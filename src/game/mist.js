// La traînée de brume du ninja de la brume (champ `dashFx: "mist"` du skin) : pendant le dash, des bouffées de
// brume se détachent de son corps et restent derrière lui ; elles enflent, montent à peine, dérivent un peu vers
// l'arrière et s'effacent. Au départ du dash, une bouffée plus épaisse (il « se dissout » dans la brume).
// Dessin en pixels du jeu : chaque bouffée est un petit nuage vaporeux, aux contours irréguliers (son rayon varie
// selon la direction : pas un rond parfait), dont l'opacité baisse doucement du cœur vers le bord, qui se défait
// en pixels épars (demande de Raph : moins net, moins détaillé, un peu flou). Purement décoratif.

const SHADES = ['#e2e9ef', '#d2dce5', '#bccad6', '#a5b5c4', '#8fa1b2'];
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

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
      life: (0.55 + Math.random() * 0.3) * (size > 1 ? 1.25 : 1),
      seed: (Math.random() * 1e6) | 0,
      ph: [Math.random() * 6.3, Math.random() * 6.3],
      squash: 1.1 + Math.random() * 0.35,
    });
  }

  draw(ctx, cam) {
    if (!this.puffs.length) return;
    ctx.save();
    for (const p of this.puffs) {
      const k = p.age / p.life, r = p.r0 + p.grow * p.age;
      const cx = Math.round(p.x - cam.x), cy = Math.round(p.y - cam.y), R = Math.ceil(r);
      const fade = k < 0.25 ? 1 : (1 - k) / 0.75;   // (pleine un instant, puis elle s'efface)
      for (let dy = -R - 1; dy <= R + 1; dy++) {
        for (let dx = -R - 1; dx <= R + 1; dx++) {
          // un contour bosselé : le rayon change avec la direction (deux ondulations), et la bouffée est aplatie
          const ang = Math.atan2(dy, dx);
          const rr = r * (1 + 0.24 * Math.sin(3 * ang + p.ph[0]) + 0.13 * Math.sin(5 * ang + p.ph[1]));
          const d = Math.hypot(dx, dy * p.squash) / rr;
          if (d > 1) continue;
          const X = cx + dx, Y = cy + dy;
          // le bord se défait en pixels épars (de plus en plus clairsemés vers l'extérieur)
          if (d > 0.6 && hash(X, Y, p.seed) < (d - 0.6) / 0.4 * 0.7) continue;
          // l'opacité baisse en douceur du cœur au bord ; la teinte fonce un peu vers le bord
          ctx.globalAlpha = fade * 0.58 * (1 - d * d * 0.75);
          ctx.fillStyle = SHADES[Math.min(SHADES.length - 1, Math.floor(d * SHADES.length))];
          ctx.fillRect(X, Y, 1, 1);
        }
      }
    }
    ctx.restore();
  }
}
