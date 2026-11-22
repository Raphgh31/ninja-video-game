// Le salon de l'arène, style « Les lanternes » (planche docs/menus/planche_lanternes.png) : un écran
// plein, avant (et entre) les combats, dans la nuit de l'intro. Le code de l'arène s'écrit sur quatre
// tablettes de bois (un clic le copie) ; chaque place a sa lanterne, qui s'allume quand un ninja
// arrive ; les trois modes sur une ligne, la règle du mode choisi dessous ; l'hôte lance le combat en
// frappant le gong. À la fin d'un combat : le vainqueur devant le gong, les points, puis retour au salon.
import { MODES } from '../multi.js';
import { measure } from '../../engine/pixelfont.js';
import { homeIcon } from '../menu.js';
import { canvas } from '../potager/paint.js';
import {
  Pen, INK, flat, ground, stoneLantern, drawFlame, gong, drawGongRing, ema, drawSign, rope, stroke, NinjaArt, smooth, clamp01,
} from '../menuart.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class Lobby {
  /**
   * root : le calque de l'interface (.ui). deps : { net, multi, meta, skins, arenaName, backdrop (le décor
   * de nuit de l'intro, src/game/intro.js, décor seul), onLaunch(modeId), onQuit() }
   */
  constructor(root, deps) {
    Object.assign(this, deps);
    this.root = root;
    this.mode = 'souffle';
    this.status = '';
    this.art = new NinjaArt(this.meta, this.skins);
    this.el = el('section', 'm-screen m-lant solid');
    this.el.dataset.salon = '';
    this.el.setAttribute('aria-label', "Salon de l'arène");
    this.cv = canvas(1, 1);
    this.cv.className = 'm-scene';
    this.layer = el('div', 'm-layer');
    this.el.append(this.cv, this.layer);
    root.append(this.el);
    this.visible = true;
    this.view = 'salon';            // salon | result
    this.lights = [0, 0, 0, 0];      // la flamme de chaque place (elle monte quand un ninja arrive)
    this.age = 0;
    this.ring = -1;
    addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.onQuit(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const items = [...this.el.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      e.preventDefault(); e.stopPropagation();
      items[(i + d + items.length) % items.length].focus();
    }, true);
    this.render();
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('m-in')));
    let last = 0;
    const step = (now) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!this.el.hidden) this.tick(dt);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  show() {
    this.visible = true; this.view = 'salon'; this.el.hidden = false; this.ring = -1;
    this.el.classList.remove('m-in', 'm-go');
    this.render();
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('m-in')));
  }

  /** Le salon s'efface (le combat commence derrière). */
  hide() {
    this.visible = false;
    this.el.classList.remove('m-in');
    clearTimeout(this.hideT);
    this.hideT = setTimeout(() => { if (!this.visible) this.el.hidden = true; }, 260);
  }

  setStatus(text) { this.status = text; this.render(); }
  setMode(id) { if (MODES[id]) { this.mode = id; this.render(); } }

  // ---- la scène ------------------------------------------------------------------------------------
  /** Taille de l'image, décor de nuit et couche fixe (sol, gong, perches, tablettes vides), refaits au besoin. */
  layout() {
    const W = this.root.offsetWidth || 448, H = this.root.offsetHeight || 252;
    const key = `${this.view}|${W}x${H}`;
    if (this.key === key) return false;
    this.key = key; this.W = W; this.H = H;
    this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d'); this.g.imageSmoothingEnabled = false;
    this.base = canvas(W, H);
    const p = new Pen(this.base.getContext('2d'));
    if (this.backdrop) { this.backdrop.resize(W, H); this.backdrop.draw(); p.g.drawImage(this.backdrop.el, 0, 0); }
    else { p.r(0, 0, W, H, '#0a0c10'); }
    if (this.view === 'result') {
      this.g0 = H - 62;
      ground(p, flat(this.g0));
      this.gong = gong(p, Math.round(W / 2), this.g0 - 84, H < 236 ? 22 : 28, this.g0);
      return true;
    }
    const g0 = this.g0 = H - 76;
    ground(p, flat(g0));
    this.gong = gong(p, W - 54, g0 - 48, 16, g0);
    // la corde et ses tablettes (le code s'y écrit à chaque image)
    const tw = 24, th = 32, gap = 30, cx = Math.round(W * 0.44), x0 = cx - Math.round((3 * gap) / 2), ry0 = 26;
    const ry = rope(p, x0 - 28, x0 + 3 * gap + 28, ry0, 6, g0);
    this.tabs = [0, 1, 2, 3].map((i) => {
      const x = x0 + i * gap, top = ry(x) + 7;
      p.r(x, ry(x) + 1, 1, top + Math.round(tw / 3) - 2 - ry(x), '#6a5d45');
      return { x, ...ema(p, x - tw / 2, top, tw, th) };
    });
    this.codeBox = { x: x0 - tw / 2, y: this.tabs[0].y, w: 3 * gap + tw, h: th };
    // les quatre places : une lanterne chacune
    this.seats = [0, 1, 2, 3].map((i) => {
      const cx2 = Math.round(W * 0.116 + i * W * 0.174);
      return { cx: cx2, lan: stoneLantern(p, cx2 - 10, g0, 1.2) };
    });
    return true;
  }

  tick(dt) {
    this.age += dt;
    this.layout();
    const g = this.g, t = this.age;
    g.clearRect(0, 0, this.W, this.H);
    g.drawImage(this.base, 0, 0);
    if (this.ring >= 0) { this.ring += dt; drawGongRing(g, this.gong, this.ring); }
    if (this.view === 'result') {
      const w = this.winner;
      if (w?.skin) this.art.draw(g, w.skin, Math.round(this.W / 2), this.g0, { k: 2, t, tint: 'rgba(10,14,30,0.15)', alpha: clamp01((t - 0.2) / 0.4) });
    } else {
      const { net } = this;
      this.seats.forEach((S, i) => {
        const p = net.roster.find((r) => r.slot === i);
        const tg = p ? 1 : 0;
        this.lights[i] += Math.sign(tg - this.lights[i]) * Math.min(Math.abs(tg - this.lights[i]), dt * 2);
        drawFlame(g, S.lan, this.lights[i], 0.8, t, i);
        if (p) this.art.draw(g, this.skinOf(p), S.cx + 11, this.g0, { t, alpha: clamp01((this.lights[i] - 0.5) * 2) });
      });
      this.tabs.forEach((T, i) => { if (net.code[i]) drawSign(g, T, net.code[i]); });
    }
    const f = document.activeElement;
    if (f && this.el.contains(f) && f.stroke && !f.disabled) {
      if (this.strokeFor !== f) { this.strokeFor = f; this.strokeAt = t; }
      const k = f.stroke;
      stroke(g, k.cx, k.y, k.len, smooth((t - this.strokeAt) / 0.22), k.col ?? INK, k.tail);
    } else this.strokeFor = null;
    const home = this.layer.querySelector('.m-home');
    if (home) homeIcon(g, parseFloat(home.style.left) + 2, 9, f === home ? INK : '#4a505b');
  }

  skinOf(p) {
    return p.id === this.net.id ? this.multi.skinId() : this.multi.remotes.get(p.id)?.skin ?? 'encre';
  }

  // ---- les textes et les boutons, posés au pixel -------------------------------------------------------
  put(e, t, x, y, align = 'left', font = 'small') {
    const w = measure(t, font);
    e.style.left = `${Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x)}px`;
    e.style.top = `${Math.round(y)}px`;
    e.pw = w;
    this.layer.append(e);
    return e;
  }

  text(t, x, y, cls, align = 'left', font = 'small') { return this.put(el('p', `m-txt ${cls ?? ''}`.trim(), t), t, x, y, align, font); }

  act(t, x, y, onClick, { align = 'left', cls = '', stroke: st = false, tag = 'button' } = {}) {
    const b = el(tag, `m-act ${cls}`.trim(), t);
    if (tag === 'button') {
      b.type = 'button';
      b.addEventListener('click', onClick);
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !b.disabled) b.focus({ preventScroll: true }); });
    }
    this.put(b, t, x, y, align);
    if (st) b.stroke = { cx: parseFloat(b.style.left) + b.pw / 2, y: Math.round(y) + 13, len: b.pw + 6, ...(st === true ? {} : st) };
    return b;
  }

  render() {
    if (this.view !== 'salon') return;
    const { net } = this, host = net.host, focused = document.activeElement?.dataset?.focusKey;
    this.layout();
    const { W, g0 } = this;
    this.layer.replaceChildren();
    this.text(this.arenaName ?? 'Arène', 16, 8, 'm-dim');
    const quit = this.act('Quitter', W - 16, 8, () => this.onQuit(), { align: 'right', cls: 'm-back' });
    quit.dataset.quit = ''; quit.dataset.focusKey = 'quit';
    // la petite maison : retour au menu principal
    const home = el('button', 'm-act m-home');
    home.type = 'button'; home.setAttribute('aria-label', 'Menu'); home.dataset.home = ''; home.dataset.focusKey = 'home';
    home.style.cssText = `left:${W - 16 - measure('Quitter') - 22}px;top:7px`;
    home.addEventListener('click', () => (this.onHome ?? this.onQuit)());
    this.layer.append(home);
    // le code : sur les tablettes (un clic le copie) ; le texte reste lisible dans la page
    const code = el('p', 'm-hidden', net.code);
    code.dataset.salonCode = '';
    this.layer.append(code);
    const copy = el('button', 'm-codein');
    copy.type = 'button';
    copy.setAttribute('aria-label', `Copier le code ${net.code}`);
    copy.dataset.focusKey = 'copy';
    const cb = this.codeBox;
    copy.style.cssText = `left:${cb.x}px;top:${cb.y}px;width:${cb.w}px;height:${cb.h}px`;
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(net.code).then(() => { this.copied = Date.now(); this.render(); }).catch(() => {});
    });
    this.layer.append(copy);
    if (this.copied && Date.now() - this.copied < 1500) {
      this.text('copié', cb.x + cb.w / 2, cb.y + cb.h + 4, 'm-soft', 'center');
      setTimeout(() => this.render(), 1600);
    }
    // les places : le nom sous chaque lanterne ; « hôte », « toi »
    for (let i = 0; i < 4; i++) {
      const p = net.roster.find((r) => r.slot === i), S = this.seats[i];
      if (!p) { this.text('·', S.cx, g0 + 6, 'm-faint', 'center'); continue; }
      const me = p.id === net.id;
      const n = this.text(p.name, S.cx, g0 + 6, 'm-ink', 'center');
      n.dataset.player = me ? 'me' : '';
      const tag = [p.slot === 0 ? 'hôte' : '', me ? 'toi' : ''].filter(Boolean).join(' · ');
      if (tag) this.text(tag, S.cx, g0 + 17, 'm-warm', 'center');
    }
    // les modes, sur une ligne ; la règle du mode choisi, dessous, une seule fois
    const xs = [0.26, 0.46, 0.62];
    Object.entries(MODES).forEach(([id, m], i) => {
      const b = this.act('', Math.round(W * xs[i]), g0 + 36, () => { this.mode = id; net.send({ t: 'mode', mode: id }); this.render(); },
        { align: 'center', cls: `m-mode${id === this.mode ? ' m-on' : ''}`, stroke: host, tag: host ? 'button' : 'div' });
      b.dataset.mode = id;
      if (host) b.dataset.focusKey = `mode-${id}`;
      b.textContent = '';
      b.append(el('p', null, m.name));
      const w = measure(m.name);
      b.style.left = `${Math.round(W * xs[i] - w / 2)}px`;
      if (host) b.stroke = { cx: Math.round(W * xs[i]), y: g0 + 49, len: w + 6 };
    });
    const rule = this.text(MODES[this.mode].text, 16, g0 + 58, 'm-soft');
    rule.dataset.modeRule = '';
    if (this.status) {
      const msg = this.text(this.status, cb.x + cb.w / 2, cb.y + cb.h + 4, 'm-warm', 'center');
      msg.dataset.salonMsg = '';
    }
    if (host) {
      const go = this.act('Frapper le gong', W - 54, g0 + 36, () => this.launch(), { align: 'center', cls: 'm-gong', stroke: { col: '#e8b25a', tail: '#a8803c' } });
      go.dataset.launch = ''; go.dataset.focusKey = 'launch';
      go.disabled = net.roster.length < 2;
      if (go.disabled) go.title = 'Il faut au moins deux joueurs';
    }
    // garder le focus au même endroit après un nouveau rendu
    const keep = focused && this.layer.querySelector(`[data-focus-key="${focused}"]`);
    if (keep && !keep.disabled) keep.focus({ preventScroll: true });
    else if (this.visible && !this.el.contains(document.activeElement)) {
      setTimeout(() => (this.layer.querySelector('[data-launch]:not(:disabled)') ?? this.layer.querySelector('[data-mode].m-on') ?? quit)?.focus({ preventScroll: true }), 20);
    }
  }

  /** L'hôte frappe le gong : il vibre, puis le combat commence. */
  launch() {
    if (this.ring >= 0 && this.ring < 0.4) return;
    this.ring = 0;
    setTimeout(() => this.onLaunch(this.mode), 300);
  }

  /** Fin d'un combat : le vainqueur devant le gong et les points, puis retour au salon. */
  result(winnerName, lines) {
    this.visible = true;
    this.view = 'result';
    this.el.hidden = false;
    this.el.classList.remove('m-in');
    this.age = 0; this.ring = 0;
    const p = this.net.roster.find((r) => r.name === winnerName);
    this.winner = winnerName ? { name: winnerName, skin: p ? this.skinOf(p) : 'encre' } : null;
    this.layout();
    this.layer.replaceChildren();
    const { W, g0 } = this;
    this.text(MODES[this.mode]?.name ?? '', 16, 8, 'm-dim');
    const w = this.text(winnerName ?? 'Égalité', W / 2, g0 + 6, 'm-ink m-big', 'center', 'big');
    w.dataset.winner = winnerName ?? '';
    this.text(lines.join(' · '), W / 2, g0 + 32, 'm-soft', 'center');
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('m-in')));
  }
}
