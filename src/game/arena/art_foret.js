// Mode combat — le dessin propre à l'arène de la Forêt (« La clairière de la statue »).
// Le terrain, les souches, le tronc couché, les arbres, le tronc flottant, les lianes,
// les planches et l'eau sont ceux du chapitre (src/game/foret/, ForetArt) ; ici :
//   - au loin, glissés entre les plans de la forêt (calque du paysage) : le temple
//     d'où l'on vient, sur sa butte, et la statue oubliée, colossale, à demi enfouie,
//     voilés par la brume du matin (décor seul : aucun mécanisme) ;
//   - le bassin : sa surface suit le niveau de l'eau (arena.js) ; la source qui
//     coule du rocher, plus forte quand l'eau monte ; des bulles et des cercles ;
//   - les cœurs (comme au Potager).
import { ArenaArt } from './art.js';
import { Pix, canvas, ih, noise2, pick, mixHex } from '../potager/paint.js';
import * as C from '../foret/palette.js';
import * as L from '../foret/layers.js';
import { paintStatue, STATUE } from '../foret/statue.js';

const TILE = 16;
const R = Math.round;

// le décor lointain : abscisse (px du monde, au centre de la caméra), défilement, voile de brume
const VISTA = {
  temple: { before: 'mistA', x: 140, fx: 0.07, fy: 0.1, haze: 0.4, drop: -26 },
  statue: { before: 'mistB', x: 330, fx: 0.24, fy: 0.2, haze: 0.2, drop: 70 },
};

/** Voile une image vers la couleur de la brume (k : part de la brume), à la manière des plans du fond. */
function hazed(src, haze, k) {
  const c = canvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const h = [parseInt(haze.slice(1, 3), 16), parseInt(haze.slice(3, 5), 16), parseInt(haze.slice(5, 7), 16)];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    // plus bas, plus de brume (elle monte du sol)
    const y = Math.floor(i / 4 / c.width), kk = Math.min(0.9, k + Math.max(0, y / c.height - 0.55) * 0.9);
    for (let j = 0; j < 3; j++) d[i + j] = Math.round(d[i + j] * (1 - kk) + h[j] * kk);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Le temple, au loin, sur sa butte : le pavillon du Potager vu de trois quarts arrière,
 * un soubassement de pierre et ses marches, quatre piliers vermillon, des murs enduits,
 * deux toits de tuiles sombres aux coins relevés, un épi de faîtage ; des pins autour.
 */
function paintTemple() {
  const W = 110, H = 92, p = new Pix(W, H);
  const VER = ['#5a1e16', '#7e2a1e', '#a83b2a', '#c95a3e'], WALL = ['#9a907c', '#bdb39a', '#d9d0b6'];
  const TIL = ['#1f262c', '#2c353d', '#3e4a53', '#56636b'], STONE = ['#4a5257', '#646d70', '#80898a', '#a3abaa'];
  const cx = 55, base = 78;
  // la butte : une motte de rochers et de mousse
  for (let y = base - 4; y < H; y++) for (let x = 0; x < W; x++) {
    const top = base - 6 + Math.round(Math.abs(x - cx) * 0.22 + (noise2(x * 0.12, 1, 3) - 0.5) * 6);
    if (y < top) continue;
    const v = 0.65 - (y - top) / 22 - (x - cx) / 200;
    p.set(x, y, noise2(x * 0.2, y * 0.2, 7) > 0.55 ? pick(C.MOSS.slice(2), v, x, y) : pick(STONE, v, x, y));
  }
  // le soubassement de pierre, les marches au milieu
  for (let y = base - 9; y < base - 3; y++) for (let x = cx - 30; x < cx + 30; x++) p.set(x, y, pick(STONE, 0.75 - (y - base + 9) * 0.08 - (x - cx) / 160, x, y));
  for (let k = 0; k < 4; k++) for (let x = cx - 7 + k; x < cx + 7 - k; x++) p.set(x, base - 3 + k, STONE[3 - Math.min(2, k)]);
  // le corps du pavillon : murs enduits entre quatre piliers vermillon
  const y0 = base - 33, y1 = base - 9;
  for (let y = y0; y < y1; y++) for (let x = cx - 24; x < cx + 24; x++) p.set(x, y, pick(WALL, 0.7 - (x - cx) / 90 - (y - y0) / 80, x, y));
  for (let y = y0 + 6; y < y1; y++) for (let x = cx - 6; x < cx + 6; x++) p.set(x, y, y < y0 + 8 ? '#3a2416' : '#1c140f');   // la porte ouverte
  for (const px of [cx - 25, cx - 9, cx + 7, cx + 22]) for (let y = y0 - 1; y < y1; y++) for (let i = 0; i < 3; i++) p.set(px + i, y, VER[i === 0 ? 3 : i === 2 ? 0 : 2]);
  for (let x = cx - 27; x < cx + 27; x++) { p.set(x, y0 - 2, VER[1]); p.set(x, y0 - 1, VER[2]); }   // la poutre
  // un toit de tuiles : large en bas, coins relevés, faîte sombre
  const roof = (yb, half, h) => {
    for (let y = yb - h; y <= yb; y++) {
      const t = (y - (yb - h)) / h, ext = Math.round(half * (0.55 + 0.45 * t));
      for (let x = cx - ext; x <= cx + ext; x++) {
        const u = Math.abs(x - cx) / ext;
        let c = pick(TIL, 0.75 - t * 0.5 - (x - cx) / (half * 5), x, y);
        if ((y - yb) % 3 === 0) c = TIL[0];
        p.set(x, y, c);
      }
      for (const s of [-1, 1]) p.set(cx + s * (ext + 1), y, TIL[1]);
    }
    for (const s of [-1, 1]) { p.set(cx + s * (half + 1), yb - 1, TIL[2]); p.set(cx + s * (half + 2), yb - 2, TIL[3]); p.set(cx + s * (half + 3), yb - 3, TIL[3]); }   // les coins relevés
    for (let x = cx - Math.round(half * 0.55); x <= cx + Math.round(half * 0.55); x++) p.set(x, yb - h - 1, TIL[0]);
  };
  roof(y0 - 3, 36, 9);
  // l'étage : un petit corps, un second toit, l'épi de faîtage
  for (let y = y0 - 20; y < y0 - 12; y++) for (let x = cx - 13; x < cx + 13; x++) p.set(x, y, pick(WALL, 0.6 - (x - cx) / 60, x, y));
  for (const px of [cx - 14, cx + 12]) for (let y = y0 - 21; y < y0 - 12; y++) for (let i = 0; i < 2; i++) p.set(px + i, y, VER[i ? 1 : 3]);
  roof(y0 - 21, 22, 7);
  for (let y = y0 - 34; y < y0 - 28; y++) p.set(cx, y, y < y0 - 32 ? '#c9a24a' : TIL[1]);
  // des pins autour, et une lanterne de pierre au pied des marches
  L.fir(p, 12, base + 2, 44, 10, [C.PINE[2], C.PINE[3], C.PINE[5]], 31);
  L.fir(p, 98, base + 4, 52, 12, [C.PINE[2], C.PINE[3], C.PINE[5]], 37);
  L.fir(p, 86, base + 6, 30, 8, [C.PINE[1], C.PINE[3], C.PINE[4]], 41);
  return p.done();
}

/** La statue oubliée, au loin : la même tête (statue.js), ses lianes et sa chevelure de feuillage. */
function paintFarStatue() {
  const art = paintStatue();
  const c = canvas(STATUE.w, STATUE.h), g = c.getContext('2d');
  g.drawImage(art.stone, 0, 0);
  g.drawImage(art.hair, 0, 0);
  return c;
}

export class ForetArenaArt extends ArenaArt {
  constructor(level) {
    super(level);
    const bd = level.art.backdrop, mood = C.MOODS[level.zones[0]?.mood] ?? C.MOODS.matin;
    this.vistaImg = {
      temple: hazed(paintTemple(), mood.haze, VISTA.temple.haze),
      statue: hazed(paintFarStatue(), mood.haze, VISTA.statue.haze),
    };
    bd.vista = (ctx, before, cam, viewW, viewH) => {
      for (const [id, v] of Object.entries(VISTA)) {
        if (v.before !== before) continue;
        const img = this.vistaImg[id];
        const x = bd.q(v.x - cam.x * v.fx + viewW / 2 - 224 - img.width / 2);
        const y = bd.groundAt(v.fy, cam, viewH) - img.height + v.drop;
        if (x > viewW || x + img.width < 0) continue;
        ctx.drawImage(img, x, y);
      }
    };
    this.bubbles = [];
    // sous terre (la petite grotte), le soleil, ses rais et ses poussières s'effacent (daylight.js) :
    // caveK monte quand KAGE descend dans la grotte, et retombe quand il en sort
    this.caveK = 0;
    level.art.caveAt = () => this.caveK;
  }

  /** La surface de l'eau du bassin, telle que live.js la peint (elle suit le niveau). */
  syncWater() {
    const b = this.a.basin, live = this.level.art?.live;
    if (!b || !live || b.y == null) return;
    this.water ??= live.waters.find((w) => !w.sub && w.x === b.x0 * TILE);
    if (!this.water) return;
    this.water.y = R(b.y) - 3;
    this.water.h = this.level.h * TILE - this.water.y;
  }

  drawBack(ctx, cam, time) {
    const ox = -R(cam.x), oy = -R(cam.y);
    const cv = this.a.def.cave, p = this.level.player;
    const under = !!cv && !!p && p.x >= cv.x0 - 8 && p.x < cv.x1 + 8 && p.y > cv.y;
    this.caveK += ((under ? 1 : 0) - this.caveK) * 0.08;
    if (this.caveK < 0.01) this.caveK = 0;
    this.syncWater();
    this.drawSpring(ctx, ox, oy, time);
    this.drawPickups(ctx, ox, oy, time);
  }

  drawFront(ctx, cam, time) {
    const ox = -R(cam.x), oy = -R(cam.y);
    this.drawSurface(ctx, ox, oy, time);
  }

  /**
   * La source : un filet d'eau tombe du rocher moussu, par-dessus le bord de pierre, dans le
   * bassin. Il grossit quand l'eau monte (on l'entend, on le voit : la crue s'annonce).
   */
  drawSpring(ctx, ox, oy, time) {
    const b = this.a.basin;
    if (!b?.spring) return;
    const rising = b.phase === 'rise' || b.phase === 'flood' || b.phase === 'mid';
    const w = rising ? (b.phase === 'mid' ? 3 : 4) : 1;
    const x = b.x1 * TILE + ox, lip = b.spring.y + 2 + oy, surf = R(b.y) + oy;
    // le filet, du rocher jusqu'au bord, puis le long de la paroi jusqu'à la surface
    for (let y = lip; y < surf; y++) {
      const k = (y - lip) / Math.max(1, surf - lip), wob = R(Math.sin(time * 9 + y * 0.6) * 0.6);
      const xx = x + 3 - R(Math.min(1, k * 3) * 4) + wob;
      for (let i = 0; i < w; i++) {
        const lit = i === 0 || (y + R(time * 40)) % 7 === 0;
        ctx.fillStyle = lit ? C.WATER[5] : C.WATER[i === w - 1 ? 3 : 4];
        ctx.globalAlpha = rising ? 0.95 : 0.7;
        ctx.fillRect(xx - i, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    // l'écume au pied du filet
    ctx.fillStyle = C.WATER[5];
    for (let i = 0; i < (rising ? 6 : 2); i++) {
      const fx = x - 1 - R(Math.abs(Math.sin(time * 5 + i * 2.1)) * (rising ? 9 : 4)) - i;
      ctx.fillRect(fx, surf - (i % 2), 1 + (i % 2), 1);
    }
  }

  /** Bulles et cercles à la surface quand l'eau monte ; quelques reflets quand elle redescend. */
  drawSurface(ctx, ox, oy, time) {
    const b = this.a.basin;
    if (!b) return;
    const x0 = b.x0 * TILE, x1 = b.x1 * TILE, y = R(b.y);
    const rising = b.phase === 'rise' || b.phase === 'flood';
    if (rising && Math.random() < 0.35) this.bubbles.push({ x: x0 + 6 + Math.random() * (x1 - x0 - 12), t: 0, life: 0.6 + Math.random() * 0.6 });
    for (const q of this.bubbles) q.t += 1 / 60;
    this.bubbles = this.bubbles.filter((q) => q.t < q.life).slice(-40);
    for (const q of this.bubbles) {
      const k = q.t / q.life, r = R(1 + k * 4);
      ctx.globalAlpha = 0.7 * (1 - k);
      ctx.fillStyle = C.WATER[5];
      ctx.fillRect(R(q.x) + ox - r, y + oy, 1, 1);
      ctx.fillRect(R(q.x) + ox + r, y + oy, 1, 1);
      if (k < 0.3) ctx.fillRect(R(q.x) + ox, y + oy - 1, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
