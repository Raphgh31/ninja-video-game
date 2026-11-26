// L'éclair d'un coup reçu : la silhouette du personnage, d'une seule couleur (blanc par défaut),
// pendant une ou deux images (combat.js : IMPACT.flash). Chaque image de la feuille est recolorée
// une seule fois, puis gardée.
import { canvas } from '../game/potager/paint.js';

const cache = new WeakMap();   // feuille -> Map('frame,couleur' -> toile)

function tinted(sheet, f, color) {
  let m = cache.get(sheet);
  if (!m) cache.set(sheet, (m = new Map()));
  const key = `${f.x},${f.y},${color}`;
  let c = m.get(key);
  if (!c) {
    const P = sheet.P ?? 1;
    c = canvas(f.w, f.h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = !!sheet.smooth;
    g.drawImage(sheet, f.x * P, f.y * P, f.w * P, f.h * P, 0, 0, f.w, f.h);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, f.w, f.h);
    m.set(key, c);
  }
  return c;
}

/** Dessine l'image courante de l'animateur `anim`, en silhouette de couleur `color`, ancrée en (x, y). */
export function drawWhite(ctx, sheet, anim, x, y, facing = 1, color = '#ffffff') {
  const f = anim.anim.frames[anim.frame];
  drawWhiteFrame(ctx, sheet, f, anim.meta.pivot, anim.meta.flipForLeft, x, y, facing, color);
}

/** Même chose pour une image donnée (les autres joueurs : multi.js). */
export function drawWhiteFrame(ctx, sheet, f, pivot, flipForLeft, x, y, facing = 1, color = '#ffffff') {
  const c = tinted(sheet, f, color), dx = Math.round(x), dy = Math.round(y) - pivot.y;
  ctx.save();
  if (facing < 0 && flipForLeft) {
    ctx.translate(dx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(c, -pivot.x, dy);
  } else ctx.drawImage(c, dx - pivot.x, dy);
  ctx.restore();
}
