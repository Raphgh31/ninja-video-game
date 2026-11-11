// Constructeur de carte des chapitres : chaque zone ajoute ses colonnes de terrain
// et déclare ses éléments (décors, aides, zones, lanternes). Partagé par tous les
// chapitres ; la hauteur de la carte et la ligne du sol de référence sont libres.
// Légende des tuiles : voir maps.js.

const TILE = 16;

export class Builder {
  /** h : hauteur de la carte (cases) ; g : ligne du haut du sol de référence. */
  constructor(h = 22, g = 19) {
    this.H = h;
    this.G = g;
    this.cols = [];
    this.zones = [];
    this.legacy = [];     // colonnes des 3 lanternes d'origine (anciennes sauvegardes)
    this.props = [];
    this.hints = [];
    this.backdrops = [];
    this.cranes = [];
    this.bossDef = null;
  }

  get x() { return this.cols.length; }

  /** n colonnes de sol dont le haut est à la ligne top (matière ch). */
  flat(n, top = this.G, ch = '#') {
    for (let i = 0; i < n; i++) {
      const c = new Array(this.H).fill('.');
      for (let y = top; y < this.H; y++) c[y] = ch;
      this.cols.push(c);
    }
    return this;
  }

  /** n colonnes vides ; fond d'eau (canal, bassin) ou de terre basse (fossé peu profond). */
  gap(n, bottom = 'water') {
    for (let i = 0; i < n; i++) {
      const c = new Array(this.H).fill('.');
      if (bottom === 'water') { c[this.H - 2] = '~'; c[this.H - 1] = '~'; }
      else if (bottom === 'ditch') { c[this.G + 2] = '#'; }
      this.cols.push(c);
    }
    return this;
  }

  /** Pose une tuile (coordonnées absolues). */
  set(x, y, ch) {
    this.cols[x][y] = ch;
    return this;
  }

  /** Rangée horizontale de tuiles (plateforme, poutre). */
  row(x0, n, y, ch = '=') {
    for (let i = 0; i < n; i++) this.cols[x0 + i][y] = ch;
    return this;
  }

  /** Bloc plein (plafond bas, mur, tronc). */
  block(x0, n, y0, y1, ch = '#') {
    for (let i = 0; i < n; i++) for (let y = y0; y <= y1; y++) this.cols[x0 + i][y] = ch;
    return this;
  }

  /** Échelle d'une plateforme à l'autre : pied en bx, haut en tx (en cases, décimales permises). */
  ladder(bx, tx, row, h) {
    return this.prop('ladder', Math.floor(bx), row, { h, bx, tx });
  }

  /** Haut du sol d'une colonne déjà posée. */
  top(x) {
    const c = this.cols[x];
    for (let y = 0; y < this.H; y++) if (c[y] !== '.' && c[y] !== 'o') return y;
    return this.H;
  }

  /** Entité posée sur le sol de la colonne x (ou à la ligne y). */
  on(x, ch, y = null) {
    this.cols[x][(y ?? this.top(x)) - 1] = ch;
    return this;
  }

  /** Ryō à hauteur de hanche au-dessus du sol (ou en l'air, dy carreaux plus haut). */
  coins(xs, dy = 1) {
    for (const x of xs) this.cols[x][this.top(x) - 1 - dy] = 'o';
    return this;
  }

  zone(id, name) {
    const prev = this.zones[this.zones.length - 1];
    if (prev) prev.x1 = this.x;
    this.zones.push({ id, name, x0: this.x, x1: this.x });
    return this;
  }

  prop(type, x, y, extra = {}) {
    this.props.push({ type, x, y, ...extra });
    return this;
  }

  /** Décor posé au fond, derrière tous les autres (une maison derrière les arbres). */
  propBack(type, x, y, extra = {}) {
    this.props.unshift({ type, x, y, ...extra });
    return this;
  }

  hint(kind, x = this.x) {
    this.hints.push({ kind, x });
    return this;
  }

  /** Grue de bambou : un mur de blocs suspendu (w × h cases, haut à la ligne top)
   *  au-dessus d'une fosse de même taille, qu'il comble quand on coupe la corde. */
  crane(id, x0, w, top, h, extra = {}) {
    for (let i = 0; i < w; i++) for (let y = top + h; y < top + 2 * h; y++) this.cols[x0 + i][y] = '.';   // la fosse
    const ropeX = (x0 + w / 2) * TILE;
    this.cranes.push({ id, x0, w, top, h, ropeX, ropeY0: (top - 5) * TILE, ropeY1: top * TILE - 6, ...extra });
    return this;
  }

  backdrop(type, x0, x1, y0, y1, extra = {}) {
    this.backdrops.push({ type, x0, x1, y0, y1, ...extra });
    return this;
  }

  rows() {
    const out = [];
    for (let y = 0; y < this.H; y++) out.push(this.cols.map((c) => c[y]).join(''));
    return out;
  }
}
