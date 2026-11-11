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

const H = 72;
const TILE = 16;
export const FORET_ROWS = { lisiere: 50, plateau: 22, canopee: 13, souterrain: 36, sanctuaire: 36, vallee: 62 };

function build() {
  const b = new Builder(H, 50);
  const F = { spans: [], crumbles: [], logs: [], vines: [], lamps: [], hollows: [], statue: null, collapse: null, slide: null, dark: null };
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
  b.prop('pine_young', b.x - 16, G1); b.prop('birch', b.x - 10, G1, { s: 0.9 }); b.prop('pine_young', b.x - 5, G1);
  coins([b.x - 18, b.x - 14, b.x - 12, b.x - 8, b.x - 3], G1 - 2);

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
  b.row(x - 5, 2, G1 - 5, '-');                        // une branche basse au-dessus du gué : deux ryō pour les curieux
  coins([x - 5, x - 4], G1 - 6);
  b.prop('branch', x - 5, G1 - 5, { w: 2, from: 'top' });
  water(6, G1);
  ground(16, G1);
  coins([b.x - 12, b.x - 9, b.x - 6], G1 - 2);

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
  // la falaise : le plateau du torrent est tout en haut
  ground(2, G6);
  // la niche de la lanterne, creusée dans la falaise à mi-hauteur
  carve(cliff, 2, G1 - 16, G1 - 14);
  // (la colonne suivante ferme la niche)
  lantern(cliff + 1, G1 - 13);
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
  x = b.x; ground(104, G6);                            // le sous-bois de rattrapage, sous toute la canopée
  const c0 = x;
  climbTree(c0 + 3, G7 - 1);
  const branch = (bx, row, w, extra = {}) => { b.row(c0 + bx, w, row, '-'); b.prop('branch', c0 + bx, row, { w, ...extra }); };
  branch(4, G7, 5);                                    // on arrive en haut de la première remontée
  lantern(c0 + 6, G7);
  branch(12, G7, 3); coin(c0 + 13, G7 - 2);            // 3 cases : un saut
  branch(18, G7 - 1, 4);                               // 3 cases, une case plus haut
  branch(27, G7 - 1, 3); coin(c0 + 24, G7 - 4);        // 5 cases : sprint
  branch(36, G7, 4); coin(c0 + 33, G7 - 3);            // 6 cases : dash
  climbTree(c0 + 42, G7);                              // remontée du milieu
  branch(43, G7 + 1, 5);
  lantern(c0 + 45, G7 + 1);
  branch(51, G7, 2);                                   // petites branches : 3 cases, puis 4
  branch(56, G7 - 1, 2); coin(c0 + 57, G7 - 3);
  branch(65, G7 - 1, 4); coin(c0 + 61, G7 - 4);        // 7 cases : sprint, saut, dash au sommet
  branch(72, G7 + 1, 3);
  // le nid, au-dessus du chemin : on y monte par deux petites branches
  branch(68, G7 - 4, 2); branch(72, G7 - 7, 4, { nest: true });
  b.prop('chest', c0 + 74, G7 - 7, { id: 'nid', ryo: 12 });
  climbTree(c0 + 80, G7 + 1);                          // dernière remontée
  branch(81, G7 + 2, 4);
  branch(88, G7 + 1, 3); coin(c0 + 86, G7 - 1);        // 3 cases
  // au bout : le grand arbre creux ; on entre par le haut et on se laisse glisser jusque sous terre
  const pit = c0 + 96;
  branch(92, G7 + 1, 4);
  const G8 = FORET_ROWS.souterrain;

  // ===========================================================================
  // ZONE 8 — Le souterrain des racines entrelacées : plafonds bas, glissades,
  // un puits de racines, des champignons qui s'allument quand on approche.
  // ===========================================================================
  // l'arbre creux : un boyau de 3 cases qui descend du sous-bois jusqu'au souterrain
  fill(pit - 1, 1, G7 + 3, G6 - 1, '|'); fill(pit + 3, 1, G7 - 3, G6 - 1, '|');
  b.prop('hollow_giant', pit - 1, G6, { w: 5, top: G7 - 3 });
  carve(pit, 3, G6, G8 - 1);
  coins([pit + 1], G6 + 2); coins([pit + 1], G6 + 6); coins([pit + 1], G6 + 10);
  zone('08', 'Le souterrain des racines entrelacées', { mood: 'souterrain' });
  const u0 = b.x;
  const tunnel = (n, floor, ceil) => {                  // n colonnes pleines, un couloir entre ceil et floor - 1
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      for (let y = G6; y < H; y++) c[y] = y >= ceil && y < floor ? '.' : '#';
      b.cols.push(c);
    }
  };
  // la salle d'arrivée, sous l'arbre creux (les colonnes du boyau la rejoignent)
  carve(pit - 4, 12, G8 - 4, G8 - 1);
  lantern(pit - 2, G8);
  b.prop('mushrooms', pit - 4, G8, { w: 3 });
  tunnel(6, G8, G8 - 4);
  x = b.x; tunnel(5, G8, G8 - 1);                       // premier plafond bas : glissade
  b.hint('slide', x - 3);
  tunnel(7, G8, G8 - 4);
  coins([b.x - 5, b.x - 3], G8 - 2);
  x = b.x; tunnel(4, G8, G8 - 1); tunnel(3, G8, G8 - 3); tunnel(5, G8, G8 - 1);   // deux glissades, un court répit
  tunnel(6, G8, G8 - 4);
  b.prop('mushrooms', b.x - 5, G8, { w: 4 });
  // une mare souterraine : 6 cases, dash
  x = b.x;
  for (let i = 0; i < 6; i++) { const c = new Array(H).fill('.'); for (let y = G6; y < H; y++) c[y] = y < G8 - 5 || y > G8 + 1 ? '#' : y >= G8 ? '~' : '.'; b.cols.push(c); }
  tunnel(4, G8, G8 - 5); tunnel(2, G8, G8 - 3);        // (le plafond s'abaisse : il sert de mur gauche au puits)
  lantern(b.x - 4, G8);
  // le puits de racines : on monte de 7 cases en sauts muraux vers la galerie haute
  x = b.x; tunnel(3, G8, G8 - 11);
  coins([x + 1], G8 - 4); coins([x + 1], G8 - 8);
  const G8b = G8 - 7;
  x = b.x; tunnel(8, G8b, G8b - 4);
  coins([x + 3, x + 5], G8b - 2);
  // un creux tapissé de champignons dans le plancher de la galerie : quatre ryō
  x = b.x; tunnel(4, G8b + 2, G8b - 4);
  coins([x, x + 1, x + 2, x + 3], G8b + 1);
  b.prop('mushrooms', x, G8b + 2, { w: 4 });
  tunnel(4, G8b, G8b - 4);
  x = b.x; tunnel(6, G8b, G8b - 1);                     // plafond bas dans la galerie haute
  tunnel(5, G8b, G8b - 4);
  // on redescend : un grand puits, puis le couloir de sortie
  x = b.x; tunnel(4, G8, G8b - 4);
  coins([x + 1, x + 2], G8 - 3);
  tunnel(7, G8, G8 - 4);
  x = b.x; tunnel(5, G8, G8 - 1);                       // dernière glissade, vers la lumière
  tunnel(4, G8, G8 - 5);
  F.dark = { x0: (pit - 5) * TILE, x1: b.x * TILE, y0: (G6 + 1) * TILE };

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
  // la statue : son axe est à la limite entre deux cases
  x = b.x; ground(14, G9, '=');
  const sx = x + 9;                                     // axe du visage (en cases)
  const scx = sx * TILE, sground = G9 * TILE;
  // les lianes de sa chevelure : immobiles, on y monte et on en descend
  vine(sx - 4, G9 - 13.6, 12.3);                        // la grande mèche de gauche, jusqu'au sol
  vine(sx - 2.5, G9 - 13.4, 7.4);                       // un brin devant l'œil gauche
  vine(sx - 0.6, G9 - 13.2, 5.2);                       // un brin court sur l'arête du nez : le relais
  vine(sx + 1.4, G9 - 13.4, 7.6);                       // un brin devant l'œil droit
  vine(sx + 4, G9 - 13.6, 9.2);                         // la mèche de droite, jusqu'aux éboulis
  b.row(sx - 3, 6, G9 - 13, '-');                       // le dessus de la couronne de feuillage : un coffre
  b.prop('chest', sx + 1, G9 - 13, { id: 'couronne', ryo: 15 });
  coins([sx - 2, sx - 1], G9 - 15);
  F.statue = { cx: scx, ground: sground, door: sx + 2, eyes: [{ x: scx - 26, y: sground - 109 }, { x: scx + 26, y: sground - 109 }] };
  b.prop('statue', sx, G9);
  // derrière sa joue droite : un amas de gros blocs, puis la falaise. Le couloir passe dessous.
  x = b.x;                                              // = sx + 5
  for (let i = 0; i < 12; i++) {
    const c = new Array(H).fill('.');
    const wall = i >= 1;                                // la falaise monte jusqu'en haut de la carte
    for (let y = 0; y < H; y++) c[y] = y >= G9 ? '=' : y >= G9 - 2 ? '.' : wall || y === G9 - 3 ? '#' : '.';
    b.cols.push(c);
  }
  // le toit du couloir sous les éboulis, et la porte de pierre
  for (let i = sx + 2; i < x; i++) { b.cols[i][G9 - 3] = '#'; }
  b.cols[sx + 2][G9 - 1] = 'J'; b.cols[sx + 2][G9 - 2] = 'J';
  b.prop('rubble', sx + 2, G9, { w: 4, h: 3 });
  b.prop('cliff', x + 1, G9, { w: 11 });

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
  zone('11', 'La descente vertigineuse', { mood: 'couchant' });
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
  zone('12', 'La lisière crépusculaire', { mood: 'crepuscule' });
  x = b.x; ground(14, G12);
  lantern(x + 3, G12);
  coins([x + 6, x + 8, x + 10], G12 - 2);
  x = b.x; ground(3, G12 - 1);
  b.prop('boulder', x, G12 - 1, { w: 3 });
  coins([x + 1], G12 - 3);
  x = b.x; ground(16, G12);
  b.prop('last_tree', x + 4, G12);
  b.prop('chest', x + 8, G12, { id: 'lisiere', ryo: 20 });
  x = b.x; ground(2, G12 - 1); ground(2, G12 - 2);
  b.prop('stump', x, G12 - 1, { w: 2 }); b.prop('stump', x + 2, G12 - 2, { w: 2 });
  coins([x + 2, x + 3], G12 - 4);
  x = b.x; ground(30, G12);
  lantern(x + 6, G12);
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
