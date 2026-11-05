// Effets visuels : particules en pixel art (poussière, étincelles), secousse
// de l'écran et micro-arrêt de l'image (« hit-stop ») sur les coups.

const COLORS = {
  dust: ['#d9d2c2', '#c4bba6', '#ece6d8'],
  spark: ['#fff6d8', '#f4e7b8', '#f0c25a'],
  hit: ['#f2ede6', '#e6e0d4'],
  straw: ['#e2d29d', '#c2ae78', '#8c7f57', '#e4d9b2'],   // brins de paille (WARA)
  feather: ['#0a0b11', '#171b26', '#262c3c', '#33405a'],  // plumes du corbeau
  dirt: ['#4a3322', '#6b4a2e', '#8a6844', '#3a281a'],     // mottes de terre
  paper: ['#efe6cf', '#ddd0ad', '#b8322a'],               // talisman déchiré
  fire: ['#fff3c4', '#f6c453', '#e0782c', '#9b3b22'],     // explosion d'un navet
};

export class Fx {
  constructor() {
    this.parts = [];
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.stopT = 0;
  }

  /**
   * Bouffée de poussière en (x, y) : n grains, poussés dans la direction dir
   * (-1, 0, 1), plus ou moins vers le haut.
   */
  dust(x, y, n = 4, { dir = 0, spread = 30, up = 25, life = 0.4, palette = 'dust' } = {}) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 4, y: y - Math.random() * 2,
        vx: dir * (20 + Math.random() * spread) + (Math.random() - 0.5) * spread,
        vy: -(Math.random() * up), g: 60, drag: 3,
        life: life * (0.6 + Math.random() * 0.6), t: 0,
        size: Math.random() < 0.35 ? 2 : 1,
        color: COLORS[palette][Math.floor(Math.random() * COLORS[palette].length)],
      });
    }
  }

  /** Gerbe d'étincelles (coup bloqué, impact). */
  sparks(x, y, n = 6, { dir = 0, speed = 90, palette = 'spark' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (dir === 0 ? Math.random() * Math.PI * 2 : (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6);
      const v = speed * (0.5 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 200, drag: 1,
        life: 0.15 + Math.random() * 0.15, t: 0, size: 1,
        color: COLORS[palette][Math.floor(Math.random() * COLORS[palette].length)],
      });
    }
  }

  /**
   * Débris lents (plumes, papier) : ils flottent et retombent en se balançant.
   */
  drift(x, y, n = 4, { palette = 'feather', speed = 50, up = 30, life = 1.1, g = 40 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6), vy: -Math.random() * up, g, drag: 2.5,
        life: life * (0.7 + Math.random() * 0.6), t: 0, size: Math.random() < 0.5 ? 2 : 1, sway: 6 + Math.random() * 6,
        color: COLORS[palette][Math.floor(Math.random() * COLORS[palette].length)],
      });
    }
  }

  shake(amp, time) {
    if (amp >= this.shakeAmp || this.shakeT <= 0) {
      this.shakeAmp = amp;
      this.shakeT = time;
    }
  }

  hitStop(time) {
    this.stopT = Math.max(this.stopT, time);
  }

  /** true tant que le jeu doit rester figé (micro-arrêt). */
  frozen(dt) {
    if (this.stopT <= 0) return false;
    this.stopT -= dt;
    return true;
  }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.vx -= p.vx * Math.min(1, p.drag * dt);
      p.x += (p.vx + (p.sway ? Math.sin(p.t * 7 + p.sway) * p.sway : 0)) * dt;
      p.y += p.vy * dt;
      if (p.sway) p.vy = Math.min(p.vy, 22);   // plume : elle plane
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  }

  /** Décalage de caméra dû à la secousse (en pixels entiers). */
  offset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const a = Math.ceil(this.shakeAmp * Math.min(1, this.shakeT * 8));
    return { x: Math.round((Math.random() * 2 - 1) * a), y: Math.round((Math.random() * 2 - 1) * a) };
  }

  draw(ctx, cam) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
