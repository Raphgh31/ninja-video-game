// Le Potager peint : point d'entrée utilisé par level.js.
//   drawBack   : ciel, montagnes et plans de paysage, puis le terrain et ses décors ;
//   drawBehind : ce qui bouge derrière les personnages (eau, roue, koïs, marchand…) ;
//   drawFront  : premier plan, pluie, lumière, vie sauvage.
import { Backdrop } from './backdrop.js';
import { World } from './world.js';
import { Live } from './live.js';
import { canvas, Brush, pick } from './paint.js';
import * as C from './palette.js';

const TILE = 16;

/** Caisse de bois cerclée (elle se brise au sabre). */
function crateSprite() {
  const c = canvas(TILE, TILE);
  const b = new Brush(c.getContext('2d'));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 0.55 - x * 0.012 - y * 0.012 + ((x + 1) % 5 === 0 ? -0.2 : 0);
    b.p(x, y, pick(C.WOOD, Math.max(0, Math.min(1, v)), x, y));
  }
  b.r(0, 0, 16, 2, C.WOOD[1]).r(0, 14, 16, 2, C.WOOD[1]).r(0, 0, 2, 16, C.WOOD[1]).r(14, 0, 2, 16, C.WOOD[1]);
  b.r(0, 0, 16, 1, C.WOOD[4]).r(0, 0, 1, 16, C.WOOD[3]).r(15, 0, 1, 16, C.WOOD[0]).r(0, 15, 16, 1, C.WOOD[0]);
  for (let k = 2; k < 14; k++) { b.p(k, k, C.WOOD[1]); b.p(k + 1, k, C.WOOD[1]); b.p(k, k - 1, C.WOOD[4]); }
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) b.p(x, y, '#8e939c');
  return c;
}

export class PotagerArt {
  constructor(level) {
    this.level = level;
    const t0 = performance.now();
    this.backdrop = new Backdrop(level);
    this.world = new World(level);
    this.live = new Live(level, this.world.map);
    this.crate = crateSprite();
    this.buildMs = Math.round(performance.now() - t0);
  }

  drawBack(ctx, cam, viewW, viewH, time) {
    this.backdrop.draw(ctx, cam, viewW, viewH, time);
    this.world.idle(cam, viewW);
    this.world.draw(ctx, 'back', cam, viewW, viewH);
    // caisses : elles disparaissent quand on les brise
    for (const cr of this.level.crates.values()) {
      const sx = Math.round(cr.tx * TILE - cam.x), sy = Math.round(cr.ty * TILE - cam.y);
      if (sx < -TILE || sx > viewW) continue;
      ctx.drawImage(this.crate, sx, sy);
    }
  }

  drawBehind(ctx, cam, viewW, viewH, time) {
    this.live.drawBehind(ctx, cam, viewW, viewH, time);
  }

  drawFront(ctx, cam, viewW, viewH, time) {
    this.world.draw(ctx, 'front', cam, viewW, viewH);
    this.live.drawFront(ctx, cam, viewW, viewH, time);
    this.backdrop.drawFore(ctx, cam, viewW, viewH);
  }
}
