// La statue oubliée (zone 9) : une tête de femme monumentale, en pierre, la tête un
// peu penchée, le regard baissé, mélancolique ; coiffée et drapée de feuillage et de
// lianes en désordre (d'après le modèle de Raph). Le visage est sculpté comme un vrai
// relief (une hauteur par pixel), puis éclairé du haut à gauche avec ses ombres
// portées : arcades, paupières, nez, lèvres et cou ont du volume.
//
// Deux calques : la pierre, et le feuillage (devant). Les yeux s'allument un par un :
// une lumière turquoise filtre sous les paupières baissées.
import { Pix, canvas, ih, noise1, noise2, fbm2, worley, pick, bayer } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

export const STATUE = {
  w: 208, h: 236,            // toile (le sol est en bas)
  cx: 104,                   // axe du cou
  top: 30, chin: 182,        // haut du crâne et bas du menton (tête droite)
  half: 56,                  // demi-largeur du visage
  tilt: -0.15,               // la tête penche vers la gauche (radians)
  pivot: { x: 104, y: 178 }, // elle penche autour du haut du cou
  neck: { top: 146, half0: 22, half1: 31 },
  eyeU: 0.36, eyeV: 0.452,   // les yeux, en coordonnées du visage
};
const S = STATUE;
const FH = S.chin - S.top;
const COS = Math.cos(S.tilt), SIN = Math.sin(S.tilt);
/** Coordonnées du visage (u : -1 à 1 de gauche à droite, v : 0 en haut du crâne, 1 au menton) d'un point de la toile. */
function toHead(x, y) {
  const dx = x - S.pivot.x, dy = y - S.pivot.y;
  return { u: (COS * dx + SIN * dy) / S.half, v: (-SIN * dx + COS * dy + S.pivot.y - S.top) / FH };
}
/** Point de la toile d'un point du visage. */
function fromHead(u, v) {
  const lx = u * S.half, ly = v * FH - (S.pivot.y - S.top);
  return { x: S.pivot.x + COS * lx - SIN * ly, y: S.pivot.y + SIN * lx + COS * ly };
}
export const eyeCenter = (side) => { const p = fromHead(side * S.eyeU, S.eyeV + 0.012); return { x: Math.round(p.x), y: Math.round(p.y) }; };

// pierre de la statue : gris-bleu, lumières un peu vertes (le soleil traverse les feuilles)
const STONE = ['#101824', '#1b2936', '#2b4152', '#405e6b', '#5c8187', '#86a99f', '#b6cdb4'];
const LASH = '#0a0f17';

const gauss = (t) => Math.exp(-t * t);
const hat = (t) => Math.exp(-t * t * t * t);

/** Demi-largeur du visage (0 à 1) selon v : crâne arrondi, tempes, puis un ovale qui s'affine jusqu'au menton. */
function headHalf(v) {
  if (v < 0) return 0;
  if (v < 0.16) return 0.6 + 0.38 * Math.sqrt(v / 0.16);
  if (v < 0.46) return 0.98 + 0.02 * Math.sin(((v - 0.16) / 0.3) * Math.PI);
  const t = (v - 0.46) / 0.54;
  // un ovale qui s'affine tôt : mâchoire fine, menton étroit et arrondi
  return Math.max(0, 0.98 - 0.8 * Math.pow(t, 1.4) - (t > 0.86 ? Math.pow((t - 0.86) / 0.14, 2) * 0.18 : 0));
}

/** La ligne des cils d'un œil baissé (v selon u) : un arc à peine creusé vers le bas. */
const lashV = (au) => 0.462 + 0.02 * (1 - ((au - S.eyeU) / 0.185) ** 2);

/** Relief du visage en (u, v), -1 hors de la pierre. */
function face(u, v) {
  const hw = headHalf(v);
  if (v < 0 || v > 1 || hw <= 0) return -1;
  const a = u / hw;
  if (Math.abs(a) >= 1) return -1;
  const au = Math.abs(u);
  let z = Math.sqrt(1 - a * a) * 0.44 + 0.16 * Math.pow(1 - a * a * a * a, 0.5) + 0.14;
  z -= Math.max(0, 0.24 - v) * 0.55;                                              // le front fuit
  z -= Math.max(0, v - 0.86) * 0.5;                                               // le menton rentre
  // sourcils fins, arqués, relevés vers le milieu : la mélancolie
  const vb = 0.352 + 0.05 * ((au - 0.37) / 0.26) ** 2 - (au < 0.37 ? (0.022 * (0.37 - au)) / 0.25 : 0);
  z += 0.055 * gauss((v - vb) / 0.024) * gauss((au - 0.38) / 0.2);
  // orbites : un creux doux ; la paupière du haut, baissée, bombée ; celle du bas, à peine
  z -= 0.15 * gauss(Math.hypot((au - S.eyeU) / 0.23, (v - 0.44) / 0.075));
  z += 0.075 * gauss(Math.hypot((au - S.eyeU) / 0.18, (v - 0.442) / 0.034));
  z += 0.02 * gauss(Math.hypot((au - S.eyeU) / 0.17, (v - 0.488) / 0.012));
  // le nez : une arête fine, un bout arrondi, de petites narines
  const nt = (v - 0.4) / 0.225;
  if (nt > -0.1 && nt < 1.15) {
    const k = Math.max(0, Math.min(1, nt)), nw = 0.045 + 0.06 * k;
    z += (0.05 + 0.15 * Math.pow(k, 0.85)) * hat(u / nw) * (nt > 1 ? gauss((nt - 1) / 0.08) : 1);
  }
  z += 0.045 * gauss(Math.hypot(u / 0.065, (v - 0.622) / 0.024));
  z -= 0.035 * gauss(Math.hypot((au - 0.052) / 0.022, (v - 0.64) / 0.011));
  z -= 0.015 * gauss(u / 0.025) * gauss((v - 0.67) / 0.02);                     // le sillon sous le nez
  // les lèvres : pleines, closes, les coins qui retombent
  const vm = 0.712 + 0.02 * Math.min(1, (u / 0.16) ** 2);
  z += 0.048 * gauss((v - (vm - 0.018)) / 0.014) * hat(u / 0.165);
  z -= 0.06 * gauss((v - vm) / 0.0055) * hat(u / 0.155);
  z += 0.06 * gauss((v - (vm + 0.026)) / 0.019) * hat(u / 0.13);
  z -= 0.03 * gauss((v - (vm + 0.066)) / 0.017) * hat(u / 0.13);
  z += 0.045 * gauss(Math.hypot(u / 0.15, (v - 0.88) / 0.06));                   // le menton
  // pommettes hautes, joues un peu creusées
  z += 0.055 * gauss((v - 0.53) / 0.07) * gauss((au - 0.56) / 0.17);
  z -= 0.025 * gauss((v - 0.68) / 0.07) * gauss((au - 0.6) / 0.14);
  return z;
}

/** Le cou : un fût lisse, qui s'élargit vers le bas (les épaules sont sous les feuilles). */
function neck(x, y) {
  const N = S.neck;
  if (y < N.top || y > S.h) return -1;
  // le cou, puis la naissance des épaules (enfouies dans le sol et les feuilles)
  const t = (y - N.top) / (S.h - N.top), hwN = N.half0 + (N.half1 - N.half0) * t * t + (t > 0.72 ? Math.pow((t - 0.72) / 0.28, 1.6) * 52 : 0);
  const nx = (x - S.cx - (y - S.h) * 0.07) / hwN;          // le cou suit un peu la tête qui penche
  if (Math.abs(nx) >= 1) return -1;
  // deux tendons à peine marqués, qui descendent en biais
  return Math.sqrt(1 - nx * nx) * 0.3 + 0.012 * gauss((Math.abs(nx) - 0.55 + t * 0.2) / 0.12);
}

/** Hauteur de la pierre en un point de la toile (la tête passe devant le cou). */
function zAt(x, y) {
  const h = toHead(x, y), zf = face(h.u, h.v), zn = neck(x, y);
  return Math.max(zf, zn);
}

const KZ = 46;                                  // pixels de profondeur par unité de relief
const LIGHT = (() => { const l = [-0.42, -0.72, 0.55], n = Math.hypot(...l); return l.map((c) => c / n); })();

/** Peint la pierre de la statue. */
function carve(pix) {
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const h = toHead(x, y), onFace = face(h.u, h.v) >= 0 && face(h.u, h.v) >= neck(x, y);
    // silhouette érodée : des éclats manquent au bord
    const z = zAt(x + (noise1(y * 0.19, 3) - 0.5) * 2.6 * (Math.abs(h.u) > 0.82 || !onFace ? 1 : 0), y);
    if (z < 0) continue;
    const zx = (zAt(x + 1, y) - zAt(x - 1, y)) * 0.5 * KZ, zy = (zAt(x, y + 1) - zAt(x, y - 1)) * 0.5 * KZ;
    const inv = 1 / Math.hypot(zx, zy, 1);
    let lum = 0.1 + 0.8 * Math.max(0, (-zx * LIGHT[0] - zy * LIGHT[1] + LIGHT[2]) * inv);
    // ombres portées : on remonte vers la lumière
    for (let k = 1; k <= 10; k++) {
      const sz = zAt(x + LIGHT[0] * k * 2.2, y + LIGHT[1] * k * 2.2);
      if (sz >= 0 && (sz - z) * KZ > k * 2.2 * 0.62 + 0.6) { lum *= 0.5; break; }
    }
    // la pierre : grands pans, grain léger, fissures
    const w = worley(x, y, 23, 5, 1.15);
    lum += (w.id - 0.5) * (onFace ? 0.035 : 0.07) + (fbm2(x * 0.09, y * 0.09, 3, 7) - 0.5) * 0.12;
    const fy = (y - S.top) / (S.h - S.top);
    lum *= 1.08 - 0.55 * Math.pow(Math.max(0, fy), 1.4);                          // le bas se perd dans l'ombre
    if (onFace) lum += 0.11 * gauss(Math.hypot(h.u * 0.9, (h.v - 0.38) * 1.4) / 0.55);   // le jour tombe sur le haut du visage
    let c = pick(STONE, lum, x, y, 0.22);
    if (w.d2 - w.d < 0.5 && ih(Math.round(w.id * 97), 0, 4) < 0.2) c = STONE[Math.max(0, Math.floor(lum * 6) - 1)];   // fissure
    if (onFace) {
      const au = Math.abs(h.u);
      // les yeux baissés : la ligne des cils, et le pli de la paupière
      if (Math.abs(au - S.eyeU) < 0.185) {
        const lv = lashV(au);
        if (Math.abs(h.v - lv) < 0.0068) c = LASH;
        else if (h.v > lv && h.v < lv + 0.012 && au > S.eyeU) c = STONE[1];        // les cils, côté extérieur
        else if (Math.abs(h.v - (lv - 0.034 - 0.006 * (1 - ((au - S.eyeU) / 0.185) ** 2))) < 0.004) c = STONE[Math.max(0, Math.floor(lum * 6) - 1)];
      }
      // une traînée sombre sous l'œil gauche, comme une larme de pluie
      if (Math.abs(h.u + S.eyeU + 0.06 - (h.v - 0.47) * 0.08) < 0.012 && h.v > 0.47 && h.v < 0.6 + ih(x, 0, 5) * 0.02) c = STONE[1];
    }
    // mousse sur ce qui regarde le ciel, et dans les creux humides (jamais sur les yeux)
    const up = -zy * inv;
    const nearEye = onFace && Math.hypot((Math.abs(h.u) - S.eyeU) / 0.24, (h.v - 0.455) / 0.06) < 1.2;
    const m = up * 1.1 + fbm2(x * 0.09, y * 0.11, 3, 11) * 1.7 + (0.45 - Math.max(0, fy)) * 0.4 - (nearEye ? 2 : 0) - (onFace && Math.abs(h.u) < 0.4 && h.v > 0.55 ? 0.4 : 0);
    if (m > 1.62) c = pick(C.MOSS, Math.min(0.6, lum * 0.8 + 0.06 + (m - 1.62) * 0.4), x, y);
    pix.set(x, y, c);
  }
}

/** Le feuillage : une couronne qui suit la tête penchée, des touffes en désordre sur les côtés, des lianes de toutes longueurs. */
function hair(pix) {
  const ramp = ['#0d2a22', '#14392b', '#1b4d3e', '#23694a', '#2e8b57', '#55ae54', '#8fd058', '#c9ee78'];
  const shade = (k) => ramp.map((c, i) => ramp[Math.max(0, i - k)]);
  // le bord bas de la couronne (sur le front), déchiqueté
  const edge = (u) => 0.25 + (noise1(u * 6 + 3, 27) - 0.5) * 0.1 + 0.06 * u * u + (u > 0.3 ? 0.04 : 0);
  const top = (u) => -0.085 - 0.04 * (1 - u * u) + (noise1(u * 5, 28) - 0.5) * 0.07 - Math.max(0, Math.sin(u * 7.3 + 1.1)) * 0.035;   // des touffes qui dépassent
  const crown = (x, y) => {
    const { u, v } = toHead(x, y), e = edge(u), t = top(u);
    if (v > e || v < t) return 0;
    const hw = (v > 0.02 ? headHalf(v) : 1) + 0.12 + (noise1(v * 9 + u, 29) - 0.5) * 0.12;
    if (Math.abs(u) > hw) return 0;
    return Math.min(e - v, v - t, hw - Math.abs(u)) * 30;
  };
  const light = (x, y) => { const { u, v } = toHead(x, y); return 1.0 - (v - top(u)) * 1.9 - Math.max(0, u) * 0.18; };
  // les touffes des côtés : la gauche descend plus bas que la droite (la tête penche)
  const clumps = [];
  for (const side of [-1, 1]) {
    const n = side < 0 ? 9 : 7;
    for (let k = 0; k < n; k++) {
      // elles descendent le long des tempes et des joues, sans jamais venir sous le menton
      const v = 0.16 + k * (side < 0 ? 0.075 : 0.07) + (ih(k, side, 51) - 0.5) * 0.05;
      const u = side * (Math.max(headHalf(Math.min(0.99, v)), 0.92) + 0.06 + ih(k, side, 52) * 0.12);
      const p = fromHead(u, v), r = 7 + ih(k, side, 53) * 8 - k * 0.3;
      clumps.push({ x: p.x + side * ih(k, side, 54) * 6, y: p.y, r, k, side });
    }
  }
  // d'abord l'ombre derrière les touffes, puis les touffes elles-mêmes
  for (const c of clumps) L.leafMass(pix, [c.x - c.r * 1.6, c.y - c.r * 1.4, c.x + c.r * 1.6, c.y + c.r * 1.8],
    (x, y) => 1 - Math.hypot((x - c.x) / (c.r * 1.3), (y - c.y) / (c.r * 1.2)) + (noise2(x * 0.3, y * 0.3, c.k + 60) - 0.5) * 0.6,
    (x, y) => 0.75 - (y - c.y + c.r) / (c.r * 3) - (c.side > 0 ? 0.18 : 0), ramp, 61 + c.k * 3 + (c.side > 0 ? 50 : 0), { density: 0.7, size: 2, wide: 2, step: 3 });
  // des lianes qui pendent de partout, de toutes longueurs ; aucune ne cache un œil
  const eyes = [eyeCenter(-1), eyeCenter(1)];
  const list = [];
  for (let i = 0; i < 46; i++) {
    const u = -1.25 + (i / 45) * 2.5 + (ih(i, 1, 71) - 0.5) * 0.05;
    const v = Math.abs(u) > 1 ? 0.2 + ih(i, 2, 71) * 0.5 : edge(u) - 0.03;
    const p = fromHead(u, v);
    const side = Math.abs(u) > 0.95;
    let len = side ? 30 + ih(i, 3, 71) * (S.h - p.y - 30) : 6 + Math.pow(ih(i, 3, 71), 2.2) * 120;
    for (const e of eyes) if (Math.abs(p.x - e.x) < 15 && p.y < e.y && p.y + len > e.y - 9) len = Math.max(4, e.y - 10 - p.y);
    list.push({ x: Math.round(p.x), y: Math.round(p.y), len: Math.round(Math.min(len, S.h - 2 - p.y)), front: ih(i, 4, 71), i });
  }
  list.sort((a, b) => a.front - b.front);
  for (const st of list) L.strand(pix, st.x, st.y, st.len, st.front < 0.4 ? shade(2) : ramp, st.i * 7 + 3, Math.max(0.25, st.front), 0, st.len > 60 ? 2 : 1);
  // la couronne : un dôme de grandes feuilles, éclairé par le dessus
  L.leafMass(pix, [0, 0, S.w - 1, S.top + 60], crown, light, ramp, 31, { density: 0.78, size: 2, wide: 2, step: 4 });
  // des fougères plantées dans la couronne
  for (const [u, sz] of [[-0.95, 11], [-0.45, 14], [0.05, 16], [0.55, 13], [1.0, 10]]) {
    const p = fromHead(u, top(u) + 0.06);
    L.fern(pix, Math.round(p.x), Math.round(p.y), sz, C.FERN, 40 + Math.round(u * 20));
  }
  // au pied : des fougères et des buissons cachent la naissance des épaules
  for (const [dx, rw, rh] of [[-58, 14, 9], [-30, 11, 7], [44, 13, 8], [70, 12, 9], [16, 8, 5]]) L.bush(pix, S.cx + dx, S.h - 1, rw, rh, shade(1), 120 + dx);
  for (const [dx, sz] of [[-66, 15], [-40, 12], [58, 14], [30, 10]]) L.fern(pix, S.cx + dx, S.h - 1, sz, C.FERN, 130 + dx);
  // de la mousse et quelques feuilles sur le visage : l'arête du nez, la joue droite, le bas de la joue gauche
  for (const [u, v, rw, rh] of [[0.02, 0.4, 4, 3], [0.66, 0.74, 6, 3], [-0.78, 0.6, 5, 3]]) {
    const p = fromHead(u, v);
    L.bush(pix, Math.round(p.x), Math.round(p.y), rw, rh, ramp.slice(1), 90 + Math.round(u * 50));
  }
}

/** La lumière d'un œil rallumé : elle filtre sous la paupière baissée et coule sur la joue. */
function eyeGlow(side) {
  const R = 30, p = new L.Sheet(R * 2, R * 2), e = eyeCenter(side);
  for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
    const X = e.x - R + x, Y = e.y - R + y, h = toHead(X, Y), au = Math.abs(h.u);
    if (Math.sign(h.u) !== side) continue;
    const du = (au - S.eyeU) / 0.185;
    if (Math.abs(du) < 1) {
      const lv = lashV(au);
      if (Math.abs(h.v - lv) < 0.0068) { p.set(x, y, Math.abs(du) < 0.55 ? '#eafff4' : '#a6eede'); continue; }
      // sous les cils : une lueur qui pâlit en descendant
      const below = (h.v - lv) / 0.06;
      if (below > 0 && below < 1) { p.set(x, y, '#6fe0d4', Math.round((1 - below) * (1 - du * du) * 150)); continue; }
    }
    // un halo très doux autour de l'œil
    const d = Math.hypot(du * 0.8, (h.v - 0.47) / 0.07);
    if (d < 1.6) p.set(x, y, '#5fd0cc', Math.round(Math.max(0, 1 - d / 1.6) * 55));
  }
  return { img: p.done(), x: e.x - R, y: e.y - R };
}

/** Peint la statue une fois pour toutes : { stone, hair, glow: [gauche, droite] }. */
export function paintStatue() {
  const stone = new L.Sheet(S.w, S.h);
  carve(stone);
  const h = new L.Sheet(S.w, S.h);
  hair(h);
  return { stone: stone.done(), hair: h.done(), glow: [eyeGlow(-1), eyeGlow(1)] };
}

/** Dessine la statue, posée en (x, ground). state : { eyes: [0..1, 0..1] }. */
export function drawStatue(ctx, art, x, ground, state = {}) {
  const y = ground - S.h, eyes = state.eyes ?? [0, 0];
  ctx.drawImage(art.stone, x, y);
  art.glow.forEach((g, i) => {
    if (eyes[i] <= 0) return;
    ctx.globalAlpha = Math.min(1, eyes[i]);
    ctx.drawImage(g.img, x + g.x, y + g.y);
    ctx.globalAlpha = 1;
  });
  ctx.drawImage(art.hair, x, y);
}

// ---------------------------------------------------------------------------
// ruines du sanctuaire : murs de gros blocs, dallage
// ---------------------------------------------------------------------------
/** Mur de gros blocs taillés, moussu (x0, y0 : coin haut-gauche). dim : assombrit (mur dans l'ombre). */
export function ruinWall(pix, x0, y0, w, h, seed, dim = 0) {
  let y = y0, row = 0;
  while (y < y0 + h) {
    const bh = 13 + Math.floor(ih(row, seed, 1) * 9);
    let x = x0 - Math.floor(ih(row, seed, 2) * 14);
    let col = 0;
    while (x < x0 + w) {
      const bw = 17 + Math.floor(ih(row, col, seed) * 16);
      const tone = 0.42 + (ih(col, row, seed + 3) - 0.5) * 0.3 - dim;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const X = x + i, Y = y + j;
        if (X < x0 || X >= x0 + w || Y >= y0 + h) continue;
        let v = tone + (fbm2(X * 0.2, Y * 0.2, 2, seed) - 0.5) * 0.22 - ((X - x0) / w) * 0.14;
        if (j === 0 || i === 0) v += 0.17;                                         // arêtes éclairées
        if (j >= bh - 1 || i >= bw - 1) { pix.set(X, Y, C.RUIN[0]); continue; }      // joints
        if (ih(col, row, seed + 5) < 0.2 && i + j < 5) { pix.set(X, Y, C.RUIN[0]); continue; }   // coin ébréché
        const m = fbm2(X * 0.1, Y * 0.12, 3, seed + 7) + (j < 3 ? 0.22 : 0) - 0.06;
        pix.set(X, Y, m > 0.68 ? pick(C.MOSS, v + 0.12 + (j < 3 ? 0.25 : 0), X, Y) : pick(C.RUIN, v, X, Y));
      }
      x += bw; col++;
    }
    y += bh; row++;
  }
}

/** Dallage ancien : dalles inégales, herbe dans les joints (y0 : dessus). */
export function pavement(pix, x0, x1, y0, h, seed, light = () => 0) {
  for (let x = x0; x < x1; x++) for (let j = 0; j < h; j++) {
    const y = y0 + j;
    const w = worley(x, y * 2.6, 26, seed, 1);
    let v = 0.46 + (w.id - 0.5) * 0.22 + (fbm2(x * 0.15, y * 0.3, 2, seed + 1) - 0.5) * 0.2 - j * 0.035 + light(x);
    if (j === 0) v += 0.14;
    if (w.d2 - w.d < 1.3) pix.set(x, y, j < 2 && ih(x, 0, seed) < 0.55 ? C.MOSS[4] : C.RUIN[0]);
    else pix.set(x, y, j > 5 ? L.groundColor(x, y, j + 6) : pick(C.RUIN, v, x, y));
  }
}

export { canvas };
