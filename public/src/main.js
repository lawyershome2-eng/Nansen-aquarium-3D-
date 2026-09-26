import { Simulation } from './simulation.js';
import { connect } from './stream.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const sim = new Simulation();
window.Meridian = { sim }; // the aquarium fork will read sim.getRenderState()

let status = { state: 'connecting' }, received = 0;
connect({
  onEvent: (ev) => { received++; sim.handleEvent(ev); },
  onStatus: (s) => { status = { ...status, ...s }; },
});

const fit = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
addEventListener('resize', fit); fit();

const COLORS = ['#7fd6ff', '#5fb0ff', '#9b8cff', '#ff9bd6'];
const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n}`;

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  sim.update(dt);

  const W = canvas.width, H = canvas.height, B = sim.cfg.bounds;
  const sx = W / (B.x * 2.2), sy = H / (B.y * 2.6);
  ctx.fillStyle = '#04141f'; ctx.fillRect(0, 0, W, H);

  for (const e of sim.entities) {
    const x = W / 2 + e.pos[0] * sx, y = H / 2 - e.pos[1] * sy;
    const r = e.scale * 5 * devicePixelRatio;
    ctx.globalAlpha = (e.ambient ? 0.35 : 0.95) * e.alpha;
    ctx.fillStyle = e.ambient ? '#4b7d95' : ({ buy: '#5dffa4', in: '#7fd6ff', sell: '#ff6b6b', out: '#ffb057', transfer: '#e7d38a' })[e.event?.side] || '#e8f6ff';
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, Math.atan2(-e.vel[1], e.vel[0]), 0, 7); ctx.fill();
    if (!e.ambient) { ctx.strokeStyle = COLORS[e.species]; ctx.lineWidth = 2; ctx.stroke(); }
  }

  // labels for the top few only
  ctx.globalAlpha = 1; ctx.font = `${12 * devicePixelRatio}px system-ui`; ctx.fillStyle = '#e8f6ff';
  for (const e of sim.topEntities(5)) {
    const x = W / 2 + e.pos[0] * sx, y = H / 2 - e.pos[1] * sy - e.scale * 9 * devicePixelRatio;
    ctx.fillText(`${e.event.from.label} ${e.event.side.toUpperCase()} ${e.event.token.symbol} ${fmt(e.event.usd)}`, x - 40, y);
  }

  const n = sim.entities.filter((e) => e.event).length;
  hud.textContent = `${status.mode || ''} ${status.state} | events ${received} | live fish ${n} | ${(1 / dt).toFixed(0)} fps`
    + (status.creditsRemaining != null ? ` | credits ${status.creditsRemaining}` : '')
    + (status.error ? ` | ${status.error.slice(0, 80)}` : '');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
