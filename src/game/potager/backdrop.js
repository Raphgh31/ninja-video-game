// Fond du Potager : le ciel, les nuages et cinq plans de paysage en parallaxe,
// du plus lointain au plus proche :
//   1. la grande chaîne enneigée (trois rangs de sommets qui se chevauchent,
//      dominés par le Mont Kagero, au flanc duquel on devine le dojo final) ;
//   2. les aiguilles rocheuses : falaises, corniches, pins accrochés, cascades ;
//   3. les contreforts boisés, chemins, temple, et vers la fin les rizières ;
//   4. le village au pied des collines : maisons, pagode, cerisiers, fumées ;
//   5. la lisière : grands arbres, haies, bosquet de bambous.
// Chaque plan est peint une fois au chargement dans une longue bande, puis
// recopié à chaque image avec son propre défilement : le monde paraît immense.
import { Pix, Brush, fbm1, fbm2, noise1, noise2, ih, rng, pick, hazeRamp, mix, hex, mixHex, bayer, worley } from './paint.js';
import * as C from './palette.js';
import { cloudSprite as fineCloud, cirrusSprite } from '../sky.js';

const TILE = 16;
const GROUND_ROW = 19;          // haut du sol de référence du chapitre
const MAXW = 1200;              // largeur d'écran maximale prise en compte (téléphones larges)
const GROUND_AT = 0.86;         // hauteur du sol dans l'image (comme la caméra)

// défilement horizontal (fx) et vertical (fy) de chaque plan ; off = position de
// la base du plan par rapport au sol, h = hauteur de la bande, base = ligne de base dans la bande
const PLANES = {
  far:     { fx: 0.035, fy: 0.06, off: -40, h: 236, base: 222 },
  mid:     { fx: 0.085, fy: 0.12, off: -24, h: 176, base: 160 },
  foot:    { fx: 0.17,  fy: 0.2,  off: -10, h: 130, base: 116 },
  village: { fx: 0.29,  fy: 0.32, off: -2,  h: 112, base: 98 },
  near:    { fx: 0.5,   fy: 0.5,  off: 6,   h: 140, base: 92 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Position dans une bande d'un repère vu au centre de l'écran quand KAGE est en worldX. */
const anchor = (plane, worldX) => (worldX - 240) * plane.fx + 240;

// ---------------------------------------------------------------------------
// un sommet : flancs, arêtes, ravines, neige ; peint seul, pour pouvoir passer
// devant ou derrière ses voisins
// ---------------------------------------------------------------------------
function peakHeight(pk, x) {
  const dx = x - pk.x;
  const R = dx < 0 ? pk.rl : pk.rr;
  const t = Math.abs(dx) / R;
  if (t >= 1) return -1;
  let s;
  if (pk.crag && (dx < 0) === (pk.cliff < 0)) {
    // côté falaise : un plateau déchiqueté, une paroi presque verticale, un éboulis boisé
    s = t < 0.32 ? 1 - 0.14 * (t / 0.32) : t < 0.46 ? 0.86 - 0.5 * ((t - 0.32) / 0.14) : 0.36 * Math.pow((1 - t) / 0.54, 1.3);
  } else {
    s = 0.55 * Math.pow(1 - t, 1.9) + 0.45 * (1 - t);         // pic : sommet raide, pied doux
  }
  const jag = (fbm1(x * 0.06, 4, pk.seed) - 0.5) * pk.h * (pk.crag ? 0.1 : 0.16)
    + (noise1(x * 0.5, pk.seed + 5) - 0.5) * 2.2
    + (Math.floor(x / 5 + pk.seed) % 3 === 0 ? -1 : 0);       // petites cassures du rocher
  return pk.h * s + jag * (0.4 + 0.6 * (1 - t));
}

/**
 * Couleur d'un pixel (x, y) d'un sommet. o.rock / o.snow : rampes ; o.forest :
 * rampe de la forêt qui monte à l'assaut des pentes (plans moyens) ; o.mist :
 * brume au pied.
 */
function shadePeak(pk, x, y, yTop, base, o) {
  const sY = base - pk.h;
  const depth = (y - sY) / pk.h;                               // 0 au sommet, 1 au pied
  let col;
  // arête principale : elle descend du sommet en serpentant
  const xr = pk.x + (fbm1(y * 0.035, 3, pk.seed + 9) - 0.5) * pk.h * 0.5 * Math.min(1, depth * 1.6);
  const lit = x < xr;
  const k = lit ? 0.8 : -0.8;
  const streak = fbm2((x + (y - sY) * k) * 0.075, y * 0.012, 3, pk.seed + 1);
  let v;
  const tt = Math.abs(x - pk.x) / (x < pk.x ? pk.rl : pk.rr);
  const wall = pk.crag && (x < pk.x) === (pk.cliff < 0) && tt > 0.3 && tt < 0.5 && depth < 0.75;
  if (wall) {
    // paroi : verticale, éclairée si elle regarde le soleil, strates et fissures
    v = pk.cliff < 0 ? 0.62 : 0.2;
    v += (noise1(x * 0.8, pk.seed) - 0.5) * 0.34 + (noise1(y * 0.3, pk.seed + 1) - 0.5) * 0.12;
    if ((y + Math.floor(noise1(x * 0.12, pk.seed + 2) * 5)) % 7 === 0) v -= 0.2;
  } else {
    v = lit ? 0.68 : 0.24;
    v += (streak - 0.5) * 0.6;
    if (lit && xr - x < 2.5) v += 0.18;                        // crête éclairée
    if (!lit && x - xr < 1.5) v -= 0.12;                       // l'ombre commence net
  }
  if (y - yTop < 2) v += lit ? 0.16 : 0.1;                     // liseré du ciel
  // forêt : elle monte dans les ravines, s'arrête sous les rochers
  let forest = false;
  if (o.forest) {
    const line = sY + pk.h * (0.3 + 0.28 * fbm1(x * 0.04, 2, pk.seed + 4)) - Math.max(0, streak - 0.55) * pk.h * 0.8;
    const cap = pk.crag && y - yTop < 3 + noise1(x * 0.3, pk.seed) * 3;
    forest = !wall && (y > line || cap) && !(y < base - 12 && noise2(x * 0.06, y * 0.14, pk.seed + 6) > 0.74);
    if (forest) {
      const w = worley(x, y, 5, pk.seed + 7, 0.8);
      let fv = 0.58 - (w.dx / 5) * 0.5 - (w.dy / 4) * 0.5 + (lit ? 0.1 : -0.12);
      if (w.d2 - w.d < 0.9) fv -= 0.22;
      col = pick(o.forest, clamp01(fv), x, y);
    }
  }
  if (!forest) {
    const snowLine = sY + pk.h * (0.27 + 0.11 * fbm1(x * 0.025, 2, pk.seed + 3));
    const finger = Math.max(0, streak - 0.56) * pk.h * 1.1;
    if (o.snow && pk.h > 100 && y < snowLine + finger && !(streak < 0.34 && y - yTop > 3)) {
      col = pick(o.snow, clamp01(v + 0.1), x, y);
    } else {
      col = pick(o.rock, clamp01(v), x, y);
    }
  }
  // brume au pied (par paliers tramés)
  const hb = clamp01((y - (base - o.mist)) / (o.mist + 10));
  const step = Math.floor(hb * 4 + bayer(x, y) - 0.5) / 4;
  if (step > 0) col = mixHex(col, C.MIST, Math.min(0.94, step));
  return col;
}

/**
 * Peint une suite de sommets, de l'arrière vers l'avant : pour chaque pixel on
 * cherche d'abord le sommet le plus proche qui le couvre, puis on ne le colore
 * qu'une fois (les sommets se chevauchent sans repeindre).
 */
function paintPeaks(pix, list, base) {
  const H = pix.h;
  const owner = new Int16Array(H), tops = new Float32Array(list.length);
  for (let x = 0; x < pix.w; x++) {
    owner.fill(-1);
    for (let k = 0; k < list.length; k++) {
      const pk = list[k].pk;
      if (x < pk.x - pk.rl || x > pk.x + pk.rr) { tops[k] = H; continue; }
      const top = peakHeight(pk, x);
      tops[k] = top <= 0 ? H : Math.round(base - top);
      for (let y = Math.max(0, tops[k]); y < H; y++) owner[y] = k;
    }
    for (let y = 0; y < H; y++) {
      const k = owner[y];
      if (k < 0) continue;
      pix.set(x, y, shadePeak(list[k].pk, x, y, tops[k], base, list[k].o));
    }
  }
}

// ---------------------------------------------------------------------------
// 1. la grande chaîne enneigée
// ---------------------------------------------------------------------------
/**
 * La grande chaîne. k > 1 : les mêmes sommets (et le dojo) repeints plus grands,
 * pour un chapitre plus proche d'eux (la Forêt : k = 1,25) ; fx : défilement.
 */
export function paintFar(levelW, k = 1, fx = PLANES.far.fx) {
  const P0 = PLANES.far;
  const P = { ...P0, h: Math.round(P0.h * k), base: Math.round(P0.base * k) };
  const W0 = Math.ceil(MAXW + (levelW - 480) * fx) + 4;
  const W = Math.ceil(W0 * k);
  const pix = new Pix(W, P.h);
  const r = rng(7);
  const groups = [
    { haze: 0.46, hMin: 100, hMax: 150, step: [110, 180], peaks: [] },
    { haze: 0.2, hMin: 85, hMax: 140, step: [130, 210], peaks: [] },
    { haze: 0.05, hMin: 40, hMax: 78, step: [70, 120], peaks: [] },
  ];
  let seed = 100;
  for (const g of groups) {
    for (let x = -40 + r() * 60; x < W0 + 60; x += g.step[0] + r() * (g.step[1] - g.step[0])) {
      const h = g.hMin + r() * (g.hMax - g.hMin);
      g.peaks.push({ x, h, rl: h * (1.2 + r() * 0.6), rr: h * (1.2 + r() * 0.6), seed: seed++ });
    }
  }
  // le Mont Kagero : le plus haut, au loin devant KAGE pendant tout le chapitre
  const giant = { x: 430, h: 188, rl: 225, rr: 200, seed: 999 };
  groups[1].peaks = groups[1].peaks.filter((p) => Math.abs(p.x - giant.x) > 170);
  groups[1].peaks.push(giant, { x: 336, h: 118, rl: 110, rr: 80, seed: 998 }, { x: 540, h: 132, rl: 80, rr: 130, seed: 997 });
  if (k !== 1) for (const g of groups) for (const pk of g.peaks) { pk.x *= k; pk.h *= k; pk.rl *= k; pk.rr *= k; }
  const list = [];
  for (const g of groups) {
    const o = { rock: hazeRamp(C.ROCK_FAR, C.HAZE, g.haze), snow: hazeRamp(C.SNOW, C.HAZE, g.haze * 0.6), mist: Math.round(56 * k) };
    for (const pk of g.peaks.sort((a, b) => b.h - a.h)) list.push({ pk, o });
  }
  paintPeaks(pix, list, P.base);
  pix.done();
  // le dojo final (chapitre 7), au flanc du Mont Kagero : voir paintDojo
  paintDojo(new Brush(pix.c.getContext('2d')), giant, P);
  return { img: pix.c, W, plane: P };
}

/**
 * Le dojo final, au flanc du Mont Kagero : un avant-goût du chapitre 7. Un
 * sanctuaire de montagne, voilé par la distance : deux terrasses taillées dans la
 * pente, sur de grands murs de pierre évasés comme ceux des châteaux (ishigaki),
 * la grande salle au double toit aux coins relevés, une pagode à cinq étages
 * coiffée d'or, de la neige sur les toits, des fenêtres et des lanternes
 * allumées, un escalier en lacets et son torii, une écharpe de brume.
 */
function paintDojo(b, giant, P) {
  const K = {
    roof: '#323a58', roofL: '#4a5476', roofE: '#232841', snow: '#f1f5fb', snowS: '#cdd6e8',
    wall: '#dfe3ec', wallS: '#aab2c8', red: '#a8493b', redD: '#7a312a', wood: '#474860', woodL: '#62657f',
    gold: '#e4c067', lamp: '#f7d27c', stone: '#8e99b9', stoneL: '#b3bcd5', stoneD: '#646e95',
  };
  const ground = (x) => Math.round(P.base - peakHeight(giant, x));
  const cx = giant.x + 82, x0 = cx - 30;                       // assez bas sur le flanc : il reste dans l'image
  const ty = ground(x0 + 8) + 1;                                 // terrasse haute (la grande salle)
  const t2 = { x0: cx + 3, x1: cx + 25, y: ty + 9 };             // terrasse basse (la pagoda), un cran plus bas
  const x1 = t2.x1;
  // toit à coins relevés : eave = ligne du bord, hw = demi-largeur, h = hauteur
  const roof = (mx, eave, hw, h, snowy = true) => {
    for (let j = 0; j < h; j++) {
      const half = Math.round(hw - j * (hw * 0.62) / Math.max(1, h - 1)), y = eave - j;
      b.r(mx - half, y, 2 * half + 1, 1, j === 0 ? K.roofE : j < 2 ? K.roof : K.roofL);
      if (snowy && j >= h - 2) b.r(mx - half + 1, y, 2 * half - 1, 1, j === h - 1 ? K.snow : K.snowS);
    }
    b.r(mx - hw - 1, eave - 1, 2, 1, K.roofE).p(mx - hw - 2, eave - 2, K.roofE);   // coins relevés
    b.r(mx + hw, eave - 1, 2, 1, K.roofE).p(mx + hw + 2, eave - 2, K.roofE);
    if (snowy) for (let x = mx - hw + 2; x < mx + hw - 1; x += 3) b.p(x, eave - 1, K.snowS);
  };
  // 1. les grands murs de pierre (ishigaki) sous les deux terrasses, jusqu'à la pente :
  //    gros blocs assisés, face légèrement en fruit, neige sur les arêtes
  const wall = (xa, xb, top, fruit = 0) => {
    for (let x = xa; x <= xb + 16; x++) {
      const g = ground(x);
      for (let y = top + 3; y < g + 1; y++) {
        // en gradins : tous les 14 px, un ressaut enneigé avance de 3 px (et la face a un léger fruit)
        const step = Math.floor((y - top - 3) / 14), inStep = (y - top - 3) % 14;
        const edge = xb + Math.round(fruit * (step * 3 + Math.floor(inStep / 5)));
        if (x > edge) continue;
        // pierres inégales : chaque assise a ses propres joints (blocs de 3 à 7 px)
        const row = Math.floor((y - top) / 3), u = x + Math.floor(ih(row, 1, 71) * 7);
        const joint = (y - top) % 3 === 0 || ih(u, row, 72) < 0.24;
        const lit = x - xa < 2 ? 1 : edge - x < 2 ? -1 : 0;
        const tone = ih(Math.floor(u / 4), row, 73) < 0.3 ? '#9aa4c2' : K.stone;
        let col = joint ? '#76809f' : lit > 0 ? K.stoneL : lit < 0 ? '#5e6890' : tone;
        if (fruit && step > 0 && inStep === 0) col = x > edge - 4 ? K.snow : K.snowS;          // neige sur le ressaut
        b.p(x, y, col);
      }
    }
  };
  wall(x0 - 2, t2.x0, ty);
  wall(t2.x0, x1 + 2, t2.y, 1);
  // 2. les terrasses : dalles, garde-corps vermillon
  for (const [xa, xb, y] of [[x0 - 2, t2.x0, ty], [t2.x0, x1 + 2, t2.y]]) {
    b.r(xa, y, xb - xa + 1, 3, K.stone).r(xa, y, xb - xa + 1, 1, K.stoneL).r(xa, y + 3, xb - xa + 1, 1, K.stoneD);
  }
  for (let x = t2.x0 + 1; x <= x1 + 1; x += 3) b.r(x, t2.y - 3, 1, 3, K.red);
  b.r(t2.x0 + 1, t2.y - 3, x1 - t2.x0 + 1, 1, K.red);
  // 3. la pagode à cinq étages, sur la terrasse basse : elle domine la grande salle
  const px = cx + 15, py = t2.y;
  for (let k = 0; k < 5; k++) {
    const eave = py - 6 - k * 8, bw = 5 - Math.floor(k * 0.7);
    b.r(px - bw, eave + 1, 2 * bw + 1, k ? 7 : 6, k % 2 ? K.wallS : K.wall).r(px - bw, eave + 1, 1, k ? 7 : 6, K.red).r(px + bw, eave + 1, 1, k ? 7 : 6, K.redD);
    if (k < 4) b.p(px - 1, eave + 3, K.lamp).p(px + 1, eave + 3, K.lamp);
    roof(px, eave, 10 - k, 3);
  }
  const spire = py - 6 - 4 * 8 - 3;
  b.r(px, spire - 11, 1, 11, K.gold);
  for (let k = 0; k < 5; k++) b.r(px - 1, spire - 2 - k * 2, 3, 1, K.gold);
  b.p(px, spire - 12, K.lamp);
  // 4. la grande salle : piliers vermillon, fenêtres allumées, double toit
  const hx = x0 + 15, hw = 13;
  b.r(hx - hw, ty - 9, 2 * hw + 1, 9, K.wall);
  for (let x = hx - hw; x <= hx + hw; x += 4) b.r(x, ty - 9, 1, 9, K.red).p(x + 1, ty - 9, K.redD);
  for (const wx of [hx - 9, hx - 5, hx + 3, hx + 7]) b.r(wx, ty - 6, 2, 3, K.lamp).p(wx, ty - 6, '#ffe9b0');
  b.r(hx - 1, ty - 7, 3, 7, K.redD).p(hx, ty - 5, K.gold);         // la grande porte
  b.r(hx - hw - 1, ty - 1, 2 * hw + 3, 1, K.stoneD);
  roof(hx, ty - 10, hw + 6, 5);
  b.r(hx - 8, ty - 18, 17, 4, K.wallS).r(hx - 8, ty - 18, 17, 1, K.wall);
  for (let x = hx - 8; x <= hx + 8; x += 4) b.r(x, ty - 18, 1, 4, K.red);
  roof(hx, ty - 19, 12, 6);
  b.r(hx - 7, ty - 26, 15, 1, K.roofE);                            // le faîtage, et ses ornements d'or
  b.r(hx - 8, ty - 28, 1, 2, K.gold).r(hx + 8, ty - 28, 1, 2, K.gold).p(hx, ty - 27, K.gold);
  for (const lx of [hx - 15, hx + 15]) b.p(lx, ty - 9, K.lamp).p(lx, ty - 8, '#c9973e');   // lanternes sous l'avant-toit
  // 5. l'escalier en lacets jusqu'au torii, bordé de lanternes
  let sx = x1 + 2, sy = t2.y + 1, dir = 1;
  for (let i = 0; i < 46; i++) {
    sx += dir; sy += 1;
    const g = ground(sx);
    if (sy < g - 1) sy = g - 1;
    b.r(sx, sy, 2, 1, K.stoneL).p(sx, sy + 1, K.stoneD);
    if (i % 7 === 3) b.p(sx + (dir > 0 ? 2 : -1), sy - 1, K.lamp);
    if (i % 12 === 11) dir = -dir;
  }
  const tx = sx + 2, tg = sy + 1;                                  // le torii, en bas de l'escalier
  b.r(tx - 5, tg - 9, 11, 1, K.redD).r(tx - 6, tg - 10, 13, 1, K.red).r(tx - 4, tg - 7, 9, 1, K.red)
    .r(tx - 3, tg - 9, 1, 9, K.red).r(tx + 3, tg - 9, 1, 9, K.redD);
  // 6. une écharpe de brume sous la terrasse
  for (let x = x0 - 8; x < x1 + 14; x++) {
    const y = t2.y + 16 + Math.round(Math.sin(x * 0.12) * 2);
    b.r(x, y, 1, 2, 'rgba(238, 243, 250, 0.55)');
    if ((x * 7) % 5 < 2) b.p(x, y - 1, 'rgba(238, 243, 250, 0.35)');
  }
}

// ---------------------------------------------------------------------------
// 2. montagnes moyennes : pics boisés, aiguilles, falaises, cascades
// ---------------------------------------------------------------------------
function paintMid(levelW) {
  const P = PLANES.mid;
  const W = Math.ceil(MAXW + (levelW - 480) * P.fx) + 4;
  const pix = new Pix(W, P.h);
  const r = rng(21);
  const ranks = [{ haze: 0.3, peaks: [] }, { haze: 0.1, peaks: [] }];
  let seed = 300;
  for (const [i, rk] of ranks.entries()) {
    for (let x = -30 + r() * 40; x < W + 40; x += (i ? 90 : 70) + r() * (i ? 120 : 90)) {
      const crag = r() < 0.38;
      const h = crag ? 75 + r() * 50 : (i ? 50 : 70) + r() * (i ? 55 : 55);
      const w = h * (1.1 + r() * 0.5);
      rk.peaks.push({ x, h, rl: w * (0.8 + r() * 0.4), rr: w * (0.8 + r() * 0.4), crag, cliff: r() < 0.5 ? -1 : 1, seed: seed++, fall: crag && r() < 0.55 });
    }
    // un bourrelet boisé continu au pied (pas de trou vers le ciel)
    for (let x = -20; x < W + 40; x += 34) {
      rk.peaks.push({ x: x + r() * 10, h: 22 + r() * 14, rl: 60, rr: 60, seed: seed++, low: true });
    }
  }
  const falls = [];
  const pines = [];
  const list = [];
  for (const rk of ranks) {
    const o = { rock: hazeRamp(C.ROCK_MID, C.HAZE, rk.haze), forest: hazeRamp(C.FOREST_MID, C.HAZE, rk.haze), mist: 34 };
    for (const pk of rk.peaks.sort((a, b) => b.h - a.h)) {
      list.push({ pk, o });
      if (pk.fall) {
        const fx = Math.round(pk.x + pk.cliff * (pk.cliff < 0 ? pk.rl : pk.rr) * 0.38);
        falls.push({ x: fx, y: Math.round(P.base - peakHeight(pk, fx + pk.cliff * 2)) + 1, haze: rk.haze });
      }
      if (pk.crag) for (let k = 0; k < 5; k++) pines.push({ x: Math.round(pk.x + (r() - 0.5) * (pk.cliff < 0 ? pk.rl : pk.rr) * 0.6), pk, haze: rk.haze });
    }
  }
  paintPeaks(pix, list, P.base);
  pix.done();
  const b = new Brush(pix.c.getContext('2d'));
  for (const p of pines) {                                     // pins tordus au sommet des aiguilles
    const top = Math.round(P.base - peakHeight(p.pk, p.x));
    const f = hazeRamp(C.FOREST_MID, C.HAZE, p.haze);
    const hgt = 4 + Math.floor(ih(p.x, 1, 4) * 6);
    b.r(p.x, top - hgt + 2, 1, hgt - 1, hazeRamp(C.WOOD, C.HAZE, p.haze)[1]);
    for (let k = 0; k < hgt; k += 2) b.r(p.x - Math.floor(k / 2) - 1, top - hgt + k, Math.floor(k / 2) * 2 + 3, 1, k < 2 ? f[3] : f[1]);
  }
  for (const f of falls) {                                     // filets de cascade jusqu'à la brume
    const c1 = hex(mix('#f4fafb', C.HAZE, f.haze)), c2 = hex(mix('#c3dbe3', C.HAZE, f.haze));
    for (let y = f.y; y < P.base - 14; y++) { b.p(f.x, y, (y + f.x) % 4 ? c1 : c2); if ((y + f.x) % 3 === 0) b.p(f.x + 1, y, c2); }
    b.r(f.x - 1, f.y - 1, 3, 1, c2).r(f.x - 2, P.base - 15, 5, 1, c2).r(f.x - 3, P.base - 14, 7, 1, c1);
  }
  return { img: pix.c, W, plane: P };
}

// ---------------------------------------------------------------------------
// houppiers : un arbre vu de loin, tamponné rond et éclairé du haut à gauche
// ---------------------------------------------------------------------------
const EDGE = Array.from({ length: 64 }, (_, i) => i);
function crown(pix, cx, cy, r, ramp, seed, light = 0) {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.ceil(r * 1.2);
  // bord découpé : un rayon par direction (32 directions), tiré une fois
  const edge = EDGE.slice(0, 32).map((i) => r * (0.84 + 0.28 * noise1(i * 0.49 + 10, seed)));
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y * 1.1);
      if (d > R) continue;
      const a = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * 32) & 31;
      const rr = edge[a];
      if (d > rr) continue;
      const nx = x / r, ny = y / r;
      let v = 0.58 + light - nx * 0.36 - ny * 0.46 + (ih((cx + x) >> 1, (cy + y) >> 1, seed & 255) - 0.5) * 0.3;
      if (d > rr - 1.1 && nx + ny > 0.1) v -= 0.22;            // ombre propre en bas à droite
      pix.set(cx + x, cy + y, pick(ramp, clamp01(v), cx + x, cy + y));
    }
  }
}

/**
 * Collines : prés et cultures en bandes qui suivent la pente, et forêts
 * tamponnées arbre par arbre là où le masque le demande.
 */
function paintHills(pix, o) {
  const { base } = o;
  for (let x = 0; x < pix.w; x++) {
    const yTop = Math.round(base - o.profile(x));
    for (let y = Math.max(0, yTop); y < pix.h; y++) {
      const d = y - yTop;
      const col = o.ground(x, y, d);
      pix.set(x, y, col);
    }
  }
  const r = rng(o.seed);
  const step = o.rMin * 1.1;
  const deep = o.deep ?? Infinity;           // sous cette profondeur, la forêt est cachée
  for (let y = 0; y < pix.h + o.rMax; y += step * 0.75) {
    for (let x = -o.rMax + r() * step; x < pix.w + o.rMax; x += step * (0.8 + r() * 0.5)) {
      const yy = y + (r() - 0.5) * step * 0.6;
      const xi = Math.max(0, Math.min(pix.w - 1, Math.round(x)));
      const yTop = base - o.profile(xi);
      if (yy < yTop - o.rMin * 0.3 || yy > yTop + deep) continue;
      if (o.mask(x, yy) < 0) continue;
      const rad = o.rMin + r() * (o.rMax - o.rMin);
      crown(pix, x, yy, rad, o.forest(x, yy), o.seed + Math.floor(x), o.light ? o.light(x, yy) : 0);
    }
  }
}

// ---------------------------------------------------------------------------
// rizières en terrasses : chaque bassin suit la courbe de la colline et
// reflète le ciel ; certaines sont déjà vertes de jeunes pousses
// ---------------------------------------------------------------------------
// Même langage que la colline proche (zone 2) : chaque gradin a sa surface
// (eau qui reflète le ciel, ou rangs de riz), une diguette éclairée à l'avant,
// puis le mur vertical qui descend au gradin suivant (éclairé à gauche des
// bosses, dans l'ombre à droite). Des ruisseaux descendent de gradin en gradin
// (une petite cascade d'écume sur chaque mur), des canaux suivent les courbes.
const paddyCol = { x: NaN, seed: 0, scale: 0, wob: 0, slope: 0 };
const WALL = ['#6b6a4f', '#7d7a5a', '#928d68', '#a8a27b'];
function paddyWob(x, scale, seed) {
  return fbm1(x * 0.018 / scale, 2, seed) * 9 * scale + Math.sin(x * 0.025 / scale) * 3 * scale;
}
function paddyColor(x, y, d, scale, haze, seed) {
  const bandH = Math.round(7 * scale), riser = Math.max(1, Math.round(1.6 * scale));
  if (paddyCol.x !== x || paddyCol.seed !== seed || paddyCol.scale !== scale) {
    paddyCol.x = x; paddyCol.seed = seed; paddyCol.scale = scale;
    paddyCol.wob = paddyWob(x, scale, seed);
    paddyCol.slope = paddyWob(x + 3, scale, seed) - paddyCol.wob;
  }
  const q = d + paddyCol.wob;
  const band = Math.floor(q / bandH), ly = q - band * bandH;
  const H = (c) => mixHex(c, C.HAZE, haze);
  // ruisseau qui descend la pente : un filet sur les gradins, une chute sur chaque mur
  const sp = 230 * scale, k = Math.floor((x + 40 * scale) / sp);
  const sx = k * sp + 70 * scale + ih(k, 0, seed + 5) * 60 * scale + Math.sin(band * 1.3 + k) * 5 * scale;
  const sw = Math.max(1, Math.round(1.6 * scale));
  const inStream = ih(k, 1, seed + 5) < 0.75 && Math.abs(x - sx) <= sw;
  // canal qui suit la courbe de niveau (un gradin sur sept, par endroits)
  const canal = band % 7 === 3 && ih(Math.floor(x / (180 * scale)), band, seed + 6) < 0.6;
  if (ly >= bandH - riser) {
    // le mur du gradin : chute d'écume si un ruisseau passe, sinon terre et pierre
    if (inStream) return H(((ly * 3 + x) % 3 === 0) ? '#cfe7ea' : '#f4fbfa');
    const lit = paddyCol.slope < -0.15 ? 1 : paddyCol.slope > 0.15 ? -1 : 0;
    const v = 1.4 + lit * 0.9 + (ih(Math.floor(x / (3 * scale)), band, seed + 3) - 0.5) * 0.8 - (ly - (bandH - riser)) * 0.5;
    const col = WALL[Math.max(0, Math.min(3, Math.round(v)))];
    return H(ih(x, band, seed + 4) < 0.12 ? C.GRASS[1] : col);   // touffes d'herbe sur le mur
  }
  if (ly >= bandH - riser - 1) return H(inStream ? '#bfe0e6' : C.GRASS[3]);   // la diguette, éclairée
  if (inStream) {
    // le filet d'eau sur le gradin, et l'écume au pied de la chute du gradin au-dessus
    if (ly < 1.5 * scale) return H('#eef8f7');
    return H(Math.abs(x - sx) < sw * 0.5 ? '#7fb6c6' : '#9fcbd6');
  }
  if (canal) {
    const ripple = ((Math.floor(x / (5 * scale)) + band) % 4 === 0 && ly > 1 && ly < bandH - riser - 2);
    if (ly < 1) return H(C.GRASS[2]);
    return H(ripple ? '#d8eef0' : ly < bandH * 0.45 ? '#6fa7b9' : '#5d97ab');
  }
  const cell = Math.floor((x + band * 17 * scale) / ((36 + ih(band, 0, seed) * 40) * scale));
  const kind = ih(cell, band, seed + 1);
  if (ly < 1) return H(mixHex(C.GRASS[1], '#3f5a3a', 0.35));        // ombre du mur du gradin au-dessus
  if (kind < 0.6) {
    // eau : le ciel s'y reflète, plus clair au fond, avec des reflets
    const sh = ih(Math.floor(x / (3 * scale)), band, seed + 2);
    const back = ly / (bandH - riser);
    const c = sh > 0.88 ? '#e9f6f4' : back < 0.35 ? '#c8e5ea' : kind < 0.3 ? '#9fcbd6' : '#b0d6de';
    return mixHex(c, C.HAZE, haze * 0.7);
  }
  // jeunes pousses de riz en rangs (ou riz déjà doré, par endroits)
  const row = Math.floor(x / (2 * scale)) % 2;
  if (kind > 0.92) return H(row ? '#d9cf7a' : '#c4b866');
  return H(kind < 0.82 ? (row ? '#9fcf6a' : '#86bb57') : (row ? '#c1dc8a' : '#a9cd76'));
}

// ---------------------------------------------------------------------------
// 3. contreforts boisés, champs, temple, rizières au loin
// ---------------------------------------------------------------------------
function paintFoot(levelW, zones) {
  const P = PLANES.foot;
  const W = Math.ceil(MAXW + (levelW - 480) * P.fx) + 4;
  const pix = new Pix(W, P.h);
  const base = P.base;
  const endX = zones.length ? anchor(P, zones[zones.length - 1].x0 * TILE) - 300 : W;
  const ranks = [
    { haze: 0.24, prof: (x) => 50 + fbm1(x * 0.008, 3, 41) * 46, seed: 61 },
    { haze: 0.1, prof: (x) => 20 + fbm1(x * 0.012, 3, 43) * 36, seed: 62 },
  ];
  for (const [ri, rk] of ranks.entries()) {
    const forest = hazeRamp(C.FOREST_FOOT, C.HAZE, rk.haze);
    const field = hazeRamp(['#6c8c4e', '#82a35c', '#99b96a', '#b2cd7c', '#c8dc94'], C.HAZE, rk.haze);
    const paddy = hazeRamp(['#7f9e5c', '#a2c27c', '#c3dc9f'], C.HAZE, rk.haze);
    const water = hazeRamp(['#88aebd', '#aed0d9', '#d6ecee'], C.HAZE, rk.haze);
    const mistK = ri === 0 ? 1 : 0.4;
    let colX = NaN, colF = 0;
    paintHills(pix, {
      deep: 70,
      base, seed: rk.seed, rMin: ri ? 4 : 3, rMax: ri ? 6 : 5, profile: rk.prof,
        ground: (x, y, d) => {
        if (x !== colX) { colX = x; colF = fbm1(x * 0.05, 2, 7 + ri) * 3; }
        const row = Math.floor((d + colF) / 4);
        const edge = (d + Math.floor(colF)) % 4 === 0;
        let col;
        if (x > endX) {
          col = paddyColor(x, y, d, 1, rk.haze, 70 + ri);
        } else {
          col = edge ? field[1] : pick(field, 0.5 + ((row + Math.floor(x / 60)) % 3) * 0.17 - d * 0.006, x, y);
        }
        const hb = clamp01((y - (base - 16)) / 24) * mistK;
        const st = Math.floor(hb * 3 + bayer(x, y) - 0.5) / 3;
        return st > 0 ? mixHex(col, C.MIST, Math.min(0.85, st)) : col;
      },
      mask: (x, y) => (x > endX - 30 ? (y < base - rk.prof(Math.max(0, Math.min(W - 1, Math.round(x)))) + 7 && fbm1(x * 0.02, 2, 53) > 0.45 ? 0.1 : -1) : fbm2(x * 0.012, y * 0.03, 3, 50 + ri) - 0.42 + (y > base - rk.prof(Math.max(0, Math.round(x))) + 18 ? 0.06 : 0)),
      forest: (x, y) => {
        const hb = ri === 0 ? clamp01((y - (base - 20)) / 30) : 0;
        return hb > 0.3 ? hazeRamp(C.FOREST_FOOT, C.MIST, Math.min(0.8, hb)) : forest;
      },
    });
  }
  pix.done();
  const b = new Brush(pix.c.getContext('2d'));
  // un temple sur la colline du fond (vers le jardin des sentinelles)
  const tx = Math.round(anchor(P, (zones[6]?.x0 ?? 300) * TILE)) + 70;
  const ty = Math.round(base - ranks[0].prof(tx)) + 1;
  const roof = hazeRamp(C.ROOF, C.HAZE, 0.22), red = hazeRamp(C.RED, C.HAZE, 0.25), wall = hazeRamp(C.PLASTER, C.HAZE, 0.2);
  b.r(tx - 20, ty - 1, 40, 3, wall[1]);
  for (let k = 0; k < 3; k++) {
    const w = 14 - k * 4, y = ty - 6 - k * 6;
    b.r(tx - w + 2, y + 1, w * 2 - 3, 5, k === 0 ? wall[2] : red[2]).r(tx - w + 2, y + 1, 1, 5, wall[3])
      .r(tx - w, y, w * 2 + 1, 2, roof[1]).p(tx - w - 1, y - 1, roof[1]).p(tx + w + 1, y - 1, roof[1]);
  }
  b.r(tx, ty - 26, 1, 6, roof[0]);
  b.r(tx - 30, ty - 9, 1, 9, red[2]).r(tx - 23, ty - 9, 1, 9, red[2]).r(tx - 32, ty - 10, 12, 1, red[1]).r(tx - 31, ty - 8, 10, 1, red[2]);
  // de petites fermes éparpillées sur les collines du fond, voilées par la brume
  const rf = rng(66);
  for (let x = 30; x < W - 20; x += 70 + rf() * 120) {
    if (Math.abs(x - tx) < 60) continue;
    const ri = rf() < 0.5 ? 0 : 1, y = Math.round(base - ranks[ri].prof(Math.round(x)) + 4 + rf() * 10);
    house(b, Math.round(x), y, 0.5 + rf() * 0.15, rf, ri ? 0.2 : 0.32);
  }
  return { img: pix.c, W, plane: P };
}

// ---------------------------------------------------------------------------
// 4. le village au pied des collines
// ---------------------------------------------------------------------------
function house(b, x, y, s, r, haze) {
  // minka : toit de chaume (ou de tuiles) à pignons, murs blancs à colombages
  const th = hazeRamp(C.THATCH, C.HAZE, haze), pl = hazeRamp(C.PLASTER, C.HAZE, haze);
  const wd = hazeRamp(C.WOOD, C.HAZE, haze), rf = hazeRamp(C.ROOF, C.HAZE, haze);
  const w = Math.round(16 * s), hw = Math.round(6 * s), rh = Math.round(9 * s);
  const roof = r() < 0.35 ? rf : th;
  b.r(x - w / 2, y - hw, w, hw, pl[2]).r(x - w / 2, y - hw, 1, hw, pl[3]);
  for (let k = 4; k < w; k += 5) b.r(x - w / 2 + k, y - hw, 1, hw, wd[1]);
  b.r(x - w / 2 + 2, y - 4, 3, 4, wd[0]).r(x + 2, y - hw + 2, 3, 2, wd[0]);
  b.r(x - w / 2 - 1, y - 1, w + 2, 1, wd[0]);
  for (let k = 0; k < rh; k++) {
    const half = Math.round(w / 2 + 3 - (k * (w / 2 + 1)) / rh);
    b.r(x - half, y - hw - 1 - k, half * 2, 1, k === 0 ? roof[0] : k < 3 ? roof[1] : k < rh - 2 ? roof[2] : roof[3]);
    b.p(x - half, y - hw - 1 - k, roof[3]);
    if (k > 1 && k % 3 === 0) b.r(x - half + 2, y - hw - 1 - k, half - 2, 1, roof[3]);
  }
  b.r(x - 3, y - hw - rh - 1, 6, 1, roof[0]);
  return { cx: x + 3, cy: y - hw - rh - 1 };
}

function paintVillage(levelW, zones) {
  const P = PLANES.village;
  const W = Math.ceil(MAXW + (levelW - 480) * P.fx) + 4;
  const pix = new Pix(W, P.h);
  const base = P.base;
  const prof = (x) => 12 + fbm1(x * 0.011, 3, 81) * 22;
  const meadow = C.HILL;
  const endX = zones.length ? anchor(P, zones[zones.length - 1].x0 * TILE) - 200 : W;
  paintHills(pix, {
    base, seed: 84, rMin: 4, rMax: 7, profile: prof,
    ground: (x, y, d) => {
      if (x > endX) return d < 4 ? pick(meadow, clamp01(0.8 - d * 0.1), x, y) : paddyColor(x, y, d - 4, 1.8, 0.02, 97);
      const band = Math.floor((d + fbm1(x * 0.04, 2, 93) * 4) / 5);
      let v = 0.6 - d * 0.01 + ((band + Math.floor(x / 53)) % 3 === 0 ? 0.16 : 0) + (noise2(x * 0.4, y * 0.4, 94) - 0.5) * 0.18;
      if (d < 1) v += 0.18;
      return pick(meadow, clamp01(v), x, y);
    },
    mask: (x, y) => (x > endX || x < 440 ? -1 : fbm2(x * 0.014, y * 0.04, 2, 90) - 0.55),
    forest: () => C.FOREST_FOOT,
  });
  const r = rng(95);
  const smoke = [];
  const groundAt = (x) => Math.round(base - prof(x)) + 1;
  // le village où KAGE arrive (début du chapitre), puis des fermes isolées
  const spots = [];
  for (let x = 24; x < 470; x += 28 + r() * 26) if (Math.abs(x - 300) > 22) spots.push({ x, s: 0.8 + r() * 0.45, tree: r(), pink: r(), side: r() });
  // puis des hameaux de 1 à 3 maisons tout au long du chapitre, et des fermes
  // isolées sur les rizières de la fin
  for (let x = 540; x < W - 40; x += (x > endX ? 150 : 95) + r() * 110) {
    const n = x > endX ? 1 : 1 + Math.floor(r() * 2.6);
    for (let k = 0; k < n; k++) spots.push({ x: x + k * (20 + r() * 8), s: 0.75 + r() * 0.45, tree: r(), pink: r(), side: r() });
  }
  for (const sp of spots) {                                    // cerisier ou arbre derrière la maison
    if (sp.tree > 0.6) continue;
    const y = groundAt(sp.x) + 2;
    const tx = Math.round(sp.x + (sp.side < 0.5 ? -11 : 11));
    pix.rect(tx, y - 11, 1, 9, C.WOOD[1]);
    crown(pix, tx, y - 15, 6, sp.pink < 0.55 ? C.BLOSSOM : C.LEAF, tx);
  }
  pix.done();
  const b = new Brush(pix.c.getContext('2d'));
  for (const sp of spots) {
    const h = house(b, Math.round(sp.x), groundAt(sp.x) + 2, sp.s, r, 0.06);
    if (r() < 0.75) smoke.push({ x: h.cx, y: h.cy });
  }
  // une pagode à cinq étages au cœur du village
  const px = 300, py = groundAt(px) + 2;
  const rf = C.ROOF, red = C.RED;
  for (let k = 0; k < 5; k++) {
    const w = 12 - k * 1.6, y = py - 5 - k * 7;
    b.r(px - w / 2 + 1, y, w - 2, 5, red[2]).r(px - w / 2 + 1, y, 1, 5, red[4]).r(px - w / 2 + 1, y + 1, w - 2, 1, red[0]);
    b.r(px - w / 2 - 2, y - 1, w + 4, 2, rf[1]).p(px - w / 2 - 3, y - 2, rf[2]).p(px + w / 2 + 2, y - 2, rf[1]);
  }
  b.r(px, py - 48, 1, 12, rf[0]);
  for (let k = 0; k < 5; k++) b.r(px - 1, py - 46 + k * 2, 3, 1, '#c8a04a');
  return { img: pix.c, W, plane: P, smoke };
}

// ---------------------------------------------------------------------------
// 5. la lisière : grands arbres, haies, bambous
// ---------------------------------------------------------------------------
function bigTree(pix, x, y, s, kind, r) {
  const ramp = kind === 'blossom' ? C.BLOSSOM : kind === 'pine' ? C.HEDGE : C.LEAF;
  const h = Math.round(24 * s);
  pix.rect(x - 1, y - h, 3, h, C.WOOD[1]).rect(x - 1, y - h, 1, h, C.WOOD[3]).rect(x + 1, y - h, 1, h, C.WOOD[0]);
  pix.line(x, y - h * 0.55, x - 9 * s, y - h * 0.95, C.WOOD[1], 2).line(x + 1, y - h * 0.45, x + 10 * s, y - h * 0.9, C.WOOD[1], 2);
  if (kind === 'pine') {
    for (let k = 0; k < 4; k++) crown(pix, x + (k % 2 ? 6 : -5) * s, y - h - 4 + k * 7 * s, (8 - k) * s, ramp, x + k, -0.04);
    return;
  }
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    crown(pix, x + (r() - 0.5) * 24 * s, y - h - 2 - r() * 12 * s, (6 + r() * 5) * s, ramp, x * 7 + i, 0.02);
  }
}

function paintNear(levelW, zones) {
  const P = PLANES.near;
  const W = Math.ceil(MAXW + (levelW - 480) * P.fx) + 4;
  const pix = new Pix(W, P.h);
  const base = P.base;
  const zoneAt = (sx) => {
    const wx = (sx - 240) / P.fx + 240;
    return zones.find((z) => wx >= z.x0 * TILE && wx < z.x1 * TILE)?.id ?? '01';
  };
  const r = rng(130);
  // grands arbres d'abord (ils dépassent de la haie)
  const trees = [];
  for (let x = 10; x < W; x += 40 + r() * 70) trees.push({ x: Math.round(x), z: zoneAt(x), s: 0.85 + r() * 0.5, j: r() });
  for (const t of trees) {
    if (t.z === '05') {
      for (let k = 0; k < 9; k++) {                            // bosquet de bambous derrière la serre
        const bx = Math.round(t.x + k * 5 + r() * 3), h = 56 + r() * 44;
        for (let y = Math.round(base - h); y < base + 10; y++) { pix.set(bx, y, C.BAMBOO[3]); pix.set(bx + 1, y, C.BAMBOO[1]); }
        for (let n = Math.round(base - h + 6); n < base; n += 9) { pix.set(bx, n, C.BAMBOO[0]); pix.set(bx + 1, n, C.BAMBOO[0]); }
        for (let n = 0; n < 6; n++) {                          // feuilles étroites qui retombent
          const ny = Math.round(base - h + 3 + n * 8), dir = (n + k) % 2 ? 1 : -1;
          for (let l = 0; l < 3; l++) {
            const len = 4 + l;
            for (let j = 0; j < len; j++) pix.set(bx + dir * (2 + j), ny + l * 2 + Math.round(j * 0.5), j < 2 ? C.BAMBOO[2] : C.BAMBOO[3]);
          }
        }
      }
      continue;
    }
    const kind = (t.z === '04' || t.z === '07' || t.z === '01') && t.j < 0.45 ? 'blossom' : t.j > 0.82 ? 'pine' : 'leaf';
    bigTree(pix, t.x, base - 10 + Math.round(t.j * 6), t.s, kind, r);
  }
  // de grandes fermes au toit de chaume, à demi cachées derrière la haie
  // (pas derrière la serre ni la grange, qui ont déjà leur fond)
  const rh = rng(131), farms = [];
  for (let x = 120; x < W - 60; x += 230 + rh() * 260) {
    const z = zoneAt(x);
    if (z === '05' || z === '06') continue;
    const f = { x: Math.round(x), s: 1.9 + rh() * 0.5, tree: rh(), side: rh(), pink: rh() };
    farms.push(f);
    if (f.tree < 0.6) bigTree(pix, f.x + (f.side < 0.5 ? -30 : 30), base - 8, 0.75, f.pink < 0.5 ? 'blossom' : 'leaf', rh);
  }
  pix.done();
  const bh = new Brush(pix.c.getContext('2d'));
  for (const f of farms) house(bh, f.x, base - 6, f.s, rh, 0);
  const hedge = new Pix(W, P.h);
  // haie basse continue, tamponnée par-dessus
  const prof = (x) => 18 + fbm1(x * 0.02, 3, 120) * 16;
  paintHills(hedge, {
    base, seed: 140, rMin: 6, rMax: 9, profile: prof, deep: 22,
    ground: (x, y) => pick(C.HEDGE, clamp01(0.3 - (y - base) / 60), x, y),
    mask: () => 0,
    forest: () => C.HEDGE,
    light: (x, y) => -clamp01((y - base + 10) / 40) * 0.25,
  });
  pix.c.getContext('2d').drawImage(hedge.done(), 0, 0);
  return { img: pix.c, W, plane: P };
}

// ---------------------------------------------------------------------------
// 6. le tout premier plan : herbes, fougères et grandes feuilles en ombre
//    chinoise, qui défilent plus vite que le jeu (en bas de l'image)
// ---------------------------------------------------------------------------
const FORE = { fx: 1.22, h: 70 };
const DARK = ['#101a0d', '#172414', '#1f311a', '#2a4122', '#3d5c2c'];

function paintFore(levelW, zones) {
  const W = Math.ceil(MAXW + (levelW - 480) * FORE.fx) + 4;
  const pix = new Pix(W, FORE.h);
  const r = rng(808);
  const H = FORE.h;
  const zoneAt = (sx) => {
    const wx = (sx - 240) / FORE.fx + 240;
    return zones.find((z) => wx >= z.x0 * TILE && wx < z.x1 * TILE)?.id ?? '01';
  };
  const blade = (x0, len, lean, w = 1) => {
    for (let j = 0; j < len; j++) {
      const t = j / len, x = Math.round(x0 + lean * t * t * len * 0.5);
      for (let k = 0; k < w; k++) pix.set(x + k, H - 1 - j, j > len - 3 ? DARK[3] : DARK[1 + ((x0 + k) % 2)]);
      if (j > len * 0.4 && lean < 0) pix.set(x + w, H - 1 - j, DARK[4]);
    }
  };
  for (let x = 20 + r() * 40; x < W; x += 50 + r() * 110) {
    const z = zoneAt(x);
    if (z === '06') continue;
    const kind = r();
    if (kind < 0.45) {                                         // touffe d'herbes hautes
      const n = 8 + Math.floor(r() * 10);
      for (let k = 0; k < n; k++) blade(Math.round(x + (r() - 0.5) * 26), 10 + r() * 22, (r() - 0.5) * 2.2, r() < 0.3 ? 2 : 1);
    } else if (kind < 0.7) {                                   // fougère
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.42, len = 18 + r() * 12;
        for (let j = 0; j < len; j++) {
          const px = Math.round(x + Math.cos(a) * j + (k - 2.5) * j * j * 0.012), py = Math.round(H - 2 + Math.sin(a) * j + j * j * 0.028);
          pix.set(px, py, DARK[2]);
          if (j % 2 === 0 && j > 3) { pix.set(px - 1, py + 1, DARK[1]); pix.set(px + 1, py + 1, DARK[1]); pix.set(px - 2, py + 2, DARK[0]); pix.set(px + 2, py + 2, DARK[0]); }
          if (j % 4 === 0) pix.set(px, py - 1, DARK[4]);
        }
      }
    } else if (kind < 0.88) {                                  // grandes feuilles larges (hosta)
      for (let k = 0; k < 4; k++) {
        const cx = x + (k - 1.5) * 9, cy = H - 8 - r() * 10, rw = 7 + r() * 4, rh = 4 + r() * 2;
        for (let j = -rh; j <= rh; j++) for (let i = -rw; i <= rw; i++) {
          if ((i * i) / (rw * rw) + (j * j) / (rh * rh) > 1) continue;
          const v = i * 0.04 + j * 0.08;
          pix.set(Math.round(cx + i), Math.round(cy + j - i * 0.25 * (k % 2 ? 1 : -1)), v < -0.2 ? DARK[3] : v < 0.1 ? DARK[2] : DARK[1]);
        }
        for (let j = 0; j < H - cy; j++) pix.set(Math.round(cx), Math.round(cy + j), DARK[1]);
      }
    } else {                                                   // fleurs sur leur tige
      for (let k = 0; k < 4; k++) {
        const fx = Math.round(x + k * 6 + r() * 3), h = 16 + r() * 18;
        for (let j = 0; j < h; j++) pix.set(fx, H - 1 - j, DARK[2]);
        const c = z === '04' || z === '07' ? '#c97a8f' : r() < 0.5 ? '#c9b25a' : '#b7b9c8';
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) pix.set(fx + dx, Math.round(H - h + dy), dx === 0 && dy === 0 ? '#f3e2a0' : c);
      }
      for (let k = 0; k < 6; k++) blade(Math.round(x + (r() - 0.3) * 24), 8 + r() * 10, (r() - 0.5) * 2);
    }
  }
  return { img: pix.done(), W };
}

// ---------------------------------------------------------------------------
// ciel
// ---------------------------------------------------------------------------
function paintSky(h, horizonY) {
  const pix = new Pix(4, h);
  const stops = [[0, C.SKY.top], [0.3, C.SKY.high], [0.58, C.SKY.mid], [0.8, C.SKY.low], [0.94, C.SKY.horizon], [1, C.SKY.glow]];
  for (let y = 0; y < h; y++) {
    const t = clamp01(y / horizonY);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const k = clamp01((t - t0) / (t1 - t0));
    for (let x = 0; x < 4; x++) {
      // passages tramés entre les bandes de couleur
      const q = Math.floor(k * 5 + bayer(x, y) - 0.5) / 5;
      pix.set(x, y, hex(mix(c0, c1, clamp01(q))));
    }
  }
  return pix.done();
}

// ---------------------------------------------------------------------------
// le fond complet
// ---------------------------------------------------------------------------
export class Backdrop {
  constructor(level) {
    const zones = level.zones;
    this.levelW = level.width;
    const T = {};
    const time = (k, f) => { const t = performance.now(); const r = f(); T[k] = Math.round(performance.now() - t); return r; };
    this.far = time('far', () => paintFar(level.width));
    this.mid = time('mid', () => paintMid(level.width));
    this.foot = time('foot', () => paintFoot(level.width, zones));
    this.village = time('village', () => paintVillage(level.width, zones));
    this.near = time('near', () => paintNear(level.width, zones));
    this.fore = time('fore', () => paintFore(level.width, zones));
    this.timings = T;
    this.skyH = 0;
    this.k = 1;
    this.sky = null;
    // nuages : grands cumulus dans le ciel, nappes basses autour des montagnes
    const r = rng(500);
    this.clouds = [];
    // nuages fins et étirés (sky.js) : quelques cirrus tout en haut, des nuages élégants, des bancs bas
    for (let i = 0; i < 3; i++) {
      this.clouds.push({ img: cirrusSprite(650 + i, 150 + r() * 90, 14, '#f4f8fa'), x: i * 620 + r() * 200, y: 2 + r() * 14, speed: 0.6 + r() * 0.5, f: 0.008, high: true });
    }
    for (let i = 0; i < 7; i++) {
      const w = 90 + r() * 120, h = 9 + r() * 9;
      this.clouds.push({ img: fineCloud(600 + i, w, h, C.CLOUD), x: i * 270 + r() * 120, y: 10 + r() * 56, speed: 1.2 + r() * 2, f: 0.012 + r() * 0.01, high: true });
    }
    for (let i = 0; i < 7; i++) {
      const w = 110 + r() * 130, h = 4 + r() * 5;
      this.clouds.push({ img: fineCloud(700 + i, w, h, C.CLOUD), x: i * 290 + r() * 100, y: 0, dy: -(r() * 46), speed: 2.5 + r() * 3, f: 0.05, high: false });
    }
  }

  /**
   * Base d'un plan à l'écran, selon la hauteur de la caméra. Le fond est peint
   * sur son propre calque à la résolution de l'écran (k pixels d'écran par pixel
   * de jeu) : les positions sont arrondies au pixel d'écran, pas au pixel de jeu,
   * pour que les plans lointains glissent lentement et sans à-coups.
   */
  planeY(plane, cam, viewH) {
    const gy = GROUND_ROW * TILE - cam.y;                    // sol de référence à l'écran
    const ref = viewH * GROUND_AT;
    return this.q(ref + plane.off + (gy - ref) * plane.fy) - plane.base;
  }

  /** Arrondi au pixel d'écran. */
  q(v) { return Math.round(v * this.k) / this.k; }

  drawStrip(ctx, strip, cam, viewW, viewH) {
    const off = this.q(cam.x * strip.plane.fx);
    const sx = Math.floor(off), frac = off - sx;
    const y = this.planeY(strip.plane, cam, viewH);
    const w = Math.min(viewW + 1, strip.W - sx);
    if (w > 0) ctx.drawImage(strip.img, sx, 0, w, strip.plane.h, -frac, y, w, strip.plane.h);
    return y;
  }

  drawClouds(ctx, cam, viewW, viewH, time, high) {
    const span = 1900;
    for (const c of this.clouds) {
      if (c.high !== high) continue;
      const x = ((c.x + time * c.speed - cam.x * c.f) % span + span) % span - 200;
      if (x > viewW || x + c.img.width < 0) continue;
      const y = high ? c.y + Math.round((viewH - 270) * 0.3) : this.planeY(PLANES.mid, cam, viewH) + PLANES.mid.base - 64 + c.dy;
      if (!high) ctx.globalAlpha = 0.82;
      ctx.drawImage(c.img, this.q(x), this.q(y));
      ctx.globalAlpha = 1;
    }
  }

  /** k = pixels d'écran par pixel de jeu (le contexte est déjà mis à l'échelle). */
  draw(ctx, cam, viewW, viewH, time, k = 1) {
    this.k = k;
    if (this.skyH !== viewH) {
      this.skyH = viewH;
      this.sky = paintSky(viewH, viewH * GROUND_AT - 30);
    }
    ctx.drawImage(this.sky, 0, 0, 4, viewH, 0, 0, viewW, viewH);
    this.drawClouds(ctx, cam, viewW, viewH, time, true);
    this.drawStrip(ctx, this.far, cam, viewW, viewH);
    this.drawBirds(ctx, cam, viewW, viewH, time);
    this.drawClouds(ctx, cam, viewW, viewH, time, false);
    this.drawStrip(ctx, this.mid, cam, viewW, viewH);
    this.drawStrip(ctx, this.foot, cam, viewW, viewH);
    const vy = this.drawStrip(ctx, this.village, cam, viewW, viewH);
    this.villageY = vy;
    // fumées des cheminées du village
    const sx0 = this.q(cam.x * this.village.plane.fx);
    for (const c of this.village.smoke) {
      const x = c.x - sx0, y = vy + c.y;
      if (x < -10 || x > viewW + 10) continue;
      for (let i = 0; i < 6; i++) {
        const t = (time * 0.22 + i / 6 + c.x * 0.013) % 1;
        ctx.globalAlpha = 0.45 * (1 - t);
        ctx.fillStyle = '#f1f3ef';
        const sz = 1 + Math.round(t * 3);
        ctx.fillRect(x + Math.round(Math.sin(t * 4 + c.x) * 2 + t * 8), y + Math.round(-2 - t * 26), sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    const ny = this.drawStrip(ctx, this.near, cam, viewW, viewH);
    // sous la lisière (visible dans les canaux et les fossés) : la haie se prolonge
    const bottom = ny + this.near.plane.h;
    if (bottom < viewH) { ctx.fillStyle = C.HEDGE[0]; ctx.fillRect(0, bottom - 1, viewW, viewH - bottom + 1); }
  }

  /** Vols d'oiseaux en V qui traversent lentement le ciel. */
  drawBirds(ctx, cam, viewW, viewH, time) {
    ctx.fillStyle = '#4a5468';
    for (let f = 0; f < 3; f++) {
      const period = 70 + f * 23;
      const t = ((time + f * 31) % period) / period;
      const x0 = this.q(viewW + 60 - t * (viewW + 160) - cam.x * 0.02), y0 = 30 + f * 26 + Math.sin(time * 0.3 + f) * 4;
      const n = 3 + f * 2;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2);
        const x = x0 + k * 7, y = Math.round(y0 + side * k * 4);
        const up = Math.sin(time * 9 + i) > 0;
        ctx.fillRect(x - 2, y + (up ? -1 : 0), 2, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + (up ? -1 : 0), 2, 1);
      }
    }
  }

  /** Premier plan sombre, devant tout (en bas de l'image). */
  drawFore(ctx, cam, viewW, viewH) {
    const sx = Math.round(cam.x * FORE.fx);
    const w = Math.min(viewW, this.fore.W - sx);
    if (w <= 0) return;
    ctx.drawImage(this.fore.img, sx, 0, w, FORE.h, 0, viewH - FORE.h + 6, w, FORE.h);
  }

  /** Cheminées du village (pour la fumée animée), en coordonnées d'écran. */
  chimneys(cam, viewW) {
    const sx = cam.x * this.village.plane.fx;
    return this.village.smoke.map((s) => ({ x: s.x - sx, y: (this.villageY ?? 0) + s.y })).filter((s) => s.x > -10 && s.x < viewW + 10);
  }
}
