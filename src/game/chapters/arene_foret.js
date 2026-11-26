// Mode combat — l'arène de la Forêt : « La clairière de la statue ».
// Deux fois la largeur de l'image, comme celle du Potager. Une clairière de la lisière,
// au matin doré, fermée de chaque côté par un grand fût moussu (sauts muraux). Au
// fond, en parallaxe : la grande chaîne, le temple d'où l'on vient, et la statue
// oubliée, colossale, à demi enfouie dans la brume (décor seul, aucun mécanisme).
//
// Au centre, l'ancien bassin du sanctuaire, bordé de pierres taillées. Son niveau
// monte et descend (la source respire, voir arena.js, ARENA.basin) :
//   - eau basse : trois pas japonais émergent (deux rochers et le tronc flottant) ;
//   - eau haute : les rochers sont noyés (mortels), le tronc file plus vite et coule
//     plus vite ; on traverse par le haut ou par les lianes.
// À gauche, la vieille forêt dense : un tronc mort creux, en miniature de celui du
// chapitre (on y entre par le haut, de nœud en nœud), descend dans une petite grotte
// aux champignons lumineux (les galeries du chapitre, en petit) ; on en ressort par un
// puits de racines, sous le vieux chêne.
// À droite, la coupe des bûcherons : le rocher de la source, une souche, une haute
// souche, l'arbre sacré épargné, et un tronc de remontée (branches en quinconce).
// En haut, comme la canopée suspendue du chapitre : la voûte des deux grands arbres
// (on passe par-dessus le bassin), un perchoir feuillu sur le chêne, une branche haute
// sur le cèdre, et un petit pont suspendu du cèdre au tronc de remontée.
// Mécanismes : src/game/arena/arena.js (bassin), foret/mechanics.js (lianes, tronc,
// pont) ; dessin : arena/art_foret.js ; guide : docs/ARENES.md § 7.

import { Builder } from './builder.js';

const H = 28;          // hauteur de la carte (cases) : sous le sol, la petite grotte
const G = 18;          // ligne du haut du sol
const TILE = 16;
const L = 4, R = 64;   // les deux grands fûts qui ferment l'arène (deux colonnes chacun)
const C0 = 28, CW = 14; // le bassin (colonnes 28 à 41)
export const ARENA_W = R + 6;   // largeur de la carte
// le bassin : rochers des pas japonais (colonnes), chenal du tronc flottant au milieu
const STONES = [[30, 2], [38, 2]];
const BED = G + 3;     // le fond du bassin
const CAVE = { x0: 8, x1: 23, top: G + 3, floor: G + 8 };   // la petite grotte, sous la vieille forêt
const CANOPY = G - 14; // la canopée : perchoir du chêne, branche haute du cèdre, pont suspendu

function build() {
  const b = new Builder(H, G);
  const F = { oasis: null, galleries: null, snaps: [], spans: [], crumbles: [], logs: [], vines: [], lamps: [], slopes: [], hollows: [], bridges: [], glows: [], statue: null, collapse: null, slide: null, dark: null };
  b.zone('A2', 'La clairière de la statue');
  b.zones[0].mood = 'matin';
  b.zones[0].bgRow = G;              // le fond de la forêt est posé sur le sol de l'arène
  const fill = (x0, n, y0, y1, ch = '#') => { for (let i = 0; i < n; i++) for (let y = y0; y <= y1; y++) b.cols[x0 + i][y] = ch; };
  const carve = (x0, n, y0, y1) => fill(x0, n, y0, y1, '.');
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
  // un plafond invisible, tout en haut : on ne passe jamais par-dessus les fûts
  b.row(L + 2, R - L - 2, 0, '%');

  // ---- à gauche : la vieille forêt ----------------------------------------------
  // le tronc mort creux (la miniature de celui de la canopée) : cassé à 3 cases, ses deux parois à la même
  // hauteur (demande de Raph). Dedans, des nœuds du bois en quinconce, tous les 3 cases : on descend de
  // palier en palier jusqu'à la grotte, on y remonte de même
  fill(9, 1, G - 3, G - 1, '|'); fill(12, 1, G - 3, G - 1, '|');
  b.prop('hollow_giant', 9, G, { w: 4, top: G - 3, chicot: 6 });
  carve(10, 2, G, G + 2);
  b.set(10, G - 1, '-'); b.set(11, G + 2, '-'); b.set(10, G + 5, '-');
  // la petite grotte : une salle basse (5 cases), une voûte plus haute au milieu, une butte près du puits
  carve(CAVE.x0, CAVE.x1 - CAVE.x0, CAVE.top, CAVE.floor - 1);
  carve(14, 4, G + 2, G + 2);
  fill(17, 2, G + 7, G + 7);
  // le puits de racines, sous le vieux chêne : on remonte par deux racines ; en haut, un lacis de racines
  // ferme le trou (on marche dessus, on le traverse par-dessous)
  carve(21, 2, G, G + 2);
  b.row(21, 2, G, '-'); b.set(21, G + 2, '-'); b.set(22, G + 5, '-');
  b.prop('root_well', 21, G, { w: 2, bottom: CAVE.floor });
  // la vie de la grotte : de grands champignons qui luisent, des petits, un arbre à perles
  b.prop('cave_mushroom', 8, CAVE.floor, { h: 30, violet: false });
  b.prop('cave_mushroom', 19, CAVE.floor - 1, { h: 22, violet: true });
  b.prop('cave_mushroom', 15, CAVE.floor, { h: 18, violet: false, small: true });
  b.prop('mushrooms', 12, CAVE.floor, { w: 2 }); b.prop('mushrooms', 20, CAVE.floor, { w: 1 });
  b.prop('pearl_tree', 14, CAVE.floor, { s: 1 });
  F.galleries = {
    x0: (CAVE.x0 - 2) * TILE, x1: (CAVE.x1 + 2) * TILE, y0: (G + 1) * TILE, y1: (CAVE.floor + 1) * TILE, under: (CAVE.x0 - 2) * TILE,   // (les parois de la grotte : terre du souterrain)
    beam: { x: 10 * TILE + 12, y: (G - 3) * TILE, floor: CAVE.floor * TILE },     // le jour tombe du haut du tronc creux
    curtains: [[13, G + 3, 0.7], [16, G + 2, 0.5], [20, G + 3, 0.6]],
    shade: 1.9,                                                                  // plus sombre que les galeries du chapitre : les champignons luisent
  };
  // une souche (2 cases), entre le tronc creux et le chêne (le tronc couché a été retiré : il cachait le tronc creux)
  b.block(15, 2, G - 2, G - 1); b.prop('stump', 15, G - 2, { w: 2 });
  // le vieux chêne : branche basse (5 cases, jusqu'au-dessus du tronc creux), grande branche (8 cases),
  // perchoir de la canopée (14 cases)
  b.prop('canopy_trunk', 23, G, { w: 24, seed: 61 });
  b.row(14, 12, G - 5, '-');
  b.row(21, 11, G - 8, '-');
  b.row(19, 7, CANOPY, '-');
  // la vieille forêt est dense : des fourrés, des champignons, un petit sanctuaire au bord du bassin
  b.prop('mushrooms', 6, G, { w: 2 }); b.prop('mushrooms', 26, G, { w: 1 });
  b.prop('thicket', 6, G, { w: 2 }); b.prop('thicket', 20, G, { w: 1 });
  b.prop('thicket', 6, G, { w: 1, front: true });
  b.prop('hokora', 25, G);

  // ---- à droite : la coupe des bûcherons ------------------------------------------
  // le rocher de la source : l'eau en coule dans le bassin (elle grossit quand le niveau monte)
  b.block(43, 2, G - 2, G - 1); b.prop('boulder', 43, G - 2, { w: 2, wet: true });
  // le grand cèdre : branche basse (5 cases), grande branche (8 cases), branche haute de la canopée
  // (14 cases), d'où part le pont suspendu
  b.prop('canopy_trunk', 46, G, { w: 26, seed: 83 });
  b.row(44, 8, G - 5, '-');
  b.row(38, 11, G - 8, '-');
  b.row(41, 6, CANOPY, '-');
  // une souche (2 cases), puis une haute souche (4 cases)
  b.block(49, 2, G - 2, G - 1); b.prop('stump', 49, G - 2, { w: 2 });
  b.block(53, 2, G - 4, G - 1); b.prop('stump', 53, G - 4, { w: 2, tall: true });
  // l'arbre sacré, épargné par les bûcherons : sa corde de paille, ses papiers blancs
  b.propBack('sacred_tree', 56, G, { seed: 47 });
  // le tronc de remontée : des branches en quinconce, toutes les deux cases, jusque sous le pont
  // (son fût monte jusqu'au-dessus du pont : le pont s'accroche juste sous son feuillage)
  b.prop('climb_trunk', 60, G, { top: CANOPY - 1 });
  for (let row = G - 2, k = 0; row >= CANOPY + 2; row -= 2, k++) b.row(60 + (k % 2 ? 1 : -2), 2, row, '-');
  // le pont suspendu, du cèdre au tronc de remontée : de vieilles planches entre deux cordes ; il ploie
  // et oscille quand on y saute (ici, aucune planche ne lâche : l'arène reste la même d'un combat à l'autre)
  F.bridges.push({ x0: 46 * TILE + 8 + 13, x1: 60 * TILE + 8 - 11, y: CANOPY * TILE, sag: 10, rotten: [] });

  // ---- le bassin : le tronc flottant, les lianes ----------------------------------
  // le tronc dérive dans le chenal, entre les deux rochers ; son dessus suit le niveau de l'eau (arena.js) ;
  // eau haute, il file plus vite et s'enfonce plus vite sous le poids
  F.logs.push({ x0: 32 * TILE + 3, x1: 35 * TILE - 3, y: G * TILE + 3 - 8, w: 3 * TILE, d: 13, speed: 9, start: 0.3 });
  // la voûte : deux branches hautes des grands arbres se rejoignent au-dessus du bassin ; on marche dessus
  // (on passe d'un arbre à l'autre par le haut). Deux lianes y pendent, juste au-delà du bout des grandes
  // branches. Leur bas reste hors de portée d'un saut depuis le sol ou depuis un rocher ; on les attrape
  // depuis le bout d'une grande branche, ou en sautant du tronc flottant (une échappée quand l'eau est haute)
  const AY = G - 11;
  b.row(24, 22, AY, '-');
  b.prop('vine_arch', 23, AY, { x1: 46, meet0: 33, meet1: 37 });
  F.vines.push({ ax: 32.5 * TILE, ay: AY * TILE + 6, len: 6.3 * TILE, swing: 0.16, phase: 0 });
  F.vines.push({ ax: 37.5 * TILE, ay: AY * TILE + 8, len: 6.15 * TILE, swing: 0.16, phase: Math.PI });

  // ---- les arbres du décor (derrière) ------------------------------------------------
  b.propBack('birch', 7, G, { s: 1.15 });
  b.propBack('pine_young', 16, G);
  b.propBack('birch', 27, G, { s: 0.9 });
  b.propBack('birch', 51, G, { s: 1.05 });
  b.propBack('birch', 63, G, { s: 0.8 });

  b.zones[0].x1 = b.x;
  const px = (c) => c * TILE + TILE / 2;
  return {
    b, F,
    arena: {
      center: (C0 + CW / 2) * TILE, ground: G * TILE, walls: [L, R + 1],
      camGround: 0.8,                  // le sol à 80 % de l'image : on voit le bassin, ses rochers et le fond
      camTop: CANOPY - G,              // l'étage le plus haut (en cases, compté depuis le sol : -14) : la canopée
      camHigh: 11,                     // sur téléphone, le palier « en haut » montre jusqu'à la voûte (11 cases)
      // la grotte : quand KAGE y est, la caméra descend (son sol en bas de l'image)
      cave: { x0: CAVE.x0 * TILE, x1: CAVE.x1 * TILE, y: (G + 2) * TILE, floor: CAVE.floor * TILE },
      // le duel (deux combattants) : face à face, assez près pour tenir ensemble dans l'image à l'ouverture
      duelSpawns: [{ x: px(24), y: G * TILE }, { x: px(47), y: G * TILE }],
      spawns: [
        { x: px(7), y: G * TILE }, { x: px(62), y: G * TILE },
        { x: px(24), y: (G - 8) * TILE }, { x: px(45), y: (G - 8) * TILE },
      ],
      scaffolds: [],
      // le bassin : colonnes, rochers, rangées de l'eau (de la plus haute à la plus basse), fond
      basin: { x0: C0, x1: C0 + CW, stones: STONES, top: G, bed: BED, spring: { x: 43 * TILE, y: (G - 1) * TILE } },
      hay: [],
      crates: [],
      // les cœurs : sur la souche, au fond de la grotte, sur le perchoir du chêne, au milieu du pont
      hearts: [{ x: 16 * TILE, y: (G - 2) * TILE }, { x: 15 * TILE + 8, y: CAVE.floor * TILE }, { x: 21 * TILE, y: CANOPY * TILE }, { x: 53 * TILE + 8, y: (CANOPY + 0.8) * TILE }],
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
