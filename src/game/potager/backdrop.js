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
// nuages : sprites peints (boules de coton éclairées par le haut à gauche)
// ---------------------------------------------------------------------------
function cloudSprite(seed, w, h, flat = 1) {
  const r = rng(seed);
  const pix = new Pix(w + 10, h + 6);
  const base = h + 2;
  const puffs = [];
  // rangée basse et large, puis des dômes de plus en plus hauts vers le centre
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rad = (0.25 + 0.55 * Math.sin(t * Math.PI) * (0.65 + r() * 0.5)) * h;
    puffs.push({ cx: 5 + t * w + (r() - 0.5) * 8, cy: base - rad * (0.5 + r() * 0.3), r: rad });
  }
  for (let i = 0; i < 4; i++) {
    const rad = h * (0.28 + r() * 0.22);
    puffs.push({ cx: 5 + w * (0.2 + r() * 0.6), cy: base - h * (0.45 + r() * 0.2), r: rad });
  }
  // relief : hauteur d'une sphère pour chaque bouffée, la plus haute l'emporte
  const H = (x, y) => {
    let best = -1;
    for (const p of puffs) {
      const dx = x - p.cx, dy = (y - p.cy) * 1.15 * flat;
      const q = p.r * p.r - dx * dx - dy * dy;
      if (q > 0) best = Math.max(best, Math.sqrt(q));
    }
    return best;
  };
  const L = [-0.45, -0.7, 0.55];
  for (let y = 0; y < pix.h; y++) {
    for (let x = 0; x < pix.w; x++) {
      if (y > base) continue;
      const z = H(x, y);
      if (z < 0) continue;
      const zx = H(x + 1, y) - H(x - 1, y), zy = H(x, y + 1) - H(x, y - 1);
      const nx = -Math.max(-6, Math.min(6, zx)) / 2, ny = -Math.max(-6, Math.min(6, zy)) / 2, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      let v = 0.42 + 0.62 * ((nx * L[0] + ny * L[1] + nz * L[2]) / len);
      v -= clamp01((y - (base - h * 0.3)) / (h * 0.3)) * 0.3;     // ventre ombré
      if (z < 1.6 && y < base - 2) v += 0.08;                    // bord lumineux
      pix.set(x, y, pick(C.CLOUD, clamp01(v), x, y, 0.36));
    }
  }
  return pix.done();
}

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
function paintFar(levelW) {
  const P = PLANES.far;
  const W = Math.ceil(MAXW + (levelW - 480) * P.fx) + 4;
  const pix = new Pix(W, P.h);
  const r = rng(7);
  const groups = [
    { haze: 0.46, hMin: 100, hMax: 150, step: [110, 180], peaks: [] },
    { haze: 0.2, hMin: 85, hMax: 140, step: [130, 210], peaks: [] },
    { haze: 0.05, hMin: 40, hMax: 78, step: [70, 120], peaks: [] },
  ];
  let seed = 100;
  for (const g of groups) {
    for (let x = -40 + r() * 60; x < W + 60; x += g.step[0] + r() * (g.step[1] - g.step[0])) {
      const h = g.hMin + r() * (g.hMax - g.hMin);
      g.peaks.push({ x, h, rl: h * (1.2 + r() * 0.6), rr: h * (1.2 + r() * 0.6), seed: seed++ });
    }
  }
  // le Mont Kagero : le plus haut, au loin devant KAGE pendant tout le chapitre
  const giant = { x: 430, h: 188, rl: 225, rr: 200, seed: 999 };
  groups[1].peaks = groups[1].peaks.filter((p) => Math.abs(p.x - giant.x) > 170);
  groups[1].peaks.push(giant, { x: 336, h: 118, rl: 110, rr: 80, seed: 998 }, { x: 540, h: 132, rl: 80, rr: 130, seed: 997 });
  const list = [];
  for (const g of groups) {
    const o = { rock: hazeRamp(C.ROCK_FAR, C.HAZE, g.haze), snow: hazeRamp(C.SNOW, C.HAZE, g.haze * 0.6), mist: 56 };
    for (const pk of g.peaks.sort((a, b) => b.h - a.h)) list.push({ pk, o });
  }
  paintPeaks(pix, list, P.base);
  pix.done();
  // le dojo final, minuscule, sur un replat du Mont Kagero, et son sentier
  const b = new Brush(pix.c.getContext('2d'));
  const dx = giant.x + 46;
  const dy = Math.round(P.base - peakHeight(giant, dx));
  const ink = '#3d4668', wall = '#7d86a8', lamp = '#f3c770';
  b.r(dx - 9, dy, 19, 2, '#6b7699');                           // replat de pierre
  b.r(dx - 6, dy - 4, 13, 4, wall).r(dx - 8, dy - 5, 17, 1, ink).r(dx - 9, dy - 6, 2, 1, ink).r(dx + 8, dy - 6, 2, 1, ink)
    .r(dx - 4, dy - 9, 9, 3, wall).r(dx - 6, dy - 10, 13, 1, ink).r(dx - 7, dy - 11, 1, 1, ink).r(dx + 6, dy - 11, 1, 1, ink)
    .r(dx - 2, dy - 13, 5, 2, ink).r(dx, dy - 16, 1, 3, ink)
    .p(dx - 3, dy - 2, lamp).p(dx + 3, dy - 2, lamp).p(dx, dy - 7, lamp);
  b.r(dx - 14, dy - 5, 1, 5, '#a3473a').r(dx - 10, dy - 5, 1, 5, '#a3473a').r(dx - 15, dy - 6, 7, 1, '#7d2f28');
  for (let i = 0; i < 40; i++) {                               // sentier en lacets dans la neige
    const sx = dx - 12 + Math.round(Math.sin(i * 0.42) * 7) - Math.floor(i / 4);
    const sy = dy + 2 + i * 2;
    if (sy < P.base - 50 && ih(i, 2, 3) < 0.8) b.p(sx, sy, '#8f9abb');
  }
  return { img: pix.c, W, plane: P };
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
const paddyCol = { x: NaN, seed: 0, scale: 0, wob: 0 };
function paddyColor(x, y, d, scale, haze, seed) {
  const bandH = 6 * scale;
  if (paddyCol.x !== x || paddyCol.seed !== seed || paddyCol.scale !== scale) {
    paddyCol.x = x; paddyCol.seed = seed; paddyCol.scale = scale;
    paddyCol.wob = fbm1(x * 0.018 / scale, 2, seed) * 9 * scale + Math.sin(x * 0.025 / scale) * 3 * scale;
  }
  const q = d + paddyCol.wob;
  const band = Math.floor(q / bandH), ly = q - band * bandH;
  const cell = Math.floor((x + band * 17 * scale) / ((36 + ih(band, 0, seed) * 40) * scale));
  const kind = ih(cell, band, seed + 1);
  if (ly < 1) return mixHex(C.GRASS[2], C.HAZE, haze);                   // diguette herbeuse
  if (ly < 1 + scale * 0.6 && scale > 1) return mixHex(C.GRASS[1], C.HAZE, haze);
  if (kind < 0.62) {
    // eau : le ciel s'y reflète, avec un trait de lumière
    const sh = ih(Math.floor(x / (3 * scale)), band, seed + 2);
    const c = ly > bandH - 1.5 ? '#c4e2e8' : sh > 0.85 ? '#e6f4f2' : kind < 0.3 ? '#9fcbd6' : '#b3d8df';
    return mixHex(c, C.HAZE, haze * 0.7);
  }
  // jeunes pousses de riz en rangs
  const row = Math.floor(x / (2 * scale)) % 2;
  return mixHex(kind < 0.85 ? (row ? '#9fcf6a' : '#86bb57') : (row ? '#c1dc8a' : '#a9cd76'), C.HAZE, haze);
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
  for (let x = 560; x < endX; x += 110 + r() * 170) spots.push({ x, s: 0.8 + r() * 0.45, tree: r(), pink: r(), side: r() });
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
  // haie basse continue, tamponnée par-dessus
  const prof = (x) => 18 + fbm1(x * 0.02, 3, 120) * 16;
  paintHills(pix, {
    base, seed: 140, rMin: 6, rMax: 9, profile: prof, deep: 22,
    ground: (x, y) => pick(C.HEDGE, clamp01(0.3 - (y - base) / 60), x, y),
    mask: () => 0,
    forest: () => C.HEDGE,
    light: (x, y) => -clamp01((y - base + 10) / 40) * 0.25,
  });
  pix.done();
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
    for (let i = 0; i < 7; i++) {
      const w = 80 + r() * 110, h = 22 + r() * 22;
      this.clouds.push({ img: cloudSprite(600 + i, w, h), x: i * 270 + r() * 120, y: 4 + r() * 60, speed: 1.2 + r() * 2, f: 0.012 + r() * 0.01, high: true });
    }
    for (let i = 0; i < 7; i++) {
      const w = 90 + r() * 120, h = 9 + r() * 8;
      this.clouds.push({ img: cloudSprite(700 + i, w, h, 1.8), x: i * 290 + r() * 100, y: 0, dy: -(r() * 46), speed: 2.5 + r() * 3, f: 0.05, high: false });
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
