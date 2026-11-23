// Le dessin des menus « Les lanternes » (planche docs/menus/planche_lanternes.png, choisie par
// l'utilisateur le 22 novembre 2026). Le menu est un petit monde, la nuit de l'intro : la montagne et
// la lune derrière, un sol sombre, et des objets du monde à la place des boutons — lanternes de
// pierre (une par chapitre), gong, tablettes votives, rocher, panneau de bois. La lumière montre ce
// qui compte ; le reste reste dans l'ombre.
//
// Tout est peint en pixels de jeu (1 pixel de canvas = 1 pixel de jeu) : les parties fixes une fois
// (couche « base »), ce qui vit à chaque image (flammes, lueurs, ninjas, coups de pinceau).
import { canvas, pick, ih, noise1, bayer, rgb } from './potager/paint.js';
import { renderText, renderSmooth } from '../engine/pixelfont.js';
import { smoothText } from '../engine/brushgl.js';
import { crispSheet } from '../engine/netsprite.js';

export const INK = '#e9e5da';
const STONE = ['#0f131b', '#171d28', '#212a38', '#2e3a4e', '#43536c'];
export const WOOD = ['#1d130c', '#2e1e13', '#45301d', '#5e4229', '#7c5935', '#9a7244'];
const PLANK = ['#2a1c11', '#4e3a26', '#6e5236', '#886946', '#a08058', '#b8976a'];   // bois moyen (panneau du pseudo : le bois se voit, l'encre se lit)
const BRONZE = ['#1a120c', '#2f2014', '#4a321c', '#6c4a26', '#946734', '#bf8f4c', '#e2bb72'];

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const steps = (v, n, x, y) => Math.max(0, Math.min(n, Math.floor(v * n + bayer(x, y)))) / n;

/** Petit pinceau sur un contexte 2D : rectangles, pixels, et peinture par pixel (shade). */
export class Pen {
  constructor(g) { this.g = g; this.w = g.canvas.width; this.h = g.canvas.height; }
  r(x, y, w, h, col) { if (w > 0 && h > 0) { this.g.fillStyle = col; this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } return this; }
  px(x, y, col) { return this.r(x, y, 1, 1, col); }
  line(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.r(Math.round(x0 + ((x1 - x0) * i) / n - (w >> 1)), Math.round(y0 + ((y1 - y0) * i) / n - (w >> 1)), w, w, col);
    return this;
  }
  /** fn(x, y) → null | couleur | [couleur, alpha] (mélangée à ce qui est déjà peint). */
  shade(x0, y0, w, h, fn) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    w = Math.min(this.w - x0, Math.round(w)); h = Math.min(this.h - y0, Math.round(h));
    if (w <= 0 || h <= 0) return this;
    const id = this.g.getImageData(x0, y0, w, h), d = id.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const res = fn(x0 + i, y0 + j);
      if (!res) continue;
      const [col, a] = Array.isArray(res) ? res : [res, 1];
      const c = rgb(col), k = (j * w + i) * 4, o = d[k + 3] / 255;
      if (o === 0) { d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = Math.round(a * 255); continue; }
      for (let q = 0; q < 3; q++) d[k + q] += (c[q] - d[k + q]) * a;
      d[k + 3] = Math.round(255 * (a + o * (1 - a)));
    }
    this.g.putImageData(id, x0, y0);
    return this;
  }
}

// ---- le sol ----------------------------------------------------------------------------------
/** Profil plat, à peine ondulé, à la hauteur y. */
export const flat = (y) => (x) => y - 1 - Math.round(noise1(x / 23, 3) * 2 + noise1(x / 7, 4));

/** Sol sombre au profil top(x), herbes dont la pointe accroche la lune. */
export function ground(p, top) {
  let y0 = p.h;
  for (let x = 0; x < p.w; x += 4) y0 = Math.min(y0, Math.round(top(x)));
  p.shade(0, y0 - 8, p.w, p.h - y0 + 8, (x, y) => {
    const d = y - Math.round(top(x));
    return d < 0 ? null : d === 0 ? '#1f2636' : d < 3 ? '#131722' : d < 12 ? '#0e1118' : '#0b0d12';
  });
  for (let x = 2; x < p.w; x += 3) {
    if (ih(x, 1, 9) < 0.45) continue;
    const t = Math.round(top(x)), h = 2 + Math.floor(ih(x, 2, 9) * 4), dx = ih(x, 3) < 0.5 ? -1 : 1;
    p.line(x, t, x + dx, t - h, '#151a24'); p.px(x + dx, t - h, '#2c3549');
  }
}

// ---- la lanterne de pierre (tōrō) --------------------------------------------------------------
/**
 * Peint la pierre d'une lanterne posée en (cx, by), à l'échelle k (1 ≈ 27 px de haut). Rend ce que la
 * flamme éclairera : la fenêtre du foyer, le dessus du plateau et le dessous du toit.
 */
export function stoneLantern(p, cx, by, k) {
  const R = (n) => Math.max(1, Math.round(n * k));
  let y = by;
  const block = (w, h) => {
    const x0 = Math.round(cx - w / 2);
    p.r(x0, y - h, w, h, STONE[2]); p.r(x0, y - h, 1, h, STONE[3]); p.r(x0 + w - 1, y - h, 1, h, STONE[1]); p.r(x0, y - h, w, 1, STONE[3]);
    y -= h; return x0;
  };
  block(R(11), R(2)); block(R(8), R(1));
  const pw = Math.max(3, R(3)) | 1, p0 = block(pw, R(7));
  for (let i = 1; i < R(7); i += 3) p.px(p0 + 1, y + i, STONE[1]);
  const tw = R(12), t0 = block(tw, Math.max(1, R(2)));
  const shelf = { x: t0 + 1, y, w: tw - 2 };
  const fw = R(8) | 1, fh = R(6), fx = Math.round(cx - fw / 2), fy = y - fh;
  p.r(fx, fy, fw, fh, STONE[2]); p.r(fx, fy, 1, fh, STONE[3]); p.r(fx + fw - 1, fy, 1, fh, STONE[1]);
  const ww = Math.max(2, R(3)), wh = Math.max(2, R(3)), wx = Math.round(cx - ww / 2), wy = fy + Math.round((fh - wh) / 2);
  p.r(wx, wy, ww, wh, '#07090d');
  y = fy;
  const rw = R(16), rh = R(3);
  for (let j = 0; j < rh; j++) {
    const w = Math.round(rw - (rw - fw * 0.55) * (j / rh)), x0 = Math.round(cx - w / 2);
    p.r(x0, y - 1 - j, w, 1, j === rh - 1 ? STONE[3] : STONE[2]); p.px(x0, y - 1 - j, STONE[4]); p.px(x0 + w - 1, y - 1 - j, STONE[1]);
  }
  const rx = Math.round(cx - rw / 2);
  p.px(rx - 1, y - 2, STONE[3]); p.px(rx + rw, y - 2, STONE[2]);
  const eave = { x: rx + 1, y: y - 1, w: rw - 2 };
  y -= rh;
  p.r(Math.round(cx - R(1)), y - R(3), Math.max(2, R(2)), R(3), STONE[3]); p.px(Math.round(cx - R(1)), y - R(3), STONE[4]);
  return { cx, by, k, top: y - R(3), win: { x: wx, y: wy, w: ww, h: wh }, shelf, eave };
}

const glows = new Map();
/** La lueur d'une flamme (l'air autour, une flaque au sol), tramée, peinte une fois par taille. */
function glowSprite(k) {
  const key = Math.round(k * 20);
  let s = glows.get(key);
  if (s) return s;
  const R = Math.round(30 * k), gr = Math.round(9 * k), W = 4 * gr + 2 * R, H = 2 * R + 12;
  const c = canvas(W, H), p = new Pen(c.getContext('2d'));
  const cx = W / 2, cy = R, gy = R + Math.round(9 * k);
  p.shade(0, 0, W, H, (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / R;
    let a = d < 1 ? steps(Math.pow(1 - d, 2.2), 5, x, y) * 0.3 : 0;
    const e = Math.hypot((x - cx) / (gr * 2), (y - gy - 1) / 5);
    if (e < 1 && y >= gy - 2) a = Math.max(a, steps(1 - e, 4, x, y) * 0.42);
    return a > 0 ? ['#f0a848', a] : null;
  });
  s = { c, ox: Math.round(cx), oy: cy };
  glows.set(key, s);
  return s;
}

/**
 * La flamme d'une lanterne : light (0..1) = combien elle est allumée, power = force de sa lueur.
 * Elle vacille un peu (t en secondes) ; à faible lumière, il ne reste qu'une braise.
 */
export function drawFlame(g, lan, light, power, t, seed = 0) {
  if (light <= 0.01) return;
  const fl = 0.9 + 0.06 * Math.sin(t * 7.3 + seed * 2.1) + 0.04 * Math.sin(t * 13.1 + seed);
  const gs = glowSprite(lan.k);
  g.globalAlpha = clamp01(light * power * fl);
  g.drawImage(gs.c, Math.round(lan.cx - gs.ox), Math.round(lan.win.y + lan.win.h / 2 - gs.oy));
  const { x, y, w, h } = lan.win;
  g.globalAlpha = clamp01(light * 1.4);
  g.fillStyle = '#5a3a1e'; g.fillRect(x - 1, y - 1, w + 2, 1); g.fillRect(x - 1, y + h, w + 2, 1); g.fillRect(x - 1, y, 1, h); g.fillRect(x + w, y, 1, h);
  g.fillStyle = '#6b4a28'; g.fillRect(lan.shelf.x, lan.shelf.y, lan.shelf.w, 1);
  g.fillStyle = '#4a3220'; g.fillRect(lan.eave.x, lan.eave.y, lan.eave.w, 1);
  g.globalAlpha = clamp01(light * 1.2);
  g.fillStyle = '#f6b24a'; g.fillRect(x, y, w, h);
  g.fillStyle = '#ffd98a'; g.fillRect(x, y + 1, w, h - 1);
  if (w > 2 && light > 0.5) { g.fillStyle = fl > 0.93 ? '#fff6d6' : '#fff3c8'; g.fillRect(x + 1, y + 1, w - 2, Math.max(1, h - 2)); }
  g.globalAlpha = 1;
}

// ---- le gong -----------------------------------------------------------------------------------
/** Le gong sur son portique de bois (posé au sol gy). Rend le disque (centre, rayon) pour ses vibrations. */
export function gong(p, cx, cy, r, gy) {
  const left = cx - r - 14, right = cx + r + 11, top = cy - r - 16;
  for (const x of [left, right]) { p.r(x, top, 4, gy - top, WOOD[2]); p.r(x, top, 1, gy - top, WOOD[4]); p.r(x + 3, top, 1, gy - top, WOOD[1]); }
  const bw = right - left + 20;
  p.r(left - 8, top - 6, bw, 5, WOOD[2]); p.r(left - 8, top - 6, bw, 1, WOOD[4]); p.r(left - 8, top - 2, bw, 1, WOOD[1]);
  p.r(left - 10, top - 8, 3, 3, WOOD[3]); p.r(right + 11, top - 8, 3, 3, WOOD[2]);
  p.r(left - 2, top + 3, right - left + 8, 3, WOOD[2]); p.r(left - 2, top + 3, right - left + 8, 1, WOOD[3]);
  p.line(cx - r * 0.55, top + 6, cx - r * 0.45, cy - r * 0.85, '#6f6350');
  p.line(cx + r * 0.55, top + 6, cx + r * 0.45, cy - r * 0.85, '#4e4636');
  const disc = canvas(2 * r + 3, 2 * r + 3), dp = new Pen(disc.getContext('2d'));
  dp.shade(0, 0, 2 * r + 3, 2 * r + 3, (x, y) => {
    const dx = x - r - 1 + 0.5, dy = y - r - 1 + 0.5, d = Math.hypot(dx, dy) / r;
    if (d > 1) return null;
    let v = 0.5 - 0.32 * (dx + dy) / (r * 1.4);
    if (Math.abs(d - 0.62) < 0.035 || Math.abs(d - 0.84) < 0.03) v -= 0.22;
    if (Math.abs(d - 0.66) < 0.03) v += 0.12;
    if (d < 0.24) v += 0.28 - d * 0.6 - (dx + dy) / (r * 2);
    if (d > 0.93) v -= 0.25;
    return pick(BRONZE, v, x, y, 0.35);
  });
  p.g.drawImage(disc, cx - r - 1, cy - r - 1);
  const mh = Math.round(r * 1.2);
  p.line(left - 6, gy - 1, left + 1, gy - mh, WOOD[3]);
  p.r(left - 1, gy - mh - 6, 5, 7, '#8c7f68'); p.r(left - 1, gy - mh - 6, 1, 7, '#b0a284'); p.r(left + 3, gy - mh - 6, 1, 7, '#5e5444');
  return { cx, cy, r, disc };
}

/**
 * Le gong frappé : il tremble (le disque oscille d'un pixel), des cercles de lumière partent de son
 * centre et pâlissent. k = temps depuis le coup (secondes) ; rien après 1,6 s.
 */
export function drawGongRing(g, gg, k) {
  if (k < 0 || k > 1.6) return;
  const off = k < 0.9 ? Math.round(Math.sin(k * 60) * (1 - k / 0.9) * 1.4) : 0;
  if (off) g.drawImage(gg.disc, gg.cx - gg.r - 1 + off, gg.cy - gg.r - 1);
  for (let n = 0; n < 2; n++) {
    const u = k / 1.6 - n * 0.22;
    if (u <= 0 || u >= 1) continue;
    const rad = gg.r * (0.3 + u * 1.6);
    g.globalAlpha = (1 - u) * 0.5;
    g.fillStyle = '#e2bb72';
    for (let a = 0; a < 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      if ((a + n) % 3 === 0) continue;
      g.fillRect(Math.round(gg.cx + Math.cos(th) * rad), Math.round(gg.cy + Math.sin(th) * rad), 1, 1);
    }
  }
  g.globalAlpha = 1;
}

/** Devant le gong, l'arène choisie : la rizière (Potager) ou la mare et les fougères (Forêt). */
export function arenaFront(p, kind, x0, x1, y) {
  if (kind === 'foret') {
    p.shade(x0 + 10, y + 1, x1 - x0 - 20, 5, (x, yy) => {
      const e = Math.min(x - x0 - 10, x1 - 10 - x) / 14;
      if (e < 1 && ih(x, yy, 5) > e) return null;
      return yy === y + 1 ? '#2a3a46' : (x * 3 + yy) % 13 === 0 ? '#3d5566' : '#0f1820';
    });
    for (let i = 0; i < 7; i++) {             // fougères : des frondes qui retombent
      const fx = x0 + 6 + Math.round(ih(i, 3, 7) * (x1 - x0 - 12)), side = i % 2 ? 1 : -1, len = 7 + Math.round(ih(i, 4, 7) * 5);
      for (let j = 0; j < len; j++) {
        const t = j / len, x = fx + side * Math.round(t * len * 0.7), yy = y - Math.round(Math.sin(t * 2.4) * len * 0.6);
        p.px(x, yy, j < len - 2 ? '#24382c' : '#3d5e48');
        if (j % 2 === 0 && j < len - 1) p.px(x + side, yy - 1, '#2e4a3a');
      }
    }
    return;
  }
  p.shade(x0, y, x1 - x0, 6, (x, yy) => (yy === y ? '#2a3346' : (x + yy * 3) % 11 === 0 ? '#3a4660' : '#121826'));
  for (let x = x0 + 3; x < x1 - 3; x += 6) { p.px(x, y - 1, '#2e4a3a'); p.px(x, y - 2, '#3d5e48'); p.px(x + 1, y - 2, '#24382c'); }
}

// ---- tablettes votives (ema) et leur corde ------------------------------------------------------
/** Une tablette de bois (toit en pointe), vide : le signe s'écrit par-dessus (drawSign). */
export function ema(p, x, y, w, h, dim = false) {
  const roof = Math.round(w / 3);
  p.shade(x, y, w, h, (px, py) => {
    const i = px - x, j = py - y;
    const inset = Math.max(0, roof - j) * (w / 2) / roof;
    if (i < inset - 0.01 || i > w - 1 - inset + 0.01) return null;
    const edgeL = i < inset + 1, edgeR = i > w - 2 - inset, edgeB = j === h - 1;
    let v = 0.55 + (noise1(px * 0.7 + py * 0.05, 6) - 0.5) * 0.25 + (ih(px, py >> 2, 8) - 0.5) * 0.1;
    if (edgeL) v = 0.92;
    if (edgeR || edgeB) v = 0.18;
    if (dim) v *= 0.6;
    return pick(WOOD, v, px, py, 0.3);
  });
  p.r(x + Math.round(w / 2) - 1, y + roof - 3, 2, 2, '#120c08');
  return { x, y, w, h, body: { x: x + 1, y: y + roof, w: w - 2, h: h - roof - 1 } };
}

const signs = new Map();
/** Un signe à la police du jeu, recadré sur ses pixels (pour le centrer exactement). */
export function inkGlyph(ch, font = 'big', color = '#1b120b') {
  const key = `${ch}|${font}|${color}`;
  let s = signs.get(key);
  if (s) return s;
  const cv = renderText(ch, { font, color });
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  s = x1 < 0 ? null : { cv, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  signs.set(key, s);
  return s;
}

/** Écrit un signe au centre de la tablette (centré sur ses pixels, jamais hors du bois). top : style peint (lisse). */
export function drawSign(g, tab, ch, dy = 0, top = null) {
  if (top) {
    const b = tab.body;
    smoothText(top, renderSmooth, ch, b.x + b.w / 2, b.y + (b.h - 24) / 2 - 1 + dy, { font: 'big', color: '#1b120b' }, 'center');
    return;
  }
  const b = tab.body;
  let s = inkGlyph(ch, 'big');
  if (s && (s.w > b.w - 4 || s.h > b.h - 4)) s = inkGlyph(ch, 'small');
  if (!s) return;
  const x = Math.round(b.x + (b.w - s.w) / 2), y = Math.round(b.y + (b.h - s.h) / 2) + dy;
  g.drawImage(s.cv, s.x0, s.y0, s.w, s.h, x, y, s.w, s.h);
}

/** Corde tendue entre deux perches de bambou plantées au sol ; rend sa hauteur en x. */
export function rope(p, x0, x1, y, sag, gy) {
  for (const px of [x0 - 2, x1]) {
    p.r(px, y - 6, 3, gy - y + 6, '#4a5236'); p.r(px, y - 6, 1, gy - y + 6, '#6e7a4e'); p.r(px + 2, y - 6, 1, gy - y + 6, '#2c3122');
    for (let j = y + 10; j < gy - 4; j += 14) p.r(px, j, 3, 1, '#2c3122');
  }
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
  const ry = (x) => Math.round(y + sag * (1 - Math.pow((x - mid) / half, 2)));
  for (let x = x0; x <= x1; x++) { p.px(x, ry(x), '#7b6d52'); p.px(x, ry(x) + 1, '#2c261c'); }
  return ry;
}

// ---- rocher et panneau (Mon ninja) --------------------------------------------------------------
export function rock(p, cx, top, w, base) {
  p.shade(cx - w / 2 - 4, top - 4, w + 8, base - top + 6, (x, y) => {
    const u = (x - cx) / (w / 2);
    const surf = top + Math.pow(Math.abs(u), 2.4) * (base - top) * 0.7 + noise1(x / 5, 11) * 3;
    if (Math.abs(u) > 1 || y < surf || y > base) return null;
    const lit = y - surf < 2 && u < 0.35;
    const v = (lit ? 0.85 : 0.3 - (y - surf) / (base - top) * 0.25) - (u > 0.4 ? 0.1 : 0) + (ih(x >> 1, y >> 1, 4) - 0.5) * 0.12;
    return pick(STONE, v, x, y, 0.4);
  });
}

/** Panneau de bois sur deux poteaux plantés au sol gy ; light : planche claire (on y lit mieux l'encre). */
export function signpost(p, x, y, w, h, gy, light = false) {
  const lift = light ? 0.3 : 0;
  for (const px of [x + 8, x + w - 12]) { p.r(px, y + h, 4, gy - y - h, WOOD[2]); p.r(px, y + h, 1, gy - y - h, WOOD[4]); p.r(px + 3, y + h, 1, gy - y - h, WOOD[1]); }
  p.shade(x, y, w, h, (px, py) => {
    const j = py - y;
    let v = 0.55 + (noise1(px * 0.08 + Math.floor(j / 4) * 7.3, 13) - 0.5) * 0.35;
    if (j === 0) v = 0.9;
    if (j === h - 1 || px === x + w - 1) v = 0.12;
    if (px === x) v = 0.8;
    if (j % 6 === 5) v -= light ? 0.26 : 0.18;
    if (light && noise1(px * 0.3 + j * 1.7, 31) > 0.83) v -= 0.16;          // nœuds et veines du bois
    return pick(light ? PLANK : WOOD, light && j > 0 && j < h - 1 && px > x && px < x + w - 1 ? v + lift * 0.35 : v, px, py, 0.3);
  });
}

// ---- le coup de pinceau ----------------------------------------------------------------------------
/**
 * Le trait qui marque le choix : presque droit, deux pixels qui s'effilent en un, qui remonte d'un
 * pixel en fin de geste et finit un peu sec. u (0..1) : le trait se tire de gauche à droite.
 */
export function stroke(g, cx, y, len, u = 1, col = INK, tail = '#aaa69c') {
  const x0 = Math.round(cx - len / 2), n = Math.round(len * clamp01(u));
  for (let i = 0; i < n; i++) {
    const t = i / (len - 1);
    if (t > 0.9 && ih(i, 1, len) < 0.5) continue;
    const yy = y - (t > 0.62 ? 1 : 0);
    g.fillStyle = t > 0.82 ? tail : col; g.fillRect(x0 + i, yy, 1, 1);
    if (t > 0.05 && t < 0.55) { g.fillStyle = t > 0.45 ? tail : col; g.fillRect(x0 + i, yy + 1, 1, 1); }
  }
}

// ---- les ninjas --------------------------------------------------------------------------------------
/** Dessine les ninjas des menus (images de repos animées, voilées de nuit), avec un cache par skin. */
export class NinjaArt {
  constructor(meta, skins) { this.meta = meta; this.skins = skins; this.cache = new Map(); }

  frame(skin, i, tint) {
    const key = `${skin}|${i}|${tint}`;
    let c = this.cache.get(key);
    if (c) return c;
    const anim = this.meta.animations.idle, f = anim.frames[i % anim.frames.length];
    c = canvas(f.w, f.h);
    const g = c.getContext('2d');
    g.drawImage((this.skins[skin] ?? this.skins.encre).sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, f.w, f.h); }
    this.cache.set(key, c);
    return c;
  }

  /** Le ninja, pieds en (x, y), agrandi k fois ; t : l'heure (pour l'animation de repos). */
  // crisp : le ninja net (style peint : posé sur le calque du dessus, après le pinceau, en « trait fin »)
  draw(g, skin, x, y, { k = 1, t = 0, flip = false, tint = 'rgba(10,14,30,0.25)', alpha = 1, crisp = false } = {}) {
    if (alpha <= 0) return;
    const anim = this.meta.animations.idle, total = anim.frames.reduce((s, f) => s + (f.duration ?? 167), 0);
    let ms = (t * 1000) % total, i = 0;
    while (ms > (anim.frames[i].duration ?? 167)) { ms -= anim.frames[i].duration ?? 167; i++; }
    let c = this.frame(skin, i, tint);
    const { pivot } = this.meta;
    if (crisp) c = c.crisp ??= crispSheet(c, 'fin');
    const P = c.P ?? 1;
    g.save();
    g.imageSmoothingEnabled = !!c.smooth;
    if (c.smooth) g.imageSmoothingQuality = 'high';
    g.globalAlpha = alpha;
    if (flip) { g.translate(Math.round(x + pivot.x * k), Math.round(y - pivot.y * k)); g.scale(-1, 1); }
    else g.translate(Math.round(x - pivot.x * k), Math.round(y - pivot.y * k));
    g.drawImage(c, 0, 0, c.width / P * k, c.height / P * k);
    g.restore();
  }
}
