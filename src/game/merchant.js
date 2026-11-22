// Les marchands ambulants (un par chapitre : même silhouette, autres couleurs — ce n'est pas le même
// homme qui est partout). Refaits le 22 novembre 2026 (demande de Raph : l'ébauche du Potager était
// trop petite, pas assez travaillée, on ne remarquait pas son importance).
//
// Un vieil homme plus grand que le ninja : grand chapeau de paille conique (kasa) noué sous le menton,
// longue barbe, kimono et hakama, bâton de marche ; sur le dos, une hotte de bois (oi) chargée d'un
// coffre laqué aux coins dorés, d'un ballot de tissu à motifs, d'une natte roulée, et d'une petite
// lanterne de papier qui pend du montant. Il regarde vers la gauche (d'où arrive le ninja).
// Peint ici en pixels, une fois par palette et par image, avec un contour sombre ; lumière de gauche.
// Animations : il respire, sa barbe et la lanterne bougent ; quand le ninja approche, il le salue et
// fait sauter une pièce dans sa main.
import { canvas, rgb } from './potager/paint.js';

const OUT = '#1c1510';
/** Une palette par chapitre. Clés : r robe, a ceinture, b cordon du chapeau, h paille, k coffre, c ballot, p hakama, w barbe. */
export const MERCHANTS = {
  potager: {
    r: ['#2a4570', '#3b5d8f', '#5478ad'], a: ['#8c2c20', '#b8402e'], b: '#c8432f',
    h: ['#9b7f3e', '#c9a85a', '#e2c47c'], k: ['#4e1a15', '#7a2a22', '#a33a2c'], c: ['#3e6230', '#4f7a3a', '#6d9a4e'], dots: '#e9dcc0',
    p: ['#2e2822', '#4a4038'], w: ['#b9b3a4', '#f2efe6'], s: ['#b9845a', '#e2b088'], gold: ['#a8802c', '#e8c35a'],
  },
  foret: {
    r: ['#2f4527', '#46623a', '#66854e'], a: ['#283a64', '#3d5590'], b: '#3d5590',
    h: ['#7f6a38', '#a98d4e', '#c9ad6e'], k: ['#1e1916', '#33291f', '#4c3d2c'], c: ['#5e2c50', '#7a3e66', '#9a5a84'], dots: '#e8c35a',
    p: ['#2a2420', '#423830'], w: ['#8f8a80', '#c4bfb4'], s: ['#a9764e', '#d6a07a'], gold: ['#a8802c', '#e8c35a'],
  },
};

const W = 42, H = 52, FOOT = 50;   // la toile ; les pieds sur la ligne FOOT ; x = 17 : le milieu du corps

/** Peint une image du marchand. pose : 'idle' | 'greet' ; f : 0 ou 1 (respiration, barbe). */
function paint(P, pose, f) {
  const g = new Map();                       // "x,y" → couleur
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g.set(`${x},${y}`, c); };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
  const vline = (x, y0, y1, c) => { for (let y = y0; y <= y1; y++) put(x, y, c); };
  const breath = f;                          // le haut du corps monte d'un pixel sur une image sur deux
  const bob = pose === 'greet' ? 1 : 0;      // il s'incline un peu pour saluer

  // ---- la hotte, sur son dos (derrière tout le reste) ----------------------------------------------
  const py = -breath;
  vline(21, 5 + py, 40 + py, '#3a2616'); vline(22, 5 + py, 40 + py, '#6a4a2c');
  vline(32, 5 + py, 40 + py, '#3a2616'); vline(33, 5 + py, 40 + py, '#4e351f');
  for (const y of [8, 26, 38]) rect(21, y + py, 13, 1, '#5a3e24');
  // le coffre laqué, coins dorés
  rect(23, 28 + py, 9, 10, P.k[1]); rect(23, 28 + py, 9, 1, P.k[2]); rect(23, 28 + py, 1, 10, P.k[2]); rect(23, 37 + py, 9, 1, P.k[0]); rect(31, 28 + py, 1, 10, P.k[0]);
  rect(23, 32 + py, 9, 1, P.k[0]);
  for (const [x, y] of [[23, 28], [31, 28], [23, 37], [31, 37]]) put(x, y + py, P.gold[1]);
  put(27, 30 + py, P.gold[1]); put(27, 34 + py, P.gold[1]);
  // le ballot de tissu à motifs, noué en haut
  for (let y = 15; y <= 25; y++) {
    const half = y < 17 ? 4 : y > 23 ? 5 : 6;
    for (let x = 27 - half; x <= 27 + half; x++) {
      const c = x < 25 ? P.c[2] : x > 30 ? P.c[0] : P.c[1];
      put(x, y + py, (x * 3 + y * 5) % 7 === 0 ? P.dots : c);
    }
  }
  rect(25, 13 + py, 5, 2, P.c[0]); put(24, 12 + py, P.c[1]); put(30, 12 + py, P.c[1]);
  // la natte roulée tout en haut, liée de deux cordons
  for (let y = 9; y <= 12; y++) for (let x = 22; x <= 32; x++) put(x, y + py, y === 9 ? P.h[2] : y === 12 ? P.h[0] : P.h[1]);
  for (const x of [24, 30]) vline(x, 9 + py, 12 + py, '#6a4a2c');
  rect(21, 4 + py, 2, 1, '#6a4a2c'); rect(32, 4 + py, 2, 1, '#4e351f');
  // la petite lanterne de papier, accrochée au montant (elle se balance : drawn plus tard, à part)

  // ---- les jambes (hakama) et les sandales ----------------------------------------------------------
  for (let y = 36; y <= 46; y++) {
    const spread = Math.floor((y - 36) / 4);
    for (let x = 12 - spread; x <= 21 + spread; x++) put(x, y, x === 16 || x === 17 ? P.p[0] : x > 18 ? P.p[0] : P.p[1]);
  }
  rect(10, 47, 6, 2, '#e9e4d6'); rect(18, 47, 6, 2, '#d6d0c0');
  rect(9, 49, 7, 1, '#7a5a34'); rect(18, 49, 7, 1, '#6a4a2c');

  // ---- le corps : kimono, ceinture, col blanc --------------------------------------------------------
  const by = -breath;
  for (let y = 19; y <= 36; y++) {
    const x0 = 11 - Math.floor((y - 19) / 9), x1 = 21 + Math.floor((y - 19) / 8);
    for (let x = x0; x <= x1; x++) put(x, y + by, x <= x0 + 1 ? P.r[2] : x >= x1 - 2 ? P.r[0] : P.r[1]);
  }
  for (let i = 0; i < 5; i++) { put(14 + i, 19 + i + by, '#ece7da'); put(13 + i, 19 + i + by, '#ece7da'); }   // le col croisé
  for (let i = 0; i < 4; i++) put(15 + i, 20 + i + by, P.r[0]);
  rect(10, 29 + by, 13, 3, P.a[1]); rect(10, 31 + by, 13, 1, P.a[0]);                                 // la ceinture
  rect(19, 29 + by, 3, 4, P.a[0]); put(20, 33 + by, P.a[1]);                                          // son nœud

  // ---- le bras, la manche, le bâton --------------------------------------------------------------
  if (pose === 'greet') {
    // la main levée devant lui, une pièce entre les doigts
    for (let y = 20; y <= 27; y++) for (let x = 8 + Math.floor((27 - y) / 3); x <= 13; x++) put(x, y + by, x < 10 ? P.r[2] : P.r[1]);
    rect(6, 19 + by, 3, 3, P.s[1]); put(6, 21 + by, P.s[0]);
    vline(5, 18 + bob, 49, '#4e351f'); vline(4, 18 + bob, 49, '#7a5a34');                               // le bâton, appuyé
  } else {
    for (let y = 20; y <= 31; y++) for (let x = 8; x <= 13; x++) if (!(y > 28 && x > 11)) put(x, y + by, x < 10 ? P.r[2] : y > 28 ? P.r[0] : P.r[1]);
    rect(6, 30 + by, 3, 3, P.s[1]); put(8, 32 + by, P.s[0]);
    vline(7, 13 - breath, 49, '#4e351f'); vline(6, 13 - breath, 49, '#7a5a34');                          // le bâton, à la main
    put(6, 12 - breath, P.gold[1]); put(7, 12 - breath, P.gold[0]);                                     // son anneau
  }

  // ---- la tête : visage de profil, sourcil broussailleux, longue barbe ---------------------------------
  const hy = -breath + bob;
  rect(11, 12 + hy, 7, 8, P.s[1]);
  rect(11, 12 + hy, 7, 2, P.s[0]);                                   // l'ombre du chapeau
  put(10, 15 + hy, P.s[1]); put(10, 16 + hy, P.s[1]); put(9, 16 + hy, P.s[0]);   // le nez
  rect(16, 14 + hy, 2, 3, P.s[0]);                                   // l'oreille
  rect(17, 12 + hy, 2, 4, P.w[0]);                                   // les cheveux, noués derrière
  rect(11, 14 + hy, 3, 1, P.w[1]); put(12, 15 + hy, OUT);            // sourcil et œil
  // la barbe : elle tombe jusqu'à la ceinture et ondule
  const sway = f ? 1 : 0;
  for (let y = 17; y <= 27; y++) {
    const w0 = y < 20 ? 6 : Math.max(1, 6 - Math.floor((y - 20) * 0.7));
    const x0 = 10 + Math.floor((y - 17) / 4) - (y > 22 ? sway : 0);
    for (let x = x0; x < x0 + w0; x++) put(x, y + hy, x === x0 + w0 - 1 || y > 25 ? P.w[0] : P.w[1]);
  }
  rect(9, 17 + hy, 4, 1, P.w[1]);                                    // la moustache
  // ---- le chapeau de paille, conique, large ; son cordon sous le menton --------------------------------
  const cx = 14;
  for (let y = 2; y <= 11; y++) {
    const half = Math.round((y - 1) * 1.25);
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / Math.max(1, half);
      let c = u < -0.35 ? P.h[2] : u > 0.4 ? P.h[0] : P.h[1];
      if ((y - 2) % 3 === 2 && x % 2 === 0) c = P.h[0];               // le tressage
      put(x, y + hy, c);
    }
  }
  rect(cx - 12, 12 + hy, 25, 1, P.h[0]);                              // le bord
  rect(cx - 1, 1 + hy, 3, 1, P.h[1]);                                 // la pointe
  for (let i = 0; i < 6; i++) put(16 - Math.floor(i / 3), 13 + i + hy, P.b);   // le cordon

  // ---- contour sombre autour de la silhouette ---------------------------------------------------------
  const cv = canvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  const at = (x, y) => g.get(`${x},${y}`);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = at(x, y);
    if (!c && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) c = OUT;
    if (!c) continue;
    const [r, gg, b] = rgb(c), k = (y * W + x) * 4;
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Le marchand d'un chapitre : ses images (peintes une fois), et son dessin à chaque image du jeu. */
export class MerchantArt {
  constructor(kind = 'potager') {
    this.P = MERCHANTS[kind] ?? MERCHANTS.potager;
    this.frames = {};
    for (const pose of ['idle', 'greet']) this.frames[pose] = [0, 1].map((f) => paint(this.P, pose, f));
    this.greet = 0;                 // 0 → 1 quand le ninja s'approche
  }

  /**
   * Dessine le marchand, pieds en (sx, sy) (coordonnées de l'image), au temps time ; near : le ninja est
   * tout près (il le salue). dt : pour la transition du salut.
   */
  draw(ctx, sx, sy, time, near = false, dt = 1 / 60) {
    this.greet += ((near ? 1 : 0) - this.greet) * Math.min(1, dt * 8);
    const pose = this.greet > 0.5 ? 'greet' : 'idle';
    const f = Math.floor(time * 1.4) % 2;
    const x = Math.round(sx - 17), y = Math.round(sy - FOOT);
    // une ombre douce au sol
    ctx.fillStyle = 'rgba(20, 14, 10, 0.28)';
    ctx.fillRect(x + 6, y + FOOT, 30, 1); ctx.fillRect(x + 9, y + FOOT + 1, 24, 1);
    ctx.drawImage(this.frames[pose][f], x, y);
    // la lanterne de papier qui pend du montant de la hotte, et sa lueur
    const sw = Math.round(Math.sin(time * 1.7) * 1.2), lx = x + 35 + sw, ly = y + 6 - f;
    ctx.fillStyle = '#3a2616'; ctx.fillRect(x + 33, y + 4 - f, 3, 1); ctx.fillRect(lx, ly - 1, 1, 2);
    ctx.globalAlpha = 0.18 + 0.04 * Math.sin(time * 6);
    ctx.fillStyle = '#ffc870'; ctx.fillRect(lx - 4, ly + 1, 10, 9); ctx.fillRect(lx - 2, ly - 1, 6, 13);
    ctx.globalAlpha = 1;
    ctx.fillStyle = OUT; ctx.fillRect(lx - 2, ly + 1, 5, 7);
    ctx.fillStyle = '#f4e2b0'; ctx.fillRect(lx - 1, ly + 2, 3, 5);
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(lx, ly + 3, 1, 3);
    ctx.fillStyle = this.P.a[1]; ctx.fillRect(lx - 1, ly + 1, 3, 1); ctx.fillRect(lx - 1, ly + 7, 3, 1);
    // la pièce qu'il fait sauter quand il salue
    if (pose === 'greet') {
      const k = (time * 1.6) % 1, hop = Math.round(Math.sin(k * Math.PI) * 7);
      const gx = x + 7, gy = y + 16 - hop - f;
      ctx.fillStyle = OUT; ctx.fillRect(gx - 1, gy - 1, 4, 4);
      ctx.fillStyle = Math.floor(time * 8) % 2 ? this.P.gold[1] : this.P.gold[0]; ctx.fillRect(gx, gy, 2, 2);
      if (hop > 5) { ctx.fillStyle = '#fff6d0'; ctx.fillRect(gx + 2, gy - 2, 1, 1); }
    }
  }
}

/** Le campement de la Forêt : une natte posée au sol, ses marchandises, une perche et sa lanterne. */
export function drawCamp(ctx, sx, sy, time, P = MERCHANTS.foret) {
  const x = Math.round(sx), y = Math.round(sy);
  // la natte (goza), vue de biais
  for (let j = 0; j < 4; j++) {
    ctx.fillStyle = j === 0 ? '#c9ad6e' : j === 3 ? '#7f6a38' : '#a98d4e';
    ctx.fillRect(x + 8 - j, y - 4 + j, 44 + j * 2, 1);
  }
  ctx.fillStyle = '#7f6a38'; for (let i = 0; i < 44; i += 4) ctx.fillRect(x + 8 + i, y - 4, 1, 4);
  // les marchandises : rouleaux de tissu, pots, un éventail, petits sacs
  const goods = [[12, '#b8402e', 6, 4], [19, '#3d5590', 6, 4], [27, '#d6ba78', 5, 5], [34, P.c[1], 7, 5], [43, '#5a6a72', 5, 6]];
  for (const [gx, col, w, h] of goods) {
    ctx.fillStyle = OUT; ctx.fillRect(x + gx - 1, y - 4 - h - 1, w + 2, h + 1);
    ctx.fillStyle = col; ctx.fillRect(x + gx, y - 4 - h, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + gx, y - 4 - h, w, 1);
  }
  // la perche, son petit rideau (noren) et sa lanterne
  ctx.fillStyle = '#3a2616'; ctx.fillRect(x + 56, y - 40, 2, 40);
  ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 56, y - 40, 1, 40);
  ctx.fillStyle = '#3a2616'; ctx.fillRect(x + 44, y - 40, 14, 1);
  for (let i = 0; i < 3; i++) {
    const wave = Math.round(Math.sin(time * 1.3 + i) * 0.6);
    ctx.fillStyle = P.r[1]; ctx.fillRect(x + 45 + i * 4, y - 39, 3, 11 + wave);
    ctx.fillStyle = P.r[2]; ctx.fillRect(x + 45 + i * 4, y - 39, 1, 11 + wave);
  }
  ctx.fillStyle = '#e9dcc0'; ctx.fillRect(x + 49, y - 35, 3, 3);
  const sw = Math.round(Math.sin(time * 1.5) * 1);
  ctx.globalAlpha = 0.2 + 0.05 * Math.sin(time * 5);
  ctx.fillStyle = '#ffc870'; ctx.fillRect(x + 58 + sw, y - 36, 12, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a2616'; ctx.fillRect(x + 57, y - 38, 7, 1); ctx.fillRect(x + 63 + sw, y - 38, 1, 3);
  ctx.fillStyle = OUT; ctx.fillRect(x + 61 + sw, y - 35, 6, 9);
  ctx.fillStyle = '#c8432f'; ctx.fillRect(x + 62 + sw, y - 34, 4, 7);
  ctx.fillStyle = '#ffb060'; ctx.fillRect(x + 63 + sw, y - 33, 2, 5);
}
