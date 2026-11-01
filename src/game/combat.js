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
  // chute hors du niveau : mort immédiate
};

// dégâts infligés par KAGE
export const DAMAGE_DEALT = {
  sword: 2,
  airSword: 3,         // coup aérien à deux mains, plus lourd
  shuriken: 1,
  kick: 1,             // coup de pied : peu de dégâts, mais il repousse
};
