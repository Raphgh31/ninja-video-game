// La traînée de brume du ninja de la brume (champ `dashFx: "mist"` du skin) : pendant le dash, des bouffées de
// brume se détachent de son corps et restent derrière lui ; elles enflent, montent à peine, dérivent un peu vers
// l'arrière et s'effacent. Au départ du dash, une bouffée plus épaisse (il « se dissout » dans la brume).
// Dessin en pixels du jeu : chaque bouffée est un petit nuage tramé (cœur clair, bord gris-bleu, une trame en
// damier qui s'éclaircit vers le bord) ; rien de flou. Purement décoratif : rien ne change au jeu.

const CORE = '#e2e9ef', MID = '#bccad6', EDGE = '#8fa1b2';

export class Mist {
  constructor() {
    this.puffs = [];
    this.was = false;     // dash à l'image d'avant
    this.lastX = 0;
  }

  /** active : le skin porté a la traînée de brume ; player : KAGE (état, position, sens). */
  update(dt, player, active) {
    for (const p of this.puffs) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;     // l'air la freine : elle reste là où il est passé
      p.vy *= 1 - 1.5 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life);
    const dash = active && player.state === 'dash';
    if (dash && !this.was) {
      // le départ : une bouffée épaisse là où il était
      for (let i = 0; i < 5; i++) this.emit(player, 1.6, i);
      this.lastX = player.x;
    } else if (dash) {
      // une bouffée tous les 6 pixels parcourus (rattrape le chemin entier si l'image a sauté)
      const f = player.facing || 1;
      while (Math.abs(player.x - this.lastX) >= 6) {
        this.lastX += 6 * Math.sign(player.x - this.lastX);
        this.emit({ x: this.lastX, y: player.y, facing: f }, 1, this.puffs.length);
      }
    }
    this.was = dash;
  }

  emit(player, size, i) {
    const f = player.facing || 1;
    this.puffs.push({
      x: player.x - f * (2 + Math.random() * 6),
      y: player.y - 4 - Math.random() * 15 - (i % 3) * 2,
      vx: -f * (6 + Math.random() * 12),
      vy: -3 - Math.random() * 5,
      r0: (2.8 + Math.random() * 1.6) * size,
      grow: (4 + Math.random() * 3) * Math.min(size, 1.2),
      age: 0,
      life: (0.8 + Math.random() * 0.45) * (size > 1 ? 1.3 : 1),
      seed: (Math.random() * 4) | 0,
    });
  }

  draw(ctx, cam) {
    if (!this.puffs.length) return;
    ctx.save();
    for (const p of this.puffs) {
      const k = p.age / p.life, r = p.r0 + p.grow * p.age;
      const cx = Math.round(p.x - cam.x), cy = Math.round(p.y - cam.y), R = Math.ceil(r);
      const fade = k < 0.25 ? 1 : (1 - k) / 0.75;   // (pleine un instant, puis elle s'efface)
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy * 1.25) / r;    // (un peu aplatie : la brume s'étale)
          if (d > 1) continue;
          // la trame : pleine au cœur, en damier vers le bord, clairsemée à l'extrême bord
          const X = cx + dx, Y = cy + dy;
          if (d > 0.55 && (X + Y + p.seed) % 2) continue;
          if (d > 0.85 && (X + p.seed) % 3) continue;
          ctx.globalAlpha = fade * (d < 0.45 ? 0.82 : 0.62);
          ctx.fillStyle = d < 0.45 ? CORE : d < 0.75 ? MID : EDGE;
          ctx.fillRect(X, Y, 1, 1);
        }
      }
    }
    ctx.restore();
  }
}
