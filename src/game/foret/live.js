// Ce qui bouge dans la Forêt, dessiné à chaque image :
//   derrière KAGE : travées du pont et leurs colonnes, planches vermoulues,
//     troncs flottants, la statue (yeux, mâchoire), les lianes, le lierre des
//     caches, les coffres, les oiseaux posés ;
//   devant KAGE : l'eau (miroir de la clairière, torrent, mare souterraine), la
//     joue de la statue (on passe derrière), l'éboulis, la brume des ravins,
//     poussières et lucioles, la pénombre du souterrain, le premier plan.
import { canvas, ih, noise1, noise2, fbm2, pick, bayer, Brush } from '../potager/paint.js';
import { chestSprite, CHEST } from '../potager/props.js';
import * as C from './palette.js';
import * as L from './layers.js';
import { paintStatue, drawStatue, STATUE } from './statue.js';

const TILE = 16;
const R = Math.round;

/** Sprite peint pixel par pixel (w × h). */
function sprite(w, h, paint) {
  const p = new L.Sheet(w, h);
  paint(p);
  return p.done();
}

/** Tronc flottant : écorce en cylindre couché, coupe claire aux deux bouts. */
function logSprite(w, seed) {
  const h = 11;
  return sprite(w, h, (p) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v0 = y / (h - 1), cyl = Math.sin(v0 * Math.PI);
      let v = 0.18 + cyl * 0.55 - v0 * 0.3 + (noise2(x * 0.08, y * 0.6, seed) - 0.5) * 0.25;
      let c = Math.abs(fbm2(x * 0.03, y * 0.4, 2, seed) - 0.5) < 0.03 ? C.BARK[0] : pick(C.BARK, v, x, y);
      if (y < 2 && fbm2(x * 0.15, 0, 2, seed + 1) > 0.55) c = C.MOSS[4 + (y === 0 ? 1 : 0)];
      const e = Math.min(x, w - 1 - x);
      if (e < 2) { const d = Math.abs(v0 - 0.5) * 2; c = d > 0.8 ? C.BARK[1] : (e === 0 ? '#d2b07a' : '#b08a58'); }
      p.set(x, y, c);
    }
  });
}

/** Planche de bois vermoulu (zone 5), clouée sur deux tasseaux enfoncés dans le tronc et la falaise. */
function plankSprite(w) {
  return sprite(w + 8, 12, (p) => {
    for (let y = 0; y < 6; y++) for (let x = 4; x < w + 4; x++) {
      let v = 0.62 - y * 0.1 + (noise2(x * 0.15, y * 0.8, 3) - 0.5) * 0.3;
      if ((x - 4) % 16 === 15) v -= 0.3;
      const c = ih(x, y, 5) < 0.06 ? C.ROT[0] : pick(C.ROT, v, x, y);
      p.set(x, y, y === 0 && ih(x, 1, 6) < 0.4 ? C.MOSS[3] : c);
    }
    for (const sx of [0, w + 4]) for (let y = 0; y < 12; y++) for (let i = 0; i < 4; i++) p.set(sx + i, y, pick(C.BARK, 0.5 - i * 0.1 - y * 0.03, sx + i, y));
    for (let x = 6; x < w + 2; x += 7) if (ih(x, 2, 7) < 0.5) for (let s = 0; s < 3 + (x % 3); s++) p.set(x, 6 + s, C.MOSS[1]);
  });
}

/** Dalle du pont (zone 4) : une pierre taillée sur une colonne. */
function slabSprite(w, seed) {
  return sprite(w, 16, (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) {
      let v = 0.55 - (x / w) * 0.25 - y * 0.02 + (noise2(x * 0.3, y * 0.3, seed) - 0.5) * 0.18;
      if (y === 0) v += 0.15;
      const joint = y === 15 || x === w - 1 || (x > 0 && x % 26 === 0);
      const m = fbm2(x * 0.12, y * 0.15, 2, seed) + (y < 3 ? 0.25 : 0);
      p.set(x, y, joint ? C.RUIN[0] : y === 0 && ih(x, 0, seed) < 0.5 ? C.MOSS[5] : m > 0.7 ? pick(C.MOSS, v + 0.1, x, y) : pick(C.RUIN, v, x, y));
    }
  });
}
function columnSprite(w, h, seed) {
  return sprite(w, h, (p) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let v = 0.55 - u * 0.45 + Math.sin(u * Math.PI) * 0.1 - (y / h) * 0.3 + (noise2(x * 0.4, y * 0.1, seed) - 0.5) * 0.12;
      if (y % 22 === 0) v -= 0.25;                                                   // tambours de la colonne
      p.set(x, y, fbm2(x * 0.15, y * 0.05, 2, seed + 1) > 0.68 ? pick(C.MOSS, v + 0.05, x, y) : pick(C.RUIN, v, x, y));
    }
  });
}

/** Rideau de lierre sur une cache (une case ; il se tranche au sabre). */
function ivySprite() {
  const p = new L.Sheet(20, 20);
  L.leafMass(p, [0, 0, 19, 19], (x, y) => 1 - Math.max(Math.abs(x - 10) / 10, Math.abs(y - 10) / 10) + 0.1, (x, y) => 0.7 - y / 30 - x / 50, C.LEAF, 5, { step: 2 });
  return p.done();
}

/** Gros rocher de l'éboulis (quatre images de rotation). */
function boulderFrames(r, seed) {
  return [0, 1, 2, 3].map((k) => sprite(2 * r + 2, 2 * r + 2, (p) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r + (noise1(Math.atan2(y, x) * 2 + seed, seed) - 0.5) * 0.25;
      if (d > 1) continue;
      const a = Math.atan2(y, x) + (k * Math.PI) / 2;
      const facet = noise2(Math.cos(a) * d * 3 + seed, Math.sin(a) * d * 3, seed);
      const v = 0.6 - (x + y) / (2 * r) * 0.35 - d * 0.15 + (facet - 0.5) * 0.3;
      const m = fbm2(Math.cos(a) * d * 2 + 9, Math.sin(a) * d * 2, 2, seed) > 0.7 && y < 0;
      p.set(x + r + 1, y + r + 1, m ? pick(C.MOSS, v + 0.1, x, y) : d > 0.86 ? C.ROCK[0] : pick(C.ROCK, v, x, y));
    }
  }));
}

/** Halo tramé (pour percer la pénombre) : alpha de 1 au centre à 0 au bord, par paliers. */
function haloSprite(r) {
  const c = canvas(2 * r, 2 * r), g = c.getContext('2d');
  for (let y = 0; y < 2 * r; y++) for (let x = 0; x < 2 * r; x++) {
    const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
    if (d >= 1) continue;
    const a = Math.min(1, (1 - d) * 1.6);
    const steps = Math.round(a * 4) / 4;
    const dither = a * 4 - Math.floor(a * 4) > bayer(x, y) ? 0.25 : 0;
    g.fillStyle = `rgba(0,0,0,${Math.min(1, Math.floor(a * 4) / 4 + dither)})`;
    if (steps > 0 || dither) g.fillRect(x, y, 1, 1);
  }
  return c;
}

/** Bande du premier plan (frondes et herbes sombres, contour adouci) pour une lumière. */
function foreStrip(mood) {
  const W = 768, H = 70;
  const p = new L.Strip(W, H);
  const F = mood.fore, ramp = [F[0], F[0], F[1], F[1], F[2], F[3]];
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(ih(i, 1, 91) * W), len = 26 + Math.floor(ih(i, 2, 91) * 40);
    L.frond(p, x, H + 4, len, -Math.PI / 2 + (ih(i, 3, 91) - 0.5) * 1.6, (ih(i, 4, 91) - 0.5) * 2.2, F, len);
  }
  for (let x = 0; x < W; x += 3) if (ih(x, 7, 91) < 0.35) L.grassTuft(p, x, H, 3 + Math.floor(ih(x, 8, 91) * 9), ramp, x);
  L.soften(p, F[0]);
  return p.done();
}

export class ForetLive {
  constructor(level, art) {
    this.level = level;
    this.art = art;
    this.f = level.forest;
    this.rows = level.rows.slice();
    this.zones = level.zones;
    const f = this.f;
    this.logImg = new Map();
    for (const l of f?.logs ?? []) if (!this.logImg.has(l.w)) this.logImg.set(l.w, logSprite(l.w + 4, l.w));
    this.plank = f?.crumbles?.length ? plankSprite(f.crumbles[0].w) : null;
    this.slabs = (f?.spans ?? []).map((s, i) => slabSprite(s.w * TILE, 50 + i));
    const kill = this.killRow(f?.spans?.[0]?.x0 ?? 0, f?.spans?.[0]?.row ?? 0);
    this.colH = f?.spans?.length ? (kill - f.spans[0].row + 3) * TILE : 0;
    this.columns = (f?.spans ?? []).map((s, i) => columnSprite(Math.round(s.w * TILE * 0.5), this.colH, 70 + i));
    this.ivy = ivySprite();
    this.chestImg = level.chests?.length ? [0, 1, 2].map((st) => chestSprite(st, Brush, canvas)) : null;
    this.rocks = [7, 9, 11, 8, 10, 6].map((r, i) => boulderFrames(r, 300 + i));
    this.statueArt = null;
    this.halo = haloSprite(72);
    this.haloSmall = haloSprite(26);
    // halos colorés (lumière des champignons) : turquoise, violet
    this.tint = ['#3fb0b8', '#8f6ae0'].map((col) => {
      const h = haloSprite(32), c = canvas(64, 64), g = c.getContext('2d');
      g.drawImage(h, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 64, 64);
      return c;
    });
    this.shade = null;
    this.fore = {};
    this.mirror = null;
    // l'eau : une nappe par course de « ~ » (sa surface et sa profondeur)
    this.waters = [];
    for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
      if (this.rows[ty][tx] !== '~' || this.rows[ty][tx - 1] === '~' || this.rows[ty - 1]?.[tx] === '~') continue;
      let w = 1; while (this.rows[ty][tx + w] === '~') w++;
      let d = 1; while (this.rows[ty + d]?.[tx] === '~') d++;
      const z = this.zoneAt(tx * TILE);
      this.waters.push({ x: tx * TILE, y: ty * TILE, w: w * TILE, h: d * TILE, mirror: !!z?.mirror, flow: z?.id === '06', under: this.underground(tx * TILE, ty * TILE) });
    }
    // brume au fond des ravins (lignes « v »), et l'ombre qui monte de leurs profondeurs
    this.chasms = [];
    const topOf = (c) => { let r = 0; while (r < level.h && !'#=|'.includes(this.rows[r][c] ?? '#')) r++; return r; };
    for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
      if (this.rows[ty][tx] !== 'v' || this.rows[ty][tx - 1] === 'v') continue;
      let w = 1; while (this.rows[ty][tx + w] === 'v') w++;
      const lip = Math.min(topOf(tx - 1), topOf(tx + w), ty) * TILE;
      this.chasms.push({ x: tx * TILE, y: ty * TILE, w: w * TILE, lip });
    }
    // champignons lumineux du souterrain : les grappes déclarées, et quelques-unes en plus sur le sol des galeries
    this.glows = [];
    for (const p of level.props) if (p.type === 'mushrooms') this.glows.push({ x: (p.x + p.w / 2) * TILE, y: p.y * TILE - 4, lit: 0, big: true });
    const d = f?.dark;
    if (d) for (let tx = Math.floor(d.x0 / TILE); tx < d.x1 / TILE; tx++) for (let ty = Math.floor(d.y0 / TILE) + 2; ty < level.h - 1; ty++) {
      const solidBelow = '#='.includes(this.rows[ty + 1]?.[tx]), air = this.rows[ty][tx] === '.';
      if (air && solidBelow && ih(tx, ty, 17) < 0.3 && !this.glows.some((g) => Math.abs(g.x - tx * TILE) < 30 && Math.abs(g.y - (ty + 1) * TILE) < 40)) this.glows.push({ x: tx * TILE + 8, y: (ty + 1) * TILE, lit: 0, small: true, big: ih(tx, ty, 18) < 0.35 });
    }
    // oiseaux posés à la lisière (zones 1, 3, 12) : ils s'envolent quand KAGE approche
    this.birds = [];
    for (const z of this.zones) if (['01', '03', '12'].includes(z.id)) {
      for (let k = 0; k < 3; k++) {
        const tx = z.x0 + 10 + Math.floor(ih(k, z.x0, 33) * (z.x1 - z.x0 - 20));
        let ty = 0; while (ty < level.h && !'#='.includes(this.rows[ty][tx])) ty++;
        if (ty >= level.h || this.rows[ty - 1][tx] !== '.') continue;
        for (let b = 0; b < 3; b++) this.birds.push({ x: tx * TILE + b * 7, y: ty * TILE, gy: ty * TILE, fly: -1, vx: 0, vy: 0, seed: k * 3 + b + z.x0 });
      }
    }
  }

  zoneAt(x) { return this.zones.find((z) => x >= z.px0 && x < z.px1) ?? null; }
  underground(x, y) { const d = this.f?.dark; return !!d && x > d.x0 && x < d.x1 && y > d.y0 + 2 * TILE; }
  killRow(tx, from) { for (let r = from; r < this.level.h; r++) if (this.rows[r]?.[tx + 1] === 'v' || this.rows[r]?.[tx] === 'v') return r; return this.level.h; }

  /** À chaque image : la statue est peinte d'avance quand on approche du sanctuaire. */
  idle(cam) {
    const st = this.f?.statue;
    if (st && !this.statueArt && Math.abs(cam.x - st.cx) < 2400) { this.statueArt = paintStatue(); return true; }
    return false;
  }

  vis(x, y, w, h, cam, vw, vh) { return x + w >= cam.x && x <= cam.x + vw && y + h >= cam.y && y <= cam.y + vh; }

  // ===========================================================================
  drawBehind(ctx, cam, vw, vh, time) {
    const f = this.f, lv = this.level;
    if (!f) return;
    this.drawChasmDepth(ctx, cam, vw, vh);
    // travées du pont et leurs colonnes
    f.spans.forEach((s, i) => {
      const x = s.x0 * TILE, y = s.row * TILE;
      if (!this.vis(x, y, s.w * TILE, this.colH + 20, cam, vw, vh)) return;
      let dy = 0, dx = 0, rot = 0, alpha = 1;
      if (s.state === 'warn') { dx = R(Math.sin(time * 70 + i) * 1); }
      if (s.state === 'down') {
        const t = lv.forest.time - s.fallAt;
        dy = 0.5 * 700 * t * t; rot = t; alpha = Math.max(0, 1 - t / 1.2);
        if (alpha <= 0) return;
      }
      ctx.globalAlpha = alpha;
      const cw = this.columns[i].width;
      ctx.drawImage(this.columns[i], R(x + (s.w * TILE - cw) / 2 - cam.x + dx), R(y + 14 + dy * 1.15 - cam.y));
      ctx.drawImage(this.slabs[i], R(x - cam.x + dx), R(y - cam.y + dy));
      if (s.state === 'warn') {
        // la fissure s'ouvre
        ctx.fillStyle = C.RUIN[0];
        const cx = R(x + s.w * TILE * 0.55 - cam.x + dx);
        for (let k = 0; k < 14; k++) ctx.fillRect(cx + R(Math.sin(k * 1.3) * 2), R(y - cam.y) + k, 1, 1);
      }
      ctx.globalAlpha = 1;
    });
    // planches vermoulues
    for (const c of f.crumbles) {
      if (!this.plank || !this.vis(c.x - 4, c.y, c.w + 8, 40, cam, vw, vh)) continue;
      const sh = c.state === 'shake' ? R(Math.sin(time * 60) * (0.5 + c.t)) : 0;
      ctx.globalAlpha = c.state === 'grow' ? Math.min(1, c.t / 0.35) : c.state === 'fall' ? Math.max(0, 1 - c.t / 0.9) : 1;
      if (ctx.globalAlpha > 0) ctx.drawImage(this.plank, R(c.x - 4 - cam.x + sh), R(c.y - cam.y));
      ctx.globalAlpha = 1;
    }
    // troncs flottants (l'eau, dessinée devant, cache ce qui s'enfonce)
    for (const l of f.logs) {
      if (!this.vis(l.x - 2, l.y, l.w + 4, 16, cam, vw, vh)) continue;
      ctx.drawImage(this.logImg.get(l.w), R(l.x - 2 - cam.x), R(l.y - cam.y));
    }
    // la statue
    const st = f.statue;
    if (st && this.vis(st.cx - 100, st.ground - 240, 200, 240, cam, vw, vh)) {
      if (!this.statueArt) this.statueArt = paintStatue();
      const eyes = st.lit.map((on, i) => (on ? Math.min(1, (f.time - st.litAt[i]) / 0.7) : 0));
      const shake = st.jaw > 0 && st.jaw < 1 ? R(Math.sin(time * 40) * 0.6) : 0;
      drawStatue(ctx, this.statueArt, R(st.cx - STATUE.cx - cam.x) + shake, R(st.ground - cam.y), { eyes, jaw: st.jaw });
    }
    // lianes (derrière KAGE)
    for (const v of f.vines) this.vine(ctx, v, cam, vw, vh, time);
    // lierre des caches
    for (const cr of lv.crates.values()) {
      const sx = R(cr.tx * TILE - 2 - cam.x), sy = R((cr.fall ? cr.fall.y : cr.ty * TILE) - 2 - cam.y);
      if (sx < -24 || sx > vw) continue;
      ctx.drawImage(this.ivy, sx, sy);
    }
    // coffres
    if (this.chestImg) for (const ch of lv.chests) {
      if (!this.vis(ch.x - 24, ch.y - 40, 48, 40, cam, vw, vh)) continue;
      const t = lv.time - ch.openedAt;
      const s = !ch.open ? 0 : t < 0.14 ? 1 : 2;
      ctx.drawImage(this.chestImg[s], R(ch.x - CHEST.cx - cam.x), R(ch.y - CHEST.h - cam.y) + (ch.open && t < 0.14 ? -1 : 0));
    }
    this.drawBirds(ctx, cam, vw, vh, time);
  }

  /** Les ravins : sous le niveau des bords, l'ombre s'épaissit vers le fond (tramée). */
  drawChasmDepth(ctx, cam, vw, vh) {
    for (const c of this.chasms) {
      const y0 = c.lip + 2 * TILE;
      if (!this.vis(c.x, y0, c.w, c.y - y0 + 40, cam, vw, vh)) continue;
      const z = this.zoneAt(c.x), m = C.MOODS[z?.mood] ?? C.MOODS.sousbois;
      ctx.fillStyle = m.fore[0];
      const x0 = R(c.x - cam.x) - 2, w = c.w + 4;
      for (let y = Math.max(y0, cam.y); y < Math.min(c.y + 40, cam.y + vh); y++) {
        const a = Math.min(1, (y - y0) / 110);
        if (a <= 0) continue;
        const sy = R(y - cam.y);
        if (a >= 1) { ctx.fillRect(x0, sy, w, 1); continue; }
        // tramage ordonné : une ligne sur deux décalée
        const step = a > 0.66 ? 2 : a > 0.33 ? 3 : 4;
        for (let x = (y & 1) ? 0 : 1; x < w; x += step) ctx.fillRect(x0 + x, sy, 1, 1);
      }
    }
  }

  /** Une liane : une tige souple, des feuilles de part et d'autre ; elle suit son angle. */
  vine(ctx, v, cam, vw, vh, time) {
    const len = v.len;
    const tip = { x: v.ax + Math.sin(v.angle) * len, y: v.ay + Math.cos(v.angle) * len };
    if (Math.max(v.ax, tip.x) < cam.x - 10 || Math.min(v.ax, tip.x) > cam.x + vw + 10 || v.ay > cam.y + vh || tip.y < cam.y) return;
    const s = Math.sin(v.angle), c = Math.cos(v.angle);
    const bend = -(v.av ?? 0) * 0.05;                     // la liane traîne un peu derrière son mouvement
    const rider = v.rider;
    for (let d = 0; d <= len; d++) {
      const t = d / len, off = bend * d * (1 - t) * (rider ? 0.3 : 1) + Math.sin(time * 1.3 + d * 0.06 + v.i) * 0.4 * t;
      const x = R(v.ax + s * d + c * off - cam.x), y = R(v.ay + c * d - s * off - cam.y);
      ctx.fillStyle = C.LEAF[1];
      ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = d % 9 < 2 ? C.LEAF[2] : C.LEAF[3];
      ctx.fillRect(x, y, 1, 1);
      if (d % 5 === v.i % 5 && d > 4) {
        const side = Math.floor(d / 5) % 2 ? 1 : -1, sx = side > 0 ? x + 2 : x - 1;
        ctx.fillStyle = C.LEAF[side > 0 ? 3 : 5];
        ctx.fillRect(sx, y, 1, 2);
        ctx.fillRect(sx + side, y + 1, 1, 2);
        ctx.fillStyle = side > 0 ? C.LEAF[2] : C.LEAF[6];
        ctx.fillRect(sx + side * 2, y + 2, 1, 1);
      }
    }
    // le bout : une petite touffe
    ctx.fillStyle = C.LEAF[5];
    ctx.fillRect(R(tip.x - cam.x) - 1, R(tip.y - cam.y), 3, 2);
  }

  drawBirds(ctx, cam, vw, vh, time) {
    const p = this.level.player;
    for (const b of this.birds) {
      if (b.fly < 0 && p && Math.abs(p.x - b.x) < 70 && Math.abs(p.y - b.y) < 50) {
        b.fly = time; b.vx = (b.x < p.x ? -1 : 1) * (50 + ih(b.seed, 1, 3) * 40); b.vy = -(70 + ih(b.seed, 2, 3) * 40);
        this.level.onEvent?.('birds', { x: b.x, y: b.y });
      }
      let x = b.x, y = b.gy, flap = false;
      if (b.fly >= 0) {
        const t = time - b.fly;
        if (t > 6) continue;
        x = b.x + b.vx * t; y = b.gy + b.vy * t + 10 * t * t * 0 - 6 * Math.sin(t * 3);
        flap = Math.sin(t * 30 + b.seed) > 0;
      } else if (Math.sin(time * 2 + b.seed) > 0.97) y -= 1;
      const sx = R(x - cam.x), sy = R(y - cam.y);
      if (sx < -4 || sx > vw + 4 || sy < -4 || sy > vh + 4) continue;
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(sx - 1, sy - 3, 3, 2);
      ctx.fillRect(sx + (b.vx >= 0 ? 2 : -2), sy - 4, 1, 1);
      if (b.fly >= 0) { ctx.fillRect(sx - 3, sy - (flap ? 5 : 3), 2, 1); ctx.fillRect(sx + 2, sy - (flap ? 5 : 3), 2, 1); }
      else { ctx.fillStyle = '#c98a4a'; ctx.fillRect(sx, sy - 2, 1, 1); }
    }
  }

  // ===========================================================================
  drawFront(ctx, cam, vw, vh, time) {
    const f = this.f;
    if (!f) return;
    for (const w of this.waters) if (this.vis(w.x, w.y - 40, w.w, w.h + 40, cam, vw, vh)) this.water(ctx, w, cam, vw, vh, time);
    // la joue droite de la statue : KAGE passe derrière en entrant dans le couloir
    const st = f.statue;
    if (st && this.statueArt && this.vis(st.cx - 100, st.ground - 240, 200, 240, cam, vw, vh)) {
      const a = this.statueArt, x0 = STATUE.cx + 30, w = STATUE.cx + STATUE.half + 4 - x0, h = 52;
      const dx = R(st.cx - STATUE.cx - cam.x) + x0, dy = R(st.ground - h - cam.y);
      ctx.drawImage(a.stone, x0, STATUE.h - h, w, h, dx, dy, w, h);
      ctx.drawImage(a.hair, x0, STATUE.h - h, w, h, dx, dy, w, h);
    }
    this.drawSlide(ctx, cam, vw, vh, time);
    // brume au fond des ravins
    for (const c of this.chasms) {
      if (!this.vis(c.x, c.y - 64, c.w, 96, cam, vw, vh)) continue;
      for (let y = -56; y < 30; y += 1) {
        const a = Math.max(0, Math.min(1, (y + 56) / 70));
        const row = R(c.y + y - cam.y);
        if (row < 0 || row >= vh) continue;
        ctx.fillStyle = `rgba(${this.underground(c.x, c.y) ? '8,14,18' : '20,52,60'},${(a * 0.92).toFixed(3)})`;
        ctx.fillRect(R(c.x - cam.x) - 8, row, c.w + 16, 1);
      }
    }
    this.motes(ctx, cam, vw, vh, time);
    this.drawDark(ctx, cam, vw, vh, time);
    this.drawFore(ctx, cam, vw, vh, time);
  }

  water(ctx, w, cam, vw, vh, time) {
    const x0 = R(w.x - cam.x), y0 = R(w.y + 3 - cam.y), W = w.w, H = w.h - 3;
    const ramp = w.under ? ['#06141a', '#0a2029', '#0f2f38', '#16424a'] : C.WATER;
    // reflet : on recopie, retournée, la bande d'image juste au-dessus de la surface
    if (w.mirror || !w.flow) {
      const rh = Math.min(H, 40);
      for (let k = 0; k < rh; k++) {
        const sy = y0 - 1 - k, dy = y0 + k;
        if (sy < 0 || dy >= vh || dy < 0) continue;
        const wob = R(Math.sin(time * 2.2 + k * 0.7) * (k > 3 ? 1 : 0));
        ctx.globalAlpha = (w.mirror ? 0.55 : 0.3) * (1 - k / (rh + 4));
        ctx.drawImage(ctx.canvas, Math.max(0, x0), sy, Math.min(W, vw - Math.max(0, x0)), 1, Math.max(0, x0) + wob, dy, Math.min(W, vw - Math.max(0, x0)), 1);
      }
      ctx.globalAlpha = 1;
    }
    // le corps de l'eau : le ciel s'y reflète en surface (clair), puis il fonce vers le fond
    const m = C.MOODS[this.zoneAt(w.x)?.mood] ?? C.MOODS.sousbois;
    const sky = w.under ? ramp : [m.sky[5], m.sky[4], C.WATER[4], C.WATER[3], C.WATER[2], C.WATER[1]];
    for (let k = 0; k < H; k++) {
      const t = k / H;
      if (k > 0 && k % 2 === 0 && k < 9 && !w.under) {
        // des bandes de ciel, tramées par la houle
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = sky[Math.min(1, k >> 2)];
        for (let x = (k + R(time * (w.flow ? 30 : 3))) % 5; x < W; x += 5) ctx.fillRect(x0 + x, y0 + k, 3, 1);
      }
      ctx.globalAlpha = w.under ? 0.85 : 0.42 + t * 0.5;
      ctx.fillStyle = w.under ? ramp[Math.min(3, Math.floor((1 - t) * 3))] : sky[Math.min(5, 2 + Math.floor(t * 4))];
      ctx.fillRect(x0, y0 + k, W, 1);
    }
    ctx.globalAlpha = 1;
    // la surface : une ligne claire, des reflets qui scintillent (le torrent les emporte)
    ctx.fillStyle = w.under ? '#2c6f78' : C.WATER[4];
    ctx.fillRect(x0, y0, W, 1);
    const speed = w.flow ? 38 : 4;
    for (let i = 0; i < W / 6; i++) {
      const px = ((i * 23 + time * speed + ih(i, 1, w.x) * 40) % W + W) % W;
      const py = 1 + Math.floor(ih(i, 2, w.x) * Math.min(10, H - 2));
      const on = Math.sin(time * 3 + i) > 0.2;
      if (!on && !w.flow) continue;
      ctx.fillStyle = w.under ? '#4fb6c0' : py < 3 ? C.WATER[5] : C.WATER[3];
      ctx.fillRect(x0 + R(px), y0 + py, w.flow ? 5 : 2, 1);
    }
    // l'écume au pied des troncs et des rochers
    if (w.flow) for (const l of this.f.logs) {
      if (l.x + l.w < w.x || l.x > w.x + w.w) continue;
      ctx.fillStyle = C.WATER[5];
      for (let k = 0; k < 3; k++) ctx.fillRect(R(l.x - 3 - k * 3 - cam.x), y0 + (k % 2), 2, 1);
    }
  }

  drawSlide(ctx, cam, vw, vh, time) {
    const S = this.f.slide;
    if (!S || (!S.active && !S.done)) return;
    const x = S.x;
    if (x < cam.x - 120 || x - 140 > cam.x + vw) return;
    const ground = (px) => { const tx = Math.floor(px / TILE); for (let r = 20; r < this.level.h; r++) if ('#='.includes(this.rows[r][tx])) return r * TILE; return this.level.height; };
    // nuage de poussière derrière le front
    for (let k = 0; k < 18; k++) {
      const px = x - 20 - k * 7 + Math.sin(time * 3 + k) * 4, py = ground(px) - 10 - (k % 5) * 6 - Math.abs(Math.sin(time * 2 + k)) * 8;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = k % 2 ? '#c9a07a' : '#a8806a';
      const r = 6 + (k % 4) * 3;
      ctx.fillRect(R(px - r - cam.x), R(py - r / 2 - cam.y), r * 2, r);
    }
    ctx.globalAlpha = 1;
    // les rochers qui roulent, les petits cailloux devant
    this.rocks.forEach((fr, i) => {
      const px = x - 8 - i * 17 + (i % 2) * 6;
      const r = (fr[0].width - 2) / 2;
      const hop = S.done ? 0 : Math.abs(Math.sin(time * (6 + i) + i)) * (5 + i % 3 * 3);
      const py = ground(px) - r - hop;
      const img = fr[S.done ? 0 : Math.floor(time * 10 + i) % 4];
      ctx.drawImage(img, R(px - r - cam.x), R(py - r - cam.y));
    });
    if (!S.done) for (let k = 0; k < 6; k++) {
      const px = x + 6 + ((time * 120 + k * 19) % 60), py = ground(px) - 2 - Math.abs(Math.sin(time * 9 + k)) * 6;
      ctx.fillStyle = C.ROCK[2 + (k % 2)];
      ctx.fillRect(R(px - cam.x), R(py - cam.y), 2, 2);
    }
  }

  /** Poussières dorées dans les rais (le jour), lucioles (sous-bois, soir), spores (sous terre). */
  motes(ctx, cam, vw, vh, time) {
    const z = this.zoneAt(cam.x + vw / 2);
    if (!z) return;
    const kind = z.mood === 'matin' || z.mood === 'canopee' ? 'dust' : z.mood === 'souterrain' ? 'spore' : 'fly';
    const cell = 48;
    for (let gx = Math.floor(cam.x / cell) - 1; gx <= (cam.x + vw) / cell; gx++) for (let gy = Math.floor(cam.y / cell) - 1; gy <= (cam.y + vh) / cell; gy++) {
      if (ih(gx, gy, 51) > (kind === 'fly' ? 0.35 : 0.5)) continue;
      const ph = ih(gx, gy, 52) * 6.28;
      const x = gx * cell + ih(gx, gy, 53) * cell + Math.sin(time * 0.4 + ph) * 10;
      const y = gy * cell + ih(gx, gy, 54) * cell + Math.cos(time * 0.3 + ph) * 8 - (kind === 'spore' ? (time * 4) % cell : 0);
      if (kind === 'fly') {
        const on = Math.sin(time * 1.7 + ph * 3) > 0.35;
        if (!on) continue;
        ctx.fillStyle = z.mood === 'crepuscule' || z.mood === 'couchant' ? '#ffe9a0' : '#d8ff8a';
        ctx.globalAlpha = 0.9;
      } else if (kind === 'spore') { ctx.fillStyle = C.GLOW[3]; ctx.globalAlpha = 0.6; }
      else { ctx.fillStyle = '#fff3b8'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 2 + ph); }
      ctx.fillRect(R(x - cam.x), R(y - cam.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** La pénombre du souterrain : tout est sombre, sauf autour de KAGE et des champignons allumés. */
  drawDark(ctx, cam, vw, vh, time) {
    const d = this.f.dark;
    if (!d || d.x1 < cam.x || d.x0 > cam.x + vw || cam.y + vh < d.y0) return;
    if (!this.shade || this.shade.width !== vw || this.shade.height !== vh) this.shade = canvas(vw, vh);
    const g = this.shade.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, vw, vh);
    const p0 = this.level.player, deep = p0 && p0.y > d.y0 + 64 && p0.x > d.x0 && p0.x < d.x1;
    const x0 = R(d.x0 - cam.x), x1 = R(d.x1 - cam.x), y0 = deep ? -999 : R(d.y0 - cam.y);   // sous terre : tout l'écran
    // la nuit tombe progressivement en descendant dans l'arbre creux
    for (let y = Math.max(0, y0); y < vh; y++) {
      const a = Math.min(0.62, Math.max(0, (y - y0) / 48) * 0.62);
      g.fillStyle = `rgba(3,7,11,${a.toFixed(3)})`;
      g.fillRect(Math.max(0, x0), y, Math.min(vw, x1) - Math.max(0, x0), 1);
    }
    g.globalCompositeOperation = 'destination-out';
    const p = this.level.player;
    if (p) g.drawImage(this.halo, R(p.x - cam.x - 72), R(p.y - 14 - cam.y - 72));
    for (const m of this.glows) {
      if (p && Math.hypot(p.x - m.x, p.y - m.y) < 100) m.lit = Math.min(1, m.lit + 0.03);
      if (m.lit <= 0) continue;
      const r = m.big ? 1 : 0.7;
      g.globalAlpha = m.lit * (0.85 + 0.15 * Math.sin(time * 2 + m.x));
      g.drawImage(this.haloSmall, R(m.x - cam.x - 26 * r), R(m.y - 8 - cam.y - 26 * r), 52 * r, 52 * r);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.shade, 0, 0);
    // la lueur colorée des champignons (turquoise ou violette), puis les champignons eux-mêmes
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.glows) {
      const sx = R(m.x - cam.x), sy = R(m.y - cam.y);
      if (m.lit <= 0.05 || sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;
      const img = this.tint[(m.x >> 4) % 3 === 1 ? 1 : 0], r = m.big ? 34 : 24;
      ctx.globalAlpha = m.lit * (0.3 + 0.06 * Math.sin(time * 1.7 + m.x));   // lueur adoucie (demande de l'utilisateur)
      ctx.drawImage(img, sx - r, sy - 10 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const m of this.glows) {
      const sx = R(m.x - cam.x), sy = R(m.y - cam.y);
      if (sx < -20 || sx > vw + 20 || sy < -30 || sy > vh + 20) continue;
      const violet = (m.x >> 4) % 3 === 1, cap = violet ? C.VIOLET : [C.GLOW[1], C.GLOW[2], C.GLOW[3], C.GLOW[4]];
      for (let k = 0; k < (m.big ? 5 : 3); k++) {
        const kx = sx - 7 + k * 4 + (k % 2) * 2, h = 2 + ((k * 7 + (m.x >> 4)) % (m.big ? 8 : 5)), w = 1 + (h > 5 ? 2 : 1);
        ctx.fillStyle = '#9fb8c8'; ctx.fillRect(kx, sy - h, 1, h);
        ctx.fillStyle = m.lit > 0.2 ? cap[2] : cap[0];
        ctx.fillRect(kx - w, sy - h - 2, w * 2 + 1, 2);
        ctx.fillRect(kx - w + 1, sy - h - 3, w * 2 - 1, 1);
        if (m.lit > 0.2) { ctx.fillStyle = cap[3]; ctx.fillRect(kx - w + 1, sy - h - 3, 1, 1); }
      }
    }
  }

  /** Premier plan : frondes et herbes sombres en bas de l'image (la lumière de la zone). */
  drawFore(ctx, cam, vw, vh) {
    const list = this.art.backdrop.weights(cam, vw, vh);
    for (const [i, o] of list.entries()) {
      const m = C.MOODS[o.mood];
      if (!m || m.cave) continue;
      const img = (this.fore[o.mood] ??= foreStrip(m));
      ctx.globalAlpha = i === 0 ? 1 : o.w;
      const off = (((cam.x * 1.25) % 768) + 768) % 768;
      let dx = -(off % 1), x = Math.floor(off);
      while (dx < vw) { const w = Math.min(768 - x, vw - dx + 1); ctx.drawImage(img, x, 0, w, 70, R(dx), vh - 62, w, 70); dx += w; x = 0; }
    }
    ctx.globalAlpha = 1;
  }
}
