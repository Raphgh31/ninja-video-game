// Boutique du marchand ambulant.
// Pour l'instant, seule l'architecture existe : les rayons sont vides. Plus tard,
// chaque article sera un objet de la forme :
//   { id, name, price, kind: 'skin-ninja' | 'skin-arme' | 'ressource' | 'objet',
//     icon, description, available(save), buy(save) }
// et le marchand pourra proposer un stock différent selon le chapitre.

export const SHOP_CATEGORIES = [
  { id: 'apparences', name: 'Apparences', items: [] },
  { id: 'ressources', name: 'Ressources', items: [] },
  { id: 'objets', name: 'Objets', items: [] },
];

export const MERCHANT_LINES = {
  first: "Un long voyage t'attend, jeune ninja. Repasse me voir lorsque tu en auras besoin !",
  again: 'Te revoilà ! Mes paniers se rempliront au fil de ta route.',
};

/** Fenêtre de la boutique (HTML, au-dessus du jeu). */
export class Shop {
  constructor(root) {
    this.root = root;
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

  open({ firstVisit, ryo }) {
    this.line.textContent = firstVisit ? MERCHANT_LINES.first : MERCHANT_LINES.again;
    this.purse.textContent = `${ryo} ryō`;
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

  show(id) {
    this.tab = id;
    for (const b of this.tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tab === id));
    const cat = SHOP_CATEGORIES.find((c) => c.id === id);
    this.list.replaceChildren();
    if (!cat.items.length) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = 'Rien sur cet étal pour le moment. Le marchand reviendra avec de nouvelles marchandises.';
      this.list.append(p);
    }
  }
}
