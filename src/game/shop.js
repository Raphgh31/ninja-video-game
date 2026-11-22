import { drawAura } from './aura.js';
import { measure } from '../engine/pixelfont.js';
import { canvas, bayer } from './potager/paint.js';
import { Pen, INK, stroke, smooth, WOOD } from './menuart.js';

// Boutique du marchand ambulant, refaite le 22 novembre 2026 dans le style des menus « Les lanternes »
// (demande de Raph) : plus de cartes ni de cadres, une scène peinte par-dessus le jeu en pause.
//   - en haut à gauche, le nom de l'échoppe ; en haut à droite, la bourse ;
//   - au milieu, le skin choisi, en grand, sous une lanterne de papier : il s'anime (repos, course, saut,
//     sabre…) ; à droite, son nom, sa rareté (en couleur), son prix, et l'achat (à confirmer), « Porter »,
//     « Porté », ou comment gagner une récompense ;
//   - en bas, une étagère de bois où tous les skins se tiennent debout, du moins cher au plus cher : elle
//     glisse pour garder le skin choisi au milieu ; ← / → (ou un clic) passent de l'un à l'autre ;
//   - « Reprendre la route », en bas à droite (ou Échap).
// Menus sobres : le marchand ne parle pas, aucune ligne d'aide. Encre est toujours possédé.
// Version de test (window.__KAGE_TEST) : tous les skins se portent sans achat.
export const SHOP_CATEGORIES = [{ id: 'apparences', name: 'Apparences', items: [] }];

/** Les raretés : nom affiché et couleur. */
export const RARITIES = {
  origine: { name: 'Origine', color: '#8d8a80' },
  commun: { name: 'Commun', color: '#a8a290' },
  'peu commun': { name: 'Peu commun', color: '#6fae5a' },
  rare: { name: 'Rare', color: '#4f8fd6' },
  'épique': { name: 'Épique', color: '#a46ad6' },
  'légendaire': { name: 'Légendaire', color: '#f0c25a' },
};

/** L'ordre des skins (boutique, panneau de test) : du moins cher au plus cher, puis les récompenses (champ
 *  `reward`, sans prix : le trophée du corbeau). */
export function skinOrder(skins) {
  const key = (id) => (skins[id].reward ? Infinity : skins[id].price ?? 0);
  return Object.keys(skins).sort((a, b) => key(a) - key(b) || skins[a].name.localeCompare(skins[b].name));
}

/** Ce qu'il faut faire pour gagner une récompense. */
const REWARDS = { karasu: 'Battre le corbeau' };
// le skin choisi enchaîne ces animations
const SHOWCASE = [['idle', 1800], ['run', 1600], ['jump', 900], ['attack', 1000], ['sprint', 1400], ['kick', 900], ['throw', 900]];
const STEP = 44;                  // écart des skins sur l'étagère

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class Shop {
  /** root : la section .shop (dans le calque de l'interface). wardrobe : { skins, meta, test, buy(id) → bool, wear(id) } */
  constructor(root, wardrobe) {
    this.root = root;
    this.wardrobe = wardrobe;
    this.isOpen = false;
    this.selected = null;
    this.confirming = false;
    root.replaceChildren();
    root.classList.add('m-lant');
    this.cv = canvas(1, 1);
    this.cv.className = 'm-scene';
    this.layer = el('div', 'm-layer');
    root.append(this.cv, this.layer);
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (this.confirming) return;
        e.preventDefault(); e.stopPropagation();
        const ids = this.ids(), i = ids.indexOf(this.selected);
        this.select(ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))]);
        this.layer.querySelector('[data-action]:not(:disabled)')?.focus({ preventScroll: true });
      }
    }, true);
  }

  /** opts : { save, title } (le nom de l'échoppe du chapitre). */
  open({ save, title }) {
    this.save = save;
    this.title = title ?? 'Le marchand';
    this.root.hidden = false;
    this.isOpen = true;
    this.confirming = false;
    this.selected = this.selected ?? save.skin ?? 'encre';
    this.age = 0;
    this.cam = null;
    this.root.classList.remove('m-in');
    this.render();
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('m-in')));
    this.animate();
  }

  close() {
    this.isOpen = false;
    this.root.classList.remove('m-in');
    cancelAnimationFrame(this.raf);
    setTimeout(() => { if (!this.isOpen) this.root.hidden = true; }, 220);
    this.onClose?.();
  }

  ids() { return skinOrder(this.wardrobe.skins); }
  owned(id) { return this.wardrobe.test || id === 'encre' || this.save.skins.includes(id); }

  select(id) {
    if (!id || id === this.selected) return;
    this.selected = id;
    this.confirming = false;
    this.showT0 = performance.now();
    this.render();
  }

  // ---- la scène ------------------------------------------------------------------------------------------
  layout() {
    const ui = this.root.parentElement;
    const W = ui?.offsetWidth || 448, H = ui?.offsetHeight || 252;
    if (this.W === W && this.H === H) return;
    this.W = W; this.H = H;
    this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d'); this.g.imageSmoothingEnabled = false;
    this.shelfY = H - 46;                  // le dessus de l'étagère
    this.floorY = this.shelfY - 46;        // le sol du skin choisi : bien au-dessus de l'étagère, sous la lanterne
    // la couche fixe : le voile sombre et l'étagère de bois (sur toute la largeur)
    this.base = canvas(W, H);
    const p = new Pen(this.base.getContext('2d'));
    p.g.fillStyle = 'rgba(6, 8, 12, 0.9)'; p.g.fillRect(0, 0, W, H);
    const y = this.shelfY;
    p.shade(0, y, W, 5, (x, yy) => {
      const j = yy - y;
      const v = j === 0 ? 0.92 : j === 4 ? 0.1 : 0.5 + ((x * 7 + j * 13) % 23 === 0 ? -0.2 : 0) + (Math.sin(x * 0.11 + j) * 0.06);
      return WOOD[Math.max(0, Math.min(WOOD.length - 1, Math.round(v * (WOOD.length - 1))))];
    });
    for (let x = 30; x < W; x += 120) { p.r(x, y + 5, 3, 10, WOOD[1]); p.r(x, y + 5, 1, 10, WOOD[3]); }   // les consoles
  }

  /** Les textes et boutons (posés au pixel), refaits à chaque changement. */
  render() {
    this.layout();
    const { W, H, save } = this, id = this.selected, sk = this.wardrobe.skins[id];
    const rar = RARITIES[sk?.rarity ?? 'origine'] ?? RARITIES.commun;
    const L = this.layer;
    L.replaceChildren();
    const put = (e, t, x, y, align = 'left', font = 'small') => {
      const w = measure(t, font);
      e.style.left = `${Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x)}px`;
      e.style.top = `${Math.round(y)}px`;
      e.pw = w;
      L.append(e);
      return e;
    };
    const text = (t, x, y, cls, align, font) => put(el('p', `m-txt ${cls ?? ''}`.trim(), t), t, x, y, align, font);
    const act = (t, x, y, onClick, { align = 'left', cls = '', st = true } = {}) => {
      const b = put(el('button', `m-act ${cls}`.trim(), t), t, x, y, align);
      b.type = 'button';
      b.addEventListener('click', onClick);
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !b.disabled) b.focus({ preventScroll: true }); });
      if (st) b.stroke = { cx: parseFloat(b.style.left) + b.pw / 2, y: Math.round(y) + 13, len: b.pw + 6, ...(st === true ? {} : st) };
      return b;
    };
    text(this.title, 16, 8, 'm-ttl');
    const purse = text(`${save.ryo} ryō`, W - 16, 8, 'm-gold', 'right');
    purse.dataset.purse = '';
    this.purseX = parseFloat(purse.style.left) - 10;
    const close = act('Reprendre la route', W - 16, H - 18, () => this.close(), { align: 'right', cls: 'm-main' });
    close.dataset.close = '';

    // le skin choisi : nom, rareté, l'achat
    const tx = Math.round(W * 0.55), ty = Math.round(H * 0.22);
    text(rar.name, tx, ty, 'm-rar').style.color = rar.color;
    const bigName = measure(sk.name, 'big') <= W - tx - 10;   // un nom trop long passe en petits caractères
    text(sk.name, tx, ty + (bigName ? 12 : 18), bigName ? 'm-ink m-big' : 'm-ink', 'left', bigName ? 'big' : 'small');
    const owned = this.owned(id), worn = save.skin === id;
    let first = null;
    if (this.confirming) {
      text(`L'acheter pour ${sk.price} ryō ?`, tx, ty + 44, 'm-ink');
      const yes = act('Oui', tx + 4, ty + 62, () => this.buy(id), { cls: 'm-main' });
      yes.dataset.confirm = '';
      const no = act('Non', tx + 44, ty + 62, () => { this.confirming = false; this.render(); });
      no.dataset.cancel = '';
      first = yes;
    } else {
      let b;
      if (worn) { b = act('Porté', tx, ty + 44, () => {}, { st: false }); b.disabled = true; }
      else if (owned) b = act('Porter', tx, ty + 44, () => { this.wardrobe.wear(id); this.render(); }, { cls: 'm-main' });
      else if (sk.reward) { b = act(REWARDS[sk.reward] ?? 'Récompense', tx, ty + 44, () => {}, { st: false }); b.disabled = true; }
      else {
        const poor = save.ryo < sk.price;
        b = act(`Acheter · ${sk.price} ryō`, tx, ty + 44, () => {
          if (save.ryo < sk.price) return;
          this.confirming = true; this.render();
        }, { cls: poor ? 'm-poor' : 'm-main', st: !poor });
        if (poor) b.classList.add('m-poor');
      }
      b.dataset.action = '';
      first = b;
    }

    // l'étagère : un bouton (invisible) sur chaque skin ; son prix, ou « porté », dessous
    this.cards = this.ids().map((sid) => {
      const s2 = this.wardrobe.skins[sid];
      const card = el('button', 'm-lamp shop__card');
      card.type = 'button';
      card.dataset.skin = sid;
      card.setAttribute('aria-label', s2.name);
      card.setAttribute('aria-pressed', String(sid === id));
      const tag = el('span', 'shop__tag');
      tag.textContent = save.skin === sid ? 'porté' : this.owned(sid) ? 'acquis' : s2.reward ? 'trophée' : `${s2.price} ryō`;
      tag.hidden = true;
      card.append(tag);
      card.addEventListener('click', () => { this.select(sid); this.layer.querySelector('[data-action]:not(:disabled), [data-confirm]')?.focus({ preventScroll: true }); });
      card.style.cssText = `top:${this.shelfY - 38}px;width:30px;height:40px`;
      L.append(card);
      const lbl = el('p', 'm-txt shop__price');
      lbl.textContent = tag.textContent;
      lbl.classList.add(save.skin === sid ? 'm-ink' : this.owned(sid) ? 'm-soft' : s2.reward ? 'm-faint' : save.ryo < (s2.price ?? 0) ? 'm-faint' : 'm-gold');
      L.append(lbl);
      return { sid, card, lbl, w: measure(lbl.textContent) };
    });
    this.place();
    if (this.isOpen) setTimeout(() => (first && !first.disabled ? first : close).focus({ preventScroll: true }), 20);
  }

  /** L'étagère glisse : le skin choisi au milieu. */
  place() {
    const i = this.ids().indexOf(this.selected), target = this.W / 2 - i * STEP;
    this.cam ??= target;
    this.camTo = target;
    for (const [k, c] of (this.cards ?? []).entries()) {
      const x = Math.round(this.cam + k * STEP);
      c.card.style.left = `${x - 15}px`;
      c.lbl.style.left = `${x - Math.round(c.w / 2)}px`;
      c.lbl.style.top = `${this.shelfY + 8}px`;
      const out = x < 8 || x > this.W - 8;
      c.card.hidden = out; c.lbl.hidden = out;
    }
  }

  buy(id) {
    this.confirming = false;
    this.wardrobe.buy(id);
    this.render();
  }

  animate() {
    cancelAnimationFrame(this.raf);
    let last = 0;
    const step = (now) => {
      if (!this.isOpen) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      this.age += dt;
      this.draw(dt);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Une image d'un skin (animation a, temps t en ms), pieds en (x, y), agrandi k fois, voilé de nuit ou non. */
  ninja(g, sk, a, t, x, y, k, dim) {
    const { meta } = this.wardrobe, A = meta.animations[a] ?? meta.animations.idle;
    const dur = A.frames.reduce((s, f) => s + (f.duration ?? 100), 0);
    const tt = A.loop === false ? Math.min(t, dur - 1) : t % dur;
    let i = 0, acc = 0;
    while (i < A.frames.length - 1 && acc + (A.frames[i].duration ?? 100) <= tt) { acc += A.frames[i].duration ?? 100; i++; }
    const f = A.frames[i];
    g.drawImage(sk.sheet, f.x, f.y, f.w, f.h, Math.round(x - meta.pivot.x * k), Math.round(y - meta.pivot.y * k), f.w * k, f.h * k);
    if (sk.aura && !dim) drawAura(g, x, y, 1, performance.now() / 1000, k);
  }

  draw(dt) {
    this.layout();
    const g = this.g, { W, H } = this, t = this.age;
    if (this.camTo != null && Math.abs(this.camTo - this.cam) > 0.3) { this.cam += (this.camTo - this.cam) * Math.min(1, dt * 7); this.place(); }
    else if (this.camTo != null && this.cam !== this.camTo) { this.cam = this.camTo; this.place(); }
    g.clearRect(0, 0, W, H);
    g.drawImage(this.base, 0, 0);
    const sk = this.wardrobe.skins[this.selected];
    const cx = Math.round(W * 0.3), fy = this.floorY;
    // la lanterne de papier, au-dessus du skin choisi, et sa lumière
    const sw = Math.sin(t * 1.4) * 1.2, lx = Math.round(cx + sw), ly = 20;
    g.fillStyle = '#3a2616'; g.fillRect(cx, 0, 1, ly);
    const fl = 0.92 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1);
    if (!this.halo) {                        // la lumière de la lanterne, tramée, peinte une fois
      const R = 70, c = canvas(2 * R, 2 * R + 8), hp = new Pen(c.getContext('2d'));
      hp.shade(0, 0, 2 * R, 2 * R + 8, (x, y) => {
        const d = Math.hypot((x - R) / R, (y - R) / (R * 0.95));
        let a = d < 1 ? Math.floor((Math.pow(1 - d, 1.8) * 5) + bayer(x, y)) / 5 * 0.28 : 0;
        const e = Math.hypot((x - R) / 34, (y - 2 * R + 2) / 3);
        if (e < 1) a = Math.max(a, Math.floor((1 - e) * 3 + bayer(x, y)) / 3 * 0.35);
        return a > 0 ? ['#f0a848', a] : null;
      });
      this.halo = { c, R };
    }
    g.globalAlpha = fl;
    g.drawImage(this.halo.c, cx - this.halo.R, fy + 1 - 2 * this.halo.R);
    g.globalAlpha = 1;
    g.fillStyle = '#1c1510'; g.fillRect(lx - 6, ly, 13, 18);
    g.fillStyle = '#c8432f'; g.fillRect(lx - 5, ly + 1, 11, 16);
    g.fillStyle = '#f4cf8a'; g.fillRect(lx - 4, ly + 3, 9, 12);
    g.fillStyle = '#ffe9b0'; g.fillRect(lx - 2, ly + 5, 5, 8);
    g.fillStyle = '#1c1510'; g.fillRect(lx - 5, ly + 1, 11, 1); g.fillRect(lx - 5, ly + 16, 11, 1);
    for (let y = ly + 5; y < ly + 15; y += 3) { g.fillStyle = 'rgba(120,40,20,0.35)'; g.fillRect(lx - 4, y, 9, 1); }
    // le skin choisi, en grand, qui s'anime
    if (sk) {
      const total = SHOWCASE.reduce((a, [, d]) => a + d, 0);
      let tt = (performance.now() - (this.showT0 ?? 0)) % total, k = 0;
      while (tt > SHOWCASE[k][1]) { tt -= SHOWCASE[k][1]; k++; }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(cx - 18, fy, 36, 2);
      const z = H < 236 ? 2 : 3;
      this.ninja(g, sk, SHOWCASE[k][0], tt, cx, fy + 1, z, false);
    }
    // l'étagère : chaque skin debout, au repos ; celui qu'on regarde, éclairé
    const ids = this.ids();
    ids.forEach((sid, i) => {
      const x = Math.round(this.cam + i * STEP);
      if (x < -20 || x > W + 20) return;
      const s2 = this.wardrobe.skins[sid], on = sid === this.selected;
      this.ninja(g, s2, 'idle', performance.now() + i * 137, x, this.shelfY + 1, 1, !on);
      if (!on) { g.fillStyle = 'rgba(6, 8, 12, 0.45)'; g.fillRect(x - 20, this.shelfY - 40, 40, 40); }
    });
    // la petite pièce de la bourse
    const px = this.purseX ?? W - 60;
    g.fillStyle = '#1c1510'; g.fillRect(px - 1, 9, 8, 8);
    g.fillStyle = '#e8b93c'; g.fillRect(px, 10, 6, 6);
    g.fillStyle = '#fff0b0'; g.fillRect(px + 1, 11, 2, 1);
    g.fillStyle = '#1c1510'; g.fillRect(px + 2, 12, 2, 2);
    // le coup de pinceau sous le choix
    const f = document.activeElement;
    if (f && this.root.contains(f) && f.stroke && !f.disabled) {
      if (this.strokeFor !== f) { this.strokeFor = f; this.strokeAt = t; }
      const s = f.stroke;
      stroke(g, s.cx, s.y, s.len, smooth((t - this.strokeAt) / 0.22), s.col ?? INK, s.tail);
    } else this.strokeFor = null;
  }
}
