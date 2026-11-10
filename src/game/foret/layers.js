// Pinceaux de la Forêt : chaque élément du décor (conifère, tronc, feuillage,
// fougère, rocher, sol moussu, brume, rai de lumière) est une petite fonction
// qui peint dans un tampon de pixels. Les plans du fond (backdrop.js), les
// tuiles et les décors s'en servent tous : une seule écriture, une seule lumière
// (du haut à gauche).
import { Pix, ih, noise1, noise2, fbm1, fbm2, worley, pick, bayer, hazeRamp, mixHex } from '../potager/paint.js';
import * as C from './palette.js';

/** Tampon de pixels qui accepte des coordonnées décimales (arrondies au pixel). */
export class Sheet extends Pix {
  set(x, y, col, a = 255) { super.set(Math.round(x), Math.round(y), col, a); }
}

/** Tampon qui se referme sur lui-même en largeur : une bande qui se répète sans couture. */
export class Strip extends Pix {
  set(x, y, col, a = 255) {
    x = ((Math.round(x) % this.w) + this.w) % this.w;
    super.set(x, Math.round(y), col, a);
  }
}

/** Relief fractal périodique (période W) : pour les crêtes des bandes qui se répètent. */
export function pf(x, W, scale, oct, seed) {
  const xx = ((x % W) + W) % W, t = xx / W;
  return fbm1(xx * scale, oct, seed) * (1 - t) + fbm1((xx - W) * scale, oct, seed) * t;
}
const pf2 = (x, y, W, sx, sy, oct, seed) => {
  const xx = ((x % W) + W) % W, t = xx / W;
  return fbm2(xx * sx, y * sy, oct, seed) * (1 - t) + fbm2((xx - W) * sx, y * sy, oct, seed) * t;
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------------------
// plan 0 : ciel, montagnes et cimes lointaines
// ---------------------------------------------------------------------------
export function paintSky(pix, mood) {
  const { w, h } = pix, g = mood.glow;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = (y / h) * 0.95;
    if (g) v += Math.max(0, 1 - Math.hypot(x / w - g.x, (y / h - g.y) * 0.8) / g.r) * g.k;
    pix.set(x, y, pick(mood.sky, v, x, y, 0.8));
  }
}

/** Deux crêtes dans la brume, hérissées de cimes de conifères. */
export function paintRidges(pix, base, mood, seed = 1) {
  const W = pix.w;
  for (let k = 0; k < 2; k++) {
    const amp = [44, 30][k], yb = base - [16, 0][k], col = mood.ridge[k];
    for (let x = 0; x < W; x++) {
      const s = 5 + k * 2, cell = Math.floor(x / s), loc = (x % s) / s;
      const cime = (1 - Math.abs(loc * 2 - 1)) * (2 + 4 * ih(cell, k, seed));
      const top = Math.round(yb - amp * pf(x, W, 0.007, 4, seed + k * 9) - cime);
      for (let y = top; y < pix.h; y++) {
        const t = (y - top) / 46;
        pix.set(x, y, t * 0.9 > bayer(x, y) ? mood.haze : col);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// conifères
// ---------------------------------------------------------------------------
/** Un conifère en étages : cols = [ombre, teinte, lumière]. */
export function fir(pix, cx, base, h, hw, cols, seed) {
  const [dark, mid, light] = cols;
  const tierH = Math.max(4, Math.round(h / (6 + ih(seed, 1, 3) * 3)));
  const trunkH = Math.max(2, Math.round(h * 0.07));
  const fh = h - trunkH, top = base - h, small = Math.min(1, hw / 7);
  for (let j = 0; j < fh; j++) {
    const t = j / fh, k = Math.floor(j / tierH), tier = (j % tierH) / tierH;
    const sway = Math.round((ih(k, seed, 5) - 0.5) * 2.4 * small);
    const half = (0.05 + 0.95 * Math.pow(t, 0.9)) * hw * (0.46 + 0.54 * tier) + (ih(j, seed, 7) - 0.5) * 1.8 * small;
    if (half < 0.3) { pix.set(cx, top + j, mid); continue; }
    const x0 = Math.round(cx + sway - half), x1 = Math.round(cx + sway + half);
    for (let x = x0; x <= x1; x++) {
      const u = (x - cx - sway) / half;
      let c = mid;
      if (tier < 0.24 && k > 0 && Math.abs(u) < 0.8) c = dark;                       // l'ombre sous l'étage du dessus
      else if (u > 0.42 || (u > 0.2 && bayer(x, top + j) < (u - 0.2) * 4)) c = dark;  // le flanc droit, dans l'ombre
      else if (u < -0.2 && tier > 0.34 && bayer(x, top + j) < 0.75) c = light;        // le flanc gauche, éclairé
      pix.set(x, top + j, c);
    }
  }
  const tw = Math.max(1, Math.round(hw / 5));
  for (let j = fh; j < h; j++) for (let i = 0; i < tw; i++) pix.set(cx - (tw >> 1) + i, top + j, dark);
}

/** Un rang de conifères le long d'une bande (hauteurs h0..h1, base ondulée). */
export function firRow(pix, base, n, h0, h1, ratio, cols, seed, wave = 6) {
  const W = pix.w;
  const list = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i + 0.15 + ih(i, seed, 1) * 0.7) * W) / n);
    const h = Math.round(h0 + Math.pow(ih(i, seed, 2), 1.4) * (h1 - h0));
    list.push({ x, h, hw: h * ratio * (0.8 + ih(i, seed, 3) * 0.45), y: Math.round(base + (pf(x, W, 0.02, 2, seed) - 0.5) * wave) });
  }
  list.sort((a, b) => a.y - b.y || a.h - b.h);
  list.forEach((f, i) => fir(pix, f.x, f.y, f.h, f.hw, cols, seed * 31 + i));
  // le pied du rang : un sous-bois sombre, pour qu'aucun tronc ne flotte
  for (let x = 0; x < W; x++) {
    const top = Math.round(base - 3 - pf(x, W, 0.09, 3, seed + 5) * 9);
    for (let y = top; y < pix.h; y++) pix.set(x, y, y - top < 2 && ih(x, y, seed) < 0.5 ? cols[1] : cols[0]);
  }
}

// ---------------------------------------------------------------------------
// troncs droits dans la brume (plans lointains)
// ---------------------------------------------------------------------------
/** cols = [teinte, arête sombre, arête claire]. Les 8 premières lignes sont de purs fûts (on peut les étirer vers le haut). */
export function stems(pix, yBase, n, w0, w1, cols, seed) {
  const W = pix.w, [col, edge, lit] = cols;
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i + 0.1 + ih(i, seed, 1) * 0.8) * W) / n);
    const w = Math.round(w0 + Math.pow(ih(i, seed, 2), 1.6) * (w1 - w0));
    for (let y = 0; y < yBase; y++) {
      const f = y > yBase - 12 ? Math.round(Math.pow((y - (yBase - 12)) / 12, 2) * (1 + w / 4)) : 0;
      for (let dx = -f; dx < w + f; dx++) {
        let c = col;
        if (dx <= 0 && w > 2) c = lit;
        else if (dx >= w - 1 - (w > 6 ? 1 : 0)) c = edge;
        else if (w > 5 && ih(dx + i * 7, y >> 2, seed) < 0.07) c = edge;
        pix.set(x + dx, y, c);
      }
    }
    // chicots et branches mortes
    for (let y = 16 + Math.floor(ih(i, seed, 4) * 30); y < yBase - 20; y += 26 + Math.floor(ih(i, y, seed) * 34)) {
      const side = ih(i, y, seed + 1) < 0.5 ? -1 : 1, len = 3 + Math.floor(ih(i, y, seed + 2) * (3 + w));
      for (let s = 0; s < len; s++) pix.set(x + (side < 0 ? -1 - s : w + s), y - Math.round(s * 0.6), edge);
    }
  }
}

// ---------------------------------------------------------------------------
// feuillages : amas de petites touffes éclairées par le haut à gauche
// ---------------------------------------------------------------------------
/** Une feuille pointue : dessus clair, dessous sombre. */
export function leaf(pix, x, y, ang, len, dark, light, wide = 1) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = 0; i < len; i++) {
    const hw = wide ? Math.round(Math.sin((Math.PI * (i + 0.6)) / (len + 0.4)) * wide) : 0;
    if (!wide && i > 0 && i < len - 1) pix.set(x + c * i - s, y + s * i + c, dark);
    for (let k = -hw; k <= hw; k++) {
      // le côté tourné vers la lumière (haut, gauche) est clair, l'autre sombre
      const lit = (-s * k) * -0.6 + (c * k) * -0.8;
      pix.set(x + c * i - s * k, y + s * i + c * k, k === 0 ? light : lit > 0 ? light : dark);
    }
  }
}

/**
 * Masse de feuilles : un fond sombre, puis trois passes de feuilles de plus en
 * plus claires (les plus éclairées par-dessus). inside(x, y) > 0 dans la masse ;
 * light(x, y) : lumière reçue, de 0 à 1. box : [x0, y0, x1, y1].
 */
export function leafMass(pix, box, inside, light, ramp, seed, o = {}) {
  const [x0, y0, x1, y1] = box, n = ramp.length, step = o.step ?? 3, size = o.size ?? 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (inside(x, y) > 0.12) pix.set(x, y, ramp[noise2(x * 0.3, y * 0.3, seed) > 0.62 ? 1 : 0]);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let gy = y0; gy <= y1; gy += step) for (let gx = x0; gx <= x1; gx += step) {
      const x = gx + Math.floor(ih(gx, gy, seed + pass) * step), y = gy + Math.floor(ih(gx, gy, seed + pass + 9) * step);
      if (inside(x, y) <= 0) continue;
      const lum = light(x, y) + (ih(gx, gy, seed + pass + 3) - 0.5) * 0.34;
      if (lum < [-1, 0.36, 0.6][pass] || ih(gx, gy, seed + pass + 5) > (o.density ?? 0.8)) continue;
      const idx = Math.max(1, Math.min(n - 1, Math.round(lum * (n - 1))));
      const ang = Math.PI / 2 + (ih(gx, gy, seed + pass + 7) - 0.5) * 2.1;
      leaf(pix, x, y, ang, Math.round((3 + ih(gx, gy, seed + 11) * 3) * size), ramp[Math.max(0, idx - 2)], ramp[idx], o.wide ?? 1);
    }
  }
}

/** Buisson (ou houppier) : une masse arrondie de feuilles, éclairée par le haut à gauche. */
export function bush(pix, cx, base, rw, rh, ramp, seed) {
  const lump = (x, y) => {
    const nx = (x - cx) / rw, ny = (y - base) / rh;
    return y > base ? 0 : 1 - (nx * nx + ny * ny) - (noise1(x * 0.4 + seed, seed) - 0.5) * 0.5;
  };
  leafMass(pix, [cx - rw - 3, base - rh - 4, cx + rw + 3, base], lump,
    (x, y) => 0.45 + (-(y - base) / rh - 0.45) * 0.6 - ((x - cx) / rw) * 0.2, ramp, seed);
}

/** Voûte de feuillage accrochée au haut de l'image : sombre dedans, translucide au liseré, lianes qui pendent. */
export function paintCanopy(pix, depth, ramp, seed, rim = true, env = () => 1) {
  const W = pix.w;
  const lim = (x) => depth * env(((x % W) + W) % W) * Math.max(0, pf(x, W, 0.02, 3, seed) * 1.7 - 0.35) + (noise1(x * 0.5, seed + 2) - 0.5) * 5;
  leafMass(pix, [0, 0, W - 1, depth + 8], (x, y) => (lim(x) - y) / 6,
    (x, y) => 0.18 + (rim ? Math.max(0, 1 - (lim(x) - y) / 11) * 0.62 : Math.max(0, 1 - (lim(x) - y) / 9) * 0.3), ramp, seed);
  // lianes : elles partent toutes du feuillage
  const n = Math.round(W / 46);
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i + ih(i, seed, 11)) * W) / n), d = lim(x);
    if (d < 8) continue;
    strand(pix, x, Math.round(d) - 5, 16 + Math.floor(ih(i, seed, 12) * 46), ramp, seed + i, 0.5);
  }
}

/** Brin de liane feuillu qui pend (front : 0 = au fond, sombre ; 1 = devant, clair). */
export function strand(pix, x, y0, len, ramp, seed, front = 1, side = 0, big = 0) {
  const n = ramp.length, hi = Math.max(2, Math.min(n - 1, Math.round(1 + front * (n - 2))));
  for (let s = 0; s < len; s++) {
    const px = x + Math.round(Math.sin(s * 0.075 + seed) * 1.6);
    pix.set(px, y0 + s, ramp[Math.max(0, hi - 3)]);
    if (s % 3 === seed % 3) {
      const dir = (Math.floor(s / 3) + seed) % 2 ? 1 : -1;
      const fade = 1 - (s / len) * 0.35;                              // plus sombre vers le bas
      const idx = Math.max(1, Math.round(hi * fade - (dir * side > 0 ? 0 : side ? 1 : 0) - (dir > 0 ? 1 : 0)));
      leaf(pix, px, y0 + s, Math.PI / 2 + dir * (0.55 + ih(s, seed, 3) * 0.5), 3 + big + Math.floor(ih(s, seed, 4) * 3), ramp[Math.max(0, idx - 2)], ramp[Math.min(n - 1, idx)], big ? 1 : 0);
    }
  }
}

// ---------------------------------------------------------------------------
// grands troncs à l'écorce rousse, moussus (plan 2 et troncs jouables)
// ---------------------------------------------------------------------------
/**
 * Tronc massif de cx, large de w, du haut du tampon jusqu'à yBase, pied évasé
 * en racines. bark / moss : rampes (déjà fondues dans la brume pour le plan 2).
 */
export function bigTrunk(pix, cx, w, yBase, seed, bark = C.BARK, moss = C.MOSS, o = {}) {
  const R = Math.round(w * (o.roots ?? 0.9)), half = w / 2, y0 = o.top ?? 0;
  for (let y = y0; y < yBase; y++) {
    const p = y > yBase - R ? (y - (yBase - R)) / R : 0;
    const flare = Math.pow(p, 2.3) * w * 0.62;
    const wob = (noise1(y * 0.045, seed) - 0.5) * 2.2;
    const L = Math.round(-half - flare + wob), Rr = Math.round(half + flare + wob);
    for (let i = L; i <= Rr; i++) {
      // les racines : des doigts séparés, pas une jupe
      if (p > 0.55 && Math.abs(i) > half) {
        const finger = noise1(i * 0.22 + seed * 3.1, seed + 4);
        if (finger < 0.38 + (p - 0.55) * 0.5 * (Math.abs(i) - half) / (flare + 1)) continue;
      }
      const u = (i - L) / Math.max(1, Rr - L);                      // 0 à gauche (lumière), 1 à droite
      const cyl = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
      let v = 0.1 + 0.78 * Math.pow(1 - u, 1.25) * (0.55 + 0.45 * cyl);
      const x = cx + i;
      const plate = fbm2(i * 0.3 + seed, y * 0.028, 2, seed + 1);
      v += (noise2(i * 0.8, y * 0.22, seed + 2) - 0.5) * 0.2;
      let c;
      const gro = Math.abs(plate - 0.5) < 0.026;                     // sillons entre les plaques d'écorce
      const m = fbm2(i * 0.1 + seed * 0.7, y * 0.03, 3, seed + 3) + (1 - u) * 0.3 + p * 0.25 - 0.08
        + (noise2(i * 0.7, y * 0.7, seed + 8) - 0.5) * 0.07;
      if (m > 0.74) {
        // coussins de mousse : clairs en haut à gauche, liseré sombre en bas à droite
        const below = fbm2(i * 0.1 + seed * 0.7, (y + 3) * 0.03, 3, seed + 3) + (1 - u) * 0.3 + p * 0.25 - 0.08;
        const mv = 0.2 + 0.5 * Math.pow(1 - u, 0.8) + (noise2(i * 0.55, y * 0.55, seed + 9) - 0.5) * 0.4 + Math.min(0.12, (m - 0.74) * 1.5);
        c = m < 0.765 || below < 0.74 ? moss[1] : pick(moss, mv, x, y);
      } else if (gro) c = u < 0.5 ? bark[1] : bark[0];
      else c = pick(bark, v, x, y);
      pix.set(x, y, c);
    }
  }
}

/** Liane qui pend d'un point d'accroche (toujours une branche ou un feuillage visible). */
export function vine(pix, x, y0, len, ramp, seed, thick = 1) {
  for (let s = 0; s < len; s++) {
    const px = x + Math.round(Math.sin(s * 0.09 + seed) * (1.5 + s * 0.02));
    for (let k = 0; k < thick; k++) pix.set(px + k, y0 + s, ramp[k ? 2 : 1]);
    if (s % 5 === seed % 5) {
      const side = (s / 5) % 2 < 1 ? -1 : thick;
      pix.set(px + side, y0 + s, ramp[4]); pix.set(px + side * (side < 0 ? 2 : 1) + (side < 0 ? 0 : 1), y0 + s + 1, ramp[3]);
    }
  }
  pix.set(x + Math.round(Math.sin(len * 0.09 + seed) * (1.5 + len * 0.02)), y0 + len, ramp[5] ?? ramp[4]);
}

// ---------------------------------------------------------------------------
// sous-bois : fougères, herbes, champignons, rochers, souches
// ---------------------------------------------------------------------------
export function fern(pix, x, y, size, ramp, seed) {
  const n = 5 + Math.floor(ih(seed, 1, 9) * 3);
  for (let f = 0; f < n; f++) {
    const ang = -Math.PI / 2 + ((f + 0.5) / n - 0.5) * 2.5 + (ih(f, seed, 2) - 0.5) * 0.25;
    const len = size * (0.65 + ih(f, seed, 3) * 0.35) * (1 - Math.abs((f + 0.5) / n - 0.5) * 0.35);
    const back = f % 2 === 1;                                       // une fronde sur deux, derrière : plus sombre
    for (let s = 0; s <= len; s++) {
      const t = s / len;
      const px = x + Math.cos(ang) * s, py = y + Math.sin(ang) * s + t * t * len * 0.5;
      const pl = Math.round((1 - t) * size * 0.22 * (0.4 + Math.min(1, t * 4) * 0.6)) + (t < 0.95 ? 1 : 0);
      const nx = -Math.sin(ang), ny = Math.cos(ang) + t * 0.8;
      if (s % 2 === 0) for (let q = 1; q <= pl; q++) {
        pix.set(px + nx * q * 0.9, py + ny * q * 0.7, ramp[back ? 2 : q === pl ? 5 : 4]);
        pix.set(px - nx * q * 0.9, py - ny * q * 0.7, ramp[back ? 1 : 3]);
      }
      pix.set(px, py, ramp[back ? 1 : 2]);
    }
  }
}

/** Grande fronde de fougère (premier plan) : nervure courbe, folioles larges qui s'effilent. */
export function frond(pix, x, y, len, ang, bend, ramp, seed) {
  for (let s = 0; s <= len; s++) {
    const t = s / len, a = ang + bend * t * t;
    const px = x + Math.cos(ang + bend * t * 0.5) * s, py = y + Math.sin(ang + bend * t * 0.5) * s;
    pix.set(px, py, ramp[1]); pix.set(px, py + 1, ramp[0]);
    if (s % 4 !== 1 || s < 5) continue;
    const pl = Math.round(len * 0.26 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) + 2);
    for (const side of [-1, 1]) {
      const la = a + side * (1.15 - t * 0.35);
      for (let q = 1; q <= pl; q++) {
        const qx = px + Math.cos(la) * q, qy = py + Math.sin(la) * q + (q * q) / (pl * 3);
        const c = ramp[side < 0 ? (q > pl * 0.5 ? 3 : 2) : q > pl * 0.6 ? 1 : 0];
        pix.set(qx, qy, c); if (q < pl * 0.7) pix.set(qx + 1, qy, c);
      }
    }
  }
}

/** Adoucit le contour d'un calque (flou de profondeur en pixels : un liseré tramé). */
export function soften(pix, color) {
  const add = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    if (pix.alpha(x, y) || ((x + y) & 1)) continue;
    if (pix.alpha(x - 1, y) > 200 || pix.alpha(x + 1, y) > 200 || pix.alpha(x, y - 1) > 200 || pix.alpha(x, y + 1) > 200) add.push(x, y);
  }
  for (let i = 0; i < add.length; i += 2) Pix.prototype.set.call(pix, add[i], add[i + 1], color, 150);
}

export function grassTuft(pix, x, y, h, ramp, seed) {
  for (let b = -2; b <= 2; b++) {
    const bh = Math.max(1, Math.round(h * (0.5 + ih(b, seed, 1) * 0.6)));
    const lean = (ih(b, seed, 2) - 0.5) * 2.4 + b * 0.4;
    for (let s = 0; s < bh; s++) pix.set(x + b + Math.round((lean * s * s) / (bh * bh + 1)), y - s, ramp[s > bh - 2 ? 5 : s > bh / 2 ? 4 : 2]);
  }
}

export function mushroom(pix, x, y, s, cap = ['#7a2c20', '#b84a30', '#e08a5a'], stem = '#e6dcc0') {
  pix.rect(x, y - s, Math.max(1, s >> 1), s, stem);
  for (let i = -s; i <= s; i++) for (let j = 0; j < Math.max(2, s - 1); j++) {
    if (Math.abs(i) > s - j * 0.9) continue;
    pix.set(x + i, y - s - j, i < -s / 3 && j > 0 ? cap[2] : i > s / 3 ? cap[0] : cap[1]);
  }
}

/** Rocher moussu : bloc à facettes, mousse sur le dessus. */
export function rock(pix, cx, base, rw, rh, seed, ramp = C.ROCK, moss = C.MOSS) {
  for (let y = -rh - 2; y <= 0; y++) for (let x = -rw - 2; x <= rw + 2; x++) {
    const nx = x / rw, ny = y / rh;
    const edge = Math.pow(Math.abs(nx), 2.6) + Math.pow(Math.abs(ny), 2.2) + (fbm2((cx + x) * 0.13, (base + y) * 0.13, 2, seed) - 0.5) * 0.5;
    if (edge > 1) continue;
    const w = worley(cx + x, base + y, Math.max(6, rw * 0.5), seed, 0.9);
    let v = 0.52 - nx * 0.3 - (ny + 0.5) * 0.5 + (w.id - 0.5) * 0.3;
    if (edge > 0.82) v -= 0.14;
    const X = cx + x, Y = base + y;
    const m = -ny * 1.1 + fbm2(X * 0.17, Y * 0.2, 2, seed + 3) * 0.9 - nx * 0.15;
    if (m > 1.18) pix.set(X, Y, pick(moss, v + 0.28 + (m - 1.18) * 0.7, X, Y));
    else if (w.d2 - w.d < 0.8) pix.set(X, Y, ramp[0]);
    else pix.set(X, Y, pick(ramp, v, X, Y));
  }
}

/** Souche : fût court d'écorce, coupe claire aux cernes, mousse. */
export function stump(pix, cx, base, w, h, seed) {
  bigTrunk(pix, cx, w, base, seed, C.BARK, C.MOSS, { top: base - h, roots: 0.7 });
  const half = w / 2;
  for (let y = -3; y <= 2; y++) for (let x = -half; x <= half; x++) {
    const d = (x * x) / (half * half) + (y * y) / 7;
    if (d > 1) continue;
    const ring = Math.sin(Math.sqrt(d) * 9) > 0.3;
    pix.set(cx + x, base - h + y, d > 0.8 ? C.BARK[2] : ring ? '#b08a58' : '#d2b07a');
  }
  for (let x = -half; x < -half / 3; x++) if (ih(x, seed, 2) < 0.7) pix.set(cx + x, base - h - 3, C.MOSS[5]);
}

// ---------------------------------------------------------------------------
// le sol de la forêt : tapis de mousse épais sur un humus sombre
// ---------------------------------------------------------------------------
/** Couleur du sol à d pixels sous la surface (x, y : coordonnées du monde). */
export function groundColor(x, y, d) {
  const th = 4 + noise1(x * 0.23, 5) * 3;
  const drip = ih(x, 0, 6) < 0.2 ? 2 + Math.floor(ih(x, 1, 6) * 5) : 0;
  if (d < th + drip) {
    if (d === 0) return ih(x, 3, 7) < 0.3 ? C.MOSS[6] : C.MOSS[5];
    const v = 0.86 - (d / (th + 1)) * 0.62 + (noise2(x * 0.5, y * 0.5, 8) - 0.5) * 0.2;
    return pick(C.MOSS, d >= th ? 0.3 : v, x, y);
  }
  const w = worley(x, y, 9, 21, 0.85);
  let v = 0.5 + (fbm2(x * 0.16, y * 0.16, 2, 22) - 0.5) * 0.45 + (-w.dx * 0.5 - w.dy * 0.7) / 9 * 0.35;
  if (d < th + drip + 5) v -= 0.3;                                   // l'ombre sous la mousse
  v -= Math.min(0.22, d / 260);
  const st = worley(x, y, 24, 23);
  if (st.id > 0.8 && Math.abs(st.dx) * (0.6 + st.id * 0.5) + Math.abs(st.dy) * 1.25 < 3.2 + (st.id - 0.8) * 9 + noise2(x * 0.6, y * 0.6, 25) * 1.6) {
    return st.d2 - st.d < 1 ? C.HUMUS[0] : pick(C.ROCK, 0.42 - st.dx * 0.1 - st.dy * 0.2, x, y);
  }
  if (d > 9 && Math.abs(fbm2(x * 0.045, y * 0.1, 2, 24) - 0.5) < 0.011) return C.BARK[3];   // radicelles
  if (w.d2 - w.d < 0.75) return C.HUMUS[0];
  return pick(C.HUMUS, v, x, y);
}

// ---------------------------------------------------------------------------
// plan 1 : brume et rais de lumière (calques transparents)
// ---------------------------------------------------------------------------
/** Nappe de brume tramée, périodique en largeur ; env(y) : densité selon la hauteur (0 à 1). */
export function paintMist(pix, color, seed, env, k = 1) {
  const W = pix.w;
  for (let y = 0; y < pix.h; y++) {
    const e = env(y / pix.h);
    if (e <= 0) continue;
    for (let x = 0; x < W; x++) {
      const m = pf2(x, y, W, 0.011, 0.055, 4, seed) * e * k;
      const b = bayer(x, y) * 0.22;
      if (m > 0.46 + b) pix.set(x, y, color, 200);
      else if (m > 0.34 + b) pix.set(x, y, color, 105);
    }
  }
}

/** Rais de lumière obliques, tramés ; list : [{ x, w, len }] ; ils tombent de gauche à droite. */
export function paintRays(pix, list, color, a = 0.45, slope = 0.46) {
  for (const r of list) {
    for (let y = 0; y < Math.min(pix.h, r.len); y++) {
      const fade = Math.pow(1 - y / r.len, 0.7);
      for (let i = 0; i < r.w; i++) {
        const x = Math.round(r.x + i + y * slope);
        const u = Math.sin((Math.PI * (i + 0.5)) / r.w);
        const s = u * fade * a * (0.75 + 0.25 * noise1(i * 0.9 + r.x, 31));
        const b = bayer(x, y);
        if (s > b * 0.8) pix.set(x, y, color, 120);
        else if (s > b * 0.36) pix.set(x, y, color, 58);
      }
    }
  }
}

export { hazeRamp, mixHex };
