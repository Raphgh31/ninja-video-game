// Le pinceau « à l'avance » : repeint une image fixe (plans du fond, ciel, feuilles de sprites) en touches
// d'aquarelle, une fois, au chargement. Exactement le même motif de touches que le pinceau en direct de la
// carte graphique (src/engine/brushgl.js), calculé ici sur le processeur : tout le jeu a la même main.
//
// Pour chaque point de la toile finale (4 points par pixel de jeu), on lit le motif : il dit à quelle
// touche ce point appartient (décalage vers le centre de la touche, et sa teinte) ; le point prend la
// couleur de l'image au centre de la touche. Touches larges sur les aplats (ciel, montagnes), fines là où
// l'image est détaillée. Les touches sont accrochées à l'image : une feuille de sprites garde les mêmes
// touches d'une image à l'autre (le ninja ne « grouille » pas en courant).
import { canvas } from '../game/potager/paint.js';
import { strokeMap } from './brushgl.js';

export const P = 4;                 // points de toile par pixel de jeu (la résolution du motif)
// Le pinceau d'aquarelle n'est plus utilisé (23 novembre 2026 : retour aux pixels nets, « pixel art lumineux ») ;
// ?aquarelle=1 dans l'adresse le remet, pour comparer. Sans lui, les fonctions ci-dessous rendent l'image telle quelle.
export const BRUSH = typeof location !== 'undefined' && /[?&]aquarelle=1\b/.test(location.search);
function asIs(src) {                // (l'image elle-même : certaines bandes de décor sont très larges)
  src.P = 1;
  return src;
}
const TILE = 128;                   // un motif couvre 128 × 128 pixels de jeu
const maps = {};
const SPECS = {
  fine: { len: 2.4, wid: 1.25, curve: 0.12, seed: 3 },
  wide: { len: 6.5, wid: 2.4, curve: 0.18, seed: 5 },
  huge: { len: 11, wid: 3.6, curve: 0.22, seed: 7 },
  mid: { len: 4, wid: 1.7, curve: 0.14, seed: 17 },
  tiny: { len: 1.25, wid: 0.75, curve: 0.06, seed: 13 },
};
function map(name) { return (maps[name] ??= strokeMap(SPECS[name])); }

/**
 * Repeint une toile (ou une image). o : { fine = 'fine', wide = 'wide' | 'huge' | null, detail = 0.32
 * (seuil, comme le pinceau en direct), ink = 1 (bords des touches), paper = 0.08 (grain), tile = 1024
 * (largeur d'une tuile, en pixels de jeu), ox, oy (où l'image commence dans le motif) }.
 * Rend { tiles: [{ x0, w, c }], P, w, h } ; à dessiner avec blit().
 */
export function paintCanvas(src, o = {}) {
  if (!BRUSH) return { tiles: [{ x0: 0, w: src.width, c: src }], P: 1, w: src.width, h: src.height };
  if (!src.getContext) { const c = canvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); src = c; }
  const w = src.width, h = src.height, TW = o.tile ?? 1024, Q = o.P ?? P, step = P / Q;
  const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const F = map(o.fine ?? 'fine'), Wd = o.wide === null ? null : map(o.wide ?? 'wide');
  const MS = F.size, detail = (o.detail ?? 0.32) * 255, ink = o.ink ?? 1, paper = o.paper ?? 0.08;
  const ox0 = o.ox ?? 0, oy0 = o.oy ?? 0, soft = o.soft ?? true;
  // les couleurs lues à travers un petit flou (comme le pinceau en direct : le tramage se fond dans la touche)
  // (un flou en boîte 3 × 3, une seule fois : le tramage se fond sans voiler l'image)
  let bl = new Float32Array(sd);
  if (soft) for (let pass = 0; pass < 1; pass++) {
    const nb = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r = 0, gg = 0, b = 0, a = 0, n = 0;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        const xx = x + ax, yy = y + ay;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4, wa = bl[j + 3] / 255;
        r += bl[j] * wa; gg += bl[j + 1] * wa; b += bl[j + 2] * wa; a += bl[j + 3]; n += wa;
      }
      if (n > 0) { nb[o] = r / n; nb[o + 1] = gg / n; nb[o + 2] = b / n; }
      nb[o + 3] = a / 9;                      // (la transparence tramée aussi : une brume pleine et douce)
    }
    bl = nb;
  }
  const sdRaw = sd;
  // le détail de l'image, une fois par pixel de jeu : l'écart de couleur le plus grand à 2 pixels autour
  const det = new Uint8Array(w * h);
  if (Wd) {
    const lim = detail * detail;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let m = 0;
      for (const [ax, ay] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const xx = Math.min(w - 1, Math.max(0, x + ax)), yy = Math.min(h - 1, Math.max(0, y + ay)), j = (yy * w + xx) * 4;
        const a = bl[i] - bl[j], b = bl[i + 1] - bl[j + 1], c = bl[i + 2] - bl[j + 2], e = bl[i + 3] - bl[j + 3];
        const q = a * a + b * b + c * c + e * e;
        if (q > m) m = q;
      }
      det[y * w + x] = m > lim ? 1 : 0;
    }
  }
  const tiles = [];
  for (let x0 = 0; x0 < w; x0 += TW) {
    const tw = Math.min(TW, w - x0), OW = tw * Q, OH = h * Q;
    const c = canvas(OW, OH), g = c.getContext('2d'), img = g.createImageData(OW, OH), d = img.data;
    for (let y = 0; y < OH; y++) {
      const gy = (y + 0.5) / Q, my = (((((y * step) | 0) + oy0 * P) % MS + MS) % MS) * MS;
      for (let x = 0; x < OW; x++) {
        const gx = x0 + (x + 0.5) / Q, mi = (my + (((((x * step) | 0) + (x0 + ox0) * P) % MS + MS) % MS)) * 4;
        let m = F.data;
        if (Wd) {
          const cx = Math.min(w - 1, Math.max(0, (gx + (Wd.data[mi] - 128) / 16) | 0)), cy = Math.min(h - 1, Math.max(0, (gy + (Wd.data[mi + 1] - 128) / 16) | 0));
          if (!det[cy * w + cx]) m = Wd.data;
        }
        const sx2 = Math.min(w - 1, Math.max(0, (gx + (m[mi] - 128) / 16) | 0)), sy2 = Math.min(h - 1, Math.max(0, (gy + (m[mi + 1] - 128) / 16) | 0)), si = (sy2 * w + sx2) * 4;
        const k = (1 + (m[mi + 2] / 200 - 1) * ink) * (1 + (((x * 7 + y * 13) % 17) / 17 - 0.5) * paper * 0.6);
        const oi = (y * OW + x) * 4;
        d[oi] = bl[si] * k; d[oi + 1] = bl[si + 1] * k; d[oi + 2] = bl[si + 2] * k; d[oi + 3] = bl[si + 3];
      }
    }
    g.putImageData(img, 0, 0);
    tiles.push({ x0, w: tw, c });
  }
  return { tiles, P: Q, w, h };
}

/**
 * Dessine une partie (sx, sy, sw, sh, en pixels de jeu) d'une image peinte, en (dx, dy), à la taille dw × dh
 * (par défaut sw × sh) : comme ctx.drawImage, mais à travers les tuiles.
 */
export function blit(ctx, pc, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
  const kx = dw / sw, Q = pc.P;
  for (const t of pc.tiles) {
    const a = Math.max(sx, t.x0), b = Math.min(sx + sw, t.x0 + t.w);
    if (b <= a) continue;
    ctx.drawImage(t.c, (a - t.x0) * Q, sy * Q, (b - a) * Q, sh * Q, dx + (a - sx) * kx, dy, (b - a) * kx, dh);
  }
}

/** Une feuille de sprites (ou toute petite image) repeinte : une seule toile, avec son facteur P. */
export function paintSheet(sheet, o = {}) {
  if (!BRUSH) return asIs(sheet);
  const pc = paintCanvas(sheet, { fine: 'tiny', wide: null, ink: 0.45, soft: false, tile: 1 << 20, ...o });
  const c = pc.tiles[0].c;
  c.P = pc.P;
  return c;
}

/** Une bande de décor repeinte (une seule toile, finesse Q) : pour les plans du fond de la Forêt. */
export function paintBand(img, o = {}) {
  if (!BRUSH) return asIs(img);
  const pc = paintCanvas(img, { P: 2, wide: 'wide', tile: 1 << 20, ...o });
  const c = pc.tiles[0].c;
  c.P = pc.P;
  return c;
}

/**
 * Un texte (ou un petit pictogramme) au pinceau, lisible même petit : les lettres sont agrandies en douceur,
 * puis leurs bords deviennent irréguliers comme un trait d'encre (seuil bruité), avec un léger grain de
 * touche dans la couleur. Les lettres gardent leur forme : on n'y déplace pas les couleurs.
 */
export function paintText(src, o = {}) {
  const Q = o.P ?? P, w = src.width, h = src.height, OW = w * Q, OH = h * Q;
  const up = canvas(OW, OH), ug = up.getContext('2d', { willReadFrequently: true });
  ug.imageSmoothingEnabled = true;
  ug.imageSmoothingQuality = 'high';
  ug.filter = `blur(${Q * 0.32}px)`;
  ug.drawImage(src, 0, 0, OW, OH);
  ug.filter = 'none';
  const u = ug.getImageData(0, 0, OW, OH).data;
  const sd = (src.getContext ? src : (() => { const c = canvas(w, h); c.getContext('2d').drawImage(src, 0, 0); return c; })()).getContext('2d').getImageData(0, 0, w, h).data;
  const F = map('fine'), MS = F.size, seed = o.seed ?? 3;
  const out = canvas(OW, OH), og = out.getContext('2d'), img = og.createImageData(OW, OH), d = img.data;
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const i = (y * OW + x) * 4, a = u[i + 3];
    if (a < 8) continue;
    const mi = ((((y + seed * 7) % MS) * MS) + ((x + seed * 13) % MS)) * 4;
    // le bord : un seuil qui ondule avec les touches (l'encre mord un peu, ou manque)
    const wob = (F.data[mi] - 128) / 255 * 0.5 + ((x * 7 + y * 13) % 11) / 11 * 0.12;
    const t = a / 255 - 0.42 - wob * 0.35;
    if (t <= 0) continue;
    const al = Math.min(1, t * 5);
    // la couleur : celle du pixel d'origine (sans moyenne : un liseré garde sa couleur), un grain de touche
    const sx = Math.min(w - 1, (x / Q) | 0), sy = Math.min(h - 1, (y / Q) | 0), si = (sy * w + sx) * 4;
    let si2 = si;
    if (sd[si + 3] < 8) {                       // bord adouci, hors des pixels pleins : le voisin le plus plein
      let best = -1;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const xx = Math.min(w - 1, Math.max(0, sx + ax)), yy = Math.min(h - 1, Math.max(0, sy + ay)), j = (yy * w + xx) * 4;
        if (sd[j + 3] > best) { best = sd[j + 3]; si2 = j; }
      }
    }
    const k = 0.9 + (F.data[mi + 2] / 200) * 0.1;
    d[i] = sd[si2] * k; d[i + 1] = sd[si2 + 1] * k; d[i + 2] = sd[si2 + 2] * k; d[i + 3] = 255 * al;
  }
  og.putImageData(img, 0, 0);
  out.P = Q;
  return out;
}
