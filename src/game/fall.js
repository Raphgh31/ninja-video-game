// Chute des ennemis : un ennemi poussé au-delà d'un bord (coup de pied) tombe.
// S'il retombe sur un sol plus bas, il reprend le combat ; s'il tombe sur des
// pics ou hors du niveau, il est vaincu. En marchant, les ennemis évitent
// toujours le vide d'eux-mêmes : seule une poussée peut les y envoyer.
import { TILE } from './level.js';

export const FALL = {
  gravity: 980,     // px/s² (comme KAGE)
  maxFall: 420,     // px/s
};

/** Y a-t-il du sol sous les pieds (au centre) de l'ennemi ? */
export function groundBelow(e) {
  const lv = e.level;
  if (!lv) return true;
  return lv.solid(Math.floor(e.x / TILE), Math.floor((e.y + 1) / TILE));
}

/** Mur juste devant, dans la direction dir (-1 / 1) ? */
export function wallAhead(e, dir, reach = 10) {
  const lv = e.level;
  if (!lv) return false;
  const tx = Math.floor((e.x + dir * reach) / TILE);
  return lv.solid(tx, Math.floor((e.y - 8) / TILE)) || lv.solid(tx, Math.floor((e.y - 20) / TILE));
}

/**
 * Recul donné par un coup de pied : il ne s'arrête que contre un mur, pas au
 * bord du vide. decel = freinage (px/s²).
 */
export function applyShove(e, dt, decel) {
  if (!e.shove) return;
  const dir = Math.sign(e.shove);
  if (wallAhead(e, dir)) {
    e.shove = 0;
    return;
  }
  e.x += e.shove * dt;
  const v = Math.max(0, Math.abs(e.shove) - (e.falling ? decel * 0.25 : decel) * dt);
  e.shove = dir * v;
}

/**
 * Gère la chute. Renvoie true tant que l'ennemi tombe (son comportement
 * normal est alors suspendu).
 */
export function updateFall(e, dt) {
  const lv = e.level;
  if (!lv) return false;
  if (!e.falling) {
    if (groundBelow(e)) return false;
    e.falling = true;
    e.vy = 0;
    e.onEvent?.('fall_start', { x: e.x, y: e.y, facing: e.facing });
  }
  e.vy = Math.min(FALL.maxFall, e.vy + FALL.gravity * dt);
  const ny = e.y + e.vy * dt;
  const ty = Math.floor((ny + 1) / TILE);
  if (lv.solid(Math.floor(e.x / TILE), ty) && e.y <= ty * TILE) {
    // retombe sur un sol plus bas : il reprend le combat
    e.y = ty * TILE;
    e.falling = false;
    e.vy = 0;
    e.onEvent?.('fall_land', { x: e.x, y: e.y, facing: e.facing });
    return false;
  }
  e.y = ny;
  if (lv.hitsSpike(e.box('body')) || e.y > lv.height + 40) {
    // pics ou hors du niveau : vaincu
    e.falling = false;
    e.hp = 0;
    e.state = 'defeated';
    e.timer = 0;
    e.gone = true;
    e.onEvent?.('fell', { x: e.x, y: Math.min(e.y, lv.height - 4), facing: e.facing });
  }
  return true;
}
