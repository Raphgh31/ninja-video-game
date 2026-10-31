// KAGE : physique de plateforme + machine d'états reliée aux animations.
import { Animator } from '../engine/sprites.js';
import { TILE } from './level.js';

const P = {
  run: 120,          // px/s
  accel: 1400,
  friction: 1800,
  gravity: 980,
  maxFall: 420,
  jump: 315,
  jumpCut: 0.45,     // relâcher le saut tôt = saut plus court
  coyote: 0.09,
  buffer: 0.11,
  dashSpeed: 340,
  dashTime: 0.2,
  vdashSpeed: 330,
  vdashTime: 0.18,
  slideSpeed: 190,
  slideTime: 0.36,
  landTime: 0.12,
  deathPause: 0.35,
};

export class Player {
  constructor(meta, level) {
    this.meta = meta;
    this.level = level;
    this.anim = new Animator(meta);
    this.respawn(true);
  }

  respawn(instant = false) {
    const s = this.level.spawn;
    this.x = s.x;
    this.y = s.y;       // y = sous les pieds (point d'ancrage du sprite)
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.timer = 0;
    this.airDash = true;
    this.setState(instant ? 'idle' : 'respawn');
  }

  setState(s) {
    this.state = s;
    this.timer = 0;
    this.anim.play(s === 'land' ? 'land' : s, { restart: true });
  }

  /** Boîte de collision selon l'état (définie dans kage.json, relative à la cellule). */
  box() {
    const hb = this.meta.hitbox;
    const h = this.state === 'slide' ? hb.slide : this.state === 'dash' ? hb.dash : hb.default;
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? h.x - pivot.x : pivot.x - (h.x + h.w);
    return { x: this.x + ox, y: this.y - pivot.y + h.y, w: h.w, h: h.h };
  }

  update(dt, input) {
    this.timer += dt;
    const L = input.isHeld('left'), R = input.isHeld('right');
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    if (input.wasPressed('jump')) this.jumpBuffer = P.buffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    switch (this.state) {
      case 'death':
        if (this.anim.finished && this.timer > P.deathPause + 0.43) this.respawn();
        this.anim.update(dt);
        return;
      case 'respawn':
        this.anim.update(dt);
        if (this.anim.finished) this.setState('idle');
        return;
      case 'dash':
        this.vx = this.facing * P.dashSpeed;
        this.vy = 0;
        if (this.timer >= P.dashTime) this.endSpecial();
        break;
      case 'dash_vertical':
        this.vx = 0;
        this.vy = -P.vdashSpeed;
        if (this.timer >= P.vdashTime) {
          this.vy *= 0.35;
          this.endSpecial();
        }
        break;
      case 'slide':
        this.vx = this.facing * P.slideSpeed * (1 - 0.45 * (this.timer / P.slideTime));
        if (this.timer >= P.slideTime && !this.ceilingAbove()) this.endSpecial();
        else if (!this.onGround) this.setState('fall');
        break;
      default: {
        // contrôle horizontal
        const target = dir * P.run;
        const a = dir !== 0 ? P.accel : P.friction;
        if (this.vx < target) this.vx = Math.min(target, this.vx + a * dt);
        else if (this.vx > target) this.vx = Math.max(target, this.vx - a * dt);
        if (dir !== 0) this.facing = dir;

        if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
          this.vy = -P.jump;
          this.onGround = false;
          this.coyote = 0;
          this.jumpBuffer = 0;
          this.setState('jump');
        }
        if (!input.isHeld('jump') && this.vy < 0 && this.state === 'jump') {
          this.vy *= 1 - P.jumpCut * dt * 10;
        }
        if (input.wasPressed('dash') && (this.onGround || this.airDash)) {
          if (!this.onGround) this.airDash = false;
          if (input.isHeld('up') || input.wasPressed('up')) {
            this.setState('dash_vertical');
            this.onGround = false;
          } else {
            this.setState('dash');
          }
          break;
        }
        if ((input.wasPressed('slide') || input.wasPressed('down')) && this.onGround && Math.abs(this.vx) > 20) {
          this.setState('slide');
          break;
        }
      }
    }

    // gravité (sauf pendant les dashs)
    if (this.state !== 'dash' && this.state !== 'dash_vertical') {
      this.vy = Math.min(P.maxFall, this.vy + P.gravity * dt);
    }
    const wasGround = this.onGround;
    this.move(dt);

    if (this.onGround) {
      this.coyote = P.coyote;
      this.airDash = true;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // transitions d'animation
    const s = this.state;
    if (s === 'idle' || s === 'run' || s === 'land' || s === 'jump' || s === 'fall') {
      if (!this.onGround) {
        if (this.vy > 30 && s !== 'fall') this.setState('fall');
        else if (s !== 'jump' && s !== 'fall') this.setState('fall');
      } else if (!wasGround) {
        this.setState('land');
      } else if (s === 'land') {
        if (this.timer >= P.landTime && (dir !== 0 || this.anim.finished)) this.setState(dir ? 'run' : 'idle');
      } else if (Math.abs(this.vx) > 10 && dir !== 0) {
        if (s !== 'run') this.setState('run');
      } else if (s !== 'idle') {
        this.setState('idle');
      }
    }

    if (this.level.hitsSpike(this.box()) || this.y > this.level.height + 64) this.die();
    this.anim.update(dt);
  }

  endSpecial() {
    this.setState(this.onGround ? (Math.abs(this.vx) > 10 ? 'run' : 'idle') : 'fall');
  }

  die() {
    if (this.state === 'death' || this.state === 'respawn') return;
    this.vx = 0;
    this.vy = 0;
    this.setState('death');
  }

  ceilingAbove() {
    const b = this.box();
    const full = this.meta.hitbox.default;
    const top = this.y - this.meta.pivot.y + full.y;
    for (let x = b.x; x < b.x + b.w; x += 4) {
      if (this.level.solid(Math.floor(x / TILE), Math.floor(top / TILE))) return true;
    }
    return false;
  }

  move(dt) {
    const lv = this.level;
    // horizontal
    this.x += this.vx * dt;
    let b = this.box();
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
    if (this.vx > 0) {
      const tx = Math.floor((b.x + b.w) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (lv.solid(tx, ty)) { this.x -= b.x + b.w - tx * TILE; this.vx = 0; break; }
    } else if (this.vx < 0) {
      const tx = Math.floor(b.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (lv.solid(tx, ty)) { this.x += (tx + 1) * TILE - b.x; this.vx = 0; break; }
    }
    // vertical
    this.y += this.vy * dt;
    b = this.box();
    const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
    this.onGround = false;
    if (this.vy >= 0) {
      const ty = Math.floor((b.y + b.h) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (lv.solid(tx, ty) && b.y + b.h - this.vy * dt <= ty * TILE + 1) {
          this.y -= b.y + b.h - ty * TILE;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    } else {
      const ty = Math.floor(b.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (lv.solid(tx, ty)) { this.y += (ty + 1) * TILE - b.y; this.vy = 0; break; }
      }
    }
  }

  draw(ctx, sheet, cam) {
    this.anim.draw(ctx, sheet, this.x - Math.round(cam.x), this.y - Math.round(cam.y), this.facing);
  }
}
