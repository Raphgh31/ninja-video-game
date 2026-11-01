import { loadCharacter, loadImage, loadJson } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { TouchControls } from './engine/touch.js';
import { Level } from './game/level.js';
import { Player } from './game/player.js';
import { Shurikens } from './game/shuriken.js';
import { Tate, TATE } from './game/tate.js';
import { DAMAGE_DEALT, HEALTH } from './game/combat.js';
import { HealthBar } from './game/healthbar.js';
import { Fx } from './engine/fx.js';
import { isMuted, play as sfx, setMuted, unlockAudio } from './engine/sfx.js';
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
player.onThrow = (x, y, dir, height) => {
  sfx('throw');
  shurikens.throw(x, y, dir, height);
};
player.canThrow = () => shurikens.canThrow();
// ennemi : TATE, posté au milieu du terrain
const tateMeta = await loadJson('./characters/tate/tate.json');
const tate = new Tate(tateMeta, await loadImage(`./characters/tate/${tateMeta.image}`),
  await loadImage(`./characters/tate/${tateMeta.glowImage}`), 30 * 16, level.spawn.y);
shurikens.enemies.push(tate);
// ---- effets : poussière, étincelles, secousses, micro-arrêts, sons ----------
const fx = new Fx();
player.onEvent = (n, d) => {
  switch (n) {
    case 'jump': sfx('jump'); fx.dust(d.x, d.y, 5, { spread: 25, up: 15 }); break;
    case 'land':
      if (d.speed > 140) {
        const k = Math.min(1, d.speed / 420);
        sfx('land', { strength: 0.5 + 0.5 * k });
        fx.dust(d.x - 3, d.y, 3 + Math.round(k * 4), { dir: -1 });
        fx.dust(d.x + 3, d.y, 3 + Math.round(k * 4), { dir: 1 });
        if (d.speed > 400) fx.shake(1, 0.12);
      }
      break;
    case 'dash': sfx('dash'); fx.dust(d.x - d.dir * 4, d.y, 7, { dir: -d.dir, spread: 50, up: 12 }); break;
    case 'step':
      sfx('step', { sprint: d.sprint });
      if (d.sprint) fx.dust(d.x - d.facing * 4, d.y, 2, { dir: -d.facing, up: 10, life: 0.3 });
      break;
    case 'skid': sfx('skid'); break;
    case 'skid_dust': fx.dust(d.x + d.facing * 6, d.y, 2, { dir: d.facing, spread: 40, up: 10, life: 0.3 }); break;
    case 'slide': sfx('slide'); break;
    case 'slide_dust': fx.dust(d.x - d.facing * 2, d.y, 2, { dir: -d.facing, spread: 20, up: 12, life: 0.35 }); break;
    case 'wall_grab': sfx('wallGrab'); break;
    case 'wall_slide':
      sfx('wallSlide');
      fx.dust(d.x + d.side * 5, d.y - 14, 1, { dir: -d.side, spread: 10, up: -10, life: 0.35 });
      break;
    case 'wall_jump': sfx('wallJump'); fx.dust(d.x + d.side * 5, d.y - 12, 6, { dir: -d.side, spread: 40, up: 20 }); break;
    case 'swing': sfx('swing'); break;
    case 'swing_heavy': sfx('swingHeavy'); break;
    case 'hurt':
      sfx('hurt');
      fx.shake(2, 0.2);
      fx.sparks(d.x, d.y - 14, 6, { palette: 'hit', dir: Math.sign(d.x - d.fromX) });
      break;
    case 'death': sfx('death'); fx.shake(2, 0.25); break;
    case 'respawn': sfx('respawn'); break;
    default:
  }
};
shurikens.onEvent = (n, d) => {
  switch (n) {
    case 'empty': sfx('empty'); break;
    case 'pickup': sfx('pickup'); break;
    case 'deflect': sfx('deflect'); fx.sparks(d.x, d.y, 4, { dir: d.dir, speed: 70 }); break;
    case 'stick': sfx('stick'); fx.dust(d.x, d.y, 2, { spread: 15, up: 10, life: 0.25 }); break;
    default:
  }
};
tate.onEvent = (n, d) => {
  switch (n) {
    case 'step': sfx('tateStep'); fx.dust(d.x - 6, d.y, 2, { dir: -1, up: 8 }); fx.dust(d.x + 6, d.y, 2, { dir: 1, up: 8 }); break;
    case 'windup': sfx('tateWindup'); break;
    case 'bash': sfx('tateBash'); fx.dust(d.x - d.facing * 8, d.y, 6, { dir: -d.facing, spread: 40 }); break;
    case 'bash_hit': fx.shake(3, 0.3); break;
    case 'block': sfx('block'); fx.sparks(d.x, d.y, 7, { dir: d.facing, speed: 100 }); break;
    case 'hit': sfx('hit'); fx.sparks(d.x, d.y - 16, 8, { palette: 'hit' }); break;
    case 'stunned': sfx('tateStun'); break;
    case 'defeat_kneel': sfx('tateKneel'); fx.dust(d.x, d.y, 5, { spread: 30 }); break;
    case 'defeat_impact':
      sfx('tateFall');
      fx.shake(2, 0.25);
      fx.dust(d.x - 4, d.y, 6, { dir: -1, spread: 45 });
      fx.dust(d.x + 14 * d.facing, d.y, 6, { dir: 1, spread: 45 });
      break;
    default:
  }
};

// son : débloqué au premier geste ; bouton et touche M pour le couper
const muteBtn = document.querySelector('.mute');
function refreshMute() {
  muteBtn.textContent = isMuted() ? 'Son coupé' : 'Son';
  muteBtn.setAttribute('aria-pressed', String(isMuted()));
}
muteBtn.addEventListener('click', () => { setMuted(!isMuted()); refreshMute(); muteBtn.blur(); });
refreshMute();
for (const t of ['keydown', 'pointerdown', 'touchstart']) addEventListener(t, unlockAudio, { capture: true, passive: true });

// barres de vie fines au-dessus de chaque personnage
const kageBar = new HealthBar(HEALTH.max);
const tateBar = new HealthBar(TATE.hp);
player.onRespawn = () => {
  shurikens.reset();
  tate.reset();
  kageBar.reset();
  tateBar.reset();
};
const input = new Input();
touch = MOBILE ? new TouchControls(canvas, input) : null;
if (MOBILE) {
  // plein écran au premier contact (refusé sans gravité si le navigateur ne le permet pas)
  canvas.addEventListener('pointerdown', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, { once: true });
}
const camera = { x: 0, y: 0 };
let debug = false;

const stateEl = document.querySelector('[data-state]');

function update(dt) {
  // touches d'interface : traitées même pendant un micro-arrêt
  if (input.wasPressed('debug')) { debug = !debug; input.pressed.delete('debug'); }
  if (input.wasPressed('mute')) { setMuted(!isMuted()); refreshMute(); input.pressed.delete('mute'); }
  // micro-arrêt sur un coup : tout se fige un instant (les appuis de jeu sont gardés)
  if (fx.frozen(dt)) return;
  player.update(dt, input);
  // le sprint tactile se coupe tout seul à l'arrêt ou quand on est essoufflé
  if (touch?.sprintOn) {
    const moving = input.isHeld('left') || input.isHeld('right');
    touch.idleSprint = moving ? 0 : (touch.idleSprint ?? 0) + dt;
    if (player.energy.exhausted || touch.idleSprint > 0.5) touch.setSprint(false);
  }
  level.update(dt);
  shurikens.update(dt);
  tate.update(dt, player);
  tate.interact(player);
  const ab = player.attackBox();
  if (ab) {
    const heavy = player.state === 'air_attack';
    const r = tate.takeHit(ab, player.x, player.attackId, heavy ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword);
    if (r === 'hit') {
      fx.hitStop(heavy ? 0.11 : 0.07);
      if (heavy) fx.shake(2, 0.18);
    } else if (r === 'blocked') {
      fx.hitStop(0.04);
    }
  }
  fx.update(dt);
  if (player.state !== 'death' && player.state !== 'respawn') shurikens.pickup(player.box());
  kageBar.update(dt, player.hp);
  tateBar.update(dt, Math.max(0, tate.hp));
  const tx = Math.min(Math.max(player.x - VIEW_W * 0.4, 0), level.width - VIEW_W);
  const ty = Math.min(Math.max(player.y - VIEW_H * 0.62, 0), level.height - VIEW_H);
  camera.x += (tx - camera.x) * Math.min(1, dt * 8);
  camera.y += (ty - camera.y) * Math.min(1, dt * 6);
  input.endFrame();
}

function draw() {
  // secousse de l'écran : décalage temporaire de la caméra
  const shake = fx.offset();
  const cam = { x: camera.x + shake.x, y: camera.y + shake.y };
  level.draw(ctx, cam, VIEW_W, VIEW_H);
  level.drawTargets(ctx, cam);
  shurikens.drawStuck(ctx, look.projectiles.shuriken, cam);
  tate.draw(ctx, cam, player);
  player.draw(ctx, look.sheet, cam);
  shurikens.drawFlying(ctx, look.projectiles.shuriken, cam);
  fx.draw(ctx, cam);
  // barres de vie : au-dessus de la tête, elles suivent chaque personnage
  if (!tate.gone) {
    const fade = tate.state === 'defeated' ? Math.max(0, 1 - tate.timer / 0.6) : 1;
    tateBar.draw(ctx, tate.x - cam.x, tate.y - cam.y - 27, fade);
  }
  if (player.state !== 'death' && player.state !== 'respawn') {
    kageBar.draw(ctx, player.x - cam.x, player.y - cam.y - 27);
  }
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
    for (const [name, color] of [['body', '#ff3b3b'], ['shield', '#3bb3ff']]) {
      const tb = tate.box(name);
      ctx.strokeStyle = color;
      ctx.strokeRect(Math.round(tb.x - cam.x) + 0.5, Math.round(tb.y - cam.y) + 0.5, tb.w - 1, tb.h - 1);
    }
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(Math.round(player.x - cam.x), Math.round(player.y - cam.y), 1, 1);
  }
  stateEl.textContent = `${player.state} · frame ${player.anim.frame + 1}/${player.anim.anim.frameCount} · énergie ${Math.round(player.energy.value * 100)} % · vie ${player.hp}/${HEALTH.max}`;
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
window.__kage = { player, input, level, shurikens, touch, tate, fx };
