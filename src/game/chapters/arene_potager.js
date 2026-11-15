// Mode combat — l'arène du Potager : « La rizière du gong ».
// Une fois et demie la largeur de l'image : on en voit les deux tiers, la caméra
// suit KAGE en largeur (jamais en hauteur). Trois étages (le sol, les échafaudages, les
// perches de séchage du riz), fermés de chaque côté par un bosquet de bambous
// serrés (sauts muraux). Au centre, le canal d'irrigation (mortel) et sa
// passerelle ; à gauche, la grue de bambou et ses sacs de riz ; à droite, le
// gong qui ouvre les vannes : une vague balaie la rizière basse vers le canal.
// Les mécanismes vivent dans src/game/arena/ (Arena) ; ici, la carte et les repères.

import { Builder } from './builder.js';

const H = 21;          // hauteur de la carte (cases) : plus haute que l'image (ciel des écrans plus hauts)
const G = 18;          // ligne du haut du sol
const TILE = 16;
// L'arène fait une fois et demie la largeur de l'image : on en voit les deux tiers,
// la caméra suit KAGE pour découvrir le reste (demande de l'utilisateur).
const L = 6, R = 49;   // les deux bosquets de bambous qui ferment l'arène (colonnes)
const C0 = 25, CW = 6; // le canal d'irrigation, au centre (colonnes 25 à 30)
export const ARENA_W = R + 7;   // largeur de la carte : l'arène et des bords peints

function build() {
  const b = new Builder(H, G);
  b.zone('A1', 'La rizière du gong');
  // le sol : rizière à gauche, canal au centre, rizière à droite
  b.flat(C0);
  b.gap(CW);
  b.flat(ARENA_W - C0 - CW);
  // la passerelle du canal : deux planches au milieu (deux sauts de 2 cases)
  b.row(C0 + 2, 2, G, '-');
  // les bosquets qui ferment l'arène : on y grimpe en sauts muraux, on n'en sort pas
  b.block(L, 1, 0, G - 1, '|');
  b.block(R, 1, 0, G - 1, '|');
  // un plafond invisible au ras du haut de l'image : on ne sort jamais du cadre
  b.row(L + 1, R - L - 1, G - 13, '%');

  // ---- gauche : la grue de bambou et ses balles de riz ----
  b.row(L + 1, 3, G - 9, '-');                 // plateforme du treuil, accrochée au bosquet (d'ici, un shuriken coupe la corde)
  b.block(L + 2, 2, G - 1, G - 1, '%');        // botte de foin : un tremplin
  b.set(L + 5, G - 1, 'B');                    // une caisse (d'un coup de pied, elle file vers l'eau)

  // ---- le potager sur pilotis, à gauche : deux plateformes légères, cultivées ----
  b.row(15, 4, G - 3, '-');
  b.row(18, 4, G - 6, '-');
  b.prop('crops', 15, G - 3, { w: 4, kind: 'choux' });
  b.prop('crops', 18, G - 6, { w: 4, kind: 'carottes' });
  b.ladder(14.4, 15.4, G, 3);
  b.ladder(17.3, 18.4, G - 3, 3);
  b.prop('baskets', 21, G - 6);

  // ---- centre : les perches de séchage du riz (hasa), au-dessus du canal ----
  b.row(C0 - 2, CW + 4, G - 9, '-');

  // ---- le potager sur pilotis, à droite ----
  b.row(39, 4, G - 3, '-');
  b.row(42, 4, G - 6, '-');
  b.prop('crops', 39, G - 3, { w: 4, kind: 'radis' });
  b.prop('crops', 42, G - 6, { w: 4, kind: 'poireaux+choux' });
  b.ladder(38.4, 39.4, G, 3);
  b.ladder(41.3, 42.4, G - 3, 3);

  // ---- droite : l'étal, les caisses, le gong ----
  b.row(C0 + CW + 3, 3, G - 2, '=');           // l'étal : un toit bas (on passe dessous en glissade ou au dash), on monte dessus
  b.set(C0 + CW + 6, G - 1, 'B').set(C0 + CW + 6, G - 2, 'B');   // deux caisses : d'un coup de pied, sous l'étal, vers le canal
  b.block(R - 3, 2, G - 1, G - 1, '%');        // botte de foin
  b.row(R - 3, 3, G - 9, '=');                 // la plateforme du gong, contre le bosquet

  // ---- trois arbres, de tailles et de formes variées ----
  b.propBack('tree', 17, G, { kind: 'pommier', s: 1.3 });
  b.propBack('tree', 47, G, { kind: 'cerisier', s: 0.8 });
  b.propBack('tree', 45, G, { kind: 'poirier', s: 1.1 });

  // échafaudages fragiles (« _ ») : bas au bord du canal, haut près de la grue et de l'étal
  const scaffolds = [
    { x0: C0 - 3, w: 3, row: G - 3 }, { x0: L + 3, w: 3, row: G - 6 },
    { x0: C0 + CW, w: 3, row: G - 3 }, { x0: C0 + CW + 4, w: 3, row: G - 6 },
  ];
  for (const sc of scaffolds) { b.row(sc.x0, sc.w, sc.row, '_'); sc.ground = G; }

  b.zones[0].x1 = b.x;
  const px = (c) => c * TILE + TILE / 2;
  const rack = { x0: C0 - 2, x1: C0 + CW + 1, row: G - 9 }, deck = { x0: L + 1, x1: L + 3, row: G - 9 };
  return {
    b,
    arena: {
      // caméra : elle suit KAGE en largeur, sans sortir de l'arène ; le sol en bas de l'image
      center: (C0 + CW / 2) * TILE, ground: G * TILE, walls: [L, R],
      spawns: [
        { x: px(16), y: G * TILE }, { x: px(41), y: G * TILE },
        { x: px(L + 2), y: (G - 9) * TILE }, { x: px(R - 2), y: (G - 9) * TILE },
      ],
      scaffolds,
      // la grue : balles de riz (2 × 2 cases) suspendues, haut à la ligne top ; elles tombent au sol
      crane: { x0: L + 6, w: 2, top: G - 8, h: 2, mastX: px(L + 1) + 6, boomY: (G - 12) * TILE + 2, recharge: 18 },
      gong: { x: px(R - 2), y: (G - 9) * TILE },
      // les vannes, au pied des bosquets : l'eau part vers le canal
      sluices: [{ x: (L + 1) * TILE, dir: 1 }, { x: R * TILE, dir: -1 }],
      canal: [C0 * TILE, (C0 + CW) * TILE],
      rack, deck,                                        // les perches de séchage, la plateforme du treuil
      gongDeck: { x0: R - 3, x1: R - 1, row: G - 9 },
      ownSupports: [rack, deck],                         // supports dessinés par l'arène (pas de poteaux automatiques)
      hay: [{ x0: L + 2, w: 2, row: G - 1 }, { x0: R - 3, w: 2, row: G - 1 }],
      // caisses : où elles retombent du ciel quand il en manque
      crates: [{ tx: L + 5, ty: G - 1 }, { tx: C0 + CW + 6, ty: G - 1 }, { tx: C0 + CW + 6, ty: G - 2 }],
      // bonus : cœurs (vie) et paquets de shurikens, à des endroits disputés
      hearts: [{ x: (C0 + CW / 2) * TILE, y: (G - 9) * TILE }, { x: px(L + 2), y: (G - 9) * TILE }, { x: px(43), y: (G - 6) * TILE }],
      bundles: [{ x: px(C0 - 2), y: (G - 3) * TILE }, { x: px(C0 + CW + 1), y: (G - 3) * TILE }, { x: px(C0 + CW + 4), y: (G - 2) * TILE }, { x: px(19), y: (G - 6) * TILE }],
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
