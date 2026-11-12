// Chapitre 2 — La Forêt. Une seule carte continue de douze zones, bien plus
// haute que le Potager (72 cases) : on y monte (ascension des conifères,
// canopée), on y descend sous terre, puis on dévale une longue pente.
// Plan et intentions : docs/FORET.md. Légende des tuiles : maps.js, plus
//   | tronc (plein : un mur pour le saut mural)   = pierre taillée des ruines (pleine)
//   - branche ou planche (traversable par-dessous)   ~ eau   v vide (on y meurt)
//   J porte de pierre de la statue (pleine tant que la statue dort)   % bloc invisible
// Les éléments vivants (dalles qui s'effondrent, bois vermoulu, troncs flottants,
// lianes, statue, éboulis) sont déclarés dans `forest` et animés par
// src/game/foret/mechanics.js.
import { Builder } from './builder.js';
import { STATUE, eyeCenter } from '../foret/statue.js';

const H = 72;
const TILE = 16;
export const FORET_ROWS = { lisiere: 50, plateau: 22, canopee: 9, souterrain: 46, sanctuaire: 36, vallee: 62 };

function build() {
  const b = new Builder(H, 50);
  const F = { oasis: null, galleries: null, snaps: [], spans: [], crumbles: [], logs: [], vines: [], lamps: [], hollows: [], bridges: [], glows: [], statue: null, collapse: null, slide: null, dark: null };
  let x;

  // --- petits outils ----------------------------------------------------------
  const zone = (id, name, extra = {}) => { b.zone(id, name); Object.assign(b.zones[b.zones.length - 1], extra); };
  const ground = (n, top, ch = '#') => b.flat(n, top, ch);
  /** n colonnes d'eau dont la surface est à la ligne top (2 cases d'eau, puis le fond). */
  const water = (n, top) => {
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      c[top] = '~'; c[top + 1] = '~';
      for (let y = top + 2; y < H; y++) c[y] = '#';
      b.cols.push(c);
    }
  };
  /** n colonnes de vide (ravin) : on meurt en touchant la ligne kill. */
  const chasm = (n, kill) => {
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      c[kill] = 'v';
      b.cols.push(c);
    }
  };
  const fill = (x0, n, y0, y1, ch = '#') => { for (let i = 0; i < n; i++) for (let y = y0; y <= y1; y++) b.cols[x0 + i][y] = ch; };
  const carve = (x0, n, y0, y1) => fill(x0, n, y0, y1, '.');
  const coin = (cx, row) => { b.cols[cx][row] = 'o'; };
  const coins = (list, row) => { for (const cx of list) coin(cx, row); };
  const lantern = (cx, groundRow) => { b.cols[cx][groundRow - 1] = 'P'; };
  /**
   * Grand arbre creux : son tronc est plein (un mur pour le saut mural) du haut
   * de la carte jusqu'à `open` cases du sol ; on passe à pied par le creux.
   */
  const hollow = (x0, w, groundRow, open = 2, top = 2) => {
    fill(x0, w, top, groundRow - open - 1, '|');
    F.hollows.push({ x0, w, ground: groundRow, open, top });
  };
  /** Liane : accroche (cases, décimales permises), longueur en cases ; swing = amplitude (radians). */
  const vine = (ax, ay, len, swing = 0, phase = 0) => { F.vines.push({ ax: ax * TILE, ay: ay * TILE, len: len * TILE, swing, phase }); };

  // ===========================================================================
  // ZONE 1 — La lisière ensoleillée : on marche, on saute sur des rochers et des
  // souches ; aucun danger. KAGE sort par l'arrière de la porte du temple.
  // ===========================================================================
  const G1 = FORET_ROWS.lisiere;
  zone('01', 'La lisière ensoleillée', { mood: 'matin' });
  ground(16, G1);
  b.cols[4][G1 - 1] = 'S';
  b.prop('temple_back', 0, G1);
  b.prop('birch', 8, G1, { s: 1.0 }); b.prop('birch', 12, G1, { s: 0.8 });
  coins([9, 11, 13], G1 - 2);
  x = b.x; ground(4, G1 - 1);                          // rocher moussu : une marche
  b.prop('boulder', x, G1 - 1, { w: 4 });
  ground(6, G1);
  b.prop('pine_young', b.x - 3, G1);
  x = b.x; ground(2, G1 - 1);                          // souche basse
  b.prop('stump', x, G1 - 1, { w: 2 });
  coin(x, G1 - 3); coin(x + 1, G1 - 3);
  ground(7, G1);
  b.prop('birch', b.x - 4, G1, { s: 1.1 });
  x = b.x; ground(3, G1 - 2);                          // gros rocher : deux cases
  b.prop('boulder', x, G1 - 2, { w: 3 });
  coins([x, x + 1, x + 2], G1 - 4);
  ground(8, G1);
  coins([b.x - 6, b.x - 4, b.x - 2], G1 - 2);
  x = b.x; ground(2, G1 - 1); ground(2, G1 - 2); ground(3, G1 - 4);   // souches en escalier : la plus haute porte des ryō
  b.prop('stump', x, G1 - 1, { w: 2 }); b.prop('stump', x + 2, G1 - 2, { w: 2 }); b.prop('stump', x + 4, G1 - 4, { w: 3, tall: true });
  coins([x + 4, x + 5, x + 6], G1 - 6);
  ground(3, G1 - 1);
  ground(22, G1);
  b.prop('pine_young', b.x - 5, G1);
  coins([b.x - 18, b.x - 14, b.x - 12, b.x - 8, b.x - 3], G1 - 2);
  // DÉTOUR — la cabane du guetteur : dans un vieux chêne, une plateforme de planches à 9 cases du sol
  // (on peut toujours en sauter sans se blesser), une échelle de corde, et une petite cabane
  // d'affût au toit d'écorce ; le coffre y est rangé. Deux ryō sur l'échelle.
  {
    const o = b.x - 16;                                // le fût du chêne
    const deck = G1 - 9;
    b.row(o - 4, 12, deck, '-');                       // la plateforme
    b.row(o - 4, 2, G1 - 3, '-'); b.row(o - 4, 2, G1 - 6, '-');   // deux barreaux de l'échelle tiennent le pied
    coins([o - 4], G1 - 5); coins([o - 3], G1 - 8);
    b.prop('chest', o + 5, deck, { id: 'guetteur', ryo: 10 });
    b.prop('treehouse', o, G1, { deck, x0: o - 4, x1: o + 8, ladder: o - 4, hut: o + 3, roof: deck - 3, seed: 23 });
  }

  // ===========================================================================
  // ZONE 2 — Le sentier des fougères ancestrales : des racines géantes barrent le
  // chemin. On passe par le creux d'un grand arbre, puis on monte en sauts muraux
  // entre son tronc et la racine.
  // ===========================================================================
  zone('02', 'Le sentier des fougères ancestrales', { mood: 'matin' });
  x = b.x; ground(12, G1);
  lantern(x + 1, G1);
  b.hint('wall', x + 10);
  // premier passage : la racine fait 6 cases de haut
  x = b.x; ground(3, G1); hollow(x, 3, G1);
  // DÉTOUR — l'arbre aux cavités : des branches montent le long du grand tronc, côté lumière, jusqu'à
  // sa couronne de feuillage (21 cases). Deux creux dans l'écorce, au bout d'une branche, gardent des
  // ryō ; tout en haut, dans la plus grande cavité, un coffre. Chaque branche dépasse celle du dessus :
  // on redescend en se laissant tomber de l'une à l'autre
  {
    const t = x;                                       // le tronc : colonnes t à t + 2
    const bough = (n, row) => b.row(t - n, n, row, '-');   // une branche qui sort du tronc vers la gauche
    const hole = (row, h) => carve(t, 2, row - h, row - 1);   // un creux dans l'écorce, au ras de la branche
    // (comme un sapin : chaque branche dépasse celle du dessus de 1 à 2 cases ; en courant, une
    // chute de 3 cases porte KAGE 1,5 case plus loin : il retombe toujours sur la suivante)
    bough(13, G1 - 3);
    bough(11, G1 - 6); hole(G1 - 6, 2); coins([t, t + 1], G1 - 7);
    bough(10, G1 - 9); coin(t - 10, G1 - 11);
    bough(8, G1 - 12); coins([t - 8, t - 7], G1 - 14);
    bough(6, G1 - 15); hole(G1 - 15, 2); coin(t + 1, G1 - 16);
    bough(5, G1 - 18);
    bough(3, G1 - 21); hole(G1 - 21, 3);
    b.prop('chest', t, G1 - 21, { id: 'cavites', ryo: 12, dx: 9 });   // (au fond du creux, contre le bois)
    b.prop('tree_crown', t, G1 - 21, { w: 3, top: G1 - 36, seed: 41 });
  }
  ground(3, G1);                                       // le puits, entre le tronc et la racine
  coins([b.x - 2], G1 - 5);
  x = b.x; ground(6, G1 - 6);                          // la racine géante : on marche dessus
  b.prop('giant_root', x, G1 - 6, { w: 6, h: 6 });
  coins([x + 2, x + 4], G1 - 8);
  // une cache au pied de la racine, côté puits, derrière un rideau de lierre (deux coups de sabre)
  carve(x, 3, G1 - 2, G1 - 1);
  b.cols[x][G1 - 2] = 'B'; b.cols[x][G1 - 1] = 'B';
  coins([x + 1, x + 2], G1 - 1); coin(x + 2, G1 - 2);
  b.prop('ivy', x, G1, { h: 2 });
  ground(2, G1 - 3); ground(2, G1 - 1);                // on redescend par deux gradins de racines
  ground(10, G1);
  // second passage : la racine fait 9 cases ; trois sauts muraux, des ryō dans un creux d'écorce
  x = b.x; ground(3, G1); hollow(x, 3, G1);
  carve(x + 1, 2, G1 - 10, G1 - 9);                    // un creux dans l'écorce, en hauteur
  coins([x + 1, x + 2], G1 - 9);
  ground(3, G1);
  coins([b.x - 2], G1 - 4); coins([b.x - 2], G1 - 8);
  x = b.x; ground(8, G1 - 9);
  b.prop('giant_root', x, G1 - 9, { w: 8, h: 9 });
  coins([x + 3, x + 5], G1 - 11);
  ground(3, G1 - 6); ground(3, G1 - 3); ground(3, G1 - 1);
  ground(14, G1);
  coins([b.x - 10, b.x - 7, b.x - 4], G1 - 2);

  // ===========================================================================
  // ZONE 3 — La clairière aux eaux miroirs : des mares trop larges pour un saut ;
  // il faut le dash en l'air.
  // ===========================================================================
  zone('03', 'La clairière aux eaux miroirs', { mood: 'matin', mirror: true });
  x = b.x; ground(9, G1);
  lantern(x + 1, G1);
  b.hint('dash', x + 6);
  water(6, G1);                                        // première mare : 6 cases, on voit l'autre rive
  x = b.x; ground(6, G1);
  coins([x + 2, x + 3], G1 - 2);
  water(6, G1);                                        // deux mares à la suite, un îlot au milieu
  x = b.x; ground(2, G1);
  b.prop('boulder', x, G1, { w: 2, low: true });
  water(6, G1);
  x = b.x; ground(7, G1);
  coins([x + 2, x + 4], G1 - 2);
  // le grand miroir : des pierres de gué, et un îlot à l'écart (saut + dash précis) pour les curieux
  water(3, G1); ground(1, G1 - 1); water(3, G1); ground(2, G1 - 1); water(3, G1);
  x = b.x; ground(2, G1 - 1);
  b.prop('boulder', x - 9, G1 - 1, { w: 1, wet: true }); b.prop('boulder', x - 5, G1 - 1, { w: 2, wet: true }); b.prop('boulder', x, G1 - 1, { w: 2, wet: true });
  // un jeune arbre pousse sur la pierre du gué ; sa branche basse (3 cases : un saut) porte deux ryō
  b.row(x - 5, 2, G1 - 4, '-');
  coins([x - 5, x - 4], G1 - 5);
  b.prop('branch', x - 5, G1 - 4, { w: 2, from: 'center' });
  water(6, G1);
  x = b.x; ground(16, G1);
  coins([b.x - 12, b.x - 9, b.x - 6], G1 - 2);
  // DÉTOUR — l'arche de racines : un vieil arbre sacré a poussé sur une motte de terre que ses racines
  // portent au-dessus du sentier, comme une arche. On passe dessous ; ou bien on grimpe par deux
  // racines en marche (à gauche) jusqu'à la motte : la corde sacrée autour du tronc, un petit
  // sanctuaire de pierre, le coffre. Elle est à 8 cases du sol : on en redescend en sautant.
  {
    const m0 = x + 4, mw = 8, top = G1 - 8;
    fill(m0, mw, top, G1 - 6);                         // la motte (3 cases d'épaisseur ; 5 cases libres dessous)
    b.row(x, 2, G1 - 3, '-'); b.row(x + 2, 2, G1 - 5, '-');   // deux racines en marche
    b.prop('root_arch', m0, top, { w: mw, ground: G1, steps: [[x, G1 - 3, 2], [x + 2, G1 - 5, 2]], seed: 17 });
    b.prop('sacred_tree', m0 + 1, top, { seed: 29 });
    b.prop('hokora', m0 + 7, top);
    b.prop('chest', m0 + 4, top, { id: 'arche', ryo: 10 });
    coins([m0 + 3, m0 + 4, m0 + 5], top - 3);
  }

  // ===========================================================================
  // ZONE 4 — L'allée des piliers effondrés : un pont de dalles sur des colonnes,
  // au-dessus d'un ravin. Passé le déclencheur, les travées tombent une à une
  // derrière KAGE : sprint, sauts, un dash par-dessus la dernière brèche.
  // ===========================================================================
  zone('04', "L'allée des piliers effondrés", { mood: 'sousbois' });
  x = b.x; ground(8, G1);
  lantern(x + 1, G1);
  x = b.x; ground(10, G1, '=');                        // le parvis des ruines
  b.prop('ruin_arch', x + 2, G1);
  lantern(x + 7, G1);                                  // juste avant le pont : on repart d'ici
  b.hint('sprint', x + 8);
  const KILL4 = G1 + 9;
  const bridge0 = b.x;
  const span = (n) => {
    const x0 = b.x;
    for (let i = 0; i < n; i++) { const c = new Array(H).fill('.'); c[G1] = '='; c[KILL4] = 'v'; b.cols.push(c); }
    F.spans.push({ x0, w: n, row: G1 });
    coin(x0 + Math.floor(n / 2), G1 - 2);
  };
  span(5); span(5); span(5);
  chasm(3, KILL4);                                     // brèche : un saut
  span(5); span(5);
  chasm(5, KILL4);                                     // brèche : sprint (ou dash)
  span(5); span(5); span(4);
  chasm(6, KILL4);                                     // brèche : dash
  span(4);
  F.collapse = { trigger: (bridge0 + 4) * TILE, period: 0.72, warn: 0.5, respawnX: (bridge0 - 3) * TILE };
  // derrière et sous les piliers : la gorge (paroi lointaine, racines, corniches, colonnes en ruine, brume)
  b.prop('ravine', bridge0 - 1, G1, { w: b.x - bridge0 + 2 });
  x = b.x; ground(14, G1, '=');
  b.prop('ruin_arch', x + 5, G1, { broken: true });
  coins([x + 3, x + 6, x + 9], G1 - 2);

  // ===========================================================================
  // ZONE 5 — L'ascension des conifères : on grimpe 28 cases en sauts muraux
  // alternés, entre un tronc et la falaise ; des planches de bois vermoulu pour
  // souffler (elles cèdent), une niche avec une lanterne à mi-hauteur.
  // ===========================================================================
  const G6 = FORET_ROWS.plateau;
  zone('05', "L'ascension des conifères", { mood: 'sousbois' });
  x = b.x; ground(9, G1);
  lantern(x + 1, G1);
  x = b.x; ground(3, G1); hollow(x, 3, G1);            // le tronc de gauche
  const shaft = b.x; ground(3, G1);                    // le puits
  const cliff = b.x;
  F.crumbles.push({ x: shaft * TILE, y: (G1 - 9) * TILE, w: 3 * TILE }, { x: shaft * TILE, y: (G1 - 20) * TILE, w: 3 * TILE });
  coins([shaft + 1], G1 - 4); coins([shaft + 1], G1 - 12); coins([shaft + 1], G1 - 18); coins([shaft + 1], G1 - 25);
  // la falaise : le plateau du torrent est tout en haut. Elle se prolonge en une butte de terre
  // (38 cases) : en surface, trois souches en escalier, comme à la lisière ; dessous, des galeries
  ground(6, G6);
  x = b.x; ground(2, G6 - 1); ground(2, G6 - 2); ground(3, G6 - 4);   // souches en escalier : la plus haute porte des ryō
  b.prop('stump', x, G6 - 1, { w: 2 }); b.prop('stump', x + 2, G6 - 2, { w: 2 }); b.prop('stump', x + 4, G6 - 4, { w: 3, tall: true });
  coins([x + 4, x + 5, x + 6], G6 - 6);
  ground(3, G6 - 1);
  ground(22, G6);
  b.prop('pine_young', b.x - 15, G6); b.prop('pine_young', b.x - 6, G6);
  coins([b.x - 12, b.x - 10, b.x - 3], G6 - 2);
  // --- les galeries de terre, sous la butte : un avant-goût du souterrain ---------------------------
  // on y entre par la niche de la lanterne, à mi-hauteur de la falaise ; une salle de croisement ;
  // en haut, la salle du coffre (un petit arbre à perles, des champignons) ; en bas, un passage bas
  // sous une racine de chêne, puis un fossé sans fond (des ryō de l'autre côté, pour les téméraires)
  const c = cliff, KILLG = G1 + 10;
  carve(c, 8, G1 - 16, G1 - 14);                       // la niche, prolongée en couloir
  lantern(c + 1, G1 - 13);
  carve(c + 8, 6, G1 - 20, G1 - 14);                   // la salle de croisement (7 cases de haut)
  b.prop('mushrooms', c + 9, G1 - 13, { w: 2 });
  coins([c + 10, c + 11], G1 - 17);
  // en haut : une marche, un couloir qui monte, la salle du coffre
  carve(c + 14, 4, G1 - 20, G1 - 16);                  // une marche (2 cases plus haut, par-dessus le trou)
  carve(c + 18, 4, G1 - 21, G1 - 18);                  // un couloir qui monte encore de 2 cases
  carve(c + 22, 11, G1 - 25, G1 - 19);
  b.prop('pearl_tree', c + 25, G1 - 18, { s: 2 });
  b.prop('mushrooms', c + 27, G1 - 18, { w: 2 }); b.prop('mushrooms', c + 22, G1 - 18, { w: 1 });
  b.prop('chest', c + 30, G1 - 18, { id: 'galerie', ryo: 10 });
  coins([c + 19, c + 20], G1 - 19);
  // en bas : le sol s'ouvre, on descend deux paliers ; un passage bas sous une racine (glissade)
  carve(c + 12, 6, G1 - 13, G1 - 11);
  carve(c + 16, 2, G1 - 10, G1 - 8);                   // le sol s'ouvre encore
  carve(c + 18, 8, G1 - 10, G1 - 8);
  fill(c + 20, 3, G1 - 10, G1 - 9);                   // le plafond s'abaisse : on passe en glissade
  coins([c + 15], G1 - 12); coins([c + 24], G1 - 9);
  b.prop('mushrooms', c + 18, G1 - 7, { w: 2 }); b.prop('mushrooms', c + 25, G1 - 7, { w: 1 });   // la grappe violette : le fossé est proche
  // le fossé : 4 cases, sans fond ; de l'autre côté, un cul-de-sac et trois ryō
  carve(c + 26, 4, G1 - 10, KILLG - 1);
  for (let i = 0; i < 4; i++) b.cols[c + 26 + i][KILLG] = 'v';
  carve(c + 30, 3, G1 - 10, G1 - 8);
  coins([c + 28], G1 - 10); coins([c + 30, c + 31, c + 32], G1 - 8);
  F.galleries = {
    x0: c * TILE, x1: (c + 34) * TILE, y0: (G1 - 26) * TILE, y1: (KILLG + 1) * TILE, under: (c + 2) * TILE,
    beam: { x: (c + 28) * TILE + 6, y: (G1 - 25) * TILE, floor: (G1 - 18) * TILE },     // un rai de jour tombe d'une fente sur le coffre
    curtains: [[c + 7, G1 - 17, 1.2], [c + 21, G1 - 23, 1], [c + 17, G1 - 14, 0.8], [c + 25, G1 - 11, 0.9]],   // rideaux de racines : [colonne, plafond, longueur]
  };
  // des ryō dans une cheminée plus dure : un creux tout en haut du tronc
  carve(shaft - 2, 2, G6 - 4, G6 - 3);
  coins([shaft - 2, shaft - 1], G6 - 3);

  // ===========================================================================
  // ZONE 6 — Le torrent du bois ancien : des troncs flottants dérivent et
  // s'enfoncent sous KAGE ; des rochers pour souffler.
  // ===========================================================================
  zone('06', 'Le torrent du bois ancien', { mood: 'sousbois' });
  x = b.x; ground(9, G6);
  lantern(x + 2, G6);
  const log = (c0, c1, w = 2, speed = 12, start = 0) => F.logs.push({ x0: c0 * TILE, x1: c1 * TILE, y: G6 * TILE - 5, w: w * TILE, speed, start });
  // premier bras : deux troncs lents
  x = b.x; water(11, G6);
  log(x + 1, x + 4, 2, 10, 0.2); log(x + 6, x + 9, 2, 12, 0.7);
  coin(x + 5, G6 - 3);
  x = b.x; ground(3, G6 - 1);                          // rocher
  b.prop('boulder', x, G6 - 1, { w: 3, wet: true });
  // deuxième bras : trois troncs, celui du milieu remonte le courant (un ryō dessus)
  x = b.x; water(16, G6);
  log(x + 1, x + 4, 2, 13, 0.5); log(x + 6, x + 10, 2, -16, 0.5); log(x + 12, x + 14, 2, 12, 0.1);
  coin(x + 8, G6 - 3);
  x = b.x; ground(4, G6 - 1);                          // rocher du milieu : une lanterne
  b.prop('boulder', x, G6 - 1, { w: 4, wet: true });
  lantern(x + 1, G6 - 1);
  // troisième bras : les troncs sont plus espacés, le dernier demande un dash
  x = b.x; water(20, G6);
  log(x + 1, x + 3, 2, 12, 0.3); log(x + 6, x + 8, 2, 14, 0.8); log(x + 11, x + 12, 2, 8, 0.4);
  coins([x + 4, x + 9], G6 - 3); coin(x + 16, G6 - 3);
  x = b.x; ground(16, G6);
  coins([x + 3, x + 6], G6 - 2);

  // ===========================================================================
  // ZONE 7 — La canopée suspendue : de branche en branche, tout en haut. Une
  // chute ne tue pas : on retombe dans le sous-bois et on remonte par un tronc.
  // ===========================================================================
  const G7 = FORET_ROWS.canopee;
  zone('07', 'La canopée suspendue', { mood: 'canopee' });
  x = b.x; ground(8, G6);
  lantern(x + 1, G6);
  /** Remontée : des branches en quinconce le long d'un tronc (décor), du sol jusqu'à la canopée. */
  const climbTree = (cx, top) => {
    b.prop('climb_trunk', cx, G6, { top });
    for (let row = G6 - 2, k = 0; row > top; row -= 2, k++) b.row(cx + (k % 2 ? 1 : -2), 2, row, '-');
  };
  x = b.x; ground(112, G6);                            // le sous-bois de rattrapage, sous toute la canopée
  const c0 = x;
  // Les arbres de la canopée sont posés ici, un par un, et chacun a les pieds sur la terre :
  // l'eau du sous-bois s'étend entre eux (voir les îlots plus bas). Les branches proches d'un
  // arbre (jusqu'à 6 cases) en sortent par un long bras (props.js). Largeur du fût en pixels.
  const trees = [];                                    // [colonne, largeur du fût]
  const tree = (cx, w = 20) => { b.prop('canopy_trunk', c0 + cx, G6, { w, seed: cx * 7 + 3 }); trees.push([c0 + cx, w]); };
  climbTree(c0 + 3, G7 - 1);
  const branch = (bx, row, w, extra = {}) => { b.row(c0 + bx, w, row, '-'); b.prop('branch', c0 + bx, row, { w, ...extra }); };
  branch(4, G7, 5);                                    // on arrive en haut de la première remontée
  lantern(c0 + 6, G7);
  tree(11);
  branch(12, G7, 3); coin(c0 + 13, G7 - 2);            // 3 cases : un saut
  // le pont suspendu, d'un grand tronc à l'autre : de vieilles planches moussues entre deux cordes,
  // certaines lâchent sous le pied, pour de bon ; il ploie et oscille quand KAGE y saute.
  // Les deux troncs sont écartés de 21 cases : dessous, 14 cases d'eau (plus que sprint + saut + dash).
  b.prop('bridge_tree', c0 + 17, G6, { top: 0 }); b.prop('bridge_tree', c0 + 38, G6, { top: 0, flip: true });
  trees.push([c0 + 17, 24], [c0 + 38, 24]);
  F.bridges.push({ x0: (c0 + 18) * TILE, x1: (c0 + 38) * TILE, y: (G7 - 1) * TILE, sag: 15 });
  coin(c0 + 21, G7 - 3); coin(c0 + 25, G7 - 4); coin(c0 + 30, G7 - 4); coin(c0 + 35, G7 - 3);
  tree(43);
  branch(44, G7, 4); coin(c0 + 41, G7 - 3);            // 6 cases : dash
  climbTree(c0 + 50, G7);                              // remontée du milieu
  branch(51, G7 + 1, 5);
  lantern(c0 + 53, G7 + 1);
  tree(62);                                            // un arbre porte les deux petites branches
  branch(59, G7, 2);                                   // petites branches : 3 cases, puis 4
  branch(64, G7 - 1, 2); coin(c0 + 65, G7 - 3);
  tree(82, 26);                                        // le grand arbre du nid, 14 cases d'eau avant lui
  // la grande branche où l'on se pose en arrivant (7 cases : sprint, saut, dash au sommet) : elle rompt
  // presque aussitôt (la première fois, on tombe) ; elle revient quand KAGE réapparaît
  F.snaps.push({ x0: c0 + 73, w: 4, row: G7 - 1, host: c0 + 82 }); coin(c0 + 69, G7 - 4);
  branch(80, G7 + 1, 3);
  // le nid : à droite du grand tronc, une petite branche puis celle du nid, le coffre bien en vue
  branch(84, G7 - 1, 2); branch(84, G7 - 4, 4, { nest: true });
  b.prop('chest', c0 + 86, G7 - 4, { id: 'nid', ryo: 12 });
  // des lianes pendent sous quelques branches jusqu'au sous-bois, toujours au-dessus de la terre :
  // on s'y accroche pour remonter (↑, puis un bond)
  const VINES = [[12, G7, 3], [36, G7 - 1, 3], [59, G7, 2], [80, G7 + 1, 3], [96, G7 + 1, 3]];
  for (const [bx, row, w] of VINES) {
    const deck = bx === 36 ? 0.5 : 0;                  // celle-ci pend sous le pont
    vine(c0 + bx + w / 2, row + 0.15 + deck, G6 - row - 0.55 - deck);
  }
  climbTree(c0 + 88, G7 + 1);                          // dernière remontée
  branch(89, G7 + 2, 4);
  tree(99);                                            // entre les deux dernières branches
  branch(96, G7 + 1, 3); coin(c0 + 94, G7 - 1);        // 3 cases
  // au bout : le grand arbre creux ; on entre par le haut et on se laisse glisser jusque sous terre
  const pit = c0 + 104;
  branch(100, G7 + 1, 4);
  // au sol, de l'eau partout, sauf sous les pieds des arbres, autour des remontées et sous les lianes :
  // sous le pont et avant l'arbre du nid, 14 cases qu'on ne franchit pas, même en sprint + saut + dash (~10,5)
  const land = new Set();
  const keep = (a, z) => { for (let c = a; c <= z; c++) land.add(c); };
  keep(c0 - 8, c0 + 7); keep(c0 + 98, c0 + 112);       // le départ, et le pied de l'arbre creux
  for (const cx of [c0 + 50, c0 + 88]) keep(cx - 3, cx + 4);
  for (const [bx, , w] of VINES) keep(c0 + bx + Math.floor(w / 2) - 2, c0 + bx + Math.floor(w / 2) + 2);
  // le pied d'un arbre s'évase (racines) jusqu'à ~1,12 fois la largeur du fût de chaque côté, plus une case de rive
  for (const [cx, w] of trees) keep(Math.floor((cx * TILE + 8 - 1.12 * w) / TILE) - 1, Math.floor((cx * TILE + 8 + 1.12 * w) / TILE) + 1);
  for (let cx = c0; cx < c0 + 112; cx++) if (!land.has(cx)) {
    // pas de flaque de moins de 3 cases : la terre reprend
    let a = cx; while (a > c0 && !land.has(a - 1)) a--;
    let z = cx; while (z < c0 + 111 && !land.has(z + 1)) z++;
    if (z - a + 1 < 3) continue;
    b.cols[cx][G6] = '~'; b.cols[cx][G6 + 1] = '~';
  }
  const G8 = FORET_ROWS.souterrain;

  // ===========================================================================
  // ZONE 8 — Le souterrain des racines entrelacées : plafonds bas, glissades,
  // un puits de racines, des champignons qui s'allument quand on approche.
  // ===========================================================================
  // l'arbre creux : un boyau de 3 cases qui descend du sous-bois jusqu'au souterrain
  fill(pit - 1, 1, G7 + 3, G6 - 1, '|'); fill(pit + 3, 1, G7 - 3, G6 - 1, '|');
  b.prop('hollow_giant', pit - 1, G6, { w: 5, top: G7 - 3 });
  carve(pit, 3, G6, G8 - 1);
  // dans le boyau, cinq nœuds du bois en quinconce : on descend de palier en palier ; du dernier,
  // on se laisse tomber de 10 cases (juste sous la limite mortelle) dans la grande salle de la caverne
  for (let r = G7 + 7, k = 0; k < 5; r += 5, k++) b.row(pit + (k % 2), 2, r, '-');
  coins([pit + 1], G6 + 2); coins([pit + 1], G6 + 6); coins([pit + 1], G6 + 10);

  // ===========================================================================
  // ZONE 8 — La caverne aux perles : un petit monde féerique sous la forêt.
  // De grandes salles, d'énormes racines de chêne qui barrent le chemin, des
  // arbres à perles lumineuses, des papillons ; au cœur, une clairière haute
  // avec sa petite eau et le grand arbre aux perles. On en ressort par un puits
  // de racines, et la lumière revient peu à peu.
  // ===========================================================================
  zone('08', 'La caverne aux perles', { mood: 'souterrain' });
  const G9s = FORET_ROWS.sanctuaire;
  /** n colonnes de terre sous la surface du sous-bois, un couloir de ceil à floor - 1 (assez profond pour ne jamais voir le dehors). */
  const tunnel = (n, floor, ceil) => {
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      for (let y = G6; y < H; y++) c[y] = '#';
      for (let y = ceil; y < floor; y++) c[y] = '.';
      b.cols.push(c);
    }
  };
  const pearl = (cx, ground, s = 1) => b.prop('pearl_tree', cx, ground, { s });
  const root = (x0, w, y0, y1, kind) => { fill(x0, w, y0, y1, '#'); b.prop('oak_root', x0, y1, { w, h: y1 - y0 + 1, kind }); };
  // la grande salle, sous l'arbre creux (on y arrive en tombant du dernier palier)
  tunnel(8, G8, G8 - 9);
  carve(pit - 4, 14, G8 - 9, G8 - 1);
  lantern(pit - 2, G8);
  b.prop('mushrooms', pit - 4, G8, { w: 3 });
  pearl(pit + 7, G8, 1);
  b.prop('mushrooms', b.x - 4, G8, { w: 3 });
  tunnel(6, G8, G8 - 5);
  // première racine de chêne : elle barre le couloir à hauteur d'homme, on glisse dessous
  x = b.x; tunnel(5, G8, G8 - 6); root(x, 5, G8 - 6, G8 - 2, 'ceil');
  b.hint('slide', x - 3);
  x = b.x; tunnel(9, G8, G8 - 6);
  pearl(x + 4, G8, 1); coins([x + 2, x + 6], G8 - 2);
  // deuxième racine : couchée en travers du sol, on saute par-dessus
  x = b.x; tunnel(5, G8, G8 - 7); root(x, 5, G8 - 2, G8 - 1, 'floor');
  coins([x + 2], G8 - 4);
  tunnel(6, G8, G8 - 6);
  b.prop('mushrooms', b.x - 5, G8, { w: 4 });
  // une galerie en contrebas : le sol descend de deux marches, des arbres à perles, puis on remonte
  tunnel(3, G8 + 1, G8 - 6); x = b.x; tunnel(14, G8 + 2, G8 - 8);
  pearl(x + 3, G8 + 2, 1); pearl(x + 10, G8 + 2, 2);
  b.prop('mushrooms', x + 6, G8 + 2, { w: 3 });
  coins([x + 5, x + 7, x + 9], G8);
  tunnel(3, G8 + 1, G8 - 6);
  tunnel(5, G8, G8 - 5);
  // une mare souterraine : 6 cases, dash
  for (let i = 0; i < 6; i++) { const c = new Array(H).fill('.'); for (let y = G6; y < H; y++) c[y] = y >= G8 - 5 && y < G8 ? '.' : y === G8 || y === G8 + 1 ? '~' : '#'; b.cols.push(c); }
  tunnel(5, G8, G8 - 5);
  lantern(b.x - 3, G8);
  // la clairière : le plafond s'envole (15 cases) ; au pied du grand arbre aux perles, une petite oasis
  // souterraine : un bassin de 13 cases, un îlot au milieu (deux sauts de 5 cases), roseaux et nénuphars
  x = b.x; tunnel(42, G8, G8 - 15);
  const glade = x;
  for (let i = 18; i < 31; i++) if (i < 23 || i > 25) { b.cols[glade + i][G8] = '~'; b.cols[glade + i][G8 + 1] = '~'; }
  pearl(glade + 15, G8, 3);
  pearl(glade + 5, G8, 1); pearl(glade + 24, G8, 1); pearl(glade + 37, G8, 2);
  b.prop('cave_reeds', glade + 16, G8, { w: 2 }); b.prop('cave_reeds', glade + 31, G8, { w: 3 });
  b.prop('cave_reeds', glade + 23, G8, { w: 1 }); b.prop('cave_reeds', glade + 25, G8, { w: 1 });
  b.prop('mushrooms', glade + 9, G8, { w: 3 }); b.prop('mushrooms', glade + 33, G8, { w: 3 });
  coins([glade + 8, glade + 11, glade + 20, glade + 28], G8 - 3); coins([glade + 24], G8 - 6);
  F.oasis = { x0: (glade + 18) * TILE, x1: (glade + 31) * TILE };
  tunnel(5, G8, G8 - 6);
  // la salle aux papillons : plafond haut, trois arbres à perles, des papillons qui volent autour
  x = b.x; tunnel(18, G8, G8 - 11);
  pearl(x + 3, G8, 2); pearl(x + 9, G8, 1); pearl(x + 14, G8, 2);
  b.prop('mushrooms', x + 6, G8, { w: 3 }); b.prop('mushrooms', x + 11, G8, { w: 2 });
  coins([x + 6, x + 12], G8 - 3);
  tunnel(4, G8, G8 - 6);
  // troisième racine : elle tombe du plafond, on glisse dessous
  x = b.x; tunnel(4, G8, G8 - 6); root(x, 4, G8 - 6, G8 - 2, 'ceil');
  tunnel(5, G8, G8 - 5);
  pearl(b.x - 3, G8, 1);
  lantern(b.x - 5, G8);
  // le puits de racines : on remonte de 10 cases en sauts muraux jusqu'à la sortie
  tunnel(2, G8, G8 - 3);                                // (le plafond s'abaisse : il sert de mur gauche au puits)
  x = b.x; tunnel(3, G8, G9s - 4);
  coins([x + 1], G8 - 4); coins([x + 1], G8 - 8);
  // le couloir de sortie : la lumière revient peu à peu
  // (le couloir s'évase en bouche de caverne : le plafond monte vers la sortie, la lumière entre)
  x = b.x; for (let i = 0; i < 16; i++) tunnel(1, G9s, G9s - 5 - Math.round(Math.pow(i / 15, 1.6) * 9));
  // deep : vers l'ouest, en profondeur seulement (sous le sous-bois de la canopée), la roche de la caverne
  // continue : un écran large ne voit jamais la terre claire du dessus au bord de la grotte
  F.dark = { x0: (pit - 12) * TILE, x1: b.x * TILE, y0: (G6 + 1) * TILE, fade: 18 * TILE, deep: { x0: (pit - 60) * TILE, y0: (G8 - 16) * TILE } };

  // ===========================================================================
  // ZONE 9 — L'antre de la statue oubliée : le calme. On grimpe aux lianes de sa
  // chevelure pour rallumer la lanterne de chaque œil ; alors sa mâchoire
  // s'abaisse, et la suite passe par sa bouche.
  // ===========================================================================
  const G9 = FORET_ROWS.sanctuaire;
  zone('09', "L'antre de la statue oubliée", { mood: 'sanctuaire', camGround: 0.955 });
  x = b.x; ground(10, G9, '=');
  lantern(x + 2, G9);
  b.prop('ruin_wall', x + 5, G9, { w: 3, h: 9 });
  x = b.x; ground(2, G9 - 1, '='); ground(8, G9, '=');  // un fût de colonne couché
  b.prop('ruin_drum', x, G9 - 1, { w: 2 });
  coins([x, x + 1], G9 - 3);
  // la statue : son axe (le cou) est à la limite entre deux cases ; la tête penche vers la gauche
  x = b.x; ground(14, G9, '=');
  const sx = x + 9;                                     // axe du cou (en cases)
  const scx = sx * TILE, sground = G9 * TILE;
  const eye = (side) => { const e = eyeCenter(side); return { x: scx - STATUE.cx + e.x, y: sground - STATUE.h + e.y }; };
  const eyeL = eye(-1), eyeR = eye(1);
  // les lianes de sa chevelure : immobiles, on y monte et on en descend ; deux passent devant les yeux
  vine(sx - 4.4, G9 - 13.6, 12.3);                      // la grande mèche de gauche, jusqu'au sol
  vine(eyeL.x / TILE, G9 - 13.4, 7.4);                  // devant l'œil gauche
  vine((eyeL.x + eyeR.x) / 2 / TILE, G9 - 13.2, 6);     // un brin court sur l'arête du nez : le relais
  vine(eyeR.x / TILE, G9 - 13.4, 7.6);                  // devant l'œil droit
  vine(sx + 3.8, G9 - 13.6, 9.4);                       // la mèche de droite
  b.row(sx - 3, 6, G9 - 13, '-');                       // le dessus de la couronne de feuillage : un coffre
  b.prop('chest', sx + 1, G9 - 13, { id: 'couronne', ryo: 15 });
  coins([sx - 2, sx - 1], G9 - 15);
  F.statue = { cx: scx, ground: sground, eyes: [eyeL, eyeR] };
  b.prop('statue', sx, G9);
  // à sa droite, un pilier de pierre maçonnée ; une porte de pierre y ferme un petit tunnel :
  // quand les deux yeux sont allumés, la dalle remonte dans le mur
  ground(2, G9, '=');
  x = b.x;
  for (let i = 0; i < 12; i++) {
    const c = new Array(H).fill('.');
    for (let y = 0; y < H; y++) c[y] = y >= G9 ? '=' : y >= G9 - 2 ? '.' : i < 3 ? '=' : '#';
    b.cols.push(c);
  }
  b.cols[x][G9 - 1] = 'J'; b.cols[x][G9 - 2] = 'J';
  F.statue.door = x;
  b.prop('stone_gate', x, G9);
  b.prop('cliff', x + 1, G9, { w: 11 });           // (son fond commence une case plus tôt : derrière la dalle)

  // ===========================================================================
  // ZONE 10 — Le souffle des lianes : de longues lianes se balancent au-dessus
  // d'un ravin. On les attrape au vol, on prend de l'élan, on lâche ; à la fin,
  // on lâche au sommet de la courbe et on dashe vers la corniche.
  // ===========================================================================
  zone('10', 'Le souffle des lianes', { mood: 'sousbois', enchanted: true });
  x = b.x; ground(9, G9);
  lantern(x + 2, G9);
  b.hint('vine', x + 4);
  const KILL10 = G9 + 14;
  const AY = G9 - 17;                                    // hauteur des branches où pendent les lianes
  const swing = (cx, len = 18, phase = 0, amp = 0.5) => { vine(cx, AY, len, amp, phase); b.prop('vine_branch', cx, AY); };
  const pillar = (n, top, lamp = false) => { const p0 = b.x; ground(n, top); b.prop('rock_pillar', p0, top, { w: n }); if (lamp) lantern(p0 + Math.floor(n / 2), top); return p0; };
  // une liane, pour apprendre : elle ramène tout près du bord
  x = b.x; chasm(12, KILL10);
  swing(x + 6, 18, 0);
  coins([x + 6], G9 - 1);
  pillar(5, G9, false);
  // deux lianes à la suite
  x = b.x; chasm(21, KILL10);
  swing(x + 6, 18, 0); swing(x + 15, 18, Math.PI);
  coins([x + 10], G9 - 4);
  pillar(5, G9, true);
  // trois lianes, la dernière plus courte : il faut lâcher plus haut
  x = b.x; chasm(29, KILL10);
  swing(x + 6, 18, 0); swing(x + 15, 17, Math.PI); swing(x + 23, 16, 0);
  coins([x + 10, x + 19], G9 - 5);
  pillar(5, G9 - 1, true);
  // le final : une liane, puis la corniche, plus haute et trop loin : on lâche au sommet de la courbe et on dashe
  x = b.x; chasm(22, KILL10);
  swing(x + 6, 17, 0, 0.55);
  coins([x + 12], G9 - 8);
  const G10 = G9 - 5;
  x = b.x; ground(6, G10);
  b.prop('rock_ledge', x, G10, { w: 6 });
  // tout en haut, une corniche pour un dash parfait : cinq ryō
  b.row(x + 2, 3, G10 - 6, '-');
  b.prop('branch', x + 2, G10 - 6, { w: 3, from: 'right' });
  coins([x + 2, x + 3, x + 4], G10 - 7);

  // ===========================================================================
  // ZONE 11 — La descente vertigineuse : un éboulis de pierres moussues dévale
  // la pente derrière KAGE. Gradins, brèches, un tronc couché sous lequel on glisse.
  // ===========================================================================
  zone('11', 'La descente vertigineuse', { mood: 'couchant', bgSlope: true });
  x = b.x; ground(10, G10);
  lantern(x + 2, G10);
  const slide0 = x + 7;
  let g = G10;
  const KILL11 = FORET_ROWS.vallee + 8;
  const step = (n, drop) => { g += drop; const s0 = b.x; ground(n, g); return s0; };
  const gapv = (n) => { const s0 = b.x; chasm(n, KILL11); return s0; };
  x = step(7, 2); coin(x + 3, g - 2);
  x = step(8, 3); coins([x + 2, x + 5], g - 2);
  gapv(3);                                               // brèche : un saut
  x = step(9, 2); coin(x + 4, g - 2);
  x = step(6, 3);
  // un tronc couché en travers : on glisse dessous
  x = step(9, 2);
  fill(x + 3, 4, g - 3, g - 2, '|');
  b.prop('fallen_log', x + 3, g - 1, { w: 4 });
  gapv(5);                                               // brèche : sprint
  x = step(8, 3); coins([x + 2, x + 5], g - 2);
  x = step(7, 2);
  lantern(x + 3, g);                                     // mi-pente : l'éboulis repart d'ici
  const slideMid = x + 3;
  x = step(8, 3); coin(x + 4, g - 2);
  gapv(3);                                               // brèche : un saut
  x = step(8, 2);
  x = step(6, 3); coins([x + 1, x + 4], g - 2);
  gapv(6);                                               // brèche : dash
  x = step(9, 2);
  fill(x + 4, 3, g - 3, g - 2, '|');                     // second tronc couché
  b.prop('fallen_log', x + 4, g - 1, { w: 3 });
  x = step(7, 2); coin(x + 3, g - 2);
  const G12 = FORET_ROWS.vallee;
  x = step(8, G12 - g - 0);
  F.slide = { trigger: slide0 * TILE, start: (slide0 - 9) * TILE, mid: slideMid * TILE, end: (b.x - 2) * TILE, speed: 94, speedEnd: 106 };

  // ===========================================================================
  // ZONE 12 — La lisière crépusculaire : le calme, les derniers ryō, un coffre,
  // la dernière lanterne, et l'horizon.
  // ===========================================================================
  zone('12', 'La lisière crépusculaire', { mood: 'crepuscule', bgRow: FORET_ROWS.vallee });
  x = b.x; ground(14, G12);
  lantern(x + 3, G12);
  coins([x + 6, x + 8, x + 10], G12 - 2);
  x = b.x; ground(3, G12 - 1);
  b.prop('boulder', x, G12 - 1, { w: 3 });
  coins([x + 1], G12 - 3);
  x = b.x; ground(16, G12);
  b.prop('last_tree', x + 4, G12);
  b.prop('chest', x + 8, G12, { id: 'lisiere', ryo: 20 });
  const tLast = x + 4;                                 // le dernier grand arbre (son belvédère : plus bas)
  x = b.x; ground(2, G12 - 1); ground(2, G12 - 2);
  b.prop('stump', x, G12 - 1, { w: 2 }); b.prop('stump', x + 2, G12 - 2, { w: 2 });
  coins([x + 2, x + 3], G12 - 4);
  x = b.x; ground(30, G12);
  lantern(x + 6, G12);
  // DÉTOUR — le belvédère : on grimpe au dernier grand arbre par ses branches, étagées des deux côtés
  // comme un sapin (en tombant d'une branche, on retombe toujours sur la suivante), jusqu'à la fourche,
  // à 15 cases : la vallée au soleil couchant, l'horizon, un coffre posé dans la fourche
  {
    const t = tLast;                                   // le fût (40 px : de t - 1 à t + 1)
    // à gauche : 11, 9, 7 et 5 cases ; à droite, une case plus haut : 10, 8, 6 et 4 (les deux côtés alternent)
    for (const [k, row] of [59, 56, 53, 50].entries()) b.row(t - 2 - (10 - 2 * k), 11 - 2 * k, row, '-');
    for (const [k, row] of [58, 55, 52, 49].entries()) b.row(t + 2, 10 - 2 * k, row, '-');
    b.row(t - 4, 9, G12 - 15, '-');                    // la fourche, en travers du fût
    b.prop('chest', t, G12 - 15, { id: 'belvedere', ryo: 15 });
    coins([t - 3, t - 2, t + 2, t + 3], G12 - 17);
    coins([t - 8], G12 - 10); coins([t + 9], G12 - 8);
  }
  coins([x + 10, x + 13, x + 16], G12 - 2);
  b.prop('horizon', x + 18, G12);
  b.cols[x + 24][G12 - 1] = 'G';
  for (let y = 0; y < G12; y++) b.cols[b.x - 1][y] = '%';   // le monde s'arrête là
  b.zones[b.zones.length - 1].x1 = b.x;
  return { b, F };
}

const { b: B, F } = build();
export const FORET = {
  name: 'Chapitre 2 — La Forêt',
  map: B.rows(),
  zones: B.zones,
  props: B.props,
  hints: B.hints,
  backdrops: B.backdrops,
  cranes: [],
  forest: F,
  theme: 'foret',
  chapter: 2,
  intro: { pre: 'Fin de l\'initiation', num: 'Chapitre 2', name: 'La Forêt', line: 'Le voyage commence.' },
  endText: 'Au-delà de la lisière, le chemin continue… la suite de l\'aventure arrive bientôt.',
  // musique : la piste fournie par Raph, introduction puis boucle sans couture (tools/musique_boucle.py)
  music: { src: './music/foret.mp3', loopStart: 12.28, loopEnd: 152.27 },
  next: null,
};
