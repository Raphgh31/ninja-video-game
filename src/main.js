import { loadCharacter, loadImage, loadJson } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { TouchControls } from './engine/touch.js';
import { Level } from './game/level.js';
import { Player } from './game/player.js';
import { Shurikens } from './game/shuriken.js';
import { Tate, TATE } from './game/tate.js';
import { Wara, WARA } from './game/wara.js';
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
// niveau : #terrain = terrain d'essai, sinon niveau 1
const LEVEL_ID = location.hash === '#terrain' ? 'terrain' : 'niveau-1';
const level = new Level(LEVEL_ID);
addEventListener('hashchange', () => location.reload());
const player = new Player(meta, level);
const shurikens = new Shurikens(level, meta);
player.onThrow = (x, y, dir, height) => {
  sfx('throw');
  shurikens.throw(x, y, dir, height);
};
player.canThrow = () => shurikens.canThrow();
// ennemis : un TATE à chaque repère « E » de la carte
const tateMeta = await loadJson('./characters/tate/tate.json');
const tateSheet = await loadImage(`./characters/tate/${tateMeta.image}`);
const tateGlow = await loadImage(`./characters/tate/${tateMeta.glowImage}`);
const tates = level.enemies.map((e) => new Tate(tateMeta, tateSheet, tateGlow, e.x, e.y, level));
shurikens.enemies.push(...tates);
// WARA : un épouvantail à chaque repère « W » de la carte
const waraMeta = await loadJson('./characters/wara/wara.json');
const waraSheet = await loadImage(`./characters/wara/${waraMeta.image}`);
const waras = level.waras.map((w) => new Wara(waraMeta, waraSheet, w.x, w.y, level));
shurikens.enemies.push(...waras);
const enemies = [...tates, ...waras];
// partie : chronomètre, chutes, arrivée
const run = { time: 0, falls: 0, won: false };
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
    case 'death': sfx('death'); fx.shake(2, 0.25); run.falls++; break;
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
function onTateEvent(n, d) {
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
}
for (const t of tates) t.onEvent = onTateEvent;
function onWaraEvent(n, d) {
  switch (n) {
    case 'crouch': sfx('waraHop'); break;
    case 'land': fx.dust(d.x, d.y, 3, { spread: 18, up: 8, life: 0.3 }); break;
    case 'windup': sfx('waraWindup'); break;
    case 'spin': sfx('waraSpin'); break;
    case 'spin_hit': fx.shake(2, 0.2); break;
    case 'dizzy': sfx('waraDizzy'); break;
    case 'block': sfx('waraBlock'); fx.sparks(d.x + d.facing * 10, d.y, 5, { dir: d.facing, speed: 80, palette: 'straw' }); break;
    case 'hit': sfx('waraHit'); fx.sparks(d.x, d.y - 16, 9, { palette: 'straw', speed: 100 }); break;
    case 'death_poof': sfx('waraPoof'); fx.sparks(d.x, d.y - 14, 14, { palette: 'straw', speed: 120 }); fx.dust(d.x, d.y, 5, { spread: 30 }); break;
    case 'death_pile': fx.dust(d.x - 4, d.y, 4, { dir: -1, spread: 25 }); fx.dust(d.x + 4, d.y, 4, { dir: 1, spread: 25 }); break;
    default:
  }
}
for (const w of waras) w.onEvent = onWaraEvent;
level.onEvent = (n, d) => {
  switch (n) {
    case 'gong': sfx('gong'); sfx('door'); fx.shake(1, 0.25); fx.sparks(d.x, d.y, 8, { speed: 70 }); break;
    case 'checkpoint': sfx('checkpoint'); fx.sparks(d.x, d.y - 16, 5, { speed: 40 }); break;
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
for (const t of tates) t.bar = new HealthBar(TATE.hp);
for (const w of waras) w.bar = new HealthBar(WARA.hp);
player.onRespawn = () => {
  shurikens.reset();
  // les ennemis encore debout reprennent leur poste ; les vaincus le restent
  for (const t of enemies) if (t.state !== 'defeated') { t.reset(); t.bar.reset(); }
  kageBar.reset();
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
const IDLE_INPUT = { isHeld: () => false, wasPressed: () => false };
let debug = false;

const stateEl = document.querySelector('[data-state]');
for (const a of document.querySelectorAll('.levels a')) if (a.dataset.level === LEVEL_ID) a.setAttribute('aria-current', 'page');

function update(dt) {
  // touches d'interface : traitées même pendant un micro-arrêt
  if (input.wasPressed('debug')) { debug = !debug; input.pressed.delete('debug'); }
  if (input.wasPressed('mute')) { setMuted(!isMuted()); refreshMute(); input.pressed.delete('mute'); }
  // micro-arrêt sur un coup : tout se fige un instant (les appuis de jeu sont gardés)
  if (fx.frozen(dt)) return;
  player.update(dt, run.won ? IDLE_INPUT : input);
  // le sprint tactile se coupe tout seul à l'arrêt ou quand on est essoufflé
  if (touch?.sprintOn) {
    const moving = input.isHeld('left') || input.isHeld('right');
    touch.idleSprint = moving ? 0 : (touch.idleSprint ?? 0) + dt;
    if (player.energy.exhausted || touch.idleSprint > 0.5) touch.setSprint(false);
  }
  level.update(dt);
  shurikens.update(dt);
  for (const t of enemies) {
    t.update(dt, player);
    t.interact(player);
  }
  const ab = player.attackBox();
  if (ab) {
    const heavy = player.state === 'air_attack';
    level.hitGongs(ab);
    for (const t of enemies) {
      const r = t.takeHit(ab, player.x, player.attackId, heavy ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword);
      if (r === 'hit') {
        fx.hitStop(heavy ? 0.11 : 0.07);
        if (heavy) fx.shake(2, 0.18);
      } else if (r === 'blocked') {
        fx.hitStop(0.04);
      }
    }
  }
  // progression : lanternes et arrivée
  if (!run.won && level.checkProgress(player.x, player.y) && level.goal) win();
  if (!run.won && level.goal) run.time += dt;
  fx.update(dt);
  if (player.state !== 'death' && player.state !== 'respawn') shurikens.pickup(player.box());
  kageBar.update(dt, player.hp);
  for (const t of enemies) t.bar.update(dt, Math.max(0, t.hp));
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
  level.drawProps(ctx, cam);
  shurikens.drawStuck(ctx, look.projectiles.shuriken, cam);
  for (const t of tates) t.draw(ctx, cam, player);
  for (const w of waras) w.draw(ctx, cam);
  player.draw(ctx, look.sheet, cam);
  shurikens.drawFlying(ctx, look.projectiles.shuriken, cam);
  fx.draw(ctx, cam);
  // barres de vie : au-dessus de la tête, elles suivent chaque personnage
  for (const t of enemies) {
    if (t.gone) continue;
    const fade = t.state === 'defeated' ? Math.max(0, 1 - t.timer / 0.6) : 1;
    const top = t instanceof Wara ? 33 + Math.round(t.lift) : 27;   // WARA : au-dessus du chapeau
    t.bar.draw(ctx, t.x - cam.x, t.y - cam.y - top, fade);
  }
  if (player.state !== 'death' && player.state !== 'respawn') {
    kageBar.draw(ctx, player.x - cam.x, player.y - cam.y - 27);
  }
  // interface en haut à gauche : anneau d'énergie, puis stock de shurikens
  player.energy.draw(ctx, 13, 13, { always: true });
  shurikens.drawHud(ctx, look.projectiles.shuriken, 26, 8);
  // chronomètre centré en haut (le coin haut-droit accueille le bouton du son sur mobile)
  if (level.goal) drawTime(ctx, Math.round(VIEW_W / 2 + 9), 5, run.time);
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
    const boxes = [...tates.flatMap((t) => [[t, 'body', '#ff3b3b'], [t, 'shield', '#3bb3ff']]),
      ...waras.flatMap((w) => (w.state === 'spin' ? [[w, 'spin', '#ff9a3b']] : [])).concat(waras.map((w) => [w, 'body', '#ff3b3b']))];
    for (const [name, color] of boxes.map(([t, n, c]) => [[t, n], c])) {
      const tb = name[0].box(name[1]);
      ctx.strokeStyle = color;
      ctx.strokeRect(Math.round(tb.x - cam.x) + 0.5, Math.round(tb.y - cam.y) + 0.5, tb.w - 1, tb.h - 1);
    }
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(Math.round(player.x - cam.x), Math.round(player.y - cam.y), 1, 1);
  }
  stateEl.textContent = `${player.state} · frame ${player.anim.frame + 1}/${player.anim.anim.frameCount} · énergie ${Math.round(player.energy.value * 100)} % · vie ${player.hp}/${HEALTH.max}`;
}

// ---- arrivée ------------------------------------------------------------------
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function win() {
  run.won = true;
  sfx('win');
  const el = document.querySelector('.win');
  el.querySelector('[data-time]').textContent = fmt(run.time);
  el.querySelector('[data-falls]').textContent = String(run.falls);
  el.hidden = false;
}
document.querySelector('.win [data-again]').addEventListener('click', () => location.reload());

// chiffres en pixel art (3×5) pour le chronomètre, alignés à droite sur x
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  ':': '000010000010000',
};
function drawTime(c, right, y, t) {
  const text = fmt(t);
  let x = right - text.length * 4 + 1;
  for (const ch of text) {
    const bits = DIGITS[ch];
    for (let i = 0; i < 15; i++) {
      if (bits[i] !== '1') continue;
      c.fillStyle = '#06070a';
      c.fillRect(x + (i % 3) + 1, y + Math.floor(i / 3) + 1, 1, 1);
      c.fillStyle = '#e9e5da';
      c.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
    }
    x += 4;
  }
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
window.__kage = { player, input, level, shurikens, touch, tate: tates[0], tates, wara: waras[0], waras, fx, run };
