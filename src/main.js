import { loadCharacter } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { Level } from './game/level.js';
import { Player } from './game/player.js';
import './style.css';

const VIEW_W = 320;
const VIEW_H = 180;

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Mise à l'échelle entière : chaque pixel du sprite reste un carré net.
function fit() {
  const stage = canvas.parentElement.getBoundingClientRect();
  const scale = Math.max(1, Math.floor(Math.min(stage.width / VIEW_W, stage.height / VIEW_H)));
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', fit);

const { meta, skins } = await loadCharacter('./characters/kage', 'kage.json');
let skinId = 'encre';
const level = new Level();
const player = new Player(meta, level);
const input = new Input();
input.bindTouch(document.querySelector('.touch'));
const cam = { x: 0, y: 0 };
let debug = false;

const skinBar = document.querySelector('.skins');
for (const id of Object.keys(skins)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = skins[id].name;
  b.dataset.skin = id;
  b.setAttribute('aria-pressed', String(id === skinId));
  b.addEventListener('click', () => {
    skinId = id;
    for (const o of skinBar.children) o.setAttribute('aria-pressed', String(o.dataset.skin === id));
    b.blur();
  });
  skinBar.append(b);
}
const stateEl = document.querySelector('[data-state]');

function update(dt) {
  if (input.wasPressed('debug')) debug = !debug;
  player.update(dt, input);
  const tx = Math.min(Math.max(player.x - VIEW_W * 0.4, 0), level.width - VIEW_W);
  const ty = Math.min(Math.max(player.y - VIEW_H * 0.62, 0), level.height - VIEW_H);
  cam.x += (tx - cam.x) * Math.min(1, dt * 8);
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  input.endFrame();
}

function draw() {
  level.draw(ctx, cam, VIEW_W, VIEW_H);
  player.draw(ctx, skins[skinId].sheet, cam);
  if (debug) {
    const b = player.box();
    ctx.strokeStyle = '#ff3b3b';
    ctx.strokeRect(Math.round(b.x - cam.x) + 0.5, Math.round(b.y - cam.y) + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(Math.round(player.x - cam.x), Math.round(player.y - cam.y), 1, 1);
  }
  stateEl.textContent = `${player.state} · frame ${player.anim.frame + 1}/${player.anim.anim.frameCount}`;
}

// Boucle à pas fixe (120 Hz) pour une physique stable quel que soit l'écran.
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(frame);
}
fit();
requestAnimationFrame(frame);

// Accès pour les tests automatisés.
window.__kage = { player, input, level };
