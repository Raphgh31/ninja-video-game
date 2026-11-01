// Shurikens : stock de 3, projectiles en vol, plantés dans le décor puis
// ramassés en passant dessus.
import { TILE } from './level.js';

export const SHURIKEN = {
  speed: 260,        // px/s, horizontal, constant
  range: 160,        // portée sur terrain plat, lancé à l'arrêt : 10 carreaux
  stock: 3,          // shurikens portés au maximum
  pickupMargin: 4,   // px autour du personnage pour ramasser un shuriken planté
  pickupDelay: 0.3,  // s avant de pouvoir ramasser un shuriken qui vient de se planter
  spinStep: 0.12,    // s par image de rotation (rotation lente et lisible)
};

export class Shurikens {
  constructor(level, meta) {
    this.level = level;
    this.meta = meta.projectiles.shuriken;
    this.flying = [];
    this.stuck = [];
    this.stock = SHURIKEN.stock;
    this.emptyBlink = 0;   // clignotement du compteur quand on essaie de lancer sans stock
  }

  /** Réapparition : tout redevient disponible. */
  reset() {
    this.flying = [];
    this.stuck = [];
    this.stock = SHURIKEN.stock;
  }

  canThrow() {
    if (this.stock > 0) return true;
    this.emptyBlink = 0.45;
    return false;
  }

  /** Ramasse les shurikens plantés touchés par la boîte du personnage. */
  pickup(box) {
    const m = SHURIKEN.pickupMargin;
    this.stuck = this.stuck.filter((s) => {
      if (this.stock >= SHURIKEN.stock || s.age < SHURIKEN.pickupDelay) return true;
      const hit = s.x >= box.x - m && s.x <= box.x + box.w + m && s.y >= box.y - m && s.y <= box.y + box.h + m;
      if (hit) this.stock++;
      return !hit;
    });
  }

  /**
   * Lance un shuriken depuis (x, y). `height` = hauteur du point de lâcher
   * au-dessus des pieds : la gravité est réglée pour qu'il touche un sol plat
   * exactement à `range` px devant.
   */
  throw(x, y, dir, height) {
    if (this.stock <= 0) return;
    this.stock--;
    // lancé collé à un mur : le point de lâcher est déjà dans le mur, il se
    // plante directement dans sa face
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (this.level.solid(tx, ty)) {
      this.plant({ kind: 'stuck_wall', x: dir > 0 ? tx * TILE : (tx + 1) * TILE, y: Math.round(y), dir });
      return;
    }
    const t = SHURIKEN.range / SHURIKEN.speed;
    const gravity = (2 * height) / (t * t);
    this.flying.push({ x, y, vx: dir * SHURIKEN.speed, vy: 0, gravity, dir, t: 0 });
  }

  update(dt) {
    const lv = this.level;
    this.emptyBlink = Math.max(0, this.emptyBlink - dt);
    for (const s of this.stuck) s.age += dt;
    for (const s of this.flying) {
      s.t += dt;
      const px = s.x, py = s.y;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
      // cible d'entraînement : elle se brise, le shuriken est dévié et retombe
      if (lv.hitTargets({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 }, s.dir)) {
        s.vx *= -0.2;
        s.vy = -40;
        s.gravity = Math.max(s.gravity, 400);
      }
      if (lv.solid(tx, ty)) {
        const ptx = Math.floor(px / TILE);
        if (ptx !== tx && !lv.solid(ptx, ty)) {
          // entrée par le côté : planté dans le mur
          const wx = s.dir > 0 ? tx * TILE : (tx + 1) * TILE;
          this.plant({ kind: 'stuck_wall', x: wx, y: Math.round(s.y), dir: s.dir });
        } else {
          // entrée par le dessus : planté dans le sol, avec une des deux
          // inclinaisons tirée au hasard (la rotation à l'impact varie)
          const variants = this.meta.ground;
          const kind = variants[Math.floor(Math.random() * variants.length)];
          this.plant({ kind, x: Math.round(s.x), y: ty * TILE, dir: 1 });
        }
        s.dead = true;
      } else if (s.x < -32 || s.x > lv.width + 32 || s.y > lv.height + 32) {
        s.dead = true;
        this.stock++;      // perdu hors du niveau : il revient dans le stock
      }
    }
    this.flying = this.flying.filter((s) => !s.dead);
  }

  plant(d) {
    this.stuck.push({ ...d, age: 0 });
  }

  /** Compteur en haut à gauche de l'écran (coordonnées écran, coin haut-gauche en x, y). */
  drawHud(ctx, sheet, x = 4, y = 4) {
    const f = this.meta.frames[this.meta.spin[0]];
    const blinkOn = this.emptyBlink > 0 && Math.floor(this.emptyBlink * 12) % 2 === 0;
    for (let i = 0; i < SHURIKEN.stock; i++) {
      ctx.globalAlpha = i < this.stock ? 1 : blinkOn ? 0.75 : 0.25;
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, x + i * 11, y, f.w, f.h);
    }
    ctx.globalAlpha = 1;
  }

  /** Les shurikens plantés font partie du décor : dessinés avant le personnage. */
  drawStuck(ctx, sheet, cam) {
    for (const s of this.stuck) this.blit(ctx, sheet, s.kind, s.x, s.y, s.dir, cam);
  }

  drawFlying(ctx, sheet, cam) {
    for (const s of this.flying) {
      const k = this.meta.spin[Math.floor(s.t / SHURIKEN.spinStep) % this.meta.spin.length];
      this.blit(ctx, sheet, k, s.x, s.y, 1, cam);
    }
  }

  // Dessine l'image `kind` de façon que son ancre tombe sur (x, y) : le pixel
  // juste avant la surface (mur / sol). dir < 0 : image retournée (mur à gauche).
  blit(ctx, sheet, kind, x, y, dir, cam) {
    const f = this.meta.frames[kind];
    const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y);
    const oy = kind.startsWith('stuck_ground') ? 1 : 0;
    if (dir < 0) {
      ctx.save();
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -f.anchor.x - 1, sy - f.anchor.y - oy, f.w, f.h);
      ctx.restore();
    } else {
      const ox = kind === 'stuck_wall' ? 1 : 0;
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, sx - f.anchor.x - ox, sy - f.anchor.y - oy, f.w, f.h);
    }
  }
}
