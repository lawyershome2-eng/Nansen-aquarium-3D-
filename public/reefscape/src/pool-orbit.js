// Turn the tank the way Three.js r180 OrbitControls does on a phone:
// one finger rotates, two fingers dolly. No pan, so the pool stays in frame.
// https://threejs.org/docs/pages/OrbitControls.html

import * as THREE from 'three';

const TAU = Math.PI * 2;

export function installPoolOrbit(camera, dom, { onChange } = {}) {
  const pivot = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const pointers = new Map();
  let aimed = false;
  let dragging = false;
  let pinch = 0;

  function read() {
    offset.copy(camera.position).sub(pivot);
    if (offset.lengthSq() < 1e-6) offset.set(0, 0.5, 1);
    spherical.setFromVector3(offset);
  }

  function apply() {
    spherical.radius = Math.max(6.5, Math.min(32, spherical.radius));
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    camera.position.copy(pivot).add(offset);
    camera.lookAt(pivot);
    camera.updateMatrixWorld();
    onChange?.();
  }

  function span() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function down(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: 0 });
    pinch = span();
    try { dom.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
    if (event.pointerType !== 'mouse') event.preventDefault();
  }

  function move(event) {
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;
    prev.moved += Math.abs(dx) + Math.abs(dy);

    if (pointers.size >= 2) {
      const next = span();
      if (pinch > 8 && next > 8) {
        spherical.radius *= pinch / next;
        aimed = true;
        dragging = true;
        apply();
      }
      pinch = next;
      event.preventDefault();
      return;
    }

    if (prev.moved < 2) return;
    const height = dom.clientHeight || 1;
    const width = dom.clientWidth || 1;
    // A short swipe should turn the tank. Vertical room is wide on purpose:
    // the opening view already sits near the old clamp, so a tight limit felt stuck.
    spherical.theta -= TAU * dx / width * 1.35;
    spherical.phi -= TAU * dy / height * 1.15;
    spherical.phi = Math.max(0.28, Math.min(1.72, spherical.phi));
    aimed = true;
    dragging = true;
    apply();
    event.preventDefault();
  }

  function up(event) {
    const prev = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    pinch = span();
    const tap = Boolean(prev && prev.moved < 8 && pointers.size === 0);
    if (pointers.size === 0) dragging = false;
    if (tap) dom.dispatchEvent(new CustomEvent('pool-tap', { detail: event }));
  }

  dom.style.touchAction = 'none';
  dom.addEventListener('pointerdown', down);
  dom.addEventListener('pointermove', move, { passive: false });
  dom.addEventListener('pointerup', up);
  dom.addEventListener('pointercancel', up);

  return {
    get aimed() { return aimed; },
    get dragging() { return dragging; },
    setTarget(x, y, z) {
      pivot.set(x, y, z);
      read();
    },
    sync() { read(); },
    relinquish() {
      aimed = false;
      read();
    },
  };
}
