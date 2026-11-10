// La statue oubliée (zone 9) : un visage monumental de pierre, paisible, coiffé
// et drapé de feuillage et de lianes. Le visage est sculpté comme un vrai relief
// (une hauteur par pixel), puis éclairé du haut à gauche avec ses ombres portées :
// le nez, les arcades et les lèvres ont du volume, rien n'est plat.
//
// Trois calques, pour le mécanisme : la pierre (avec la caverne de la bouche),
// la mâchoire (elle s'enfonce dans le sol) et le feuillage (devant). Les yeux
// s'allument un par un (lueur turquoise des lanternes de pierre).
import { Pix, canvas, ih, noise1, noise2, fbm2, worley, pick, bayer } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

export const STATUE = {
  w: 184, h: 228,            // toile (le sol est en bas)
  cx: 92,                    // axe du visage
  top: 38,                   // haut de la pierre (le feuillage dépasse au-dessus)
  half: 61,                  // demi-largeur du visage
  jawW: 52, jawH: 54,        // la mâchoire : large de 52, haute de 54 ; elle descend de toute sa hauteur
  eyeDX: 26, eyeY: 0.425,    // centres des yeux : cx ± eyeDX, à cette hauteur relative
};
const S = STATUE;
const FH = S.h - S.top;                         // hauteur du visage
const MOUTH_V = 1 - S.jawH / FH;                // ligne de la bouche
export const eyeCenter = (side) => ({ x: S.cx + side * S.eyeDX, y: Math.round(S.top + S.eyeY * FH) });

// pierre de la statue : gris-bleu, lumières un peu vertes (le soleil traverse les feuilles)
const STONE = ['#101824', '#1b2936', '#2b4152', '#405e6b', '#5c8187', '#86a99f', '#b6cdb4'];
const SOCKET = ['#090e16', '#0e1620', '#15222e'];

const gauss = (t) => Math.exp(-t * t);
const hat = (t) => Math.exp(-t * t * t * t);

/** Demi-largeur du visage (0 à 1) selon la hauteur v : crâne arrondi, tempes, mâchoire. */
function headHalf(v) {
  if (v < 0.14) return 0.7 + 0.28 * Math.sqrt(v / 0.14);
  if (v < 0.6) return 0.98 + 0.02 * Math.sin(((v - 0.14) / 0.46) * Math.PI);
  return 0.98 - 0.1 * Math.pow((v - 0.6) / 0.4, 1.6);
}

/** Relief du visage en (u, v) : u de -1 à 1 (gauche à droite), v de 0 (haut) à 1 (sol). -1 hors de la pierre. */
function relief(u, v) {
  const hw = headHalf(v), a = u / hw;
  if (Math.abs(a) >= 1 || v < 0) return -1;
  let z = Math.sqrt(1 - a * a) * 0.42 + 0.2 * Math.pow(1 - a * a * a * a, 0.5);
  z -= Math.max(0, 0.22 - v) * 0.7;                                             // le front fuit vers l'arrière
  // arcades : une barre droite, plus basse aux tempes, creusée entre les yeux
  z += 0.15 * gauss((v - (0.34 + 0.03 * a * a)) / 0.03) * (1 - 0.3 * gauss(u / 0.09)) * Math.min(1, (1 - Math.abs(a)) * 5);
  // orbites : larges, profondes, bord du haut droit sous l'arcade
  for (const s of [-1, 1]) {
    const du = (u - s * 0.42) / 0.275, dv = (v - S.eyeY) / (v < S.eyeY ? 0.05 : 0.07);
    z -= 0.36 * gauss(Math.sqrt(du * du + dv * dv) * 1.05);
  }
  // nez : arête droite qui s'élargit, ailes au bout
  const nt = (v - 0.325) / 0.28;
  if (nt > 0 && nt < 1.25) {
    const nw = 0.065 + 0.1 * Math.min(1, nt) * Math.min(1, nt);
    z += (0.07 + 0.2 * Math.pow(Math.min(1, nt), 0.75)) * hat(u / nw) * (nt > 1 ? gauss((nt - 1) / 0.07) : 1);
  }
  z += 0.075 * gauss((v - 0.6) / 0.026) * gauss((Math.abs(u) - 0.17) / 0.06);
  // pommettes
  z += 0.08 * gauss((v - 0.555) / 0.08) * gauss((Math.abs(u) - 0.55) / 0.2);
  // lèvres closes : un sourire à peine esquissé
  const smile = 0.012 * (1 - Math.min(1, (u * u) / 0.1));
  z += 0.075 * gauss((v - (MOUTH_V - 0.032)) / 0.022) * hat(u / 0.33);
  z -= 0.085 * gauss((v - MOUTH_V - smile) / 0.0075) * hat(u / 0.37);
  z += 0.085 * gauss((v - (MOUTH_V + 0.035)) / 0.024) * hat(u / 0.29);
  z -= 0.045 * gauss((v - (MOUTH_V + 0.085)) / 0.022) * hat(u / 0.3);
  z += 0.09 * gauss((v - (MOUTH_V + 0.17)) / 0.07) * hat(u / 0.36);                // menton
  return z;
}

const KZ = 46;                                  // pixels de profondeur par unité de relief
const LIGHT = (() => { const l = [-0.42, -0.72, 0.55], n = Math.hypot(...l); return l.map((c) => c / n); })();

/** Peint la pierre d'un rectangle du visage dans pix (décalé de ox, oy). only : filtre des pixels. */
function carve(pix, ox, oy, only) {
  const zAt = (x, y) => relief((x - S.cx) / S.half, (y - S.top) / FH);
  for (let y = S.top; y < S.h; y++) for (let x = S.cx - S.half - 2; x <= S.cx + S.half + 2; x++) {
    if (only && !only(x, y)) continue;
    const u = (x - S.cx) / S.half, v = (y - S.top) / FH;
    // silhouette érodée : des éclats manquent au bord
    const z = zAt(x + (noise1(y * 0.19, 3) - 0.5) * 3.2 * (Math.abs(u) > 0.8 ? 1 : 0), y);
    if (z < 0) continue;
    const zx = (zAt(x + 1, y) - zAt(x - 1, y)) * 0.5 * KZ, zy = (zAt(x, y + 1) - zAt(x, y - 1)) * 0.5 * KZ;
    const inv = 1 / Math.hypot(zx, zy, 1);
    let lum = 0.1 + 0.8 * Math.max(0, (-zx * LIGHT[0] - zy * LIGHT[1] + LIGHT[2]) * inv);
    // ombres portées : on remonte vers la lumière
    for (let k = 1; k <= 9; k++) {
      const sz = zAt(x + LIGHT[0] * k * 2.2, y + LIGHT[1] * k * 2.2);
      if (sz >= 0 && (sz - z) * KZ > k * 2.2 * 0.62 + 0.6) { lum *= 0.52; break; }
    }
    // la pierre : grands pans, grain, fissures
    const w = worley(x, y, 21, 5, 1.15);
    lum += (w.id - 0.5) * 0.11 + (fbm2(x * 0.09, y * 0.09, 3, 7) - 0.5) * 0.2;
    lum *= 1.06 - 0.5 * Math.pow(v, 1.3);                                          // le bas se perd dans l'ombre
    lum += 0.12 * gauss(Math.hypot(u * 0.9, (v - 0.3) * 1.5) / 0.55);              // la lumière tombe sur le haut du visage
    // orbites : presque noires, avec une paupière du bas qui accroche un peu de jour
    let c;
    const du = (Math.abs(u) - 0.42) / 0.255, dv = (v - S.eyeY) / (v < S.eyeY ? 0.042 : 0.062);
    const eye = du * du + dv * dv;
    if (eye < 1) c = pick(SOCKET, 0.25 + (dv > 0.55 ? 0.4 : 0) + (noise2(x * 0.4, y * 0.4, 9) - 0.5) * 0.4, x, y);
    else if (w.d2 - w.d < 0.5 && ih(Math.round(w.id * 97), 0, 4) < 0.22) c = STONE[Math.max(0, Math.floor(lum * 6) - 1)];   // fissure
    else c = pick(STONE, lum, x, y, 0.34);
    // mousse sur ce qui regarde le ciel, et dans les creux humides
    const up = -zy * inv;
    const m = up * 1.1 + fbm2(x * 0.09, y * 0.11, 3, 11) * 1.7 + (0.5 - v) * 0.4 - (eye < 1.4 ? 1 : 0) - (Math.abs(u) < 0.4 && v > 0.5 ? 0.5 : 0);
    if (m > 1.6) c = pick(C.MOSS, Math.min(0.6, lum * 0.8 + 0.06 + (m - 1.6) * 0.4), x, y);
    pix.set(x - ox, y - oy, c);
  }
}

/** La caverne derrière la mâchoire : une gorge de pierre, une lueur turquoise tout au fond. */
function throat(pix) {
  const x0 = S.cx - S.jawW / 2, y0 = S.h - S.jawH;
  const ramp = ['#04070b', '#070d14', '#0b1822', '#0f2c36', '#16505a', '#2a8a8c', '#6fd6cc'];
  for (let y = 0; y < S.jawH; y++) for (let x = 0; x < S.jawW; x++) {
    const nx = (x - S.jawW / 2) / (S.jawW / 2), ny = (S.jawH - y) / S.jawH;
    // une voûte qui s'enfonce : trois arcs de plus en plus petits et clairs
    const d = Math.hypot(nx * 1.15, (ny - 0.1) * 1.35);
    let v = 0.86 - d * 0.95 + (noise2(x * 0.3, y * 0.3, 13) - 0.5) * 0.08;
    const ring = (d * 3.2) % 1;
    if (ring < 0.16) v -= 0.14;                                                  // l'arête d'un arc
    if (ny < 0.1) v = Math.min(v, 0.3 - Math.abs(nx) * 0.1) + ((x >> 3) % 2 ? 0.04 : 0);   // les dalles du seuil
    pix.set(x0 + x, y0 + y, pick(ramp, v, x0 + x, y0 + y));
  }
  // radicelles et mousse qui pendent de la lèvre du haut
  for (let i = 0; i < 9; i++) {
    const x = x0 + 3 + Math.floor(ih(i, 1, 15) * (S.jawW - 6)), len = 3 + Math.floor(ih(i, 2, 15) * 9);
    for (let s = 0; s < len; s++) pix.set(x + (s > 4 && i % 2 ? 1 : 0), y0 + s, s > len - 3 ? C.MOSS[3] : C.MOSS[1]);
  }
}

const inJaw = (x, y) => Math.abs(x - S.cx) < S.jawW / 2 && y >= S.h - S.jawH;

/** Chevelure : couronne de feuillage, deux rideaux de lianes (les « mèches »), brins sur le visage. */
function hair(pix) {
  const ramp = ['#0d2a22', '#14392b', '#1b4d3e', '#23694a', '#2e8b57', '#55ae54', '#8fd058', '#c9ee78'];
  const crownTop = (x) => { const u = (x - S.cx) / (S.half + 24); return 5 + 30 * u * u * u * u + 9 * u * u + (noise1(x * 0.12, 27) - 0.5) * 9; };
  const crownLow = (x) => { const u = (x - S.cx) / (S.half + 24); return S.top + 16 + (noise1(x * 0.07, 29) - 0.5) * 22 + 22 * u * u; };
  // les deux rideaux : une masse sombre, puis des brins feuillus (ceux du fond d'abord) ;
  // le rideau de droite est dans l'ombre
  for (const side of [-1, 1]) {
    const edge = S.cx + side * (S.half + 3);
    for (let y = S.top + 10; y < S.h; y++) for (let o = -15; o <= 17; o++) {
      const k = 1 - Math.abs(o - 1) / 17;
      const bottom = S.h - Math.pow(noise1((edge + o * side) * 0.3, 19 + side), 2) * 90 * (1 - k * 0.8);
      if (y < bottom && k + (noise2(o * 0.35, y * 0.12, 21 + side) - 0.5) * 0.9 > 0.3) pix.set(edge + o * side, y, ramp[ih(o, y >> 2, 23) < 0.3 ? 1 : 0]);
    }
    const list = [];
    for (let i = 0; i < 20; i++) list.push({ x: Math.round(edge + side * (-13 + i * 1.6 + (ih(i, side, 41) - 0.5) * 2)), front: ih(i, side, 42), i });
    list.sort((a, b) => a.front - b.front);
    for (const st of list) {
      const y0 = Math.round(crownLow(st.x)) - 10;
      const reach = ih(st.i, side, 43) < 0.55 ? 1 : 0.55 + ih(st.i, side, 44) * 0.4;      // plus d'un brin sur deux touche le sol
      L.strand(pix, st.x, y0, Math.round((S.h - 3 - y0) * reach), ramp, st.i * 7 + (side > 0 ? 3 : 0), Math.max(0.2, st.front * (side > 0 ? 0.6 : 0.95)), side, 2);
    }
  }
  // la couronne : un dôme de grandes feuilles, éclairé par le dessus
  L.leafMass(pix, [S.cx - S.half - 28, 0, S.cx + S.half + 28, S.top + 50],
    (x, y) => (Math.abs(x - S.cx) > S.half + 25 ? 0 : Math.min(y - crownTop(x), crownLow(x) - y) / 5),
    (x, y) => 1.02 - ((y - crownTop(x)) / (crownLow(x) - crownTop(x) + 1)) * 0.8 - Math.max(0, (x - S.cx) / S.half) * 0.14, ramp, 31, { density: 0.75, size: 2, wide: 2, step: 4 });
  // fougères plantées dans la couronne
  for (const [fx, sz] of [[-50, 13], [-18, 16], [18, 14], [44, 15], [70, 11], [-74, 11]]) L.fern(pix, S.cx + fx, Math.round(crownTop(S.cx + fx)) + 6, sz, C.FERN, 40 + fx);
  // brins qui pendent sur le front et devant un œil
  for (const [dx, len, f] of [[-40, 70, 0.9], [-29, 34, 0.6], [-10, 20, 0.7], [7, 28, 0.6], [22, 78, 0.85], [36, 40, 0.6], [47, 24, 0.5], [-50, 38, 0.7]]) {
    L.strand(pix, S.cx + dx, Math.round(crownLow(S.cx + dx)) - 8, len, ramp, Math.abs(dx) + 1, f, 0, 1);
  }
}

/** Lueur d'un œil rallumé : la petite lanterne de pierre au fond de l'orbite. */
function eyeGlow(side) {
  const R = 30, p = new L.Sheet(R * 2, R * 2), e = eyeCenter(side);
  const ramp = ['#0f3a44', '#16596a', '#1f8f96', '#4fc9c2', '#a6eede', '#eafff4'];
  for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
    const X = e.x - R + x, Y = e.y - R + y;
    const u = (X - S.cx) / S.half, v = (Y - S.top) / FH;
    const du = (Math.abs(u) - 0.42) / 0.255, dv = (v - S.eyeY) / (v < S.eyeY ? 0.042 : 0.062);
    const eye = du * du + dv * dv;
    const d = Math.hypot(x - R, (y - R - 2) * 1.5) / R;
    if (eye < 1) p.set(x, y, pick(ramp, 1.02 - d * 2.1, X, Y));
    else if (d < 0.95 && (1 - d) * 0.75 > bayer(X, Y)) p.set(x, y, '#5fd0cc', 70);                 // halo sur la pierre
  }
  // la lanterne : un petit toit, une flamme
  const lx = R, ly = R + 4;
  p.rect(lx - 3, ly - 6, 7, 1, '#eafff4').rect(lx - 2, ly - 5, 5, 4, '#ffffff').rect(lx - 3, ly - 1, 7, 1, '#a6eede').rect(lx - 1, ly - 7, 3, 1, '#a6eede');
  return { img: p.done(), x: e.x - R, y: e.y - R };
}

/** Peint la statue une fois pour toutes : { stone, jaw, hair, glow: [gauche, droite] }. */
export function paintStatue() {
  const stone = new L.Sheet(S.w, S.h);
  throat(stone);
  carve(stone, 0, 0, (x, y) => !inJaw(x, y));
  // les deux joints de la mâchoire : des fissures franches du coin des lèvres jusqu'au sol
  for (let y = S.h - S.jawH; y < S.h; y++) {
    if (ih(y, 2, 33) < 0.8) stone.set(S.cx - S.jawW / 2 - 1, y, STONE[1]);
    if (ih(y, 3, 33) < 0.8) stone.set(S.cx + S.jawW / 2, y, STONE[1]);
  }
  const jaw = new L.Sheet(S.jawW, S.jawH);
  carve(jaw, S.cx - S.jawW / 2, S.h - S.jawH, inJaw);
  for (let x = 0; x < S.jawW; x++) { jaw.set(x, 0, '#05080d'); }                  // l'ombre de la lèvre du haut
  const h = new L.Sheet(S.w, S.h);
  hair(h);
  return { stone: stone.done(), jaw: jaw.done(), hair: h.done(), glow: [eyeGlow(-1), eyeGlow(1)] };
}

/**
 * Dessine la statue, pieds posés en (x, ground). state : { eyes: [0..1, 0..1], jaw: 0..1 }
 * (jaw = part de la descente de la mâchoire : 1 = entièrement dans le sol).
 */
export function drawStatue(ctx, art, x, ground, state = {}) {
  const y = ground - S.h, eyes = state.eyes ?? [0, 0], drop = Math.round((state.jaw ?? 0) * S.jawH);
  ctx.drawImage(art.stone, x, y);
  art.glow.forEach((g, i) => {
    if (eyes[i] <= 0) return;
    ctx.globalAlpha = Math.min(1, eyes[i]);
    ctx.drawImage(g.img, x + g.x, y + g.y);
    ctx.globalAlpha = 1;
  });
  if (drop < S.jawH) ctx.drawImage(art.jaw, 0, 0, S.jawW, S.jawH - drop, x + S.cx - S.jawW / 2, ground - S.jawH + drop, S.jawW, S.jawH - drop);
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
