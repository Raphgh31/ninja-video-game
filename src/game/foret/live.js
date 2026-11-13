// Ce qui bouge dans la Forêt, dessiné à chaque image :
//   derrière KAGE : travées du pont et leurs colonnes, planches vermoulues,
//     troncs flottants, la statue (yeux, porte de pierre), les lianes, le lierre des
//     caches, les coffres, les oiseaux posés ;
//   devant KAGE : l'eau (miroir de la clairière, torrent, mare souterraine), la
//     joue de la statue (on passe derrière), l'éboulis, la brume des ravins,
//     poussières et lucioles, la pénombre du souterrain, le premier plan.
import { canvas, ih, noise1, noise2, fbm2, pick, bayer, Brush } from '../potager/paint.js';
import { chestSprite, CHEST, drawChest } from '../potager/props.js';
import * as C from './palette.js';
import * as L from './layers.js';
import { paintStatue, drawStatue, STATUE } from './statue.js';
import { pearlTreeShape, limbSprite, GATE } from './props.js';
import { FOREST } from './mechanics.js';

const TILE = 16;
const R = Math.round;

/** Sprite peint pixel par pixel (w × h). */
function sprite(w, h, paint) {
  const p = new L.Sheet(w, h);
  paint(p);
  return p.done();
}

/**
 * Rondin flottant (zone 6) : un vrai cylindre couché, chacun le sien. w : longueur, d : diamètre (px).
 * Ombré comme un cylindre éclairé du haut à gauche (un reflet sur le dessus, le ventre sombre et mouillé),
 * écorce fendue dans la longueur, des nœuds, de la mousse sur le dessus, un ou deux moignons de branches
 * cassées ; un bout scié (la coupe ronde et ses cernes), l'autre cassé net en échardes ; il s'amincit vers
 * un bout. Renvoie { img, ox, oy } : le dessus du rondin est à oy dans l'image, son début à ox.
 */
function logArt(w, d, seed) {
  const OY = 8, OX = 4, H = d + OY + 2, W = w + 2 * OX;
  const taper = (ih(seed, 1, 61) - 0.5) * 0.35;                         // un bout plus épais que l'autre
  const cutLeft = ih(seed, 2, 61) < 0.5;                                 // le bout scié (l'autre est cassé)
  const BARK = ['#1d120b', '#2c1b10', '#3d2516', '#54331d', '#6d4528', '#8a5a34', '#a8774a'];
  const WOOD = ['#7a5432', '#a07446', '#c39a62', '#dcbc84', '#ecd5a4'];
  const img = sprite(W, H, (p) => {
    const dd = (x) => d * (1 + taper * (x / w - 0.5)) + (noise1(x * 0.09, seed) - 0.5) * 1.6;     // diamètre local (bosses)
    const capW = Math.max(3, Math.round(d * 0.32));
    for (let x = 0; x < w; x++) {
      const D = dd(x), top = OY + (d - D) / 2;
      const brokenEnd = (cutLeft ? w - 1 - x : x);                        // distance au bout cassé
      for (let y = Math.floor(top); y < top + D; y++) {
        const v = Math.max(0, Math.min(1, (y - top) / D));               // 0 dessus, 1 dessous
        // le bout cassé : des échardes qui dépassent irrégulièrement
        if (brokenEnd < 4 && brokenEnd < Math.floor(ih(y, seed, 62) * 5)) continue;
        // ombrage du cylindre : clair un peu au-dessus de l'axe, reflet étroit, ventre sombre
        // (la partie visible est le haut : le bord du dessus sombre, un reflet net juste dessous, puis
        // l'écorce fonce en tournant vers l'eau)
        let L = 0.95 - Math.abs(v - 0.2) * 1.7 - (v < 0.07 ? 0.4 : 0) + 0.28 * Math.exp(-(((v - 0.18) / 0.06) ** 2));
        // l'écorce : des fentes dans la longueur (qui ondulent), des crêtes entre elles
        const lane = v * D / 3 + (noise1(x * 0.06, seed + Math.floor(v * D / 3)) - 0.5) * 1.4;
        const fis = Math.abs(lane - Math.round(lane)) < 0.16 && ih(Math.floor(x / 7), Math.round(lane), seed) < 0.8;
        L += (noise2(x * 0.35, y * 0.7, seed) - 0.5) * 0.18 - (fis ? 0.32 : 0);
        let c = pick(BARK, L, x, y);
        // la mousse sur le dessus, par plaques
        if (v < 0.22 && fbm2(x * 0.11, v * 3, 2, seed + 3) > 0.64 + v * 0.4) c = v < 0.08 ? C.MOSS[4] : pick(C.MOSS, 0.75 - v * 1.5, x, y);
        // le ventre mouillé, bleui par l'eau
        if (v > 0.78) c = pick(['#0f1a1c', '#1a2a2a', '#28393a'], 1.2 - v, x, y);
        p.set(OX + x, y, c);
      }
    }
    // des nœuds : un anneau sombre, un cœur plus clair
    for (let k = 0; k < 1 + Math.floor(ih(seed, 3, 61) * 2); k++) {
      const kx = Math.round(w * (0.25 + 0.5 * ih(seed, 4 + k, 61))), ky = Math.round(OY + d * (0.35 + 0.25 * ih(seed, 6 + k, 61)));
      for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
        const r = Math.hypot(x / 3, y / 1.8);
        if (r <= 1) p.set(OX + kx + x, ky + y, r > 0.65 ? BARK[0] : r > 0.35 ? BARK[3] : BARK[5]);
      }
    }
    // le bout scié : la coupe ronde, ses cernes, l'écorce qui l'entoure
    {
      const x0 = cutLeft ? 0 : w - 1, D = dd(x0), top = OY + (d - D) / 2, cy = top + D / 2;
      for (let y = Math.floor(top); y < top + D; y++) for (let x = -capW; x <= 0; x++) {
        const r = Math.hypot(x / capW, (y + 0.5 - cy) / (D / 2));
        if (r > 1) continue;
        const ring = Math.floor(r * 5 + ih(Math.floor(r * 10), seed, 63) * 0.4);
        const c = r > 0.85 ? BARK[1] : ring % 2 ? WOOD[1 + (r < 0.4 ? 1 : 0)] : WOOD[2 + (r < 0.5 ? 1 : 0)];
        p.set(OX + (cutLeft ? x0 - x - capW : x0 + x + capW), y, (r < 0.12 ? WOOD[0] : c));
      }
    }
    // un ou deux moignons de branches cassées, sur le dessus, dressés de biais
    for (let k = 0; k < 1 + (ih(seed, 8, 61) < 0.45 ? 1 : 0); k++) {
      const sx = Math.round(w * (0.3 + 0.45 * ih(seed, 9 + k, 61))), dir = ih(seed, 11 + k, 61) < 0.5 ? -1 : 1, len = 4 + Math.floor(ih(seed, 13 + k, 61) * 4);
      for (let i = 0; i < len; i++) {
        const x = OX + sx + Math.round(dir * i * 0.6), y = OY + 1 - i;
        p.set(x, y, BARK[3]); p.set(x + 1, y, BARK[2]); if (i < 2) p.set(x - 1, y, BARK[4]);
      }
      const ex = OX + sx + Math.round(dir * (len - 1) * 0.6), ey = OY + 2 - len;
      p.set(ex, ey, WOOD[3]); p.set(ex + 1, ey, WOOD[2]); p.set(ex + (dir > 0 ? 1 : 0), ey - 1, WOOD[4]);   // le bois clair de la cassure
    }
    // parfois, un champignon en console sur le flanc
    if (ih(seed, 15, 61) < 0.4) {
      const fx = OX + Math.round(w * (0.6 + 0.3 * ih(seed, 16, 61))), fy = OY + Math.round(d * 0.45);
      for (let x = -3; x <= 2; x++) { p.set(fx + x, fy, '#d9c49a'); p.set(fx + x, fy + 1, '#a8885e'); }
      p.set(fx - 2, fy - 1, '#efe2bf'); p.set(fx - 1, fy - 1, '#efe2bf');
    }
  });
  return { img, ox: OX, oy: OY };
}

/** Planche du pont suspendu (16 × 7) : vieux bois patiné, mousse ; pourrie : sombre, fendue. */
function bridgePlank(seed, rotten, W = 16) {
  return sprite(W, 12, (p) => {
    const ramp = rotten ? C.ROT : ['#3a2616', '#563a22', '#74522f', '#93703f', '#b08e58'];
    for (let y = 0; y < 6; y++) for (let x = 0; x < W; x++) {
      if ((x === 0 || x === W - 1) && ih(y, seed, 3) < 0.4) continue;              // bouts irréguliers
      let v = 0.62 - y * 0.09 + (noise2(x * 0.18 + seed, y * 0.9, seed) - 0.5) * 0.35 - (x > W - 3 ? 0.12 : 0);
      if (rotten && Math.abs(x - 6 - (seed % 4)) < 1 && y > 0) { p.set(x, y, ramp[0]); continue; }   // la fente
      let c = pick(ramp, v, x, y);
      if (y === 0) c = ih(x, seed, 4) < (rotten ? 0.7 : 0.45) ? (ih(x, seed, 5) < 0.5 ? C.MOSS[4] : C.MOSS[3]) : ramp[4];
      if (y === 5) c = ramp[0];
      p.set(x, y, c);
    }
    // les clous, et des franges de mousse qui pendent sous la planche
    p.set(2, 2, '#2a2420'); p.set(W - 3, 2, '#2a2420');
    for (let x = 1; x < W - 1; x += 2) if (ih(x, seed, 6) < (rotten ? 0.5 : 0.3)) for (let q = 0; q < 1 + Math.floor(ih(x, seed, 7) * 5); q++) p.set(x, 6 + q, q ? C.MOSS[1] : C.MOSS[2]);
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

/** Bande du premier plan (herbes sombres, contour adouci) pour une lumière, et ses grandes frondes à part
 *  (chacune son image et son pied : on ne la dessine pas si son pied tombe sur l'eau). */
function foreStrip(mood) {
  const W = 768, H = 70;
  const p = new L.Strip(W, H);
  const F = mood.fore, ramp = [F[0], F[0], F[1], F[1], F[2], F[3]];
  for (let x = 0; x < W; x += 3) if (ih(x, 7, 91) < 0.35) L.grassTuft(p, x, H, 3 + Math.floor(ih(x, 8, 91) * 9), ramp, x);
  L.soften(p, F[0]);
  const fronds = [];
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(ih(i, 1, 91) * W), len = 26 + Math.floor(ih(i, 2, 91) * 40), fw = len * 2 + 24;
    const q = new L.Strip(fw, H);
    L.frond(q, fw / 2, H + 4, len, -Math.PI / 2 + (ih(i, 3, 91) - 0.5) * 1.6, (ih(i, 4, 91) - 0.5) * 2.2, F, len);
    L.soften(q, F[0]);
    fronds.push({ x, w: fw, img: q.done() });
  }
  return { grass: p.done(), fronds };
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
    (f?.logs ?? []).forEach((l, i) => this.logImg.set(l, logArt(l.w, l.d ?? 11, 17 + i * 37)));
    this.plank = f?.crumbles?.length ? plankSprite(f.crumbles[0].w) : null;
    this.slabs = (f?.spans ?? []).map((s, i) => slabSprite(s.w * TILE, 50 + i));
    const kill = this.killRow(f?.spans?.[0]?.x0 ?? 0, f?.spans?.[0]?.row ?? 0);
    this.colH = f?.spans?.length ? (kill - f.spans[0].row + 3) * TILE : 0;
    this.columns = (f?.spans ?? []).map((s, i) => columnSprite(Math.round(s.w * TILE * 0.5), this.colH, 70 + i));
    this.ivy = ivySprite();
    const PW = FOREST.bridge.plankW;
    this.planks = [0, 1, 2, 3, 4, 5].map((k) => bridgePlank(k * 7 + 3, false, PW));
    this.rottenPlanks = [0, 1].map((k) => bridgePlank(k * 11 + 5, true, PW));
    this.chestImg = level.chests?.length ? [0, 1, 2].map((st) => chestSprite(st, Brush, canvas)) : null;
    this.rocks = [7, 9, 11, 8, 10, 6].map((r, i) => boulderFrames(r, 300 + i));
    this.statueArt = null;
    this.halo = haloSprite(72);
    // les arbres à perles de la caverne : leurs perles, leur lumière, leurs papillons
    // la sortie de la caverne : le sol du couloir (pour la lumière qui y entre)
    if (this.f?.dark) { const tx = Math.floor(this.f.dark.x1 / TILE) - 1; let ty = 0; while (ty < level.h && !'#='.includes(this.rows[ty][tx])) ty++; this.exitY = ty * TILE; }
    // la branche qui rompt (zone 7) : son image, et sa jointure avec le tronc (le pivot)
    this.snapArt = (this.f?.snaps ?? []).map((q) => {
      const host = level.props.find((p) => p.type === 'canopy_trunk' && p.x === q.host);
      const tcx = (q.host * TILE) + 8, half = (host?.w ?? 20) / 2 - 3;
      const art = limbSprite(q.x - 4, tcx - half, q.y0, -1, Math.floor(q.x / TILE) * 7 + Math.floor(q.y0 / TILE));
      return { ...art, px: tcx - half - 2, py: q.y0 + 3 };
    });
    this.pearlTrees = level.props.filter((p) => p.type === 'pearl_tree').map((p) => ({ p, shape: pearlTreeShape(p) }));
    this.butterflies = [];
    for (const { p, shape } of this.pearlTrees) {
      const n = [0, 2, 3, 6][p.s ?? 1];
      for (let k = 0; k < n; k++) this.butterflies.push({ cx: shape.cx, cy: shape.gy - shape.trunkH * (0.6 + ih(k, p.x, 1) * 0.6), rx: 18 + ih(k, p.x, 2) * 30 * (p.s ?? 1), ry: 8 + ih(k, p.x, 3) * 14, a: 0.5 + ih(k, p.x, 4) * 0.6, b: 0.7 + ih(k, p.x, 5) * 0.7, ph: ih(k, p.x, 6) * 6.28, c: k % 3 });
    }
    // fondu de sortie (dithered) : de la pénombre au jour, sur toute la largeur du fondu
    const fw = Math.round(this.f?.dark?.fade ?? 0);
    if (fw) {
      this.exitFade = canvas(fw, 4);
      const g = this.exitFade.getContext('2d');
      for (let x = 0; x < fw; x++) for (let y = 0; y < 4; y++) {
        const t = x / fw, a = Math.pow(1 - t, 1.4);
        const lvl = Math.floor(a * 6) / 6 + ((a * 6) % 1 > bayer(x, y) ? 1 / 6 : 0);
        g.fillStyle = `rgba(3,7,11,${(Math.min(1, lvl) * 0.62).toFixed(3)})`; g.fillRect(x, y, 1, 1);
      }
    }
    this.haloSmall = haloSprite(26);
    // halos colorés (lumière des champignons) : turquoise, violet
    this.tint = ['#3fb0b8', '#8f6ae0', '#e8e6a0'].map((col) => {
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
      // l'eau est profonde : son corps descend à travers le lit (jusqu'au prochain vide, 14 cases au plus) ;
      // on n'en voit jamais le fond
      let bed = 0; while (bed < 14 && ty + d + bed < level.h && this.rows[ty + d + bed][tx] === '#') bed++;
      d += bed;
      const z = this.zoneAt(tx * TILE);
      const oa = this.f?.def?.oasis, oasis = !!oa && tx * TILE >= oa.x0 && tx * TILE < oa.x1;
      this.waters.push({ oasis, x: tx * TILE, y: ty * TILE, w: w * TILE, h: d * TILE, mirror: !!z?.mirror, flow: z?.id === '06', under: this.underground(tx * TILE, ty * TILE) });
    }
    // les piliers de pierre plantés dans l'eau : sous la surface, l'eau passe devant eux (on n'en voit pas le pied)
    for (const p of level.props) {
      if (p.type !== 'rock_pillar' && p.type !== 'rock_ledge' && p.type !== 'boulder') continue;
      const nb = this.waters.find((w) => (w.x === (p.x + p.w) * TILE || w.x + w.w === p.x * TILE) && w.y > p.y * TILE);
      if (nb) this.waters.push({ x: p.x * TILE, y: nb.y, w: p.w * TILE, h: nb.h, mirror: false, flow: nb.flow, under: nb.under, sub: true });
    }
    // brume au fond des ravins (lignes « v »), et l'ombre qui monte de leurs profondeurs
    this.chasms = [];
    const topOf = (c) => { let r = 0; while (r < level.h && !'#=|'.includes(this.rows[r][c] ?? '#')) r++; return r; };
    for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
      if (this.rows[ty][tx] !== 'v' || this.rows[ty][tx - 1] === 'v') continue;
      let w = 1; while (this.rows[ty][tx + w] === 'v') w++;
      // sous terre (un fossé dans une galerie), l'ombre part du plafond du couloir, pas de la surface
      let open = ty; while (open > 0 && !'#=|%'.includes(this.rows[open - 1][tx] ?? '#')) open--;
      const lip = Math.max(Math.min(topOf(tx - 1), topOf(tx + w), ty), open) * TILE;
      const decor = level.props.some((p) => p.type === 'ravine' && tx >= p.x && tx < p.x + p.w);   // la gorge peinte : l'ombre vient plus bas
      this.chasms.push({ x: tx * TILE, y: ty * TILE, w: w * TILE, lip, decor: decor || this.underground(tx * TILE, ty * TILE) });
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
  underground(x, y) {
    const d = this.f?.dark, g = this.f?.def?.galleries;
    return (!!d && x > d.x0 && x < d.x1 && y > d.y0 + 2 * TILE) || (!!g && x >= g.x0 && x < g.x1 && y >= g.y0 && y < g.y1);
  }
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
    for (const B of f.bridges ?? []) this.bridge(ctx, B, cam, vw, vh, time, 'back');
    // planches vermoulues
    for (const c of f.crumbles) {
      if (!this.plank || !this.vis(c.x - 4, c.y, c.w + 8, 40, cam, vw, vh)) continue;
      const sh = c.state === 'shake' ? R(Math.sin(time * 60) * (0.5 + c.t)) : 0;
      ctx.globalAlpha = c.state === 'grow' ? Math.min(1, c.t / 0.35) : c.state === 'fall' ? Math.max(0, 1 - c.t / 0.9) : 1;
      if (ctx.globalAlpha > 0) ctx.drawImage(this.plank, R(c.x - 4 - cam.x + sh), R(c.y - cam.y));
      ctx.globalAlpha = 1;
    }
    // la branche qui rompt
    (f.snaps ?? []).forEach((q, i) => this.drawSnap(ctx, q, this.snapArt[i], cam, vw, vh, time));
    // troncs flottants (l'eau, dessinée devant, cache ce qui s'enfonce)
    for (const l of f.logs) {
      const A = this.logImg.get(l);
      if (!A || !this.vis(l.x - A.ox, l.y - A.oy, A.img.width, A.img.height, cam, vw, vh)) continue;
      ctx.drawImage(A.img, R(l.x - A.ox - cam.x), R(l.y - A.oy - cam.y));
    }
    // la statue
    const st = f.statue;
    if (st && this.vis(st.cx - 100, st.ground - 240, 200, 240, cam, vw, vh)) {
      if (!this.statueArt) this.statueArt = paintStatue();
      const eyes = st.lit.map((on, i) => (on ? Math.min(1, (f.time - st.litAt[i]) / 0.7) : 0));
      drawStatue(ctx, this.statueArt, R(st.cx - STATUE.cx - cam.x), R(st.ground - cam.y), { eyes });
    }
    // la corde de la statue : le bloc, la poulie, la corde (zone 9)
    if (f.rope) this.drawRopeWorks(ctx, f.rope, cam, vw, vh, time);
    // lianes (derrière KAGE)
    for (const v of f.vines) this.vine(ctx, v, cam, vw, vh, time);
    // le départ des lianes de la chevelure de la statue : caché sous une touffe de son feuillage
    if (st) {
      const RAMP = ['#0d2a22', '#14392b', '#1b4d3e', '#23694a', '#2e8b57', '#55ae54', '#8fd058', '#c9ee78'];
      this.vineTufts ??= [0, 1, 2, 3].map((k) => sprite(20, 16, (p) => L.bush(p, 10, 15, 7 + (k % 2) * 2, 12, RAMP, 900 + k * 7)));
      for (const v of f.vines) {
        if (Math.abs(v.ax - st.cx) > 96 || v.ay < st.ground - 15 * TILE || v.ay > st.ground - 11 * TILE) continue;
        const img = this.vineTufts[Math.floor(v.ax) % 4];
        if (this.vis(v.ax - 10, v.ay - 10, 20, 18, cam, vw, vh)) ctx.drawImage(img, R(v.ax - 10 - cam.x), R(v.ay - 8 - cam.y));
      }
    }
    // lierre des caches
    for (const cr of lv.crates.values()) {
      const sx = R(cr.tx * TILE - 2 - cam.x), sy = R((cr.fall ? cr.fall.y : cr.ty * TILE) - 2 - cam.y);
      if (sx < -24 || sx > vw) continue;
      ctx.drawImage(this.ivy, sx, sy);
    }
    // coffres
    if (this.chestImg) for (const ch of lv.chests) {
      if (!this.vis(ch.x - 24, ch.y - 40, 48, 40, cam, vw, vh)) continue;
      drawChest(ctx, this.chestImg, ch, cam, time, lv.time, lv.player);
    }
    this.drawBirds(ctx, cam, vw, vh, time);
  }

  /** Les ravins : sous le niveau des bords, l'ombre s'épaissit vers le fond (tramée). */
  drawChasmDepth(ctx, cam, vw, vh) {
    for (const c of this.chasms) {
      const y0 = c.lip + (c.decor ? 7 : 2) * TILE, ramp = c.decor ? 170 : 110;
      if (!this.vis(c.x, y0, c.w, c.y - y0 + 40, cam, vw, vh)) continue;
      const z = this.zoneAt(c.x), m = C.MOODS[z?.mood] ?? C.MOODS.sousbois;
      ctx.fillStyle = this.underground(c.x, c.y) ? '#030506' : m.fore[0];
      const x0 = R(c.x - cam.x) - 2, w = c.w + 4;
      for (let y = Math.max(y0, cam.y); y < Math.min(c.y + 40, cam.y + vh); y++) {
        const a = Math.min(1, (y - y0) / ramp);
        if (a <= 0) continue;
        const sy = R(y - cam.y);
        if (a >= 1) { ctx.fillRect(x0, sy, w, 1); continue; }
        if (c.decor) { ctx.globalAlpha = Math.round(a * 16) / 16; ctx.fillRect(x0, sy, w, 1); ctx.globalAlpha = 1; continue; }   // la gorge peinte : un fondu, sans trame
        // tramage ordonné : une ligne sur deux décalée
        const step = a > 0.66 ? 2 : a > 0.33 ? 3 : 4;
        for (let x = (y & 1) ? 0 : 1; x < w; x += step) ctx.fillRect(x0 + x, sy, 1, 1);
      }
    }
  }

  /**
   * Le pont suspendu. layer 'back' : la corde du fond, les suspentes, les cordes porteuses,
   * les planches ; 'front' : la main courante de devant (elle passe devant KAGE).
   */
  bridge(ctx, B, cam, vw, vh, time, layer) {
    if (B.x1 + 20 < cam.x || B.x0 - 20 > cam.x + vw || B.y - 40 > cam.y + vh || B.y + 40 < cam.y) return;
    const f = this.f, ROPE = ['#3e3020', '#5c4a2e', '#7d6640', '#a08756'];
    const deck = (x) => f.deckY(B, x);
    const rail = (x, k) => B.y - 18 - k + (deck(x) - B.y) * 0.8;      // la main courante ploie un peu moins que le tablier
    const rope = (yAt, light, thick = 1) => {
      for (let x = B.x0 - 4; x <= B.x1 + 4; x++) {
        const y = R(yAt(x) - cam.y), sx = R(x - cam.x);
        if (sx < -2 || sx > vw + 2) continue;
        ctx.fillStyle = (x >> 1) % 2 ? ROPE[light] : ROPE[light - 1];       // la torsion de la corde
        ctx.fillRect(sx, y, 1, thick);
        if (thick > 1) { ctx.fillStyle = ROPE[0]; ctx.fillRect(sx, y + thick, 1, 1); }
      }
    };
    if (layer === 'front') {
      rope((x) => rail(x, 0), 3, 2);
      // touffes de mousse accrochées à la corde, et quelques brins qui pendent
      for (let x = B.x0 + 6; x < B.x1; x += 9) {
        if (ih(x, 3, 91) > 0.55) continue;
        const sx = R(x - cam.x), sy = R(rail(x, 0) - cam.y);
        ctx.fillStyle = C.MOSS[4]; ctx.fillRect(sx - 1, sy - 1, 3, 2);
        ctx.fillStyle = C.MOSS[2];
        const len = 2 + Math.floor(ih(x, 4, 91) * 6), sway = Math.sin(time * 1.5 + x) * 0.6;
        for (let q = 0; q < len; q++) ctx.fillRect(sx + R(sway * q / len), sy + 2 + q, 1, 1);
      }
      // les nœuds autour des deux troncs
      for (const x of [B.x0 - 3, B.x1 + 3]) { ctx.fillStyle = ROPE[1]; ctx.fillRect(R(x - cam.x) - 2, R(rail(x, 0) - cam.y) - 2, 5, 5); ctx.fillStyle = ROPE[3]; ctx.fillRect(R(x - cam.x) - 1, R(rail(x, 0) - cam.y) - 2, 2, 1); }
      return;
    }
    // la main courante du fond, et les suspentes qui la relient au tablier (de part et d'autre)
    rope((x) => rail(x, 2), 2, 1);
    for (const p of B.planks) {
      if (!p.active) continue;
      const cx = p.x + p.w / 2;
      for (const [k, dx, col] of [[2, -6, ROPE[1]], [0, 6, ROPE[2]]]) {
        const x = R(cx + dx - cam.x), y0 = R(rail(cx + dx, k) - cam.y), y1 = R(p.y - cam.y);
        ctx.fillStyle = col; ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      }
    }
    // deux cordes porteuses sous les planches
    rope((x) => deck(x) + 5, 1, 1);
    // les planches (une planche pourrie tremble, puis tombe en tournant un peu)
    for (const p of B.planks) {
      if (p.state === 'gone') continue;
      const img = p.rotten ? this.rottenPlanks[p.i % 2] : this.planks[(p.i * 5 + 1) % 6];
      let sx = R(p.x - cam.x), sy = R(p.y - cam.y) - 1;
      if (p.state === 'shake') sx += R(Math.sin(time * 70 + p.i) * 1);
      if (p.state === 'fall') { ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1); }
      if (p.state === 'grow') ctx.globalAlpha = Math.min(1, p.t / 0.4);
      if (ctx.globalAlpha > 0) ctx.drawImage(img, sx, sy);
      ctx.globalAlpha = 1;
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
    for (const B of f.bridges ?? []) this.bridge(ctx, B, cam, vw, vh, time, 'front');
    this.drawRopeHands(ctx, cam);
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
    this.drawGalleries(ctx, cam, vw, vh, time);
    this.drawFore(ctx, cam, vw, vh, time);
  }

  water(ctx, w, cam, vw, vh, time) {
    const x0 = R(w.x - cam.x), y0 = R(w.y + 3 - cam.y), W = w.w, H = w.h - 3;
    // l'oasis souterraine luit sous les perles (turquoise) ; les autres eaux de la caverne sont d'encre
    const ramp = w.oasis ? ['#0a2a30', '#0f3d44', '#17575c', '#23767a'] : w.under ? ['#06141a', '#0a2029', '#0f2f38', '#16424a'] : C.WATER;
    // reflet : on recopie, retournée, la bande d'image juste au-dessus de la surface
    if (!w.sub && (w.mirror || !w.flow)) {
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
      // en surface, l'eau laisse voir un peu ce qui est derrière ; dès 14 px, elle est opaque et fonce sans fin
      const a = Math.min(1, k / 14);
      ctx.globalAlpha = w.under ? 0.85 + a * 0.15 : 0.42 + a * 0.58;
      const dk = Math.min(1, k / 30);
      ctx.fillStyle = w.under ? (k > 40 ? '#040d11' : ramp[Math.max(0, 3 - Math.floor(dk * 4))]) : k > 64 ? '#08222a' : k > 40 ? C.WATER[0] : sky[Math.min(5, 2 + Math.floor(dk * 4))];
      ctx.fillRect(x0, y0 + k, W, 1);
    }
    ctx.globalAlpha = 1;
    // la surface : une ligne claire, des reflets qui scintillent (le torrent les emporte)
    ctx.fillStyle = w.oasis ? '#7fe3e0' : w.under ? '#2c6f78' : C.WATER[4];
    ctx.fillRect(x0, y0, W, 1);
    if (w.oasis) {
      // les perles du grand arbre se reflètent : des points cyan et violets qui scintillent sous la surface
      for (let i = 0; i < W / 4; i++) {
        const tw = Math.sin(time * (1.3 + ih(i, 3, 7) * 2) + i * 1.7);
        if (tw < 0.1) continue;
        ctx.globalAlpha = 0.35 + tw * 0.6;
        ctx.fillStyle = ih(i, 4, 7) < 0.5 ? '#6fd6ee' : ih(i, 5, 7) < 0.6 ? '#a67cf0' : '#e8fdff';
        ctx.fillRect(x0 + R(ih(i, 1, 7) * W + Math.sin(time * 0.8 + i) * 1.5), y0 + 2 + Math.floor(ih(i, 2, 7) * 12), 1, 1);
      }
      ctx.globalAlpha = 1;
      // des nénuphars posés sur l'eau, bercés ; une fleur sur deux luit
      for (let x = 5; x < W - 5; x += 10) {
        if (ih(x, 1, w.x) < 0.3) continue;
        const cx = x0 + x + Math.floor(ih(x, 2, w.x) * 4) + R(Math.sin(time * 0.6 + x) * 1), r = 3 + Math.floor(ih(x, 3, w.x) * 2), cy = y0;
        for (let dx = -r; dx <= r; dx++) {
          if (dx > 0 && dx < 3) { ctx.fillStyle = '#0e3a34'; ctx.fillRect(cx + dx, cy, 1, 1); continue; }   // l'encoche
          ctx.fillStyle = '#2e8b6a'; ctx.fillRect(cx + dx, cy - 1, 1, 1);
          ctx.fillStyle = Math.abs(dx) === r ? '#0e3a34' : '#17594c'; ctx.fillRect(cx + dx, cy, 1, 1);
        }
        if (ih(x, 4, w.x) < 0.55) {
          const f = ih(x, 5, w.x) < 0.5 ? ['#a67cf0', '#e9d8ff'] : ['#6fd6ee', '#e8fdff'];
          ctx.fillStyle = f[0]; ctx.fillRect(cx - 1, cy - 2, 3, 1); ctx.fillRect(cx, cy - 3, 1, 1);
          ctx.fillStyle = f[1]; ctx.fillRect(cx, cy - 2, 1, 1);
          ctx.globalAlpha = 0.25; ctx.fillStyle = f[0]; ctx.fillRect(cx - 2, cy - 4, 5, 4); ctx.globalAlpha = 1;
        }
      }
    }
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
    if (w.flow) this.torrent(ctx, w, x0, y0, cam, time);
  }

  /**
   * La vie du torrent : l'écume qui bat le pied des rochers et leur sillage vers l'aval, des embruns qui
   * jaillissent, des brindilles et des feuilles emportées par le courant.
   */
  torrent(ctx, w, x0, y0, cam, time) {
    this.riverRocks ??= this.level.props.filter((p) => p.type === 'river_rock').map((p) => ({ x: p.x * TILE + 8, w: [12, 16, 22][p.s ?? 1], s: p.s ?? 1 }));
    const FOAM = ['#ffffff', '#e4f7f5', '#bfe8e6'];
    for (const r of this.riverRocks) {
      if (r.x + r.w + 40 < w.x || r.x - r.w > w.x + w.w) continue;
      const sx = R(r.x - cam.x);
      // le bourrelet d'écume contre le rocher, qui palpite
      for (let dx = -r.w - 2; dx <= r.w + 4; dx++) {
        const k = Math.abs(dx) / (r.w + 3), on = Math.sin(time * 9 + dx * 1.3 + r.x) > k * 1.4 - 0.6;
        if (!on) continue;
        ctx.fillStyle = FOAM[k > 0.8 ? 2 : k > 0.5 ? 1 : 0];
        ctx.fillRect(sx + dx, y0 - (Math.abs(dx) < r.w * 0.6 && Math.sin(time * 13 + dx) > 0.3 ? 1 : 0), 1, 1);
      }
      // le sillage : deux traînées d'écume qui s'écartent vers l'aval
      for (let i = 0; i < 18 + r.s * 6; i++) {
        const t = ((time * 1.6 + i * 0.13 + r.x * 0.01) % 1), dx = r.w + 3 + t * (34 + r.s * 10), spread = Math.round(t * 3);
        if (ih(i, 3, r.x) < t * 0.8) continue;
        ctx.fillStyle = FOAM[1 + (t > 0.5 ? 1 : 0)];
        ctx.fillRect(sx + R(dx), y0 + 1 + spread * (i % 2), 2, 1);
      }
      // des embruns : quelques gouttes jaillissent et retombent
      for (let i = 0; i < 2 + r.s; i++) {
        const t = (time * 1.1 + i * 0.37 + r.x * 0.003) % 1.3;
        if (t > 0.6) continue;
        const gx = sx - r.w * 0.6 + (ih(i, Math.floor(time * 1.1 + i * 0.37), r.x) - 0.3) * r.w * 1.4, gy = y0 - 2 - (t * 18 - t * t * 30) * (1 + r.s * 0.4);
        ctx.fillStyle = FOAM[i % 2];
        ctx.fillRect(R(gx + t * 6), R(gy), 1, 1);
      }
    }
    // ce que le courant emporte : brindilles, feuilles, une écorce (on ne s'y pose pas : elles passent)
    const n = Math.max(2, Math.floor(w.w / 90));
    for (let i = 0; i < n; i++) {
      const sp = 30 + ih(i, 1, w.x) * 18, px = ((ih(i, 2, w.x) * w.w + time * sp) % (w.w + 40)) - 20;
      if (px < 0 || px > w.w) continue;
      const x = x0 + R(px), y = y0 + 1 + Math.round(Math.sin(time * 3 + i) * 0.6), kind = Math.floor(ih(i, 3, w.x) * 3);
      if (kind === 0) { ctx.fillStyle = '#4a2f1c'; ctx.fillRect(x, y, 6, 1); ctx.fillStyle = '#6d4528'; ctx.fillRect(x + 1, y - 1, 2, 1); ctx.fillRect(x + 4, y + 1, 2, 1); }
      else if (kind === 1) { ctx.fillStyle = C.LEAF[3]; ctx.fillRect(x, y, 3, 1); ctx.fillStyle = C.LEAF[5]; ctx.fillRect(x + 1, y - 1, 1, 1); }
      else { ctx.fillStyle = '#c98a4a'; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = '#e0b060'; ctx.fillRect(x + 1, y - 1, 1, 1); }
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

  /**
   * Les galeries de la zone 5 : une pénombre plus légère que celle du souterrain, posée sur les seuls
   * couloirs ; KAGE, la lanterne, les champignons (qui s'allument à son approche) et l'arbre à perles
   * l'éclairent. Un avant-goût de la caverne.
   */
  drawGalleries(ctx, cam, vw, vh, time) {
    const g = this.f?.def?.galleries;
    if (!g || g.x1 < cam.x || g.x0 > cam.x + vw || g.y1 < cam.y || g.y0 > cam.y + vh) return;
    if (!this.gal) {
      const inG = (x, y) => x >= g.x0 && x < g.x1 && y >= g.y0 && y < g.y1;
      const cells = [], lamps = [];
      for (let ty = Math.floor(g.y0 / TILE); ty < g.y1 / TILE; ty++) for (let tx = Math.floor(g.under / TILE); tx < g.x1 / TILE; tx++) {
        const ch = this.rows[ty]?.[tx];
        if (ch == null || '#=|%'.includes(ch)) continue;
        cells.push([tx, ty, ch === 'v' || this.rows[ty - 3]?.[tx] === '.' && this.rows[ty + 1]?.[tx] !== '#' && ty > 42 ? 0.75 : 0.42]);
      }
      for (let ty = Math.floor(g.y0 / TILE); ty < g.y1 / TILE; ty++) for (let tx = Math.floor(g.x0 / TILE); tx < g.x1 / TILE; tx++) if (this.rows[ty]?.[tx] === 'P') lamps.push([tx * TILE + 8, ty * TILE + 4]);
      this.gal = { cells, lamps, glows: this.glows.filter((m) => inG(m.x, m.y)), trees: this.pearlTrees.filter(({ shape }) => inG(shape.cx, shape.gy - 4)) };
    }
    const G = this.gal, p = this.level.player;
    for (const m of G.glows) if (p && Math.hypot(p.x - m.x, p.y - m.y) < 110) m.lit = Math.min(1, m.lit + 0.03);
    if (!this.gshade || this.gshade.width !== vw || this.gshade.height !== vh) this.gshade = canvas(vw, vh);
    const s = this.gshade.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, vw, vh);
    for (const [tx, ty, a] of G.cells) {
      const sx = R(tx * TILE - cam.x), sy = R(ty * TILE - cam.y);
      if (sx < -16 || sx > vw || sy < -16 || sy > vh) continue;
      s.fillStyle = `rgba(3,7,11,${a * 0.75})`; s.fillRect(sx, sy, TILE, TILE);
    }
    s.globalCompositeOperation = 'destination-out';
    if (p) s.drawImage(this.halo, R(p.x - cam.x - 72), R(p.y - 14 - cam.y - 72));
    for (const [lx, ly] of G.lamps) { s.globalAlpha = 0.9; s.drawImage(this.halo, R(lx - cam.x - 60), R(ly - cam.y - 60), 120, 120); }
    for (const m of G.glows) { if (m.lit <= 0) continue; s.globalAlpha = m.lit * 0.9; s.drawImage(this.haloSmall, R(m.x - cam.x - 30), R(m.y - 10 - cam.y - 30), 60, 60); }
    for (const { shape } of G.trees) { s.globalAlpha = 0.85; s.drawImage(this.halo, R(shape.cx - cam.x - 54), R(shape.gy - shape.trunkH * 0.9 - cam.y - 54), 108, 108); }
    s.globalAlpha = 1; s.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.gshade, 0, 0);
    // la lueur colorée des champignons, puis les champignons eux-mêmes
    ctx.globalCompositeOperation = 'lighter';
    for (const m of G.glows) {
      const sx = R(m.x - cam.x), sy = R(m.y - cam.y);
      if (m.lit <= 0.05) continue;
      const img = this.tint[(m.x >> 4) % 3 === 1 ? 1 : 0], r = m.big ? 34 : 24;
      ctx.globalAlpha = m.lit * (0.3 + 0.06 * Math.sin(time * 1.7 + m.x));
      ctx.drawImage(img, sx - r, sy - 10 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const m of G.glows) {
      const sx = R(m.x - cam.x), sy = R(m.y - cam.y);
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
    const d = this.f.dark;
    if (!d || d.x1 < cam.x || d.x0 > cam.x + vw || cam.y + vh < d.y0) this.drawPearls(ctx, cam, vw, vh, time);
  }

  /**
   * La branche qui rompt : elle tremble et craque (une fissure s'ouvre à la jointure), pivote vers le
   * bas en restant tenue par quelques fibres, puis se détache et tombe en tournant. Au tronc reste un
   * moignon aux échardes claires.
   */
  drawSnap(ctx, q, A, cam, vw, vh, time) {
    if (!A || !this.vis(A.x - 40, A.y - 20, A.img.width + 80, 400, cam, vw, vh)) return;
    const px = A.px, py = A.py;
    const stub = () => {
      // le moignon : du bois clair fendu, des échardes
      const x = R(px - cam.x), y = R(py - cam.y);
      ctx.fillStyle = '#3d2314'; ctx.fillRect(x - 4, y - 3, 6, 7);
      ctx.fillStyle = '#57301c'; ctx.fillRect(x - 4, y - 3, 6, 2);
      ctx.fillStyle = '#d9b98a'; ctx.fillRect(x - 5, y - 2, 1, 1); ctx.fillRect(x - 6, y, 2, 1); ctx.fillRect(x - 5, y + 2, 1, 1);
      ctx.fillStyle = '#b48a5c'; ctx.fillRect(x - 5, y - 1, 1, 1); ctx.fillRect(x - 5, y + 1, 1, 2); ctx.fillRect(x - 7, y + 1, 1, 1);
    };
    if (q.state === 'gone') { stub(); return; }
    if (q.state === 'idle' || q.state === 'crack') {
      const k = q.state === 'crack' ? q.t / FOREST.snap.hold : 0;
      const jit = q.state === 'crack' ? R(Math.sin(time * 75) * (0.4 + k)) : 0;
      ctx.save();
      ctx.translate(R(px - cam.x), R(py - cam.y) + (q.y - q.y0));
      ctx.rotate(-0.035 * k);
      ctx.drawImage(A.img, R(A.x - px) + jit, R(A.y - py));
      ctx.restore();
      if (q.state === 'crack') {
        // la fissure qui s'ouvre à la jointure
        const x = R(px - cam.x) - 3, y = R(py - cam.y) + (q.y - q.y0) - 3, n = 2 + Math.floor(k * 5);
        ctx.fillStyle = '#120a06';
        for (let j = 0; j < n; j++) ctx.fillRect(x + (j % 2), y + j, 1, 1);
        if (k > 0.5) { ctx.fillStyle = '#d9b98a'; ctx.fillRect(x + 1, y + 1, 1, 1); }
      }
      return;
    }
    // pivote, puis tombe
    stub();
    ctx.save();
    ctx.translate(R(px + q.fx - cam.x), R(py + q.fy - cam.y));
    ctx.rotate(q.ang);
    ctx.drawImage(A.img, R(A.x - px), R(A.y - py));
    // le bout arraché : des fibres claires
    ctx.fillStyle = '#d9b98a'; ctx.fillRect(-1, -2, 2, 1); ctx.fillRect(0, 0, 2, 1); ctx.fillRect(-1, 2, 2, 1);
    ctx.restore();
  }

  /**
   * La corde de la statue (zone 9). Le bloc de granit qui ferme le tunnel, ficelé d'une corde en croix ;
   * la corde monte au bord de la falaise jusqu'à la grande poulie (une roue de bois cerclée sur un
   * chevalet), passe dessus et revient le long de la branche jusqu'à son bout — ou jusqu'à KAGE qui la
   * tire. Au repos, quand KAGE est sur la branche : une lueur dorée pulse sur le bout de la corde et des
   * chevrons clignotent vers la gauche (« tirez par là »). Coincée, elle s'enroule sur le rameau.
   */
  drawRopeWorks(ctx, r, cam, vw, vh, time) {
    const X = r.door * TILE, G = r.ground, cx = r.pulleyX, cy = r.branchY - 16, RAD = 13;
    const ROPE = ['#3e3020', '#5c4a2e', '#7d6640', '#a08756', '#c4ab74'];
    const P = this.level.player;
    const rope = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) {
        const x = R(x0 + (x1 - x0) * i / n - cam.x), y = R(y0 + (y1 - y0) * i / n - cam.y);
        if (x < -4 || x > vw + 4 || y < -4 || y > vh + 4) continue;
        ctx.fillStyle = ((i + R(r.pull)) >> 1) % 2 ? ROPE[3] : ROPE[2]; ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = ROPE[1]; ctx.fillRect(x, y + 1, 2, 1);
      }
    };
    // le bloc : plus large que le passage, levé de r.lift
    if (!this.block) {
      const W = 26, H = 34;
      this.block = sprite(W, H, (p) => {
        const S = ['#232b30', '#323e45', '#45545c', '#5c6d75', '#7a8a90', '#9aa8aa'];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const e = Math.min(x, y, W - 1 - x, H - 1 - y);
          if (e === 0 && ih(x, y, 151) < 0.35) continue;                  // arêtes ébréchées
          let v = 0.66 - (x / W) * 0.35 - (y / H) * 0.12 + (noise2(x * 0.3, y * 0.3, 152) - 0.5) * 0.2;
          if (e === 0) v += x === 0 || y === 0 ? 0.15 : -0.3;
          if ((x * 3 + y * 7) % 11 === 0 && ih(x, y, 153) < 0.4) v -= 0.18;   // traces de ciseau
          let c = pick(S, v, x, y);
          if (y < 4 && fbm2(x * 0.2, y * 0.3, 2, 154) > 0.5) c = y < 2 ? C.MOSS[4] : C.MOSS[2];
          if (y > H - 5 && ih(x, y, 155) < 0.3) c = C.MOSS[1];
          p.set(x, y, c);
        }
      });
    }
    const bw = this.block.width, bh = this.block.height;
    const bx = X + 8 - bw / 2, by = G - bh - r.lift;
    if (this.vis(bx - 4, by - 4, bw + 8, bh + 8, cam, vw, vh)) {
      const jit = r.state === 'held' && r.lift > 0 && r.lift < 30 ? R(Math.sin(time * 40) * 0.5) : 0;
      ctx.drawImage(this.block, R(bx - cam.x) + jit, R(by - cam.y));
      // la corde en croix sur sa face, et le nœud en haut
      rope(bx + 2, by + 3, bx + bw - 3, by + bh - 4); rope(bx + bw - 3, by + 3, bx + 2, by + bh - 4); rope(bx + 1, by + bh / 2, bx + bw - 2, by + bh / 2);
      ctx.fillStyle = ROPE[1]; ctx.fillRect(R(X + 6 - cam.x), R(by - 3 - cam.y), 5, 4);
      ctx.fillStyle = ROPE[3]; ctx.fillRect(R(X + 7 - cam.x), R(by - 3 - cam.y), 2, 1);
    }
    // la corde qui monte du bloc à la poulie (tangente au côté droit de la roue)
    rope(X + 8, by - 3, cx + RAD, cy);
    // la poulie : le chevalet sur la branche, la roue qui tourne avec la corde
    if (this.vis(cx - 24, cy - 24, 48, 48, cam, vw, vh)) {
      const WOOD = ['#2a1a10', '#3f2a1a', '#5a3d25', '#765233', '#946a43'];
      const sx = R(cx - cam.x), sy = R(cy - cam.y);
      for (const dx of [-5, 4]) { ctx.fillStyle = WOOD[1]; ctx.fillRect(sx + dx, sy, 3, R(r.branchY - cy) + 1); ctx.fillStyle = WOOD[3]; ctx.fillRect(sx + dx, sy, 1, R(r.branchY - cy) + 1); }
      ctx.fillStyle = WOOD[0]; ctx.fillRect(sx - 7, R(r.branchY - cam.y) - 2, 16, 3);
      const ang = -r.pull / RAD;
      for (let y = -RAD; y <= RAD; y++) for (let x = -RAD; x <= RAD; x++) {
        const d = Math.hypot(x, y);
        if (d > RAD) continue;
        let c = null;
        if (d > RAD - 2) c = d > RAD - 1 ? '#2b2620' : '#5a5048';                        // le cercle de fer, la gorge
        else if (d > RAD - 4) c = WOOD[2 + ((x + y) > 0 ? 0 : 1)];                        // la jante
        else if (d < 3) c = d < 1.5 ? '#9aa0a0' : '#4a4a48';                              // le moyeu
        else {
          const a = Math.atan2(y, x) - ang, sp = Math.abs(((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6);
          if (sp < 0.16 + 0.5 / d) c = WOOD[x < 0 ? 3 : 2];                                // six rayons
        }
        if (c) { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, 1, 1); }
      }
      // la corde passe dans la gorge, par-dessus
      for (let a = 0; a <= Math.PI; a += 0.08) { ctx.fillStyle = ROPE[2]; ctx.fillRect(R(sx + Math.cos(a) * (RAD - 1)), R(sy - Math.sin(a) * (RAD - 1)), 1, 1); }
    }
    // l'autre brin : de la poulie au bout de la corde (sur la branche), ou jusqu'à KAGE
    const lx = cx - RAD, held = r.state === 'held' && P?.state === 'rope_pull';
    if (held) {
      const sh = this.ropePoint(P, 'shoulder');
      rope(lx, cy, sh.x, sh.y);
    } else {
      const endX = r.state === 'caught' ? r.twig + 3 : r.end - r.pull;
      rope(lx, cy, lx - 6, r.branchY - 2);
      rope(lx - 6, r.branchY - 2, endX, r.branchY - 2);
      if (r.state === 'caught') {
        // emmêlée dans le rameau : deux tours, et le bout qui pend
        const tx = R(r.twig - cam.x), ty = R(r.branchY - cam.y);
        ctx.fillStyle = ROPE[1]; ctx.fillRect(tx, ty - 6, 5, 2); ctx.fillRect(tx + 1, ty - 3, 4, 2);
        ctx.fillStyle = ROPE[3]; ctx.fillRect(tx + 1, ty - 6, 2, 1); ctx.fillRect(tx + 2, ty - 3, 2, 1);
        for (let k = 0; k < 7; k++) { ctx.fillStyle = ROPE[k % 2 ? 2 : 1]; ctx.fillRect(tx - 1, ty - 1 + k, 1, 1); }
      } else {
        // le bout effiloché ; au repos et KAGE sur la branche : une lueur qui pulse, des chevrons vers la gauche
        const ex = R(endX - cam.x), ey = R(r.branchY - 2 - cam.y);
        const near = P && Math.abs(P.y - r.branchY) < 6 && Math.abs(P.x - endX) < 110 && r.state === 'rest';
        const twitch = near && Math.sin(time * 9) > 0.7 ? -1 : 0;
        ctx.fillStyle = ROPE[4]; ctx.fillRect(ex - 3, ey + twitch, 2, 1); ctx.fillRect(ex - 4, ey + 1 + twitch, 1, 1); ctx.fillRect(ex - 2, ey + 1, 1, 1);
        if (near) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 4);
          if (!this.ropeGlow) this.ropeGlow = haloSprite(14);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.3 * pulse;
          ctx.drawImage(this.tint?.[2] ?? this.ropeGlow, ex - 12, ey - 12, 24, 24); ctx.restore();
          for (let k = 0; k < 4; k++) if (Math.sin(time * 5 + k * 1.9) > 0.6) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(ex - 6 + ((k * 7) % 11), ey - 5 - (k % 3) * 2, 1, 1); }
          // des chevrons dorés qui s'allument l'un après l'autre, vers la gauche : le sens où tirer
          for (let k = 0; k < 4; k++) {
            const on = ((Math.floor(time * 5) - k) % 4 + 4) % 4 === 0;
            ctx.globalAlpha = on ? 0.95 : 0.25;
            ctx.fillStyle = '#ffd36a';
            const cxk = ex - 16 - k * 10, cyk = ey - 6;
            ctx.fillRect(cxk, cyk, 1, 1); ctx.fillRect(cxk + 1, cyk - 1, 1, 1); ctx.fillRect(cxk + 1, cyk + 1, 1, 1); ctx.fillRect(cxk + 2, cyk - 2, 1, 1); ctx.fillRect(cxk + 2, cyk + 2, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /** Un point de la corde dans les mains de KAGE (grip : les mains ; shoulder : le haut de l'épaule). */
  ropePoint(P, key) {
    const A = P.meta.animations.rope_pull, pts = A?.[key];
    const [px, py] = pts?.[P.anim.frame] ?? [P.meta.pivot.x, P.meta.pivot.y - 20];
    return { x: P.x + P.facing * (px - P.meta.pivot.x), y: P.y + (py - P.meta.pivot.y) };
  }

  /** Devant KAGE : le brin de corde de l'épaule aux mains, et le bout qui pend sous ses poings. */
  drawRopeHands(ctx, cam) {
    const r = this.f?.rope, P = this.level.player;
    if (!r || r.state !== 'held' || P?.state !== 'rope_pull') return;
    const a = this.ropePoint(P, 'shoulder'), b = this.ropePoint(P, 'grip');
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let i = 0; i <= n; i++) {
      const x = R(a.x + (b.x - a.x) * i / n - cam.x), y = R(a.y + (b.y - a.y) * i / n - cam.y);
      ctx.fillStyle = (i >> 1) % 2 ? '#a08756' : '#7d6640'; ctx.fillRect(x, y, 1, 2);
    }
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#7d6640' : '#5c4a2e'; ctx.fillRect(R(b.x - cam.x) + (k > 2 ? 1 : 0), R(b.y - cam.y) + 1 + k, 1, 1); }
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
    // la nuit tombe progressivement en descendant dans l'arbre creux ; vers la sortie, elle se lève peu à peu
    const fx1 = this.exitFade ? x1 - this.exitFade.width : x1;
    for (let y = Math.max(0, y0); y < vh; y++) {
      const a = Math.min(0.62, Math.max(0, (y - y0) / 48) * 0.62);
      g.fillStyle = `rgba(3,7,11,${a.toFixed(3)})`;
      g.fillRect(Math.max(0, x0), y, Math.max(0, Math.min(vw, fx1) - Math.max(0, x0)), 1);
      if (y0 > -999 && this.exitFade && fx1 < vw) { g.globalAlpha = a / 0.62; g.drawImage(this.exitFade, 0, y & 3, this.exitFade.width, 1, fx1, y, this.exitFade.width, 1); g.globalAlpha = 1; }
    }
    if (y0 <= -999 && this.exitFade && fx1 < vw) g.drawImage(this.exitFade, 0, 0, this.exitFade.width, 4, fx1, 0, this.exitFade.width, vh);
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
    // les arbres à perles éclairent leur coin de caverne
    for (const { p: pt, shape } of this.pearlTrees) {
      const r = [0, 38, 54, 120][pt.s ?? 1];
      const sx = R(shape.cx - cam.x), sy = R(shape.gy - shape.trunkH * 0.9 - cam.y);
      if (sx < -r || sx > vw + r || sy < -r || sy > vh + r) continue;
      g.globalAlpha = 0.85; g.drawImage(this.halo, sx - r, sy - r, r * 2, r * 2); g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.shade, 0, 0);
    // la lumière du jour entre par la sortie : une nappe dorée et verte qui s'avance dans le couloir
    if (this.exitFade && x1 > -40 && x1 - this.exitFade.width < vw) {
      if (!this.spill) this.spill = haloSprite(80);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const r = 40 + k * 26, sy = R((this.exitY ?? d.y0) - cam.y) - 24;
        ctx.globalAlpha = 0.08 + 0.02 * Math.sin(time * 0.7 + k);
        ctx.drawImage(this.tint[2] ?? this.tint[0], x1 - r * 1.6, sy - r, r * 2.2, r * 2);
      }
      ctx.restore();
    }
    this.drawPearls(ctx, cam, vw, vh, time);
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

  /** Les perles qui scintillent, la lumière bleutée des arbres, les papillons lumineux. */
  drawPearls(ctx, cam, vw, vh, time) {
    const COLS = [['#6fd6ee', '#c4fbff'], ['#a67cf0', '#dcc4ff'], ['#ffe7a8', '#fff7dc']];
    ctx.globalCompositeOperation = 'lighter';
    for (const { p: pt, shape } of this.pearlTrees) {
      const r = [0, 40, 56, 130][pt.s ?? 1];
      const sx = R(shape.cx - cam.x), sy = R(shape.gy - shape.trunkH * 0.9 - cam.y);
      if (sx < -r || sx > vw + r || sy < -r || sy > vh + r) continue;
      ctx.globalAlpha = 0.18 + 0.03 * Math.sin(time * 0.8 + pt.x);
      ctx.drawImage(this.tint[0], sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const { shape } of this.pearlTrees) {
      if (shape.cx + 100 < cam.x || shape.cx - 100 > cam.x + vw) continue;
      for (const pe of shape.pearls) {
        const sx = R(pe.x - cam.x), sy = R(pe.y - cam.y + Math.sin(time * 1.2 + pe.ph) * 0.6);
        if (sx < -2 || sx > vw + 2 || sy < -2 || sy > vh + 2) continue;
        const tw = 0.55 + 0.45 * Math.sin(time * 2.2 + pe.ph * 3);
        const [mid, hi] = COLS[pe.c];
        ctx.globalAlpha = 0.35 * tw; ctx.fillStyle = mid; ctx.fillRect(sx - 1, sy - 1, 3, 3);
        ctx.globalAlpha = 0.6 + 0.4 * tw; ctx.fillStyle = tw > 0.7 ? hi : mid; ctx.fillRect(sx, sy, 1, pe.big ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1;
    // les papillons : ailes qui battent, une lueur qui les suit
    for (const b of this.butterflies) {
      const x = b.cx + Math.sin(time * b.a + b.ph) * b.rx + Math.sin(time * 1.7 + b.ph) * 4;
      const y = b.cy + Math.sin(time * b.b * 1.3 + b.ph * 2) * b.ry;
      const sx = R(x - cam.x), sy = R(y - cam.y);
      if (sx < -4 || sx > vw + 4 || sy < -4 || sy > vh + 4) continue;
      const [mid, hi] = COLS[b.c], open = Math.sin(time * 14 + b.ph) > 0;
      ctx.globalAlpha = 0.25; ctx.fillStyle = mid; ctx.fillRect(sx - 2, sy - 2, 5, 4);
      ctx.globalAlpha = 1; ctx.fillStyle = hi;
      ctx.fillRect(sx, sy, 1, 2);
      if (open) { ctx.fillStyle = mid; ctx.fillRect(sx - 2, sy - 1, 2, 2); ctx.fillRect(sx + 1, sy - 1, 2, 2); }
      else { ctx.fillStyle = mid; ctx.fillRect(sx - 1, sy - 2, 1, 2); ctx.fillRect(sx + 1, sy - 2, 1, 2); }
    }
  }

  /** Premier plan : frondes et herbes sombres en bas de l'image (la lumière de la zone). */
  drawFore(ctx, cam, vw, vh) {
    const list = this.art.backdrop.weights(cam, vw, vh);
    // rien ne pousse sur l'eau : la bande est découpée au-dessus des colonnes où l'on voit de l'eau en bas de l'image
    const lv = this.level, r0 = Math.floor(cam.y / 16), r1 = Math.floor((cam.y + vh) / 16);   // (l'eau est profonde : toute la colonne compte)
    const gal = this.f?.def?.galleries, galTx0 = gal ? Math.floor(gal.x0 / 16) : 0, galTx1 = gal ? Math.ceil(gal.x1 / 16) + 2 : 0;
    const inGal = gal && cam.y + vh > gal.y0 + 40;                     // dans les galeries : pas de fougères devant
    const wet = (tx) => { if (inGal && tx >= galTx0 && tx < galTx1) return true; for (let r = r0; r <= r1; r++) if (lv.at(tx, r) === '~') return true; return false; };
    let clip = null, run = null;
    const flush = () => { if (!run) return; clip ??= (() => { const q = new Path2D(); q.rect(0, vh - 62, vw, 70); return q; })(); clip.rect(R(run[0] * 16 - cam.x) - 6, vh - 62, (run[1] - run[0] + 1) * 16 + 12, 70); run = null; };
    for (let tx = Math.floor(cam.x / 16); tx * 16 < cam.x + vw; tx++) {
      if (wet(tx)) { if (run) run[1] = tx; else run = [tx, tx]; } else flush();
    }
    flush();
    if (clip) { ctx.save(); ctx.clip(clip, 'evenodd'); }
    for (const [i, o] of list.entries()) {
      const m = C.MOODS[o.mood];
      if (!m || m.cave) continue;
      const fs = (this.fore[o.mood] ??= foreStrip(m));
      ctx.globalAlpha = i === 0 ? 1 : o.w;
      const off = (((cam.x * 1.25) % 768) + 768) % 768;
      let dx = -(off % 1), x = Math.floor(off);
      while (dx < vw) { const w = Math.min(768 - x, vw - dx + 1); ctx.drawImage(fs.grass, x, 0, w, 70, R(dx), vh - 62, w, 70); dx += w; x = 0; }
      for (const f of fs.fronds) for (let sx = f.x - off - 768; sx < vw + f.w; sx += 768) {
        if (sx < -f.w) continue;
        let over = false;                                   // ni le pied ni les feuilles au-dessus de l'eau
        for (let t = Math.floor((cam.x + sx - f.w / 2 + 12) / 16); t <= Math.floor((cam.x + sx + f.w / 2 - 12) / 16); t++) if (wet(t)) { over = true; break; }
        if (over) continue;
        ctx.drawImage(f.img, R(sx - f.w / 2), vh - 62);
      }
    }
    ctx.globalAlpha = 1;
    if (clip) ctx.restore();
  }
}
