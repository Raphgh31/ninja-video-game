// Fond de la Forêt : le ciel, puis six plans en parallaxe, du plus loin au plus
// proche (crêtes et cimes lointaines, fûts et sapins dans la brume, nappe de
// brume, fûts et sapins plus proches, brume basse, arbres géants), une voûte de
// feuillage en haut de l'image et des rais de lumière.
//
// Chaque lumière (matin, sous-bois, canopée, sanctuaire, couchant, crépuscule,
// souterrain) a son jeu de bandes, peint à la demande (celle de la zone où l'on
// est d'abord, les voisines ensuite, un plan par image) ; entre deux zones de
// lumières différentes, les deux jeux se fondent l'un dans l'autre.
//
// Le fond est posé sur un sol de référence unique (la lisière, ligne 50) : quand
// KAGE grimpe (ascension, canopée), la forêt lointaine descend sous lui ; quand il
// dévale la pente, elle remonte. Les bandes se prolongent vers le haut (fûts) et
// vers le bas (sous-bois) : aucune coupe ne se voit, quelle que soit la hauteur.
import { canvas, ih, pick, bayer, hazeRamp } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';
import { cloudSprite, cirrusSprite, sunSprite, skyGradient, stars } from '../sky.js';
import { paintFar } from '../potager/backdrop.js';

const TILE = 16;
const W = 768;                 // largeur d'une bande (elle se répète sans couture)
const H = 252;                 // hauteur d'une bande
const GY = 217;                // ligne de sol dans la bande (86 %)
const REF_ROW = 50;            // sol de référence du fond, en cases
const GROUND_AT = 0.86;
const BLEND = 12 * TILE;       // largeur du fondu entre deux lumières

// défilement horizontal (fx), vertical (fy) ; drift : la brume glisse toute seule (px/s)
const PLANES = [
  { id: 'far', fx: 0.04, fy: 0.05, up: false },
  { id: 'firs', fx: 0.1, fy: 0.1, up: true },
  { id: 'mistA', fx: 0.14, fy: 0.13, drift: 2.2, mist: true },
  { id: 'near', fx: 0.2, fy: 0.18, up: true },
  { id: 'mistB', fx: 0.28, fy: 0.24, drift: 3.6, mist: true },
  { id: 'giants', fx: 0.38, fy: 0.32, up: true },
];
const VAULT = { fx: 0.45, h: 74 };

const n = (k) => Math.round((k * W) / 448);   // nombre d'éléments, à densité égale

// ---------------------------------------------------------------------------
// peinture des plans d'une lumière
// ---------------------------------------------------------------------------
function paintPlane(id, mood) {
  const strip = () => new L.Strip(W, H);
  const p = strip();
  if (mood.cave) return paintCavePlane(id, p, mood);
  switch (id) {
    case 'far':
      L.paintRidges(p, GY - 74, mood, 3);
      L.firRow(p, GY - 50, n(24), 22, 50, 0.2, mood.firs[0], 11, 5);
      break;
    case 'firs':
      if (mood.crowns) { padTrees(p, n(9), 3, 6, mood.stems[0], mood.firs[0], 13, GY - 30); L.firRow(p, GY - 28, n(12), 46, 92, 0.19, mood.firs[1], 17, 6); break; }
      L.stems(p, GY - 30, n(15), 2, 5, mood.stems[0], 13);
      L.firRow(p, GY - 28, n(12), 46, 92, 0.19, mood.firs[1], 17, 6);
      break;
    case 'mistA':
      L.paintMist(p, mood.haze, 41, (t) => Math.max(0, 1 - Math.abs(t - 0.66) / 0.2), 1.25);
      break;
    case 'near':
      if (mood.crowns) { padTrees(p, n(5), 7, 12, mood.stems[1], mood.firs[2], 19, GY - 12); L.firRow(p, GY - 8, n(6), 84, 150, 0.17, mood.firs[2], 23, 5); break; }
      L.stems(p, GY - 12, n(8), 4, 10, mood.stems[1], 19);
      L.firRow(p, GY - 8, n(6), 84, 150, 0.17, mood.firs[2], 23, 5);
      break;
    case 'mistB':
      L.paintMist(p, mood.haze, 47, (t) => Math.max(0, 1 - Math.abs(t - 0.8) / 0.16), 1.2);
      break;
    case 'giants': {
      const bark = L.hazeRamp(C.BARK, mood.depth, mood.tint), moss = L.hazeRamp(C.MOSS, mood.depth, mood.tint);
      const leaf = L.hazeRamp(C.LEAF, mood.depth, mood.tint * 0.8);
      if (mood.crowns) {
        // vus d'en haut : des houppiers ronds, leurs troncs plongent dans la brume
        for (let i = 0; i < n(7); i++) {
          const x = Math.round((i + 0.2 + ih(i, 3, 41) * 0.6) * W / n(7)), top = 70 + Math.floor(ih(i, 4, 41) * 50);
          L.bigTrunk(p, x, 8 + Math.floor(ih(i, 6, 41) * 8), H, 40 + i, bark, moss, { top: top + 10, roots: 0 });
          L.bush(p, x, top + 26, 30 + Math.floor(ih(i, 5, 41) * 18), 22 + Math.floor(ih(i, 7, 41) * 10), leaf, 51 + i);
        }
        for (let i = 0; i < n(12); i++) {
          const x = Math.round((i + ih(i, 8, 41)) * W / n(12));
          L.bush(p, x, H + 4, 26 + Math.floor(ih(i, 9, 41) * 20), 40 + Math.floor(ih(i, 10, 41) * 26), leaf, 71 + i);
        }
        break;
      }
      for (let i = 0; i < n(3); i++) {
        const fx = (i + 0.15 + ih(i, 2, 29) * 0.7) / n(3);
        L.bigTrunk(p, Math.round(W * fx), 26 + Math.floor(ih(i, 1, 29) * 18), GY + 3, 3 + i * 5, bark, moss);
      }
      for (let i = 0; i < n(9); i++) {
        const x = Math.round((i + 0.2 + ih(i, 3, 3) * 0.6) * W / n(9));
        L.bush(p, x, GY + 2, 14 + Math.floor(ih(i, 4, 3) * 16), 9 + Math.floor(ih(i, 5, 3) * 9), leaf, 31 + i);
      }
      // le pied du plan : un sous-bois sombre jusqu'en bas
      for (let x = 0; x < W; x++) for (let y = GY + 2 + Math.floor(ih(x, 1, 5) * 3); y < H; y++) if (!p.alpha(x, y)) p.set(x, y, leaf[0]);
      break;
    }
    default: break;
  }
  return p.done();
}

/**
 * Les grands pins de la canopée, au loin (même dessin que ceux où KAGE se tient) :
 * un fût, des plateaux de feuillage alternés, de petites lianes ; certains montrent
 * leur cime (on comprend qu'ils ne sont pas infinis), les autres sortent du cadre.
 */
function padTrees(p, count, w0, w1, stem, leaf, seed, base) {
  const [col, edge, lit] = stem, [dark, mid, light] = leaf;
  for (let i = 0; i < count; i++) {
    const x = Math.round(((i + 0.1 + ih(i, seed, 1) * 0.8) * W) / count), w = Math.round(w0 + ih(i, seed, 2) * (w1 - w0));
    const cime = ih(i, seed, 3) < 0.55, top = cime ? 18 + Math.floor(ih(i, seed, 4) * 60) : 0;
    for (let y = top + (cime ? 10 : 0); y < base + 6; y++) for (let dx = 0; dx < w; dx++) p.set(x + dx, y, dx === 0 ? lit : dx >= w - 1 ? edge : col);
    // les plateaux de feuillage, de part et d'autre
    for (let k = 0, y = (cime ? top + 18 : 14) + Math.floor(ih(i, seed, 5) * 20); y < base - 20; k++, y += 26 + Math.floor(ih(i, k, seed) * 18)) {
      const side = (k + i) % 2 ? 1 : -1, pw = Math.round(w * 1.4 + 6 + ih(i, k, seed + 1) * w), ph = 4 + Math.floor(w / 3);
      const cx = x + w / 2 + side * (w / 2 + pw * 0.45);
      for (let q = 0; q < pw * 0.5; q++) p.set(Math.round(x + w / 2 + side * q), y + ph - 1 - Math.round(q * 0.2), edge);
      for (let yy = -ph; yy <= ph * 0.6; yy++) for (let xx = -pw; xx <= pw; xx++) {
        const e = (xx * xx) / (pw * pw) + (yy * yy) / (ph * ph) + (ih(xx >> 1, yy, seed + k) - 0.5) * 0.35;
        if (e > 1) continue;
        p.set(cx + xx, y + yy, yy < -ph * 0.35 && xx < pw * 0.3 ? light : yy > ph * 0.2 ? dark : mid);
      }
      // une petite liane qui pend du plateau
      if (ih(i, k, seed + 2) < 0.5) for (let q = 0, len = 6 + Math.floor(ih(i, k, seed + 3) * 16); q < len; q++) p.set(Math.round(cx + Math.sin(q * 0.3) * 1), y + ph * 0.6 + q, q % 3 ? dark : mid);
    }
    // la cime : une pointe de pin
    if (cime) L.fir(p, x + w / 2, top + 26, 30, 8 + w * 0.6, [dark, mid, light], seed * 7 + i);
  }
}

/** Sous terre : une paroi de terre au loin, des racines qui pendent, des points de lumière. */
function paintCavePlane(id, p, mood) {
  if (id === 'far') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = 0.35 + (L.pf(x, W, 0.05, 3, 7) - 0.5) * 0.4 + Math.sin((y / H) * Math.PI) * 0.15;
      p.set(x, y, pick(['#06090b', '#0a0f12', '#0e1518', '#121b1e'], v, x, y));
    }
    // filons de lueurs (champignons lointains)
    for (let i = 0; i < n(60); i++) {
      const x = Math.floor(ih(i, 1, 9) * W), y = 40 + Math.floor(ih(i, 2, 9) * 170);
      p.set(x, y, C.GLOW[2 + (i % 2)]);
      if (i % 3 === 0) p.set(x + 1, y, C.GLOW[2], 120);
    }
  } else if (id === 'firs' || id === 'near' || id === 'giants') {
    const k = { firs: 0, near: 1, giants: 2 }[id];
    const ramp = [['#0b0d0d', '#0f1211', '#151a18', '#1c2220'], ['#0e0c0a', '#14110e', '#1c1813', '#251f19'], ['#120e0b', '#1b1510', '#261d15', '#33271c']][k];
    // racines épaisses qui descendent de la voûte jusqu'au sol, entrelacées
    const cnt = [n(10), n(7), n(4)][k];
    for (let i = 0; i < cnt; i++) {
      const x0 = Math.floor(((i + ih(i, 4, k)) * W) / cnt), w = [3, 5, 9][k] + Math.floor(ih(i, 5, k) * [3, 4, 8][k]);
      for (let y = 0; y < H; y++) {
        const sway = Math.round(Math.sin(y * 0.03 + i * 1.7) * (4 + k * 3));
        for (let dx = 0; dx < w; dx++) {
          const u = dx / w;
          p.set(x0 + sway + dx, y, ramp[u < 0.25 ? 3 : u > 0.7 ? 0 : (ih(dx, y >> 2, i) < 0.15 ? 1 : 2)]);
        }
      }
      // radicelles
      for (let r = 0; r < 4 + k * 2; r++) {
        const y0 = Math.floor(ih(i, r, k + 7) * 160), len = 8 + Math.floor(ih(i, r, k + 8) * 30), side = ih(i, r, k + 9) < 0.5 ? -1 : 1;
        for (let s = 0; s < len; s++) p.set(x0 + (side < 0 ? 0 : w) + side * Math.round(s * 0.5), y0 + s, ramp[1]);
      }
    }
    // la caverne vit : de grands champignons lumineux, des mares qui luisent, de la mousse
    if (k >= 1) caveLife(p, k, mood);
  } else if (id === 'mistA' || id === 'mistB') {
    L.paintMist(p, id === 'mistA' ? '#2a6f7a' : '#3b3a7a', id === 'mistA' ? 43 : 49, (t) => Math.max(0, 1 - Math.abs(t - 0.85) / 0.14), 1.1);
  }
  return p.done();
}

/** Grands champignons lumineux (turquoise et violet), mares qui luisent, touffes de mousse : d'après l'image de l'utilisateur. */
function caveLife(p, k, mood) {
  const dim = k === 1 ? 0.55 : 0.85;                           // le plan lointain est plus terne
  const T = ['#16404a', '#1f6a76', '#3fb0b8', '#8ff0ec'], V = ['#2c2058', '#4a3a9a', '#8f6ae0', '#d6c2ff'];
  const mix = (a) => a.map((c) => L.mixHex('#05080b', c, dim));
  // le sol de la caverne, ses mares turquoise
  for (let x = 0; x < W; x++) {
    const top = GY - 6 - Math.round(L.pf(x, W, 0.03, 3, 60 + k) * 18);
    for (let y = top; y < H; y++) p.set(x, y, pick(mix(['#0b1012', '#101a1c', '#16262a', '#1d3436']), 0.5 - (y - top) / 60, x, y));
    const pool = Math.sin(x * 0.012 + k) > 0.55;
    if (pool) for (let y = top + 2; y < top + 7; y++) p.set(x, y, mix(T)[y === top + 2 ? 3 : 2 - Math.floor((y - top - 2) / 2) + (y > top + 4 ? 0 : 1)]);
    if (ih(x, k, 61) < 0.25) for (let q = 0; q < 2 + Math.floor(ih(x, k, 62) * 4); q++) p.set(x, top - q, mix(['#123a2e', '#1b5a3c', '#2e8b57'])[q > 2 ? 2 : 1]);
  }
  // les champignons
  const cnt = k === 1 ? n(9) : n(6);
  for (let i = 0; i < cnt; i++) {
    const x = Math.floor(((i + ih(i, k, 63) * 0.8) * W) / cnt), cols = mix(i % 3 === 1 ? V : T);
    const big = (k === 2 ? 14 : 8) + Math.floor(ih(i, k, 64) * (k === 2 ? 16 : 9)), stemH = big * (1.3 + ih(i, k, 65) * 1.2);
    const gy = GY - 6 - Math.round(L.pf(x, W, 0.03, 3, 60 + k) * 18), top = gy - stemH;
    // halo tramé autour du chapeau
    for (let yy = -big * 1.4; yy < big * 1.2; yy++) for (let xx = -big * 2; xx < big * 2; xx++) {
      const d = Math.hypot(xx / (big * 2), yy / (big * 1.3));
      if (d < 1 && bayer(x + xx, Math.round(top + yy)) < (1 - d) * 0.35) p.set(x + xx, top + yy, cols[1], 140);
    }
    for (let y = Math.round(top); y < gy; y++) for (let dx = -1; dx <= 1; dx++) p.set(x + dx + Math.round(Math.sin((y - top) * 0.08) * 2), y, dx < 0 ? '#9fb8c8' : '#5c7280');
    for (let yy = -Math.round(big * 0.55); yy <= 0; yy++) {
      const hw = Math.round(big * Math.sqrt(1 - (yy * yy) / (big * big * 0.3)));
      for (let xx = -hw; xx <= hw; xx++) p.set(x + xx, top + yy, yy === 0 ? cols[0] : xx < -hw * 0.3 && yy < -big * 0.2 ? cols[3] : cols[2]);
    }
    for (let xx = -big; xx <= big; xx += 3) if (ih(xx, i, 66) < 0.6) for (let q = 1; q < 3 + Math.floor(ih(xx, i, 67) * 5); q++) p.set(x + xx, top + q, cols[1], 180);   // lamelles qui pendent
  }
}

function paintVault(mood) {
  const p = new L.Strip(W, VAULT.h);
  const leaf = L.hazeRamp(C.LEAF, mood.depth, mood.tint * 0.55);
  L.paintCanopy(p, 46, leaf, 29);
  return p.done();
}

function paintRays(mood) {
  const p = new L.Sheet(W, H);
  const list = [];
  for (let i = 0; i < n(5); i++) list.push({ x: (i + ih(i, 1, 77) * 0.6) * W / n(5) - 40, w: 8 + Math.floor(ih(i, 2, 77) * 24), len: H * (0.7 + ih(i, 3, 77) * 0.3) });
  L.paintRays(p, list, mood.ray, mood.rayA);
  return p.done();
}

/** Le ciel : un dégradé à la hauteur de l'image (4 px de large, étiré). */
function paintSky(mood, h) {
  const p = new L.Sheet(4, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) {
    let v = (y / h) * 0.95;
    if (mood.glow) v += Math.max(0, 1 - Math.abs(y / h - mood.glow.y) / mood.glow.r) * mood.glow.k * 0.5;
    p.set(x, y, pick(mood.sky, v, x, y, 0.8));
  }
  return p.done();
}

// ---------------------------------------------------------------------------
// le ciel de chaque heure du jour : dégradé, soleil (levant le matin, couchant le
// soir), nuages fins teintés par la lumière, cirrus, étoiles au crépuscule
// ---------------------------------------------------------------------------
const SKIES = {
  matin: {
    stops: [[0, '#6faac4'], [0.3, '#97c6c8'], [0.52, '#cfe1bb'], [0.7, '#f2e2ac'], [0.86, '#ffd6a0'], [1, '#ffe9c4']],
    sun: { x: 0.3, y: 0.36, r: 10, R: 56, core: '#fffbe8', glow: ['#ffc98a', '#ffe0a8', '#fff2d2'] },
    clouds: ['#b89aa0', '#dbb9ae', '#f2d4bc', '#fde8d0', '#fff6e8'], cirrus: '#fff0dc', n: 6,
  },
  sousbois: {
    stops: [[0, '#2a7a92'], [0.35, '#4aa2b2'], [0.65, '#86cdc8'], [1, '#c8eee0']],
    sun: { x: 0.64, y: 0.08, r: 7, R: 40, core: '#fffcea', glow: ['#cdeed6', '#e6f8e6', '#f8fff2'] },
    clouds: ['#84b4ba', '#a4cdcc', '#c3e2da', '#e0f2ea', '#f6fdf8'], cirrus: '#e8faf2', n: 5,
  },
  canopee: {
    stops: [[0, '#3a80c2'], [0.32, '#5ea4d6'], [0.6, '#96c9e2'], [0.84, '#cce6e6'], [1, '#f2f1d2']],
    sun: { x: 0.36, y: 0.3, r: 10, R: 56, core: '#fffef2', glow: ['#ffeeb0', '#fff6d6', '#fffdf2'] },
    clouds: ['#9ab3cf', '#b9cde0', '#d7e3ee', '#f0f5f7', '#fffefa'], cirrus: '#f6fafd', n: 8,
  },
  sanctuaire: {
    stops: [[0, '#0c3444'], [0.4, '#18525e'], [0.75, '#2f7a7e'], [1, '#5ea698']],
    sun: null, clouds: ['#1e4a54', '#2a5e66', '#3a7476', '#4e8a84', '#68a294'], cirrus: null, n: 3,
  },
  couchant: {
    stops: [[0, '#38386c'], [0.26, '#674c86'], [0.48, '#b4667e'], [0.66, '#ea8a64'], [0.82, '#ffb86c'], [1, '#ffe2a2']],
    sun: { x: 0.8, y: 0.42, r: 14, R: 70, core: '#fff2c2', glow: ['#ff8e4e', '#ffb468', '#ffdc9c'] },
    clouds: ['#523868', '#82506e', '#c2706e', '#f2a46e', '#ffd89c'], cirrus: '#ffc49c', n: 7,
  },
  crepuscule: {
    stops: [[0, '#12142e'], [0.3, '#272552'], [0.55, '#55386c'], [0.78, '#9a5276'], [0.92, '#d77868'], [1, '#f2a070']],
    sun: { x: 0.86, y: 0.5, r: 0, R: 110, core: '#ffb070', glow: ['#c45a5a', '#e57a62', '#ffa874'] },
    clouds: ['#221c3a', '#3c2a52', '#6a3c62', '#b0586a', '#e88a6c'], cirrus: '#d88a7a', n: 5, stars: 40,
  },
};

// La grande chaîne du chapitre 1 (Mont Kagero, le dojo), toujours au loin : un
// quart plus grande que dans le Potager (on a avancé vers elle), teintée par la
// lumière de l'heure (couleur, part de cette couleur).
const RANGE = { k: 1.25, fx: 0.03, fy: 0.05, drop: 14 };
const RANGE_TINT = {
  matin: ['#f6dcae', 0.32], sousbois: ['#8fcfca', 0.42], canopee: ['#d4e6f0', 0.2],
  sanctuaire: ['#173f4c', 0.62], couchant: ['#e2907e', 0.46], crepuscule: ['#33264f', 0.62],
};

// ---------------------------------------------------------------------------
export class ForetBackdrop {
  constructor(level) {
    this.level = level;
    this.zones = level.zones;
    this.dark = level.forest?.dark ?? null;
    this.sets = {};                 // mood -> { planes: { id: canvas }, vault, rays, sky, skyH }
    this.k = 1;
    this.tmp = null;
    // la lumière de la première zone tout de suite ; les autres à la demande
    this.need(this.zones[0]?.mood ?? 'matin', true);
  }

  set(mood) { return (this.sets[mood] ??= { planes: {}, vault: null, rays: null, sky: null, skyH: 0 }); }

  /** Peint ce qui manque d'une lumière (tout, ou une seule pièce si !all). Renvoie true s'il a peint. */
  need(mood, all = false) {
    const m = C.MOODS[mood] ?? C.MOODS.sousbois, s = this.set(mood);
    for (const pl of PLANES) {
      if (s.planes[pl.id]) continue;
      s.planes[pl.id] = paintPlane(pl.id, m);
      if (!all) return true;
    }
    if (!s.vault && !m.cave && !m.crowns) { s.vault = paintVault(m); if (!all) return true; }
    if (!s.rays && !m.cave) { s.rays = paintRays(m); if (!all) return true; }
    return false;
  }

  ready(mood) {
    const m = C.MOODS[mood], s = this.sets[mood];
    return !!s && PLANES.every((pl) => s.planes[pl.id]) && (s.vault || m.cave || m.crowns) && (s.rays || m.cave);
  }

  /** Lumières à mélanger pour cette caméra : [{ mood, w }] (poids décroissants). */
  weights(cam, viewW, viewH) {
    const cx = cam.x + viewW / 2, cy = cam.y + viewH * 0.6;
    const zs = this.zones;
    let i = zs.findIndex((z) => cx >= z.px0 && cx < z.px1);
    if (i < 0) i = cx < zs[0].px0 ? 0 : zs.length - 1;
    const z = zs[i];
    let out = [{ mood: z.mood, w: 1 }];
    // près d'une frontière avec une lumière différente : fondu enchaîné
    const prev = zs[i - 1], next = zs[i + 1];
    if (next && next.mood !== z.mood && cx > z.px1 - BLEND / 2) {
      const t = (cx - (z.px1 - BLEND / 2)) / BLEND;
      out = [{ mood: z.mood, w: 1 - t }, { mood: next.mood, w: t }];
    } else if (prev && prev.mood !== z.mood && cx < z.px0 + BLEND / 2) {
      const t = (z.px0 + BLEND / 2 - cx) / BLEND;
      out = [{ mood: z.mood, w: 1 - t }, { mood: prev.mood, w: t }];
    }
    // sous terre : la paroi du souterrain remplace le ciel dès qu'on descend
    const d = this.dark;
    if (d && cx > d.x0 && cx < d.x1) {
      const t = Math.max(0, Math.min(1, (cy - d.y0) / 64));
      if (t > 0) {
        out = out.map((o) => ({ mood: o.mood, w: o.w * (1 - t) })).filter((o) => o.mood !== 'souterrain');
        out.push({ mood: 'souterrain', w: t });
      }
    }
    return out.filter((o) => o.w > 0.002).sort((a, b) => b.w - a.w);
  }

  /** À chaque image : peint une pièce d'avance (lumières des zones voisines). */
  /** La chaîne de montagnes (peinte une fois), et sa version teintée pour une lumière. */
  range(mood) {
    if (!this.mountains) return null;
    const t = RANGE_TINT[mood];
    if (!t) return null;
    const s = this.set(mood);
    if (!s.range) {
      const src = this.mountains.img, c = canvas(src.width, src.height), g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = t[1]; g.fillStyle = t[0]; g.fillRect(0, 0, c.width, c.height);
      s.range = c;
    }
    return s.range;
  }

  idle(cam, viewW) {
    if (!this.mountains) { this.mountains = paintFar(this.level.width, RANGE.k, RANGE.fx); return; }
    const cx = cam.x + viewW / 2, zs = this.zones;
    let i = zs.findIndex((z) => cx >= z.px0 && cx < z.px1);
    if (i < 0) i = 0;
    const order = [zs[i], zs[i + 1], zs[i - 1], zs[i + 2]].filter(Boolean).map((z) => z.mood);
    if (this.dark && i >= 5 && i <= 8) order.push('souterrain');
    for (const m of order) if (!this.ready(m)) { this.need(m); return; }
  }

  q(v) { return Math.round(v * this.k) / this.k; }

  /** k = pixels d'écran par pixel de jeu (le contexte est déjà mis à l'échelle). */
  draw(ctx, cam, viewW, viewH, time, k = 1) {
    this.k = k;
    const list = this.weights(cam, viewW, viewH);
    for (const o of list) if (!this.ready(o.mood)) this.need(o.mood, true);
    this.drawMood(ctx, list[0].mood, cam, viewW, viewH, time);
    if (list.length > 1) {
      // fondu exact : la seconde lumière est composée à part, puis posée par-dessus
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      if (!this.tmp || this.tmp.width !== cw || this.tmp.height !== ch) this.tmp = canvas(cw, ch);
      const g = this.tmp.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(ctx.getTransform());
      g.imageSmoothingEnabled = false;
      for (let j = 1; j < list.length; j++) {
        this.drawMood(g, list[j].mood, cam, viewW, viewH, time);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = list[j].w / (list[0].w + list[j].w) * (j === 1 ? 1 : 0.5);
        ctx.drawImage(this.tmp, 0, 0);
        ctx.restore();
      }
    }
  }

  /**
   * Sol de référence du fond à cette abscisse (en cases) : celui de la lisière,
   * sauf où la zone en fixe un autre (bgRow) ; une zone en pente (bgSlope) passe
   * doucement de celui d'avant à celui d'après (la grande descente).
   */
  refRow(x) {
    const zs = this.zones;
    let i = zs.findIndex((z) => x >= z.px0 && x < z.px1);
    if (i < 0) i = x < zs[0].px0 ? 0 : zs.length - 1;
    const at = (k) => { for (let j = k; j >= 0; j--) if (zs[j].bgRow != null) return zs[j].bgRow; return REF_ROW; };
    const z = zs[i];
    if (z.bgSlope && zs[i + 1]) {
      const t = Math.max(0, Math.min(1, (x - z.px0) / (z.px1 - z.px0)));
      const a = at(i - 1), b = zs[i + 1].bgRow ?? a;
      return a + (b - a) * (t * t * (3 - 2 * t));
    }
    return at(i);
  }

  /** Base d'un plan à l'écran : il suit la caméra en hauteur d'une fraction fy. */
  planeY(pl, cam, viewH) {
    const ref = viewH * GROUND_AT, gy = this.refRow(cam.x + 240) * TILE - cam.y;
    return this.q(ref + (gy - ref) * pl.fy) - GY;
  }

  /** Le ciel d'une heure du jour : dégradé, étoiles, soleil, nuages (peints une fois). */
  skyOf(mood, viewH) {
    const s = this.sets[mood], K = SKIES[mood];
    if (!K) return null;
    if (s.skyH !== viewH) { s.sky = skyGradient(K.stops, viewH); s.skyH = viewH; }
    if (!s.clouds) {
      let seed = mood.length * 97;
      s.sun = K.sun ? sunSprite(K.sun.core, K.sun.glow, K.sun.r, K.sun.R) : null;
      // la lumière du soleil qui déborde sur la forêt lointaine (posée par-dessus les premiers plans)
      s.sunGlow = K.sun ? sunSprite(K.sun.glow[2], K.sun.glow, 0, 150) : null;
      s.clouds = [];
      for (let i = 0; i < K.n; i++) {
        const big = i % 3 !== 2, w = big ? 100 + ih(i, 1, seed) * 110 : 140 + ih(i, 2, seed) * 120, h = big ? 9 + ih(i, 3, seed) * 9 : 4 + ih(i, 4, seed) * 4;
        s.clouds.push({ img: cloudSprite(seed + i, w, h, K.clouds), x: i * 330 + ih(i, 5, seed) * 160, y: big ? 0.06 + ih(i, 6, seed) * 0.26 : 0.34 + ih(i, 7, seed) * 0.12, speed: 1 + ih(i, 8, seed) * 1.8, f: 0.01 + (big ? 0 : 0.012) });
      }
      if (K.cirrus) for (let i = 0; i < 2; i++) s.clouds.unshift({ img: cirrusSprite(seed + 40 + i, 170 + ih(i, 9, seed) * 80, 14, K.cirrus), x: i * 700 + 120, y: 0.02 + i * 0.05, speed: 0.5, f: 0.006 });
      s.stars = K.stars ? stars(seed, 900, 120, K.stars) : null;
    }
    return s;
  }

  drawMood(ctx, mood, cam, viewW, viewH, time) {
    const s = this.sets[mood], m = C.MOODS[mood] ?? C.MOODS.sousbois, K = SKIES[mood];
    if (K) {
      this.skyOf(mood, viewH);
      ctx.drawImage(s.sky, 0, 0, 4, viewH, 0, 0, viewW, viewH);
      if (s.stars) {
        ctx.fillStyle = '#f4ecff';
        for (const st of s.stars) {
          const a = (0.35 + 0.65 * st.b) * (0.75 + 0.25 * Math.sin(time * 1.3 + st.p));
          if (st.y > viewH * 0.45) continue;
          ctx.globalAlpha = a * (1 - st.y / (viewH * 0.45));
          ctx.fillRect(this.q(((st.x - cam.x * 0.004) % viewW + viewW) % viewW), this.q(st.y * 0.9), 1, 1);
        }
        ctx.globalAlpha = 1;
      }
      if (s.sun) {
        const R = K.sun.R + 1;
        ctx.drawImage(s.sun, this.q(K.sun.x * viewW - R - cam.x * 0.006), this.q(K.sun.y * viewH - R));
      }
      // la grande chaîne, derrière les nuages bas et les crêtes boisées
      const rg = this.range(mood);
      if (rg) {
        const base = this.q(viewH * GROUND_AT + RANGE.drop + (this.refRow(cam.x + 240) * TILE - cam.y - viewH * GROUND_AT) * RANGE.fy);
        const off = this.q(cam.x * RANGE.fx), sx = Math.floor(off);
        const w = Math.min(viewW + 1, rg.width - sx);
        if (w > 0) ctx.drawImage(rg, sx, 0, w, rg.height, -(off - sx), base - this.mountains.plane.base, w, rg.height);
      }
      const span = 2400;
      for (const c of s.clouds) {
        const x = ((c.x + time * c.speed - cam.x * c.f) % span + span) % span - 260;
        if (x > viewW || x + c.img.width < 0) continue;
        ctx.drawImage(c.img, this.q(x), this.q(c.y * viewH));
      }
    } else {
      if (s.skyH !== viewH) { s.sky = paintSky(m, viewH); s.skyH = viewH; }
      ctx.drawImage(s.sky, 0, 0, 4, viewH, 0, 0, viewW, viewH);
    }
    for (const pl of PLANES) {
      if (pl.id === 'near' && s.sunGlow) {
        // le soleil baigne la forêt lointaine : un halo clair, léger, derrière les plans proches
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16;
        ctx.drawImage(s.sunGlow, this.q(K.sun.x * viewW - 151 - cam.x * 0.006), this.q(K.sun.y * viewH - 151));
        ctx.restore();
      }
      const img = s.planes[pl.id];
      const y = this.planeY(pl, cam, viewH);
      const off = this.q(cam.x * pl.fx + (pl.drift ?? 0) * time);
      this.tile(ctx, img, off, y, H, viewW);
      if (pl.mist) continue;
      // au-dessus de la bande : les fûts continuent ; en dessous : le sous-bois
      if (pl.up && y > 0) this.stretch(ctx, img, off, 0, 1, 0, y, viewW);
      if (y + H < viewH) this.stretch(ctx, img, off, H - 1, 1, y + H, viewH - (y + H), viewW);
    }
    if (s.vault) {
      // voûte de feuillage, accrochée en haut de l'image (rien ne flotte : elle sort du cadre)
      const off = this.q(cam.x * VAULT.fx);
      this.tile(ctx, s.vault, off, -6, VAULT.h, viewW);
    }
    if (s.rays) {
      const off = this.q(cam.x * 0.3 + Math.sin(time * 0.07) * 20);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 0.5);
      this.tile(ctx, s.rays, off, 0, Math.min(H, viewH), viewW, viewH / H);
      ctx.globalAlpha = 1;
    }
  }

  /** Recopie une bande périodique (décalage off) à la hauteur y. */
  tile(ctx, img, off, y, h, viewW, sy = 1) {
    let sx = ((off % W) + W) % W;
    const fl = Math.floor(sx), frac = sx - fl;
    let dx = -frac, x = fl;
    while (dx < viewW) {
      const w = Math.min(W - x, viewW - dx + 1);
      ctx.drawImage(img, x, 0, w, h, dx, y, w, h * sy);
      dx += w; x = 0;
    }
  }

  /** Étire la ligne sy de la bande sur la hauteur h (prolongement vers le haut ou le bas). */
  stretch(ctx, img, off, sy, sh, y, h, viewW) {
    if (h <= 0) return;
    let sx = ((off % W) + W) % W;
    const fl = Math.floor(sx), frac = sx - fl;
    let dx = -frac, x = fl;
    while (dx < viewW) {
      const w = Math.min(W - x, viewW - dx + 1);
      ctx.drawImage(img, x, sy, w, sh, dx, y, w, h + 0.5);
      dx += w; x = 0;
    }
  }
}
