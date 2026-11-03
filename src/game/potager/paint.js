// Outils de peinture pixel pour les décors : toiles hors écran, hasard
// déterministe (le même dessin à chaque partie), bruit, couleurs et tramage.
// Les décors sont peints une seule fois au chargement, puis recopiés à chaque
// image : on peut se permettre beaucoup de détail sans ralentir le jeu.

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Hasard déterministe (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage entier -> [0, 1[ (stable, sans état). */
export function ih(x, y = 0, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Bruit de valeur 1D, lissé. */
export function noise1(x, s = 0) {
  const i = Math.floor(x), f = x - i;
  return ih(i, 0, s) + (ih(i + 1, 0, s) - ih(i, 0, s)) * smooth(f);
}

/** Bruit de valeur 2D, lissé. */
export function noise2(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = ih(ix, iy, s), b = ih(ix + 1, iy, s), c = ih(ix, iy + 1, s), d = ih(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Somme d'octaves (relief fractal), résultat dans [0, 1]. */
export function fbm1(x, oct = 4, s = 0) {
  let v = 0, amp = 0.5, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) { v += noise1(x * f, s + o * 17) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

export function fbm2(x, y, oct = 4, s = 0) {
  let v = 0, amp = 0.5, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) { v += noise2(x * f, y * f, s + o * 31) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

/**
 * Cellules de Voronoï (bruit de Worley) : renvoie le décalage au germe le plus
 * proche (dx, dy), sa distance (d), celle du second (d2) et un identifiant.
 * Sert à peindre des houppiers d'arbres, des pierres, des mottes de terre.
 */
const W_OUT = { dx: 0, dy: 0, d: 0, d2: 0, id: 0 };
export function worley(x, y, cell, seed = 0, sy = 1) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / (cell * sy));
  let best = 1e9, second = 1e9, bx = 0, by = 0, bid = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.12 + ih(cx, cy, seed) * 0.76) * cell;
      const py = (cy + 0.12 + ih(cx, cy, seed + 1) * 0.76) * cell * sy;
      const d = (x - px) * (x - px) + ((y - py) * (y - py)) / (sy * sy);
      if (d < best) { second = best; best = d; bx = px; by = py; bid = ih(cx, cy, seed + 2); } else if (d < second) second = d;
    }
  }
  W_OUT.dx = x - bx; W_OUT.dy = y - by; W_OUT.d = Math.sqrt(best); W_OUT.d2 = Math.sqrt(second); W_OUT.id = bid;
  return W_OUT;
}

// ---------------------------------------------------------------------------
// couleurs
// ---------------------------------------------------------------------------
const cache = new Map();
export function rgb(hex) {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    cache.set(hex, c);
  }
  return c;
}

export function mix(a, b, t) {
  const A = typeof a === 'string' ? rgb(a) : a, B = typeof b === 'string' ? rgb(b) : b;
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

export function hex(c) {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** Mélange mémorisé (pour les boucles par pixel : t doit prendre peu de valeurs). */
const mixCache = new Map();
export function mixHex(a, b, t) {
  const key = a + b + t;
  let c = mixCache.get(key);
  if (!c) { c = hex(mix(a, b, t)); mixCache.set(key, c); }
  return c;
}

/** Rampe de couleurs mélangée vers une teinte (brume, lointain). */
export function hazeRamp(ramp, haze, t) {
  return ramp.map((c) => hex(mix(c, haze, t)));
}

// tramage ordonné 4×4 (Bayer), seuils dans ]0, 1[
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/**
 * Teinte d'une rampe (de l'ombre à la lumière) pour une valeur v dans [0, 1].
 * Les passages d'une teinte à l'autre sont tramés sur une bande étroite :
 * des aplats nets, comme un pixel art peint à la main.
 */
export function pick(ramp, v, x, y, band = 0.3) {
  const n = ramp.length;
  const l = Math.max(0, Math.min(0.9999, v)) * n;
  const i = Math.floor(l), f = l - i;
  const t = (f - (0.5 - band / 2)) / band;
  if (i < n - 1 && t > bayer(x, y)) return ramp[i + 1];
  return ramp[i];
}

// ---------------------------------------------------------------------------
// tampon de pixels (pour les grands fonds peints pixel par pixel)
// ---------------------------------------------------------------------------
export class Pix {
  constructor(w, h) {
    this.w = Math.ceil(w);
    this.h = Math.ceil(h);
    this.c = canvas(this.w, this.h);
    this.ctx = this.c.getContext('2d');
    this.img = this.ctx.createImageData(this.w, this.h);
    this.d = this.img.data;
  }

  set(x, y, col, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = typeof col === 'string' ? rgb(col) : col;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
    } else {
      const k = a / 255, o = this.d[i + 3] / 255, out = k + o * (1 - k);
      if (out <= 0) return;
      for (let j = 0; j < 3; j++) this.d[i + j] = (c[j] * k + this.d[i + j] * o * (1 - k)) / out;
      this.d[i + 3] = out * 255;
    }
  }

  rect(x, y, w, h, col) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
    return this;
  }

  line(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.rect(x0 + ((x1 - x0) * i) / n - (w >> 1), y0 + ((y1 - y0) * i) / n - (w >> 1), w, w, col);
    return this;
  }

  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }

  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }

  done() {
    this.ctx.putImageData(this.img, 0, 0);
    return this.c;
  }
}

// ---------------------------------------------------------------------------
// pinceau pour les décors (rectangles et pixels sur un contexte 2D)
// ---------------------------------------------------------------------------
export class Brush {
  constructor(ctx) { this.ctx = ctx; }

  r(x, y, w, h, c) {
    if (w <= 0 || h <= 0) return this;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  p(x, y, c) { return this.r(x, y, 1, 1, c); }

  /** Ligne pixel (Bresenham). */
  line(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    this.ctx.fillStyle = c;
    for (;;) {
      this.ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }

  /** Disque plein (rayon r), éventuellement aplati (ry). */
  disc(cx, cy, r, c, ry = r) {
    this.ctx.fillStyle = c;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const t = 1 - (y * y) / (ry * ry + 0.25);
      if (t < 0) continue;
      const half = Math.floor(Math.sqrt(t) * r + 0.3);
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
    return this;
  }

  /** Polygone plein (règle pair-impair), balayé ligne par ligne. */
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    this.ctx.fillStyle = c;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) {
          xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
        if (b > a) this.ctx.fillRect(a, y, b - a, 1);
      }
    }
    return this;
  }
}
