// Énergie de KAGE (endurance), affichée en anneau au-dessus de la tête,
// façon Breath of the Wild en simplifié.

export const ENERGY = {
  runDrain: 0.04,      // par seconde de course (≈ 25 s pour vider la barre)
  regen: 0.55,         // par seconde à l'arrêt (vide -> plein en < 2 s)
  regenDelay: 0.35,    // s d'immobilité avant que la recharge démarre
  dash: 1 / 3,
  jump: 0.1,
  attack: 0.12,        // coup de sabre (le shuriken est gratuit)
  recover: 0.4,        // essoufflé jusqu'à ce que l'énergie remonte à ce niveau
  exhaustedSpeed: 0.65,// vitesse de course quand on est essoufflé
};

const RING = { outer: 8, inner: 5 };   // anneau épais, en pixels du jeu
const COLORS = {
  full: '#9fd98b',       // jauge
  exhausted: '#e2674e',  // essoufflé / action refusée
  track: '#1b1e27',      // fond de l'anneau
  edge: '#06070a',       // contour
};

export class Energy {
  constructor() {
    this.reset();
  }

  reset() {
    this.value = 1;
    this.exhausted = false;
    this.idle = 0;        // temps passé sans dépenser
    this.flash = 0;       // clignotement quand une action est refusée
    this.shown = 0;       // opacité de l'anneau (il s'efface quand la barre est pleine)
    this.fullFor = 1;
  }

  /** Dépense obligatoire (ex. saut) : toujours acceptée, l'énergie ne descend pas sous 0. */
  spend(cost) {
    this.value = Math.max(0, this.value - cost);
    this.idle = 0;
    if (this.value <= 0) this.exhausted = true;
  }

  /** Dépense soumise à condition (dash, sabre) : refusée s'il n'y a pas assez d'énergie. */
  trySpend(cost) {
    if (this.exhausted || this.value + 1e-6 < cost) {
      this.flash = 0.5;
      return false;
    }
    this.spend(cost);
    return true;
  }

  /** running : en train de courir au sol ; resting : immobile au sol. */
  update(dt, { running, resting }) {
    this.flash = Math.max(0, this.flash - dt);
    if (running) {
      this.spend(ENERGY.runDrain * dt);
    } else if (resting) {
      this.idle += dt;
      if (this.idle >= ENERGY.regenDelay) this.value = Math.min(1, this.value + ENERGY.regen * dt);
    } else {
      this.idle = 0;
    }
    if (this.exhausted && this.value >= ENERGY.recover) this.exhausted = false;
    // visible tant que la barre n'est pas pleine, puis s'efface doucement
    this.fullFor = this.value >= 1 ? this.fullFor + dt : 0;
    const target = this.fullFor < 0.6 ? 1 : 0;
    this.shown += Math.sign(target - this.shown) * Math.min(Math.abs(target - this.shown), dt * 4);
  }

  get speedFactor() {
    return this.exhausted ? ENERGY.exhaustedSpeed : 1;
  }

  /** Anneau dessiné pixel par pixel (net à toutes les échelles entières). */
  draw(ctx, cx, cy) {
    if (this.shown <= 0.01) return;
    const red = this.exhausted || (this.flash > 0 && Math.floor(this.flash * 12) % 2 === 0);
    const fill = this.value * Math.PI * 2;
    ctx.globalAlpha = this.shown;
    const R = RING.outer + 1;
    for (let y = -R; y <= R; y++) {
      for (let x = -R; x <= R; x++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d > RING.outer + 1 || d < RING.inner - 1) continue;
        let color;
        if (d > RING.outer || d < RING.inner) {
          color = COLORS.edge;
        } else {
          // angle mesuré depuis le haut, dans le sens des aiguilles d'une montre
          let a = Math.atan2(x + 0.5, -(y + 0.5));
          if (a < 0) a += Math.PI * 2;
          color = a <= fill ? (red ? COLORS.exhausted : COLORS.full) : COLORS.track;
        }
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(cx) + x, Math.round(cy) + y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}
