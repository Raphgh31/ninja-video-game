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
    // les travées du pont sont dessinées par live.js (elles tombent) : jamais par le terrain
    for (const sp of F.spans ?? []) mask(sp.x0, sp.w, sp.row, sp.row);

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
          // le boyau continue sous terre : l'intérieur sombre descend jusqu'au fond du puits (on ne voit jamais le décor à travers)
          let bot = p.y; while (bot < level.h - 1 && level.rows[bot][p.x + 2] !== '#') bot++;
          p.shaftBottom = bot;
          add('behind', X - 30, (p.top - 8) * TILE, p.w * TILE + 60, (bot - p.top + 9) * TILE, (pix) => hollowGiant(pix, level, p, 'behind'));
          add('over', X - 30, (p.top - 8) * TILE, p.w * TILE + 60, (p.y - p.top + 9) * TILE, (pix) => hollowGiant(pix, level, p, 'over'));
          break;
        }
        case 'ravine': {
          const W = p.w * TILE, Hh = level.height - Y;
          add('behind', X - 12, Y - 8, W + 24, Hh + 8, (pix) => ravine(pix, X, Y, W, Hh, p.x));
          break;
        }
        case 'cave_reeds': add('over', X - 8, Y - 34, p.w * TILE + 16, 36, (pix) => caveReeds(pix, X, Y, p.w * TILE, p.x)); break;
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
        case 'bridge_tree': {
          // un grand tronc de la canopée, qui porte un bout du pont suspendu
          const deckY = (level.forest?.def?.bridges ?? []).find((br) => Math.abs(br.x0 - X) < 48 || Math.abs(br.x1 - X) < 48)?.y ?? Y - 200;
          add('behind', X - 52, 0, 120, Y + 6, (pix) => branchTree(pix, X + 8, deckY, Y + 4, 0, p.x * 3 + 1, 24));
          break;
        }
        case 'canopy_trunk': {
          // un arbre de la canopée, posé à la main (foret.js) : ses branches voisines en sortent
          const top = Math.min(...level.props.filter((q) => q.type === 'branch' && Math.abs(q.x - p.x) <= 5).map((q) => q.y), p.y - 12) * TILE;
          add('behind', X - 52, 0, 120, Y + 6, (pix) => branchTree(pix, X + 8, top, Y + 4, 0, p.seed ?? p.x * 3, p.w ?? 20));
          break;
        }
        case 'pearl_tree': {
          const sz = PEARL_SIZE[p.s ?? 1];
          add('behind', X + 8 - sz.w, Y - sz.h - 8, sz.w * 2, sz.h + 14, (pix) => pearlTree(pix, p));
          break;
        }
        case 'oak_root': {
          mask(p.x, p.w, p.y - p.h + 1, p.y);
          add('over', X - 80, (p.y - p.h - 4) * TILE, p.w * TILE + 160, (p.h + 7) * TILE, (pix) => oakRoot(pix, p));
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
    // les galeries de terre de la zone 5 : leur fond (strates, racines, pierres, lueurs)
    if (F.galleries) {
      const G = F.galleries;
      add('behind', G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0, (pix) => galleriesBack(pix, level, G));
      // des rideaux de racines qui pendent des plafonds, aux entrées des salles (devant le terrain, derrière KAGE)
      for (const [cx, row, k] of G.curtains ?? []) add('over', cx * TILE - 14, row * TILE - 4, 44, 64, (pix) => rootCurtain(pix, cx * TILE, row * TILE, k, cx));
    }
    // grands troncs (zones 2 et 5) : le pied est un décor (KAGE passe devant), peint par world.js ;
    // seules deux petites racines s'enfoncent dans la mousse, au ras du sol
    for (const hw of F.hollows ?? []) {
      const X = hw.x0 * TILE, Y = hw.ground * TILE;
      add('behind', X - 14, Y - 12, hw.w * TILE + 28, 16, (pix) => trunkFoot(pix, X, Y, hw.w * TILE, hw.x0));
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
    const trees = lv.props.filter((p) => p.type === 'canopy_trunk');
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
        // dans le boyau de l'arbre creux géant : un simple nœud du bois, pas d'arbre
        const hg = lv.props.find((p) => p.type === 'hollow_giant' && tx >= p.x && tx < p.x + p.w && ty > p.top);
        if (hg) { add('over', X - 4, Y - 4, W + 8, 14, (pix) => limb(pix, X - 2, X + W + 2, Y, tx === hg.x + 1 ? -1 : 1, tx * 7 + ty, false)); continue; }
        const climb = climbs.find((c) => Math.abs(c.x - tx) <= 3 && ty >= c.top - 1 && ty < c.y);
        const d = decl.find((p) => p.x === tx && p.y === ty);
        // un arbre posé à côté (canopée) : la branche sort de son fût, pas d'arbre en plus
        const dist = (a) => (a.x < tx ? tx - a.x : a.x > tx + w - 1 ? a.x - (tx + w - 1) : 0);
        const host = !climb && trees.filter((a) => ty < a.y && dist(a) <= 6).sort((a, b) => dist(a) - dist(b))[0];
        if (host) {
          const tcx = host.x * TILE + 8, half = (host.w ?? 20) / 2 - 3;
          // un bras de chaque côté du fût que la branche dépasse
          if (X - 4 < tcx - half) add('over', X - 16, Y - 12, tcx - X + 24, 28, (pix) => limb(pix, X - 4, tcx - half, Y, -1, tx * 7 + ty, true));
          if (X + W + 4 > tcx + half) add('over', tcx - 8, Y - 12, X + W - tcx + 24, 28, (pix) => limb(pix, tcx + half, X + W + 4, Y, 1, tx * 7 + ty + 1, true));
          if (d?.nest) add('over', X + W / 2 - 18, Y - 14, 36, 18, (pix) => nest(pix, X + W / 2, Y));
          continue;
        }
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
        const end = d?.from === 'center' ? 0 : d?.from === 'right' ? 1 : d?.from === 'left' ? -1 : ih(tx, ty, 5) < 0.5 ? -1 : 1;
        const tcx = end === 0 ? X + W / 2 : (end > 0 ? tx + w : tx) * TILE + (end > 0 ? 6 : -6);
        const bottom = Math.min(lv.height, g * TILE + 4), topY = Math.max(0, Y - 260);
        add('behind', tcx - 44, topY, 88, bottom - topY, (pix) => branchTree(pix, tcx, Y, bottom, topY, tx * 3 + ty));
        if (end === 0) {
          // le tronc au milieu : deux branches de part et d'autre
          add('over', X - 12, Y - 12, W + 24, 28, (pix) => { limb(pix, X - 4, tcx, Y, -1, tx * 7 + ty, true); limb(pix, tcx, X + W + 4, Y, 1, tx * 7 + ty + 1, true); });
        } else add('over', X - 12, Y - 12, W + 24, 28, (pix) => limb(pix, end > 0 ? X - 4 : tcx, end > 0 ? tcx : X + W + 4, Y, -end, tx * 7 + ty, true));
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
    // (sans empattement : la racine s'arrête au bord de son bloc, rien ne déborde dans le puits)
    const left = X + Math.round((noise1(y * 0.1, 6) - 0.5) * 3);
    const topY = Y + Math.round((noise1(x * 0.08, 7) - 0.5) * 3);
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
function branchTree(pix, cx, Y, bottom, topY, seed, wide = 0) {
  // un grand fût qui sort du cadre par le haut ; des masses de feuillage irrégulières le long du tronc
  const bark = L.hazeRamp(C.BARK, '#1d4a44', 0.12), moss = L.hazeRamp(C.MOSS, '#1d4a44', 0.12);
  const w = wide || 16 + Math.floor(ih(seed, 1, 4) * 8);
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
    const inTop = floorTop(level, p.x, p.top) + 6, end = (p.shaftBottom ?? p.y) * TILE, FADE = 120;
    for (let y = inTop - 8; y < end; y++) for (let x = X + 12; x < X + W - 12; x++) {
      // en haut, le bois du creux reçoit encore la lumière ; il fonce ligne après ligne vers le noir du
      // boyau : un fondu continu, opaque (on ne voit jamais le décor à travers), sans trame ni grain
      const t = Math.min(1, (y - (inTop - 8)) / FADE), e = t * t * (3 - 2 * t);
      const below = y > base;                                         // sous terre : le bois laisse place à la terre et aux racines
      if (below && Math.abs(fbm2(x * 0.08, y * 0.02, 2, 9) - 0.5) < 0.03) { pix.set(x, y, '#2a1c12'); continue; }   // racines
      const fibre = noise1(x * 0.3, 3) > 0.62 ? 0.1 : noise1(x * 0.3, 3) < 0.3 ? -0.06 : 0;   // de longues veines verticales
      const lit = L.mixHex('#4a2e1a', '#0b0706', Math.round(Math.min(1, e + (fibre < 0 ? 0.08 : 0)) * 48) / 48);
      const col = below ? '#0a1013' : fibre > 0 ? L.mixHex(lit, '#5c3a22', 0.18 * (1 - e)) : lit;
      pix.set(x, y, col);
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

/**
 * La gorge sous l'allée des piliers (zone 4) : la paroi d'en face, dans la brume du sous-bois ;
 * son bord moussu d'où pendent racines et lianes, des corniches à fougères, de vieilles colonnes
 * qui montent des profondeurs, deux nappes de brume ; tout fonce vers le fond.
 */
function ravine(pix, X, Y, W, Hh, seed) {
  const DARK = '#0a282a';
  // peu de tramage : les teintes changent par aplats (une rampe resserrée), la profondeur fond en douceur
  const ROCK = L.hazeRamp(C.ROCK, '#2f8d95', 0.36), RUIN = L.hazeRamp(C.RUIN, '#2f8d95', 0.26);
  const MOSSH = L.hazeRamp(C.MOSS, '#1f6f7a', 0.32), LEAFH = L.hazeRamp(C.LEAF, '#1f6f7a', 0.25), FERNH = L.hazeRamp(C.FERN, '#1f6f7a', 0.22);
  const ROOTH = L.hazeRamp(C.BARK, '#1f6f7a', 0.45), RIM = L.hazeRamp(C.MOSS, '#1f6f7a', 0.45);
  const x0 = X - 12, x1 = X + W + 12, bottom = Y + Hh;
  const rim = (x) => Y + 3 + Math.round((noise1(x * 0.045, seed) - 0.5) * 8);
  const shade = (col, t) => L.mixHex(col, DARK, Math.round(Math.min(0.85, t * 0.95) * 20) / 20);   // l'ombre du fond, par paliers fins
  const flat = (ramp, v) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)))];
  // 1. la paroi : grandes dalles verticales, fissures sombres, arêtes claires, coulures, strates
  for (let x = x0; x < x1; x++) {
    const r = rim(x);
    for (let y = r; y < bottom; y++) {
      const d = y - r, t = Math.min(1, d / 240);
      const w = worley(x * 1.6, y * 0.55, 22, seed, 0.9);
      const strata = Math.sin((y + noise1(x * 0.02, seed + 1) * 26) * 0.09);
      let v = 0.48 + (w.id - 0.5) * 0.3 + strata * 0.05 + (noise1(x * 0.06 + y * 0.01, seed + 5) - 0.5) * 0.1;
      const edge = w.d2 - w.d;
      if (edge < 0.5) v = 0.06;                                                    // la fissure, franche
      else if (edge < 0.9) v -= 0.16;                                              // son ombre
      else if (edge < 1.6 && (w.id * 7) % 1 < 0.6) v += 0.18;                      // l'arête éclairée de la dalle
      if (noise1(x * 0.3, seed + 9) > 0.8 && edge > 0.9) v -= 0.1;                 // coulures
      // la mousse : des plaques qui suivent le haut des dalles et coulent en rideaux
      const moss = fbm2(x * 0.03, y * 0.045, 2, seed + 2) + (d < 18 ? 0.12 : 0) - t * 0.35 + (edge > 1.6 && edge < 2.6 ? 0.08 : 0);
      const col = moss > 0.72 ? flat(MOSSH, Math.min(0.58, 0.25 + (moss - 0.72) * 1.6) + (edge < 0.9 ? -0.18 : 0)) : flat(ROCK, v);
      pix.set(x, y, shade(col, t));
    }
    // le bord : un liseré de mousse épais, des herbes qui dépassent
    for (let k = 0; k < 4; k++) pix.set(x, r + k, RIM[[3, 2, 1, 1][k]]);
    if (ih(x, 1, seed) < 0.4) L.grassTuft(pix, x, r, 2 + Math.floor(ih(x, 2, seed) * 6), RIM, x);
  }
  // 2. des touffes de feuillage accrochées à la paroi (rideaux de mousse, petits buissons)
  for (let i = 0; i < W / 40; i++) {
    const cx = x0 + Math.floor(ih(i, 11, seed) * (x1 - x0)), cy = Y + 16 + Math.floor(ih(i, 12, seed) * 120);
    const t = Math.min(1, (cy - Y) / 240), rw = 6 + Math.floor(ih(i, 13, seed) * 10);
    L.bush(pix, cx, cy, rw, 4 + Math.floor(rw / 3), L.hazeRamp(LEAFH, DARK, t * 0.7), seed + i * 7);
    for (let q = 0; q < 3; q++) if (ih(i, 20 + q, seed) < 0.6) L.vine(pix, cx - rw + Math.floor(ih(i, 30 + q, seed) * rw * 2), cy, 8 + Math.floor(ih(i, 40 + q, seed) * 22), L.hazeRamp(LEAFH, DARK, t * 0.7), seed + i + q);
  }
  // 3. des corniches, avec fougères et buissons
  for (let i = 0; i < W / 45; i++) {
    const cx = x0 + 20 + Math.floor(ih(i, 1, seed) * (x1 - x0 - 40)), ly = Y + 30 + Math.floor(ih(i, 2, seed) * 160);
    const lw = 14 + Math.floor(ih(i, 3, seed) * 26), t = Math.min(1, (ly - Y) / 240);
    for (let x = -lw; x <= lw; x++) {
      const th = Math.round(6 * (1 - (x / lw) ** 2)) + 1;
      for (let k = 0; k < th; k++) pix.set(cx + x, ly + k, shade(k === 0 ? MOSSH[5] : k === 1 ? MOSSH[3] : flat(ROCK, 0.62 - k * 0.12), t));
      pix.set(cx + x, ly + th, shade(ROCK[0], t));                                  // l'ombre sous la corniche
    }
    L.fern(pix, cx - Math.floor(lw / 3), ly, 7 + Math.floor(ih(i, 4, seed) * 7), L.hazeRamp(FERNH, DARK, t * 0.6), seed + i);
    L.bush(pix, cx + Math.floor(lw / 3), ly + 1, 6 + Math.floor(ih(i, 6, seed) * 6), 5, L.hazeRamp(LEAFH, DARK, t * 0.6), seed + i * 3);
    if (ih(i, 8, seed) < 0.5) L.vine(pix, cx + Math.floor((ih(i, 9, seed) - 0.5) * lw), ly + 4, 12 + Math.floor(ih(i, 10, seed) * 30), L.hazeRamp(LEAFH, DARK, t * 0.6), seed + i);
  }
  // 4. de vieilles colonnes, plus loin que celles du pont : elles montent des profondeurs, cassées en haut
  for (let i = 0; i < W / 150; i++) {
    const cx = X + 60 + i * 150 + Math.floor((ih(i, 7, seed) - 0.5) * 60), cw = 10 + Math.floor(ih(i, 8, seed) * 8);
    const top = Y + 18 + Math.floor(ih(i, 9, seed) * 60);
    for (let x = 0; x < cw; x++) {
      const u = x / (cw - 1), broken = top + Math.round(Math.abs(Math.sin(x * 1.7 + i)) * 5 + (u > 0.6 ? 4 : 0));
      for (let y = broken; y < bottom; y++) {
        const t = Math.min(1, (y - Y) / 240);
        let v = u < 0.25 ? 0.78 : u < 0.6 ? 0.55 : u < 0.9 ? 0.35 : 0.08;
        if ((y - top) % 20 === 0) v -= 0.25;                                       // les tambours
        const mossy = fbm2((cx + x) * 0.12, y * 0.04, 2, seed + i) > 0.68;
        pix.set(cx + x, y, shade(mossy ? flat(MOSSH, v * 0.8 + 0.1) : flat(RUIN, v), t));
      }
      pix.set(cx + x, broken - 1, MOSSH[4]);
    }
    L.fern(pix, cx + Math.floor(cw / 2), top + 2, 6 + Math.floor(ih(i, 10, seed) * 5), FERNH, seed + i * 5);
  }
  // 5. racines et lianes qui pendent du bord
  for (let x = x0 + 4; x < x1 - 4; x += 5) {
    const k = ih(x, 3, seed);
    if (k < 0.4) L.vine(pix, x, rim(x) + 3, 14 + Math.floor(ih(x, 4, seed) * 80), LEAFH, x);
    else if (k < 0.6) {
      let rx = x, len = 10 + Math.floor(ih(x, 5, seed) * 44);
      for (let q = 0; q < len; q++) {
        if (q % 6 === 5) rx += ih(x, q, seed) < 0.5 ? -1 : 1;
        pix.set(rx, rim(x) + 3 + q, ROOTH[q < len * 0.6 ? 2 : 1]);
        if (q < len * 0.35) pix.set(rx + 1, rim(x) + 3 + q, ROOTH[0]);
      }
    }
  }
  // 6. deux nappes de brume : un voile léger et continu (en transparence), pas de trame
  for (const [dm, dens] of [[90, 0.32], [175, 0.42]]) {
    for (let y = Y + dm - 18; y < Y + dm + 18; y++) for (let x = x0; x < x1; x++) {
      const a = dens * (1 - Math.abs(y - Y - dm) / 18) * (0.55 + noise1(x * 0.015 + dm, seed + 4) * 0.6);
      if (a > 0.02) pix.set(x, y, '#6cbcbc', Math.round(a * 255));
    }
  }
}

/**
 * Le fond des galeries de terre (zone 5) : la paroi du fond, en retrait et plus sombre que les murs ;
 * des strates de sédiments ondulées, des lits de cailloux, de grosses racines qui la traversent,
 * des radicelles qui pendent du plafond (certaines luisent), et la lumière des champignons, de
 * l'arbre à perles et de la lanterne déjà posée sur la terre. Pas de trame : aplats et fondus fins.
 * Le fossé fond au noir.
 */
function galleriesBack(pix, level, G) {
  const rows = level.rows, T = TILE;
  const air = (tx, ty) => { const c = rows[ty]?.[tx]; return c != null && !'#=|%'.includes(c); };
  const BACK = ['#100a06', '#19100a', '#23170e', '#2e1e12', '#3a2717', '#47301c', '#553a22'];
  const OCHRE = ['#1c130a', '#2a1d0f', '#392815', '#4a341b'];
  const flat = (v) => BACK[Math.max(0, Math.min(BACK.length - 1, Math.floor(v * BACK.length)))];
  // les sources de lumière peintes sur le fond (elles ne bougent pas) : [x, y, rayon, couleur, force]
  const lights = [];
  for (const q of level.props) {
    const X = q.x * T, Y = q.y * T;
    if (X < G.x0 - 40 || X > G.x1 + 40 || Y < G.y0 - 40 || Y > G.y1 + 40) continue;
    if (q.type === 'mushrooms') lights.push([X + q.w * 8, Y - 8, 46, (q.x % 3) === 1 ? '#3a2a62' : '#173f44', 0.75]);
    if (q.type === 'pearl_tree') lights.push([X + 8, Y - 40, 70, '#1d3f4a', 0.8], [X + 8, Y - 50, 40, '#33305c', 0.45]);
  }
  for (let ty = 0; ty < level.h; ty++) for (let tx = Math.floor(G.x0 / T); tx < G.x1 / T; tx++) if (rows[ty]?.[tx] === 'P') lights.push([tx * T + 8, ty * T + 2, 64, '#5a3a1c', 0.7]);
  // le fond de chaque case vide
  const tx0 = Math.floor(G.x0 / T), tx1 = Math.ceil(G.x1 / T), ty0 = Math.floor(G.y0 / T), ty1 = Math.ceil(G.y1 / T);
  for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
    if (!air(tx, ty)) continue;
    // la hauteur libre au-dessus et au-dessous : près du plafond, l'ombre ; au ras du sol, un peu de clarté
    let up = 0; while (up < 8 && air(tx, ty - 1 - up)) up++;
    let dn = 0; while (dn < 30 && air(tx, ty + 1 + dn)) dn++;
    const pitDepth = dn > 3 ? 0 : 0;
    for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
      const x = tx * T + px, y = ty * T + py;
      const fromCeil = up * T + py, toFloor = (dn + 1) * T - py;
      let v = 0.5 + Math.sin(y * 0.21 + noise1(x * 0.018, 81) * 7) * 0.08 + (noise1(x * 0.05 + y * 0.013, 82) - 0.5) * 0.1;
      // la paroi est en retrait : son pourtour, sous le bord des murs, est dans l'ombre
      const dl = air(tx - 1, ty) ? 99 : px, dr = air(tx + 1, ty) ? 99 : T - 1 - px, dd = air(tx, ty + 1) ? 99 : T - 1 - py;
      const rim = Math.min(dl, dr, dd);
      if (rim < 6) v -= (6 - rim) / 6 * 0.22;
      // des lits de cailloux dans les strates
      const bed = Math.sin(y * 0.21 + noise1(x * 0.018, 81) * 7);
      if (bed > 0.82) {
        const w = worley(x, y, 4, 83, 0.9);
        if (w.d < 2.4 && w.id < 0.45) v = w.d < 1.2 ? 0.66 : 0.5;
      }
      if (fromCeil < 14) v -= (14 - fromCeil) / 14 * 0.28;           // l'ombre sous le plafond
      if (toFloor < 10) v += (10 - toFloor) / 10 * 0.06;              // un peu de clarté au ras du sol
      // une strate sur trois est d'argile ocre
      const band = Math.floor((y + noise1(x * 0.018, 81) * 33) / 11);
      let col = ih(band, 0, 94) < 0.3 ? OCHRE[Math.max(0, Math.min(3, Math.floor(v * 4)))] : flat(v);
      // le rai de jour : une bande oblique, douce, qui s'évase en tombant
      if (G.beam) {
        const B = G.beam, k = (y - B.y) / (B.floor - B.y);
        if (k > 0 && k < 1.05) {
          const cx = B.x + (y - B.y) * 0.32, half = 3 + k * 9, dx = Math.abs(x - cx);
          if (dx < half) col = L.mixHex(col, '#c9b98a', Math.round((1 - dx / half) * (0.32 - k * 0.14) * 16) / 16);
        }
      }
      // la lumière des champignons, de l'arbre et de la lanterne, par paliers fins
      for (const [lx, ly, r, lc, k] of lights) {
        const d = Math.hypot(x - lx, (y - ly) * 1.15) / r;
        if (d < 1) col = L.mixHex(col, lc, Math.round((1 - d) * (1 - d) * k * 12) / 12);
      }
      // le fossé : il fond au noir en descendant
      if (ty > 42 && dn >= 0 && !air(tx, 42) && air(tx, ty)) {
        const below = (y - 43 * T) / 150;
        col = L.mixHex(col, '#020304', Math.round(Math.min(1, below + 0.25) * 16) / 16);
      }
      if (rows[ty][tx] === 'v') col = '#020304';
      pix.set(x, y, col);
    }
    // des radicelles qui pendent du plafond (certaines finissent par une perle qui luit)
    if (up === 0) for (let k = 0; k < 4; k++) {
      if (ih(tx, k, 84) > 0.45) continue;
      const rx = tx * T + 2 + Math.floor(ih(tx, k, 85) * 12), len = 4 + Math.floor(ih(tx, k, 86) * 18);
      for (let q = 0; q < len; q++) pix.set(rx + Math.round(Math.sin(q * 0.35 + k) * 0.7), ty * T + q, q < len * 0.5 ? '#3a2416' : '#2a1a10');
      if (ih(tx, k, 87) < 0.35) pix.set(rx, ty * T + len, ih(tx, k, 88) < 0.5 ? '#6fd6ee' : '#a67cf0');
    }
    // de loin en loin, une spore qui luit sur la paroi
    for (let k = 0; k < 2; k++) if (ih(tx, ty * 3 + k, 89) < 0.12) pix.set(tx * T + Math.floor(ih(tx, ty + k, 90) * 16), ty * T + Math.floor(ih(tx, ty - k, 91) * 16), k ? '#a67cf0' : '#6fd6ee');
  }
  // de grosses racines qui traversent le fond des salles (en diagonale, elles sortent d'un mur et rentrent dans l'autre)
  const ROOT = ['#1a0f08', '#2b1a0e', '#3f2715', '#56361c'];
  for (let i = 0; i < 7; i++) {
    let x = G.x0 + 40 + ih(i, 1, 92) * (G.x1 - G.x0 - 80), y = G.y0 + 40 + ih(i, 2, 92) * 230;
    const ang = (ih(i, 3, 92) - 0.5) * 1.6 + Math.PI / 2 * (ih(i, 4, 92) < 0.5 ? 0.3 : -0.3), len = 50 + ih(i, 5, 92) * 70;
    let thick = 3 + Math.floor(ih(i, 6, 92) * 3);
    for (let q = 0; q < len; q++) {
      x += Math.cos(ang + Math.sin(q * 0.06 + i) * 0.4); y += Math.sin(ang + Math.sin(q * 0.06 + i) * 0.4) * 0.6;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (!air(tx, ty)) continue;
      const th = Math.max(1, Math.round(thick * (1 - q / len * 0.6)));
      for (let k = 0; k < th; k++) pix.set(Math.round(x), Math.round(y) + k, k === 0 ? ROOT[3] : k === th - 1 ? ROOT[0] : ROOT[2 - (k > th / 2 ? 1 : 0)]);
      if (q % 9 === 4 && ih(i, q, 93) < 0.6) for (let r = 1; r < 5; r++) pix.set(Math.round(x) + r, Math.round(y) + th + r, ROOT[1]);   // une radicelle
    }
  }
}

/** Un rideau de racines fines qui pend d'un plafond de galerie ; quelques bouts luisent. */
function rootCurtain(pix, X, Y, k, seed) {
  const R = ['#24150c', '#331f12', '#4a2e1a', '#5e3c22'];
  for (let i = 0; i < 9; i++) {
    const x0 = X - 8 + Math.floor(ih(i, 1, seed) * 30), len = Math.round((10 + ih(i, 2, seed) * 34) * k);
    let x = x0;
    for (let q = 0; q < len; q++) {
      if (q % 5 === 4) x += ih(i, q, seed) < 0.5 ? -1 : 1;
      pix.set(x, Y + q, R[q < 3 ? 3 : q < len * 0.5 ? 2 : 1]);
      if (q < len * 0.3 && i % 3 === 0) pix.set(x + 1, Y + q, R[0]);
      if (q % 7 === 3 && ih(i, q, seed + 1) < 0.4) pix.set(x + (q % 2 ? 1 : -1), Y + q + 1, R[1]);   // radicelle
    }
    if (ih(i, 3, seed) < 0.35) pix.set(x, Y + len, ih(i, 4, seed) < 0.5 ? '#6fd6ee' : '#a67cf0');
  }
}

/** Roseaux de l'oasis souterraine : tiges bleu-vert, feuilles qui retombent, quelques pointes qui luisent. */
function caveReeds(pix, X, Y, W, seed) {
  const STEM = ['#0b2a2a', '#10403c', '#17594c', '#20705a', '#2e8b6a'];
  for (let x = X - 4; x < X + W + 4; x += 2) {
    if (ih(x, 1, seed) < 0.3) continue;
    const h = 10 + Math.floor(ih(x, 2, seed) * 20), lean = (ih(x, 3, seed) - 0.5) * 0.35;
    const c = STEM[1 + Math.floor(ih(x, 4, seed) * 4)];
    for (let k = 0; k < h; k++) pix.set(x + Math.round(lean * k), Y - k, k === 0 ? STEM[0] : c);
    const tx = x + Math.round(lean * h);
    if (ih(x, 5, seed) < 0.45) {
      // une massette qui luit doucement
      for (let k = 0; k < 4; k++) pix.set(tx, Y - h - k, k === 0 || k === 3 ? '#2e8b6a' : (ih(x, 6, seed) < 0.5 ? '#6fd6ee' : '#a67cf0'));
      pix.set(tx, Y - h - 5, '#c4fbff');
    } else {
      // une feuille qui retombe
      const d = ih(x, 7, seed) < 0.5 ? -1 : 1;
      for (let k = 0; k < 7; k++) pix.set(tx + d * k, Y - h + Math.round(k * k * 0.12), STEM[3]);
    }
  }
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

/** Deux racines basses de part et d'autre du pied d'un grand tronc. */
function trunkFoot(pix, X, Y, W, seed) {
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? X : X + W - 1, len = 9 + Math.floor(ih(seed, side, 3) * 4);
    for (let s = 0; s < len; s++) {
      const th = Math.max(1, Math.round((1 - s / len) * 6));
      for (let j = 0; j < th; j++) pix.set(x0 + side * s, Y - th + j + 1, j === 0 ? (side < 0 ? C.BARK[4] : C.BARK[2]) : C.BARK[1 + (j % 2)]);
    }
  }
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

// ===========================================================================
// la caverne aux perles (zone 8)
// ===========================================================================
const TRUNK = ['#0e0a10', '#1a121c', '#281c28', '#382834', '#4a3842', '#5e4a50'];
const CAVE_LEAF = ['#06171a', '#0a2428', '#103438', '#174a4a', '#22625c', '#2f7a6c', '#46947e'];
const PEARL_SIZE = { 1: { w: 26, h: 44 }, 2: { w: 40, h: 72 }, 3: { w: 118, h: 196 } };

/**
 * Les branches d'un arbre à perles (déterministes) : des arcs qui partent du tronc,
 * montent puis retombent en pleureur. Partagées avec live.js (les perles y brillent).
 */
export function pearlTreeShape(p) {
  const s = p.s ?? 1, sz = PEARL_SIZE[s], cx = p.x * TILE + 8, gy = p.y * TILE;
  const trunkH = Math.round(sz.h * 0.5), lean = (ih(p.x, 1, 41) - 0.5) * 6 * s;
  const top = { x: cx + lean, y: gy - trunkH };
  const branches = [], n = s === 3 ? 13 : 3 + s * 2;
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, t0 = 0.55 + (k / n) * 0.45;
    const sx = cx + lean * t0, sy = gy - trunkH * t0 - (k === n - 1 ? 4 : 0);
    const reach = sz.w * (0.55 + ih(k, p.x, 42) * 0.45), lift = sz.h * (0.25 + ih(k, p.x, 43) * 0.3);
    branches.push({ sx, sy, ex: sx + side * reach, ey: sy - lift * 0.4 + sz.h * 0.08, cx: sx + side * reach * 0.45, cy: sy - lift, side, th: Math.max(1, Math.round((s === 3 ? 6 : s * 1.5) - k * (s === 3 ? 0.35 : 0.2))) });
  }
  const at = (b, t) => ({ x: (1 - t) ** 2 * b.sx + 2 * (1 - t) * t * b.cx + t * t * b.ex, y: (1 - t) ** 2 * b.sy + 2 * (1 - t) * t * b.cy + t * t * b.ey });
  // les fils de perles qui pendent des branches
  const strands = [];
  branches.forEach((b, k) => {
    for (let t = 0.3; t <= 1.0; t += 0.14 / s + 0.06) {
      const q = at(b, t), len = Math.round((6 + ih(Math.round(t * 50), k + p.x, 44) * 14) * (0.7 + s * 0.35));
      strands.push({ x: Math.round(q.x), y: Math.round(q.y), len, beads: Math.max(2, Math.round(len / 5)) });
    }
  });
  const pearls = [];
  strands.forEach((st, i) => {
    for (let j = 1; j <= st.beads; j++) {
      const c = ih(i, j, p.x) < 0.65 ? 0 : ih(i, j, p.x + 1) < 0.6 ? 1 : 2;
      pearls.push({ x: st.x + Math.round(Math.sin(j * 1.3 + i) * 1), y: st.y + Math.round((j / st.beads) * st.len), c, big: j === st.beads, ph: ih(i, j, 45) * 6.28 });
    }
  });
  return { s, cx, gy, top, trunkH, branches, strands, pearls, at };
}

/** Arbre à perles lumineuses : tronc sombre et tordu, branches en pleureur, feuillage bleu-vert, fils de perles. */
function pearlTree(pix, p) {
  const T = pearlTreeShape(p), s = T.s;
  // les racines, qui s'agrippent au sol (et à l'eau pour le grand arbre)
  for (let k = 0; k < 2 + s * 2; k++) {
    const side = k % 2 ? 1 : -1, len = 6 + s * 6 + ih(k, p.x, 46) * 8 * s;
    for (let q = 0; q < len; q++) {
      const th = Math.max(1, Math.round((1 - q / len) * (2 + s)));
      for (let j = 0; j < th; j++) pix.set(T.cx + side * (2 + q), T.gy - th + j + Math.round(q / len * 2), TRUNK[j === 0 ? 3 : 1]);
    }
  }
  // le tronc : il se tord en montant, plus étroit en haut, éclairé à gauche (par les perles)
  const w0 = s === 3 ? 18 : 2 + s * 3;
  for (let y = 0; y < T.trunkH + 4; y++) {
    const t = y / T.trunkH, w = Math.max(2, Math.round(w0 * (1 - t * 0.55))), x = T.cx + (T.top.x - T.cx) * t + Math.sin(t * 5 + p.x) * s;
    for (let i = 0; i < w; i++) {
      const u = i / Math.max(1, w - 1);
      pix.set(Math.round(x - w / 2 + i), T.gy - y, TRUNK[u < 0.25 ? 4 : u > 0.75 ? 1 : (ih(i, y >> 2, p.x) < 0.2 ? 2 : 3)]);
    }
  }
  // les branches, puis un feuillage léger le long de leur courbe
  for (const b of T.branches) {
    for (let t = 0; t <= 1; t += 0.01) {
      const q = T.at(b, t), th = Math.max(1, Math.round(b.th * (1 - t * 0.6)));
      for (let j = 0; j < th; j++) pix.set(q.x, q.y + j, TRUNK[j === 0 ? 4 : 2]);
    }
    for (let t = 0.35; t <= 1; t += 0.22) {
      const q = T.at(b, t), r = 3 + s * 2;
      L.leafMass(pix, [q.x - r - 2, q.y - r, q.x + r + 2, q.y + r * 0.6], (x, y) => 1 - ((x - q.x) / r) ** 2 - ((y - q.y) / (r * 0.6)) ** 2 + (ih(x, y, 47) - 0.5) * 0.4,
        (x, y) => 0.6 - (y - q.y + r) / (r * 2.4), CAVE_LEAF, p.x + Math.round(t * 10), { step: 2, size: 0.6 });
    }
  }
  // les fils (les perles elles-mêmes brillent dans live.js)
  for (const st of T.strands) for (let q = 0; q < st.len; q++) if (q % 2 === 0) pix.set(st.x + Math.round(Math.sin(q * 0.3) * 0.6), st.y + q, '#1d2c34');
  for (const pe of T.pearls) pix.set(pe.x, pe.y, pe.c === 1 ? '#5a4a8a' : '#3a6f78');
}

/** Racine de chêne énorme qui barre le passage (au plafond : on glisse dessous ; au sol : on saute). */
function oakRoot(pix, p) {
  const X = p.x * TILE, W = p.w * TILE, y1 = (p.y + 1) * TILE, y0 = y1 - p.h * TILE, ceil = p.kind === 'ceil';
  const R = ['#120c08', '#1f150e', '#2e2016', '#3f2d1e', '#533c27', '#6a4e33'];
  // la masse : un gros cylindre noueux qui sort de la paroi d'un côté et plonge dans l'autre
  const EXT = 72;
  for (let x = X - EXT; x < X + W + EXT; x++) {
    const t = (x - X) / W, inside = t >= 0 && t <= 1;
    // (au plafond, le dessous de la racine est peint 6 px au-dessus de la case : KAGE glisse à 20-21 px de haut)
    const full = p.h * TILE - (ceil ? 6 : 0);
    const e = inside ? 0 : Math.abs(t < 0 ? t : t - 1) * W / EXT;      // 0 au bord du bloc, 1 au bout
    if (!inside && e > 0.98) continue;
    // un tube épais qui traverse le passage, et qui s'amincit en plongeant dans les parois
    const thick = inside ? full * (0.78 + 0.22 * Math.sin(Math.PI * t)) : Math.max(0, full * 0.78 * (1 - e * 0.55));
    if (thick <= 2) continue;
    const rise = inside ? 0 : e * e * (ceil ? 26 : 14);
    const mid = ceil ? (inside ? y0 + (full - thick) * 0.25 + thick / 2 : y0 + thick / 2 - rise) : (inside ? y1 - thick / 2 : y1 - thick / 2 + rise * 0.6);
    const wob = Math.sin(x * 0.07 + p.x) * 2 + (noise1(x * 0.15, p.x) - 0.5) * 3;
    const top = Math.round(mid - thick / 2 + wob), bot = Math.round(mid + thick / 2 + wob * 0.5);
    for (let y = top; y <= bot; y++) {
      const v0 = (y - top) / Math.max(1, bot - top), cyl = Math.sin(v0 * Math.PI);
      let v = 0.15 + cyl * 0.55 - v0 * 0.25 + (noise2(x * 0.06, y * 0.4, p.x) - 0.5) * 0.25;
      const groove = Math.abs(fbm2(x * 0.02, y * 0.25, 2, p.x) - 0.5) < 0.035;
      const m = fbm2(x * 0.08, y * 0.1, 3, p.x + 2) + (v0 < 0.25 ? 0.25 : 0);
      pix.set(x, y, groove ? R[0] : m > 0.66 ? pick(CAVE_LEAF, v + 0.25, x, y) : pick(R, v, x, y));
    }
    // radicelles qui pendent sous la racine
    if (ih(x, 1, p.x) < 0.08) for (let q = 0; q < 3 + Math.floor(ih(x, 2, p.x) * 10); q++) pix.set(x + Math.round(Math.sin(q * 0.4)), bot + 1 + q, R[2]);
  }
}
