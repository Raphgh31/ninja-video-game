// La statue oubliée (zone 9) : une tête de femme monumentale, en pierre, la tête un
// peu penchée, le regard baissé, mélancolique ; coiffée et drapée de feuillage et de
// lianes en désordre (d'après le modèle de Raph). Le visage est sculpté comme un vrai
// relief (une hauteur par pixel), puis éclairé du haut à gauche avec ses ombres
// portées : arcades, paupières, nez, lèvres et cou ont du volume.
//
// Deux calques : la pierre, et le feuillage (devant). (Les yeux ne s'allument plus : un nouveau
// mécanisme, sur le haut de la tête, viendra plus tard.)
import { Pix, canvas, ih, noise1, noise2, fbm2, worley, pick, bayer } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

export const STATUE = {
  w: 208, h: 236,            // toile (le sol est en bas)
  cx: 104,                   // axe du cou
  top: 38, chin: 192,        // haut du crâne et bas du menton (tête droite)
  half: 62,                  // demi-largeur du visage
  tilt: 0.07,                // un peu inclinée vers la droite, comme une statue qui commence à s'affaisser
  pivot: { x: 104, y: 188 }, // elle penche autour du haut du cou
  neck: { top: 162, half0: 29, half1: 35 },
  eyeU: 0.36, eyeV: 0.55,    // les yeux, en coordonnées du visage (la tête penchée les fait descendre)
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

const gauss = (t) => Math.exp(-t * t);
const hat = (t) => Math.exp(-t * t * t * t);

/** Demi-largeur du visage (0 à 1) selon v : crâne arrondi, tempes, puis un ovale qui s'affine jusqu'au menton. */
function headHalf(v) {
  if (v < 0) return 0;
  if (v < 0.16) return 0.6 + 0.38 * Math.sqrt(v / 0.16);
  if (v < 0.46) return 0.98 + 0.02 * Math.sin(((v - 0.16) / 0.3) * Math.PI);
  const t = (v - 0.46) / 0.54;
  // un ovale qui s'affine tôt : mâchoire fine, menton étroit et arrondi
  return Math.max(0, 0.98 - 0.66 * Math.pow(t, 1.75) - (t > 0.84 ? Math.pow((t - 0.84) / 0.16, 2) * 0.32 : 0));
}

/**
 * La tête est penchée vers le sol : vue de face, le front grandit et les traits descendent, le bas du
 * visage se raccourcit. fv donne, pour une hauteur v du visage, la hauteur « des traits ».
 */
// penchée vers l'avant : le front plonge vers le sol ; vu de face, les traits descendent, le nez s'allonge
// vers le bas, la bouche se rapproche du nez et le menton rentre
const PITCH = 0.3;
const fv = (v) => v - 0.105 + Math.max(0, v - 0.55) * 0.45;
/** Un profil en arête (et non en cloche) : des volumes taillés, aux bords nets. */
const tri = (t) => Math.max(0, 1 - Math.abs(t));
const hat8 = (t) => Math.exp(-(t ** 8));


/** Relief du visage en (u, v), -1 hors de la pierre. */
function face(u, v) {
  const hw = headHalf(v);
  if (v < 0 || v > 1 || hw <= 0) return -1;
  const a = u / hw;
  if (Math.abs(a) >= 1) return -1;
  const au = Math.abs(u), V = fv(v);
  let z = Math.pow(1 - Math.pow(Math.abs(a), 2.6), 0.5) * 0.44 + 0.16 * Math.pow(1 - a * a * a * a, 0.5) + 0.14;
  z += PITCH * (0.5 - v);                                                          // penchée : le haut vient vers nous, le menton s'éloigne
  z -= Math.max(0, 0.2 - v) * 0.4;                                                // le front s'arrondit vers le crâne
  z -= Math.max(0, v - 0.88) * 0.5;                                               // le menton rentre
  // les arcades : lourdes, elles avancent au-dessus des yeux et y jettent leur ombre ;
  // les sourcils se relèvent un peu vers le milieu (la mélancolie)
  const vb = 0.37 + 0.045 * ((au - 0.37) / 0.27) ** 2 - (au < 0.37 ? (0.018 * (0.37 - au)) / 0.25 : 0);
  z += 0.12 * tri((V - vb) / 0.05) * tri((au - 0.38) / 0.36) * (1 - 0.35 * gauss(u / 0.08));
  // orbites profondes ; la paupière du haut, lourde, baissée ; la paupière du bas, à peine
  z -= 0.17 * gauss(Math.hypot((au - S.eyeU) / 0.22, (V - 0.44) / (V < 0.44 ? 0.07 : 0.05)));    // les orbites, sous l'arcade
  z += 0.06 * gauss(Math.hypot((au - S.eyeU) / 0.17, (V - 0.452) / 0.03));
  // le nez : une arête droite qui part du front, un bout arrondi, de petites narines
  const nt = (V - 0.39) / 0.235;
  if (nt > -0.15 && nt < 1.15) {
    const k = Math.max(0, Math.min(1, nt)), nw = 0.05 + 0.065 * k;
    z += (0.07 + 0.15 * Math.pow(k, 0.8)) * hat8(u / nw) * (nt > 1 ? tri((nt - 1) / 0.12) : 1);
  }
  z += 0.05 * gauss(Math.hypot(u / 0.07, (V - 0.62) / 0.025));
  z -= 0.04 * gauss(Math.hypot((au - 0.056) / 0.024, (V - 0.64) / 0.012));
  z -= 0.015 * gauss(u / 0.025) * gauss((V - 0.67) / 0.02);                     // le sillon sous le nez
  // la bouche : petite, close, les coins à peine tombants
  const vm = 0.712 + 0.015 * Math.min(1, (u / 0.15) ** 2);
  z += 0.045 * gauss((V - (vm - 0.018)) / 0.014) * hat(u / 0.16);
  z -= 0.06 * gauss((V - vm) / 0.0055) * hat(u / 0.15);
  z += 0.055 * gauss((V - (vm + 0.026)) / 0.019) * hat(u / 0.125);
  z -= 0.035 * gauss((V - (vm + 0.066)) / 0.017) * hat(u / 0.13);
  z += 0.045 * gauss(Math.hypot(u / 0.16, (V - 0.86) / 0.06));                   // le menton
  // pommettes, joues un peu creusées, tempes
  z += 0.08 * tri((V - 0.53) / 0.1) * tri((au - 0.56) / 0.26);
  z -= 0.05 * tri((V - 0.69) / 0.1) * tri((au - 0.62) / 0.2);
  z -= 0.04 * Math.max(0, au - 0.45) * tri((V - 0.84) / 0.14) * 4;                 // l'angle de la mâchoire
  z -= 0.03 * gauss((V - 0.33) / 0.06) * gauss((au - 0.86) / 0.1);
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

const KZ = 58;                                  // pixels de profondeur par unité de relief (un relief plus marqué)
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
    let lum = 0.04 + 0.92 * Math.pow(Math.max(0, (-zx * LIGHT[0] - zy * LIGHT[1] + LIGHT[2]) * inv), 1.25);
    // ombres portées : on remonte vers la lumière
    for (let k = 1; k <= 12; k++) {
      const sz = zAt(x + LIGHT[0] * k * 2.2, y + LIGHT[1] * k * 2.2);
      if (sz >= 0 && (sz - z) * KZ > k * 2.2 * 0.62 + 0.6) { lum *= 0.32; break; }
    }
    // l'ombre des creux (occlusion) : plus le point est en retrait de ses voisins, plus il est sombre
    let ao = 0;
    for (const [ax, ay] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3]]) { const nz = zAt(x + ax, y + ay); if (nz >= 0) ao += Math.max(0, nz - z); }
    const eyeZone = Math.hypot((Math.abs(h.u) - S.eyeU) / 0.24, (fv(h.v) - 0.455) / 0.07) < 1;
    lum -= Math.min(eyeZone ? 0.06 : 0.3, ao * 0.9);                               // (autour des yeux : pas d'ombre noire)
    // la pierre : grands pans, grain léger, fissures
    const w = worley(x, y, 23, 5, 1.15);
    lum += (w.id - 0.5) * (onFace ? 0.035 : 0.07) + (fbm2(x * 0.09, y * 0.09, 3, 7) - 0.5) * 0.12;
    const fy = (y - S.top) / (S.h - S.top);
    lum *= 1.08 - 0.42 * Math.pow(Math.max(0, fy), 1.5);                          // le bas se perd dans l'ombre
    lum -= 0.02;
    if (onFace) lum += 0.07 * gauss(Math.hypot((h.u + 0.15) * 0.9, (h.v - 0.4) * 1.4) / 0.6);   // le jour tombe sur le haut du visage, côté gauche
    if (onFace) {
      // les yeux : une seule grande zone d'ombre sous l'arcade, sans aucun trait ; plus sombre en haut
      // (sous le sourcil), elle s'éclaircit vers le bas : un regard baissé vers le sol
      const V = fv(h.v), du = (Math.abs(h.u) - S.eyeU) / 0.22, dv = (V - 0.445) / (V < 0.445 ? 0.055 : 0.07);
      const e = Math.hypot(du, dv);
      if (e < 1) lum *= 0.26 + 0.74 * Math.pow(e, 1.8) + (dv > 0 ? 0.1 * dv : 0);
    }
    lum = Math.round(lum * 9) / 9;                                                // des aplats : les ombres tombent net
    let c = pick(STONE, lum, x, y, 0.06);
    if (w.d2 - w.d < 0.5 && ih(Math.round(w.id * 97), 0, 4) < 0.2) c = STONE[Math.max(0, Math.floor(lum * 6) - 1)];   // fissure
    // mousse sur ce qui regarde le ciel, et dans les creux humides (jamais sur les yeux)
    const up = -zy * inv;
    const nearEye = onFace && Math.hypot((Math.abs(h.u) - S.eyeU) / 0.24, (fv(h.v) - 0.455) / 0.06) < 1.2;
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
  const edge = (u) => 0.33 + (noise1(u * 6 + 3, 27) - 0.5) * 0.1 + 0.04 * u * u + Math.max(0, Math.sin(u * 11 + 2)) * 0.06;   // des mèches qui descendent sur le front
  const top = (u) => -0.03 - 0.025 * (1 - u * u) + (noise1(u * 5, 28) - 0.5) * 0.06 - Math.max(0, Math.sin(u * 7.3 + 1.1)) * 0.045;   // un feuillage mince, des touffes qui dépassent
  // la couronne : des grappes de feuillage inégales posées sur le crâne, avec des trous entre elles
  const tufts = [];
  for (let i = 0; i < 8; i++) {
    const u = -1.05 + i * 0.3 + (ih(i, 1, 81) - 0.5) * 0.14;
    const v = (Math.abs(u) > 0.8 ? 0.22 : 0.1) + (ih(i, 2, 81) - 0.3) * 0.12;
    tufts.push({ u, v, ru: 0.17 + ih(i, 3, 81) * 0.13, rv: 0.1 + ih(i, 4, 81) * 0.09 + (Math.abs(u) > 0.8 ? 0.06 : 0) });
  }
  // et quelques-unes qui retombent sur le front
  for (const [u, v, ru, rv] of [[-0.42, 0.24, 0.2, 0.08], [0.08, 0.27, 0.16, 0.07], [0.5, 0.25, 0.18, 0.08]]) tufts.push({ u, v, ru, rv });
  const crown = (x, y) => {
    const { u, v } = toHead(x, y);
    let best = -1;
    for (const t of tufts) best = Math.max(best, 1 - Math.hypot((u - t.u) / t.ru, (v - t.v) / t.rv));
    if (best < -0.12) return 0;                                                       // (pas de feuilles qui flottent à l'écart)
    const ragged = (noise2(x * 0.22, y * 0.22, 35) - 0.5) * 0.7 + (v > edge(u) ? -0.6 : 0);
    return (best + ragged) * 3;
  };
  const light = (x, y) => { const { u, v } = toHead(x, y); return 0.95 - (v + 0.12) * 1.8 - Math.max(0, u) * 0.18; };
  // les touffes des côtés, inégales : la droite descend plus bas (la tête penche de ce côté)
  const clumps = [];
  for (const side of [-1, 1]) {
    const n = side < 0 ? 5 : 7;
    for (let k = 0; k < n; k++) {
      if (ih(k, side, 50) < 0.25) continue;                                        // des vides entre les touffes
      // elles descendent le long des tempes et des joues, sans jamais venir sous le menton
      const v = 0.16 + k * (side < 0 ? 0.075 : 0.07) + (ih(k, side, 51) - 0.5) * 0.05;
      const u = side * (Math.max(headHalf(Math.min(0.99, v)), 0.92) + 0.06 + ih(k, side, 52) * 0.12);
      const p = fromHead(u, v), r = 5 + ih(k, side, 53) * 8 - k * 0.3;
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
  for (let i = 0; i < 44; i++) {
    if (ih(i, 6, 71) < 0.18) continue;                                             // des brins manquent : des trous dans le rideau
    const u = -1.3 + (i / 43) * 2.6 + (ih(i, 1, 71) - 0.5) * 0.08;
    const v = Math.abs(u) > 1 ? 0.2 + ih(i, 2, 71) * 0.5 : edge(u) - 0.03;
    const p = fromHead(u, v);
    const side = Math.abs(u) > 0.95;
    let len = side ? 24 + ih(i, 3, 71) * (S.h - p.y - 24) : 8 + Math.pow(ih(i, 3, 71), 1.5) * 130;
    for (const e of eyes) if (Math.abs(p.x - e.x) < 15 && p.y < e.y && p.y + len > e.y - 9) len = Math.max(4, e.y - 10 - p.y);
    // le nez et la bouche restent dégagés : les brins du milieu s'arrêtent sur le front
    if (!side && Math.abs(u) < 0.2) len = Math.min(len, 12 + ih(i, 5, 71) * 8);
    list.push({ x: Math.round(p.x), y: Math.round(p.y), len: Math.round(Math.min(len, S.h - 2 - p.y)), front: ih(i, 4, 71), i });
  }
  list.sort((a, b) => a.front - b.front);
  for (const st of list) L.strand(pix, st.x, st.y, st.len, st.front < 0.4 ? shade(2) : ramp, st.i * 7 + 3, Math.max(0.25, st.front), 0, st.len > 60 ? 2 : 1);
  // la couronne : un dôme de grandes feuilles, éclairé par le dessus
  L.leafMass(pix, [0, 0, S.w - 1, S.top + 60], crown, light, ramp, 31, { density: 0.66, size: 2, wide: 2, step: 4 });
  // des fougères plantées dans la couronne
  for (const [u, sz] of [[-0.75, 11], [-0.4, 14], [0.05, 16], [0.5, 13]]) {
    const p = fromHead(u, top(u) + 0.06);
    L.fern(pix, Math.round(p.x), Math.round(p.y), sz, C.FERN, 40 + Math.round(u * 20));
  }
  // au pied : des fougères et des buissons cachent la naissance des épaules
  for (const [dx, rw, rh] of [[-58, 14, 9], [-30, 11, 7], [44, 13, 8], [70, 12, 9], [16, 8, 5]]) L.bush(pix, S.cx + dx, S.h - 1, rw, rh, shade(1), 120 + dx);
  for (const [dx, sz] of [[-66, 15], [-40, 12], [58, 14], [30, 10], [-18, 7], [6, 6], [-50, 8], [80, 8], [44, 7]]) L.fern(pix, S.cx + dx, S.h - 1, sz, C.FERN, 130 + dx);
  // sur le cou : un peu de lierre et de mousse qui grimpent
  for (const [dx, dy, rw, rh] of [[-24, -40, 6, 4], [-18, -22, 4, 3], [20, -30, 5, 3], [26, -14, 6, 4], [-8, -56, 3, 2]]) L.bush(pix, S.cx + dx, S.h + dy, rw, rh, ramp.slice(1), 170 + dx);
  for (const [dx, dy, len] of [[-22, -44, 14], [22, -34, 10], [-6, -60, 8]]) L.strand(pix, S.cx + dx, S.h + dy, len, ramp, 180 + dx, 0.6, 0, 1);
  // de la mousse et quelques feuilles sur le visage : l'arête du nez, la joue droite, le bas de la joue gauche
  for (const [u, v, rw, rh] of [[0.02, 0.4, 4, 3], [0.66, 0.74, 6, 3], [-0.78, 0.6, 5, 3]]) {
    const p = fromHead(u, v);
    L.bush(pix, Math.round(p.x), Math.round(p.y), rw, rh, ramp.slice(1), 90 + Math.round(u * 50));
  }
}

/** Peint la statue une fois pour toutes : { stone, hair }. */
/** Des fissures sur le cou : la pierre a commencé à céder (des zigzags sombres, un bord clair). */
function cracks(pix) {
  const onNeck = (x, y) => neck(x, y) >= 0 && face(toHead(x, y).u, toHead(x, y).v) < neck(x, y);
  for (const [x0, y0, len, dir, seed] of [[96, 176, 46, 0.35, 1], [114, 182, 28, -0.4, 2], [88, 206, 22, 0.6, 3], [118, 212, 18, -0.2, 4]]) {
    let x = x0, y = y0;
    for (let k = 0; k < len; k++) {
      y += 1; x += (ih(k, seed, 191) < 0.5 ? -1 : 1) * (ih(k, seed, 192) < 0.4 ? 1 : 0) + (ih(k, seed, 193) < Math.abs(dir) ? Math.sign(dir) : 0);
      if (!onNeck(x, y)) continue;
      pix.set(x, y, STONE[0]);
      if (onNeck(x + 1, y)) pix.set(x + 1, y, STONE[3]);                            // le bord éclairé de la fente
      if (k % 9 === 4 && onNeck(x - 2, y + 1)) { pix.set(x - 1, y + 1, STONE[0]); pix.set(x - 2, y + 2, STONE[0]); }   // une fente secondaire
    }
  }
}

export function paintStatue() {
  const stone = new L.Sheet(S.w, S.h);
  carve(stone);
  cracks(stone);
  const h = new L.Sheet(S.w, S.h);
  hair(h);
  return { stone: stone.done(), hair: h.done() };
}

/** Dessine la statue, posée en (x, ground). */
export function drawStatue(ctx, art, x, ground, state = {}) {
  const y = ground - S.h;
  ctx.drawImage(art.stone, x, y);
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
