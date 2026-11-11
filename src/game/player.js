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
  airFriction: 450,  // freinage en l'air quand on lâche la direction (garde l'élan, utile pour le dash au double appui)
  flingDrag: 70,
  fallLimit: 168,    // chute mortelle au-delà de 10,5 cases entre le sol quitté et le sol d'arrivée
                     // (la poutre de la serre, 10 cases au-dessus du sol, est la limite sans dégâts ; le toit, 13 cases, tue)     // après le lâcher d'une liane : léger freinage de l'élan tant qu'on ne pousse pas à contre-sens
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
  kickCooldown: 0.35, // s après un coup de pied avant de pouvoir en donner un autre
  kickPush: 170,      // px/s : recul donné aux ennemis par le coup de pied
  walk: 34,           // px/s : marche à bout de souffle
  airAttackFall: 160, // chute maximale pendant un coup de sabre en l'air (px/s)
  airChopPlunge: 140, // pendant la frappe aérienne, KAGE est entraîné vers le bas (px/s)
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
    this.vine = null;         // liane tenue (chapitre 2)
    this.vineCd = 0;
    this.fling = false;       // élan d'une liane en cours (en l'air)
    this.fallFrom = this.y;   // hauteur du dernier appui (dégâts de chute)
    this.lastVine = null;
    this.ride = null;         // plateforme mobile sous ses pieds
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
    this.kickCd = Math.max(0, (this.kickCd ?? 0) - dt);
    this.vineCd = Math.max(0, this.vineCd - dt);
    this.fastTimer = Math.max(0, this.fastTimer - dt);
    this.fxTimer += dt;
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
      case 'vine':
        // accroché à une liane : balancier, grimpe et lâcher sont gérés par la forêt
        this.level.forest.rideVine(this, dt, input);
        this.fallFrom = this.y;   // accroché : la chute se compte depuis le lâcher
        this.energy.update(dt, { resting: true });
        return;
      case 'dash':
        this.vy = 0;
        if (this.timer < P.dashTime) {
          this.vx = this.facing * P.dashSpeed;
        } else {
          // freinage : on revient vers la vitesse de course pendant la dernière frame
          const target = dir * P.run;
          this.vx += Math.sign(target - this.vx) * Math.min(Math.abs(target - this.vx), P.dashBrake * dt);
          // fin du dash sous un plafond bas (feuillage de bambou) : il enchaîne en
          // glissade jusqu'à en sortir, au lieu de se relever dans le feuillage
          if (this.anim.finished) {
            if (this.onGround && this.ceilingAbove()) this.setState('slide');
            else this.endSpecial();
          }
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
        // coup aérien : léger plongeon pendant la frappe (images 3 à 5)
        if (this.state === 'air_attack' && !this.onGround && f >= 2 && f <= 4) this.vy = Math.max(this.vy, P.airChopPlunge);
        this.vx += Math.sign(want - this.vx) * Math.min(Math.abs(want - this.vx), P.friction * dt);
        const box = this.attackBox();
        if (box) this.level.hitTargets(box, this.facing);
        if (this.anim.finished) this.endSpecial();
        break;
      }
      case 'kick': {
        // au sol on se plante sur sa jambe d'appui ; en l'air on garde son élan
        if (this.onGround) this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), P.friction * dt);
        const box = this.kickBox();
        if (box) this.level.hitTargets(box, this.facing);
        // retrait de la jambe : KAGE souffle (le coup lui coûte)
        if (this.anim.frame >= 3 && !this.breathed) {
          this.breathed = true;
          this.emit('kick_breath');
        }
        if (this.anim.finished) {
          this.kickCd = P.kickCooldown;
          this.endSpecial();
        }
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
        // ralentit puis garde une vitesse minimale (on peut rester sous un plafond bas)
        this.vx = this.facing * P.slideSpeed * Math.max(0.55, 1 - 0.45 * (this.timer / P.slideTime));
        if (this.timer >= P.slideTime && !this.ceilingAbove()) this.endSpecial();
        else if (!this.onGround) this.setState('fall');
        break;
      default: {
        // contrôle horizontal
        // sprint : touche maintenue, en mouvement, et pas essoufflé
        this.sprinting = input.isHeld('sprint') && dir !== 0 && !this.energy.exhausted && this.energy.value > 0;
        // à bout de souffle : KAGE ne peut plus que marcher (l'énergie remonte en marchant)
        const tired = this.energy.exhausted;
        // dérapage : demi-tour brusque en pleine course, ou juste après (fenêtre de 0,12 s)
        if (this.onGround && Math.abs(this.vx) > P.skidSpeed && Math.sign(this.vx) === dir) {
          this.fastDir = dir;
          this.fastTimer = P.skidWindow;
        }
        if (this.onGround && dir !== 0 && dir === -this.fastDir && this.fastTimer > 0
            && !tired && (this.state === 'run' || this.state === 'sprint' || this.state === 'idle')) {
          this.vx = this.fastDir * Math.max(Math.abs(this.vx), P.skidSpeed + 10);
          this.facing = this.fastDir;
          this.fastTimer = 0;
          this.emit('skid');
          this.setState('skid');
          break;
        }
        const target = dir * (tired ? P.walk : this.sprinting ? P.sprint : P.run);
        if (this.onGround) this.fling = false;
        if (this.fling && dir !== -Math.sign(this.vx) && Math.abs(this.vx) > Math.abs(target)) {
          // élan d'une liane : il porte KAGE, les commandes ne le brident pas
          this.vx -= Math.sign(this.vx) * P.flingDrag * dt;
          if (dir !== 0) this.facing = dir;
        } else if (this.wallLock <= 0) {
          this.fling = false;
          const a = dir !== 0 ? P.accel : this.onGround ? P.friction : P.airFriction;
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
        if (!input.isHeld('jump') && this.vy < 0 && this.state === 'jump' && !this.fling) {
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
          this.emit(this.onGround ? 'swing' : 'swing_heavy');
          this.setState(this.onGround ? 'attack' : 'air_attack');
          break;
        }
        if (input.wasPressed('kick') && this.kickCd <= 0 && this.energy.trySpend(ENERGY.kick)) {
          this.attackId = (this.attackId ?? 0) + 1;   // un coup = une seule touche par ennemi
          this.breathed = false;
          this.emit('kick');
          this.setState('kick');
          break;
        }
        if (input.wasPressed('throw') && this.throwCd <= 0 && (this.canThrow?.() ?? true)) {
          this.thrown = false;
          this.setState(this.onGround ? 'throw' : 'air_throw');
          break;
        }
        // glissade : en mouvement, ou à l'arrêt en poussant une direction (ex. collé à l'entrée d'un tunnel)
        if ((input.wasPressed('slide') || input.wasPressed('down')) && this.onGround && (Math.abs(this.vx) > 20 || dir !== 0)) {
          if (dir !== 0) this.facing = dir;
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
    // dégâts de chute : la hauteur se compte depuis le dernier appui (sol, glissade murale, liane)
    if (this.onGround) {
      if (!wasGround && this.y - this.fallFrom > P.fallLimit) {
        this.emit('fall_death', { x: this.x, y: this.y, height: this.y - this.fallFrom });
        this.fallFrom = this.y;
        this.die();
        return;
      }
      this.fallFrom = this.y;
    } else if (this.state === 'wall_slide') this.fallFrom = this.y;

    if (this.onGround) {
      this.coyote = P.coyote;
      this.airDash = true;
      this.lastWallJump = null;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // transitions d'animation
    const s = this.state;
    const moving = this.energy.exhausted ? 'walk' : this.sprinting ? 'sprint' : 'run';
    if (s === 'idle' || s === 'run' || s === 'sprint' || s === 'walk' || s === 'land' || s === 'jump' || s === 'fall' || s === 'wall_jump') {
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

    // en l'air, une direction tenue : il attrape la liane qu'il touche
    if (!this.onGround && (this.state === 'jump' || this.state === 'fall' || this.state === 'wall_jump') && this.level.forest?.tryGrab(this, input)) return;

    if (this.y > this.level.height + 64 || this.level.hitsVoid?.(this.box())) {
      this.die();
    } else if (this.level.hitsSpike(this.box())) {
      if (this.hurt(DAMAGE_TAKEN.spikes, this.x - this.facing) && this.state !== 'death') {
        this.x = this.safe.x;
        this.y = this.safe.y;
        this.vx = 0;
        this.vy = 0;
      }
    } else if (this.onGround && !this.ride && this.state !== 'hurt') {
      this.safe = { x: this.x, y: this.y };
    }
    this.energy.update(dt, {
      running: this.onGround && (this.state === 'run' || this.state === 'sprint') && Math.abs(this.vx) > 10,
      sprinting: this.onGround && this.state === 'sprint',
      resting: this.onGround && (this.state === 'idle' || this.state === 'land'),
      walking: this.onGround && this.state === 'walk',
    });
    const before = this.anim.frame, stateBefore = this.state;
    this.anim.update(dt);
    // bruit de pas : seulement quand le pied touche le sol dans le cycle, et que
    // KAGE avance vraiment (rien à l'arrêt, ni en entrant dans la course)
    const f = this.anim.frame;
    if (f !== before && this.state === stateBefore && this.onGround && Math.abs(this.vx) > 20) {
      if ((this.state === 'run' || this.state === 'sprint') && STEP_FRAMES.includes(f)) this.emit('step', { sprint: this.state === 'sprint' });
      else if (this.state === 'walk' && (f === 0 || f === 2)) this.emit('step', { walk: true });
    }
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

  /** Zone de frappe du coup de pied, active pendant la détente et l'impact. */
  kickBox() {
    if (this.state !== 'kick') return null;
    const a = this.meta.hitbox.kick;
    if (!a.frames.includes(this.anim.frame)) return null;
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? a.x - pivot.x : pivot.x - (a.x + a.w);
    return { x: this.x + ox, y: this.y - pivot.y + a.y, w: a.w, h: a.h };
  }

  /** Recul donné aux ennemis par le coup de pied (px/s). */
  get kickPush() {
    return P.kickPush;
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
    // porté par une plateforme mobile (tronc flottant) : il la suit
    if (this.ride?.active) this.x += this.ride.dx;
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
        // tuile pleine, ou passerelle « - » (on la traverse en montant, on retombe dessus)
        if ((lv.solid(tx, ty) || lv.ledge?.(tx, ty)) && b.y + b.h - this.vy * dt <= ty * TILE + 1) {
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
    // plateformes mobiles de la forêt : on se pose dessus en retombant
    this.ride = null;
    if (!this.onGround && this.vy >= 0 && lv.forest) {
      const p = lv.forest.platformUnder(b, this.vy * dt);
      if (p) {
        this.y -= b.y + b.h - p.y;
        this.vy = 0;
        this.onGround = true;
        this.ride = p;
        p.load = true;
      }
    }
  }

  draw(ctx, sheet, cam) {
    if (this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) return;   // clignote
    this.anim.draw(ctx, sheet, this.x - Math.round(cam.x), this.y - Math.round(cam.y), this.facing);
  }
}
