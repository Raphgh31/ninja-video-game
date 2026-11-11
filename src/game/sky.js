// Ciel commun aux chapitres : nuages fins et élégants, cirrus, soleil et étoiles.
// Tout est peint pixel par pixel une fois (sprites), puis recopié à chaque image.
//
//   - cloudSprite : un nuage étiré à l'horizontale ; dessus en dômes doux, éclairé
//     par le haut à gauche, ventre plat et ombré, bords tramés, des filaments qui
//     s'effilochent aux deux bouts (jamais de « boule de coton ») ;
//   - cirrusSprite : de longues mèches très fines, tout en haut du ciel ;
//   - sunSprite : un disque, son halo en anneaux tramés (se lève, se couche) ;
//   - stars : quelques étoiles pour le crépuscule.
// Les rampes de couleur viennent de l'appelant (une par heure du jour).
import { Pix, rng, pick, bayer, mixHex } from './potager/paint.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Nuage fin : ramp = [ombre, ventre, corps, lumière, liseré] (5 teintes).
 * w × h : taille du corps (h petit : des nuages étirés).
 */
export function cloudSprite(seed, w, h, ramp) {
  const r = rng(seed);
  const pad = 14, W = Math.round(w + pad * 2), H = Math.round(h + 6);
  const pix = new Pix(W, H);
  const base = h + 2;                                         // le ventre, presque plat
  const domes = [];
  const nd = 2 + Math.floor(r() * 3);
  for (let i = 0; i < nd; i++) domes.push({ c: 0.18 + r() * 0.64, s: 0.08 + r() * 0.14, a: 0.55 + r() * 0.45 });
  const topAt = (t) => {
    if (t <= 0 || t >= 1) return base;
    const env = Math.pow(Math.sin(Math.PI * t), 0.8);
    let bump = 0.32;
    for (const d of domes) bump = Math.max(bump, d.a * Math.exp(-(((t - d.c) / d.s) ** 2)));
    return base - h * env * (0.35 + 0.65 * bump) - (r() < 0 ? 0 : 0);
  };
  const tops = [], bots = [];
  for (let x = 0; x < W; x++) {
    const t = (x - pad) / w;
    tops[x] = topAt(t) + Math.sin(x * 0.9 + seed) * 0.35;
    const taper = clamp01(Math.min(t, 1 - t) / 0.12);
    bots[x] = base - (1 - taper) * h * 0.35 + (Math.sin(x * 0.21 + seed) > 0.6 ? 1 : 0);
  }
  for (let x = 0; x < W; x++) {
    const t = (x - pad) / w, top = tops[x], bot = bots[x];
    if (bot - top < 0.6) continue;
    for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
      if (y < top - 0.2 || y > bot) continue;
      const d = (y - top) / Math.max(1, bot - top);           // 0 en haut, 1 au ventre
      let v = 0.92 - d * 0.62 - t * 0.12;                      // lumière d'en haut à gauche
      // un pli d'ombre sous chaque dôme
      const slope = tops[x + 1] - tops[x - 1 < 0 ? 0 : x - 1];
      if (slope > 0.4) v -= 0.1;
      // le bout des ailes s'efface dans le ciel (tramé)
      const edge = Math.min(t, 1 - t);
      const a = edge < 0.06 ? edge / 0.06 : 1;
      if (a < 1 && bayer(x, y) > a) continue;
      if (d > 0.82 && bayer(x, y) < 0.35) v -= 0.08;           // le ventre, tramé
      pix.set(x, y, y - top < 1 && t < 0.85 ? ramp[4] : pick(ramp, clamp01(v), x, y, 0.4));
    }
  }
  // du volume : sous chaque dôme, une bouffée plus claire éclairée par le haut à gauche
  for (const d of domes) {
    const cx = pad + d.c * w - w * d.s * 0.3, cy = topAt(d.c) + h * 0.35, rx = w * d.s * 0.7, ry = h * 0.32;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e > 1 || !pix.alpha(x, y) || y < tops[x] + 1) continue;
      if (bayer(x, y) < (1 - e) * 0.9) pix.set(x, y, e < 0.35 ? ramp[4] : ramp[3]);
    }
  }
  // filaments : de fines traînées qui prolongent le ventre aux deux bouts
  for (const side of [-1, 1]) {
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const y = Math.round(base - 1 - k * 2 - r() * 2), len = Math.round(w * (0.12 + r() * 0.18));
      const x0 = side < 0 ? pad + w * 0.1 : pad + w * 0.9;
      for (let s = 0; s < len; s++) {
        const x = Math.round(x0 + side * s), fade = 1 - s / len;
        if (bayer(x, y) > fade * 0.9) continue;
        pix.set(x, y, ramp[k ? 2 : 3], 200);
      }
    }
  }
  return pix.done();
}

/** Cirrus : quelques longues mèches de 1 px, légèrement courbes, qui s'effilent. */
export function cirrusSprite(seed, w, h, color) {
  const r = rng(seed), pix = new Pix(w, h);
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const y0 = 2 + r() * (h - 4), x0 = r() * w * 0.3, len = w * (0.45 + r() * 0.5), bend = (r() - 0.5) * 6;
    for (let s = 0; s < len; s++) {
      const t = s / len, x = Math.round(x0 + s), y = Math.round(y0 + Math.sin(t * Math.PI) * bend - t * 2);
      const a = Math.sin(Math.PI * t);
      if (bayer(x, y) > a * 0.95) continue;
      pix.set(x, y, color, 150 + Math.round(a * 90));
      if (t > 0.3 && t < 0.7 && r() < 0.25) pix.set(x, y + 1, color, 90);
    }
  }
  return pix.done();
}

/** Soleil : disque (core) et halo tramé en anneaux (glow), rayon R du halo. */
export function sunSprite(core, glow, rDisc, R) {
  const S = R * 2 + 2, pix = new Pix(S, S), c = R + 1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - c + 0.5, y - c + 0.5);
    if (d <= rDisc) { pix.set(x, y, d > rDisc - 1.2 ? glow[2] : core); continue; }
    const t = (d - rDisc) / (R - rDisc);
    if (t >= 1) continue;
    const a = Math.pow(1 - t, 1.6);
    const ring = a > 0.66 ? 2 : a > 0.38 ? 1 : 0;              // trois anneaux, passages tramés
    if (bayer(x, y) > a * 1.15) continue;
    pix.set(x, y, glow[ring], Math.round(70 + a * 150));
  }
  return pix.done();
}

/** Ciel en dégradé à paliers tramés : stops = [[t, couleur]…], hauteur h (4 px de large, à étirer). */
export function skyGradient(stops, h) {
  const pix = new Pix(4, h);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const k = clamp01((t - t0) / (t1 - t0));
    for (let x = 0; x < 4; x++) {
      const q = Math.floor(k * 6 + bayer(x, y) - 0.5) / 6;
      pix.set(x, y, mixHex(c0, c1, clamp01(q)));
    }
  }
  return pix.done();
}

/** Positions d'étoiles (déterministes) dans une bande w × h. */
export function stars(seed, w, h, n) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) out.push({ x: r() * w, y: r() * h, b: r(), p: r() * 6.28 });
  return out;
}
