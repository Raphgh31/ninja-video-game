// Montage d'un Reel (1080 × 1920, 30 images/s) à partir des images tournées dans le jeu (tools/reels/tourner.cjs).
// Chaque image du Reel est composée ici, dans une toile : le cadre du jeu (recadré, panoramique au pixel d'écran
// près), les textes dans la police du jeu (src/engine/pixelfont.js), les taches et traits d'encre en pixels de jeu
// (4 × 4 pixels d'écran, comme le jeu). Lancé par tools/reels/monter.mjs.
import { renderText } from '/src/engine/pixelfont.js';

const W = 1080, H = 1920, FPS = 30;
const K = 4;                       // pixels d'écran par pixel de jeu (le jeu est tourné en 4×)
const GW = 1792, GH = 1008;        // image tournée (448 × 252 pixels de jeu)
const CW = 1080;                   // largeur du cadre du jeu dans le Reel (270 pixels de jeu)
const GY = 520;                    // haut du cadre du jeu
const INK = [9, 9, 14], BG = '#0b0c12', CREAM = '#efe6d2', GOLD = '#f2b866';

const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 0, s) * (1 - u) + hash(i + 1, 0, s) * u; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Un texte de la police du jeu, agrandi d'un nombre entier (pixels nets). */
function text(str, font, color, scale) {
  const c = renderText(str, { font, color });
  return { c, w: c.width * scale, h: c.height * scale, scale };
}
function drawText(g, t, x, y, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
  g.drawImage(t.c, Math.round(x), Math.round(y), t.w, t.h); g.restore();
}
/** Le texte qui s'écrit lettre à lettre (la place est celle du texte entier : rien ne bouge). */
function typed(g, str, font, color, scale, cx, y, n, alpha = 1) {
  const full = text(str, font, color, scale), part = text(str.slice(0, n), font, color, scale);
  if (n <= 0) return full;
  drawText(g, part, cx - full.w / 2, y, alpha);
  return full;
}

/**
 * Une tache d'encre en pixels de jeu : une ellipse aux bords déchiquetés (bruit), des éclaboussures lancées
 * autour, un bord tramé. p : 0 → 1 (croissance).
 */
function inkBlot(g, cx, cy, rx, ry, p, seed, color = INK, alpha = 0.94) {
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

/** Un trait de pinceau horizontal (pixels de jeu), qui se tire de gauche à droite et s'effile. */
function brush(g, x0, y, w, thick, p, color, seed) {
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
function inkWipe(g, p) {
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

export async function setup({ track, n }) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  document.body.append(cv);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  // le recadrage : d'abord le soleil, puis un lent panoramique qui accompagne le ninja (amorti, au pixel d'écran)
  const crop = [];
  let c = 20, v = 0;
  for (let f = 0; f < n; f++) {
    const l = track[f], s = f / FPS;
    let want = 20 + 22 * ss((s - 1.4) / 1.6);
    if (!l.hide) want = Math.max(want, Math.min(178, (l.x - l.cx) - 0.46 * 270));
    v += ((want - c) * 7 - v * 4.2) / FPS; c += v / FPS;
    crop.push(Math.max(0, Math.min(178, c)));
  }
  const L1 = "I'm making a video game.", L2 = 'Alone.', T1 = 'THE NINJA ADVENTURE', T2 = "Week 1 — I'll show you everything.";
  const title = text(T1, 'title', CREAM, 2);
  const sub = text(T2, 'big', CREAM, 2);

  window.frame = async (f, src) => {
    const img = new Image(); img.src = src; await img.decode();
    const s = f / FPS;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    // le cadre du jeu, qui sort du noir
    const gx = Math.round(crop[f] * K);
    g.save();
    g.globalAlpha = ss((s - 0.15) / 1.2);
    g.drawImage(img, gx, 0, CW, GH, 0, GY, CW, GH);
    g.restore();
    // les bords du cadre se fondent dans le noir (haut et bas), sans trait
    for (const [y0, dir] of [[GY, 1], [GY + GH, -1]]) {
      const gr = g.createLinearGradient(0, y0, 0, y0 + dir * 90);
      gr.addColorStop(0, 'rgba(11,12,18,1)'); gr.addColorStop(1, 'rgba(11,12,18,0)');
      g.fillStyle = gr; g.fillRect(0, Math.min(y0, y0 + dir * 90), W, 90);
    }
    // « I'm making a video game. » lettre à lettre, puis « Alone. » (doré)
    const out1 = 1 - ss((s - 3.7) / 0.45);
    if (s > 0.3 && out1 > 0) {
      const n1 = Math.floor((s - 0.3) * 26);
      typed(g, L1, 'big', CREAM, 3, W / 2, 310, n1, out1);
      if (s > 1.55) {
        const a = easeOut((s - 1.55) / 0.3), t2 = text(L2, 'big', GOLD, 5);
        drawText(g, t2, W / 2 - t2.w / 2, 392 + Math.round((1 - a) * 3) * K, a * out1);
      }
    }
    // la carte de titre : une tache d'encre sur le ciel, le titre qui se découvre, un trait doré, la semaine
    const cy = GY + 290;
    if (s > 4.75) {
      inkBlot(g, W / 2, cy, 500, 168, (s - 4.75) / 0.42, 3);
      if (s > 5.0) {
        const r = easeOut((s - 5.0) / 0.45), x0 = W / 2 - title.w / 2, y0 = cy - title.h / 2 - 34;
        g.save(); g.beginPath(); g.rect(x0, y0 - 8, title.w * r, title.h + 16); g.clip();
        drawText(g, title, x0, y0); g.restore();
        if (s > 5.35) brush(g, Math.round((W / 2 - 300) / K) * K, Math.round((cy + 26) / K) * K, 600, 12, (s - 5.35) / 0.4, GOLD, 5);
        if (s > 5.9) drawText(g, sub, W / 2 - sub.w / 2, cy + 58, ss((s - 5.9) / 0.4));
      }
    }
    // la sortie : un grand coup d'encre balaie tout, vers la suite de la vidéo
    inkWipe(g, (s - 7.95) / 0.75);
    return cv.toDataURL('image/png');
  };
}
