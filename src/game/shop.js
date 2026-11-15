// Boutique du marchand ambulant — plein écran (refaite en novembre 2026, demande de Raph).
// Rayon « Apparences » : tous les skins de KAGE (assets/characters/kage/skins/*.json, champ `price` en
// ryō), en vente dès le chapitre 1. Une grille de cartes (vignette, cadre à la couleur de la rareté, prix) ;
// un clic ouvre le skin en grand à droite (il s'anime : repos, course, saut, sabre…), avec sa rareté, sa
// description, son prix, et l'achat, à confirmer. Encre est toujours possédé.
// Version de test (window.__KAGE_TEST) : tous les skins se portent sans achat.
// Les rayons Ressources et Objets sont encore vides.

export const SHOP_CATEGORIES = [
  { id: 'apparences', name: 'Apparences', items: [] },
  { id: 'ressources', name: 'Ressources', items: [] },
  { id: 'objets', name: 'Objets', items: [] },
];

export const MERCHANT_LINES = {
  first: "Un long voyage t'attend, jeune ninja. Repasse me voir lorsque tu en auras besoin !",
  again: 'Te revoilà ! Regarde donc ce que la route m\'a apporté.',
  bought: 'Il te va comme un gant. Bonne route, jeune ninja !',
  poor: "Reviens quand ta bourse sera plus lourde.",
  look: (name) => `${name} ? Un bon choix. Regarde-le de près.`,
};

/** Les raretés : nom affiché et couleur du cadre. */
export const RARITIES = {
  origine: { name: 'Origine', color: '#8d8a80' },
  commun: { name: 'Commun', color: '#a8a290' },
  'peu commun': { name: 'Peu commun', color: '#6fae5a' },
  rare: { name: 'Rare', color: '#4f8fd6' },
  'épique': { name: 'Épique', color: '#a46ad6' },
  'légendaire': { name: 'Légendaire', color: '#f0c25a' },
};

// l'aperçu du skin choisi : il enchaîne ces animations
const SHOWCASE = [['idle', 1800], ['run', 1600], ['jump', 900], ['attack', 1000], ['sprint', 1400], ['kick', 900], ['throw', 900]];

/** Fenêtre de la boutique (HTML, au-dessus du jeu, tout l'écran). */
export class Shop {
  /** wardrobe : { skins, meta, test, buy(id) → bool, wear(id) } */
  constructor(root, wardrobe) {
    this.root = root;
    this.wardrobe = wardrobe;
    this.isOpen = false;
    this.tab = SHOP_CATEGORIES[0].id;
    this.selected = null;
    this.confirming = false;
    this.root.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.tabs = this.root.querySelector('[data-tabs]');
    this.list = this.root.querySelector('[data-items]');
    this.detail = this.root.querySelector('[data-detail]');
    this.line = this.root.querySelector('[data-line]');
    this.purse = this.root.querySelector('[data-purse]');
    this.hint = this.root.querySelector('[data-hint]');
    for (const c of SHOP_CATEGORIES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.name;
      b.dataset.tab = c.id;
      b.addEventListener('click', () => this.show(c.id));
      this.tabs.append(b);
    }
    // les flèches passent d'une carte à l'autre
    this.list.addEventListener('keydown', (e) => this.arrows(e));
  }

  open({ firstVisit, save }) {
    this.save = save;
    this.line.textContent = firstVisit ? MERCHANT_LINES.first : MERCHANT_LINES.again;
    this.updatePurse();
    this.root.hidden = false;
    this.isOpen = true;
    this.confirming = false;
    this.selected = this.selected ?? save.skin ?? 'encre';
    this.show(this.tab);
    (this.list.querySelector(`[data-skin="${this.selected}"]`) ?? this.root.querySelector(`[data-tab="${this.tab}"]`))?.focus();
    this.animate();
  }

  close() {
    this.root.hidden = true;
    this.isOpen = false;
    cancelAnimationFrame(this.raf);
    this.onClose?.();
  }

  updatePurse() {
    this.purse.textContent = `${this.save.ryo} ryō`;
  }

  show(id) {
    this.tab = id;
    for (const b of this.tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tab === id));
    const cat = SHOP_CATEGORIES.find((c) => c.id === id);
    this.list.replaceChildren();
    this.detail.replaceChildren();
    this.root.classList.toggle('shop--empty', id !== 'apparences');
    if (id === 'apparences' && this.wardrobe) {
      this.showSkins();
      return;
    }
    this.hint.textContent = '';
    if (!cat.items.length) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = 'Rien sur cet étal pour le moment. Le marchand reviendra avec de nouvelles marchandises.';
      this.list.append(p);
    }
  }

  /** Les skins, du moins cher au plus cher. */
  ids() {
    const { skins } = this.wardrobe;
    return Object.keys(skins).sort((a, b) => (skins[a].price ?? 0) - (skins[b].price ?? 0) || skins[a].name.localeCompare(skins[b].name));
  }

  owned(id) {
    return this.wardrobe.test || id === 'encre' || this.save.skins.includes(id);
  }

  /** La grille des cartes, puis le skin choisi en grand. */
  showSkins() {
    const { skins, meta } = this.wardrobe;
    const f = meta.animations.idle.frames[0];
    this.list.replaceChildren();
    for (const id of this.ids()) {
      const sk = skins[id], rar = RARITIES[sk.rarity ?? 'origine'] ?? RARITIES.commun;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'shop__card';
      card.dataset.skin = id;
      card.style.setProperty('--rar', rar.color);
      card.setAttribute('aria-pressed', String(id === this.selected));
      card.setAttribute('aria-label', `${sk.name}, ${rar.name}`);
      // vignette : KAGE au repos, à la taille des pixels du jeu (chapeau, cornes et capes compris)
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 32;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(sk.sheet, f.x, f.y + 4, 40, 32, 0, 0, 40, 32);
      const tag = document.createElement('span');
      tag.className = 'shop__tag';
      if (this.save.skin === id) { tag.textContent = 'Porté'; tag.classList.add('shop__tag--worn'); }
      else if (this.owned(id)) { tag.textContent = 'Acquis'; tag.classList.add('shop__tag--own'); }
      else { tag.textContent = `${sk.price} ryō`; if (this.save.ryo < sk.price) tag.classList.add('shop__tag--poor'); }
      card.append(cv, tag);
      card.addEventListener('click', () => this.select(id));
      this.list.append(card);
    }
    this.hint.textContent = this.wardrobe.test ? 'Version de test : tous les skins se portent sans achat.' : '';
    this.showDetail();
  }

  select(id) {
    if (id !== this.selected) this.line.textContent = MERCHANT_LINES.look(this.wardrobe.skins[id].name);
    this.selected = id;
    this.confirming = false;
    for (const b of this.list.querySelectorAll('.shop__card')) b.setAttribute('aria-pressed', String(b.dataset.skin === id));
    this.showDetail();
  }

  /** Le skin choisi, en grand : rareté, nom, aperçu animé, description, prix, et l'achat (à confirmer). */
  showDetail() {
    const id = this.selected, sk = this.wardrobe.skins[id];
    if (!sk) return;
    const rar = RARITIES[sk.rarity ?? 'origine'] ?? RARITIES.commun;
    const save = this.save;
    const owned = this.owned(id), worn = save.skin === id;
    this.detail.replaceChildren();
    this.detail.style.setProperty('--rar', rar.color);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const stage = el('div', 'shop__stage');
    this.preview = document.createElement('canvas');
    this.preview.className = 'shop__preview';
    this.preview.width = 114; this.preview.height = 72;
    stage.append(this.preview);
    this.showT0 = performance.now();
    this.detail.append(el('p', 'shop__rar', rar.name), el('h3', 'shop__name', sk.name), stage);
    // (pendant la confirmation, la question prend la place de la description)
    if (!this.confirming) this.detail.append(el('p', 'shop__desc', sk.description ?? sk.blurb ?? ''));
    const act = el('div', 'shop__act');
    act.dataset.act = '';
    if (this.confirming) {
      act.append(el('p', 'shop__ask', `L'acheter pour ${sk.price} ryō ?`));
      const yes = el('button', 'shop__yes', 'Oui, je le prends');
      yes.type = 'button'; yes.dataset.confirm = '';
      yes.addEventListener('click', () => this.buy(id));
      const no = el('button', '', 'Non');
      no.type = 'button'; no.dataset.cancel = '';
      no.addEventListener('click', () => { this.confirming = false; this.showDetail(); this.detail.querySelector('[data-action]')?.focus(); });
      act.append(yes, no);
    } else {
      const b = el('button', 'shop__buy');
      b.type = 'button'; b.dataset.action = '';
      if (worn) { b.textContent = 'Porté'; b.disabled = true; }
      else if (owned) {
        b.textContent = 'Porter';
        b.addEventListener('click', () => { this.wardrobe.wear(id); this.showSkins(); this.focusSkin(id); });
      } else {
        b.textContent = `Acheter · ${sk.price} ryō`;
        if (save.ryo < sk.price) b.classList.add('shop__poor');
        b.addEventListener('click', () => {
          if (save.ryo < sk.price) { this.line.textContent = MERCHANT_LINES.poor; return; }
          this.confirming = true;
          this.showDetail();
          this.detail.querySelector('[data-confirm]')?.focus();
        });
      }
      act.append(b);
    }
    this.detail.append(act);
  }

  buy(id) {
    this.confirming = false;
    if (this.wardrobe.buy(id)) {
      this.line.textContent = MERCHANT_LINES.bought;
      this.updatePurse();
    } else {
      this.line.textContent = MERCHANT_LINES.poor;
    }
    this.showSkins();
    this.focusSkin(id);
  }

  focusSkin(id) {
    this.list.querySelector(`[data-skin="${id}"]`)?.focus();
  }

  /** L'aperçu s'anime tant que la boutique est ouverte. */
  animate() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      if (!this.isOpen) return;
      this.drawPreview();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  drawPreview() {
    const cv = this.preview, sk = this.wardrobe?.skins[this.selected];
    if (!cv || !sk || !cv.isConnected) return;
    const { meta } = this.wardrobe;
    const total = SHOWCASE.reduce((a, [, d]) => a + d, 0);
    let t = (performance.now() - this.showT0) % total, k = 0;
    while (t > SHOWCASE[k][1]) { t -= SHOWCASE[k][1]; k++; }
    const A = meta.animations[SHOWCASE[k][0]] ?? meta.animations.idle;
    let i = 0, acc = 0;
    const dur = A.frames.reduce((a, f) => a + (f.duration ?? 100), 0);
    const tt = A.loop === false ? Math.min(t, dur - 1) : t % dur;
    while (i < A.frames.length - 1 && acc + (A.frames[i].duration ?? 100) <= tt) { acc += A.frames[i].duration ?? 100; i++; }
    const f = A.frames[i], c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    // une ombre portée sous ses pieds
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(20, 68, 40, 2);
    c.drawImage(sk.sheet, f.x, f.y, f.w, f.h, 0, 0, f.w * 2, f.h * 2);
  }

  /** Les flèches passent d'une carte à l'autre. */
  arrows(e) {
    const cards = [...this.list.querySelectorAll('.shop__card')];
    const i = cards.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = Math.max(1, cards.filter((c) => c.offsetTop === cards[0].offsetTop).length);
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = cards[Math.max(0, Math.min(cards.length - 1, i + d))];
    n.focus();
    this.select(n.dataset.skin);
  }
}
