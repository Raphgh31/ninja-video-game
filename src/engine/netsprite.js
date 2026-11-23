// Le ninja net, au milieu du jeu peint : sa feuille de sprites n'est pas repeinte au pinceau, elle est
// agrandie proprement (4 points par pixel de jeu) dans l'un des styles à l'essai (`?ninja=` dans l'adresse) :
//   pixel  — les pixels d'origine, nets ;
//   lisse  — agrandi en arrondissant les diagonales (Scale2x deux fois) : des traits nets, sans escaliers ;
//   doux   — lisse, et le bord de la silhouette adouci d'un quart de pixel ;
//   encre  — doux, et le contour un peu fondu dans les couleurs du ninja (il ressort moins) ;
//   fin    — lisse, la silhouette affinée d'un quart de pixel : des traits plus fins (CHOISI, 23 nov. 2026) ;
//   lavis  — doux, les couleurs accordées à la peinture (un rien moins vives, un grain de papier).
import { canvas } from '../game/potager/paint.js';

export const NINJA_STYLES = ['pixel', 'lisse', 'doux', 'encre', 'fin', 'lavis'];

function imageData(src) {
  const c = canvas(src.width, src.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  return g.getImageData(0, 0, src.width, src.height);
}

const same = (d, i, j) => d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];

/** Scale2x (EPX) : chaque pixel devient 2 × 2, les diagonales s'arrondissent. */
function scale2x(d, w, h) {
  const W = w * 2, o = new Uint8ClampedArray(W * h * 2 * 4);
  const at = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const put = (x, y, s) => { const k = (y * W + x) * 4; o[k] = d[s]; o[k + 1] = d[s + 1]; o[k + 2] = d[s + 2]; o[k + 3] = d[s + 3]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (!same(d, A, D) && !same(d, C, B)) {
      if (same(d, C, A)) e0 = A;
      if (same(d, A, B)) e1 = B;
      if (same(d, D, C)) e2 = C;
      if (same(d, B, D)) e3 = D;
    }
    put(2 * x, 2 * y, e0); put(2 * x + 1, 2 * y, e1); put(2 * x, 2 * y + 1, e2); put(2 * x + 1, 2 * y + 1, e3);
  }
  return o;
}

/** Les pixels du bord (opaques, touchant le vide), dans l'image d'origine. */
function edges(d, w, h) {
  const e = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < 8) continue;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + ax, yy = y + ay;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || d[(yy * w + xx) * 4 + 3] < 8) { e[y * w + x] = 1; break; }
    }
  }
  return e;
}

/** Une feuille de sprites nette, dans le style demandé ; rend une toile P = 4 fois plus fine (lissée au dessin). */
export function crispSheet(sheet, style = 'lisse') {
  if (style === 'pixel') {            // les pixels d'origine, tels quels (dessinés sans lissage)
    const c = canvas(sheet.width, sheet.height);
    c.getContext('2d').drawImage(sheet, 0, 0);
    c.P = 1;
    return c;
  }
  const w = sheet.width, h = sheet.height, src = imageData(sheet), d0 = src.data, Q = 4, W = w * Q, H = h * Q;
  let d;
  {
    let base = d0;
    if (style === 'encre') {          // le contour, mêlé pour un tiers à la couleur du ninja juste dedans
      base = new Uint8ClampedArray(d0);
      const e = edges(d0, w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!e[y * w + x]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
          const xx = x + ax, yy = y + ay;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || e[yy * w + xx]) continue;
          const j = (yy * w + xx) * 4;
          if (d0[j + 3] < 8) continue;
          r += d0[j]; g += d0[j + 1]; b += d0[j + 2]; n++;
        }
        const i = (y * w + x) * 4;
        // un brun d'encre plutôt qu'un noir pur, et un tiers de la couleur voisine
        const tr = n ? r / n : 60, tg = n ? g / n : 50, tb = n ? b / n : 55;
        base[i] = d0[i] * 0.45 + 42 * 0.2 + tr * 0.35; base[i + 1] = d0[i + 1] * 0.45 + 32 * 0.2 + tg * 0.35; base[i + 2] = d0[i + 2] * 0.45 + 36 * 0.2 + tb * 0.35;
      }
    }
    d = scale2x(scale2x(base, w, h), w * 2, h * 2);
  }
  const alphaAt = (a, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[(y * W + x) * 4 + 3]);
  if (style === 'fin') {              // un quart de pixel retiré tout autour de la silhouette
    const a = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      if (a[k + 3] < 8) continue;
      if (alphaAt(a, x + 1, y) < 8 || alphaAt(a, x - 1, y) < 8 || alphaAt(a, x, y + 1) < 8 || alphaAt(a, x, y - 1) < 8) {
        if (alphaAt(a, x, y + 1) >= 8 || y % Q !== Q - 1) d[k + 3] = 0;   // (pas sous les pieds : il reste posé)
      }
    }
  }
  if (style === 'doux' || style === 'encre' || style === 'lavis' || style === 'fin') {   // bord adouci (seulement la transparence)
    const a = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      let s = 0, n = 0, edge = false;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        const v = alphaAt(a, x + ax, y + ay);
        s += v; n++;
        if ((v < 8) !== (a[k + 3] < 8)) edge = true;
      }
      if (!edge) continue;
      if (a[k + 3] < 8) {             // un pixel vide au bord : la couleur du voisin plein, un peu de transparence
        let best = -1;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const v = alphaAt(a, x + ax, y + ay);
          if (v > best) { best = v; const j = ((y + ay) * W + x + ax) * 4; d[k] = a[j]; d[k + 1] = a[j + 1]; d[k + 2] = a[j + 2]; }
        }
        d[k + 3] = (s / n) * 0.5;
      } else d[k + 3] = Math.max(a[k + 3] * 0.6, s / n);
    }
  }
  if (style === 'lavis') {           // un rien moins vif, un peu plus chaud, un grain de papier fixe
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      if (d[k + 3] < 8) continue;
      const l = (d[k] + d[k + 1] + d[k + 2]) / 3, gr = 1 + ((((x >> 1) * 7 + (y >> 1) * 13) % 17) / 17 - 0.5) * 0.07;
      d[k] = (d[k] * 0.88 + l * 0.12 + 5) * gr; d[k + 1] = (d[k + 1] * 0.88 + l * 0.12 + 2) * gr; d[k + 2] = (d[k + 2] * 0.88 + l * 0.12 - 2) * gr;
    }
  }
  const c = canvas(W, H), g = c.getContext('2d');
  g.putImageData(new ImageData(d, W, H), 0, 0);
  c.P = Q;
  c.smooth = true;
  return c;
}
