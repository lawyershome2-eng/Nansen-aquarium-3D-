import { eventToParams } from './mapper.js';

// Pure logic, no DOM and no renderer. The renderer reads getRenderState().
export const STRIDE = 12; // x y z vx vy vz scale species alpha side phase variant

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULTS = {
  // CALIBRATE these to the aquarium's tank units when you wire the fork.
  bounds: { x: 30, y: 8, z: 12 },
  ambientCount: 60,
  maxEventEntities: 150,
  seed: 1,
  fadeIn: 1.5,
  fadeOut: 2.5,
};

export class Simulation {
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULTS, ...cfg, bounds: { ...DEFAULTS.bounds, ...cfg.bounds } };
    this.rand = mulberry32(this.cfg.seed);
    this.entities = [];
    this.time = 0;
    this.nextId = 1;
    this.listeners = new Set();
  }

  onSpawn(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  r(a, b) { return a + this.rand() * (b - a); }

  handleEvent(ev) {
    const eventCount = this.entities.filter((e) => e.event).length;
    if (eventCount >= this.cfg.maxEventEntities) {
      // drop the lowest-score event entity, never the new heavy one
      let worst = null;
      for (const e of this.entities) if (e.event && (!worst || e.score < worst.score)) worst = e;
      if (worst && worst.score < eventToParams(ev).score) this.remove(worst.id); else return null;
    }
    const p = eventToParams(ev);
    const B = this.cfg.bounds;
    const laneY = (p.lane.y * 2 - 1) * B.y * 0.85;
    const laneZ = (p.lane.z * 2 - 1) * B.z * 0.85;
    const e = {
      id: this.nextId++,
      event: ev,
      ambient: false,
      pos: [-p.dir * B.x * 0.95, laneY + this.r(-1, 1), laneZ + this.r(-1, 1)],
      vel: [p.dir * p.maxSpeed * 0.5, 0, 0],
      target: [p.dir * B.x * 1.05, laneY, laneZ],
      age: 0, alpha: 0, state: 'entering', phase: this.r(0, 6.28),
      ...p,
    };
    this.entities.push(e);
    this.listeners.forEach((fn) => fn(e));
    return e;
  }

  spawnAmbient() {
    const B = this.cfg.bounds;
    const e = {
      id: this.nextId++, event: null, ambient: true,
      pos: [this.r(-B.x, B.x), this.r(-B.y, B.y), this.r(-B.z, B.z)],
      vel: [this.r(-1, 1), 0, this.r(-1, 1)],
      target: null, wanderAt: 0,
      scale: this.r(0.6, 1.3), mass: 1, species: this.rand() < 0.7 ? 0 : 1,
      maxSpeed: this.r(1.5, 2.6), accel: 3, lifetime: Infinity, score: 0,
      behavior: 'cruise', dir: 0, age: 0, alpha: 1, state: 'active', t: 0, phase: this.r(0, 6.28),
    };
    this.entities.push(e);
    return e;
  }

  remove(id) {
    const i = this.entities.findIndex((e) => e.id === id);
    if (i >= 0) this.entities.splice(i, 1);
  }

  update(dt) {
    dt = Math.min(dt, 0.05); // never let a tab switch explode the physics
    this.time += dt;
    const B = this.cfg.bounds;

    let ambient = 0;
    for (const e of this.entities) if (e.ambient) ambient++;
    for (; ambient < this.cfg.ambientCount; ambient++) this.spawnAmbient();

    const list = this.entities;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.age += dt;

      // lifecycle
      if (!e.ambient) {
        const left = e.lifetime - e.age;
        const dx = e.target[0] - e.pos[0];
        if (e.state !== 'exiting' && (left < this.cfg.fadeOut || Math.abs(dx) < 2)) e.state = 'exiting';
        if (e.state === 'entering' && e.age > this.cfg.fadeIn) e.state = 'active';
        e.alpha = e.state === 'exiting'
          ? Math.max(0, Math.min(e.alpha, left / this.cfg.fadeOut))
          : Math.min(1, e.age / this.cfg.fadeIn);
        if (e.age >= e.lifetime || (e.state === 'exiting' && e.alpha <= 0.01)) { list.splice(i, 1); continue; }
      }

      // steering
      const acc = [0, 0, 0];
      if (e.ambient) {
        if (e.wanderAt <= this.time || !e.target) {
          e.target = [this.r(-B.x, B.x), this.r(-B.y, B.y), this.r(-B.z, B.z)];
          e.wanderAt = this.time + this.r(4, 10);
        }
      }
      seek(e, acc);

      // separation from nearby entities (O(n^2), fine for a few hundred)
      for (let j = 0; j < list.length; j++) {
        if (j === i) continue;
        const o = list[j];
        const dx = e.pos[0] - o.pos[0], dy = e.pos[1] - o.pos[1], dz = e.pos[2] - o.pos[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        const r = (e.scale + o.scale) * 0.9;
        if (d2 > 0 && d2 < r * r) {
          const d = Math.sqrt(d2), push = (r - d) / r * e.accel * 0.8 * (o.mass / (e.mass + o.mass));
          acc[0] += dx / d * push; acc[1] += dy / d * push; acc[2] += dz / d * push;
        }
      }

      // soft walls (event entities are allowed to leave through the x edge)
      const wall = (v, lim, axis) => {
        if (v > lim) acc[axis] -= (v - lim) * 2; else if (v < -lim) acc[axis] -= (v + lim) * 2;
      };
      if (e.ambient) wall(e.pos[0], B.x, 0);
      wall(e.pos[1], B.y, 1); wall(e.pos[2], B.z, 2);

      // integrate
      for (let k = 0; k < 3; k++) e.vel[k] += acc[k] * dt;
      const sp = Math.hypot(e.vel[0], e.vel[1], e.vel[2]);
      if (sp > e.maxSpeed) for (let k = 0; k < 3; k++) e.vel[k] *= e.maxSpeed / sp;
      for (let k = 0; k < 3; k++) { e.vel[k] *= 1 - 0.15 * dt; e.pos[k] += e.vel[k] * dt; }
      e.phase += dt * (1 + Math.hypot(e.vel[0], e.vel[1], e.vel[2]) * 0.6); // swim cycle, renderer scales it
    }
  }

  // Flat buffer for the renderer. Entity i -> fish instance i.
  getRenderState(out) {
    const n = this.entities.length;
    if (!out || out.length < n * STRIDE) out = new Float32Array(Math.max(n, 256) * STRIDE);
    for (let i = 0; i < n; i++) {
      const e = this.entities[i], o = i * STRIDE;
      out[o] = e.pos[0]; out[o + 1] = e.pos[1]; out[o + 2] = e.pos[2];
      out[o + 3] = e.vel[0]; out[o + 4] = e.vel[1]; out[o + 5] = e.vel[2];
      out[o + 6] = e.scale; out[o + 7] = e.species; out[o + 8] = e.alpha;
      out[o + 9] = e.ambient ? 0 : e.dir;
      out[o + 10] = e.phase;
      out[o + 11] = e.id & 1; // stable per entity, lets the renderer pick a model variant
    }
    return { buffer: out, count: n };
  }

  // Only the few worth a label, highest score first.
  topEntities(n = 5) {
    return this.entities.filter((e) => e.event && e.state !== 'exiting')
      .sort((a, b) => b.score - a.score).slice(0, n);
  }
}

function seek(e, acc) {
  if (!e.target) return;
  const dx = e.target[0] - e.pos[0], dy = e.target[1] - e.pos[1], dz = e.target[2] - e.pos[2];
  const d = Math.hypot(dx, dy, dz) || 1;
  const arrive = e.ambient ? Math.min(1, d / 6) : 1; // ambient fish slow down near their goal
  const want = e.maxSpeed * arrive;
  const sx = (dx / d) * want - e.vel[0], sy = (dy / d) * want - e.vel[1], sz = (dz / d) * want - e.vel[2];
  const m = Math.hypot(sx, sy, sz) || 1, lim = Math.min(m, e.accel) / m;
  acc[0] += sx * lim; acc[1] += sy * lim; acc[2] += sz * lim;
}
