// Le menu de l'écran titre (sur l'intro) : trois choix sur une ligne — Aventure, Arène, Mon ninja —
// puis des écrans pleins, dans le style « Les lanternes » (planche docs/menus/planche_lanternes.png,
// dessin src/game/menuart.js) : chaque écran est un petit monde dans la nuit de l'intro, des objets
// du monde à la place des boutons, et la lumière qui montre ce qui compte.
//
//   Aventure  : sept lanternes, une par chapitre, reliées par un sentier ; allumées jusqu'au chapitre
//               en cours, où se tient le ninja. En haut, « Aventure 1 · Aventure 2 ». « Reprendre »,
//               « Effacer » (les flammes baissent : « Éteindre l'aventure ? »), « Nouvelle aventure » ;
//   Arène     : le gong ; « Accueillir » (l'arène se choisit dessous : ← nom →) ou « Rejoindre » ; seul :
//               « Contre l'ombre » (le ninja de l'ordinateur) ou « Dojo » (s'entraîner à parer) ;
//   Rejoindre : le code de quatre signes s'écrit sur quatre tablettes de bois ;
//   Mon ninja : le ninja en grand sur un rocher, son pseudo sur un panneau de bois, sa route.
//
// Les textes et les boutons sont de vrais éléments de la page (clavier, lecteurs d'écran, tests),
// posés au pixel sur la scène peinte. Transitions : les écrans entrent et sortent en fondu, les
// lanternes s'allument l'une après l'autre, le coup de pinceau se tire sous le choix.
import { cleanCode } from '../engine/net.js';
import { BrushedCanvas, brushView, smoothText } from '../engine/brushgl.js';
import { measure, renderText, renderSmooth } from '../engine/pixelfont.js';
import { play } from '../engine/sfx.js';
import { cleanName } from './profile.js';
import { ArenaStats, TITLES, drawSeal } from './arena/stats.js';
import { canvas, noise1 } from './potager/paint.js';
import {
  Pen, INK, flat, ground, stoneLantern, drawFlame, gong, drawGongRing, arenaFront, ema, drawSign,
  rope, signpost, stroke, NinjaArt, smooth, clamp01,
} from './menuart.js';

const SOFT = '#8d8a80';
const FADE = 220;                 // sortie d'un écran (ms)
export const LANTERNS = 7;        // sept chapitres prévus (docs/MONDE.md)

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const sfx = (n) => { try { play(n); } catch { /* le son n'est pas indispensable */ } };

/** La petite maison (9 × 9 pixels) : bouton du retour au menu principal. */
const HOUSE = ['....#....', '...#.#...', '..#...#..', '.#.....#.', '#########', '.#.....#.', '.#..#..#.', '.#..#..#.', '.#######.'];
export function homeIcon(g, x, y, col) {
  g.fillStyle = col;
  HOUSE.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(x + i, y + j, 1, 1); });
}

export class Menu {
  /**
   * title : la section .title-screen. deps : { meta, skins, profile, saveProfile(p), saves(),
   * chapterOf(save) → { num, name, zoneNum, zones, … }, chapters : { n → nom }, continueAdventure(slot),
   * newAdventure(slot), eraseAdventure(slot), createArena(id), joinArena(code), setBackdrop(on),
   * arenas : [{ id, name, theme }] (les arènes, une par chapitre) }
   */
  constructor(title, deps) {
    Object.assign(this, deps);
    this.title = title;
    this.ui = title.closest('.ui') ?? title.parentElement;
    this.main = title.querySelector('.title-screen__actions');
    this.stack = [];
    this.art = new NinjaArt(this.meta, this.skins);
    this.raf = 0;
    for (const b of this.main.querySelectorAll('[data-menu]')) b.addEventListener('click', () => this.open(b.dataset.menu));
    addEventListener('keydown', (e) => this.key(e), true);
  }

  get current() { return this.stack[this.stack.length - 1] ?? null; }

  /** Ouvre un écran (aventure, arene, rejoindre, ninja) par-dessus les autres, en fondu. */
  open(name, opts = {}) {
    const prev = this.current;
    if (prev) this.fadeOut(prev, false);
    const screen = this.build(name, opts);
    this.stack.push(screen);
    this.title.classList.add('menu-open');
    this.setBackdrop?.(true);
    this.focusFirst(screen);
    this.run();
    return screen;
  }

  /** Remonte d'un écran (jusqu'au menu principal) ; l'écran retrouvé est reconstruit (à jour). */
  back() {
    const s = this.stack.pop();
    if (!s) return;
    this.fadeOut(s, true);
    const prev = this.stack.pop();
    if (prev) { prev.remove(); this.stack.push(this.build(prev.dataset.screen, prev.opts ?? {})); this.focusFirst(this.current); return; }
    this.title.classList.remove('menu-open');
    this.setBackdrop?.(false);
    this.main.querySelector(`[data-menu="${s.dataset.screen}"]`)?.focus();
  }

  /** Tout ferme d'un coup (la partie commence : elle a son propre fondu). */
  closeAll() {
    while (this.stack.length) this.stack.pop().remove();
    this.title.classList.remove('menu-open');
    this.setBackdrop?.(false);
  }

  fadeOut(s, remove) {
    s.classList.remove('m-in');
    s.classList.add('m-out');
    s.leaving = true;
    setTimeout(() => { if (remove || !this.stack.includes(s)) s.remove(); else s.hidden = true; }, FADE);
  }

  focusFirst(screen) {
    setTimeout(() => (screen.querySelector('[data-first]:not(:disabled)') ?? screen.querySelector('button:not(:disabled), input'))?.focus({ preventScroll: true }), 30);
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

  // ---- la boucle d'images des scènes -------------------------------------------------------------
  run() {
    if (this.raf) return;
    let last = 0;
    const step = (now) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      for (const s of this.title.querySelectorAll('.m-lant')) {
        if (s.hidden) continue;
        // l'image a changé de taille (téléphone tourné…) : l'écran est refait à la nouvelle taille
        if (!s.leaving && (s.W !== this.ui.offsetWidth || s.H !== this.ui.offsetHeight) && this.stack.includes(s)) {
          const i = this.stack.indexOf(s), fresh = this.build(s.dataset.screen, s.opts ?? {}, true);
          s.remove(); this.stack[i] = fresh; this.focusFirst(fresh);
          continue;
        }
        s.tick(dt);
      }
      if (!this.title.querySelector('.m-lant')) { this.raf = 0; return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Construit un écran et le pose (il entre en fondu, sauf quand il remplace le même à une autre taille). */
  build(name, opts = {}, instant = false) {
    const s = this[`build_${name}`](opts);
    s.dataset.screen = name;
    s.opts = opts;
    const bk = s.querySelector('.m-back');
    if (bk) s.append(bk);               // « ← » en dernier : les flèches du clavier y arrivent après les choix
    this.title.append(s);
    if (instant) s.classList.add('m-in', 'm-now');
    else requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('m-in')));
    return s;
  }

  // ---- éléments communs --------------------------------------------------------------------------
  /**
   * Un écran-scène : la toile (la scène peinte, à la taille de l'image de jeu), la couche « base »
   * (ce qui ne bouge pas), le titre en haut à gauche, « ← » en haut à droite. s.paint(g, t, dt) peint
   * ce qui vit, par-dessus la base ; s.age : secondes depuis l'ouverture.
   */
  scene(title) {
    const W = this.ui.offsetWidth || 448, H = this.ui.offsetHeight || 252;
    const s = el('section', 'm-screen m-lant');
    s.W = W; s.H = H;
    // style peint : la scène se dessine en pixels sur une toile à part, le pinceau la repeint à chaque image
    const bc = brushView.on ? new BrushedCanvas('m-scene') : null;
    if (bc) bc.size(W, H);
    const cv = bc ? bc.el : canvas(W, H);
    cv.className = 'm-scene';
    s.append(cv);
    s.g = bc ? bc.g : cv.getContext('2d');
    s.tg = bc ? bc.tg : null;          // (style peint : les textes lisses, posés après le pinceau)
    s.g.imageSmoothingEnabled = false;
    s.base = canvas(W, H);
    s.pen = new Pen(s.base.getContext('2d'));
    s.age = 0;
    s.strokes = new Map();        // bouton → instant où il a reçu le focus (le trait se tire)
    s.paint = () => {};
    if (title) this.text(s, title, 16, 8, { cls: 'm-ttl' });
    const back = this.act(s, '←', W - 16, 8, () => this.back(), { align: 'right', cls: 'm-back' });
    back.setAttribute('aria-label', 'Retour');
    // la petite maison : retour direct au menu principal (Aventure · Arène · Mon ninja), d'où qu'on soit
    const home = el('button', 'm-act m-home');
    home.type = 'button';
    home.setAttribute('aria-label', 'Menu');
    home.dataset.home = '';
    home.style.cssText = `left:${W - 44}px;top:7px`;
    home.addEventListener('click', () => this.home());
    home.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') home.focus({ preventScroll: true }); });
    s.append(home);
    s.tick = (dt) => {
      s.age += dt;
      const g = s.g;
      g.clearRect(0, 0, W, H);
      const night = this.backdrop?.();
      if (night) g.drawImage(night, 0, 0);
      g.drawImage(s.base, 0, 0);
      s.paint(g, s.age, dt);
      // le coup de pinceau sous le choix (le bouton qui a le focus et qui en porte un)
      const f = document.activeElement;
      if (f && s.contains(f) && f.stroke && !f.disabled) {
        if (!s.strokes.has(f)) s.strokes.set(f, s.age);
        const k = f.stroke, u = smooth((s.age - s.strokes.get(f)) / 0.22);
        stroke(g, k.cx, k.y, k.len, u, k.col ?? INK, k.tail);
      }
      for (const b of s.strokes.keys()) if (b !== f) s.strokes.delete(b);
      homeIcon(g, W - 41, 9, f === home ? INK : '#4a505b');
      if (bc) bc.present({ wide: 'mid', detail: 0.22 });   // (des touches moyennes : le sentier, les lanternes se reconnaissent)
    };
    return s;
  }

  /** Retour au menu principal, d'où qu'on soit : tous les écrans s'effacent, la lune revient. */
  home() {
    while (this.stack.length) this.fadeOut(this.stack.pop(), true);
    this.title.classList.remove('menu-open');
    this.setBackdrop?.(false);
    setTimeout(() => this.main.querySelector('[data-menu]')?.focus({ preventScroll: true }), 260);
  }

  /** Un texte posé au pixel : x selon align (left | center | right), y = haut de la ligne. */
  text(s, t, x, y, { align = 'left', font = 'small', cls = '', tag = 'p' } = {}) {
    const e = el(tag, `m-txt ${cls}`.trim(), t);
    this.placeText(e, t, x, y, align, font);
    s.append(e);
    return e;
  }

  placeText(e, t, x, y, align = 'left', font = 'small') {
    const w = measure(t, font);
    e.style.left = `${Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x)}px`;
    e.style.top = `${Math.round(y)}px`;
    e.pw = w;
  }

  /**
   * Un choix : un vrai bouton, son texte posé comme text(). opts.stroke : le trait de pinceau sous lui
   * quand il a le focus (true, ou { col, tail }). La souris qui le survole lui donne le focus.
   */
  act(s, t, x, y, onClick, { align = 'left', cls = '', stroke: st = false, font = 'small' } = {}) {
    const b = el('button', `m-act ${cls}`.trim(), t);
    b.type = 'button';
    b.addEventListener('click', onClick);
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !b.disabled) b.focus({ preventScroll: true }); });
    this.placeText(b, t, x, y, align, font);
    if (st) {
      const left = parseFloat(b.style.left), w = b.pw;
      b.stroke = { cx: left + w / 2, y: Math.round(y) + 13, len: w + 6, ...(st === true ? {} : st) };
    }
    s.append(b);
    return b;
  }

  /** Change le texte d'un élément posé, en fondu court (l'ancien s'efface, le nouveau apparaît). */
  swap(e, t, x, y, align = 'left', font = 'small') {
    if (e.textContent === t && e.dataset.x === `${x}`) return;
    e.classList.add('m-hide');
    clearTimeout(e.swapT);
    e.swapT = setTimeout(() => {
      e.textContent = t;
      e.dataset.x = `${x}`;
      this.placeText(e, t, x, y, align, font);
      e.classList.remove('m-hide');
    }, 130);
  }

  // =================================================================================================
  // Aventure : sept lanternes, une par chapitre, le long d'un sentier qu'on parcourt
  // =================================================================================================
  // Les lanternes sont espacées : l'image n'en montre que deux ou trois, jamais la fin du chemin. La
  // caméra glisse le long du sentier jusqu'à la lanterne regardée (à l'ouverture, elle part de la
  // première et suit les flammes qui s'allument jusqu'au chapitre en cours).
  build_aventure() {
    const s = this.scene(null);
    const { W, H } = s;
    const saves = this.saves();
    const has = (n) => !!saves.find((x) => x.slot === n)?.save;
    let sel = has(this.profile.shown) ? this.profile.shown : saves.find((x) => x.save)?.slot ?? 1;

    const g0 = H - 56, SP = Math.round(W * 0.42), AT = Math.round(W * 0.3);   // écart des lanternes ; place de la lanterne regardée
    const LX = Array.from({ length: LANTERNS }, (_, i) => AT + i * SP);
    const rise = [0, 5, 9, 14, 18, 23, 30];
    const LY = rise.map((r) => g0 - r);
    const WW = LX[LANTERNS - 1] + W;
    const top = (x) => {
      let i = 0;
      while (i < LX.length - 2 && x > LX[i + 1]) i++;
      const t = clamp01((x - LX[i]) / (LX[i + 1] - LX[i])), e = (1 - Math.cos(t * Math.PI)) / 2;
      let y = LY[i] + (LY[i + 1] - LY[i]) * e;
      if (x < LX[0]) y = LY[0] + (LX[0] - x) * 0.03;
      if (x > LX[6]) y = LY[6] + (x - LX[6]) * 0.08;
      return y + Math.round(noise1(x / 9, 21) * 1.4 + noise1(x / 41, 22) * 2);
    };
    // le monde (plus large que l'image) : peint une fois
    s.world = canvas(WW, H);
    const wp = new Pen(s.world.getContext('2d'));
    ground(wp, top);
    const stones = [];
    for (let x = 12; x < WW - 12; x += 7) {
      if (LX.some((l) => Math.abs(x - l) < 14)) continue;
      const y = Math.round(top(x)), w = 3 + ((x * 7) % 2);
      wp.r(x, y, w, 1, '#283041'); wp.r(x, y + 1, w, 1, '#161b25');
      stones.push({ x, y, w, seg: LX.findIndex((l) => l > x) });
    }
    const lamps = LX.map((x, i) => ({ lan: stoneLantern(wp, x, Math.round(top(x)) + 1, i === 6 ? 2.3 : 1.9), v: 0, target: 0, wait: 0, power: 0.55, pTarget: 0.55 }));
    // les numéros, peints sous chaque lanterne (ils glissent avec le sentier)
    const numCv = new Map();
    const numOf = (n, col) => {
      const k = `${n}|${col}`;
      if (!numCv.has(k)) numCv.set(k, renderText(String(n), { color: col }));
      return numCv.get(k);
    };

    let cam = 0, camTo = 0;
    const camFor = (n) => Math.max(0, LX[Math.max(0, n - 1)] - AT);
    // un bouton (invisible) sur chaque lanterne allumée : la regarder montre son chapitre
    const lampBtns = LX.map((x, i) => {
      const b = el('button', 'm-lamp');
      b.type = 'button';
      b.dataset.lantern = String(i + 1);
      const L = lamps[i].lan;
      b.style.top = `${L.top - 2}px`; b.style.width = '28px'; b.style.height = `${L.by - L.top + 16}px`;
      b.addEventListener('focus', () => { focusN = i + 1; camTo = camFor(i + 1); showInfo(); });
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !b.hidden) b.focus({ preventScroll: true }); });
      b.addEventListener('click', () => s.querySelector('[data-continue]')?.focus());
      s.append(b);
      return b;
    });

    const tab1 = this.act(s, 'Aventure 1', 16, 8, () => pickSlot(1), { cls: 'm-tab' });
    const tab2 = this.act(s, 'Aventure 2', 16 + measure('Aventure 1') + 14, 8, () => pickSlot(2), { cls: 'm-tab' });
    tab1.dataset.slot = '1'; tab2.dataset.slot = '2';

    // le chapitre regardé, sous sa lanterne ; les choix à droite
    const l1 = this.text(s, '', AT, g0 + 22, { cls: 'm-ink' });
    const l2 = this.text(s, '', AT, g0 + 34, { cls: 'm-soft' });
    let acts = [];
    let state = 'view';
    let focusN = 0;

    const info = () => {
      const sv = saves.find((x) => x.slot === sel)?.save ?? null;
      return sv ? { sv, ...this.chapterOf(sv) } : null;
    };
    const showInfo = () => {
      const a = info();
      if (!a) { this.swap(l1, '', AT, g0 + 22, 'center'); this.swap(l2, '', AT, g0 + 34, 'center'); return; }
      if (state === 'confirm') {
        this.swap(l1, `Éteindre l'aventure ${sel} ?`, AT, g0 + 22, 'center');
        this.swap(l2, '', AT, g0 + 34, 'center');
        return;
      }
      const n = focusN || a.num;
      const name = n === a.num ? a.name : this.chapters?.[n] ?? '';
      this.swap(l1, `Chapitre ${n} — ${name}`, AT, g0 + 22, 'center');
      this.swap(l2, n === a.num ? `zone ${a.zoneNum} sur ${a.zones} · ${a.sv.ryo ?? 0} ryō` : 'terminé', AT, g0 + 34, 'center');
    };

    const setActs = () => {
      for (const b of acts) b.remove();
      acts = [];
      const a = info(), x1 = Math.round(W * 0.68), x2 = x1 + 70, ay = g0 + 26;
      if (!a) {
        const b = this.act(s, 'Nouvelle aventure', AT, ay, () => begin(), { align: 'center', stroke: true, cls: 'm-main' });
        b.dataset.new = ''; b.dataset.first = '';
        acts.push(b);
      } else if (state === 'confirm') {
        const keep = this.act(s, 'Garder', x1, ay, () => { state = 'view'; light(); setActs(); showInfo(); }, { align: 'center', stroke: true, cls: 'm-main' });
        keep.dataset.first = '';
        const off = this.act(s, 'Éteindre', x2, ay, () => erase(), { align: 'center', stroke: { col: '#c07058', tail: '#8a5444' }, cls: 'm-danger' });
        off.dataset.erase = '';
        acts.push(keep, off);
      } else {
        const go = this.act(s, 'Reprendre', x1, ay, () => resume(), { align: 'center', stroke: true, cls: 'm-main' });
        go.dataset.continue = ''; go.dataset.first = '';
        go.addEventListener('focus', () => { focusN = 0; camTo = camFor(info()?.num ?? 1); showInfo(); });
        const del = this.act(s, 'Effacer', x2, ay, () => { state = 'confirm'; light(); setActs(); showInfo(); }, { align: 'center', stroke: true });
        del.dataset.eraseAsk = '';
        acts.push(go, del);
      }
      if (s.isConnected) setTimeout(() => (s.querySelector('[data-first]') ?? acts[0])?.focus({ preventScroll: true }), 20);
    };

    /** Les flammes visées, allumées jusqu'au chapitre en cours, en vague (au passage de la caméra). */
    const light = (wave = 0.32, from = 0.25) => {
      const cur = info()?.num ?? 0;
      lamps.forEach((L, i) => {
        const tg = i + 1 <= cur ? 1 : 0;
        if (tg !== L.target) L.wait = from + i * wave;
        L.target = tg;
        L.pTarget = state === 'confirm' ? 0.3 : i + 1 === cur ? 1 : 0.55;
      });
      lampBtns.forEach((b, i) => { b.hidden = !(i + 1 <= cur); b.tabIndex = i + 1 <= cur ? 0 : -1; b.setAttribute('aria-label', `Chapitre ${i + 1}`); });
      tab1.classList.toggle('m-on', sel === 1); tab2.classList.toggle('m-on', sel === 2);
      focusN = 0;
      camTo = camFor(Math.max(1, cur));
    };

    const pickSlot = (n) => {
      if (sel === n || state === 'leaving') return;
      sel = n; state = 'view';
      if (has(n)) { this.profile.shown = n; this.saveProfile(this.profile); }
      lamps.forEach((L) => { L.target = -1; });
      light(0.12, 0.05);
      setActs(); showInfo();
    };
    const resume = () => {
      if (state === 'leaving') return;
      state = 'leaving';
      lamps[info().num - 1].pTarget = 1.6;
      sfx('checkpoint');
      s.classList.add('m-go');
      setTimeout(() => this.continueAdventure(sel), 420);
    };
    const begin = () => {
      if (state === 'leaving') return;
      state = 'leaving';
      lamps[0].target = 1; lamps[0].wait = 0; lamps[0].pTarget = 1.4;
      camTo = 0;
      sfx('checkpoint');
      s.classList.add('m-go');
      setTimeout(() => this.newAdventure(sel), 650);
    };
    const erase = () => {
      if (state === 'leaving') return;
      state = 'leaving';
      lamps.forEach((L, i) => { L.target = 0; L.wait = (LANTERNS - 1 - i) * 0.12; });
      camTo = 0;
      setTimeout(() => {
        this.eraseAdventure(sel);
        const k = saves.findIndex((x) => x.slot === sel);
        if (k >= 0) saves[k] = { slot: sel, save: null };
        state = 'view';
        light(); setActs(); showInfo();
      }, 1000);
    };

    light();
    setActs();
    showInfo();

    s.paint = (g, t, dt) => {
      const a = info(), cur = state === 'leaving' && !a ? 1 : a?.num ?? 0;
      for (const L of lamps) {
        if (L.wait > 0) { L.wait -= dt; continue; }
        const tg = Math.max(0, L.target);
        L.v += Math.sign(tg - L.v) * Math.min(Math.abs(tg - L.v), dt * 2.4);
        L.power += (L.pTarget - L.power) * Math.min(1, dt * 4);
      }
      // la caméra glisse (lent-rapide-lent) vers la lanterne regardée
      cam += (camTo - cam) * Math.min(1, dt * 2.6);
      if (Math.abs(camTo - cam) < 0.3) cam = camTo;
      const cx = Math.round(cam);
      g.drawImage(s.world, -cx, 0);
      g.save();
      g.translate(-cx, 0);
      for (const st of stones) {
        const k = Math.min(lamps[st.seg - 1]?.v ?? 0, lamps[st.seg]?.v ?? 0);
        if (k <= 0 || st.x < cx - 8 || st.x > cx + W + 8) continue;
        g.globalAlpha = k;
        g.fillStyle = '#5a4530'; g.fillRect(st.x, st.y, st.w, 1);
        g.fillStyle = '#2a2118'; g.fillRect(st.x, st.y + 1, st.w, 1);
      }
      g.globalAlpha = 1;
      const look = focusN || cur;
      lamps.forEach((L, i) => {
        if (LX[i] < cx - 80 || LX[i] > cx + W + 80) return;
        drawFlame(g, L.lan, L.v, L.power, t, i);
        const col = L.v > 0.5 ? (i + 1 === look ? '#d8b070' : '#6e5a40') : i + 1 === look ? '#8d8a80' : '#2a2f38';
        if (s.tg) smoothText(s.tg, renderSmooth, String(i + 1), LX[i] - cx, Math.round(top(LX[i])) + 7, { color: col }, 'center');
        else { const nc = numOf(i + 1, col); g.drawImage(nc, Math.round(LX[i] - nc.width / 2), Math.round(top(LX[i])) + 7); }
      });
      if (cur > 0) {
        const x = LX[cur - 1] + 26, skin = a?.sv?.skin ?? 'encre';
        // (style peint : le ninja net, sur le calque du dessus, qui n'est pas décalé avec le sentier)
        this.art.draw(s.tg ?? g, skin, s.tg ? x - cx : x, Math.round(top(x)) + 1, { t, alpha: clamp01((lamps[cur - 1].v - 0.5) * 2), crisp: !!s.tg });
      }
      g.restore();
      lampBtns.forEach((b, i) => { b.style.left = `${LX[i] - cx - 14}px`; });
    };
    return s;
  }

  // =================================================================================================
  // Arène : le gong
  // =================================================================================================
  build_arene() {
    const s = this.scene('Arène');
    const { W, H } = s;
    const g0 = H - 56, r = H < 236 ? 24 : 30, cy = g0 - r - 38;
    const list = this.arenas ?? [];
    let pick = Math.max(0, list.findIndex((a) => a.id === this.arenaPick));
    const paintBase = () => {
      s.pen.g.clearRect(0, 0, W, H);
      ground(s.pen, flat(g0));
      s.gong = gong(s.pen, Math.round(W / 2), cy, r, g0);
      arenaFront(s.pen, list[pick]?.theme === 'foret' ? 'foret' : 'potager', Math.round(W / 2) - 64, Math.round(W / 2) + 64, g0 + 3);
    };
    paintBase();
    let ring = -1, leaving = false;
    const create = this.act(s, 'Accueillir', Math.round(W * 0.25), g0 + 10, () => {
      if (leaving) return;
      leaving = true; ring = 0;
      sfx('gong');
      s.classList.add('m-go');
      setTimeout(() => this.createArena(list[pick]?.id), 650);
    }, { align: 'center', stroke: true, cls: 'm-main' });
    create.dataset.create = ''; create.dataset.first = '';
    if (list.length > 1) {
      const y = g0 + 26, cx = Math.round(W * 0.25);
      const name = this.text(s, list[pick].name, cx, y, { align: 'center', cls: 'm-soft' });
      name.dataset.arenaName = '';
      const turn = (d) => {
        pick = (pick + d + list.length) % list.length;
        this.arenaPick = list[pick].id;
        this.swap(name, list[pick].name, cx, y, 'center');
        // le décor devant le gong change en fondu
        const old = canvas(W, H); old.getContext('2d').drawImage(s.base, 0, 0);
        paintBase();
        s.old = { c: old, at: s.age };
      };
      const half = Math.max(52, Math.round(measure(list.reduce((m, a) => (a.name.length > m.length ? a.name : m), '')) / 2) + 12);
      const prev = this.act(s, '←', cx - half, y, () => turn(-1), { align: 'center', cls: 'm-arrow' });
      const next = this.act(s, '→', cx + half, y, () => turn(1), { align: 'center', cls: 'm-arrow' });
      prev.setAttribute('aria-label', 'Arène précédente'); next.setAttribute('aria-label', 'Arène suivante');
      prev.dataset.arenaPrev = ''; next.dataset.arenaNext = '';
    }
    const join = this.act(s, 'Rejoindre', Math.round(W * 0.75), g0 + 10, () => this.open('rejoindre'), { align: 'center', stroke: true });
    join.dataset.joinScreen = '';
    // seul : contre le ninja de l'ombre (l'ordinateur), ou au Dojo (parer, riposter) — dans l'arène choisie
    const solo = (fn) => () => {
      if (leaving) return;
      leaving = true; ring = 0;
      sfx('gong');
      s.classList.add('m-go');
      setTimeout(() => fn(list[pick]?.id), 650);
    };
    const shadow = this.act(s, "Contre l'ombre", Math.round(W * 0.75), g0 + 25, solo((id) => this.vsBot?.(id)), { align: 'center', stroke: true });
    shadow.dataset.vsBot = '';
    const dojo = this.act(s, 'Dojo', Math.round(W * 0.75), g0 + 38, solo((id) => this.dojo?.(id)), { align: 'center', stroke: true });
    dojo.dataset.dojo = '';
    s.paint = (g, t, dt) => {
      if (s.old) {
        const k = clamp01((t - s.old.at) / 0.35);
        if (k >= 1) s.old = null;
        else { g.globalAlpha = 1 - k; g.drawImage(s.old.c, 0, 0); g.globalAlpha = 1; }
      }
      if (ring >= 0) { ring += dt; drawGongRing(g, s.gong, ring); }
    };
    return s;
  }

  // =================================================================================================
  // Rejoindre : quatre tablettes de bois
  // =================================================================================================
  build_rejoindre({ code = '', message = '' } = {}) {
    const s = this.scene('Rejoindre une arène');
    const { W, H } = s;
    const g0 = H - 56, ry0 = Math.max(26, g0 - 126);
    const tw = 26, th = 36, gap = 36, cx = Math.round(W / 2), x0 = cx - Math.round((3 * gap) / 2);
    ground(s.pen, flat(g0));
    const ry = rope(s.pen, x0 - 30, x0 + 3 * gap + 30, ry0, 6, g0);
    // les tablettes se peignent à part : elles descendent à l'ouverture, sautillent quand on écrit
    const tabs = [0, 1, 2, 3].map((i) => {
      const x = x0 + i * gap, hang = ry(x) + 1, top = ry(x) + 7;
      const c = canvas(tw, th), p = new Pen(c.getContext('2d'));
      const tab = ema(p, 0, 0, tw, th);
      return { x, hang, top, c, tab, at: -1 };
    });
    const input = el('input');
    input.maxLength = 9; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'characters');
    input.setAttribute('aria-label', "Code de l'arène");
    input.dataset.code = ''; input.dataset.first = '';
    input.className = 'm-codein';
    input.style.cssText = `left:${x0 - tw / 2}px;top:${tabs[0].top}px;width:${3 * gap + tw}px;height:${th}px`;
    input.value = cleanCode(code).slice(0, 4);
    s.append(input);
    let shake = -1, prevVal = input.value;
    const msg = this.text(s, message, cx, g0 + 28, { align: 'center', cls: 'm-warm' });
    msg.dataset.multiMsg = '';
    input.addEventListener('input', () => {
      input.value = cleanCode(input.value).slice(0, 4);
      if (input.value.length > prevVal.length) { tabs[input.value.length - 1].at = s.age; sfx('stick'); }
      prevVal = input.value;
      this.swap(msg, '', cx, g0 + 28, 'center');
    });
    const join = () => {
      const c = cleanCode(input.value);
      if (c.length !== 4) {
        shake = s.age;
        clearTimeout(msg.swapT);
        msg.textContent = 'Le code a quatre signes';
        this.placeText(msg, msg.textContent, cx, g0 + 28, 'center');
        msg.classList.remove('m-hide');
        input.focus();
        return;
      }
      s.classList.add('m-go');
      setTimeout(() => this.joinArena(c), 300);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); join(); } else if (e.key !== 'Escape') e.stopPropagation(); });
    const go = this.act(s, 'Rejoindre', cx, g0 + 10, join, { align: 'center', stroke: true, cls: 'm-main' });
    go.dataset.join = '';
    s.paint = (g, t) => {
      const val = input.value, focused = document.activeElement === input;
      const dx = shake >= 0 && t - shake < 0.35 ? Math.round(Math.sin((t - shake) * 60) * 2) : 0;
      tabs.forEach((T, i) => {
        // la descente (rebond léger), puis le petit saut d'une tablette qu'on vient d'écrire
        const d = clamp01((t - 0.1 - i * 0.08) / 0.45), drop = Math.round((1 - (1 - (1 - d) ** 2 * (1 + 2.2 * d))) * -46);
        const hop = T.at >= 0 && t - T.at < 0.25 ? -Math.round(Math.sin(((t - T.at) / 0.25) * Math.PI) * 3) : 0;
        const y = T.top + drop + hop, x = T.x - tw / 2 + dx;
        g.fillStyle = '#6a5d45'; g.fillRect(T.x + dx, T.hang, 1, Math.max(1, y + Math.round(tw / 3) - 2 - T.hang));
        g.drawImage(T.c, x, y);
        const tab = { body: { ...T.tab.body, x: x + T.tab.body.x, y: y + T.tab.body.y } };
        if (val[i]) drawSign(g, tab, val[i], 0, s.tg);
        else if (focused && i === val.length && Math.floor(t * 2.2) % 2 === 0) {
          g.fillStyle = '#1b120b'; g.fillRect(tab.body.x + Math.round(tab.body.w / 2) - 4, tab.body.y + tab.body.h - 6, 8, 2);
        }
      });
    };
    return s;
  }

  // =================================================================================================
  // Mon ninja : le ninja debout, son pseudo sur un panneau ; l'aventure affichée en haut à gauche
  // =================================================================================================
  build_ninja() {
    const s = this.scene('Mon ninja');
    const { W, H } = s;
    const g0 = H - 46;
    const saves = this.saves();
    const shown = saves.find((x) => x.slot === this.profile.shown && x.save) ?? saves.find((x) => x.save) ?? null;
    const others = saves.filter((x) => x.save);
    const skin = shown?.save.skin ?? 'encre';
    const rx = Math.round(W * 0.34);
    ground(s.pen, flat(g0));

    // le panneau : il s'allonge avec le pseudo (place pour les jambages du j, du y…)
    const sx = Math.round(W * 0.64), sh = 28, sy = g0 - 58;
    const signW = (name) => Math.max(64, measure(name, 'big') + 22);
    let sw = signW(this.profile.name);
    const paintSign = () => {
      s.pen.g.clearRect(sx - 90, sy - 2, 180, g0 - sy + 4);
      ground(s.pen, flat(g0));
      signpost(s.pen, sx - Math.round(sw / 2), sy, sw, sh, g0, true);
    };
    paintSign();
    const nameEl = this.text(s, this.profile.name, sx, sy + 2, { align: 'center', font: 'big', cls: 'm-carved' });
    const input = el('input');
    input.maxLength = 10; input.autocomplete = 'off'; input.spellcheck = false; input.value = this.profile.name;
    input.dataset.pseudo = '';
    input.setAttribute('aria-label', 'Pseudo');
    input.className = 'm-codein';
    const fit = () => { input.style.cssText = `left:${sx - Math.round(sw / 2)}px;top:${sy}px;width:${sw}px;height:${sh}px`; };
    fit();
    let before = this.profile.name;
    const mirror = () => {
      input.value = cleanName(input.value);
      const t = input.value;
      nameEl.textContent = t || ' ';
      this.placeText(nameEl, t, sx, sy + 2, 'center', 'big');
      const w = signW(t || before);
      if (w !== sw) { sw = w; paintSign(); fit(); }
      const n = t.trim();
      if (n) { this.profile.name = n; this.saveProfile(this.profile); }
    };
    // choisir son pseudo : tout est sélectionné, on écrit par-dessus (ou on efface tout) ; pas de curseur
    input.addEventListener('focus', () => { before = this.profile.name; setTimeout(() => input.select(), 0); });
    input.addEventListener('input', mirror);
    input.addEventListener('blur', () => { if (!input.value.trim()) { input.value = before; mirror(); } });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); s.querySelector('.m-home')?.focus(); return; }
      if (e.key !== 'Escape') e.stopPropagation();
    });
    s.append(input);
    Object.defineProperty(input, 'stroke', { get: () => ({ cx: sx, y: sy + sh + 4, len: Math.min(sw, 60) }) });

    // en haut à gauche, sous le titre : l'aventure affichée, en quelques lignes
    const x0 = 16;
    let y = 30;
    const label = shown ? `Aventure ${shown.slot}` : 'Aucune aventure';
    if (others.length > 1) {
      const prev = this.act(s, '←', x0, y, () => flip(-1), { cls: 'm-arrow' });
      this.text(s, label, x0 + 16, y, { cls: 'm-dim' });
      const next = this.act(s, '→', x0 + 16 + measure(label) + 8, y, () => flip(1), { cls: 'm-arrow' });
      prev.dataset.prev = ''; next.dataset.next = ''; next.dataset.first = '';
    } else this.text(s, label, x0, y, { cls: 'm-dim' });
    let reached = 0;
    if (shown) {
      const a = this.chapterOf(shown.save);
      reached = a.num;
      this.text(s, `Chapitre ${a.num} — ${a.name}`, x0, y += 18, { cls: 'm-ink' });
      this.text(s, `zone ${a.zoneNum} sur ${a.zones}`, x0, y += 12, { cls: 'm-soft' });
      this.text(s, `${shown.save.ryo ?? 0} ryō`, x0, y += 12, { cls: 'm-soft' });
      y += 18;
    }
    // à droite, au-dessus du panneau : l'arène (si on y a combattu) — duels, victoires, le titre porté
    // (← → pour en changer parmi ceux gagnés : il donne son sceau et la couleur de la lame), l'ennemi juré
    const st = new ArenaStats(), sum = st.summary(), ax = Math.round(W * 0.53);
    let sealAt = null;
    if (sum.fights > 0) {
      let ay = 30;
      this.text(s, 'Arène', ax, ay, { cls: 'm-dim' });
      this.text(s, `${sum.fights} duel${sum.fights > 1 ? 's' : ''} · ${sum.wins} victoire${sum.wins > 1 ? 's' : ''} · ${sum.rate} %`, ax, ay += 18, { cls: 'm-ink' }).dataset.arenaStats = '';
      const lines = [`meilleure série : ${sum.best}`, `parades : ${sum.parries} · coups fatals : ${sum.fatals}`];
      if (sum.nemesis) lines.push(`ennemi juré : ${sum.nemesis}`);
      for (const l of lines) this.text(s, l, ax, ay += 12, { cls: 'm-soft' });
      const won = TITLES.filter((t) => st.s.titles.includes(t.id));
      if (won.length) {
        ay += 16;
        sealAt = { x: ax, y: ay + 1 };
        const tx = ax + 12, tEl = this.text(s, st.title?.name ?? won[0].name, tx, ay, { cls: 'm-warm' });
        tEl.dataset.arenaTitle = '';
        if (won.length > 1) {
          const turn = (d) => {
            const i = won.findIndex((t) => t.id === st.s.title), n = won[(i + d + won.length) % won.length];
            st.choose(n.id);
            this.swap(tEl, n.name, tx, ay, 'left');
          };
          const nx = tx + Math.max(...won.map((t) => measure(t.name))) + 8;
          const prev = this.act(s, '←', nx, ay, () => turn(-1), { cls: 'm-arrow' }), next = this.act(s, '→', nx + 12, ay, () => turn(1), { cls: 'm-arrow' });
          prev.setAttribute('aria-label', 'Titre précédent'); next.setAttribute('aria-label', 'Titre suivant');
        }
      }
    }
    const flip = (d) => {
      this.profile.shown = this.profile.shown === 1 ? 2 : 1;
      this.saveProfile(this.profile);
      const i = this.stack.indexOf(s), fresh = this.build('ninja', {}, false);
      this.fadeOut(s, true); this.stack[i] = fresh;
      setTimeout(() => fresh.querySelector(d < 0 ? '[data-prev]' : '[data-next]')?.focus(), 40);
    };
    s.paint = (g, t) => {
      this.art.draw(s.tg ?? g, skin, rx, g0 + 1, { k: 2, t, tint: 'rgba(10,14,30,0.15)', alpha: clamp01((t - 0.15) / 0.4), crisp: !!s.tg });
      if (sealAt && st.seal) { g.globalAlpha = clamp01((t - 0.3) / 0.3); drawSeal(g, st.seal, sealAt.x, sealAt.y); g.globalAlpha = 1; }
      if (!shown) return;
      // la route : sept petites flammes, allumées jusqu'au chapitre de l'aventure
      for (let i = 0; i < LANTERNS; i++) {
        const x = x0 + 1 + i * 13, on = i < reached, a = clamp01((t - 0.3 - i * 0.08) / 0.3);
        if (i < LANTERNS - 1) { g.fillStyle = i < reached - 1 ? '#6a5236' : '#1d2230'; g.fillRect(x + 3, y + 2, 7, 1); }
        if (on) {
          g.globalAlpha = a;
          g.fillStyle = '#5a3a1e'; g.fillRect(x - 2, y - 1, 5, 6);
          g.fillStyle = '#f6b24a'; g.fillRect(x - 1, y, 3, 4);
          g.fillStyle = '#fff3c8'; g.fillRect(x, y + 1, 1, 2);
          g.fillStyle = '#ffd98a'; g.fillRect(x, y - 1, 1, 1);
          g.globalAlpha = 1;
        } else { g.fillStyle = '#1a1f2a'; g.fillRect(x - 1, y, 3, 4); g.fillStyle = '#2c3446'; g.fillRect(x - 1, y, 1, 4); }
      }
    };
    return s;
  }
}
