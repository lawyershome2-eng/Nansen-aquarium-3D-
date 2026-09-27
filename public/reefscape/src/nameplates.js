// A name rides on the fish that owns it. Sprites live in the tank, at that
// fish's position, so orbiting the pool cannot leave the caption behind.

import * as THREE from 'three';
import { fishCaption } from '../../src/fish-labels.js';

const W = 512;
const H = 160;
const SIDE = {
  buy: '#7dcea0',
  sell: '#ff8d8d',
  in: '#8fd4ff',
  out: '#ffc48a',
  transfer: '#e7d38a',
};

function paint(ctx, caption) {
  ctx.clearRect(0, 0, W, H);
  const sub = caption.who ? `${caption.meta} · ${caption.who}` : caption.meta;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '600 58px sans-serif';
  const symbolW = ctx.measureText(caption.symbol).width;
  ctx.font = '500 32px sans-serif';
  const subW = sub ? ctx.measureText(sub).width : 0;
  const boxW = Math.min(W - 8, Math.max(symbolW, subW) + 40);
  const boxH = sub ? 128 : 78;
  const x = (W - boxW) / 2;
  const y = H - boxH;
  ctx.fillStyle = 'rgba(4, 16, 29, 0.82)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = SIDE[caption.side] || '#e7f4ff';
  ctx.fillRect(x, y, 8, boxH);
  ctx.fillStyle = '#e7f4ff';
  ctx.font = '600 58px sans-serif';
  ctx.fillText(caption.symbol, x + 20, y + (sub ? 42 : boxH / 2));
  if (sub) {
    ctx.fillStyle = '#9fd3ea';
    ctx.font = '500 32px sans-serif';
    ctx.fillText(sub, x + 20, y + 96);
  }
}

function makePlate() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  // Bottom of the plate sits on the fish. The words grow up its back.
  sprite.center.set(0.5, 0.02);
  sprite.frustumCulled = false;
  sprite.visible = false;
  sprite.renderOrder = 3;
  sprite.userData.ctx = ctx;
  sprite.userData.map = map;
  sprite.userData.key = '';
  return sprite;
}

export function createNameplates(scene) {
  const plates = [];
  const ahead = new THREE.Vector3();
  let used = 0;

  function plateAt(index) {
    let sprite = plates[index];
    if (sprite) return sprite;
    sprite = makePlate();
    plates.push(sprite);
    scene.add(sprite);
    return sprite;
  }

  return {
    begin() { used = 0; },
    stick(x, y, z, fishScale, alpha, event, camera) {
      if (!(alpha > 0.08) || !(fishScale > 0)) return;
      const sprite = plateAt(used++);
      const caption = fishCaption(event);
      const key = `${caption.side}|${caption.symbol}|${caption.meta}|${caption.who}`;
      if (sprite.userData.key !== key) {
        paint(sprite.userData.ctx, caption);
        sprite.userData.map.needsUpdate = true;
        sprite.userData.key = key;
      }
      ahead.set(camera.position.x - x, camera.position.y - y, camera.position.z - z);
      const len = ahead.length() || 1;
      // A few centimetres toward the glass, so the body does not swallow the type.
      const nudge = 0.08 + fishScale * 0.2;
      sprite.position.set(x + (ahead.x / len) * nudge, y + fishScale * 0.15, z + (ahead.z / len) * nudge);
      const width = Math.max(1.15, fishScale * 6.5);
      sprite.scale.set(width, width * (H / W), 1);
      sprite.material.opacity = Math.min(1, alpha);
      sprite.visible = true;
    },
    end() {
      for (let i = used; i < plates.length; i++) plates[i].visible = false;
    },
  };
}
