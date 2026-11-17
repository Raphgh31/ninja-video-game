import { DAMAGE_DEALT } from './combat.js';

// Shurikens : stock de 3, projectiles en vol, plantés dans le décor puis
// ramassés en passant dessus.
import { TILE } from './level.js';

export const SHURIKEN = {
  speed: 260,        // px/s, horizontal, constant
  range: 160,        // portée sur terrain plat, lancé à l'arrêt : 10 carreaux
  stock: 3,          // shurikens portés au maximum
  pickupMargin: 4,   // px autour du personnage pour ramasser un shuriken planté
  pickupDelay: 0.3,  // s avant de pouvoir ramasser un shuriken qui vient de se planter
  spinStep: 0.16,    // s par image de rotation (ralentie : on reconnaît l'étoile)
};

export class Shurikens {
  constructor(level, meta) {
    this.level = level;
    this.meta = meta.projectiles.shuriken;
    this.flying = [];
    this.stuck = [];
    this.dust = [];        // poussière d'or (skin à traînée) ou gouttes d'eau (pêcheur) derrière le projectile
    this.dustKind = null;  // 'gold' ou 'water' : choisi par drawFlying selon le skin
    this.stock = SHURIKEN.stock;
    this.emptyBlink = 0;
    this.enemies = [];     // ennemis touchables (méthode takeHit)   // clignotement du compteur quand on essaie de lancer sans stock
  }

  /** Réapparition : tout redevient disponible. */
  reset() {
    this.flying = [];
    this.stuck = [];
    this.dust = [];
    this.stock = SHURIKEN.stock;
  }

  canThrow() {
    if (this.stock > 0) return true;
    this.emptyBlink = 0.45;
    this.onEvent?.('empty', {});
    return false;
  }

  /** Ramasse les shurikens plantés touchés par la boîte du personnage. */
  pickup(box) {
    const m = SHURIKEN.pickupMargin;
    this.stuck = this.stuck.filter((s) => {
      if (this.stock >= SHURIKEN.stock || s.age < SHURIKEN.pickupDelay) return true;
      const hit = s.x >= box.x - m && s.x <= box.x + box.w + m && s.y >= box.y - m && s.y <= box.y + box.h + m;
      if (hit) {
        this.stock++;
        this.onEvent?.('pickup', { x: s.x, y: s.y });
      }
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
    this.updateDust(dt);
    for (const s of this.flying) {
      s.t += dt;
      const px = s.x, py = s.y;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
      // ennemi : bloqué par le bouclier ou touché dans le dos ; dans les deux
      // cas le shuriken est dévié et retombe (il reste récupérable)
      if (!s.deflected) {
        const box = { x: s.x - 2, y: s.y - 2, w: 4, h: 4 };
        for (const e of this.enemies) {
          if (e.takeHit(box, s.x - s.dir * 20, null, DAMAGE_DEALT.shuriken)) {
            s.deflected = true;
            this.onEvent?.('deflect', { x: s.x, y: s.y, dir: -s.dir });
            s.vx *= -0.2;
            s.vy = -60;
            s.gravity = Math.max(s.gravity, 400);
            break;
          }
        }
      }
      // gong : il sonne et ouvre les portes ; le shuriken retombe
      if (!s.deflected && lv.hitGongs?.({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 })) {
        s.deflected = true;
        s.vx *= -0.2;
        s.vy = -60;
        s.gravity = Math.max(s.gravity, 400);
      }
      // corde d'une grue : il la tranche et poursuit sa course
      lv.cutRope?.({ x: s.x - 3, y: s.y - 3, w: 6, h: 6 });
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
          // (un poisson se plante la tête la première, la queue vers l'arrière : selon le sens du lancer)
          if (this.faces) this.plant({ kind: variants[0], x: Math.round(s.x), y: ty * TILE, dir: s.dir });
          else this.plant({ kind: variants[Math.floor(Math.random() * variants.length)], x: Math.round(s.x), y: ty * TILE, dir: 1 });
        }
        s.dead = true;
      } else if (s.x < -32 || s.x > lv.width + 32 || s.y > lv.height + 32) {
        s.dead = true;
        this.stock++;      // perdu hors du niveau : il revient dans le stock
      }
    }
    this.flying = this.flying.filter((s) => !s.dead);
  }

  /** Poussière d'or : quelques grains semés derrière chaque shuriken en vol, qui flottent, scintillent et s'éteignent. */
  updateDust(dt) {
    for (const d of this.dust) {
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 1 - 6 * dt;
      d.vy += (d.water ? 260 : 14) * dt;   // l'or retombe à peine ; une goutte tombe
    }
    this.dust = this.dust.filter((d) => d.age < d.life);
    if (!this.dustKind) return;
    const water = this.dustKind === 'water';
    for (const s of this.flying) {
      if (s.deflected || Math.abs(s.vx) < 40) continue;
      s.dustT = (s.dustT ?? 0) - dt;
      if (s.dustT > 0) continue;
      s.dustT = water ? 0.01 + Math.random() * 0.012 : 0.014 + Math.random() * 0.016;
      this.dust.push(water ? {
        // une micro-gouttelette qui se détache du poisson (derrière sa queue) et retombe
        x: s.x - s.dir * (3 + Math.random() * 4), y: s.y + (Math.random() * 4 - 1.5),
        vx: s.vx * 0.3 + (Math.random() * 14 - 7), vy: -6 - Math.random() * 26,
        age: 0, life: 0.18 + Math.random() * 0.22, water: true, ph: 0,
      } : {
        x: s.x - s.dir * (3 + Math.random() * 3), y: s.y + (Math.random() * 5 - 2.5),
        vx: s.vx * 0.4 + (Math.random() * 12 - 6), vy: Math.random() * 16 - 10,
        age: 0, life: 0.16 + Math.random() * 0.2, star: Math.random() < 0.18, ph: Math.random() * 6,
      });
    }
  }

  drawDust(ctx, cam) {
    if (!this.dust.length) return;
    ctx.save();
    for (const d of this.dust) {
      const k = d.age / d.life;
      // scintillement : le grain s'allume et s'éteint vite en pâlissant
      const tw = 0.7 + 0.3 * Math.sin(d.ph + d.age * 38);
      ctx.globalAlpha = Math.max(0, (1 - k * k) * tw);
      const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
      if (d.water) {
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.fillStyle = k < 0.35 ? '#eef8ff' : k < 0.7 ? '#a9d6ec' : '#5f9cc0';
        ctx.fillRect(x, y, 1, 1);
        continue;
      }
      ctx.fillStyle = k < 0.4 ? '#fff8d8' : k < 0.75 ? '#ffe07a' : '#f2b440';
      ctx.fillRect(x, y, 1, 1);
      if (d.star && k < 0.55 && tw > 0.8) {   // petite étoile en croix au plus fort de l'éclat
        ctx.fillStyle = '#ffe07a';
        ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
      }
    }
    ctx.restore();
  }

  plant(d) {
    this.stuck.push({ ...d, age: 0 });
    this.onEvent?.('stick', d);
  }

  /** Compteur en haut à gauche de l'écran (coordonnées écran, coin haut-gauche en x, y). */
  drawHud(ctx, sheet, x = 4, y = 4) {
    const m = sheet.projMeta ?? this.meta;
    const f = m.frames[m.hud ?? m.spin[0]];   // petite icône
    const blinkOn = this.emptyBlink > 0 && Math.floor(this.emptyBlink * 12) % 2 === 0;
    for (let i = 0; i < SHURIKEN.stock; i++) {
      ctx.globalAlpha = i < this.stock ? 1 : blinkOn ? 0.75 : 0.25;
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, x + i * (m.hudStep ?? 11), y, f.w, f.h);   // (les poissons du pêcheur, plus grands : hudStep)
    }
    ctx.globalAlpha = 1;
  }

  /** Les shurikens plantés font partie du décor : dessinés avant le personnage. */
  drawStuck(ctx, sheet, cam) {
    for (const s of this.stuck) this.blit(ctx, sheet, s.kind, s.x, s.y, s.dir, cam);
  }

  /** trail : un skin à traînée (Lumière d'or) laisse derrière chaque shuriken trois reflets qui pâlissent ;
   *  faces : le projectile regarde dans le sens du vol (les poissons du pêcheur) ; dust : 'water' (gouttes). */
  drawFlying(ctx, sheet, cam, trail = false, { faces = false, dust = null } = {}) {
    this.dustKind = dust ?? (trail ? 'gold' : null);
    this.faces = faces;
    for (const s of this.flying) {
      const dir = faces ? (s.vx < 0 ? -1 : 1) : 1;
      const k = this.meta.spin[Math.floor(s.t / SHURIKEN.spinStep) % this.meta.spin.length];
      if (trail && Math.abs(s.vx) > 40) {
        ctx.save();
        for (let i = 3; i >= 1; i--) {
          ctx.globalAlpha = 0.32 - i * 0.08;
          const kk = this.meta.spin[Math.floor((s.t - i * 0.02) / SHURIKEN.spinStep + 64) % this.meta.spin.length];
          this.blit(ctx, sheet, kk, s.x - s.vx * 0.016 * i, s.y - s.vy * 0.016 * i, dir, cam);
        }
        ctx.restore();
      }
      this.blit(ctx, sheet, k, s.x, s.y, dir, cam);
    }
    this.drawDust(ctx, cam);
  }

  // Dessine l'image `kind` de façon que son ancre tombe sur (x, y) : le pixel
  // juste avant la surface (mur / sol). dir < 0 : image retournée (mur à gauche).
  blit(ctx, sheet, kind, x, y, dir, cam) {
    const f = (sheet.projMeta ?? this.meta).frames[kind];   // (les cases de la planche dessinée : poissons ou shurikens)
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
