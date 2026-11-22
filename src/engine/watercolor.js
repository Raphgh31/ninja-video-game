// Le filtre « aquarelle » (essai du 22 novembre 2026, demande de Raph, d'après une image de référence :
// un Japon peint à l'eau, des couleurs plus douces). Il s'applique à l'image déjà composée de chaque
// calque, à chaque image, juste avant l'interface — donc à tout ce qui est peint (décor, terrain,
// personnages, premier plan), sans retoucher aucun dessin :
//   - lavis : des zones un peu plus claires ou plus chargées, irrégulières, accrochées au monde (elles ne
//     glissent pas quand la caméra bouge) ;
//   - grain du papier, fin ;
//   - l'eau qui éclaircit : les couleurs remontent un peu vers le papier (jamais de noir profond) ;
//   - le paysage lointain, peint plus mouillé : un très léger adoucissement en plus.
// Une intensité par calque (WATERCOLOR). ?aquarelle=0 dans l'adresse l'enlève (pour comparer).
import { canvas } from '../game/potager/paint.js';

export const WATERCOLOR = {
  // le paysage du fond (calque fin, à la résolution de l'écran)
  back: { wash: 0.14, mottle: 0.85, grain: 0.55, scale: 1, blur: 0.45 },
  // le jeu : terrain, décors, personnages, premier plan (plus discret : il doit rester lisible)
  front: { wash: 0.08, mottle: 0.6, grain: 0.32, scale: 1, blur: 0 },
  paper: '#f6efdd',
};

/** Hasard déterministe (pour des textures toujours identiques). */
function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Bruit lisse qui se raccorde sur ses bords (texture répétable), plusieurs octaves ; rend des niveaux de gris. */
function tileNoise(size, cells, amp, seed) {
  const r = rand(seed), field = new Float32Array(size * size);
  cells.forEach((n, o) => {
    const grid = Array.from({ length: n * n }, () => r() * 2 - 1);
    const at = (i, j) => grid[((j + n) % n) * n + ((i + n) % n)];
    const s = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = (x / size) * n, gy = (y / size) * n, i = Math.floor(gx), j = Math.floor(gy), fx = s(gx - i), fy = s(gy - j);
      const v = at(i, j) * (1 - fx) * (1 - fy) + at(i + 1, j) * fx * (1 - fy) + at(i, j + 1) * (1 - fx) * fy + at(i + 1, j + 1) * fx * fy;
      field[y * size + x] += v * amp[o];
    }
  });
  const c = canvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let k = 0; k < size * size; k++) {
    const v = Math.max(0, Math.min(255, Math.round(128 + field[k] * 127)));
    img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Grain du papier : fin, irrégulier, quelques fibres. */
function paperGrain(size, seed) {
  const r = rand(seed), c = canvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let k = 0; k < size * size; k++) {
    let v = 128 + (r() - 0.5) * 70;
    if (r() < 0.015) v -= 40;                    // un grain plus marqué
    img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < size / 6; i++) {           // de petites fibres
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 3 + r() * 6;
    g.strokeStyle = r() < 0.5 ? 'rgba(90,90,90,0.25)' : 'rgba(200,200,200,0.25)';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}

export class Watercolor {
  constructor() {
    this.on = !/[?&]aquarelle=0\b/.test(location.search);
    this.mottle = tileNoise(256, [3, 6, 12, 32], [0.5, 0.28, 0.16, 0.12], 7);
    this.grain = paperGrain(128, 11);
    this.ov = canvas(1, 1);
  }

  /**
   * Applique le filtre au calque ctx (sa toile entière, en pixels de la toile). opts : un réglage de
   * WATERCOLOR ; k : pixels de toile par pixel de jeu ; cam : la caméra (les lavis suivent le monde) ;
   * par : parallaxe des lavis (1 = le terrain, moins = un plan lointain) ; masked : seulement là où le
   * calque est peint (le jeu est transparent hors du terrain).
   */
  apply(ctx, opts, { k = 1, cam = { x: 0, y: 0 }, par = 1, masked = true } = {}) {
    if (!this.on) return;
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    if (this.ov.width !== W || this.ov.height !== H) { this.ov.width = W; this.ov.height = H; }
    const o = this.ov.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // un léger adoucissement (le paysage lointain, peint plus mouillé)
    if (opts.blur > 0 && 'filter' in ctx && W * H <= 1300000) {   // (pas sur les très grands écrans : trop coûteux à chaque image)
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'copy'; o.filter = `blur(${opts.blur * k}px)`;
      o.drawImage(cv, 0, 0); o.filter = 'none';
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.55; ctx.drawImage(this.ov, 0, 0); ctx.globalAlpha = 1;
    }
    // les lavis et le grain, en lumière douce (le gris moyen ne change rien)
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.clearRect(0, 0, W, H);
    const ms = 1.6 * k * opts.scale;
    const mp = o.createPattern(this.mottle, 'repeat');
    mp.setTransform(new DOMMatrix().translate(-((cam.x * par * k) % (256 * ms)), -((cam.y * par * k) % (256 * ms))).scale(ms));
    o.fillStyle = mp; o.globalAlpha = opts.mottle; o.fillRect(0, 0, W, H);
    const gs = Math.max(1, Math.round(k / 2));
    const gp = o.createPattern(this.grain, 'repeat');
    gp.setTransform(new DOMMatrix().translate(-((cam.x * par * k) % (128 * gs)), -((cam.y * par * k) % (128 * gs))).scale(gs));
    o.globalAlpha = opts.grain; o.fillStyle = gp; o.fillRect(0, 0, W, H);
    o.globalAlpha = 1;
    // (gris neutre sous les textures : là où elles sont transparentes, rien ne change)
    o.globalCompositeOperation = 'destination-over'; o.fillStyle = '#808080'; o.fillRect(0, 0, W, H);
    if (masked) { o.globalCompositeOperation = 'destination-in'; o.drawImage(cv, 0, 0); }
    ctx.globalCompositeOperation = 'soft-light'; ctx.drawImage(this.ov, 0, 0);
    // l'eau qui éclaircit : un voile de papier, là où c'est peint
    o.globalCompositeOperation = 'copy'; o.fillStyle = WATERCOLOR.paper; o.fillRect(0, 0, W, H);
    if (masked) { o.globalCompositeOperation = 'destination-in'; o.drawImage(cv, 0, 0); }
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = opts.wash; ctx.drawImage(this.ov, 0, 0);
    ctx.restore();
  }
}
