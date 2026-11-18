// Mode combat — l'arène de la Forêt : « La clairière de la statue ».
// Deux fois la largeur de l'image, comme celle du Potager. Une clairière de la lisière,
// au matin doré, fermée de chaque côté par un grand fût moussu (sauts muraux). Au
// fond, en parallaxe : la grande chaîne, le temple d'où l'on vient, et la statue
// oubliée, colossale, à demi enfouie dans la brume (décor seul, aucun mécanisme).
//
// Au centre, l'ancien bassin du sanctuaire, bordé de pierres taillées. Son niveau
// monte et descend lentement (la source respire, voir arena.js, ARENA.basin) :
//   - eau basse : trois pas japonais émergent (deux rochers et le tronc flottant) ;
//   - eau haute : les rochers sont noyés (mortels) ; on traverse par le haut (des
//     grandes branches, on se lance sur les lianes de la voûte) ou par le tronc
//     flottant (il s'enfonce sous le poids), d'un saut et d'un dash.
// À gauche, la vieille forêt dense (fougères, champignons, un tronc couché sur deux
// rochers : on passe dessous en glissade). À droite, la coupe des bûcherons : des
// souches de toutes les hauteurs, une pile de bûches, une passerelle de planches
// vermoulues posée entre deux hautes souches (elle cède sous le pied, puis se refait).
// Trois étages, comme au Potager : le sol et les souches (1 à 4 cases), les
// branches basses (5 cases), les grandes branches (8 cases).
// Mécanismes : src/game/arena/arena.js (bassin), foret/mechanics.js (lianes, tronc,
// planches) ; dessin : arena/art_foret.js ; guide : docs/ARENES.md § 7.

import { Builder } from './builder.js';

const H = 22;          // hauteur de la carte (cases)
const G = 18;          // ligne du haut du sol
const TILE = 16;
const L = 4, R = 64;   // les deux grands fûts qui ferment l'arène (deux colonnes chacun)
const C0 = 28, CW = 14; // le bassin (colonnes 28 à 41)
export const ARENA_W = R + 6;   // largeur de la carte
// le bassin : rochers des pas japonais (colonnes), chenal du tronc flottant au milieu
const STONES = [[30, 2], [38, 2]];
const BED = G + 3;     // le fond du bassin

function build() {
  const b = new Builder(H, G);
  const F = { oasis: null, galleries: null, snaps: [], spans: [], crumbles: [], logs: [], vines: [], lamps: [], slopes: [], hollows: [], bridges: [], glows: [], statue: null, collapse: null, slide: null, dark: null };
  b.zone('A2', 'La clairière de la statue');
  b.zones[0].mood = 'matin';
  b.zones[0].bgRow = G;              // le fond de la forêt est posé sur le sol de l'arène
  // le sol, le bassin, le sol
  b.flat(C0);
  for (let i = 0; i < CW; i++) {
    const c = new Array(H).fill('.');
    for (let y = G; y < BED; y++) c[y] = '~';
    for (let y = BED; y < H; y++) c[y] = '#';
    b.cols.push(c);
  }
  b.flat(ARENA_W - C0 - CW);
  // les bords du bassin : de vieilles pierres taillées (le bassin d'un ancien sanctuaire)
  b.block(C0 - 1, 1, G, H - 1, '=');
  b.block(C0 + CW, 1, G, H - 1, '=');
  // les deux rochers des pas japonais : leur dessus à une case sous le bord ; noyés quand l'eau monte
  for (const [x, w] of STONES) {
    b.block(x, w, G + 1, H - 1, '#');
    b.prop('rock_pillar', x, G + 1, { w });
  }
  // les grands fûts qui ferment l'arène : on y grimpe en sauts muraux, on n'en sort pas
  b.block(L, 2, 0, G - 1, '|');
  b.block(R, 2, 0, G - 1, '|');
  // un plafond invisible, haut au-dessus des grandes branches : on ne passe jamais par-dessus les fûts
  b.row(L + 2, R - L - 2, G - 15, '%');

  // ---- à gauche : la vieille forêt ----------------------------------------------
  // une souche moyenne (2 cases)
  b.block(8, 2, G - 2, G - 1); b.prop('stump', 8, G - 2, { w: 2 });
  // le tronc couché sur deux rochers : on monte dessus (3 cases), on passe dessous en glissade
  b.block(12, 6, G - 3, G - 2);
  b.prop('fallen_log', 12, G - 1, { w: 6 });
  // une souche basse, au pied de l'arbre
  b.block(19, 1, G - 1, G - 1); b.prop('stump', 19, G - 1, { w: 1 });
  // le vieux chêne : une branche basse en travers du fût (5 cases), une grande branche au-dessus du bassin (8 cases)
  b.prop('canopy_trunk', 23, G, { w: 24, seed: 61 });
  b.row(17, 9, G - 5, '-');
  b.row(21, 11, G - 8, '-');
  b.prop('mushrooms', 6, G, { w: 2 }); b.prop('mushrooms', 20, G, { w: 2 });
  // la vieille forêt est dense : des fourrés au pied des arbres, et devant, contre le grand fût
  b.prop('thicket', 6, G, { w: 2 }); b.prop('thicket', 20, G, { w: 2 });
  b.prop('thicket', 6, G, { w: 1, front: true });
  b.prop('hokora', 25, G);

  // ---- à droite : la coupe des bûcherons ------------------------------------------
  // le rocher de la source : l'eau en coule dans le bassin (elle grossit quand le niveau monte)
  b.block(43, 2, G - 2, G - 1); b.prop('boulder', 43, G - 2, { w: 2, wet: true });
  // le grand cèdre : une branche basse (5 cases), une grande branche au-dessus du bassin (8 cases)
  b.prop('canopy_trunk', 46, G, { w: 26, seed: 83 });
  b.row(44, 8, G - 5, '-');
  b.row(38, 11, G - 8, '-');
  // une pile de bûches (2 cases)
  b.block(48, 3, G - 2, G - 1); b.prop('log_pile', 48, G - 2, { w: 3 });
  // deux hautes souches (4 cases) ; entre elles, la passerelle de planches vermoulues
  b.block(53, 2, G - 4, G - 1); b.prop('stump', 53, G - 4, { w: 2, tall: true });
  b.block(59, 2, G - 4, G - 1); b.prop('stump', 59, G - 4, { w: 2, tall: true });
  F.crumbles.push({ x: 55 * TILE - 2, y: (G - 4) * TILE, w: 2 * TILE + 2 }, { x: 57 * TILE, y: (G - 4) * TILE, w: 2 * TILE + 2 });
  b.prop('log_cut', 55, G, { n: 3 });
  // l'arbre sacré, épargné par les bûcherons : sa corde de paille, ses papiers blancs
  b.propBack('sacred_tree', 57, G, { seed: 47 });
  // une souche basse contre le fût
  b.block(62, 1, G - 1, G - 1); b.prop('stump', 62, G - 1, { w: 1 });

  // ---- le bassin : le tronc flottant, les lianes ----------------------------------
  // le tronc dérive dans le chenal, entre les deux rochers ; son dessus suit le niveau de l'eau (arena.js)
  F.logs.push({ x0: 32 * TILE + 3, x1: 35 * TILE - 3, y: G * TILE + 3 - 8, w: 3 * TILE, d: 13, speed: 9, start: 0.3 });
  // la voûte : deux branches hautes des grands arbres se rejoignent au-dessus du bassin ; deux lianes y
  // pendent, juste au-delà du bout des grandes branches. Leur bas reste hors de portée d'un saut depuis le
  // sol (on ne les attrape pas en sautant vers un rocher) : on s'y lance depuis le bout d'une grande
  // branche, on se balance au-dessus du bassin, on lâche vers l'autre branche (ou sur le tronc flottant)
  const AY = G - 11;
  b.prop('vine_arch', 23, AY, { x1: 46, meet0: 33, meet1: 37 });
  F.vines.push({ ax: 32.5 * TILE, ay: AY * TILE + 6, len: 5.1 * TILE, swing: 0.14, phase: 0 });
  F.vines.push({ ax: 37.5 * TILE, ay: AY * TILE + 10, len: 4.85 * TILE, swing: 0.14, phase: Math.PI });

  // ---- les arbres du décor (derrière) ------------------------------------------------
  b.propBack('birch', 7, G, { s: 1.15 });
  b.propBack('pine_young', 15, G);
  b.propBack('birch', 27, G, { s: 0.9 });
  b.propBack('birch', 51, G, { s: 1.05 });
  b.propBack('pine_young', 57, G);
  b.propBack('birch', 61, G, { s: 0.8 });

  b.zones[0].x1 = b.x;
  const px = (c) => c * TILE + TILE / 2;
  return {
    b, F,
    arena: {
      center: (C0 + CW / 2) * TILE, ground: G * TILE, walls: [L, R + 1],
      camGround: 0.8,                  // le sol à 80 % de l'image : on voit le bassin, ses rochers et le fond
      spawns: [
        { x: px(6), y: G * TILE }, { x: px(61), y: G * TILE },
        { x: px(24), y: (G - 8) * TILE }, { x: px(45), y: (G - 8) * TILE },
      ],
      scaffolds: [],
      // le bassin : colonnes, rochers, rangées de l'eau (de la plus haute à la plus basse), fond
      basin: { x0: C0, x1: C0 + CW, stones: STONES, top: G, bed: BED, spring: { x: 43 * TILE, y: (G - 1) * TILE } },
      hay: [],
      crates: [],
      // les cœurs : sur le tronc couché, sur la passerelle vermoulue, sur les grandes branches
      hearts: [{ x: 15 * TILE, y: (G - 3) * TILE }, { x: 57 * TILE, y: (G - 4) * TILE }, { x: px(26), y: (G - 8) * TILE }, { x: px(42), y: (G - 8) * TILE }],
      bundles: [],
    },
  };
}

const { b: B, F, arena } = build();
export const ARENE_FORET = {
  name: 'Arène — La clairière de la statue',
  map: B.rows(),
  zones: B.zones,
  props: B.props,
  hints: [],
  backdrops: B.backdrops,
  cranes: [],
  theme: 'foret',
  forest: F,
  arena,
  // la musique de la Forêt
  music: { src: './music/foret.mp3', loopStart: 12.28, loopEnd: 152.27 },
};
