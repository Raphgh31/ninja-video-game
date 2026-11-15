// Le menu de l'écran titre (sur l'intro) : trois choix sur une ligne — Aventure,
// Arène, Mon ninja — puis des écrans pleins, empilés : on y entre, « Retour » (ou
// Échap) remonte d'un cran. Chaque écran est décrit une fois (build…), la
// navigation est commune : souris, doigt, et clavier (flèches, Entrée, Échap).
//
//   Aventure  : deux emplacements ; « Continuer l'aventure », « Nouvelle aventure »
//               (un emplacement libre), « Effacer » (confirmé) ;
//   Arène     : « Créer une arène » (on arrive en hôte dans le salon) ou « Rejoindre » ;
//   Rejoindre : le code de quatre signes, une case par signe ;
//   Mon ninja : le profil (pseudo, aventure affichée et sa progression ; l'arène, plus tard).
import { loadImage } from '../engine/sprites.js';
import { cleanCode } from '../engine/net.js';
import { cleanName } from './profile.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (text, cls, onClick) => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};

export class Menu {
  /**
   * title : la section .title-screen. deps : { meta, skins, profile, saveProfile(p), saves(),
   * chapterOf(save) → { chapter, zone }, continueAdventure(slot), newAdventure(slot),
   * eraseAdventure(slot), createArena(), joinArena(code), setBackdrop(on), message }
   */
  constructor(title, deps) {
    Object.assign(this, deps);
    this.title = title;
    this.main = title.querySelector('.title-screen__actions');
    this.stack = [];
    this.timers = [];
    for (const b of this.main.querySelectorAll('[data-menu]')) b.addEventListener('click', () => this.open(b.dataset.menu));
    addEventListener('keydown', (e) => this.key(e), true);
    this.thumbs = {};
    for (const k of ['creer', 'rejoindre']) loadImage(`./menus/vignette_${k}.png`).then((im) => { this.thumbs[k] = im; }).catch(() => {});
  }

  get current() { return this.stack[this.stack.length - 1] ?? null; }

  /** Ouvre un écran (aventure, arene, rejoindre, ninja) par-dessus les autres. */
  open(name, opts = {}) {
    const screen = this[`build_${name}`](opts);
    screen.dataset.screen = name;
    screen.opts = opts;
    this.title.append(screen);
    this.stack.forEach((s) => { s.hidden = true; });
    this.stack.push(screen);
    this.title.classList.add('menu-open');
    this.setBackdrop?.(true);
    this.focusFirst(screen);
    return screen;
  }

  /** Remonte d'un écran (jusqu'au menu principal) ; l'écran retrouvé est reconstruit (à jour). */
  back() {
    const s = this.stack.pop();
    if (!s) return;
    s.remove();
    this.clearTimers();
    const prev = this.stack.pop();
    if (prev) { prev.remove(); this.open(prev.dataset.screen, prev.opts ?? {}); return; }
    this.title.classList.remove('menu-open');
    this.setBackdrop?.(false);
    this.main.querySelector(`[data-menu="${s.dataset.screen}"]`)?.focus();
  }

  closeAll() { while (this.stack.length) { this.stack.pop().remove(); } this.clearTimers(); this.title.classList.remove('menu-open'); this.setBackdrop?.(false); }

  clearTimers() { for (const t of this.timers) clearInterval(t); this.timers = []; }

  focusFirst(screen) {
    setTimeout(() => (screen.querySelector('[data-first]') ?? screen.querySelector('button:not(:disabled), input'))?.focus(), 30);
  }

  /** Clavier : Échap remonte ; les flèches passent d'un bouton à l'autre (dans l'ordre de la page). */
  key(e) {
    if (this.title.hidden) return;
    const scr = this.current;
    const inField = document.activeElement?.tagName === 'INPUT';
    if (e.key === 'Escape' && scr) { e.preventDefault(); e.stopPropagation(); this.back(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    if (inField && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    const root = scr ?? this.main;
    const items = [...root.querySelectorAll('button:not(:disabled), input')].filter((b) => b.offsetParent !== null || b.tagName === 'INPUT');
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    e.preventDefault(); e.stopPropagation();
    items[(i + d + items.length) % items.length].focus();
  }

  // ---- éléments communs ---------------------------------------------------------------------
  frame(title, sub, help) {
    const s = el('section', 'm-screen');
    s.append(el('div', 'm-veil'));
    const hd = el('header', 'm-hd');
    hd.append(el('h2', null, title));
    if (sub) hd.append(el('p', 'm-sub', sub));
    const body = el('div', 'm-body');
    const ft = el('footer', 'm-ft');
    ft.append(button('← Retour', 'm-link', () => this.back()), el('p', null, help ?? ''));
    s.append(hd, body, ft);
    s.body = body;
    s.help = ft.lastChild;
    return s;
  }

  /** Le ninja (image de repos, animée) dans un canevas, au skin donné. */
  ninja(skinId, k = 1, crop = false) {
    const cv = el('canvas', 'm-ninja');
    const sk = this.skins[skinId] ?? this.skins.encre, anim = this.meta.animations.idle;
    const f0 = anim.frames[0];
    cv.width = crop ? 22 : f0.w * k; cv.height = crop ? 22 : f0.h * k;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    let i = 0;
    const paint = () => {
      const f = anim.frames[i % anim.frames.length];
      g.clearRect(0, 0, cv.width, cv.height);
      if (crop) g.drawImage(sk.sheet, f.x + 7, f.y + 3, 22, 22, 0, 0, 22, 22);
      else g.drawImage(sk.sheet, f.x, f.y, f.w, f.h, 0, 0, f.w * k, f.h * k);
      i++;
    };
    paint();
    if (!crop) this.timers.push(setInterval(paint, 180));
    return cv;
  }

  /** Champ de saisie en pixels : un vrai champ (invisible) et son texte dessiné. */
  field(value, { maxLength = 10, clean = (v) => v, onInput, placeholder = '' } = {}) {
    const wrap = el('label', 'm-field');
    const view = el('p', 'm-ink');
    const input = el('input');
    input.maxLength = maxLength; input.autocomplete = 'off'; input.spellcheck = false; input.value = value;
    const mirror = () => {
      input.value = clean(input.value);
      view.textContent = (input.value || placeholder) + (document.activeElement === input ? '_' : '');
      onInput?.(input.value);
    };
    for (const t of ['input', 'focus', 'blur']) input.addEventListener(t, mirror);
    input.addEventListener('keydown', (e) => { if (e.key !== 'Escape' && e.key !== 'Enter') e.stopPropagation(); });
    wrap.append(view, input);
    mirror();
    wrap.input = input;
    return wrap;
  }

  // ---- Aventure : deux emplacements -----------------------------------------------------------
  build_aventure() {
    const s = this.frame('Aventure', 'Deux aventures au plus', 'Entrée : choisir');
    const cards = el('div', 'm-cards');
    const big = !document.querySelector('.ui.short');
    for (const { slot, save } of this.saves()) {
      const card = el('div', `m-card${save ? '' : ' m-empty'}${save && slot === this.profile.shown ? ' m-on' : ''}`);
      const top = el('div', 'm-row');
      top.append(el('p', 'm-lbl', `Aventure ${slot}`));
      if (save && slot === this.profile.shown) top.append(el('p', 'm-warm', 'sur ton profil'));
      card.append(top);
      if (save) {
        const info = this.chapterOf(save);
        card.append(this.ninja(save.skin ?? 'encre', big ? 2 : 1));
        card.append(el('p', 'm-ink', info.chapter), el('p', 'm-muted', info.zone),
          el('p', 'm-muted', `${save.ryo ?? 0} ryō · ${(save.skins ?? ['encre']).length} skins${info.boss ? ' · corbeau vaincu' : ''}`));
        const row = el('div', 'm-row m-push');
        const go = button("Continuer l'aventure", null, () => this.continueAdventure(slot));
        go.dataset.continue = '';
        if (slot === this.profile.shown) go.dataset.first = '';
        row.append(go, button('Effacer', 'm-link', () => this.open('effacer', { slot })));
        card.append(row);
      } else {
        const mid = el('div', 'm-center m-push');
        mid.style.gap = '6px';
        const nb = button('Nouvelle aventure', null, () => this.newAdventure(slot));
        if (!this.saves().some((x) => x.save)) nb.dataset.first = '';
        nb.dataset.new = '';
        mid.append(el('p', 'm-dim', 'Emplacement libre'), nb);
        mid.append(el('p', 'm-muted', this.saves().some((x) => x.save) ? 'Tout reprend de zéro. Ton autre aventure est gardée.' : "Le début de l'aventure, au Potager."));
        mid.lastChild.style.setProperty('--pxw', '170');
        card.append(mid, el('div', 'm-push'));
      }
      cards.append(card);
    }
    s.body.append(cards);
    return s;
  }

  /** Effacer une aventure : une confirmation. */
  build_effacer({ slot } = {}) {
    const s = this.frame('Effacer', `Aventure ${slot}`, '');
    const box = el('div', 'm-center');
    box.style.cssText = 'gap:8px;padding-top:24px';
    box.append(el('p', 'm-big', `Effacer l'aventure ${slot} ?`), el('p', 'm-muted', 'Sa progression, ses ryō et ses skins seront perdus.'));
    const row = el('div', 'm-row');
    row.style.gap = '12px';
    const no = button('Garder', null, () => this.back());
    no.dataset.first = '';
    const yes = button('Effacer', 'm-gold-btn', () => { this.eraseAdventure(slot); this.back(); });
    yes.dataset.erase = '';
    row.append(no, yes);
    box.append(row);
    s.body.append(box);
    return s;
  }

  // ---- Arène : créer ou rejoindre --------------------------------------------------------------
  build_arene() {
    const s = this.frame('Arène', 'La rizière du gong', `Ton pseudo : ${this.profile.name}`);
    const cards = el('div', 'm-cards');
    const make = (thumb, title, text, label, cls, onClick, attr) => {
      const c = el('div', 'm-card');
      const t = el('div', 'm-thumb');
      const im = this.thumbs[thumb];
      if (im) t.style.backgroundImage = `url(${im.src})`;
      const b = button(label, cls, onClick);
      b.dataset[attr] = '';
      const row = el('div', 'm-row m-push');
      row.append(b);
      c.append(t, el('p', 'm-big', title), el('p', 'm-muted', text), row);
      c.querySelectorAll('.m-muted').forEach((p) => p.style.setProperty('--pxw', '170'));
      return [c, b];
    };
    const [c1, b1] = make('creer', 'Créer une arène', "Tu es l'hôte : tu reçois un code à donner à tes amis et tu choisis le mode.", 'Créer', 'm-gold-btn', () => this.createArena(), 'create');
    b1.dataset.first = '';
    const [c2] = make('rejoindre', 'Rejoindre une arène', "Tape le code de quatre signes que l'hôte t'a donné.", 'Rejoindre', null, () => this.open('rejoindre'), 'joinScreen');
    cards.append(c1, c2);
    s.body.append(cards);
    return s;
  }

  // ---- Rejoindre une arène : le code ----------------------------------------------------------
  build_rejoindre({ code = '', message = '' } = {}) {
    const s = this.frame('Rejoindre une arène', `Ton pseudo : ${this.profile.name}`, 'Entrée : rejoindre');
    const box = el('div', 'm-center');
    box.style.gap = '6px';
    box.append(el('p', 'm-lbl', "Code de l'arène"));
    const boxes = el('label', 'm-code');
    const cells = [0, 1, 2, 3].map(() => { const c = el('div', 'm-box'); c.append(el('p')); boxes.append(c); return c; });
    const input = el('input');
    input.maxLength = 9; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'characters');
    input.setAttribute('aria-label', "Code de l'arène");
    input.dataset.code = '';
    input.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;font-size:16px';
    boxes.append(input);
    const msg = el('p', 'm-warm', message);
    msg.dataset.multiMsg = '';
    const paint = () => {
      input.value = cleanCode(input.value);
      cells.forEach((c, i) => {
        c.firstChild.textContent = input.value[i] ?? (i === input.value.length && document.activeElement === input ? '_' : '');
        c.classList.toggle('m-cur', i === Math.min(3, input.value.length));
      });
    };
    for (const t of ['input', 'focus', 'blur']) input.addEventListener(t, () => { paint(); if (t === 'input') msg.textContent = ''; });
    boxes.addEventListener('click', () => input.focus());
    input.value = code;
    const join = () => {
      const c = cleanCode(input.value);
      if (c.length !== 4) { msg.textContent = 'Le code a quatre signes (par exemple 7F3Q)'; input.focus(); return; }
      this.joinArena(c);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); join(); } else if (e.key !== 'Escape') e.stopPropagation(); });
    const go = button('Rejoindre', 'm-gold-btn', join);
    go.dataset.join = '';
    box.append(boxes, el('p', 'm-muted', 'Quatre signes : lettres et chiffres'), go, msg);
    s.body.append(box);
    input.dataset.first = '';
    paint();
    return s;
  }

  // ---- Mon ninja : le profil -----------------------------------------------------------------
  build_ninja() {
    const s = this.frame('Mon ninja', 'Ton profil', 'Le pseudo sert en arène');
    const grid = el('div', 'm-cards');
    grid.style.gridTemplateColumns = '150px minmax(0, 1fr)';
    const saves = this.saves();
    const shown = saves.find((x) => x.slot === this.profile.shown && x.save) ?? saves.find((x) => x.save) ?? null;
    const left = el('div', 'm-card');
    const skin = shown?.save.skin ?? 'encre';
    left.append(this.ninja(skin, document.querySelector('.ui.short') ? 1 : 2));
    const sn = el('p', 'm-muted', this.skins[skin]?.name ?? 'Encre');
    sn.style.alignSelf = 'center';
    left.append(sn, el('p', 'm-lbl', 'Pseudo'));
    const f = this.field(this.profile.name, { clean: cleanName, onInput: (v) => { const n = v.trim(); if (n) { this.profile.name = n; this.saveProfile(this.profile); } } });
    f.input.dataset.pseudo = '';
    f.input.dataset.first = '';
    left.append(f, el('p', 'm-dim', "C'est ton nom en arène."));
    const right = el('div');
    right.style.cssText = 'display:grid;align-content:start;gap:3px';
    const head = el('div', 'm-row');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
    head.append(el('p', 'm-lbl', 'Aventure affichée'));
    const arrows = el('div', 'm-arrows');
    const others = saves.filter((x) => x.save);
    const flip = (d) => {
      if (others.length < 2) return;
      this.profile.shown = this.profile.shown === 1 ? 2 : 1;
      this.saveProfile(this.profile);
      this.clearTimers();
      const scr = this.build_ninja();
      scr.dataset.screen = 'ninja';
      s.replaceWith(scr);
      this.stack[this.stack.length - 1] = scr;
      scr.querySelector(d < 0 ? '[data-prev]' : '[data-next]')?.focus();
    };
    const prev = button('←', 'm-link', () => flip(-1)), next = button('→', 'm-link', () => flip(1));
    prev.dataset.prev = ''; next.dataset.next = '';
    prev.disabled = next.disabled = others.length < 2;
    arrows.append(prev, el('p', 'm-ink', shown ? `Aventure ${shown.slot}` : 'Aucune'), next);
    head.append(arrows);
    right.append(head);
    const stats = el('div', 'm-stats');
    const row = (a, b) => { const r = el('div', 'm-row'); r.append(el('p', null, a), el('p', 'm-ink', b)); stats.append(r); };
    if (shown) {
      const info = this.chapterOf(shown.save);
      row('Chapitre', info.chapterShort);
      row('Zone', info.zoneShort);
      row('Ryō', String(shown.save.ryo ?? 0));
      row('Skins', `${(shown.save.skins ?? ['encre']).length} sur ${Object.keys(this.skins).length}`);
      row('Corbeau du Potager', info.boss ? 'vaincu' : 'pas encore');
    } else {
      stats.append(el('p', 'm-dim', "Pas encore d'aventure : Aventure, puis Nouvelle aventure."));
    }
    right.append(stats, el('p', 'm-lbl', 'Arène'));
    right.lastChild.style.marginTop = '6px';
    const later = el('p', 'm-dim', 'Bientôt : combats, victoires, éliminations, titres.');
    later.style.setProperty('--pxw', '220');
    right.append(later);
    grid.append(left, right);
    s.body.append(grid);
    return s;
  }
}
