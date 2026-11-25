// Le duel (mode Arène, novembre 2026) : ce qui fait d'un combat un moment. Tout ce qui ne change pas les règles
// mais la façon de le vivre, pour le combat en ligne comme contre le ninja de l'ordinateur.
//
// Recherche (jeux de duel : Nidhogg, Samurai Gunn, TowerFall, Divekick, Smash, Street Fighter 6) :
//   - l'ouverture : les deux combattants face à face, le vent, une feuille qui tombe, le gong — on retient
//     son souffle avant le premier coup ;
//   - le coup fatal : le coup qui finit une manche est un spectacle (ralenti, zoom sur l'impact, le monde qui
//     s'assombrit, un trait d'encre en travers de l'image, puis le retour brusque) ;
//   - le revoir : les dernières secondes rejouées au ralenti ; puis le score, et la manche suivante tout de suite ;
//   - la manche décisive : la lumière tombe (le soir), le cœur bat ; l'arène qui se resserre (brume d'encre)
//     quand une manche traîne ; un cœur qui apparaît plutôt près de celui qui perd (léger) ;
//   - la fin : une pose de victoire, un genou à terre pour le vaincu, la revanche d'un geste.
// Le dessin est fait dans l'image du jeu (en pixels, police du jeu) ; l'écran de fin est une page de l'interface.
import { renderText } from '../../engine/pixelfont.js';
import { canvas, ih } from '../potager/paint.js';
import { MODES } from '../multi.js';
import { HEALTH } from '../combat.js';
import { drawSeal } from './stats.js';

export const DUEL = {
  intro: 2.4,          // s : l'ouverture d'une manche (on ne joue pas encore)
  fatal: 1.2,          // s : le coup fatal (temps réel)
  slow: 0.16,          // vitesse du jeu au cœur du ralenti
  zoom: 1.7,           // grossissement au plus fort du coup fatal
  replayLen: 2.2,      // s de jeu rejouées
  replaySpeed: 0.85,   // vitesse du revoir
  card: 1.1,           // s : le score de la manche (avant la suivante)
  mistAt: 40,          // s de manche avant que la brume d'encre ne resserre l'arène
  mistSpeed: 14,       // px/s
  mistKeep: 7 * 16,    // demi-largeur laissée libre au centre
  mistHurt: 1.1,       // s entre deux blessures dans la brume
  bars: 15,            // hauteur des bandes noires (px)
};

const ease = (k) => k * k * (3 - 2 * k);

/** Le trait d'encre du coup fatal : un coup de pinceau oblique, épais au départ, qui s'effile, gouttes et franges sèches. */
function inkStroke(w = 340, h = 70) {
  const c = canvas(w, h), g = c.getContext('2d');
  const INK = ['#0b0608', '#170a0d', '#2a0e14'], RED = '#7a1622';
  for (let x = 0; x < w; x++) {
    const u = x / w, mid = h * 0.62 - u * h * 0.3, th = Math.max(1, Math.round(16 * Math.pow(1 - u, 0.7) + 2 * Math.sin(u * 9)));
    for (let y = Math.round(mid - th); y <= Math.round(mid + th); y++) {
      const dry = ih(x >> 1, y, 7) < 0.06 + u * 0.5;           // les franges sèches, de plus en plus vers la fin
      if (dry) continue;
      g.fillStyle = Math.abs(y - mid) < th * 0.35 && u < 0.7 ? RED : INK[(x + y) % 3 === 0 ? 1 : y < mid ? 0 : 2];
      g.fillRect(x, y, 1, 1);
    }
    if (ih(x, 3, 9) < 0.05) { g.fillStyle = INK[0]; g.fillRect(x, Math.round(mid + th + 2 + ih(x, 4, 9) * 8), 2, 2); }   // gouttes
  }
  return c;
}

/** La brume d'encre (bord) : une colonne tramée, qui se répète en hauteur. */
function mistEdge(h = 128) {
  const c = canvas(28, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < 28; x++) {
    const edge = 14 + Math.sin(y * 0.09) * 5 + Math.sin(y * 0.031 + 1) * 4;
    const d = (edge - x) / 14;
    const a = Math.max(0, Math.min(1, d + (ih(x, y, 31) - 0.5) * 0.5));
    if (a <= 0.05) continue;
    g.fillStyle = `rgba(10, 8, 16, ${(0.88 * a).toFixed(3)})`;
    g.fillRect(x, y, 1, 1);
  }
  return c;
}

export class Duel {
  /**
   * o : { level, player, fx, sfx, music, cycle, camera, view(), uiLayer, layers (calques du jeu à zoomer),
   *       sheetOf(skin), meta, stats, myName(), mySkin(), onLobby(), onLeave(), bot }
   */
  constructor(o) {
    Object.assign(this, o);
    this.multi = null;
    this.phase = 'idle';
    this.t = 0;
    this.rec = [];
    this.recT = 0;
    this.roundT = 0;
    this.mistT = 0;
    this.beatT = 0;
    this.ink = inkStroke();
    this.mistImg = mistEdge();
    this.texts = new Map();
    this.leaf = null;
    this.zoomK = 1;
    this.buildEnd();
  }

  // ---- ce que le jeu doit savoir --------------------------------------------------------
  /** Vitesse du jeu (le ralenti du coup fatal). */
  get timeScale() {
    if (this.phase !== 'fatal') return 1;
    const k = this.t / DUEL.fatal;
    return k < 0.7 ? DUEL.slow : DUEL.slow + (1 - DUEL.slow) * ease((k - 0.7) / 0.3);
  }
  /** Le monde est figé (revoir, score de la manche). */
  get freeze() { return this.phase === 'replay' || this.phase === 'card'; }
  /** Les commandes sont retenues (ouverture, coup fatal, revoir, score, fin). */
  get lock() { return this.phase !== 'fight' && this.phase !== 'idle'; }
  get replaying() { return this.phase === 'replay'; }

  text(key, s, o) {
    let c = this.texts.get(key);
    if (!c || c.s !== s) { c = { s, cv: renderText(s, o) }; this.texts.set(key, c); }
    return c.cv;
  }

  // ---- les événements du combat (multi.js) --------------------------------------------------
  start(mode) {
    this.mode = mode;
    this.endEl.hidden = true;
    this.endEl.classList.remove('on');
    this.pending = null;
    this.restoreLight();
    this.music?.active === 'duel' && this.music.switchTo('main', { fadeOut: 1.5, fadeIn: 2, delay: 0.2 });
    this.rivals = [...(this.multi?.remotes.values() ?? [])].map((r) => r.name);
    this.intro(1, false);
  }

  roundStart(n, decisive) { this.intro(n, decisive); }

  intro(n, decisive) {
    this.phase = 'intro';
    this.t = 0;
    this.round = n;
    this.decisive = decisive;
    this.roundT = 0;
    this.mistT = 0;
    this.rec = [];
    this.hitMe = false;
    this.sfx('duelWind');
    if (decisive) this.goDecisive();
    // une feuille traverse l'image, entre les deux combattants
    const v = this.view();
    this.leaf = { x: this.camera.x + v.w * 0.3, y: this.camera.y + 20, vx: 22, t: 0 };
  }

  /** Mon coup porte (d.final : il finit la manche ou le combat). */
  strike(d) { if (d.final) this.fatal(d.x, d.y + 8, d.dir, true); }

  /** Je suis touché. */
  hurt(d) { this.hitMe = true; if (d.final) this.fatal(d.x, d.y + 8, d.dir, false); }

  fatal(x, y, dir, mine) {
    if (this.phase === 'fatal' || this.phase === 'replay' || this.phase === 'card') return;
    this.phase = 'fatal';
    this.t = 0;
    this.fatalAt = { x, y, dir: dir || 1 };
    this.sfx('fatal');
    this.fx.shake(3, 0.3);
    this.fx.flash(x, y, { size: 22, life: 0.5, halo: 16 });
    if (mine) this.stats?.add('fatals');
  }

  roundEnd(d) {
    this.pending = { kind: 'round', ...d };
    const me = this.multi?.net.id;
    if (d.winner === me && this.player.hp >= HEALTH.max && !this.hitMe) this.stats?.add('perfect');
    this.stats?.add('rounds');
    if (d.winner === me) this.stats?.add('roundsWon');
    if (this.phase !== 'fatal') { this.phase = 'wait'; this.t = 0; }
  }

  end(d) {
    this.pending = { kind: 'end', ...d };
    this.stats?.match({ won: !!d.mine, arena: this.level.name.replace(/^Arène — /, ''), rivals: this.rivals ?? [] });
    if (this.phase !== 'fatal') { this.phase = 'wait'; this.t = 0; }
  }

  // ---- le temps qui passe ------------------------------------------------------------------
  /** À chaque image (temps réel). */
  update(dt) {
    this.t += dt;
    switch (this.phase) {
      case 'intro':
        if (this.t > 1.75 && !this.gonged) { this.gonged = true; this.sfx('gong'); this.fx.shake(1, 0.2); }
        if (this.t >= DUEL.intro) { this.phase = 'fight'; this.t = 0; this.gonged = false; }
        break;
      case 'fatal':
        if (this.t >= DUEL.fatal) this.afterFatal();
        break;
      case 'wait':
        // (une manche finie sans coup fatal : un piège, une chute) on laisse voir la mort un instant
        if (this.t >= 0.7) this.afterFatal();
        break;
      case 'replay':
        if (this.t >= DUEL.replayLen / DUEL.replaySpeed) {
          if (this.pending?.kind === 'end') this.showEnd();
          else { this.phase = 'card'; this.t = 0; this.sfx('roundEnd'); }
        }
        break;
      default:
    }
    this.applyZoom();
    if (this.leaf) {
      this.leaf.t += dt;
      this.leaf.x += this.leaf.vx * dt;
      this.leaf.y += 26 * dt;
      if (this.leaf.t > 3) this.leaf = null;
    }
  }

  afterFatal() {
    if (!this.pending) { this.phase = 'fight'; this.t = 0; return; }
    if (this.rec.length > 6) { this.phase = 'replay'; this.t = 0; this.replayFrom = Math.max(0, this.rec.length - Math.round(DUEL.replayLen * 30)); }
    else if (this.pending.kind === 'end') this.showEnd();
    else { this.phase = 'card'; this.t = 0; }
  }

  /** À chaque pas du jeu : on enregistre (revoir), la brume, le cœur qui bat, le cœur posé près du perdant. */
  step(dt) {
    if (this.phase === 'fight') {
      this.roundT += dt;
      this.mist(dt);
      // à bout de vie, le cœur bat (la tension monte)
      if (this.player.hp > 0 && this.player.hp <= 2 && this.player.state !== 'death') {
        this.beatT -= dt;
        if (this.beatT <= 0) { this.beatT = 0.95; this.sfx('heartbeat'); }
      }
    }
    // le revoir : 30 instantanés par seconde, les 3 dernières secondes
    this.recT -= dt;
    if (this.recT <= 0 && (this.phase === 'fight' || this.phase === 'fatal')) {
      this.recT = 1 / 30;
      this.rec.push(this.snapshot());
      if (this.rec.length > 96) this.rec.shift();
    }
    // le cœur (bonus) apparaît plutôt près de celui qui est derrière (manches, puis vie)
    const a = this.level.arena, m = this.multi;
    if (a && m) {
      let best = null, key = Infinity;
      const cand = [{ id: m.net.id, x: this.player.x, hp: this.player.hp }, ...[...m.remotes.values()].map((r) => ({ id: r.id, x: r.x, hp: r.hp }))];
      for (const c of cand) { const k = (m.wins.get(c.id) ?? 0) * 10 + (m.scores.get(c.id) ?? 0) * 10 + c.hp; if (k < key) { key = k; best = c; } }
      a.favorX = best?.x ?? null;
    }
  }

  snapshot() {
    const p = this.player, m = this.multi;
    const list = [{ x: p.x, y: p.y, f: p.facing, a: p.anim.name, fr: p.anim.frame, sk: this.mySkin(), w: p.flashT > 0, dead: p.state === 'respawn' }];
    if (m) for (const r of m.remotes.values()) if (r.seen) list.push({ x: r.x, y: r.y, f: r.facing, a: r.anim, fr: r.frame, sk: r.skin, w: r.flashT > 0, dead: r.state === 'respawn' });
    return { list, cam: { x: this.camera.x, y: this.camera.y } };
  }

  /** La brume d'encre : après DUEL.mistAt s de manche, elle avance des deux bords ; on y perd des vies. */
  mist(dt) {
    if (!this.multi?.oneLife || !this.level.arena) return;
    const e = this.mistEdges();
    if (!e) return;
    const p = this.player;
    if (p.state === 'death' || p.state === 'respawn') return;
    this.mistT -= dt;
    if ((p.x < e.l + 2 || p.x > e.r - 2) && this.mistT <= 0) {
      this.mistT = DUEL.mistHurt;
      p.hurt(1, p.x < e.l + 2 ? p.x - 20 : p.x + 20, 'kick');
    }
  }

  mistEdges() {
    if (this.roundT < DUEL.mistAt || !this.level.arena) return null;
    const [l, r] = this.level.arena.def.walls, a = (l + 1) * 16, z = r * 16, c = (a + z) / 2;
    const adv = Math.min(c - DUEL.mistKeep - a, (this.roundT - DUEL.mistAt) * DUEL.mistSpeed);
    return { l: a + adv, r: z - adv };
  }

  // ---- la manche décisive : la lumière tombe ------------------------------------------------------
  goDecisive() {
    if (this.cycle) { this.prevT ??= this.cycle.t; this.cycle.set('soir'); }
    if (this.music?.voices?.duel) this.music.switchTo('duel', { fadeOut: 1.2, fadeIn: 1.5, delay: 0.1 });
    for (let i = 0; i < 3; i++) setTimeout(() => this.sfx('heartbeat'), 300 + i * 700);
  }

  restoreLight() {
    if (this.cycle && this.prevT != null) { this.cycle.t = this.prevT; this.prevT = null; }
  }

  // ---- le zoom du coup fatal (les calques du jeu, ensemble) --------------------------------------------
  applyZoom() {
    let k = 1;
    if (this.phase === 'fatal') {
      const u = this.t / DUEL.fatal;
      k = u < 0.18 ? 1 + (DUEL.zoom - 1) * ease(u / 0.18) : u < 0.72 ? DUEL.zoom : 1 + (DUEL.zoom - 1) * (1 - ease((u - 0.72) / 0.28));
    }
    if (Math.abs(k - this.zoomK) < 0.001) return;
    this.zoomK = k;
    const v = this.view(), at = this.fatalAt;
    for (const el of this.layers()) {
      if (!el) continue;
      if (k === 1) { el.style.transform = ''; el.style.transformOrigin = ''; continue; }
      const sx = el.clientWidth / v.w, sy = el.clientHeight / v.h;
      const ox = at ? (at.x - this.camera.x) * sx : el.clientWidth / 2, oy = at ? (at.y - 14 - this.camera.y) * sy : el.clientHeight / 2;
      el.style.transformOrigin = `${Math.round(ox)}px ${Math.round(oy)}px`;
      el.style.transform = `scale(${k.toFixed(3)})`;
    }
  }

  // ---- le dessin (dans l'image du jeu, en pixels) ------------------------------------------------------
  /** La brume, dans le monde (devant le décor, derrière l'interface). */
  drawWorld(ctx, cam) {
    const e = this.phase === 'fight' || this.phase === 'fatal' ? this.mistEdges() : null;
    const v = this.view();
    if (e) {
      const H = this.mistImg.height, off = Math.floor((this.roundT * 9) % H);
      for (const side of [-1, 1]) {
        const edge = Math.round((side < 0 ? e.l : e.r) - cam.x);
        ctx.fillStyle = 'rgba(10, 8, 16, 0.86)';
        if (side < 0 && edge > 0) ctx.fillRect(0, 0, edge - 14, v.h);
        if (side > 0 && edge < v.w) ctx.fillRect(edge + 14, 0, v.w - edge - 14, v.h);
        for (let y = -off; y < v.h; y += H) {
          ctx.save();
          if (side < 0) { ctx.translate(edge + 14, 0); ctx.scale(-1, 1); ctx.drawImage(this.mistImg, 0, y); } else ctx.drawImage(this.mistImg, edge - 14, y);
          ctx.restore();
        }
      }
    }
    // la feuille de l'ouverture
    if (this.leaf) {
      const x = Math.round(this.leaf.x + Math.sin(this.leaf.t * 3) * 6 - cam.x), y = Math.round(this.leaf.y - cam.y);
      const up = Math.sin(this.leaf.t * 6) > 0;
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(x, y, 3, 1);
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x + (up ? 1 : 0), y + 1, 2, 1);
    }
  }

  /** Les combattants rejoués (revoir). */
  drawReplay(ctx, cam) {
    const i = Math.min(this.rec.length - 1, this.replayFrom + Math.floor(this.t * DUEL.replaySpeed * 30));
    const s = this.rec[i];
    if (!s) return;
    const { pivot } = this.meta;
    for (const f of s.list) {
      if (f.dead) continue;
      const anim = this.meta.animations[f.a], fr = anim?.frames[Math.min(f.fr, anim.frames.length - 1)];
      const sh = this.sheetOf(f.sk);
      if (!fr || !sh) continue;
      const Q = sh.P ?? 1, x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
      ctx.save();
      if (f.f < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(sh, fr.x * Q, fr.y * Q, fr.w * Q, fr.h * Q, -pivot.x, y - pivot.y, fr.w, fr.h); }
      else ctx.drawImage(sh, fr.x * Q, fr.y * Q, fr.w * Q, fr.h * Q, x - pivot.x, y - pivot.y, fr.w, fr.h);
      ctx.restore();
    }
  }

  /** La caméra du revoir : celle de l'instant rejoué. */
  replayCam() {
    const i = Math.min(this.rec.length - 1, this.replayFrom + Math.floor(this.t * DUEL.replaySpeed * 30));
    return this.rec[i]?.cam ?? null;
  }

  /** Par-dessus tout : bandes noires, titres, coup fatal (voile, trait d'encre), revoir, score. */
  drawOver(ctx) {
    const v = this.view(), W = v.w, H = v.h, t = this.t;
    const bars = (k) => { const b = Math.round(DUEL.bars * k); if (b <= 0) return; ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); };
    const center = (cv, y, a = 1) => { ctx.globalAlpha = a; ctx.drawImage(cv, Math.round((W - cv.width) / 2), Math.round(y)); ctx.globalAlpha = 1; };
    if (this.phase === 'intro') {
      const k = t < 0.3 ? ease(t / 0.3) : t > DUEL.intro - 0.4 ? 1 - ease((t - (DUEL.intro - 0.4)) / 0.4) : 1;
      bars(k);
      const name = this.decisive ? 'Manche décisive' : MODES[this.mode]?.rounds ? `Manche ${this.round}` : MODES[this.mode]?.name ?? 'Duel';
      const a = t < 0.4 ? 0 : t < 0.7 ? (t - 0.4) / 0.3 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.25);
      if (a > 0) center(this.text('title', name, { font: 'big', color: this.decisive ? '#f2b8a8' : '#f3e3c3', outline: '#14100c' }), H * 0.3, a);
      if (t >= 1.75 && t < 2.25) {
        const k2 = (t - 1.75) / 0.5;
        center(this.text('go', 'Combattez', { font: 'big', color: '#fff6d8', outline: '#14100c' }), H * 0.3, 1 - k2);
        if (k2 < 0.25) { ctx.globalAlpha = 0.35 * (1 - k2 / 0.25); ctx.fillStyle = '#fff6e0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      }
      if (this.decisive) { ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#5a0e14'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      return;
    }
    if (this.phase === 'fatal') {
      const u = t / DUEL.fatal, at = this.fatalAt;
      // le monde s'assombrit, l'encre tranche l'image au point de l'impact
      const dark = u < 0.1 ? u / 0.1 : u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
      ctx.globalAlpha = 0.5 * dark; ctx.fillStyle = '#12040a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      bars(dark);
      if (at) {
        const reveal = Math.min(1, u / 0.12), ink = this.ink;
        const x = Math.round(at.x - this.camera.x - ink.width / 2), y = Math.round(at.y - 14 - this.camera.y - ink.height / 2);
        ctx.globalAlpha = Math.min(1, dark * 1.3);
        ctx.save();
        if (at.dir < 0) { ctx.translate(x + ink.width, 0); ctx.scale(-1, 1); ctx.drawImage(ink, 0, 0, Math.round(ink.width * reveal), ink.height, 0, y, Math.round(ink.width * reveal), ink.height); }
        else ctx.drawImage(ink, 0, 0, Math.round(ink.width * reveal), ink.height, x, y, Math.round(ink.width * reveal), ink.height);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (this.phase === 'replay') {
      bars(1);
      // le revoir : un léger voile froid, un mot discret dans la bande du haut
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#1a2a40'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      const cv = this.text('rev', 'Revoir', { font: 'small', color: '#a8a296' });
      ctx.drawImage(cv, 8, Math.round((DUEL.bars - cv.height) / 2));
      if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#b8282e'; ctx.fillRect(4, Math.round(DUEL.bars / 2) - 1, 2, 2); }
      return;
    }
    if (this.phase === 'card') {
      bars(1);
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      const d = this.pending ?? {};
      const top = this.text('cardT', d.name ? `Manche à ${d.name}` : 'Manche nulle', { font: 'big', color: '#f3e3c3', outline: '#14100c' });
      center(top, H * 0.32);
      this.drawPips(ctx, W, H * 0.32 + top.height + 8);
    }
  }

  /** Les manches gagnées de chacun : un nom, des ronds (pleins : gagnées). */
  drawPips(ctx, W, y) {
    const m = this.multi;
    if (!m) return;
    const need = MODES[this.mode]?.rounds ?? 0;
    const rows = m.net.roster.map((p) => ({ name: p.name, wins: m.wins.get(p.id) ?? 0, seal: p.id === m.net.id ? this.stats?.seal : m.remotes.get(p.id)?.seal }));
    rows.forEach((r, i) => {
      const cv = this.text(`pip${i}`, r.name, { font: 'small', color: '#e9e5da', outline: '#14100c' });
      const yy = Math.round(y + i * 12), x0 = Math.round(W / 2 - 50);
      if (r.seal) drawSeal(ctx, r.seal, x0 - 12, yy + 1);
      ctx.drawImage(cv, x0, yy);
      for (let k = 0; k < Math.max(need, r.wins); k++) {
        const px = Math.round(W / 2 + 22 + k * 9), on = k < r.wins;
        ctx.fillStyle = '#14100c'; ctx.fillRect(px - 1, yy, 7, 7);
        ctx.fillStyle = on ? '#e8b93c' : '#3a3630'; ctx.fillRect(px, yy + 1, 5, 5);
        if (on) { ctx.fillStyle = '#fff3c4'; ctx.fillRect(px + 1, yy + 2, 1, 1); }
      }
    });
  }

  // ---- la fin du duel ----------------------------------------------------------------------------
  buildEnd() {
    const el = document.createElement('section');
    el.className = 'duel-end';
    el.hidden = true;
    el.setAttribute('aria-label', 'Fin du duel');
    el.dataset.duelEnd = '';
    el.innerHTML = `<p class="duel-end__title" data-end-title></p>
      <p class="duel-end__line" data-end-line></p>
      <p class="duel-end__new" data-end-new></p>
      <div class="duel-end__acts"><button type="button" class="duel-end__btn duel-end__btn--main" data-again>Revanche</button>
      <button type="button" class="duel-end__btn" data-lobby>Salon</button></div>
      <p class="duel-end__wait" data-end-wait></p>`;
    this.uiLayer.append(el);
    this.endEl = el;
    el.querySelector('[data-again]').addEventListener('click', () => {
      this.multi?.askAgain();
      el.querySelector('[data-again]').disabled = true;
    });
    el.querySelector('[data-lobby]').addEventListener('click', () => { this.hideEnd(); this.onLobby?.(); });
  }

  showEnd() {
    const d = this.pending ?? {}, m = this.multi, el = this.endEl;
    this.phase = 'result';
    this.t = 0;
    // les poses : le vainqueur rengaine, le vaincu met un genou à terre
    const p = this.player;
    if (d.mine) { if (p.state !== 'death' && p.state !== 'respawn') p.setState('victory'); }
    else {
      if (m) m.out = false;
      if (this.level.hitsWater?.(p.box()) || p.y > this.level.height - 8) { const s = p.spawnAt ?? this.level.spawn; p.x = s.x; p.y = s.y; }
      p.vx = 0; p.vy = 0; p.hp = Math.max(1, p.hp);
      p.setState('defeat');
    }
    this.restoreLight();
    const set = (k, s) => { el.querySelector(`[data-end-${k}]`).textContent = s; };
    set('title', d.mine ? 'Victoire' : d.name ? `Victoire de ${d.name}` : 'Fin du combat');
    const rows = m ? m.net.roster.map((r) => `${r.name} ${MODES[this.mode]?.rounds ? (m.wins.get(r.id) ?? 0) : (m.scores.get(r.id) ?? 0)}`) : [];
    set('line', rows.join('  ·  '));
    const fresh = this.stats?.takeFresh() ?? [];
    set('new', fresh.length ? `Nouveau titre : ${fresh.map((t) => t.name).join(', ')}` : '');
    set('wait', '');
    el.querySelector('[data-again]').disabled = false;
    el.querySelector('[data-lobby]').textContent = this.bot ? 'Menu' : 'Salon';
    el.hidden = false;
    requestAnimationFrame(() => { el.classList.add('on'); el.querySelector('[data-again]').focus(); });
  }

  /** La revanche : qui l'a demandée. */
  again(d) {
    const el = this.endEl;
    if (el.hidden) return;
    el.querySelector('[data-end-wait]').textContent = d.n < d.of ? `Revanche demandée (${d.n} sur ${d.of})` : '';
  }

  hideEnd() {
    this.endEl.classList.remove('on');
    this.endEl.hidden = true;
    if (this.player.state === 'victory' || this.player.state === 'defeat') this.player.endSpecial();
    this.phase = 'idle';
  }
}
