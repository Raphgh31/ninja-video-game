// KARASU-KASHI — le corbeau du potager, mini-boss du chapitre 1.
//
// Perché sur son épouvantail géant, il toise KAGE. Quand le combat s'engage :
//   1. le bombardement : il s'envole, se place en hauteur et lâche des glands
//      piquants (épines au sol) et des navets explosifs ; une ombre au sol
//      annonce chaque point d'impact. En vol, seuls les shurikens le touchent.
//   2. le plongeon : il se place, fixe KAGE (regard plissé), replie les ailes et
//      fond en ligne droite. La trajectoire passe à 16 px du sol au-dessus de
//      KAGE : debout (22 px) il est touché, en glissade (14 px) il passe dessous.
//   3. la fenêtre : manqué, il s'écrase, le bec planté dans la terre, étourdi.
//      Le sabre fait mal ; puis il s'ébroue, replace son chapeau, regagne son perchoir.
// Plus il perd de vie, plus il est rapide (trois paliers), sans jamais attaquer
// sans préparation lisible. Les sons et les effets passent par onEvent.

import { DAMAGE_DEALT } from './combat.js';
import { TILE } from './level.js';

export const KARASU = {
  hp: 24,
  engageX: 7,              // cases après le début de l'arène : le combat commence
  altitude: 34,            // px : ses pattes au-dessus du sol en vol (le corps entre ~60 et ~95 px) :
                           // à portée d'un shuriken lancé au sommet d'un saut
  flySpeed: 110,           // px/s en vol (déplacements)
  bombSpeed: 62,           // px/s : il suit KAGE pendant le bombardement
  takeoff: 0.42,           // s
  taunt: 0.75,             // s de croassement avant une salve
  // par palier (début, milieu, fin)
  salvo: [3, 4, 5],        // projectiles par salve
  dropEvery: [1.15, 0.9, 0.7],
  dropWindup: 0.14,       // s : il ouvre les serres avant chaque lâcher
  aim: [0.85, 0.68, 0.55], // s de visée avant le plongeon (le joueur doit pouvoir le lire)
  stuck: [2.9, 2.6, 2.3],  // s coincé dans le sol
  perchPause: [1.6, 1.2, 0.9],
  diveSpeed: [300, 330, 360],
  diveClear: 17,           // px : hauteur de sa boîte au-dessus du sol quand elle passe sur KAGE
  crash: 0.32,
  shake: 0.75,
  hurtFlash: 0.16,
  // projectiles
  acornHit: 1, thornHit: 1, boomHit: 1, diveHit: 2,
  thornSpeed: 95, thornLife: 0.42,
  fuse: 0.75, boomRadius: 26,
  gravity: 420,
};

const PHASE_OF = (f) => (f > 0.66 ? 0 : f > 0.33 ? 1 : 2);
const touch = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Karasu {
  /** def : { x, y (cases : le pied de l'épouvantail), arena: [x0, x1] (cases) } */
  constructor(meta, images, def, level) {
    this.meta = meta;
    this.img = images;                 // { sheet, perch, items }
    this.level = level;
    this.perchX = def.x * TILE + 8;
    this.groundY = def.y * TILE;
    this.arena = [def.arena[0] * TILE, def.arena[1] * TILE];
    this.reset();
  }

  reset() {
    const top = this.perchPoint();
    this.x = top.x;
    this.y = top.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.hp = KARASU.hp;
    this.engaged = false;
    this.setState('perch');
    this.animName = 'idle';
    this.animT = 0;
    this.flash = 0;
    this.shots = [];           // glands et navets
    this.thorns = [];          // épines qui filent au sol
    this.sway = 0;             // l'épouvantail : inclinaison et vitesse
    this.swayV = 0;
    this.lastHit = -1;
    this.salvoLeft = 0;
    this.dropT = 0;
    this.nextIdle = 2.5;
    this.diveDone = 0;
    this.gone = false;
    this.defeatedT = 0;
  }

  get alive() { return this.state !== 'defeated'; }
  get noBar() { return true; }        // pas de barre au-dessus de la tête : la sienne est en haut de l'écran

  /** Déjà vaincu (partie reprise) : affalé au pied de son épouvantail. */
  setDefeated() {
    this.reset();
    this.hp = 0;
    this.x = this.perchX - 30;
    this.y = this.groundY;
    this.facing = 1;
    this.setState('defeated');
    this.play('defeated');
    this.animT = 10;
  }
  get phase() { return PHASE_OF(this.hp / KARASU.hp); }

  /** Le sommet de l'épouvantail, là où il se pose (il suit l'oscillation). */
  perchPoint() {
    const m = this.meta;
    return {
      x: this.perchX + (m.perchTop.x - m.perchPivot.x) + this.sway * 3.3,
      y: this.groundY + (m.perchTop.y - m.perchPivot.y),
    };
  }

  setState(s) {
    this.state = s;
    this.timer = 0;
  }

  play(name) {
    if (this.animName !== name) { this.animName = name; this.animT = 0; }
  }

  /** Secoue l'épouvantail (envol, atterrissage). */
  kick(force) {
    this.swayV += force;
    this.onEvent?.('straw', { x: this.perchX, y: this.groundY - 100 });
  }

  // ---- boîtes ---------------------------------------------------------------
  boxName() {
    if (this.state === 'perch' || this.state === 'taunt' || this.state === 'land' || this.state === 'shake' || this.state === 'look') return 'perched';
    if (this.state === 'dive') return 'dive';
    if (this.state === 'crash' || this.state === 'stuck' || this.state === 'defeated') return 'stuck';
    return 'flying';
  }

  box(name = this.boxName()) {
    const b = this.meta.boxes[name];
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? b.x - pivot.x : pivot.x - (b.x + b.w);
    return { x: this.x + ox, y: this.y - pivot.y + b.y, w: b.w, h: b.h };
  }

  get flying() { return ['takeoff', 'fly', 'bomb', 'aim', 'dive', 'return'].includes(this.state); }

  // ---- coups reçus ----------------------------------------------------------
  /**
   * Le sabre et le coup de pied (id = numéro du coup) ne le touchent que coincé
   * dans le sol ; les shurikens (id = null) le touchent aussi en vol.
   */
  takeHit(box, attackerX, id = null, dmg = DAMAGE_DEALT.sword) {
    if (!this.alive || !this.engaged || (id !== null && id === this.lastHit)) return null;
    const stuck = this.state === 'stuck' || this.state === 'crash';
    if (!stuck && !(id === null && this.flying)) return null;
    if (!touch(box, this.box())) return null;
    if (id !== null) this.lastHit = id;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = KARASU.hurtFlash;
    this.onEvent?.('hit', { x: this.x, y: this.y - 30, dmg, stuck, dir: Math.sign(this.x - attackerX) || 1 });
    if (this.hp <= 0) {
      this.setState('defeated');
      this.play('defeated');
      this.vx = 0;
      this.vy = 0;
      this.onEvent?.('defeat', { x: this.x, y: this.y });
    } else if (stuck) {
      this.hitT = 0.18;               // réaction : la mine vexée
    } else {
      this.vy -= 40;                  // touché en vol : il encaisse, vexé
    }
    return 'hit';
  }

  push() {}                          // le coup de pied ne le repousse pas (il est planté)

  // ---- comportement ---------------------------------------------------------
  update(dt, player) {
    this.timer += dt;
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hitT = Math.max(0, (this.hitT ?? 0) - dt);
    // l'épouvantail : un ressort amorti
    this.swayV += (-this.sway * 38 - this.swayV * 3.2) * dt;
    this.sway = Math.max(-1, Math.min(1, this.sway + this.swayV * dt));
    this.updateShots(dt);
    if (this.state === 'defeated') {
      this.defeatedT += dt;
      this.vy += KARASU.gravity * dt;
      this.y = Math.min(this.groundY, this.y + this.vy * dt);
      return;
    }
    const P = this.phase;
    const px = player.x;
    // KAGE quitte l'arène : il regagne son perchoir et l'attend (pas de coups gratuits au loin)
    if (this.engaged && px < this.arena[0] - 48 && ['fly', 'bomb', 'aim'].includes(this.state)) {
      this.engaged = false;
      this.setState('return');
      this.onEvent?.('disengage', {});
    }
    const toward = Math.sign(px - this.x) || this.facing;
    switch (this.state) {
      case 'perch': {
        const top = this.perchPoint();
        this.x = top.x; this.y = top.y;
        this.facing = toward;
        if (!this.engaged) {
          // il attend : il toise KAGE, penche la tête, redresse son chapeau
          this.personality(dt);
          if (px > this.arena[0] + KARASU.engageX * TILE && player.state !== 'death') {
            this.engaged = true;
            this.onEvent?.('engage', {});
            this.setState('taunt');
            this.play('croak');
            this.onEvent?.('caw', { x: this.x, y: this.y - 40, taunt: true });
          }
        } else {
          this.personality(dt);
          if (this.timer > KARASU.perchPause[P]) this.takeOff();
        }
        break;
      }
      case 'taunt':
        if (this.timer > KARASU.taunt) this.takeOff();
        break;
      case 'takeoff':
        this.play('takeoff');
        this.y -= 70 * dt;
        if (this.timer > KARASU.takeoff) {
          this.setState('fly');
          this.salvoLeft = KARASU.salvo[P];
          this.dropT = 0.6;
          this.croaked = false;
        }
        break;
      case 'fly':                    // il gagne sa hauteur de bombardement
      case 'bomb': {
        this.play(this.state === 'bomb' && this.dropping > 0 ? 'drop' : 'fly');
        const ty = this.groundY - KARASU.altitude + Math.sin(this.timer * 2.2) * 4;
        const lead = this.clampX(this.state === 'bomb' ? px - toward * 10 : px - toward * 60, 40);
        this.steer(lead, ty, this.state === 'bomb' ? KARASU.bombSpeed : KARASU.flySpeed, dt);
        this.facing = toward;
        if (this.state === 'fly' && Math.abs(this.y - ty) < 6) this.setState('bomb');
        if (this.state === 'bomb') {
          this.dropping = Math.max(0, (this.dropping ?? 0) - dt);
          if (!this.croaked && this.timer > 0.2) {
            this.croaked = true;
            this.onEvent?.('caw', { x: this.x, y: this.y - 40, taunt: true });
          }
          this.dropT -= dt;
          if (this.windup > 0) {          // il ouvre les serres : le projectile part
            this.windup -= dt;
            if (this.windup <= 0) { this.drop(player, P); this.salvoLeft--; }
          } else if (this.dropT <= 0 && this.salvoLeft > 0) {
            this.windup = KARASU.dropWindup;   // il s'apprête (lisible avant chaque lâcher)
            this.dropping = KARASU.dropWindup + 0.2;
            this.dropT = KARASU.dropEvery[P] * (0.85 + Math.random() * 0.3);
          }
          if (this.salvoLeft <= 0 && this.dropT <= 0 && !(this.windup > 0)) {
            this.setState('aim');
            this.aimSide = -toward;
          }
        }
        break;
      }
      case 'aim': {                  // il se place, fixe KAGE, replie les ailes
        this.play('aim');
        let sx = px + this.aimSide * 96;
        if (sx !== this.clampX(sx, 30)) { this.aimSide = -this.aimSide; sx = px + this.aimSide * 96; }   // pas de place : de l'autre côté
        sx = this.clampX(sx, 30);
        this.steer(sx, this.groundY - KARASU.altitude - 16, KARASU.flySpeed * 1.2, dt);
        this.facing = toward;
        if (this.timer === dt) this.onEvent?.('glare', { x: this.x, y: this.y - 40 });
        if (this.timer > KARASU.aim[P]) this.startDive(player, P);
        break;
      }
      case 'dive': {
        this.play('dive');
        const sp = Math.min(KARASU.diveSpeed[P], 150 + this.timer * 900);
        this.x += this.dx * sp * dt;
        this.y += this.dy * sp * dt;
        if (this.y >= this.groundY) {   // il touche le sol : écrasé dans le potager
          this.y = this.groundY;
          this.setState('crash');
          this.play('crash');
          this.onEvent?.('crash', { x: this.x, y: this.groundY, dir: this.facing });
        }
        break;
      }
      case 'crash':
        if (this.timer > KARASU.crash) { this.setState('stuck'); this.play('stuck'); }
        break;
      case 'stuck':
        this.play(this.hitT > 0 ? 'stuckHit' : 'stuck');
        if (this.timer > KARASU.stuck[P]) {
          this.setState('shake');
          this.play('shake');
          this.onEvent?.('shake', { x: this.x, y: this.y });
        }
        break;
      case 'shake':                  // il s'ébroue, replace son chapeau
        if (this.timer > KARASU.shake) { this.setState('return'); this.onEvent?.('flap', { x: this.x, y: this.y }); }
        break;
      case 'return': {               // il regagne son perchoir
        this.play('fly');
        const top = this.perchPoint();
        this.steer(top.x, top.y - (Math.abs(this.x - top.x) > 20 ? 30 : 0), KARASU.flySpeed * 1.3, dt);
        this.facing = Math.sign(top.x - this.x) || this.facing;
        if (Math.abs(this.x - top.x) < 3 && Math.abs(this.y - top.y) < 4) {
          this.x = top.x; this.y = top.y;
          this.kick(-2.5);
          this.setState('perch');
          this.play('hatfix');
        }
        break;
      }
      case 'pullup': {               // il a touché KAGE : il remonte sans s'écraser
        this.play('fly');
        this.y -= 120 * dt;
        this.x += this.facing * 80 * dt;
        if (this.timer > 0.55) {
          // à la fin du combat, il enchaîne un second plongeon
          if (P === 2 && !this.diveDone) { this.diveDone = 1; this.setState('aim'); this.aimSide = -toward; }
          else { this.diveDone = 0; this.setState('fly'); this.salvoLeft = KARASU.salvo[P]; this.dropT = 0.4; this.croaked = false; }
        }
        break;
      }
      default:
    }
  }

  /** Les petites animations de caractère, quand il est perché. */
  personality(dt) {
    const a = this.meta.animations[this.animName];
    if (this.animName !== 'idle' && !a.loop && this.animT > a.durations.reduce((s, d) => s + d, 0) / 1000) this.play('idle');
    this.nextIdle -= dt;
    if (this.nextIdle <= 0 && this.animName === 'idle') {
      const r = Math.random();
      this.play(r < 0.45 ? 'look' : r < 0.75 ? 'hatfix' : 'croak');
      if (this.animName === 'croak') this.onEvent?.('caw', { x: this.x, y: this.y - 40, taunt: true, soft: true });
      this.nextIdle = 2.4 + Math.random() * 2.6;
    }
  }

  takeOff() {
    this.setState('takeoff');
    this.kick(2.8);
    this.onEvent?.('flap', { x: this.x, y: this.y });
  }

  clampX(x, m) { return Math.max(this.arena[0] + m, Math.min(this.arena[1] - m, x)); }

  steer(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const v = Math.min(speed, d * 4);
    this.x += (dx / d) * v * dt;
    this.y += (dy / d) * v * dt;
  }

  /** Un projectile : surtout des glands ; des navets de plus en plus souvent. */
  drop(player, P) {
    const turnip = Math.random() < [0.3, 0.4, 0.45][P];
    const sx = this.x + this.facing * 8, sy = this.y - 22;
    const lead = player.vx * 0.25;
    const spread = P >= 1 && !turnip && Math.random() < 0.5 ? [-26, 0, 26] : [0];
    for (const o of spread) {
      const tx = this.clampX(player.x + lead + o + (Math.random() - 0.5) * 16, 8);
      const t = Math.sqrt((2 * (this.groundY - sy)) / KARASU.gravity);
      this.shots.push({ kind: turnip ? 'turnip' : 'acorn', x: sx, y: sy, vx: (tx - sx) / t, vy: 0, t: 0, tx, state: 'fall' });
    }
    this.onEvent?.('drop', { x: sx, y: sy, turnip });
  }

  startDive(player, P) {
    // Il vise le sol juste au-delà de KAGE. Le point bas de sa boîte, au moment où
    // l'arrière de celle-ci dépasse KAGE, passe à KARASU.diveClear px du sol :
    // trop bas pour KAGE debout (22 px), assez haut pour qu'il glisse dessous (14 px).
    this.facing = Math.sign(this.clampX(player.x, 24) - this.x) || this.facing;
    const f = this.facing, b = this.meta.boxes.dive, pivot = this.meta.pivot;
    const rear = pivot.x - b.x;                    // de l'ancrage à l'arrière de la boîte
    const lift = pivot.y - (b.y + b.h);            // bas de la boîte, au-dessus des pattes
    const qx = this.clampX(player.x, 24) + f * (rear + 8);   // il ne s'écrase jamais hors de l'arène
    const qy = this.groundY - KARASU.diveClear + lift;
    const sx = qx - this.x, sy = qy - this.y;
    const k = (this.groundY - this.y) / Math.max(1, sy);   // on prolonge jusqu'au sol
    const cx = this.x + sx * k, cy = this.groundY;
    const L = Math.hypot(cx - this.x, cy - this.y);
    this.dx = (cx - this.x) / L;
    this.dy = (cy - this.y) / L;
    this.diveTarget = { x: cx, y: cy, at: player.x };
    this.setState('dive');
    this.onEvent?.('dive', { x: this.x, y: this.y });
  }

  // ---- projectiles ----------------------------------------------------------
  updateShots(dt) {
    for (const s of this.shots) {
      s.t += dt;
      if (s.state === 'fall') {
        s.vy += KARASU.gravity * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y >= this.groundY - 4) {
          s.y = this.groundY - 4;
          if (s.kind === 'acorn') {
            s.dead = true;
            for (const dir of [-1, 1]) this.thorns.push({ x: s.x, y: this.groundY - 3, dir, t: 0 });
            this.onEvent?.('acorn', { x: s.x, y: this.groundY });
          } else {
            s.state = 'fuse';
            s.t = 0;
            this.onEvent?.('turnipLand', { x: s.x, y: this.groundY });
          }
        }
      } else if (s.state === 'fuse' && s.t > KARASU.fuse) {
        s.dead = true;
        s.boom = true;
        this.onEvent?.('boom', { x: s.x, y: this.groundY, r: KARASU.boomRadius });
      }
    }
    this.booms = this.shots.filter((s) => s.boom);
    this.shots = this.shots.filter((s) => !s.dead);
    for (const th of this.thorns) {
      th.t += dt;
      th.x += th.dir * KARASU.thornSpeed * dt;
    }
    this.thorns = this.thorns.filter((th) => th.t < KARASU.thornLife);
  }

  /** Ce qui blesse KAGE : le plongeon, les glands, les épines, les explosions. */
  interact(player) {
    if (player.state === 'death' || player.state === 'respawn') return;
    const pb = player.box();
    const hurt = (dmg, fromX) => player.hurt(dmg, fromX);
    if (this.state === 'dive' && touch(pb, this.box('dive'))) {
      // touché : il remonte ; KAGE encore invulnérable (il clignote) : il file et s'écrase
      if (hurt(KARASU.diveHit, this.x)) {
        this.onEvent?.('diveHit', { x: player.x, y: player.y - 12 });
        this.setState('pullup');
      }
    }
    for (const s of this.shots) {
      if (s.state === 'fall' && touch(pb, { x: s.x - 4, y: s.y - 5, w: 8, h: 9 })) {
        if (hurt(s.kind === 'acorn' ? KARASU.acornHit : KARASU.boomHit, s.x)) s.dead = true;
      }
    }
    for (const th of this.thorns) {
      if (touch(pb, { x: th.x - 3, y: th.y - 3, w: 6, h: 4 })) hurt(KARASU.thornHit, th.x - th.dir * 10);
    }
    for (const bm of this.booms ?? []) {
      const cx = player.x, cy = player.y - 11;
      if (Math.hypot(cx - bm.x, cy - (this.groundY - 6)) < KARASU.boomRadius + 6) hurt(KARASU.boomHit, bm.x);
    }
    this.booms = [];
  }

  // ---- dessin ---------------------------------------------------------------
  frame() {
    const a = this.meta.animations[this.animName];
    if (!a.durations) return a.frames[0];
    const total = a.durations.reduce((s, d) => s + (d || 1e9), 0);
    let t = this.animT * 1000;
    if (a.loop) t %= total;
    for (let i = 0; i < a.frames.length; i++) {
      const d = a.durations[i] || 1e9;
      if (t < d) return a.frames[i];
      t -= d;
    }
    return a.frames[a.frames.length - 1];
  }

  /** L'épouvantail (derrière KAGE) et les ombres des projectiles au sol. */
  drawBack(ctx, cam) {
    const m = this.meta;
    const k = Math.max(0, Math.min(4, Math.round((this.sway + 1) * 2)));
    const f = m.frames[`perch_${k}`];
    const sx = Math.round(this.perchX - m.perchPivot.x - cam.x), sy = Math.round(this.groundY - m.perchPivot.y - cam.y);
    ctx.drawImage(this.img.perch, f.x, f.y, f.w, f.h, sx, sy, f.w, f.h);
    // ombres au sol : elles annoncent où tombe chaque projectile
    for (const s of this.shots) {
      const h = Math.max(0, this.groundY - s.y);
      const w = Math.max(3, Math.round(12 - h / 12));
      ctx.globalAlpha = s.state === 'fall' ? Math.min(0.45, 0.15 + 30 / (h + 30)) : 0.35;
      ctx.fillStyle = '#1a120c';
      const gx = s.state === 'fall' ? s.tx ?? s.x : s.x;
      ctx.fillRect(Math.round(gx - w / 2 - cam.x), Math.round(this.groundY - 2 - cam.y), w, 2);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, cam) {
    if (this.gone) return;
    const m = this.meta, name = this.frame(), f = m.frames[name];
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y) - m.pivot.y;
    ctx.save();
    if (this.facing < 0) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img.sheet, f.x, f.y, f.w, f.h, -m.pivot.x, sy, f.w, f.h);
    } else {
      ctx.drawImage(this.img.sheet, f.x, f.y, f.w, f.h, sx - m.pivot.x, sy, f.w, f.h);
    }
    ctx.restore();
    if (this.flash > 0) {                        // éclair blanc bref quand il est touché
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'lighter';
      const b = this.box();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y), b.w, b.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // projectiles et épines
    for (const s of this.shots) {
      const a = m.animations[s.kind];
      const fr = m.frames[a.frames[Math.floor(s.t * (s.state === 'fuse' ? 14 : 10)) % a.frames.length]];
      const blink = s.state === 'fuse' && Math.floor(s.t * 12) % 2 === 0;
      ctx.drawImage(this.img.items, fr.x, fr.y, fr.w, fr.h, Math.round(s.x - fr.w / 2 - cam.x), Math.round(s.y - fr.h + 5 - cam.y), fr.w, fr.h);
      if (blink) {
        ctx.fillStyle = '#ffe39a';
        ctx.fillRect(Math.round(s.x + 6 - cam.x), Math.round(s.y - 13 - cam.y), 2, 2);
      }
    }
    for (const th of this.thorns) {
      const x = Math.round(th.x - cam.x), y = Math.round(th.y - cam.y);
      ctx.fillStyle = '#0a0b11';
      ctx.fillRect(x - 3, y - 1, 7, 3);
      ctx.fillStyle = '#b9bec6';
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x + th.dir * 2, y - 1, 1, 1);
    }
  }
}
