// Introduction au lancement du jeu (planche : docs/intro/planche_ouvertures.png, ouvertures 1 et 4
// combinées à la demande de l'utilisateur) :
//   1. le noir ; « THE NINJA GAME » s'écrit lettre à lettre, au pied des montagnes, puis un
//      coup de pinceau se tire dessous ;
//   2. l'encre finie, la lune se lève derrière la grande chaîne du Potager : elle éclaircit le ciel
//      et les montagnes sortent du noir ;
//   3. KAGE arrive en ombre chinoise, traverse la lune d'un coup de sabre et se pose sur un sommet ;
//   4. le menu apparaît (boutons de l'écran titre, sans cadre) ; au choix, l'intro s'efface sur le jeu.
// Une touche ou un toucher pendant l'intro l'amène à sa fin. Tout est dessiné à la résolution du
// jeu (1 pixel = 1 pixel de jeu), dans son propre canvas posé dans le calque de l'interface.
import { renderText, measure, FONTS } from '../engine/pixelfont.js';
import { Animator } from '../engine/sprites.js';
import { canvas, pick, noise1, noise2, fbm1, rgb } from './potager/paint.js';
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
  kage: 12.1,        // KAGE entre dans l'image
  kageTime: 1.25,    // durée du saut (entrée → sommet)
  menu: 14.0,        // le menu apparaît
  fadeOut: 1.6,      // l'intro s'efface sur le jeu
};

// les couleurs de la nuit
const SKY = ['#04060c', '#060a14', '#0a101f', '#0f182b', '#15203a'];
const FAR = ['#04070b', '#0a111c', '#121c2c', '#1b293e', '#273a54', '#3a4f6c'];
const MID = ['#04070b', '#081019', '#0e1824', '#152234', '#1f2e44'];
const BASE = ['#03050a', '#060a12', '#0a111b', '#0e1724', '#121d2c'];   // collines au pied de la chaîne, du bas vers le haut
const HAZE = '#121d2e';     // brume au pied des montagnes
const MOON = ['#8d93a6', '#b5b8c4', '#d7d6cf', '#ece8da'];
const RIM = '#6f7a93';      // liseré de lune sur KAGE posé
const MOON_R = 40;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;

/** Peint un pixel. */
const dot = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

/** Le coup de pinceau, de gauche à droite : attaque épaisse, corps plein, fin effilée et sèche. */
function brushPixels(half) {
  const out = [];
  for (let x = -half; x <= half; x++) {
    const u = (x + half) / (2 * half);
    const th = u < 0.03 ? 2 : u < 0.5 ? 4 : u < 0.78 ? 3 : u < 0.92 ? 2 : 1;
    for (let r = 0; r < th; r++) {
      const dry = u > 0.62 && noise2(x * 0.22, r * 3.1, 11) < (u - 0.62) * 1.6;   // les poils qui s'écartent
      if (dry || (u > 0.97 && noise2(x, 2, 5) < 0.5)) continue;
      out.push([x, r - (th >> 1), u]);
    }
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
   * meta, sheet : KAGE (kage.json, planche du skin porté) ; far : la grande chaîne déjà peinte
   * par le Potager s'il est chargé (sinon on la peint, comme la chaîne voisine).
   */
  constructor(meta, sheet, far = null) {
    this.meta = meta;
    this.sheet = sheet;
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
    this.anim = new Animator(meta);
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
    // le pied de la chaîne : une ligne de collines boisées, sombre et uniforme, qui fonce vers le bas
    const hillTop = Math.round(h * 0.6);
    const hill = new Int16Array(w);
    for (let x = 0; x < w; x++) hill[x] = hillTop + Math.round(12 * fbm1(x * 0.009, 3, 5) - 6 + 3 * noise1(x * 0.13, 8) + 1.5 * noise1(x * 0.4, 9));
    const fd = farC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const md = midC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    // la terre recolorée en nuit (par la luminosité de chaque pixel), sa silhouette noire, les crêtes
    this.land = canvas(w, h); this.black = canvas(w, h);
    const lg = this.land.getContext('2d'), bg = this.black.getContext('2d');
    const out = lg.createImageData(w, h), blk = bg.createImageData(w, h);
    const [br, bgg, bb] = rgb(BLACK);
    this.ridge = new Int16Array(w).fill(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onHill = y >= hill[x], onMid = md[i + 3] > 0, onFar = fd[i + 3] > 0;
      if (!onHill && !onMid && !onFar) continue;
      let c;
      if (onHill) {
        c = y === hill[x] ? HAZE : pick(BASE, 0.78 * (1 - (y - hill[x]) / (h - hillTop)), x, y, 0.7);
      } else if (y >= hill[x] - 16 && pick([0, 1], (y - hill[x] + 16) / 18, x, y, 0.9)) {
        c = HAZE;                                                            // la brume monte du pied des montagnes
      } else if (onMid) {
        const l = md[i + 3] ? (0.3 * md[i] + 0.55 * md[i + 1] + 0.15 * md[i + 2]) / 255 : 0;
        c = pick(MID, l * 0.95 - 0.1, x, y, 0.5);
      } else {
        const l = (0.3 * fd[i] + 0.55 * fd[i + 1] + 0.15 * fd[i + 2]) / 255;
        c = pick(FAR, l * 0.95 - 0.15, x, y, 0.5);
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
    // le titre, le pinceau, le menu : au pied des montagnes
    this.titleW = measure(TITLE, FONT.font, FONT.spacing);
    this.titleX = Math.round((w - this.titleW) / 2);
    this.titleY = hillTop + 8;
    const f = FONTS[FONT.font];
    let x = this.titleX;
    this.letterX = [...TITLE].map((ch) => { const at = x; x += measure(ch, FONT.font) + f.gap + FONT.spacing * f.k; return at; });
    const box = renderText(TITLE, FONT);
    const d = box.getContext('2d').getImageData(0, 0, box.width, box.height).data;
    let bottom = 0;
    for (let y = 0; y < box.height; y++) for (let xx = 0; xx < box.width; xx++) if (d[(y * box.width + xx) * 4 + 3]) bottom = y;
    this.lineY = this.titleY + bottom + 9;
    this.brush = brushPixels(Math.round(this.titleW / 2) - 14);
    this.menuY = this.lineY + 7;
    // la lune : monte derrière la chaîne, jusqu'au quart de l'image
    this.moonX = Math.round(w * 0.47);
    this.moonY0 = this.ridge[this.moonX] + MOON_R + 2;
    this.moonY1 = Math.round(h * 0.25);
    // le sommet où KAGE se pose : une vraie pointe (du ciel des deux côtés), à droite de la lune et
    // dans sa clarté (son ombre s'y découpe) ; à défaut, la plus haute pointe de la moitié droite
    const isPeak = (px) => { const r = this.ridge[px]; return r > 40 && r <= this.ridge[px - 1] && r < this.ridge[px + 1] && this.ridge[px - 9] > r + 6 && this.ridge[px + 9] > r + 6; };
    const highest = (x0, x1, top = 0) => { let best = -1; for (let px = Math.max(10, x0); px < Math.min(w - 10, x1); px++) if (isPeak(px) && this.ridge[px] >= top && (best < 0 || this.ridge[px] < this.ridge[best])) best = px; return best; };
    // (la plus proche, pas plus haute que le centre de la lune : en plein halo, son ombre s'y découpe)
    let peak = -1;
    for (let px = this.moonX + MOON_R + 6; px < Math.min(w - 10, this.moonX + Math.round(MOON_R * 2.4)) && peak < 0; px++) if (isPeak(px) && this.ridge[px] >= this.moonY1) peak = px;   // la plus proche de la lune
    if (peak < 0) peak = highest(this.moonX + MOON_R + 6, this.moonX + Math.round(MOON_R * 2.6));
    if (peak < 0) peak = highest(Math.round(w * 0.6), w);
    if (peak < 0) peak = Math.round(w * 0.8);
    this.peak = { x: peak, y: this.ridge[peak] };
  }

  /** Silhouette d'une image de KAGE (noire ; rim : liseré de lune sur les bords tournés vers elle). */
  silhouette(name, i, rim) {
    const key = `${name}:${i}:${rim ? 1 : 0}`;
    let c = this.sil.get(key);
    if (c) return c;
    const f = this.meta.animations[name].frames[i];
    c = canvas(f.w, f.h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(this.sheet, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const d = g.getImageData(0, 0, f.w, f.h).data, on = (x, y) => x >= 0 && x < f.w && y >= 0 && y < f.h && d[(y * f.w + x) * 4 + 3] > 0;
    g.clearRect(0, 0, f.w, f.h);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (on(x, y)) dot(g, x, y, rim && !on(x - 1, y) && on(x + 1, y) ? RIM : BLACK);
    }
    this.sil.set(key, c);
    return c;
  }

  /** KAGE au temps t : null avant son entrée ; sinon { name, i, x, y } (x, y : sous les pieds). */
  kage(t) {
    const k = (t - INTRO.kage) / INTRO.kageTime;
    if (k < 0) return null;
    const A = this.meta.animations;
    const frameAt = (name, u) => ({ name, i: Math.min(A[name].frameCount - 1, Math.floor(clamp01(u) * A[name].frameCount)) });
    if (k < 1) {
      // une courbe d'entrée (hors de l'image, à gauche) au sommet, qui passe devant la lune
      const P0 = { x: -30, y: Math.round(this.h * 0.62) }, P2 = this.peak;
      const M = { x: this.moonX, y: this.moonY1 + 14 };
      const C = { x: 2 * M.x - (P0.x + P2.x) / 2, y: 2 * M.y - (P0.y + P2.y) / 2 };
      const u = k, a = (1 - u) ** 2, b = 2 * u * (1 - u), c = u * u;
      const pose = u < 0.3 ? frameAt('jump', u / 0.3) : u < 0.64 ? frameAt('air_attack', (u - 0.3) / 0.34) : frameAt('fall', (u - 0.64) / 0.36);
      return { ...pose, x: Math.round(a * P0.x + b * C.x + c * P2.x), y: Math.round(a * P0.y + b * C.y + c * P2.y), rim: false };
    }
    // posé : il atterrit, puis attend sur le sommet
    if (this.anim.name !== 'land' && this.anim.name !== 'idle') this.anim.play('land');
    if (this.anim.name === 'land' && this.anim.finished) this.anim.play('idle');
    return { name: this.anim.name, i: this.anim.frame, x: this.peak.x, y: this.peak.y, rim: false };
  }

  /** Dessine l'image au temps courant. */
  draw() {
    const { g, w, h, t } = this;
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
    // KAGE
    const k = this.kage(t);
    if (k) {
      const sil = this.silhouette(k.name, k.i, k.rim), { pivot } = this.meta;
      g.drawImage(sil, k.x - pivot.x, k.y - pivot.y);
    }
  }

  /** Avance de dt secondes (le menu s'annonce une fois, à son heure). */
  update(dt) {
    this.t += dt;
    if (this.t >= INTRO.kage + INTRO.kageTime) this.anim.update(dt);
    if (!this.menuShown && this.t >= INTRO.menu) { this.menuShown = true; this.onMenu?.(); }
  }

  /** Passe directement à la fin : tout est en place, KAGE attend sur son sommet. */
  skip() {
    if (this.t >= INTRO.menu) return;
    this.t = INTRO.menu;
    this.anim.play('idle', { restart: true });
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
