// Introduction au lancement du jeu (planche : docs/intro/planche_ouvertures.png, ouvertures 1 et 4
// combinées à la demande de l'utilisateur) :
//   1. le noir ; « THE NINJA GAME » s'écrit lettre à lettre, au pied des montagnes, puis un
//      coup de pinceau se tire dessous (large à la base, effilé à la fin, quelques éclaboussures) ;
//   2. l'encre finie, la lune se lève derrière la grande chaîne du Potager : elle éclaircit le ciel
//      et les montagnes sortent du noir ; leur pied se fond par paliers dans une base d'encre ;
//   3. KAGE arrive en ombre chinoise, en coup de pied sauté, jusqu'au centre de la lune : là,
//      l'image se fige ;
//   4. le menu apparaît (boutons de l'écran titre, sans cadre) ; au choix, l'intro s'efface sur le jeu.
// Une touche ou un toucher pendant l'intro l'amène à sa fin. Tout est dessiné à la résolution du
// jeu (1 pixel = 1 pixel de jeu), dans son propre canvas posé dans le calque de l'interface.
import { renderText, measure, FONTS } from '../engine/pixelfont.js';
import { canvas, pick, noise2, ih, rgb, mixHex } from './potager/paint.js';
import { paintFar, paintMid } from './potager/backdrop.js';

const INK = '#e9e5da', BLACK = '#05080a';
const TITLE = 'THE NINJA GAME';
const FONT = { font: 'title', spacing: 1.25 };

/** Le déroulé, en secondes depuis le début. */
export const INTRO = {
  letters: 0.9,      // première lettre
  letterGap: 0.26,   // une lettre toutes les…
  letterFade: 0.8,   // fondu d'une lettre
  brush: 5.2,        // le coup de pinceau…
  brushTime: 0.9,    // …tiré en
  moon: 6.7,         // la lune commence à monter
  moonTime: 5.2,     // …et finit de monter
  kage: 12.1,        // KAGE entre dans l'image…
  kageTime: 1.1,     // …et arrive au centre de la lune : l'image se fige
  menu: 13.7,        // le menu apparaît
  fadeOut: 1.6,      // l'intro s'efface sur le jeu
};
const FREEZE = INTRO.kage + INTRO.kageTime;

// les couleurs de la nuit
const SKY = ['#04060c', '#060a14', '#0a101f', '#0f182b', '#15203a'];
const FAR = ['#04070b', '#0a111c', '#121c2c', '#1b293e', '#273a54', '#3a4f6c'];
const MID = ['#04070b', '#081019', '#0e1824', '#152234', '#1f2e44'];
// la base, au pied des montagnes : une encre neutre, presque noire, qui fonce vers le bas
const BASE = ['#060708', '#08090b', '#0b0c0f', '#0e1013', '#121418'];
const MOON = ['#8d93a6', '#b5b8c4', '#d7d6cf', '#ece8da'];
const MOON_R = 40;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;

/** Peint un pixel. */
const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

/**
 * Le coup de pinceau, de gauche à droite : attaque arrondie, large à la base (5 pixels), qui
 * s'amincit jusqu'à un pixel, fin sèche et cassée, très légèrement incurvé ; quelques gouttes d'encre projetées autour de
 * l'attaque, le long du trait, et au-delà de la fin. Chaque pixel : [x, y, u] (u : quand il apparaît).
 */
function brushPixels(half) {
  const out = [];
  const L = 2 * half;
  const bow = (u) => Math.round(2 * 4 * clamp01(u) * (1 - clamp01(u)));   // très légère courbe : 2 px plus bas au milieu
  for (let x = -half; x <= half; x++) {
    const u = (x + half) / L;
    const th = u < 0.012 ? 3 : u < 0.03 ? 4 : Math.max(1, Math.round(5 - 4.4 * clamp01((u - 0.1) / 0.72)));
    for (let r = 0; r < th; r++) {
      const dry = u > 0.55 && th > 1 && noise2(x * 0.22, r * 3.1, 11) < (u - 0.55) * 1.4;   // les poils qui s'écartent
      if (dry || (u > 0.9 && ih(x, 2, 5) < (u - 0.9) * 5)) continue;                       // la fin se casse
      out.push([x, r - (th >> 1) + bow(u), u]);
    }
  }
  // éclaboussures : des gouttes d'un pixel (parfois deux), plus nombreuses et plus loin à l'attaque
  const drop = (u, dx, dy, big) => {
    const x = Math.round(-half + u * L + dx);
    out.push([x, dy + bow(u), Math.min(1, u)]);
    if (big) out.push([x + 1, dy + bow(u), Math.min(1, u)]);
  };
  for (let i = 0; i < 7; i++) {                                     // autour de l'attaque
    const u = 0.01 + 0.09 * ih(i, 1, 21), side = ih(i, 2, 21) < 0.55 ? -1 : 1;
    drop(u, (ih(i, 3, 21) - 0.5) * 6, side * Math.round(4 + 5 * ih(i, 4, 21)), ih(i, 5, 21) < 0.35);
  }
  for (let i = 0; i < 4; i++) {                                     // le long du trait
    const u = 0.2 + 0.5 * ih(i, 1, 22), side = ih(i, 2, 22) < 0.5 ? -1 : 1;
    drop(u, 0, side * Math.round(3 + 2 * ih(i, 4, 22)), false);
  }
  for (let i = 0; i < 4; i++) {                                     // le pinceau qui part : une traînée de gouttes
    drop(1.02 + 0.03 * i + 0.02 * ih(i, 1, 23), 0, Math.round((ih(i, 2, 23) - 0.5) * 2), false);
  }
  return out;
}

/** La lune et sa clarté (anneaux nets, aucun flou). */
function paintMoon() {
  const RG = MOON_R * 3.2, S = Math.ceil(RG) * 2 + 1, o = Math.ceil(RG), c = canvas(S, S), g = c.getContext('2d');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - o, y - o);
    if (d > MOON_R && d < RG) {
      const step = Math.floor((1 - (d - MOON_R) / (RG - MOON_R)) * 5) + 1;
      g.fillStyle = `rgba(150,165,200,${(0.045 * step).toFixed(3)})`; g.fillRect(x, y, 1, 1);
    } else if (d <= MOON_R) {
      const dx = x - o, dy = y - o, k = d / MOON_R;
      const lit = 0.8 - 0.3 * k + 0.3 * (noise2(dx * 0.08, dy * 0.08, 3) - 0.5) - 0.18 * Math.max(0, (dx + dy) / MOON_R);
      dot(g, x, y, pick(MOON, lit, x, y, 0.5));
    }
  }
  return { c, o };
}

export class Intro {
  /**
   * meta : kage.json (cellule, ancrage, champ intro) ; kick : la bande du coup de pied sauté
   * (kage_intro_kick.png : l'élan, l'armé, le coup) ; far : la grande chaîne déjà peinte par le
   * Potager s'il est chargé (sinon on la peint, comme la chaîne voisine).
   */
  constructor(meta, kick, far = null) {
    this.meta = meta;
    this.kick = kick;
    this.far = far ?? paintFar(480);
    this.mid = paintMid(480);
    this.el = canvas(1, 1);
    this.el.className = 'intro';
    this.g = this.el.getContext('2d');
    this.t = 0;
    this.menuShown = false;
    this.onMenu = null;            // appelé une fois, quand le menu doit apparaître
    this.letters = [...TITLE].map((ch) => (ch === ' ' ? null : renderText(ch, { font: FONT.font, color: INK })));
    this.moon = paintMoon();
    this.sil = new Map();          // silhouettes de KAGE déjà découpées
    this.raf = 0;
    this.last = 0;
  }

  /** (Re)compose la scène pour une image de w × h pixels de jeu. */
  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.el.width = w; this.el.height = h;
    this.g.imageSmoothingEnabled = false;
    // les deux chaînes, posées comme au début du Potager ; le Mont Kagero à droite
    const lay = (strip, sx, y) => { const c = canvas(w, h), g = c.getContext('2d'); g.drawImage(strip.img, -sx, y); return c; };
    const ground = Math.round(h * 0.86);
    const farC = lay(this.far, 430 - (w - 60), ground - 40 - 222);
    const midC = lay(this.mid, 0, ground - 24 - 160);
    const fd = farC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const md = midC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    // le pied des montagnes se fond dans la base par paliers nets (le dessin reste lisible), entre f0 et f1 ;
    // sous f1, la base seule, qui fonce doucement vers le bas
    const f0 = Math.round(h * 0.45), f1 = Math.round(h * 0.63);
    const baseAt = (x, y) => pick(BASE, 0.9 - 0.85 * clamp01((y - f1) / (h - f1)), x, y, 0.3);
    this.land = canvas(w, h); this.black = canvas(w, h);
    const lg = this.land.getContext('2d'), bg = this.black.getContext('2d');
    const out = lg.createImageData(w, h), blk = bg.createImageData(w, h);
    const [br, bgg, bb] = rgb(BLACK);
    this.ridge = new Int16Array(w).fill(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onMid = md[i + 3] > 0, onFar = fd[i + 3] > 0;
      if (!onMid && !onFar && y < f1) continue;
      let c;
      if (y >= f1) c = baseAt(x, y);
      else {
        const s = onMid ? md : fd, l = (0.3 * s[i] + 0.55 * s[i + 1] + 0.15 * s[i + 2]) / 255;
        c = onMid ? pick(MID, l * 0.95 - 0.1, x, y, 0.5) : pick(FAR, l * 0.95 - 0.15, x, y, 0.5);
        if (y >= f0) c = mixHex(c, BASE[4], Math.floor(((y - f0) / (f1 - f0)) * 6) / 6);   // six paliers vers la base
      }
      const [r, g, b] = rgb(c);
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
      blk.data[i] = br; blk.data[i + 1] = bgg; blk.data[i + 2] = bb; blk.data[i + 3] = 255;
      if (y < this.ridge[x]) this.ridge[x] = y;
    }
    lg.putImageData(out, 0, 0); bg.putImageData(blk, 0, 0);
    // le ciel de nuit, tramé, et ses étoiles
    this.sky = canvas(w, h);
    const sg = this.sky.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dot(sg, x, y, pick(SKY, y / (h * 0.68), x, y, 0.6));
    this.stars = [];
    for (let i = 0; i < Math.round(w * 0.3); i++) {
      const x = Math.floor(noise2(i * 7.1, 1, 1) * 99991) % w, y = Math.floor(noise2(i * 3.3, 6, 2) * 79193) % Math.round(h * 0.6);
      if (y < this.ridge[x]) this.stars.push({ x, y, c: i % 6 ? '#3e4a66' : '#a7b2c8', p: i * 1.7 });
    }
    // le titre, le pinceau, le menu : sur la base, au pied des montagnes
    this.titleW = measure(TITLE, FONT.font, FONT.spacing);
    this.titleX = Math.round((w - this.titleW) / 2);
    this.titleY = f1 + 2;
    const f = FONTS[FONT.font];
    let x = this.titleX;
    this.letterX = [...TITLE].map((ch) => { const at = x; x += measure(ch, FONT.font) + f.gap + FONT.spacing * f.k; return at; });
    const box = renderText(TITLE, FONT);
    const d = box.getContext('2d').getImageData(0, 0, box.width, box.height).data;
    let bottom = 0;
    for (let y = 0; y < box.height; y++) for (let xx = 0; xx < box.width; xx++) if (d[(y * box.width + xx) * 4 + 3]) bottom = y;
    this.lineY = this.titleY + bottom + 10;
    this.brush = brushPixels(Math.round(this.titleW / 2) - 14);
    this.menuY = this.lineY + 9;
    // la lune : monte derrière la chaîne, jusqu'au quart de l'image
    // au-dessus d'un col (là où les crêtes sont les plus basses), et assez haut pour que KAGE, figé
    // en son centre, se découpe tout entier sur le disque clair (jamais devant une montagne)
    const lowest = (cx, half) => { let m = h; for (let x = Math.max(0, cx - half); x <= Math.min(w - 1, cx + half); x++) m = Math.min(m, this.ridge[x]); return m; };
    let best = Math.round(w * 0.47);
    for (let cx = Math.round(w * 0.3); cx <= Math.round(w * 0.62); cx++) if (lowest(cx, 24) > lowest(best, 24)) best = cx;
    this.moonX = best;
    this.moonY1 = Math.max(MOON_R + 4, Math.min(Math.round(h * 0.25), lowest(best, 24) - 24));
    this.moonY0 = this.ridge[this.moonX] + MOON_R + 2;
  }

  /** Silhouette noire d'une image du coup de pied, et le centre de son corps (par rapport à l'ancrage). */
  silhouette(i) {
    let s = this.sil.get(i);
    if (s) return s;
    const { cell, pivot, intro } = this.meta, w = cell.w, h = cell.h;
    const c = canvas(w, h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(this.kick, i * intro.step, 0, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    g.globalCompositeOperation = 'source-in'; g.fillStyle = BLACK; g.fillRect(0, 0, w, h);
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    s = { c, cx: (x0 + x1) / 2 - pivot.x, cy: (y0 + y1) / 2 - pivot.y };
    this.sil.set(i, s);
    return s;
  }

  /**
   * KAGE au temps t : null avant son entrée ; sinon { i, x, y } (i : image du coup de pied ; x, y :
   * ancrage). Il entre par le bas de l'image, à gauche, genoux ramenés (l'élan), arme le coup en
   * montant, puis détend la jambe et arrive au centre de la lune, où il se fige.
   */
  kage(t) {
    const k = (Math.min(t, FREEZE) - INTRO.kage) / INTRO.kageTime;
    if (k < 0) return null;
    const hold = this.meta.intro.hold;
    const i = k >= 0.8 ? hold : k >= 0.42 ? 1 : 0;
    // le corps de l'image finale (jambe tendue) tombe au centre de la lune
    const end = this.silhouette(hold);
    const P2 = { x: this.moonX - end.cx, y: this.moonY1 - end.cy };
    const P0 = { x: -40, y: Math.round(this.h * 0.7) };
    const C = { x: (P0.x + P2.x) / 2, y: P2.y - 34 };                // une courbe qui monte puis redescend un peu
    const u = 1 - (1 - clamp01(k)) ** 1.6;                           // il ralentit un peu en arrivant
    const a = (1 - u) ** 2, b = 2 * u * (1 - u), c = u * u;
    return { i, x: Math.round(a * P0.x + b * C.x + c * P2.x), y: Math.round(a * P0.y + b * C.y + c * P2.y) };
  }

  /** Dessine l'image au temps courant (figée à l'arrivée de KAGE). */
  draw() {
    const { g, w, h } = this;
    const t = Math.min(this.t, FREEZE);
    g.fillStyle = BLACK; g.fillRect(0, 0, w, h);
    // la lune monte et éclaircit le ciel ; les montagnes sortent du noir avec elle
    const m = (t - INTRO.moon) / INTRO.moonTime;
    const light = smooth(m * 1.15);
    if (light > 0) {
      g.globalAlpha = light; g.drawImage(this.sky, 0, 0);
      for (const s of this.stars) {
        g.globalAlpha = light * (0.65 + 0.35 * Math.sin(t * 1.3 + s.p)); dot(g, s.x, s.y, s.c);
      }
      g.globalAlpha = 1;
    }
    if (m > 0) {
      const my = Math.round(this.moonY0 + (this.moonY1 - this.moonY0) * easeOut(m));
      g.drawImage(this.moon.c, this.moonX - this.moon.o, my - this.moon.o);
    }
    g.drawImage(this.black, 0, 0);
    if (light > 0) { g.globalAlpha = light; g.drawImage(this.land, 0, 0); g.globalAlpha = 1; }
    // l'encre : le titre lettre à lettre, puis le coup de pinceau
    this.letters.forEach((c, i) => {
      if (!c) return;
      const a = clamp01((t - INTRO.letters - i * INTRO.letterGap) / INTRO.letterFade);
      if (a <= 0) return;
      g.globalAlpha = a; g.drawImage(c, this.letterX[i], this.titleY); g.globalAlpha = 1;
    });
    const b = easeOut((t - INTRO.brush) / INTRO.brushTime);
    if (b > 0) {
      g.fillStyle = INK;
      const cx = Math.round(w / 2);
      for (const [x, y, u] of this.brush) if (u <= b) g.fillRect(cx + x, this.lineY + y, 1, 1);
    }
    // KAGE, en ombre chinoise
    const k = this.kage(t);
    if (k) {
      const s = this.silhouette(k.i), { pivot } = this.meta;
      g.drawImage(s.c, k.x - pivot.x, k.y - pivot.y);
    }
  }

  /** Avance de dt secondes (le menu s'annonce une fois, à son heure). */
  update(dt) {
    this.t += dt;
    if (!this.menuShown && this.t >= INTRO.menu) { this.menuShown = true; this.onMenu?.(); }
  }

  /** Passe directement à la fin : tout est en place, KAGE figé au centre de la lune. */
  skip() {
    if (this.t >= INTRO.menu) return;
    this.t = INTRO.menu;
    this.update(0);
  }

  /** Lance l'animation (sa propre boucle d'images). */
  start() {
    const step = (now) => {
      const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Arrête l'animation. */
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** S'efface sur le jeu, puis se retire ; done() quand c'est fini. */
  close(done) {
    this.el.classList.add('out');
    setTimeout(() => { this.stop(); this.el.remove(); done?.(); }, INTRO.fadeOut * 1000);
  }
}
