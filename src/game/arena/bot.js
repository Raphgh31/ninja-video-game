// Le ninja de l'ombre (mode Arène, novembre 2026 ; refait le 26 novembre 2026 : « qu'il sache vraiment jouer,
// avec trois niveaux réglables et des styles de combat cohérents ») : un adversaire joué par l'ordinateur, pour
// s'entraîner seul et pour le Dojo. Il joue un vrai KAGE (player.js : mêmes gestes, mêmes règles, même énergie)
// avec des commandes virtuelles, et passe par le même chemin qu'un adversaire en ligne (multi.js, sur un réseau
// local à la page : engine/localnet.js).
//
// Comment il joue (recherche : les bons adversaires des jeux de combat — ils voient, puis réagissent ; ils ont un
// plan, ils ne gigotent pas) :
//   - il PERÇOIT le joueur avec un temps de réaction (il voit ses gestes d'il y a 0,12 à 0,34 s, jamais ses
//     touches) ; plus le niveau est haut, plus il voit tôt ;
//   - il SE DÉPLACE sur le graphe des appuis de l'arène (nav.js) : il sait quels sauts il réussit, contourne
//     les souches, ne saute jamais dans l'eau ; sur le même appui que le joueur, il combat ;
//   - il COMBAT en suivant un plan simple et lisible, pris pour un moment (pas de changement d'avis à chaque
//     image) : garder la bonne distance (juste hors de portée du sabre), entrer quand on se découvre — un coup
//     dans le vide, un déséquilibre, une parade levée trop tôt (coup de pied) —, parer ce qu'il voit venir et
//     riposter, lancer un shuriken de loin, reculer pour reprendre son souffle, aller chercher un cœur ;
//   - le Maître s'adapte : contre qui pare souvent, il frappe du pied ; contre qui attaque souvent, il pare et
//     punit ; il feinte (entre, s'arrête, ressort) et entre en dash.
// Trois niveaux, choisis au menu Arène (la barre de trois crans) : l'Apprenti (un débutant cohérent, lent, qui frappe
// parfois trop tôt), le Rōnin (solide, il pare la moitié des coups), le Maître (il pare presque tout et punit tout). Le Dojo : il frappe à un rythme régulier.
import { Player } from '../player.js';
import { Shurikens } from '../shuriken.js';
import { Multi } from '../multi.js';
import { DAMAGE_DEALT } from '../combat.js';
import { TILE } from '../level.js';
import { NavGraph } from './nav.js';

// react : temps de réaction (s) ; think : un plan tient au moins ce temps ; parry : il pare ce qu'il voit venir ;
// punish : il punit un coup dans le vide ou un déséquilibre ; riposte : après une parade ; kick : contre une garde ;
// aggro : il prend l'initiative ; feint : feintes ; dash : il entre en dash ; throw : shuriken de loin ;
// space : la distance qu'il garde (px) ; slop : sa précision (px) ; air : coups sautés ; adapt : il s'adapte.
export const BOT = {
  levels: [
    { name: "L'Apprenti", react: 0.38, think: 0.6, parry: 0.12, punish: 0.2, riposte: 0.3, kick: 0.1, aggro: 0.32, feint: 0, dash: 0, throw: 0.08, space: 46, slop: 14, air: 0.03, adapt: 0, whiff: 0.3 },
    { name: 'Le Rōnin', react: 0.22, think: 0.4, parry: 0.5, punish: 0.6, riposte: 0.7, kick: 0.4, aggro: 0.55, feint: 0.15, dash: 0.3, throw: 0.25, space: 40, slop: 5, air: 0.15, adapt: 0.5, whiff: 0.08 },
    { name: 'Le Maître', react: 0.1, think: 0.28, parry: 0.88, punish: 0.95, riposte: 0.95, kick: 0.7, aggro: 0.7, feint: 0.3, dash: 0.6, throw: 0.45, space: 38, slop: 2, air: 0.25, adapt: 1, whiff: 0 },
  ],
  dojo: { name: 'Dojo', react: 0.3, think: 0.5, parry: 0.35, punish: 0.3, riposte: 0.5, kick: 0, aggro: 1, feint: 0, dash: 0, throw: 0, space: 30, slop: 4, air: 0, adapt: 0, every: 1.7 },
  reach: 30,              // px : la portée du sabre (boîte de frappe de « attack » contre la boîte du corps)
  kickReach: 27,
  name: "L'ombre",
};

const SWORDS = new Set(['attack', 'air_attack', 'flip_attack']);
const FREE = new Set(['idle', 'run', 'sprint', 'walk', 'land', 'jump', 'fall', 'skid']);   // (il peut agir)

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
    this.initBrain();
    this.locked = false;    // le duel retient les commandes (ouverture, coup fatal…)
  }

  /** La tête : ce qu'il retient, son plan, son chemin (aussi pour un cerveau seul : brain()). */
  initBrain() {
    this.t = 0;
    this.atkCd = 0.6;
    this.throwCd = 2;
    this.jumpHold = 0;
    this.landX = null;      // l'appui visé par un saut
    this.seen = [];         // ce qu'il a vu du joueur (pour le voir avec son temps de réaction)
    this.plan = { kind: 'space', until: 0 };
    this.route = null; this.routeT = 0; this.navT = 0;
    this.memo = { parries: 0, swings: 0, lastFoe: '' };   // ce qu'il retient du joueur (le Maître s'adapte)
    const bs = this.level.arena?.def.basin;
    this.nav = new NavGraph(this.level, (tx, ty) => !!bs && tx >= bs.x0 && tx < bs.x1 && ty >= bs.top);
  }

  get out() { return this.multi?.out ?? false; }

  /** « L'ombre apprend » : son niveau pour la revanche. */
  setRank(r) { this.rank = r; if (!this.dojo) this.p = BOT.levels[Math.max(0, Math.min(2, r))]; }

  /** Ce qu'il voit du joueur : son état d'il y a « react » secondes. */
  perceive() {
    const f = this.foe, now = this.t;
    this.seen.push({ t: now, x: f.x, y: f.y, vx: f.vx, vy: f.vy, state: f.state, frame: f.anim.frame, facing: f.facing, onGround: f.onGround, hp: f.hp });
    while (this.seen.length > 2 && this.seen[1].t <= now - Math.min(1, this.p.react)) this.seen.shift();
    return this.seen[0];
  }

  /** Un pas de jeu. */
  update(dt) {
    this.t += dt;
    const pl = this.player, inp = this.input;
    if (this.locked || this.out || pl.state === 'victory' || pl.state === 'defeat') {
      inp.clear();
      // (même retenu par le duel, il finit le saut commencé vers son appui : il ne tombe pas à l'eau)
      if (this.landX != null && !pl.onGround && Math.abs(this.landX - pl.x) > 2) inp.hold(this.landX < pl.x ? 'left' : 'right', true);
    }
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
    const pl = this.player, inp = this.input, P = this.p;
    inp.held.clear();
    if (this.t < this.jumpHold) inp.hold('jump', true);     // (un saut tenu : il monte haut)
    const F = this.perceive();
    if (pl.state === 'death' || pl.state === 'respawn') return;
    this.navT -= dt; this.throwCd -= dt; this.atkCd -= dt;
    if (this.navT <= 0) { this.navT = 2; this.nav.build(); this.route = null; }
    // en l'air vers un appui visé : il s'y dirige (et y frappe s'il a sauté pour frapper)
    if (this.landX != null) {
      if ((pl.onGround && this.t > this.landT) || this.t > this.landT + 2) this.landX = null;   // (posé ; ou un vieux saut oublié)
      else {
        const d = this.landX - pl.x;
        if (Math.abs(d) > 2) inp.hold(d < 0 ? 'left' : 'right', true);
        if (Math.abs(d) > 40) inp.hold('sprint', true);
        if (this.airStrike && this.t > this.airStrike && Math.abs(F.x - pl.x) < BOT.reach + 6) { inp.tap('attack'); this.airStrike = 0; }
        return;
      }
    }
    if (this.foe.state === 'death' || this.foe.state === 'respawn' || this.foeOut?.()) { this.idleAround(); return; }
    // le joueur : où il est, ce qu'il fait (tel qu'il le voit)
    const dx = F.x - pl.x, adx = Math.abs(dx), dy = F.y - pl.y, to = Math.sign(dx) || pl.facing;
    const facingMe = Math.sign(pl.x - F.x) === F.facing || adx < 4;
    this.remember(F, adx);
    // 1. réagir à ce qui vient (dès qu'il le peut : debout, en course, en l'air, à la réception)
    if (FREE.has(pl.state) && this.react(F, adx, dy, to, facingMe)) return;
    // les gestes en cours : on les laisse finir (sauf la riposte, juste après une parade)
    if (pl.state === 'parry_hit') { if (pl.anim.frame >= 1 && this.rand(P.riposte, 'riposte') && this.safeLunge(pl.facing)) inp.tap('attack'); return; }
    if (!FREE.has(pl.state)) return;
    if (P.aggro === 0 && P.parry === 0) return;     // (un mannequin immobile : les tests)
    // 2. le même appui (ou presque) : le combat ; sinon, le chemin jusqu'à lui
    const mine = this.nav.segUnder(pl.x, pl.y), his = this.nav.segUnder(F.x, F.y);
    const together = (mine && his && mine === his) || (Math.abs(dy) < 20 && adx < 60 && this.walkable(pl.x, F.x, pl.y));
    // il est sur un appui étroit au-dessus de l'eau (la passerelle du canal) : on ne va pas s'y battre, on l'attend
    // au bord (et on lance de loin) ; il faudra bien qu'il en descende
    this.waitT = together ? 0 : (this.waitT ?? 0) + dt;
    if (!together && his && this.perilous(his) && mine && !this.perilous(mine) && this.waitT < 3 + 3 * (1 - P.aggro)) {
      if (Math.abs(dy) < 40 && this.throwCd <= 0 && this.shurikens.stock > 0 && this.rand(P.throw * 2.5, 'throw')) { this.throwCd = 1.2; pl.facing = to; inp.tap('throw'); return; }
      this.moveTo(this.edgeToward(mine, F.x) - to * 12);
      if (pl.facing !== to && Math.abs(this.edgeToward(mine, F.x) - to * 12 - pl.x) < 4) inp.hold(to < 0 ? 'left' : 'right', true);
      return;
    }
    if (!together && !(F.onGround === false && adx < 40 && dy > -60)) {
      if (this.travel(mine, his, F, adx)) return;
      // pas de chemin (l'autre rive du bassin) : il garde sa rive, et lance de loin
      if (Math.abs(dy) < 40 && this.throwCd <= 0 && this.shurikens.stock > 0 && this.rand(P.throw * 2, 'throw')) { this.throwCd = 1.4; pl.facing = to; inp.tap('throw'); return; }
      this.moveTo(this.edgeToward(mine, F.x));
      return;
    }
    this.fight(F, dx, adx, dy, to, facingMe);
  }

  /** Un tirage, avec la mémoire de la décision prise pour ce moment (il ne change pas d'avis à chaque image). */
  rand(p, key) {
    const k = `${key}:${Math.floor(this.t / this.p.think)}`;
    if (this.memo.last !== k) { this.memo.last = k; this.memo.roll = Math.random(); }
    return this.memo.roll < p;
  }

  /** Ce qu'il retient : les parades et les attaques du joueur (le Maître s'adapte). */
  remember(F, adx) {
    if (F.state !== this.memo.lastFoe) {
      if (F.state === 'parry') this.memo.parries = this.memo.parries * 0.8 + 1;
      if (F.state === 'attack' && adx > BOT.reach) this.memo.swings = this.memo.swings * 0.8 + 1;   // (un coup dans le vide)
      this.memo.lastFoe = F.state;
    }
  }

  /** Réagir : la parade, l'esquive, le renvoi d'un shuriken. Renvoie vrai s'il a agi. */
  react(F, adx, dy, to, facingMe) {
    const pl = this.player, inp = this.input, P = this.p;
    const sword = (F.state === 'attack' || F.state === 'air_attack' || F.state === 'flip_attack') && F.frame <= 2;
    const kick = (F.state === 'kick' || F.state === 'air_kick') && F.frame <= 1;
    const key = `${F.state}${Math.round(F.x)}`;
    if (sword && facingMe && adx < BOT.reach + 14 && Math.abs(dy) < 40 && this.reacted !== key) {
      this.reacted = key;
      const bias = P.adapt * Math.min(0.15, this.memo.swings * 0.03);
      if (Math.random() < P.parry + bias && pl.parryCd <= 0) { pl.facing = to; inp.tap('parry'); return true; }
      // sinon : reculer d'un pas, hors de portée (le niveau 1 se fait souvent toucher)
      if (Math.random() < P.punish * 0.6) { this.plan = { kind: 'back', until: this.t + 0.25 }; }
      return false;
    }
    if (kick && facingMe && adx < BOT.kickReach + 12 && this.reacted !== key) {
      this.reacted = key;
      // le coup de pied brise la garde : on ne pare pas, on recule (ou le Maître saute par-dessus et frappe)
      if (Math.random() < P.air * 2 && pl.onGround) { this.jumpAt(F.x + to * 10, 0.28, true); return true; }
      if (Math.random() < P.parry) { this.plan = { kind: 'back', until: this.t + 0.3 }; }
      return false;
    }
    // un shuriken qui arrive : la garde le renvoie, sinon un saut
    const star = this.incoming();
    if (star && this.reacted !== `s${star.id}`) {
      this.reacted = `s${star.id}`;
      if (Math.random() < P.parry && pl.parryCd <= 0) { pl.facing = Math.sign(star.x - pl.x) || to; inp.tap('parry'); return true; }
      if (Math.random() < 0.6 && pl.onGround) { this.jump(0.2); return true; }
    }
    return false;
  }

  /** Le combat, sur le même appui : un plan (garder la distance, entrer, punir, reculer), tenu un moment. */
  fight(F, dx, adx, dy, to, facingMe) {
    const pl = this.player, inp = this.input, P = this.p, R = BOT.reach;
    const exposed = F.state === 'stagger' || F.state === 'hurt' || F.state === 'land' || F.state === 'throw'
      || ((F.state === 'attack' || F.state === 'kick') && F.frame >= 4) || (F.state === 'parry' && F.frame >= 3) || F.state === 'dash';
    const guarding = F.state === 'parry' && F.frame < 3;
    const tired = pl.energy.value < 0.22;
    const losing = pl.hp <= 2 && pl.hp < F.hp;
    // le Dojo : il vient à portée et frappe en rythme
    if (this.dojo) {
      if (adx > R - 4) { this.moveTo(F.x - to * (R - 8)); return; }
      if (pl.facing !== to) { inp.hold(to < 0 ? 'left' : 'right', true); return; }
      if (this.atkCd <= 0 && this.safeLunge(to)) { inp.tap('attack'); this.atkCd = P.every; }
      return;
    }
    // un cœur, à bout de vie
    const heart = losing ? this.level.arena?.pickups.find((k) => k.kind === 'heart' && Math.abs(k.y - pl.y) < 40) : null;
    if (heart && Math.abs(heart.x - pl.x) < 200 && Math.abs(heart.x - pl.x) > 6) { this.moveTo(heart.x, true); return; }
    // la brume : revenir vers le centre
    const m = this.mist?.();
    if (m && (pl.x < m.l + 30 || pl.x > m.r - 30)) { this.moveTo((m.l + m.r) / 2, true); return; }

    // 1. punir : il s'est découvert
    if (exposed && adx < R + 50 && this.rand(P.punish, 'punish')) {
      if (adx <= R - 2 && this.safeLunge(to)) { pl.facing = to; inp.tap('attack'); this.atkCd = 0.3; return; }
      if (adx < R + 46 && P.dash > 0 && this.rand(P.dash + 0.3, 'dpunish') && pl.energy.value > 0.3 && this.flatAhead(to, 76)) { pl.facing = to; inp.tap(to > 0 ? 'dash_right' : 'dash_left'); this.plan = { kind: 'strike', until: this.t + 0.4 }; return; }
      this.plan = { kind: 'strike', until: this.t + 0.45 };
    }
    // 2. sa garde est levée : un coup de pied (qui la brise), ou attendre qu'elle retombe
    if (guarding) {
      const k = P.kick + P.adapt * Math.min(0.25, this.memo.parries * 0.05);
      if (adx < BOT.kickReach - 2 && this.rand(k, 'kick')) { pl.facing = to; inp.tap('kick'); return; }
      this.plan = { kind: 'space', until: this.t + 0.2 };
    }
    // 3. le plan du moment
    if (this.t >= this.plan.until) this.choose(F, adx, tired, losing);
    const plan = this.plan;
    switch (plan.kind) {
      case 'strike': {
        // entrer et frapper (en dash si le Maître le peut, sauté si l'autre est en l'air)
        // (le niveau 1 frappe parfois trop tôt, dans le vide : une erreur de débutant, qui se punit)
        if (adx <= R - 3 || (adx <= R + 14 && this.rand(P.whiff ?? 0, 'whiff'))) { pl.facing = to; if (this.atkCd <= 0 && this.safeLunge(to)) { inp.tap(Math.random() < P.kick * 0.25 ? 'kick' : 'attack'); this.atkCd = 0.25 + (1 - P.aggro) * 0.35; } this.plan = { kind: 'space', until: this.t + P.think }; return; }
        if (!F.onGround && dy < -18 && adx < R + 20 && this.rand(P.air * 2, 'air')) { this.jumpAt(F.x, 0.3, true); return; }
        if (adx > R + 26 && adx < R + 58 && this.rand(P.dash, 'dash') && pl.energy.value > 0.35 && this.flatAhead(to, 76)) { pl.facing = to; inp.tap(to > 0 ? 'dash_right' : 'dash_left'); return; }
        this.moveTo(F.x - to * (R - 10), adx > 90);
        return;
      }
      case 'feint':
        // feinte : il entre d'un pas, s'arrête juste au bord de sa portée, puis ressort
        if (adx > R + 6) this.moveTo(F.x - to * (R + 4));
        else this.plan = { kind: 'back', until: this.t + 0.22 };
        return;
      case 'back':
        if (this.edgeBehind(-to) < 30) { this.plan = { kind: 'space', until: this.t + 0.2 }; return; }
        this.moveTo(F.x - to * (P.space + 22), false, true);
        return;
      case 'zone':
        if (this.throwCd <= 0 && Math.abs(dy) < 24 && this.shurikens.stock > 0) { pl.facing = to; inp.tap('throw'); this.throwCd = 1.1 + Math.random(); this.plan = { kind: 'space', until: this.t + P.think }; return; }
        this.moveTo(F.x - to * Math.max(adx, 90));
        return;
      default: {
        // garder la distance : juste hors de portée, face à lui (une zone morte : il ne gigote pas)
        const want = tired || losing ? P.space + 18 : P.space;
        // dos à l'eau ou au vide : il ne recule plus (un coup le jetterait dedans) ; il tient, pare, ou passe à l'attaque
        const cornered = this.edgeBehind(-to) < 30;
        if (cornered && adx < want) {
          // le Maître passe par-dessus lui (c'est alors l'autre qui a l'eau dans le dos) ; sinon il tient et frappe
          if (pl.onGround && Math.abs(dy) < 10 && this.rand(P.air * 3, 'vault') && this.edgeBehind(to) > 60) { this.jumpAt(F.x + to * 34, 0.32, false); return; }
          if (pl.facing !== to) inp.hold(to < 0 ? 'left' : 'right', true);
          if (this.rand(P.aggro, 'corner')) this.plan = { kind: 'strike', until: this.t + 0.4 };
          return;
        }
        if (adx < want - 8 - P.slop) this.moveTo(F.x - to * want, false, true);
        else if (adx > want + 10 + P.slop) this.moveTo(F.x - to * want, adx > 120);
        else if (pl.facing !== to) inp.hold(to < 0 ? 'left' : 'right', true);
      }
    }
  }

  /** Choisir le plan du moment (le style de son niveau). */
  choose(F, adx, tired, losing) {
    const P = this.p, r = Math.random();
    let kind = 'space';
    if (tired) kind = 'back';
    else if (adx > 110 && this.throwCd <= 0 && r < P.throw) kind = 'zone';
    else if (r < P.aggro * (losing ? 0.6 : 1)) kind = Math.random() < P.feint ? 'feint' : 'strike';
    this.plan = { kind, until: this.t + P.think * (0.8 + Math.random() * 0.6) };
  }

  /** Aller d'un appui à un autre : le chemin du graphe (marcher, sauter, se laisser tomber). */
  travel(mine, his, F, adx) {
    const pl = this.player;
    if (!mine || !his) return false;
    this.routeT -= 1 / 120;
    if (!this.route || this.routeT <= 0 || this.route.seg !== mine || this.route.to !== his) {
      const p = this.nav.path(mine, his, pl.x);
      this.route = p ? { seg: mine, to: his, steps: p } : null;
      this.routeT = 0.5;
    }
    if (!this.route || !this.route.steps.length) return false;
    const e = this.route.steps[0];
    // ne pas sauter se poser sous son sabre (sauf s'il s'est découvert, ou après une longue attente) : on attend
    // au bord, et on lance de loin
    const F2 = this.seen[0];
    if (e.kind !== 'slide' && F2 && F2.onGround && Math.abs(F2.x - e.land) < 52 && Math.abs(F2.y - e.to.y) < 20
      && !['stagger', 'hurt', 'throw', 'attack'].includes(F2.state) && (this.waitT ?? 0) < 2.5 + 4 * (1 - this.p.aggro)) {
      if (Math.abs(e.from - pl.x) > 20) { this.moveTo(e.from - Math.sign(e.land - e.from) * 16); return true; }
      const to = Math.sign(F2.x - pl.x) || pl.facing;
      if (this.throwCd <= 0 && this.shurikens.stock > 0 && Math.abs(F2.y - pl.y) < 30) { this.throwCd = 1.3; pl.facing = to; this.input.tap('throw'); }
      else if (pl.facing !== to) this.input.hold(to < 0 ? 'left' : 'right', true);
      return true;
    }
    const d = e.from - pl.x;
    if (Math.abs(d) > 3) { this.moveTo(e.from, Math.abs(d) > 60); return true; }
    // au point de départ : le saut (ou le pas dans le vide), vers le milieu de l'appui d'arrivée
    if (e.kind === 'slide') { this.input.hold(e.land < pl.x ? 'left' : 'right', true); this.input.tap('down'); return true; }
    if (e.kind === 'drop') { this.landX = e.land; this.landT = this.t + 0.15; this.input.hold(e.land < pl.x ? 'left' : 'right', true); return true; }
    const hold = e.rise >= 2 * TILE ? 0.34 : e.rise >= TILE ? 0.26 : Math.min(0.32, 0.12 + Math.abs(e.land - e.from) / 300);
    this.jumpAt(e.land, hold);
    return true;
  }

  /** Le sol est-il plat et sûr sur dist px dans la direction dir (pour un dash : ni marche, ni trou) ? */
  flatAhead(dir, dist) {
    const pl = this.player, ty = Math.floor((pl.y + 2) / TILE);
    for (let d = 8; d <= dist; d += 8) if (!this.nav.standable(Math.floor((pl.x + dir * d) / TILE), ty)) return false;
    return pl.onGround;
  }

  /** Le sabre fait faire un pas en avant : pas s'il y a l'eau ou le vide juste devant. */
  safeLunge(dir) { return this.edgeBehind(dir) >= 34; }

  /** Un appui étroit entre deux vides ou deux eaux (une passerelle) : dangereux pour s'y battre. */
  perilous(seg) {
    if (seg.x1 - seg.x0 > 4) return false;
    // (de chaque côté, de l'eau ou le vide — pas une souche ou un mur)
    const lv = this.level, hazard = (tx) => {
      if (lv.solid(tx, seg.ty - 1)) return false;
      for (let k = 0; k < 7; k++) { const c = lv.at(tx, seg.ty + k); if (c === '~' || c === 'v') return true; if (lv.solid(tx, seg.ty + k) || lv.ledge(tx, seg.ty + k)) return false; }
      return true;
    };
    return hazard(seg.x0 - 1) && hazard(seg.x1 + 1);
  }

  /** La distance (px) jusqu'au bord dangereux de son appui, dans la direction dir (l'eau, le vide), ou Infinity. */
  edgeBehind(dir, max = 48) {
    const pl = this.player, lv = this.level, ty = Math.floor((pl.y + 2) / TILE);
    for (let d = 0; d <= max; d += 8) {
      const tx = Math.floor((pl.x + dir * d) / TILE);
      if (this.nav.standable(tx, ty)) continue;
      // au-delà du bord : de l'eau ou un vide sous lui ?
      for (let k = 0; k < 7; k++) { const c = lv.at(tx, ty + k); if (c === '~' || c === 'v') return d; if (lv.solid(tx, ty + k) || lv.ledge(tx, ty + k)) return k > 3 ? d : Infinity; }
      return d;
    }
    return Infinity;
  }

  /** Le bout de son appui le plus proche d'un x (pour attendre sur sa rive). */
  edgeToward(seg, x) {
    if (!seg) return this.player.x;
    return Math.max(seg.x0 * TILE + 10, Math.min((seg.x1 + 1) * TILE - 10, x));
  }

  /** Le sol est-il continu entre deux x (même rangée, sans trou ni mur) ? */
  walkable(a, b, y) {
    const ty = Math.floor((y + 2) / TILE);
    for (let x = Math.min(a, b); x <= Math.max(a, b); x += 8) {
      const tx = Math.floor(x / TILE);
      if (!this.nav.standable(tx, ty)) return false;
    }
    return true;
  }

  /** Personne à combattre (l'autre est tombé) : il reprend son souffle, au centre de l'arène. */
  idleAround() {
    const a = this.level.arena?.def.walls;
    if (a) { const c = ((a[0] + 1 + a[1]) / 2) * TILE; if (Math.abs(this.player.x - c) > 40) this.moveTo(c); }
  }

  /** Un saut plein (la touche tenue un instant, comme un joueur). */
  jump(hold = 0.32) {
    if (!this.player.onGround && this.player.coyote <= 0) return;   // (jamais un second appui en l'air : ce serait un salto)
    this.input.tap('jump'); this.input.hold('jump', true); this.jumpHold = this.t + hold; }

  /** Un saut visé : il se dirigera en l'air vers x (et y frappera si strike). */
  jumpAt(x, hold, strike = false) {
    if (!this.player.onGround && this.player.coyote <= 0) return;
    // (on ne saute que vers un appui : jamais au-dessus de l'eau ou du vide, même pour frapper)
    const land = this.nav.segUnder(x, this.player.y - 40, 16);
    if (!land) return;
    x = Math.max(land.x0 * TILE + 6, Math.min((land.x1 + 1) * TILE - 6, x));
    this.landX = x; this.landT = this.t + 0.15;
    this.airStrike = strike ? this.t + 0.12 : 0;
    this.jump(hold);
  }

  /**
   * Marcher (ou courir) vers x, sur son appui : s'arrête au bord de l'eau ou du vide, saute une souche par le
   * graphe (le chemin), recule face à l'adversaire si backward.
   */
  moveTo(x, run = false, backward = false) {
    const pl = this.player, inp = this.input, d = x - pl.x;
    if (Math.abs(d) < 3) return;
    const dir = Math.sign(d);
    // devant lui, rien où poser le pied : il s'arrête (le graphe dira s'il y a un saut)
    const ty = Math.floor((pl.y + 2) / TILE), ahead = Math.floor((pl.x + dir * 8) / TILE);
    if (pl.onGround && !this.nav.standable(ahead, ty)) {
      // une marche (souche, rebord) : le graphe donne le saut
      const seg = this.nav.segUnder(pl.x, pl.y), next = this.nav.segUnder(pl.x + dir * 24, pl.y - 40, 6) ?? this.nav.segUnder(pl.x + dir * 24, pl.y);
      const e = seg?.edges.find((ee) => ee.to === next && Math.abs(ee.from - pl.x) < 12);
      if (e) { this.jumpAt(e.land, e.rise >= TILE ? 0.3 : 0.2); return; }
      return;
    }
    inp.hold(dir < 0 ? 'left' : 'right', true);
    if (run && !backward) inp.hold('sprint', true);
  }

  /** Un shuriken du joueur qui arrive sur lui (vu depuis assez longtemps pour qu'il y réagisse). */
  incoming() {
    const pl = this.player;
    for (const s of this.foeShurikens?.flying ?? []) {
      const dx = pl.x - s.x;
      if (Math.sign(dx) === Math.sign(s.vx) && Math.abs(dx) < 90 && Math.abs(s.y - (pl.y - 14)) < 20 && (s.t ?? 1) >= this.p.react * 0.8) return s;
    }
    return null;
  }
}

/**
 * Un cerveau seul, qui mène un autre KAGE (tests : le joueur mené par l'ordinateur, pour faire se battre deux
 * niveaux). o : { level, player, foe, foeShurikens, shurikens, rank }. À chaque pas : b.step(dt, input).
 */
export function brain(o) {
  const b = Object.create(ShadowBot.prototype);
  Object.assign(b, o);
  b.p = BOT.levels[Math.max(0, Math.min(2, o.rank ?? 1))];
  b.input = new BotInput();
  b.initBrain();
  b.step = (dt, input) => {
    b.t += dt;
    b.input.endFrame();
    b.think(dt);
    input.held.clear();
    for (const a of b.input.held) input.held.add(a);
    for (const a of b.input.pressed) input.pressed.add(a);
  };
  return b;
}
