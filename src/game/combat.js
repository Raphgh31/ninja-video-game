// Réglages de combat : vie de KAGE, dégâts reçus et infligés.
// Tout est ici pour pouvoir rééquilibrer facilement.

export const HEALTH = {
  max: 5,              // points de vie de KAGE
  invulnerable: 1.0,   // s d'invincibilité (clignotement) après un coup
  knockback: 120,      // px/s de recul horizontal quand KAGE est touché
  knockup: 160,        // px/s de recul vers le haut
  hurtLock: 0.3,       // s sans contrôle juste après un coup
};

// dégâts subis par KAGE
export const DAMAGE_TAKEN = {
  tateBash: 2,         // coup de bouclier de TATE
  waraSpin: 1,         // moulinet de WARA (des deux côtés)
  spikes: 1,           // pics (KAGE est replacé au dernier sol sûr)
  crate: 1,            // une caisse qui lui tombe dessus
  // chute hors du niveau : mort immédiate
};

// dégâts infligés par KAGE
export const DAMAGE_DEALT = {
  sword: 2,
  airSword: 3,         // coup aérien à deux mains, plus lourd
  flipSword: 4,        // coup du salto : le coup aérien porté juste après un salto (le plus puissant)
  shuriken: 1,
  kick: 2,             // coup de pied : comme le sabre, et il repousse (jusque dans le vide)
};

// ---------------------------------------------------------------------------
// Le duel (mode Arène, novembre 2026) : la sensation de chaque coup, la parade, le choc des lames.
// Recherche : un coup « se sent » quand plusieurs effets s'empilent au même instant (arrêt sur image
// des deux combattants, éclair blanc sur la victime, recul franc, secousse réservée aux gros coups,
// son en couches) ; la parade récompense la lecture de l'adversaire et coûte cher quand elle est lue.
// ---------------------------------------------------------------------------

/** Par coup : arrêt sur image (s), recul de la victime (px/s), secousse (amplitude, durée). */
export const IMPACT = {
  sword:    { stop: 0.065, push: 150, lift: 150, shake: 0, shakeT: 0 },
  air:      { stop: 0.1, push: 200, lift: 170, shake: 1.5, shakeT: 0.16 },
  flip:     { stop: 0.15, push: 270, lift: 200, shake: 3, shakeT: 0.24 },
  kick:     { stop: 0.075, push: 0, lift: 120, shake: 1, shakeT: 0.12 },   // (le recul du coup de pied est le sien : kickPush)
  shuriken: { stop: 0.035, push: 80, lift: 90, shake: 0, shakeT: 0 },
  riposte:  { stop: 0.12, push: 240, lift: 180, shake: 2.5, shakeT: 0.2 },  // le coup porté juste après une parade réussie
  flash: 0.09,                     // s d'éclair blanc sur la victime
};

/**
 * La parade : on lève la garde (touche F ou G, R1 / L1, bouton tactile « garde »). Pendant la
 * fenêtre (les trois premières images, ~0,3 s), un coup de sabre ou un shuriken venus de face sont
 * parés : l'attaquant est déséquilibré, le défenseur peut riposter (le coup suivant fait +1, plus
 * lourd). Le coup de pied brise la garde (comme la projection contre la parade des jeux de combat).
 * Une parade ratée laisse un instant à découvert (la fin du geste) et coûte de l'énergie.
 */
export const PARRY = {
  window: 3,              // images actives de l'animation « parry » (0, 1, 2)
  cooldown: 0.42,         // s avant de pouvoir relever la garde
  riposte: 0.7,           // s pendant lesquelles le coup suivant est une riposte (+1, plus lourd)
  riposteBonus: 1,
  staggerPush: 130,       // recul de l'attaquant paré
  clashPush: 175,         // recul des deux combattants quand les lames se choquent
  clashGap: 0.35,         // s pendant lesquelles un même choc n'est compté qu'une fois
  guardBreakBonus: 1,     // le coup de pied qui brise une garde fait +1
};
