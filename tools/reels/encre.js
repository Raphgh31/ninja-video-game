// Les outils communs du montage des Reels (pixels de jeu, encre, textes dans la police du jeu) : le format,
// les couleurs, les courbes, le texte agrandi d'un nombre entier, la tache, le coup de pinceau sumi-e, le trait
// doré, le grand balayage d'encre. Utilisés par compose.js (l'intro « Week 1 ») et week1_suite.js (sa suite).
import { renderText } from '/src/engine/pixelfont.js';

export const W = 1080, H = 1920, FPS = 30;
export const K = 5;                       // pixels d'écran par pixel de jeu (le jeu est tourné en 5×)
export const GW = 2240, GH = 1260;        // image tournée (448 × 252 pixels de jeu)
export const CW = 1080;                   // largeur du cadre du jeu dans le Reel (216 pixels de jeu)
export const VW = CW / K, PAN = 448 - VW; // (la largeur vue, en pixels de jeu, et le panoramique possible)
export const GY = 440;                    // haut du cadre du jeu
export const INK = [9, 9, 14], BG = '#0b0c12', CREAM = '#efe6d2', GOLD = '#f2b866';

export const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
export const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const noise = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 0, s) * (1 - u) + hash(i + 1, 0, s) * u; };
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Un texte de la police du jeu, agrandi d'un nombre entier (pixels nets). */
export function text(str, font, color, scale) {
  const c = renderText(str, { font, color });
  return { c, w: c.width * scale, h: c.height * scale, scale };
}
export function drawText(g, t, x, y, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
  g.drawImage(t.c, Math.round(x), Math.round(y), t.w, t.h); g.restore();
}
/** Le texte qui s'écrit lettre à lettre (la place est celle du texte entier : rien ne bouge). */
export function typed(g, str, font, color, scale, cx, y, n, alpha = 1) {
  const full = text(str, font, color, scale), part = text(str.slice(0, n), font, color, scale);
  if (n <= 0) return full;
  drawText(g, part, cx - full.w / 2, y, alpha);
  return full;
}

/**
 * Une tache d'encre en pixels de jeu : une ellipse aux bords déchiquetés (bruit), des éclaboussures lancées
 * autour, un bord tramé. p : 0 → 1 (croissance).
 */
export function inkBlot(g, cx, cy, rx, ry, p, seed, color = INK, alpha = 0.94) {
  if (p <= 0) return;
  const gx0 = Math.floor((cx - rx * 1.5) / K), gx1 = Math.ceil((cx + rx * 1.5) / K);
  const gy0 = Math.floor((cy - ry * 1.9) / K), gy1 = Math.ceil((cy + ry * 1.9) / K);
  const e = easeOut(p);
  const drops = Array.from({ length: 14 }, (_, i) => {
    const a = hash(i, 1, seed) * Math.PI * 2, d = 1.05 + hash(i, 2, seed) * 0.45;
    return { x: cx + Math.cos(a) * rx * d * e, y: cy + Math.sin(a) * ry * d * e, r: (6 + hash(i, 3, seed) * 16) * e };
  });
  g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  for (let j = gy0; j <= gy1; j++) for (let i = gx0; i <= gx1; i++) {
    const x = i * K + K / 2, y = j * K + K / 2, dx = (x - cx) / (rx * e), dy = (y - cy) / (ry * e);
    const ang = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    const edge = 1 + 0.16 * (noise(ang * 3.2 + 10, seed) - 0.5) * 2 + 0.07 * (noise(ang * 11 + 3, seed + 1) - 0.5) * 2;
    let v = (edge - d) * 9;                          // > 0 dedans ; le bord, tramé sur ~1/9 du rayon
    for (const dr of drops) v = Math.max(v, (dr.r - Math.hypot(x - dr.x, y - dr.y)) / 4);
    if (v <= 0) continue;
    if (v < 1 && v < BAYER[(j & 3) * 4 + (i & 3)]) continue;
    g.fillRect(i * K, j * K, K, K);
  }
}

/**
 * Un large coup de pinceau horizontal à l'encre (sumi-e), en pixels de jeu : il se tire de gauche à droite,
 * les bords haut et bas irréguliers, la queue qui s'effile et se sépare en fibres (brosse sèche).
 */
export function brushBand(g, x0, x1, cy, h, p, seed, color = INK, alpha = 0.93) {
  if (p <= 0) return;
  const cols = Math.round((x1 - x0) / K), shown = Math.round(cols * easeOut(p)), rows = Math.round(h / K);
  g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  for (let i = 0; i < shown; i++) {
    const u = i / cols;
    const body = Math.min(1, u / 0.05) ** 0.6 * (1 - Math.max(0, (u - 0.9) / 0.1) ** 1.4 * 0.7);   // attaque ronde, queue effilée
    const hh = (rows / 2) * body;
    const top = -hh * (1 + 0.1 * (noise(i * 0.09, seed) - 0.5) * 2) + Math.sin(u * 2.6) * 1.6;
    const bot = hh * (1 + 0.1 * (noise(i * 0.09 + 40, seed) - 0.5) * 2) + Math.sin(u * 2.6) * 1.6;
    for (let j = Math.floor(top); j <= Math.ceil(bot); j++) {
      // brosse sèche : des fibres (lignes) qui s'interrompent, surtout dans la queue et sur les bords
      const edge = Math.min(j - top, bot - j);
      const lead = Math.max(0, (i - (shown - 7)) / 7);        // le bord avant, qui avance : plus léger
      const dry = Math.max(0, (u - 0.8) / 0.2) * 0.75 + (edge < 1.5 ? 0.25 : 0) + lead * 0.6;
      if (dry > 0 && noise(i * 0.22 + hash(j, 0, seed) * 50, seed + j) < dry * 0.8) continue;
      g.fillRect(x0 + i * K, Math.round(cy / K + j) * K, K, K);
    }
  }
}

/** Un trait de pinceau horizontal (pixels de jeu), qui se tire de gauche à droite et s'effile. */
export function brush(g, x0, y, w, thick, p, color, seed) {
  const n = Math.round((w * easeOut(p)) / K);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, w / K), taper = Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.75) / 0.25) * 0.7);
    const th = Math.max(1, Math.round((thick / K) * taper * (0.85 + 0.3 * noise(i * 0.4, seed))));
    const off = Math.round(Math.sin(u * 3.1) * 1.2);
    for (let k = 0; k < th; k++) if (!(k === th - 1 && hash(i, k, seed) < 0.3)) g.fillRect(x0 + i * K, y + (off + k - Math.floor(th / 2)) * K, K, K);
  }
}

/** Le grand coup de pinceau qui couvre tout l'écran (sortie vers la suite), en pixels de jeu. */
export function inkWipe(g, p) {
  if (p <= 0) return;
  const cols = W / K, rows = H / K;
  g.fillStyle = BG;
  for (let j = 0; j < rows; j++) {
    const lag = (j / rows) * 0.35 + 0.08 * noise(j * 0.12, 9);      // le haut part le premier, comme un geste en diagonale
    const front = (p * 1.45 - lag) * cols;
    if (front <= 0) continue;
    const ragged = front + (noise(j * 0.5, 4) - 0.5) * 10;
    const n = Math.min(cols, Math.floor(ragged));
    g.fillRect(0, j * K, n * K, K);
    for (let i = n; i < n + 3 && i < cols; i++) if (hash(i, j, 7) < 0.5 - (i - n) * 0.15) g.fillRect(i * K, j * K, K, K);
  }
}

