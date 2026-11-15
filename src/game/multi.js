// Jeu à plusieurs, dans une arène : les autres ninjas de la salle (src/engine/net.js).
// Chacun joue son propre KAGE sur son écran et envoie son état vingt fois par
// seconde ; les autres sont dessinés à l'endroit reçu (lissé), avec leur skin et
// leur nom au-dessus de la tête. Un coup est décidé par l'écran de celui qui le
// porte (sabre, coup de pied, shuriken) : il prévient sa cible, qui encaisse.
// Les pièges de l'arène (gong, corde de la grue, caisses, échafaudages) sont
// partagés ; les bonus, c'est l'hôte qui les décide.
import { renderText } from '../engine/pixelfont.js';
import { Shurikens } from './shuriken.js';
import { HEALTH } from './combat.js';

const SEND_EVERY = 0.05;        // s : vingt états par seconde
export const SLOT_COLORS = ['#e8b93c', '#5ccdc8', '#e0607a', '#9ad35a'];   // repère de chaque place (or, eau, laque, pousse)
// les modes du combat (choisis par l'hôte dans le salon)
export const MODES = {
  souffle: { name: 'Souffle unique', text: 'Une vie : le dernier debout gagne.', lives: 1 },
  trois: { name: 'Trois lames', text: 'Le premier à 3 éliminations gagne.', goal: 3 },
  dix: { name: 'Dix lames', text: 'Le premier à 10 éliminations gagne.', goal: 10 },
};

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Multi {
  /** deps : { net, player, shurikens, level, meta, skins, skinId() , onEvent(n, d) } */
  constructor(deps) {
    Object.assign(this, deps);
    this.remotes = new Map();
    this.scores = new Map();
    this.sendT = 0;
    this.time = 0;
    this.lastHit = null;            // { by, t } : le dernier coup reçu
    this.placed = false;
    this.match = null;              // le combat en cours : { mode, players (ids au départ), out (Set), over }
    this.out = false;               // Souffle unique : KAGE est éliminé, il regarde la fin
    this.applying = false;          // vrai pendant qu'on rejoue un événement reçu (pour ne pas le renvoyer)
    // les shurikens des autres : pour les voir voler (c'est leur écran qui décide s'ils touchent)
    const quiet = Object.create(this.level);
    quiet.cutRope = () => null; quiet.hitGongs = () => 0; quiet.hitTargets = () => 0;
    this.ghosts = new Shurikens(quiet, this.meta);
    this.ghosts.onEvent = () => {};
    // nos shurikens touchent les autres joueurs (un « ennemi » qui les représente tous)
    this.shurikens.enemies.push({ takeHit: (box, ax, id, dmg) => this.strikeBox(box, ax, `s${id ?? Math.random()}`, dmg, 0) });
    this.hookArena();
    const net = this.net;
    net.onMessage = (from, m) => this.receive(from, m);
    net.onRoster = (r) => this.roster(r);
  }

  get me() { return this.net.roster.find((p) => p.id === this.net.id); }

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
      if (rm) { rm.name = p.name; rm.slot = p.slot; } else this.remotes.set(p.id, this.newRemote(p));
      if (!this.scores.has(p.id)) this.scores.set(p.id, 0);
    }
    if (!this.scores.has(this.net.id)) this.scores.set(this.net.id, 0);
    this.net.send({ t: 'me', sk: this.skinId() });   // que les nouveaux voient notre skin (dans le salon)
    if (this.net.host && this.match && !this.match.over) this.checkEnd();
    // notre place connue : on apparaît à son point de départ (une fois)
    const me = this.me;
    if (me && !this.placed) {
      this.placed = true;
      const sp = this.level.arena.def.spawns;
      this.level.spawn = { ...sp[me.slot % sp.length] };
      this.player.respawn(true);
    }
    this.onEvent?.('roster', { roster: r });
  }

  newRemote(p) {
    return { id: p.id, name: p.name, slot: p.slot, skin: 'encre', x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, tt: 0, facing: 1,
      anim: 'idle', frame: 0, hp: HEALTH.max, iv: 0, state: 'idle', seen: false, tag: null };
  }

  /** Boîte de collision d'un autre joueur (comme celle de KAGE). */
  boxOf(r) {
    const hb = this.meta.hitbox, h = r.state === 'slide' ? hb.slide : r.state === 'dash' ? hb.dash : hb.default, { pivot } = this.meta;
    const ox = r.facing > 0 ? h.x - pivot.x : pivot.x - (h.x + h.w);
    return { x: r.x + ox, y: r.y - pivot.y + h.y, w: h.w, h: h.h };
  }

  // --- messages reçus ------------------------------------------------------------------
  receive(from, m) {
    const a = this.level.arena;
    const r = this.remotes.get(from);
    switch (m.t) {
      case 's':
        if (!r) return;
        r.tx = m.x; r.ty = m.y; r.vx = m.vx; r.vy = m.vy; r.tt = this.time; r.facing = m.f;
        r.anim = this.meta.animations[m.a] ? m.a : 'idle'; r.frame = m.fr; r.hp = m.hp; r.iv = m.iv; r.state = m.st;
        if (this.skins[m.sk]) r.skin = m.sk;
        if (!r.seen || Math.hypot(r.tx - r.x, r.ty - r.y) > 80) { r.x = r.tx; r.y = r.ty; }
        r.seen = true;
        break;
      case 'hit':
        if (m.to !== this.net.id) return;
        if (this.player.hurt(m.dmg, m.fromX)) {
          if (m.push) this.player.vx = m.push;
          this.lastHit = { by: from, t: this.time };
        }
        break;
      case 'ko': {
        if (!this.match || this.match.over) return;
        const by = m.by;
        this.scores.set(by, (this.scores.get(by) ?? 0) + 1);
        this.onEvent?.('ko', { by, victim: from });
        if (this.net.host) this.checkEnd();
        break;
      }
      case 'me': if (r && this.skins[m.sk]) { r.skin = m.sk; this.onEvent?.('roster', { roster: this.net.roster }); } break;
      case 'mode': this.onEvent?.('mode', { mode: m.mode }); break;
      case 'start': this.startMatch(m.mode); break;
      case 'out': if (this.match) { this.match.out.add(from); if (this.net.host) this.checkEnd(); } break;
      case 'end': this.endMatch(m.winner, m.scores); break;
      case 'throw':
        this.ghosts.stock = 99;
        this.ghosts.throw(m.x, m.y, m.dir, m.h);
        this.ghostSkin = r?.skin ?? 'encre';
        this.onEvent?.('throwRemote', { x: m.x, y: m.y });
        break;
      case 'gong': this.apply(() => { if (a.gong.ready) a.hitGong(a.gongBox()); }); break;
      case 'cut': this.apply(() => { const c = a.crane; a.cutRope({ x: c.ropeX - 1, y: c.boomY + 20, w: 2, h: 2 }); }); break;
      case 'kick': this.apply(() => a.kickCrates(m.box, m.dir, null)); break;
      case 'col': this.apply(() => { const s = this.level.scaffolds[m.i]; if (s) a.collapse(s, m.x); }); break;
      case 'pk': this.apply(() => { if (!a.pickups.some((p) => p.spot === m.spot)) { a.pickups.push({ kind: m.kind, x: m.x, y: m.y, spot: m.spot, t: 0 }); a.onEvent?.('pickupAppear', { kind: m.kind, x: m.x, y: m.y - 10, spot: m.spot }); } }); break;
      case 'take': a.pickups = a.pickups.filter((p) => p.spot !== m.spot); break;
      default:
    }
  }

  // --- nos coups sur les autres -----------------------------------------------------------
  /** Une zone de frappe (sabre, coup de pied, shuriken) : touche-t-elle un autre joueur ? */
  strikeBox(box, fromX, attackId, dmg, push) {
    let hit = null;
    for (const r of this.remotes.values()) {
      if (!r.seen || r.state === 'death' || r.state === 'respawn' || r.iv > 0) continue;
      if (!overlap(box, this.boxOf(r))) continue;
      r.hits ??= new Set();
      if (r.hits.has(attackId)) continue;
      r.hits.add(attackId);
      if (r.hits.size > 30) r.hits = new Set([attackId]);
      this.net.send({ t: 'hit', to: r.id, dmg, fromX, push: push ? Math.sign(r.x - fromX || 1) * push : 0 });
      r.iv = 0.3;                          // le temps que son état revienne : on ne le frappe pas deux fois
      hit = 'hit';
      this.onEvent?.('strike', { x: r.x, y: r.y - 16, dir: Math.sign(r.x - fromX) || 1 });
    }
    return hit;
  }

  // --- le combat : départ, morts, fin ------------------------------------------------------
  /** L'hôte lance le combat (mode) : tout le monde à sa place, les points à zéro. */
  launch(mode) {
    if (!this.net.host) return;
    this.net.send({ t: 'start', mode });
    this.startMatch(mode);
  }

  startMatch(mode) {
    this.match = { mode, players: this.net.roster.map((p) => p.id), out: new Set(), over: false };
    this.out = false;
    this.lastHit = null;
    for (const id of this.scores.keys()) this.scores.set(id, 0);
    const me = this.me, sp = this.level.arena.def.spawns;
    if (me) this.level.spawn = { ...sp[me.slot % sp.length] };
    this.level.arena.reset();
    this.player.respawn(true);
    this.shurikens.reset();
    this.onEvent?.('start', { mode });
  }

  /** L'hôte vérifie si le combat est fini, et l'annonce. */
  checkEnd() {
    const m = this.match;
    if (!m || m.over) return;
    const mode = MODES[m.mode];
    let done = false, winner = null;
    if (mode.goal) {
      for (const [id, n] of this.scores) if (n >= mode.goal) { done = true; winner = id; }
    } else {
      const alive = m.players.filter((id) => !m.out.has(id) && this.net.roster.some((p) => p.id === id));
      if (alive.length <= 1) { done = true; winner = alive[0] ?? null; }
    }
    if (!done) return;
    const scores = [...this.scores];
    this.net.send({ t: 'end', winner, scores });
    this.endMatch(winner, scores);
  }

  endMatch(winner, scores) {
    if (!this.match || this.match.over) return;
    this.match.over = true;
    if (scores) for (const [id, n] of scores) this.scores.set(id, n);
    this.onEvent?.('end', { winner, name: this.net.roster.find((p) => p.id === winner)?.name ?? null });
  }

  /**
   * Mort de KAGE : un point pour l'autre joueur. À deux, c'est l'adversaire ; à plus,
   * celui qui l'a touché en dernier (et si personne ne l'a touché, personne ne marque).
   * Souffle unique : KAGE est éliminé (il ne réapparaît pas).
   */
  onDeath() {
    if (!this.match || this.match.over) return;
    const others = this.net.roster.filter((p) => p.id !== this.net.id);
    const by = this.lastHit && others.some((p) => p.id === this.lastHit.by) ? this.lastHit.by : others.length === 1 ? others[0].id : null;
    if (by) {
      this.scores.set(by, (this.scores.get(by) ?? 0) + 1);
      this.net.send({ t: 'ko', by });
      this.onEvent?.('ko', { by, victim: this.net.id });
    }
    this.lastHit = null;
    if (MODES[this.match.mode].lives) {
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
      this.level.spawn = { ...best };
    }
  }

  onThrow(x, y, dir, h) { this.net.send({ t: 'throw', x, y, dir, h }); }

  // --- image par image -----------------------------------------------------------------
  update(dt) {
    this.time += dt;
    const p = this.player, a = this.level.arena;
    // pas hôte : les bonus et les caisses du ciel viennent de l'hôte
    if (!this.net.host) { a.heartClock = -1e9; a.bundleClock = -1e9; }
    this.sendT -= dt;
    if (this.sendT <= 0 && this.net.id && (this.net.status === 'ouverte' || this.net.status === 'connecté')) {
      this.sendT = SEND_EVERY;
      this.net.send({ t: 's', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.facing,
        a: p.anim.name, fr: p.anim.frame, hp: p.hp, iv: p.invuln > 0 ? 1 : 0, st: p.state, sk: this.skinId() });
    }
    for (const r of this.remotes.values()) {
      // lissé : on vise l'endroit reçu, prolongé de sa vitesse (au plus 0,12 s)
      const k = Math.min(0.12, this.time - r.tt);
      const gx = r.tx + r.vx * k, gy = r.ty + (r.state === 'idle' || r.state === 'run' ? 0 : r.vy * k);
      const f = Math.min(1, dt * 18);
      r.x += (gx - r.x) * f; r.y += (gy - r.y) * f;
      r.iv = Math.max(0, r.iv - dt);
    }
    this.ghosts.update(dt);
  }

  draw(ctx, cam) {
    const { pivot } = this.meta;
    for (const r of this.remotes.values()) {
      if (!r.seen || r.state === 'respawn') continue;
      const sk = this.skins[r.skin] ?? this.skins.encre, anim = this.meta.animations[r.anim];
      const fr = anim?.frames[Math.min(r.frame, anim.frames.length - 1)];
      const x = Math.round(r.x - cam.x), y = Math.round(r.y - cam.y);
      const blink = r.iv > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (fr && !blink) {
        ctx.save();
        if (r.facing < 0 && this.meta.flipForLeft) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(sk.sheet, fr.x, fr.y, fr.w, fr.h, -pivot.x, y - pivot.y, fr.w, fr.h); }
        else ctx.drawImage(sk.sheet, fr.x, fr.y, fr.w, fr.h, x - pivot.x, y - pivot.y, fr.w, fr.h);
        ctx.restore();
      }
      if (r.state === 'death') continue;
      // son nom au-dessus de la tête, et sa couleur de place
      if (!r.tag || r.tag.name !== r.name) r.tag = { name: r.name, cv: renderText(r.name, { font: 'small', color: '#f4efe2', outline: '#1a1410' }) };
      const tw = r.tag.cv.width, ty = y - 44 - r.tag.cv.height;
      ctx.drawImage(r.tag.cv, x - Math.round(tw / 2), ty);
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
