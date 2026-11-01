import { loadCharacter } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { TouchControls } from './engine/touch.js';
import { Level } from './game/level.js';
import { Player } from './game/player.js';
import { Shurikens } from './game/shuriken.js';
import './style.css';

// Ordinateur : 320×180 fixe. Mobile (écran tactile) : plein écran ; l'échelle
// reste entière (pixels nets) et c'est la zone visible qui s'adapte à l'écran.
const MOBILE = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('mobile', MOBILE);
let VIEW_W = 320;
let VIEW_H = 180;
let SCALE = 1;
let touch = null;   // commandes tactiles (créées une fois les sprites chargés)

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Mise à l'échelle entière : chaque pixel du sprite reste un carré net.
function fit() {
  if (MOBILE) {
    const W = window.innerWidth, H = window.innerHeight;
    // au moins ~240×150 pixels de jeu visibles en paysage (180 de large en portrait)
    SCALE = Math.max(1, Math.floor(Math.min(W / (W > H ? 240 : 180), H / 150)));
    VIEW_W = Math.ceil(W / SCALE);
    VIEW_H = Math.ceil(H / SCALE);
  } else {
    const stage = canvas.parentElement.getBoundingClientRect();
    SCALE = Math.max(1, Math.floor(Math.min(stage.width / 320, stage.height / 180)));
    VIEW_W = 320;
    VIEW_H = 180;
  }
  if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    ctx.imageSmoothingEnabled = false;
  }
  canvas.style.width = `${VIEW_W * SCALE}px`;
  canvas.style.height = `${VIEW_H * SCALE}px`;
  touch?.layout(VIEW_W, VIEW_H, SCALE);
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

const { meta, skins } = await loadCharacter('./characters/kage', 'kage.json');
const look = skins.encre;   // palette du ninja noir (les skins viendront plus tard)
const level = new Level();
const player = new Player(meta, level);
const shurikens = new Shurikens(level, meta);
player.onThrow = (x, y, dir, height) => shurikens.throw(x, y, dir, height);
player.canThrow = () => shurikens.canThrow();
player.onRespawn = () => shurikens.reset();
const input = new Input();
touch = MOBILE ? new TouchControls(canvas, input) : null;
if (MOBILE) {
  // plein écran au premier contact (refusé sans gravité si le navigateur ne le permet pas)
  canvas.addEventListener('pointerdown', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, { once: true });
}
const cam = { x: 0, y: 0 };
let debug = false;

const stateEl = document.querySelector('[data-state]');

function update(dt) {
  if (input.wasPressed('debug')) debug = !debug;
  player.update(dt, input);
  level.update(dt);
  shurikens.update(dt);
  if (player.state !== 'death' && player.state !== 'respawn') shurikens.pickup(player.box());
  const tx = Math.min(Math.max(player.x - VIEW_W * 0.4, 0), level.width - VIEW_W);
  const ty = Math.min(Math.max(player.y - VIEW_H * 0.62, 0), level.height - VIEW_H);
  cam.x += (tx - cam.x) * Math.min(1, dt * 8);
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  input.endFrame();
}

function draw() {
  level.draw(ctx, cam, VIEW_W, VIEW_H);
  level.drawTargets(ctx, cam);
  shurikens.drawStuck(ctx, look.projectiles.shuriken, cam);
  player.draw(ctx, look.sheet, cam);
  shurikens.drawFlying(ctx, look.projectiles.shuriken, cam);
  // interface en haut à gauche : anneau d'énergie, puis stock de shurikens
  player.energy.draw(ctx, 13, 13, { always: true });
  shurikens.drawHud(ctx, look.projectiles.shuriken, 26, 8);
  touch?.draw(ctx);
  if (debug) {
    const b = player.box();
    ctx.strokeStyle = '#ff3b3b';
    ctx.strokeRect(Math.round(b.x - cam.x) + 0.5, Math.round(b.y - cam.y) + 0.5, b.w - 1, b.h - 1);
    const ab = player.attackBox();
    if (ab) {
      ctx.strokeStyle = '#ffd400';
      ctx.strokeRect(Math.round(ab.x - cam.x) + 0.5, Math.round(ab.y - cam.y) + 0.5, ab.w - 1, ab.h - 1);
    }
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(Math.round(player.x - cam.x), Math.round(player.y - cam.y), 1, 1);
  }
  stateEl.textContent = `${player.state} · frame ${player.anim.frame + 1}/${player.anim.anim.frameCount} · énergie ${Math.round(player.energy.value * 100)} %`;
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
window.__kage = { player, input, level, shurikens, touch };
