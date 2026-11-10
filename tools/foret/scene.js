// Vue d'ambiance de la Forêt : compose les cinq plans avec les vrais pinceaux
// du décor (src/game/foret/layers.js), pour les planches de design.
import { Pix, canvas, ih, noise1 } from '/src/game/potager/paint.js';
import * as C from '/src/game/foret/palette.js';
import * as L from '/src/game/foret/layers.js';

const GROUND_AT = 0.86;

/** Les plans d'une vue, du plus loin au plus proche : [{ id, name, img }]. */
export function planes(mood, W = 448, H = 252, kage = null) {
  const gy = Math.round(H * GROUND_AT);
  const out = [];
  const layer = (id, name, paint, strip = true) => {
    const p = strip ? new L.Strip(W, H) : new L.Sheet(W, H);
    paint(p);
    out.push({ id, name, img: p.done() });
  };
  // --- plan 0 : ciel, montagnes, cimes --------------------------------------
  layer('p0', 'Plan 0 — ciel, reliefs et cimes lointaines', (p) => {
    L.paintSky(p, mood);
    L.paintRidges(p, gy - 74, mood, 3);
    L.firRow(p, gy - 50, 24, 22, 50, 0.2, mood.firs[0], 11, 5);
  }, false);
  // --- plan 1 : brume et lumière (entre les rangs d'arbres) -----------------
  const mistA = new L.Strip(W, H);
  L.paintMist(mistA, mood.haze, 41, (t) => Math.max(0, 1 - Math.abs(t - 0.66) / 0.2), 1.25);
  const mistB = new L.Strip(W, H);
  L.paintMist(mistB, mood.haze, 47, (t) => Math.max(0, 1 - Math.abs(t - 0.8) / 0.16), 1.2);
  const rays = new L.Sheet(W, H);
  L.paintRays(rays, [{ x: W * 0.05, w: 22, len: H * 0.95 }, { x: W * 0.2, w: 12, len: H * 0.8 }, { x: W * 0.38, w: 30, len: H * 1.0 }, { x: W * 0.6, w: 16, len: H * 0.85 }, { x: W * 0.72, w: 9, len: H * 0.7 }], mood.ray, mood.rayA);
  // --- plan 2 : la forêt en profondeur ---------------------------------------
  layer('p2a', 'Plan 2 — troncs dans la brume', (p) => {
    L.stems(p, gy - 30, 15, 2, 5, mood.stems[0], 13);
    L.firRow(p, gy - 28, 12, 46, 92, 0.19, mood.firs[1], 17, 6);
  });
  out.push({ id: 'p1a', name: 'Plan 1 — nappes de brume', img: mistA.done() });
  layer('p2b', 'Plan 2 — conifères et fûts', (p) => {
    L.stems(p, gy - 12, 8, 4, 10, mood.stems[1], 19);
    L.firRow(p, gy - 8, 6, 84, 150, 0.17, mood.firs[2], 23, 5);
  });
  out.push({ id: 'p1b', name: 'Plan 1 — brume basse', img: mistB.done() });
  layer('p2c', 'Plan 2 — arbres géants, lianes', (p) => {
    const bark = L.hazeRamp(C.BARK, mood.depth, mood.tint), moss = L.hazeRamp(C.MOSS, mood.depth, mood.tint);
    const leaf = L.hazeRamp(C.LEAF, mood.depth, mood.tint * 0.8);
    L.paintCanopy(p, 46, leaf, 29);
    for (const [fx, w, s] of [[0.13, 34, 3], [0.52, 26, 5], [0.86, 42, 8]]) L.bigTrunk(p, Math.round(W * fx), w, gy + 3, s, bark, moss);
    for (let i = 0; i < 9; i++) {
      const x = Math.round((i + 0.2 + ih(i, 3, 3) * 0.6) * W / 9);
      L.bush(p, x, gy + 2, 14 + Math.floor(ih(i, 4, 3) * 16), 9 + Math.floor(ih(i, 5, 3) * 9), leaf, 31 + i);
    }
  });
  out.push({ id: 'p1c', name: 'Plan 1 — rais de lumière', img: rays.done() });
  // --- plan 3 : le monde jouable ---------------------------------------------
  layer('p3', 'Plan 3 — le jeu', (p) => {
    // une marche de terre, aux flancs ondulés (jamais de coupe droite)
    const x0 = Math.round(W * 0.3), x1 = x0 + 64;
    const surf = (x, y = gy - 8) => (x > x0 + (noise1(y * 0.3, 3) - 0.5) * 3 && x < x1 + (noise1(y * 0.3, 4) - 0.5) * 3 ? gy - 16 : gy);
    for (let x = 0; x < W; x++) for (let y = gy - 16; y < H; y++) {
      const top = surf(x, y);
      if (y >= top) p.set(x, y, L.groundColor(x + 200, y, y - top));
    }
    L.bigTrunk(p, Math.round(W * 0.7), 30, gy + 2, 12);                              // tronc jouable : un mur pour le saut mural
    L.rock(p, Math.round(W * 0.49), gy + 3, 20, 16, 5);
    L.stump(p, Math.round(W * 0.22), gy + 1, 18, 13, 7);
    for (let i = 0; i < 16; i++) {
      const x = Math.round((i + ih(i, 1, 9)) * W / 16), y = surf(x);
      if (ih(i, 2, 9) < 0.6) L.fern(p, x, y, 8 + Math.floor(ih(i, 3, 9) * 8), C.FERN, 50 + i);
      else L.grassTuft(p, x, y - 1, 4 + Math.floor(ih(i, 4, 9) * 4), C.FERN, 60 + i);
    }
    L.mushroom(p, Math.round(W * 0.56), gy, 3);
    L.mushroom(p, Math.round(W * 0.575), gy, 2);
  }, false);
  if (kage) {
    const c = canvas(W, H), g = c.getContext('2d');
    g.drawImage(kage, 0, 0, 57, 36, Math.round(W * 0.38) - 19, gy - 16 - 35, 57, 36);
    out.push({ id: 'kage', name: 'KAGE', img: c });
  }
  // --- plan 4 : premier plan ---------------------------------------------------
  layer('p4', 'Plan 4 — premier plan', (p) => {
    const F = mood.fore, ramp = [F[0], F[0], F[1], F[1], F[2], F[3]];
    // feuillage aux deux coins du haut, grandes frondes aux coins du bas
    L.paintCanopy(p, 40, [F[0], F[0], F[1], F[1], F[2], F[2], F[3]], 71, false, (x) => Math.max(0, 1 - Math.min(x, W - x) / (W * 0.24)));
    for (const [fx, len, ang, bend] of [[-0.02, 96, -1.3, 1.0], [0.0, 74, -0.95, 1.2], [0.05, 58, -1.7, -0.6], [0.1, 40, -1.1, 1.3], [1.02, 104, -1.85, -1.0], [0.99, 78, -2.25, -1.1], [0.94, 54, -1.5, 0.7], [0.62, 40, -1.2, 1.2], [0.6, 36, -2.0, -1.2]]) {
      L.frond(p, Math.round(W * fx), H + 6, len, ang, bend, F, len);
    }
    for (let x = 0; x < W; x += 3) if (ih(x, 7, 7) < 0.4) L.grassTuft(p, x, H, 4 + Math.floor(ih(x, 8, 7) * 8), ramp, x);
    L.soften(p, F[0]);
  });
  return out;
}

/** La vue complète. */
export function mock(mood, W = 448, H = 252, kage = null) {
  const c = canvas(W, H), g = c.getContext('2d');
  for (const pl of planes(mood, W, H, kage)) g.drawImage(pl.img, 0, 0);
  return c;
}
