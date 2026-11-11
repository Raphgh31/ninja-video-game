// Les décors de la Forêt, déclarés dans chapters/foret.js (b.prop) ou déduits de
// la carte (branches, arbres creux). Chacun est peint une seule fois, à la
// demande, dans sa propre image posée dans le monde, sur une couche :
//   'behind' : derrière le terrain (troncs lointains, intérieur d'un arbre creux) ;
//   'over'   : sur le terrain, derrière KAGE (rochers, souches, racines, branches) ;
//   'front'  : devant KAGE (éboulis du couloir, joue de la statue…).
// Les décors qui dessinent eux-mêmes un bloc plein (rocher, souche, racine,
// pilier, tronc couché) masquent ces tuiles pour la peinture du terrain.
// Règle du chapitre 1 : rien ne flotte. Chaque branche tient à un tronc, chaque
// tronc couché repose sur des pierres, chaque liane pend d'une branche visible.
import { ih, noise1, noise2, fbm2, pick, worley, bayer } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';
import { Window } from './world.js';

const TILE = 16;

/** Ligne du sol autour d'un bloc (première ligne pleine à gauche ou à droite, à partir de row). */
function groundBeside(level, x, w, row) {
  for (let r = row; r < level.h; r++) {
    const a = level.rows[r]?.[x - 1], b = level.rows[r]?.[x + w];
    if (a === '#' || a === '=' || b === '#' || b === '=') return r;
  }
  return level.h;
}
/** Le vrai sol autour d'un bloc : la ligne de dessus la plus fréquente des colonnes voisines (hors du bloc). */
function regionGround(level, x, w, row) {
  const count = new Map();
  for (let c = x - 8; c < x + w + 8; c++) {
    if (c >= x && c < x + w) continue;
    let r = row; while (r < level.h && !'#=|'.includes(level.rows[r]?.[c] ?? '#')) r++;
    if (r <= row) continue;
    count.set(r, (count.get(r) ?? 0) + 1);
  }
  let best = row + 1, n = -1;
  for (const [r, k] of count) if (k > n || (k === n && r > best)) { best = r; n = k; }
  return best;
}
/** Première ligne pleine sous (col, row). */
function floorBelow(level, col, row) {
  for (let r = row; r < level.h; r++) { const c = level.rows[r]?.[col]; if (c === '#' || c === '=' || c === '|') return r; }
  return level.h;
}

export class ForetProps {
  constructor(level) {
    this.level = level;
    this.list = [];               // { layer, x, y, w, h, paint(pix), img }
    this.mask = new Set();
    const add = (layer, x, y, w, h, paint) => this.list.push({ layer, x: Math.floor(x), y: Math.floor(y), w: Math.ceil(w), h: Math.ceil(h), paint, img: null });
    const mask = (x0, w, y0, y1) => { for (let i = 0; i < w; i++) for (let y = y0; y <= y1; y++) this.mask.add(`${x0 + i},${y}`); };
    this.add = add;
    const F = level.forest?.def ?? {};

    for (const p of level.props) {
      const X = p.x * TILE, Y = p.y * TILE;
      switch (p.type) {
        case 'temple_back': add('behind', X - 8, Y - 150, 120, 154, (pix) => templeBack(pix, X, Y)); break;
        case 'birch': { const h = Math.round(150 * (p.s ?? 1)); add('behind', X - 30, Y - h - 30, 76, h + 34, (pix) => birch(pix, X + 8, Y + 2, h, p.x)); break; }
        case 'pine_young': add('behind', X - 20, Y - 84, 56, 88, (pix) => L.fir(pix, X + 8, Y + 2, 70 + Math.floor(ih(p.x, 1, 3) * 14), 13, [C.PINE[1], C.PINE[3], C.PINE[5]], p.x)); break;
        case 'boulder': {
          const base = regionGround(level, p.x, p.w, p.y), hpx = (base - p.y) * TILE;
          mask(p.x, p.w, p.y, base - 1);
          add('over', X - 8, Y - 6, p.w * TILE + 16, hpx + 12, (pix) => boulder(pix, X, Y, p.w * TILE, hpx, p.x, p.wet));
          break;
        }
        case 'stump': {
          const base = regionGround(level, p.x, p.w, p.y), hpx = (base - p.y) * TILE;
          mask(p.x, p.w, p.y, base - 1);
          add('over', X - 14, Y - 6, p.w * TILE + 28, hpx + 12, (pix) => L.stump(pix, X + (p.w * TILE) / 2, base * TILE + 2, p.w * TILE + 2, hpx + 2, p.x));
          break;
        }
        case 'giant_root': {
          mask(p.x, p.w, p.y, p.y + p.h - 1);
          add('over', X - 60, Y - 8, p.w * TILE + 74, p.h * TILE + 12, (pix) => giantRoot(pix, level, p));
          break;
        }
        case 'ruin_arch': add('behind', X - 10, Y - 120, 84, 124, (pix) => ruinArch(pix, X, Y, p.broken, p.x)); break;
        case 'ruin_wall': add('behind', X, Y - p.h * TILE, p.w * TILE, p.h * TILE, (pix) => ruinWallP(pix, X, Y - p.h * TILE, p.w * TILE, p.h * TILE, p.x)); break;
        case 'ruin_drum': mask(p.x, p.w, p.y, p.y); add('over', X - 4, Y - 4, p.w * TILE + 8, TILE + 8, (pix) => ruinDrum(pix, X, Y, p.w * TILE)); break;
        case 'climb_trunk': add('behind', X - 40, (p.top - 6) * TILE, 96, (p.y - p.top + 7) * TILE, (pix) => climbTrunk(pix, X + 8, Y, (p.top - 2) * TILE, p.x)); break;
        case 'hollow_giant': {
          mask(p.x, 1, p.top, p.y - 1); mask(p.x + p.w - 1, 1, p.top, p.y - 1);
          add('behind', X - 30, (p.top - 8) * TILE, p.w * TILE + 60, (p.y - p.top + 9) * TILE, (pix) => hollowGiant(pix, level, p, 'behind'));
          add('over', X - 30, (p.top - 8) * TILE, p.w * TILE + 60, (p.y - p.top + 9) * TILE, (pix) => hollowGiant(pix, level, p, 'over'));
          break;
        }
        case 'mushrooms': add('over', X - 4, Y - 16, p.w * TILE + 8, 18, (pix) => mushrooms(pix, X, Y, p.w * TILE, p.x)); break;
        case 'rubble': add('front', X - 10, Y - (p.h + 3) * TILE - 6, (p.w + 1) * TILE + 20, (p.h + 3) * TILE + 8, (pix) => rubble(pix, X, Y, p.w, p.h)); break;
        case 'cliff': add('behind', X - TILE, Y - 3 * TILE, (p.w + 2) * TILE, 3 * TILE, (pix) => tunnelBack(pix, X - TILE, Y - 2 * TILE, (p.w + 2) * TILE)); break;
        case 'rock_pillar': case 'rock_ledge': {
          const bottom = level.h;
          mask(p.x, p.w, p.y, bottom - 1);
          add('over', X - 6, Y - 4, p.w * TILE + 12, (bottom - p.y) * TILE + 4, (pix) => rockColumn(pix, X, Y, p.w * TILE, (bottom - p.y) * TILE, p.x, p.type === 'rock_ledge'));
          break;
        }
        case 'fallen_log': {
          mask(p.x, p.w, p.y - 2, p.y - 1);
          const g = floorBelow(level, p.x - 1, p.y);
          add('over', X - 24, Y - 2 * TILE - 6, p.w * TILE + 48, (g - p.y + 2) * TILE + 10, (pix) => fallenLog(pix, X, Y - 2 * TILE, p.w * TILE, g * TILE, p.x));
          break;
        }
        case 'last_tree': add('behind', X - 90, Y - 330, 200, 334, (pix) => lastTree(pix, X + 8, Y + 2)); break;
        case 'horizon': add('behind', X - 40, Y - 200, 26 * TILE, 204, (pix) => horizon(pix, X, Y, 24 * TILE)); break;
        default: break;
      }
    }
    // la grande branche des lianes balancier (zone 10), portée par des fûts qui montent du ravin
    const vb = level.props.filter((p) => p.type === 'vine_branch');
    if (vb.length) {
      const x0 = (vb[0].x - 9) * TILE, x1 = (vb[vb.length - 1].x + 9) * TILE, y = vb[0].y * TILE;
      add('behind', x0 - 40, y - 90, x1 - x0 + 80, level.height - y + 90, (pix) => vineBough(pix, level, x0, x1, y, vb));
    }
    // arbres creux (zones 2 et 5) : l'intérieur sombre du passage, les racines du pied
    for (const hw of F.hollows ?? []) {
      const X = hw.x0 * TILE, Y = hw.ground * TILE;
      add('behind', X - 4, Y - (hw.open + 1) * TILE, hw.w * TILE + 8, (hw.open + 1) * TILE, (pix) => hollowInside(pix, X, Y, hw.w * TILE, hw.open * TILE));
      add('over', X - 26, Y - (hw.open + 2) * TILE, hw.w * TILE + 52, (hw.open + 2) * TILE + 4, (pix) => hollowFoot(pix, X, Y, hw.w * TILE, hw.open * TILE, hw.x0));
    }
    // les branches (« - ») : chacune tient à un tronc
    this.branches(add);
    this.layers = { behind: [], over: [], front: [] };
    for (const it of this.list) this.layers[it.layer].push(it);
  }

  /** Branches et planches « - » : une branche feuillue, et son appui (tronc qui descend au sol, ou tronc de remontée voisin). */
  branches(add) {
    const lv = this.level, climbs = lv.props.filter((p) => p.type === 'climb_trunk'), statue = lv.props.find((p) => p.type === 'statue');
    const decl = lv.props.filter((p) => p.type === 'branch');
    for (let ty = 0; ty < lv.h; ty++) {
      const row = lv.rows[ty];
      for (let tx = 0; tx < lv.w; tx++) {
        if (row[tx] !== '-' || row[tx - 1] === '-') continue;
        let w = 1; while (row[tx + w] === '-') w++;
        const X = tx * TILE, Y = ty * TILE, W = w * TILE;
        // sur la couronne de la statue : un tapis de feuilles (la statue le porte)
        if (statue && Math.abs(tx + w / 2 - statue.x) < 5 && Math.abs(ty - (statue.y - 13)) < 2) {
          add('over', X - 8, Y - 6, W + 16, 14, (pix) => leafMat(pix, X, Y, W, tx));
          continue;
        }
        const climb = climbs.find((c) => Math.abs(c.x - tx) <= 3 && ty >= c.top - 1 && ty < c.y);
        const d = decl.find((p) => p.x === tx && p.y === ty);
        if (climb) {
          // marche le long d'un tronc de remontée : une grosse branche qui sort du tronc
          const side = tx + w / 2 > climb.x + 0.5 ? 1 : -1;
          const tcx = climb.x * TILE + 8;
          add('over', Math.min(X, tcx) - 6, Y - 10, Math.abs(tcx - (side > 0 ? X + W : X)) + 14, 24, (pix) => limb(pix, side > 0 ? tcx + 4 : X - 2, side > 0 ? X + W + 2 : tcx - 4, Y, side, tx * 7 + ty, false));
          continue;
        }
        // sinon : un arbre dont le tronc descend jusqu'au sol (ou jusqu'au bas de la carte)
        const mid = tx + Math.floor(w / 2);
        const g = floorBelow(lv, mid, ty + 1);
        // le tronc à un bout de la branche (celui déclaré, sinon au hasard) : la branche en sort
        const end = d?.from === 'right' ? 1 : d?.from === 'left' ? -1 : ih(tx, ty, 5) < 0.5 ? -1 : 1;
        const tcx = (end > 0 ? tx + w : tx) * TILE + (end > 0 ? 6 : -6);
        const bottom = Math.min(lv.height, g * TILE + 4), topY = Math.max(0, Y - 260);
        add('behind', tcx - 44, topY, 88, bottom - topY, (pix) => branchTree(pix, tcx, Y, bottom, topY, tx * 3 + ty));
        add('over', X - 12, Y - 12, W + 24, 28, (pix) => limb(pix, end > 0 ? X - 4 : tcx, end > 0 ? tcx : X + W + 4, Y, -end, tx * 7 + ty, true));
        if (d?.nest) add('over', X + W / 2 - 18, Y - 14, 36, 18, (pix) => nest(pix, X + W / 2, Y));
      }
    }
  }

  /** Image d'un décor (peinte à la première demande). */
  img(it) {
    if (!it.img) {
      const pix = new Window(it.x, it.y, it.w, it.h);
      it.paint(pix);
      it.img = pix.done();
    }
    return it.img;
  }

  /** Peint un décor d'avance (proche de l'écran) ; renvoie true s'il a peint. */
  idle(cam, viewW, viewH) {
    const m = 200;
    for (const it of this.list) {
      if (it.img) continue;
      if (it.x > cam.x + viewW + m || it.x + it.w < cam.x - m || it.y > cam.y + viewH + m || it.y + it.h < cam.y - m) continue;
      this.img(it);
      return true;
    }
    return false;
  }

  draw(ctx, layer, cam, viewW, viewH) {
    for (const it of this.layers[layer]) {
      if (it.x > cam.x + viewW || it.x + it.w < cam.x || it.y > cam.y + viewH || it.y + it.h < cam.y) continue;
      ctx.drawImage(this.img(it), it.x - cam.x, it.y - cam.y);
    }
  }
}

// ===========================================================================
// les pinceaux des décors
// ===========================================================================

/** L'arrière du pavillon du temple : on en sort au début du chapitre. */
function templeBack(pix, X, Y) {
  const VER = ['#4a1a14', '#6e261c', '#93352a', '#b24a36'], WALL = ['#8a8270', '#a89e86', '#c4bba0', '#ddd5bb'], TILEC = ['#1d2228', '#2b333b', '#3d4851', '#56636b'];
  const x0 = X - 4, x1 = X + 104;
  // le mur enduit, une porte de bois ouverte (on en sort), deux piliers vermillon
  for (let y = Y - 92; y < Y; y++) for (let x = x0; x < x1; x++) {
    const u = (x - x0) / (x1 - x0);
    let c = pick(WALL, 0.75 - u * 0.4 + (noise2(x * 0.3, y * 0.3, 3) - 0.5) * 0.15, x, y);
    if (y > Y - 70 && x > X + 50 && x < X + 86) c = y < Y - 66 ? '#2a1a12' : pick(['#0d0907', '#160f0b', '#1f1610'], 0.4 - (x - X - 50) / 90 + (y - Y + 70) / 300, x, y);   // l'embrasure
    if ((y - Y) % 23 === 0 && y < Y - 72) c = WALL[0];
    pix.set(x, y, c);
  }
  for (const px of [x0, X + 44, x1 - 10]) for (let y = Y - 96; y < Y; y++) for (let i = 0; i < 10; i++) pix.set(px + i, y, VER[i < 2 ? 3 : i > 7 ? 0 : i > 5 ? 1 : 2]);
  // poutre et grand toit de tuiles (son débord est porté par les consoles des piliers)
  for (let y = Y - 104; y < Y - 92; y++) for (let x = x0 - 6; x < x1 + 6; x++) pix.set(x, y, y < Y - 100 ? VER[2] : VER[1]);
  for (let y = Y - 150; y < Y - 104; y++) {
    const t = (y - (Y - 150)) / 46, ext = Math.round(14 + t * t * 10);
    for (let x = x0 - ext; x < x1 + ext; x++) {
      const row = Math.floor((y - Y) / 4), col = Math.floor((x + (row % 2) * 3) / 6);
      let c = pick(TILEC, 0.55 - t * 0.35 + (ih(col, row, 4) - 0.5) * 0.2, x, y);
      if ((y - Y) % 4 === 0) c = TILEC[0];
      pix.set(x, y, c);
    }
  }
  for (let x = x0 - 24; x < x1 + 24; x++) { pix.set(x, Y - 104, TILEC[0]); pix.set(x, Y - 151, TILEC[1]); }
  // des fougères au pied du mur
  for (const [fx, s] of [[x0 + 6, 9], [x0 + 30, 7], [x1 - 6, 10]]) L.fern(pix, fx, Y, s, C.FERN, fx);
}

/** Bouleau de la lisière : tronc blanc tacheté de noir, houppier léger. */
function birch(pix, cx, base, h, seed) {
  const w = 5 + Math.floor(ih(seed, 1, 5) * 3);
  for (let y = base - h; y < base; y++) {
    const lean = Math.round(Math.sin((base - y) * 0.012 + seed) * 2);
    for (let i = 0; i < w; i++) {
      const u = i / (w - 1);
      let c = pick(C.BIRCH, 0.85 - u * 0.75, cx + i, y);
      if (ih(Math.floor(y / 3), i > w / 2 ? 1 : 0, seed) < 0.12) c = '#2a2a26';            // lenticelles
      if (y > base - 6 && ih(i, y, seed) < 0.5) c = C.MOSS[3];
      pix.set(cx - (w >> 1) + i + lean, y, c);
    }
  }
  const leaf = [C.LEAF[2], C.LEAF[3], C.LEAF[4], C.LEAF[5], C.LEAF[6], '#b4dc6a', '#d6ec86'];
  // un houppier léger : des touffes de part et d'autre, chacune au bout d'une fine branche
  const n = 6;
  for (let k = n - 1; k >= 0; k--) {
    const t = k / (n - 1), side = k % 2 ? 1 : -1;
    const by = base - h + 10 + Math.round(t * h * 0.5), reach = 6 + Math.round((1 - Math.abs(t - 0.35)) * 10) + Math.floor(ih(k, 2, seed) * 5);
    const ex = cx + side * reach, ey = by - 4 - Math.floor(ih(k, 3, seed) * 4);
    for (let q = 0; q <= reach; q++) pix.set(cx + side * q, by - Math.round((q / reach) * (by - ey)), '#5a5a50');
    L.bush(pix, ex, ey + 6, 9 + Math.floor(ih(k, 4, seed) * 6), 7 + Math.floor(ih(k, 5, seed) * 4), leaf, seed + 3 + k);
  }
  L.bush(pix, cx, base - h + 12, 11, 12, leaf, seed + 20);
  for (let x = cx - 12; x < cx + 14; x += 3) if (ih(x, 0, seed) < 0.5) L.grassTuft(pix, x, base - 2, 3 + Math.floor(ih(x, 1, seed) * 4), C.FERN, x);
}

/** Rocher moussu qui remplit exactement son bloc (son dessus est à la hauteur des pieds de KAGE). */
function boulder(pix, X, Y, W, Hh, seed, wet) {
  const moss = wet ? [C.MOSS[0], C.MOSS[1], C.MOSS[2], C.MOSS[2], C.MOSS[3], C.MOSS[4], C.MOSS[4]] : C.MOSS;
  const ramp = wet ? ['#1a2830', '#26393f', '#34505a', '#486b72', '#62878b', '#88a9a6'] : C.ROCK;
  const cx = X + W / 2, rw = W / 2 + 3, bot = Y + Hh + 4;
  for (let y = Y - 2; y < bot; y++) for (let x = X - 6; x < X + W + 6; x++) {
    const nx = (x - cx) / rw, ny = (y - (Y + Hh * 0.6)) / (Hh * 0.6 + 6);
    // un bloc aux coins arrondis : le dessus est plat, les flancs bombés
    const top = Y + Math.pow(Math.abs(nx), 6) * Math.min(10, Hh * 0.6) + (noise1(x * 0.3, seed) - 0.5) * 1.5;
    if (y < top || Math.abs(nx) > 1 - Math.max(0, (y - bot + 6) / 40)) continue;
    const w = worley(x, y, Math.max(6, W * 0.25), seed, 0.9);
    let v = 0.58 - nx * 0.32 - ((y - Y) / Hh) * 0.3 + (w.id - 0.5) * 0.25;
    const m = -(y - top) * 0.22 + fbm2(x * 0.17, y * 0.2, 2, seed + 3) * 1.1 - nx * 0.2;
    if (m > 0.35 || y - top < 2) pix.set(x, y, pick(moss, v + 0.32 + Math.max(0, m - 0.35) * 0.4, x, y));
    else if (w.d2 - w.d < 0.8) pix.set(x, y, ramp[0]);
    else pix.set(x, y, pick(ramp, v, x, y));
  }
  if (wet) for (let x = X - 4; x < X + W + 4; x += 2) if (ih(x, 1, seed) < 0.4) pix.set(x, Y + Hh + 2, '#a6eede', 140);   // la ligne d'eau
}

/** La racine géante (zone 2) : une énorme racine d'écorce qui sort du sol, une cache dans son flanc gauche. */
function giantRoot(pix, level, p) {
  const X = p.x * TILE, Y = p.y * TILE, W = p.w * TILE, Hh = p.h * TILE, base = Y + Hh;
  for (let y = Y - 4; y < base + 6; y++) for (let x = X - 54; x < X + W + 10; x++) {
    // la masse : le bloc, plus un empattement qui plonge vers le tronc creux à gauche
    const t = (y - Y) / Hh;
    const right = X + W + 2 + Math.round((noise1(y * 0.12, 5) - 0.5) * 6) - Math.round(Math.max(0, 0.25 - t) * 30);
    const left = X - Math.round(Math.max(0, t - 0.55) * 110) + Math.round((noise1(y * 0.1, 6) - 0.5) * 4);
    const topY = Y + Math.round((noise1(x * 0.08, 7) - 0.5) * 3) + (x < X ? Math.round((X - x) * 0.9 + 6) : 0);
    if (x < left || x > right || y < topY) continue;
    // la cache creusée dans le pied (tuiles vides du bloc) : laissée à live.js (lierre) ; ici, la pénombre
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const hole = tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h && level.rows[ty][tx] !== '#';
    const u = (x - left) / Math.max(1, right - left);
    const grain = fbm2(x * 0.03, y * 0.25, 2, 9);
    let v = 0.62 - u * 0.4 - t * 0.2 + (grain - 0.5) * 0.3;
    if (hole) { pix.set(x, y, pick(['#08050a', '#100b0a', '#1a120d'], 0.3 + (y - Y) / Hh * 0.6, x, y)); continue; }
    const m = fbm2(x * 0.08, y * 0.1, 3, 11) + (y - topY < 6 ? 0.35 : 0) - u * 0.15 - 0.1;
    if (Math.abs(grain - 0.5) < 0.02) pix.set(x, y, C.BARK[0]);
    else if (m > 0.62) pix.set(x, y, pick(C.MOSS, v + 0.25 + (y - topY < 3 ? 0.3 : 0), x, y));
    else pix.set(x, y, pick(C.BARK, v, x, y));
  }
  for (let x = X + 4; x < X + W - 2; x += 3) if (ih(x, 2, p.x) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 3, p.x) * 4), C.FERN, x);
}

function ruinArch(pix, X, Y, broken, seed) {
  const pil = (x0) => L.Sheet && ruinBlock(pix, x0, Y - 96, 14, 96, seed + x0);
  pil(X);
  if (!broken) pil(X + 50);
  else ruinBlock(pix, X + 50, Y - 34, 14, 34, seed + 9);
  // l'arc : des claveaux en demi-cercle (cassé : il s'arrête net, deux blocs à terre)
  const cx = X + 32, cy = Y - 96, R = 32;
  for (let a = Math.PI; a <= (broken ? Math.PI * 1.45 : Math.PI * 2); a += 0.004) {
    for (let r = R - 12; r < R; r++) {
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.85);
      const seg = Math.floor((a - Math.PI) / 0.32);
      let v = 0.5 + (ih(seg, 0, seed) - 0.5) * 0.25 - (r - (R - 12)) * 0.01 - Math.cos(a) * 0.12;
      const joint = Math.abs(((a - Math.PI) / 0.32) % 1) < 0.04;
      pix.set(x, y, joint ? C.RUIN[0] : fbm2(x * 0.1, y * 0.1, 2, seed) > 0.66 ? pick(C.MOSS, v + 0.1, x, y) : pick(C.RUIN, v, x, y));
    }
  }
  if (broken) for (const [bx, bw] of [[X + 70, 12], [X + 84, 9]]) ruinBlock(pix, bx, Y - 9, bw, 9, seed + bx);
  // lierre qui pend de l'arc
  for (let i = 0; i < 4; i++) L.strand(pix, X + 6 + i * 13, Y - 100 + (i % 2) * 8, 14 + Math.floor(ih(i, 1, seed) * 22), C.LEAF, seed + i, 0.8);
}

function ruinBlock(pix, x0, y0, w, h, seed) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const course = Math.floor((y - y0) / 12), j = (y - y0) % 12;
    let v = 0.5 - ((x - x0) / w) * 0.35 + (ih(course, 0, seed) - 0.5) * 0.2 + (noise2(x * 0.3, y * 0.3, seed) - 0.5) * 0.15;
    if (j === 0) v += 0.15;
    const m = fbm2(x * 0.12, y * 0.09, 3, seed + 2);
    pix.set(x, y, j === 11 ? C.RUIN[0] : m > 0.66 ? pick(C.MOSS, v + 0.1, x, y) : pick(C.RUIN, v, x, y));
  }
}

function ruinWallP(pix, x0, y0, w, h, seed) {
  // un pan de mur ruiné : son sommet est déchiqueté
  for (let x = x0; x < x0 + w; x++) {
    const top = y0 + Math.round(Math.abs(noise1(x * 0.07, seed) - 0.3) * 40);
    for (let y = top; y < y0 + h; y++) {
      const course = Math.floor((y - y0) / 14), off = Math.floor(ih(course, 1, seed) * 20), bi = Math.floor((x - x0 + off) / 24);
      const j = (y - y0) % 14, i = (x - x0 + off) % 24;
      let v = 0.36 + (ih(bi, course, seed) - 0.5) * 0.25 - ((x - x0) / w) * 0.2 + (y - top < 3 ? 0.18 : 0);
      const m = fbm2(x * 0.1, y * 0.1, 3, seed + 4) + (y - top < 5 ? 0.25 : 0);
      pix.set(x, y, j === 13 || i === 23 ? C.RUIN[0] : m > 0.68 ? pick(C.MOSS, v + 0.12, x, y) : pick(C.RUIN, v, x, y));
    }
  }
  for (let i = 0; i < 3; i++) L.strand(pix, x0 + 8 + i * 14, y0 + 20 + i * 6, 30 + i * 12, C.LEAF, seed + i, 0.6);
}

/** Un fût de colonne couché : un cylindre de pierre, la face coupée à droite. */
function ruinDrum(pix, X, Y, W) {
  for (let y = Y - 2; y < Y + TILE; y++) for (let x = X; x < X + W; x++) {
    const v0 = (y - Y + 2) / (TILE + 2), cyl = Math.sin(v0 * Math.PI);
    let v = 0.25 + cyl * 0.45 - v0 * 0.25 + (noise2(x * 0.4, y * 0.4, 3) - 0.5) * 0.12;
    if ((x - X) % 9 === 0) v -= 0.12;                                                 // cannelures
    pix.set(x, y, fbm2(x * 0.12, y * 0.2, 2, 7) > 0.68 ? pick(C.MOSS, v + 0.15, x, y) : pick(C.RUIN, v, x, y));
  }
  for (let y = Y - 1; y < Y + TILE; y++) for (let i = 0; i < 4; i++) {
    const d = Math.hypot(i / 4, (y - Y - 7) / 9);
    if (d < 1) pix.set(X + W - 2 + i, y, pick(C.RUIN, 0.65 - d * 0.3, X + i, y));
  }
}

/** Tronc de remontée (canopée) : un fût droit du sous-bois jusqu'au-dessus des branches, couronné de feuillage. */
function climbTrunk(pix, cx, base, top, seed) {
  L.bigTrunk(pix, cx, 20, base + 2, seed, C.BARK, C.MOSS, { top, roots: 1.1 });
  L.bush(pix, cx, top + 22, 40, 34, C.LEAF, seed + 4);
  L.bush(pix, cx - 22, top + 40, 22, 16, C.LEAF, seed + 5);
}

/** Une grosse branche horizontale (x0 → x1 au niveau Y du dessus), feuilles dessous et au bout. */
function limb(pix, x0, x1, Y, dir, seed, leafy) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1), len = b - a;
  for (let x = a; x <= b; x++) {
    const t = dir > 0 ? (x - a) / len : (b - x) / len;               // 0 côté tronc, 1 au bout
    const th = Math.max(4, Math.round(9 - t * 4));
    const y0 = Y + Math.round((noise1(x * 0.08, seed) - 0.5) * 2);
    for (let j = 0; j < th; j++) {
      const v = 0.75 - (j / th) * 0.65 + (noise2(x * 0.4, j, seed) - 0.5) * 0.15;
      pix.set(x, y0 + j, j === 0 ? (ih(x, 1, seed) < 0.6 ? C.MOSS[5] : C.MOSS[4]) : j === 1 && ih(x, 2, seed) < 0.5 ? C.MOSS[3] : pick(C.BARK, v, x, y0 + j));
    }
  }
  if (leafy) {
    L.bush(pix, dir > 0 ? b - 2 : a + 2, Y + 3, 12, 8, C.LEAF, seed + 3);
    for (let x = a + 4; x < b - 4; x += 5) if (ih(x, 3, seed) < 0.45) L.strand(pix, x, Y + 6, 4 + Math.floor(ih(x, 4, seed) * 9), C.LEAF, seed + x, 0.5);
  }
  for (let x = a + 2; x < b; x += 3) if (ih(x, 5, seed) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 6, seed) * 2), C.FERN, x);
}

/** L'arbre qui porte une branche : son tronc descend jusqu'au sol ; le houppier s'ouvre au-dessus. */
function branchTree(pix, cx, Y, bottom, topY, seed) {
  // un grand fût qui sort du cadre par le haut ; des masses de feuillage irrégulières le long du tronc
  const bark = L.hazeRamp(C.BARK, '#1d4a44', 0.12), moss = L.hazeRamp(C.MOSS, '#1d4a44', 0.12);
  const w = 16 + Math.floor(ih(seed, 1, 4) * 8);
  L.bigTrunk(pix, cx, w, bottom, seed, bark, moss, { top: topY, roots: 1.2 });
  const leaf = L.hazeRamp(C.LEAF, '#1d4a44', 0.15);
  for (let k = 0; k < 4; k++) {
    const side = (k + seed) % 2 ? 1 : -1, ly = Y - 30 - k * 52 - Math.floor(ih(k, 2, seed) * 20);
    if (ly < topY + 10) break;
    const lw = 18 + Math.floor(ih(k, 3, seed) * 14), lx = cx + side * (w / 2 + lw * 0.6);
    for (let q = 0; q < lw * 0.9; q++) pix.set(cx + side * (w / 2 + q), ly + 8 - Math.round(q * 0.45), C.BARK[1]);
    // une masse irrégulière : plusieurs lobes fondus ensemble, le dessous retombe en franges
    const lobes = [];
    for (let j = 0; j < 4; j++) lobes.push({ x: lx + (ih(k, j, seed + 5) - 0.5) * lw * 1.5, y: ly + (ih(k, j, seed + 6) - 0.5) * lw * 0.5, r: lw * (0.4 + ih(k, j, seed + 7) * 0.35) });
    const inside = (x, y) => {
      let best = -1;
      for (const o of lobes) best = Math.max(best, 1 - Math.hypot((x - o.x) / o.r, (y - o.y) / (o.r * 0.72)));
      return best * 3 + (noise2(x * 0.25, y * 0.25, seed + k) - 0.5) * 0.9 + (y > ly ? Math.sin(x * 0.7) * 0.4 : 0);
    };
    L.leafMass(pix, [lx - lw * 1.4, ly - lw, lx + lw * 1.4, ly + lw * 0.9], inside, (x, y) => 0.62 - (y - ly + lw * 0.6) / (lw * 1.6) - (x - lx) / (lw * 5), leaf, seed + k * 7);
  }
}

function nest(pix, cx, Y) {
  for (let y = Y - 9; y < Y + 1; y++) for (let x = cx - 14; x <= cx + 14; x++) {
    const nx = (x - cx) / 14, ny = (y - Y) / 9;
    if (nx * nx + ny * ny > 1 || y < Y - 9 + Math.abs(nx) * 2) continue;
    const straw = ih(x, y, 4) < 0.5 ? (ih(x + y, 1, 4) < 0.5 ? '#8a6a3c' : '#6b4f2b') : '#a8854c';
    pix.set(x, y, y < Y - 6 ? '#3a2a18' : straw);
  }
}

function leafMat(pix, X, Y, W, seed) {
  L.leafMass(pix, [X - 6, Y - 6, X + W + 6, Y + 6], (x, y) => 1 - Math.abs(y - Y) / 5 - Math.max(0, Math.max(X - x, x - X - W)) / 6,
    (x, y) => 0.7 - (y - Y + 5) / 14, C.LEAF, seed);
}

/** L'arbre creux géant (fin de la canopée) : on entre par le haut, le boyau descend sous terre. */
function hollowGiant(pix, level, p, layer) {
  const X = p.x * TILE, W = p.w * TILE, top = p.top * TILE, base = p.y * TILE;
  if (layer === 'behind') {
    // l'intérieur : du bois sombre, des fibres verticales, une lueur qui monte d'en bas
    const inTop = floorTop(level, p.x, p.top) + 6;
    for (let y = inTop; y < base + 2; y++) for (let x = X + 12; x < X + W - 12; x++) {
      const v = 0.18 + (noise2(x * 0.5, y * 0.05, 3) - 0.5) * 0.25 + Math.max(0, (y - base + 60) / 300);
      pix.set(x, y, pick(['#0b0706', '#130c08', '#1d120b', '#2a190f'], v, x, y));
    }
    return;
  }
  // les parois : deux murs d'écorce épais, le gauche plus bas (on entre par là), le droit monte en chicot
  const wall = (x0, w, yTop, side) => {
    for (let y = yTop; y < base + 4; y++) {
      const flare = y > base - 30 ? Math.round(Math.pow((y - base + 30) / 30, 2) * 14) : 0;
      for (let i = -(side < 0 ? flare : 0); i < w + (side > 0 ? flare : 0); i++) {
        const x = x0 + i, u = (i + 10) / (w + 20);
        let v = 0.15 + 0.7 * (side < 0 ? 1 - u : 0.5 - u * 0.3) + (noise2(i * 0.6, y * 0.2, x0) - 0.5) * 0.2;
        const pl = fbm2(i * 0.3, y * 0.03, 2, x0);
        const m = fbm2(i * 0.1, y * 0.03, 3, x0 + 3) + (side < 0 ? 0.2 : 0) - 0.05;
        // bord du haut déchiqueté
        if (y < yTop + 6 && ih(x, 0, 9) * 6 > y - yTop) continue;
        pix.set(x, y, m > 0.72 ? pick(C.MOSS, v + 0.2, x, y) : Math.abs(pl - 0.5) < 0.025 ? C.BARK[0] : pick(C.BARK, v, x, y));
      }
    }
  };
  const leftTop = (level.forest?.def?.hollows ? 0 : 0) + floorTop(level, p.x, p.top);
  wall(X - 10, 26, leftTop, -1);
  wall(X + W - 16, 26, top - 60, 1);
  L.bush(pix, X + W + 4, top - 52, 26, 20, C.LEAF, p.x + 3);
}
function floorTop(level, col, from) {
  for (let r = from; r < level.h; r++) if (level.rows[r][col] === '|') return r * TILE;
  return from * TILE;
}

function mushrooms(pix, X, Y, W, seed) {
  const caps = [['#1c2a5c', '#3c58b8', '#6fd6ee'], ['#2a1f5a', '#5a46b0', '#a67cf0']];
  for (let i = 0; i < W / 5; i++) {
    const x = X + 2 + Math.floor(ih(i, 1, seed) * (W - 4)), s = 2 + Math.floor(ih(i, 2, seed) * 3);
    L.mushroom(pix, x, Y, s, caps[i % 2], '#9fb8c8');
  }
}

/** L'éboulis au-dessus du couloir de la statue : de gros blocs taillés, devant KAGE. */
function rubble(pix, X, Y, w, h) {
  const top = Y - (h + 3) * TILE;
  const blocks = [];
  for (let k = 0; k < 14; k++) {
    const bw = 16 + Math.floor(ih(k, 1, 21) * 18), bh = 12 + Math.floor(ih(k, 2, 21) * 12);
    const bx = X - 6 + Math.floor(ih(k, 3, 21) * ((w + 1) * TILE - bw + 12));
    const by = top + Math.floor((k / 14) * ((h + 3) * TILE - bh)) + Math.floor(ih(k, 4, 21) * 8);
    blocks.push({ bx, by, bw, bh, k });
  }
  for (const b of blocks) for (let y = b.by; y < Math.min(Y, b.by + b.bh); y++) for (let x = b.bx; x < b.bx + b.bw; x++) {
    const i = x - b.bx, j = y - b.by;
    let v = 0.42 + (ih(b.k, 5, 21) - 0.5) * 0.25 - (i / b.bw) * 0.3 - (j / b.bh) * 0.15;
    if (j === 0 || i === 0) v += 0.18;
    const edge = i === b.bw - 1 || j === b.bh - 1;
    const m = fbm2(x * 0.12, y * 0.12, 2, 23) + (j < 3 ? 0.25 : 0);
    pix.set(x, y, edge ? C.RUIN[0] : m > 0.7 ? pick(C.MOSS, v + 0.15, x, y) : pick(C.RUIN, v, x, y));
  }
  for (let i = 0; i < 4; i++) L.strand(pix, X + 4 + i * 15, top + 6, 10 + Math.floor(ih(i, 7, 21) * 20), C.LEAF, 30 + i, 0.7);
}

/** Le fond d'un couloir creusé (sous la falaise de la statue) : terre sombre, étais de racines. */
function tunnelBack(pix, x0, y0, w) {
  for (let y = y0; y < y0 + 2 * TILE; y++) for (let x = x0; x < x0 + w; x++) {
    const v = 0.22 + (noise2(x * 0.2, y * 0.2, 5) - 0.5) * 0.25 - (y - y0) / 160;
    pix.set(x, y, pick(['#0a0706', '#120c09', '#1b130d', '#261a11'], v, x, y));
  }
}

/** Pilier de roche (zone 10) : une colonne de roc qui plonge dans le ravin, dessus moussu. */
function rockColumn(pix, X, Y, W, Hh, seed, ledge) {
  for (let y = Y - 2; y < Y + Hh; y++) {
    const t = (y - Y) / Hh;
    const l = X + Math.round((noise1(y * 0.06, seed) - 0.5) * 6 + t * 4), r = X + W + Math.round((noise1(y * 0.06, seed + 1) - 0.5) * 6 - t * 4);
    for (let x = l; x < r; x++) {
      const u = (x - l) / Math.max(1, r - l);
      if (y < Y + Math.pow(Math.abs(u * 2 - 1), 8) * 3) continue;
      // de grandes facettes verticales (roc fracturé), pas des pavés
      const w = worley(x * 1.6, y * 0.35, 12, seed, 1);
      let v = 0.6 - u * 0.5 - t * 0.4 + (w.id - 0.5) * 0.22 + (noise2(x * 0.3, y * 0.08, seed + 4) - 0.5) * 0.12;
      const m = -(y - Y) * 0.15 + fbm2(x * 0.15, y * 0.1, 2, seed + 2) * 1.2 - u * 0.3;
      if (m > 0.5 || y - Y < 2) pix.set(x, y, pick(C.MOSS, v + 0.3, x, y));
      else if (w.d2 - w.d < 0.7 && ih(Math.floor(y / 6), Math.floor(x / 5), seed) < 0.7) pix.set(x, y, C.ROCK[0]);
      else pix.set(x, y, pick(C.ROCK, v, x, y));
    }
  }
  for (let x = X + 2; x < X + W - 2; x += 3) if (ih(x, 1, seed) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 2, seed) * 4), C.FERN, x);
  if (ledge) for (let i = 0; i < 3; i++) L.strand(pix, X + W - 6 - i * 10, Y + 6, 20 + i * 14, C.LEAF, seed + i, 0.7);
}

/** Tronc couché (zone 11) : on glisse dessous ; il repose sur deux pierres. */
function fallenLog(pix, X, top, W, ground, seed) {
  const R = TILE;
  for (const sx of [X - 12, X + W + 2]) L.rock(pix, sx + 6, ground + 2, 9, ground - top - 2 * TILE + 8, seed + sx);
  for (let y = top - 2; y < top + 2 * R + 1; y++) for (let x = X - 10; x < X + W + 6; x++) {
    const v0 = (y - top + 2) / (2 * R + 3), cyl = Math.sin(v0 * Math.PI);
    let v = 0.15 + cyl * 0.55 - v0 * 0.3 + (noise2(x * 0.05, y * 0.5, seed) - 0.5) * 0.2;
    const pl = fbm2(x * 0.02, y * 0.3, 2, seed);
    const m = fbm2(x * 0.08, y * 0.1, 3, seed + 2) + (v0 < 0.25 ? 0.3 : 0) - 0.05;
    let c = m > 0.65 ? pick(C.MOSS, v + 0.2, x, y) : Math.abs(pl - 0.5) < 0.02 ? C.BARK[0] : pick(C.BARK, v, x, y);
    // la coupe, au bout droit : des cernes clairs
    const ex = X + W + 2 + Math.round(Math.sin(v0 * Math.PI) * 4);
    if (x > ex) {
      const d = Math.hypot((x - ex) / 4, (y - top - R) / R);
      if (d > 1) continue;
      c = d > 0.85 ? C.BARK[2] : Math.sin(d * 10) > 0.3 ? '#b08a58' : '#d2b07a';
    }
    pix.set(x, y, c);
  }
}

/** Le dernier grand arbre (zone 12). */
function lastTree(pix, cx, base) {
  L.bigTrunk(pix, cx, 40, base, 77, C.BARK, C.MOSS, { top: base - 300, roots: 1.0 });
  const leaf = ['#1a1420', '#2a1f2e', '#3a2a36', '#4f3a40', '#6b4d4a', '#8c6a56', '#b08a62'];
  L.bush(pix, cx, base - 250, 80, 54, leaf, 78);
  L.bush(pix, cx - 60, base - 214, 36, 26, leaf, 79);
  L.bush(pix, cx + 64, base - 220, 40, 28, leaf, 80);
}

/** La sortie : la forêt s'ouvre ; deux vieux fûts sombres encadrent le passage, des fougères à leurs pieds. */
function horizon(pix, X, Y, W) {
  const dark = ['#140b16', '#20131f', '#2e1b29', '#402634', '#57343f'];
  for (const [fx, w, seed] of [[0.02, 28, 3], [0.9, 36, 4]]) {
    const cx = X + Math.round(W * fx);
    L.bigTrunk(pix, cx, w, Y + 2, seed + 90, dark.concat(['#6e4549']), ['#1a1420', '#24182a', '#302036', '#3d2a40', '#4f3a4a', '#634a52', '#7a5a5a'], { top: Y - 200, roots: 1.1 });
    for (let k = 0; k < 4; k++) L.fern(pix, cx - 20 + k * 13, Y, 8 + (k % 3) * 3, ['#1a1420', '#2a1f2e', '#3a2a36', '#4f3a40', '#6b4d4a', '#8c6a56'], seed * 10 + k);
  }
}

/** Les deux arbres et la grande branche d'où pendent les lianes balancier (zone 10). */
function vineBough(pix, level, x0, x1, y, vb) {
  const bark = L.hazeRamp(C.BARK, '#123a40', 0.35), moss = L.hazeRamp(C.MOSS, '#123a40', 0.35), leaf = L.hazeRamp(C.LEAF, '#123a40', 0.3);
  const H = level.height;
  // des fûts qui montent du fond du ravin (derrière les piliers), tous les deux ou trois balanciers
  const posts = [x0 + 10, ...vb.filter((_, i) => i % 2 === 1).map((v) => v.x * TILE + 64), x1 - 10];
  for (const [i, px] of posts.entries()) L.bigTrunk(pix, px, 24 + (i % 2) * 8, H, 100 + i, bark, moss, { top: y - 90, roots: 0 });
  // la branche : épaisse, moussue dessus, des nœuds là où pendent les lianes
  for (let x = x0; x < x1; x++) {
    const yy = y - 6 + Math.round(Math.sin(x * 0.012) * 4 + (noise1(x * 0.05, 3) - 0.5) * 3);
    const th = 12 + Math.round(noise1(x * 0.02, 4) * 5);
    for (let j = 0; j < th; j++) {
      const v = 0.7 - (j / th) * 0.6 + (noise2(x * 0.3, j * 0.5, 5) - 0.5) * 0.15;
      pix.set(x, yy + j, j < 2 ? moss[5 - j] : pick(bark, v, x, yy + j));
    }
  }
  for (let x = x0; x < x1; x += 34) L.bush(pix, x + Math.floor(ih(x, 1, 9) * 20), y - 14, 22, 16, leaf, x);
}

/** L'intérieur d'un arbre creux (le passage à pied, au pied du tronc). */
function hollowInside(pix, X, Y, W, open) {
  for (let y = Y - open - 6; y < Y; y++) for (let x = X; x < X + W; x++) {
    const v = 0.3 + (y - (Y - open)) / open * 0.25 - Math.abs((x - X) / W - 0.4) * 0.3 + (noise2(x * 0.4, y * 0.1, 4) - 0.5) * 0.15;
    pix.set(x, y, pick(['#0a0605', '#140c08', '#1f130c', '#2c1b10'], v, x, y));
  }
}

/** Le pied d'un arbre creux : l'arche de l'ouverture (écorce) et les racines qui s'évasent. */
function hollowFoot(pix, X, Y, W, open, seed) {
  // l'arche : l'écorce descend dans les coins de l'ouverture (sans boucher le passage de KAGE)
  for (let x = X; x < X + W; x++) {
    const u = (x - X) / W, drop = Math.round(Math.pow(Math.abs(u * 2 - 1), 3) * 9);
    for (let j = 0; j < drop; j++) pix.set(x, Y - open + j, pick(C.BARK, 0.6 - u * 0.5, x, j));
    pix.set(x, Y - open + drop, C.BARK[0]);
  }
  // racines : des doigts d'écorce qui plongent dans la mousse, de part et d'autre
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x0 = side < 0 ? X + 2 : X + W - 2, len = 10 + k * 6 + Math.floor(ih(k, side, seed) * 6);
      for (let s = 0; s < len; s++) {
        const x = x0 + side * s, yy = Y - open * 0.45 + (s / len) * open * 0.5 + k * 3;
        const th = Math.max(1, Math.round((1 - s / len) * 5));
        for (let j = 0; j < th; j++) pix.set(x, Math.round(yy) + j, j === 0 ? C.BARK[4] : C.BARK[1 + (j % 2)]);
      }
    }
  }
}
