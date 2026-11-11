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

export class ForetArt {
  constructor(level) {
    this.level = level;
    const t0 = performance.now();
    this.backdrop = new ForetBackdrop(level);
    this.props = new ForetProps(level);
    this.world = new ForetWorld(level, this.props.mask);
    this.live = new ForetLive(level, this);
    this.frame = 0;
    this.buildMs = Math.round(performance.now() - t0);
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
