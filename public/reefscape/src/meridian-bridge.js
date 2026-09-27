// Meridian bridge for the Reefscape renderer.
//
// The reef's own fish (clownfish/chromis/anthias, from ReefSimulation + createFishSchool
// in main.js) are left completely alone and serve as the ambient population.
// Event-driven trade fish are a SEPARATE population: Meridian's own Simulation class
// (imported unmodified from ../../src/simulation.js, the same file the Google Aquarium
// build used) computes position/velocity for up to POOL_CHROMIS + POOL_ANTHIAS entities,
// and this module renders them using the reef's real fish geometry and muscle-wave shader
// via two fixed-size InstancedMesh pools (one per species).
//
// Known simplifications, stated plainly rather than left implicit:
// - Event fish swim in open mid-water and do not steer around rock/coral (no REEF_BOUNDS
//   avoidance). They also do not interact with the native reef fish's separation/alignment.
//   That means a large event fish will NOT visibly push native fish aside, unlike the
//   in-tank population. Fixing that would mean folding event fish into ReefSimulation's own
//   fish array and giving them GAIT entries, which is a bigger change than this pass makes.
// - Body bend ("C-turn") is left at 0. The shader supports it (fishGait.z) but Meridian's
//   simulation doesn't currently track a smoothed turning rate to drive it, so turns will
//   look straighter than native fish. Pectoral rowing is a rough approximation, not the
//   real gait model.
// - Not run in a browser. The instancing calls mirror createFishSchool in fish-model.js
//   exactly (same attribute layout), but this has not been visually verified.

import * as THREE from 'three';
import { makeFishGeometry, fishMaterial } from './fish-model.js';
import { Simulation, STRIDE } from '../../src/simulation.js';
import { connect } from '../../src/stream.js';
import { createNameplates } from './nameplates.js';

const POOL = { chromis: 48, anthias: 32 }; // species 0/1 -> chromis, 2/3 -> anthias
const KIND_FOR_SPECIES = ['chromis', 'chromis', 'anthias', 'anthias'];
const AMPLITUDE = { chromis: 0.095, anthias: 0.095 }; // matches native non-clown amplitude
const HIDE_Y = -50; // parked far below the tank floor when a pool slot is unused

// Open mid-water box the event fish are confined to, chosen to clear the rock/coral
// layout in layout.js (ROCKS island tops sit below y~3.7, the arch pillars run to z~-1.4)
// without importing and checking against REEF_BOUNDS directly.
const ZONE = { xHalf: 8.4, yMin: 3.4, yMax: 7.0, zBack: -0.8, zFront: 4.2 };

function reefFromSim(pos, bounds, out) {
  // Meridian's soft walls damp rather than hard-clamp, so a fast entity can overshoot
  // its bounds slightly. Clamp here too so an event fish never visibly exits the
  // mid-water box regardless of simulation edge cases.
  out[0] = clamp((pos[0] / bounds.x) * ZONE.xHalf, -ZONE.xHalf, ZONE.xHalf);
  out[1] = clamp(ZONE.yMin + ((pos[1] / bounds.y + 1) / 2) * (ZONE.yMax - ZONE.yMin), ZONE.yMin, ZONE.yMax);
  out[2] = clamp(ZONE.zBack + ((pos[2] / bounds.z + 1) / 2) * (ZONE.zFront - ZONE.zBack), ZONE.zBack, ZONE.zFront);
  return out;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function makePool(scene, kind, size) {
  const geometry = makeFishGeometry(kind);
  const trimData = new Float32Array(size * 4);
  const gaitData = new Float32Array(size * 4);
  const trim = new THREE.InstancedBufferAttribute(trimData, 4).setUsage(THREE.DynamicDrawUsage);
  const gait = new THREE.InstancedBufferAttribute(gaitData, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFishTrim', trim);
  geometry.setAttribute('aFishGait', gait);
  const mesh = new THREE.InstancedMesh(geometry, fishMaterial(kind), size);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  // InstancedMesh starts every instance at an uninitialized identity matrix (scale 1,
  // position origin), not scale 0, so every slot must be explicitly parked before the
  // first update or unused fish sit visible at the tank's centre.
  const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  hideMatrix.setPosition(0, HIDE_Y, 0);
  for (let i = 0; i < size; i++) mesh.setMatrixAt(i, hideMatrix);
  mesh.instanceMatrix.needsUpdate = true;
  return { kind, size, mesh, trimData, gait: gaitData, trim, gaitAttr: gait, slots: new Array(size).fill(null), yaw: new Float32Array(size) };
}

export function createMeridianBridge(scene, camera) {
  const sim = new Simulation({ bounds: { x: 22, y: 7, z: 11 }, ambientCount: 0, maxEventEntities: POOL.chromis + POOL.anthias });
  const subs = new Set();
  let status = { mode: 'mock', state: 'connecting' };
  let resolved = null;
  let stop = null;

  function notify(type, data) {
    if (type === 'status') status = { ...status, ...data };
    if (type === 'resolved') resolved = data;
    for (const fn of subs) fn({ type, data, status, resolved });
  }

  function listen(url) {
    if (stop) stop();
    stop = null;
    for (let i = sim.entities.length - 1; i >= 0; i--) {
      if (sim.entities[i].event) sim.entities.splice(i, 1);
    }
    status = { state: 'connecting' };
    resolved = null;
    for (const fn of subs) fn({ type: 'status', data: status, status, resolved });
    stop = connect({
      url,
      onEvent: (ev) => sim.handleEvent(ev),
      onStatus: (s) => notify('status', s),
      onResolved: (r) => notify('resolved', r),
    });
  }

  listen('/api/stream');

  const pools = { chromis: makePool(scene, 'chromis', POOL.chromis), anthias: makePool(scene, 'anthias', POOL.anthias) };
  const plates = createNameplates(scene);
  const dummy = new THREE.Object3D();
  const euler = new THREE.Euler(0, 0, 0, 'YZX');
  const pos3 = [0, 0, 0];
  let buf = null;

  function slotFor(pool, id) {
    const i = pool.slots.indexOf(id);
    if (i >= 0) return i;
    const free = pool.slots.indexOf(null);
    return free; // -1 if the pool is full; caller drops the entity for this frame
  }

  return {
    sim,
    listen,
    subscribe(fn) {
      subs.add(fn);
      fn({ type: 'status', data: status, status, resolved });
      return () => subs.delete(fn);
    },

    update(dt) {
      sim.update(dt);
      const r = sim.getRenderState(buf);
      buf = r.buffer;

      const liveIds = { chromis: new Set(), anthias: new Set() };
      plates.begin();
      for (let i = 0; i < r.count; i++) {
        const o = i * STRIDE;
        const kind = KIND_FOR_SPECIES[buf[o + 7]];
        // sim entity id isn't in the buffer; recover it via array order (buffer is built
        // from sim.entities in the same order every call within a frame)
        const id = sim.entities[i].id;
        liveIds[kind].add(id);
        const pool = pools[kind];
        const slot = slotFor(pool, id);
        if (slot < 0) continue; // pool full this frame, entity just doesn't render
        pool.slots[slot] = id;

        reefFromSim([buf[o], buf[o + 1], buf[o + 2]], sim.cfg.bounds, pos3);
        const vx = buf[o + 3], vy = buf[o + 4], vz = buf[o + 5];
        const speed = Math.hypot(vx, vy, vz);
        const scale = (buf[o + 6] / 5) * 0.28; // sim scale ~0.8..4.8 -> reef fish size units
        const alpha = buf[o + 8];
        const phase = buf[o + 10];
        pos3[1] += Math.sin(phase * 0.85) * Math.min(0.12, scale * 0.55);

        dummy.position.set(pos3[0], pos3[1], pos3[2]);
        dummy.scale.setScalar(alpha > 0.02 ? Math.max(scale, 0.001) : 0);
        const yaw = Math.atan2(-vz, vx || 1e-6);
        let turn = yaw - pool.yaw[slot];
        if (turn > Math.PI) turn -= Math.PI * 2;
        if (turn < -Math.PI) turn += Math.PI * 2;
        pool.yaw[slot] = yaw;
        const bend = Math.max(-0.55, Math.min(0.55, turn * 6));
        const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(vy, Math.hypot(vx, vz) || 1e-6)));
        euler.set(0, yaw, pitch);
        dummy.quaternion.setFromEuler(euler);
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(slot, dummy.matrix);
        if (camera && alpha > 0.08) plates.stick(pos3[0], pos3[1], pos3[2], scale, alpha, sim.entities[i].event, camera);

        const wave = Math.min(1, speed / (buf[o + 6] * 1.4 + 0.5));
        const tailAmplitude = AMPLITUDE[kind] * wave;
        const trimVariant = (slot * 0.6180339887 + 0.31) % 1; // same golden-ratio spread the reef uses
        pool.trimData.set([phase, tailAmplitude, trimVariant, 0], slot * 4);
        pool.gait.set([phase * 0.5, 1, bend, 0], slot * 4);
      }
      plates.end();

      for (const kind of ['chromis', 'anthias']) {
        const pool = pools[kind];
        for (let s = 0; s < pool.size; s++) {
          if (pool.slots[s] !== null && !liveIds[kind].has(pool.slots[s])) {
            pool.slots[s] = null;
            dummy.position.set(0, HIDE_Y, 0);
            dummy.scale.setScalar(0);
            dummy.quaternion.identity();
            dummy.updateMatrix();
            pool.mesh.setMatrixAt(s, dummy.matrix);
            pool.trimData.set([0, 0, 0, 0], s * 4);
          }
        }
        pool.trim.needsUpdate = true;
        pool.gaitAttr.needsUpdate = true;
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
