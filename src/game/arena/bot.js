// Le ninja de l'ombre (mode Arène, novembre 2026) : un adversaire joué par l'ordinateur, pour s'entraîner
// seul et pour le Dojo. Il joue un vrai KAGE (player.js : mêmes gestes, mêmes règles, même énergie) avec
// des commandes virtuelles, et passe par le même chemin qu'un adversaire en ligne (multi.js, sur un réseau
// local à la page : engine/localnet.js) : coups, parades, chocs des lames, manches, coup fatal, revoir.
//
// Son jeu (recherche : les bons adversaires d'entraînement des jeux de combat) : il a un temps de réaction
// (il ne lit pas les touches, il voit les gestes), il garde sa distance de sabre, pare une partie des
// coups qu'il voit venir, riposte après une parade, brise la garde d'un coup de pied, lance un shuriken de
// loin, saute vers qui se perche, évite l'eau et le vide, va chercher un cœur quand il est à bout.
// Trois niveaux ; « L'ombre apprend » : il monte d'un cran quand on le bat, redescend quand il gagne.
// Le Dojo : il frappe à un rythme régulier, lisible, pour apprendre la parade et la riposte.
import { Player } from '../player.js';
import { Shurikens } from '../shuriken.js';
import { Multi } from '../multi.js';
import { DAMAGE_DEALT } from '../combat.js';
import { TILE } from '../level.js';

export const BOT = {
  levels: [
    { name: 'Apprenti', react: 0.36, parry: 0.22, aggro: 0.5, throw: 0.12, kick: 0.15, riposte: 0.4, jump: 0.25 },
    { name: 'Ninja', react: 0.24, parry: 0.45, aggro: 0.7, throw: 0.22, kick: 0.3, riposte: 0.7, jump: 0.4 },
    { name: 'Maître', react: 0.15, parry: 0.68, aggro: 0.85, throw: 0.3, kick: 0.45, riposte: 0.92, jump: 0.55 },
  ],
  dojo: { name: 'Dojo', react: 0.3, parry: 0.35, aggro: 1, throw: 0, kick: 0, riposte: 0.5, jump: 0, every: 1.7 },
  range: [15, 27],          // px : la distance du sabre qu'il cherche
  name: "L'ombre",
};

const SWORDS = new Set(['attack', 'air_attack', 'flip_attack']);

/** Les commandes virtuelles (comme engine/input.js). */
class BotInput {
  constructor() { this.held = new Set(); this.pressed = new Set(); }
  isHeld(a) { return this.held.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  tap(a) { this.pressed.add(a); }
  hold(a, on) { if (on) this.held.add(a); else this.held.delete(a); }
  clear() { this.held.clear(); this.pressed.clear(); }
  endFrame() { this.pressed.clear(); }
}

export class ShadowBot {
  /**
   * o : { level, meta, skins, net (le bout « invité » de localnet), skin, foe (le KAGE du joueur),
   *       foeShurikens, dojo, rank (0..2), onEvent(n, d) (sons et effets), mist() (bords de la brume ou null) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.p = this.dojo ? BOT.dojo : BOT.levels[Math.max(0, Math.min(2, this.rank ?? 1))];
    this.input = new BotInput();
    const pl = (this.player = new Player(this.meta, this.level));
    pl.canParry = true;
    this.shurikens = new Shurikens(this.level, this.meta);
    this.shurikens.onEvent = () => {};
    pl.canThrow = () => this.shurikens.canThrow();
    pl.onThrow = (x, y, dir, h) => { this.shurikens.throw(x, y, dir, h); this.multi.onThrow(x, y, dir, h); };
    pl.onEvent = (n, d) => {
      if (n === 'death') this.multi.onDeath();
      this.onEvent?.(n, { ...d, x: d.x ?? pl.x, y: d.y ?? pl.y });
    };
    this.multi = new Multi({ net: this.net, player: pl, shurikens: this.shurikens, level: this.level, levelId: null, meta: this.meta,
      skins: this.skins, skinId: () => this.skin, shared: true, sendEvery: 1 / 120, noDelay: true, onEvent: () => {} });
    this.t = 0;
    this.seen = { threat: false, at: 0, act: null };
    this.atkCd = 0.6;
    this.stuckT = 0;
    this.throwCd = 2;
    this.thinkT = 0;
    this.want = 0;          // direction voulue (-1, 0, 1)
    this.jumpHold = 0;
    this.landX = null;   // l'appui visé par un saut au-dessus de l'eau
    this.locked = false;    // le duel retient les commandes (ouverture, coup fatal…)
  }

  get out() { return this.multi.out; }

  /** « L'ombre apprend » : son niveau pour la revanche. */
  setRank(r) { this.rank = r; if (!this.dojo) this.p = BOT.levels[Math.max(0, Math.min(2, r))]; }

  /** Un pas de jeu. */
  update(dt) {
    this.t += dt;
    const pl = this.player, inp = this.input;
    if (this.locked || this.out || pl.state === 'victory' || pl.state === 'defeat') inp.clear();
    else this.think(dt);
    pl.update(dt, inp);
    inp.endFrame();
    this.multi.update(dt);
    this.shurikens.update(dt);
    if (pl.state !== 'death' && pl.state !== 'respawn') this.shurikens.pickup(pl.box());
    // ses coups : comme ceux du joueur (main.js), par le même chemin qu'en ligne
    const ab = pl.attackBox();
    if (ab) {
      const kind = pl.riposte ? 'riposte' : pl.state === 'flip_attack' ? 'flip' : pl.state === 'air_attack' ? 'air' : 'sword';
      const dmg = (kind === 'flip' ? DAMAGE_DEALT.flipSword : kind === 'air' ? DAMAGE_DEALT.airSword : DAMAGE_DEALT.sword) + (kind === 'riposte' ? 1 : 0);
      const r = this.multi.strikeBox(ab, pl.x, `a${pl.attackId}`, dmg, 0, kind);
      if (r === 'hit') this.onEvent?.('botHit', { kind });
    }
    const kb = pl.kickBox();
    if (kb) this.multi.strikeBox(kb, pl.x, `k${pl.attackId}`, DAMAGE_DEALT.kick, pl.kickPush, 'kick');
  }

  // ---- ce qu'il voit et ce qu'il décide ---------------------------------------------------------
  think(dt) {
    const pl = this.player, foe = this.foe, inp = this.input, P = this.p;
    inp.held.clear();
    if (this.t < this.jumpHold) inp.hold('jump', true);     // (un saut tenu : il monte haut)
    if (pl.state === 'death' || pl.state === 'respawn') return;
    // en l'air au-dessus de l'eau ou d'un vide : il se dirige vers son appui
    if (this.landX != null) {
      if (pl.onGround && this.t > this.landT) this.landX = null;
      else { const d = this.landX - pl.x; if (Math.abs(d) > 3) inp.hold(d < 0 ? 'left' : 'right', true); return; }
    }
    if (this.airStrike && this.t > this.airStrike && !pl.onGround) { inp.tap('attack'); this.airStrike = 0; return; }
    if (foe.state === 'death' || foe.state === 'respawn' || this.foeOut?.()) { this.idleAround(); return; }
    this.atkCd -= dt; this.throwCd -= dt;
    const dx = foe.x - pl.x, adx = Math.abs(dx), dy = foe.y - pl.y, to = Math.sign(dx) || pl.facing;
    const foeFacing = Math.sign(pl.x - foe.x) === foe.facing;

    // 1. la menace : un coup qui vient (il le voit après son temps de réaction)
    const swing = SWORDS.has(foe.state) && foeFacing && adx < 48 && Math.abs(dy) < 34;
    const kick = (foe.state === 'kick' || foe.state === 'air_kick') && foeFacing && adx < 34;
    const star = this.incoming();
    const threat = swing ? 'sword' : kick ? 'kick' : star ? 'star' : null;
    if (threat && !this.seen.threat) { this.seen = { threat: true, at: this.t + P.react * (0.75 + Math.random() * 0.5), act: null }; }
    if (!threat) this.seen.threat = false;
    if (threat && this.seen.threat && this.t >= this.seen.at && !this.seen.act) {
      const r = Math.random();
      this.seen.act = threat === 'kick' ? (r < P.parry ? 'back' : 'none') : r < P.parry ? 'parry' : r < P.parry + 0.2 ? 'back' : 'none';
      if (this.seen.act === 'parry') inp.tap('parry');
      if (this.seen.act === 'back') { this.backUntil = this.t + 0.3; if (threat === 'star' && pl.onGround) this.jump(); }
    }
    if (this.backUntil > this.t) { this.move(-to); this.safety(-to); return; }

    // 2. la riposte : juste après une parade réussie
    if (pl.state === 'parry_hit' && pl.anim.frame >= 1) { if (Math.random() < P.riposte * dt * 30) inp.tap('attack'); return; }
    if (['parry', 'parry_hit', 'stagger', 'hurt', 'attack', 'air_attack', 'flip_attack', 'kick', 'air_kick'].includes(pl.state)) return;

    // 3. à bout de vie : un cœur, s'il y en a un
    const heart = pl.hp <= 2 ? this.level.arena?.pickups.find((k) => k.kind === 'heart') : null;
    if (heart && Math.abs(heart.x - pl.x) > 8) { this.goTo(heart.x, heart.y); return; }

    // 4. la brume d'encre : revenir vers le centre
    const m = this.mist?.();
    if (m && (pl.x < m.l + 30 || pl.x > m.r - 30)) { this.goTo((m.l + m.r) / 2, pl.y); return; }

    // 5. de loin : un shuriken, ou se rapprocher
    if (adx > 90 && Math.abs(dy) < 18 && this.throwCd <= 0 && pl.onGround) {
      this.throwCd = 1.2 + Math.random() * 2;
      if (Math.random() < P.throw * 3) { pl.facing = to; inp.tap('throw'); return; }
    }
    // perché au-dessus : sauter vers lui
    if (dy < -28 && adx < 80) {
      this.move(to);
      if (pl.onGround && Math.random() < P.jump * dt * 6) this.jump();
      this.safety(to);
      return;
    }
    const [near, far] = BOT.range;
    if (adx > far + 4) {
      this.move(to);
      if (adx > 130 && !this.dojo) inp.hold('sprint', true);
      this.safety(to);
      return;
    }
    if (adx < near - 4) { this.move(-to); this.safety(-to); return; }

    // 6. à portée : frapper (rythme du Dojo : régulier, lisible)
    if (pl.facing !== to) { this.move(to); return; }
    if (this.atkCd > 0) return;
    if (foe.state === 'parry' && Math.random() < P.kick * 2) { inp.tap('kick'); this.atkCd = 0.55; return; }
    if (this.dojo) { inp.tap('attack'); this.atkCd = P.every; return; }
    if (Math.random() < P.aggro) {
      const r = Math.random();
      if (r < P.kick * 0.5) inp.tap('kick');
      else if (r < P.kick * 0.5 + P.jump * 0.3 && pl.onGround) { this.jump(); this.airStrike = this.t + 0.18; }
      else inp.tap('attack');
    }
    this.atkCd = 0.35 + (1 - P.aggro) * 0.9 + Math.random() * 0.35;
  }

  /** Personne à combattre (l'autre est tombé) : il reprend son souffle, au centre de l'arène. */
  idleAround() {
    const a = this.level.arena?.def.walls;
    if (a) { const c = ((a[0] + 1 + a[1]) / 2) * TILE; if (Math.abs(this.player.x - c) > 40) this.goTo(c, this.player.y); }
  }

  /** Un saut plein (la touche tenue un instant, comme un joueur). */
  jump(hold = 0.32) { this.input.tap('jump'); this.input.hold('jump', true); this.jumpHold = this.t + hold; }

  move(dir) {
    const inp = this.input, pl = this.player;
    inp.hold(dir < 0 ? 'left' : 'right', true);
    // bloqué contre un obstacle : un saut
    if (pl.onGround && Math.abs(pl.vx) < 8 && !(this.blocked > this.t)) this.stuckT += 1 / 120; else this.stuckT = 0;
    if (this.stuckT > 0.35) { this.hop(dir); this.stuckT = 0; }
  }

  /** Sauter par-dessus un obstacle (une souche, un rebord) : il vise la première case où se poser derrière. */
  hop(dir) {
    const pl = this.player, lv = this.level, ty = Math.floor((pl.y + 2) / TILE);
    const tx = Math.floor(pl.x / TILE);
    for (let k = 1; k <= 5; k++) {
      const x = tx + dir * k;
      if (k > 1 && !lv.solid(x, ty - 1) && !lv.solid(x, ty - 2) && (lv.solid(x, ty) || lv.ledge(x, ty))) {
        this.landX = (x + 0.5) * TILE; this.landT = this.t + 0.12;
        this.jump();
        return;
      }
    }
    // un mur plus haut : un saut pour s'y accrocher (glissade murale, saut mural), sauf si l'eau est derrière
    if (!this.level.arena?.basin || Math.abs(pl.x - this.level.arena.def.center) > 9 * TILE) this.jump();
    else this.backUntil = this.t + 0.5;
  }

  goTo(x, y) {
    const pl = this.player, d = Math.sign(x - pl.x);
    if (Math.abs(x - pl.x) > 6) { this.move(d); this.safety(d); }
    if (y < pl.y - 28 && pl.onGround && Math.random() < 0.05) this.jump();
  }

  /**
   * Devant lui, l'eau ou le vide : s'il y a un appui à moins de cinq cases (la rive d'en face, un rocher du
   * bassin hors de l'eau, une passerelle), il saute et se dirige en l'air vers son milieu ; sinon il s'arrête.
   */
  safety(dir) {
    const pl = this.player, lv = this.level;
    if (!pl.onGround || this.landX != null) return;
    const ty = Math.floor((pl.y + 2) / TILE), ahead = Math.floor((pl.x + dir * 9) / TILE);
    const bs = lv.arena?.def.basin;      // (le bassin de la Forêt : ses rochers sont trop loin l'un de l'autre pour lui)
    const raw = (x) => {
      if (bs && x >= bs.x0 && x < bs.x1) return 9;
      for (let k = 0; k < 6; k++) {
        const c = lv.at(x, ty + k);
        if (c === '~' || c === 'v') return 9;
        if (lv.solid(x, ty + k) || lv.ledge(x, ty + k)) return k;      // (un appui, même un peu plus bas)
      }
      return 9;
    };
    // (une marche à descendre n'est sûre que si la case d'après l'est aussi : en courant, il retombe plus loin)
    const danger = (x) => { const k = raw(x); return k === 9 || (k > 0 && raw(x + dir) === 9); };
    if (!danger(ahead)) return;
    for (let k = 1; k <= 5; k++) {
      const x = ahead + dir * k;
      if (danger(x)) continue;
      // le milieu de l'appui (un rocher de deux cases : entre les deux)
      let x2 = x;
      while (!danger(x2 + dir) && Math.abs(x2 - x) < 2) x2 += dir;
      this.landX = ((x + x2) / 2 + 0.5) * TILE;
      this.landT = this.t + 0.12;
      const d = Math.abs(this.landX - pl.x);
      this.jump(Math.min(0.32, 0.08 + d / 260));
      return;
    }
    // rien où se poser : il garde sa rive (et lance un shuriken s'il le peut)
    this.input.held.delete(dir < 0 ? 'left' : 'right');
    this.blocked = this.t + 0.6;
    this.stuckT = 0;
    if (this.throwCd <= 0 && this.shurikens.stock > 0 && Math.abs(this.foe.y - pl.y) < 20) { this.throwCd = 1 + Math.random() * 1.5; pl.facing = dir; this.input.tap('throw'); }
  }

  /** Un shuriken du joueur qui arrive sur lui. */
  incoming() {
    const pl = this.player;
    for (const s of this.foeShurikens?.flying ?? []) {
      const dx = pl.x - s.x;
      if (Math.sign(dx) === Math.sign(s.vx) && Math.abs(dx) < 80 && Math.abs(s.y - (pl.y - 14)) < 18) return true;
    }
    return false;
  }
}
