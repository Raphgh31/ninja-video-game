// Montage d'un Reel (1080 × 1920, 30 images/s) à partir des images tournées dans le jeu (tools/reels/tourner.cjs).
// Chaque image du Reel est composée ici, dans une toile : le cadre du jeu (recadré, panoramique au pixel d'écran
// près), les textes dans la police du jeu (src/engine/pixelfont.js), les taches et traits d'encre en pixels de jeu
// (4 × 4 pixels d'écran, comme le jeu). Lancé par tools/reels/monter.mjs.
import { W, H, FPS, K, GW, GH, CW, VW, PAN, GY, BG, CREAM, GOLD, ss, easeOut, text, drawText, typed, brushBand, brush, inkWipe } from './encre.js';

export async function setup({ track, n }) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  document.body.append(cv);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  // le recadrage : d'abord le soleil, puis un lent panoramique qui accompagne le ninja (amorti, au pixel d'écran)
  const crop = [];
  let c = 22, v = 0;
  for (let f = 0; f < n; f++) {
    const l = track[f], s = f / FPS;
    let want = 22 + 26 * ss((s - 1.3) / 1.8);
    if (!l.hide) want = Math.max(want, Math.min(PAN, (l.x - l.cx) - 0.44 * VW));
    v += ((want - c) * 7 - v * 4.2) / FPS; c += v / FPS;
    crop.push(Math.max(0, Math.min(PAN, c)));
  }
  const L1 = "I'm making a video game.", L2 = 'Alone.', T1 = 'THE NINJA ADVENTURE';
  const title = text(T1, 'title', CREAM, 2);
  const week = text('WEEK 1', 'big', GOLD, 4);
  const sub = text("I'll show you everything.", 'big', CREAM, 3);

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
    const out1 = 1 - ss((s - 4.2) / 0.45);
    if (s > 0.3 && out1 > 0) {
      const n1 = Math.floor((s - 0.3) * 26);
      typed(g, L1, 'big', CREAM, 4, W / 2, 236, n1, out1);
      if (s > 1.55) {
        const a = easeOut((s - 1.55) / 0.3), t2 = text(L2, 'big', GOLD, 6);
        drawText(g, t2, W / 2 - t2.w / 2, 318 + Math.round((1 - a) * 3) * 4, a * out1);
      }
    }
    // la carte de titre : un coup de pinceau à l'encre sur le ciel, le titre qui se découvre, un trait doré ;
    // puis, au-dessus du cadre, « WEEK 1 » et la promesse
    const cy = GY + 300;
    if (s > 5.15) {
      brushBand(g, 20, 1060, cy, 150, (s - 5.15) / 0.38, 3);
      if (s > 5.4) {
        const r = easeOut((s - 5.4) / 0.45), x0 = Math.round((W / 2 - title.w / 2) / 2) * 2, y0 = cy - title.h / 2 - 12;
        g.save(); g.beginPath(); g.rect(x0, y0 - 8, title.w * r, title.h + 16); g.clip();
        drawText(g, title, x0, y0); g.restore();
        if (s > 5.75) brush(g, Math.round((W / 2 - 260) / K) * K, Math.round((cy + 44) / K) * K, 520, 10, (s - 5.75) / 0.4, GOLD, 5);
      }
      if (s > 6.15) {
        const a = easeOut((s - 6.15) / 0.35);
        drawText(g, week, W / 2 - week.w / 2, 226 + Math.round((1 - a) * 3) * 4, a);
      }
      if (s > 6.55) drawText(g, sub, W / 2 - sub.w / 2, 320, ss((s - 6.55) / 0.4));
    }
    // la sortie : un grand coup d'encre balaie tout, vers la suite de la vidéo
    inkWipe(g, (s - 8.35) / 0.75);
    return cv.toDataURL('image/png');
  };
}
