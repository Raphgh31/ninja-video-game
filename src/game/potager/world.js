// Le terrain et les décors du Potager, peints une fois par tranches de 512 px :
//   - la couche « arrière » : fonds d'intérieur (serre, grange), berges des
//     canaux, grands décors, tuiles, herbe et petits décors posés au sol ;
//   - la couche « avant » : herbes hautes, branches, poteaux devant KAGE.
// Les tranches sont peintes à la demande (celles qu'on voit d'abord, puis les
// suivantes une par une pendant le jeu), pour un chargement rapide.
import { Pix, Brush, canvas } from './paint.js';
import { paintCanvas, blit } from '../../engine/brush.js';
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
      // style peint : la colline repeinte une fois, touches un peu plus larges (elle est au loin)
      return { x0, c, pc: level.painted ? paintCanvas(c, { len: 2.6, wid: 1.3, seed: 5 }) : null };
    });
    this.items = this.items.filter((it) => it.p.type !== 'terraces_bg');
    this.next = 0;                       // prochaine tranche à peindre en tâche de fond
    // style peint : les tranches repeintes au pinceau (src/engine/brush.js), seulement près de la caméra
    this.painted = !!level.painted;
    this.pcs = new Map();
  }

  /** La tranche i repeinte (layer : back | front), faite à la demande ; on n'en garde que quelques-unes. */
  paintedChunk(i, layer) {
    const key = `${layer}${i}`;
    let e = this.pcs.get(key);
    if (!e) {
      this.ensure(i);
      const raw = layer === 'front' ? this.front[i] : this.back[i];
      e = { i, pc: paintCanvas(raw, { len: 1.9, wid: 1.1, seed: 100 + i, plume: true, plumeA: 0.45 }) };
      this.pcs.set(key, e);
      if (this.pcs.size > 10) {                         // les plus loin de celle-ci s'en vont
        const far = [...this.pcs.entries()].sort((a, b) => Math.abs(b[1].i - i) - Math.abs(a[1].i - i));
        for (const [k] of far.slice(0, this.pcs.size - 10)) this.pcs.delete(k);
      }
    }
    return e.pc;
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
    if (this.painted) {                                  // la tranche suivante, repeinte d'avance
      for (const i of [z + 1, a - 1]) {
        if (i < 0 || i >= this.n) continue;
        if (!this.pcs.has(`back${i}`)) { this.paintedChunk(i, 'back'); return; }
        if (!this.frontEmpty[i] && !this.pcs.has(`front${i}`)) { this.paintedChunk(i, 'front'); return; }
      }
    }
    while (this.next < this.n && this.back[this.next]) this.next++;
    if (this.next < this.n) this.ensure(this.next);
  }

  drawHills(ctx, cam, viewW) {
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    for (const h of this.hills) {
      if (h.x0 - cx > viewW || h.x0 + h.c.width - cx < 0) continue;
      if (h.pc) blit(ctx, h.pc, 0, 0, h.c.width, h.c.height, h.x0 - cx, -cy);
      else ctx.drawImage(h.c, h.x0 - cx, -cy);
    }
  }

  draw(ctx, layer, cam, viewW, viewH) {
    const arr = layer === 'front' ? this.front : this.back;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    const a = Math.floor(cx / CHUNK), z = Math.floor((cx + viewW) / CHUNK);
    for (let i = Math.max(0, a); i <= Math.min(this.n - 1, z); i++) {
      this.ensure(i);
      if (layer === 'front' && this.frontEmpty[i]) continue;
      const sx = i * CHUNK - cx, sy = Math.max(0, cy), sh = Math.min(viewH, this.level.height - sy);
      if (sh <= 0) continue;
      if (this.painted) blit(ctx, this.paintedChunk(i, layer), 0, sy, CHUNK, sh, sx, Math.max(0, -cy));
      else ctx.drawImage(arr[i], 0, sy, CHUNK, sh, sx, Math.max(0, -cy), CHUNK, sh);
    }
  }
}
