// Décors du Potager, peints une fois dans les tranches du terrain.
// Chaque décor est posé sur le sol : p.x = colonne (centre de la tuile),
// p.y = ligne du haut du sol. Il peut appartenir à plusieurs couches :
//   backdrop : fond d'intérieur (serre, grange) ; back : derrière KAGE ;
//   ground : posé sur l'herbe, devant les tuiles ; front : devant KAGE.
// Les éléments animés (roue à eau, eau qui coule, lanternes, koïs…) sont dans live.js.
import { ih, noise1, noise2, rng, pick, mix, hex, mixHex, worley } from './paint.js';
import * as C from './palette.js';

const TILE = 16;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// couches de chaque type de décor (dans l'ordre de peinture)
const LAYERS = {
  serre: ['backdrop', 'front'], grange: ['backdrop', 'front'], terraces_bg: ['backdrop'], basin: ['ground'],
  house: ['back'], mill: ['back'], well: ['back'], tree: ['back', 'front'], orchard_canopy: ['front'],
  ladder: ['back'], lantern_stone: ['back'], shrine: ['back'], gate: ['back', 'front'], torii: ['back'],
  bridge_red: ['back'], stall: ['back'], kakashi: ['back'], daikon_rack: ['back'], bamboo_grove: ['back'],
  pine: ['back'], jizo: ['ground'], fox: ['ground'], crops: ['ground'], fence: ['ground'], stone: ['ground'],
  baskets: ['ground'], bridge: ['ground'], reeds: ['ground', 'front'], pots: ['ground'], hay: ['ground'],
  barn_door: ['back', 'front'], signpost: ['ground'], woodpile: ['ground'], cart: ['ground'], bush: ['ground'],
  sacks: ['ground'], tools: ['ground'], tubs: ['ground'], trellis: ['back'], tall_grass: ['front'],
  path_stones: ['ground'], bench: ['ground'], sign: ['ground'], waterfall: [], waterwheel: [], koi: [], kappa: [], barrel: [],
};
export function propLayers(p) { return LAYERS[p.type] ?? ['ground']; }
export const PROP_REACH = { terraces_bg: 1100, serre: 700, grange: 600, house: 90, mill: 160, tree: 70, orchard_canopy: 600, gate: 80, stall: 80, bridge_red: 180, bamboo_grove: 90, crops: 400, reeds: 120, bridge: 200, trellis: 120 };

// ---------------------------------------------------------------------------
// outils de dessin
// ---------------------------------------------------------------------------

/** Masse de feuillage ronde, éclairée du haut à gauche, au bord découpé. */
function leaves(b, cx, cy, r, ramp, seed, opt = {}) {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.ceil(r * 1.25), sq = opt.sq ?? 1;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const a = Math.atan2(y, x);
      const rr = r * (0.8 + 0.32 * noise1(a * 2.6 + 4, seed)) ;
      const d = Math.hypot(x, y / sq);
      if (d > rr) continue;
      const nx = x / r, ny = y / (r * sq);
      let v = 0.6 + (opt.light ?? 0) - nx * 0.34 - ny * 0.48;
      const w = worley(cx + x, cy + y, opt.cell ?? 3.2, seed + 3);
      v += -(w.dx + w.dy) * 0.07;
      if (w.d2 - w.d < 0.55) v -= 0.12;
      if (d > rr - 1.2 && nx + ny > 0) v -= 0.26;
      b.p(cx + x, cy + y, pick(ramp, clamp01(v), cx + x, cy + y, 0.3));
    }
  }
}

/** Fleurs ou fruits semés sur un feuillage. */
function dots(b, cx, cy, r, colors, n, seed, size = 1) {
  for (let i = 0; i < n; i++) {
    const a = ih(i, seed, 1) * Math.PI * 2, d = Math.sqrt(ih(i, seed, 2)) * r;
    const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
    const c = colors[Math.floor(ih(i, seed, 3) * colors.length)];
    b.r(x, y, size, size, c);
    if (size > 1) b.p(x, y, hex(mix(c, '#ffffff', 0.45)));
  }
}

/** Tronc ou branche : segment épais, écorce claire à gauche. */
function limb(b, x0, y0, x1, y1, w0, w1, ramp = C.WOOD) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, w = w0 + (w1 - w0) * t;
    const half = w / 2;
    for (let k = -Math.ceil(half); k <= Math.ceil(half); k++) {
      if (Math.abs(k) > half + 0.3) continue;
      const q = (k + half) / (w + 0.01);
      let v = 0.62 - q * 0.5 + (noise2(x * 0.3, y * 0.6, 5) - 0.5) * 0.3;
      if (Math.abs(noise2(x * 0.2, y * 0.08, 6) - 0.5) < 0.04) v -= 0.25;   // crevasses de l'écorce
      b.p(Math.round(x + k), Math.round(y), pick(ramp, clamp01(v), Math.round(x + k), Math.round(y)));
    }
  }
}

/** Planches verticales (mur, porte). */
function planks(b, x, y, w, h, ramp, opt = {}) {
  const pw = opt.pw ?? 4;
  for (let i = 0; i < w; i++) {
    const k = Math.floor(i / pw), edge = i % pw === 0;
    for (let j = 0; j < h; j++) {
      let v = (opt.v ?? 0.45) + (ih(k, Math.floor(j / 23), opt.seed ?? 1) - 0.5) * 0.3 + (noise2((x + i) * 0.4, (y + j) * 0.05, 7) - 0.5) * 0.2;
      if (edge) v -= 0.22;
      if (i % pw === 1) v += 0.08;
      b.p(x + i, y + j, pick(ramp, clamp01(v), x + i, y + j));
    }
  }
}

/** Toit de chaume épais, à pignon : rangs de paille superposés, mousse, faîtage. */
function thatchRoof(b, cx, y, w, h, seed, ramp = C.THATCH) {
  for (let j = 0; j < h; j++) {
    const half = Math.round(w / 2 - (j * (w / 2 - 6)) / h);
    for (let i = -half; i <= half; i++) {
      const x = cx + i, yy = y + h - 1 - j;
      const band = (yy - y + Math.round(noise1(x * 0.15, seed) * 3)) % 9;
      let v = 0.6 - (j / h) * 0.08 - (i / half) * 0.16;
      v += (noise2(x * 1.3, yy * 0.18, seed) - 0.5) * 0.42;     // brins de paille
      if (band === 0) v -= 0.22;                                  // ombre sous chaque rang
      else if (band === 1) v += 0.14;                             // pointes éclairées
      const moss = noise2(x * 0.16, yy * 0.22, seed + 3) * (0.75 + 0.25 * noise2(x * 0.03, yy * 0.05, seed + 4));
      if (j < 3) {                                                // avant-toit épais, effiloché
        if (j === 0 && ih(x, 0, seed) < 0.3) continue;
        v = 0.18 + (j * 0.08) + (noise1(x * 0.9, seed + 1) - 0.5) * 0.2;
      }
      if (Math.abs(i) > half - 1) v -= 0.2;
      if (moss > 0.76 && j > 3) { b.p(x, yy, pick(C.MOSS, clamp01(v - 0.05), x, yy)); continue; }
      b.p(x, yy, pick(ramp, clamp01(v), x, yy));
    }
  }
  // faîtage en bois et bambou
  b.r(cx - 8, y - 4, 16, 4, C.ROOF[1]).r(cx - 8, y - 4, 16, 1, C.ROOF[3]).r(cx - 8, y - 1, 16, 1, C.ROOF[0]);
  for (let k = -7; k <= 7; k += 3) b.r(cx + k, y - 7, 1, 3, C.WOOD[1]);
}

/** Toit de tuiles grises, rangées de tuiles rondes. */
function tileRoof(b, cx, y, w, h, flare = 3) {
  for (let j = 0; j < h; j++) {
    const half = Math.round(w / 2 - (j * (w / 2 - 4)) / h) + (j < 2 ? flare - j : 0);
    for (let i = -half; i <= half; i++) {
      const x = cx + i, yy = y + h - 1 - j;
      let v = 0.5 + ((x % 3) === 0 ? -0.18 : (x % 3) === 1 ? 0.12 : 0) - (i / half) * 0.12;
      if ((yy - y) % 4 === 0) v -= 0.1;
      if (j === 0) v = 0.1;
      b.p(x, yy, pick(C.ROOF, clamp01(v), x, yy));
    }
  }
  b.r(cx - w / 2 + 6, y - 2, w - 12, 2, C.ROOF[0]).r(cx - w / 2 + 6, y - 2, w - 12, 1, C.ROOF[2]);
}

/**
 * La colline en terrasses (zone 2), construite gradin par gradin : chaque
 * gradin a sa largeur (tirée au hasard, différente à gauche et à droite), un
 * dessus plat vu un peu d'en haut (arc plus bas au milieu : il épouse la
 * rondeur) et un mur de pierre en façade. La silhouette est donc un escalier
 * irrégulier : replat, mur, replat… Géométrie partagée par le décor et l'eau.
 */
const hillCache = new Map();
export function hillGeom(p) {
  const key = `${p.x},${p.w},${p.mx},${p.peak}`;
  if (hillCache.has(key)) return hillCache.get(key);
  const x0 = p.x * TILE, x1 = (p.x + p.w) * TILE, mx = p.mx * TILE, base = p.y * TILE;
  const r = rng(4040);
  const tiers = [];
  let y = p.peak;
  const incL = [], incR = [];
  for (let k = 0; y < base + 30; k++) {
    const D = Math.round(7 + k * 0.55 + r() * 2), wall = Math.round(5 + k * 0.4 + r() * 2);
    tiers.push({ y, D, wall, sag: 3 + k * 1.5, curl: Math.min(D - 4, 3 + k * 0.35), kind: r(), seed: k });
    incL.push(16 + Math.round(r() * 24));                         // chaque gradin dépasse le précédent,
    incR.push(14 + Math.round(r() * 24));                         // d'une longueur inégale
    y += D + wall;
  }
  // les largeurs sont mises à l'échelle pour que le gradin du bas finisse juste
  // au bord de la zone peinte : l'escalier reste irrégulier jusqu'en bas
  const fit = (inc, w0, room) => {
    const tot = inc.slice(0, -1).reduce((a, b) => a + b, 0);
    const k = Math.min(1, (room - w0) / Math.max(1, tot));
    let w = w0;
    return inc.map((d) => { const cur = w; w += d * k; return Math.round(cur); });
  };
  const WL = fit(incL, 34, mx - x0 - 8), WR = fit(incR, 26, x1 - mx - 8);
  tiers.forEach((t, k) => { t.wl = WL[k]; t.wr = WR[k]; });
  const wob = (yy, k, side) => (noise1(yy * 0.35 + k * 7.3 + side * 50, 61) - 0.5) * 3;
  // bout de gradin arrondi : le coin haut du replat s'arrondit (rayon R)
  const R = 5;
  const round = (t, yy) => { const d = yy - t.y; return d >= R ? 0 : R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d))); };
  const covers = (t, dx, yy, k) => (dx < 0 ? -dx < t.wl + wob(yy, k, 0) - round(t, yy) : dx < t.wr + wob(yy, k, 1) - round(t, yy));
  // bord avant du replat : il plonge au milieu (plus près de nous) et, au bout,
  // remonte en douceur, comme s'il contournait la colline
  const lip = (t, dx) => {
    const u = Math.min(1, Math.abs(dx) / (dx < 0 ? t.wl : t.wr));
    const v = Math.max(0, (u - 0.8) / 0.2);
    return t.y + t.D + t.sag * (1 - u * u) - t.curl * v * v + (noise1((mx + dx) * 0.06, t.seed + 3) - 0.5) * 1.6;
  };
  /** Ce qu'il y a au point (x, y) : null (ciel), ou { tier, part: 'top' | 'wall', f }. */
  const band = (x, yy) => {
    const dx = x - mx;
    let k = 0; while (k < tiers.length && !covers(tiers[k], dx, yy, k)) k++;
    if (k >= tiers.length || yy < tiers[k].y) return null;
    let start = tiers[k].y;
    for (let j = k; j < tiers.length; j++) {
      const t = tiers[j], L = lip(t, dx), B = L + t.wall;
      if (yy < L) return { tier: j, t, part: 'top', f: (yy - start) / Math.max(1, L - start), h: L - start, edge: j === k };
      if (yy < B) return { tier: j, t, part: 'wall', f: (yy - L) / t.wall };
      start = B;
    }
    return null;
  };
  /** Haut de la silhouette en x (le replat du gradin le plus haut qui couvre x). */
  const top = (x) => {
    const dx = x - mx;
    for (const t of tiers) if (dx < 0 ? -dx < t.wl : dx < t.wr) return t.y;
    return null;
  };
  // le ruisseau : de la source (sur le replat du sommet) au rocher du bas,
  // presque aussi large que la cascade, en nappe sur les replats, en chute sur les murs
  const src = { x: mx + 6, y: tiers[0].y + 3 };
  const weir = { x: p.spout * TILE + 8, y: p.lip };
  const rows = [];
  for (let yy = src.y; yy < weir.y - 8; yy++) {
    const tt = (yy - src.y) / (weir.y - 8 - src.y);
    const cx = src.x + (weir.x - src.x) * tt + Math.sin(tt * 5) * 5 * (1 - tt);
    const w = 14 + tt * 10;
    rows.push({ y: yy, x0: Math.round(cx - w / 2), x1: Math.round(cx + w / 2) });
  }
  const g = { x0, x1, mx, peak: p.peak, base, tiers, band, top, rows, src, weir };
  hillCache.set(key, g);
  return g;
}

const hazeRampLite = (ramp) => ramp.map((c) => hex(mix(c, '#c2d6cc', 0.35)));

function rope(b, x0, y0, x1, y1, sag, c = '#3a2e22') {
  const n = Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.p(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), c);
  }
}

/** Rocher naturel : contour irrégulier, facettes fissurées, mousse sur le dessus. */
function boulder(b, cx, cy, rw, rh, seed, veilCol, veilK) {
  const fin = (c) => (veilCol ? mixHex(c, veilCol, veilK) : c);
  for (let y = -rh - 2; y <= rh; y++) {
    for (let x = -rw - 3; x <= rw + 3; x++) {
      const a = Math.atan2(y / rh, x / rw);
      const rad = 0.82 + 0.26 * noise1(a * 2.2 + 5, seed) + (y > rh * 0.4 ? 0.2 : 0);   // base large, dessus bosselé
      const d = Math.hypot(x / rw, y / rh);
      if (d > rad) continue;
      const w = worley(cx + x, cy + y, 5, seed, 0.75);
      let v = 0.62 - (x / rw) * 0.3 - (y / rh) * 0.3 - (w.dx / 5) * 0.18 - (w.dy / 4) * 0.2;
      if (w.d2 - w.d < 0.75) v -= 0.3;                             // fissures
      if (d > rad - 0.12 && x + y > 0) v -= 0.2;                   // ombre propre
      if (y < -rh * 0.35 && noise2((cx + x) * 0.3, (cy + y) * 0.3, seed) > 0.5) {
        b.p(cx + x, cy + y, fin(pick(C.MOSS, clamp01(0.5 - x / rw * 0.2), cx + x, cy + y)));
        continue;
      }
      b.p(cx + x, cy + y, fin(pick(C.STONE, clamp01(v), cx + x, cy + y, 0.15)));
    }
  }
}

/** Une ombre douce au sol (ellipse tramée). */
function groundShadow(b, cx, y, w) {
  for (let i = -w; i <= w; i++) if ((i + y) % 2 === 0 || Math.abs(i) < w * 0.6) b.p(cx + i, y, 'rgba(30, 40, 20, 0.28)');
}

// ---------------------------------------------------------------------------
// légumes
// ---------------------------------------------------------------------------
function veg(b, x, y, kind, s) {
  const V = C.VEG;
  switch (kind) {
    case 'carottes': {
      b.r(x - 2, y - 3, 4, 3, V.carrot[1]).r(x - 2, y - 3, 1, 2, V.carrot[2]).p(x + 1, y - 1, V.carrot[0]);
      for (let k = 0; k < 5; k++) {                             // fanes plumeuses
        const dir = (k - 2) * 0.55, h = 6 + Math.floor(ih(x, k, s) * 4);
        for (let j = 0; j < h; j++) {
          const lx = Math.round(x + dir * j * 0.6);
          b.p(lx, y - 4 - j, j % 2 ? C.GRASS[3] : C.GRASS[2]);
          if (j > 2 && j % 2 === 0) b.p(lx + (dir >= 0 ? 1 : -1), y - 4 - j, C.GRASS[4]);
        }
      }
      break;
    }
    case 'radis':
      b.r(x - 2, y - 4, 5, 4, V.radish[1]).r(x - 2, y - 4, 2, 2, V.radish[2]).p(x + 2, y - 1, V.radish[0]).p(x, y, '#e9d8c0');
      leaves(b, x - 3, y - 7, 2.6, C.LEAF, x, { light: 0.1 });
      leaves(b, x + 3, y - 8, 2.8, C.LEAF, x + 1, { light: 0.15 });
      break;
    case 'navets':
      b.r(x - 3, y - 5, 7, 5, V.turnip[1]).r(x - 3, y - 5, 7, 2, '#b48ac8').r(x - 3, y - 4, 2, 2, V.turnip[2]).p(x + 3, y - 1, V.turnip[0]);
      leaves(b, x - 3, y - 9, 3, C.LEAF, x + 2, { light: 0.1 });
      leaves(b, x + 3, y - 10, 3.2, C.LEAF, x + 3, { light: 0.15 });
      break;
    case 'choux':
      leaves(b, x, y - 5, 5.5, V.cabbage, x + 7, { light: 0.05, cell: 2.4, sq: 0.85 });
      leaves(b, x - 1, y - 6, 3.2, ['#79b04f', '#a8d47a', '#cfe8a8', '#e6f4d0'], x + 8, { light: 0.1, cell: 2 });
      break;
    case 'poireaux':
      b.r(x, y - 7, 2, 7, V.leek[2]).r(x, y - 7, 1, 7, '#ffffff');
      b.line(x, y - 7, x - 4, y - 15, V.leek[1]).line(x + 1, y - 7, x + 4, y - 16, V.leek[0]).line(x, y - 8, x + 1, y - 17, V.leek[1]);
      break;
    case 'potirons':
      for (let j = 0; j < 7; j++) for (let i = -6; i <= 6; i++) {
        if (i * i * 0.3 + (j - 3.5) ** 2 > 11) continue;
        b.p(x + i, y - 7 + j, pick(V.pumpkin, clamp01(0.62 - i * 0.05 - (j - 3) * 0.08 + (i % 4 === 0 ? -0.18 : 0)), x + i, y + j));
      }
      b.r(x, y - 9, 2, 2, C.WOOD[1]);
      leaves(b, x - 8, y - 4, 3.5, C.LEAF, x + 9, { light: 0.05 });
      break;
    case 'aubergines':
      leaves(b, x, y - 11, 4.5, C.LEAF, x, { light: 0.05 });
      b.r(x - 1, y - 7, 3, 6, V.eggplant[1]).p(x - 1, y - 7, V.eggplant[2]).r(x - 1, y - 8, 3, 1, C.GRASS[1]);
      break;
    default:
  }
}

const VEG_ROW = {
  carottes: 'carottes', radis: 'radis', navets: 'navets', choux: 'choux', poireaux: 'poireaux', potirons: 'potirons', aubergines: 'aubergines',
};

// ---------------------------------------------------------------------------
// les décors
// ---------------------------------------------------------------------------
const PAINT = {
  // --- zone 1 : le chemin des premières pousses ---------------------------
  house(b, p, X, Y) {
    // grande ferme au toit de chaume, un peu en retrait du chemin
    const w = 96, wall = 30;
    // soubassement de pierre et véranda (engawa)
    b.r(X - w / 2, Y - 6, w, 6, C.STONE[2]).r(X - w / 2, Y - 6, w, 1, C.STONE[4]);
    for (let i = 0; i < w; i += 7) b.r(X - w / 2 + i, Y - 6, 1, 6, C.STONE[1]);
    // murs : enduit clair, colombages, portes coulissantes (shōji)
    b.r(X - w / 2 + 4, Y - 6 - wall, w - 8, wall, C.PLASTER[2]);
    for (let i = 0; i < w - 8; i++) for (let j = 0; j < wall; j++) if (noise2((X + i) * 0.3, (Y + j) * 0.3, 2) > 0.7) b.p(X - w / 2 + 4 + i, Y - 6 - wall + j, C.PLASTER[1]);
    for (let k = 0; k <= 6; k++) b.r(X - w / 2 + 4 + k * 14.6, Y - 6 - wall, 3, wall, C.WOOD[1]).r(X - w / 2 + 4 + k * 14.6, Y - 6 - wall, 1, wall, C.WOOD[3]);
    b.r(X - w / 2 + 4, Y - 6 - wall, w - 8, 3, C.WOOD[1]).r(X - w / 2 + 4, Y - 6 - wall + 13, w - 8, 2, C.WOOD[1]);
    for (const sx of [X - 30, X + 8]) {                         // shōji lumineux
      b.r(sx, Y - 6 - wall + 16, 20, 13, C.PAPER[2]);
      for (let i = 0; i < 20; i += 5) b.r(sx + i, Y - 6 - wall + 16, 1, 13, C.WOOD[2]);
      for (let j = 0; j < 13; j += 4) b.r(sx, Y - 6 - wall + 16 + j, 20, 1, C.WOOD[2]);
    }
    b.r(X - 8, Y - 6 - wall + 16, 12, 14, C.WOOD[0]).r(X - 7, Y - 6 - wall + 17, 10, 13, '#2a1c14');   // porte ouverte, sombre
    b.r(X - 4, Y - 6 - wall + 17, 2, 13, C.CLOTH[2]);                // rideau (noren)
    // toit de chaume
    thatchRoof(b, X, Y - 6 - wall - 34, w + 16, 36, 31);
    // auvent de bois et poteaux de la véranda
    b.r(X - w / 2 - 2, Y - 6 - wall, w + 4, 3, C.WOOD[2]).r(X - w / 2 - 2, Y - 6 - wall, w + 4, 1, C.WOOD[4]);
    // tas de bois et tonneau à côté
    PAINT.woodpile(b, p, X + w / 2 + 10, Y);
  },

  woodpile(b, p, X, Y) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
      const cx = X - 9 + k * 6 + r * 3, cy = Y - 3 - r * 5;
      b.disc(cx, cy, 3, C.WOOD[2]).disc(cx, cy, 2, C.WOOD[4]).p(cx, cy, C.WOOD[2]);
    }
    b.r(X - 11, Y - 18, 1, 18, C.WOOD[1]).r(X + 13, Y - 18, 1, 18, C.WOOD[1]);
  },

  crops(b, p, X, Y) {
    // sillons de terre et rangées de légumes
    const x0 = p.x * TILE, w = (p.w ?? 1) * TILE;
    for (let i = 0; i < w; i++) {
      const bump = Math.round(Math.sin(i / 8 * Math.PI) * 1.4);
      for (let j = 0; j < 2 + bump; j++) b.p(x0 + i, Y - 1 - j, j === 1 + bump ? C.SOIL[4] : C.SOIL[2]);
    }
    const kinds = (p.kind ?? 'carottes').split('+');
    for (let i = 5; i < w - 3; i += 10) veg(b, x0 + i, Y - 1, VEG_ROW[kinds[Math.floor(i / 10) % kinds.length]] ?? 'carottes', p.x * 31 + i);
  },

  fence(b, p, X, Y) {
    // clôture de bambou à claire-voie, ligaturée de corde noire
    const w = (p.w ?? 2) * TILE, x0 = X - w / 2;
    for (const ry of [Y - 6, Y - 12]) {
      b.r(x0 - 2, ry, w + 4, 2, C.BAMBOO[3]).r(x0 - 2, ry, w + 4, 1, C.BAMBOO[5]);
      for (let k = 0; k < w; k += 9) b.r(x0 + k + 4, ry, 1, 1, C.BAMBOO[1]);
    }
    for (let k = 0; k <= w; k += 6) {
      const h = 15 + (k % 12 ? 0 : 2);
      b.r(x0 + k, Y - h, 2, h, C.BAMBOO[2]).r(x0 + k, Y - h, 1, h, C.BAMBOO[4]).r(x0 + k, Y - h, 2, 1, C.BAMBOO[0]);
      b.r(x0 + k - 1, Y - 12, 4, 2, '#2a2420').r(x0 + k - 1, Y - 6, 4, 2, '#2a2420');
    }
  },

  stone(b, p, X, Y) {
    // pierres moussues
    const r = rng(p.x * 7 + 1);
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const cx = X - 6 + i * 7 + r() * 3, rw = 4 + r() * 4, rh = 3 + r() * 3;
      for (let y = -rh; y <= 0; y++) for (let x = -rw; x <= rw; x++) {
        if ((x * x) / (rw * rw) + (y * y) / (rh * rh) > 1) continue;
        let v = 0.6 - (x / rw) * 0.3 + (y / rh) * 0.35;
        if (y < -rh * 0.4 && noise2((cx + x) * 0.5, (Y + y) * 0.5, i) > 0.45) { b.p(cx + x, Y + y, pick(C.MOSS, clamp01(v), cx + x, Y + y)); continue; }
        b.p(Math.round(cx + x), Y + y, pick(C.STONE, clamp01(v), cx + x, Y + y));
      }
    }
  },

  jizo(b, p, X, Y) {
    // petite statue de Jizō, bavoir et bonnet rouges, offrande
    b.r(X - 6, Y - 4, 12, 4, C.STONE[2]).r(X - 6, Y - 4, 12, 1, C.STONE[4]);
    for (let j = 0; j < 14; j++) {
      const half = j < 4 ? 2 + j * 0.5 : 4;
      for (let i = -half; i <= half; i++) b.p(X + i, Y - 18 + j, pick(C.STONE, clamp01(0.6 - i * 0.08 - (j < 4 ? -0.1 : 0)), X + i, j));
    }
    b.r(X - 4, Y - 13, 9, 4, C.RED[3]).r(X - 3, Y - 10, 7, 1, C.RED[2]).r(X - 3, Y - 20, 6, 3, C.RED[3]).r(X - 3, Y - 20, 6, 1, C.RED[4]);
    b.p(X - 1, Y - 16, C.STONE[0]).p(X + 1, Y - 16, C.STONE[0]);
    b.r(X + 6, Y - 6, 3, 2, C.VEG.apple[1]).r(X + 9, Y - 5, 2, 1, C.PAPER[3]);
  },

  sign(b, p, X, Y) {
    // panneau de bois peint (inscriptions décoratives)
    b.r(X - 1, Y - 22, 3, 22, C.WOOD[2]).r(X - 1, Y - 22, 1, 22, C.WOOD[4]);
    b.r(X - 9, Y - 24, 19, 11, C.WOOD[3]).r(X - 9, Y - 24, 19, 1, C.WOOD[5]).r(X - 9, Y - 14, 19, 1, C.WOOD[1]);
    const glyph = ['1110100', '0101110', '1011010'];
    for (let g = 0; g < 3; g++) for (let k = 0; k < 7; k++) if (glyph[g][k] === '1') b.p(X - 7 + g * 5 + (k % 3), Y - 22 + Math.floor(k / 3) * 3, '#2a1c14');
  },

  kakashi(b, p, X, Y) {
    // épouvantail habillé d'un vieux kimono rapiécé
    b.r(X, Y - 34, 2, 34, C.WOOD[1]).r(X - 12, Y - 26, 26, 2, C.WOOD[2]);
    for (let j = 0; j < 14; j++) {
      const half = 6 + j * 0.3;
      for (let i = -half; i <= half; i++) b.p(X + 1 + i, Y - 27 + j, pick(C.CLOTH, clamp01(0.6 - i * 0.04 + (noise2(i, j, 3) - 0.5) * 0.3), X + i, j));
    }
    b.r(X - 3, Y - 22, 5, 4, '#a37b4f').r(X + 3, Y - 18, 4, 3, '#8f3b2f');      // rapiéçages
    b.r(X - 12, Y - 26, 4, 5, C.CLOTH[2]).r(X + 10, Y - 26, 4, 5, C.CLOTH[1]);  // manches
    b.r(X - 13, Y - 22, 2, 3, C.STRAW[3]).r(X + 14, Y - 22, 2, 3, C.STRAW[3]);
    b.disc(X + 1, Y - 32, 4, C.PAPER[2]).p(X - 1, Y - 33, '#2a2420').p(X + 3, Y - 33, '#2a2420').r(X - 1, Y - 30, 4, 1, '#2a2420');
    b.r(X - 8, Y - 37, 19, 2, C.STRAW[2]).r(X - 4, Y - 40, 11, 3, C.STRAW[3]).r(X - 8, Y - 37, 19, 1, C.STRAW[4]).r(X - 2, Y - 41, 7, 1, C.STRAW[4]);
  },

  tree(b, p, X, Y, env, layer) {
    // arbre fruitier au tronc tortueux ; cerisier en fleurs
    const r = rng(p.x * 13 + 7);
    const kind = p.kind ?? 'fruit';
    const blossom = kind === 'cerisier';
    const ramp = blossom ? C.BLOSSOM : C.LEAF;
    const s = p.s ?? 1;
    const lean = (r() - 0.5) * 14;
    const top = { x: X + lean, y: Y - 46 * s };
    if (layer === 'back') {
      // racines et tronc
      b.r(X - 6, Y - 2, 13, 2, C.WOOD[1]);
      limb(b, X, Y, X + lean * 0.4, Y - 22 * s, 9, 7);
      limb(b, X + lean * 0.4, Y - 22 * s, top.x, top.y, 7, 4);
      const branches = [];
      for (let k = 0; k < 5; k++) {
        const t = 0.35 + k * 0.14, bx = X + lean * t, by = Y - 50 * s * t;
        const dir = k % 2 ? 1 : -1, len = (16 + r() * 14) * s;
        const ex = bx + dir * len, ey = by - 8 - r() * 12;
        limb(b, bx, by, ex, ey, 4, 2);
        branches.push({ x: ex, y: ey });
      }
      // feuillage (de l'arrière vers l'avant)
      const puffs = [...branches, top, { x: top.x - 14 * s, y: top.y + 2 }, { x: top.x + 14 * s, y: top.y + 4 }, { x: top.x, y: top.y - 10 * s }];
      for (const [i, q] of puffs.entries()) leaves(b, q.x, q.y, (11 + r() * 5) * s, blossom ? C.BLOSSOM : C.LEAF, p.x + i, { light: -0.08, cell: 3 });
      for (const [i, q] of puffs.entries()) leaves(b, q.x - 2, q.y - 3, (7 + r() * 4) * s, ramp, p.x * 3 + i, { light: 0.08, cell: 2.6 });
      if (kind === 'pommier' || kind === 'fruit') for (const q of puffs) dots(b, q.x, q.y, 10 * s, C.VEG.apple, 4, Math.round(q.x), 2);
      if (kind === 'poirier') for (const q of puffs) dots(b, q.x, q.y, 10 * s, C.VEG.pear, 4, Math.round(q.x), 2);
      if (blossom) for (const q of puffs) dots(b, q.x, q.y, 11 * s, [C.BLOSSOM[4], '#ffffff', C.BLOSSOM[1]], 7, Math.round(q.x), 1);
      // fruits tombés et pétales au pied
      for (let k = 0; k < 6; k++) {
        const fx = X - 20 + r() * 40;
        b.p(Math.round(fx), Y - 1, blossom ? C.BLOSSOM[3] : kind === 'poirier' ? C.VEG.pear[1] : C.VEG.apple[1]);
      }
    } else if (layer === 'front' && (p.front ?? true)) {
      // quelques feuilles basses passent devant KAGE (haut du feuillage seulement)
      leaves(b, top.x + 16 * s, top.y + 8, 6 * s, ramp, p.x + 50, { light: -0.1 });
    }
  },

  orchard_canopy(b, p, X, Y, env) {
    // voûte de branches au-dessus du chemin du verger : premier plan
    const x0 = p.x * TILE, w = (p.w ?? 20) * TILE, top = p.top ?? 70;
    const r = rng(p.x * 3);
    for (let x = x0; x < x0 + w; x += 18 + r() * 20) {
      const dep = 30 + r() * 40;
      limb(b, x, top - 6, x + (r() - 0.5) * 30, top + dep * 0.6, 4, 2, C.WOOD);
      leaves(b, x + (r() - 0.5) * 20, top + dep * 0.5, 12 + r() * 8, r() < 0.4 ? C.BLOSSOM : C.LEAF, Math.round(x), { light: -0.15 });
      leaves(b, x + (r() - 0.5) * 20, top + dep * 0.3, 10 + r() * 6, C.LEAF, Math.round(x) + 9, { light: -0.22 });
      if (r() < 0.5) dots(b, x, top + dep * 0.5, 10, C.VEG.apple, 3, Math.round(x), 2);
    }
  },

  ladder(b, p, X, Y) {
    const h = (p.h ?? 4) * TILE;
    b.line(X - 6, Y, X + 2, Y - h, C.WOOD[2], 2).line(X + 2, Y, X + 10, Y - h, C.WOOD[2], 2);
    b.line(X - 5, Y, X + 3, Y - h, C.WOOD[4]);
    for (let y = 6; y < h; y += 7) {
      const t = y / h;
      b.r(Math.round(X - 6 + 8 * t), Y - y, 16, 1, C.WOOD[3]);
    }
  },

  baskets(b, p, X, Y) {
    // paniers de bambou tressé pleins de légumes (renversé si pillé)
    const basket = (cx, cy, w, h, tilt) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const v = 0.55 - (i / w) * 0.3 + ((i + j * 2) % 4 < 2 ? 0.12 : -0.05) - (j === 0 ? -0.15 : 0);
        b.p(cx + i + Math.round(tilt * j), cy + j, pick(C.STRAW, clamp01(v), cx + i, cy + j));
      }
      b.r(cx + Math.round(tilt * 0) - 1, cy, w + 2, 1, C.STRAW[1]);
    };
    if (p.stolen) {
      basket(X - 8, Y - 8, 14, 8, 0.4);
      for (let k = 0; k < 7; k++) veg(b, X + 10 + k * 5, Y, ['carottes', 'radis', 'navets'][k % 3], X + k);
      return;
    }
    basket(X - 14, Y - 10, 13, 10, 0);
    basket(X + 1, Y - 9, 12, 9, 0);
    basket(X - 7, Y - 19, 12, 9, 0);
    for (let k = 0; k < 3; k++) veg(b, X - 12 + k * 4, Y - 10, 'carottes', X + k);
    for (let k = 0; k < 2; k++) veg(b, X + 3 + k * 6, Y - 9, 'choux', X + 9 + k);
    for (let k = 0; k < 2; k++) veg(b, X - 4 + k * 5, Y - 19, 'navets', X + 4 + k);
  },

  daikon_rack(b, p, X, Y) {
    // séchoir à radis blancs (hoshi-daikon) : perches et cordes
    const w = (p.w ?? 3) * TILE;
    b.r(X - w / 2, Y - 34, 2, 34, C.WOOD[2]).r(X + w / 2 - 2, Y - 34, 2, 34, C.WOOD[2]);
    b.r(X - w / 2 - 3, Y - 34, w + 6, 2, C.BAMBOO[3]).r(X - w / 2 - 3, Y - 34, w + 6, 1, C.BAMBOO[5]);
    for (let x = X - w / 2 + 4; x < X + w / 2 - 3; x += 4) {
      const h = 11 + Math.floor(ih(x, 0, 9) * 6);
      b.r(x, Y - 33, 1, 2, C.GRASS[1]);
      for (let j = 0; j < h; j++) b.r(x - (j < h - 3 ? 1 : 0), Y - 31 + j, j < h - 3 ? 3 : 1, 1, j % 5 === 2 ? C.PAPER[1] : C.PAPER[3]);
    }
  },

  bridge(b, p, X, Y) {
    // garde-corps de bois le long de la terrasse
    const x0 = p.x * TILE, w = (p.w ?? 4) * TILE;
    b.r(x0, Y - 11, w, 2, C.WOOD[3]).r(x0, Y - 11, w, 1, C.WOOD[5]).r(x0, Y - 6, w, 1, C.WOOD[2]);
    for (let k = 0; k <= w; k += 16) b.r(x0 + k, Y - 13, 3, 13, C.WOOD[2]).r(x0 + k, Y - 13, 1, 13, C.WOOD[4]).r(x0 + k - 1, Y - 14, 5, 1, C.WOOD[1]);
  },

  terraces_bg(b, p, X, Y) {
    // la colline en terrasses : voir hillGeom (gradins inégaux, silhouette en
    // escalier), flanc droit dans l'ombre, végétation, abri, escalier ; le
    // ruisseau naît au sommet et descend de replat en replat jusqu'au rocher
    const H = hillGeom(p);
    const VEIL = '#c4d7cc';
    const veil = (c, y) => mixHex(c, VEIL, Math.round((0.24 + (1 - (y - H.peak) / (Y - H.peak)) * 0.1) * 20) / 20);
    for (let x = H.x0; x < H.x1; x++) {
      const dx = x - H.mx;
      const top = H.top(x);
      if (top == null) continue;
      for (let y = top - 3; y < Y; y++) {
        const q = H.band(x, y);
        if (!q) continue;
        const W = dx < 0 ? q.t.wl : q.t.wr, u = Math.min(1, Math.abs(dx) / W);
        const side = -0.3 * (dx / Math.max(1, W)) * (0.5 + 0.5 * u) - (dx > 0 ? 0.12 * u * u : 0);   // lumière à gauche
        let col;
        if (q.part === 'wall') {
          const w = worley(x, y, 3.4, 91 + q.tier, 0.6);
          let v = 0.56 - (w.dx / 3.4) * 0.2 - (w.dy / 2) * 0.2 + side;
          if (w.d2 - w.d < 0.8) v = 0.08;
          if (q.f > 0.86) v -= 0.25;
          if (q.f < 0.16) v += 0.14;                                  // arête du mur, éclairée
          col = pick(C.STONE, clamp01(v), x, y, 0.15);
          if (q.f < 0.2 && ih(x, q.tier, 13) < 0.25) col = pick(C.GRASS, clamp01(0.55 + side), x, y);   // herbe qui retombe
        } else {
          const f = q.f, kind = q.t.kind;
          if (f < 0.16 || (q.edge && y - q.t.y < 1)) col = pick(C.GRASS, clamp01(0.78 + side), x, y);   // bord herbeux
          else if (kind < 0.42) {                                                    // légumes en rangs
            const row = Math.floor(f * 3), ry = f * 3 - row;
            const px = (x + row * 4 + q.tier * 3) % 6;
            const plant = ry > 0.25 && px < 4 && !(px === 0 && ry < 0.5) && !(px === 3 && ry < 0.5);
            col = plant ? pick(C.GRASS, clamp01(0.62 + side + (ry < 0.55 ? 0.12 : -0.08) - (px > 1 ? 0.1 : 0)), x, y) : C.SOIL[3];
            if (plant && px === 1 && ry > 0.7 && ih(x, q.tier, 6) < 0.35) col = [C.VEG.carrot[1], C.VEG.cabbage[2], '#e7e1f0', C.VEG.radish[1]][q.tier % 4];
          } else if (kind < 0.72) {                                                  // rizière inondée : le ciel s'y reflète
            col = f > 0.88 ? C.GRASS[1] : ih(Math.floor(x / 3), y, q.tier) > 0.9 ? '#eef7f4' : (y + q.tier) % 3 === 0 ? '#a9d0d6' : '#bcdde0';
            if ((x + y) % 4 === 0 && f < 0.88) col = '#93c46a';
            if (side < -0.15 && col !== '#93c46a') col = mixHex(col, '#7fa4ae', 0.3);
          } else {                                                                   // théiers taillés en boules
            // rangs de buissons (un rang par ~6 px de profondeur), décalés d'un rang à
            // l'autre, chaque buisson un peu différent ; ombre portée sur la terre
            const rows = Math.max(1, Math.round((q.h ?? 8) / 6)), ff = (f - 0.16) / 0.84;
            const row = Math.min(rows - 1, Math.floor(ff * rows)), ry = ff * rows - row;
            const cx = x + q.tier * 7 + row * 4, cell = Math.floor(cx / 8), bx = (cx % 8) - 3.5;
            const rad = 2.9 + ih(cell, row, q.tier + 30) * 1.1, by = (ry - 0.5) * 6.5;
            const d = (bx * bx) / (rad * rad) + (by * by) / 10;
            if (d < 1) col = pick(C.HEDGE, clamp01(0.62 + side - bx * 0.06 - by * 0.09 + (d < 0.3 ? 0.08 : 0)), x, y);
            else col = by > 0 && Math.abs(bx) < rad + 1 ? C.SOIL[1] : C.SOIL[2 + (ih(x, y, 31) < 0.2 ? 1 : 0)];
          }
        }
        b.p(x, y, veil(col, y));
      }
    }
    const vr = (ramp) => ramp.map((c) => mixHex(c, VEIL, 0.24));
    // touffes et buissons aux angles des gradins (sans masquer les marches)
    for (const t of H.tiers) {
      for (const [sgn, w] of [[-1, t.wl], [1, t.wr]]) {
        const x = Math.round(H.mx + sgn * (w - 3));
        if (x < H.x0 + 4 || x > H.x1 - 4 || t.y > Y - 12) continue;
        if (ih(t.seed, sgn + 2, 14) < 0.55) leaves(b, x, t.y + 1, 3 + ih(t.seed, sgn, 15) * 2.5, vr(ih(t.seed, sgn, 16) < 0.3 ? C.BLOSSOM : C.HEDGE), x, { sq: 0.7 });
      }
    }
    // escalier de pierre : il grimpe de gradin en gradin, en lacets
    for (let k = 1; k < H.tiers.length - 1; k++) {
      const t = H.tiers[k], sx = Math.round(H.mx - 70 + Math.sin(k * 1.7) * 30);
      const q = H.band(sx, t.y + t.D + 2);
      if (!q || t.y > Y - 10) continue;
      for (let s2 = 0; s2 < 3; s2++) {
        const yy = Math.round(t.y + t.D + t.sag * 0.8 + s2 * 3);
        b.r(sx - 3 + s2, yy, 6, 2, veil(C.STONE[4], yy)).r(sx - 3 + s2, yy + 2, 6, 1, veil(C.STONE[1], yy));
      }
    }
    // arbres posés sur les replats, pin et abri de paille au sommet
    const tree = (x, kind, s) => {
      const y = H.top(x);
      if (y == null || y > Y - 20) return;
      const ramp = vr(kind === 'blossom' ? C.BLOSSOM : kind === 'pine' ? C.HEDGE : C.LEAF);
      b.r(x, y - 10 * s, 2, 10 * s + 2, mixHex(C.WOOD[1], VEIL, 0.25));
      if (kind === 'pine') {
        for (let k = 0; k < 3; k++) leaves(b, x + (k % 2 ? 3 : -2), y - 10 * s - k * 5, (7 - k * 1.6) * s, ramp, x + k, { sq: 0.55 });
      } else {
        leaves(b, x - 4 * s, y - 12 * s, 6 * s, ramp, x, {});
        leaves(b, x + 4 * s, y - 13 * s, 6 * s, ramp, x + 1, {});
        leaves(b, x, y - 17 * s, 6.5 * s, ramp, x + 2, { light: 0.06 });
      }
    };
    const T = H.tiers;
    tree(H.mx + T[0].wr - 6, 'pine', 1.15);
    tree(H.mx - T[2].wl + 8, 'leaf', 0.95);
    tree(H.mx - T[4].wl + 6, 'blossom', 0.85);
    tree(H.mx + T[3].wr - 7, 'leaf', 0.9);
    tree(H.mx + T[6].wr - 6, 'pine', 0.85);
    tree(H.mx - T[7].wl + 7, 'leaf', 0.8);
    const hx = H.mx - T[0].wl + 14, hy = T[0].y + 3;
    b.r(hx - 9, hy - 8, 18, 8, mixHex(C.WOOD[2], VEIL, 0.25)).r(hx - 3, hy - 6, 5, 6, mixHex(C.WOOD[0], VEIL, 0.25));
    for (let k = 0; k < 7; k++) b.r(hx - 12 + k, hy - 9 - k, 24 - k * 2, 1, mixHex(C.THATCH[k < 2 ? 1 : 3], VEIL, 0.25));
    // le ruisseau : nappe d'eau sur les replats, chute d'écume sur chaque mur
    for (const row of H.rows) {
      for (let x = row.x0; x <= row.x1; x++) {
        const q = H.band(x, row.y);
        if (!q) continue;
        const e = Math.min(x - row.x0, row.x1 - x);
        let col;
        if (q.part === 'wall') {
          // chute : filets blancs et bleus verticaux, écume au pied
          col = e === 0 ? C.WATER[2] : (x * 3) % 4 === 0 ? C.WATER[4] : (x * 3) % 4 === 1 ? '#ffffff' : C.WATER[5];
          if (q.f > 0.7) col = (x + row.y) % 3 ? '#ffffff' : C.WATER[5];
        } else {
          // nappe : bleu franc, bords sombres, petites rides claires
          col = e === 0 ? C.WATER[1] : e === 1 ? C.WATER[2] : (row.y * 3 + Math.floor(x / 4)) % 7 === 0 ? C.WATER[5] : row.y % 2 ? C.WATER[3] : C.WATER[4];
          if (q.f < 0.22) col = (x + row.y) % 2 ? '#ffffff' : C.WATER[5];   // remous au pied de la chute
        }
        b.p(x, row.y, col);
      }
      // éclaboussures au pied de chaque chute
      const q = H.band((row.x0 + row.x1) >> 1, row.y);
      if (q && q.part === 'top' && q.f < 0.2) {
        for (const sx of [row.x0 - 2, row.x0 - 1, row.x1 + 1, row.x1 + 2]) if (ih(sx, row.y, 17) < 0.5) b.p(sx, row.y - 1, '#ffffff');
      }
    }
    // la source : de l'eau qui sourd entre des rochers moussus, au sommet
    boulder(b, H.src.x - 13, H.src.y + 1, 9, 6, 71, VEIL, 0.18);
    boulder(b, H.src.x + 12, H.src.y + 2, 7, 5, 72, VEIL, 0.18);
    b.r(H.src.x - 5, H.src.y - 1, 11, 3, C.WATER[4]).r(H.src.x - 4, H.src.y - 1, 8, 1, C.WATER[5]);
    // le rocher d'où tombe la grande cascade : un bloc naturel, fissuré, moussu
    boulder(b, H.weir.x, H.weir.y - 9, 30, 13, 73, null, 0);
    // l'eau franchit le rocher par une échancrure aux bords irréguliers
    for (let y = H.weir.y - 16; y < H.weir.y; y++) {
      const k = (y - H.weir.y + 16) / 16;
      const l = Math.round(H.weir.x - 9 - k * 2 + (noise1(y * 0.5, 81) - 0.5) * 3), rr = Math.round(H.weir.x + 9 + k * 2 + (noise1(y * 0.5, 82) - 0.5) * 3);
      b.p(l - 1, y, '#3d4a4c').p(rr + 1, y, '#3d4a4c');                 // rocher mouillé
      for (let x = l; x <= rr; x++) {
        const e = Math.min(x - l, rr - x);
        b.p(x, y, e === 0 ? C.WATER[2] : (x * 3 + y) % 5 === 0 ? '#ffffff' : (x * 3) % 4 === 1 ? C.WATER[5] : C.WATER[4]);
      }
    }
    leaves(b, H.weir.x - 27, H.weir.y - 15, 5, C.LEAF, 3, { sq: 0.7 });
    leaves(b, H.weir.x + 26, H.weir.y - 13, 4.5, C.LEAF, 4, { sq: 0.7 });
    for (let k = 0; k < 5; k++) b.r(H.weir.x + 22 + k * 2, H.weir.y - 22 - (k % 2) * 3, 1, 8 + (k % 2) * 3, C.GRASS[2 + (k % 2)]);
  },

  basin(b, p, X, Y) {
    // bassin de pierre où tombe la cascade
    b.r(X - 16, Y - 7, 32, 7, C.STONE[2]).r(X - 16, Y - 7, 32, 1, C.STONE[4]).r(X - 16, Y - 1, 32, 1, C.STONE[0]);
    for (let k = 0; k < 4; k++) b.r(X - 16 + k * 8, Y - 6, 1, 5, C.STONE[1]);
    b.r(X - 14, Y - 6, 28, 2, C.WATER[3]).r(X - 14, Y - 6, 28, 1, C.WATER[5]);
    leaves(b, X - 18, Y - 4, 4, C.MOSS, 2, { sq: 0.6 });
    for (let k = 0; k < 4; k++) b.r(X + 15 + k * 2, Y - 8 - (k % 2) * 3, 1, 8 + (k % 2) * 3, C.GRASS[2 + (k % 2)]);
  },

  // --- zone 3 : les canaux --------------------------------------------------
  mill(b, p, X, Y) {
    // le moulin à eau : grande bâtisse de bois, toit de chaume, bief en bois
    const w = 120, wall = 52, cx = X - 70;
    b.r(cx - w / 2, Y - 8, w, 8, C.STONE[2]);
    for (let i = 0; i < w; i += 8) for (let j = 0; j < 8; j += 4) b.r(cx - w / 2 + i + ((j / 4) % 2) * 4, Y - 8 + j, 1, 4, C.STONE[1]);
    planks(b, cx - w / 2 + 4, Y - 8 - wall, w - 8, wall, C.WOOD, { pw: 5, v: 0.42, seed: 3 });
    for (let k = 0; k < 4; k++) b.r(cx - w / 2 + 4 + k * 37, Y - 8 - wall, 4, wall, C.WOOD[1]);
    b.r(cx - w / 2 + 4, Y - 8 - wall + 22, w - 8, 3, C.WOOD[1]);
    b.r(cx - 20, Y - 8 - 30, 16, 20, '#2a1c14').r(cx - 20, Y - 8 - 30, 16, 2, C.WOOD[0]);   // porte sombre
    b.r(cx + 16, Y - 8 - wall + 6, 14, 10, '#2a1c14').r(cx + 16, Y - 8 - wall + 6, 14, 10, 'rgba(255, 210, 120, 0.25)');
    for (let i = 0; i < 14; i += 4) b.r(cx + 16 + i, Y - 8 - wall + 6, 1, 10, C.WOOD[2]);
    thatchRoof(b, cx, Y - 8 - wall - 40, w + 22, 42, 61);
    // sacs de farine devant
    for (let k = 0; k < 3; k++) PAINT.sacks(b, p, cx - 42 + k * 9, Y, true);
    // le bief : canal de bois qui amène l'eau en haut de la roue
    const fx = p.flume ?? X - 10, fy = Y - 70;
    b.r(cx + w / 2 - 6, fy, fx - (cx + w / 2 - 6) + 10, 6, C.WOOD[2]).r(cx + w / 2 - 6, fy, fx - (cx + w / 2 - 6) + 10, 1, C.WOOD[4]);
    b.r(cx + w / 2 - 6, fy + 1, fx - (cx + w / 2 - 6) + 10, 2, C.WATER[3]);
    b.r(fx - 2, fy + 6, 3, Y - fy - 6, C.WOOD[1]);
  },

  reeds(b, p, X, Y, env, layer) {
    // roseaux, massettes et iris au bord de l'eau
    const x0 = p.x * TILE, w = (p.w ?? 2) * TILE;
    const r = rng(p.x * 5 + (layer === 'front' ? 1 : 0));
    const n = Math.round(w / (layer === 'front' ? 6 : 2.5));
    for (let k = 0; k < n; k++) {
      const x = Math.round(x0 + r() * w), h = layer === 'front' ? 6 + r() * 8 : 10 + r() * 16, lean = (r() - 0.5) * 6;
      for (let j = 0; j < h; j++) b.p(Math.round(x + lean * (j / h) ** 2), Y - j, j > h - 3 ? C.GRASS[4] : pick(C.GRASS, 0.35 + r() * 0.3, x, j));
      if (layer === 'back' && r() < 0.2) b.r(Math.round(x + lean) - 1, Y - h - 4, 2, 5, C.WOOD[1]).p(Math.round(x + lean) - 1, Y - h - 4, C.WOOD[3]);   // massette
      if (r() < 0.1) b.r(Math.round(x + lean * 0.5) - 1, Y - Math.round(h * 0.6), 3, 2, C.FLOWER.violet).p(Math.round(x + lean * 0.5), Y - Math.round(h * 0.6) - 1, C.FLOWER.yellow);
    }
  },

  // --- zone 4 : le verger --------------------------------------------------
  lantern_stone(b, p, X, Y) {
    // lanterne de pierre (tōrō) : socle, fût, chambre à lumière, toit relevé
    const S = C.STONE;
    b.r(X - 7, Y - 3, 15, 3, S[2]).r(X - 7, Y - 3, 15, 1, S[4]);
    b.r(X - 3, Y - 16, 7, 13, S[3]).r(X - 3, Y - 16, 2, 13, S[4]).r(X + 2, Y - 16, 2, 13, S[1]);
    b.r(X - 6, Y - 19, 13, 3, S[2]).r(X - 6, Y - 19, 13, 1, S[4]);
    b.r(X - 5, Y - 26, 11, 7, S[3]).r(X - 3, Y - 25, 7, 5, '#3a2a1a').r(X - 2, Y - 24, 5, 3, C.GLOW[1]).r(X - 1, Y - 24, 3, 2, C.GLOW[3]);
    for (let j = 0; j < 5; j++) b.r(X - 9 + j, Y - 27 - j, 19 - j * 2, 1, j === 0 ? S[1] : S[3 - (j > 2 ? 1 : 0)]);
    b.p(X - 10, Y - 28, S[2]).p(X + 10, Y - 28, S[2]);
    b.r(X - 1, Y - 34, 3, 3, S[3]).p(X, Y - 35, S[4]);
    b.r(X - 6, Y - 19, 3, 1, C.MOSS[2]).r(X + 3, Y - 31, 3, 1, C.MOSS[2]);
  },

  // --- zone 5 : la serre de bambou ----------------------------------------
  serre(b, p, X, Y, env, layer) {
    const x0 = p.x0 * TILE, x1 = p.x1 * TILE, y0 = p.y0 * TILE, y1 = p.y1 * TILE;
    if (layer === 'backdrop') {
      // toiles de protection tendues, translucides, déchirées par endroits
      for (let x = x0; x < x1; x++) for (let y = y0 - 34; y < y1; y++) {
        const u = (x - x0) % 48;
        const sag = y < y0 ? Math.round(Math.sin((u / 48) * Math.PI) * 10) : 0;
        if (y < y0 - 24 + sag) continue;
        const torn = noise2(x * 0.08, y * 0.12, 71) > 0.72 && y > y0 + 6;
        if (torn) { if (noise2(x * 0.08, y * 0.12, 71) < 0.74) b.p(x, y, 'rgba(240, 244, 228, 0.7)'); continue; }
        const fold = Math.sin((x - x0) * 0.4) * 0.5 + 0.5;
        const v = 0.55 + fold * 0.15 - (y - y0) / 300;
        b.p(x, y, `rgba(${Math.round(222 + v * 20)}, ${Math.round(232 + v * 15)}, ${Math.round(205 + v * 20)}, ${y < y0 ? 0.92 : 0.66})`);
      }
      // structure : arceaux et poteaux de bambou, étagères, pots, plantes grimpantes
      for (let x = x0; x <= x1; x += 48) {
        for (let y = y0 - 26; y < y1; y++) { b.p(x, y, C.BAMBOO[4]); b.p(x + 1, y, C.BAMBOO[2]); b.p(x + 2, y, C.BAMBOO[1]); }
        for (let n = y0; n < y1; n += 14) b.r(x - 1, n, 5, 1, C.BAMBOO[0]);
        // liane qui s'enroule
        for (let y = y0; y < y1 - 2; y++) {
          const vx = x + 1 + Math.round(Math.sin(y * 0.35 + x) * 3);
          b.p(vx, y, C.LEAF[2]);
          if (y % 5 === 0) b.r(vx - 1, y, 3, 2, C.LEAF[3]).p(vx - 1, y, C.LEAF[4]);
        }
      }
      for (let x = x0; x < x1; x++) {
        const u = (x - x0) % 48;
        b.p(x, y0 - 24 + Math.round(Math.sin((u / 48) * Math.PI) * 10), C.BAMBOO[2]);
      }
      // étagères de graines contre la toile
      for (let k = 0; k < 4; k++) {
        const sx = x0 + 70 + k * 150, sy = y1 - 50;
        if (sx > x1 - 40) continue;
        for (const dy of [0, 18]) {
          b.r(sx, sy + dy, 40, 3, C.WOOD[3]).r(sx, sy + dy, 40, 1, C.WOOD[5]);
          for (let j = 0; j < 5; j++) {
            const kind = Math.floor(ih(sx + j, dy, 4) * 3);
            const jx = sx + 3 + j * 8;
            b.r(jx, sy + dy - 7, 6, 7, [C.TERRACOTTA[3], C.PAPER[2], '#8aa074'][kind]).r(jx, sy + dy - 8, 6, 1, C.WOOD[1]).p(jx, sy + dy - 6, '#ffffff');
          }
        }
        b.r(sx, sy, 2, 50, C.WOOD[2]).r(sx + 38, sy, 2, 50, C.WOOD[2]);
      }
      // plantes suspendues
      for (let x = x0 + 30; x < x1 - 20; x += 96) {
        rope(b, x, y0, x, y0 + 14, 0, C.WOOD[1]);
        b.r(x - 4, y0 + 14, 9, 5, C.TERRACOTTA[2]).r(x - 4, y0 + 14, 9, 1, C.TERRACOTTA[4]);
        for (let k = 0; k < 5; k++) b.r(x - 5 + k * 3, y0 + 18, 1, 4 + (k % 3) * 3, C.LEAF[2 + (k % 2)]);
        leaves(b, x, y0 + 12, 5, C.LEAF, x, { light: 0.05 });
      }
    } else if (layer === 'front') {
      // poteaux du premier plan, plus sombres
      for (let x = x0 + 24; x < x1; x += 160) {
        for (let y = y0 - 26; y < y1; y++) { b.p(x, y, C.BAMBOO[1]); b.p(x + 1, y, C.BAMBOO[0]); b.p(x + 2, y, '#2d401c'); }
        for (let n = y0; n < y1; n += 14) b.r(x - 1, n, 5, 1, '#2a2420');
      }
    }
  },

  pots(b, p, X, Y) {
    // pots de terre cuite et semis
    const r = rng(p.x * 9);
    for (let k = 0; k < 4; k++) {
      const x = X - 14 + k * 8, h = 6 + Math.floor(r() * 3);
      for (let j = 0; j < h; j++) {
        const half = 3 - (j > h - 2 ? 0 : j < 2 ? 0 : 1);
        for (let i = -half; i <= half; i++) b.p(x + i, Y - h + j, pick(C.TERRACOTTA, clamp01(0.6 - i * 0.12 - (j === 0 ? -0.2 : 0)), x + i, j));
      }
      b.r(x - 2, Y - h - 1, 5, 1, C.SOIL[1]);
      const sp = Math.floor(r() * 3);
      for (let s = 0; s < 3; s++) b.r(x - 2 + s * 2, Y - h - 2 - sp - (s % 2) * 2, 1, 2 + sp, C.LEAF[3]).p(x - 2 + s * 2, Y - h - 3 - sp - (s % 2) * 2, C.LEAF[4]);
    }
  },

  tools(b, p, X, Y) {
    // râteau et houe appuyés, arrosoir
    b.line(X - 6, Y, X + 2, Y - 30, C.WOOD[3]).r(X - 1, Y - 32, 7, 2, '#5b5e66');
    for (let k = 0; k < 4; k++) b.r(X + k * 2 - 1, Y - 30, 1, 2, '#5b5e66');
    b.line(X + 4, Y, X + 10, Y - 28, C.WOOD[2]).r(X + 9, Y - 29, 5, 3, '#6f737b');
    b.r(X + 12, Y - 8, 9, 8, '#7d8a8f').r(X + 12, Y - 8, 9, 1, '#a9b6ba').r(X + 21, Y - 7, 4, 1, '#7d8a8f').r(X + 14, Y - 11, 5, 1, '#5b5e66');
  },

  trellis(b, p, X, Y) {
    // treillis de bambou couvert de concombres grimpants
    const w = (p.w ?? 3) * TILE, x0 = X - w / 2;
    for (let x = x0; x <= x0 + w; x += 8) b.line(x, Y, x + 4, Y - 36, C.BAMBOO[3]);
    for (let y = Y - 34; y < Y; y += 9) b.r(x0, y, w + 4, 1, C.BAMBOO[2]);
    for (let k = 0; k < w / 4; k++) {
      const lx = x0 + ih(k, 1, p.x) * w, ly = Y - 4 - ih(k, 2, p.x) * 30;
      b.r(Math.round(lx), Math.round(ly), 3, 2, C.LEAF[3]).p(Math.round(lx), Math.round(ly), C.LEAF[4]);
      if (k % 4 === 0) b.r(Math.round(lx) + 1, Math.round(ly) + 2, 1, 4, '#4f8a32');
      if (k % 7 === 0) b.p(Math.round(lx) + 2, Math.round(ly) - 1, C.FLOWER.yellow);
    }
  },

  // --- zone 6 : la grange --------------------------------------------------
  grange(b, p, X, Y, env, layer) {
    const x0 = p.x0 * TILE, x1 = p.x1 * TILE, y0 = p.y0 * TILE, y1 = p.y1 * TILE;
    if (layer === 'backdrop') {
      // grand toit de chaume visible de loin
      thatchRoof(b, (x0 + x1) / 2, y0 - 96, x1 - x0 + 70, 98, 91);
      // mur du fond : planches sombres, poteaux, contrefiches
      planks(b, x0, y0, x1 - x0, y1 - y0, ['#1f160f', '#2c2017', '#3a2a1e', '#4a3626', '#5a4330'], { pw: 6, v: 0.45, seed: 9 });
      for (let x = x0 + 24; x < x1; x += 96) {
        b.r(x, y0, 6, y1 - y0, C.WOOD[1]).r(x, y0, 2, y1 - y0, C.WOOD[2]);
        b.line(x + 6, y0 + 30, x + 40, y0 + 2, C.WOOD[1], 3).line(x, y0 + 30, x - 34, y0 + 2, C.WOOD[1], 3);
      }
      // jours entre les planches : la lumière du dehors
      for (let x = x0 + 10; x < x1; x += 31) b.r(x, y0 + 8, 1, y1 - y0 - 20, 'rgba(255, 226, 160, 0.35)');
      // fenêtre haute
      const wx = x0 + (x1 - x0) * 0.62, wy = y0 + 18;
      b.r(wx, wy, 26, 18, '#f6dfa0').r(wx + 12, wy, 2, 18, C.WOOD[1]).r(wx, wy + 8, 26, 2, C.WOOD[1]).r(wx - 2, wy - 2, 30, 2, C.WOOD[2]);
      // outils suspendus, cordes, sacs, toiles d'araignée
      for (let x = x0 + 50; x < x1 - 30; x += 70) {
        b.r(x, y0 + 40, 14, 1, C.WOOD[2]);
        b.line(x + 2, y0 + 41, x + 2, y0 + 70, C.WOOD[3]).r(x - 2, y0 + 70, 9, 2, '#6f737b');
        b.line(x + 9, y0 + 41, x + 9, y0 + 58, C.WOOD[3]);
        for (let a = 0; a < 7; a++) b.p(x + 9 + Math.round(Math.cos(a * 0.4 + 1) * 6), y0 + 58 + Math.round(Math.sin(a * 0.4 + 1) * 6), '#9aa0a8');   // faucille
        rope(b, x + 12, y0 + 41, x + 12, y0 + 55, 0, '#8a6a3a');
        b.disc(x + 12, y0 + 58, 3, '#a07a40');
      }
      for (let k = 0; k < 4; k++) {                                // toiles d'araignée dans les coins
        const cx = x0 + k * 200 + 30, cy = y0 + 2;
        for (let a = 0; a < 5; a++) b.line(cx, cy, cx + Math.cos(a * 0.35 + 0.1) * 12, cy + Math.sin(a * 0.35 + 0.1) * 12, 'rgba(220, 220, 210, 0.35)');
        for (const rr of [4, 8]) for (let a = 0; a < 5; a++) b.p(Math.round(cx + Math.cos(a * 0.35) * rr), Math.round(cy + Math.sin(a * 0.35) * rr), 'rgba(230, 230, 220, 0.5)');
      }
      // meules de foin contre le mur
      for (let x = x0 + 110; x < x1 - 60; x += 240) {
        for (let j = 0; j < 28; j++) for (let i = -26 + j * 0.4; i < 26 - j * 0.4; i++) {
          const v = 0.55 - (i / 26) * 0.2 - j * 0.004 + (noise2((x + i) * 0.6, (y1 - j) * 0.3, 4) - 0.5) * 0.5;
          b.p(Math.round(x + i), y1 - 1 - j, pick(C.STRAW, clamp01(v - 0.1), x + i, j));
        }
      }
    } else if (layer === 'front') {
      // encadrement de la porte et poteau d'angle, au premier plan
      b.r(x0 - 4, y0 - 6, 8, y1 - y0 + 6, C.WOOD[1]).r(x0 - 4, y0 - 6, 2, y1 - y0 + 6, C.WOOD[3]);
      b.r(x1 - 6, y0 - 6, 8, y1 - y0 + 6, C.WOOD[1]).r(x1 - 6, y0 - 6, 2, y1 - y0 + 6, C.WOOD[3]);
    }
  },

  barn_door(b, p, X, Y, env, layer) {
    // grande porte coulissante entrouverte
    if (layer === 'back') {
      planks(b, X - 30, Y - 120, 22, 120, C.WOOD, { pw: 5, v: 0.4, seed: 4 });
      b.line(X - 30, Y - 118, X - 9, Y - 62, C.WOOD[1], 2).line(X - 30, Y - 62, X - 9, Y - 4, C.WOOD[1], 2);
      b.r(X - 34, Y - 124, 60, 4, '#55585f').r(X - 22, Y - 126, 3, 3, '#3a3d44');
    }
  },

  hay(b, p, X, Y) {
    // bottes de foin liées
    const bale = (cx, cy, w, h) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        let v = 0.6 - (i / w) * 0.25 - (j / h) * 0.15 + (noise2((cx + i) * 0.7, (cy + j) * 0.3, 2) - 0.5) * 0.45;
        if (i === 0 || j === 0) v += 0.1;
        b.p(cx + i, cy + j, pick(C.STRAW, clamp01(v), cx + i, cy + j));
      }
      b.r(cx + 4, cy, 1, h, C.STRAW[0]).r(cx + w - 5, cy, 1, h, C.STRAW[0]);
      for (let k = 0; k < w; k += 3) b.p(cx + k, cy - 1, C.STRAW[3]);
    };
    bale(X - 14, Y - 12, 18, 12);
    bale(X + 4, Y - 12, 18, 12);
    bale(X - 6, Y - 23, 18, 11);
  },

  sacks(b, p, X, Y, small) {
    // sacs de graines en toile de jute
    const n = small ? 1 : 3;
    for (let k = 0; k < n; k++) {
      const cx = X - (n - 1) * 5 + k * 10, h = small ? 9 : 12;
      for (let j = 0; j < h; j++) {
        const half = j < 2 ? 2 : 4 + (j > h - 3 ? 0 : 1);
        for (let i = -half; i <= half; i++) b.p(cx + i, Y - h + j, pick(['#6e5a3e', '#8d7552', '#ab9268', '#c8b084'], clamp01(0.6 - i * 0.08 + (noise2(i, j, k) - 0.5) * 0.2), cx + i, j));
      }
      b.r(cx - 2, Y - h + 2, 5, 1, '#4e3e2a');
      if (!small) b.r(cx - 2, Y - 6, 4, 3, '#a8433a');
    }
  },

  // --- zone 7 : le jardin des sentinelles ----------------------------------
  shrine(b, p, X, Y) {
    // petit sanctuaire sur un socle de pierre, corde sacrée et papiers
    const S = C.STONE;
    b.r(X - 26, Y - 8, 52, 8, S[2]).r(X - 26, Y - 8, 52, 1, S[4]);
    for (let i = 0; i < 52; i += 9) b.r(X - 26 + i, Y - 8, 1, 8, S[1]);
    b.r(X - 16, Y - 40, 32, 32, C.WOOD[2]);
    planks(b, X - 14, Y - 38, 28, 28, C.WOOD, { pw: 4, v: 0.55, seed: 11 });
    b.r(X - 18, Y - 40, 3, 32, C.RED[3]).r(X + 15, Y - 40, 3, 32, C.RED[3]);
    b.r(X - 6, Y - 30, 12, 22, C.WOOD[0]).r(X - 5, Y - 29, 4, 20, C.WOOD[1]).r(X + 1, Y - 29, 4, 20, C.WOOD[1]);
    b.p(X - 1, Y - 20, C.GLOW[1]).p(X + 1, Y - 20, C.GLOW[1]);
    // toit de tuiles aux bords relevés
    tileRoof(b, X, Y - 56, 58, 16, 5);
    b.r(X - 2, Y - 62, 5, 4, C.ROOF[1]);
    // corde sacrée (shimenawa) et papiers (shide)
    rope(b, X - 16, Y - 39, X + 16, Y - 39, 4, C.STRAW[2]);
    rope(b, X - 16, Y - 38, X + 16, Y - 38, 4, C.STRAW[3]);
    for (const dx of [-9, 0, 9]) b.r(X + dx, Y - 36 + (dx === 0 ? 3 : 2), 2, 3, C.PAPER[3]).r(X + dx + 1, Y - 33 + (dx === 0 ? 3 : 2), 2, 3, C.PAPER[3]);
    // tronc à offrandes et cloche
    b.r(X - 8, Y - 15, 16, 7, C.WOOD[3]).r(X - 8, Y - 15, 16, 1, C.WOOD[5]);
    for (let i = 0; i < 16; i += 2) b.r(X - 8 + i, Y - 13, 1, 4, C.WOOD[1]);
  },

  torii(b, p, X, Y) {
    const R = C.RED, h = p.h ?? 54, w = p.w ?? 44;
    b.r(X - w / 2 + 6, Y - h, 5, h, R[3]).r(X - w / 2 + 6, Y - h, 1, h, R[4]).r(X + w / 2 - 11, Y - h, 5, h, R[3]).r(X + w / 2 - 11, Y - h, 1, h, R[4]);
    b.r(X - w / 2 + 5, Y - 4, 7, 4, '#2a2420').r(X + w / 2 - 12, Y - 4, 7, 4, '#2a2420');
    b.r(X - w / 2 + 2, Y - h + 10, w - 4, 4, R[2]).r(X - 2, Y - h + 6, 4, 4, R[2]);
    b.r(X - w / 2 - 3, Y - h, w + 6, 5, R[3]).r(X - w / 2 - 3, Y - h, w + 6, 1, R[4]);
    b.r(X - w / 2 - 5, Y - h - 3, w + 10, 3, '#2a2420').p(X - w / 2 - 6, Y - h - 4, '#2a2420').p(X + w / 2 + 5, Y - h - 4, '#2a2420');
  },

  fox(b, p, X, Y) {
    // renard de pierre (kitsune) sur son socle, bavoir rouge
    const S = C.STONE;
    b.r(X - 7, Y - 8, 14, 8, S[2]).r(X - 7, Y - 8, 14, 1, S[4]).r(X - 8, Y - 9, 16, 1, S[3]);
    for (let j = 0; j < 16; j++) {
      const half = j < 6 ? 2 + j * 0.4 : 4 - (j > 13 ? 1 : 0);
      for (let i = -half; i <= half; i++) b.p(X + i, Y - 25 + j, pick(S, clamp01(0.65 - i * 0.07), X + i, j));
    }
    b.r(X - 3, Y - 28, 2, 3, S[3]).r(X + 2, Y - 28, 2, 3, S[3]).p(X + 4, Y - 23, S[1]);   // oreilles, museau
    b.p(X - 1, Y - 23, S[0]).p(X + 2, Y - 23, S[0]);
    b.r(X - 4, Y - 18, 9, 4, C.RED[3]).r(X - 3, Y - 15, 7, 1, C.RED[2]);
    for (let j = 0; j < 9; j++) b.p(X + 5 + Math.round(j * 0.4), Y - 18 + j, S[3]);       // queue
    b.r(X - 5, Y - 9, 3, 1, C.MOSS[2]);
  },

  bridge_red(b, p, X, Y) {
    // pont en arc vermillon (taiko-bashi), rompu en son milieu
    const x0 = p.x * TILE, w = (p.w ?? 8) * TILE, R = C.RED;
    for (let k = 0; k <= w; k++) {
      const t = k / w;
      if (p.broken && t > 0.36 && t < 0.64) {
        // travées arrachées : quelques planches qui pendent
        if ((t < 0.4 || t > 0.6) && k % 3 === 0) b.r(x0 + k, Y - 22 + Math.round((t - 0.5) * 40), 1, 6, C.WOOD[2]);
        continue;
      }
      const arc = Math.round(Math.sin(t * Math.PI) * 18);
      b.r(x0 + k, Y - 4 - arc, 1, 4, C.WOOD[3]).p(x0 + k, Y - 4 - arc, C.WOOD[5]);   // tablier
      b.r(x0 + k, Y - 16 - arc, 1, 2, R[3]).p(x0 + k, Y - 16 - arc, R[4]);          // rambarde
      if (k % 12 === 0) {
        b.r(x0 + k, Y - 17 - arc, 2, 14, R[2]).r(x0 + k, Y - 17 - arc, 1, 14, R[4]);
        b.r(x0 + k - 1, Y - 20 - arc, 4, 3, '#c9a24a').p(x0 + k, Y - 21 - arc, '#e8c76a');   // pommeaux de laiton
      }
      if (k % 30 === 0) b.r(x0 + k, Y - arc, 3, arc + 20, R[1]);                 // piles dans l'eau
    }
  },

  pine(b, p, X, Y) {
    // pin de jardin taillé en plateaux
    limb(b, X, Y, X - 6, Y - 22, 5, 3);
    limb(b, X - 6, Y - 22, X + 4, Y - 40, 3, 2);
    limb(b, X - 4, Y - 26, X + 16, Y - 30, 2, 1);
    for (const [dx, dy, r] of [[-14, -24, 9], [16, -31, 8], [3, -42, 8], [-4, -10, 6]]) {
      leaves(b, X + dx, Y + dy, r, C.HEDGE, X + dx, { sq: 0.55, light: 0.1 });
    }
  },

  bush(b, p, X, Y) {
    // buisson d'azalées en fleurs
    const r = rng(p.x * 17);
    for (let k = 0; k < 3; k++) leaves(b, X - 8 + k * 8, Y - 6 - (k === 1 ? 3 : 0), 7 + r() * 2, C.LEAF, p.x + k, { sq: 0.75, light: 0.02 });
    dots(b, X, Y - 8, 12, p.flowers === 'white' ? ['#ffffff', '#f4ecdc'] : [C.FLOWER.pink, '#e9849c', '#ffd1dc'], 14, p.x, 1);
  },

  bamboo_grove(b, p, X, Y) {
    // bosquet de bambous, derrière le chemin
    const w = (p.w ?? 4) * TILE, r = rng(p.x * 23);
    for (let k = 0; k < w / 5; k++) {
      const x = Math.round(X - w / 2 + r() * w), h = 80 + r() * 90;
      for (let y = Y - h; y < Y; y++) { b.p(x, y, C.BAMBOO[4]); b.p(x + 1, y, C.BAMBOO[2]); b.p(x + 2, y, C.BAMBOO[1]); }
      for (let n = Y - h + 8; n < Y; n += 12) b.r(x - 1, n, 5, 1, C.BAMBOO[0]);
      for (let n = 0; n < 5; n++) {
        const ly = Y - h + 6 + n * 12, dir = n % 2 ? 1 : -1;
        b.line(x + 1, ly, x + 1 + dir * 9, ly + 5, C.BAMBOO[2]);
        for (let l = 0; l < 3; l++) b.r(x + 1 + dir * (4 + l * 3), ly + 2 + l, 4, 1, C.BAMBOO[3 + (l % 2)]);
      }
    }
  },

  path_stones(b, p, X, Y) {
    // pas japonais (tobi-ishi) dans l'herbe
    const w = (p.w ?? 4) * TILE, x0 = X - w / 2;
    for (let x = x0; x < x0 + w; x += 12) {
      b.r(x, Y - 1, 9, 2, C.STONE[3]).r(x + 1, Y - 2, 7, 1, C.STONE[4]).r(x, Y, 9, 1, C.STONE[1]);
    }
  },

  gate(b, p, X, Y, env, layer) {
    // la grande porte de bois du jardin : la sortie du potager
    const W = C.WOOD;
    if (layer === 'back') {
      b.r(X - 44, Y - 6, 88, 6, C.STONE[2]).r(X - 44, Y - 6, 88, 1, C.STONE[4]);
      // battants ouverts vers l'intérieur
      planks(b, X - 34, Y - 70, 18, 64, W, { pw: 6, v: 0.5, seed: 21 });
      planks(b, X + 16, Y - 70, 18, 64, W, { pw: 6, v: 0.5, seed: 22 });
      for (const bx of [X - 34, X + 16]) for (const by of [Y - 60, Y - 24]) { b.r(bx, by, 18, 3, '#3b3f47'); for (let k = 2; k < 18; k += 5) b.p(bx + k, by + 1, '#8e939c'); }
      // piliers massifs et linteau
      for (const px of [X - 42, X + 34]) {
        b.r(px, Y - 92, 9, 86, W[2]).r(px, Y - 92, 2, 86, W[4]).r(px + 7, Y - 92, 2, 86, W[0]);
        b.r(px - 2, Y - 10, 13, 4, '#2a2420');
      }
      b.r(X - 50, Y - 96, 100, 7, W[1]).r(X - 50, Y - 96, 100, 1, W[3]);
      b.r(X - 46, Y - 82, 92, 4, W[2]).r(X - 46, Y - 82, 92, 1, W[4]);
      tileRoof(b, X, Y - 118, 128, 22, 6);
      // plaque au nom du domaine
      b.r(X - 8, Y - 80, 16, 10, '#2a2420').r(X - 7, Y - 79, 14, 8, W[4]);
      for (let k = 0; k < 3; k++) b.r(X - 5 + k * 4, Y - 77, 2, 4, '#2a2420');
    }
  },

  bench(b, p, X, Y) {
    b.r(X - 14, Y - 9, 28, 3, C.WOOD[3]).r(X - 14, Y - 9, 28, 1, C.WOOD[5]);
    b.r(X - 12, Y - 6, 3, 6, C.WOOD[1]).r(X + 9, Y - 6, 3, 6, C.WOOD[1]);
  },

  // --- zone 8 : le comptoir du voyageur ------------------------------------
  stall(b, p, X, Y) {
    // échoppe : comptoir, grande ombrelle de papier, marchandises
    const W = C.WOOD;
    // ombrelle (wagasa) rouge, plantée derrière le comptoir
    b.r(X + 20, Y - 70, 2, 70, W[1]);
    for (let j = 0; j < 14; j++) {
      const half = 6 + j * 3.2;
      for (let i = -half; i <= half; i++) {
        const x = X + 21 + i, y = Y - 82 + j;
        const rib = Math.round((i + half) / 6) % 2;
        b.p(Math.round(x), y, pick(C.RED, clamp01(0.55 - i / 90 - j * 0.015 + (rib ? 0.08 : -0.04)), x, y));
      }
    }
    b.r(X + 21 - 50, Y - 69, 101, 1, C.RED[0]);
    b.r(X + 17, Y - 85, 8, 3, C.RED[2]);
    // auvent de tissu indigo à motifs et poteaux
    b.r(X - 30, Y - 50, 2, 50, W[2]).r(X + 28, Y - 50, 2, 50, W[2]);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 9; j++) {
      const wave = j < 7 || i % 8 < 6;
      if (!wave) continue;
      b.p(X - 32 + i, Y - 54 + j, (i + j) % 9 === 0 ? '#e9dcc0' : pick(C.CLOTH, 0.5 - j * 0.04, i, j));
    }
    // comptoir
    planks(b, X - 26, Y - 16, 52, 16, W, { pw: 6, v: 0.55, seed: 31 });
    b.r(X - 28, Y - 18, 56, 3, W[4]).r(X - 28, Y - 18, 56, 1, W[5]);
    // marchandises : rouleaux de tissu, pots, éventails, petits sacs
    const cols = ['#c44a37', '#4c6ba0', '#d6ba78', '#5f8a3a', '#86599a'];
    for (let k = 0; k < 5; k++) b.r(X - 24 + k * 5, Y - 24, 4, 6, cols[k]).r(X - 24 + k * 5, Y - 24, 4, 1, '#ffffff33');
    b.r(X + 2, Y - 23, 6, 5, C.TERRACOTTA[2]).r(X + 2, Y - 24, 6, 1, C.TERRACOTTA[4]);
    b.r(X + 10, Y - 22, 7, 4, C.STRAW[2]).r(X + 18, Y - 23, 5, 5, '#2c303d');
    // enseigne verticale
    b.r(X - 40, Y - 44, 9, 30, W[3]).r(X - 40, Y - 44, 9, 1, W[5]).r(X - 36, Y - 14, 2, 14, W[1]);
    for (let k = 0; k < 4; k++) b.r(X - 38, Y - 41 + k * 7, 5, 4, '#2a2420').r(X - 37, Y - 40 + k * 7, 3, 2, W[3]);
    // caisses empilées et grand sac de voyage
    for (const [cx, cy] of [[X + 32, Y - 14], [X + 46, Y - 14], [X + 38, Y - 27]]) {
      b.r(cx, cy, 13, 13, W[2]).r(cx, cy, 13, 1, W[4]).r(cx, cy + 6, 13, 1, W[1]).line(cx, cy, cx + 12, cy + 12, W[1]);
    }
    for (let j = 0; j < 20; j++) for (let i = -8; i <= 8; i++) {
      if (i * i / 64 + ((j - 11) ** 2) / 100 > 1) continue;
      b.p(X - 50 + i, Y - 20 + j, pick(['#6e5a3e', '#8d7552', '#ab9268', '#c8b084'], clamp01(0.62 - i * 0.05 - (j - 11) * 0.02), i, j));
    }
    b.r(X - 54, Y - 26, 9, 2, '#4e3e2a').r(X - 49, Y - 34, 2, 10, W[1]);
  },

  signpost(b, p, X, Y) {
    // poteau indicateur : vers les rizières
    b.r(X - 1, Y - 34, 3, 34, C.WOOD[2]).r(X - 1, Y - 34, 1, 34, C.WOOD[4]);
    b.poly([[X + 2, Y - 32], [X + 22, Y - 32], [X + 27, Y - 28], [X + 22, Y - 24], [X + 2, Y - 24]], C.WOOD[3]);
    b.r(X + 2, Y - 32, 20, 1, C.WOOD[5]);
    for (let k = 0; k < 3; k++) b.r(X + 5 + k * 6, Y - 30, 3, 4, '#2a1c14');
    b.poly([[X - 2, Y - 22], [X - 20, Y - 22], [X - 24, Y - 18], [X - 20, Y - 14], [X - 2, Y - 14]], C.WOOD[2]);
    for (let k = 0; k < 2; k++) b.r(X - 17 + k * 6, Y - 20, 3, 4, '#2a1c14');
    b.r(X - 4, Y - 36, 8, 3, C.STRAW[3]);
  },

  cart(b, p, X, Y) {
    // charrette à bras chargée de légumes
    planks(b, X - 22, Y - 20, 40, 8, C.WOOD, { pw: 8, v: 0.5, seed: 41 });
    b.line(X + 18, Y - 16, X + 40, Y - 26, C.WOOD[2], 2);
    for (let a = 0; a < 32; a++) b.p(X - 6 + Math.round(Math.cos(a / 5) * 9), Y - 9 + Math.round(Math.sin(a / 5) * 9), C.WOOD[1]);
    for (let a = 0; a < 6; a++) b.line(X - 6, Y - 9, X - 6 + Math.cos(a) * 8, Y - 9 + Math.sin(a) * 8, C.WOOD[2]);
    for (let k = 0; k < 6; k++) veg(b, X - 18 + k * 6, Y - 20, ['choux', 'potirons', 'carottes'][k % 3], X + k);
  },

  tubs(b, p, X, Y) {
    // baquets d'eau cerclés
    for (let k = 0; k < 2; k++) {
      const cx = X - 8 + k * 14, h = 9 - k * 2;
      planks(b, cx - 5, Y - h, 11, h, C.WOOD, { pw: 3, v: 0.55, seed: 5 + k });
      b.r(cx - 5, Y - h + 2, 11, 1, '#3b3f47').r(cx - 5, Y - 2, 11, 1, '#3b3f47').r(cx - 4, Y - h, 9, 1, C.WATER[4]);
    }
  },

  well(b, p, X, Y) {
    // puits de pierre, petit toit, seau
    b.r(X - 13, Y - 14, 26, 14, C.STONE[2]);
    for (let i = 0; i < 26; i += 6) for (let j = 0; j < 14; j += 5) b.r(X - 13 + i + ((j / 5) % 2) * 3, Y - 14 + j, 1, 5, C.STONE[1]);
    b.r(X - 14, Y - 15, 28, 2, C.STONE[4]);
    b.r(X - 12, Y - 40, 2, 26, C.WOOD[2]).r(X + 10, Y - 40, 2, 26, C.WOOD[2]).r(X - 13, Y - 34, 26, 2, C.WOOD[1]);
    tileRoof(b, X, Y - 50, 36, 10, 3);
    rope(b, X, Y - 33, X, Y - 22, 0, C.STRAW[1]);
    b.r(X - 3, Y - 22, 7, 5, C.WOOD[3]).r(X - 3, Y - 22, 7, 1, '#3b3f47');
  },

  tall_grass(b, p, X, Y) {
    // herbes hautes et fougères au tout premier plan (devant KAGE)
    const r = rng(p.x * 37 + 3);
    const w = (p.w ?? 1) * TILE;
    for (let k = 0; k < w / 3; k++) {
      const x = Math.round(X - w / 2 + r() * w), h = 5 + r() * 7, lean = (r() - 0.5) * 6;
      for (let j = 0; j < h; j++) b.p(Math.round(x + lean * (j / h) ** 2), Y + 2 - j, j > h - 2 ? C.GRASS[3] : C.GRASS[1 + (k % 2)]);
    }
  },
};

/** Peint un décor dans la couche demandée. */
export function paintProp(b, p, env, layer) {
  const f = PAINT[p.type];
  if (!f) return;
  const X = p.x * TILE + TILE / 2, Y = p.y * TILE;
  f(b, p, X, Y, env, layer);
}

// ---------------------------------------------------------------------------
// décors automatiques : poteaux sous les plateformes de bois, buissons et
// herbes derrière le chemin (ils donnent de la profondeur au plan de jeu)
// ---------------------------------------------------------------------------
export function autoDecor(b, map, tx0, tx1) {
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    // poteaux de soutien
    for (let ty = 0; ty < map.h - 1; ty++) {
      const st = map.styleAt(tx, ty);
      if (st !== 'deck' && st !== 'beam') continue;
      if (map.solid(tx, ty + 1)) continue;
      const lEnd = map.styleAt(tx - 1, ty) !== st, rEnd = map.styleAt(tx + 1, ty) !== st;
      if (!lEnd && !rEnd && tx % 3) continue;
      let bot = ty + 1; while (bot < map.h && !map.solid(tx, bot) && map.at(tx, bot) !== '~') bot++;
      const x = tx * TILE + (lEnd ? 2 : rEnd ? 11 : 6), y0 = (ty + 1) * TILE, y1 = bot * TILE + (map.at(tx, bot) === '~' ? 10 : 0);
      b.r(x, y0, 3, y1 - y0, C.WOOD[2]).r(x, y0, 1, y1 - y0, C.WOOD[4]).r(x + 2, y0, 1, y1 - y0, C.WOOD[0]);
      if (lEnd && y1 - y0 > 20) b.line(x + 3, y0 + 14, x + 12, y0 + 1, C.WOOD[1], 2);
      if (rEnd && y1 - y0 > 20) b.line(x, y0 + 14, x - 9, y0 + 1, C.WOOD[1], 2);
    }
    // buissons, fougères, herbes hautes derrière le chemin
    let ty = 0; while (ty < map.h && !map.solid(tx, ty)) ty++;
    if (ty >= map.h || ty < 4) continue;
    const st = map.styleAt(tx, ty);
    if (!(st === 'soil' || st === 'stone' || st === 'cut')) continue;
    let covered = false;
    for (let k = 1; k < 10; k++) if (map.solid(tx, ty - k)) covered = true;
    if (covered) continue;
    const z = map.zone[tx];
    if (z === '06') continue;
    const n = ih(tx, ty, 301);
    if (n > ({ '01': 0.3, '02': 0.2, '03': 0.32, '04': 0.38, '05': 0.3, '07': 0.36, '08': 0.3 }[z] ?? 0.2)) continue;
    const X = tx * TILE + 8, Y = ty * TILE + 3, kind = ih(tx, ty, 302);
    if (z === '03' || (z === '02' && kind < 0.3)) {
      for (let k = 0; k < 9; k++) {
        const x = X - 8 + k * 2 + Math.round(ih(k, tx, 3) * 2), h = 8 + ih(k, tx, 4) * 14;
        for (let j = 0; j < h; j++) b.p(x + Math.round(((k % 3) - 1) * (j / h) ** 2 * 3), Y - j, j > h - 3 ? C.GRASS[3] : C.GRASS[1 + (k % 2)]);
      }
    } else if (z === '04' && kind < 0.5) {
      for (let k = 0; k < 7; k++) {                              // fougère
        const a = -Math.PI / 2 + (k - 3) * 0.38, len = 9 + ih(k, tx, 5) * 5;
        for (let j = 0; j < len; j++) {
          const x = Math.round(X + Math.cos(a) * j + (j * j) * 0.02 * (k - 3)), y = Math.round(Y + Math.sin(a) * j + j * j * 0.03);
          b.p(x, y, C.LEAF[2]);
          if (j % 2 === 0) { b.p(x - 1, y, C.LEAF[3]); b.p(x + 1, y + 1, C.LEAF[1]); }
        }
      }
    } else if ((z === '05' || z === '07') && kind < 0.45) {
      for (let k = 0; k < 4; k++) {                              // jeunes pousses de bambou
        const x = X - 6 + k * 4, h = 14 + ih(k, tx, 6) * 18;
        b.r(x, Y - h, 2, h, C.BAMBOO[3]).r(x, Y - h, 1, h, C.BAMBOO[5]);
        b.line(x + 1, Y - h + 3, x + 5, Y - h, C.BAMBOO[2]).line(x, Y - h + 6, x - 4, Y - h + 3, C.BAMBOO[3]);
      }
    } else {
      const r = 6 + kind * 5;
      leaves(b, X, Y - r * 0.5, r, kind < 0.6 ? C.LEAF : C.HEDGE, tx * 7, { sq: 0.8, light: -0.06 });
      if (kind > 0.8 || z === '07') dots(b, X, Y - r * 0.6, r * 0.8, z === '07' ? [C.FLOWER.pink, '#ffd1dc'] : [C.FLOWER.white, C.FLOWER.yellow], 6, tx, 1);
    }
  }
}

/** Feuilles de bambou en éventail sur les bosquets (elles débordent des tiges). */
export function groveLeaves(b, map, tx0, tx1) {
  for (let tx = Math.max(0, tx0); tx < Math.min(map.w, tx1); tx++) {
    for (let ty = 0; ty < map.h; ty++) {
      if (map.styleAt(tx, ty) !== 'grove') continue;
      for (let k = 0; k < 3; k++) {
        if (ih(tx, ty * 3 + k, 501) < 0.35) continue;
        const x = tx * TILE + Math.floor(ih(tx, ty * 3 + k, 502) * 16), y = ty * TILE + Math.floor(ih(tx, ty * 3 + k, 503) * 14);
        const dir = ih(tx, ty * 3 + k, 504) < 0.5 ? -1 : 1;
        for (let l = 0; l < 4; l++) {
          const len = 5 + l * 2;
          for (let j = 0; j < len; j++) {
            const px = x + dir * j, py = y + l * 2 - 3 + Math.round((j * j) * 0.06);
            b.p(px, py, j < 2 ? C.BAMBOO[2] : j < len - 2 ? C.BAMBOO[3 + (l % 2)] : C.BAMBOO[5]);
          }
        }
      }
    }
  }
}
