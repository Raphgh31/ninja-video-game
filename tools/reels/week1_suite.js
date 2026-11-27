// Montage de la suite du Reel « Week 1 » (après l'intro, docs/reels/week1_intro.mp4) : une journée dans le jeu,
// du matin à la nuit, en cinq plans tournés (tools/reels/week1/*.cjs) : le Potager au matin, la Forêt à midi, le
// corbeau à l'heure dorée, le duel quand la nuit tombe, la maison du début sous la lune (carte de fin).
// Raccords : un coup de pinceau qui découvre le plan suivant (bord déchiqueté, liseré d'encre, en pixels de jeu).
// Textes : la police du jeu, en haut (zones sûres d'Instagram). Lancé par tools/reels/monter_plans.mjs.
import { W, H, FPS, K, GH, CW, VW, PAN, GY, INK, BG, CREAM, GOLD, ss, easeOut, hash, noise, text, drawText, typed, brushBand, brush } from './encre.js';

const CUT = 10;                 // durée d'un raccord (images)
const Y1 = 232, Y2 = 318;       // les deux lignes de texte, au-dessus du cadre du jeu

// les textes : [ligne, texte, couleur, échelle, début (s), sortie (s)] ; lettre à lettre, puis fondu
const CAPTIONS = [
  [1, 'Two worlds so far.', CREAM, 5, 0.35, 7.2],
  [2, 'WORLD 1 · THE GARDEN', GOLD, 4, 0.95, 3.9],
  [2, 'WORLD 2 · THE FOREST', GOLD, 4, 4.25, 7.2],
  [1, 'A crow boss.', CREAM, 5, 7.55, 10.75],
  [2, 'It throws rocks.', GOLD, 4, 8.2, 10.75],
  [1, 'Online duels.', CREAM, 5, 11.15, 14.45],
  [2, 'Best of three.', GOLD, 4, 11.75, 14.45],
  [1, 'Soon on Steam & mobile.', CREAM, 5, 14.85, 17.85],
  [2, 'Made alone, week by week.', GOLD, 4, 15.75, 17.85],
  [1, 'Follow to help it grow.', CREAM, 5, 18.95, 99],
  [2, 'Week 2 is coming.', GOLD, 4, 19.85, 99],
];
const END = { band: 18.05, title: 18.3, stroke: 18.65, black: 21.15 };

/** Le recadrage d'un plan (en pixels de jeu, 0 → PAN) : ce que la caméra du Reel vise, image par image. */
function aim(nom, l, prev) {
  const nx = l.x - l.cx;
  if (nom === '3_corbeau') {           // le ninja et le corbeau ensemble (le corbeau compte un peu moins)
    const bx = l.bx ?? nx, c = Math.abs(bx - nx) < 170 ? nx * 0.62 + bx * 0.38 : nx;
    return c - VW / 2;
  }
  if (nom === '4_duel') {              // les deux combattants ; pendant le coup fatal (ralenti, zoom du jeu) : on ne bouge plus
    if (l.ph && l.ph !== 'fight') return prev;
    const bx = l.bx ?? nx, c = Math.abs(bx - nx) < 170 ? (nx + bx) / 2 : nx;
    return c - VW / 2;
  }
  if (nom === '5_nuit') return nx - 0.30 * VW;     // le ninja à gauche, la lune à droite
  return nx - 0.42 * VW;                            // une course : un peu d'avance devant le ninja
}

export async function setup({ tracks, montage }) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  document.body.append(cv);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  // les recadrages, amortis (un ressort, comme l'intro), au pixel d'écran près
  const crops = {};
  for (const p of montage.plans) {
    const tr = tracks[p.nom], out = [];
    let c = null, v = 0, want = null;
    for (let i = 0; i < tr.length; i++) {
      want = Math.max(0, Math.min(PAN, aim(p.nom, tr[i], want ?? 0)));
      if (c == null) c = want;
      v += ((want - c) * 7 - v * 4.2) / FPS; c += v / FPS;
      out.push(Math.max(0, Math.min(PAN, c)));
    }
    crops[p.nom] = out;
  }
  // tailles : la phrase du haut prend la plus grande taille entière qui tient dans 1000 pixels (jamais collée aux
  // bords) ; la ligne dorée, toujours un cran plus petite que la phrase qu'elle accompagne
  const fit = (str, scale) => { while (scale > 2 && text(str, 'big', CREAM, scale).w > 1000) scale--; return scale; };
  const texts = CAPTIONS.map(([line, str, color, scale, t0, t1]) => ({ line, str, color, t0, t1, scale: fit(str, scale) }));
  for (const t of texts) if (t.line === 2) {
    const head = texts.find((h) => h.line === 1 && h.t0 <= t.t0 && h.t1 >= t.t0);
    if (head) t.scale = Math.min(t.scale, head.scale - 1);
  }
  const title = text('THE NINJA ADVENTURE', 'title', CREAM, 2);
  const imgs = new Map();
  const load = async (src) => { if (!imgs.has(src)) { const im = new Image(); im.src = src; await im.decode(); imgs.clear(); imgs.set(src, im); } return imgs.get(src); };

  /** Le cadre d'un plan (image i), recadré, dans la zone du jeu. */
  function shot(im, nom, i) {
    const gx = Math.round(crops[nom][Math.min(i, crops[nom].length - 1)] * K);
    g.drawImage(im, gx, 0, CW, GH, 0, GY, CW, GH);
  }
  /**
   * Le raccord : un coup de pinceau qui balaie le cadre de gauche à droite (le haut part le premier), découvre le
   * plan suivant derrière son bord déchiqueté et laisse un liseré d'encre. p : 0 → 1. draw() peint le plan suivant.
   */
  function brushCut(p, seed, draw) {
    if (p <= 0) return;
    const cols = CW / K, rows = GH / K, fronts = [];
    g.save(); g.beginPath();
    for (let j = 0; j < rows; j++) {
      const lag = (j / rows) * 0.28 + 0.07 * noise(j * 0.09, seed);
      const front = Math.round((easeOut(p) * 1.38 - lag) * cols + (noise(j * 0.45, seed + 3) - 0.5) * 6);
      fronts.push(front);
      if (front > 0) g.rect(0, GY + j * K, Math.min(cols, front) * K, K);
    }
    g.clip(); draw(); g.restore();
    // le liseré : deux ou trois pixels d'encre au bord qui avance (plus maigre vers la fin, brosse sèche)
    g.fillStyle = `rgb(${INK})`;
    for (let j = 0; j < rows; j++) {
      const f = fronts[j];
      if (f <= 0 || f >= cols) continue;
      const w = 2 + (hash(j, 1, seed) < 0.45 ? 1 : 0) - (p > 0.8 && hash(j, 2, seed) < 0.5 ? 1 : 0);
      for (let i = 0; i < w; i++) if (f + i < cols && !(i === w - 1 && hash(j, i, seed + 9) < 0.3)) g.fillRect((f + i) * K, GY + j * K, K, K);
    }
  }

  window.frame = async (f, srcs) => {
    const s = f / FPS;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    // les plans actifs : le plus ancien en dessous, le suivant découvert par le coup de pinceau
    const act = montage.plans.filter((p) => srcs[p.nom]);
    for (const [k, p] of act.entries()) {
      const im = await load(srcs[p.nom]);
      const i = f - p.a;
      if (k === 0 && act.length === 1 && p.a > 0 && i >= CUT) shot(im, p.nom, i);
      else if (k === 0 && act.length > 1) shot(im, p.nom, i);
      else if (i < CUT) brushCut((i + 1) / CUT, 3 + montage.plans.indexOf(p) * 7, () => shot(im, p.nom, i));
      else shot(im, p.nom, i);
    }
    // les bords du cadre se fondent dans le noir (haut et bas), sans trait
    for (const [y0, dir] of [[GY, 1], [GY + GH, -1]]) {
      const gr = g.createLinearGradient(0, y0, 0, y0 + dir * 90);
      gr.addColorStop(0, 'rgba(11,12,18,1)'); gr.addColorStop(1, 'rgba(11,12,18,0)');
      g.fillStyle = gr; g.fillRect(0, Math.min(y0, y0 + dir * 90), W, 90);
    }
    // la carte de fin, sur le ciel de la nuit : le coup de pinceau, le titre qui se découvre, le trait doré
    if (s > END.band) {
      const cy = GY + 330;
      brushBand(g, 20, 1060, cy, 150, (s - END.band) / 0.38, 3);
      if (s > END.title) {
        const r = easeOut((s - END.title) / 0.45), x0 = Math.round((W / 2 - title.w / 2) / 2) * 2, y0 = cy - title.h / 2 - 12;
        g.save(); g.beginPath(); g.rect(x0, y0 - 8, title.w * r, title.h + 16); g.clip();
        drawText(g, title, x0, y0); g.restore();
        if (s > END.stroke) brush(g, Math.round((W / 2 - 260) / K) * K, Math.round((cy + 44) / K) * K, 520, 10, (s - END.stroke) / 0.4, GOLD, 5);
      }
    }
    // les textes du haut : lettre à lettre (26 lettres/s), une petite montée pour la ligne dorée, puis un fondu
    for (const t of texts) {
      if (s < t.t0 || s > t.t1 + 0.3) continue;
      const a = 1 - ss((s - t.t1) / 0.28), n = Math.floor((s - t.t0) * (t.line === 1 ? 26 : 30)) + 1;
      const y = t.line === 1 ? Y1 : Y2 + Math.round((1 - easeOut((s - t.t0) / 0.3)) * 2) * 4;
      typed(g, t.str, 'big', t.color, t.scale, W / 2, y, n, a);
    }
    // la fin : un fondu au noir (Instagram reprend la vidéo au début, qui sort du noir)
    if (s > END.black) { g.fillStyle = `rgba(11,12,18,${ss((s - END.black) / 0.4)})`; g.fillRect(0, 0, W, H); }
    return cv.toDataURL('image/png');
  };
}
