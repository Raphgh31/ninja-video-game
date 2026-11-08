// Énergie de KAGE (endurance), affichée en anneau en haut à gauche de l'écran,
// à côté du stock de shurikens (façon Breath of the Wild en simplifié).

// Toutes les dépenses sont multipliées par COST, en gardant les mêmes proportions
// entre les actions : 85 % d'abord, puis encore −20 % à la demande de l'utilisateur
// (plus d'endurance) : 0,85 × 0,8 = 0,68.
const COST = 0.68;
export const ENERGY = {
  runDrain: 0.04 * COST,     // par seconde de course (≈ 29 s pour vider la barre)
  sprintDrain: 0.16 * COST,  // par seconde de sprint (≈ 7 s pour vider la barre)
  regen: 0.55,               // par seconde à l'arrêt (vide -> plein en < 2 s)
  walkRegen: 0.55 * 0.6,     // par seconde en marchant, à bout de souffle (un peu moins qu'à l'arrêt)
  regenDelay: 0.35,          // s sans dépenser avant que la recharge démarre
  dash: (1 / 3) * COST,
  jump: 0.1 * COST,
  attack: 0.12 * COST,       // coup de sabre (le shuriken est gratuit)
  kick: 0.15 * COST,         // coup de pied : un peu plus cher que le sabre
  recover: 0.4,              // à bout de souffle (mode marche) jusqu'à ce que l'énergie remonte ici
  tolerance: 0.15,           // une action passe s'il manque au plus 15 % de son coût
                             // (la course entre deux dashs ne doit pas empêcher le 3e)
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
    if (this.exhausted || this.value + 1e-6 < cost * (1 - ENERGY.tolerance)) {
      this.flash = 0.5;
      return false;
    }
    this.spend(cost);
    return true;
  }

  /**
   * running : en train de courir au sol (sprinting : en sprint) ; resting : immobile au sol ;
   * walking : marche à bout de souffle (l'énergie remonte, un peu moins vite qu'à l'arrêt).
   */
  update(dt, { running, sprinting, resting, walking }) {
    this.flash = Math.max(0, this.flash - dt);
    if (running) {
      this.spend((sprinting ? ENERGY.sprintDrain : ENERGY.runDrain) * dt);
    } else if (resting || walking) {
      this.idle += dt;
      const rate = resting ? ENERGY.regen : ENERGY.walkRegen;
      if (this.idle >= ENERGY.regenDelay) this.value = Math.min(1, this.value + rate * dt);
    } else {
      this.idle = 0;
    }
    if (this.exhausted && this.value >= ENERGY.recover) this.exhausted = false;
    // visible tant que la barre n'est pas pleine, puis s'efface doucement
    this.fullFor = this.value >= 1 ? this.fullFor + dt : 0;
    const target = this.fullFor < 0.6 ? 1 : 0;
    this.shown += Math.sign(target - this.shown) * Math.min(Math.abs(target - this.shown), dt * 4);
  }

  /** Anneau dessiné pixel par pixel (net à toutes les échelles entières). */
  draw(ctx, cx, cy, { always = false } = {}) {
    if (!always && this.shown <= 0.01) return;
    const red = this.exhausted || (this.flash > 0 && Math.floor(this.flash * 12) % 2 === 0);
    const fill = this.value * Math.PI * 2;
    ctx.globalAlpha = always ? 1 : this.shown;
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
