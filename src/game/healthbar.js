// Barre de vie fine, au-dessus d'un personnage (KAGE comme ennemis).
// Jauge continue d'1 px, longueur proportionnelle au nombre de vies. Quand des
// dégâts arrivent, le vert descend en douceur ; la portion perdue reste un
// instant en pâle puis se vide (on voit ce qu'on vient de perdre).

const LOOK = {
  perHp: 3.5,            // px de barre par point de vie (arrondi au pixel)
  height: 1,             // jauge très fine (hors contour)
  alpha: 0.75,           // discrète (fond et contour)
  greenAlpha: 0.92,      // le vert, un peu plus franc
  green: '#86d374',
  trail: '#f2ede6',      // portion qui vient d'être perdue
  empty: 'rgba(27, 30, 39, 0.7)',
  edge: 'rgba(6, 7, 10, 0.55)',   // contour léger
};
const SPEED = {
  follow: 12,            // vitesse à laquelle le vert rejoint la vraie valeur
  trailDelay: 0.35,      // s avant que la portion perdue commence à se vider
  trailDrain: 0.9,       // fraction de barre vidée par seconde
};

export class HealthBar {
  constructor(max) {
    this.max = max;
    this.reset();
  }

  reset() {
    this.shown = 1;      // fraction affichée en vert
    this.trail = 1;      // fraction affichée en pâle (en retard)
    this.last = 1;       // dernière valeur réelle
    this.sinceHit = 99;
  }

  update(dt, hp) {
    const target = Math.max(0, Math.min(1, hp / this.max));
    this.sinceHit += dt;
    if (target < this.last - 1e-4) this.sinceHit = 0;   // nouveau dégât
    this.last = target;
    if (target > this.shown) {
      // soin / réapparition : on remonte directement
      this.shown = target;
      this.trail = Math.max(this.trail, target);
    } else {
      this.shown += (target - this.shown) * Math.min(1, dt * SPEED.follow);
      if (this.shown - target < 0.002) this.shown = target;
    }
    if (this.sinceHit > SPEED.trailDelay && this.trail > this.shown) {
      this.trail = Math.max(this.shown, this.trail - SPEED.trailDrain * dt);
    }
  }

  /** Dessine la barre centrée sur cx, son bord haut en y (pixels du jeu). */
  draw(ctx, cx, y, alpha = 1) {
    const w = Math.round(this.max * LOOK.perHp);
    const x = Math.round(cx - w / 2);
    y = Math.round(y);
    const h = LOOK.height;
    ctx.save();
    ctx.globalAlpha = LOOK.alpha * alpha;
    // contour léger (sans les coins, plus doux)
    ctx.fillStyle = LOOK.edge;
    ctx.fillRect(x, y - 1, w, 1);
    ctx.fillRect(x, y + h, w, 1);
    ctx.fillRect(x - 1, y, 1, h);
    ctx.fillRect(x + w, y, 1, h);
    ctx.fillStyle = LOOK.empty;
    ctx.fillRect(x, y, w, h);
    const tw = Math.round(this.trail * w);
    const gw = Math.round(this.shown * w);
    if (tw > gw) {
      ctx.fillStyle = LOOK.trail;
      ctx.fillRect(x + gw, y, tw - gw, h);
    }
    if (gw > 0) {
      ctx.globalAlpha = LOOK.greenAlpha * alpha;
      ctx.fillStyle = LOOK.green;
      ctx.fillRect(x, y, gw, h);
    }
    ctx.restore();
  }
}
