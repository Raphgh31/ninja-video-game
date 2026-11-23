import { renderSmooth } from './engine/pixelfont.js';
import { loadCharacter, loadImage, loadJson } from './engine/sprites.js';
import { Input } from './engine/input.js';
import { TouchControls } from './engine/touch.js';
import { Level } from './game/level.js';
import { LEVELS } from './game/maps.js';
import { Player } from './game/player.js';
import { Shurikens, SHURIKEN } from './game/shuriken.js';
import { Tate, TATE } from './game/tate.js';
import { Wara, WARA } from './game/wara.js';
import { Karasu, KARASU } from './game/karasu.js';
import { DAMAGE_DEALT, DAMAGE_TAKEN, HEALTH } from './game/combat.js';
import { HealthBar } from './game/healthbar.js';
import { Fx } from './engine/fx.js';
import { ambience, audioOutput, musicOutput, play as sfx, unlockAudio } from './engine/sfx.js';
import { MUSIC, Music } from './engine/music.js';
import { clearSave, emptySave, listSaves, loadSave, setSlot, writeSave } from './game/save.js';
import { drawAura as drawAura0 } from './game/aura.js';
import { Mist } from './game/mist.js';
import { Shop, skinOrder } from './game/shop.js';
import './style.css';
import { pixelUI, setBrushText } from './engine/pixelui.js';
import { Intro } from './game/intro.js';
import { paintSheet } from './engine/brush.js';
import { crispSheet, NINJA_STYLES } from './engine/netsprite.js';
import { brushGL, brushView, smoothText } from './engine/brushgl.js';
import { ArenaArt } from './game/arena/art.js';
import { ForetArenaArt } from './game/arena/art_foret.js';
import { Net, randomCode, cleanCode } from './engine/net.js';
import { Multi, SLOT_COLORS, MODES } from './game/multi.js';
import { Lobby } from './game/arena/lobby.js';
import { Menu } from './game/menu.js';
import { loadProfile, saveProfile } from './game/profile.js';

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
let intro = null;   // introduction au lancement (src/game/intro.js), tant qu'elle est à l'écran

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
let GK = 1;    // pixels de la toile du jeu par pixel de jeu (style peint : comme le paysage)
let paintedMode = false;
const hudText = [];   // style peint : les textes de l'interface, posés après le pinceau
// calque des commandes tactiles (au-dessus du jeu, sous l'interface HTML)
const touchCanvas = MOBILE ? document.createElement('canvas') : null;
const touchCtx = touchCanvas?.getContext('2d');
if (touchCanvas) {
  touchCanvas.className = 'touch-layer';
  canvas.after(touchCanvas);
}

// Mise à l'échelle entière : chaque pixel du sprite reste un carré net.
const stage = canvas.parentElement;
// calque de l'interface : à la taille de l'image de jeu, en pixels de jeu, puis
// agrandi comme elle ; tous ses textes sont tracés avec la police en pixels
const uiLayer = document.querySelector('.ui');
/** Change un texte seulement s'il a changé (chaque changement redessine son canvas). */
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
const MOBILE_VIEW_H = 252;   // hauteur de jeu visée sur téléphone (comme sur ordinateur)
const TOUCH_VIEW_H = 180;    // hauteur du calque des commandes tactiles
let touchView = { w: 320, h: 180, scale: 1 };
// arène, pendant un combat, sur téléphone : l'image d'un cran plus proche (demande de l'utilisateur :
// on voit le jeu de plus près ; la caméra a alors deux hauteurs, voir arenaCamY)
let closeUp = false, camReady = false;
function fit() {
  if (MOBILE) {
    const W = window.innerWidth, H = window.innerHeight;     // pixels CSS
    const dpr = window.devicePixelRatio || 1;
    const rotated = H > W;                                     // portrait : jeu pivoté
    const LW = rotated ? H : W, LH = rotated ? W : H;          // côtés du jeu, en paysage
    // échelle entière en pixels réels de l'écran : la plus proche de 252 px de jeu en hauteur, et
    // jamais plus large que l'image de l'ordinateur (448 px) : la même échelle partout (les
    // téléphones allongés montraient plus loin, KAGE y paraissait petit ; demande de l'utilisateur)
    let dev = Math.max(1, Math.round((LH * dpr) / MOBILE_VIEW_H), Math.round((LW * dpr) / DESK_W));
    while (dev > 1 && (LW * dpr) / dev < 420) dev--;           // jamais trop étroit
    if (closeUp && (LW * dpr) / (dev + 1) >= 320) dev++;       // arène : un cran plus près
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
  GK = paintedMode ? bgK : 1;
  brushView.k = bgK; brushView.on = paintedMode;
  if (paintedMode && (passCanvas.width !== VIEW_W || passCanvas.height !== VIEW_H)) { passCanvas.width = VIEW_W; passCanvas.height = VIEW_H; passCtx.imageSmoothingEnabled = false; }
  if (canvas.width !== VIEW_W * GK || canvas.height !== VIEW_H * GK) {
    canvas.width = VIEW_W * GK;
    canvas.height = VIEW_H * GK;
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
  uiLayer.classList.toggle('short', VIEW_H < 236);   // écrans de menu compacts (téléphones allongés)
  uiLayer.style.width = `${VIEW_W}px`;
  uiLayer.style.height = `${VIEW_H}px`;
  uiLayer.style.transform = `scale(${SCALE})`;
  uiLayer.style.setProperty('--cx', `${Math.floor(VIEW_W / 2)}px`);
  uiLayer.style.setProperty('--cy', `${Math.floor(VIEW_H / 2)}px`);
  stage.style.setProperty('--gw', `${VIEW_W * SCALE}px`);
  stage.style.setProperty('--gh', `${VIEW_H * SCALE}px`);
  touch?.layout(touchView.w, touchView.h, touchView.scale);
  if (intro) placeIntro();
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

const { meta, skins } = await loadCharacter('./characters/kage', 'kage.json');
let look = skins.encre;     // skin porté (Encre : le ninja noir) ; changé à la boutique du marchand
// version de test (artefact privé) : tous les skins sont disponibles sans achat
const TEST_BUILD = !!globalThis.__KAGE_TEST;
const NINJA_STYLE = new URLSearchParams(location.search).get('ninja');
function wearSkin(id) {
  look = skins[id] ?? skins.encre;
  if (paintedMode) {                      // style peint : la feuille du skin, repeinte au pinceau (une fois)
    // le ninja, seul élément net du jeu peint : style à l'essai (?ninja=…), sinon repeint au pinceau
    look.painted ??= { ...look, sheet: NINJA_STYLES.includes(NINJA_STYLE) ? crispSheet(look.sheet, NINJA_STYLE) : paintSheet(look.sheet, { seed: 41 }) };
    look = look.painted;
  }
}
/**
 * Les traînées d'or d'un skin (Lumière d'or) : derrière le coup d'épée, les images précédentes de la lame et
 * de son arc, de plus en plus pâles (une traînée légère) ; derrière le dash, des silhouettes dorées qui
 * s'effacent. Rien ne change au jeu : c'est dessiné sous KAGE.
 */
const TRAIL_STRIKE = new Set(['attack', 'air_attack', 'flip_attack']);
const trail = [];
function drawTrail(cam) {
  const now = performance.now() / 1000, st = player.state, a = player.anim;
  const kind = TRAIL_STRIKE.has(st) ? 'blade' : st === 'dash' ? 'body' : null;
  const last = trail[trail.length - 1];
  if (kind && (!last || last.frame !== a.frame || last.name !== a.name || Math.abs(last.x - player.x) > 4)) {
    trail.push({ kind, name: a.name, frame: a.frame, x: player.x, y: player.y, facing: player.facing, t: now });
  }
  const life = { blade: 0.16, body: 0.22 };
  while (trail.length && now - trail[0].t > life[trail[0].kind]) trail.shift();
  const { pivot } = meta;
  ctx.save();
  for (const g of trail) {
    const k = 1 - (now - g.t) / life[g.kind];
    // (l'image en cours n'a pas besoin de fantôme : on ne garde que celles d'avant)
    if (g === trail[trail.length - 1] && g.frame === a.frame && g.name === a.name) continue;
    const f = meta.animations[g.name]?.frames[g.frame];
    if (!f) continue;
    ctx.globalAlpha = (g.kind === 'blade' ? 0.42 : 0.3) * k;
    const dx = Math.round(g.x - cam.x), dy = Math.round(g.y - cam.y) - pivot.y, sheet = look.trail[g.kind];
    if (g.facing < 0 && meta.flipForLeft) {
      ctx.save(); ctx.translate(dx, 0); ctx.scale(-1, 1);
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -pivot.x, dy, f.w, f.h);
      ctx.restore();
    } else ctx.drawImage(sheet, f.x, f.y, f.w, f.h, dx - pivot.x, dy, f.w, f.h);
  }
  ctx.restore();
}

/** L'éclat d'un skin légendaire (Lumière d'or) : orbe, volutes, étincelles (src/game/aura.js). */
// la traînée de brume du dash (skin à `dashFx: "mist"` : le ninja de la brume, src/game/mist.js)
const mist = new Mist();
function drawAura(cam) {
  drawAura0(ctx, Math.round(player.x - cam.x), Math.round(player.y - cam.y), player.facing, performance.now() / 1000);
}
// niveau : #terrain = terrain d'essai, #niveau-1 = niveau 1, sinon le chapitre 1 (Le Potager)
// version de test (artefact « The Ninja Game Test », window.__KAGE_TEST) : pas d'écran titre,
// et un panneau en haut à droite : skins sans achat, choix du chapitre, saut de zone en zone
const SKIN_LAB = TEST_BUILD;
const labGet = (k) => { try { return localStorage.getItem(`kage.lab.${k}`); } catch { return null; } };
const labSet = (k, v) => { try { localStorage.setItem(`kage.lab.${k}`, v); } catch { /* rien */ } };
const hashId = location.hash.slice(1);
// sans ancre : le chapitre de la partie en cours (la sauvegarde suit KAGE d'un chapitre à l'autre)
const save0 = !hashId && !TEST_BUILD ? loadSave() : null;
const LEVEL_ID = LEVELS[hashId] ? hashId : TEST_BUILD && LEVELS[labGet('chapter')] ? labGet('chapter')
  : save0 && LEVELS[save0.chapter] && !save0.done ? save0.chapter : 'potager';
const level = new Level(LEVEL_ID);
// style peint (essai sur le Potager, src/engine/brush.js) : le décor et les personnages repeints en touches
// d'aquarelle ; le calque du jeu est alors dessiné plus finement (GK pixels de toile par pixel de jeu).
// ?peint=0 dans l'adresse : le pixel art d'avant.
const PAINTED = !!level.painted;
const brush = brushGL();
const passCanvas = document.createElement('canvas');
const passCtx = passCanvas.getContext('2d', { willReadFrequently: false });
paintedMode = PAINTED;
brushView.on = PAINTED;
if (PAINTED) { fit(); wearSkin(look.id ?? 'encre'); }
if (level.forest) level.forest.touch = MOBILE;   // sur téléphone, le bouton de saut saisit la corde de la statue (comme une liane)
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
  multi?.onThrow(x, y, dir, height);
};
player.canThrow = () => shurikens.canThrow();
// ennemis : un TATE à chaque repère « E » de la carte
const tateMeta = await loadJson('./characters/tate/tate.json');
let tateSheet = await loadImage(`./characters/tate/${tateMeta.image}`);
if (PAINTED) tateSheet = paintSheet(tateSheet, { seed: 43 });
const tateGlow = await loadImage(`./characters/tate/${tateMeta.glowImage}`);
const tates = level.enemies.map((e) => new Tate(tateMeta, tateSheet, tateGlow, e.x, e.y, level));
shurikens.enemies.push(...tates);
// WARA : un épouvantail à chaque repère « W » de la carte
const waraMeta = await loadJson('./characters/wara/wara.json');
let waraSheet = await loadImage(`./characters/wara/${waraMeta.image}`);
if (PAINTED) waraSheet = paintSheet(waraSheet, { seed: 47 });
const waras = level.waras.map((w) => new Wara(waraMeta, waraSheet, w.x, w.y, level));
shurikens.enemies.push(...waras);
const enemies = [...tates, ...waras];
// boss du chapitre : KARASU-KASHI, perché sur son épouvantail géant (zone 9 du Potager)
let boss = null;
if (level.boss?.type === 'karasu') {
  const kbase = './characters/karasu';
  const kmeta = await loadJson(`${kbase}/karasu.json`);
  const [sheet, perch, items] = await Promise.all([kmeta.image, kmeta.perchImage, kmeta.itemImage].map((f) => loadImage(`${kbase}/${f}`)));
  boss = new Karasu(kmeta, PAINTED ? { sheet: paintSheet(sheet, { ox: 3 }), perch: paintSheet(perch, { ox: 7 }), items } : { sheet, perch, items }, level.boss, level);
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
    if (!save || sk.reward || save.skins.includes(id) || save.ryo < sk.price) return false;   // (une récompense ne s'achète pas)
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
    case 'flip': sfx('flip'); break;
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
    case 'swing_power': sfx('swingPower'); break;
    // coup du salto : reflet sur la lame dressée, puis éclat de lumière quand elle arrive en bas
    case 'blade_glint': {
      // le reflet suit la lame dressée pendant toute la charge (tremblement compris)
      const dx = d.x - player.x, dy = d.y - player.y, f0 = player.facing;
      fx.flash(d.x, d.y, { size: 6, life: 0.22, halo: 4, follow: () => ({ x: player.x + dx * player.facing * f0 + (player.anim.frame === 2 ? player.facing : 0), y: player.y + dy }) });
      break;
    }
    case 'blade_flash':
      sfx('bladeFlash');
      {
        const dx = d.x - player.x, dy = d.y - player.y, f0 = player.facing;
        fx.flash(d.x, d.y, { size: 15, life: 0.34, halo: 11, follow: () => ({ x: player.x + dx * player.facing * f0, y: player.y + dy }) });
      }
      fx.sparks(d.x, d.y, 7, { speed: 85 });
      fx.shake(2, 0.22);
      break;
    case 'kick_breath': sfx('breath'); break;
    // lianes de la Forêt
    case 'fall_death': sfx('land', { strength: 1 }); fx.shake(2, 0.25); fx.dust(d.x, d.y, 8, { spread: 30, up: 14 }); break;
    case 'vine_grab': sfx('vineGrab', { still: d.still }); fx.drift(player.x, player.y - 24, 3, { palette: 'leaf', speed: 30, up: 10, life: 0.9, g: 30 }); break;
    case 'vine_release': sfx('vineRelease'); if (d.perfect) { sfx('flip'); fx.drift(d.x, d.y - 20, 5, { palette: 'leaf', speed: 50, up: 20, life: 0.8, g: 40 }); } break;
    case 'vine_step': sfx('vineStep'); break;
    case 'kick': sfx('kick'); if (!d.air) fx.dust(d.x - d.facing * 2, d.y, 2, { dir: -d.facing, spread: 15, up: 6, life: 0.25 }); break;
    case 'hurt':
      sfx('hurt');
      fx.shake(2, 0.2);
      fx.sparks(d.x, d.y - 14, 6, { palette: 'hit', dir: Math.sign(d.x - d.fromX) });
      break;
    case 'drown': sfx('logDip'); fx.sparks(d.x, d.y - 4, 12, { palette: 'water', speed: 80 }); break;   // tombé à l'eau : une gerbe, puis la mort
    case 'death':
      sfx('death'); fx.shake(2, 0.25); run.falls++; if (save) save.falls = run.falls;
      if (level.arena) level.spawn = level.arena.nextSpawn();   // arène : on revient par un autre côté
      multi?.onDeath();                                          // à plusieurs : un point pour qui l'a touché, réapparition loin des autres
      break;
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
    // (le premier, quand KAGE entre dans l'arène, s'entend en entier même si le corbeau est encore hors de l'image)
    case 'caw': if (d.long) sfx('karasuCawLong'); else sfxAt('karasuCaw', d); break;
    case 'straw': fx.sparks(d.x + (Math.random() - 0.5) * 20, d.y, 5, { palette: 'straw', speed: 60 }); fx.drift(d.x, d.y + 10, 3, { palette: 'straw', speed: 30 }); break;
    case 'flap': fx.drift(d.x, d.y - 30, 2, { speed: 40 }); break;   // (le son : wingbeat)
    // sabre depuis le sol : il pare d'un coup d'aile (seul un saut depuis une plateforme le fait tomber)
    case 'parry': sfxAt('karasuWing', d); sfxAt('block', d, undefined, 0.5); fx.drift(d.x, d.y, 4, { speed: 60, up: 30 }); fx.sparks(d.x, d.y, 4, { dir: -d.dir, speed: 70 }); break;
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
      if (save) { save.bossDefeated = true; earnRewards(save); persist(); }
      break;
    default:
  }
}
if (boss) boss.onEvent = onKarasuEvent;
// La porte ouverte : le joueur garde la main. Une fois dans le passage, KAGE est
// dessiné par la porte, entre le couloir et la façade (temple.js, inside) : en
// continuant d'avancer, il passe derrière le vantail droit, le pilier et le mur
// du pavillon, et disparaît ; juste après, la fin du chapitre (l'arrivée G est
// derrière le mur).
const templeGate = level.art?.live?.templeGate ?? null;
const behindGate = () => templeGate && level.doorOpen && player.x >= templeGate.X - 24;
if (templeGate) templeGate.inside = (c, cam) => { if (behindGate()) player.draw(c, look.sheet, cam); };

/** La porte du temple s'ouvre : le talisman se déchire, les battants pivotent. */
// Elle ne s'ouvre que lorsque KAGE la voit : vaincu (ou à la reprise d'une partie
// où il l'est déjà), le corbeau la laisse « prête », et elle s'ouvre devant lui dès
// qu'elle entre dans l'image (voir updateGate) : le joueur la voit toujours s'ouvrir.
let gatePending = false;
function updateGate() {
  if (!gatePending || !gateProp) return;
  const gx = gateProp.x * 16 + 8;
  if (gx - camera.x < VIEW_W - 40 && gx - camera.x > -40) { gatePending = false; openTempleGate(); }
}
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
    // la Forêt : pont qui s'effondre, bois vermoulu, troncs flottants, statue, éboulis, oiseaux
    case 'collapseStart': sfx('collapseStart'); fx.shake(0.8, 0.6); break;
    case 'spanWarn': sfxAt('spanWarn', d); fx.dust(d.x, d.y, 5, { spread: d.w * 0.5, up: 10, life: 0.6, palette: 'stone' }); break;
    case 'spanFall': sfxAt('spanFall', d); fx.dust(d.x, d.y + 8, 7, { spread: d.w * 0.6, up: 18, life: 0.8 }); fx.shake(0.7, 0.15); break;
    case 'crumbleCreak': sfxAt('crumbleCreak', d); fx.dust(d.x, d.y + 4, 3, { spread: 20, up: -6, life: 0.5, palette: 'dirt' }); break;
    case 'crumbleFall': sfxAt('crumbleFall', d); fx.drift(d.x, d.y, 5, { palette: 'dirt', speed: 40, up: 6 }); break;
    case 'bridgeCreak': sfxAt('crumbleCreak', d, {}, 0.7); break;
    case 'plankFall': sfxAt('crumbleFall', d); fx.drift(d.x, d.y + 4, 4, { palette: 'dirt', speed: 30, up: 4 }); break;
    case 'branchCrack': sfxAt('crumbleCreak', d, {}, 1.2); fx.dust(d.x - 8, d.y + 2, 4, { spread: 14, up: -4, life: 0.6, palette: 'dirt' }); break;
    case 'branchSnap': sfxAt('crumbleFall', d, {}, 1.3); fx.sparks(d.x - 4, d.y + 2, 7, { speed: 70, palette: 'dirt' }); fx.drift(d.x - d.w / 2, d.y - 4, 9, { palette: 'leaf', speed: 45, up: 20, life: 1.6 }); fx.shake(0.5, 0.12); break;
    case 'logDip': sfxAt('logDip', d); fx.sparks(d.x, d.y + 8, 4, { palette: 'water', speed: 40 }); break;
    case 'eyeLit': sfx('eyeLit', { both: d.both }); fx.sparks(d.x, d.y, 10, { palette: 'glow', speed: 55 }); break;
    case 'gateOpen': sfx('jawOpen'); fx.shake(0.5, 1.2); fx.dust(d.x, d.y, 8, { spread: 12, up: 8, life: 0.8 }); if (save) { save.statue = true; persist(); } break;
    // la corde de la statue : la saisir, la tirer (elle grince, le bloc racle), la lâcher, le bloc qui retombe
    case 'ropeGrab': sfx('vineGrab', { still: true }); break;
    case 'ropeRelease': sfx('vineRelease'); break;
    case 'ropeStrain': sfxAt('crumbleCreak', d); break;
    case 'ropeHeave': fx.shake(0.6, 0.2); sfxAt('crumbleCreak', d); break;
    case 'ropeBreath': sfx('breath'); break;
    case 'blockFall': sfx('land', { strength: 1 }); fx.shake(1.5, 0.3); fx.dust(d.x, d.y, 10, { spread: 18, up: 6, life: 0.6 }); break;
    case 'gateDone': sfx('jawDone'); fx.shake(1.2, 0.25); fx.dust(d.x, d.y - 32, 8, { spread: 14, up: -6, life: 0.9 }); break;
    case 'slideStart': sfx('slideStart'); if (d.pile) { sfx('boulderLand'); fx.shake(2.6, 1.1); } else fx.shake(1, 0.8); slideRumble = 0.5; break;
    case 'slideHit': sfx('slideHit'); fx.shake(2.4, 0.4); fx.dust(d.x, d.y, 10, { spread: 40, up: 30, life: 0.8 }); break;
    case 'slideEnd': sfxAt('slideEnd', d); fx.shake(1.2, 0.3); break;
    case 'pileCreak': sfxAt('crumbleCreak', d); fx.shake(0.4 + d.k * 0.8, 0.22); break;
    case 'birds': sfxAt('birds', d); fx.drift(d.x, d.y - 4, 3, { palette: 'feather', speed: 30, up: 20 }); break;
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

// ---- mode combat : l'arène (grue, gong et vagues, foin, caisses, bonus) ---------
const arenaArt = level.arena && level.art ? (level.theme === 'foret' ? new ForetArenaArt(level) : new ArenaArt(level)) : null;
if (level.arena) {
  level.arena.onEvent = (n, d) => {
    switch (n) {
      case 'gongArena': sfx('gong'); fx.shake(1.4, 0.35); fx.sparks(d.x, d.y, 10, { speed: 80 }); break;
      case 'gongDull': sfx('block'); break;                    // déjà frappé : le bronze ne chante pas
      case 'gongReady': sfxAt('bell', d, undefined, 0.5); break;
      case 'sluiceRumble': sfx('woodCreak'); fx.shake(0.6, 0.5); break;
      case 'sluiceOpen': sfxAt('waterRush', d); fx.sparks(d.x + d.dir * 10, d.y - 8, 8, { palette: 'water', speed: 90, dir: d.dir }); break;
      case 'waveFall': sfxAt('logDip', d); fx.sparks(d.x, d.y + 14, 6, { palette: 'water', speed: 60 }); break;
      case 'waveHit': sfxAt('logDip', d); fx.sparks(d.x, d.y - 4, 8, { palette: 'water', speed: 90, dir: d.dir }); break;
      case 'hayBounce': sfxAt('hayBounce', d, { k: d.k }); fx.drift(d.x, d.y - 2, 4, { palette: 'straw', speed: 50, up: 40 }); fx.sparks(d.x, d.y - 2, 5, { palette: 'straw', speed: 60 }); break;
      case 'scaffoldRebuild': sfxAt('crateLand', d, {}, 0.6); fx.dust(d.x, d.y, 6, { spread: d.w * 0.5, up: 10, life: 0.5 }); break;
      case 'craneWinch': sfxAt('woodCreak', d); break;
      case 'craneHit': fx.shake(2.2, 0.3); break;
      case 'crateKick': sfx('kickHit'); fx.dust(d.x - d.dir * 6, d.y + 6, 4, { dir: -d.dir, spread: 20, up: 6 }); break;
      case 'crateBreak': sfxAt('crate', d); fx.dust(d.x, d.y + 6, 6, { spread: 30, up: 16 }); fx.sparks(d.x, d.y, 5, { palette: 'straw', speed: 80 }); break;
      case 'crateSplash': sfxAt('logDip', d); fx.sparks(d.x, d.y, 10, { palette: 'water', speed: 80 }); break;
      // le bassin de la Forêt : la source gronde quand l'eau monte, puis noie les rochers ; elle redescend
      case 'basinRise': sfxAt('waterRush', d, {}, 0.55); fx.sparks(d.x, d.y, 6, { palette: 'water', speed: 40 }); break;
      case 'basinFlood': sfxAt('waterRush', d, {}, 0.8); fx.shake(0.5, 0.4); fx.sparks(d.x, d.y, 10, { palette: 'water', speed: 60 }); break;
      case 'basinFall': sfxAt('logDip', d); break;
      case 'pickupAppear': sfxAt('pickup', d, undefined, 0.5); break;
      case 'pickup':
        if (d.kind === 'heart') { d.fighter.hp = Math.min(HEALTH.max, d.fighter.hp + 1); sfx('heart'); fx.sparks(d.x, d.y, 8, { palette: 'heart', speed: 50 }); }
        else { shurikens.stock = SHURIKEN.stock; sfx('pickup'); fx.sparks(d.x, d.y, 6, { speed: 50 }); }
        break;
      default: level.onEvent?.(n, d);                         // corde, chute des balles, échafaudages : comme dans le chapitre
    }
  };
}

// ---- l'arène à plusieurs : le salon, puis les combats (net.js, multi.js, arena/lobby.js) ----
// Le menu (Arène → Créer / Rejoindre) range le choix dans sessionStorage puis ouvre l'arène ;
// une adresse ?salle=CODE rejoint aussi directement une arène.
let multi = null;
let lobby = null;
const profile = loadProfile();
function roomConfig() {
  let c = null;
  try { c = JSON.parse(sessionStorage.getItem('kage-salle') || 'null'); } catch { /* rien */ }
  const q = new URLSearchParams(location.search).get('salle');
  if (!c && q && cleanCode(q).length === 4) c = { mode: 'join', code: cleanCode(q) };
  if (c) c.name = c.name || profile.name;     // (les tests donnent un nom à chaque onglet)
  return c;
}
/** Retour au menu de l'écran titre, sur un écran donné (avec un message), depuis l'arène. */
function backToMenu(screen = null, extra = {}) {
  try {
    sessionStorage.removeItem('kage-salle');
    if (screen) sessionStorage.setItem('kage-menu', JSON.stringify({ screen, ...extra }));
  } catch { /* rien */ }
  if (TEST_BUILD) labSet('chapter', 'potager');
  location.replace(location.pathname + location.search.replace(/[?&]salle=[^&]*/, ''));
}
function startRoom(cfg) {
  const hud = document.querySelector('.salle'), codeEl = hud.querySelector('[data-salle-code]');
  const listEl = hud.querySelector('[data-salle-list]'), msgEl = hud.querySelector('[data-salle-msg]');
  const transport = new URLSearchParams(location.search).get('net') === 'local' || window.__KAGE_NET === 'local' ? 'local' : 'peer';
  const net = new Net({ code: cfg.code, host: cfg.mode === 'host', name: cfg.name, transport });
  let msgT = null;
  const say = (t, keep = false) => { setText(msgEl, t); clearTimeout(msgT); if (!keep) msgT = setTimeout(() => setText(msgEl, ''), 3500); };
  const nameOf = (id) => net.roster.find((p) => p.id === id)?.name ?? '?';
  const showList = () => {
    listEl.replaceChildren(...net.roster.map((p) => {
      const el = document.createElement('p');
      el.style.setProperty('--slot', SLOT_COLORS[p.slot % 4]);
      el.textContent = `${p.name} : ${multi?.scores.get(p.id) ?? 0}`;
      return el;
    }));
  };
  run.paused = true;                       // le salon d'abord : le combat attend que l'hôte le lance
  setCloseUp(false);                       // (le salon à l'échelle des menus)
  net.onStatus = (st, detail) => {
    if (st === 'connexion') lobby?.setStatus(cfg.mode === 'host' ? "Ouverture de l'arène…" : `Connexion à l'arène ${cfg.code}…`);
    else if (st === 'ouverte') lobby?.setStatus('');
    else if (st === 'connecté') lobby?.setStatus('');
    else if (st === 'introuvable') backToMenu('rejoindre', { code: cfg.code, message: 'Arène introuvable : vérifie le code' });
    else if (st === 'pleine') backToMenu('rejoindre', { code: cfg.code, message: 'Arène pleine : quatre joueurs au plus' });
    else if (st === 'perdue') { lobby?.setStatus("L'hôte a quitté l'arène"); setTimeout(() => backToMenu('arene'), 2500); }
    else if (st === 'prise') {                          // ce code est déjà pris : on en tire un autre
      net.close();
      cfg.code = randomCode();
      try { sessionStorage.setItem('kage-salle', JSON.stringify(cfg)); } catch { /* rien */ }
      lobby?.el.remove(); lobby = null; multi = null;
      startRoom(cfg);
    } else if (st === 'erreur') {
      if (cfg.mode === 'host') lobby?.setStatus(detail || 'Pas de connexion au service des arènes');
      else backToMenu('rejoindre', { code: cfg.code, message: detail || 'Pas de connexion au service des arènes' });
    }
  };
  multi = new Multi({
    painted: PAINTED,
    net, player, shurikens, level, levelId: LEVEL_ID, meta, skins, skinId: () => look.id,
    onEvent(n, d) {
      if (n === 'roster') { showList(); lobby?.render(); }
      else if (n === 'arena') {
        // l'hôte a ouvert une autre arène : on la rejoint (même code)
        net.onStatus = () => {};
        net.close();
        try { sessionStorage.setItem('kage-salle', JSON.stringify({ ...cfg, arena: d.id })); sessionStorage.setItem('kage-sans-intro', '1'); } catch { /* rien */ }
        if (TEST_BUILD) labSet('chapter', d.id);
        location.hash = `#${d.id}`;
      }
      else if (n === 'mode') lobby?.setMode(d.mode);
      else if (n === 'start') {
        lobby?.hide();
        setCloseUp(true);
        hud.hidden = false;
        setText(codeEl, `${MODES[d.mode].name} · ${net.code}`);
        showList(); say('Le combat commence !');
        sfx('gong');
        run.paused = false;
        snapCamera();
      } else if (n === 'ko') { showList(); say(`Un point pour ${nameOf(d.by)}`); }
      else if (n === 'out') say('Éliminé : tu regardes la fin du combat', true);
      else if (n === 'end') {
        sfx('gong');
        const lines = net.roster.map((p) => `${p.name} : ${multi.scores.get(p.id) ?? 0}`);
        setTimeout(() => {
          run.paused = true;
          hud.hidden = true;
          setCloseUp(false);
          lobby?.result(d.name, lines);
          setTimeout(() => { if (lobby) { lobby.show(); } }, 4000);
        }, 900);
      } else if (n === 'strike') fx.sparks(d.x, d.y, 6, { palette: 'hit', dir: d.dir });
    },
  });
  lobby = new Lobby(uiLayer, { net, multi, meta, skins, arenaName: level.name.replace(/^Arène — /, ''),
    backdrop: new Intro(meta, null, null, { backdropOnly: true }), onLaunch: (mode) => multi.launch(mode), onQuit: () => { net.close(); backToMenu('arene'); }, onHome: () => { net.close(); backToMenu('accueil'); } });
  net.onStatus('connexion');
  net.start().catch(() => net.onStatus('erreur', 'Pas de connexion au service des arènes'));
}
/** Arène : image rapprochée (combat) ou à l'échelle des menus (salon). */
function setCloseUp(on) {
  if (closeUp === on) return;
  closeUp = on;
  fit();
  if (camReady) snapCamera();
}
// en arène, le ninja porte le skin de l'aventure en cours (dans la version de test, c'est la barre des skins)
if (level.arena && !SKIN_LAB) { const s = loadSave(); if (s?.skin && (s.skins ?? []).includes(s.skin)) wearSkin(s.skin); }
if (level.arena) { setCloseUp(true); const cfg = roomConfig(); if (cfg) startRoom(cfg); }

// son : débloqué au premier geste, toujours actif (aucun bouton ni touche pour le couper : le joueur passe son
// téléphone en silencieux s'il le veut)
// musique du chapitre : chargée tout de suite, jouée au premier geste du joueur
const music = new Music();
music.load(level.music);
music.add('boss', level.bossMusic);
// (pendant l'introduction, c'est sa propre musique qui joue : celle du chapitre attend la fin)
const onGesture = () => { unlockAudio(); if (!intro || intro.closing) music.start(); };
for (const t of ['keydown', 'pointerdown', 'touchstart']) addEventListener(t, onGesture, { capture: true, passive: true });

// barres de vie fines au-dessus de chaque personnage
const kageBar = new HealthBar(HEALTH.max);
for (const t of tates) t.bar = new HealthBar(TATE.hp);
for (const w of waras) w.bar = new HealthBar(WARA.hp);
if (boss) boss.bar = new HealthBar(KARASU.hp);
player.onRespawn = () => {
  // (dans l'arène, les planches et le tronc sont partagés : on ne remet en place que la liane qu'il tenait)
  if (level.arena) level.forest?.vines.forEach((v) => { if (v.rider === player) v.rider = null; });
  else level.forest?.reset(level.spawn);
  snapCamera();   // retour à la lanterne : coupe franche plutôt qu'un long travelling
  shurikens.reset();
  // les ennemis encore debout reprennent leur poste ; les vaincus le restent
  for (const t of enemies) if (t.state !== 'defeated') { t.reset(); t.bar.reset(); }
  if (boss && boss.state !== 'defeated') { bossUi.shown = 0; bossUi.lag = 1; }
  kageBar.reset();
};
const input = new Input();
touch = MOBILE ? new TouchControls(touchCanvas, input) : null;
if (touch) touch.onTap = (u, v) => tapChest(u, v);
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
let labZone = null;   // libellé « Zone 03 » du panneau de test
if (SKIN_LAB) setupSkinLab();

/**
 * Panneau de la version de test, en haut à droite de l'image : une vignette par
 * skin (clic ou touches 1, 2…), les chapitres, et le saut de zone en zone.
 */
function setupSkinLab() {
  document.querySelector('.levels').style.display = 'none';
  document.title = 'The Ninja Adventure — Test';
  const lab = document.createElement('div');
  lab.className = 'lab';
  // tout le panneau (skins, chapitres, zones…) s'ouvre et se ferme d'un seul bouton ; fermé, on ne voit que
  // ce bouton (demande de Raph : que le panneau n'empiète pas sur l'image)
  const panel = document.createElement('div');
  panel.className = 'lab__panel';
  const stop = (el) => el.addEventListener('pointerdown', (e) => e.stopPropagation());
  const button = (label, title, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (label) b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', () => { onClick(); b.blur(); });
    stop(b);
    return b;
  };
  // --- skins ---
  const bar = document.createElement('div');
  bar.className = 'skinlab';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Skins');
  const f = meta.animations.idle.frames[0];
  const ids = skinOrder(skins);
  const buttons = ids.map((id, i) => {
    const b = button('', `${skins[id].name} (touche ${i + 1})`, () => pick(id));
    b.dataset.skin = id;
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 26;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(skins[id].sheet, f.x, f.y + 6, 32, 26, 0, 0, 32, 26);
    const name = document.createElement('span');
    name.textContent = skins[id].name;
    b.append(cv, name);
    bar.append(b);
    return b;
  });
  function pick(id) {
    wearSkin(id);
    labSet('skin', id);
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.skin === id));
  }
  addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= ids.length) pick(ids[n - 1]);
  });
  panel.append(bar);
  // --- chapitres : un clic recharge la page sur le chapitre choisi ---
  const chapters = Object.entries(LEVELS).filter(([, l]) => l.chapter != null).sort((a, b) => a[1].chapter - b[1].chapter);
  const row = document.createElement('div');
  row.className = 'lab__row';
  row.dataset.chapters = '';
  for (const [id, l] of chapters) {
    const b = button(`Chapitre ${l.chapter}`, l.name, () => {
      if (id === LEVEL_ID) { gotoZone(0); return; }
      labSet('chapter', id);
      sessionStorage.setItem('kage-sans-intro', '1');   // on change de chapitre : pas d'intro
      location.hash = `#${id}`;
      location.reload();
    });
    b.dataset.labChapter = id;
    b.setAttribute('aria-pressed', String(id === LEVEL_ID));
    row.append(b);
  }
  // mode combat : les arènes (une par chapitre)
  for (const [id, l] of Object.entries(LEVELS).filter(([, v]) => v.arena)) {
    const b = button(`Arène ${{ potager: 'Potager', foret: 'Forêt' }[l.theme] ?? ''}`.trim(), l.name, () => {
      labSet('chapter', id);
      sessionStorage.setItem('kage-sans-intro', '1');
      location.hash = `#${id}`;
      location.reload();
    });
    b.dataset.labChapter = id;
    b.setAttribute('aria-pressed', String(id === LEVEL_ID));
    row.append(b);
  }
  const again = button('Intro', 'Rejouer l\'introduction', () => playIntro());
  again.dataset.labIntro = '';
  row.append(again);
  panel.append(row);
  // témoin du son (pour comprendre, sur l'appareil de l'utilisateur, pourquoi une musique ne sort pas)
  const sound = document.createElement('div');
  sound.className = 'lab__row lab__sound';
  const soundText = document.createElement('span');
  sound.append(soundText);
  panel.append(sound);
  const SOUND = { running: 'en marche', suspended: 'suspendu', interrupted: 'interrompu', closed: 'fermé' };
  setInterval(() => {
    const ac = audioOutput()?.ac;
    const it = !intro || intro.closing ? 'finie' : intro.gated ? 'en attente' : intro.voice ? 'musique' : intro.waking ? 'démarrage…' : 'sans musique';
    setText(soundText, `Son : ${ac ? SOUND[ac.state] ?? ac.state : 'aucun'} · Intro : ${it}`);
  }, 500);
  // --- zones : ← Zone 03 → pose KAGE à la lanterne de la zone ---
  if (level.zones.length && !level.arena) {
    const zr = document.createElement('div');
    zr.className = 'lab__row';
    zr.dataset.zones = '';
    const cur = () => Math.max(0, level.zones.indexOf(level.zoneAt(player.x)));
    labZone = document.createElement('span');
    labZone.textContent = `Zone ${level.zones[0].id}`;
    const prev = button('←', 'Zone précédente', () => gotoZone(cur() - 1));
    prev.dataset.zone = 'prev';
    const next = button('→', 'Zone suivante', () => gotoZone(cur() + 1));
    next.dataset.zone = 'next';
    zr.append(prev, labZone, next);
    panel.append(zr);
  }
  const toggle = button('Réglages', 'Ouvrir ou fermer le panneau de test', () => setOpen(panel.hidden));
  toggle.className = 'lab__toggle';
  toggle.dataset.labToggle = '';
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    labSet('open', open ? '1' : '0');
  }
  setOpen(labGet('open') === '1');      // fermé au premier lancement, puis comme on l'a laissé
  lab.append(toggle, panel);
  uiLayer.append(lab);
  pick(skins[labGet('skin')] ? labGet('skin') : 'encre');
}

/** Version de test : pose KAGE au début de la zone i (à sa lanterne s'il y en a une). */
function gotoZone(i) {
  const z = level.zones[Math.max(0, Math.min(level.zones.length - 1, i))];
  if (!z || !save) return;
  const cp = level.checkpoints.find((k) => k.x >= z.x0 * 16 && k.x < z.x1 * 16);
  if (cp) {
    level.checkpoints.forEach((k) => { k.lit = k.x <= cp.x; });
    level.spawn = { x: cp.x, y: cp.y };
  } else {
    const tx = z.x0 + 3;
    let ty = 0;
    while (ty < level.h && !level.solid(tx, ty)) ty++;
    level.checkpoints.forEach((k) => { k.lit = k.x < tx * 16; });
    level.spawn = { x: tx * 16 + 8, y: ty * 16 };
  }
  player.respawn(true);
  startX = player.x;
  for (const h of level.hints) if (h.x * 16 < player.x - 48) hintsDone.add(h.kind);
  hint = null;
  snapCamera();
}

function update(dt) {
  // touches d'interface : traitées même pendant un micro-arrêt
  if (input.wasPressed('debug')) { debug = !debug; input.pressed.delete('debug'); }
  // écran titre ou boutique ouverte : le monde attend
  if (run.paused) {
    if (shop.isOpen && input.wasPressed('escape')) shop.close();
    input.endFrame();
    return;
  }
  // micro-arrêt sur un coup : tout se fige un instant (les appuis de jeu sont gardés)
  if (fx.frozen(dt)) return;
  if (!multi?.out) player.update(dt, run.won ? IDLE_INPUT : input);   // (Souffle unique : éliminé, il regarde)
  level.update(dt);
  level.arena?.update(dt, [player]);
  multi?.update(dt);
  level.forest?.update(dt, player);
  shurikens.update(dt);
  mist.update(dt, player, look.dashFx === 'mist');
  for (const t of enemies) {
    t.update(dt, player);
    t.interact(player);
  }
  const ab = player.attackBox();
  if (ab) {
    const power = player.state === 'flip_attack';
    const heavy = player.state === 'air_attack' || power;
    level.hitGongs(ab);
    if (multi?.strikeBox(ab, player.x, `a${player.attackId}`, power ? DAMAGE_DEALT.flipSword : heavy ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword, 0)) {
      sfx('bladeHit', { heavy }); fx.hitStop(power ? 0.15 : heavy ? 0.11 : 0.07);
    }
    for (const t of enemies) {
      swordStrike = true;
      const r = t.takeHit(ab, player.x, player.attackId, power ? DAMAGE_DEALT.flipSword : heavy ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword);
      swordStrike = false;
      if (r === 'hit') {
        sfx('bladeHit', { heavy });
        fx.hitStop(power ? 0.15 : heavy ? 0.11 : 0.07);
        if (heavy) fx.shake(power ? 3 : 2, power ? 0.26 : 0.18);
      } else if (r === 'blocked') {
        fx.hitStop(0.04);
      }
    }
  }
  // coup de pied : 1 dégât, et l'ennemi recule (même s'il pare)
  const kb = player.kickBox();
  if (kb) {
    level.hitGongs(kb);
    if (multi?.strikeBox(kb, player.x, `k${player.attackId}`, DAMAGE_DEALT.kick, player.kickPush)) { sfx('kickHit'); fx.hitStop(0.06); }
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
  if (level.arena && player.kickBox()) level.arena.kickCrates(player.kickBox(), player.facing, player);
  for (const box of [ab, level.arena ? null : player.kickBox()]) {
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
  updateGate();
  // musique : celle du combat dès qu'on entre dans le champ du corbeau (zone 9),
  // en fondu enchaîné, tant qu'il n'est pas vaincu ; ensuite, retour à celle du chapitre
  if (CHAPTER && boss && level.bossMusic && !run.won) {
    // (elle commence un peu avant l'arène, 4 cases avant, avec une transition plus vive)
    const want = boss.state !== 'defeated' && player.x >= boss.arena[0] - 4 * 16 ? 'boss' : 'main';
    if (music.active !== want) music.switchTo(want, want === 'boss' ? { fadeOut: 2.5, fadeIn: 3.5, delay: 0.4 } : { fadeOut: 3, fadeIn: 5, delay: 1.5 });
  }
  // progression : lanternes et arrivée
  if (!run.won && level.checkProgress(player.x, player.y) && level.goal) win();
  if (!run.won && level.goal) run.time += dt;
  fx.update(dt);
  if (player.state !== 'death' && player.state !== 'respawn') shurikens.pickup(player.box());
  kageBar.update(dt, player.hp);
  for (const t of enemies) t.bar.update(dt, Math.max(0, t.hp));
  if (boss) updateBossUi(dt);
  updateCamera(dt);
  if (level.theme === 'foret') forestSound(dt);
  input.endFrame();
}

// ---- l'ambiance de la Forêt ------------------------------------------------------
// Une nappe discrète qui suit la lumière de la zone ; l'éboulis gronde tant qu'il dévale.
const FOREST_AMB = {
  matin: { wind: 0.5, birds: 1, creak: 0.15 },
  sousbois: { wind: 0.35, birds: 0.35, drops: 0.25, creak: 0.35 },
  canopee: { wind: 1, birds: 0.8, creak: 0.3 },
  souterrain: { drops: 1, cave: 0.7 },
  sanctuaire: { wind: 0.25, drops: 0.7, cave: 0.3 },
  couchant: { wind: 0.6, birds: 0.35, creak: 0.3 },
  crepuscule: { wind: 0.35, crickets: 1, birds: 0.1 },
};
let slideRumble = 0;
function forestSound(dt) {
  const z = level.zones.find((zz) => player.x >= zz.px0 && player.x < zz.px1);
  const under = level.forest?.dark && player.x > level.forest.dark.x0 && player.x < level.forest.dark.x1 && player.y > level.forest.dark.y0 + 48;
  const mix = { ...(FOREST_AMB[under ? 'souterrain' : z?.mood] ?? FOREST_AMB.sousbois) };
  if (z?.id === '06') mix.water = 1;                       // le torrent
  if (z?.id === '03') mix.water = 0.25;                     // les mares (un filet d'eau)
  ambience(dt, run.paused || run.won ? null : mix);
  const S = level.forest?.slide;
  if (S?.active) {
    slideRumble -= dt;
    if (slideRumble <= 0) { slideRumble = 0.42; sfxAt('slideRumble', { x: S.x, y: player.y }); }
  }
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
const camGround = { y: null, k: CAM.ground };                 // sol de référence du palier en cours
const camV = { from: 0, to: 0, t: 1, dur: CAM.move };   // transition verticale en cours
let camVX = 0;                                 // vitesse horizontale (amorti)

const clampCamX = (x) => {
  // arène : on ne voit jamais au-delà des bosquets qui la ferment (si l'image est plus large, on la centre)
  if (level.arena) {
    const [l, r] = level.arena.def.walls, a = l * 16, z = (r + 1) * 16;
    return z - a <= VIEW_W ? Math.round((a + z - VIEW_W) / 2) : Math.min(Math.max(x, a), z - VIEW_W);
  }
  return Math.min(Math.max(x, 0), level.width - VIEW_W);
};
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
/** Hauteur du sol dans l'image : celle de la caméra, ou celle imposée par la zone (la statue tient entière dans l'image). */
function camGroundAt(x) {
  const z = level.zones?.find((zz) => x >= zz.px0 && x < zz.px1);
  return z?.camGround ?? CAM.ground;
}

function retargetY(groundY) {
  camGround.y = groundY;
  const to = clampCamY(groundY - VIEW_H * camGroundAt(player.x));
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
  // arène : la hauteur ne bouge jamais
  if (level.arena) { camera.y = arenaCamY(dt); return; }
  // hauteur : paliers
  if (camGround.y == null) retargetY(player.y);
  const alive = player.state !== 'death' && player.state !== 'respawn';
  if (alive && player.onGround && Math.abs(player.y - camGround.y) > CAM.step) retargetY(player.y);
  // cadrage imposé par la zone (la statue) : on recadre en entrant et en sortant
  const gAt = camGroundAt(player.x);
  if (alive && gAt !== camGround.k) { camGround.k = gAt; if (player.onGround) retargetY(player.y); }
  // garde-fous : KAGE ne sort jamais de l'image (puits, grandes chutes)
  const y = camV.t < 1 ? camV.to : camera.y;
  if (alive && player.y - 31 < y + VIEW_H * CAM.top) retargetY(player.y - 31 + VIEW_H * (CAM.ground - 0.3));   // tête ramenée à 30 %
  // vers le bas, seulement s'il descend vers un vrai sol (pas dans l'eau, un ravin, ou hors de la carte) :
  // sinon l'image reste figée et KAGE sort de l'écran par le bas
  else if (alive && player.y > y + VIEW_H * CAM.bottom && groundBelow(player.x, player.y) != null) retargetY(player.y + 32);
  if (camV.t < 1) {
    camV.t = Math.min(1, camV.t + dt / camV.dur);
    camera.y = camV.from + (camV.to - camV.from) * ease(camV.t);
  }
}

/** Ligne du premier vrai sol sous (x, y) (tuile pleine ou passerelle), ou null : eau, vide, bas de la carte. */
function groundBelow(x, y) {
  const tx = Math.floor(x / 16);
  for (let ty = Math.floor(y / 16); ty < level.h; ty++) {
    const c = level.at(tx, ty);
    if (c === '~' || c === 'v' || c === '^') return null;
    if (level.solid(tx, ty) || level.ledge(tx, ty)) return ty;
  }
  return null;
}

/**
 * Arène : en hauteur, le sol à 85 % de l'image. Sur ordinateur, l'image montre tout : elle
 * suit à peine KAGE quand il saute de l'étage du haut. Sur un écran plus bas (téléphone,
 * combat rapproché), deux hauteurs seulement, comme les paliers de l'aventure : en bas (au sol
 * et sur les premières plateformes), et en haut — une montée légère, ~3,5 cases sur un téléphone
 * allongé —, dès que KAGE se pose à 4,5 cases ou plus ;
 * on passe de l'une à l'autre d'un seul mouvement fluide (0,6 s, lent-rapide-lent), et il
 * faut redescendre à 3,5 cases ou moins pour revenir en bas.
 */
let arenaY = null, arenaHigh = false, arenaMove = null;
const ARENA_CAM = { up: 4.5 * 16, down: 3.5 * 16, top: 9 * 16, head: 30, margin: 0.15, time: 0.6 };
function arenaCamY(dt = 1) {
  // (le sol à 85 % de l'image ; une arène peut le remonter : camGround, la Forêt montre son bassin)
  const a = level.arena.def, low = Math.round(a.ground + VIEW_H * (1 - (a.camGround ?? 0.85)) - VIEW_H);
  if (VIEW_H >= 236) {                                     // ordinateur : presque fixe
    const top = Math.min(low, Math.round(a.ground - 15 * 16));
    let want = low;
    if (top < low) want = Math.max(top, Math.min(low, Math.round(player.y - VIEW_H * 0.62)));
    arenaY = arenaY == null ? want : arenaY + (want - arenaY) * Math.min(1, dt * 5);
    return clampCamY(Math.round(arenaY));
  }
  // en haut : une montée légère, juste ce qu'il faut pour que KAGE, debout sur l'étage le plus
  // haut (9 cases), ait la tête dans l'image avec un peu de marge (15 % de l'image au-dessus)
  const high = Math.min(low, Math.round(a.ground - ARENA_CAM.top - ARENA_CAM.head - VIEW_H * ARENA_CAM.margin));
  const feet = a.ground - player.y, alive = player.state !== 'death' && player.state !== 'respawn';
  if (alive && player.onGround) {
    if (feet >= ARENA_CAM.up) arenaHigh = true;
    else if (feet <= ARENA_CAM.down) arenaHigh = false;
  }
  const want = arenaHigh ? high : low;
  if (arenaY == null) { arenaY = want; arenaMove = null; }
  if (!arenaMove || arenaMove.to !== want) arenaMove = { from: arenaY, to: want, t: arenaY === want ? 1 : 0 };
  arenaMove.t = Math.min(1, arenaMove.t + dt / ARENA_CAM.time);
  const k = arenaMove.t * arenaMove.t * (3 - 2 * arenaMove.t);
  arenaY = arenaMove.from + (arenaMove.to - arenaMove.from) * k;
  return clampCamY(Math.round(arenaY));
}
function arenaCamera() {
  camera.x = clampCamX(Math.round(player.x - VIEW_W * 0.42));
  arenaY = null; arenaMove = null;
  arenaHigh = level.arena.def.ground - player.y >= ARENA_CAM.up;
  camera.y = arenaCamY();
  camVX = 0;
}

camReady = true;                         // (setCloseUp peut maintenant recadrer)

/** Caméra posée d'un coup sur KAGE (écran titre, reprise d'une partie). */
function snapCamera() {
  if (level.arena) { arenaCamera(); return; }
  camGround.y = player.y;
  camera.x = clampCamX(player.x - VIEW_W * 0.42);
  camera.y = clampCamY(player.y - VIEW_H * camGroundAt(player.x));
  camV.to = camera.y; camV.t = 1; camVX = 0;
}

function draw() {
  // secousse de l'écran : décalage temporaire de la caméra
  const shake = fx.offset();
  // une seule position, arrondie au pixel, pour tout ce qui est dessiné
  const cam = { x: Math.round(camera.x + shake.x), y: Math.round(camera.y + shake.y) };
  ctx.setTransform(GK, 0, 0, GK, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // style peint : le monde se dessine d'abord en pixels sur une toile à part (W), puis le pinceau de la carte
  // graphique le repeint dans l'image (touches accrochées au monde) ; les personnages, repeints à l'avance,
  // se posent par-dessus ; puis le premier plan et les effets, repeints de même ; puis l'interface.
  const B = PAINTED && brush.ok;
  const W = B ? passCtx : ctx;
  if (B) { passCtx.setTransform(1, 0, 0, 1, 0, 0); passCtx.clearRect(0, 0, VIEW_W, VIEW_H); }
  if (level.art) {
    // paysage : position exacte de la caméra, arrondie au pixel d'écran
    bgCtx.setTransform(bgK, 0, 0, bgK, 0, 0);
    bgCtx.imageSmoothingEnabled = false;
    level.art.backdrop.draw(bgCtx, { x: camera.x + shake.x, y: camera.y + shake.y }, VIEW_W, VIEW_H, level.time, bgK);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  }
  level.draw(W, cam, VIEW_W, VIEW_H);
  level.drawTargets(W, cam);
  level.drawProps(W, cam);
  arenaArt?.drawBack(W, cam, level.time);
  boss?.drawBack(W, cam);
  shurikens.drawStuck(W, look.projectiles.shuriken, cam);
  if (B) brush.paint(ctx, passCanvas, GK, { cam, wide: 'mid', detail: 0.2, soft: 0.35 });
  for (const t of tates) t.draw(ctx, cam, player);
  for (const w of waras) w.draw(ctx, cam);
  drawScarecrows(cam);
  boss?.draw(ctx, cam);
  multi?.draw(ctx, cam);
  if (look.trail && !behindGate()) drawTrail(cam);
  if (!behindGate() && !multi?.out) player.draw(ctx, look.sheet, cam);   // (dans le passage, c'est la porte qui le dessine)
  if (look.aura && !behindGate() && player.state !== 'death') drawAura(cam);
  if (B) passCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (!behindGate()) mist.draw(W, cam);
  level.drawForeground(W, cam);
  arenaArt?.drawFront(W, cam, level.time);
  shurikens.drawFlying(W, look.projectiles.shuriken, cam, !!look.trail, { faces: look.projectileFaces, dust: look.projectileDust });
  fx.draw(W, cam);
  if (B) brush.paint(ctx, passCanvas, GK, { cam, wide: null, soft: 0.2 });   // (le premier plan : touches fines, plus précis)
  if (run.title) return;   // écran titre : le décor seul, sans interface
  // l'interface : peinte aussi, avec des touches fines accrochées à l'écran
  const U = ctx;   // (l'interface n'est pas repeinte : ses textes sont lisses)
  // barres de vie : au-dessus de la tête, elles suivent chaque personnage
  for (const t of enemies) {
    if (t.gone || t.noBar) continue;
    const fade = t.state === 'defeated' ? Math.max(0, 1 - t.timer / 0.6) : 1;
    const top = t instanceof Wara ? 34 + Math.round(t.lift) : 38;   // au-dessus du chapeau (personnages agrandis de 20 %)
    t.bar.draw(U, t.x - cam.x, t.y - cam.y - top, fade);
  }
  if (player.state !== 'death' && player.state !== 'respawn' && !behindGate()) {
    kageBar.draw(U, player.x - cam.x, player.y - cam.y - 31 - (look.barLift ?? 0));   // (barLift : au-dessus d'un casque à cornes)
  }
  // interface en haut à gauche : anneau d'énergie, puis stock de shurikens
  player.energy.draw(U, 13, 13, { always: true });
  shurikens.drawHud(U, look.projectiles.shuriken, 26, 8);
  // ryō : sous les shurikens (dans un chapitre)
  if (save) drawRyo(U, 27, 19, save.ryo);
  // chronomètre centré en haut, hors chapitre (le coin haut-droit accueille le bouton du son sur mobile)
  if (level.goal && !CHAPTER) drawTime(U, Math.round(VIEW_W / 2 + 9), 5, run.time);
  for (const f of hudText.splice(0)) f();
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
  setText(stateEl, `${player.state} · frame ${player.anim.frame + 1}/${player.anim.anim.frameCount} · énergie ${Math.round(player.energy.value * 100)} % · vie ${player.hp}/${HEALTH.max}`);
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
  haul: ['↑ : saisir la corde — ← : tirer — Espace : lâcher', 'Saut : saisir la corde — joystick : tirer — saut : lâcher'],
  vine: ['← → tenue : s\'accrocher, pousser en rythme — tout relâcher : lâcher', 'Joystick tenu : s\'accrocher, pousser en rythme — relâcher : lâcher'],
};
const HINT_USED = {
  move: () => Math.abs(player.x - startX) > 48,
  jump: () => player.state === 'jump' || player.isFlipping(),
  sprint: () => player.state === 'sprint',
  dash: () => player.state === 'dash',
  kick: () => player.state === 'kick' || player.state === 'air_kick',
  attack: () => player.state === 'attack' || player.state === 'air_attack' || player.state === 'flip_attack',
  slide: () => player.state === 'slide',
  wall: () => player.state === 'wall_jump',
  rope: () => level.cranes.some((c) => c.cut),
  airAttack: () => player.state === 'air_attack' || player.state === 'flip_attack',
  haul: () => player.state === 'rope_pull',
  vine: () => player.state === 'vine',
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
    if (labZone) setText(labZone, `Zone ${z.id}`);
  }
  zoneTimer = Math.max(0, zoneTimer - dt);
  ui.zone.classList.toggle('on', zoneTimer > 0);
  // aides : une seule commande à la fois, au moment où elle sert
  for (const h of level.hints) {
    if (hintsDone.has(h.kind) || player.x < h.x * 16 || (h.y != null && Math.abs(player.y - h.y * 16) > 40)) continue;
    if (!hint || hint.kind !== h.kind) hint = { kind: h.kind, t: 0 };
  }
  if (hint) {
    hint.t += dt;
    if (HINT_USED[hint.kind]() || hint.t > 9) {
      hintsDone.add(hint.kind);
      hint = null;
    }
  }
  if (hint) setText(ui.hint, HINTS[hint.kind][MOBILE ? 1 : 0]);
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
  // (le coffre n'a plus de bouton : il tressaute et scintille, on l'ouvre avec ↑ ou en le touchant)
  ui.talk.hidden = !near;
  setText(ui.talkLabel, 'Parler au marchand');
  if (input.wasPressed('up')) talkAction();
}

/** ↑ / E ou le bouton : parler au marchand, ou ouvrir le coffre devant soi. */
function talkAction() {
  if (chestHere) openChest(chestHere);
  else if (!ui.talk.hidden) openShop();
}

let chestHere = null;
/** Tactile : un doigt posé sur un coffre fermé, KAGE tout près, l'ouvre. Renvoie true si l'appui est pris. */
function tapChest(u, v) {
  if (!level?.chests?.length || player.state === 'death' || player.state === 'respawn') return false;
  const wx = camera.x + u * VIEW_W, wy = camera.y + v * VIEW_H;
  const ch = level.chests.find((c) => !c.open && Math.abs(wx - c.x) < 24 && wy > c.y - 36 && wy < c.y + 8);
  if (!ch || Math.abs(player.x - ch.x) > 48 || Math.abs(player.y - ch.y) > 40) return false;
  openChest(ch);
  return true;
}
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
  shop.open({ firstVisit: !save.merchantMet, save, title: LEVEL_ID === 'foret' ? 'Le campement de la clairière' : 'Le comptoir du voyageur' });
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
/** Les skins de récompense (champ `reward` : « karasu » = le trophée du corbeau, gagné en battant KARASU-KASHI ;
 *  au-delà du Potager, il l'a forcément été) : ils rejoignent la garde-robe, sans achat. */
function earnRewards(sv) {
  const won = { karasu: !!sv.bossDefeated || sv.chapter !== 'potager' };
  for (const [id, sk] of Object.entries(skins)) if (sk.reward && won[sk.reward] && !sv.skins.includes(id)) sv.skins.push(id);
}
function startChapter(resume) {
  const s = resume ? loadSave() : null;
  if (!resume) clearSave();
  save = s && s.chapter === LEVEL_ID ? s : emptySave(LEVEL_ID);
  save.skins ??= ['encre'];   // sauvegarde d'avant les skins
  save.chests ??= [];        // sauvegarde d'avant les coffres
  save.cranes ??= [];        // grues dont la corde a été coupée
  save.skins = save.skins.filter((id) => skins[id]);   // (un skin retiré du jeu, comme le voyageur, s'efface)
  if (!save.skins.includes('encre')) save.skins.unshift('encre');
  earnRewards(save);
  save.skin = (save.skins.includes(save.skin) || TEST_BUILD) && skins[save.skin] ? save.skin : 'encre';
  if (!SKIN_LAB) wearSkin(save.skin);   // dans la cabine, c'est la barre des skins qui décide
  level.applySave(save);
  run.time = save.time;
  run.falls = save.falls;
  const c = savedCheckpoint(save);
  if (c) {
    level.checkpoints.forEach((k) => { k.lit = k.x <= c.x; });
    level.spawn = { x: c.x, y: c.y };
  }
  if (boss && save.bossDefeated) { boss.setDefeated(); bossUi.shown = 0; gatePending = true; }   // elle s'ouvrira sous ses yeux
  player.respawn(true);
  startX = player.x;
  // reprise : les aides des commandes déjà passées ne reviennent pas
  for (const h of level.hints) if (h.x * 16 < player.x - 48) hintsDone.add(h.kind);
  snapCamera();
  document.querySelector('.title-screen').hidden = true;
  run.title = false;
  run.paused = false;
  persist();
  endIntro();
}

/** Introduction au lancement : l'encre, la lune, KAGE ; puis le menu (les boutons de l'écran titre). */
let introKick = null;   // le coup de pied sauté de l'intro (kage_intro_kick.png, généré par tools/kage_forge/intro_kick.py)
async function playIntro() {
  introKick ??= await loadImage(`./characters/kage/${meta.intro.image}`);
  const title = document.querySelector('.title-screen');
  if (intro) { intro.stop(); intro.stopVoice?.(0.3); intro.el.remove(); }
  if (music.playing) music.setLevel(0, 0.8);    // (version de test : on rejoue l'intro en pleine partie)
  intro = new Intro(meta, introKick, LEVEL_ID === 'potager' ? level.art?.backdrop?.far : null, { touch: MOBILE });
  uiLayer.append(intro.el);
  placeIntro();
  title.hidden = false;
  title.classList.add('with-intro', 'waiting');
  run.title = true;
  run.paused = true;
  const it = intro;
  it.onMenu = () => {
    title.classList.remove('waiting');
    // un peu plus tard : la touche qui a passé l'intro ne doit pas aussi choisir dans le menu
    setTimeout(() => { if (intro === it && !menu?.current) title.querySelector('[data-menu="aventure"]')?.focus(); }, 350);
  };
  // la musique finit : le menu s'efface avec l'image, puis l'intro recommence (le menu revient à son heure)
  it.onFade = () => { title.classList.add('waiting'); document.activeElement?.blur?.(); };
  it.start();
  // son déjà débloqué : l'intro commence tout de suite ; sinon elle attend un geste
  if (musicOutput()?.ac.state === 'running') it.begin(true);
}
/** Place l'intro et le menu sur l'image de jeu (à chaque changement de taille). */
function placeIntro() {
  intro.resize(VIEW_W, VIEW_H);
  document.querySelector('.title-screen').style.setProperty('--menu-y', `${intro.menuY}px`);
}
/**
 * Les gestes pendant l'intro. Le premier la lance avec sa musique : seulement au clic complet, au doigt
 * levé ou à une touche, les seuls gestes après lesquels tous les navigateurs permettent le son (le
 * bouton ou le doigt qui se pose ne suffit pas partout : l'intro partait alors muette). Ensuite, une
 * touche ou un toucher l'amène à sa fin ; et tant que sa musique n'est pas partie, chaque geste la
 * relance (comme celle du jeu). Les clics du panneau de la version de test ne comptent pas.
 */
function introGesture(e) {
  if (!intro || intro.closing || e.target?.closest?.('.lab')) return;
  if (e.type !== 'keydown' && !stage.contains(e.target)) return;   // (souris et doigt : sur l'image du jeu seulement)
  if (intro.gated) {
    if (e.type !== 'pointerdown') { unlockAudio(); intro.begin(true); intro.begunAt = performance.now(); }
    return;
  }
  // (le geste qui vient de lancer l'intro ne la passe pas : une touche tenue, ou le clic qui suit le doigt levé)
  const fresh = performance.now() - (intro.begunAt ?? 0) < 400;
  if ((e.type === 'keydown' || e.type === 'pointerdown') && !fresh && !intro.menuShown) intro.skip();
  if (!intro.clock) { unlockAudio(); intro.wake(); }
}
for (const t of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) addEventListener(t, introGesture, { capture: true, passive: true });
/** La partie commence : l'intro s'efface sur le jeu. */
function endIntro() {
  const title = document.querySelector('.title-screen');
  title.classList.remove('with-intro', 'waiting');
  if (!intro || intro.closing) return;
  const it = intro;
  it.closing = true;
  it.close(() => { if (intro === it) intro = null; });
  // la musique de l'intro s'éteint en fondu, celle du chapitre monte
  music.setLevel(1, 0);
  music.start();
}
// ---- l'écran titre : le menu (src/game/menu.js) ------------------------------------------
let menu = null;
let nightBg = null;   // la nuit de l'intro, décor seul, pour les menus ouverts sans l'intro
/** Ce qu'on dit d'une aventure : son chapitre, sa zone (d'après sa lanterne), le corbeau. */
function chapterOf(sv) {
  const def = LEVELS[sv.chapter] ?? LEVELS.potager;
  const short = (def.name ?? '').split('— ')[1] ?? def.name;
  const x = sv.checkpointX ?? 0;
  const zones = def.zones ?? [];
  const z = zones.find((zz) => x >= zz.x0 * 16 && x < zz.x1 * 16) ?? zones[0];
  return {
    chapter: `Chapitre ${def.chapter ?? 1} · ${short}`,
    chapterShort: `${def.chapter ?? 1} · ${short}`,
    zone: z ? `Zone ${z.id} · ${z.name.charAt(0).toLowerCase()}${z.name.slice(1)}` : '',
    zoneShort: z ? `${z.id} sur ${zones.length}` : '',
    boss: !!sv.bossDefeated || sv.chapter !== 'potager',
    // pour les lanternes du menu : le numéro du chapitre, son nom, la zone
    num: def.chapter ?? 1,
    name: short,
    zoneNum: Number.parseInt(z?.id ?? 1, 10) || 1,
    zones: zones.length,
  };
}
/** Recharge la page sur le chapitre d'une aventure (la reprise se fait au chargement). */
function goAdventure(chapter, how) {
  try { sessionStorage.setItem('kage-go', how); } catch { /* rien */ }
  if (TEST_BUILD) labSet('chapter', chapter);
  location.replace(location.pathname + location.search);
}
if (CHAPTER) {
  const title = document.querySelector('.title-screen');
  title.hidden = false;
  run.title = true;
  snapCamera();
  title.querySelector('[data-chapter]').textContent = level.name;
  menu = new Menu(title, {
    meta, skins, profile, saveProfile,
    saves: listSaves,
    chapterOf,
    continueAdventure(slot) {
      setSlot(slot);
      const sv = loadSave(slot);
      if (sv && sv.chapter !== LEVEL_ID) { goAdventure(sv.chapter, 'continue'); return; }
      menu.closeAll();
      startChapter(true);
    },
    newAdventure(slot) {
      setSlot(slot);
      clearSave(slot);
      if (LEVEL_ID !== 'potager') { goAdventure('potager', 'new'); return; }   // une aventure commence au chapitre 1
      menu.closeAll();
      startChapter(false);
    },
    eraseAdventure(slot) {
      clearSave(slot);
      if (profile.shown === slot) { profile.shown = slot === 1 ? 2 : 1; saveProfile(profile); }
    },
    arenas: Object.entries(LEVELS).filter(([, l]) => l.arena).map(([id, l]) => ({ id, name: l.name.replace(/^Arène — /, ''), theme: l.theme })),
    // le nom de chaque chapitre (une lanterne chacun, dans le menu Aventure)
    chapters: Object.fromEntries(Object.values(LEVELS).filter((l) => l.chapter && !l.arena).map((l) => [l.chapter, (l.name ?? '').split('— ')[1] ?? l.name])),
    createArena(id) { go({ mode: 'host', code: randomCode(), arena: id }); },
    joinArena(code) { go({ mode: 'join', code }); },
    setBackdrop(on) { if (intro) intro.menuMode = on; },
    // sans l'intro (retour de l'arène…), les écrans peignent eux-mêmes la nuit des montagnes
    backdrop() {
      if (intro) return null;
      nightBg ??= new Intro(meta, null, null, { backdropOnly: true });
      nightBg.resize(VIEW_W, VIEW_H);
      nightBg.draw();
      return nightBg.el;
    },
  });
  function go(cfg) {
    try { sessionStorage.setItem('kage-salle', JSON.stringify(cfg)); sessionStorage.setItem('kage-sans-intro', '1'); } catch { /* rien */ }
    location.hash = `#${cfg.arena && LEVELS[cfg.arena]?.arena ? cfg.arena : 'arene-potager'}`;
  }
  title.querySelector('[data-menu="aventure"]').focus();
  const existing = loadSave();
  let goNow = null, back = null;
  try {
    goNow = sessionStorage.getItem('kage-go'); sessionStorage.removeItem('kage-go');
    back = JSON.parse(sessionStorage.getItem('kage-menu') || 'null'); sessionStorage.removeItem('kage-menu');
  } catch { /* rien */ }
  if (goNow) {
    startChapter(goNow === 'continue');             // choisi dans le menu, puis rechargé sur son chapitre
  } else if (existing && existing.chapter === LEVEL_ID && existing.intro) {
    // on arrive du chapitre précédent : pas d'écran titre, la carte du chapitre s'efface sur la forêt
    startChapter(true);
    delete save.intro;
    persist();
    chapterCard(level.intro, true);
  } else {
    if (SKIN_LAB) startChapter(false);   // cabine : on joue tout de suite (l'intro passe devant)
    // l'introduction, à chaque lancement ; pas pour les tests (__KAGE_SKIP_INTRO), ni quand on revient
    // de l'arène, ni dans la version de test quand on vient de changer de chapitre par le panneau
    // (« accueil » : le bouton maison du salon de l'arène ramène au menu principal, sur la fin de l'intro)
    const home = back?.screen === 'accueil';
    const quiet = !home && (globalThis.__KAGE_SKIP_INTRO || back || (TEST_BUILD && sessionStorage.getItem('kage-sans-intro')));
    sessionStorage.removeItem('kage-sans-intro');
    if (home) playIntro().then(() => { if (intro) { intro.begin(false); intro.skip(); } });
    else if (!quiet) playIntro();
    else if (SKIN_LAB && back) { document.querySelector('.title-screen').hidden = false; run.title = true; }
    if (back?.screen && !home) menu.open(back.screen, back);
  }
}

/** Carte de chapitre : noire, le titre ; fadeOut = elle part de noir et s'efface sur le jeu. */
function chapterCard(t, fadeOut) {
  const el = document.querySelector('.chapter-card');
  if (!el || !t) return el;
  el.querySelector('[data-card-pre]').textContent = t.pre ?? '';
  el.querySelector('[data-card-num]').textContent = t.num ?? '';
  el.querySelector('[data-card-name]').textContent = t.name ?? '';
  el.querySelector('[data-card-line]').textContent = t.line ?? '';
  el.hidden = false;
  if (fadeOut) {
    el.classList.add('on');
    run.paused = true;
    setTimeout(() => { run.paused = false; el.classList.add('out'); el.classList.remove('on'); }, 2400);
    setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 5200);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  }
  return el;
}

/** Fin d'un chapitre qui a une suite : fondu au noir, titre du suivant, puis on y entre (même partie). */
function nextChapter() {
  const id = level.nextId, def = LEVELS[id];
  const ns = emptySave(id);
  for (const k of ['ryo', 'skins', 'skin', 'merchantMet', 'bossDefeated', 'time', 'falls']) if (save?.[k] != null) ns[k] = save[k];
  ns.time = run.time;
  ns.prev = [...(save?.prev ?? []), LEVEL_ID];
  ns.intro = true;
  writeSave(ns);
  if (TEST_BUILD) labSet('chapter', id);
  chapterCard(def.intro ?? { num: `Chapitre ${def.chapter}`, name: def.name }, false);
  music.setLevel(0, 2.5);
  setTimeout(() => {
    if (location.hash) location.replace(location.pathname + location.search);
    else location.reload();
  }, 4600);
}

// barre de vie du boss : fine, en haut de l'image, avec son nom ; la part perdue
// s'efface en retard (on voit ce que le coup a coûté)
function updateBossUi(dt) {
  if (bossUi.outro > 0) {
    bossUi.outro -= dt;
    if (bossUi.outro <= 0) { bossUi.shown = 0; gatePending = true; }   // la porte s'ouvrira quand KAGE la verra
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
    const P = waraSheet.P ?? 1;
    ctx.drawImage(waraSheet, f.x * P, f.y * P, f.w * P, f.h * P, sx - waraMeta.pivot.x, sy, f.w, f.h);
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
  if (CHAPTER && level.nextId && LEVELS[level.nextId] && !hashId) { save.done = true; nextChapter(); return; }
  const el = document.querySelector('.win');
  if (CHAPTER) {
    el.querySelector('.win__title').textContent = `${level.name} — terminé`;
    el.querySelector('[data-next]').textContent = level.endText ?? (level.next ? `Au loin s'étendent ${level.next.toLowerCase()}… la suite de l'aventure arrive bientôt.` : '');
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
  if (PAINTED && brush.ok) {          // style peint : une écriture lisse, posée sur l'image finale (pas repeinte)
    hudText.push(() => smoothText(ctx, renderSmooth, text, right + 3, y - 4, { color: '#e9e5da', outline: '#06070a' }, 'right'));
    return;
  }
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
let manual = false;   // tests : le temps n'avance que par __kage.step()
let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    if (!manual) update(STEP);
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(frame);
}
fit();
setBrushText(PAINTED);
pixelUI([...document.querySelectorAll('.bar'), uiLayer]);
requestAnimationFrame(frame);
// le jeu est peint : l'écran de chargement s'efface (après la première image)
requestAnimationFrame(() => requestAnimationFrame(() => {
  const ld = document.querySelector('.loading');
  if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 700); }
}));

// Accès pour les tests automatisés.
window.__kage = { get multi() { return multi; }, music, player, input, level, shurikens, mist, touch, tate: tates[0], tates, wara: waras[0], waras, boss, fx, run, camera, view: () => ({ w: VIEW_W, h: VIEW_H }), get save() { return save; }, get skin() { return look.id; }, skins, get intro() { return intro; },
  /** Tests : fait avancer le jeu de n pas de 1/120 s, d'un coup (le temps réel est alors suspendu). */
  step(n = 1) { manual = true; for (let i = 0; i < n; i++) update(STEP); },
  resume() { manual = false; },
};
