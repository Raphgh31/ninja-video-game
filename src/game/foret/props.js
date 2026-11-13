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
        case 'rope_branch': {
          // la grande branche de la statue : elle sort de la falaise au-dessus du tunnel (zone 9)
          const xr = p.x1 * TILE, G = p.ground * TILE;
          // l'arbre qui s'agrippe au pilier (comme aux temples envahis) : derrière, son tronc et ses racines
          add('front', xr - 30, Y - 200, 110, G - Y + 204, (pix) => pillarTree(pix, xr + 26, Y, G, xr, p.x * 3 + 9));
          add('over', X - 40, Y - 70, xr - X + 80, 120, (pix) => ropeBranch(pix, X, xr, Y, p.twig ?? p.x1 * TILE - 105, p.x * 3 + 5));
          break;
        }
        case 'river_rock': {
          // un rocher pointu dans le lit du torrent, derrière les rondins : le pied noyé (l'eau, dessinée
          // devant, le cache), l'écume autour (live.js) ; on ne s'y pose pas
          const h = [9, 13, 18][p.s ?? 1], w = [12, 16, 22][p.s ?? 1];
          add('behind', X - w, Y - h - 4, 2 * w + 16, h + 26, (pix) => riverRock(pix, X + 8, Y + 6, w, h, p.x * 7 + (p.s ?? 1)));
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
          // (il s'arrête au plafond de la caverne : là où la paroi gauche du boyau s'ouvre)
          let bot = p.y; while (bot < level.h - 1 && level.rows[bot][p.x + 2] !== '#' && !(bot > p.y && level.rows[bot][p.x] !== '#')) bot++;
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
        case 'stone_gate': {
          // le pilier maçonné au-dessus de la porte (le terrain n'y peint que de la terre) : gros blocs moussus
          mask(p.x, 3, 0, p.y - 3);
          add('over', X, 0, 3 * TILE, Y - 2 * TILE, (pix) => ruinWallP(pix, X, 0, 3 * TILE, Y - 2 * TILE, 157));
          add('over', X - 12, Y - 3 * TILE - 22, 50, 3 * TILE + 26, (pix) => stoneGate(pix, X, Y));
          break;
        }
        case 'cave_reeds': add('over', X - 8, Y - 34, p.w * TILE + 16, 36, (pix) => caveReeds(pix, X, Y, p.w * TILE, p.x)); break;
        case 'mushrooms': add('over', X - 4, Y - 16, p.w * TILE + 8, 18, (pix) => mushrooms(pix, X, Y, p.w * TILE, p.x)); break;
        case 'rubble': add('front', X - 10, Y - (p.h + 3) * TILE - 6, (p.w + 1) * TILE + 20, (p.h + 3) * TILE + 8, (pix) => rubble(pix, X, Y, p.w, p.h)); break;
        case 'cliff': add('behind', X - TILE, Y - 3 * TILE, (p.w + 2) * TILE, 3 * TILE, (pix) => tunnelBack(pix, X - TILE, Y - 2 * TILE, (p.w + 2) * TILE)); break;
        case 'rock_pillar': case 'rock_ledge': {
          const bottom = level.h;
          mask(p.x, p.w, p.y, bottom - 1);
          add('over', X - 10, Y - 18, p.w * TILE + 20, (bottom - p.y) * TILE + 18, (pix) => rockColumn(pix, X, Y, p.w * TILE, (bottom - p.y) * TILE, p.x, p.type === 'rock_ledge'));
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
        case 'treehouse': {
          // la cabane du guetteur (zone 1) : le chêne et l'arrière de la cabane derrière le terrain ;
          // le bord de la plateforme, la balustrade et l'avant-toit devant (derrière KAGE)
          const ox = X + 8, base = Y + 2, dY = p.deck * TILE;
          add('behind', ox - 170, dY - 230, 340, base - dY + 240, (pix) => oakTree(pix, ox, base, dY, p.seed));
          add('behind', p.x0 * TILE - 12, dY - 70, (p.x1 - p.x0) * TILE + 24, base - dY + 74, (pix) => treehouse(pix, p, 'back'));
          add('over', p.x0 * TILE - 12, dY - 70, (p.x1 - p.x0) * TILE + 24, base - dY + 74, (pix) => treehouse(pix, p, 'front'));
          break;
        }
        case 'root_arch': {
          // l'arche de racines (zone 3) : les racines qui portent la motte, derrière KAGE ; les racines
          // en marche (« - ») et le chevelu qui pend sous la motte, devant le terrain
          const x0 = Math.min(...p.steps.map((q) => q[0])) * TILE - 24, x1 = (p.x + p.w) * TILE + 60, Gy = p.ground * TILE;
          mask(p.x, p.w, p.y, p.y + 2);                   // la motte : peinte ici (une boule de terre ronde), pas par le terrain
          add('behind', x0, Y, x1 - x0, Gy - Y + 6, (pix) => rootArch(pix, p, 'legs'));
          add('over', x0, Y, x1 - x0, Gy - Y + 6, (pix) => rootArch(pix, p, 'front'));
          break;
        }
        case 'sacred_tree': add('behind', X - 110, Y - 190, 236, 194, (pix) => sacredTree(pix, X + 8, Y + 1, p.seed ?? p.x)); break;
        case 'hokora': add('behind', X - 16, Y - 34, 48, 36, (pix) => hokora(pix, X + 8, Y + 1)); break;
        case 'tree_crown': {
          // la couronne d'un grand tronc jouable (détours) : des masses de feuillage autour du fût,
          // derrière lui et ses branches ; quelques grappes et lianes devant (sans jamais cacher KAGE)
          const W = p.w * TILE, top = p.top * TILE, bot = p.y * TILE;
          add('behind', X - 120, top - 30, W + 240, bot - top + 90, (pix) => treeCrown(pix, X, W, top, bot, p.seed ?? p.x, 'back'));
          add('over', X - 120, top - 30, W + 240, bot - top + 90, (pix) => treeCrown(pix, X, W, top, bot, p.seed ?? p.x, 'front'));
          break;
        }
        case 'last_tree': add('behind', X - 140, Y - 440, 300, 444, (pix) => lastTree(pix, X + 8, Y + 2)); break;
        case 'horizon': add('behind', X - 40, Y - 200, 26 * TILE, 204, (pix) => horizon(pix, X, Y, 24 * TILE)); break;
        default: break;
      }
    }
    // la grande branche des lianes balancier (zone 10), portée par des fûts qui montent du ravin
    const vb = level.props.filter((p) => p.type === 'vine_branch');
    if (vb.length) {
      const x0 = (vb[0].x - 9) * TILE, x1 = (vb[vb.length - 1].x + 12) * TILE, y = Math.min(...vb.map((p) => p.y)) * TILE;
      add('behind', x0 - 60, y - 140, x1 - x0 + 120, level.height - y + 140, (pix) => vineBough(pix, level, x0, x1, vb));
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
    const trees = lv.props.filter((p) => p.type === 'canopy_trunk')
      .concat(lv.props.filter((p) => p.type === 'last_tree').map((p) => ({ x: p.x, y: p.y, w: 40, cedar: true })));
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
        // la grande branche de la statue : elle se dessine elle-même (prop rope_branch)
        if (lv.props.some((p) => p.type === 'rope_branch' && p.y === ty && tx >= p.x && tx < p.x1)) continue;
        // les racines en marche de l'arche (zone 3) : elle les dessine elle-même
        if (lv.props.some((p) => p.type === 'root_arch' && p.steps.some((q) => q[1] === ty && tx >= q[0] && tx < q[0] + q[2]))) continue;
        // la plateforme, l'échelle et le toit de la cabane du guetteur : elle les dessine elle-même
        if (lv.props.some((p) => p.type === 'treehouse' && tx >= p.x0 && tx < p.x1 && ty >= p.roof && ty < p.y)) continue;
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
          if (host.cedar) {
            // le grand cèdre de la lisière : chaque branche porte un plateau de feuillage (on marche sur son dessus)
            if (X - 4 < tcx - half) add('over', X - 20, Y - 10, tcx - X + 28, 40, (pix) => cedarTier(pix, X - 6, tcx - half + 2, Y, -1, tx * 7 + ty));
            if (X + W + 4 > tcx + half) add('over', tcx - 8, Y - 10, X + W - tcx + 28, 40, (pix) => cedarTier(pix, tcx + half - 2, X + W + 6, Y, 1, tx * 7 + ty + 1));
          } else {
            if (X - 4 < tcx - half) add('over', X - 16, Y - 12, tcx - X + 24, 28, (pix) => limb(pix, X - 4, tcx - half, Y, -1, tx * 7 + ty, true));
            if (X + W + 4 > tcx + half) add('over', tcx - 8, Y - 12, X + W - tcx + 24, 28, (pix) => limb(pix, tcx + half, X + W + 4, Y, 1, tx * 7 + ty + 1, true));
          }
          // une branche en travers du fût (une fourche) : un rebord de bois moussu devant lui
          if (X < tcx - half && X + W > tcx + half) add('over', tcx - half - 4, Y - 4, 2 * half + 8, 14, (pix) => crotch(pix, tcx, half + 3, Y, tx));
          if (d?.nest) add('over', X + W / 2 - 18, Y - 14, 36, 18, (pix) => nest(pix, X + W / 2, Y));
          continue;
        }
        // une branche qui sort d'un grand tronc jouable (« | » au bout) : un bras feuillu, pas d'arbre en plus
        const bole = row[tx + w] === '|' ? 1 : row[tx - 1] === '|' ? -1 : 0;
        if (bole) {
          const edge = bole > 0 ? (tx + w) * TILE + 3 : tx * TILE - 3;
          // l'arbre aux cavités (un tronc jouable couronné) : de vieilles branches naturelles, effilées
          const crowned = lv.props.some((p) => p.type === 'tree_crown' && Math.abs((bole > 0 ? tx + w : tx - 3) - p.x) <= 1);
          if (crowned) add('over', X - 30, Y - 22, W + 60, 46, (pix) => oldBough(pix, bole > 0 ? X - 4 : edge, bole > 0 ? edge : X + W + 4, Y, -bole, tx * 7 + ty));
          else add('over', X - 16, Y - 14, W + 32, 32, (pix) => limb(pix, bole > 0 ? X - 4 : edge, bole > 0 ? edge : X + W + 4, Y, -bole, tx * 7 + ty, true));
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
/**
 * Le grand arbre agrippé au pilier de la statue (zone 9) : un tronc épais plaqué contre la maçonnerie (cx),
 * qui monte vers la canopée au-dessus de l'image ; sous la branche (Y), ses racines ruissellent le long
 * des pierres jusqu'au sol (G), en laissant libre l'entrée du tunnel (à door).
 */
function pillarTree(pix, cx, Y, G, door, seed) {
  // le tronc : un cylindre éclairé à gauche, sillons verticaux, mousse
  for (let y = Y - 200; y < Y + 26; y++) {
    const half = 12 + Math.max(0, (y - Y) / 26) * 6 + (noise1(y * 0.05, seed) - 0.5) * 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - (cx - half)) / (2 * half);
      let v = 0.82 - u * 0.66 + (noise2(x * 0.5, y * 0.08, seed) - 0.5) * 0.2;
      if (Math.abs(noise2(x * 0.32, y * 0.025, seed + 1) - 0.5) < 0.05) v -= 0.3;
      const moss = u < 0.35 && fbm2(x * 0.1, y * 0.06, 2, seed + 2) > 0.58;
      pix.set(x, y, moss ? pick(C.MOSS, 0.4 + (1 - u) * 0.4, x, y) : pick(C.BARK, v, x, y));
    }
  }
  // le départ de la grande branche : un collet épais, du tronc jusqu'au bord du pilier (la poulie est juste à gauche)
  for (let x = door - 2; x <= cx - 8; x++) {
    const t = (x - (door - 2)) / Math.max(1, cx - 8 - (door - 2)), th = Math.round(15 + t * 9);
    for (let j = 0; j < th; j++) {
      const y = Y - Math.round(t * 4) + j, k = j / th;
      const moss = j <= 1 ? (ih(x, 1, seed) < 0.6 ? C.MOSS[5] : C.MOSS[4]) : null;
      pix.set(x, y, moss ?? pick(C.BARK, 0.8 - k * 0.7 + (noise2(x * 0.4, y * 0.4, seed + 5) - 0.5) * 0.2, x, y));
    }
  }
  // en haut, il se perd dans le feuillage
  for (let k = 0; k < 4; k++) L.bush(pix, cx - 18 + k * 12, Y - 196 + (k % 2) * 8, 22, 14, C.LEAF, seed + k);
  // les racines : elles descendent le long du pilier, s'écartent de l'entrée du tunnel (à gauche, la porte)
  // et s'arrêtent au-dessus de son plafond : rien ne passe devant le bloc ni ne cache KAGE qui y glisse
  const roots = [[-2, door + 26, 6, G - 3 * TILE], [4, door + 14, 4, G - 4 * TILE], [9, door + 38, 5, G - 3 * TILE - 6], [-11, door + 2, 3, G - 3 * TILE - 2]];
  for (const [i, [dx, xg, w, yEnd]] of roots.entries()) rootStroke(pix, cx + dx, Y + 18, xg, yEnd, w, 2, (i % 2 ? 8 : -6), seed + 30 + i, 1);
}

/**
 * La grande branche de la statue (zone 9), de X0 (son bout, à gauche) à X1 (la falaise) ; dessus plat à Y
 * (on y marche). Massive contre la roche (un collet, des racines qui l'agrippent), elle s'effile vers la
 * gauche ; des touffes de feuilles dessous et au bout, de la mousse, des brins qui pendent ; un grand
 * rameau en Y dressé à twigX (sa fourche, 13 px au-dessus du dessus), où la corde se coincera au retour.
 */
function ropeBranch(pix, X0, X1, Y, twigX, seed) {
  const len = X1 - X0;
  for (let x = X0 - 6; x <= X1 + 6; x++) {
    const t = (X1 - x) / len;                                            // 0 contre la falaise, 1 au bout
    const th = Math.max(5, Math.round(16 - t * 9 + Math.max(0, 1 - (X1 - x) / 22) * 10 + (noise1(x * 0.17, seed) - 0.5) * 2));
    const top = Y + (x > X1 - 10 ? -Math.round((x - (X1 - 10)) * 0.6) : 0) + Math.round((noise1(x * 0.09, seed + 1) - 0.5) * 1.2);
    for (let y = top; y < Y + th; y++) {
      const k = (y - top) / (Y + th - top);
      let v = 0.82 - k * 0.72 + (noise2(x * 0.4, y * 0.5, seed) - 0.5) * 0.2;
      if (Math.abs(noise2(x * 0.05, y * 0.45, seed + 2) - 0.5) < 0.04) v -= 0.28;     // les sillons de l'écorce
      const moss = y - top <= 1 ? (ih(x, 1, seed) < 0.65 ? C.MOSS[5] : C.MOSS[4]) : y - top === 2 && ih(x, 2, seed) < 0.45 ? C.MOSS[3] : null;
      pix.set(x, y, moss ?? pick(C.BARK, v, x, y));
    }
  }
  // contre la falaise : des racines qui s'enfoncent dans les fissures de la roche
  for (let k = 0; k < 4; k++) rootStroke(pix, X1 - 4, Y + 4 + k * 3, X1 + 10 + k * 5, Y - 30 + k * 22, 5 - (k % 2), 1, (k % 2 ? 4 : -4), seed + 20 + k);
  // le bout : un rameau qui se relève, une grosse touffe
  for (let i = 0; i < 10; i++) { const x = X0 - 6 - i, y = Y + 2 - Math.round((i / 10) ** 1.5 * 7); pix.set(x, y, C.BARK[2]); pix.set(x, y + 1, C.BARK[1]); }
  L.bush(pix, X0 - 16, Y - 6, 18, 11, C.LEAF, seed + 3);
  // des touffes sous la branche (le dessus reste libre), de la mousse et des brins qui pendent
  for (let x = X0 + 10; x < X1 - 20; x += 22 + Math.floor(ih(x, 3, seed) * 14)) L.bush(pix, x, Y + 14, 12 + Math.floor(ih(x, 4, seed) * 8), 7, C.LEAF, seed + x);
  for (let x = X0 + 4; x < X1 - 6; x += 4) if (ih(x, 5, seed) < 0.45) L.strand(pix, x, Y + 10 + Math.floor(ih(x, 6, seed) * 4), 4 + Math.floor(ih(x, 7, seed) * 12), C.LEAF, seed + x, 0.5);
  for (let x = X0; x < X1 - 4; x += 3) if (ih(x, 8, seed) < 0.45) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 9, seed) * 2), C.FERN, x);
  // le grand rameau en Y : une tige qui sort du dessus (un empattement moussu), se fourche à 13 px ; un bras
  // part loin vers la gauche, l'autre se dresse ; des feuilles en touffes au bout de chacun, quelques-unes
  // le long des bras ; la corde se coince dans la fourche
  const tx = Math.round(twigX), fy = Y - 13;
  for (let k = -3; k <= 4; k++) if (Math.abs(k) < 3 || ih(k, 11, seed) < 0.6) pix.set(tx + 1 + k, Y - 1, k < 1 ? C.MOSS[4] : C.BARK[2]);
  rootStroke(pix, tx + 3, Y + 1, tx, fy, 7, 4, 0.8, seed + 40, 1);              // la tige
  rootStroke(pix, tx - 1, fy + 1, tx - 21, Y - 31, 4, 2, -2, seed + 41);       // le bras de gauche, qui part loin
  rootStroke(pix, tx + 1, fy + 1, tx - 2, Y - 36, 3.5, 1.5, 1.2, seed + 42);    // le bras dressé
  rootStroke(pix, tx - 12, Y - 24, tx - 16, Y - 38, 2, 1, 0.6, seed + 43);     // une brindille
  rootStroke(pix, tx - 18, Y - 29, tx - 27, Y - 33, 1.5, 1, -0.5, seed + 47);   // et une autre, au bout
  L.bush(pix, tx - 24, Y - 29, 10, 8, C.LEAF, seed + 44);
  L.bush(pix, tx - 2, Y - 34, 8, 9, C.LEAF, seed + 45);
  L.bush(pix, tx - 15, Y - 36, 7, 7, C.LEAF, seed + 46);
  for (const [dx, dy] of [[-6, -18], [-9, -22], [3, -24], [-1, -17], [-14, -26], [2, -30]]) { pix.set(tx + dx, Y + dy, C.LEAF[4]); pix.set(tx + dx + 1, Y + dy, C.LEAF[3]); pix.set(tx + dx, Y + dy - 1, C.LEAF[5]); }
}

/**
 * Un rocher du torrent (décor) : pointu, de biais, luisant d'eau ; base à cy (la ligne d'eau), w de large,
 * h de haut au-dessus de l'eau ; plus bas, il continue sous l'eau (cachée devant lui).
 */
function riverRock(pix, cx, cy, w, h, seed) {
  const S = ['#1a2328', '#25323a', '#33454f', '#4a5f69', '#6a808a', '#93a7ad', '#c9d8da'];
  const lean = (ih(seed, 1, 71) - 0.5) * 0.6, peak = cx + Math.round(lean * w);
  for (let y = cy - h; y < cy + 14; y++) {
    const k = Math.min(1, (y - (cy - h)) / h);                          // 0 à la pointe, 1 à la ligne d'eau
    const half = w * Math.pow(k, 0.7) * (1 + (noise1(y * 0.3, seed) - 0.5) * 0.35) + (y > cy ? (y - cy) * 0.4 : 0);
    const c0 = peak + (cx - peak) * k;
    for (let x = Math.floor(c0 - half); x <= Math.ceil(c0 + half); x++) {
      const u = (x - (c0 - half)) / Math.max(1, 2 * half);             // 0 à gauche (lumière), 1 à droite
      let v = 0.78 - u * 0.62 - k * 0.12 + (noise2(x * 0.3, y * 0.3, seed) - 0.5) * 0.2;
      if (Math.abs(noise2(x * 0.15, y * 0.4, seed + 1) - 0.5) < 0.035) v -= 0.3;   // fissures
      let c = pick(S, v, x, y);
      if (y > cy - 3 && y <= cy) c = S[1];                              // la ligne mouillée, sombre
      if (u < 0.25 && k < 0.6 && ih(x, y, seed) < 0.12) c = S[6];       // l'eau qui luit
      pix.set(x, y, c);
    }
  }
  // un filet de mousse sur le côté abrité, des gouttes au pied
  for (let y = cy - Math.round(h * 0.5); y < cy - 2; y++) if (ih(y, 2, seed) < 0.5) pix.set(Math.round(cx + w * 0.35 + (cx - peak) * 0.2), y, C.MOSS[2]);
}

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
/** Une branche feuillue seule, dans sa propre image (la branche qui rompt, dessinée par live.js). */
export function limbSprite(x0, x1, Y, dir, seed) {
  const X = Math.floor(Math.min(x0, x1)) - 16, W = Math.ceil(Math.abs(x1 - x0)) + 32, pix = new Window(X, Y - 16, W, 36);
  limb(pix, x0, x1, Y, dir, seed, true);
  return { img: pix.done(), x: X, y: Y - 16 };
}

function limb(pix, x0, x1, Y, dir, seed, leafy, ramp = C.LEAF) {
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
    L.bush(pix, dir > 0 ? b - 2 : a + 2, Y + 3, 12, 8, ramp, seed + 3);
    for (let x = a + 4; x < b - 4; x += 5) if (ih(x, 3, seed) < 0.45) L.strand(pix, x, Y + 6, 4 + Math.floor(ih(x, 4, seed) * 9), ramp, seed + x, 0.5);
  }
  for (let x = a + 2; x < b; x += 3) if (ih(x, 5, seed) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 6, seed) * 2), C.FERN, x);
}

/**
 * Une vieille branche de l'arbre aux cavités, de x0 à x1 (dir : côté du bout). Épaisse au tronc (un collet
 * qui s'y fond), elle s'effile jusqu'au bout, où un rameau se relève ; le dessus reste plat là où l'on
 * marche, moussu ; quelques rameaux portent des touffes de feuilles, une grosse touffe coiffe le bout.
 */
function oldBough(pix, x0, x1, Y, dir, seed) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1), len = b - a;
  const at = (t) => (dir > 0 ? a + t * len : b - t * len);
  for (let x = a; x <= b; x++) {
    const t = dir > 0 ? (x - a) / len : (b - x) / len;               // 0 côté tronc, 1 au bout
    const collar = Math.max(0, 1 - t * len / 9);                      // le collet, contre le tronc
    const th = Math.max(3, Math.round(10 - t * 6 + collar * 6 + (noise1(x * 0.21, seed) - 0.5) * 2));
    const top = Y + Math.round((noise1(x * 0.11, seed + 1) - 0.5) * 1.2) - Math.round(collar * 3);
    for (let j = 0; j < th + (top < Y ? Y - top : 0); j++) {
      const y = top + j, k = j / th;
      const v = 0.8 - k * 0.7 + (noise2(x * 0.45, y * 0.6, seed) - 0.5) * 0.18 - (Math.abs(noise2(x * 0.06, y * 0.5, seed + 2) - 0.5) < 0.04 ? 0.25 : 0);
      const moss = j <= 1 && y <= Y + 1 ? (ih(x, 1, seed) < 0.62 ? C.MOSS[5] : C.MOSS[4]) : j === 2 && ih(x, 2, seed) < 0.4 ? C.MOSS[3] : null;
      pix.set(x, y, moss ?? pick(C.BARK, v, x, y));
    }
  }
  // le bout : un rameau qui se relève, au-delà de la partie où l'on marche
  const tipX = dir > 0 ? b : a;
  for (let i = 0; i < 9; i++) {
    const x = tipX + dir * i, y = Y + 1 - Math.round((i / 9) ** 1.6 * 6);
    pix.set(x, y, C.BARK[2]); pix.set(x, y + 1, C.BARK[1]);
  }
  L.bush(pix, tipX + dir * 9, Y - 4, 14, 9, C.LEAF, seed + 3);
  // des rameaux le long de la branche : vers le bas surtout (le dessus reste libre), une touffe au bout de chacun
  for (let k = 0; k < 3; k++) {
    if (ih(k, 4, seed) < 0.3) continue;
    const t = 0.3 + k * 0.22 + (ih(k, 5, seed) - 0.5) * 0.1, x = Math.round(at(t)), down = ih(k, 6, seed) < 0.75;
    const n = 6 + Math.floor(ih(k, 7, seed) * 7);
    let ex = x, ey = Y;
    for (let i = 0; i < n; i++) {
      ex = x + dir * Math.round(i * 0.7); ey = down ? Y + 6 + Math.round(i * 0.6) : Y - 1 - Math.round(i * 0.8);
      pix.set(ex, ey, C.BARK[1]);
    }
    L.bush(pix, ex, ey + (down ? 1 : -2), 8 + Math.floor(ih(k, 8, seed) * 5), 6, C.LEAF, seed + 10 + k);
  }
  // des brins de mousse et de feuilles qui pendent, et des touffes d'herbe sur le dessus
  for (let x = a + 6; x < b - 3; x += 5) if (ih(x, 3, seed) < 0.4) L.strand(pix, x, Y + 7, 3 + Math.floor(ih(x, 4, seed) * 8), C.LEAF, seed + x, 0.5);
  for (let x = a + 2; x < b; x += 3) if (ih(x, 5, seed) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 6, seed) * 2), C.FERN, x);
}

/** La fourche d'un grand arbre, là où une branche le traverse : un bourrelet de bois sur lequel on se pose. */
function crotch(pix, cx, half, Y, seed) {
  for (let x = cx - half; x <= cx + half; x++) {
    const t = (x - (cx - half)) / (2 * half), th = Math.round(5 + Math.sin(t * Math.PI) * 3);
    for (let j = 0; j < th; j++) pix.set(x, Y + j, j === 0 ? (ih(x, 1, seed) < 0.5 ? C.MOSS[4] : C.MOSS[3]) : pick(C.BARK, 0.8 - t * 0.5 - j / th * 0.35, x, Y + j));
  }
}

/** Le feuillage du cèdre au couchant : les aiguilles sombres, bleuies par le soir, et le liseré chaud du soleil bas. */
const CEDAR = ['#0f1a1c', '#16262a', '#1f3434', '#2a453f', '#3a5a4a', '#577055', '#8a8a62'];

/**
 * Un plateau de cèdre le long d'une branche (de x0 à x1, dir : côté du bout) : le dessus presque plat
 * (on s'y pose), l'épaisseur qui retombe en franges, plus épaisse près du fût, éclairée du haut à
 * gauche ; une branche sombre dedans ; le soleil couchant ourle le dessus.
 */
function cedarTier(pix, x0, x1, Y, dir, seed) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1), len = b - a;
  const th = (x) => { const t = dir > 0 ? (x - a) / len : (b - x) / len; return 13 - t * 7 + Math.sin(x * 0.55 + seed) * 2 + (noise1(x * 0.3, seed) - 0.5) * 4; };
  const inside = (x, y) => {
    if (x < a - 3 || x > b + 3) return -1;
    const end = dir > 0 ? b - x : x - a, round = Math.min(1, end / 6);
    const top = Y - 2 - round * 2, bot = Y + th(x) * (0.4 + 0.6 * round);
    return Math.min(y - top, bot - y) / 3 + (noise2(x * 0.4, y * 0.4, seed) - 0.5) * 0.8;
  };
  // la branche, devinée sous le feuillage
  for (let x = a; x <= b; x++) { const t = dir > 0 ? (x - a) / len : (b - x) / len; for (let j = 0; j < Math.max(2, 5 - t * 3); j++) pix.set(x, Y + 3 + j, C.BARK[j ? 0 : 2]); }
  L.leafMass(pix, [a - 4, Y - 6, b + 4, Y + 18], inside, (x, y) => 0.78 - (y - Y + 4) / 18 - (x - a) / 900, CEDAR, seed, { step: 2, wide: 0 });
  // le liseré du couchant sur le dessus (c'est là qu'on marche)
  for (let x = a + 1; x < b; x++) if (inside(x, Y - 1) > 0 && ih(x, 3, seed) < 0.7) pix.set(x, Y - 1 + (ih(x, 4, seed) < 0.3 ? 1 : 0), ih(x, 5, seed) < 0.4 ? '#c99a62' : CEDAR[5]);
}

const DUSK_LEAF = ['#1a1420', '#2a1f2e', '#3a2a36', '#4f3a40', '#6b4d4a', '#8c6a56', '#b08a62'];   // feuillage au couchant (le dernier grand arbre)

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

/**
 * Couronne d'un grand tronc jouable : de gros lobes de feuillage étagés autour du fût, éclairés du
 * haut à gauche, qui retombent en franges ; des branches maîtresses qui y plongent ; des lianes.
 * part 'back' : la masse (derrière le tronc et le terrain) ; 'front' : quelques grappes sur les
 * bords du fût et des feuilles qui pendent, devant le terrain mais derrière KAGE.
 */
function treeCrown(pix, X, W, top, bot, seed, part) {
  const cx = X + W / 2;
  if (part === 'back') {
    // des touffes étagées le long du fût, de part et d'autre, chacune au bout de sa branche
    // (le même dessin que les vieux chênes : on voit le ciel entre elles)
    const tufts = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const side = (i + (seed % 2)) % 2 ? 1 : -1, u = i / (n - 1);
      const y = top + 18 + u * (bot - top - 46) + (ih(i, 1, seed) - 0.5) * 14;
      const reach = W / 2 + 26 + ih(i, 2, seed) * 46 + Math.sin(u * Math.PI) * 26;
      tufts.push({ x: cx + side * reach, y, rx: 24 + ih(i, 3, seed) * 16, ry: 15 + ih(i, 4, seed) * 9, side, back: ih(i, 5, seed) < 0.3 });
    }
    tufts.push({ x: cx + 4, y: top + 4, rx: 40, ry: 22, side: 0, back: false });
    const deep = L.hazeRamp(C.LEAF, '#0c2a22', 0.35);
    tufts.sort((a, b) => (b.back - a.back) || (a.y - b.y));
    for (const [k, t] of tufts.entries()) {
      if (t.side) {
        const sx = cx + t.side * (W / 2 - 2), sy = t.y + t.ry * 0.9 + 10, ex = t.x - t.side * t.rx * 0.25, ey = t.y + t.ry * 0.35;
        const len = Math.ceil(Math.hypot(ex - sx, ey - sy));
        for (let q = 0; q <= len; q++) {
          const u = q / len, x = sx + (ex - sx) * u, y = sy + (ey - sy) * u - Math.sin(u * Math.PI) * 6, w = Math.max(1, Math.round(5 - u * 3.5));
          for (let j = 0; j < w; j++) pix.set(Math.round(x), Math.round(y) + j, j === 0 ? C.BARK[t.back ? 2 : 4] : j === w - 1 ? C.BARK[0] : C.BARK[t.back ? 1 : 2]);
        }
      }
      const inside = (x, y) => (1 - Math.hypot((x - t.x) / t.rx, ((y - t.y) / t.ry) * (y > t.y ? 1.25 : 1))) * 3 + (noise2(x * 0.22, y * 0.22, seed + k) - 0.5) * 1.6;
      const light = (x, y) => (t.back ? 0.5 : 0.82) - ((y - t.y) / t.ry) * 0.42 - ((x - t.x) / t.rx) * 0.22;
      L.leafMass(pix, [Math.floor(t.x - t.rx - 8), Math.floor(t.y - t.ry - 8), Math.ceil(t.x + t.rx + 8), Math.ceil(t.y + t.ry + 8)], inside, light, t.back ? deep : C.LEAF, seed + k * 3);
      if (t.side && ih(k, 9, seed) < 0.55) L.strand(pix, Math.round(t.x + (ih(k, 10, seed) - 0.5) * t.rx), Math.round(t.y + t.ry * 0.6), 8 + Math.floor(ih(k, 11, seed) * 24), C.LEAF, seed + k, 0.6);
    }
  } else {
    // devant : de petites grappes collées aux flancs du fût (elles cassent sa silhouette droite)
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1, y = top + 30 + k * ((bot - top - 50) / 6) + ih(k, 4, seed) * 12;
      L.bush(pix, Math.round(cx + side * (W / 2 + 4)), Math.round(y), 9 + Math.floor(ih(k, 5, seed) * 5), 7, C.LEAF, seed + k * 5);
    }
    for (let i = 0; i < 5; i++) L.strand(pix, Math.round(cx + (i % 2 ? 1 : -1) * (W / 2 + 2 + i * 3)), Math.round(top + 50 + i * 30), 8 + Math.floor(ih(i, 7, seed) * 12), C.LEAF, seed + 30 + i, 0.9);
  }
}

/** Le vieux chêne de la cabane du guetteur : un fût court et noueux qui se divise en grosses
 *  branches au-dessus de la plateforme, et un houppier large et touffu. */
function oakTree(pix, cx, base, deckY, seed) {
  const fork = deckY - 34;
  L.bigTrunk(pix, cx, 34, base, seed, C.BARK, C.MOSS, { top: fork, roots: 1.35 });
  // les grosses branches : elles partent du haut du fût en éventail
  const arms = [[-1, 0.55, 70, 9], [1, 0.45, 82, 10], [-1, 1.15, 50, 7], [1, 1.25, 46, 7], [0, 1.6, 40, 8]];
  for (const [side, rise, len, w0] of arms) {
    for (let q = 0; q < len; q++) {
      const t = q / len, w = Math.max(2, Math.round(w0 * (1 - t * 0.7)));
      const x = cx + side * q * (side ? 1 : 0.15) + (side ? 0 : Math.sin(q * 0.08) * 4), y = fork + 4 - q * rise * (1 - t * 0.3);
      for (let j = -Math.floor(w / 2); j <= Math.floor(w / 2); j++) {
        const u = (j + w / 2) / w;
        pix.set(Math.round(x + (side ? 0 : j)), Math.round(y + (side ? j : 0)), pick(C.BARK, 0.75 - u * 0.55 + (noise2(q * 0.3, j, seed) - 0.5) * 0.15, x, y));
      }
    }
  }
  clumpCrown(pix, cx, fork, 150, seed);
}

/** Un houppier en touffes séparées (pins japonais, vieux chênes) sur sa ramure ; R : rayon (px). */
function clumpCrown(pix, cx, fork, R, seed, n = Math.round(18 * R / 150), ramp = C.LEAF) {
  const k = R / 150;
  // le houppier : des touffes bien séparées (on voit le ciel entre elles), chacune éclairée du haut
  // à gauche et sombre dessous ; celles du fond, plus sombres, d'abord
  const tufts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + 0.5) / n * Math.PI + (ih(i, 1, seed) - 0.5) * 0.25;
    const r = 0.55 + ih(i, 2, seed) * 0.45;
    tufts.push({ x: cx + Math.cos(a) * R * r, y: fork - 60 * k + Math.sin(a) * R * 0.8 * r, rx: (26 + ih(i, 3, seed) * 18) * k, ry: (18 + ih(i, 4, seed) * 12) * k, back: ih(i, 5, seed) < 0.4 });
  }
  tufts.push({ x: cx - 8 * k, y: fork - 30 * k, rx: 44 * k, ry: 22 * k, back: true }, { x: cx + 40 * k, y: fork - 150 * k, rx: 38 * k, ry: 26 * k, back: false });
  tufts.sort((a, b) => (b.back - a.back) || (a.y - b.y));
  const deep = L.hazeRamp(ramp, ramp === C.LEAF ? '#0c2a22' : '#140c18', 0.35);
  // la ramure : quatre branches maîtresses qui montent en s'écartant, puis un rameau vers chaque touffe
  const limbLine = (sx, sy, ex, ey, w0, w1, bend, dark) => {
    const n = Math.ceil(Math.hypot(ex - sx, ey - sy));
    const pts = [];
    for (let q = 0; q <= n; q++) {
      const u = q / n, x = sx + (ex - sx) * u + Math.sin(u * Math.PI) * bend * 0.4, y = sy + (ey - sy) * u - Math.sin(u * Math.PI) * bend;
      const w = Math.max(1, Math.round(w0 + (w1 - w0) * u));
      for (let j = 0; j < w; j++) pix.set(Math.round(x), Math.round(y) + j, j === 0 ? (dark ? C.BARK[2] : C.BARK[4]) : j === w - 1 ? C.BARK[0] : pick(C.BARK, dark ? 0.25 : 0.45, x, y + j));
      pts.push([x, y]);
    }
    return pts;
  };
  const mains = [[-150, -70], [-70, -150], [60, -155], [140, -80]].map(([dx, dy], i) => limbLine(cx + Math.sign(dx) * 4 * k, fork + 8 * k, cx + dx * 0.72 * k, fork + dy * 0.72 * k, Math.max(3, 8 * k), Math.max(1, 3 * k), (10 + i * 3) * k, false));
  for (const [k, t] of tufts.entries()) {
    // le point de la ramure le plus proche de la touffe : le rameau en part
    let best = null, bd = 1e9;
    for (const m of mains) for (let q = Math.floor(m.length * 0.35); q < m.length; q += 3) { const d = Math.hypot(m[q][0] - t.x, m[q][1] - t.y); if (d < bd) { bd = d; best = m[q]; } }
    limbLine(best[0], best[1], t.x - Math.sign(t.x - cx) * t.rx * 0.15, t.y + t.ry * 0.4, t.back ? 3 : 4, 1, 4 + ih(k, 12, seed) * 6, t.back);
  }
  for (const [k, t] of tufts.entries()) {
    const inside = (x, y) => {
      const nx = (x - t.x) / t.rx, ny = (y - t.y) / t.ry;
      return (1 - Math.hypot(nx, ny * (y > t.y ? 1.25 : 1))) * 3 + (noise2(x * 0.22, y * 0.22, seed + k) - 0.5) * 1.6;
    };
    const light = (x, y) => (t.back ? 0.5 : 0.82) - ((y - t.y) / t.ry) * 0.42 - ((x - t.x) / t.rx) * 0.22 - (x - cx) / 900;
    L.leafMass(pix, [Math.floor(t.x - t.rx - 8), Math.floor(t.y - t.ry - 8), Math.ceil(t.x + t.rx + 8), Math.ceil(t.y + t.ry + 8)], inside, light, t.back ? deep : ramp, seed + k * 3);
  }
  // quelques brins qui pendent des touffes basses
  for (const [i, t] of tufts.entries()) if (t.y > fork - 80 * k && ih(i, 9, seed) < 0.6) L.strand(pix, Math.round(t.x + (ih(i, 10, seed) - 0.5) * t.rx), Math.round(t.y + t.ry * 0.6), Math.round((8 + Math.floor(ih(i, 11, seed) * 22)) * k), ramp, seed + i, 0.6);
}

/**
 * Un « orteil » de racine qui rampe au sol depuis le pied d'un pilier : posé sur la ligne y0, il part vers
 * dir (-1 ou 1) sur len px, de h0 px de haut à rien ; le dessus moussu, il ondule un peu.
 */
function rootToe(pix, x0, y0, len, dir, h0, seed) {
  for (let i = 0; i <= len; i++) {
    const u = i / len, h = Math.round(h0 * Math.pow(1 - u, 0.8) + (noise1(i * 0.2, seed) - 0.5) * 1.5);
    if (h < 1) continue;
    const x = Math.round(x0 + dir * i), top = y0 - h + Math.round((noise1(i * 0.15, seed + 1) - 0.5) * 2);
    for (let y = top; y <= y0; y++) {
      const t = (y - top) / Math.max(1, y0 - top);
      const moss = y - top < 2 && fbm2(x * 0.12, y * 0.2, 2, seed + 2) > 0.45;
      pix.set(x, y, moss ? (y === top ? C.MOSS[4] : C.MOSS[3]) : pick(C.BARK, 0.75 - t * 0.45 - u * 0.1 + (noise2(x * 0.4, y * 0.4, seed) - 0.5) * 0.15, x, y));
    }
  }
}

/** Une racine épaisse, de (x0, y0) à (x1, y1), de largeur w0 à w1, courbée de bend (px) ; éclairée à gauche. */
function rootStroke(pix, x0, y0, x1, y1, w0, w1, bend, seed, mossy = 0) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.3);
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  for (let q = 0; q <= n; q++) {
    const u = q / n, b = Math.sin(u * Math.PI) * bend + (noise1(u * 6, seed) - 0.5) * 3;
    const cx = x0 + (x1 - x0) * u + (nx / nl) * b, cy = y0 + (y1 - y0) * u + (ny / nl) * b;
    const w = w0 + (w1 - w0) * u;
    for (let j = -w / 2; j <= w / 2; j += 0.5) {
      const x = Math.round(cx + j), y = Math.round(cy);
      const t = (j + w / 2) / Math.max(1, w);                              // 0 à gauche (lumière), 1 à droite
      let v = 0.78 - t * 0.6 + (noise2(x * 0.5, y * 0.12, seed) - 0.5) * 0.18;
      if (Math.abs(noise2(x * 0.3, y * 0.04, seed + 1) - 0.5) < 0.03) v -= 0.25;   // sillons de l'écorce
      const moss = mossy && t < 0.45 && fbm2(x * 0.1, y * 0.08, 2, seed + 2) > 0.62 - mossy * 0.1;
      pix.set(x, y, moss ? pick(C.MOSS, 0.3 + (1 - t) * 0.5, x, y) : pick(C.BARK, v, x, y));
    }
  }
}

/** L'arche de racines (zone 3). part 'legs' : les deux pieds et des racines qui descendent ; 'front' : les marches, le chevelu sous la motte. */
function rootArch(pix, p, part) {
  const T = TILE, X0 = p.x * T, X1 = (p.x + p.w) * T, bot = (p.y + 3) * T, G = p.ground * T, seed = p.seed;
  if (part === 'legs') {
    // des racines-piliers (comme un banian) : larges et évasées au sol, où elles s'étalent en « orteils »
    // dans la mousse, elles s'affinent en montant vers la motte qu'elles portent
    const leg = (xg, xt, yt, wg, wt, bend, s, toes = [1, -1]) => {
      rootStroke(pix, xg, G + 3, xt, yt, wg, wt, bend, s, 1);
      for (const [k, dir] of toes.entries()) rootToe(pix, xg + dir * (wg * 0.25), G + 2, 10 + wg * (0.7 + 0.5 * ih(k, 3, s)), dir, Math.max(3, wg * 0.42), s + k);
    };
    // le pied gauche : la grosse racine passe par les deux marches (ses genoux) avant de plonger dans la rive
    const st = [...p.steps].sort((a, b) => a[1] - b[1]);                   // de la plus haute à la plus basse
    const pts = [[X0 + 10, bot - 8], ...st.map(([c, r, w]) => [(c + w / 2) * T, r * T + 6]), [st[st.length - 1][0] * T - 18, G + 3]];
    const nSeg = pts.length - 1;
    for (let i = 0; i < nSeg; i++) rootStroke(pix, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 9 + i * 5, 14 + i * 5, i % 2 ? 4 : -4, seed + i, 1);
    for (const [k, dir] of [-1, 1].entries()) rootToe(pix, pts[nSeg][0] + dir * 5, G + 2, 18 + k * 8, dir, 9, seed + 40 + k);
    leg(X0 - 22, X0 + 20, bot - 4, 22, 7, -8, seed + 3);                  // le second pied gauche
    // le pied droit : le plus massif, deux piliers jumeaux
    leg(X1 + 38, X1 - 14, bot - 6, 30, 10, 14, seed + 7);
    leg(X1 + 14, X1 - 28, bot - 3, 20, 7, 7, seed + 9, [-1]);
    // au milieu, deux racines plus fines (loin du passage, derrière KAGE), évasées elles aussi
    leg(X0 + 26, X0 + 40, bot - 2, 11, 4, 5, seed + 13, [-1]);
    leg(X1 - 30, X1 - 44, bot - 2, 10, 4, -5, seed + 15, [1]);
    return;
  }
  // les marches : des genoux de la grosse racine, renflés, le dessus moussu et plat (on s'y pose)
  for (const [c, r, w] of p.steps) {
    const x0 = c * T - 3, x1 = (c + w) * T + 3, y = r * T;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0), th = Math.round(6 + Math.sin(t * Math.PI) * 6);
      for (let j = 0; j < th; j++) pix.set(x, y + j, j === 0 ? (ih(x, 1, seed) < 0.6 ? C.MOSS[5] : C.MOSS[4]) : j === 1 ? C.MOSS[3] : pick(C.BARK, 0.8 - t * 0.35 - (j / th) * 0.4, x, y + j));
    }
    for (let x = x0 + 3; x < x1; x += 4) if (ih(x, 2, seed) < 0.5) L.grassTuft(pix, x, y - 1, 2 + Math.floor(ih(x, 3, seed) * 2), C.FERN, x);
  }
  // la motte : une boule de terre et de racines, ronde dessous, la mousse qui déborde du dessus
  const Y = p.y * T, mid = (X0 + X1) / 2, half = (X1 - X0) / 2;
  for (let y = Y - 2; y < bot + 10; y++) for (let x = X0 - 8; x <= X1 + 8; x++) {
    const d = (y - Y) / (bot + 8 - Y);                                   // 0 en haut, 1 au fond de la boule
    const w = half + 4 * Math.sin(Math.min(1, d * 1.6) * Math.PI) - Math.max(0, d - 0.55) * 1.9 * half * (d - 0.55) / 0.45
      + (noise1(y * 0.25, seed + 20) - 0.5) * 3;
    if (Math.abs(x - mid) > w || (y < Y && Math.abs(x - mid) > half - 2)) continue;
    const e = w - Math.abs(x - mid), lit = (x - mid) / w;                 // distance au bord ; -1 à gauche (lumière)
    let c;
    if (y < Y + 3) c = y < Y ? C.MOSS[5] : pick(C.MOSS, 0.75 - (y - Y) * 0.15 - lit * 0.1, x, y);
    else if (y < Y + 6 && noise1(x * 0.4, seed + 21) > 0.35 - (y - Y - 3) * 0.15) c = C.MOSS[2 + (lit < 0 ? 1 : 0)];   // la mousse qui coule
    else {
      let v = 0.5 - lit * 0.25 - d * 0.35 + (noise2(x * 0.25, y * 0.25, seed + 22) - 0.5) * 0.22;
      if (e < 2) v -= 0.2;
      if (Math.abs(fbm2(x * 0.06, y * 0.03, 2, seed + 23) - 0.5) < 0.03) { pix.set(x, y, C.BARK[2]); continue; }   // racines prises dans la terre
      if (worley(x, y, 9, seed + 24).d < 1.6 && ih(Math.floor(x / 9), Math.floor(y / 9), seed) < 0.25) { pix.set(x, y, C.PEBBLE[1]); continue; }
      c = pick(C.HUMUS, v + 0.35, x, y);
    }
    pix.set(x, y, c);
  }
  for (let x = X0 - 4; x < X1 + 4; x += 3) if (ih(x, 7, seed) < 0.6) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 8, seed) * 3), C.FERN, x);
  // les racines qui enserrent la motte : elles montent des piliers et la tiennent par les flancs, de plus
  // en plus fines (comme des doigts), quelques-unes en travers de la terre
  const grip = [
    [X0 + 8, bot - 6, X0 - 5, Y + 7, 6, 2, -5], [X0 + 20, bot - 2, X0 + 2, Y + 13, 4, 1, -3],
    [X1 - 12, bot - 6, X1 + 5, Y + 6, 7, 2, 5], [X1 - 26, bot - 2, X1 - 4, Y + 12, 4, 1, 3],
    [X0 + 40, bot + 2, X0 + 50, bot - 7, 3, 1, 2], [X1 - 44, bot + 2, X1 - 54, bot - 6, 3, 1, -2],
  ];
  for (const [i, [a0, b0, a1, b1, w0, w1, bend]] of grip.entries()) rootStroke(pix, a0, b0, a1, b1, w0, w1, bend, seed + 60 + i, 1);
  // le chevelu : des radicelles qui pendent sous la boule (plus longues aux bords, courtes au-dessus du passage)
  for (let x = X0 + 6; x < X1 - 6; x += 2 + Math.floor(ih(x, 4, seed) * 3)) {
    const edge = Math.min(x - X0, X1 - x) / (X1 - X0), d = Math.abs(x - mid) / half;
    const y0 = Math.round(bot + 8 - Math.max(0, d - 0.3) * 22);
    const len = Math.round(3 + ih(x, 5, seed) * 9 + Math.max(0, 0.2 - edge) * 60);
    for (let y = 0; y < len; y++) pix.set(x + Math.round(Math.sin(y * 0.3 + x) * 0.7), y0 + y, ih(x, y, seed) < 0.15 ? C.MOSS[3] : C.BARK[y > len - 3 ? 2 : 1]);
  }
}

/** L'arbre sacré de l'arche : un tronc trapu, la corde de paille (shimenawa) et ses papiers en zigzag, un houppier en touffes. */
function sacredTree(pix, cx, base, seed) {
  const fork = base - 58;
  L.bigTrunk(pix, cx, 22, base, seed, C.BARK, C.MOSS, { top: fork, roots: 1.4 });
  clumpCrown(pix, cx, fork, 92, seed, 13);
  // la corde sacrée : une grosse tresse de paille autour du tronc, deux glands, deux papiers en zigzag
  const ry = base - 26, ROPE = ['#7d6a3c', '#a88f52', '#cdb877', '#ead9a2'];
  for (let x = cx - 14; x <= cx + 14; x++) for (let j = 0; j < 5; j++) {
    const tw = ((x + j * 2) % 6 + 6) % 6;
    pix.set(x, ry + j + Math.round(Math.abs(x - cx) / 12), tw < 2 ? ROPE[3] : tw < 4 ? ROPE[2] : j === 4 ? ROPE[0] : ROPE[1]);
  }
  for (const tx of [cx - 8, cx + 7]) for (let y = 0; y < 7; y++) for (let k = -1; k <= 1; k++) if (Math.abs(k) <= y / 3) pix.set(tx + k, ry + 6 + y, y > 5 ? ROPE[0] : ROPE[2]);
  for (const sx of [cx - 3, cx + 12]) {
    let x = sx;
    for (let y = 0; y < 13; y++) {
      if (y % 3 === 0 && y) x += (Math.floor(y / 3) % 2 ? 2 : -2);
      pix.set(x, ry + 5 + y, '#f6f4ea'); pix.set(x + 1, ry + 5 + y, y % 3 === 2 ? '#c9c6b8' : '#ffffff');
    }
  }
}

/** Petit sanctuaire de pierre (hokora) : un socle, une niche de bois sombre, un toit de pierre moussu. */
function hokora(pix, cx, base) {
  const S = ['#1f2a33', '#2f3d49', '#445663', '#5c6f7b', '#7d9099', '#a3b3b6'];
  const block = (x0, y0, w, h, v0) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) pix.set(x, y, pick(S, v0 - (x - x0) / w * 0.35 - (y === y0 + h - 1 ? 0.2 : 0) + (y === y0 ? 0.15 : 0) + (noise2(x * 0.6, y * 0.6, 81) - 0.5) * 0.15, x, y)); };
  block(cx - 11, base - 5, 22, 5, 0.6);                 // le socle
  block(cx - 7, base - 18, 14, 13, 0.5);                // la niche
  for (let y = base - 15; y < base - 6; y++) for (let x = cx - 4; x <= cx + 3; x++) pix.set(x, y, y < base - 13 ? '#14100c' : '#211912');
  pix.set(cx - 1, base - 8, '#c0392b'); pix.set(cx, base - 8, '#e05a3a'); pix.set(cx - 1, base - 7, '#8e2a20');   // une offrande
  for (let y = 0; y < 8; y++) {                         // le toit : deux pans de pierre, mousse au faîte
    const w = 6 + y * 2;
    for (let x = cx - w; x <= cx + w - 1; x++) pix.set(x, base - 26 + y, y < 2 && Math.abs(x - cx) < 4 ? C.MOSS[4] : pick(S, (x < cx ? 0.7 : 0.4) - y * 0.03 + (noise2(x * 0.5, y, 82) - 0.5) * 0.15, x, y));
  }
  for (let x = cx - 14; x <= cx + 13; x++) pix.set(x, base - 18, S[0]);
}

/** La cabane du guetteur : plateforme, échelle de corde, cabane d'affût (part 'back' ou 'front'). */
function treehouse(pix, p, part) {
  const T = TILE, x0 = p.x0 * T, x1 = p.x1 * T, dY = p.deck * T, base = p.y * T;
  const WOOD = ['#2a1a10', '#3f2a1a', '#5a3d25', '#765233', '#946a43', '#b08655'];
  const ROPE = ['#5e5034', '#8c7f57', '#c2ae78', '#e2d29d'];
  const hx0 = p.hut * T + 2, hx1 = hx0 + 4 * T - 6, hTop = p.roof * T;          // la cabane (4 cases)
  const plank = (x, y, len, vertical, v0) => {
    for (let i = 0; i < len; i++) {
      const xx = vertical ? x : x + i, yy = vertical ? y + i : y;
      pix.set(xx, yy, pick(WOOD, v0 + (noise2(xx * 0.5, yy * 0.15, 61) - 0.5) * 0.25, xx, yy));
    }
  };
  if (part === 'back') {
    // l'échelle de corde : deux cordes et des barreaux, du bord de la plateforme jusqu'au sol
    const lx0 = p.ladder * T + 3, lx1 = lx0 + 2 * T - 7;
    for (const lx of [lx0, lx1]) for (let y = dY + 4; y < base - 1; y++) pix.set(lx + Math.round(Math.sin(y * 0.05) * 0.6), y, (y + lx) % 3 ? ROPE[1] : ROPE[2]);
    for (let y = dY + 16; y < base - 4; y += 16) {
      for (let x = lx0 + 1; x < lx1; x++) { pix.set(x, y, WOOD[4]); pix.set(x, y + 1, WOOD[1]); }
      pix.set(lx0, y, ROPE[3]); pix.set(lx1, y, ROPE[3]);
    }
    // sous la plateforme : deux jambes de force qui s'appuient sur le fût
    const cx = p.x * T + 8;
    for (const side of [-1, 1]) {
      const n = 34;
      for (let q = 0; q <= n; q++) { const x = cx + side * (16 + n - q), y = dY + 5 + q; pix.set(x, y, WOOD[3]); pix.set(x, y + 1, WOOD[2]); pix.set(x, y + 2, WOOD[1]); }
    }
    // la cabane : le mur du fond en planches verticales, une petite fenêtre ronde, l'ombre dedans
    for (let x = hx0; x <= hx1; x++) {
      const board = Math.floor((x - hx0) / 6);
      for (let y = hTop + 6; y < dY; y++) {
        const seam = (x - hx0) % 6 === 0;
        let v = 0.3 + (ih(board, 1, 62) - 0.5) * 0.18 + (noise2(x * 0.3, y * 0.08, 63) - 0.5) * 0.12 - (y - hTop) / 160;
        if (seam) v -= 0.25;
        const wx = (hx0 + hx1) / 2, wy = hTop + 20, dw = Math.hypot(x - wx, (y - wy) * 1.1);
        if (dw < 5) { pix.set(x, y, dw < 4 ? (y < wy ? '#8fc7c0' : '#5c9a96') : WOOD[1]); continue; }   // fenêtre : le ciel de l'autre côté
        pix.set(x, y, pick(WOOD, v, x, y));
      }
    }
    // une lanterne de papier pendue sous l'avant-toit
    const lx = hx0 - 6, ly = hTop + 10;
    for (let y = hTop + 2; y < ly; y++) pix.set(lx, y, ROPE[0]);
    for (let y = ly; y < ly + 9; y++) for (let x = lx - 3; x <= lx + 3; x++) if (Math.abs(x - lx) < 3 + (y > ly && y < ly + 8 ? 1 : 0) - (y === ly || y === ly + 8 ? 1 : 0)) pix.set(x, y, y === ly + 3 || y === ly + 6 ? '#c9822e' : x < lx ? '#ffe2a0' : '#f2b85a');
    return;
  }
  // devant : le plancher (planches posées en long), son chant éclairé, des clous
  for (let x = x0 - 2; x <= x1 + 1; x++) {
    const b = Math.floor((x - x0 + 40) / 23);
    for (let j = 0; j < 6; j++) {
      const y = dY + j + ((ih(b, 2, 64) < 0.3 && j === 0) ? 0 : 0);
      let v = j === 0 ? 0.92 : j === 1 ? 0.7 : 0.5 - j * 0.06;
      if ((x - x0 + 40) % 23 === 0 && j > 0) v -= 0.3;
      pix.set(x, y, pick(WOOD, v + (noise2(x * 0.4, j, 65) - 0.5) * 0.15, x, y));
    }
    if ((x - x0 + 40) % 23 === 3) pix.set(x, dY + 3, '#2a2a30');
    if (ih(x, 3, 66) < 0.25) pix.set(x, dY - 1, C.MOSS[ih(x, 4, 66) < 0.5 ? 4 : 5]);        // mousse sur le bord
  }
  // la balustrade : des poteaux et une corde, du côté opposé à l'échelle (le vide reste libre devant l'échelle)
  const posts = [x1 - 1, hx0 - 18];
  for (const px of posts) for (let y = dY - 14; y < dY; y++) { pix.set(px, y, WOOD[3]); pix.set(px + 1, y, WOOD[1]); }
  for (let x = posts[1]; x <= posts[0]; x++) { const y = dY - 12 + Math.round(Math.sin(((x - posts[1]) / (posts[0] - posts[1])) * Math.PI) * 2); pix.set(x, y, ROPE[2]); pix.set(x, y + 1, ROPE[0]); }
  // la cabane : deux poteaux d'angle et le toit d'écorce à deux pans, moussu (on le voit par l'avant ouvert)
  for (const px of [hx0 - 1, hx1 + 1]) for (let y = hTop + 4; y < dY; y++) { pix.set(px, y, WOOD[4]); pix.set(px + 1, y, WOOD[2]); }
  const rx0 = hx0 - 9, rx1 = hx1 + 9, ry = hTop + 6, peak = (rx0 + rx1) / 2;
  for (let x = rx0; x <= rx1; x++) {
    const d = Math.abs(x - peak) / ((rx1 - rx0) / 2), top = Math.round(ry - (1 - d) * 12);
    for (let y = top; y <= ry + 2; y++) {
      const shingle = Math.floor((y - top + (Math.floor((x - rx0) / 7) % 2) * 3) / 5);
      let v = 0.55 - d * 0.15 + (x < peak ? 0.12 : -0.12) - ((y - top) % 5 === 4 ? 0.3 : 0) + (ih(shingle, Math.floor(x / 7), 67) - 0.5) * 0.2;
      const moss = fbm2(x * 0.08, y * 0.2, 2, 68) > 0.58 && y < top + 4;
      pix.set(x, y, moss ? pick(C.MOSS, 0.4 + (1 - d) * 0.4, x, y) : pick(['#24150d', '#3a2416', '#55351f', '#7a5030', '#946a43'], v, x, y));
    }
    pix.set(x, ry + 3, '#1a0f09');                    // l'ombre sous l'avant-toit
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
    // le fond du creux commence sous le haut de la paroi gauche (la plus basse, par où l'on entre) :
    // il ne dépasse jamais du tronc
    const inTop = floorTop(level, p.x, p.top) + 14, end = (p.shaftBottom ?? p.y) * TILE, FADE = 120;
    for (let y = inTop - 12; y < end; y++) for (let x = X + 14; x < X + W - 14; x++) {
      // le haut du fond est la paroi d'en face, cassée : un rebord irrégulier d'écorce éclairée
      const y0 = inTop - 8 + Math.round((noise1(x * 0.22, 5) - 0.5) * 8 + (ih(x, 1, 6) < 0.25 ? 2 : 0));
      if (y < y0) continue;
      if (y < y0 + 2) { pix.set(x, y, y === y0 ? '#955636' : '#75402a'); continue; }
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

/**
 * La porte de la statue (zone 9) : le linteau sculpté au-dessus de la bouche du tunnel, dans la face
 * du pilier maçonné, avec deux yeux clos gravés (live.js les allume) ; un seuil de pierre au sol.
 * La dalle elle-même est dessinée par live.js (elle remonte).
 */
export const GATE = { lintel: { x: -8, w: 34, h: 16 }, eyes: [[3, -7], [15, -7]] };   // yeux gravés : relatifs au coin bas-gauche du linteau
function stoneGate(pix, X, Y) {
  const top = Y - 2 * TILE, L0 = X + GATE.lintel.x, W = GATE.lintel.w, H = GATE.lintel.h;
  // le linteau : un bloc massif, chanfreiné, qui déborde à gauche du pilier
  for (let y = top - H; y < top + 2; y++) for (let x = L0; x < L0 + W; x++) {
    const i = x - L0, j = y - (top - H);
    if ((i < 2 && j < 2 - i) || (i > W - 3 && j < i - (W - 3))) continue;                 // coins chanfreinés
    let v = 0.56 - (i / W) * 0.18 + (fbm2(x * 0.25, y * 0.25, 2, 141) - 0.5) * 0.14;
    if (j < 2) v += 0.2;                                                                      // le dessus éclairé
    if (j === 4 || j === H - 4) v -= 0.22;                                                    // les moulures
    if (j === 5 || j === H - 3) v += 0.1;
    if (j >= H) v = 0.12;                                                                      // l'ombre sous le linteau
    if (i === 0) v += 0.14;
    const moss = fbm2(x * 0.15, y * 0.2, 2, 143) + (j < 3 ? 0.3 : 0) > 0.8;
    pix.set(x, y, moss ? pick(C.MOSS, v + 0.1, x, y) : pick(C.RUIN, v, x, y, 0.2));
  }
  // les deux yeux clos gravés au milieu du linteau
  for (const [ex, ey] of GATE.eyes) for (let k = -2; k <= 2; k++) {
    const x = L0 + ex + 6 + k, y = top + ey + (Math.abs(k) === 2 ? -1 : 0);
    pix.set(x, y, C.RUIN[0]); pix.set(x, y - 1, C.RUIN[1]);
  }
  // le montant gauche de la porte : un pilastre, son chapiteau sous le linteau, son socle au sol
  for (let y = top; y < Y; y++) for (let x = X - 8; x < X; x++) {
    const i = x - (X - 8), cap = y < top + 3, base = y >= Y - 4;
    if (!cap && !base && (i === 0 || i === 7)) continue;
    let v = 0.6 - (i / 8) * 0.3 + (noise2(x * 0.4, y * 0.15, 145) - 0.5) * 0.1;
    if (cap || base) v += 0.1;
    if (y === top + 3 || y === Y - 5) v -= 0.25;
    if (i === 1) v += 0.12;
    if (i === 6) v -= 0.18;
    pix.set(x, y, pick(C.RUIN, v, x, y, 0.2));
  }
  // le seuil : une dalle usée devant la porte
  for (let x = X - 6; x < X + 18; x++) for (let j = 0; j < 3; j++) pix.set(x, Y - 1 + j, j === 0 ? C.RUIN[4] : C.RUIN[2]);
  // du lierre qui retombe du linteau, sur le côté
  L.strand(pix, L0 + 2, top - H + 2, 22, C.LEAF, 147, 0.7);
  L.strand(pix, L0 + 7, top - H + 3, 12, C.LEAF, 149, 0.6);
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
  // le coussin de mousse déborde du sommet et coule le long des flancs
  for (let x = X - 2; x < X + W + 2; x++) {
    const edge = Math.min(x - X, X + W - 1 - x);
    if (edge < 2 && ih(x, 9, seed) < 0.75) pix.set(x, Y, C.MOSS[3]);
    const drip = edge < 3 ? 3 + Math.floor(ih(x, 10, seed) * 9) : ih(x, 11, seed) < 0.15 ? 2 + Math.floor(ih(x, 12, seed) * 3) : 0;
    for (let k = 1; k <= drip; k++) pix.set(x, Y + k, k === drip ? C.MOSS[1] : k < 2 ? C.MOSS[4] : C.MOSS[2]);
  }
  for (let x = X + 2; x < X + W - 2; x += 3) if (ih(x, 1, seed) < 0.5) L.grassTuft(pix, x, Y - 1, 2 + Math.floor(ih(x, 2, seed) * 4), C.FERN, x);
  // des fougères aux coins, quelques fleurs, du lierre qui descend
  L.fern(pix, X + 4, Y, 8 + Math.floor(ih(seed, 13, 3) * 4), C.FERN, seed + 14);
  if (W > 60) L.fern(pix, X + W - 6, Y, 7, C.FERN, seed + 15);
  for (let k = 0; k < 4; k++) { const x = X + 6 + Math.floor(ih(k, 16, seed) * (W - 12)); pix.set(x, Y - 2, k % 2 ? '#f2c6d8' : '#fff1c2'); pix.set(x, Y - 1, C.FERN[3]); }
  L.strand(pix, X + 2, Y + 3, 14 + Math.floor(ih(seed, 17, 3) * 18), C.LEAF, seed + 18, 0.6);
  if (!ledge) L.strand(pix, X + W - 3, Y + 3, 10 + Math.floor(ih(seed, 19, 3) * 14), C.LEAF, seed + 20, 0.4);
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
  // la cime du cèdre, au-dessus de la fourche du belvédère (à 15 cases) : des étages qui se resserrent en pointe
  for (let k = 0; k < 6; k++) {
    const y = base - 262 - k * 24, half = 92 - k * 15;
    cedarTier(pix, cx - half, cx - 10, y, -1, 300 + k * 7);
    cedarTier(pix, cx + 10, cx + half, y, 1, 400 + k * 7);
  }
  L.fir(pix, cx, base - 380, 70, 22, [CEDAR[1], CEDAR[3], CEDAR[5]], 9);
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

/**
 * Les lianes balancier (zone 10) : de grands fûts montent du fond du ravin (derrière les piliers, et au
 * milieu des longues traversées) ; de chacun, une grosse branche part vers la liane la plus proche : elle
 * monte un peu en quittant le tronc, puis s'avance en s'effilant, et la liane y est nouée par quelques
 * tours. Sur les branches : mousse, touffes de feuilles, une fougère épiphyte, de la barbe de lichen qui
 * pend ; tout en haut, le feuillage des houppiers ferme l'image.
 */
function vineBough(pix, level, x0, x1, vb) {
  const bark = L.hazeRamp(C.BARK, '#123a40', 0.3), moss = L.hazeRamp(C.MOSS, '#123a40', 0.25), leaf = L.hazeRamp(C.LEAF, '#123a40', 0.22);
  const limbBark = L.hazeRamp(C.BARK, '#123a40', 0.12), limbMoss = L.hazeRamp(C.MOSS, '#123a40', 0.1), limbLeaf = L.hazeRamp(C.LEAF, '#123a40', 0.1);
  const BEARD = ['#5f7a66', '#7f9a82', '#a3b99c'];
  const H = level.height;
  const anchors = vb.map((p) => ({ x: Math.round(p.x * TILE), y: Math.round(p.y * TILE) }));
  // les fûts : derrière chaque pilier, au départ ; un de plus quand une liane serait trop loin d'un tronc
  const trunks = [x0 + 18];
  for (const q of level.props) if ((q.type === 'rock_pillar' || q.type === 'rock_ledge') && q.x * TILE > x0 && q.x * TILE < x1) trunks.push(q.x * TILE + (q.w * TILE) / 2);
  for (const a of anchors) if (Math.min(...trunks.map((t) => Math.abs(t - a.x))) > 8 * TILE) trunks.push(a.x + 3 * TILE);
  trunks.sort((a, b) => a - b);
  const top = Math.min(...anchors.map((a) => a.y)) - 130;
  // aucun arbre pareil : largeur, branches de décor, houppier, lierre, tout est tiré pour chacun
  const tw = (k) => 18 + Math.floor(ih(k, 1, 91) * 16);
  const limbYs = anchors.map((a) => a.y), aTop = Math.min(...limbYs);
  for (const [k, cx] of trunks.entries()) {
    const w = tw(k), sd = 700 + k * 31;
    L.bigTrunk(pix, cx, w, H, 100 + k, bark, moss, { top, roots: 0 });
    // du lierre qui grimpe le long du fût
    for (let q = 0; q < 1 + Math.floor(ih(k, 2, sd) * 3); q++) {
      const lx = cx + Math.round((ih(k, 3 + q, sd) - 0.5) * w * 0.7), ly = top + 60 + Math.floor(ih(k, 6 + q, sd) * 90);
      L.strand(pix, lx, ly, 18 + Math.floor(ih(k, 9 + q, sd) * 40), leaf, sd + q, 0.5);
    }
    // des branches de décor (on ne s'y accroche pas) : plus ou moins hautes, d'un côté ou de l'autre,
    // qui montent en biais ; certaines cassées ; un bouquet de feuilles au bout des autres
    const nb = 3 + Math.floor(ih(k, 12, sd) * 4);
    for (let q = 0; q < nb; q++) {
      const side = ih(k, 13 + q, sd) < 0.5 ? -1 : 1;
      const y0 = aTop - 44 + Math.floor(ih(k, 20 + q, sd) * 170);
      if (limbYs.some((ly) => Math.abs(ly - 6 - y0) < 22)) continue;          // pas sur une branche à liane
      const len = 18 + Math.floor(ih(k, 27 + q, sd) * 42), rise = 6 + Math.floor(ih(k, 34 + q, sd) * 34);
      const bx0 = cx + side * (w / 2 - 2), bx1 = bx0 + side * len, by1 = y0 - rise;
      const broken = ih(k, 41 + q, sd) < 0.2;
      rootStroke(pix, bx0, y0, broken ? bx0 + side * len * 0.4 : bx1, broken ? y0 - rise * 0.4 : by1, 5 + Math.floor(ih(k, 48 + q, sd) * 4), broken ? 3 : 1.2, side * (ih(k, 55 + q, sd) - 0.3) * 6, sd + q);
      if (broken) continue;
      // un rameau qui part du milieu, et le feuillage
      const mx = bx0 + side * len * 0.55, my = y0 - rise * 0.55;
      rootStroke(pix, mx, my, mx + side * (6 + ih(k, 62 + q, sd) * 10), my - 8 - ih(k, 69 + q, sd) * 10, 2, 1, 0, sd + q + 9);
      const nl = 2 + Math.floor(ih(k, 76 + q, sd) * 3);
      for (let f = 0; f < nl; f++) L.bush(pix, Math.round(bx1 - side * f * 10 + (ih(f, q, sd) - 0.5) * 8), Math.round(by1 + 5 + f * 2 - ih(f, q + 3, sd) * 6), 10 + Math.floor(ih(f, q + 5, sd) * 11), 8 + Math.floor(ih(f, q + 7, sd) * 7), f % 2 ? leaf : limbLeaf, sd + q * 7 + f);
      L.bush(pix, Math.round(mx + side * 10), Math.round(my - 10), 7 + Math.floor(ih(k, 83 + q, sd) * 5), 6, leaf, sd + q * 5 + 40);
    }
  }
  // les houppiers : de grosses masses de feuillage au sommet de chaque fût, qui descendent dans l'image
  // (peintes avant les branches à liane, qui passent devant), et des brins qui en pendent
  for (const [k, cx] of trunks.entries()) {
    const sd = 900 + k * 37, n2 = 10 + Math.floor(ih(k, 1, sd) * 7), spread = 50 + ih(k, 2, sd) * 40, lean = (ih(k, 3, sd) - 0.5) * 40;
    for (let q = 0; q < n2; q++) {
      const u = q / (n2 - 1) - 0.5;
      const bx = cx + lean * (0.5 - Math.abs(u)) + u * 2 * spread + (ih(q, 4, sd) - 0.5) * 18;
      const base = aTop - 14 - Math.abs(u) * 12 - ih(q, 5, sd) * 40 + (ih(k, 6, sd) - 0.5) * 16;
      if (anchors.some((a) => Math.abs(a.x - bx) < 22 && base > a.y - 26)) continue;   // jamais devant le nœud d'une liane
      L.bush(pix, Math.round(bx), Math.round(base), 14 + Math.floor(ih(q, 7, sd) * 16), 14 + Math.floor(ih(q, 8, sd) * 12), q % 3 ? leaf : limbLeaf, sd + q);
    }
    for (let q = 0; q < 3 + Math.floor(ih(k, 9, sd) * 4); q++) {
      const hx = cx + Math.round((ih(q, 10, sd) - 0.5) * spread * 2);
      L.strand(pix, hx, aTop - 26 + Math.floor(ih(q, 11, sd) * 10), 10 + Math.floor(ih(q, 12, sd) * 26), limbLeaf, sd + q * 3, 0.6);
    }
  }
  // les branches, une par liane
  for (const [n, a] of anchors.entries()) {
    let k = 0; for (let q = 1; q < trunks.length; q++) if (Math.abs(trunks[q] - a.x) < Math.abs(trunks[k] - a.x)) k = q;
    const t = trunks[k], dir = a.x >= t ? 1 : -1, seed = 300 + n * 17;
    const xs = t + dir * (tw(k) / 2 - 3), xe = a.x + dir * (22 + Math.floor(ih(n, 1, seed) * 12));
    const span = Math.abs(xe - xs), ua = Math.abs(a.x - xs) / span;
    // chaque branche a sa forme : un coude (elle part haut du tronc), presque à plat, ou bien elle part plus
    // bas et monte en biais vers la liane ; plus ou moins arquée, plus ou moins tombante au bout
    const kind = ih(n, 20, seed), dy0 = kind < 0.4 ? -16 - ih(n, 21, seed) * 14 : kind < 0.65 ? -4 + ih(n, 22, seed) * 6 : 12 + ih(n, 23, seed) * 14;
    const pw = 1.1 + ih(n, 24, seed) * 1.2, sag = ih(n, 25, seed) * 7, droop = ih(n, 26, seed) * 7;
    const base = (u) => dy0 * Math.pow(1 - u, pw) - Math.sin(Math.PI * u) * sag + u * u * droop;
    const yAt = (u) => a.y - 5 + base(u) - base(ua) + (noise1(u * 4, seed) - 0.5) * 2;
    const th0 = 13 + ih(n, 27, seed) * 6, thAt = (u) => Math.max(3.5, th0 - u * (th0 - 4) + (noise1(u * 9, seed + 7) - 0.5) * 2.5);
    for (let i = 0; i <= span; i++) {
      const u = i / span, x = xs + dir * i, yc = yAt(u), th = thAt(u);
      const y0 = Math.round(yc - th / 2), y1 = Math.round(yc + th / 2);
      for (let y = y0; y <= y1; y++) {
        const k2 = (y - y0) / Math.max(1, y1 - y0);
        let v = 0.82 - k2 * 0.72 + (noise2(x * 0.35, y * 0.5, seed) - 0.5) * 0.18;
        if (Math.abs(noise2(x * 0.05, y * 0.6, seed + 2) - 0.5) < 0.04) v -= 0.25;              // sillons de l'écorce
        const mossTop = y - y0 <= 1 + (fbm2(x * 0.08, 1, 2, seed + 3) > 0.55 ? 1 : 0);
        pix.set(x, y, mossTop ? (y === y0 ? limbMoss[5] : limbMoss[3]) : pick(limbBark, v, x, y));
      }
      if (ih(x, 2, seed) < 0.05 && u > 0.15) L.grassTuft(pix, x, y0, 2 + Math.floor(ih(x, 3, seed) * 3), C.FERN, x);
    }
    // un rameau secondaire qui part vers le haut et vers l'avant, coiffé de feuilles
    {
      const u0 = 0.32 + ih(n, 8, seed) * 0.18, bx = xs + dir * u0 * span, by = yAt(u0) - thAt(u0) / 2 + 1;
      const tx2 = bx + dir * (12 + ih(n, 9, seed) * 10), ty2 = by - 14 - ih(n, 10, seed) * 8;
      rootStroke(pix, bx, by, tx2, ty2, 3.5, 1.2, dir * 2, seed + 11);
      L.bush(pix, Math.round(tx2), Math.round(ty2 + 3), 8, 7, limbLeaf, seed + 12);
    }
    // des loupes sous la branche
    for (let q = 0; q < 2; q++) {
      const u = 0.2 + q * 0.35 + ih(n, 13 + q, seed) * 0.1, x = Math.round(xs + dir * u * span), y = Math.round(yAt(u) + thAt(u) / 2);
      for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy < 3 - Math.abs(dx) / 1.5; dy++) pix.set(x + dx, y + dy, pick(limbBark, 0.35 - dy * 0.1 - dx * 0.03, x + dx, y + dy));
    }
    // le collet contre le tronc
    for (let j = -10; j <= 8; j++) for (let q = 0; q < 5 - Math.abs(j) / 3; q++) pix.set(xs - dir * q, Math.round(yAt(0) + j), pick(limbBark, 0.5 - j * 0.02, xs, j));
    // la liane nouée : trois tours de tige verte autour de la branche, un nœud dessous
    const yk = yAt(ua), thk = thAt(ua);
    for (let r = 0; r < 3; r++) for (let j = -Math.ceil(thk / 2) - 1; j <= Math.ceil(thk / 2); j++) {
      const x = a.x - 3 + r * 3 + Math.round((j + thk / 2) * 0.35);
      pix.set(x, Math.round(yk + j), j < -thk / 2 + 1 ? limbLeaf[5] : limbLeaf[2]);
    }
    for (const [dx, dy, c] of [[-1, 0, 1], [0, 0, 3], [1, 0, 2], [0, 1, 1]]) pix.set(a.x + dx, a.y - 1 + dy, limbLeaf[c]);
    // des touffes de feuilles sur la branche (pas au-dessus de la liane), au bout, et une fougère épiphyte
    for (const u of [0.1, 0.18 + ih(n, 4, seed) * 0.15, 0.4, 0.55, 0.72, 1].filter((u, q) => q % 2 === 1 || ih(n, 30 + q, seed) < 0.6)) {
      if (Math.abs(u - ua) < 0.12) continue;
      const x = xs + dir * u * span, y = yAt(u) - thAt(u) / 2 + 2;
      L.bush(pix, Math.round(x), Math.round(y), 9 + Math.floor(ih(n, u * 10, seed) * 6), 7 + Math.floor(ih(n, u * 9, seed) * 4), limbLeaf, seed + Math.round(u * 50));
    }
    L.fern(pix, Math.round(xs + dir * span * 0.38), Math.round(yAt(0.38) - thAt(0.38) / 2), 9, C.FERN, seed + 5);
    // des brins feuillus qui pendent de la branche (pas devant la liane)
    for (let q = 0; q < 2 + Math.floor(ih(n, 40, seed) * 3); q++) {
      const u = 0.12 + ih(n, 41 + q, seed) * 0.8, x = Math.round(xs + dir * u * span);
      if (Math.abs(x - a.x) < 10) continue;
      L.strand(pix, x, Math.round(yAt(u) + thAt(u) / 2) - 1, 8 + Math.floor(ih(n, 46 + q, seed) * 18), limbLeaf, seed + q, 0.7);
    }
    // la barbe de lichen : des fils pâles qui pendent sous la branche
    for (let i = 4; i < span - 4; i += 3) {
      if (ih(i, 6, seed) > 0.32) continue;
      const u = i / span, x = xs + dir * i, y = Math.round(yAt(u) + thAt(u) / 2), len = 4 + Math.floor(ih(i, 7, seed) * 14);
      if (Math.abs(x - a.x) < 5) continue;
      for (let s2 = 0; s2 < len; s2++) pix.set(x + Math.round(Math.sin(s2 * 0.4 + i) * 0.7), y + s2, BEARD[s2 < len * 0.3 ? 0 : s2 < len * 0.75 ? 1 : 2]);
    }
  }
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
