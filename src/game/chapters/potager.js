// Chapitre 1 — Le Potager (greybox jouable).
// Une seule carte continue, construite zone par zone avec un petit constructeur
// modulaire : chaque zone ajoute ses colonnes de terrain et déclare ses éléments.
// Légende des tuiles (voir aussi maps.js) :
//   # terre / pierre   = bois   | bambou   ~ eau (fait perdre 1 vie, retour au sol sûr)
//   B caisse (se brise au sabre ou au coup de pied, lâche un ryō)
//   o ryō   W WARA   E TATE   P lanterne (sauvegarde)   M marchand   S départ   G sortie
// Les décors (épouvantail, moulin, arbres, serre, grange, jardin…) et les aides
// contextuelles sont des listes à part : ils ne gênent jamais les collisions.

const H = 22;          // hauteur de la carte (carreaux)
const G = 19;          // ligne du haut du sol de référence

class Builder {
  constructor() {
    this.cols = [];
    this.zones = [];
    this.props = [];
    this.hints = [];
    this.backdrops = [];
  }

  get x() { return this.cols.length; }

  /** n colonnes de sol dont le haut est à la ligne top (matière ch). */
  flat(n, top = G, ch = '#') {
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      for (let y = top; y < H; y++) c[y] = ch;
      this.cols.push(c);
    }
    return this;
  }

  /** n colonnes vides ; fond d'eau (canal, bassin) ou de terre basse (fossé peu profond). */
  gap(n, bottom = 'water') {
    for (let i = 0; i < n; i++) {
      const c = new Array(H).fill('.');
      if (bottom === 'water') { c[H - 2] = '~'; c[H - 1] = '~'; }
      else if (bottom === 'ditch') { c[G + 2] = '#'; }
      this.cols.push(c);
    }
    return this;
  }

  /** Pose une tuile (coordonnées absolues). */
  set(x, y, ch) {
    this.cols[x][y] = ch;
    return this;
  }

  /** Rangée horizontale de tuiles (plateforme, poutre). */
  row(x0, n, y, ch = '=') {
    for (let i = 0; i < n; i++) this.cols[x0 + i][y] = ch;
    return this;
  }

  /** Bloc plein (plafond bas, mur, tronc). */
  block(x0, n, y0, y1, ch = '#') {
    for (let i = 0; i < n; i++) for (let y = y0; y <= y1; y++) this.cols[x0 + i][y] = ch;
    return this;
  }

  /** Haut du sol d'une colonne déjà posée. */
  top(x) {
    const c = this.cols[x];
    for (let y = 0; y < H; y++) if (c[y] !== '.' && c[y] !== 'o') return y;
    return H;
  }

  /** Entité posée sur le sol de la colonne x (ou à la ligne y). */
  on(x, ch, y = null) {
    this.cols[x][(y ?? this.top(x)) - 1] = ch;
    return this;
  }

  /** Ryō à hauteur de hanche au-dessus du sol (ou en l'air, dy carreaux plus haut). */
  coins(xs, dy = 1) {
    for (const x of xs) this.cols[x][this.top(x) - 1 - dy] = 'o';
    return this;
  }

  zone(id, name) {
    const prev = this.zones[this.zones.length - 1];
    if (prev) prev.x1 = this.x;
    this.zones.push({ id, name, x0: this.x, x1: this.x });
    return this;
  }

  prop(type, x, y, extra = {}) {
    this.props.push({ type, x, y, ...extra });
    return this;
  }

  hint(kind, x = this.x) {
    this.hints.push({ kind, x });
    return this;
  }

  backdrop(type, x0, x1, y0, y1) {
    this.backdrops.push({ type, x0, x1, y0, y1 });
    return this;
  }

  rows() {
    const out = [];
    for (let y = 0; y < H; y++) out.push(this.cols.map((c) => c[y]).join(''));
    return out;
  }
}

function build() {
  const b = new Builder();
  let x;

  // -------------------------------------------------------------------------
  // ZONE 01 — Le chemin des premières pousses : avancer, sauter, sprinter
  // -------------------------------------------------------------------------
  b.zone('01', 'Le chemin des premières pousses');
  b.flat(12);
  b.on(3, 'S');
  b.hint('move', 2);
  b.prop('sign', 0, G);                              // l'entrée du potager
  b.prop('house', 9, G, { far: true });
  b.prop('tall_grass', 1, G, { w: 2 });
  b.coins([7, 9, 11]);
  b.hint('jump', 11);
  x = b.x; b.flat(6, G - 1);                         // petite marche
  b.prop('crops', x, G - 1, { w: 6, kind: 'carottes' });
  x = b.x; b.flat(1, G - 2);                         // clôture basse en bambou
  b.prop('fence', x, G - 2, { w: 1.2 });
  b.flat(5, G - 1);
  b.prop('crops', x + 1, G - 1, { w: 5, kind: 'navets+radis' });
  b.prop('kakashi', x + 3, G - 1);
  b.coins([x + 2, x + 4], 2);
  b.flat(3, G);
  x = b.x; b.flat(1, G - 1);                         // pierre moussue
  b.prop('stone', x, G - 1);
  b.flat(4);
  b.prop('bush', x + 2, G);
  b.prop('jizo', x + 4, G);
  x = b.x; b.flat(6, G - 2);                         // muret : deux carreaux
  b.coins([x + 1, x + 3, x + 5]);
  b.prop('scarecrow', x + 4, G - 2);                 // l'épouvantail au grand chapeau
  b.flat(4, G - 1);
  b.flat(3);
  b.hint('sprint');
  x = b.x; b.flat(12, G - 1);                        // longue portion dégagée, légère pente
  b.prop('crops', x, G - 1, { w: 12, kind: 'radis' });
  b.flat(12);
  b.prop('tree', x + 16, G, { kind: 'fruit' });
  b.flat(10);
  b.coins([x + 4, x + 8, x + 12, x + 16, x + 20, x + 24, x + 28]);
  b.prop('kakashi', x + 6, G - 1);
  b.prop('tall_grass', x - 3, G - 1, { w: 2 });
  b.prop('well', x + 22, G);
  b.prop('stone', x + 19, G);
  b.prop('tall_grass', x + 13, G, { w: 2 });
  b.prop('cart', x + 27, G);
  b.prop('bush', x + 31, G, { flowers: 'white' });
  b.prop('tall_grass', x + 33, G, { w: 2 });

  // -------------------------------------------------------------------------
  // ZONE 02 — Les cultures en terrasse : sauter, puis le dash
  // -------------------------------------------------------------------------
  b.zone('02', 'Les cultures en terrasse');
  b.prop('terraces_bg', b.x + 29, G, { w: 31, mx: b.x + 44, spout: b.x + 46, peak: 72, lip: 125 });   // la colline en terrasses, derrière
  b.gap(3, 'ditch');                                 // fossé peu profond
  x = b.x; b.flat(5);
  b.prop('daikon_rack', x + 2, G, { w: 3 });
  b.prop('tubs', x + 4, G);
  x = b.x; b.flat(5, G - 2);                         // terrasses
  b.prop('kakashi', x + 1, G - 2);
  b.prop('crops', x, G - 2, { w: 5, kind: 'navets' });
  x = b.x; b.flat(6, G - 4);
  b.prop('crops', x, G - 4, { w: 6, kind: 'choux' });
  b.row(x + 1, 3, G - 7, '=');                       // plateforme de récolte
  b.coins([x + 2], 4);
  b.prop('baskets', x + 5, G - 4);
  b.flat(4, G - 4);
  b.prop('bush', b.x - 2, G - 4);
  b.hint('dash');
  b.gap(6);                                          // le premier dash : on voit l'arrivée
  x = b.x; b.flat(6, G - 4);
  b.coins([x + 1, x + 3]);
  b.prop('trellis', x + 3, G - 4, { w: 3 });
  b.gap(5);                                          // second dash, arrivée un peu plus haute
  x = b.x; b.flat(10, G - 5);
  // secret : une cache derrière la cascade d'irrigation
  b.row(x + 2, 2, G - 8, '=');                        // marchepied visible (on passe dessous)
  b.row(x + 5, 3, G - 9, '=');                        // étagère cachée derrière l'eau
  b.coins([x + 5, x + 6, x + 7], 0);
  b.set(x + 6, G - 10, 'o');
  b.prop('waterfall', x + 6, G - 9, { top: 125, basin: true, secret: true });   // elle descend de la colline
  b.prop('basin', x + 6, G - 5);
  b.prop('bridge', x + 1, G - 5, { w: 8 });
  b.prop('crops', x + 1, G - 5, { w: 3, kind: 'poireaux+choux' });
  x = b.x; b.flat(3, G - 3);                         // escalier de pierre ébréché
  b.flat(3, G - 1);
  b.flat(4);
  b.prop('tall_grass', x + 4, G - 1, { w: 2 });

  // -------------------------------------------------------------------------
  // ZONE 03 — Les canaux d'irrigation : saut, dash et sprint ensemble
  // -------------------------------------------------------------------------
  b.zone('03', "Les canaux d'irrigation");
  x = b.x; b.flat(8);
  b.prop('mill', x + 7, G, { flume: (x + 9) * 16 - 4 });   // le moulin et sa grande roue
  b.prop('waterwheel', x + 8, G, { r: 3, dx: 16, lift: 10 });
  b.prop('reeds', x + 7, G, { w: 1 });
  b.gap(2);                                          // canal étroit : un saut
  x = b.x; b.flat(5);
  b.coins([x + 2]);
  b.prop('reeds', x, G, { w: 1 });
  b.prop('reeds', x + 4, G, { w: 1 });
  b.gap(6);                                          // deux petits canaux, passerelle au milieu
  b.row(b.x - 4, 2, G, '=');
  b.prop('kappa', b.x - 5, G + 1);                   // une petite créature pêche sur une pierre
  x = b.x; b.flat(4);
  b.prop('reeds', x, G, { w: 1 });
  b.prop('lantern_stone', x + 2, G);
  b.gap(6);                                          // plateforme éloignée : dash
  b.prop('barrel', b.x - 4, G + 1);
  x = b.x; b.flat(22);                               // passage dégagé : sprint
  b.coins([x + 3, x + 7, x + 11, x + 15, x + 19]);
  b.prop('reeds', x, G, { w: 4 });
  b.prop('tubs', x + 6, G);
  b.prop('tall_grass', x + 9, G, { w: 2 });
  b.prop('bush', x + 13, G);
  b.prop('stone', x + 17, G);
  b.prop('reeds', x + 19, G, { w: 3 });
  b.gap(5);                                          // élan du sprint pour sauter loin
  b.flat(4);
  b.gap(5);                                          // saut + dash vers une berge plus haute
  b.prop('barrel', b.x - 3, G + 1);
  x = b.x; b.flat(6, G - 2);
  b.coins([x + 2, x + 3], 2);
  b.prop('reeds', x, G - 2, { w: 1 });
  b.flat(3, G - 1);

  // -------------------------------------------------------------------------
  // ZONE 04 — Le vieux verger : les premiers ennemis, le coup de pied
  // -------------------------------------------------------------------------
  b.zone('04', 'Le vieux verger');
  x = b.x; b.flat(6);
  b.on(x + 2, 'P');                                  // sauvegarde : entrée du verger
  b.prop('tree', x + 5, G, { kind: 'cerisier' });
  b.prop('orchard_canopy', x + 2, G, { w: 54 });   // voûte de branches au-dessus du chemin
  b.hint('kick', x + 7);
  x = b.x; b.flat(18);
  b.prop('baskets', x + 9, G, { stolen: true });     // panier de légumes pillé
  b.on(x + 11, 'W');                                 // le petit nuisible, seul
  b.prop('tree', x + 3, G, { kind: 'pommier' });
  b.prop('tree', x + 15, G, { kind: 'poirier' });
  b.prop('tree', x + 8, G, { kind: 'pommier', s: 0.8 });
  b.prop('ladder', x + 5, G, { h: 3 });
  b.prop('bush', x + 12, G);
  b.row(x + 13, 4, G - 5, '=');                      // branche basse
  b.coins([x + 14, x + 15], 5);
  x = b.x; b.flat(4, G - 1);
  b.flat(24);
  b.on(x + 9, 'W');                                  // deux nuisibles, espacés
  b.on(x + 20, 'W');
  b.prop('tree', x + 6, G, { kind: 'cerisier' });
  b.prop('ladder', x + 14, G, { h: 4 });
  b.prop('tree', x + 17, G, { kind: 'pommier' });
  b.prop('lantern_stone', x + 24, G);
  b.prop('tree', x + 1, G, { kind: 'poirier', s: 0.85 });
  b.prop('baskets', x + 11, G);
  b.prop('tree', x + 21, G, { kind: 'cerisier', s: 0.9 });
  b.prop('tall_grass', x + 4, G, { w: 2 });
  b.prop('stone', x + 22, G);
  b.coins([x + 2, x + 13, x + 25]);
  b.flat(4);

  // -------------------------------------------------------------------------
  // ZONE 05 — La serre de bambou : la glissade, puis tout s'enchaîne
  // -------------------------------------------------------------------------
  b.zone('05', 'La serre de bambou');
  const serre0 = b.x;
  b.flat(6);
  b.hint('slide', serre0 + 2);
  x = b.x; b.flat(5);                                // 1. sous une structure de bambou
  b.block(x, 5, G - 6, G - 2, '|');
  b.flat(6);
  b.coins([b.x - 3]);
  x = b.x; b.flat(4);                                // 2. sous une étagère renversée
  b.block(x, 4, G - 6, G - 2, '=');
  b.prop('pots', x - 3, G);
  b.prop('tools', x - 10, G);
  b.flat(6);
  b.prop('pots', b.x - 2, G);
  b.coins([b.x - 4, b.x - 2]);
  x = b.x; b.flat(6);                                // 3. tunnel de racines et de branches
  b.block(x, 6, G - 6, G - 2, '#');
  b.flat(5);
  const serre1 = b.x;
  b.block(serre0, serre1 - serre0, G - 7, G - 7, '|');   // toit de la serre
  b.backdrop('serre', serre0, serre1, G - 7, G);
  // sortie : sprint, saut, dash, glissade
  x = b.x; b.flat(14);
  b.coins([x + 4, x + 8, x + 12]);
  b.prop('bamboo_grove', x + 4, G, { w: 5 });
  b.prop('trellis', x + 9, G, { w: 3 });
  b.prop('tall_grass', x + 1, G, { w: 2 });
  x = b.x; b.flat(6, G - 2);                         // un saut pour monter sur la butte
  b.gap(6);                                          // dash
  x = b.x; b.flat(9, G - 2);
  b.block(x + 3, 4, G - 7, G - 4, '|');              // glissade sous un auvent bas
  b.prop('bamboo_grove', x + 5, G - 2, { w: 6 });
  b.coins([x + 4, x + 5]);
  b.flat(3, G - 1);
  b.flat(3);

  // -------------------------------------------------------------------------
  // ZONE 06 — La grange abandonnée : le sabre
  // -------------------------------------------------------------------------
  b.zone('06', 'La grange abandonnée');
  const grange0 = b.x;
  b.flat(4);
  b.prop('barn_door', grange0 + 1, G);
  b.hint('attack', grange0 + 3);
  x = b.x; b.flat(30);
  b.row(x + 3, 10, G - 4, '=');                      // mezzanine : on ne passe pas par-dessus
  b.set(x + 6, G - 1, 'B').set(x + 6, G - 2, 'B').set(x + 6, G - 3, 'B');   // caisses empilées
  b.coins([x + 9, x + 11], 5);
  b.set(x + 15, G - 1, 'B');
  b.on(x + 17, 'W');                                 // il se cachait derrière la caisse
  b.set(x + 21, G - 1, 'B').set(x + 22, G - 1, 'B').set(x + 22, G - 2, 'B');
  b.row(x + 19, 9, G - 5, '=');
  b.set(x + 26, G - 1, 'B').set(x + 26, G - 2, 'B').set(x + 26, G - 3, 'B').set(x + 26, G - 4, 'B');
  b.prop('hay', x + 1, G);
  b.prop('hay', x + 24, G);
  b.prop('sacks', x + 11, G);
  b.prop('tubs', x + 19, G);
  const grange1 = b.x;
  b.block(grange0 + 1, grange1 - grange0 - 1, G - 9, G - 9, '=');   // charpente
  b.backdrop('grange', grange0, grange1, G - 9, G);
  x = b.x; b.flat(5);
  b.on(x + 2, 'P');                                  // sauvegarde : sortie de la grange
  b.prop('woodpile', x + 4, G);

  // -------------------------------------------------------------------------
  // ZONE 07 — Le jardin des sentinelles : tout combiner
  // -------------------------------------------------------------------------
  b.zone('07', 'Le jardin des sentinelles');
  x = b.x; b.flat(20);
  b.prop('bamboo_grove', x + 2, G, { w: 8 });
  b.prop('torii', x + 0, G, { w: 40, h: 50 });
  b.prop('shrine', x + 4, G);
  b.prop('fox', x + 9, G);
  b.prop('pine', x + 14, G);
  b.prop('bush', x + 18, G);
  b.on(x + 11, 'W');                                 // un petit groupe
  b.on(x + 16, 'W');
  b.coins([x + 6, x + 14]);
  x = b.x; b.flat(3, G - 2);                         // marches de pierre : un saut
  b.flat(3, G - 2);
  b.prop('lantern_stone', x + 1, G - 2);
  b.flat(3);
  b.gap(6);                                          // bassin aux carpes, pont rouge rompu : dash
  b.prop('koi', b.x - 6, G + 1, { w: 6 });
  b.prop('bridge_red', b.x - 8, G, { w: 10, broken: true });
  b.prop('reeds', b.x - 7, G, { w: 1 });
  x = b.x; b.flat(6);
  b.on(x + 3, 'P');                                  // sauvegarde : avant la dernière partie
  x = b.x; b.flat(4);                                // bosquet de bambous couchés : glissade
  b.block(x, 4, G - 12, G - 2, '|');
  b.prop('bamboo_grove', x + 2, G - 12, { w: 3 });
  x = b.x; b.flat(18);                               // allée dégagée : sprint
  b.coins([b.x - 15, b.x - 11, b.x - 7]);
  b.prop('fox', b.x - 4, G);
  b.prop('path_stones', x + 7, G, { w: 10 });
  b.prop('lantern_stone', x + 3, G);
  b.prop('bench', x + 9, G);
  b.prop('bush', x + 13, G, { flowers: 'white' });
  b.prop('lantern_stone', x + 16, G);
  x = b.x; b.flat(12);
  b.on(x + 8, 'E');                                  // la dernière sentinelle
  b.prop('tree', x + 2, G, { kind: 'cerisier' });
  b.prop('pine', x + 6, G);
  b.prop('bush', x + 10, G);
  x = b.x; b.flat(4);
  b.prop('gate', x + 1, G);                          // la grande porte : sortie du potager

  // -------------------------------------------------------------------------
  // ZONE 08 — Le comptoir du voyageur : le marchand, puis la route
  // -------------------------------------------------------------------------
  b.zone('08', 'Le comptoir du voyageur');
  x = b.x; b.flat(18);
  b.on(x + 9, 'M');
  b.prop('stall', x + 9, G);
  b.prop('jizo', x + 2, G);
  b.prop('tree', x + 15, G, { kind: 'cerisier', s: 0.9 });
  b.prop('tall_grass', x + 17, G, { w: 2 });
  b.coins([x + 3, x + 15]);
  for (let s = 1; s <= 4; s++) b.flat(4, G - s); // le chemin monte vers les collines
  x = b.x; b.flat(10, G - 4);
  b.prop('signpost', x + 2, G - 4);
  b.prop('bush', x + 5, G - 4);
  b.prop('stone', x + 9, G - 4);
  b.on(x + 7, 'G');
  b.flat(4, G - 4);
  b.zones[b.zones.length - 1].x1 = b.x;
  return b;
}

const B = build();
export const POTAGER = {
  name: 'Chapitre 1 — Le Potager',
  map: B.rows(),
  zones: B.zones,
  props: B.props,
  hints: B.hints,
  backdrops: B.backdrops,
  theme: 'potager',
  chapter: 1,
  next: 'Les rizières',
};
