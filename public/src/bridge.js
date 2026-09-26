// Glue between the simulation and the stock Google Aquarium renderer.
// Load as <script type="module" src="/src/bridge.js"> in aquarium.html.
// The two hooks patched into aquarium.js call step() and drawModel().
import { Simulation, STRIDE } from './simulation.js';
import { connect } from './stream.js';

// Tank calibration from aquarium.js: globe radius 74, stock fish live at y ~ 25 (+ up to ~18),
// stock orbits reach radius ~55. This box keeps the corners inside that circle.
const BOUNDS = { x: 45, y: 11, z: 25 };
const CENTER_Y = 25;
const HEAD = 2;               // how far "behind" the fish the look-at point sits, like the stock 0.04 clock step
const TWO_PI = Math.PI * 2;

// aquarium.js g_fishTable order: 0 SmallFishA, 1 MediumFishA, 2 MediumFishB, 3 BigFishA, 4 BigFishB
const MODEL_COUNT = 5;
// sim species (small, medium, big, shark) -> the divisor that maps sim scale to stock scale 1..2
const SCALE_DIV = [1, 1.6, 2, 2];
// swim-cycle speed per model, roughly matching each stock model's tailSpeed
const TAIL_MULT = [6, 2, 5, 1, 1];

function modelFor(species, variant) {
  if (species === 0) return 0;
  if (species === 1) return variant ? 2 : 1;
  return species === 2 ? 4 : 3;
}

const sim = new Simulation({ bounds: BOUNDS, ambientCount: 60, maxEventEntities: 80 });
let buf = null;
let count = 0;
const buckets = Array.from({ length: MODEL_COUNT }, () => []);
const status = { state: 'connecting' };

connect({
  onEvent: (ev) => sim.handleEvent(ev),
  onStatus: (s) => Object.assign(status, s),
});

const api = {
  sim,
  status,

  // Once per frame, from onAnimationFrame. Not from render(), which runs twice per frame in stereo.
  step(dt) {
    sim.update(dt);
    const r = sim.getRenderState(buf);
    buf = r.buffer; count = r.count;
    for (const b of buckets) b.length = 0;
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE;
      buckets[modelFor(buf[o + 7], buf[o + 11])].push(i);
    }
  },

  // Called from render() right after fish.drawPrep(). Draws every fish of model `ff`.
  // Returns true so the stock orbit loop is skipped.
  drawModel(ff, fish, per, info, fishSetting, drawLasers, fishScale) {
    if (!buf) return true; // nothing simulated yet, draw nothing
    const list = buckets[ff];
    const n = list.length;
    info.num[fishSetting] = n; // the stock laser passes read this
    const pos = per.worldPosition, next = per.nextPosition;
    const fs = fishScale == null ? 1 : fishScale;
    for (let k = 0; k < n; k++) {
      const o = list[k] * STRIDE;
      const x = buf[o], y = buf[o + 1] + CENTER_Y, z = buf[o + 2];
      const vx = buf[o + 3], vy = buf[o + 4], vz = buf[o + 5];
      const sp = Math.hypot(vx, vy, vz);
      // Stock code points nextPosition slightly BEHIND the fish (clock - 0.04). Keep that convention.
      const ux = sp > 1e-3 ? vx / sp : 1, uy = sp > 1e-3 ? vy / sp : 0, uz = sp > 1e-3 ? vz / sp : 0;
      pos[0] = x; pos[1] = y; pos[2] = z;
      next[0] = x - ux * HEAD; next[1] = y - uy * HEAD; next[2] = z - uz * HEAD;
      // the stock shader has no alpha, so fade by shrinking
      const fade = Math.max(0.02, buf[o + 8]);
      per.scale = (buf[o + 6] / SCALE_DIV[buf[o + 7]]) * fs * fade;
      per.time = (buf[o + 10] * TAIL_MULT[ff]) % TWO_PI;
      fish.draw(per);
      if (drawLasers && info.lasers) {
        info.fishData[k] = {
          position: [x, y, z], target: [next[0], next[1], next[2]], scale: per.scale, time: per.time,
        };
      }
    }
    return true;
  },
};

window.Meridian = api;
