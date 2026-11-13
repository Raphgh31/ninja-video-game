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
const LIT = ['#1d1716', '#2e2422', '#463631', '#5f4a40', '#7c6151', '#9e7c62', '#c39d7a', '#e2bf95'];
const DEEP = ['#141012', '#1e181a', '#2c2326', '#3b2f30', '#4d3d3b', '#614c46', '#7a5e54', '#93725f'];
const EDGE = '#120d0c';
const ROT = 8;

/** Contour irrégulier d'une pierre : n sommets, rayon r, un peu allongée. */
function shape(r, seed) {
  const n = 6 + Math.floor(ih(seed, 1, 5) * 4), el = 1 + ih(seed, 2, 5) * 0.45, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (ih(i, seed, 3) - 0.5) * 0.55;
    const rr = r * (0.7 + ih(i, seed, 4) * 0.34);
    pts.push([Math.cos(a) * rr * el, Math.sin(a) * rr]);
  }
  return pts;
}

/** Une pierre tournée de rot (rad) : facettes éclairées du haut à gauche, contour sombre, un peu de lichen. */
function stone(pts, rot, seed, pal) {
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
      for (const q of forest.slopes ?? []) if (x >= q.x0 && x < q.x1) y = q.y0 + ((x - q.x0) * (q.y1 - q.y0)) / (q.x1 - q.x0);
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
    // la masse : chaque pierre a sa place dans le tas (u : distance au front ; h : hauteur relative),
    // sa taille (les grosses derrière et en bas), sa profondeur, sa vitesse dans la masse
    this.L = 195; this.Hmax = 96;
    this.mass = Array.from({ length: 150 }, (_, i) => {
      const u = ih(i, 1, 61) * this.L, back = u / this.L, hf = Math.pow(ih(i, 2, 61), 0.85);
      let si = Math.floor(Math.pow(ih(i, 3, 61), 1.6 - back * 0.9) * SIZES.length * (0.55 + back * 0.45 + (1 - hf) * 0.25));
      si = Math.max(0, Math.min(SIZES.length - 1, si));
      return { u0: u, hf, si, v: i % 3, z: ih(i, 4, 61), vrel: 18 + ih(i, 5, 61) * 34, ph: ih(i, 6, 61) * 6.28, spin: 0.6 + ih(i, 7, 61) * 1.6 };
    }).sort((a, b) => a.z - b.z);
    // l'amas : un empilement de gros blocs, en assises de plus en plus étroites qui penchent vers la
    // pente, coiffé d'un énorme bloc fendu ; de petites pierres calées dans les vides (l'ensemble ne
    // tient que par elles et quelques racines)
    if (S.pile) {
      const P = S.pile, X = P.x, G = P.y, W = P.w;
      const rows = [[5, 15, 19], [5, 13, 17], [4, 12, 16], [4, 11, 14], [3, 11, 14], [2, 12, 15], [1, 21, 23]];
      const B = []; let y = G + 2, lean = 0, row = 0;
      for (const [n, r0, r1] of rows) {
        const rr = (k) => r0 + Math.floor(ih(row, k, 87) * (r1 - r0 + 1));
        const span = W * (0.92 - row * 0.12), x0 = X + (W - span) / 2 + lean;
        let top = 1e9;
        for (let k = 0; k < n; k++) {
          const r = rr(k), cx = n === 1 ? x0 + span / 2 : x0 + r * 0.6 + (k * (span - r * 1.2)) / Math.max(1, n - 1) + (ih(row, k + 9, 87) - 0.5) * 6;
          const cy = y - r * 0.85 + (ih(row, k + 19, 87) - 0.5) * 5;
          B.push([cx - X, cy - G, r, row]); top = Math.min(top, cy - r * 0.55);
        }
        y = top + 10; lean += 5; row++;
      }
      // les cales : de petites pierres dans la masse et à son pied
      for (let k = 0; k < 16; k++) {
        const u = ih(k, 1, 89), f = ih(k, 2, 89) * 0.8, hh = f * (G - y), half = W * (0.42 - f * 0.3);
        B.push([W / 2 + (u - 0.5) * 2 * half + f * 25, -hh - 3, 4 + Math.floor(ih(k, 3, 89) * 4), 9]);
      }
      this.pile = B.map(([dx, dy, r, rw], i) => ({ x: X + dx, y: G + dy, r, seed: 800 + i * 13, rot: ih(i, 1, 81) * 6.28, row: rw }));
      // le dessin : les assises du haut d'abord, les blocs du bas devant elles, les cales par-dessus
      this.pile.sort((a, b) => (a.row === 9) - (b.row === 9) || b.row - a.row);
      for (const b of this.pile) { b.pts = shape(b.r, b.seed); b.img = stone(b.pts, b.rot, b.seed, LIT); }
      this.top = this.pile.reduce((a, b) => (b.row !== 9 && b.y < a.y ? b : a), this.pile[0]);
      this.pileX = X; this.pileW = W; this.pileG = G; this.pileH = G - this.top.y + this.top.r;
    }
  }

  gy(x) {
    const i = Math.round(x - this.gx0);
    return this.ground[Math.max(0, Math.min(this.ground.length - 1, i))];
  }
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
    const near = player && player.x > this.pileX - 40 && player.x < S.trigger + 20;
    const shake = near ? Math.min(1, (player.x - (this.pileX - 40)) / (S.trigger - this.pileX + 40)) : 0;
    for (const b of this.pile) {
      const j = (b.row >= 3 && b.row !== 9) && shake > 0.25 ? R(Math.sin(time * (26 + b.r) + b.seed) * shake * 1.3) : 0;
      ctx.drawImage(b.img.img, R(b.x - b.img.ext - cam.x) + j, R(b.y - b.img.ext - cam.y));
    }
    // les fissures du gros bloc du sommet (il ne tiendra pas)
    const T = this.top;
    ctx.fillStyle = EDGE;
    for (let s = 0; s < 22; s++) ctx.fillRect(R(T.x - 9 + s * 0.8 + Math.sin(s * 0.9) * 1.5 - cam.x), R(T.y - 12 + s - cam.y), 1, 1);
    for (let s = 0; s < 9; s++) ctx.fillRect(R(T.x + 4 + s * 0.6 - cam.x), R(T.y - 2 + s * 0.4 - cam.y), 1, 1);
    // des cailloux qui en roulent quand KAGE approche
    if (shake > 0.2 && Math.sin(time * 7) > 0.9 && this.pebbles.length < 40) this.pebbles.push({ x: T.x + 10, y: T.y + 6, vx: 30 + ih(Math.floor(time * 10), 1, 3) * 40, vy: -20, r: 1, age: 0, life: 1.4 });
    this.stepPebbles(ctx, cam, vw, vh, time);
  }

  /** L'éboulis en marche (devant KAGE) : les blocs de l'amas qui tombent, la masse, la poussière. */
  draw(ctx, cam, vw, vh, time, S) {
    const dt = this.t == null ? 0 : Math.min(1 / 30, Math.max(0, time - this.t));
    this.t = time;
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
        const delay = b.row === 9 ? 0.02 + ih(i, 1, 83) * 0.2 : 0.03 + b.row * 0.06 + ih(i, 5, 83) * 0.06;
        return { ...b, vx: 35 + ih(i, 2, 83) * 120 + b.row * 12, vy: -(5 + ih(i, 3, 83) * 50), w: (ih(i, 4, 83) - 0.25) * 6, a: 0, delay, set: this.rockFrames(b) };
      });
      // la grande gerbe de poussière de l'effondrement
      if (S.t < 0.1 && !this.burst) { this.burst = true; for (let k = 0; k < 60; k++) this.dust.push({ x: this.pileX + Math.random() * this.pileW, y: this.pileG - Math.random() * this.pileH, r0: 6 + Math.random() * 8, r1: 20 + Math.random() * 28, age: 0, life: 1.6 + Math.random() * 1.8, vx: (Math.random() - 0.3) * 30, vy: -8 - Math.random() * 18, fr: false }); }
    } else this.burst = false;
    this.stepDust(dt);
    // derrière : la poussière
    this.drawDust(ctx, cam, vw, vh, false);
    // la masse, du fond vers l'avant
    if (front - this.L - 40 < cam.x + vw && front + 40 > cam.x) for (const m of this.mass) {
      const u = (((m.u0 - (live ? time * m.vrel : 0)) % this.L) + this.L) % this.L;
      const x = front - u, r = SIZES[m.si];
      if (x < cam.x - 20 || x > cam.x + vw + 20) continue;
      const H = this.heap(u) * grow;
      if (H <= 0 && u > 8) continue;
      const hop = live ? Math.abs(Math.sin(time * (5 + m.spin * 2) + m.ph)) * (u < 30 ? 9 : 3) : 0;
      const y = this.gy(x) - r * 0.8 - m.hf * H - hop;
      const fr = this.set(m.si, m.v, m.z > 0.35)[(Math.floor((live ? time * m.spin * (14 / r) : 0) + m.ph * 2) % ROT + ROT) % ROT];
      ctx.drawImage(fr.img, R(x - fr.ext - cam.x), R(y - fr.ext - cam.y));
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
