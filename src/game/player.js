// KAGE : physique de plateforme + machine d'états reliée aux animations.
import { Animator } from '../engine/sprites.js';
import { TILE } from './level.js';
import { ENERGY, Energy } from './energy.js';
import { DAMAGE_TAKEN, HEALTH } from './combat.js';

const P = {
  run: 96,           // px/s (course normale)
  sprint: 140,       // px/s (sprint : Maj / bouton tactile)
  accel: 1400,
  friction: 1800,
  gravity: 980,
  maxFall: 420,
  jump: 315,
  jumpCut: 0.45,     // relâcher le saut tôt = saut plus court
  coyote: 0.09,
  buffer: 0.11,
  dashSpeed: 290,     // un peu plus lent qu'avant (340 px/s)
  dashTime: 0.17,     // poussée, puis freinage jusqu'à la fin de l'animation (0,25 s) :
  dashBrake: 4000,    // ~60 px au total au lieu de 68, et chaque frame reste visible plus longtemps
  slideSpeed: 190,
  slideTime: 0.36,
  landTime: 0.12,
  deathPause: 0.35,
  lunge: 75,          // petite fente avant pendant le coup de sabre (px/s)
  wallSlide: 50,      // vitesse de chute maximale en glissade murale (px/s)
  wallJumpX: 150,     // saut mural : poussée horizontale (px/s)
  wallJumpY: 300,     // saut mural : impulsion verticale (px/s)
  wallJumpLock: 0.16, // s pendant lesquelles la poussée du mur l'emporte sur les commandes
  wallCoyote: 0.1,    // s pendant lesquelles on peut encore sauter après avoir quitté le mur
  skidSpeed: 70,      // vitesse minimale pour déraper en changeant de sens (px/s)
  skidTime: 0.2,      // s de dérapage au plus
  skidWindow: 0.12,   // s après une course rapide pendant lesquelles un demi-tour fait déraper
  skidDecel: 650,     // freinage pendant le dérapage (px/s²) : assez doux pour qu'on le voie
  throwCooldown: 0.35,// s minimum entre deux lancers de shuriken
  airAttackFall: 160, // chute maximale pendant un coup de sabre en l'air (px/s)
};
const STEP_FRAMES = [0, 3];   // images de contact au sol dans les cycles de course et de sprint

export class Player {
  constructor(meta, level) {
    this.meta = meta;
    this.level = level;
    this.anim = new Animator(meta);
    this.energy = new Energy();
    this.sprinting = false;
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
    this.wallLock = 0;
    this.wallCoyote = 0;
    this.lastWall = 0;        // côté du dernier mur touché
    this.lastWallJump = null; // { side, tx } : pas deux sauts d'affilée sur le même mur
    this.throwCd = 0;
    this.fxTimer = 0;
    this.fastDir = 0;         // sens de la dernière course rapide (pour le dérapage)
    this.fastTimer = 0;
    this.level.resetTargets?.();
    this.energy?.reset();
    this.hp = HEALTH.max;
    this.invuln = 0;
    this.safe = { x: this.x, y: this.y };
    this.onRespawn?.();
    if (!instant) this.emit('respawn');
    this.setState(instant ? 'idle' : 'respawn');
  }

  setState(s) {
    this.state = s;
    this.timer = 0;
    this.anim.play(s, { restart: true });
  }

  /** Signale un événement (sons, poussière, secousses) : géré dans main.js. */
  emit(name, data = {}) {
    this.onEvent?.(name, { x: this.x, y: this.y, facing: this.facing, ...data });
  }

  /** Côté d'un mur collé au personnage : -1 (gauche), 1 (droite) ou 0.
   * Marge de 2 px : la boîte se décale d'1 px quand KAGE se retourne. */
  wallSide() {
    const b = this.box();
    const y0 = Math.floor((b.y + 2) / TILE), y1 = Math.floor((b.y + b.h - 3) / TILE);
    const lx = Math.floor((b.x - 2) / TILE), rx = Math.floor((b.x + b.w + 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (this.level.solid(rx, ty)) return 1;
      if (this.level.solid(lx, ty)) return -1;
    }
    return 0;
  }

  /** Colonne de tuiles du mur situé du côté `side`. */
  wallTile(side) {
    const b = this.box();
    return side > 0 ? Math.floor((b.x + b.w + 1) / TILE) : Math.floor((b.x - 2) / TILE);
  }

  canWallJump(side) {
    const j = this.lastWallJump;
    return !(j && j.side === side && j.tx === this.wallTile(side));
  }

  wallJump(side) {
    this.lastWallJump = { side, tx: this.wallTile(side) };
    this.vx = -side * P.wallJumpX;
    this.vy = -P.wallJumpY;
    this.facing = -side;
    this.energy.spend(ENERGY.jump);
    this.jumpBuffer = 0;
    this.wallLock = P.wallJumpLock;
    this.wallCoyote = 0;
    this.airDash = true;
    this.emit('wall_jump', { side });
    this.setState('wall_jump');
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
    this.invuln = Math.max(0, this.invuln - dt);
    this.wallLock = Math.max(0, this.wallLock - dt);
    this.wallCoyote = Math.max(0, this.wallCoyote - dt);
    this.throwCd = Math.max(0, this.throwCd - dt);
    this.fastTimer = Math.max(0, this.fastTimer - dt);
    this.fxTimer += dt;
    const prevFrame = this.anim.frame;
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
        this.vy = 0;
        if (this.timer < P.dashTime) {
          this.vx = this.facing * P.dashSpeed;
        } else {
          // freinage : on revient vers la vitesse de course pendant la dernière frame
          const target = dir * P.run;
          this.vx += Math.sign(target - this.vx) * Math.min(Math.abs(target - this.vx), P.dashBrake * dt);
          if (this.anim.finished) this.endSpecial();
        }
        break;
      case 'hurt':
        if (this.timer >= HEALTH.hurtLock && this.onGround) this.endSpecial();
        else if (this.timer >= HEALTH.hurtLock * 2) this.setState('fall');
        break;
      case 'attack':
      case 'air_attack': {
        // au sol : légère fente pendant le dégainé et le demi-cercle ; en l'air : on garde l'élan
        const f = this.anim.frame;
        const lunge = this.state === 'attack' && this.onGround;
        const want = lunge ? (f >= 1 && f <= 3 ? this.facing * P.lunge : 0) : this.onGround ? 0 : this.vx;
        this.vx += Math.sign(want - this.vx) * Math.min(Math.abs(want - this.vx), P.friction * dt);
        const box = this.attackBox();
        if (box) this.level.hitTargets(box, this.facing);
        if (this.anim.finished) this.endSpecial();
        break;
      }
      case 'throw':
      case 'air_throw': {
        // au sol on se plante sur ses appuis ; en l'air on garde son élan
        if (this.onGround) this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), P.friction * dt);
        const r = this.anim.anim.release;
        if (!this.thrown && this.anim.frame >= r.frame) {
          this.thrown = true;
          this.throwCd = P.throwCooldown;
          const { pivot } = this.meta;
          this.onThrow?.(this.x + this.facing * (r.x - pivot.x), this.y - pivot.y + r.y, this.facing, pivot.y - r.y);
        }
        if (this.anim.finished) this.endSpecial();
        break;
      }
      case 'wall_slide': {
        const side = this.wallSide();
        if (this.onGround) {
          this.setState('idle');
          break;
        }
        if (!side || dir !== side) {
          // on lâche le mur : on peut encore sauter un court instant
          this.lastWall = side || this.lastWall;
          this.wallCoyote = P.wallCoyote;
          this.facing = -this.lastWall;
          this.setState('fall');
          break;
        }
        this.lastWall = side;
        this.facing = -side;
        this.vx = 0;
        if (this.jumpBuffer > 0 && this.canWallJump(side)) {
          this.wallJump(side);
          break;
        }
        if (this.fxTimer > 0.08) {
          this.fxTimer = 0;
          this.emit('wall_slide', { side });
        }
        break;
      }
      case 'skid': {
        // dérapage : on freine fort en gardant l'orientation de l'élan
        this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), P.skidDecel * dt);
        if (this.fxTimer > 0.05) {
          this.fxTimer = 0;
          this.emit('skid_dust');
        }
        if (this.timer >= P.skidTime || Math.abs(this.vx) < 10) {
          if (dir) this.facing = dir;
          this.setState(dir ? 'run' : 'idle');
        }
        break;
      }
      case 'slide':
        if (this.fxTimer > 0.06) {
          this.fxTimer = 0;
          this.emit('slide_dust');
        }
        this.vx = this.facing * P.slideSpeed * (1 - 0.45 * (this.timer / P.slideTime));
        if (this.timer >= P.slideTime && !this.ceilingAbove()) this.endSpecial();
        else if (!this.onGround) this.setState('fall');
        break;
      default: {
        // contrôle horizontal
        // sprint : touche maintenue, en mouvement, et pas essoufflé
        this.sprinting = input.isHeld('sprint') && dir !== 0 && !this.energy.exhausted && this.energy.value > 0;
        // dérapage : demi-tour brusque en pleine course, ou juste après (fenêtre de 0,12 s)
        if (this.onGround && Math.abs(this.vx) > P.skidSpeed && Math.sign(this.vx) === dir) {
          this.fastDir = dir;
          this.fastTimer = P.skidWindow;
        }
        if (this.onGround && dir !== 0 && dir === -this.fastDir && this.fastTimer > 0
            && (this.state === 'run' || this.state === 'sprint' || this.state === 'idle')) {
          this.vx = this.fastDir * Math.max(Math.abs(this.vx), P.skidSpeed + 10);
          this.facing = this.fastDir;
          this.fastTimer = 0;
          this.emit('skid');
          this.setState('skid');
          break;
        }
        const target = dir * (this.sprinting ? P.sprint : P.run) * this.energy.speedFactor;
        if (this.wallLock <= 0) {
          const a = dir !== 0 ? P.accel : P.friction;
          if (this.vx < target) this.vx = Math.min(target, this.vx + a * dt);
          else if (this.vx > target) this.vx = Math.max(target, this.vx - a * dt);
          if (dir !== 0) this.facing = dir;
        }

        if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
          this.vy = -P.jump;
          this.energy.spend(ENERGY.jump);   // le saut reste toujours possible
          this.onGround = false;
          this.coyote = 0;
          this.jumpBuffer = 0;
          this.emit('jump');
          this.setState('jump');
        } else if (this.jumpBuffer > 0 && !this.onGround) {
          // saut mural : contre un mur, ou juste après l'avoir quitté
          const side = this.wallSide() || (this.wallCoyote > 0 ? this.lastWall : 0);
          if (side && this.canWallJump(side)) {
            this.wallJump(side);
            break;
          }
        }
        if (!input.isHeld('jump') && this.vy < 0 && this.state === 'jump') {
          this.vy *= 1 - P.jumpCut * dt * 10;
        }
        const dashDir = input.wasPressed('dash_right') ? 1 : input.wasPressed('dash_left') ? -1 : 0;
        if (dashDir && (this.onGround || this.airDash) && this.energy.trySpend(ENERGY.dash)) {
          if (!this.onGround) this.airDash = false;
          this.facing = dashDir;
          this.emit('dash', { dir: dashDir });
          this.setState('dash');
          break;
        }
        if (input.wasPressed('attack') && this.energy.trySpend(ENERGY.attack)) {
          this.attackId = (this.attackId ?? 0) + 1;   // un coup = une seule touche par ennemi
          this.emit('swing');
          this.setState(this.onGround ? 'attack' : 'air_attack');
          break;
        }
        if (input.wasPressed('throw') && this.throwCd <= 0 && (this.canThrow?.() ?? true)) {
          this.thrown = false;
          this.setState(this.onGround ? 'throw' : 'air_throw');
          break;
        }
        if ((input.wasPressed('slide') || input.wasPressed('down')) && this.onGround && Math.abs(this.vx) > 20) {
          this.emit('slide');
          this.setState('slide');
          break;
        }
      }
    }

    // gravité (sauf pendant le dash)
    if (this.state !== 'dash') {
      this.vy = Math.min(P.maxFall, this.vy + P.gravity * dt);
      if (this.state === 'wall_slide') this.vy = Math.min(this.vy, P.wallSlide);
      if (this.state === 'air_attack') this.vy = Math.min(this.vy, P.airAttackFall);
    }
    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    this.move(dt);

    if (this.onGround) {
      this.coyote = P.coyote;
      this.airDash = true;
      this.lastWallJump = null;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // transitions d'animation
    const s = this.state;
    const moving = this.sprinting ? 'sprint' : 'run';
    if (s === 'idle' || s === 'run' || s === 'sprint' || s === 'land' || s === 'jump' || s === 'fall' || s === 'wall_jump') {
      const side = this.wallSide();
      if (!this.onGround && this.vy > 0 && side && dir === side && s !== 'wall_jump' || (s === 'wall_jump' && this.vy > 0 && side && dir === side)) {
        // contre un mur en tombant, en poussant vers lui : glissade murale
        this.lastWall = side;
        this.facing = -side;
        this.emit('wall_grab', { side });
        this.setState('wall_slide');
      } else if (!this.onGround) {
        if (this.vy > 30 && s !== 'fall') this.setState('fall');
        else if (s !== 'jump' && s !== 'fall' && s !== 'wall_jump') this.setState('fall');
      } else if (!wasGround) {
        this.emit('land', { speed: fallSpeed });
        this.setState('land');
      } else if (s === 'land') {
        if (this.timer >= P.landTime && (dir !== 0 || this.anim.finished)) this.setState(dir ? moving : 'idle');
      } else if (Math.abs(this.vx) > 10 && dir !== 0) {
        if (s !== moving) this.setState(moving);
      } else if (s !== 'idle') {
        this.setState('idle');
      }
    }

    // bruit de pas : images de contact du cycle de course / sprint
    if ((this.state === 'run' || this.state === 'sprint') && this.anim.frame !== prevFrame && STEP_FRAMES.includes(this.anim.frame)) {
      this.emit('step', { sprint: this.state === 'sprint' });
    }

    if (this.y > this.level.height + 64) {
      this.die();
    } else if (this.level.hitsSpike(this.box())) {
      if (this.hurt(DAMAGE_TAKEN.spikes, this.x - this.facing) && this.state !== 'death') {
        this.x = this.safe.x;
        this.y = this.safe.y;
        this.vx = 0;
        this.vy = 0;
      }
    } else if (this.onGround && this.state !== 'hurt') {
      this.safe = { x: this.x, y: this.y };
    }
    this.energy.update(dt, {
      running: this.onGround && (this.state === 'run' || this.state === 'sprint') && Math.abs(this.vx) > 10,
      sprinting: this.onGround && this.state === 'sprint',
      resting: this.onGround && (this.state === 'idle' || this.state === 'land'),
    });
    this.anim.update(dt);
  }

  endSpecial() {
    this.setState(this.onGround ? (Math.abs(this.vx) > 10 ? 'run' : 'idle') : 'fall');
  }

  /**
   * KAGE est touché : perd `dmg` points de vie, recule à l'opposé de `fromX`,
   * clignote et devient invincible un instant. Renvoie true si le coup a porté.
   */
  hurt(dmg, fromX) {
    if (this.invuln > 0 || this.state === 'death' || this.state === 'respawn') return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.onHurt?.(dmg);
    this.emit('hurt', { dmg, fromX });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.invuln = HEALTH.invulnerable;
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.vx = away * HEALTH.knockback;
    this.vy = -HEALTH.knockup;
    this.onGround = false;
    this.setState('hurt');
    return true;
  }

  die() {
    if (this.state === 'death' || this.state === 'respawn') return;
    this.vx = 0;
    this.vy = 0;
    this.emit('death');
    this.setState('death');
  }

  /** Zone de frappe du sabre, active seulement sur les frames du demi-cercle. */
  attackBox() {
    if (this.state !== 'attack' && this.state !== 'air_attack') return null;
    const a = this.meta.hitbox[this.state];
    if (!a.frames.includes(this.anim.frame)) return null;
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? a.x - pivot.x : pivot.x - (a.x + a.w);
    return { x: this.x + ox, y: this.y - pivot.y + a.y, w: a.w, h: a.h };
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
    if (this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) return;   // clignote
    this.anim.draw(ctx, sheet, this.x - Math.round(cam.x), this.y - Math.round(cam.y), this.facing);
  }
}
