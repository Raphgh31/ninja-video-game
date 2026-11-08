// Tuiles du Potager, peintes pixel par pixel selon leur matière et leur
// contexte : le style d'une tuile dépend de la zone (murets de pierre sèche des
// terrasses, racines de la serre, poutres de la grange…), de ses voisines (herbe
// sur le dessus, bords arrondis, flancs ombrés) et de sa profondeur.
import { worley, noise1, noise2, fbm1, ih, pick, mix, hex } from './paint.js';
import * as C from './palette.js';

export const TILE = 16;
export const G = 19;                          // haut du sol de référence

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const SOLID = new Set(['#', '=', '|', '-']);   // « - » : passerelle (traversable par-dessous), peinte comme le reste

/** Analyse du terrain : style de chaque tuile, haut des colonnes, zones. */
export class TileMap {
  constructor(level) {
    this.level = level;
    this.w = level.w;
    this.h = level.h;
    this.zone = new Array(this.w).fill('01');
    for (const z of level.zones) for (let x = z.x0; x < z.x1 && x < this.w; x++) this.zone[x] = z.id;
    this.style = new Map();
    // fosses des grues : ce ne sont pas des canaux (pas de berge ni d'eau peintes)
    this.pitCols = new Set();
    for (const c of level.cranes ?? []) for (let x = c.x0; x < c.x0 + c.w; x++) this.pitCols.add(x);
    for (let tx = 0; tx < this.w; tx++) {
      for (let ty = 0; ty < this.h; ty++) {
        const t = level.rows[ty][tx];
        if (!SOLID.has(t) && t !== 'B') continue;
        this.style.set(tx + ',' + ty, this.classify(tx, ty, t));
      }
    }
  }

  at(tx, ty) {
    if (tx < 0 || tx >= this.w) return '#';
    if (ty < 0 || ty >= this.h) return '.';
    const c = this.level.rows[ty][tx];
    return c === 'B' ? '.' : c;   // les caisses (cassables) ne comptent pas comme terrain
  }

  solid(tx, ty) { return SOLID.has(this.at(tx, ty)); }

  /** La colonne est-elle pleine de cette tuile jusqu'en bas de la carte ? */
  grounded(tx, ty) {
    for (let y = ty; y < this.h; y++) if (!SOLID.has(this.at(tx, y)) && this.at(tx, y) !== '~') return false;
    return true;
  }

  classify(tx, ty, t) {
    const z = this.zone[tx];
    if (t === '-') return z === '05' ? 'rafter' : 'plank';
    if (t === '=') {
      if (z === '05') return 'shelf';
      if (z === '06') return 'beam';
      if (z === '04') return 'branch';
      return 'deck';
    }
    if (t === '|') {
      // bambous serrés en bosquet (murs pour le saut mural, feuillage bas) ; une
      // rangée seule (toit de la serre) reste une traverse de bambou ligaturé
      const vert = this.at(tx, ty - 1) === '|' || this.at(tx, ty + 1) === '|';
      return vert ? 'grove' : 'bamboo_h';
    }
    if (t !== '#') return 'soil';
    // roche en surplomb (falaise de la grue, zone 3) : de la pierre, pas de la terre
    if (!this.grounded(tx, ty)) return z === '05' ? 'roots' : z === '03' ? 'stone' : 'soil';
    if (ty < G) {
      // poteau isolé de la zone 1 : la clôture basse, en bambou
      if (z === '01' && !this.solid(tx - 1, ty) && !this.solid(tx + 1, ty)) {
        let top = ty; while (top > 0 && this.solid(tx, top - 1)) top--;
        if (G - top >= 2) return 'bamboo_v';
      }
      // relief au-dessus du sol de référence : murets, terrasses, marches
      let base = ty; while (base < this.h && this.solid(tx, base)) base++;
      let top = ty; while (top > 0 && this.solid(tx, top - 1)) top--;
      const height = G - top;
      if (z === '02' || (z === '01' && height >= 2)) return 'stone';
      if (z === '07') return 'cut';
      return 'soil';
    }
    if (z === '06') return 'floor';
    return 'soil';
  }

  styleAt(tx, ty) { return this.style.get(tx + ',' + ty); }
}

// ---------------------------------------------------------------------------
// peinture d'une tuile dans un tampon de pixels (coordonnées du monde : wx, wy)
// ---------------------------------------------------------------------------

/** Profondeur (en px) depuis la surface libre au-dessus, dans la même colonne de tuiles. */
function depthBelowAir(map, tx, ty, py) {
  let k = 0;
  while (ty - k - 1 >= 0 && map.solid(tx, ty - k - 1)) k++;
  return k * TILE + py;
}

// épaisseur du tapis d'herbe : irrégulière, avec des coulures
function grassDepth(wx, seed = 0) {
  const n = noise1(wx * 0.35, seed);
  let d = 4 + Math.round(n * 2);
  // coulures en pointe : une touffe pend sur 3 à 5 px, en s'affinant
  const k = Math.floor(wx / 5), c = ih(k, 0, seed + 7);
  if (c < 0.32) {
    const len = 2 + Math.floor(ih(k, 1, seed) * 4), mid = k * 5 + 2, off = Math.abs(wx - mid);
    d += Math.max(0, len - off * 2);
  }
  return d;
}

function soilColor(wx, wy, depth, ramp = C.SOIL, dark = 0) {
  const w = worley(wx, wy, 5, 11, 0.7);
  let v = 0.62 - Math.min(0.46, depth / 60) - (w.dx / 5) * 0.1 - (w.dy / 3.5) * 0.14 - dark;
  if (w.d2 - w.d < 0.6) v -= 0.12;                               // fissure entre les mottes
  // cailloux enchâssés
  if (w.id < 0.025 && w.d < 2) return pick(C.PEBBLE, clamp01(0.55 - w.dx * 0.15 - w.dy * 0.2), wx, wy);
  const big = worley(wx, wy, 15, 17, 0.75);
  if (big.id < 0.045 && big.d < 3.8 && depth > 10) {
    let sv = 0.55 - big.dx * 0.09 - big.dy * 0.12;
    if (big.d > 2.8) sv -= 0.2;
    return pick(C.STONE, clamp01(sv - depth / 200), wx, wy);
  }
  // radicelles près de la surface
  if (depth < 18 && Math.abs(noise2(wx * 0.22, wy * 0.5, 23) - 0.5) < 0.025) return ramp[1];
  return pick(ramp, clamp01(v), wx, wy, 0.25);
}

function grassColor(wx, wy, py, gd) {
  // tapis d'herbe : clair en haut, brins verticaux, sombre en dessous, liseré foncé
  if (py >= gd - 1) return C.GRASS[0];
  let v = 0.84 - (py / gd) * 0.55 + (noise2(wx * 0.6, wy * 0.6, 5) - 0.5) * 0.22;
  if (py <= 1) v += 0.1;
  if ((wx + Math.floor(py / 2)) % 3 === 0 && py > 1) v -= 0.12;   // brins
  return pick(C.GRASS, clamp01(v), wx, wy, 0.3);
}

function stoneWallColor(wx, wy) {
  const w = worley(wx + 3, wy, 6.5, 41, 0.62);
  if (w.d2 - w.d < 1.05) return C.STONE[0];                      // joints creux
  let v = 0.6 - (w.dx / 6.5) * 0.4 - (w.dy / 4) * 0.45 + (w.id - 0.5) * 0.3;
  if (w.d2 - w.d < 1.8 && w.dx + w.dy > 0) v -= 0.18;            // ombre propre en bas à droite
  // mousse sur le dessus de certaines pierres
  if (w.id > 0.62 && w.dy < -1.4) return pick(C.MOSS, clamp01(0.5 - w.dx * 0.08), wx, wy);
  return pick(C.STONE, clamp01(v), wx, wy);
}

function cutStoneColor(wx, wy) {
  // pierres taillées des marches du jardin : assises régulières, joints décalés
  const row = Math.floor(wy / 8), off = (row % 2) * 7;
  const lx = (wx + off) % 14, ly = wy % 8;
  if (lx === 0 || ly === 7) return C.STONE[1];
  let v = 0.66 - ly * 0.03 + (ih(Math.floor((wx + off) / 14), row, 3) - 0.5) * 0.2;
  if (lx === 1 || ly === 0) v += 0.14;
  if (noise2(wx * 0.4, wy * 0.4, 9) > 0.78) return pick(C.MOSS, 0.5, wx, wy);
  return pick(C.STONE, clamp01(v), wx, wy);
}

function rootsColor(wx, wy) {
  // terre sombre traversée de racines enchevêtrées
  const r1 = Math.abs(noise2(wx * 0.11, wy * 0.07, 51) - 0.5), r2 = Math.abs(noise2(wx * 0.07, wy * 0.13, 52) - 0.5);
  const r3 = Math.abs(noise2(wx * 0.18, wy * 0.1, 54) - 0.5);
  if (r1 < 0.05 || r2 < 0.045 || r3 < 0.03) {
    const core = r1 < 0.02 || r2 < 0.018 || r3 < 0.012;
    const v = 0.4 + (core ? 0.25 : 0) + (noise2(wx * 0.5, wy * 0.5, 53) - 0.5) * 0.25;
    return pick(C.WOOD, clamp01(v), wx, wy);
  }
  if (noise2(wx * 0.3, wy * 0.3, 55) > 0.72) return pick(C.MOSS, 0.35, wx, wy);
  return pick(C.SOIL, 0.12 + (noise2(wx * 0.4, wy * 0.4, 56) - 0.5) * 0.2, wx, wy);
}

function floorColor(wx, wy, depth) {
  // sol de terre battue de la grange, paille éparse
  if (depth < 2) return pick(C.SOIL, 0.45 + (noise1(wx * 0.5, 4) - 0.5) * 0.3, wx, wy);
  if (depth < 5 && ih(wx, wy, 8) < 0.12) return C.STRAW[2];
  return soilColor(wx, wy, depth + 30, C.SOIL, 0.08);
}

function deckColor(map, tx, ty, px, py, wx, wy) {
  const topOpen = !map.solid(tx, ty - 1);
  if (topOpen && py < 3) return py === 0 ? C.WOOD[5] : C.WOOD[4];  // plateau clair
  const plank = Math.floor((wx + 1) / 5);
  if ((wx + 1) % 5 === 0) return C.WOOD[1];                        // joints
  if (py === 15 && !map.solid(tx, ty + 1)) return C.WOOD[0];
  if ((py === 5 || py === 12) && (wx + 3) % 5 === 2) return C.WOOD[0];   // clous
  let v = 0.5 + (ih(plank, ty, 5) - 0.5) * 0.3 + (noise2(wx * 0.2, wy * 0.9, 7) - 0.5) * 0.25;
  if ((wx + 1) % 5 === 1) v += 0.12;
  return pick(C.WOOD, clamp01(v), wx, wy);
}

function beamColor(map, tx, ty, px, py, wx, wy) {
  // poutres épaisses de la grange, veinées, bouts sombres
  const topOpen = !map.solid(tx, ty - 1), botOpen = !map.solid(tx, ty + 1);
  if (topOpen && py === 0) return C.WOOD[4];
  if (botOpen && py >= 14) return C.WOOD[0];
  const grain = noise2(wx * 0.08, wy * 0.9, 61);
  let v = 0.42 + (grain - 0.5) * 0.5 - (py / 16) * 0.15;
  if (Math.abs(grain - 0.5) < 0.03) v -= 0.2;
  if (!map.solid(tx - 1, ty) && px < 2) v -= 0.2;
  if (!map.solid(tx + 1, ty) && px > 13) v -= 0.25;
  return pick(C.WOOD, clamp01(v), wx, wy);
}

function branchColor(map, tx, ty, px, py, wx, wy) {
  // grosse branche basse d'un vieux pommier : écorce, mousse dessus, feuilles dessous
  const topOpen = !map.solid(tx, ty - 1);
  const mid = 7 + Math.round((noise1(wx * 0.05, 3) - 0.5) * 5);
  const end = (!map.solid(tx - 1, ty) ? px : 99) + (!map.solid(tx + 1, ty) ? 0 : 0);
  const half = Math.min(4 + Math.round(noise1(wx * 0.11, 4) * 2), 2 + end * 0.4, !map.solid(tx + 1, ty) ? 2 + (15 - px) * 0.5 : 99);
  const d = py - mid;
  if (Math.abs(d) > half) {
    const lf = noise2(wx * 0.25, wy * 0.25, 9);
    if (lf > 0.52 && Math.abs(d) < half + 6) return pick(C.LEAF, clamp01(0.3 + (lf - 0.5) * 2 - (d > 0 ? 0.15 : -0.1)), wx, wy);
    return null;
  }
  if (topOpen && d < -half + 2) return pick(C.MOSS, 0.6, wx, wy);
  let v = 0.6 - (d + half) / (2 * half) * 0.5 + (noise2(wx * 0.3, wy * 0.6, 5) - 0.5) * 0.3;
  if (Math.abs(noise2(wx * 0.12, wy * 0.3, 6) - 0.5) < 0.03) v -= 0.25;
  return pick(C.WOOD, clamp01(v), wx, wy);
}

function shelfColor(map, tx, ty, px, py, wx, wy) {
  // étagère renversée : planches, et des bocaux de graines encore rangés
  const shelfLine = (wy % 16) < 3;
  if (shelfLine) return (wy % 16) === 0 ? C.WOOD[4] : C.WOOD[2];
  if (!map.solid(tx - 1, ty) && px < 2) return C.WOOD[1];
  if (!map.solid(tx + 1, ty) && px > 13) return C.WOOD[0];
  // fond de l'étagère
  const slot = Math.floor(wx / 6), ly = wy % 16;
  if (ly > 5 && ih(slot, ty, 3) < 0.7) {
    const lx = wx % 6;
    if (lx >= 1 && lx <= 4) {
      const kind = Math.floor(ih(slot, ty, 4) * 4);
      if (ly === 6) return C.WOOD[1];                              // couvercle
      const glass = [C.TERRACOTTA, C.PAPER, ['#5d6f52', '#7d9168', '#a7b98f', '#c9d6b3'], ['#7e5c3c', '#a57b52', '#c69b6e', '#dfbf93']][kind];
      return pick(glass, clamp01(0.7 - lx * 0.12 - (ly - 7) * 0.03), wx, wy);
    }
  }
  return pick(C.WOOD, 0.18 + (noise2(wx * 0.3, wy * 0.3, 9) - 0.5) * 0.2, wx, wy);
}

function bambooColor(vert, wx, wy, tx, ty) {
  // tiges de 4 px, nœuds, ligatures de corde noire
  const a = vert ? wx : wy, b = vert ? wy : wx;
  const stalk = Math.floor(a / 4), lane = a % 4;
  const nodeAt = (Math.floor(b / 13) * 13 + Math.floor(ih(stalk, 0, 2) * 13));
  if (b === nodeAt || b === nodeAt + 1) return lane === 0 ? C.BAMBOO[1] : C.BAMBOO[0];
  if ((b % 26) === 20 || (b % 26) === 21) return '#2a2420';      // ligature
  const v = [0.82, 0.62, 0.46, 0.24][lane] + (ih(stalk, 1, 5) - 0.5) * 0.15;
  return pick(C.BAMBOO, clamp01(v), wx, wy);
}

function groveColor(map, tx, ty, px, py, wx, wy) {
  // bosquet de bambous serrés : tiges de 3 px séparées d'ombre, nœuds décalés,
  // feuilles qui débordent, bas plus sombre (on se glisse dessous)
  const lane = (wx + 400) % 4, stalk = Math.floor((wx + 400) / 4);
  const edgeL = !map.solid(tx - 1, ty) && px < 2, edgeR = !map.solid(tx + 1, ty) && px > 13;
  if (edgeL || edgeR) return ih(Math.floor(wx / 2), Math.floor(wy / 5), 87) < 0.5 ? null : C.BAMBOO[0];
  if (lane === 3) return '#22301a';                              // l'ombre entre deux tiges
  const node = (wy + Math.floor(ih(stalk, 0, 86) * 17)) % 17;
  if (node === 0) return C.BAMBOO[0];
  if (node === 1) return C.BAMBOO[4];
  const depth = !map.solid(tx, ty + 1) ? 0.25 : 0;
  const v = [0.78, 0.55, 0.36][lane] + (ih(stalk, 1, 85) - 0.5) * 0.3 - depth;
  return pick(C.BAMBOO, clamp01(v), wx, wy);
}

function plankColor(map, tx, ty, px, py, wx, wy) {
  // passerelle légère sur pilotis : un plateau de planches de 5 px, rien dessous
  if (py > 5) return null;
  const lEnd = map.at(tx - 1, ty) !== '-', rEnd = map.at(tx + 1, ty) !== '-';
  if ((lEnd && px === 0 && py > 3) || (rEnd && px === 15 && py > 3)) return null;   // bouts arrondis
  if (py === 0) return (wx + 1) % 7 === 0 ? C.WOOD[3] : C.WOOD[5];
  if (py === 5) return C.WOOD[0];
  if ((wx + 1) % 7 === 0) return C.WOOD[1];                         // joints des planches
  if (py === 3 && (wx % 7 === 3) && ih(Math.floor(wx / 7), ty, 13) < 0.5) return C.WOOD[1];   // clous
  const v = 0.55 + (ih(Math.floor(wx / 7), ty, 12) - 0.5) * 0.25 + (noise2(wx * 0.3, wy * 0.9, 14) - 0.5) * 0.2 - py * 0.05;
  return pick(C.WOOD, clamp01(v), wx, wy);
}

function rafterColor(map, tx, ty, px, py, wx, wy) {
  // poutre de charpente de la serre : un gros bambou couché, ligaturé aux poteaux
  if (py > 6) return null;
  if (py === 0 || py === 6) return C.BAMBOO[0];
  const node = (wx + Math.floor(ih(tx, ty, 9) * 23)) % 23;
  if (node === 0 || node === 1) return py < 3 ? C.BAMBOO[4] : C.BAMBOO[1];
  if (tx % 3 === 0 && px >= 6 && px <= 8) return '#2a2420';           // ligature de corde
  return pick(C.BAMBOO, clamp01([0.82, 0.88, 0.7, 0.55, 0.4][py - 1] + (noise2(wx * 0.2, 1, 3) - 0.5) * 0.1), wx, wy);
}

// ---------------------------------------------------------------------------
// la masse de terre et de pierre : de grosses pierres taillées en facettes,
// séparées par des joints sombres. La silhouette des flancs suit les pierres :
// une pierre dont le centre est dans le sol est peinte entière, même si elle
// dépasse un peu de sa case (micro-falaises irrégulières, sans toucher aux
// collisions).
// ---------------------------------------------------------------------------
const ROCKY = new Set(['soil', 'stone', 'floor']);
const CELL = 8.5, SQUASH = 0.62, SEED = 211;

/** Style rocheux de la case qui contient le point (wx, wy), ou null. */
function rockyAt(map, wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (tx < 0 || tx >= map.w || ty >= map.h) return 'soil';
  const st = map.styleAt(tx, ty);
  return st && ROCKY.has(st) ? st : null;
}

/** Profondeur sous la surface libre, dans la colonne de la case (tx, ty). */
function surfaceDepth(map, tx, ty, wy) {
  let top = ty; while (top > 0 && map.solid(tx, top - 1)) top--;
  return wy - top * TILE;
}

/**
 * Matière d'une pierre (cellule de centre cx, cy) : la limite entre muret et
 * terre n'est pas une ligne droite. Chaque cellule tire un petit décalage au
 * hasard : près de la limite, des pierres s'enfoncent dans la terre, de la
 * terre remonte entre les pierres, et quelques pierres à demi enterrées
 * parsèment la terre sous le muret (de plus en plus rares en descendant).
 */
function materialOf(map, cx, cy, own) {
  const here = rockyAt(map, cx, cy);
  if (!here) return own === 'stone' ? 'stone' : own;
  const h = ih(Math.round(cx * 2), Math.round(cy * 2), 77);
  const jx = (ih(Math.round(cx), Math.round(cy), 78) - 0.5) * 10, jy = (h - 0.5) * 16;
  const there = rockyAt(map, cx + jx, cy + jy);
  if (here === 'stone') return there && there !== 'stone' ? there : 'stone';
  if (there === 'stone') return 'stone';
  // pierres à demi enterrées sous un muret
  for (const [k, p] of [[10, 0.42], [20, 0.2], [32, 0.08]]) {
    if (rockyAt(map, cx, cy - k) === 'stone') return h < p ? 'stone' : here;
  }
  return here;
}

/** Couleur d'un pixel de la masse rocheuse, ou null s'il est hors de la masse. */
function earthPixel(map, wx, wy, own) {
  const w = worley(wx, wy, CELL, SEED, SQUASH);
  const cx = wx - w.dx, cy = wy - w.dy;
  const ctx = Math.floor(cx / TILE), cty = Math.floor(cy / TILE);
  const pty = Math.floor(wy / TILE);
  const stone = materialOf(map, cx, cy, own) === 'stone';
  if (stone) return stonePixel(map, wx, wy, own, w, cx, cy, ctx, cty, pty);
  // --- terre : la silhouette suit un bord à peine ondulé (±1,5 px), jamais
  //     une coupe droite, jamais les angles vifs des pierres ---
  const ox = (noise1(wy * 0.33, 41) - 0.5) * 3.2 + (ih(wy >> 1, 0, 43) - 0.5) * 0.9;
  const oy = (noise1(wx * 0.33, 42) - 0.5) * 3.2 + (ih(wx >> 1, 0, 44) - 0.5) * 0.9;
  const sx = wx + ox, sy = wy + oy;
  const stx = Math.floor(sx / TILE), sty = Math.floor(sy / TILE);
  let st = rockyAt(map, sx, sy);
  if (!st) {
    if (own && map.solid(stx, sty)) st = own; else return null;
  }
  if (!own) {
    // terre qui déborde : jamais au-dessus d'une surface, jamais dans l'herbe
    if (sty > pty) return null;
    if (surfaceDepth(map, stx, sty, wy) < grassDepth(wx) + 3) return null;
  }
  const depth = surfaceDepth(map, stx, sty, wy);
  const under = depth < grassDepth(wx) + 2 ? 0.2 : 0;            // ombre portée sous le tapis d'herbe
  const deep = Math.min(0.36, depth / 85) + (st === 'floor' ? 0.1 : 0);
  // radicelles près de la surface
  if (depth < 16 && Math.abs(noise2(wx * 0.22, wy * 0.5, 23) - 0.5) < 0.014) return C.SOIL[1];
  // une cellule sur trois environ est une grosse motte ; le reste, de la terre meuble
  if (w.id < 0.36) {
    const edge = w.d2 - w.d;
    if (edge < 1.05) return C.CLOD_LINE;
    const nx = w.dx / CELL, ny = w.dy / (CELL * SQUASH);
    const rim = edge < 2.1 ? (w.dx + w.dy * 1.4 < 0 ? 0.15 : -0.1) : 0;
    const v = 0.56 + (w.id - 0.18) * 0.3 - nx * 0.12 - ny * 0.2 + rim - deep - under;
    return pick(C.SOIL, clamp01(v), wx, wy, 0.12);
  }
  // terre meuble : grain fin et peu contrasté, quelques gravillons
  if (ih(wx >> 1, wy >> 1, 9) < 0.004) return C.PEBBLE[1];
  let v = 0.5 + (noise2(wx * 0.16, wy * 0.24, 45) - 0.5) * 0.18 - deep - under;
  const g = ih(wx, wy, 46);
  if (g < 0.06) v -= 0.12; else if (g < 0.1) v += 0.08;
  return pick(C.SOIL, clamp01(v), wx, wy, 0.15);
}

/** Murets de pierre sèche : la silhouette suit les pierres (elles dépassent ou se creusent). */
function stonePixel(map, wx, wy, own, w, cx, cy, ctx, cty, pty) {
  let st = rockyAt(map, cx, cy);
  if (!st) {
    if (own && map.solid(ctx, cty)) st = own; else return null;
  }
  if (!own) {
    if (cty > pty) return null;
    if (surfaceDepth(map, ctx, cty, wy) < grassDepth(wx) + 3) return null;
  }
  const depth = surfaceDepth(map, ctx, cty, wy);
  const edge = w.d2 - w.d;
  if (edge < 1.1) return depth < 10 ? '#1b2a12' : C.CREVICE;
  const nx = w.dx / CELL, ny = w.dy / (CELL * SQUASH);
  const rim = edge < 2.1 ? (w.dx + w.dy * 1.4 < 0 ? 0.22 : -0.14) : 0;
  if (w.id > 0.6 && ny < -0.35 && edge > 1.6) return pick(C.MOSS, clamp01(0.55 - nx * 0.3), wx, wy);
  const v = 0.58 + (w.id - 0.5) * 0.3 - nx * 0.16 - ny * 0.26 + rim - Math.min(0.2, depth / 160);
  return pick(C.STONE, clamp01(v), wx, wy, 0.12);
}

/**
 * Peint les tuiles des colonnes [tx0, tx1[ dans le tampon pix, dont le pixel
 * (0, 0) correspond au point du monde (ox, 0).
 */
export function paintTiles(pix, map, tx0, tx1, ox) {
  // canaux, fossés, bassins : la berge d'en face (en retrait, plus sombre) et l'eau
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    // colonne sans sol au niveau de référence (une passerelle de bois ne compte pas)
    if (map.at(tx, G) === '#' || map.at(tx, G + 1) === '#' || map.pitCols.has(tx)) continue;
    let top = G + 1; while (top < map.h && map.at(tx, top) !== '~' && map.at(tx, top) !== '#') top++;
    const z = map.zone[tx];
    const stone = z === '03' || z === '07' || z === '02';
    for (let wy = G * TILE + 2; wy < top * TILE; wy++) {
      for (let px = 0; px < TILE; px++) {
        const wx = tx * TILE + px;
        let col = stone ? stoneWallColor(wx, wy + 5) : soilColor(wx, wy, wy - G * TILE + 20);
        col = hex(mix(col, '#1d2a2a', 0.45));
        if (wy < G * TILE + 5) col = wy < G * TILE + 3 ? C.GRASS[1] : C.GRASS[0];   // herbe de l'autre rive
        pix.set(wx - ox, wy, col);
      }
    }
    for (let ty = top; ty < map.h; ty++) {
      if (map.at(tx, ty) !== '~') continue;
      for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
        const wx = tx * TILE + px, wy = ty * TILE + py;
        const d = wy - top * TILE;
        let v = 0.62 - d / 40 + (noise2(wx * 0.15, wy * 0.6, 31) - 0.5) * 0.25;
        if (d < 1) v = 0.95;
        // reflet sombre de la berge
        if (d > 2 && d < 10 && noise1(wx * 0.3, 32) > 0.55) v -= 0.12;
        pix.set(wx - ox, wy, pick(C.WATER, clamp01(v), wx, wy, 0.35));
      }
    }
  }
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    for (let ty = 0; ty < map.h; ty++) {
      const style = map.styleAt(tx, ty);
      if (!style) continue;
      const t = map.at(tx, ty);
      if (t === '.') continue;   // caisse : dessinée à part
      const topOpen = !map.solid(tx, ty - 1) && map.at(tx, ty - 1) !== '~';
      const leftOpen = !map.solid(tx - 1, ty), rightOpen = !map.solid(tx + 1, ty);
      const botOpen = !map.solid(tx, ty + 1) && ty + 1 < map.h;
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const wx = tx * TILE + px, wy = ty * TILE + py;
          // terre, murets, sol de la grange : la masse rocheuse et son tapis d'herbe
          if (ROCKY.has(style)) {
            const gd = grassDepth(wx);
            let col = null;
            if (topOpen && style !== 'floor' && py < gd) col = grassColor(wx, wy, py, gd);
            else if (topOpen && style === 'floor' && py < 2) col = pick(C.SOIL, 0.45 + (noise1(wx * 0.5, 4) - 0.5) * 0.3, wx, wy);
            else col = earthPixel(map, wx, wy, style);
            if (style === 'floor' && col && py >= 2 && py < 6 && ih(wx, wy, 8) < 0.1) col = C.STRAW[2];
            if (col) pix.set(wx - ox, wy, col);
            continue;
          }
          // coins arrondis là où deux faces sont à l'air libre
          if (topOpen && ((leftOpen && px + py < 2) || (rightOpen && (TILE - 1 - px) + py < 2))) continue;
          let col;
          const grassy = style === 'soil' || style === 'stone' || style === 'roots';
          const gd = grassDepth(wx);
          if (grassy && topOpen && py < gd) {
            col = grassColor(wx, wy, py, gd);
          } else if (grassy && map.zone[tx] !== '05' && ((leftOpen && px < 2) || (rightOpen && px > 13)) && py < gd + 3 && ty > 0 && !map.solid(tx, ty - 1)) {
            col = C.GRASS[1];                                       // l'herbe déborde sur le flanc
          } else {
            switch (style) {
              case 'stone': col = stoneWallColor(wx, wy); break;
              case 'cut': col = topOpen && py < 2 ? (py ? C.STONE[3] : C.STONE[5]) : cutStoneColor(wx, wy); break;
              case 'roots': col = rootsColor(wx, wy); break;
              case 'floor': col = floorColor(wx, wy, depthBelowAir(map, tx, ty, py)); break;
              case 'deck': col = deckColor(map, tx, ty, px, py, wx, wy); break;
              case 'beam': col = beamColor(map, tx, ty, px, py, wx, wy); break;
              case 'shelf': col = shelfColor(map, tx, ty, px, py, wx, wy); break;
              case 'branch': col = branchColor(map, tx, ty, px, py, wx, wy); if (!col) continue; break;
              case 'bamboo_v': col = bambooColor(true, wx, wy, tx, ty); break;
              case 'bamboo_h': col = bambooColor(false, wx, wy, tx, ty); break;
              case 'grove': col = groveColor(map, tx, ty, px, py, wx, wy); if (!col) continue; break;
              case 'plank': col = plankColor(map, tx, ty, px, py, wx, wy); if (!col) continue; break;
              case 'rafter': col = rafterColor(map, tx, ty, px, py, wx, wy); if (!col) continue; break;
              default: col = soilColor(wx, wy, depthBelowAir(map, tx, ty, py), C.SOIL, map.zone[tx] === '05' ? 0.08 : 0);
            }
            // flancs à l'air libre : un liseré d'ombre (ou de lumière à gauche)
            if (style === 'soil' || style === 'floor') {
              if (rightOpen && px === TILE - 1) col = hex(mix(col, C.SOIL[0], 0.55));
              else if (rightOpen && px === TILE - 2) col = hex(mix(col, C.SOIL[0], 0.25));
              if (leftOpen && px === 0) col = hex(mix(col, C.SOIL[5], 0.3));
              if (botOpen && py === TILE - 1) col = C.SOIL[0];
            } else if (style === 'stone' || style === 'cut') {
              if (rightOpen && px === TILE - 1) col = hex(mix(col, C.STONE[0], 0.5));
            }
          }
          pix.set(wx - ox, wy, col);
        }
      }
    }
  }
}

/** Pierres qui débordent dans les cases vides, contre les flancs et sous les surplombs. */
export function paintOverhangs(pix, map, tx0, tx1, ox) {
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    for (let ty = 0; ty < map.h; ty++) {
      if (map.solid(tx, ty) || map.at(tx, ty) === '~') continue;
      const L = ROCKY.has(map.styleAt(tx - 1, ty) ?? ''), Rr = ROCKY.has(map.styleAt(tx + 1, ty) ?? ''), U = ROCKY.has(map.styleAt(tx, ty - 1) ?? '');
      if (!L && !Rr && !U) continue;
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const near = (L && px < 4) || (Rr && px > 11) || (U && py < 4);
          if (!near) continue;
          const wx = tx * TILE + px, wy = ty * TILE + py;
          const col = earthPixel(map, wx, wy, null);
          if (col) pix.set(wx - ox, wy, col);
        }
      }
    }
  }
}

/** Herbe qui dépasse du sol, fleurs sauvages : peints au-dessus des tuiles (derrière les personnages). */
export function paintGrassTops(b, map, tx0, tx1) {
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    for (let ty = 1; ty < map.h; ty++) {
      const st = map.styleAt(tx, ty);
      if (!(st === 'soil' || st === 'stone' || st === 'roots') || map.solid(tx, ty - 1) || map.at(tx, ty - 1) === '~') continue;
      const z = map.zone[tx];
      if (z === '06') continue;
      // l'herbe déborde des angles et coule sur le flanc
      for (const side of [-1, 1]) {
        if (map.solid(tx + side, ty)) continue;
        const ex = side < 0 ? tx * TILE : tx * TILE + TILE - 1, wy0 = ty * TILE;
        const drop = 4 + Math.floor(ih(tx, ty, 90 + side) * 6);
        b.r(side < 0 ? ex - 2 : ex + 1, wy0 + 1, 2, 3, C.GRASS[2]).p(side < 0 ? ex - 2 : ex + 2, wy0 + 1, C.GRASS[4]);
        for (let k = 0; k < 3; k++) {
          const x = ex + side * (k === 0 ? 1 : k === 1 ? 0 : -1), len = drop - k * 2;
          for (let j = 0; j < len; j++) b.p(x, wy0 + 3 + j, j > len - 2 ? C.GRASS[1] : j % 2 ? C.GRASS[2] : C.GRASS[3]);
        }
      }
      for (let px = 0; px < TILE; px++) {
        const wx = tx * TILE + px, wy = ty * TILE;
        const clump = noise1(wx * 0.28, 76);
        if (ih(wx, ty, 77) < 0.35 + clump * 0.45) {
          const h = 1 + Math.floor(ih(wx, ty, 78) * (z === '05' ? 2 : 2 + clump * 5));
          const lean = ih(wx, ty, 79) < 0.3 ? -1 : ih(wx, ty, 79) > 0.7 ? 1 : 0;
          for (let k = 1; k <= h; k++) b.p(wx + (k > h * 0.6 ? lean : 0), wy - k, k === h ? C.GRASS[5] : k > h - 2 ? C.GRASS[4] : C.GRASS[3]);
        }
        // fleurs sauvages selon la zone
        const fl = ih(wx, ty, 80);
        const rate = { '01': 0.035, '02': 0.012, '03': 0.02, '04': 0.02, '05': 0.004, '07': 0.02, '08': 0.03 }[z] ?? 0.01;
        if (fl < rate && px > 1 && px < 14) {
          const kind = Math.floor(ih(wx, ty, 81) * 4);
          const petal = [C.FLOWER.yellow, C.FLOWER.white, C.FLOWER.pink, z === '03' || z === '07' ? C.FLOWER.violet : C.FLOWER.blue][kind];
          const h = 3 + Math.floor(ih(wx, ty, 82) * 3);
          b.r(wx, wy - h, 1, h, C.GRASS[1]).p(wx + 1, wy - 2, C.GRASS[2]);
          b.p(wx - 1, wy - h - 1, petal).p(wx + 1, wy - h - 1, petal).p(wx, wy - h - 2, petal).p(wx, wy - h, petal)
            .p(wx, wy - h - 1, kind === 0 ? '#c9822c' : C.FLOWER.yellow);
        }
      }
    }
  }
}
