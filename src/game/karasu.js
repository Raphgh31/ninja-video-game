// KARASU-KASHI — le corbeau du potager, mini-boss du chapitre 1.
//
// Perché sur son épouvantail géant, il toise KAGE. Quand le combat s'engage :
//   1. les pierres : il va chercher une pierre sur un des tas de l'arène (il se
//      pose presque, la saisit dans ses serres), remonte très haut — hors de
//      portée depuis le sol, même d'un shuriken lancé en sautant — et la lâche
//      au-dessus de KAGE. Une ombre annonce la chute ; les pierres tombent moins
//      vite que les anciens projectiles ; les grosses roulent un peu.
//   2. les plateformes de bois : depuis elles, un coup de sabre sauté l'atteint.
//      Touché en vol, il tombe et s'écrase, le bec planté dans la terre ; sa
//      chute fait s'effondrer toutes les plateformes (on ne refait pas le coup).
//   3. les plongeons (seulement une fois les plateformes tombées) : il prend de
//      la hauteur, décrit un léger arc puis fond sur KAGE ; manqué, il s'écrase,
//      le bec planté. Planté, il est vulnérable au sabre et au coup de pied ;
//      puis il s'ébroue, remet son chapeau, regagne son perchoir.
// Plus il perd de vie, plus il est rapide (trois paliers), sans jamais attaquer
// sans préparation lisible. Les sons et les effets passent par onEvent.

import { DAMAGE_DEALT } from './combat.js';
import { TILE } from './level.js';

export const KARASU = {
  hp: 24,
  engageX: 1,              // cases après le début de l'arène : le combat commence (dès qu'on y entre : il croasse)
  altitude: 76,            // px : ses pattes au-dessus du sol en vol (le corps entre ~92 et ~134 px) :
                           // deux fois plus haut qu'avant : hors de portée depuis le sol (sabre et
                           // shuriken au sommet d'un saut), à portée d'un saut depuis les plateformes
  flySpeed: 115,           // px/s en vol (déplacements)
  carrySpeed: 80,          // px/s quand il porte une pierre (il suit KAGE)
  takeoff: 0.42,           // s
  taunt: 3.8,              // s sur son perchoir quand KAGE arrive : il croasse trois fois, le toise, puis part
                           // chercher sa première pierre (le joueur comprend qu'un combat commence)
  cawLong: [0.03, 1.12, 2.21],   // début des cris dans karasu_croa_long.mp3 (s) : le bec s'ouvre avec eux
  cawShort: [0.03, 1.14],        // début des cris dans karasu_croa.mp3 (retour au perchoir)
  cawOpen: 0.5,                  // s de bec ouvert par cri
  grab: 0.42,              // s pour saisir une pierre au sol
  grabHover: 6,            // px : ses pattes au-dessus du sol quand il saisit une pierre
  // par palier (début, milieu, fin)
  rocks: [3, 3, 4],        // pierres par sortie
  releaseWindup: [0.32, 0.26, 0.21],   // s : il ouvre les serres au-dessus de KAGE avant de lâcher
  lead: 0.5,               // s : il se place là où KAGE sera (sa vitesse × lead)
  throwLead: 0.4,          // la pierre part avec un peu de l'élan de KAGE (vx × throwLead, ±50 px/s)
  aim: [0.85, 0.68, 0.55], // s de visée avant le plongeon (le joueur doit pouvoir le lire)
  stuck: [2.9, 2.6, 2.3],  // s coincé dans le sol
  perchPause: [2.1, 1.9, 1.8],   // s sur le perchoir au retour : il finit ses deux croassements (1,7 s) avant de repartir
  diveSpeed: [300, 330, 360],
  diveRise: 34,            // px : il prend de la hauteur avant de plonger
  diveClear: 17,           // px : hauteur de sa boîte au-dessus du sol quand elle passe sur KAGE
  crash: 0.32,
  shake: 0.75,
  hurtFlash: 0.16,
  diveHit: 2,
  // pierres : petite, moyenne, grosse (rayon, dégâts, gravité, roulement)
  // (nov. 2026 : chute plus rapide qu'à la refonte, elles s'esquivaient trop facilement)
  rock: [
    { r: 4, dmg: 1, g: 390, roll: 0 },
    { r: 6, dmg: 1, g: 370, roll: 0 },
    { r: 8, dmg: 1, g: 350, roll: 58 },
  ],
  rollTime: 0.7,
  knockFall: 360,          // gravité de sa chute quand il est touché en vol
};

// les images où l'aile descend : le son du coup d'aile part à ce moment-là
const WING_DOWN = new Set(['fly_3', 'carry_3', 'open_2', 'takeoff_2', 'drop_2']);
const PHASE_OF = (f) => (f > 0.66 ? 0 : f > 0.33 ? 1 : 2);
const touch = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Karasu {
  /** def : { x, y (cases : le pied de l'épouvantail), arena: [x0, x1] (cases), piles: [x…] (cases) } */
  constructor(meta, images, def, level) {
    this.meta = meta;
    this.img = images;                 // { sheet, perch, items }
    this.level = level;
    this.perchX = def.x * TILE + 8;
    this.groundY = def.y * TILE;
    this.arena = [def.arena[0] * TILE, def.arena[1] * TILE];
    this.piles = (def.piles ?? []).map((x) => x * TILE + 8);
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
    this.cawing = null;
    this.flash = 0;
    this.shots = [];           // pierres lâchées
    this.carry = null;         // la pierre qu'il tient dans ses serres
    this.sway = 0;             // l'épouvantail : inclinaison et vitesse
    this.swayV = 0;
    this.lastHit = -1;
    this.rocksLeft = 0;
    this.nextIdle = 2.5;
    this.diveDone = 0;
    this.gone = false;
    this.defeatedT = 0;
    this.level.restoreScaffolds?.();   // les plateformes de bois sont de nouveau debout
  }

  get alive() { return this.state !== 'defeated'; }
  get noBar() { return true; }        // pas de barre au-dessus de la tête : la sienne est en haut de l'écran
  get scaffoldsUp() { return this.level.scaffolds?.some((s) => s.up) ?? false; }

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
    if (this.state === 'dive' || this.state === 'knocked') return 'dive';
    if (this.state === 'crash' || this.state === 'stuck' || this.state === 'defeated') return 'stuck';
    return 'flying';
  }

  box(name = this.boxName()) {
    const b = this.meta.boxes[name];
    const { pivot } = this.meta;
    const ox = this.facing > 0 ? b.x - pivot.x : pivot.x - (b.x + b.w);
    return { x: this.x + ox, y: this.y - pivot.y + b.y, w: b.w, h: b.h };
  }

  get flying() { return ['takeoff', 'fetch', 'grab', 'lift', 'carry', 'release', 'hover', 'aim', 'dive', 'return'].includes(this.state); }

  // ---- coups reçus ----------------------------------------------------------
  /**
   * Planté dans le sol : le sabre, le coup de pied et le shuriken le blessent.
   * En vol : un coup de sabre (id = numéro du coup) le fait tomber ; un shuriken
   * (id = null) le blesse sans le faire tomber.
   */
  takeHit(box, attackerX, id = null, dmg = DAMAGE_DEALT.sword) {
    if (!this.alive || !this.engaged || (id !== null && id === this.lastHit)) return null;
    const stuck = this.state === 'stuck' || this.state === 'crash';
    if (!stuck && !this.flying) return null;
    if (!touch(box, this.box())) return null;
    if (id !== null) this.lastHit = id;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = KARASU.hurtFlash;
    const dir = Math.sign(this.x - attackerX) || 1;
    this.onEvent?.('hit', { x: this.x, y: this.y - 30, dmg, stuck, dir });
    if (this.hp <= 0) {
      this.dropCarried();
      this.setState('defeated');
      this.play('defeated');
      this.vx = 0;
      this.vy = 0;
      this.onEvent?.('defeat', { x: this.x, y: this.y });
    } else if (stuck) {
      this.hitT = 0.18;               // réaction : la mine vexée
    } else if (id !== null) {
      // touché au sabre en plein vol : il tombe, tourneboule, et s'écrase bec en avant
      this.dropCarried();
      this.setState('knocked');
      this.play('hurt');
      this.vx = dir * 70;
      this.vy = -90;
      this.facing = dir;
      this.onEvent?.('knocked', { x: this.x, y: this.y - 30 });
    } else {
      this.vy -= 40;                  // touché par un shuriken en vol : il encaisse, vexé
    }
    return 'hit';
  }

  push() {}                          // le coup de pied ne le repousse pas (il est planté)

  /** Lâche la pierre qu'il portait (touché, vaincu) : elle tombe tout droit. */
  dropCarried() {
    if (!this.carry) return;
    this.throwRock(0);
  }

  // ---- comportement ---------------------------------------------------------
  update(dt, player) {
    this.timer += dt;
    this.animT += dt;
    this.voice(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hitT = Math.max(0, (this.hitT ?? 0) - dt);
    // l'épouvantail : un ressort amorti
    this.swayV += (-this.sway * 38 - this.swayV * 3.2) * dt;
    this.sway = Math.max(-1, Math.min(1, this.sway + this.swayV * dt));
    this.updateShots(dt);
    if (this.state === 'defeated') {
      this.defeatedT += dt;
      this.vy += KARASU.knockFall * dt;
      this.y = Math.min(this.groundY, this.y + this.vy * dt);
      return;
    }
    const P = this.phase;
    const px = player.x;
    // KAGE quitte l'arène : il regagne son perchoir et l'attend (pas de coups gratuits au loin)
    if (this.engaged && px < this.arena[0] - 48 && ['fetch', 'grab', 'lift', 'carry', 'release', 'hover', 'aim'].includes(this.state)) {
      this.engaged = false;
      this.carry = null;
      this.setState('return');
      this.onEvent?.('disengage', {});
    }
    const toward = Math.sign(px - this.x) || this.facing;
    const cruise = this.groundY - KARASU.altitude;
    switch (this.state) {
      case 'perch': {
        const top = this.perchPoint();
        this.x = top.x; this.y = top.y;
        this.facing = toward;
        this.personality(dt);
        if (!this.engaged) {
          // il attend : il toise KAGE, penche la tête, redresse son chapeau
          if (px > this.arena[0] + KARASU.engageX * TILE && player.state !== 'death') {
            this.engaged = true;
            this.onEvent?.('engage', {});
            this.setState('taunt');
            this.caw(KARASU.cawLong, true);
          }
        } else if (this.timer > KARASU.perchPause[P]) this.takeOff(P);
        break;
      }
      case 'taunt':                  // il croasse sur son perchoir, toise KAGE, puis s'envole
        this.facing = toward;
        if (!this.cawing && this.animName !== 'look') this.play('look');
        if (this.timer > KARASU.taunt) this.takeOff(P);
        break;
      case 'takeoff':
        this.play('takeoff');
        this.y -= 70 * dt;
        if (this.timer > KARASU.takeoff) this.goFetch(px);
        break;
      case 'fetch': {                // il vole vers un tas de pierres, puis descend dessus
        this.play('fly');
        const tx = this.pileX, ty = this.groundY - KARASU.grabHover;
        const near = Math.abs(this.x - tx) < 6;
        this.steer(tx, near ? ty : Math.min(cruise + 20, ty - 30), KARASU.flySpeed * (near ? 0.8 : 1.15), dt);
        this.facing = Math.sign(tx - this.x) || this.facing;
        if (near && Math.abs(this.y - ty) < 5) {
          this.setState('grab');
          this.play('open');                 // serres ouvertes au-dessus du tas
        }
        break;
      }
      case 'grab':                   // serres ouvertes, il saisit une pierre
        this.y = this.groundY - KARASU.grabHover + Math.sin(this.timer * 18) * 1.2;
        if (this.timer > KARASU.grab * 0.55 && !this.carry) {
          const size = Math.random() < [0.25, 0.4, 0.5][P] ? 2 : Math.random() < 0.5 ? 1 : 0;
          this.carry = { size };
          this.play('carry');                // les serres se referment sur la pierre
          this.onEvent?.('grab', { x: this.x, y: this.groundY, size });
        }
        if (this.timer > KARASU.grab) { this.setState('lift'); this.onEvent?.('flap', { x: this.x, y: this.y }); }
        break;
      case 'lift':                   // il remonte, la pierre dans les serres
        this.play(this.carry ? 'carry' : 'fly');
        this.steer(this.x + toward * 10, cruise, KARASU.flySpeed, dt);
        this.facing = toward;
        if (Math.abs(this.y - cruise) < 6) this.setState('carry');
        break;
      case 'carry': {                // il se place au-dessus de KAGE (légère avance sur sa course)
        this.play('carry');
        const lead = this.clampX(px + player.vx * KARASU.lead, 30);
        const far = Math.abs(lead - this.x) > 70;           // loin : il file ; au-dessus de KAGE : il le suit
        this.steer(lead, cruise + Math.sin(this.animT * 2.4) * 3, far ? KARASU.flySpeed * 1.1 : KARASU.carrySpeed, dt);
        this.facing = toward;
        if ((Math.abs(this.x - lead) < 10 && this.timer > 0.5) || this.timer > 5) {
          this.setState('release');
          this.play('open');                 // il ouvre les serres : la pierre va tomber
        }
        break;
      }
      case 'release':                // il ouvre les serres (lisible), puis lâche
        this.steer(this.x, cruise, 20, dt);
        if (this.timer > KARASU.releaseWindup[P]) {
          this.throwRock(Math.max(-50, Math.min(50, player.vx * KARASU.throwLead)) || this.facing * 12);
          this.rocksLeft--;
          if (this.rocksLeft > 0) this.goFetch(px);
          else if (!this.scaffoldsUp) { this.setState('aim'); this.aimSide = -toward; this.onEvent?.('glare', { x: this.x, y: this.y - 40 }); }
          else this.setState('hover');
        }
        break;
      case 'hover': {                // au-dessus des plateformes, il nargue KAGE avant de repartir
        this.play('fly');
        const hx = this.clampX(px + Math.sin(this.timer * 1.4) * 40, 40);
        this.steer(hx, cruise + Math.sin(this.timer * 2.1) * 5, KARASU.flySpeed * 0.6, dt);
        this.facing = toward;
        if (this.timer > 1.6) this.setState('return');
        break;
      }
      case 'aim': {                  // il prend de la hauteur, se place, fixe KAGE
        this.play('aim');
        let sx = px + this.aimSide * 104;
        if (sx !== this.clampX(sx, 30)) { this.aimSide = -this.aimSide; sx = px + this.aimSide * 104; }   // pas de place : de l'autre côté
        sx = this.clampX(sx, 30);
        this.steer(sx, cruise - KARASU.diveRise, KARASU.flySpeed * 1.2, dt);
        this.facing = toward;
        if (this.timer > KARASU.aim[P]) this.startDive(player, P);
        break;
      }
      case 'dive': {                 // un arc : il remonte un peu, s'incurve et fond sur KAGE
        this.play(this.u < 0.25 ? 'aim' : 'dive');
        const sp = Math.min(KARASU.diveSpeed[P], 140 + this.timer * 760);
        let p;
        if (this.u < 1) {                            // l'arc
          const d = this.bezierD(this.u);
          this.u = Math.min(1, this.u + (sp * dt) / Math.max(1, Math.hypot(d.x, d.y)));
          p = this.bezier(this.u);
          this.v = 0;
        } else {                                     // la ligne droite finale
          const ln = this.line;
          this.v = Math.min(1, this.v + (sp * dt) / Math.max(1, ln.len));
          p = { x: ln.x0 + (ln.x1 - ln.x0) * this.v, y: ln.y0 + (ln.y1 - ln.y0) * this.v };
        }
        this.facing = Math.sign(p.x - this.x) || this.facing;
        this.x = p.x; this.y = p.y;
        if ((this.u >= 1 && this.v >= 1) || this.y >= this.groundY) {   // il touche le sol : écrasé dans le potager
          this.y = this.groundY;
          this.setState('crash');
          this.play('crash');
          this.onEvent?.('crash', { x: this.x, y: this.groundY, dir: this.facing });
        }
        break;
      }
      case 'knocked': {              // touché en vol : il tombe et s'écrase bec en avant
        this.vy += KARASU.knockFall * dt;
        this.x = this.clampX(this.x + this.vx * dt, 24);
        this.y += this.vy * dt;
        if (this.vy > 60) this.play('dive');
        if (this.y >= this.groundY) {
          this.y = this.groundY;
          this.setState('crash');
          this.play('crash');
          this.onEvent?.('crash', { x: this.x, y: this.groundY, dir: this.facing, heavy: true });
          // sa chute fait trembler le champ : les plateformes de bois s'effondrent
          if (this.scaffoldsUp) this.level.collapseScaffolds?.(this.x);
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
          this.caw(KARASU.cawShort, false);      // de retour sur son perchoir : il croasse
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
          else { this.diveDone = 0; this.goFetch(px, KARASU.rocks[P]); }
        }
        break;
      }
      default:
    }
  }

  /** Les petites animations de caractère, quand il est perché. */
  personality(dt) {
    if (this.cawing) return;                      // il croasse : le bec suit les cris (voir caw)
    const a = this.meta.animations[this.animName];
    if (this.animName !== 'idle' && !a.loop && (!a.durations || this.animT > a.durations.reduce((s, d) => s + d, 0) / 1000)) this.play('idle');
    this.nextIdle -= dt;
    if (this.nextIdle <= 0 && this.animName === 'idle') {
      this.play(Math.random() < 0.6 ? 'look' : 'hatfix');
      this.nextIdle = 2.4 + Math.random() * 2.6;
    }
  }

  /** Il croasse : le son enregistré, et le bec qui s'ouvre au début de chaque cri. */
  caw(times, long) {
    this.cawing = { t: 0, times };
    this.onEvent?.('caw', { x: this.x, y: this.y - 40, long });
  }

  /** Le bec pendant un croassement (perché) ; un coup d'aile à chaque descente d'aile. */
  voice(dt) {
    if (this.cawing) {
      const c = this.cawing;
      c.t += dt;
      const open = c.times.some((t0) => c.t >= t0 && c.t < t0 + KARASU.cawOpen);
      if (['perch', 'taunt'].includes(this.state)) this.play(open ? 'cawOpen' : 'cawShut');
      if (c.t > c.times[c.times.length - 1] + KARASU.cawOpen + 0.15 || !['perch', 'taunt'].includes(this.state)) {
        this.cawing = null;
        if (['perch', 'taunt'].includes(this.state)) this.play('idle');
      }
    }
    const f = this.frame();
    if (f !== this.lastFrame && WING_DOWN.has(f)) this.onEvent?.('wingbeat', { x: this.x, y: this.y - 30 });
    this.lastFrame = f;
  }

  takeOff(P) {
    this.setState('takeoff');
    this.rocksLeft = KARASU.rocks[P];
    this.kick(2.8);
    this.onEvent?.('flap', { x: this.x, y: this.y });
  }

  /** Va chercher une pierre : le tas le plus proche qui reste à bonne distance de
   *  KAGE (il ne vient pas se servir sous son nez), sinon le plus éloigné. */
  goFetch(px, n = null) {
    if (n != null) this.rocksLeft = n;
    const piles = this.piles.length ? this.piles : [this.perchX];
    const ok = piles.filter((x) => Math.abs(x - px) > 96).sort((a, b) => Math.abs(a - this.x) - Math.abs(b - this.x));
    this.pileX = ok[0] ?? piles.reduce((a, b) => (Math.abs(b - px) > Math.abs(a - px) ? b : a));
    this.setState('fetch');
  }

  clampX(x, m) { return Math.max(this.arena[0] + m, Math.min(this.arena[1] - m, x)); }

  steer(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const v = Math.min(speed, d * 4);
    this.x += (dx / d) * v * dt;
    this.y += (dy / d) * v * dt;
  }

  /** La pierre portée part : elle tombe (vx : un peu d'élan vers l'avant). */
  throwRock(vx) {
    const size = this.carry?.size ?? 0;
    const g = this.gripPoint(), r = KARASU.rock[size].r;
    this.carry = null;
    // elle part de ses serres (s.y : le bas de la pierre)
    this.shots.push({ size, x: g.x, y: g.y + 2 * r, vx, vy: 0, t: 0, state: 'fall', spin: 0, dir: Math.sign(vx) || this.facing });
    this.onEvent?.('throw', { x: this.x, y: this.y, size });
  }

  // ---- le plongeon en arc ------------------------------------------------------
  startDive(player, P) {
    // Il vise le sol juste au-delà de KAGE. La fin de la courbe suit la droite
    // qui fait passer le bas de sa boîte à KARASU.diveClear px du sol au-dessus de
    // KAGE : trop bas pour KAGE debout (22 px), assez haut pour qu'il glisse dessous.
    this.facing = Math.sign(this.clampX(player.x, 24) - this.x) || this.facing;
    const f = this.facing, b = this.meta.boxes.dive, pivot = this.meta.pivot;
    const rear = pivot.x - b.x;
    const lift = pivot.y - (b.y + b.h);
    const qx = this.clampX(player.x, 24) + f * (rear + 8);
    const qy = this.groundY - KARASU.diveClear + lift;
    const sx = qx - this.x, sy = qy - this.y;
    const k = (this.groundY - this.y) / Math.max(1, sy);
    const cx = this.clampX(this.x + sx * k, 20), cy = this.groundY;
    // l'arc : une courbe de Bézier du point de départ jusqu'à Q, sur la droite de
    // visée (à 72 px du sol d'arrivée), tangente à elle en Q ; puis la fin du
    // plongeon est droite (elle passe au-dessus de KAGE à la hauteur prévue)
    const L = Math.hypot(cx - this.x, cy - this.y), ux = (cx - this.x) / L, uy = (cy - this.y) / L;
    const back = Math.min(72, L * 0.45);
    const q = { x: cx - ux * back, y: cy - uy * back };
    const lq = Math.hypot(q.x - this.x, q.y - this.y);
    this.p0 = { x: this.x, y: this.y };
    this.p1 = { x: q.x - ux * lq * 0.55, y: Math.min(this.y - 20, q.y - uy * lq * 0.55) };
    this.p2 = q;
    this.line = { x0: q.x, y0: q.y, x1: cx, y1: cy, len: back };
    this.u = 0;
    this.diveTarget = { x: cx, y: cy, at: player.x };
    this.setState('dive');
    this.onEvent?.('dive', { x: this.x, y: this.y });
  }

  bezier(u) {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return { x: a * this.p0.x + b * this.p1.x + c * this.p2.x, y: a * this.p0.y + b * this.p1.y + c * this.p2.y };
  }

  bezierD(u) {
    return {
      x: 2 * (1 - u) * (this.p1.x - this.p0.x) + 2 * u * (this.p2.x - this.p1.x),
      y: 2 * (1 - u) * (this.p1.y - this.p0.y) + 2 * u * (this.p2.y - this.p1.y),
    };
  }

  // ---- pierres ----------------------------------------------------------------
  /** Haut de la surface sous (x, y) : le sol de l'arène ou une plateforme de bois. */
  surfaceAt(x, y) {
    const lv = this.level, tx = Math.floor(x / TILE);
    for (let ty = Math.max(0, Math.floor(y / TILE)); ty < lv.h; ty++) {
      if (lv.solid(tx, ty) || lv.ledge(tx, ty)) return Math.min(ty * TILE, this.groundY);
    }
    return this.groundY;
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.t += dt;
      const R = KARASU.rock[s.size];
      if (s.state === 'fall') {
        s.vy += R.g * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += dt * 6;
        const floor = this.surfaceAt(s.x, s.y - 2);
        if (s.y >= floor) {
          s.y = floor;
          this.onEvent?.('rockLand', { x: s.x, y: floor, size: s.size });
          if (R.roll && floor === this.groundY) { s.state = 'roll'; s.t = 0; }
          else s.dead = true;
        }
      } else if (s.state === 'roll') {
        s.x += s.dir * R.roll * (1 - s.t / KARASU.rollTime) * dt;
        s.spin += s.dir * dt * 8;
        if (s.t > KARASU.rollTime || s.x < this.arena[0] + 8 || s.x > this.arena[1] - 8) { s.dead = true; this.onEvent?.('rockBreak', { x: s.x, y: s.y, size: s.size }); }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  /** Ce qui blesse KAGE : le plongeon et les pierres. */
  interact(player) {
    if (player.state === 'death' || player.state === 'respawn') return;
    const pb = player.box();
    if (this.state === 'dive' && touch(pb, this.box('dive'))) {
      // touché : il remonte ; KAGE encore invulnérable (il clignote) : il file et s'écrase
      if (player.hurt(KARASU.diveHit, this.x)) {
        this.onEvent?.('diveHit', { x: player.x, y: player.y - 12 });
        this.setState('pullup');
      }
    }
    for (const s of this.shots) {
      const r = KARASU.rock[s.size].r;
      if (touch(pb, { x: s.x - r, y: s.y - 2 * r, w: 2 * r, h: 2 * r }) && player.hurt(KARASU.rock[s.size].dmg, s.x)) {
        s.dead = true;
        this.onEvent?.('rockBreak', { x: s.x, y: s.y - r, size: s.size });
      }
    }
  }

  /** Le haut de la pierre tenue, dans le monde : sous ses serres (images carry_ et open_). */
  gripPoint() {
    const m = this.meta, g = m.grip?.[this.frame()] ?? m.grip?.carry_2 ?? { x: m.pivot.x, y: m.pivot.y - 10 };
    return { x: this.x + (g.x - m.pivot.x) * this.facing, y: this.y + g.y - m.pivot.y };
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

  /** Une pierre (rayon r) : tirée une fois, puis recopiée. */
  rockSprite(size) {
    this.rockImg ??= [];
    if (this.rockImg[size]) return this.rockImg[size];
    const r = KARASU.rock[size].r, d = 2 * r + 2;
    const c = document.createElement('canvas');
    c.width = d; c.height = d;
    const g = c.getContext('2d');
    const ST = ['#3c3833', '#57514a', '#746d63', '#958d80', '#b6ad9e'];
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const dx = (x - r - 0.5) / r, dy = (y - r - 0.5) / (r * 0.85);
      const bump = Math.sin(x * 2.1 + size) * 0.08 + Math.cos(y * 1.7) * 0.08;
      const q = dx * dx + dy * dy;
      if (q > 1 + bump) continue;
      let v = 0.62 - dx * 0.25 - dy * 0.3;
      if (q > 0.82 + bump) v = 0.05;
      if ((x * 7 + y * 3 + size) % 11 === 0) v -= 0.15;
      g.fillStyle = ST[Math.max(0, Math.min(4, Math.round(v * 4)))];
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = '#5f8a3a';                           // une touche de mousse
    g.fillRect(r - 1, 1, 2, 1);
    this.rockImg[size] = c;
    return c;
  }

  /** L'épouvantail (derrière KAGE) et les ombres des pierres au sol. */
  drawBack(ctx, cam) {
    const m = this.meta;
    const k = Math.max(0, Math.min(4, Math.round((this.sway + 1) * 2)));
    const f = m.frames[`perch_${k}`];
    const sx = Math.round(this.perchX - m.perchPivot.x - cam.x), sy = Math.round(this.groundY - m.perchPivot.y - cam.y);
    ctx.drawImage(this.img.perch, f.x, f.y, f.w, f.h, sx, sy, f.w, f.h);
    // ombres au sol (ou sur une plateforme) : elles annoncent où tombe chaque pierre
    const shadow = (x, floor, h, r) => {
      const w = Math.max(3, Math.round(r * 2.4 - h / 14));
      ctx.globalAlpha = Math.min(0.5, 0.18 + 40 / (h + 40));
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(Math.round(x - w / 2 - cam.x), Math.round(floor - 2 - cam.y), w, 2);
    };
    for (const s of this.shots) {
      if (s.state !== 'fall') continue;
      const floor = this.surfaceAt(s.x, s.y);
      shadow(s.x + s.vx * Math.sqrt((2 * Math.max(0, floor - s.y)) / KARASU.rock[s.size].g), floor, floor - s.y, KARASU.rock[s.size].r);
    }
    if (this.carry && ['carry', 'release'].includes(this.state)) {
      const g = this.gripPoint(), floor = this.surfaceAt(g.x, g.y);
      shadow(g.x, floor, floor - g.y, KARASU.rock[this.carry.size].r * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, cam) {
    if (this.gone) return;
    const m = this.meta, name = this.frame(), f = m.frames[name];
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y) - m.pivot.y;
    // la pierre qu'il tient, sous ses serres
    if (this.carry) {                            // dessinée avant lui : ses doigts passent devant
      const img = this.rockSprite(this.carry.size), r = KARASU.rock[this.carry.size].r, g = this.gripPoint();
      ctx.drawImage(img, Math.round(g.x - r - 1 - cam.x), Math.round(g.y - 1 - cam.y));
    }
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
    // pierres qui tombent ou qui roulent (elles tournent sur elles-mêmes)
    for (const s of this.shots) {
      const img = this.rockSprite(s.size), r = KARASU.rock[s.size].r;
      const x = Math.round(s.x - cam.x), y = Math.round(s.y - r - cam.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.round(s.spin) * (Math.PI / 2));       // quarts de tour : les pixels restent nets
      ctx.drawImage(img, -r - 1, -r - 1);
      ctx.restore();
    }
  }
}
