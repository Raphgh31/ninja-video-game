// La Forêt peinte : point d'entrée utilisé par level.js (comme PotagerArt).
//   drawBack   : (le fond a son propre calque, voir main.js) décors lointains,
//                terrain, décors posés sur le terrain ;
//   drawBehind : ce qui bouge derrière KAGE (travées, troncs flottants, lianes, statue…) ;
//   drawFront  : devant KAGE (eau, joue de la statue, éboulis, pénombre, premier plan).
// Rien n'est peint d'un bloc au chargement : le fond de la première zone, puis
// une pièce par image (tranche de terrain, décor, plan du fond) autour de la caméra.
import { ForetBackdrop } from './backdrop.js';
import { ForetProps } from './props.js';
import { ForetWorld } from './world.js';
import { ForetLive } from './live.js';
import * as C from './palette.js';

export class ForetArt {
  constructor(level) {
    this.level = level;
    const t0 = performance.now();
    this.backdrop = new ForetBackdrop(level);
    this.props = new ForetProps(level);
    this.world = new ForetWorld(level, this.props.mask);
    this.live = new ForetLive(level, this);
    this.prep = this.backdrop.prepareAll();      // (tout le fond d'avance : aucun à-coup en jouant)
    this.frame = 0;
    this.buildMs = Math.round(performance.now() - t0);
  }

  /**
   * Les lieux souterrains, en rectangles du monde { x0, y0, x1, y1, fade } (fade : le fondu, en px, sous leur
   * bord haut) : la caverne (zone à la lumière de grotte), les galeries de l'ascension, l'arbre creux et le
   * tunnel de la statue (et leur profondeur), et dans l'arène, ce qui est sous le sol. Le cycle du jour et de
   * la nuit ne les touche pas : sous terre, la lumière est toujours la même (src/game/daylight.js).
   */
  undergroundRects() {
    if (this.under) return this.under;
    const L = this.level, f = L.forest?.def ?? L.forest, R = [];
    const BIG = 1e7;
    for (const z of L.zones ?? []) if (C.MOODS[z.mood]?.cave) R.push({ x0: z.px0, x1: z.px1, y0: -BIG, y1: BIG, fade: 0 });
    const g = f?.galleries;
    if (g) R.push({ x0: g.x0, x1: g.x1, y0: g.y0, y1: g.y1, fade: 32 });
    const d = f?.dark;
    if (d) {
      R.push({ x0: d.x0, x1: d.x1, y0: d.y0, y1: BIG, fade: 48 });
      if (d.deep) R.push({ x0: d.deep.x0, x1: d.x0, y0: d.deep.y0, y1: BIG, fade: 48 });
    }
    const b = L.arena?.basin;
    if (b) R.push({ x0: -BIG, x1: BIG, y0: (b.top + 1) * 16, y1: BIG, fade: 8 });   // l'arène : sous le sol, le bassin
    return (this.under = R);
  }

  /** Sous terre à ce point du monde : 0 dehors, 1 dedans (avec le fondu du bord haut). */
  undergroundAt(x, y) {
    let u = 0;
    for (const r of this.undergroundRects()) {
      if (x < r.x0 || x >= r.x1 || y >= r.y1) continue;
      u = Math.max(u, r.fade > 0 ? Math.max(0, Math.min(1, (y - r.y0) / r.fade)) : y >= r.y0 ? 1 : 0);
    }
    return u;
  }

  /** La part souterraine de la lumière à cette abscisse (0 dehors, 1 sous terre) : pas de soleil sous terre. */
  caveAt(x, y) {
    if (y != null) return this.undergroundAt(x, y);
    const z = this.level.zones.find((zz) => x >= zz.px0 && x < zz.px1);
    return z && C.MOODS[z.mood]?.cave ? 1 : 0;
  }

  /** Une seule pièce peinte d'avance par image, à tour de rôle. */
  idle(cam, viewW, viewH) {
    const k = this.frame++ % 3;
    if (k === 0 && this.live.idle(cam)) return;
    if (k === 1 && this.props.idle(cam, viewW, viewH)) return;
    if (k === 2) this.backdrop.idle(cam, viewW);
    this.world.idle(cam, viewW, viewH);
  }

  drawBack(ctx, cam, viewW, viewH, time) {
    if (!this.hiBackdrop) this.backdrop.draw(ctx, cam, viewW, viewH, time);
    this.idle(cam, viewW, viewH);
    this.props.draw(ctx, 'behind', cam, viewW, viewH);
    this.world.draw(ctx, 'back', cam, viewW, viewH);
    this.props.draw(ctx, 'over', cam, viewW, viewH);
  }

  drawBehind(ctx, cam, viewW, viewH, time) {
    this.live.drawBehind(ctx, cam, viewW, viewH, time);
  }

  drawFront(ctx, cam, viewW, viewH, time) {
    this.world.draw(ctx, 'front', cam, viewW, viewH);
    this.props.draw(ctx, 'front', cam, viewW, viewH);
    this.live.drawFront(ctx, cam, viewW, viewH, time);
  }
}
