// Boutique du marchand ambulant.
// Rayon « Apparences » : les skins de KAGE (assets/characters/kage/skins/*.json,
// champ `price` en ryō), à acheter puis à porter ; Encre est toujours possédé.
// Version de test (window.__KAGE_TEST) : tous les skins se portent sans achat.
// Les rayons Ressources et Objets sont encore vides.

export const SHOP_CATEGORIES = [
  { id: 'apparences', name: 'Apparences', items: [] },
  { id: 'ressources', name: 'Ressources', items: [] },
  { id: 'objets', name: 'Objets', items: [] },
];

export const MERCHANT_LINES = {
  first: "Un long voyage t'attend, jeune ninja. Repasse me voir lorsque tu en auras besoin !",
  again: 'Te revoilà ! Mes paniers se rempliront au fil de ta route.',
  bought: 'Il te va comme un gant. Bonne route, jeune ninja !',
  poor: "Reviens quand ta bourse sera plus lourde.",
};

/** Fenêtre de la boutique (HTML, au-dessus du jeu). */
export class Shop {
  /** wardrobe : { skins, meta, test, buy(id) → bool, wear(id) } */
  constructor(root, wardrobe) {
    this.root = root;
    this.wardrobe = wardrobe;
    this.isOpen = false;
    this.tab = SHOP_CATEGORIES[0].id;
    this.root.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.tabs = this.root.querySelector('[data-tabs]');
    this.list = this.root.querySelector('[data-items]');
    this.line = this.root.querySelector('[data-line]');
    this.purse = this.root.querySelector('[data-purse]');
    for (const c of SHOP_CATEGORIES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.name;
      b.dataset.tab = c.id;
      b.addEventListener('click', () => this.show(c.id));
      this.tabs.append(b);
    }
  }

  open({ firstVisit, save }) {
    this.save = save;
    this.line.textContent = firstVisit ? MERCHANT_LINES.first : MERCHANT_LINES.again;
    this.updatePurse();
    this.root.hidden = false;
    this.isOpen = true;
    this.show(this.tab);
    this.root.querySelector(`[data-tab="${this.tab}"]`)?.focus();
  }

  close() {
    this.root.hidden = true;
    this.isOpen = false;
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
    if (id === 'apparences' && this.wardrobe) {
      this.showSkins();
      return;
    }
    if (!cat.items.length) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = 'Rien sur cet étal pour le moment. Le marchand reviendra avec de nouvelles marchandises.';
      this.list.append(p);
    }
  }

  /** Rayon des skins : vignette, nom, description, et Acheter / Porter / Porté. */
  showSkins() {
    const { skins, meta, test } = this.wardrobe;
    const save = this.save;
    const f = meta.animations.idle.frames[0];
    this.list.replaceChildren();
    const ids = Object.keys(skins).sort((a, b) => (skins[a].price ?? 0) - (skins[b].price ?? 0));
    for (const id of ids) {
      const sk = skins[id];
      const owned = test || id === 'encre' || save.skins.includes(id);
      const worn = save.skin === id;
      const row = document.createElement('div');
      row.className = 'shop__item';
      row.dataset.skin = id;
      // vignette : KAGE au repos, ×3, pixels nets
      const z = 3;
      const cv = document.createElement('canvas');
      cv.width = 32 * z;
      cv.height = 26 * z;
      cv.className = 'shop__thumb';
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(sk.sheet, f.x, f.y + 6, 32, 26, 0, 0, 32 * z, 26 * z);
      const text = document.createElement('div');
      text.className = 'shop__text';
      const name = document.createElement('strong');
      name.textContent = sk.name;
      const desc = document.createElement('span');
      desc.textContent = sk.blurb ?? sk.description ?? '';
      text.append(name, desc);
      const b = document.createElement('button');
      b.type = 'button';
      if (worn) {
        b.textContent = 'Porté';
        b.disabled = true;
      } else if (owned) {
        b.textContent = 'Porter';
        b.addEventListener('click', () => { this.wardrobe.wear(id); this.showSkins(); this.focusSkin(id); });
      } else {
        b.textContent = `Acheter · ${sk.price} ryō`;
        if (save.ryo < sk.price) b.classList.add('shop__poor');
        b.addEventListener('click', () => {
          if (this.wardrobe.buy(id)) {
            this.line.textContent = MERCHANT_LINES.bought;
            this.updatePurse();
          } else {
            this.line.textContent = MERCHANT_LINES.poor;
          }
          this.showSkins();
          this.focusSkin(id);
        });
      }
      row.append(cv, text, b);
      this.list.append(row);
    }
    if (test) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = 'Version de test : tous les skins se portent sans achat.';
      this.list.append(p);
    }
  }

  focusSkin(id) {
    this.list.querySelector(`[data-skin="${id}"] button`)?.focus();
  }
}
