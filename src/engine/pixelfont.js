// Police en pixels du jeu, dessinée à la main : tout ce qui s'écrit à l'écran
// (titres, bannières, aides, boutique…) est tracé avec elle, un pixel de police
// pour un pixel de jeu. Chasse variable, capitales de 5×7, bas de casse de
// hauteur d'x 5, accents français.
//
// Trois corps : 'small' (le dessin d'origine), 'big' (×2) et 'title' (×4),
// agrandis par l'algorithme Scale2x : les diagonales et les arrondis sont
// redessinés au pixel près au lieu d'être grossis en gros carrés.

// Chaque glyphe : lignes séparées par « / », en partant du haut des capitales
// (7 lignes de corps, puis jusqu'à 2 lignes de jambage).
const BASE = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..##/...#/...#/...#/...#/#..#/.##.',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#.../#.../#.../#.../#.../#.../####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '..../..../.##./...#/.###/#..#/.###',
  b: '#.../#.../###./#..#/#..#/#..#/###.',
  c: '..../..../.###/#.../#.../#.../.###',
  d: '...#/...#/.###/#..#/#..#/#..#/.###',
  e: '..../..../.##./#..#/####/#.../.###',
  f: '.##/#../###/#../#../#../#..',
  g: '..../..../.###/#..#/#..#/#..#/.###/...#/.##.',
  h: '#.../#.../###./#..#/#..#/#..#/#..#',
  i: '#/./#/#/#/#/#',
  j: '.#/../.#/.#/.#/.#/.#/.#/#.',
  k: '#.../#.../#..#/#.#./##../#.#./#..#',
  l: '#/#/#/#/#/#/#',
  m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#',
  n: '..../..../###./#..#/#..#/#..#/#..#',
  o: '..../..../.##./#..#/#..#/#..#/.##.',
  p: '..../..../###./#..#/#..#/#..#/###./#.../#...',
  q: '..../..../.###/#..#/#..#/#..#/.###/...#/...#',
  r: '.../.../#.#/##./#../#../#..',
  s: '..../..../.###/#.../.##./...#/###.',
  t: '.#./.#./###/.#./.#./.#./..#',
  u: '..../..../#..#/#..#/#..#/#..#/.###',
  v: '...../...../#...#/#...#/.#.#./.#.#./..#..',
  w: '...../...../#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  x: '.../.../#.#/#.#/.#./#.#/#.#',
  y: '..../..../#..#/#..#/#..#/#..#/.###/...#/.##.',
  z: '..../..../####/...#/.##./#.../####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '.#./##./.#./.#./.#./.#./###',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '.###./#...#/....#/..##./....#/#...#/.###.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../..#../..#../..#..',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '.../.../.../.../.../.../...',
  '.': '././././././#',
  ',': '../../../../../.#/.#/#.',
  ':': './././#/././#',
  ';': '../../../.#/../.#/.#/#.',
  '!': '#/#/#/#/#/./#',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  "'": '#/#',
  '’': '#/#',
  '"': '#.#/#.#',
  '-': '.../.../.../.../###',
  '–': '..../..../..../..../####',
  '—': '....../....../....../....../######',
  '(': '.#/#./#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/.#/#.',
  '/': '..#/..#/.#./.#./.#./#../#..',
  '+': '...../...../..#../..#../#####/..#../..#..',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '«': '...../...../...../.#..#/#..#./.#..#',
  '»': '...../...../...../#..#./.#..#/#..#.',
  '…': '...../...../...../...../...../...../#.#.#',
  '·': '././././#',
  '×': '.../.../.../#.#/.#./#.#',
  '←': '......./..#..../.#...../#######/.#...../..#....',
  '→': '......./....#../.....#./#######/.....#./....#..',
  '↑': '..#../.###./#.#.#/..#../..#../..#../..#..',
  '↓': '..#../..#../..#../..#../#.#.#/.###./..#..',
  'œ': '......./......./.##.##./#..#..#/#..####/#..#.../.##.###',
  'Œ': '.######/#..#.../#..#.../#..###./#..#.../#..#.../.######',
  'ı': '././#/#/#/#/#',
};

// accents : motif (lignes du haut vers le bas) ; ils se posent une ligne
// au-dessus de la lettre, en laissant un pixel de jour
const ACCENTS = {
  acute: ['.#', '#.'],
  grave: ['#.', '.#'],
  circ: ['.#.', '#.#'],
  trema: ['#.#'],
  macron: ['###'],
};
const COMPOSED = {
  é: ['e', 'acute'], è: ['e', 'grave'], ê: ['e', 'circ'], ë: ['e', 'trema'],
  à: ['a', 'grave'], â: ['a', 'circ'], ù: ['u', 'grave'], û: ['u', 'circ'], ü: ['u', 'trema'],
  ô: ['o', 'circ'], ō: ['o', 'macron'], î: ['ı', 'circ'], ï: ['ı', 'trema'],
  É: ['E', 'acute'], È: ['E', 'grave'], Ê: ['E', 'circ'], À: ['A', 'grave'], Â: ['A', 'circ'],
  Ô: ['O', 'circ'], Ō: ['O', 'macron'], Î: ['I', 'circ'], Û: ['U', 'circ'], Ù: ['U', 'grave'],
};

const ASC = 3;            // lignes réservées aux accents, au-dessus des capitales
const BODY = 7;
const DESC = 2;
export const LINE = ASC + BODY + DESC;   // 12 : hauteur d'une ligne (corps 'small')

/** Glyphe → { w, rows } : rows[y] est un tableau de 0/1, y de 0 à LINE-1. */
function parse(src) {
  const lines = src.split('/');
  const w = Math.max(...lines.map((l) => l.length));
  const rows = [];
  for (let y = 0; y < LINE; y++) {
    const l = lines[y - ASC] ?? '';
    rows.push(Array.from({ length: w }, (_, x) => (l[x] === '#' ? 1 : 0)));
  }
  return { w, rows };
}

function buildSmall() {
  const g = {};
  for (const [ch, src] of Object.entries(BASE)) g[ch] = parse(src);
  // cédilles : sous la lettre
  for (const [ch, base] of [['ç', 'c'], ['Ç', 'C']]) {
    const b = g[base], rows = b.rows.map((r) => r.slice());
    const cx = Math.floor(b.w / 2);
    rows[ASC + BODY][cx] = 1;
    rows[ASC + BODY + 1][cx - 1] = 1;
    g[ch] = { w: b.w, rows };
  }
  for (const [ch, [base, acc]] of Object.entries(COMPOSED)) {
    const b = g[base], pat = ACCENTS[acc];
    const upper = base === base.toUpperCase() && base !== 'ı';
    const w = Math.max(b.w, pat[0].length);
    const bx = Math.floor((w - b.w) / 2), ax = Math.round((w - pat[0].length) / 2);
    const rows = Array.from({ length: LINE }, () => new Array(w).fill(0));
    for (let y = 0; y < LINE; y++) for (let x = 0; x < b.w; x++) rows[y][bx + x] = b.rows[y][x];
    // dernière ligne de l'accent : 2 lignes au-dessus du haut de la lettre
    const bottom = upper ? ASC - 2 : ASC + 2 - 2;
    pat.forEach((l, i) => {
      const y = bottom - (pat.length - 1) + i;
      for (let x = 0; x < l.length; x++) if (l[x] === '#') rows[y][ax + x] = 1;
    });
    g[ch] = { w, rows };
  }
  return g;
}

/** Scale2x (EPX) d'une grille de 0/1. */
function scale2x(rows, w) {
  const h = rows.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : rows[y][x]);
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(0));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
    let e0 = p, e1 = p, e2 = p, e3 = p;
    if (c === a && c !== d && a !== b) e0 = a;
    if (a === b && a !== c && b !== d) e1 = b;
    if (d === c && d !== b && c !== a) e2 = c;
    if (b === d && b !== a && d !== c) e3 = d;
    out[2 * y][2 * x] = e0; out[2 * y][2 * x + 1] = e1;
    out[2 * y + 1][2 * x] = e2; out[2 * y + 1][2 * x + 1] = e3;
  }
  return out;
}

function grow(font) {
  const g = {};
  for (const [ch, gl] of Object.entries(font.glyphs)) g[ch] = { w: gl.w * 2, rows: scale2x(gl.rows, gl.w) };
  return { glyphs: g, line: font.line * 2, gap: font.gap * 2, k: font.k * 2 };
}

const SMALL = { glyphs: buildSmall(), line: LINE, gap: 1, k: 1 };
const BIG = grow(SMALL);
const TITLE = grow(BIG);
export const FONTS = { small: SMALL, big: BIG, title: TITLE };

const glyphOf = (font, ch) => font.glyphs[ch] ?? font.glyphs[ch.normalize('NFD')[0]] ?? font.glyphs['?'];

/** Largeur d'un texte sur une ligne. */
export function measure(text, fontName = 'small', spacing = 0) {
  const font = FONTS[fontName] ?? SMALL;
  let w = 0, n = 0;
  for (const ch of text) { w += glyphOf(font, ch).w; n++; }
  return w + Math.max(0, n - 1) * (font.gap + spacing * font.k);
}

/** Coupe un texte en lignes d'au plus maxW pixels (0 : une seule ligne). */
export function wrap(text, fontName, maxW, spacing = 0) {
  if (!maxW) return [text];
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const tryLine = cur ? `${cur} ${word}` : word;
    if (cur && measure(tryLine, fontName, spacing) > maxW) { lines.push(cur); cur = word; }
    else cur = tryLine;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rgba(color) {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)];
  }
  const h = /^#([0-9a-f]{6})$/i.exec(color);
  if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 255]; }
  return [233, 229, 218, 255];
}

/**
 * Trace un texte dans un canvas à sa taille exacte (1 pixel de canvas = 1 pixel de jeu).
 * options : font ('small' | 'big' | 'title'), color, outline (couleur du contour
 * d'un pixel, ou rien), maxW (retour à la ligne), spacing (interlettrage),
 * align ('left' | 'center' | 'right'), leading (pixels entre deux lignes).
 */
export function renderText(text, options = {}) {
  const { font: fontName = 'small', color = '#e9e5da', outline = '', maxW = 0, spacing = 0, align = 'left', leading = 0 } = options;
  const font = FONTS[fontName] ?? SMALL;
  const lines = wrap(text, fontName, maxW, spacing);
  const pad = outline ? 1 : 0;
  const widths = lines.map((l) => measure(l, fontName, spacing));
  let w = Math.max(1, ...widths) + 2 * pad;
  let h = lines.length * font.line + (lines.length - 1) * leading + 2 * pad;
  w += w % 2; h += h % 2;                        // dimensions paires : le centrage tombe toujours sur un pixel entier
  const mask = new Uint8Array(w * h);
  lines.forEach((line, li) => {
    let x = pad + (align === 'center' ? Math.floor((w - 2 * pad - widths[li]) / 2) : align === 'right' ? w - 2 * pad - widths[li] : 0);
    const y0 = pad + li * (font.line + leading);
    for (const ch of line) {
      const gl = glyphOf(font, ch);
      for (let y = 0; y < font.line; y++) for (let gx = 0; gx < gl.w; gx++) if (gl.rows[y][gx]) mask[(y0 + y) * w + x + gx] = 1;
      x += gl.w + font.gap + spacing * font.k;
    }
  });
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const fill = rgba(color), edge = outline ? rgba(outline) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let c = null;
    if (mask[i]) c = fill;
    else if (edge) {
      for (let dy = -1; dy <= 1 && !c; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) { c = edge; break; }
      }
    }
    if (c) { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = c[3]; }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
