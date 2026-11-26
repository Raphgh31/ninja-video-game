// Mode combat — l'arène du Potager : « La rizière du gong ».
// Deux fois la largeur de l'image (on en voit la moitié) : la caméra suit KAGE en
// largeur ; en hauteur, presque fixe sur ordinateur, deux hauteurs sur téléphone
// (arenaCamY dans main.js). Trois étages (le sol, les potagers sur pilotis, les
// échafaudages et les perches de séchage du riz), fermés de chaque côté par un
// bosquet de bambous serrés (sauts muraux). Au centre, le canal d'irrigation
// (mortel) et sa passerelle ; à gauche, la grue de bambou et son rocher ficelé ;
// à droite, le gong qui ouvre les vannes : une vague balaie la rizière vers le canal.
// Les mécanismes vivent dans src/game/arena/ (Arena) ; ici, la carte et les repères.
// Guide pour construire une autre arène : docs/ARENES.md.

import { Builder } from './builder.js';

const H = 21;          // hauteur de la carte (cases) : plus haute que l'image (ciel des écrans plus hauts)
const G = 18;          // ligne du haut du sol
const TILE = 16;
// L'arène fait deux fois la largeur de l'image : on en voit la moitié, la caméra
// suit KAGE pour découvrir l'autre (demande de l'utilisateur).
const L = 6, R = 63;   // les deux bosquets de bambous qui ferment l'arène (colonnes)
const C0 = 31, CW = 9; // le canal d'irrigation, au centre (colonnes 31 à 39)
export const ARENA_W = R + 7;   // largeur de la carte : l'arène et des bords peints

function build() {
  const b = new Builder(H, G);
  b.zone('A1', 'La rizière du gong');
  // le sol : rizière à gauche, canal au centre, rizière à droite
  b.flat(C0);
  b.gap(CW);
  b.flat(ARENA_W - C0 - CW);
  // la passerelle du canal : trois planches au milieu (deux sauts de 3 cases)
  b.row(C0 + 3, 3, G, '-');
  // les bosquets qui ferment l'arène : on y grimpe en sauts muraux, on n'en sort pas
  b.block(L, 1, 0, G - 1, '|');
  b.block(R, 1, 0, G - 1, '|');
  // un plafond invisible, haut au-dessus des plateformes (on saute normalement depuis
  // les perches du milieu) : on ne passe jamais par-dessus les bosquets
  b.row(L + 1, R - L - 1, G - 16, '%');

  // ---- gauche : la grue de bambou et son rocher ----
  b.row(L + 1, 3, G - 9, '-');                 // plateforme du treuil, accrochée au bosquet (d'ici, un shuriken coupe la corde)
  b.block(L + 2, 2, G - 1, G - 1, '%');        // botte de foin : un tremplin
  b.set(L + 5, G - 1, 'B');                    // une caisse (d'un coup de pied, elle file vers l'eau)

  // ---- le potager sur pilotis, à gauche : deux plateformes légères, cultivées ----
  b.row(17, 4, G - 3, '-');
  b.row(20, 4, G - 6, '-');
  b.prop('crops', 17, G - 3, { w: 4, kind: 'choux' });
  b.prop('crops', 20, G - 6, { w: 4, kind: 'carottes' });
  b.ladder(16.4, 17.4, G, 3);
  b.ladder(19.3, 20.4, G - 3, 3);
  b.prop('baskets', 23, G - 6);

  // ---- un coin plat, sans rien : une petite maison au fond, et c'est tout ----
  b.propBack('house', 27, G, { far: true });

  // ---- centre : les perches de séchage du riz (hasa), au-dessus du canal ----
  b.row(C0 - 2, CW + 4, G - 9, '-');

  // ---- droite : l'étal, les caisses ----
  b.row(C0 + CW + 3, 3, G - 2, '=');           // l'étal : un toit bas (on passe dessous en glissade ou au dash), on monte dessus
  b.set(C0 + CW + 6, G - 1, 'B').set(C0 + CW + 6, G - 2, 'B');   // deux caisses : d'un coup de pied, sous l'étal, vers le canal

  // ---- le potager sur pilotis, à droite ----
  b.row(48, 4, G - 3, '-');
  b.row(51, 4, G - 6, '-');
  b.prop('crops', 48, G - 3, { w: 4, kind: 'radis' });
  b.prop('crops', 51, G - 6, { w: 4, kind: 'poireaux+choux' });
  b.ladder(47.4, 48.4, G, 3);
  b.ladder(50.3, 51.4, G - 3, 3);

  // ---- tout à droite : le gong sur sa tour, une botte de foin ----
  b.block(R - 3, 2, G - 1, G - 1, '%');        // botte de foin
  b.row(R - 7, 7, G - 9, '=');                 // la plateforme du gong, contre le bosquet ; elle déborde de sa tour vers la gauche (on y accède depuis le potager)

  // ---- trois arbres, de tailles et de formes variées ----
  b.propBack('tree', 19, G, { kind: 'pommier', s: 1.3 });
  b.propBack('tree', R - 2, G, { kind: 'cerisier', s: 0.8 });
  b.propBack('tree', 55, G, { kind: 'poirier', s: 1.1 });

  // échafaudages fragiles (« _ ») : près de la grue, et au-dessus de l'étal
  const scaffolds = [
    { x0: L + 3, w: 3, row: G - 6 }, { x0: C0 + CW + 4, w: 3, row: G - 6 },
  ];
  for (const sc of scaffolds) { b.row(sc.x0, sc.w, sc.row, '_'); sc.ground = G; }

  b.zones[0].x1 = b.x;
  const px = (c) => c * TILE + TILE / 2;
  const rack = { x0: C0 - 2, x1: C0 + CW + 1, row: G - 9 }, deck = { x0: L + 1, x1: L + 3, row: G - 9 };
  const gongDeck = { x0: R - 7, x1: R - 1, tower: R - 3, row: G - 9 };
  return {
    b,
    arena: {
      // caméra : elle suit KAGE en largeur, sans sortir de l'arène ; le sol en bas de l'image
      center: (C0 + CW / 2) * TILE, ground: G * TILE, walls: [L, R],
      // le duel (deux combattants) : face à face, assez près pour tenir ensemble dans l'image à l'ouverture
      duelSpawns: [{ x: px(24), y: G * TILE }, { x: px(47), y: G * TILE }],
      spawns: [
        { x: px(23), y: G * TILE }, { x: px(50), y: G * TILE },
        { x: px(L + 2), y: (G - 9) * TILE }, { x: px(R - 2), y: (G - 9) * TILE },
      ],
      scaffolds,
      // la grue : un gros rocher ficelé (4 × 2 cases : haut comme KAGE, large comme trois KAGE), haut à la ligne top
      crane: { x0: L + 6, w: 4, top: G - 8, h: 2, mastX: px(L + 1) + 6, boomY: (G - 12) * TILE + 2, recharge: 18 },
      gong: { x: px(R - 2), y: (G - 9) * TILE },
      // les vannes, au pied des bosquets : l'eau part vers le canal
      sluices: [{ x: (L + 1) * TILE, dir: 1 }, { x: R * TILE, dir: -1 }],
      canal: [C0 * TILE, (C0 + CW) * TILE],
      rack, deck,                                        // les perches de séchage, la plateforme du treuil
      gongDeck, // la tour du gong (ses poteaux) ; à gauche, le débord sur une jambe de force
      ownSupports: [rack, deck, gongDeck],                         // supports dessinés par l'arène (pas de poteaux automatiques)
      hay: [{ x0: L + 2, w: 2, row: G - 1 }, { x0: R - 3, w: 2, row: G - 1 }],
      // caisses (au départ)
      crates: [{ tx: L + 5, ty: G - 1 }, { tx: C0 + CW + 6, ty: G - 1 }, { tx: C0 + CW + 6, ty: G - 2 }],
      // bonus : des cœurs (vie), à des endroits disputés (les shurikens, on va les rechercher là où ils se sont plantés)
      hearts: [{ x: (C0 + CW / 2) * TILE, y: (G - 9) * TILE }, { x: px(L + 2), y: (G - 9) * TILE }, { x: px(52), y: (G - 6) * TILE }],
      bundles: [],
    },
  };
}

const { b: B, arena } = build();
export const ARENE_POTAGER = {
  name: 'Arène — La rizière du gong',
  map: B.rows(),
  zones: B.zones,
  props: B.props,
  hints: [],
  backdrops: B.backdrops,
  theme: 'potager',
  arena,
  // la musique du combat contre le corbeau : elle porte le duel
  music: { src: './music/karasu.mp3', loopStart: 7.27, loopEnd: 73.51, gain: 0.6 },
};
