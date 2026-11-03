// Le terrain et les décors du Potager, peints une fois par tranches de 512 px :
//   - la couche « arrière » : fonds d'intérieur (serre, grange), berges des
//     canaux, grands décors, tuiles, herbe et petits décors posés au sol ;
//   - la couche « avant » : herbes hautes, branches, poteaux devant KAGE.
// Les tranches sont peintes à la demande (celles qu'on voit d'abord, puis les
// suivantes une par une pendant le jeu), pour un chargement rapide.
import { Pix, Brush, canvas } from './paint.js';
import { TileMap, paintTiles, paintOverhangs, paintGrassTops, TILE } from './tiles.js';
import { paintProp, propLayers, PROP_REACH, autoDecor, groveLeaves } from './props.js';

const CHUNK = 512;

export class World {
  constructor(level) {
    this.level = level;
    this.map = new TileMap(level);
    this.n = Math.ceil(level.width / CHUNK);
    this.back = new Array(this.n).fill(null);
    this.front = new Array(this.n).fill(null);
    this.frontEmpty = new Array(this.n).fill(false);
    // décors et fonds d'intérieur (serre, grange), avec leurs couches
    this.items = [
      ...level.backdrops.map((b) => ({ ...b, x: Math.floor((b.x0 + b.x1) / 2), y: b.y1 })),
      ...level.props,
    ].map((p) => ({ p, layers: propLayers(p), reach: PROP_REACH[p.type] ?? 160 }));
    // la colline en terrasses est au loin : peinte à part, sous l'eau animée et
    // sous le terrain (la cascade passe derrière les plateformes du premier plan)
    this.hills = this.items.filter((it) => it.p.type === 'terraces_bg').map(({ p }) => {
      const x0 = p.x * TILE - 60, w = p.w * TILE + 120;
      const c = canvas(w, level.height);
      const g = c.getContext('2d');
      g.translate(-x0, 0);
      paintProp(new Brush(g), p, { level, map: this.map, x0, x1: x0 + w }, 'backdrop');
      return { x0, c };
    });
    this.items = this.items.filter((it) => it.p.type !== 'terraces_bg');
    this.next = 0;                       // prochaine tranche à peindre en tâche de fond
  }

  /** Peint la tranche i (si ce n'est pas déjà fait). */
  ensure(i) {
    if (i < 0 || i >= this.n || this.back[i]) return;
    const x0 = i * CHUNK, x1 = x0 + CHUNK, H = this.level.height;
    const env = { level: this.level, map: this.map, x0, x1 };
    // --- couche arrière ---
    const back = canvas(CHUNK, H);
    const bctx = back.getContext('2d');
    bctx.translate(-x0, 0);
    const b = new Brush(bctx);
    const items = this.items.filter(({ p, reach }) => {
      const px = p.x * TILE + TILE / 2;
      return px + reach > x0 && px - reach < x1;
    });
    const paint = (brush, layer) => {
      let n = 0;
      for (const it of items) if (it.layers.includes(layer)) { paintProp(brush, it.p, env, layer); n++; }
      return n;
    };
    paint(b, 'backdrop');
    const tx0 = Math.floor(x0 / TILE) - 1, tx1 = Math.ceil(x1 / TILE) + 1;
    autoDecor(b, this.map, tx0 - 2, tx1 + 2);
    paint(b, 'back');
    // tuiles, peintes pixel par pixel
    const tiles = new Pix(CHUNK + 2 * TILE, H);
    paintTiles(tiles, this.map, tx0, tx1, x0 - TILE);
    paintOverhangs(tiles, this.map, tx0, tx1, x0 - TILE);
    bctx.drawImage(tiles.done(), x0 - TILE, 0);
    paintGrassTops(b, this.map, tx0, tx1);
    groveLeaves(b, this.map, tx0, tx1);
    paint(b, 'ground');
    this.back[i] = back;
    // --- couche avant ---
    const front = canvas(CHUNK, H);
    const fctx = front.getContext('2d');
    fctx.translate(-x0, 0);
    const any = paint(new Brush(fctx), 'front') > 0;
    this.front[i] = front;
    this.frontEmpty[i] = !any;
  }

  /** À appeler à chaque image : peint au plus une tranche d'avance. */
  idle(cam, viewW) {
    const a = Math.floor(cam.x / CHUNK), z = Math.floor((cam.x + viewW) / CHUNK);
    for (let i = a; i <= z; i++) this.ensure(i);
    // d'avance : les tranches voisines, puis tout le reste, une par image
    for (const i of [z + 1, a - 1]) if (i >= 0 && i < this.n && !this.back[i]) { this.ensure(i); return; }
    while (this.next < this.n && this.back[this.next]) this.next++;
    if (this.next < this.n) this.ensure(this.next);
  }

  drawHills(ctx, cam, viewW) {
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    for (const h of this.hills) {
      if (h.x0 - cx > viewW || h.x0 + h.c.width - cx < 0) continue;
      ctx.drawImage(h.c, h.x0 - cx, -cy);
    }
  }

  draw(ctx, layer, cam, viewW, viewH) {
    const arr = layer === 'front' ? this.front : this.back;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    const a = Math.floor(cx / CHUNK), z = Math.floor((cx + viewW) / CHUNK);
    for (let i = Math.max(0, a); i <= Math.min(this.n - 1, z); i++) {
      this.ensure(i);
      if (layer === 'front' && this.frontEmpty[i]) continue;
      const sx = i * CHUNK - cx;
      ctx.drawImage(arr[i], 0, Math.max(0, cy), CHUNK, Math.min(viewH, this.level.height - Math.max(0, cy)), sx, Math.max(0, -cy), CHUNK, Math.min(viewH, this.level.height - Math.max(0, cy)));
    }
  }
}
