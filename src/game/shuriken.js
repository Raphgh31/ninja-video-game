// Shurikens : projectiles en vol, puis plantés dans le décor.
import { TILE } from './level.js';

export const SHURIKEN = {
  speed: 260,        // px/s, horizontal, constant
  range: 160,        // portée sur terrain plat, lancé à l'arrêt : 10 carreaux
  maxStuck: 40,      // nombre de shurikens plantés conservés dans le décor
  spinStep: 0.12,    // s par image de rotation (rotation lente et lisible)
};

export class Shurikens {
  constructor(level, meta) {
    this.level = level;
    this.meta = meta.projectiles.shuriken;
    this.flying = [];
    this.stuck = [];
  }

  /**
   * Lance un shuriken depuis (x, y). `height` = hauteur du point de lâcher
   * au-dessus des pieds : la gravité est réglée pour qu'il touche un sol plat
   * exactement à `range` px devant.
   */
  throw(x, y, dir, height) {
    const t = SHURIKEN.range / SHURIKEN.speed;
    const gravity = (2 * height) / (t * t);
    this.flying.push({ x, y, vx: dir * SHURIKEN.speed, vy: 0, gravity, dir, t: 0 });
  }

  update(dt) {
    const lv = this.level;
    for (const s of this.flying) {
      s.t += dt;
      const px = s.x, py = s.y;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
      // cible d'entraînement
      if (lv.hitTargets({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 }, s.dir)) {
        s.dead = true;
        continue;
      }
      if (lv.solid(tx, ty)) {
        const ptx = Math.floor(px / TILE);
        if (ptx !== tx && !lv.solid(ptx, ty)) {
          // entrée par le côté : planté dans le mur
          const wx = s.dir > 0 ? tx * TILE : (tx + 1) * TILE;
          this.plant({ kind: 'stuck_wall', x: wx, y: Math.round(s.y), dir: s.dir });
        } else {
          // entrée par le dessus : planté dans le sol
          this.plant({ kind: 'stuck_ground', x: Math.round(s.x), y: ty * TILE, dir: s.dir });
        }
        s.dead = true;
      } else if (s.x < -32 || s.x > lv.width + 32 || s.y > lv.height + 32) {
        s.dead = true;
      }
    }
    this.flying = this.flying.filter((s) => !s.dead);
  }

  plant(d) {
    this.stuck.push(d);
    if (this.stuck.length > SHURIKEN.maxStuck) this.stuck.shift();
  }

  /** Les shurikens plantés font partie du décor : dessinés avant le personnage. */
  drawStuck(ctx, sheet, cam) {
    for (const s of this.stuck) this.blit(ctx, sheet, s.kind, s.x, s.y, s.kind === 'stuck_wall' ? s.dir : 1, cam);
  }

  drawFlying(ctx, sheet, cam) {
    for (const s of this.flying) {
      const k = this.meta.spin[Math.floor(s.t / SHURIKEN.spinStep) % this.meta.spin.length];
      this.blit(ctx, sheet, k, s.x, s.y, 1, cam);
    }
  }

  // Dessine l'image `kind` de façon que son ancre tombe sur (x, y). Pour un mur
  // à gauche (dir < 0), l'image est retournée.
  blit(ctx, sheet, kind, x, y, dir, cam) {
    const f = this.meta.frames[kind];
    const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y);
    if (dir < 0) {
      ctx.save();
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -f.anchor.x - 1, sy - f.anchor.y, f.w, f.h);
      ctx.restore();
    } else {
      // l'ancre est posée sur le pixel juste avant la surface (mur à droite / sol dessous)
      const ox = kind === 'stuck_wall' ? 1 : 0, oy = kind === 'stuck_ground' ? 1 : 0;
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, sx - f.anchor.x - ox, sy - f.anchor.y - oy, f.w, f.h);
    }
  }
}
