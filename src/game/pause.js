// La pause « La halte » (25 novembre 2026, choisie par Raph sur la planche docs/menus/planche_pause.jpg) :
// le monde s'assombrit comme à la tombée de la nuit, une lanterne de pierre s'allume au sol, des lucioles
// flottent ; les choix (Reprendre, Menu principal) sont posés dans sa lumière, le choix marqué du coup de
// pinceau des menus. Ouverte par Options (manette) ou Échap (src/main.js : openPause).
//
// La scène est une toile à la taille de l'image de jeu (pixels nets), sous les vrais boutons.
import { canvas, ih } from './potager/paint.js';
import { Pen, stoneLantern, drawFlame, ground, flat, stroke, smooth, clamp01 } from './menuart.js';

const GOLD = '#f3d9a0', GOLD_TAIL = '#b08a5a';

/**
 * Le bouton de la halte (25 novembre 2026, choisi par Raph sur docs/menus/planche_bouton_pause.png : le feu de
 * camp, plutôt que les deux barres de tous les jeux) : 11 × 11 pixels de jeu, flamme chaude sur des bûches
 * croisées, cerné d'un pixel sombre pour rester lisible sur un ciel clair. En haut à droite pendant le jeu.
 */
const CAMPFIRE = [
  '.....o.....', '....oo.....', '....oo.o...', '...ooo.oo..', '..oooooooo.', '..ooo##ooo.',
  '...oo##oo..', '#..oooooo.#', '.##.oooo.##', '...######..', '.##......##'];
export function haltIcon(btn) {
  const c = canvas(13, 13), g = c.getContext('2d'), on = (i, j) => CAMPFIRE[j]?.[i] && CAMPFIRE[j][i] !== '.';
  g.fillStyle = '#16141e';
  for (let j = -1; j <= 11; j++) for (let i = -1; i <= 11; i++) {
    if (on(i, j)) continue;
    let near = false;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (on(i + a, j + b)) near = true;
    if (near) g.fillRect(i + 1, j + 1, 1, 1);
  }
  CAMPFIRE.forEach((row, j) => { for (let i = 0; i < 11; i++) {
    if (row[i] === '.') continue;
    g.fillStyle = row[i] === '#' ? '#e8dec4' : '#f3b45a';
    g.fillRect(i + 1, j + 1, 1, 1);
  } });
  // le cœur de la flamme, plus clair
  g.fillStyle = '#ffe2a0'; g.fillRect(6, 7, 1, 1); g.fillRect(5, 8, 2, 1);
  c.className = 'halt-btn__icon';
  btn.append(c);
}

export class PauseScene {
  /** root : la section .pause (elle contient la toile, puis les textes et les boutons). */
  constructor(root) {
    this.root = root;
    this.cv = canvas(1, 1);
    this.cv.className = 'pause__scene';
    root.prepend(this.cv);
    this.raf = 0;
  }

  /** Recompose la scène à la taille de l'image (W × H pixels de jeu) et place les textes. */
  layout() {
    const ui = this.root.parentElement, W = ui?.offsetWidth || 448, H = ui?.offsetHeight || 252;
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.cv.width = W; this.cv.height = H;
    const gy = this.gy = H - 34, lx = Math.round(W / 2 - 24), tx = Math.round(W / 2 + 38);
    // la couche fixe : le voile du soir, le sol, la pierre de la lanterne
    this.base = canvas(W, H);
    const g = this.base.getContext('2d'), p = new Pen(g);
    g.fillStyle = 'rgba(5, 7, 14, 0.72)'; g.fillRect(0, 0, W, H);
    p.shade(0, 0, W, H, (x, y) => { const d = Math.hypot((x - W / 2) / (W * 0.62), (y - H / 2) / (H * 0.7)); return d > 0.6 ? ['#05070b', Math.min(0.5, (d - 0.6) * 1.3)] : null; });
    ground(p, flat(gy));
    this.lan = stoneLantern(p, lx, gy, 2.2);
    // les textes : « Halte » discret, puis les deux choix
    this.tx = tx + 52;                     // (les choix sont centrés sur cet axe, dans la lumière de la lanterne)
    this.rows = [['.pause__title', gy - 126], ['[data-resume]', gy - 106], ['[data-quit]', gy - 68]];
    this.place();
    this.flies = Array.from({ length: 10 }, (_, i) => ({ x: ih(i, 1, 71) * W, y: 50 + ih(i, 2, 71) * (gy - 70), p: ih(i, 3, 71) * 6.28, s: 0.5 + ih(i, 4, 71) }));
  }

  /** Les textes, centrés sur l'axe (refait à l'ouverture : « Quitter l'arène » est plus long). */
  place() {
    for (const [sel, y] of this.rows) {
      const e = this.root.querySelector(sel);
      e.style.top = `${y}px`;
      e.style.left = `${Math.round(this.tx - e.offsetWidth / 2)}px`;
    }
  }

  open() {
    this.layout();
    requestAnimationFrame(() => this.place());
    this.t0 = performance.now();
    this.focusAt = 0;
    this.focused = null;
    this.root.classList.remove('m-in');
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('m-in')));
    const step = () => { this.draw(); this.raf = requestAnimationFrame(step); };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(step);
  }

  close() { cancelAnimationFrame(this.raf); this.raf = 0; }

  draw() {
    const { W, H } = this, g = this.cv.getContext('2d'), t = (performance.now() - this.t0) / 1000;
    g.clearRect(0, 0, W, H);
    // tout entre en fondu ; la lanterne s'allume juste après
    g.globalAlpha = smooth(t / 0.35);
    g.drawImage(this.base, 0, 0);
    g.globalAlpha = 1;
    drawFlame(g, this.lan, smooth((t - 0.2) / 0.5), 1.1, t, 1);
    // les lucioles, qui dérivent et clignent
    for (const f of this.flies) {
      const x = Math.round((f.x + Math.sin(t * 0.4 * f.s + f.p) * 10 + W) % W), y = Math.round(f.y + Math.sin(t * 0.7 * f.s + f.p * 2) * 6);
      const a = clamp01((t - 0.4) / 0.6) * (0.5 + 0.5 * Math.sin(t * 2.2 * f.s + f.p));
      if (a < 0.05) continue;
      g.fillStyle = `rgba(200,255,140,${(a * 0.2).toFixed(3)})`; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = `rgba(226,255,170,${a.toFixed(3)})`; g.fillRect(x, y, 1, 1);
    }
    // le coup de pinceau sous le choix (il se tire quand le choix change)
    const f = document.activeElement;
    if (f && this.root.contains(f) && f.tagName === 'BUTTON') {
      if (this.focused !== f) { this.focused = f; this.focusAt = t; }
      const w = f.offsetWidth - 8, x = f.offsetLeft + f.offsetWidth / 2, y = f.offsetTop + f.offsetHeight - 2;
      stroke(g, x, y, w + 6, smooth((t - this.focusAt) / 0.22), GOLD, GOLD_TAIL);
    } else this.focused = null;
  }
}
