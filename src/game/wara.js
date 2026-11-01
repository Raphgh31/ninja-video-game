// WARA — l'épouvantail du dojo.
// Il avance en sautillant sur son pieu. Quand KAGE est tout près, son chapeau
// saute (signal), puis sa traverse tourne en hélice et touche des deux côtés :
// passer dans son dos ne protège pas. Après son moulinet, il a le tournis :
// c'est le moment de frapper. Pendant le moulinet, la traverse pare le sabre.
// 2 points de vie : un coup de sabre suffit ; abîmé (1 PV), il est plus vif.

import { DAMAGE_DEALT, DAMAGE_TAKEN } from './combat.js';
import { TILE } from './level.js';

export const WARA = {
  hp: 2,               // sabre 2 → un coup suffit ; shuriken 1
  aggro: 120,          // px : distance à laquelle il repère KAGE
  spinRange: 30,       // px (de centre à centre) pour déclencher le moulinet
  patrol: 40,          // px de ronde de part et d'autre de son poste
  hopLength: 20,       // px parcourus par bond
  hopHeight: 14,       // px de hauteur de bond
  hopAir: 0.42,        // s en l'air
  crouch: 0.12,        // s tassé avant de sauter
  land: 0.14,          // s d'atterrissage
  hopRest: 0.55,       // s de repos entre deux bonds (vers KAGE)
  hopRestTorn: 0.3,    // ... abîmé : plus vif
  patrolRest: 1.2,     // s de repos entre deux bonds (en ronde)
  windup: 0.45,        // s de signal (le chapeau saute)
  windupTorn: 0.3,     // ... abîmé
  spin: 0.5,           // s de moulinet
  dizzy: 0.9,          // s de tournis (sans défense)
  cooldown: 0.6,       // s après le tournis avant un nouveau moulinet
  hurt: 0.25,          // s de recul quand il est touché
  knockback: 70,       // px/s de recul
  defeatFade: 2.4,     // s avant de disparaître une fois vaincu
  fadeTime: 0.6,       // s de fondu à la fin
  pushDecel: 700,      // px/s² : freinage du recul donné par un coup de pied
};

export class Wara {
  constructor(meta, sheet, x, groundY, level = null) {
    this.meta = meta;
    this.sheet = sheet;
    this.level = level;
    this.home = x;
    this.groundY = groundY;
    this.reset();
  }

  reset() {
    this.x = this.home;
    this.y = this.groundY;
    this.facing = -1;           // tourné vers la gauche (vers le départ de KAGE)
    this.state = 'idle';
    this.timer = 0;
    this.anim = 0;
    this.hp = WARA.hp;
    this.rest = 0.3 + ((this.home / TILE) % 5) * 0.15;   // décale les groupes
    this.patrolDir = -1;
    this.hopDir = -1;
    this.hopFrom = this.x;
    this.lift = 0;              // hauteur du bond (px)
    this.cooldown = 0;
    this.flash = 0;
    this.spinHit = false;
    this.lastHit = -1;
    this.lastFrame = null;
    this.gone = false;
    this.shove = 0;             // recul en cours (px/s), donné par un coup de pied
  }

  /** Coup de pied : WARA est repoussé (même pendant son moulinet). */
  push(dir, speed) {
    if (this.alive) this.shove = dir * speed;
  }

  applyShove(dt) {
    if (!this.shove || this.state === 'air') return;
    const dir = Math.sign(this.shove);
    if (this.canStep(dir)) this.x += this.shove * dt;
    else this.shove = 0;
    const v = Math.max(0, Math.abs(this.shove) - WARA.pushDecel * dt);
    this.shove = dir * v;
  }

  get alive() { return this.state !== 'defeated'; }
  get torn() { return this.hp <= 1; }

  // ---- boîtes (en coordonnées du monde) ------------------------------------
  box(name) {
    const b = this.meta.boxes[name];
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? b.x - pivot.x : pivot.x - (b.x + b.w);
    return { x: this.x + ox, y: this.y - this.lift - pivot.y + b.y, w: b.w, h: b.h };
  }

  /** Peut-il bondir dans cette direction ? (pas de mur, du sol à l'arrivée) */
  canHop(dir) {
    const lv = this.level;
    if (!lv) return true;
    const to = this.x + dir * WARA.hopLength;
    const tx = Math.floor((to + dir * 6) / TILE);
    const wall = lv.solid(tx, Math.floor((this.y - 8) / TILE)) || lv.solid(tx, Math.floor((this.y - 24) / TILE));
    const ground = lv.solid(Math.floor(to / TILE), Math.floor((this.y + 2) / TILE));
    return !wall && ground;
  }

  // ---- coups reçus ----------------------------------------------------------
  /**
   * Un coup touche WARA : 'hit', 'blocked' (la traverse en hélice pare) ou
   * null (raté). `id` évite qu'un même coup de sabre compte plusieurs fois.
   */
  takeHit(box, attackerX, id = null, dmg = DAMAGE_DEALT.sword) {
    if (!this.alive || (id !== null && id === this.lastHit)) return null;
    const touches = (b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y;
    const body = this.box('body');
    if (this.state === 'spin') {
      if (!touches(this.box('spin'))) return null;
      if (id !== null) this.lastHit = id;
      this.onEvent?.('block', { x: this.x, y: this.y - 16, facing: Math.sign(attackerX - this.x) || 1 });
      return 'blocked';
    }
    if (!touches(body)) return null;
    if (id !== null) this.lastHit = id;
    this.hp -= dmg;
    this.flash = 0.18;
    this.onEvent?.('hit', { x: this.x, y: this.y - this.lift, dmg });
    if (this.hp <= 0) {
      this.lift = 0;
      this.setState('defeated');
    } else {
      // recul : le coup interrompt son bond ou son signal
      this.facing = Math.sign(attackerX - this.x) || this.facing;
      this.hopDir = -this.facing;
      this.setState('hurt');
    }
    return 'hit';
  }

  // ---- comportement ---------------------------------------------------------
  update(dt, player) {
    this.timer += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.state === 'defeated') {
      const f = this.frameName();
      if (f !== this.lastFrame) {
        this.lastFrame = f;
        if (f === 'death_poof' || f === 'death_pile') this.onEvent?.(f, { x: this.x, y: this.y, facing: this.facing });
      }
      if (this.timer > WARA.defeatFade) this.gone = true;
      return;
    }
    this.applyShove(dt);
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const playerAlive = player.state !== 'death' && player.state !== 'respawn';
    const seen = playerAlive && dist < WARA.aggro && Math.abs(player.y - this.y) < 40;

    switch (this.state) {
      case 'crouch':
        if (this.timer >= WARA.crouch) {
          this.hopFrom = this.x;
          this.setState('air');
        }
        break;
      case 'air': {
        const k = Math.min(1, this.timer / WARA.hopAir);
        this.x = this.hopFrom + this.hopDir * WARA.hopLength * k;
        this.lift = 4 * WARA.hopHeight * k * (1 - k);
        if (k >= 1) {
          this.lift = 0;
          this.setState('land');
        }
        break;
      }
      case 'land':
        if (this.timer >= WARA.land) this.setState('idle');
        break;
      case 'windup':
        if (this.timer >= (this.torn ? WARA.windupTorn : WARA.windup)) {
          this.spinHit = false;
          this.setState('spin');
        }
        break;
      case 'spin':
        if (this.timer >= WARA.spin) this.setState('dizzy');
        break;
      case 'dizzy':
        if (this.timer >= WARA.dizzy) {
          this.cooldown = WARA.cooldown;
          this.rest = WARA.cooldown;
          this.setState('idle');
        }
        break;
      case 'hurt': {
        const step = this.hopDir * WARA.knockback * dt;
        if (this.canStep(this.hopDir)) this.x += step;
        if (this.timer >= WARA.hurt) {
          this.rest = 0.35;
          this.setState('idle');
        }
        break;
      }
      default: {   // au repos, entre deux bonds
        this.rest -= dt;
        if (seen) {
          this.facing = Math.sign(dx) || this.facing;
          if (dist < WARA.spinRange && this.cooldown <= 0 && Math.abs(player.y - this.y) < 24) {
            this.setState('windup');
            break;
          }
          if (this.rest <= 0 && dist > WARA.spinRange - 6 && this.canHop(this.facing)) {
            this.hop(this.facing);
            this.rest = this.torn ? WARA.hopRestTorn : WARA.hopRest;
          }
        } else if (this.rest <= 0) {
          // ronde autour de son poste
          const out = Math.abs(this.x + this.patrolDir * WARA.hopLength - this.home) > WARA.patrol;
          if (out || !this.canHop(this.patrolDir)) this.patrolDir *= -1;
          this.facing = this.patrolDir;
          if (this.canHop(this.patrolDir)) this.hop(this.patrolDir);
          this.rest = WARA.patrolRest;
        }
      }
    }
  }

  canStep(dir) {
    const lv = this.level;
    if (!lv) return true;
    const tx = Math.floor((this.x + dir * 8) / TILE);
    return !lv.solid(tx, Math.floor((this.y - 8) / TILE)) && lv.solid(tx, Math.floor((this.y + 2) / TILE));
  }

  hop(dir) {
    this.hopDir = dir;
    this.setState('crouch');
  }

  setState(s) {
    this.state = s;
    this.timer = 0;
    this.onEvent?.(s, { x: this.x, y: this.y, facing: this.facing });
  }

  /** Effets sur KAGE : le moulinet touche des deux côtés. Le corps n'est pas solide. */
  interact(player) {
    if (this.state !== 'spin' || this.spinHit || player.state === 'death' || player.state === 'respawn') return;
    const pb = player.box();
    const b = this.box('spin');
    if (pb.x < b.x + b.w && pb.x + pb.w > b.x && pb.y < b.y + b.h && pb.y + pb.h > b.y) {
      if (player.hurt(DAMAGE_TAKEN.waraSpin, this.x)) {
        this.spinHit = true;
        this.onEvent?.('spin_hit', { x: player.x, y: player.y });
      }
    }
  }

  // ---- dessin ---------------------------------------------------------------
  frameName() {
    const anims = this.meta.animations;
    const t = this.torn && this.state !== 'defeated' ? this.meta.tornSuffix : '';
    switch (this.state) {
      case 'defeated': {
        const a = anims.defeated;
        let ms = this.timer * 1000;
        for (let i = 0; i < a.frames.length; i++) {
          const d = a.durations[i];
          if (d === 0 || ms < d) return a.frames[i];
          ms -= d;
        }
        return a.frames[a.frames.length - 1];
      }
      case 'crouch': return 'crouch' + t;
      case 'air': {
        const k = this.timer / WARA.hopAir;
        return (k > 0.3 && k < 0.7 ? 'apex' : 'rise') + t;
      }
      case 'land': return 'land' + t;
      case 'windup': return 'windup' + t;
      case 'hurt': return 'hurt' + t;
      case 'spin':
      case 'dizzy':
      case 'idle': {
        const a = anims[this.state];
        return a.frames[Math.floor(this.anim * a.fps) % a.frames.length] + t;
      }
      default: return 'idle_1' + t;
    }
  }

  draw(ctx, cam) {
    if (this.gone) return;
    const f = this.meta.frames[this.frameName()];
    const { pivot } = this.meta;
    // le signal fait trembloter l'épouvantail sur son pieu
    const shake = this.state === 'windup' ? (Math.floor(this.timer * 24) % 2 ? 1 : 0) : 0;
    const sx = Math.round(this.x - cam.x) + shake;
    const sy = Math.round(this.y - this.lift - cam.y) - pivot.y;
    let alpha = 1;
    if (this.state === 'defeated') alpha = Math.min(1, Math.max(0, (WARA.defeatFade - this.timer) / WARA.fadeTime));
    if (this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0) alpha *= 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.facing > 0) {
      ctx.drawImage(this.sheet, f.x, f.y, f.w, f.h, sx - pivot.x, sy, f.w, f.h);
    } else {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.sheet, f.x, f.y, f.w, f.h, -pivot.x, sy, f.w, f.h);
    }
    ctx.restore();
  }
}
