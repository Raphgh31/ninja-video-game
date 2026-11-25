import { drawAura } from './aura.js';
import { measure } from '../engine/pixelfont.js';
import { canvas, bayer, pick, ih, noise1 } from './potager/paint.js';
import { paintFar, paintMid } from './potager/backdrop.js';
import { paintMoon } from './intro.js';
import { BrushedCanvas, brushView } from '../engine/brushgl.js';
import { crispSheet, NINJA_DEFAULT } from '../engine/netsprite.js';
import { Pen, INK, stroke, smooth, clamp01, ground, stoneLantern, drawFlame } from './menuart.js';
/** Une feuille nette voilée de nuit (les skins de l'étagère qu'on ne regarde pas). */
function dimmed(c) {
  const d = document.createElement('canvas'); d.width = c.width; d.height = c.height;
  const g = d.getContext('2d'); g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(6, 8, 12, 0.45)'; g.fillRect(0, 0, d.width, d.height);
  d.P = c.P; d.smooth = c.smooth;
  return d;
}

// Boutique du marchand ambulant, refaite le 22 novembre 2026 dans le style des menus « Les lanternes »
// (demande de Raph) : plus de cartes ni de cadres, une scène peinte par-dessus le jeu en pause.
//   - en haut à gauche, le nom de l'échoppe ; en haut à droite, la bourse ;
//   - au milieu, le skin choisi, en grand, sous une lanterne de papier : il s'anime (repos, course, saut,
//     sabre…) ; à droite, son nom, sa rareté (en couleur), son prix, et l'achat (à confirmer), « Porter »,
//     « Porté », ou comment gagner une récompense ;
//   - « Le sentier de nuit » (25 novembre 2026, choisi par Raph sur docs/menus/planche_boutique.jpg) : la
//     nuit de l'intro (la lune, les deux chaînes, une forêt de pins et un hameau dans la brume au pied des
//     montagnes) ; les skins attendent le long d'un sentier, du moins cher au plus cher, chacun près d'une
//     lanterne de pierre : celle du skin choisi s'allume, et lui se tient en grand ; le sentier glisse pour
//     garder le choix au milieu ; ← / → (ou un clic) passent de l'un à l'autre ;
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
const STEP = 92;                  // écart des skins le long du sentier
// les couleurs de la nuit (celles de l'intro)
const SKY = ['#04060c', '#060a14', '#0a101f', '#0f182b', '#15203a'];
const FAR = ['#04070b', '#0a111c', '#121c2c', '#1b293e', '#273a54', '#3a4f6c'];
const MID = ['#04070b', '#081019', '#0e1824', '#152234', '#1f2e44', '#2a3c56'];
const PINE = ['#060a0f', '#0a1118', '#0f1922', '#16232e'];
/** Une chaîne du Potager, repeinte aux couleurs de la nuit (sa clarté devient une encre bleue). */
function nightRange(img, ramp, dark = 0) {
  const w = img.width, h = img.height, c = canvas(w, h), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, w, h), d = id.data, p = new Pen(g);
  p.g.putImageData(id, 0, 0);
  p.shade(0, 0, w, h, (x, y) => {
    const o = (y * w + x) * 4;
    if (d[o + 3] < 8) return null;
    const l = (0.3 * d[o] + 0.55 * d[o + 1] + 0.15 * d[o + 2]) / 255;
    return pick(ramp, l * 0.95 - 0.12 - dark, x, y, 0.5);
  });
  return c;
}

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
    this.bc = brushView.on ? new BrushedCanvas('m-scene') : null;     // style peint : repeinte à chaque image
    this.cv = this.bc ? this.bc.el : canvas(1, 1);
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
    if (this.bc) { this.bc.size(W, H); this.g = this.bc.g; }
    else { this.cv.width = W; this.cv.height = H; this.g = this.cv.getContext('2d'); }
    this.g.imageSmoothingEnabled = false;
    // le sentier : il monte doucement vers le milieu ; les skins s'y tiennent
    const base = H - 40;
    this.gy = (x) => Math.round(base - Math.sin(clamp01(x / W) * Math.PI) * 10);
    const hz = base - 18;                  // l'horizon : le pied des montagnes
    // la couche fixe : le ciel, les étoiles, la lune, les montagnes, la forêt, le hameau, la brume, le sol
    this.base = canvas(W, H);
    const g = this.base.getContext('2d'), p = new Pen(g);
    p.shade(0, 0, W, H, (x, y) => pick(SKY, y / (H * 0.72), x, y, 0.6));
    for (let i = 0; i < Math.round(W * 0.22); i++) {
      const x = Math.floor(ih(i, 1, 81) * W), y = Math.floor(ih(i, 2, 81) ** 1.4 * hz * 0.6);
      p.px(x, y, i % 7 ? '#3e4a66' : '#a7b2c8');
    }
    const moon = paintMoon(13);
    g.drawImage(moon.c, Math.round(W - 84 - moon.o), Math.round(34 - moon.o));
    this.ranges ??= { far: nightRange(paintFar(480).img, FAR), mid: nightRange(paintMid(480).img, MID, 0.04) };
    g.drawImage(this.ranges.far, 380, 0, W, 236, 0, hz - 222 + 4, W, 236);
    g.drawImage(this.ranges.mid, 120, 0, W, 176, 0, hz - 160 + 14, W, 176);
    // au pied des montagnes (25 novembre 2026 : « moins nues et ternes ») : une brume bleutée où les sommets
    // se posent, deux rangs de pins dont la lune (à droite) éclaire le flanc et la pointe, un hameau aux
    // fenêtres chaudes dans la brume, et une brume plus basse entre les rangs
    const mist = (y0, h, col, amax, up = true) => p.shade(0, y0, W, h, (x, y) => {
      const f = up ? (y - y0) / h : 1 - Math.abs(y - y0 - h / 2) / (h / 2);
      const a = clamp01(f) * amax * (0.8 + 0.4 * noise1(x / 40 + y / 9, 7));
      return a > 0.02 && (x + y * 2) % 3 ? [col, a] : null;
    });
    mist(hz - 40, 40, '#4a5d82', 0.34);
    const pines = (y0, hMin, hMax, col, lit, tip, seed, gap) => {
      for (let x = -8; x < W + 8; x += gap + Math.floor(ih(x, seed, 3) * gap)) {
        const h = hMin + Math.floor(ih(x, seed, 4) * (hMax - hMin)), yb = y0 + Math.round(noise1(x / 23, seed) * 3);
        for (let j = 0; j < h; j++) {
          // des étages de branches : la largeur grandit vers le bas, et se resserre un peu à chaque étage
          const half = Math.round((j / h) * h * 0.34 - ((j % 4) === 0 ? 1 : 0));
          if (half < 0) { p.px(x, yb - h + j, col); continue; }
          p.r(x - half, yb - h + j, half * 2 + 1, 1, col);
          p.px(x + half, yb - h + j, lit);                  // le flanc tourné vers la lune
        }
        p.px(x, yb - h, tip); p.px(x, yb - h + 1, lit);
        p.r(x, yb, 1, 2, col);
      }
    };
    pines(hz + 2, 8, 17, '#1a283a', '#2b3d56', '#4a6084', 11, 4);
    // le hameau : des toits sombres, des fenêtres chaudes et leur halo
    const warm = [];
    for (const [fx, n] of [[0.14, 2], [0.47, 1], [0.7, 3], [0.9, 1]]) {
      for (let k = 0; k < n; k++) {
        const hx = Math.round(W * fx) + k * 15, hy = hz + 3 + (k % 2);
        p.r(hx - 5, hy - 6, 11, 7, '#111a26');
        p.r(hx - 7, hy - 8, 15, 2, '#1b2738'); p.r(hx - 5, hy - 10, 11, 2, '#1b2738'); p.r(hx - 3, hy - 11, 7, 1, '#2a3a52');
        p.px(hx - 8, hy - 7, '#2a3a52'); p.px(hx + 8, hy - 7, '#2a3a52');
        const wx = hx - 2 + (k % 2) * 3;
        p.r(wx, hy - 4, 2, 2, '#f0b45a'); p.px(wx, hy - 3, '#c9853a');
        warm.push([wx + 1, hy - 3]);
      }
    }
    for (const [wx, wy] of warm) p.shade(wx - 6, wy - 5, 13, 10, (x, y) => {
      const d = Math.hypot(x - wx, (y - wy) * 1.4); return d < 6 && (x + y) % 2 ? ['#e8a050', (1 - d / 6) * 0.22] : null;
    });
    mist(hz + 4, 14, '#3e5070', 0.3, false);
    pines(hz + 16, 12, 26, '#0f1824', '#1d2c40', '#33476a', 23, 5);
    mist(hz + 14, 12, '#2c3c58', 0.22, false);
    ground(p, this.gy);
    this.lights = new Map();
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

    // le skin choisi : sa rareté, son nom, l'achat — centrés au-dessus du sentier
    const cx = Math.round(W / 2), ty = Math.round(H * 0.12);
    text(rar.name, cx, ty, 'm-rar', 'center').style.color = rar.color;
    const bigName = measure(sk.name, 'big') <= W - 40;
    text(sk.name, cx, ty + (bigName ? 12 : 16), bigName ? 'm-ink m-big' : 'm-ink', 'center', bigName ? 'big' : 'small');
    const owned = this.owned(id), worn = save.skin === id;
    let first = null;
    if (this.confirming) {
      text(`L'acheter pour ${sk.price} ryō ?`, cx, ty + 42, 'm-ink', 'center');
      const yes = act('Oui', cx - 26, ty + 58, () => this.buy(id), { cls: 'm-main', align: 'center' });
      yes.dataset.confirm = '';
      const no = act('Non', cx + 26, ty + 58, () => { this.confirming = false; this.render(); }, { align: 'center' });
      no.dataset.cancel = '';
      first = yes;
    } else {
      let b;
      const o = { align: 'center' };
      if (worn) { b = act('Porté', cx, ty + 44, () => {}, { ...o, st: false }); b.disabled = true; }
      else if (owned) b = act('Porter', cx, ty + 44, () => { this.wardrobe.wear(id); this.render(); }, { ...o, cls: 'm-main' });
      else if (sk.reward) { b = act(REWARDS[sk.reward] ?? 'Récompense', cx, ty + 44, () => {}, { ...o, st: false }); b.disabled = true; }
      else {
        const poor = save.ryo < sk.price;
        b = act(`Acheter · ${sk.price} ryō`, cx, ty + 44, () => {
          if (save.ryo < sk.price) return;
          this.confirming = true; this.render();
        }, { ...o, cls: poor ? 'm-poor' : 'm-main', st: !poor });
        if (poor) b.classList.add('m-poor');
      }
      b.dataset.action = '';
      first = b;
    }

    // le sentier : un bouton (invisible) sur chaque skin ; son prix, ou « porté », dessous
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
      card.style.cssText = 'width:34px;height:44px';
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

  /** Le sentier glisse : le skin choisi au milieu. */
  place() {
    const i = this.ids().indexOf(this.selected), target = this.W / 2 - i * STEP;
    this.cam ??= target;
    this.camTo = target;
    for (const [k, c] of (this.cards ?? []).entries()) {
      const x = Math.round(this.cam + k * STEP), y = this.gy(x), on = c.sid === this.selected;
      c.card.style.left = `${x - 17}px`;
      c.card.style.top = `${y - (on ? 72 : 40)}px`;
      c.card.style.height = `${on ? 72 : 40}px`;
      c.lbl.style.left = `${x + 4 - Math.round(c.w / 2)}px`;
      c.lbl.style.top = `${y + 5}px`;
      const out = x < 8 || x > this.W - 8;
      c.card.hidden = out; c.lbl.hidden = out || on;
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
    if (this.bc) {                // style peint : le ninja net (« trait fin »), posé après le pinceau
      const c = dim ? (sk.crispDim ??= dimmed(sk.crisp ??= crispSheet(sk.sheet, NINJA_DEFAULT))) : (sk.crisp ??= crispSheet(sk.sheet, NINJA_DEFAULT)), P = c.P, tg = this.bc.tg;
      tg.save(); tg.imageSmoothingEnabled = !!c.smooth; tg.imageSmoothingQuality = 'high';
      tg.drawImage(c, f.x * P, f.y * P, f.w * P, f.h * P, Math.round(x - meta.pivot.x * k), Math.round(y - meta.pivot.y * k), f.w * k, f.h * k);
      tg.restore();
    } else g.drawImage(sk.sheet, f.x, f.y, f.w, f.h, Math.round(x - meta.pivot.x * k), Math.round(y - meta.pivot.y * k), f.w * k, f.h * k);
    if (sk.aura && !dim) drawAura(g, x, y, 1, performance.now() / 1000, k);
  }

  draw(dt) {
    this.layout();
    const g = this.g, { W, H } = this, t = this.age;
    if (this.camTo != null && Math.abs(this.camTo - this.cam) > 0.3) { this.cam += (this.camTo - this.cam) * Math.min(1, dt * 7); this.place(); }
    else if (this.camTo != null && this.cam !== this.camTo) { this.cam = this.camTo; this.place(); }
    g.clearRect(0, 0, W, H);
    g.drawImage(this.base, 0, 0);
    // quelques étoiles qui scintillent
    for (let i = 0; i < 8; i++) {
      const a = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) + i * 2.1);
      if (a < 0.6) continue;
      g.fillStyle = `rgba(200,210,235,${((a - 0.6) * 2).toFixed(2)})`;
      g.fillRect(Math.floor(ih(i, 5, 81) * W), Math.floor(ih(i, 6, 81) * H * 0.4), 1, 1);
    }
    // les skins le long du sentier, chacun près de sa lanterne (celle du choix s'allume)
    const ids = this.ids(), p = new Pen(g), big = H < 236 ? 1 : 2;
    ids.forEach((sid, i) => {
      const x = Math.round(this.cam + i * STEP);
      if (x < -60 || x > W + 60) return;
      const on = sid === this.selected, y = this.gy(x);
      const lan = stoneLantern(p, x - (on ? 28 : 17), y, on ? 1.3 : 0.9);
      const v = this.lights.get(sid) ?? (on ? 0 : 0.16), to = on ? 1 : 0.16;
      const nv = v + Math.sign(to - v) * Math.min(Math.abs(to - v), dt * 2.2);
      this.lights.set(sid, nv);
      drawFlame(g, lan, nv, on ? 1 : 0.45, t, i);
      const s2 = this.wardrobe.skins[sid];
      if (on) {
        const total = SHOWCASE.reduce((a, [, d]) => a + d, 0);
        let tt = (performance.now() - (this.showT0 ?? 0)) % total, k = 0;
        while (tt > SHOWCASE[k][1]) { tt -= SHOWCASE[k][1]; k++; }
        this.ninja(g, s2, SHOWCASE[k][0], tt, x + 4, y + 1, big, false);
      } else this.ninja(g, s2, 'idle', performance.now() + i * 137, x + 3, y + 1, 1, true);
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
    this.bc?.present({ fine: 'tiny' });   // (des touches fines : le skin, agrandi, se reconnaît)
  }
}
