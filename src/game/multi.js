// Jeu à plusieurs, dans une arène : les autres ninjas de la salle (src/engine/net.js), ou le ninja de
// l'ombre de l'ordinateur (arena/bot.js : il passe par le même chemin, sur un réseau local à la page).
// Chacun joue son propre KAGE sur son écran et envoie son état trente fois par seconde ; les autres sont
// dessinés à l'endroit reçu, interpolés avec un petit retard (le mouvement reste fluide malgré le réseau).
//
// Un coup est décidé par l'écran de celui qui le porte (sabre, coup de pied, shuriken) : il prévient sa
// cible, qui encaisse — sauf si elle pare : la parade est jugée sur l'écran du défenseur (là où il a
// appuyé), qui renvoie « paré » à l'attaquant (déséquilibré). Deux sabres qui se rencontrent : le choc des
// lames, partagé. Un shuriken qui touche une lame ou une garde est renvoyé.
//
// Les pièges de l'arène (gong, corde de la grue, caisses, échafaudages, planches vermoulues de la Forêt)
// sont partagés ; le bassin de la Forêt suit l'horloge du combat (remise à zéro au départ, chez tous) ;
// les bonus, c'est l'hôte qui les décide. Le duel (manches, fin, revanche) : l'hôte l'arbitre.
import { crispSheet, NINJA_DEFAULT } from '../engine/netsprite.js';
import { renderText } from '../engine/pixelfont.js';
import { drawWhiteFrame } from '../engine/silhouette.js';
import { Shurikens } from './shuriken.js';
import { HEALTH, IMPACT, PARRY } from './combat.js';
import { drawSeal } from './arena/stats.js';

const SEND_EVERY = 1 / 30;      // s : trente états par seconde
const INTERP = 0.1;             // s de retard d'affichage des autres joueurs (interpolation entre deux états reçus)
export const SLOT_COLORS = ['#e8b93c', '#5ccdc8', '#e0607a', '#9ad35a'];   // repère de chaque place (or, eau, laque, pousse)
// les modes du combat (choisis par l'hôte dans le salon)
export const MODES = {
  duel: { name: 'Duel', text: 'Deux manches gagnantes, une vie par manche.', rounds: 2 },
  souffle: { name: 'Souffle unique', text: 'Une vie : le dernier debout gagne.', lives: 1 },
  trois: { name: 'Trois lames', text: 'Le premier à 3 éliminations gagne.', goal: 3 },
  dix: { name: 'Dix lames', text: 'Le premier à 10 éliminations gagne.', goal: 10 },
  // l'entraînement contre le ninja de l'ombre (arena/bot.js) : sans fin, et absent du salon
  dojo: { name: 'Dojo', text: 'Parer, riposter : sans fin.', endless: true, hidden: true },
};
export const ROUND_PAUSE = 5.2;  // s entre la fin d'une manche et le début de la suivante (coup fatal, revoir, score)

const SWORDS = new Set(['attack', 'air_attack', 'flip_attack']);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Multi {
  /** deps : { net, player, shurikens, level, levelId, meta, skins, skinId(), onEvent(n, d), shared?, painted? } */
  constructor(deps) {
    Object.assign(this, deps);
    this.remotes = new Map();
    this.scores = new Map();
    this.wins = new Map();          // le duel : manches gagnées
    this.sendT = 0;
    this.time = 0;
    this.lastHit = null;            // { by, t } : le dernier coup reçu
    this.placed = false;
    this.match = null;              // le combat en cours : { mode, players, out (Set), over, round, roundOver }
    this.out = false;               // une vie par manche (Duel, Souffle unique) : KAGE est éliminé, il regarde la fin
    this.applying = false;          // vrai pendant qu'on rejoue un événement reçu (pour ne pas le renvoyer)
    this.again = new Set();         // la revanche : qui l'a demandée
    this.deflected = new Map();     // shurikens d'un autre que l'on a renvoyés : 'id:sid' -> instant
    this.lastClash = -9;
    // les shurikens des autres : pour les voir voler (c'est leur écran qui décide s'ils touchent)
    const quiet = Object.create(this.level);
    quiet.cutRope = () => null; quiet.hitGongs = () => 0; quiet.hitTargets = () => 0;
    this.ghosts = new Shurikens(quiet, this.meta);
    this.ghosts.onEvent = () => {};
    // nos shurikens touchent les autres joueurs (un « ennemi » qui les représente tous)
    this.shurikens.enemies.push({ takeHit: (box, ax, id, dmg) => this.strikeBox(box, ax, id ?? `s${Math.random()}`, dmg, 0, 'shuriken') });
    if (!this.shared) this.hookArena();
    const net = this.net;
    net.onMessage = (from, m) => this.receive(from, m);
    net.onRoster = (r) => this.roster(r);
  }

  get me() { return this.net.roster.find((p) => p.id === this.net.id); }
  get mode() { return this.match ? MODES[this.match.mode] : null; }
  /** Une vie par manche (Duel, Souffle unique). */
  get oneLife() { return !!(this.mode?.rounds || this.mode?.lives); }

  // --- les pièges de l'arène, partagés ---------------------------------------------
  hookArena() {
    const a = this.level.arena, net = this.net;
    const wrap = (name, after) => {
      const orig = a[name].bind(a);
      a[name] = (...args) => { const before = name === 'hitGong' ? a.gong?.ready : null; const r = orig(...args); if (!this.applying) after(r, args, before); return r; };
    };
    wrap('hitGong', (r, args, wasReady) => { if (r && wasReady && !a.gong.ready) net.send({ t: 'gong' }); });
    wrap('cutRope', (r) => { if (r) net.send({ t: 'cut' }); });
    wrap('kickCrates', (n, [box, dir]) => { if (n) net.send({ t: 'kick', box, dir }); });
    wrap('collapse', (r, [s, x]) => net.send({ t: 'col', i: this.level.scaffolds.indexOf(s), x }));
    // les planches vermoulues de la Forêt : celle qui cède sous un joueur cède chez tous
    const f = this.level.forest;
    if (f) {
      const orig = f.startCrumble.bind(f);
      f.startCrumble = (c) => { const was = c.state; orig(c); if (!this.applying && was === 'idle' && c.state === 'shake') net.send({ t: 'crum', i: f.crumbles.indexOf(c) }); };
    }
    // bonus et caisses du ciel : décidés par l'hôte seulement
    const ev = a.onEvent;
    a.onEvent = (n, d) => {
      if (!this.applying) {
        if (n === 'pickupAppear' && net.host) net.send({ t: 'pk', kind: d.kind, x: d.x, y: d.y + 10, spot: d.spot });
        if (n === 'pickup') net.send({ t: 'take', spot: d.spot });
      }
      ev?.(n, d);
    };
  }

  apply(fn) { this.applying = true; try { fn(); } finally { this.applying = false; } }

  // --- la liste des joueurs ------------------------------------------------------------
  roster(r) {
    for (const id of [...this.remotes.keys()]) if (!r.some((p) => p.id === id)) this.remotes.delete(id);
    for (const p of r) {
      if (p.id === this.net.id) continue;
      const rm = this.remotes.get(p.id);
      if (rm) { rm.name = p.name; rm.slot = p.slot; rm.bot = !!p.bot; } else this.remotes.set(p.id, this.newRemote(p));
      if (!this.scores.has(p.id)) this.scores.set(p.id, 0);
    }
    if (!this.scores.has(this.net.id)) this.scores.set(this.net.id, 0);
    this.net.send({ t: 'me', sk: this.skinId(), seal: this.seal?.() ?? null });   // que les nouveaux voient notre skin (dans le salon)
    if (this.net.host && this.levelId && !this.shared) this.net.send({ t: 'arena', id: this.levelId });   // l'arène de l'hôte : les invités la suivent
    if (this.net.host && this.match && !this.match.over) this.checkEnd();
    // notre place connue : on apparaît à son point de départ (une fois)
    const me = this.me;
    if (me && !this.placed) {
      this.placed = true;
      this.placeAtStart();
      this.player.respawn(true);
    }
    this.onEvent?.('roster', { roster: r });
  }

  /** Notre point de départ : celui de notre place (les deux premières places se font face, au sol). */
  placeAtStart() {
    const me = this.me, def = this.level.arena.def;
    if (!me) return;
    // à deux : les places du duel, face à face (sinon, les points de départ de l'arène)
    const sp = this.net.roster.length === 2 && def.duelSpawns ? def.duelSpawns : def.spawns;
    this.player.spawnAt = { ...sp[me.slot % sp.length] };
  }

  newRemote(p) {
    return { id: p.id, name: p.name, slot: p.slot, bot: !!p.bot, skin: 'encre', seal: null, x: 0, y: 0, vx: 0, vy: 0, facing: 1,
      anim: 'idle', frame: 0, hp: HEALTH.max, iv: 0, state: 'idle', seen: false, tag: null, buf: [], offset: null, flashT: 0 };
  }

  /** Boîte de collision d'un autre joueur (comme celle de KAGE). */
  boxOf(r) {
    const hb = this.meta.hitbox, h = r.state === 'slide' ? hb.slide : r.state === 'dash' ? hb.dash : hb.default, { pivot } = this.meta;
    const ox = r.facing > 0 ? h.x - pivot.x : pivot.x - (h.x + h.w);
    return { x: r.x + ox, y: r.y - pivot.y + h.y, w: h.w, h: h.h };
  }

  /** La zone de frappe du sabre d'un autre joueur, s'il frappe en ce moment (le choc des lames). */
  bladeOf(r) {
    if (!SWORDS.has(r.state)) return null;
    const a = this.meta.hitbox[r.state];
    if (!a?.frames.includes(r.frame)) return null;
    const { pivot } = this.meta, ox = r.facing > 0 ? a.x - pivot.x : pivot.x - (a.x + a.w);
    return { x: r.x + ox, y: r.y - pivot.y + a.y, w: a.w, h: a.h };
  }

  /** La garde d'un joueur (la sienne, ou celle d'un autre d'après son état). */
  guardBox(x, y, facing) {
    const a = this.meta.hitbox.parry, { pivot } = this.meta, ox = facing > 0 ? a.x - pivot.x : pivot.x - (a.x + a.w);
    return { x: x + ox, y: y - pivot.y + a.y, w: a.w, h: a.h };
  }

  // --- messages reçus ------------------------------------------------------------------
  receive(from, m) {
    const a = this.level.arena;
    const r = this.remotes.get(from);
    const arenaMsg = ['gong', 'cut', 'kick', 'col', 'pk', 'crum', 'take'].includes(m.t);
    if (this.shared && arenaMsg) return;   // (le ninja de l'ordinateur partage l'arène de la page : rien à rejouer)
    switch (m.t) {
      case 's': {
        if (!r) return;
        // l'état reçu, horodaté par l'envoyeur : on l'ajoute au tampon d'interpolation
        const off = this.time - (m.ts ?? this.time);
        r.offset = r.offset == null ? off : Math.min(off, r.offset + 0.002);   // le plus court trajet observé (glisse lentement)
        r.buf.push({ t: (m.ts ?? this.time) + r.offset, x: m.x, y: m.y, vx: m.vx, vy: m.vy, f: m.f, a: m.a, fr: m.fr, st: m.st });
        if (r.buf.length > 24) r.buf.shift();
        r.hp = m.hp; r.iv = m.iv;
        if (this.skins[m.sk]) r.skin = m.sk;
        if (!r.seen) { r.x = m.x; r.y = m.y; r.facing = m.f; r.state = m.st; r.anim = this.meta.animations[m.a] ? m.a : 'idle'; r.frame = m.fr; }
        r.seen = true;
        break;
      }
      case 'hit': this.takeHitFrom(from, m); break;
      case 'parried':
        // notre coup a été paré : déséquilibré
        if (m.to !== this.net.id) return;
        this.player.stagger(m.x);
        this.onEvent?.('parried', { by: from, x: this.player.x, y: this.player.y - 18 });
        break;
      case 'clash':
        if (m.to !== this.net.id) return;
        if (this.time - this.lastClash > PARRY.clashGap) { this.lastClash = this.time; this.player.clash(m.x); this.onEvent?.('clash', { x: (this.player.x + m.x) / 2, y: this.player.y - 20, with: from }); }
        break;
      case 'deflect':
        // l'autre a renvoyé un de nos shurikens : il ne nous appartient plus (il ne touchera personne)
        this.shurikens.drop(m.sid);
        break;
      case 'ko': {
        if (!this.match || this.match.over) return;
        const by = m.by;
        this.scores.set(by, (this.scores.get(by) ?? 0) + 1);
        this.onEvent?.('ko', { by, victim: from, cause: m.cause });
        if (this.net.host) this.checkEnd();
        break;
      }
      case 'me': if (r && this.skins[m.sk]) { r.skin = m.sk; r.seal = m.seal ?? null; this.onEvent?.('roster', { roster: this.net.roster }); } break;
      case 'mode': this.onEvent?.('mode', { mode: m.mode }); break;
      case 'arena': if (!this.shared && m.id && this.levelId && m.id !== this.levelId) this.onEvent?.('arena', { id: m.id }); break;
      case 'start': this.startMatch(m.mode); break;
      case 'round': this.roundEnd(m.winner, m.wins, m.next); break;
      case 'roundStart': this.startRound(m.n); break;
      case 'out': if (this.match) { this.match.out.add(from); if (this.net.host) this.checkEnd(); } break;
      case 'end': this.endMatch(m.winner, m.scores, m.wins); break;
      case 'again': this.wantAgain(from); break;
      case 'throw': {
        this.ghosts.stock = 99;
        this.ghosts.throw(m.x, m.y, m.dir, m.h);
        const g = this.ghosts.flying[this.ghosts.flying.length - 1];
        if (g) { g.sid = m.sid; g.owner = from; }
        this.ghostSkin = r?.skin ?? 'encre';
        this.onEvent?.('throwRemote', { x: m.x, y: m.y });
        break;
      }
      case 'gong': this.apply(() => { if (a.gong.ready) a.hitGong(a.gongBox()); }); break;
      case 'cut': this.apply(() => { const c = a.crane; a.cutRope({ x: c.ropeX - 1, y: c.boomY + 20, w: 2, h: 2 }); }); break;
      case 'kick': this.apply(() => a.kickCrates(m.box, m.dir, null)); break;
      case 'col': this.apply(() => { const s = this.level.scaffolds[m.i]; if (s) a.collapse(s, m.x); }); break;
      case 'pk': this.apply(() => { if (!a.pickups.some((p) => p.spot === m.spot)) { a.pickups.push({ kind: m.kind, x: m.x, y: m.y, spot: m.spot, t: 0 }); a.onEvent?.('pickupAppear', { kind: m.kind, x: m.x, y: m.y - 10, spot: m.spot }); } }); break;
      case 'crum': this.apply(() => { const c = this.level.forest?.crumbles[m.i]; if (c) this.level.forest.startCrumble(c); }); break;
      case 'take': a.pickups = a.pickups.filter((p) => p.spot !== m.spot); break;
      default:
    }
  }

  /**
   * Un coup nous vise (décidé par l'écran de l'attaquant). Sur notre écran se juge la parade : la garde
   * levée face au coup le pare (sauf le coup de pied, qui la brise) ; un shuriken que l'on vient de renvoyer
   * ne compte pas.
   */
  takeHitFrom(from, m) {
    if (m.to !== this.net.id) return;
    const p = this.player, kind = m.kind ?? 'sword';
    if (kind === 'shuriken' && m.sid != null && this.deflected.has(`${from}:${m.sid}`)) return;
    if (kind !== 'kick' && p.guards(m.fromX)) {
      p.parried(m.fromX);
      this.net.send({ t: 'parried', to: from, x: p.x });
      this.onEvent?.('parry', { by: from, x: p.x + p.facing * 9, y: p.y - 20, dir: p.facing, kind });
      return;
    }
    let dmg = m.dmg;
    const broke = kind === 'kick' && p.isParrying();
    if (broke) dmg += PARRY.guardBreakBonus;      // le coup de pied brise la garde
    const killing = p.hp - dmg <= 0 && p.invuln <= 0;
    if (p.hurt(dmg, m.fromX, kind)) {
      if (m.push) p.vx = m.push;
      this.lastHit = { by: from, t: this.time, kind };
      this.onEvent?.('hurtBy', { by: from, kind, dmg, broke, killing, x: p.x, y: p.y - 16, dir: Math.sign(p.x - m.fromX) || 1, final: killing && this.wouldEnd(from) });
    }
  }

  // --- nos coups sur les autres -----------------------------------------------------------
  /**
   * Une zone de frappe (sabre, coup de pied, shuriken) : touche-t-elle un autre joueur ? kind : 'sword',
   * 'air', 'flip', 'riposte', 'kick', 'shuriken'. Renvoie 'hit', 'clash' (deux lames : le choc), 'guard'
   * (sa garde est levée : il en jugera) ou null.
   */
  strikeBox(box, fromX, attackId, dmg, push, kind = 'sword') {
    let res = null;
    for (const r of this.remotes.values()) {
      if (!r.seen || r.state === 'death' || r.state === 'respawn' || r.iv > 0) continue;
      if (this.match && this.match.out.has(r.id)) continue;
      // le choc des lames : nos deux sabres se rencontrent au même instant
      const blade = kind !== 'kick' && kind !== 'shuriken' ? this.bladeOf(r) : null;
      if (blade && overlap(box, blade) && Math.sign(r.x - fromX) === -r.facing) {
        r.hits ??= new Set();
        if (r.hits.has(attackId)) continue;
        r.hits.add(attackId);
        if (this.time - this.lastClash > PARRY.clashGap) {
          this.lastClash = this.time;
          this.net.send({ t: 'clash', to: r.id, x: this.player.x });
          this.player.clash(r.x);
          this.onEvent?.('clash', { x: (r.x + this.player.x) / 2, y: r.y - 20, with: r.id });
        }
        res = 'clash';
        continue;
      }
      if (!overlap(box, this.boxOf(r))) continue;
      r.hits ??= new Set();
      if (r.hits.has(attackId)) continue;
      r.hits.add(attackId);
      if (r.hits.size > 30) r.hits = new Set([attackId]);
      const sid = kind === 'shuriken' ? attackId.replace(/^s+/, '') : null;
      this.net.send({ t: 'hit', to: r.id, dmg, fromX, kind, sid: sid != null ? Number(sid) : undefined, push: push ? Math.sign(r.x - fromX || 1) * push : 0 });
      r.iv = 0.3;                          // le temps que son état revienne : on ne le frappe pas deux fois
      // sa garde est levée face à nous : c'est lui qui en jugera (pas d'étincelles de coup ici)
      const guarded = kind !== 'kick' && r.state === 'parry' && r.frame < PARRY.window && Math.sign(fromX - r.x) === r.facing;
      if (guarded) { res = res ?? 'guard'; continue; }
      r.flashT = IMPACT.flash;
      const killing = r.hp - dmg <= 0;
      res = 'hit';
      this.onEvent?.('strike', { x: r.x, y: r.y - 16, dir: Math.sign(r.x - fromX) || 1, kind, dmg, to: r.id, killing, final: killing && this.wouldEnd(this.net.id) });
    }
    return res;
  }

  /** Ce coup fatal (de killer) finirait-il la manche ou le combat ? (le coup fatal, son ralenti) */
  wouldEnd(killer) {
    const m = this.match;
    if (!m || m.over || m.roundOver) return false;
    const mode = MODES[m.mode];
    if (mode.endless) return false;
    if (mode.goal) return (this.scores.get(killer) ?? 0) + 1 >= mode.goal;
    const alive = m.players.filter((id) => !m.out.has(id) && this.net.roster.some((p) => p.id === id));
    return alive.length <= 2;
  }

  /** Un shuriken d'un autre touche notre lame ou notre garde : on le renvoie vers son lanceur. */
  deflectGhosts() {
    const p = this.player;
    const blade = p.attackBox?.(), guard = p.isParrying?.() ? this.guardBox(p.x, p.y, p.facing) : null;
    if (!blade && !guard) return;
    for (const g of this.ghosts.flying) {
      if (g.deflected || g.sid == null) continue;
      const b = { x: g.x - 3, y: g.y - 3, w: 6, h: 6 };
      if (!(blade && overlap(b, blade)) && !(guard && overlap(b, guard) && Math.sign(g.x - p.x) === p.facing)) continue;
      g.deflected = true;
      g.vx *= -0.2; g.vy = -60; g.gravity = 400; g.dead = true;
      this.deflected.set(`${g.owner}:${g.sid}`, this.time);
      this.net.send({ t: 'deflect', to: g.owner, sid: g.sid });
      const dir = -Math.sign(g.vx || -p.facing) || p.facing;
      const sid = this.shurikens.sendBack(g.x, g.y, Math.sign(p.facing) || dir);
      this.net.send({ t: 'throw', x: g.x, y: g.y, dir: p.facing, h: 20, sid });
      if (guard && !blade) p.parried(g.x);
      this.onEvent?.('deflect', { x: g.x, y: g.y, dir: p.facing });
    }
    this.ghosts.flying = this.ghosts.flying.filter((g) => !g.dead);
  }

  // --- le combat : départ, manches, morts, fin ------------------------------------------------
  /** L'hôte lance le combat (mode) : tout le monde à sa place, les points à zéro. */
  launch(mode) {
    if (!this.net.host) return;
    this.net.send({ t: 'start', mode });
    this.startMatch(mode);
  }

  startMatch(mode) {
    this.match = { mode, players: this.net.roster.map((p) => p.id), out: new Set(), over: false, round: 1, roundOver: false };
    this.pendingRound = null;
    this.player.holdDeath = this.oneLife;          // une vie par manche : le vaincu reste à terre jusqu'à la suivante
    this.again.clear();
    for (const id of this.scores.keys()) this.scores.set(id, 0);
    this.wins.clear();
    for (const p of this.net.roster) this.wins.set(p.id, 0);
    this.resetRound();
    this.onEvent?.('start', { mode });
  }

  /** Remet tout le monde à sa place pour une manche (arène remise à neuf, vies pleines). */
  resetRound() {
    this.out = false;
    this.lastHit = null;
    if (this.match) this.match.out = new Set();
    this.placeAtStart();
    if (!this.shared) this.level.arena.reset();
    this.player.respawn(true);
    // les deux premières places se font face (à deux : face à l'autre, d'où qu'il parte)
    const other = [...this.remotes.values()][0];
    const sp = this.level.arena.def.spawns, me = this.me;
    if (this.remotes.size === 1 && this.custom) this.player.facing = Math.sign(this.custom - this.player.x) || 1;
    else if (me && sp.length > 1) this.player.facing = me.slot % 2 === 0 ? 1 : -1;
    else if (other) this.player.facing = Math.sign(other.x - this.player.x) || 1;
    this.shurikens.reset();
    this.ghosts.reset();
  }

  /** L'hôte vérifie si la manche ou le combat est fini, et l'annonce. */
  checkEnd() {
    const m = this.match;
    if (!m || m.over || m.roundOver) return;
    const mode = MODES[m.mode];
    if (mode.endless) return;
    let done = false, winner = null;
    if (mode.goal) {
      for (const [id, n] of this.scores) if (n >= mode.goal) { done = true; winner = id; }
    } else {
      const alive = m.players.filter((id) => !m.out.has(id) && this.net.roster.some((p) => p.id === id));
      if (alive.length <= 1) { done = true; winner = alive[0] ?? null; }
    }
    if (!done) return;
    if (mode.rounds) {
      if (winner) this.wins.set(winner, (this.wins.get(winner) ?? 0) + 1);
      const wins = [...this.wins];
      if (!winner || (this.wins.get(winner) ?? 0) < mode.rounds) {
        // la manche est finie, pas le duel : on annonce, puis la suivante
        const next = m.round + 1;
        this.net.send({ t: 'round', winner, wins, next });
        this.roundEnd(winner, wins, next);
        this.pendingRound = { m, next, t: ROUND_PAUSE };     // (le temps du jeu : roundClock)
        return;
      }
      const scores = [...this.scores];
      this.net.send({ t: 'end', winner, scores, wins });
      this.endMatch(winner, scores, wins);
      return;
    }
    const scores = [...this.scores];
    this.net.send({ t: 'end', winner, scores });
    this.endMatch(winner, scores);
  }

  /** Une manche est finie (le duel continue). */
  roundEnd(winner, wins, next) {
    const m = this.match;
    if (!m || m.over) return;
    m.roundOver = true;
    if (wins) for (const [id, n] of wins) this.wins.set(id, n);
    this.onEvent?.('roundEnd', { winner, next, wins: [...this.wins], name: this.nameOf(winner) });
  }

  /** La manche suivante commence. */
  startRound(n) {
    const m = this.match;
    if (!m || m.over) return;
    m.round = n;
    m.roundOver = false;
    this.resetRound();
    this.onEvent?.('roundStart', { n, decisive: this.decisive() });
  }

  /** La manche décisive : chacun n'est plus qu'à une manche (ou à un point) de la victoire. */
  decisive() {
    const m = this.match;
    if (!m) return false;
    const mode = MODES[m.mode];
    const ids = m.players.filter((id) => this.net.roster.some((p) => p.id === id));
    if (mode.rounds) return ids.length > 1 && ids.every((id) => (this.wins.get(id) ?? 0) === mode.rounds - 1);
    if (mode.goal) return ids.length > 1 && ids.filter((id) => (this.scores.get(id) ?? 0) === mode.goal - 1).length >= 2;
    return false;
  }

  endMatch(winner, scores, wins) {
    if (!this.match || this.match.over) return;
    this.match.over = true;
    if (scores) for (const [id, n] of scores) this.scores.set(id, n);
    if (wins) for (const [id, n] of wins) this.wins.set(id, n);
    this.again.clear();
    this.onEvent?.('end', { winner, name: this.nameOf(winner), mine: winner === this.net.id });
  }

  nameOf(id) { return this.net.roster.find((p) => p.id === id)?.name ?? null; }

  /** La revanche : chacun la demande d'un geste ; quand tous l'ont demandée, l'hôte relance le même mode. */
  askAgain() {
    this.net.send({ t: 'again' });
    this.wantAgain(this.net.id);
  }

  wantAgain(id) {
    if (!this.match?.over) return;
    this.again.add(id);
    this.onEvent?.('again', { id, n: this.again.size, of: this.net.roster.length });
    if (this.net.host && this.net.roster.every((p) => this.again.has(p.id))) this.launch(this.match.mode);
  }

  /**
   * Mort de KAGE : un point pour l'autre joueur. À deux, c'est l'adversaire ; à plus,
   * celui qui l'a touché en dernier (et si personne ne l'a touché, personne ne marque).
   * Une vie (Duel, Souffle unique) : KAGE est éliminé pour la manche (il ne réapparaît pas).
   */
  onDeath(cause = null) {
    if (!this.match || this.match.over || this.match.roundOver) return;
    const others = this.net.roster.filter((p) => p.id !== this.net.id);
    const by = this.lastHit && others.some((p) => p.id === this.lastHit.by) ? this.lastHit.by : others.length === 1 ? others[0].id : null;
    const how = cause ?? (this.lastHit && this.time - this.lastHit.t < 1.5 ? this.lastHit.kind : 'trap');
    if (by) {
      this.scores.set(by, (this.scores.get(by) ?? 0) + 1);
      this.net.send({ t: 'ko', by, cause: how });
      this.onEvent?.('ko', { by, victim: this.net.id, cause: how });
    }
    this.lastHit = null;
    if (this.oneLife) {
      this.out = true;
      this.match.out.add(this.net.id);
      this.net.send({ t: 'out' });
      this.onEvent?.('out', {});
    }
    if (this.net.host) this.checkEnd();
    // réapparition : le point de départ le plus loin des autres
    const sp = this.level.arena.def.spawns, seen = [...this.remotes.values()].filter((r) => r.seen);
    if (seen.length) {
      let best = sp[0], bestD = -1;
      for (const s of sp) { const d = Math.min(...seen.map((r) => Math.abs(r.x - s.x) + Math.abs(r.y - s.y))); if (d > bestD) { bestD = d; best = s; } }
      this.player.spawnAt = { ...best };
    }
  }

  onThrow(x, y, dir, h) { this.net.send({ t: 'throw', x, y, dir, h, sid: this.shurikens.lastId }); }

  /**
   * L'hôte : le temps qui reste avant la manche suivante (appelé à chaque pas, même quand le duel fige le
   * monde : revoir, score de la manche).
   */
  roundClock(dt) {
    const r = this.pendingRound;
    if (!r) return;
    r.t -= dt;
    if (r.t > 0) return;
    this.pendingRound = null;
    if (this.match === r.m && !r.m.over) { this.net.send({ t: 'roundStart', n: r.next }); this.startRound(r.next); }
  }

  // --- image par image -----------------------------------------------------------------
  update(dt) {
    this.net.pump?.();              // (réseau dans la page : les messages en attente, avant ce pas)
    this.time += dt;
    const p = this.player, a = this.level.arena;
    // pas hôte : les bonus et les caisses du ciel viennent de l'hôte
    if (!this.net.host && !this.shared) { a.heartClock = -1e9; a.bundleClock = -1e9; }
    this.sendT -= dt;
    if (this.sendT <= 0 && this.net.id && (this.net.status === 'ouverte' || this.net.status === 'connecté')) {
      this.sendT = this.sendEvery ?? SEND_EVERY;
      this.net.send({ t: 's', ts: Math.round(this.time * 1000) / 1000, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.facing,
        a: p.anim.name, fr: p.anim.frame, hp: p.hp, iv: p.invuln > 0 ? 1 : 0, st: p.state, sk: this.skinId() });
    }
    for (const r of this.remotes.values()) this.place(r, dt);
    this.ghosts.update(dt);
    this.deflectGhosts();
    for (const [k, t] of this.deflected) if (this.time - t > 3) this.deflected.delete(k);
  }

  /**
   * Où dessiner un autre joueur : entre les deux états reçus qui encadrent l'instant « maintenant moins un
   * dixième de seconde » (le ninja de l'ordinateur, lui, est sur la page : son dernier état, tout de suite).
   */
  place(r, dt) {
    r.iv = Math.max(0, r.iv - dt);
    r.flashT = Math.max(0, r.flashT - dt);
    const b = r.buf;
    if (!b.length) return;
    const t = this.time - (r.bot || this.noDelay ? 0 : INTERP);
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > t) i--;
    const s1 = b[i], s0 = b[i - 1];
    let x, y;
    if (s0 && t >= s0.t && t <= s1.t) {
      const k = (t - s0.t) / Math.max(1e-3, s1.t - s0.t);
      x = s0.x + (s1.x - s0.x) * k; y = s0.y + (s1.y - s0.y) * k;
    } else {
      // pas encore d'état assez récent : on prolonge le dernier de sa vitesse (au plus 0,12 s)
      const last = b[b.length - 1], k = Math.max(0, Math.min(0.12, t - last.t));
      x = last.x + last.vx * k; y = last.y + (last.st === 'idle' || last.st === 'run' ? 0 : last.vy * k);
    }
    const cur = s0 && t < s1.t ? s0 : s1;
    if (Math.hypot(x - r.x, y - r.y) > 120) { r.x = x; r.y = y; } else { r.x = x; r.y = y; }
    r.facing = cur.f;
    r.vx = cur.vx; r.vy = cur.vy;
    r.anim = this.meta.animations[cur.a] ? cur.a : 'idle';
    r.frame = cur.fr;
    r.state = cur.st;
  }

  draw(ctx, cam) {
    const { pivot } = this.meta;
    for (const r of this.remotes.values()) {
      if (!r.seen || r.state === 'respawn' || r.hidden) continue;
      const sk = this.skins[r.skin] ?? this.skins.encre, anim = this.meta.animations[r.anim];
      // style peint : le ninja reste net (trait fin, comme dans main.js : wearSkin)
      const sh = (this.painted && (sk.paintedSheet ??= crispSheet(sk.sheet, NINJA_DEFAULT))) || sk.sheet, Q = sh.P ?? 1;
      const fr = anim?.frames[Math.min(r.frame, anim.frames.length - 1)];
      const x = Math.round(r.x - cam.x), y = Math.round(r.y - cam.y);
      const blink = r.iv > 0 && r.flashT <= 0 && Math.floor(this.time * 16) % 2 === 0;
      if (fr && r.flashT > 0) drawWhiteFrame(ctx, sh, fr, pivot, this.meta.flipForLeft, x, y, r.facing);
      else if (fr && !blink) {
        ctx.save();
        if (sh.smooth) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
        if (r.facing < 0 && this.meta.flipForLeft) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(sh, fr.x * Q, fr.y * Q, fr.w * Q, fr.h * Q, -pivot.x, y - pivot.y, fr.w, fr.h); }
        else ctx.drawImage(sh, fr.x * Q, fr.y * Q, fr.w * Q, fr.h * Q, x - pivot.x, y - pivot.y, fr.w, fr.h);
        ctx.restore();
      }
      if (r.state === 'death' || this.hideTags) continue;
      // son nom au-dessus de la tête, et sa couleur de place
      if (!r.tag || r.tag.name !== r.name) r.tag = { name: r.name, cv: renderText(r.name, { font: 'small', color: '#f4efe2', outline: '#1a1410' }) };
      const tw = r.tag.cv.width, ty = y - 44 - r.tag.cv.height;
      ctx.drawImage(r.tag.cv, x - Math.round(tw / 2), ty);
      if (r.seal) drawSeal(ctx, r.seal, x - Math.round(tw / 2) - 10, ty + 1);   // son sceau d'encre (titre d'arène)
      ctx.fillStyle = SLOT_COLORS[r.slot % 4];
      ctx.fillRect(x - 1, ty + r.tag.cv.height + 1, 3, 2);
      // sa vie : cinq petits traits
      for (let i = 0; i < HEALTH.max; i++) { ctx.fillStyle = i < r.hp ? '#d23c3c' : 'rgba(30, 20, 20, 0.5)'; ctx.fillRect(x - 7 + i * 3, ty - 4, 2, 2); }
    }
    const sheet = (this.skins[this.ghostSkin] ?? this.skins.encre).projectiles.shuriken;
    this.ghosts.drawStuck(ctx, sheet, cam);
    this.ghosts.drawFlying(ctx, sheet, cam);
  }
}
