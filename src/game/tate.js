// TATE — garde au bouclier.
// De face, il bloque tout (sabre : étincelles ; shuriken : rebond). Il avance
// lentement, se retourne lentement, et charge d'un coup de bouclier quand KAGE
// est proche devant lui. Une charge ratée le laisse étourdi. Son point faible
// est le talisman dans son dos : 2 coups par-derrière le battent.

export const TATE = {
  walk: 18,            // px/s : lent et lourd
  patrol: 48,          // px de ronde de part et d'autre de son poste
  aggro: 150,          // px : distance à laquelle il repère KAGE
  bashRange: 44,       // px entre son bouclier et KAGE pour déclencher la charge
  turnDelay: 0.7,      // s pour se retourner (une ouverture pour passer derrière)
  windup: 0.45,        // s d'élan (le bouclier tremble)
  bashTime: 0.32,      // s de charge
  bashSpeed: 150,      // px/s pendant la charge
  stun: 1.4,           // s étourdi après une charge ratée
  cooldown: 0.9,       // s avant de pouvoir recharger
  guardFlash: 0.22,    // s de pose de garde quand un coup est bloqué
  hp: 2,
  defeatFade: 2.4,     // s avant de disparaître une fois vaincu (chute ≈ 0,94 s, puis au sol, puis fondu)
  fadeTime: 0.6,       // s de fondu à la fin
};

export class Tate {
  constructor(meta, sheet, glow, x, groundY) {
    this.meta = meta;
    this.sheet = sheet;
    this.glow = glow;
    this.home = x;
    this.groundY = groundY;
    this.reset();
  }

  reset() {
    this.x = this.home;
    this.y = this.groundY;
    this.facing = -1;          // tourné vers la gauche (vers le départ de KAGE)
    this.state = 'walk';
    this.timer = 0;
    this.anim = 0;
    this.hp = TATE.hp;
    this.turnTimer = 0;
    this.patrolDir = -1;
    this.cooldown = 0;
    this.flash = 0;
    this.bashHit = false;
    this.lastHit = -1;
    this.gone = false;
  }

  // ---- boîtes (en coordonnées du monde) ------------------------------------
  box(name) {
    const b = this.meta.boxes[name];
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? b.x - pivot.x : pivot.x - (b.x + b.w);
    return { x: this.x + ox, y: this.y - pivot.y + b.y, w: b.w, h: b.h };
  }

  get alive() {
    return this.state !== 'defeated';
  }

  /** Le dos est-il exposé à un attaquant situé en ax ? */
  backExposedTo(ax) {
    return this.state === 'stunned' || Math.sign(ax - this.x) === -this.facing;
  }

  // ---- coups reçus ----------------------------------------------------------
  /**
   * Un coup touche TATE : 'hit' (dans le dos), 'blocked' (sur le bouclier) ou
   * null (raté). `id` évite qu'un même coup de sabre compte plusieurs fois.
   */
  takeHit(box, attackerX, id = null) {
    if (!this.alive || (id !== null && id === this.lastHit)) return null;
    const body = this.box('body'), shield = this.box('shield');
    const touches = (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y;
    if (!touches(body) && !touches(shield)) return null;
    if (id !== null) this.lastHit = id;
    if (this.backExposedTo(attackerX)) {
      this.hp--;
      this.flash = 0.18;
      if (this.hp <= 0) {
        this.state = 'defeated';
        this.timer = 0;
      }
      return 'hit';
    }
    if (this.state === 'walk') {
      this.state = 'guard';
      this.timer = 0;
    }
    return 'blocked';
  }

  // ---- comportement ---------------------------------------------------------
  update(dt, player) {
    this.timer += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.state === 'defeated') {
      if (this.timer > TATE.defeatFade) this.gone = true;
      return;
    }
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const playerAlive = player.state !== 'death' && player.state !== 'respawn';
    const seen = playerAlive && dist < TATE.aggro;

    switch (this.state) {
      case 'guard':
        if (this.timer >= TATE.guardFlash) this.setState('walk');
        break;
      case 'windup':
        if (this.timer >= TATE.windup) {
          this.bashHit = false;
          this.setState('bash');
        }
        break;
      case 'bash': {
        this.x += this.facing * TATE.bashSpeed * dt;
        if (this.timer >= TATE.bashTime) {
          // charge ratée : étourdi ; réussie : il reprend sa marche
          if (this.bashHit) {
            this.cooldown = TATE.cooldown;
            this.setState('walk');
          } else {
            this.setState('stunned');
          }
        }
        break;
      }
      case 'stunned':
        if (this.timer >= TATE.stun) {
          this.cooldown = TATE.cooldown;
          this.setState('walk');
        }
        break;
      default: {   // marche
        if (seen) {
          // se retourne lentement vers KAGE
          const want = Math.sign(dx) || this.facing;
          if (want !== this.facing) {
            this.turnTimer += dt;
            if (this.turnTimer >= TATE.turnDelay) {
              this.facing = want;
              this.turnTimer = 0;
            }
          } else {
            this.turnTimer = 0;
            const gap = dist - 16;   // distance entre son bouclier et KAGE
            if (gap < TATE.bashRange && this.cooldown <= 0 && Math.abs(player.y - this.y) < 24) {
              this.setState('windup');
              break;
            }
            if (gap > 6) this.x += this.facing * TATE.walk * dt;
          }
        } else {
          // ronde autour de son poste
          this.turnTimer = 0;
          if (Math.abs(this.x + this.patrolDir * 1 - this.home) > TATE.patrol) this.patrolDir *= -1;
          this.facing = this.patrolDir;
          this.x += this.patrolDir * TATE.walk * 0.6 * dt;
        }
      }
    }
  }

  setState(s) {
    this.state = s;
    this.timer = 0;
  }

  /** Effets sur KAGE : charge mortelle, corps solide (sauf en glissade). */
  interact(player) {
    if (!this.alive || player.state === 'death' || player.state === 'respawn') return;
    const pb = player.box();
    const overlap = (b) => pb.x < b.x + b.w && pb.x + pb.w > b.x && pb.y < b.y + b.h && pb.y + pb.h > b.y;
    if (this.state === 'bash' && player.state !== 'slide' && overlap(this.box('bash'))) {
      this.bashHit = true;
      player.die();
      return;
    }
    if (player.state === 'slide') return;   // glisse entre ses jambes
    const body = this.box('body');
    const shield = this.box('shield');
    for (const b of [body, shield]) {
      if (!overlap(b)) continue;
      // repoussé sur le côté le plus proche
      const left = pb.x + pb.w - b.x, right = b.x + b.w - pb.x;
      player.x += left < right ? -left : right;
      if (Math.sign(player.vx) === (left < right ? 1 : -1)) player.vx = 0;
    }
  }

  // ---- dessin ---------------------------------------------------------------
  frameName() {
    if (this.state === 'defeated') {
      // un genou à terre (long), bascule (rapide), impact, au sol
      const a = this.meta.animations.defeated;
      let t = this.timer * 1000;
      for (let i = 0; i < a.frames.length; i++) {
        const d = a.durations[i];
        if (d === 0 || t < d) return a.frames[i];
        t -= d;
      }
      return a.frames[a.frames.length - 1];
    }
    if (this.state === 'walk') {
      const a = this.meta.animations.walk;
      return a.frames[Math.floor(this.anim * a.fps) % a.frames.length];
    }
    return this.meta.animations[this.state].frames[0];
  }

  draw(ctx, cam, player) {
    if (this.gone) return;
    const f = this.meta.frames[this.frameName()];
    const { pivot } = this.meta;
    // le bouclier tremble pendant l'élan ; il clignote quand il est touché
    let shake = this.state === 'windup' ? (Math.floor(this.timer * 30) % 2 ? 1 : -1) : 0;
    const sx = Math.round(this.x - cam.x) + shake;
    const sy = Math.round(this.y - cam.y) - pivot.y;
    let alpha = 1;
    if (this.state === 'defeated') alpha = Math.min(1, Math.max(0, (TATE.defeatFade - this.timer) / TATE.fadeTime));
    if (this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0) alpha *= 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    const blit = (img) => {
      if (this.facing > 0) {
        ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - pivot.x, sy, f.w, f.h);
      } else {
        ctx.save();
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, f.x, f.y, f.w, f.h, -pivot.x, sy, f.w, f.h);
        ctx.restore();
      }
    };
    blit(this.sheet);
    // halo du talisman : pulse quand le dos est exposé à KAGE
    if (this.alive && this.backExposedTo(player.x)) {
      ctx.globalAlpha = alpha * (0.45 + 0.45 * Math.sin(this.anim * 6));
      blit(this.glow);
    }
    ctx.restore();
  }
}
