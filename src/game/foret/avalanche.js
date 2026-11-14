// La descente vertigineuse (zone 11) : l'amas instable du sommet, son effondrement, et l'éboulis
// qui dévale la pente derrière KAGE.
//
// Tout est peint ici, image par image (rien ne change le jeu : la mécanique est dans mechanics.js,
// updateSlide ; le front de l'éboulis est slide.x, KAGE meurt s'il passe derrière) :
//   - l'amas : une pile de gros blocs mal calés, fendus, retenus par des racines ; il tremble quand
//     KAGE approche, des cailloux en roulent ; à son passage, il s'effondre bloc par bloc ;
//   - la masse : 120 pierres anguleuses, de toutes tailles, entassées sur près de 5 cases de haut,
//     qui roulent les unes sur les autres (chacune avance dans la masse puis retombe derrière) ;
//   - la poussière : des volutes tramées qui naissent dans la masse, gonflent, montent et restent
//     derrière elle (le nuage traîne) ; des cailloux projetés devant le front, qui rebondissent.
// Les pierres sont des polygones irréguliers, ombrés par facettes (lumière du couchant, en haut à
// gauche), cernés de sombre, peints une fois pour huit angles de rotation.

import { canvas, ih, noise2, bayer, pick } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

const TILE = 16;
const R = Math.round;
// le roc au soleil couchant : chaud dans la lumière, violacé dans l'ombre
export const LIT = ['#1d1716', '#2e2422', '#463631', '#5f4a40', '#7c6151', '#9e7c62', '#c39d7a', '#e2bf95'];
const DEEP = ['#141012', '#1e181a', '#2c2326', '#3b2f30', '#4d3d3b', '#614c46', '#7a5e54', '#93725f'];
const EDGE = '#120d0c';
const ROT = 8;

/** Contour irrégulier d'une pierre : n sommets, rayon r, un peu allongée. */
export function shape(r, seed) {
  const n = 6 + Math.floor(ih(seed, 1, 5) * 4), el = 1 + ih(seed, 2, 5) * 0.45, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (ih(i, seed, 3) - 0.5) * 0.55;
    const rr = r * (0.7 + ih(i, seed, 4) * 0.34);
    pts.push([Math.cos(a) * rr * el, Math.sin(a) * rr]);
  }
  return pts;
}

/** Une pierre tournée de rot (rad) : facettes éclairées du haut à gauche, contour sombre, un peu de lichen. */
export function stone(pts, rot, seed, pal) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const P = pts.map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
  const ext = Math.ceil(Math.max(...P.map(([x, y]) => Math.hypot(x, y)))) + 2, S = 2 * ext + 1;
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // pour chaque facette (secteur entre deux sommets), sa normale et sa teinte propre
  const ang = P.map(([x, y]) => Math.atan2(y, x));
  const facet = (a) => { let best = 0, bd = 9; for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; let m = (ang[i] + ang[j]) / 2; if (Math.abs(ang[j] - ang[i]) > Math.PI) m += Math.PI; const d = Math.abs(Math.atan2(Math.sin(a - m), Math.cos(a - m))); if (d < bd) { bd = d; best = i; } } return best; };
  const img = new L.Sheet(S, S);
  const on = [];
  for (let y = 0; y < S; y++) { on.push([]); for (let x = 0; x < S; x++) on[y].push(inside(x - ext + 0.5, y - ext + 0.5)); }
  const rmax = ext - 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!on[y][x]) continue;
    const dx = x - ext + 0.5, dy = y - ext + 0.5;
    const edge = !on[y - 1]?.[x] || !on[y + 1]?.[x] || !on[y][x - 1] || !on[y][x + 1];
    if (edge) { img.set(x, y, EDGE); continue; }
    const f = facet(Math.atan2(dy, dx)), j = (f + 1) % P.length;
    // normale de la facette (vers l'extérieur) et lumière du couchant, en haut à gauche
    const ex = P[j][0] - P[f][0], ey = P[j][1] - P[f][1], el = Math.hypot(ex, ey) || 1;
    const nx = ey / el, ny = -ex / el;
    const d = Math.hypot(dx, dy) / Math.max(1, rmax);
    let v = 0.5 + (-nx * 0.6 - ny * 0.8) * 0.28 * Math.min(1, d * 1.6) - d * 0.08 + (ih(f, seed, 9) - 0.5) * 0.2 + (noise2(x * 0.5, y * 0.5, seed) - 0.5) * 0.12;
    let c = pick(pal, v, x, y);
    const sp = ih(x, y, seed + 3);
    if (sp < 0.05) c = pal[Math.max(0, pal.indexOf(c) - 2)] ?? c; else if (sp > 0.992) c = pal[pal.length - 2];
    // un peu de lichen sur les faces du dessus
    if (ny < -0.55 && pal === LIT && ih(seed, 11, 7) < 0.4 && noise2(x * 0.3, y * 0.3, seed + 7) > 0.74) c = sp < 0.5 ? '#6f8a4a' : '#8fa65a';
    img.set(x, y, c);
  }
  return { img: img.done(), ext };
}

const SIZES = [3, 4, 5, 6, 7, 9, 11, 13, 16];

export class Avalanche {
  constructor(level, forest) {
    this.level = level;
    this.f = forest;
    this.sets = new Map();          // pierres pré-peintes : 'r,variante,lit' → [8 images]
    this.dust = [];
    this.pebbles = [];
    this.puffs = new Map();
    this.fall = null;               // les blocs de l'amas, pendant qu'ils dégringolent
    this.t = null;
    const S = forest.slide;
    if (!S) return;
    // le sol tel que l'éboulis le suit : la surface (pentes comprises), les brèches comblées en ligne
    // droite, le tout adouci (la masse « coule » sur les marches)
    const x0 = S.pile ? S.pile.x - 120 : S.start - 260, x1 = S.end + 260, n = x1 - x0;
    const g = new Float32Array(n);
    const rows = level.rows;
    for (let i = 0; i < n; i++) {
      const x = x0 + i, tx = Math.floor(x / TILE);
      let y = NaN;
      for (const q of forest.slopes ?? []) if (!q.pile && x >= q.x0 && x < q.x1) y = q.y0 + ((x - q.x0) * (q.y1 - q.y0)) / (q.x1 - q.x0);
      if (Number.isNaN(y)) for (let r = 18; r < level.h; r++) { const ch = rows[r]?.[tx]; if (ch === 'v') break; if ('#=|'.includes(ch)) { y = r * TILE; break; } }
      g[i] = y;
    }
    for (let i = 0; i < n; i++) if (Number.isNaN(g[i])) {
      let a = i; while (a > 0 && Number.isNaN(g[a])) a--;
      let b = i; while (b < n - 1 && Number.isNaN(g[b])) b++;
      const ya = Number.isNaN(g[a]) ? g[b] : g[a], yb = Number.isNaN(g[b]) ? ya : g[b];
      g[i] = ya + ((yb - ya) * (i - a)) / Math.max(1, b - a);
    }
    const sm = new Float32Array(n);
    for (let pass = 0; pass < 2; pass++) {
      const src = pass ? sm.slice() : g;
      for (let i = 0; i < n; i++) { let s2 = 0, c = 0; for (let k = -12; k <= 12; k++) { const j = i + k; if (j >= 0 && j < n) { s2 += src[j]; c++; } } sm[i] = s2 / c; }
    }
    this.gx0 = x0; this.ground = sm; this.rawGround = g;
    // le sol « sous » les obstacles (souches, rochers, troncs, l'arche) : la masse ne les escalade pas
    // toute entière ; chaque pierre les franchit à sa façon (bump : hauteur de l'obstacle au-dessus du sol)
    const fl = g.slice();
    for (const q of level.props) {
      if (!['stump', 'boulder', 'log_block', 'slide_arch', 'slide_tree', 'slide_gate'].includes(q.type)) continue;
      const a = q.x * TILE - x0, b = (q.x + (q.w ?? 1)) * TILE - x0;
      if (b < 0 || a >= n) continue;
      const ya = g[Math.max(0, a - 2)], yb = g[Math.min(n - 1, b + 1)];
      for (let i = Math.max(0, a); i < Math.min(n, b); i++) fl[i] = Math.max(g[i], ya + ((yb - ya) * (i - a)) / Math.max(1, b - a));
    }
    const fs = new Float32Array(n), bump = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s2 = 0, c = 0; for (let k = -10; k <= 10; k++) { const j = i + k; if (j >= 0 && j < n) { s2 += fl[j]; c++; } } fs[i] = s2 / c; }
    for (let i = 0; i < n; i++) { let s2 = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < n) { s2 += Math.max(0, fl[j] - g[j]); c++; } } bump[i] = s2 / c; }
    this.floor = fs; this.bump = bump;
    // la masse : chaque pierre a sa place dans le tas (u : distance au front ; h : hauteur relative),
    // sa taille (les grosses derrière et en bas), sa profondeur, sa vitesse dans la masse
    this.L = 195; this.Hmax = 96;
    this.mass = Array.from({ length: 150 }, (_, i) => {
      const u = ih(i, 1, 61) * this.L, back = u / this.L, hf = Math.pow(ih(i, 2, 61), 0.85);
      let si = Math.floor(Math.pow(ih(i, 3, 61), 1.6 - back * 0.9) * SIZES.length * (0.55 + back * 0.45 + (1 - hf) * 0.25));
      si = Math.max(0, Math.min(SIZES.length - 1, si));
      // climb : la part de chaque obstacle que la pierre escalade (près de la moitié passent au ras, « dessous »)
      return { u0: u, hf, si, v: i % 3, z: ih(i, 4, 61), vrel: 10 + ih(i, 5, 61) * 48, ph: ih(i, 6, 61) * 6.28, spin: 0.4 + ih(i, 7, 61) * 2.2,
        amp: 1 + ih(i, 8, 61) * 3.5, fq: 3 + ih(i, 9, 61) * 7, leap: ih(i, 10, 61) < 0.25 ? 4 + ih(i, 11, 61) * 7 : 0, lq: 0.6 + ih(i, 12, 61) * 1.6,
        climb: ih(i, 13, 61) < 0.45 ? 0 : 0.2 + ih(i, 15, 61) * 0.5, wob: 1 + ih(i, 14, 61) * 4, dz: (ih(i, 16, 61) - 0.4) * 8 };
    }).sort((a, b) => a.z - b.z);
    // l'amas : sa surface (prof, la même que les pentes où KAGE marche) est pavée de blocs dont le dessus
    // affleure ; dessous, des assises de gros blocs ; de petites cales dans les vides
    if (S.pile) {
      const P = S.pile, X = P.x, G = P.y, W = P.w, prof = P.prof;
      const surf = (x) => { for (let k = 0; k < prof.length - 1; k++) { const [x0, y0] = prof[k], [x1, y1] = prof[k + 1]; if (x >= x0 && x <= x1) return y0 + ((x - x0) * (y1 - y0)) / Math.max(1, x1 - x0); } return G; };
      const B = [];
      // dedans : des assises, de bas en haut, aussi larges que l'amas à cette hauteur
      for (let y = G - 14, row = 0; y > G - P.h + 16; y -= 19, row++) {
        let xa = X, xb = X + W;
        while (xa < X + W && surf(xa) > y - 6) xa++;
        while (xb > X && surf(xb) > y - 6) xb--;
        for (let x = xa + 10, k = 0; x < xb - 6; k++) {
          const r = Math.max(12, 22 - row * 2 - Math.floor(ih(row, k, 87) * 6));
          B.push([x + (ih(row, k + 9, 87) - 0.5) * 6, y + (ih(row, k + 19, 87) - 0.5) * 6, r, row]);
          x += r * 1.35;
        }
      }
      // la surface : des blocs dont le dessus affleure là où KAGE pose le pied (les paliers)
      const stepAt = (x) => P.steps?.find(([a, b]) => x >= a && x < b)?.[2];
      for (let x = X + 6, k = 0; x < X + W - 4; k++) {
        const r = 11 + Math.floor(ih(k, 3, 88) * 7), y = stepAt(x) ?? surf(x);
        B.push([x, y + r * 0.8, r, 7]);
        x += r * 1.2;
      }
      // au bord de chaque palier, un bloc qui en dessine l'arête (on voit la marche à sauter)
      for (const [a, b, y] of P.steps ?? []) for (const ex of [a + 5, b - 5]) B.push([ex, y + 10, 12, 7]);
      // les cales
      for (let k = 0; k < 26; k++) {
        const x = X + 8 + ih(k, 1, 89) * (W - 16), top = surf(x);
        B.push([x, top + 8 + ih(k, 2, 89) * (G - top - 10), 4 + Math.floor(ih(k, 3, 89) * 5), 9]);
      }
      this.pile = B.map(([x, y, r, rw], i) => ({ x, y, r, seed: 800 + i * 13, rot: ih(i, 1, 81) * 6.28, row: rw }));
      // le dessin : le dedans (du haut vers le bas), la surface, les cales par-dessus
      this.pile.sort((a, b) => (a.row === 9) - (b.row === 9) || (a.row === 7) - (b.row === 7) || b.row - a.row);
      for (const b of this.pile) { b.pts = shape(b.r, b.seed); b.img = stone(b.pts, b.rot, b.seed, LIT); }
      const apex = prof.reduce((a, q) => (q[1] < a[1] ? q : a), prof[0]);
      this.top = this.pile.filter((b) => b.row === 7).reduce((a, b) => (Math.abs(b.x - apex[0]) < Math.abs(a.x - apex[0]) ? b : a));
      this.pileX = X; this.pileW = W; this.pileG = G; this.pileH = P.h; this.apexX = apex[0]; this.surf = (x) => stepAt(x) ?? surf(x);
    }
  }

  gy(x) {
    const i = Math.round(x - this.gx0);
    return this.ground[Math.max(0, Math.min(this.ground.length - 1, i))];
  }
  at(arr, x) { return arr[Math.max(0, Math.min(arr.length - 1, Math.round(x - this.gx0)))]; }
  rawGy(x) {
    const i = Math.round(x - this.gx0);
    return this.rawGround[Math.max(0, Math.min(this.rawGround.length - 1, i))];
  }

  set(si, v, lit) {
    const k = si + ',' + v + ',' + lit;
    let s = this.sets.get(k);
    if (!s) {
      const r = SIZES[si], pts = shape(r, 400 + si * 7 + v * 101);
      s = Array.from({ length: ROT }, (_, f) => stone(pts, (f / ROT) * Math.PI * 2, 400 + si + v, lit ? LIT : DEEP));
      this.sets.set(k, s);
    }
    return s;
  }

  /** Une volute de poussière tramée (rayon rr, ton 0 : à l'ombre, 1 : au soleil), bord irrégulier. */
  puff(rr, tone) {
    const k = rr * 2 + tone;
    let c = this.puffs.get(k);
    if (!c) {
      const S = 2 * rr + 2; c = canvas(S, S); const g = c.getContext('2d');
      g.fillStyle = tone ? '#d9b997' : '#8c7262';
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - rr - 0.5, y - rr - 0.5) / rr + (noise2(x * 0.18, y * 0.18, rr * 3 + tone) - 0.5) * 0.45;
        if (d >= 1) continue;
        if (Math.pow(1 - d, 0.7) * 1.1 > bayer(x, y)) g.fillRect(x, y, 1, 1);
      }
      this.puffs.set(k, c);
    }
    return c;
  }

  /** Avant l'effondrement : l'amas, derrière KAGE (il tremble quand KAGE approche). */
  drawPile(ctx, cam, vw, vh, time, S, player) {
    if (!this.pile || S.pileGone) return;
    if (this.pileX + this.pileW + 40 < cam.x || this.pileX - 40 > cam.x + vw) return;
    // sous le poids de KAGE qui redescend, l'amas tremble de plus en plus ; il grince
    const on = player && player.x > this.apexX && player.x < this.pileX + this.pileW + 4 && Math.abs(player.y - this.surf(player.x)) < 10;
    const shake = on ? 0.35 + 0.65 * (player.x - this.apexX) / (this.pileX + this.pileW - this.apexX) : player && player.x > this.pileX && player.x <= this.apexX && Math.abs(player.y - this.surf(player.x)) < 10 ? 0.15 : 0;
    if (on && (this.creak ?? 0) < time) { this.creak = time + 0.45 + Math.random() * 0.3; this.level.onEvent?.('pileCreak', { x: player.x, y: player.y, k: shake }); }
    for (const b of this.pile) {
      const j = shake > 0.1 && ih(b.seed, 1, 5) < 0.55 + shake * 0.4 ? R(Math.sin(time * (26 + b.r) + b.seed) * shake * 1.4) : 0;
      ctx.drawImage(b.img.img, R(b.x - b.img.ext - cam.x) + j, R(b.y - b.img.ext - cam.y));
    }
    // les fissures du gros bloc du sommet (il ne tiendra pas)
    const T = this.top;
    ctx.fillStyle = EDGE;
    for (let s = 0; s < 22; s++) ctx.fillRect(R(T.x - 9 + s * 0.8 + Math.sin(s * 0.9) * 1.5 - cam.x), R(T.y - 12 + s - cam.y), 1, 1);
    for (let s = 0; s < 9; s++) ctx.fillRect(R(T.x + 4 + s * 0.6 - cam.x), R(T.y - 2 + s * 0.4 - cam.y), 1, 1);
    // des cailloux qui en roulent quand KAGE approche
    if (shake > 0.2 && Math.random() < shake * 0.12 && this.pebbles.length < 40) { const px = this.pileX + Math.random() * this.pileW; this.pebbles.push({ x: px, y: this.surf(px) - 2, vx: (px > this.apexX ? 1 : -1) * (20 + Math.random() * 40), vy: -30 - Math.random() * 30, r: 1, age: 0, life: 1.4 }); }
    this.stepPebbles(ctx, cam, vw, vh, time);
  }

  /** L'éboulis en marche (devant KAGE) : les blocs de l'amas qui tombent, la masse, la poussière. */
  draw(ctx, cam, vw, vh, time, S) {
    const dt = this.t == null ? 0 : Math.min(1 / 30, Math.max(0, time - this.t));
    this.t = time;
    if (!S.done) this.settle = null;
    if (!S.active && !S.done) { this.fall = null; this.dust.length = 0; this.stepPebbles(ctx, cam, vw, vh, time, dt); return; }
    const front = S.x, live = S.active;
    // la masse se forme pendant l'effondrement (elle « monte » en quelques dixièmes de seconde)
    const grow = S.withPile ? Math.max(0, Math.min(1, (S.t - 0.25) / 1.1)) : Math.min(1, S.t / 0.4 + 0.3);
    // naissance de la poussière dans la masse, et des cailloux projetés devant le front
    if (live) {
      const rate = 60 * grow + (S.withPile && S.t < 1.2 ? 50 : 0);
      this.acc = (this.acc ?? 0) + rate * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        const u = Math.pow(Math.random(), 0.8) * this.L, x = front - u, H = this.heap(u) * grow;
        const big = Math.random();
        this.dust.push({ x, y: this.gy(x) - Math.random() * (H + 14), r0: 4 + big * 8, r1: 14 + big * 22, age: 0, life: 1.3 + Math.random() * 1.6, vx: (Math.random() - 0.6) * 18, vy: -6 - Math.random() * 16, fr: u < 30 && Math.random() < 0.35 });
      }
      if (grow > 0.5 && Math.random() < dt * 14) this.pebbles.push({ x: front + 2, y: this.gy(front) - 6 - Math.random() * 10, vx: 110 + Math.random() * 120, vy: -(50 + Math.random() * 130), r: 1 + (Math.random() < 0.3 ? 1 : 0), age: 0, life: 1.5 });
    }
    // l'amas qui s'effondre
    if (S.withPile && this.pile && S.t < 3.2) {
      // la base cède d'abord (les blocs du bas jaillissent vers la pente), puis tout s'affaisse, le gros
      // bloc du sommet en dernier
      if (!this.fall) this.fall = this.pile.map((b, i) => {
        const delay = b.row === 9 ? 0.02 + ih(i, 1, 83) * 0.2 : b.row === 7 ? 0.15 + ih(i, 6, 83) * 0.3 : 0.03 + b.row * 0.06 + ih(i, 5, 83) * 0.06;
        return { ...b, vx: 35 + ih(i, 2, 83) * 120 + b.row * 12, vy: -(5 + ih(i, 3, 83) * 50), w: (ih(i, 4, 83) - 0.25) * 6, a: 0, delay, set: this.rockFrames(b) };
      });
      // la grande gerbe de poussière de l'effondrement
      if (S.t < 0.1 && !this.burst) { this.burst = true; for (let k = 0; k < 60; k++) this.dust.push({ x: this.pileX + Math.random() * this.pileW, y: this.pileG - Math.random() * this.pileH, r0: 6 + Math.random() * 8, r1: 20 + Math.random() * 28, age: 0, life: 1.6 + Math.random() * 1.8, vx: (Math.random() - 0.3) * 30, vy: -8 - Math.random() * 18, fr: false }); }
    } else this.burst = false;
    this.stepDust(dt);
    // derrière : la poussière
    this.drawDust(ctx, cam, vw, vh, false);
    // la masse, du fond vers l'avant
    if (S.done) this.drawSettled(ctx, cam, vw, vh, time, S, dt);
    else if (front - this.L - 40 < cam.x + vw && front + 40 > cam.x) for (const m of this.mass) {
      const p = this.rockPos(m, front, time, live, grow);
      if (!p || p.x < cam.x - 20 || p.x > cam.x + vw + 20) continue;
      ctx.drawImage(p.fr.img, R(p.x - p.fr.ext - cam.x), R(p.y - p.fr.ext - cam.y));
    }
    // les blocs de l'amas
    if (this.fall) for (const b of this.fall) {
      if (S.t < b.delay) { ctx.drawImage(b.img.img, R(b.x - b.img.ext - cam.x), R(b.y - b.img.ext - cam.y)); continue; }
      b.vy += 620 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      const gy = this.rawGy(b.x) - b.r * 0.8;
      if (b.y > gy) { b.y = gy; b.vy = -Math.abs(b.vy) * 0.32; b.vx *= 0.82; b.w *= 0.8; if (Math.random() < 0.6) this.dust.push({ x: b.x, y: b.y + b.r * 0.6, r0: 4, r1: 12 + b.r, age: 0, life: 1.1, vx: 0, vy: -6, fr: true }); }
      const fade = Math.max(0, Math.min(1, (3.2 - S.t) / 0.8, (S.x - b.x + 30) / 40));   // repris par la masse
      if (fade <= 0) continue;
      const f = b.set[((Math.floor(b.a * ROT / 6.283) % ROT) + ROT) % ROT];
      ctx.globalAlpha = fade; ctx.drawImage(f.img, R(b.x - f.ext - cam.x), R(b.y - f.ext - cam.y)); ctx.globalAlpha = 1;
    }
    // devant : la poussière basse du front, et les cailloux projetés
    this.drawDust(ctx, cam, vw, vh, true);
    this.stepPebbles(ctx, cam, vw, vh, time, dt);
  }

  /** Où est la pierre m (et sa rotation), la masse ayant son front en front. */
  rockPos(m, front, time, live, grow) {
    const u = (((m.u0 - (live ? time * m.vrel : 0)) % this.L) + this.L) % this.L;
    const x = front - u, r = SIZES[m.si];
    const H = this.heap(u) * grow;
    if (H <= 0 && u > 8) return null;
    // chaque pierre a son rebond (amplitude, cadence), quelques-unes font de petits bonds de loin en loin ;
    // devant un obstacle, chacune passe à sa façon (au ras, ou en l'escaladant en partie)
    const hop = live ? Math.abs(Math.sin(time * m.fq + m.ph)) * m.amp * (u < 30 ? 1.5 : 1) + (m.leap ? Math.pow(Math.max(0, Math.sin(time * m.lq + m.ph * 3)), 6) * m.leap : 0) : 0;
    const base = this.at(this.floor, x) - this.at(this.bump, x) * m.climb + m.dz;
    const y = base - r * 0.8 - m.hf * H - hop, xw = x + (live ? Math.sin(time * 1.7 + m.ph * 2) * m.wob : 0);
    const fi = (Math.floor((live ? time * m.spin * (14 / r) : 0) + m.ph * 2) % ROT + ROT) % ROT;
    return { x: xw, y, fr: this.set(m.si, m.v, m.z > 0.35)[fi], fi };
  }

  /**
   * L'arrêt : la masse a ralenti (mechanics) puis s'est arrêtée ; ses pierres glissent en une seconde et demie
   * vers leur place dans un tas comme celui du sommet (même profil), quelques-unes roulent un peu devant ;
   * un dernier nuage de poussière.
   */
  drawSettled(ctx, cam, vw, vh, time, S, dt) {
    const end = S.x;
    if (!this.settle) {
      const prof = S.pile?.prof, Lend = 190, Hh = 82;
      const shape = (v) => { if (!prof) return Math.sin(Math.PI * v); const X = S.pile.x + v * S.pile.w; for (let k = 0; k < prof.length - 1; k++) { const [a, ya] = prof[k], [b, yb] = prof[k + 1]; if (X >= a && X <= b) return (S.pile.y - (ya + ((X - a) * (yb - ya)) / Math.max(1, b - a))) / S.pile.h; } return 0; };
      this.settle = { t: 0, rocks: this.mass.map((m) => {
        const p = this.rockPos(m, end, this.t ?? time, true, 1) ?? { x: end - m.u0, y: this.gy(end - m.u0), fi: 0 };
        const r = SIZES[m.si], u = (m.u0 / this.L) * Lend;
        let tx = end - u, ty;
        if (m.u0 < 14) { tx = end + 6 + (14 - m.u0) * 3 + ih(m.si, m.v, 7) * 10; ty = this.gy(tx) - r * 0.8; }   // roulées devant
        else ty = this.at(this.floor, tx) - r * 0.75 - m.hf * Hh * shape(1 - u / Lend) + m.dz * 0.3;
        return { m, x0: p.x, y0: p.y, fi: p.fi ?? 0, tx, ty };
      }) };
      for (let k = 0; k < 40; k++) this.dust.push({ x: end - Math.random() * Lend, y: this.gy(end) - Math.random() * 60, r0: 6, r1: 18 + Math.random() * 24, age: 0, life: 1.6 + Math.random() * 1.6, vx: (Math.random() - 0.4) * 16, vy: -6 - Math.random() * 10, fr: false });
    }
    const st = this.settle; st.t = Math.min(1.5, st.t + dt);
    const k = 1 - Math.pow(1 - st.t / 1.5, 3);
    for (const q of st.rocks) {
      const x = q.x0 + (q.tx - q.x0) * k, y = q.y0 + (q.ty - q.y0) * k - Math.sin(k * Math.PI) * (q.m.u0 < 14 ? 6 : 0);
      if (x < cam.x - 24 || x > cam.x + vw + 24) continue;
      const fi = (q.fi + Math.floor((1 - k) * 3)) % ROT, fr = this.set(q.m.si, q.m.v, q.m.z > 0.35)[fi];
      ctx.drawImage(fr.img, R(x - fr.ext - cam.x), R(y - fr.ext - cam.y));
    }
  }

  /** Hauteur du tas à la distance u du front : bas et clairsemé devant, haut au milieu, il se perd derrière. */
  heap(u) {
    const rise = Math.pow(1 - Math.exp(-u / 62), 1.3), tail = u > this.L - 45 ? (this.L - u) / 45 : 1;
    return this.Hmax * rise * Math.max(0, tail) + 4;
  }

  rockFrames(b) {
    return Array.from({ length: ROT }, (_, f) => stone(b.pts, b.rot + (f / ROT) * Math.PI * 2, b.seed, LIT));
  }

  stepDust(dt) {
    for (const d of this.dust) { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy *= 1 - dt * 0.6; }
    this.dust = this.dust.filter((d) => d.age < d.life);
  }

  drawDust(ctx, cam, vw, vh, front) {
    for (const d of this.dust) {
      if (d.fr !== front) continue;
      const k = d.age / d.life, rr = Math.max(3, Math.round((d.r0 + (d.r1 - d.r0) * (1 - Math.pow(1 - k, 2))) / 2) * 2);
      if (d.x + rr < cam.x || d.x - rr > cam.x + vw || d.y + rr < cam.y || d.y - rr > cam.y + vh) continue;
      const a = Math.min(1, k / 0.12) * Math.pow(1 - k, 1.4) * (front ? 0.55 : 0.75);
      if (a <= 0.02) continue;
      // l'ombre de la volute, décalée vers le bas à droite, puis sa face au soleil
      ctx.globalAlpha = a * 0.8; ctx.drawImage(this.puff(rr, 0), R(d.x - rr - cam.x + 2), R(d.y - rr - cam.y + 3));
      ctx.globalAlpha = a; ctx.drawImage(this.puff(rr, 1), R(d.x - rr - cam.x), R(d.y - rr - cam.y));
    }
    ctx.globalAlpha = 1;
  }

  stepPebbles(ctx, cam, vw, vh, time, dt = 1 / 60) {
    for (const p of this.pebbles) {
      p.age += dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const gy = this.rawGy(p.x);
      if (p.y > gy - p.r && p.vy > 0) { p.y = gy - p.r; p.vy = -p.vy * 0.38; p.vx *= 0.75; }
      const x = R(p.x - cam.x), y = R(p.y - cam.y);
      if (x < -4 || x > vw + 4 || y < -4 || y > vh + 4) continue;
      ctx.fillStyle = EDGE; ctx.fillRect(x - 1, y - 1, p.r + 2, p.r + 2);
      ctx.fillStyle = p.r > 1 ? LIT[5] : LIT[4]; ctx.fillRect(x, y, p.r, p.r);
    }
    this.pebbles = this.pebbles.filter((p) => p.age < p.life);
  }
}
