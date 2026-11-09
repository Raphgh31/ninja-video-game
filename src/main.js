import { loadCharacter, loadImage, loadJson } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { TouchControls } from './engine/touch.js';
import { Level } from './game/level.js';
import { Player } from './game/player.js';
import { Shurikens } from './game/shuriken.js';
import { Tate, TATE } from './game/tate.js';
import { Wara, WARA } from './game/wara.js';
import { Karasu, KARASU } from './game/karasu.js';
import { DAMAGE_DEALT, DAMAGE_TAKEN, HEALTH } from './game/combat.js';
import { HealthBar } from './game/healthbar.js';
import { Fx } from './engine/fx.js';
import { isMuted, play as sfx, setMuted, unlockAudio } from './engine/sfx.js';
import { MUSIC, Music } from './engine/music.js';
import { clearSave, emptySave, loadSave, writeSave } from './game/save.js';
import { Shop } from './game/shop.js';
import './style.css';

// Ordinateur : 448×252 fixe (on voit loin, le paysage a de la place). Mobile (écran
// tactile) : plein écran, même cadrage (~252 px de jeu en hauteur). L'échelle est
// entière en pixels réels de l'écran (pixels nets) et c'est la zone visible qui
// s'ajuste au millimètre. En portrait, le jeu pivote d'un quart de tour : il suffit
// de tourner le téléphone, même si la rotation automatique est bloquée.
// Les commandes tactiles sont dessinées sur leur propre calque, à l'ancienne
// échelle (~180 px de haut) : elles gardent la taille validée sous le pouce.
const MOBILE = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('mobile', MOBILE);
const DESK_W = 448, DESK_H = 252;
let VIEW_W = DESK_W;
let VIEW_H = DESK_H;
let SCALE = 1;
let touch = null;   // commandes tactiles (créées une fois les sprites chargés)

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
// calque du paysage (chapitres) : derrière le jeu, à la résolution réelle de
// l'écran, pour que les plans lointains glissent au pixel d'écran près
const bgCanvas = document.createElement('canvas');
bgCanvas.className = 'bg-layer';
bgCanvas.hidden = true;
canvas.before(bgCanvas);
const bgCtx = bgCanvas.getContext('2d');
let bgK = 1;   // pixels d'écran par pixel de jeu
// calque des commandes tactiles (au-dessus du jeu, sous l'interface HTML)
const touchCanvas = MOBILE ? document.createElement('canvas') : null;
const touchCtx = touchCanvas?.getContext('2d');
if (touchCanvas) {
  touchCanvas.className = 'touch-layer';
  canvas.after(touchCanvas);
}

// Mise à l'échelle entière : chaque pixel du sprite reste un carré net.
const stage = canvas.parentElement;
if (MOBILE) {
  // le bouton du son et l'écran de fin tournent avec le jeu
  stage.append(document.querySelector('.mute'), document.querySelector('.win'));
}
const MOBILE_VIEW_H = 252;   // hauteur de jeu visée sur téléphone (comme sur ordinateur)
const TOUCH_VIEW_H = 180;    // hauteur du calque des commandes tactiles
let touchView = { w: 320, h: 180, scale: 1 };
function fit() {
  if (MOBILE) {
    const W = window.innerWidth, H = window.innerHeight;     // pixels CSS
    const dpr = window.devicePixelRatio || 1;
    const rotated = H > W;                                     // portrait : jeu pivoté
    const LW = rotated ? H : W, LH = rotated ? W : H;          // côtés du jeu, en paysage
    // échelle entière en pixels réels de l'écran, la plus proche de 252 px de jeu en hauteur
    let dev = Math.max(1, Math.round((LH * dpr) / MOBILE_VIEW_H));
    while (dev > 1 && (LW * dpr) / dev < 420) dev--;           // jamais trop étroit
    bgK = Math.min(6, dev);
    SCALE = dev / dpr;                                         // pixels CSS par pixel de jeu
    VIEW_W = Math.ceil((LW * dpr) / dev);
    VIEW_H = Math.ceil((LH * dpr) / dev);
    // commandes : leur propre échelle entière, la plus proche de 180 px en hauteur
    let tdev = Math.max(1, Math.round((LH * dpr) / TOUCH_VIEW_H));
    while (tdev > 1 && (LW * dpr) / tdev < 280) tdev--;
    touchView = { w: Math.ceil((LW * dpr) / tdev), h: Math.ceil((LH * dpr) / tdev), scale: tdev / dpr };
    if (touchCanvas.width !== touchView.w || touchCanvas.height !== touchView.h) {
      touchCanvas.width = touchView.w;
      touchCanvas.height = touchView.h;
    }
    touchCanvas.style.width = `${touchView.w * touchView.scale}px`;
    touchCanvas.style.height = `${touchView.h * touchView.scale}px`;
    document.body.classList.toggle('rotated', rotated);
    stage.style.width = `${LW}px`;
    stage.style.height = `${LH}px`;
    stage.style.transform = rotated ? `translateX(${W}px) rotate(90deg)` : '';
    touch?.setRotation(rotated ? W : 0);
  } else {
    const stage = canvas.parentElement.getBoundingClientRect();
    SCALE = Math.max(1, Math.floor(Math.min(stage.width / DESK_W, stage.height / DESK_H)));
    VIEW_W = DESK_W;
    VIEW_H = DESK_H;
    bgK = Math.max(1, Math.min(6, Math.round(SCALE * (window.devicePixelRatio || 1))));
  }
  if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    ctx.imageSmoothingEnabled = false;
  }
  canvas.style.width = `${VIEW_W * SCALE}px`;
  canvas.style.height = `${VIEW_H * SCALE}px`;
  if (bgCanvas.width !== VIEW_W * bgK || bgCanvas.height !== VIEW_H * bgK) {
    bgCanvas.width = VIEW_W * bgK;
    bgCanvas.height = VIEW_H * bgK;
  }
  bgCanvas.style.width = canvas.style.width;
  bgCanvas.style.height = canvas.style.height;
  // taille de l'image de jeu, pour placer l'interface du chapitre sur elle (et non sur la page)
  stage.style.setProperty('--gw', `${VIEW_W * SCALE}px`);
  stage.style.setProperty('--gh', `${VIEW_H * SCALE}px`);
  touch?.layout(touchView.w, touchView.h, touchView.scale);
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

const { meta, skins } = await loadCharacter('./characters/kage', 'kage.json');
let look = skins.encre;     // skin porté (Encre : le ninja noir) ; changé à la boutique du marchand
// version de test (artefact privé) : tous les skins sont disponibles sans achat
const TEST_BUILD = !!globalThis.__KAGE_TEST;
function wearSkin(id) { look = skins[id] ?? skins.encre; }
// niveau : #terrain = terrain d'essai, #niveau-1 = niveau 1, sinon le chapitre 1 (Le Potager)
// cabine d'essayage des skins (artefact de test dédié, window.__KAGE_SKINLAB) : le Potager sans écran titre + barre des skins
const SKIN_LAB = !!globalThis.__KAGE_SKINLAB;
const LEVEL_ID = location.hash === '#terrain' ? 'terrain' : location.hash === '#niveau-1' ? 'niveau-1' : 'potager';
const level = new Level(LEVEL_ID);
if (level.art) {
  level.art.hiBackdrop = true;      // le paysage passe sur son calque fin
  bgCanvas.hidden = false;
  canvas.classList.add('over-bg');
}
addEventListener('hashchange', () => location.reload());
const player = new Player(meta, level);
level.player = player;   // le décor réagit à KAGE (le kappa plonge, etc.)
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
// boss du chapitre : KARASU-KASHI, perché sur son épouvantail géant (zone 9 du Potager)
let boss = null;
if (level.boss?.type === 'karasu') {
  const kbase = './characters/karasu';
  const kmeta = await loadJson(`${kbase}/karasu.json`);
  const [sheet, perch, items] = await Promise.all([kmeta.image, kmeta.perchImage, kmeta.itemImage].map((f) => loadImage(`${kbase}/${f}`)));
  boss = new Karasu(kmeta, { sheet, perch, items }, level.boss, level);
  enemies.push(boss);
  shurikens.enemies.push(boss);
}
// partie : chronomètre, chutes, arrivée ; dans un chapitre, la partie s'ouvre sur l'écran titre
const CHAPTER = level.chapter != null;
const run = { time: 0, falls: 0, won: false, paused: CHAPTER };
let save = CHAPTER ? emptySave(LEVEL_ID) : null;
const ui = {
  zone: document.querySelector('.zone-banner'),
  hint: document.querySelector('.hint'),
  saved: document.querySelector('.saved'),
  talk: document.querySelector('.talk'),
  talkLabel: document.querySelector('[data-talk]'),
};
const shop = new Shop(document.querySelector('.shop'), {
  skins, meta, test: TEST_BUILD,
  buy(id) {
    const sk = skins[id];
    if (!save || save.skins.includes(id) || save.ryo < sk.price) return false;
    save.ryo -= sk.price;
    save.skins.push(id);
    sfx('coin');
    this.wear(id);
    return true;
  },
  wear(id) {
    if (!save) return;
    save.skin = id;
    wearSkin(id);
    persist();
  },
});
shop.onClose = () => { run.paused = false; music.setLevel(1, 0.6); };
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
      sfx('step', { sprint: d.sprint, walk: d.walk });
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
    case 'kick_breath': sfx('breath'); break;
    case 'kick': sfx('kick'); fx.dust(d.x - d.facing * 2, d.y, 2, { dir: -d.facing, spread: 15, up: 6, life: 0.25 }); break;
    case 'hurt':
      sfx('hurt');
      fx.shake(2, 0.2);
      fx.sparks(d.x, d.y - 14, 6, { palette: 'hit', dir: Math.sign(d.x - d.fromX) });
      break;
    case 'death': sfx('death'); fx.shake(2, 0.25); run.falls++; if (save) save.falls = run.falls; break;
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
// Sons des ennemis : pleins tant qu'ils sont à l'écran, ils s'éteignent en
// s'éloignant du bord (sur ~7 cases) ; au loin, on ne les entend plus du tout.
function earGain(x, y) {
  const dx = Math.max(0, Math.abs(x - (camera.x + VIEW_W / 2)) - VIEW_W / 2);
  const dy = Math.max(0, Math.abs(y - (camera.y + VIEW_H / 2)) - VIEW_H / 2);
  const d = Math.max(dx, dy);
  return d <= 8 ? 1 : Math.max(0, 1 - (d - 8) / 112);
}
const sfxAt = (name, d, opts, k = 1) => sfx(name, opts, k * earGain(d.x, d.y));
let swordStrike = false;   // vrai pendant que le sabre de KAGE frappe (le son d'impact est celui de la lame)
// un ennemi poussé dans le vide : petit cri en tombant, nuage au fond
function onFallEvent(n, d) {
  if (n === 'fall_start') sfxAt('enemyFall', d);
  else if (n === 'fall_land') { sfxAt('enemyLand', d, { strength: 0.8 }); fx.dust(d.x, d.y, 5, { spread: 30 }); }
  else if (n === 'fell') { sfxAt('hit', d); fx.shake(1, 0.15); fx.dust(d.x, d.y, 8, { spread: 45, up: 20 }); }
}
function onTateEvent(n, d) {
  onFallEvent(n, d);
  switch (n) {
    case 'step': sfxAt('tateStep', d); fx.dust(d.x - 6, d.y, 2, { dir: -1, up: 8 }); fx.dust(d.x + 6, d.y, 2, { dir: 1, up: 8 }); break;
    case 'windup': sfxAt('tateWindup', d); break;
    case 'bash': sfxAt('tateBash', d); fx.dust(d.x - d.facing * 8, d.y, 6, { dir: -d.facing, spread: 40 }); break;
    case 'bash_hit': fx.shake(3, 0.3); break;
    case 'block': sfxAt('block', d); fx.sparks(d.x, d.y, 7, { dir: d.facing, speed: 100 }); break;
    case 'hit': if (!swordStrike) sfxAt('hit', d); fx.sparks(d.x, d.y - 16, 8, { palette: 'hit' }); break;
    case 'stunned': sfxAt('tateStun', d); break;
    case 'defeat_kneel': sfxAt('tateKneel', d); fx.dust(d.x, d.y, 5, { spread: 30 }); break;
    case 'defeat_impact':
      sfxAt('tateFall', d);
      fx.shake(2, 0.25);
      fx.dust(d.x - 4, d.y, 6, { dir: -1, spread: 45 });
      fx.dust(d.x + 14 * d.facing, d.y, 6, { dir: 1, spread: 45 });
      break;
    default:
  }
}
for (const t of tates) t.onEvent = onTateEvent;
function onWaraEvent(n, d) {
  onFallEvent(n, d);
  switch (n) {
    case 'crouch': sfxAt('waraHop', d); break;
    case 'land': fx.dust(d.x, d.y, 3, { spread: 18, up: 8, life: 0.3 }); break;
    case 'windup': sfxAt('waraWindup', d); break;
    case 'spin': sfxAt('waraSpin', d); break;
    case 'spin_hit': fx.shake(2, 0.2); break;
    case 'dizzy': sfxAt('waraDizzy', d); break;
    case 'block': sfxAt('waraBlock', d); fx.sparks(d.x + d.facing * 10, d.y, 5, { dir: d.facing, speed: 80, palette: 'straw' }); break;
    case 'hit': sfxAt('waraHit', d, undefined, swordStrike ? 0.5 : 1); fx.sparks(d.x, d.y - 16, 9, { palette: 'straw', speed: 100 }); break;
    case 'death_poof': sfxAt('waraPoof', d); fx.sparks(d.x, d.y - 14, 14, { palette: 'straw', speed: 120 }); fx.dust(d.x, d.y, 5, { spread: 30 }); break;
    case 'death_pile': fx.dust(d.x - 4, d.y, 4, { dir: -1, spread: 25 }); fx.dust(d.x + 4, d.y, 4, { dir: 1, spread: 25 }); break;
    default:
  }
}
for (const w of waras) w.onEvent = onWaraEvent;
// KARASU-KASHI : sons, plumes, terre, et la porte du temple qui s'ouvre à sa défaite
const gateProp = level.props.find((p) => p.type === 'temple_gate');
const bossUi = { el: document.querySelector('.boss'), shown: 0, lag: 1, outro: 0 };
function onKarasuEvent(n, d) {
  switch (n) {
    case 'engage': bossUi.shown = 1; break;
    case 'disengage': bossUi.shown = 0; break;
    // sons enregistrés : un coup d'aile à chaque descente d'aile, les croassements
    // au début du combat (trois cris) et à chaque retour au perchoir (deux cris)
    case 'wingbeat': sfxAt('karasuWing', d); break;
    case 'caw': sfxAt(d.long ? 'karasuCawLong' : 'karasuCaw', d); break;
    case 'straw': fx.sparks(d.x + (Math.random() - 0.5) * 20, d.y, 5, { palette: 'straw', speed: 60 }); fx.drift(d.x, d.y + 10, 3, { palette: 'straw', speed: 30 }); break;
    case 'flap': fx.drift(d.x, d.y - 30, 2, { speed: 40 }); break;   // (le son : wingbeat)
    case 'drop': break;
    case 'glare': sfxAt('glare', d); break;
    case 'dive': sfxAt('diveWhistle', d); fx.drift(d.x, d.y - 30, 3, { speed: 50 }); break;
    case 'diveHit': fx.shake(3, 0.25); fx.drift(d.x, d.y, 4, { speed: 70 }); break;
    case 'crash':
      sfxAt('crash', d);
      fx.shake(d.heavy ? 4 : 3, d.heavy ? 0.45 : 0.3);
      fx.dust(d.x + d.dir * 6, d.y, 8, { dir: d.dir, spread: 50, up: 30, palette: 'dirt', life: 0.6 });
      fx.dust(d.x - d.dir * 6, d.y, 5, { dir: -d.dir, spread: 35, up: 20 });
      fx.drift(d.x, d.y - 24, 5, { speed: 60, up: 40 });
      break;
    case 'shake': fx.dust(d.x, d.y, 5, { spread: 30, palette: 'dirt' }); fx.drift(d.x, d.y - 20, 4, { speed: 45 }); break;
    // les pierres : il les saisit sur un tas, les lâche, elles s'écrasent
    case 'grab': sfxAt('grabRock', d); fx.dust(d.x, d.y, 5, { spread: 26, up: 14, palette: 'dirt' }); break;
    case 'throw': break;
    case 'rockLand':
      sfxAt('rockThud', d, { size: d.size });
      fx.dust(d.x, d.y, 3 + d.size * 2, { spread: 22 + d.size * 8, up: 12 + d.size * 5, palette: 'dirt' });
      if (d.size === 2) fx.shake(1.4, 0.15);
      if (d.size < 2) fx.sparks(d.x, d.y - 3, 4 + d.size * 2, { palette: 'dirt', speed: 70 });
      break;
    case 'rockBreak': fx.sparks(d.x, d.y - 3, 6, { palette: 'dirt', speed: 80 }); break;
    case 'knocked':
      sfxAt('squawk', d);
      fx.drift(d.x, d.y, 10, { speed: 80, up: 50 });
      fx.hitStop(0.09);
      break;
    case 'hit':
      if (!swordStrike) sfxAt('hit', d, undefined, 0.6);
      sfxAt('squawk', d);
      fx.drift(d.x, d.y, 6, { speed: 70, up: 40 });
      fx.sparks(d.x, d.y, 6, { palette: 'hit', dir: d.dir });
      break;
    case 'defeat':
      sfx('karasuDefeat');
      fx.hitStop(0.22);
      fx.shake(3, 0.4);
      fx.drift(d.x, d.y - 30, 16, { speed: 90, up: 60, life: 1.6 });
      bossUi.outro = 1.3;          // puis le talisman se déchire et la porte s'ouvre
      if (save) { save.bossDefeated = true; persist(); }
      break;
    default:
  }
}
if (boss) boss.onEvent = onKarasuEvent;
// La porte ouverte : KAGE ne passe pas devant les vantaux, il entre dans le
// passage. La porte le dessine elle-même entre le couloir et la façade (temple.js,
// inside) : il s'enfonce, rapetisse avec la profondeur et s'efface dans la
// pénombre ; ensuite seulement, la fin du chapitre.
const templeGate = level.art?.live?.templeGate ?? null;
const ENTER_TIME = 1.8;
function startEntering() {
  run.won = true;                                   // plus de commandes, le chrono s'arrête
  run.entering = { t: 0, u0: (player.x - templeGate.X) / Math.cos((28 * Math.PI) / 180) };
  player.vx = 0;
  player.anim.play('walk', { restart: true });
  templeGate.inside = drawEntering;
}
function updateEntering(dt) {
  const e = run.entering;
  e.t += dt;
  player.anim.update(dt);
  if (e.t >= ENTER_TIME && !e.done) { e.done = true; win(); }
}
function drawEntering(ctx, cam, gate) {
  const e = run.entering;
  if (!e) return;
  const p = Math.min(1, e.t / ENTER_TIME);
  const u = e.u0 * (1 - Math.min(1, p * 3)), w = -60 * p, v = 4 * Math.min(1, p * 6);
  const at = gate.proj(u, v, w), k = gate.scaleAt(u, w);
  ctx.save();
  ctx.globalAlpha = p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.45);
  ctx.translate(Math.round(at.x - cam.x), Math.round(at.y - cam.y));
  ctx.scale(k, k);
  player.anim.draw(ctx, look.sheet, 0, 0, 1);
  ctx.restore();
}

/** La porte du temple s'ouvre : le talisman se déchire, les battants pivotent. */
function openTempleGate(silent = false) {
  level.doorOpen = true;
  bossUi.shown = 0;
  if (silent) level.doorT = level.doorTime;      // reprise d'une partie : la porte est déjà grande ouverte
  if (silent || !gateProp) return;
  const gx = gateProp.x * 16 + 8, gy = gateProp.y * 16 - 56;
  sfx('paperTear');
  sfx('gateCreak');
  fx.drift(gx, gy, 14, { palette: 'paper', speed: 70, up: 50, life: 1.8 });
  fx.shake(1, 0.4);
}
level.onEvent = (n, d) => {
  switch (n) {
    case 'gong': sfx('gong'); sfx('door'); fx.shake(1, 0.25); fx.sparks(d.x, d.y, 8, { speed: 70 }); break;
    case 'checkpoint':
      sfx('checkpoint');
      fx.sparks(d.x, d.y - 16, 5, { speed: 40 });
      if (save) {
        save.checkpoint = level.checkpoints.findIndex((c) => c.x === d.x && c.y === d.y);
        save.checkpointX = d.x;   // la lanterne est retrouvée par sa position (les indices changent si on en ajoute)
        persist(true);
      }
      break;
    // caisses : elles tombent lourdement quand plus rien ne les porte
    case 'crateLand':
      sfx('crateLand', {}, Math.min(1, 0.5 + d.speed / 600));
      fx.dust(d.x - 6, d.y, 4, { dir: -1, spread: 22, up: 8, life: 0.45 });
      fx.dust(d.x + 6, d.y, 4, { dir: 1, spread: 22, up: 8, life: 0.45 });
      fx.sparks(d.x, d.y - 2, 3, { palette: 'straw', speed: 50 });
      fx.shake(d.speed > 250 ? 1.2 : 0.6, 0.14);
      break;
    case 'crateHit':
      player.hurt(DAMAGE_TAKEN.crate, d.x);   // le son et le recul viennent de l'événement « hurt » de KAGE
      break;
    // grue de bambou : la corde claque, les blocs tombent dans la fosse
    case 'ropeCut':
      sfx('ropeSnap');
      fx.sparks(d.x, d.y, 6, { palette: 'straw', speed: 70 });
      if (save && !save.cranes.includes(d.id)) { save.cranes.push(d.id); persist(); }
      break;
    // arène du corbeau : sa chute fait trembler puis s'effondrer les plateformes
    case 'scaffoldsShake': sfx('woodCreak'); break;
    case 'scaffoldFall':
      sfx('woodCollapse');
      fx.dust(d.x, d.ground, 8, { spread: d.w * 0.6, up: 24, life: 0.7 });
      fx.drift(d.x, d.y, 4, { palette: 'straw', speed: 40 });
      fx.shake(1.2, 0.2);
      break;
    case 'craneLand':
      sfx('boulderLand');
      fx.shake(2.4, 0.4);
      fx.dust(d.x - d.w / 2, d.y - 4, 8, { dir: -1, spread: 40, up: 26, life: 0.7 });
      fx.dust(d.x + d.w / 2, d.y - 4, 8, { dir: 1, spread: 40, up: 26, life: 0.7 });
      fx.dust(d.x, d.y - 8, 6, { spread: 50, up: 40, life: 0.8 });
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
// musique du chapitre : chargée tout de suite, jouée au premier geste du joueur
const music = new Music();
music.load(level.music);
music.add('boss', level.bossMusic);
const onGesture = () => { unlockAudio(); music.start(); };
for (const t of ['keydown', 'pointerdown', 'touchstart']) addEventListener(t, onGesture, { capture: true, passive: true });

// barres de vie fines au-dessus de chaque personnage
const kageBar = new HealthBar(HEALTH.max);
for (const t of tates) t.bar = new HealthBar(TATE.hp);
for (const w of waras) w.bar = new HealthBar(WARA.hp);
if (boss) boss.bar = new HealthBar(KARASU.hp);
player.onRespawn = () => {
  snapCamera();   // retour à la lanterne : coupe franche plutôt qu'un long travelling
  shurikens.reset();
  // les ennemis encore debout reprennent leur poste ; les vaincus le restent
  for (const t of enemies) if (t.state !== 'defeated') { t.reset(); t.bar.reset(); }
  if (boss && boss.state !== 'defeated') { bossUi.shown = 0; bossUi.lag = 1; }
  kageBar.reset();
};
const input = new Input();
touch = MOBILE ? new TouchControls(touchCanvas, input) : null;
if (MOBILE) {
  // plein écran au premier contact (refusé sans gravité si le navigateur ne le permet pas)
  touchCanvas.addEventListener('pointerdown', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, { once: true });
}
const camera = { x: 0, y: 0 };
const IDLE_INPUT = { isHeld: () => false, wasPressed: () => false };
let debug = false;

const stateEl = document.querySelector('[data-state]');
for (const a of document.querySelectorAll('.levels a')) if (a.dataset.level === LEVEL_ID) a.setAttribute('aria-current', 'page');
if (SKIN_LAB) setupSkinLab();

/** Cabine d'essayage : une vignette par skin en haut de l'image ; clic ou touches 1, 2… */
function setupSkinLab() {
  document.querySelector('.levels').style.display = 'none';
  document.title = 'The Ninja Game — cabine des skins';
  const bar = document.createElement('div');
  bar.className = 'skinlab';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Skins');
  const f = meta.animations.idle.frames[0];
  const ids = Object.keys(skins).sort((a, b) => (skins[a].price ?? 0) - (skins[b].price ?? 0));
  const buttons = ids.map((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.skin = id;
    b.title = `${skins[id].name} (touche ${i + 1})`;
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 26;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(skins[id].sheet, f.x, f.y + 6, 32, 26, 0, 0, 32, 26);
    const name = document.createElement('span');
    name.textContent = skins[id].name;
    b.append(cv, name);
    b.addEventListener('click', () => pick(id));
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    bar.append(b);
    return b;
  });
  function pick(id) {
    wearSkin(id);
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.skin === id));
  }
  addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= ids.length) pick(ids[n - 1]);
  });
  document.querySelector('.stage').append(bar);
  pick(ids.find((id) => id !== 'encre') ?? 'encre');
}

function update(dt) {
  // touches d'interface : traitées même pendant un micro-arrêt
  if (input.wasPressed('debug')) { debug = !debug; input.pressed.delete('debug'); }
  if (input.wasPressed('mute')) { setMuted(!isMuted()); refreshMute(); input.pressed.delete('mute'); }
  // écran titre ou boutique ouverte : le monde attend
  if (run.paused) {
    if (shop.isOpen && input.wasPressed('escape')) shop.close();
    input.endFrame();
    return;
  }
  // micro-arrêt sur un coup : tout se fige un instant (les appuis de jeu sont gardés)
  if (fx.frozen(dt)) return;
  if (run.entering) updateEntering(dt);
  else player.update(dt, run.won ? IDLE_INPUT : input);
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
      swordStrike = true;
      const r = t.takeHit(ab, player.x, player.attackId, heavy ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword);
      swordStrike = false;
      if (r === 'hit') {
        sfx('bladeHit', { heavy });
        fx.hitStop(heavy ? 0.11 : 0.07);
        if (heavy) fx.shake(2, 0.18);
      } else if (r === 'blocked') {
        fx.hitStop(0.04);
      }
    }
  }
  // coup de pied : 1 dégât, et l'ennemi recule (même s'il pare)
  const kb = player.kickBox();
  if (kb) {
    level.hitGongs(kb);
    for (const t of enemies) {
      const r = t.takeHit(kb, player.x, player.attackId, DAMAGE_DEALT.kick);
      if (r) {
        t.push(player.facing, player.kickPush);
        sfx('kickHit');
        fx.hitStop(r === 'hit' ? 0.06 : 0.035);
        fx.dust(t.x - player.facing * 4, t.y, 4, { dir: player.facing, spread: 30, up: 8 });
      }
    }
  }
  // caisses : le sabre et le coup de pied les brisent
  for (const box of [ab, player.kickBox()]) {
    if (!box) continue;
    for (const c of level.breakCrates(box)) {
      sfx('crate');
      fx.dust(c.x, c.y + 6, 6, { spread: 35, up: 18 });
      fx.sparks(c.x, c.y, 4, { palette: 'straw', speed: 70 });
      if (save) { save.crates.push(c.key); persist(); }
    }
  }
  // ryō
  if (player.state !== 'death' && player.state !== 'respawn') {
    for (const c of level.takeCoins(player.box())) {
      sfx('coin');
      fx.sparks(c.x, c.y, 3, { speed: 35 });
      ryoShown = 2.5;
      if (save) { save.ryo++; save.coins.push(c.id); persist(); }
    }
  }
  ryoShown = Math.max(0, ryoShown - dt);
  if (CHAPTER) updateChapterUi(dt);
  // musique : celle du combat dès qu'on entre dans le champ du corbeau (zone 9),
  // en fondu enchaîné, tant qu'il n'est pas vaincu ; ensuite, retour à celle du chapitre
  if (CHAPTER && boss && level.bossMusic && !run.won) {
    const want = boss.state !== 'defeated' && level.zoneAt(player.x)?.id === '09' ? 'boss' : 'main';
    if (music.active !== want) music.switchTo(want, want === 'boss' ? { fadeOut: 4, fadeIn: 6, delay: 1 } : { fadeOut: 3, fadeIn: 5, delay: 1.5 });
  }
  // progression : lanternes et arrivée
  if (!run.won && templeGate && level.doorOpen && level.doorT >= level.doorTime * 0.6 && player.onGround
    && player.x >= templeGate.X - 4 && Math.abs(player.y - templeGate.G) < 6) startEntering();
  if (!run.won && level.checkProgress(player.x, player.y) && level.goal) win();
  if (!run.won && level.goal) run.time += dt;
  fx.update(dt);
  if (player.state !== 'death' && player.state !== 'respawn') shurikens.pickup(player.box());
  kageBar.update(dt, player.hp);
  for (const t of enemies) t.bar.update(dt, Math.max(0, t.hp));
  if (boss) updateBossUi(dt);
  updateCamera(dt);
  input.endFrame();
}

// ---- caméra posée -------------------------------------------------------------
// Stable avant tout : elle ne suit pas KAGE pas à pas.
// - En largeur : zone morte ; tant que KAGE reste au centre de l'écran, rien ne
//   bouge ; s'il en sort, elle le rattrape avec un amorti (sans à-coup).
// - En hauteur : des « paliers ». Une marche, un saut, un petit relief : rien ne
//   bouge. Seul un vrai changement de niveau (plus de 3,5 cases) déclenche un
//   recadrage, d'un seul mouvement franc et fluide (accélère, puis se pose).
// - Elle est arrondie au pixel une seule fois, et tout (fond, terrain,
//   personnages) est dessiné avec cette même position : tout bouge ensemble.
const CAM = {
  left: 0.3,       // KAGE peut aller de 30 %...
  right: 0.56,     // ... à 56 % de la largeur sans que la caméra bouge
  smooth: 0.22,    // amorti horizontal (s) : temps pour rattraper l'essentiel de l'écart
  ground: 0.86,    // le sol se tient à 86 % de la hauteur de l'image
  step: 56,        // écart de sol (px) à partir duquel la caméra change de palier (3,5 cases)
  move: 0.6,       // durée d'un changement de palier (s)
  top: 0.1,        // la tête de KAGE ne sort jamais par le haut (10 % de marge)
  bottom: 0.97,    // ni ses pieds par le bas
};
const camGround = { y: null };                 // sol de référence du palier en cours
const camV = { from: 0, to: 0, t: 1, dur: CAM.move };   // transition verticale en cours
let camVX = 0;                                 // vitesse horizontale (amorti)

const clampCamX = (x) => Math.min(Math.max(x, 0), level.width - VIEW_W);
const clampCamY = (y) => Math.min(Math.max(y, 0), level.height - VIEW_H);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // lent, rapide, lent

function targetX() {
  let x = camera.x;
  const sx = player.x - camera.x;
  if (sx > VIEW_W * CAM.right) x = player.x - VIEW_W * CAM.right;
  else if (sx < VIEW_W * CAM.left) x = player.x - VIEW_W * CAM.left;
  return clampCamX(x);
}

/** Lance un recadrage vertical vers le palier dont le sol est groundY. */
function retargetY(groundY) {
  camGround.y = groundY;
  const to = clampCamY(groundY - VIEW_H * CAM.ground);
  if (Math.abs(to - camV.to) < 1 && camV.t < 1) return;
  camV.from = camera.y;
  camV.to = to;
  camV.t = 0;
  camV.dur = CAM.move * Math.min(1.3, Math.max(0.75, Math.abs(to - camera.y) / 70));
}

function updateCamera(dt) {
  // largeur : ressort critique amorti vers la cible (aucun dépassement)
  const tx = targetX();
  const w = 2 / CAM.smooth, k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
  const diff = camera.x - tx, tmp = (camVX + w * diff) * dt;
  camVX = (camVX - w * tmp) * e;
  camera.x = clampCamX(tx + (diff + tmp) * e);
  if (Math.abs(camera.x - tx) < 0.05 && Math.abs(camVX) < 0.5) { camera.x = tx; camVX = 0; }
  // hauteur : paliers
  if (camGround.y == null) retargetY(player.y);
  const alive = player.state !== 'death' && player.state !== 'respawn';
  if (alive && player.onGround && Math.abs(player.y - camGround.y) > CAM.step) retargetY(player.y);
  // garde-fous : KAGE ne sort jamais de l'image (puits, grandes chutes)
  const y = camV.t < 1 ? camV.to : camera.y;
  if (alive && player.y - 31 < y + VIEW_H * CAM.top) retargetY(player.y - 31 + VIEW_H * (CAM.ground - 0.3));   // tête ramenée à 30 %
  else if (alive && player.y > y + VIEW_H * CAM.bottom) retargetY(player.y + 32);
  if (camV.t < 1) {
    camV.t = Math.min(1, camV.t + dt / camV.dur);
    camera.y = camV.from + (camV.to - camV.from) * ease(camV.t);
  }
}

/** Caméra posée d'un coup sur KAGE (écran titre, reprise d'une partie). */
function snapCamera() {
  camGround.y = player.y;
  camera.x = clampCamX(player.x - VIEW_W * 0.42);
  camera.y = clampCamY(player.y - VIEW_H * CAM.ground);
  camV.to = camera.y; camV.t = 1; camVX = 0;
}

function draw() {
  // secousse de l'écran : décalage temporaire de la caméra
  const shake = fx.offset();
  // une seule position, arrondie au pixel, pour tout ce qui est dessiné
  const cam = { x: Math.round(camera.x + shake.x), y: Math.round(camera.y + shake.y) };
  if (level.art) {
    // paysage : position exacte de la caméra, arrondie au pixel d'écran
    bgCtx.setTransform(bgK, 0, 0, bgK, 0, 0);
    bgCtx.imageSmoothingEnabled = false;
    level.art.backdrop.draw(bgCtx, { x: camera.x + shake.x, y: camera.y + shake.y }, VIEW_W, VIEW_H, level.time, bgK);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  }
  level.draw(ctx, cam, VIEW_W, VIEW_H);
  level.drawTargets(ctx, cam);
  level.drawProps(ctx, cam);
  boss?.drawBack(ctx, cam);
  shurikens.drawStuck(ctx, look.projectiles.shuriken, cam);
  for (const t of tates) t.draw(ctx, cam, player);
  for (const w of waras) w.draw(ctx, cam);
  drawScarecrows(cam);
  boss?.draw(ctx, cam);
  if (!run.entering) player.draw(ctx, look.sheet, cam);   // (dans la porte, c'est elle qui le dessine)
  level.drawForeground(ctx, cam);
  shurikens.drawFlying(ctx, look.projectiles.shuriken, cam);
  fx.draw(ctx, cam);
  if (run.title) return;   // écran titre : le décor seul, sans interface
  // barres de vie : au-dessus de la tête, elles suivent chaque personnage
  for (const t of enemies) {
    if (t.gone || t.noBar) continue;
    const fade = t.state === 'defeated' ? Math.max(0, 1 - t.timer / 0.6) : 1;
    const top = t instanceof Wara ? 34 + Math.round(t.lift) : 38;   // au-dessus du chapeau (personnages agrandis de 20 %)
    t.bar.draw(ctx, t.x - cam.x, t.y - cam.y - top, fade);
  }
  if (player.state !== 'death' && player.state !== 'respawn' && !run.entering) {
    kageBar.draw(ctx, player.x - cam.x, player.y - cam.y - 31);
  }
  // interface en haut à gauche : anneau d'énergie, puis stock de shurikens
  player.energy.draw(ctx, 13, 13, { always: true });
  shurikens.drawHud(ctx, look.projectiles.shuriken, 26, 8);
  // ryō : sous les shurikens (dans un chapitre)
  if (save) drawRyo(ctx, 27, 19, save.ryo);
  // chronomètre centré en haut, hors chapitre (le coin haut-droit accueille le bouton du son sur mobile)
  if (level.goal && !CHAPTER) drawTime(ctx, Math.round(VIEW_W / 2 + 9), 5, run.time);
  if (touch) {
    touchCtx.clearRect(0, 0, touchCanvas.width, touchCanvas.height);
    touch.draw(touchCtx);
  }
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
    if (boss) boxes.push([boss, undefined, boss.flying || boss.state === 'stuck' ? '#ff3b3b' : '#7a7a7a']);
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

// ---- chapitre : sauvegarde, écran titre, zones, aides, marchand ---------------
let ryoShown = 0;
let savedFlash = 0;
let zoneId = null;
let zoneTimer = 0;
let hint = null;            // { kind, t }
const hintsDone = new Set();
let startX = player.x;

/** Enregistre la partie ; show = afficher l'indicateur « Sauvegardé ». */
function persist(show = false) {
  if (!save) return;
  save.time = run.time;
  save.falls = run.falls;
  const ok = writeSave(save);
  if (show) {
    savedFlash = 1.8;
    ui.saved.textContent = ok ? 'Sauvegardé' : 'Sauvegarde impossible sur ce navigateur';
  }
}

const HINTS = {
  move: ['← → : avancer', 'Joystick : avancer'],
  jump: ['Espace : sauter', 'Bouton flèche : sauter'],
  sprint: ['Maj + → : sprinter', 'Joystick poussé hors du cercle : sprinter'],
  dash: ['→ → (double appui) : dash', 'Coup de joystick rapide, relâché : dash'],
  kick: ['B : coup de pied — il repousse', 'Bouton coup de pied : repousser'],
  attack: ['X : coup de sabre — il brise les caisses', 'Bouton sabre : briser les caisses'],
  slide: ['↓ en courant : glissade', 'Joystick vers le bas en courant : glissade'],
  wall: ['Espace contre un mur, en tombant : saut mural', 'Bouton saut contre un mur, en tombant : saut mural'],
  rope: ['C : un shuriken coupe la corde de la grue', 'Bouton shuriken : couper la corde de la grue'],
  airAttack: ['En l\'air, X : coup de sabre plongeant', 'En l\'air, bouton sabre : coup plongeant'],
};
const HINT_USED = {
  move: () => Math.abs(player.x - startX) > 48,
  jump: () => player.state === 'jump',
  sprint: () => player.state === 'sprint',
  dash: () => player.state === 'dash',
  kick: () => player.state === 'kick',
  attack: () => player.state === 'attack' || player.state === 'air_attack',
  slide: () => player.state === 'slide',
  wall: () => player.state === 'wall_jump',
  rope: () => level.cranes.some((c) => c.cut),
  airAttack: () => player.state === 'air_attack',
};

function updateChapterUi(dt) {
  if (run.won) { hideChapterUi(); return; }
  // bannière de zone : à chaque nouvelle zone traversée
  const z = level.zoneAt(player.x);
  if (z && z.id !== zoneId) {
    zoneId = z.id;
    zoneTimer = 3.2;
    ui.zone.querySelector('[data-zone-num]').textContent = `Zone ${z.id}`;
    ui.zone.querySelector('[data-zone-name]').textContent = z.name;
  }
  zoneTimer = Math.max(0, zoneTimer - dt);
  ui.zone.classList.toggle('on', zoneTimer > 0);
  // aides : une seule commande à la fois, au moment où elle sert
  for (const h of level.hints) {
    if (hintsDone.has(h.kind) || player.x < h.x * 16) continue;
    if (!hint || hint.kind !== h.kind) hint = { kind: h.kind, t: 0 };
  }
  if (hint) {
    hint.t += dt;
    if (HINT_USED[hint.kind]() || hint.t > 9) {
      hintsDone.add(hint.kind);
      hint = null;
    }
  }
  ui.hint.textContent = hint ? HINTS[hint.kind][MOBILE ? 1 : 0] : '';
  ui.hint.classList.toggle('on', !!hint);
  // sauvegarde
  savedFlash = Math.max(0, savedFlash - dt);
  ui.saved.classList.toggle('on', savedFlash > 0);
  // marchand : « Parler » quand on est devant le comptoir
  const m = level.merchant;
  const alive = player.state !== 'death' && player.state !== 'respawn';
  const near = m && Math.abs(player.x - m.x) < 30 && Math.abs(player.y - m.y) < 24 && alive;
  // coffre : « Ouvrir le coffre » quand on se tient devant, encore fermé
  chestHere = !near && alive ? level.chestNear(player.x, player.y) : null;
  ui.talk.hidden = !near && !chestHere;
  ui.talkLabel.textContent = chestHere ? 'Ouvrir le coffre' : 'Parler au marchand';
  if (input.wasPressed('up')) talkAction();
}

/** ↑ / E ou le bouton : parler au marchand, ou ouvrir le coffre devant soi. */
function talkAction() {
  if (chestHere) openChest(chestHere);
  else if (!ui.talk.hidden) openShop();
}

let chestHere = null;
function openChest(ch) {
  const coins = level.openChest(ch);
  if (!coins.length) return;
  chestHere = null;
  ui.talk.hidden = true;
  sfx('chestOpen');
  fx.dust(ch.x, ch.y - 2, 6, { spread: 24, up: 10 });
  fx.sparks(ch.x, ch.y - 12, 10, { speed: 60 });
  fx.shake(0.6, 0.15);
  if (save) { save.chests.push(ch.id); persist(); }
}

/** Masque les aides posées sur le jeu (boutique ouverte, fin du chapitre). */
function hideChapterUi() {
  ui.hint.classList.remove('on');
  ui.zone.classList.remove('on');
  ui.talk.hidden = true;
}

function openShop() {
  if (shop.isOpen) return;
  run.paused = true;
  music.setLevel(MUSIC.duck, 0.4);
  hideChapterUi();
  sfx('bell');
  shop.open({ firstVisit: !save.merchantMet, save });
  if (!save.merchantMet) { save.merchantMet = true; persist(); }
}
ui.talk.addEventListener('click', talkAction);

/**
 * Lanterne de reprise d'une sauvegarde : par sa position ; pour une sauvegarde
 * d'avant l'ajout des lanternes de début de zone, par son indice parmi les
 * 3 lanternes d'origine (dans l'ordre où l'ancienne version les lisait : ligne
 * par ligne, puis de gauche à droite).
 */
function savedCheckpoint(s) {
  if (s.checkpointX != null) return level.checkpoints.find((k) => k.x === s.checkpointX) ?? null;
  if (!(s.checkpoint >= 0)) return null;
  if (level.legacyCheckpoints) {
    const cols = new Set(level.legacyCheckpoints);
    const old = level.checkpoints.filter((k) => cols.has(Math.floor(k.x / 16))).sort((a, b) => a.y - b.y || a.x - b.x);
    return old[s.checkpoint] ?? null;
  }
  return level.checkpoints[s.checkpoint] ?? null;
}

/** Écran titre : continuer la partie enregistrée, ou en commencer une nouvelle. */
function startChapter(resume) {
  const s = resume ? loadSave() : null;
  if (!resume) clearSave();
  save = s && s.chapter === LEVEL_ID ? s : emptySave(LEVEL_ID);
  save.skins ??= ['encre'];   // sauvegarde d'avant les skins
  save.chests ??= [];        // sauvegarde d'avant les coffres
  save.cranes ??= [];        // grues dont la corde a été coupée
  save.skin = save.skins.includes(save.skin) || TEST_BUILD ? save.skin ?? 'encre' : 'encre';
  if (!SKIN_LAB) wearSkin(save.skin);   // dans la cabine, c'est la barre des skins qui décide
  level.applySave(save);
  run.time = save.time;
  run.falls = save.falls;
  const c = savedCheckpoint(save);
  if (c) {
    level.checkpoints.forEach((k) => { k.lit = k.x <= c.x; });
    level.spawn = { x: c.x, y: c.y };
  }
  if (boss && save.bossDefeated) { boss.setDefeated(); openTempleGate(true); }
  player.respawn(true);
  startX = player.x;
  // reprise : les aides des commandes déjà passées ne reviennent pas
  for (const h of level.hints) if (h.x * 16 < player.x - 48) hintsDone.add(h.kind);
  snapCamera();
  document.querySelector('.title-screen').hidden = true;
  run.title = false;
  run.paused = false;
  persist();
}
if (CHAPTER) {
  const title = document.querySelector('.title-screen');
  title.hidden = false;
  run.title = true;
  snapCamera();
  title.querySelector('[data-chapter]').textContent = level.name;
  const existing = loadSave();
  const cont = title.querySelector('[data-continue]');
  cont.hidden = !(existing && existing.chapter === LEVEL_ID && !existing.done);
  cont.addEventListener('click', () => startChapter(true));
  title.querySelector('[data-new]').addEventListener('click', () => startChapter(false));
  (cont.hidden ? title.querySelector('[data-new]') : cont).focus();
  if (SKIN_LAB) startChapter(false);   // cabine : on joue tout de suite
}

// barre de vie du boss : fine, en haut de l'image, avec son nom ; la part perdue
// s'efface en retard (on voit ce que le coup a coûté)
function updateBossUi(dt) {
  if (bossUi.outro > 0) {
    bossUi.outro -= dt;
    if (bossUi.outro <= 0) openTempleGate();
  }
  const f = Math.max(0, boss.hp) / KARASU.hp;
  bossUi.lag = bossUi.lag > f ? Math.max(f, bossUi.lag - dt * 0.6) : f;
  const on = bossUi.shown > 0 && !run.won;
  bossUi.el.classList.toggle('on', on);
  document.body.classList.toggle('boss-on', on);
  bossUi.el.style.setProperty('--hp', f.toFixed(3));
  bossUi.el.style.setProperty('--lag', bossUi.lag.toFixed(3));
}

// épouvantails du décor : des WARA immobiles qui se balancent au vent
function drawScarecrows(cam) {
  for (const p of level.props) {
    if (p.type !== 'scarecrow') continue;
    const f = waraMeta.frames[Math.floor(level.time * 1.5) % 2 ? 'idle_1' : 'idle_2'];
    const sx = Math.round(p.x * 16 + 8 - cam.x), sy = Math.round(p.y * 16 - cam.y) - waraMeta.pivot.y;
    if (sx < -60 || sx > VIEW_W + 60) continue;
    ctx.drawImage(waraSheet, f.x, f.y, f.w, f.h, sx - waraMeta.pivot.x, sy, f.w, f.h);
  }
}

// compteur de ryō : petite pièce + chiffres en pixel art
function drawRyo(c, x, y, n) {
  c.globalAlpha = ryoShown > 0 ? 1 : 0.7;
  c.fillStyle = '#06070a';
  c.fillRect(x - 1, y - 1, 7, 7);
  c.fillStyle = '#e8b93c';
  c.fillRect(x, y, 5, 5);
  c.fillStyle = '#7a5a1c';
  c.fillRect(x + 2, y + 2, 1, 1);
  drawTime(c, x + 9 + String(n).length * 4, y, n, String(n));
  c.globalAlpha = 1;
}

// ---- arrivée ------------------------------------------------------------------
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function win() {
  run.won = true;
  music.setLevel(0, 3);
  sfx('win');
  const el = document.querySelector('.win');
  if (CHAPTER) {
    el.querySelector('.win__title').textContent = `${level.name} — terminé`;
    el.querySelector('[data-next]').textContent = level.next ? `Au loin s'étendent ${level.next.toLowerCase()}… la suite de l'aventure arrive bientôt.` : '';
    el.querySelector('[data-ryo-row]').hidden = false;
    el.querySelector('[data-ryo]').textContent = String(save.ryo);
    save.done = true;
    persist();
  }
  el.querySelector('[data-time]').textContent = fmt(run.time);
  el.querySelector('[data-falls]').textContent = String(run.falls);
  el.hidden = false;
}
document.querySelector('.win [data-again]').addEventListener('click', () => {
  if (CHAPTER) clearSave();
  location.reload();
});

// chiffres en pixel art (3×5) pour le chronomètre, alignés à droite sur x
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  ':': '000010000010000',
};
function drawTime(c, right, y, t, label = null) {
  const text = label ?? fmt(t);
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
window.__kage = { music, player, input, level, shurikens, touch, tate: tates[0], tates, wara: waras[0], waras, boss, fx, run, camera, view: () => ({ w: VIEW_W, h: VIEW_H }), get save() { return save; }, get skin() { return look.id; } };
