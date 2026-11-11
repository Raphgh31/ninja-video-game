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

// Le grenier de la grange : sa forme suit l'intérieur du toit de chaume.
const ATTIC = ['#100b07', '#181009', '#22170f', '#2d2015', '#38291b', '#443221'];
export function atticGeom(p) {
  const x0 = p.gx0 * TILE, x1 = p.gx1 * TILE, cx = (x0 + x1) / 2, w = x1 - x0 + 70, h = p.roofH;
  const ye = p.eave * TILE, yTop = ye - h + 2;
  const span = (yy) => {
    const j = yTop + h - 1 - yy;
    let half = j < 0 ? w / 2 : Math.round(w / 2 - (j * (w / 2 - 6)) / h);
    half -= 12;                                                              // épaisseur du chaume
    return [Math.max(x0 + 6, cx - half), Math.min(x1 - 7, cx + half)];
  };
  return {
    x0, x1, cx, ye, span,
    top: (p.collar + 1) * TILE,                                              // sous l'entrait
    bottom: (p.floor + 1) * TILE,                                            // sous le plancher (plafond du rez-de-chaussée)
    floorY: p.floor * TILE, floorX0: p.floorX0 * TILE, floorX1: (p.floorX1 + 1) * TILE,
  };
}

/**
 * Le toit « plein » de la grange, tel qu'on le voit de loin : tout le chaume,
 * et la grosse poutre sous l'avant-toit. Il est peint à part (live.js le pose
 * par-dessus le grenier, et le rend presque transparent quand KAGE est monté).
 * gb : le fond « grange ».
 */
/**
 * Le vieux coffre du grenier (nagamochi) : bois sombre, ferrures, serrure de
 * laiton. state : 0 fermé, 1 entrouvert, 2 ouvert (couvercle relevé en
 * arrière, intérieur sombre où brille l'or). Toile 40×34, sol en bas ;
 * le coffre est centré (CHEST.cx).
 */
export const CHEST = { w: 40, h: 34, cx: 20 };

/**
 * Dessine un coffre, et l'invitation à l'ouvrir (plus de bouton : demande de Raph). Fermé, un reflet
 * doré balaie le coffre de loin en loin ; quand KAGE approche, il tressaute et une lueur dorée pulse
 * derrière lui ; juste devant, il tressaute plus souvent et de petites étincelles scintillent autour
 * du couvercle (on l'ouvre avec ↑, ou en le touchant du doigt).
 */
export function drawChest(ctx, imgs, ch, cam, time, lvTime, player) {
  const R = Math.round, t = lvTime - ch.openedAt;
  const st = !ch.open ? 0 : t < 0.14 ? 1 : 2;
  let jx = 0, jy = ch.open && t < 0.14 ? -1 : 0, near = 0;
  if (!ch.open && player && player.state !== 'death') {
    const dx = Math.abs(player.x - ch.x), dy = Math.abs(player.y - ch.y);
    near = dx < 26 && dy < 12 ? 2 : dx < 120 && dy < 64 ? 1 : 0;
  }
  if (near) {
    // le sursaut : trois petits tremblements et un saut d'un pixel
    const per = near === 2 ? 0.9 : 1.7, ph = ((time + ch.x * 0.01) % per) / per;
    if (ph < 0.2) { jx = R(Math.sin((ph / 0.2) * Math.PI * 6)); jy = ph < 0.1 ? -1 : 0; }
  }
  const sx = R(ch.x - CHEST.cx - cam.x), sy = R(ch.y - CHEST.h - cam.y);
  if (near) {
    // la lueur dorée qui pulse derrière le coffre
    const a = near === 2 ? 0.26 + 0.12 * Math.sin(time * 5) : 0.12 + 0.05 * Math.sin(time * 3);
    const g = ctx.createRadialGradient(sx + CHEST.cx, sy + CHEST.h - 10, 2, sx + CHEST.cx, sy + CHEST.h - 10, 30);
    g.addColorStop(0, `rgba(255,214,110,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(sx - 12, sy - 8, CHEST.w + 24, CHEST.h + 12); ctx.restore();
  }
  if (ch.open) { ctx.drawImage(imgs[st], sx, sy + jy); return; }
  // le reflet : une bande claire qui traverse le coffre en biais, toutes les 2,6 s (plus souvent quand on est près)
  const per = near ? 1.6 : 2.6, k = ((time + ch.x * 0.013) % per) / 0.5;
  if (k < 1) {
    const c = (ch._fx ??= document.createElement('canvas'));
    c.width = CHEST.w; c.height = CHEST.h;
    const g = c.getContext('2d');
    g.drawImage(imgs[0], 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const bx = -12 + k * (CHEST.w + 24);
    g.fillStyle = 'rgba(255,246,200,0.55)';
    g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx + 5, 0); g.lineTo(bx - 9, CHEST.h); g.lineTo(bx - 14, CHEST.h); g.fill();
    g.fillStyle = 'rgba(255,246,200,0.25)';
    g.beginPath(); g.moveTo(bx + 7, 0); g.lineTo(bx + 9, 0); g.lineTo(bx - 5, CHEST.h); g.lineTo(bx - 7, CHEST.h); g.fill();
    ctx.drawImage(c, sx + jx, sy + jy);
  } else ctx.drawImage(imgs[0], sx + jx, sy + jy);
  if (near === 2) {
    // des étincelles autour du couvercle
    for (const [ox, oy, f] of [[-15, -22, 0], [13, -25, 1.3], [1, -31, 2.4], [18, -14, 3.1]]) {
      const tw = Math.sin(time * 4 + f * 2.1);
      if (tw < 0.2) continue;
      const x = R(ch.x + ox - cam.x), y = R(ch.y + oy - cam.y - (time * 6 + f * 3) % 4);
      ctx.globalAlpha = Math.min(1, tw * 1.2);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(x, y, 1, 1);
      if (tw > 0.6) { ctx.fillStyle = '#ffd56e'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
    }
    ctx.globalAlpha = 1;
  }
}
export function chestSprite(state, Brush, canvas) {
  const cv = canvas(CHEST.w, CHEST.h), b = new Brush(cv.getContext('2d')), W = C.WOOD;
  const IRON = '#55585f', IRON_L = '#8a8e96', BRASS = '#b08a3a', BRASS_L = '#e2c070', DARK = '#120c07';
  const w = 34, h = 15, cx = 3, fy = CHEST.h;
  const top = fy - h;
  const wood = (x, y, j, k = 0) => {
    const v = 0.4 + (noise2(x * 0.3, y * 0.9, 21) - 0.5) * 0.3 - ((x - cx) / w) * 0.12 + k;
    return pick(W, clamp01(v), x, j);
  };
  // caisse (sous le joint du couvercle)
  for (let j = 5; j < h; j++) for (let i = 0; i < w; i++) b.p(cx + i, top + j, wood(cx + i, top + j, j));
  b.r(cx + w - 4, fy - 4, 4, 4, IRON).r(cx, fy - 4, 4, 4, IRON);
  b.r(cx - 2, fy - 9, 2, 3, IRON).r(cx + w, fy - 9, 2, 3, IRON);                // poignées
  if (state === 0) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < w; i++) b.p(cx + i, top + j, wood(cx + i, top + j, j, j === 4 ? -0.3 : 0));
    b.r(cx, top, w, 1, W[4]);
    for (const fx of [cx, cx + w - 4]) b.r(fx, top, 4, 4, IRON).p(fx + 1, top + 1, IRON_L);
    b.r(cx + w / 2 - 2, top + 3, 4, 5, BRASS).p(cx + w / 2 - 1, top + 4, BRASS_L).p(cx + w / 2, top + 6, W[0]);
    return cv;
  }
  // ouvert ou entrouvert : bord de la caisse, intérieur sombre, or qui brille
  const rim = top + 4;
  b.r(cx, rim, w, 1, W[1]);
  b.r(cx + 2, rim + 1, w - 4, 2, DARK);
  for (const [i, c] of [[6, BRASS_L], [9, BRASS], [13, BRASS_L], [18, BRASS], [21, BRASS_L], [25, BRASS], [28, BRASS_L]]) b.p(cx + i, rim + 1 + (i % 2), c);
  b.r(cx + w / 2 - 2, rim + 1, 4, 3, BRASS).p(cx + w / 2 - 1, rim + 2, BRASS_L);     // la serrure, ouverte
  if (state === 1) {
    // couvercle soulevé de quelques pixels, encore à plat : un rai sombre dessous
    for (let j = 0; j < 4; j++) for (let i = 0; i < w; i++) b.p(cx + i, top - 3 + j, wood(cx + i, top + j, j));
    b.r(cx, top - 3, w, 1, W[4]);
    for (const fx of [cx, cx + w - 4]) b.r(fx, top - 3, 4, 4, IRON).p(fx + 1, top - 2, IRON_L);
    return cv;
  }
  // ouvert : on voit le dessous du couvercle, relevé en arrière au-dessus de la caisse
  const lh = 10, ly = rim - lh;
  for (let j = 0; j < lh; j++) {
    const inset = Math.round((lh - 1 - j) * 0.25);                                  // un peu plus étroit en haut (perspective)
    for (let i = inset; i < w - inset; i++) b.p(cx + i, ly + j, wood(cx + i, ly + j, j, 0.18 - j * 0.02));
    b.p(cx + inset, ly + j, IRON).p(cx + w - 1 - inset, ly + j, IRON);
  }
  b.r(cx + 3, ly, w - 6, 1, W[1]);
  for (let i = 4; i < w - 4; i += 6) b.r(cx + i, ly + 2, 1, lh - 3, W[2]);               // planches du couvercle
  return cv;
}

/**
 * Grue de bambou (zone 3) : le mur de blocs de pierre bruts, ficelés d'une corde
 * en croix (toile w × h cases), et la paroi de la fosse qui l'attend.
 */
export function craneBundle(c, Brush, canvas) {
  const W = c.w * TILE, H = c.h * TILE;
  const cv = canvas(W, H), b = new Brush(cv.getContext('2d'));
  const ST = C.STONE, ROPE = ['#3b2a1c', '#6a4a2c', '#9a7448', '#c9a46c'];
  // grosses pierres irrégulières, empilées (cellules de Voronoï), joints sombres
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const w = worley(x + c.x0 * 37, y, 9.5, 41, 0.8);
    let v = 0.62 - (w.dx / 9) * 0.18 - (w.dy / 9) * 0.3 + (w.id - 0.5) * 0.28;
    if (w.d2 - w.d < 1.1) v = 0.05;                                  // joint entre deux pierres
    else if (w.d2 - w.d < 2) v -= 0.2;
    if (noise2(x * 0.25, y * 0.25, 44) > 0.72 && w.dy < 0) v = Math.max(v, 0.35);
    let col = pick(ST, clamp01(v), x, y, 0.15);
    if (w.dy < -3 && noise2(x * 0.2, y * 0.3, 45) > 0.62) col = pick(C.MOSS, 0.55, x, y);   // mousse sur le haut des pierres
    b.p(x, y, col);
  }
  // contour : bords du mur un peu grignotés
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (ih(x, y, 46) < 0.4) b.p(x, y, ST[0]);
  b.r(0, H - 1, W, 1, ST[0]);
  // la corde en croix et les deux bandes horizontales qui serrent le tas
  const rope = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      b.p(x, y, ROPE[2]).p(x + 1, y, ROPE[1]).p(x, y + 1, ROPE[0]);
      if (i % 3 === 0) b.p(x, y, ROPE[3]);                           // torsion de la corde
    }
  };
  rope(1, 2, W - 3, H - 4);
  rope(W - 3, 2, 1, H - 4);
  for (const yy of [5, H - 9]) rope(0, yy, W - 2, yy);
  // le nœud au croisement, et l'anneau du haut où s'accroche la corde de la grue
  const mx = Math.round(W / 2), my = Math.round(H / 2);
  b.r(mx - 2, my - 2, 4, 4, ROPE[1]).r(mx - 1, my - 2, 2, 1, ROPE[3]);
  b.r(mx - 3, 0, 6, 2, ROPE[1]).r(mx - 2, 0, 4, 1, ROPE[3]);
  return cv;
}

/** Paroi de la fosse de la grue (terre sombre, racines), peinte derrière les blocs. */
export function cranePit(c, Brush, canvas) {
  const W = c.w * TILE, H = c.h * TILE;
  const cv = canvas(W, H), b = new Brush(cv.getContext('2d'));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const w = worley(x + 300, y, 6, 51, 0.7);
    let v = 0.32 - (y / H) * 0.22 - (w.dy / 6) * 0.08 + (noise2(x * 0.3, y * 0.3, 52) - 0.5) * 0.15;
    if (w.d2 - w.d < 0.6) v -= 0.1;
    b.p(x, y, pick(C.SOIL, clamp01(v), x, y));
  }
  for (let k = 0; k < 5; k++) {                                      // racines qui pendent
    const x = Math.floor(ih(k, 3, 53) * W), len = 4 + Math.floor(ih(k, 4, 53) * 10);
    for (let j = 0; j < len; j++) b.p(x + (j % 4 === 3 ? 1 : 0), j, C.SOIL[1]);
  }
  b.r(0, 0, 1, H, C.SOIL[0]).r(W - 1, 0, 1, H, C.SOIL[0]);
  return cv;
}

export function roofCoverBox(gb) {
  const x0 = gb.x0 * TILE, x1 = gb.x1 * TILE, ye = (gb.eave ?? gb.y0) * TILE, RH = gb.roofH ?? 98, w = x1 - x0 + 70;
  return { x: Math.floor((x0 + x1) / 2 - w / 2) - 2, y: ye - RH - 8, w: w + 4, h: RH + 8 + TILE };
}
// haut des poteaux d'angle de la grange, par rapport à l'avant-toit : juste sous le bord du chaume
const POST_TOP = 2;

export function paintRoofCover(b, gb) {
  const x0 = gb.x0 * TILE, x1 = gb.x1 * TILE, ye = (gb.eave ?? gb.y0) * TILE, RH = gb.roofH ?? 98;
  thatchRoof(b, (x0 + x1) / 2, ye - RH + 2, x1 - x0 + 70, RH, 91);
  // la poutre sous l'avant-toit (comme l'ancienne charpente) : bois veiné, bouts sombres
  for (let yy = ye; yy < ye + TILE; yy++) {
    for (let x = x0 + TILE; x < x1 - 6; x++) {
      const grain = noise2(x * 0.08, yy * 0.9, 61);
      let v = 0.42 + (grain - 0.5) * 0.5 - ((yy - ye) / 16) * 0.15;
      if (Math.abs(grain - 0.5) < 0.03) v -= 0.2;
      if (yy === ye) v = 0.8; else if (yy >= ye + 14) v = 0.05;
      if (x < x0 + TILE + 2) v -= 0.2;
      b.p(x, yy, pick(C.WOOD, clamp01(v), x, yy));
    }
  }
  // les poteaux d'angle restent devant la poutre (même dessin que la couche avant de la
  // grange), mais passent SOUS le chaume : ils partent juste sous son bord (POST_TOP)
  const top = ye + POST_TOP, h = ye + TILE - top;
  b.r(x0 - 4, top, 8, h, C.WOOD[1]).r(x0 - 4, top, 2, h, C.WOOD[3]);
  b.r(x1 - 6, top, 8, h, C.WOOD[1]).r(x1 - 6, top, 2, h, C.WOOD[3]);
}

// cultures des gradins de la colline, du sommet vers le bas (0,2 rizière inondée,
// 0,5 riz, 0,7 potager, 0,9 théiers) : elles alternent pour que chaque marche se lise
const TERRACE_KINDS = [0.2, 0.5, 0.9, 0.2, 0.7, 0.5, 0.2, 0.9, 0.7, 0.2, 0.5, 0.7];

// couches de chaque type de décor (dans l'ordre de peinture)
const LAYERS = {
  serre: ['backdrop', 'front'], grange: ['backdrop', 'front'], grenier: ['backdrop', 'back', 'ground'], terraces_bg: ['backdrop'], basin: ['ground'],
  house: ['back'], mill: ['back'], well: ['back'], tree: ['back', 'front'],
  ladder: ['back'], stair: ['back'], lantern_stone: ['back'], shrine: ['back'], gate: ['back', 'front'], torii: ['back'],
  bridge_red: ['back'], stall: ['back'], temple_gate: [], kakashi: ['back'], daikon_rack: ['back'], bamboo_grove: ['back'],
  pine: ['back'], jizo: ['ground'], fox: ['ground'], crops: ['ground'], fence: ['ground'], stone: ['ground'],
  baskets: ['ground'], bridge: ['ground'], reeds: ['ground', 'front'], pots: ['ground'], hay: ['ground'],
  barn_door: ['back', 'front'], signpost: ['ground'], woodpile: ['ground'], cart: ['ground'], bush: ['ground'],
  sacks: ['ground'], tools: ['ground'], tubs: ['ground'], trellis: ['back'], tall_grass: ['front'],
  path_stones: ['ground'], bench: ['ground'], sign: ['ground'], waterfall: [], waterwheel: [], koi: [], kappa: [], barrel: [],
};
export function propLayers(p) { return LAYERS[p.type] ?? ['ground']; }
export const PROP_REACH = { stair: 140, temple_gate: 120, terraces_bg: 1100, serre: 700, grange: 600, grenier: 420, house: 90, mill: 160, tree: 100, gate: 80, stall: 80, bridge_red: 180, bamboo_grove: 90, crops: 400, reeds: 120, bridge: 200, trellis: 120 };

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

  // escalier de bois à claire-voie, vu de trois quarts (comme la porte du temple) :
  // deux limons en biais, l'un devant, l'autre derrière (décalé de la profondeur
  // D, vers le haut et la droite), et entre eux des marches de planche qui vont
  // d'un limon à l'autre, clouées sur les deux, sans contremarche ; une main
  // courante de corde. Les marches sont des « - » (traversables par-dessous) :
  // le milieu de chaque planche est à la hauteur de la case.
  stair(b, p) {
    const T = TILE, D = [14, -6];
    const P = p.treads.map(([tx, ty]) => [tx * T + 1, ty * T + 3]);      // bout avant de chaque marche
    const step = [P[1][0] - P[0][0], P[1][1] - P[0][1]];
    const top = [P[0][0] - step[0] * ((P[0][1] - p.top[1] * T) / step[1]), p.top[1] * T];
    const footY = p.foot[1] * T, foot = [P[P.length - 1][0] + step[0] * ((footY - P[P.length - 1][1]) / step[1]), footY];
    const rail = (ox, oy, light) => {                                     // un limon : planche en biais de 3 px
      const n = Math.round(foot[1] - top[1]);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(top[0] + ((foot[0] - top[0]) * i) / n) + ox, y = Math.round(top[1] + i) + oy;
        b.r(x - 1, y, 4, 1, light ? C.WOOD[2] : C.WOOD[1]).p(x - 1, y, light ? C.WOOD[4] : C.WOOD[2]).p(x + 2, y, C.WOOD[0]);
      }
    };
    // main courante de corde, des deux côtés : des poteaux plantés sur la plateforme
    // (posés sur ses planches) et au pied ; celle du fond d'abord, derrière tout
    const footX = Math.round(foot[0]);
    const handrail = (ox, oy, dark) => {
      const tx = Math.round(top[0]) + ox - 1, ty = top[1] + oy, fx = footX + ox + 4, fy = footY + oy;
      // (les poteaux descendent jusqu'aux planches et jusqu'au sol, même celui du fond)
      b.r(tx, ty - 18, 2, top[1] + 1 - (ty - 18), dark ? C.WOOD[0] : C.WOOD[1]).p(tx, ty - 18, C.WOOD[dark ? 2 : 4]);
      b.r(fx, fy - 24, 2, footY - (fy - 24), dark ? C.WOOD[0] : C.WOOD[1]).p(fx, fy - 24, C.WOOD[dark ? 2 : 4]);
      rope(b, tx + 1, ty - 17, fx + 1, fy - 23, 8, dark ? '#6b5230' : '#8a6a3a');
    };
    handrail(D[0], D[1], true);
    rail(D[0], D[1], false);                                              // le limon du fond
    // les marches : des planches qui vont d'un limon à l'autre (dessus clair, chant, ombre)
    for (const [x0, y0] of P) {
      const n = D[0];
      for (let i = 0; i <= n; i++) {
        const x = x0 + i, y = Math.round(y0 + (D[1] * i) / n);
        b.r(x, y - 2, 1, 1, C.WOOD[5]).r(x, y - 1, 1, 1, C.WOOD[4]).r(x, y, 1, 2, C.WOOD[3]).r(x, y + 2, 1, 1, C.WOOD[1]).p(x, y + 3, 'rgba(30, 18, 10, 0.5)');
        if (i % 5 === 2) b.p(x, y, C.WOOD[2]);                            // fil du bois
      }
      b.p(x0 + D[0] - 1, y0 + D[1] + 1, '#6f737b');                      // clou sur le limon du fond
    }
    rail(0, 0, true);                                                     // le limon de devant, par-dessus le bout des marches
    for (const [x0, y0] of P) b.p(x0, y0 + 1, '#a9aeb6');                 // clous sur le limon de devant
    // pied : une pierre plate ; puis la main courante de devant
    b.r(footX - 5, footY - 2, 22, 2, C.STONE[2]).r(footX - 5, footY - 2, 22, 1, C.STONE[4]);
    handrail(0, 0, false);
  },

  ladder(b, p, X, Y) {
    const h = (p.h ?? 4) * TILE;
    if (p.bx != null) {
      // échelle posée d'une plateforme à l'autre : son pied sur celle du dessous
      // (bx, en cases), son haut accroché au début de celle du dessus (tx)
      const x0 = Math.round(p.bx * TILE) - 4, x1 = Math.round(p.tx * TILE) - 4, top = Y - h - 3;
      b.line(x0, Y, x1, top, C.WOOD[1], 2).line(x0 + 8, Y, x1 + 8, top, C.WOOD[1], 2);
      b.line(x0 + 1, Y, x1 + 1, top, C.WOOD[4]).line(x0 + 9, Y, x1 + 9, top, C.WOOD[3]);
      for (let y = 5; y < h; y += 7) {
        const xx = Math.round(x0 + (x1 - x0) * (y / (h + 3)));
        b.r(xx + 1, Y - y, 8, 1, C.WOOD[3]).p(xx + 1, Y - y + 1, C.WOOD[1]);
      }
      b.r(x0 - 1, Y - 1, 12, 1, 'rgba(20, 12, 6, 0.4)');                 // ombre au pied
      return;
    }
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
          // mur de pierres sèches : sous le rebord du replat, une ombre (le replat
          // avance au-dessus du mur), puis l'arête éclairée ; pied du mur sombre
          const w = worley(x, y, 3.4, 91 + q.tier, 0.6);
          const wy = Math.floor(q.f * q.t.wall);                       // rang de pixel dans le mur
          // les murs, verticaux, reçoivent moins de lumière que les replats : plus sombres,
          // clairs juste sous l'arête puis de plus en plus sombres vers le pied
          let v = 0.46 - q.f * 0.16 - (w.dx / 3.4) * 0.2 - (w.dy / 2) * 0.22 + side;
          if (w.d2 - w.d < 0.8) v = 0.04;
          if (wy === 0) v -= 0.3;                                       // ombre sous le rebord
          else if (wy === 1) v += 0.2;                                  // arête éclairée
          if (wy >= q.t.wall - 1) v -= 0.25;                            // pied du mur
          col = pick(C.STONE, clamp01(v), x, y, 0.15);
          if (wy <= 1 && ih(x, q.tier, 13) < 0.22) col = pick(C.GRASS, clamp01(0.42 + side), x, y);   // herbe qui retombe du rebord
          if (wy > 1 && wy < q.t.wall - 1 && ih(x >> 1, y >> 1, 40 + q.tier) < 0.05) col = pick(C.MOSS, clamp01(0.5 + side), x, y);   // mousse entre les pierres
        } else {
          // le replat, vu un peu d'en haut : au fond l'ombre du mur du dessus, à l'avant
          // une diguette éclairée ; entre les deux, des rangs qui suivent la courbe du
          // gradin, plus grands au premier rang (la profondeur se lit)
          // les cultures alternent d'un gradin à l'autre (rizière inondée, riz, potager, théiers)
          const kind = TERRACE_KINDS[q.tier % TERRACE_KINDS.length], h = Math.max(1, q.h ?? 8);
          const py = q.f * h, pf = h - py;                              // pixels depuis le fond, depuis l'avant
          const back = q.edge ? 0 : 2;                                  // bande d'ombre au fond (sauf au sommet)
          if (q.edge && y - q.t.y < 1) col = pick(C.GRASS, clamp01(0.66 + side), x, y);
          else if (pf <= 1) col = pick(C.GRASS, clamp01(0.8 + side), x, y);            // arête de la diguette, au soleil
          else if (pf <= 2 && kind < 0.62) col = pick(C.SOIL, clamp01(0.42 + side), x, y);   // flanc de la diguette (rizières)
          else if (py < back) col = py < 1 ? pick(C.SOIL, clamp01(0.18 + side), x, y) : pick(C.GRASS, clamp01(0.26 + side), x, y);   // ombre portée du mur
          else {
            const m0 = back, m1 = h - (kind < 0.62 ? 2 : 1), g = Math.min(0.999, Math.max(0, (py - m0) / Math.max(1, m1 - m0)));
            const n = Math.max(2, Math.round((m1 - m0) / (kind < 0.42 ? 2.6 : 3))), rr = g * n, row = Math.floor(rr), ry = rr - row;
            const near = row / Math.max(1, n - 1);                      // 0 au fond, 1 au premier rang
            if (kind < 0.42) {                                          // rizière inondée, jeunes pousses en rangs
              const wcol = mixHex('#b9dce2', '#78aab4', g);              // le ciel se reflète, plus clair au fond
              const gap = (x + row * 3 + q.tier * 5) % 5 === 0;          // le rang de pousses, presque continu
              if (ry > 0.5 - near * 0.15 && !gap) col = ry < 0.75 && near > 0.3 ? '#b4de6c' : '#78b84a';
              else if (ry > 0.25 && !gap) col = mixHex(wcol, '#4f7f6c', 0.3);   // l'eau assombrie sous le rang
              else col = ih(x >> 2, y, q.tier + 50) > 0.93 ? '#e8f6f6' : wcol;        // rides claires
              if (side < -0.15) col = mixHex(col, '#6f95a0', 0.25);
            } else if (kind < 0.62) {                                   // riz qui a poussé : tiges serrées, en rangs
              if (ry < 0.22) col = mixHex('#9cc5cf', C.SOIL[2], 0.4);     // l'eau entre les rangs
              else {
                const blade = (x * 7 + row * 3 + q.tier) % 3;
                let v = 0.42 + ry * 0.28 + (blade === 0 ? 0.14 : blade === 1 ? -0.06 : 0) + near * 0.06 + side;
                col = pick(C.GRASS, clamp01(v), x, y);
                if (ry > 0.85 && blade === 0 && ih(x, row, q.tier) < 0.3) col = '#d9cf6a';   // épis qui dorent
              }
            } else if (kind < 0.84) {                                   // potager : touffes de légumes entre des sillons
              const cx = (x + row * 2 + q.tier * 3) % 5;
              if (ry < 0.24) col = pick(C.SOIL, clamp01(0.16 + side), x, y);                // sillon, dans l'ombre
              else if (cx === 0) col = pick(C.SOIL, clamp01(0.5 + side + (ry > 0.7 ? -0.12 : 0)), x, y);
              else {
                let v = 0.46 + (ry < 0.55 ? 0.22 : -0.06) + (cx === 1 ? 0.1 : cx === 4 ? -0.16 : 0) + near * 0.06 + side;
                col = pick(C.LEAF, clamp01(v), x, y);
                if (cx === 2 && ry > 0.7 && ih(x >> 2, row, q.tier + 6) < 0.3) col = [C.VEG.carrot[1], C.VEG.cabbage[2], '#e7e1f0', C.VEG.radish[1]][q.tier % 4];
              }
            } else {                                                    // théiers taillés en boules
              const rows = Math.max(1, Math.round(h / 6)), ff = q.f;
              const trow = Math.min(rows - 1, Math.floor(ff * rows)), ty = ff * rows - trow;
              const cxx = x + q.tier * 7 + trow * 4, cell = Math.floor(cxx / 8), bx = (cxx % 8) - 3.5;
              const rad = 2.9 + ih(cell, trow, q.tier + 30) * 1.1, by = (ty - 0.5) * 6.5;
              const d = (bx * bx) / (rad * rad) + (by * by) / 10;
              if (d < 1) col = pick(C.HEDGE, clamp01(0.62 + side - bx * 0.06 - by * 0.09 + (d < 0.3 ? 0.08 : 0)), x, y);
              else col = by > 0 && Math.abs(bx) < rad + 1 ? C.SOIL[1] : C.SOIL[2 + (ih(x, y, 31) < 0.2 ? 1 : 0)];
            }
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
    // grande serre de bambou (13 cases de haut) : voûte en arceaux, toiles
    // translucides déchirées, hautes étagères, établi, semis, plantes suspendues
    const x0 = p.x0 * TILE, x1 = p.x1 * TILE, y0 = p.y0 * TILE, y1 = p.y1 * TILE;
    const BAY = 48, top = y0 + 8;                     // haut des murs (sous le faîtage)
    const arch = (x) => { const u = ((x - x0) % BAY) / BAY; return Math.round(Math.sin(u * Math.PI) * 9); };
    if (layer === 'backdrop') {
      // 1. toiles : panneaux translucides, plus clairs en haut, coutures, déchirures
      for (let x = x0; x < x1; x++) for (let y = top - 14; y < y1; y++) {
        if (y < top - arch(x)) continue;
        const n = noise2(x * 0.06, y * 0.09, 71);
        if (n > 0.73 && y > top + 10 && y < y1 - 30) {                // déchirure : on voit dehors
          if (n < 0.745) b.p(x, y, 'rgba(244, 246, 232, 0.8)');       // bord effiloché
          continue;
        }
        const fold = Math.sin((x - x0) * 0.33) * 0.5 + 0.5;
        const v = 0.62 + fold * 0.12 - (y - top) / 520;
        const a = y < top ? 0.92 : 0.6 + (y - top) / (y1 - top) * 0.12;
        b.p(x, y, `rgba(${Math.round(214 + v * 30)}, ${Math.round(226 + v * 22)}, ${Math.round(196 + v * 28)}, ${a.toFixed(2)})`);
        if ((y - top) % 44 === 0 && y > top) b.p(x, y, 'rgba(150, 168, 120, 0.55)');   // ligne de couture
      }
      // 1 bis. le toit : une toile en pointes (façon chapiteau), tendue au-dessus du
      // faîtage par de fines perches de bambou ; elle retombe en triangle entre deux
      // perches, coutures rayonnantes, pièces rapiécées, fanions délavés
      const PEAK = 28, VAL = 5;                       // hauteur des pointes et du creux, au-dessus du faîtage
      const tentTop = (x) => {
        const u = ((x - x0) % BAY) / BAY, t = Math.abs(u - 0.5) * 2;      // 1 contre une perche, 0 au milieu
        return y0 - VAL - Math.round((PEAK - VAL) * Math.pow(t, 1.7));
      };
      for (let x = x0 - 2; x < x1 + 3; x++) {
        const yt = tentTop(Math.min(Math.max(x, x0), x1)), u = ((x - x0) % BAY + BAY) % BAY;
        const side = u < BAY / 2 ? 1 : -1;                                 // pan éclairé (à droite d'une perche) ou à l'ombre
        for (let y = yt; y < y0 + 3; y++) {
          const d = (y - yt) / (y0 + 3 - yt);
          let v = 0.66 + side * 0.08 - d * 0.1 + (noise2(x * 0.1, y * 0.2, 81) - 0.5) * 0.08;
          if (y === yt) v += 0.16;                                         // liseré de lumière sur l'arête
          const seam = ((u + 7) % 12 === 0) && y > yt + 2;                 // coutures : elles descendent de la pointe
          const col = seam ? 'rgba(160, 176, 132, 0.95)'
            : `rgba(${Math.round(214 + v * 30)}, ${Math.round(226 + v * 22)}, ${Math.round(196 + v * 28)}, 0.95)`;
          b.p(x, y, col);
        }
        b.p(x, yt + 1, 'rgba(255, 255, 246, 0.9)');
      }
      for (let k = 0; ; k++) {                                             // pièces cousues sur la toile
        const px = x0 + 20 + k * 86 + Math.floor(ih(k, 3, 82) * 20);
        if (px > x1 - 20) break;
        const py = tentTop(px) + 6;
        b.r(px, py, 7, 5, 'rgba(196, 204, 170, 0.95)').r(px, py, 7, 1, 'rgba(150, 160, 120, 0.9)').r(px, py + 4, 7, 1, 'rgba(150, 160, 120, 0.9)');
        for (let i = 1; i < 7; i += 2) b.p(px + i, py + 2, 'rgba(140, 150, 110, 0.9)');
      }
      // les perches : de fins bambous qui montent du mur jusqu'à la pointe, un nœud, un fanion
      const FLAGS = ['#a8473a', '#3f5a7a', '#c9a24a'];
      for (let x = x0, k = 0; x <= x1; x += BAY, k++) {
        const ty = y0 - PEAK - 6;
        for (let y = ty; y < top; y++) b.p(x, y, C.BAMBOO[4]).p(x + 1, y, C.BAMBOO[1]);
        for (let n = ty + 5; n < y0; n += 11) b.r(x - 1, n, 4, 1, C.BAMBOO[0]);
        b.r(x - 1, y0 - PEAK - 1, 4, 2, '#2a2420');                       // ligature sous la pointe
        b.r(x, ty - 1, 2, 1, C.BAMBOO[5]);
        if (k % 2 === 0) {                                                 // petit fanion délavé
          const fc = FLAGS[(k / 2) % FLAGS.length];
          for (let j = 0; j < 4; j++) b.r(x + 2, ty + 1 + j, 6 - j * 1.5, 1, fc);
          b.p(x + 2, ty + 1, '#e8dcc0');
        }
      }
      // 2. voûte : un arceau de bambou par travée, pannes, faîtage peint par les tuiles
      for (let x = x0; x < x1; x++) {
        const y = top - arch(x);
        b.p(x, y, C.BAMBOO[4]).p(x, y + 1, C.BAMBOO[2]).p(x, y + 2, C.BAMBOO[1]);
      }
      for (const py of [top + 34, top + 78]) for (let x = x0; x < x1; x++) b.p(x, py, (x % 17) === 0 ? C.BAMBOO[0] : C.BAMBOO[2]).p(x, py + 1, C.BAMBOO[1]);
      // 3. poteaux de bambou (un par travée), nœuds, liens, contrefiches, lianes
      for (let x = x0; x <= x1; x += BAY) {
        for (let y = top - 2; y < y1; y++) { b.p(x, y, C.BAMBOO[4]); b.p(x + 1, y, C.BAMBOO[2]); b.p(x + 2, y, C.BAMBOO[1]); }
        for (let n = top; n < y1; n += 14) b.r(x - 1, n, 5, 1, C.BAMBOO[0]);
        b.line(x + 3, top + 18, x + 18, top + 3, C.BAMBOO[2], 2).line(x - 1, top + 18, x - 16, top + 3, C.BAMBOO[2], 2);
        for (const ly of [top + 34, top + 78]) b.r(x - 2, ly - 1, 7, 3, '#2a2420');
        for (let y = top + 20; y < y1 - 2; y++) {
          if (ih(x, 7, 72) < 0.35) break;
          const vx = x + 1 + Math.round(Math.sin(y * 0.32 + x) * 3);
          b.p(vx, y, C.LEAF[2]);
          if (y % 5 === 0) b.r(vx - 1, y, 3, 2, C.LEAF[3]).p(vx - 1, y, C.LEAF[4]);
        }
      }
      // 4. hautes étagères contre la toile : bocaux de graines, pots, bottes d'herbes
      for (let k = 0; ; k++) {
        const sx = x0 + 22 + k * 132, w = 46;
        if (sx + w > x1 - 20) break;
        if (ih(k, 2, 73) < 0.25) continue;
        const sh = 4, h = 26;
        for (let l = 0; l < sh; l++) {
          const ly = y1 - 12 - l * h;
          b.r(sx, ly, w, 3, C.WOOD[3]).r(sx, ly, w, 1, C.WOOD[5]).r(sx, ly + 3, w, 1, C.WOOD[0]);
          for (let j = 0; j < 6; j++) {
            const kind = ih(sx + j, l, 74), jx = sx + 2 + j * 7 + Math.floor(ih(j, l, 75) * 2);
            if (kind < 0.18) continue;
            if (kind < 0.55) {                                       // bocal de graines
              const col = [C.TERRACOTTA[3], C.PAPER[2], '#8aa074', '#c9a46c'][Math.floor(ih(j, l, 76) * 4)];
              b.r(jx, ly - 8, 5, 8, col).r(jx, ly - 9, 5, 1, C.WOOD[1]).p(jx, ly - 7, '#ffffff').r(jx + 1, ly - 5, 3, 2, C.PAPER[0]);
            } else if (kind < 0.85) {                                // petit pot et sa pousse
              b.r(jx, ly - 5, 5, 5, C.TERRACOTTA[2]).r(jx, ly - 5, 5, 1, C.TERRACOTTA[4]);
              b.r(jx + 2, ly - 9, 1, 4, C.LEAF[2]).p(jx + 1, ly - 9, C.LEAF[3]).p(jx + 3, ly - 8, C.LEAF[3]);
            } else {                                                 // botte d'herbes sèches suspendue
              b.r(jx + 2, ly + 4, 1, 3, '#5b4a36');
              for (let q = 0; q < 4; q++) b.r(jx + q, ly + 7, 1, 7 + (q % 2) * 2, q % 2 ? '#8a7f4a' : '#a39553');
            }
          }
        }
        b.r(sx - 1, y1 - 12 - (sh - 1) * h - 4, 3, (sh - 1) * h + 16, C.WOOD[2]).r(sx + w - 2, y1 - 12 - (sh - 1) * h - 4, 3, (sh - 1) * h + 16, C.WOOD[1]);
      }
      // 5. bacs de semis le long du mur du fond, et un établi avec ses outils
      for (let x = x0 + 8; x < x1 - 30; x += 70) {
        if (ih(x, 4, 77) < 0.4) continue;
        b.r(x, y1 - 9, 30, 9, C.WOOD[2]).r(x, y1 - 9, 30, 1, C.WOOD[4]).r(x, y1 - 1, 30, 1, C.WOOD[0]);
        for (let k = 0; k < 9; k++) b.r(x + 2 + k * 3, y1 - 12 - (k % 2), 1, 3 + (k % 2), C.LEAF[2 + (k % 2)]);
      }
      {
        const wx = x0 + Math.round((x1 - x0) * 0.42), wy = y1 - 20;
        b.r(wx, wy, 44, 3, C.WOOD[3]).r(wx, wy, 44, 1, C.WOOD[5]);
        b.r(wx + 2, wy + 3, 2, 17, C.WOOD[1]).r(wx + 40, wy + 3, 2, 17, C.WOOD[1]).r(wx + 2, wy + 12, 40, 1, C.WOOD[1]);
        b.r(wx + 4, wy - 5, 12, 5, C.TERRACOTTA[1]).r(wx + 4, wy - 5, 12, 1, C.TERRACOTTA[3]);                     // pot à rempoter
        b.r(wx + 20, wy - 7, 8, 7, '#7d8c96').r(wx + 28, wy - 6, 5, 1, '#7d8c96').r(wx + 22, wy - 9, 4, 2, '#7d8c96');   // arrosoir
        b.line(wx + 34, wy - 1, wx + 40, wy - 7, C.WOOD[1]).r(wx + 39, wy - 9, 3, 3, '#8e939c');                       // transplantoir
      }
      // 6. plantes suspendues, gourdes sur une liane tendue sous la panne
      for (let x = x0 + 30; x < x1 - 20; x += 72) {
        const hy = top + 34 + Math.floor(ih(x, 1, 78) * 20);
        rope(b, x, top + 35, x, hy, 0, C.WOOD[1]);
        b.r(x - 4, hy, 9, 5, C.TERRACOTTA[2]).r(x - 4, hy, 9, 1, C.TERRACOTTA[4]);
        for (let k = 0; k < 5; k++) b.r(x - 5 + k * 3, hy + 4, 1, 5 + (k % 3) * 4, C.LEAF[2 + (k % 2)]);
        leaves(b, x, hy - 2, 5, C.LEAF, x, { light: 0.05 });
      }
      for (let x = x0 + 60; x < x1 - 40; x += 150) {
        for (let k = 0; k < 40; k++) b.p(x + k, top + 80 + Math.round(Math.sin(k * 0.3) * 2), C.LEAF[2]);
        for (const gx of [x + 10, x + 26]) b.r(gx, top + 83, 4, 7, '#c9b45a').r(gx + 1, top + 90, 2, 1, '#a08a3a').p(gx + 1, top + 84, '#e6d690');
      }
      // 7. rais de lumière par les déchirures du toit
      for (let k = 0; k < 4; k++) {
        const lx = x0 + 60 + k * 120 + Math.floor(ih(k, 5, 79) * 40);
        if (lx > x1 - 30) break;
        for (let y = top; y < y1 - 4; y++) {
          const off = Math.round((y - top) * 0.35);
          for (let w = 0; w < 10; w++) if (((lx + w + off) + y) % 3 === 0) b.p(lx + w + off, y, 'rgba(255, 250, 220, 0.08)');
        }
      }
    } else if (layer === 'front') {
      // poteaux du premier plan, plus sombres, et feuilles qui pendent du haut
      for (let x = x0 + 24; x < x1; x += 160) {
        for (let y = top - 4; y < y1; y++) { b.p(x, y, C.BAMBOO[1]); b.p(x + 1, y, C.BAMBOO[0]); b.p(x + 2, y, '#2d401c'); }
        for (let n = top; n < y1; n += 14) b.r(x - 1, n, 5, 1, '#2a2420');
      }
      for (let x = x0; x < x1; x += 6) {
        if (ih(x, 9, 80) < 0.5) continue;
        const len = 6 + Math.floor(ih(x, 10, 80) * 14);
        for (let j = 0; j < len; j++) b.p(x + Math.round(Math.sin(j * 0.4) * 1.5), top - 4 + j, j > len - 3 ? '#4d6b2c' : '#2f4a1e');
      }
    }
  },

  // pots et semis posés sur une étagère de la serre (passerelle « - ») ; montants
  // jusqu'au sol aux deux bouts
  shelf_pots(b, p, X, Y, env) {
    const x0 = p.x * TILE, w = p.w * TILE, top = p.y * TILE;
    let bot = p.y + 1; while (bot < env.map.h && !env.map.solid(p.x, bot)) bot++;
    for (const lx of [x0 + 1, x0 + w - 3]) b.r(lx, top + 6, 2, bot * TILE - top - 6, C.WOOD[2]).r(lx, top + 6, 1, bot * TILE - top - 6, C.WOOD[4]);
    b.line(x0 + 3, top + 6, x0 + 10, top + 13, C.WOOD[1]).line(x0 + w - 4, top + 6, x0 + w - 11, top + 13, C.WOOD[1]);   // équerres
    for (let k = 0; k < p.w * 2; k++) {
      const px = x0 + 3 + k * 8 + Math.floor(ih(k, p.x, 61) * 2), kind = ih(k, p.y, 62);
      if (kind < 0.15) continue;
      const pw = 5 + Math.floor(ih(k, 3, 63) * 2), ph = 4 + Math.floor(ih(k, 4, 63) * 2);
      b.r(px, top - ph, pw, ph, C.TERRACOTTA[2]).r(px, top - ph, pw, 1, C.TERRACOTTA[4]).r(px + pw - 1, top - ph, 1, ph, C.TERRACOTTA[0]);
      if (kind < 0.55) {                                             // semis
        for (let j = 0; j < 3; j++) b.r(px + 1 + j * 2, top - ph - 2 - (j % 2) * 2, 1, 2 + (j % 2) * 2, C.LEAF[2 + (j % 2)]);
      } else if (kind < 0.8) {                                       // plante feuillue
        leaves(b, px + pw / 2, top - ph - 3, 3.5, C.LEAF, px, { light: 0.06 });
      } else {                                                       // fleur
        b.r(px + 2, top - ph - 5, 1, 5, C.LEAF[1]).p(px + 1, top - ph - 6, C.FLOWER.pink).p(px + 3, top - ph - 6, C.FLOWER.pink).p(px + 2, top - ph - 7, C.FLOWER.yellow);
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
    const ye = (p.eave ?? p.y0) * TILE, RH = p.roofH ?? 98;   // avant-toit et hauteur du toit
    if (layer === 'backdrop') {
      // grand toit de chaume visible de loin (assez haut pour loger le grenier)
      thatchRoof(b, (x0 + x1) / 2, ye - RH + 2, x1 - x0 + 70, RH, 91);
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
      // meules de foin contre le mur (sous la mezzanine : pas derrière la botte-marche,
      // qu'elles noyaient dans la paille)
      for (const x of [x0 + 110, x0 + 200]) {
        for (let j = 0; j < 28; j++) for (let i = -26 + j * 0.4; i < 26 - j * 0.4; i++) {
          const v = 0.55 - (i / 26) * 0.2 - j * 0.004 + (noise2((x + i) * 0.6, (y1 - j) * 0.3, 4) - 0.5) * 0.5;
          b.p(Math.round(x + i), y1 - 1 - j, pick(C.STRAW, clamp01(v - 0.1), x + i, j));
        }
      }
    } else if (layer === 'front') {
      // encadrement de la porte et poteau d'angle, au premier plan ; ils partent sous le
      // bord du chaume (le toit les recouvre, il ne passe pas derrière eux)
      const top = ye + POST_TOP;
      b.r(x0 - 4, top, 8, y1 - top, C.WOOD[1]).r(x0 - 4, top, 2, y1 - top, C.WOOD[3]);
      b.r(x1 - 6, top, 8, y1 - top, C.WOOD[1]).r(x1 - 6, top, 2, y1 - top, C.WOOD[3]);
    }
  },

  // --- zone 6 : le grenier, 3e étage sous le toit de chaume -----------------
  // Vu en coupe comme le reste de la grange : sous l'entrait, le chaume de
  // devant a disparu (grange abandonnée) et l'on voit l'intérieur du toit :
  // pignon en planches, chevrons qui suivent les pentes, pannes, poteaux.
  grenier(b, p, X, Y, env, layer) {
    const g = atticGeom(p);
    const W = C.WOOD;
    if (layer === 'backdrop') {
      // 1. le pignon du fond : planches sombres, plus sombres sous le toit
      for (let yy = g.top - 6; yy < g.bottom; yy++) {
        const [xa, xb] = g.span(yy);
        for (let x = Math.ceil(xa); x <= Math.floor(xb); x++) {
          const i = x - g.x0, k = Math.floor(i / 7);
          let v = 0.45 + (ih(k, Math.floor(yy / 29), 77) - 0.5) * 0.3 + (noise2(x * 0.4, yy * 0.05, 7) - 0.5) * 0.22;
          if (i % 7 === 0) v -= 0.26; else if (i % 7 === 1) v += 0.08;
          v -= clamp01((g.ye + 10 - yy) / 52) * 0.3;                       // pénombre sous le chaume
          if (ih(x, yy, 78) < 0.012) v += 0.25;                             // nœuds, échardes claires
          b.p(x, yy, pick(ATTIC, clamp01(v), x, yy));
        }
      }
      // jours entre les planches du pignon (le soleil filtre)
      for (let x = g.x0 + 37; x < g.x1 - 20; x += 43) {
        const [xa, xb] = g.span(g.top + 4);
        if (x < xa + 6 || x > xb - 6) continue;
        b.r(x, g.top + 4, 1, g.bottom - g.top - 10, 'rgba(255, 220, 150, 0.22)');
      }
      // 2. sablière du grenier (au-dessus du plancher) et poteaux, dans le prolongement de ceux du bas
      b.r(g.floorX0, g.ye - 2, g.floorX1 - g.floorX0, 4, W[1]).r(g.floorX0, g.ye - 2, g.floorX1 - g.floorX0, 1, W[3]);
      for (let x = g.x0 + 24; x < g.x1; x += 96) {
        const [xa, xb] = g.span(g.top);
        if (x < xa + 2 || x + 6 > xb - 2) continue;
        b.r(x, g.top, 6, g.bottom - g.top, W[1]).r(x, g.top, 2, g.bottom - g.top, W[2]).r(x + 5, g.top, 1, g.bottom - g.top, W[0]);
        b.line(x + 6, g.top + 22, x + 28, g.top + 2, W[1], 3).line(x, g.top + 22, x - 22, g.top + 2, W[1], 3);   // contrefiches
      }
      // 3. chevrons le long des deux pentes, pannes vues en bout, brins de chaume qui pendent
      for (let yy = g.top - 6; yy < g.ye + 2; yy++) {
        const [xa, xb] = g.span(yy);
        for (let t = 0; t < 4; t++) {
          const c = t === 0 ? W[0] : t === 1 ? W[2] : t === 2 ? W[1] : W[0];
          b.p(Math.round(xa) + t, yy, c);
          b.p(Math.round(xb) - t, yy, c);
        }
        if ((yy - g.top) % 15 === 7) {                                       // pannes
          b.r(Math.round(xa) + 4, yy - 2, 4, 4, W[1]).p(Math.round(xa) + 4, yy - 2, W[3]);
          b.r(Math.round(xb) - 7, yy - 2, 4, 4, W[1]).p(Math.round(xb) - 7, yy - 2, W[3]);
        }
        if (ih(yy, 0, 81) < 0.28) {                                          // brins de paille
          const n = 3 + Math.floor(ih(yy, 1, 81) * 5);
          for (let k = 0; k < n; k++) {
            b.p(Math.round(xa) + 4 + Math.floor(k * 0.6), yy + k, C.STRAW[k < 2 ? 1 : 0]);
            b.p(Math.round(xb) - 4 - Math.floor(k * 0.6), yy + 2 + k, C.STRAW[k < 2 ? 1 : 0]);
          }
        }
      }
      // 4. l'entrait : grosse poutre qui ferme le grenier sous le faîte, et ses jambes de force
      {
        const yb = g.top - 9, [xa, xb] = g.span(g.top - 4);
        for (let yy = yb; yy < g.top + 2; yy++) {
          for (let x = Math.round(xa) - 2; x <= Math.round(xb) + 2; x++) {
            const grain = noise2(x * 0.08, yy * 0.9, 61);
            let v = 0.46 + (grain - 0.5) * 0.5 - ((yy - yb) / 11) * 0.18;
            if (Math.abs(grain - 0.5) < 0.03) v -= 0.2;
            if (yy === yb) v = 0.85; else if (yy === g.top + 1) v = 0.05;
            if (x < Math.round(xa) + 1 || x > Math.round(xb) + 1) v -= 0.25;
            b.p(x, yy, pick(W, clamp01(v), x, yy));
          }
        }
        // chevilles
        for (let x = Math.round(xa) + 14; x < xb - 10; x += 37) b.r(x, yb + 4, 2, 2, W[0]).p(x, yb + 4, W[3]);
        const ys = g.ye - 4;
        const [la, lb] = g.span(ys);
        b.line(Math.round(xa) + 22, g.top + 1, Math.round(la) + 4, ys, W[1], 3);
        b.line(Math.round(xb) - 22, g.top + 1, Math.round(lb) - 4, ys, W[1], 3);
      }
      // 5. lucarne à croisillons : papier usé, un coin déchiré
      {
        const wx = g.floorX0 + 48, wy = g.top + 26, ww = 24, wh = 16;
        b.r(wx - 2, wy - 2, ww + 4, wh + 4, W[1]).r(wx - 2, wy - 2, ww + 4, 1, W[3]);
        for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) {
          let v = 0.75 - j * 0.02 + (noise2((wx + i) * 0.5, (wy + j) * 0.5, 13) - 0.5) * 0.25;
          b.p(wx + i, wy + j, pick(C.PAPER, clamp01(v), wx + i, wy + j));
        }
        b.r(wx + ww / 2 - 1, wy, 2, wh, W[1]).r(wx, wy + wh / 2 - 1, ww, 2, W[1]);
        b.r(wx + ww / 4, wy, 1, wh, W[2]).r(wx + (3 * ww) / 4, wy, 1, wh, W[2]);
        for (let k = 0; k < 6; k++) b.r(wx + ww - 6 + k, wy + 1, 6 - k, 1, '#f9e7b0');   // le coin déchiré : le jour
        b.r(wx - 3, wy + wh + 2, ww + 6, 2, W[2]).r(wx - 3, wy + wh + 2, ww + 6, 1, W[4]);   // appui
      }
      // 6. kakis séchés (hoshigaki) et bottes de riz suspendus à l'entrait
      for (let k = 0; k < 3; k++) {
        const sx = g.floorX0 + 98 + k * 9, n = 5 + (k % 2), y1 = g.top + 18;
        b.r(sx, g.top + 2, 1, y1 - g.top + n * 5, C.STRAW[1]);
        for (let i = 0; i < n; i++) {
          const yy = y1 + i * 5;
          b.r(sx - 1, yy, 3, 4, '#c8692a').r(sx - 1, yy, 1, 2, '#e8964a').p(sx + 1, yy + 3, '#7e3e16').p(sx, yy - 1, '#4d5a2a');
        }
      }
      for (let k = 0; k < 2; k++) {                                          // gerbes de riz, épis en bas
        const sx = g.floorX0 + 136 + k * 14, y1 = g.top + 16 + k * 5;
        b.r(sx, g.top + 2, 1, y1 - g.top - 2, '#6a5530');
        b.r(sx - 1, y1, 3, 2, C.STRAW[0]);
        for (let i = -3; i <= 3; i++) {
          const len = 10 + Math.round(ih(i, k, 83) * 5);
          for (let j = 0; j < len; j++) b.p(sx + Math.round(i * (j / len) * 0.9), y1 + 2 + j, C.STRAW[j > len - 3 ? 3 : 1 + ((i + 3) % 2)]);
        }
      }
      // tirant du côté ouvert (au niveau du plafond du rez-de-chaussée), dans le plan du mur du fond
      b.r(g.floorX1, g.bottom - 5, g.x1 - 6 - g.floorX1, 5, W[0]).r(g.floorX1, g.bottom - 5, g.x1 - 6 - g.floorX1, 1, W[2]);
      for (let x = g.floorX1 + 20; x < g.x1 - 10; x += 41) b.r(x, g.bottom - 4, 2, 2, '#1a120c');
            // 7. perchoir de la chouette, côté ouvert de la grange
      b.r(p.owl.x - 30, p.owl.y, 60, 3, W[1]).r(p.owl.x - 30, p.owl.y, 60, 1, W[3]);
      // 8. toiles d'araignée dans les coins sous le chaume
      for (const side of [-1, 1]) {
        const [xa, xb] = g.span(g.top + 3);
        const cx = side < 0 ? Math.round(xa) + 4 : Math.round(xb) - 4, cy = g.top + 2;
        for (let a = 0; a < 5; a++) {
          const ang = side < 0 ? a * 0.36 + 0.1 : Math.PI - a * 0.36 - 0.1;
          b.line(cx, cy, cx + Math.cos(ang) * 13, cy + Math.sin(ang) * 13, 'rgba(220, 220, 210, 0.32)');
        }
        for (const rr of [5, 9]) for (let a = 0; a < 5; a++) {
          const ang = side < 0 ? a * 0.36 + 0.1 : Math.PI - a * 0.36 - 0.1;
          b.p(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr), 'rgba(230, 230, 220, 0.5)');
        }
      }
    } else if (layer === 'back') {
      const fy = g.floorY;                                                   // dessus du plancher
      // le vieux coffre (nagamochi) s'ouvre : il est dessiné par live.js (chestSprite)
      // sac de riz affaissé et petite caisse
      PAINT.sacks(b, p, g.floorX0 + 136, fy, true);
      b.r(g.floorX0 + 146, fy - 9, 12, 9, W[2]).r(g.floorX0 + 146, fy - 9, 12, 1, W[4]).r(g.floorX0 + 146, fy - 5, 12, 1, W[1]);
      // ombrelle de papier huilé (wagasa) fermée, posée contre la pente
      {
        const ax = g.floorX0 + 24, ay = fy;
        for (let k = 0; k < 24; k++) {
          const x = ax + Math.round(k * 0.42), y = ay - k;
          const wdt = k < 4 ? 1 : k < 18 ? 3 : 2;
          b.r(x - 1, y, wdt, 1, k % 5 === 0 ? C.RED[1] : C.RED[2]);
          if (wdt > 1) b.p(x - 1, y, C.RED[3]);
        }
        b.r(ax + 10, ay - 27, 1, 3, W[1]);
      }
      // lanterne de papier crevée, couchée sur le plancher
      {
        const lx = g.floorX0 + 168, ly = fy - 5;
        for (let j = -4; j <= 4; j++) for (let i = -6; i <= 6; i++) {
          if ((i * i) / 36 + (j * j) / 16 > 1) continue;
          b.p(lx + i, ly + j, i % 3 === 0 ? C.PAPER[0] : pick(C.PAPER, 0.5 - j * 0.06, lx + i, j));
        }
        b.r(lx - 7, ly - 2, 1, 5, '#2a2420').r(lx + 7, ly - 2, 1, 5, '#2a2420');
        b.r(lx + 1, ly - 2, 3, 3, '#3a2e22');                               // la déchirure
      }
    } else if (layer === 'ground') {
      // la marche : bottes de foin empilées au bout de la mezzanine (on y grimpe)
      const st = p.step, sx = st.x * TILE, sy = st.y0 * TILE, sw = st.w * TILE, sh = (st.y1 - st.y0 + 1) * TILE;
      // (les bottes elles-mêmes : décor « hay_stack », calé sur leurs cases)
      // fourche plantée dans la botte du haut
      b.line(sx + sw - 7, sy + 5, sx + sw + 5, sy - 17, W[1], 2);               // manche de bois clair, ombré
      b.line(sx + sw - 7, sy + 4, sx + sw + 4, sy - 17, W[4], 1);
      b.r(sx + sw + 2, sy - 19, 6, 2, '#5d6168').r(sx + sw + 2, sy - 19, 6, 1, '#9aa0a8');   // douille
      for (let k = 0; k < 3; k++) b.r(sx + sw + 2 + k * 2 + (k === 1 ? 0 : 0), sy - 25, 1, 6, k === 1 ? '#8a8e96' : '#a7adb5');
      // paille éparse sur le plancher du grenier et sur la mezzanine
      for (let x = g.floorX0 + 8; x < g.floorX1 - 2; x++) if (ih(x, 3, 85) < 0.3) b.p(x, g.floorY - 1, C.STRAW[ih(x, 4, 85) < 0.5 ? 2 : 3]);
      for (let x = sx - 30; x < sx + sw + 10; x++) if (ih(x, 5, 85) < 0.25) b.p(x, sy + sh - 1, C.STRAW[2]);
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

  // tas de pierres de l'arène du corbeau : il vient s'y servir avec ses serres
  rock_pile(b, p, X, Y) {
    const stones = [];
    for (let k = 0; k < 14; k++) {
      const r = 3 + Math.floor(ih(k, p.x, 41) * 5), row = k < 7 ? 0 : k < 11 ? 1 : 2;
      const span = [26, 18, 10][row];
      stones.push({ x: X - span + ih(k, p.x, 42) * span * 2, y: Y - r * 0.8 - row * 6, r });
    }
    stones.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const st of stones.reverse()) {
      for (let j = -st.r; j <= st.r; j++) for (let i = -st.r - 1; i <= st.r + 1; i++) {
        const q = (i * i) / ((st.r + 1) * (st.r + 1)) + (j * j) / (st.r * st.r * 0.75);
        if (q > 1) continue;
        let v = 0.6 - (i / st.r) * 0.2 - (j / st.r) * 0.28 + (noise2((st.x + i) * 0.5, (st.y + j) * 0.5, 43) - 0.5) * 0.3;
        if (q > 0.78) v = 0.08;
        let col = pick(C.STONE, clamp01(v), st.x + i, st.y + j);
        if (j < -st.r * 0.4 && noise2((st.x + i) * 0.3, (st.y + j) * 0.3, 44) > 0.66) col = pick(C.MOSS, 0.5, st.x + i, j);
        b.p(Math.round(st.x + i), Math.round(st.y + j), col);
      }
    }
    // cailloux épars et herbe autour
    for (let k = 0; k < 10; k++) b.r(Math.round(X - 34 + ih(k, 7, 45) * 68), Y - 2, 2, 2, C.STONE[1 + (k % 3)]);
  },

  // bottes de foin empilées, calées sur leurs cases de collision (« % ») : des
  // marches qu'on ne peut pas briser. p.x = colonne de gauche, p.y = haut du sol,
  // p.cols = hauteur (en cases) de chaque colonne, de gauche à droite
  hay_stack(b, p) {
    const x0 = p.x * TILE, base = p.y * TILE;
    p.cols.forEach((h, i) => {
      for (let k = 0; k < h; k++) {
        const bx = x0 + i * TILE, by = base - (k + 1) * TILE, w = TILE + (k === 0 ? 1 : 0), seed = 30 + i * 3 + k;
        for (let j = 0; j < TILE; j++) for (let q = 0; q < w; q++) {
          let v = 0.62 - (q / w) * 0.25 - (j / TILE) * 0.15 + (noise2((bx + q) * 0.7, (by + j) * 0.3, seed) - 0.5) * 0.45;
          if (j === 0) v += 0.12;
          if (j === TILE - 1 || q === w - 1) v -= 0.2;
          if (q === 0) v += 0.05;
          b.p(bx + q, by + j, pick(C.STRAW, clamp01(v), bx + q, by + j));
        }
        b.r(bx + 4, by, 1, TILE, C.STRAW[0]).r(bx + TILE - 5, by, 1, TILE, C.STRAW[0]);   // liens
        for (let q = 0; q < TILE; q += 2) if (ih(q, by, seed) < 0.55) b.p(bx + q, by - 1 - Math.floor(ih(q, bx, seed) * 2), C.STRAW[3]);
      }
    });
    // une botte-marche seule : contour net, ficelles sombres, ombre au sol (elle se
    // lit comme un bloc où poser le pied, pas comme de la paille du décor)
    if (p.step) {
      p.cols.forEach((h, i) => {
        const bx = x0 + i * TILE, top = base - h * TILE;
        const hl = i === 0 ? 0 : p.cols[i - 1], hr = p.cols[i + 1] ?? 0;
        if (hl < h) b.r(bx - 1, top + 1, 1, base - top - 1, C.STRAW[0]);
        if (hr < h) b.r(bx + TILE, base - (h - hr) * TILE + 1, 1, (h - hr) * TILE - 1, C.STRAW[0]);
        b.r(bx, top, TILE, 1, C.STRAW[4]);
        for (const lx of [bx + 4, bx + TILE - 5]) b.r(lx, top, 1, base - top, '#5b4a36').p(lx, top + 1, '#7a6444');
        for (let k = 1; k < h; k++) b.r(bx, base - k * TILE, TILE, 1, C.STRAW[0]);     // joint entre deux bottes
      });
      b.r(x0 - 3, base - 1, p.cols.length * TILE + 6, 1, 'rgba(20, 12, 6, 0.45)');
    }
    // brins éparpillés au pied
    for (let x = x0 - 6; x < x0 + p.cols.length * TILE + 6; x++) if (ih(x, 9, 31) < 0.3) b.p(x, base - 1, C.STRAW[ih(x, 2, 31) < 0.5 ? 2 : 3]);
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

  // --- zone 9 : la grande porte du temple, au bout du champ du corbeau -------
  // Ici la partie fixe : seuil de pierre, passage lumineux, piliers vermillon,
  // traverse, grand toit de tuiles, plaque. Les deux vantaux, le talisman qui
  // les scelle et la corde sacrée sont animés (live.js) : ils s'ouvrent quand
  // Karasu-Kashi est vaincu.
  temple_gate(b, p, X, Y, env, layer) {
    const R = C.RED;
    // le passage : la lumière du chemin, derrière les vantaux
    for (let y = Y - 92; y < Y - 6; y++) {
      const t = (y - (Y - 92)) / 86;
      b.r(X - 36, y, 72, 1, t < 0.5 ? mixHex('#fff3c8', '#f2e2b0', t * 2) : mixHex('#f2e2b0', C.STONE[4], (t - 0.5) * 2));
    }
    // le seuil de pierre, en deux marches
    b.r(X - 60, Y - 6, 120, 6, C.STONE[2]).r(X - 60, Y - 6, 120, 1, C.STONE[4]).r(X - 52, Y - 9, 104, 3, C.STONE[3]).r(X - 52, Y - 9, 104, 1, C.STONE[5]);
    for (let k = 0; k < 120; k += 13) b.r(X - 60 + k, Y - 5, 1, 5, C.STONE[1]);
    // piliers vermillon, socles de pierre sombre
    for (const px of [X - 51, X + 38]) {
      for (let i = 0; i < 13; i++) {
        const u = i / 12;
        b.r(px + i, Y - 104, 1, 95, u < 0.15 ? R[4] : u < 0.5 ? R[3] : u < 0.82 ? R[2] : R[1]);
      }
      b.r(px - 2, Y - 16, 17, 7, '#2a2420').r(px - 2, Y - 16, 17, 1, C.STONE[1]);
      b.r(px - 1, Y - 108, 15, 4, R[1]);
    }
    // la traverse (nuki) et le linteau
    b.r(X - 62, Y - 100, 124, 6, R[3]).r(X - 62, Y - 100, 124, 1, R[4]).r(X - 62, Y - 95, 124, 1, R[1]);
    b.r(X - 58, Y - 110, 116, 5, R[2]).r(X - 58, Y - 110, 116, 1, R[4]);
    // le grand toit de tuiles grises, bords relevés
    // toit à quatre pans (trapèze) : le faîtage repose sur le haut, sans jour
    const top = Y - 136, h = 26, wb = 76, wt = 34;
    for (let j = 0; j < h; j++) {
      const half = Math.round(wb - ((wb - wt) * j) / (h - 1)) + (j < 3 ? 8 - j * 3 : 0);
      const yy = top + h - 1 - j;
      for (let i = -half; i <= half; i++) {
        const x = X + i;
        let v = 0.5 + ((x % 3) === 0 ? -0.18 : (x % 3) === 1 ? 0.12 : 0) - (i / half) * 0.12;
        if ((yy - top) % 4 === 0) v -= 0.1;
        if (j === 0) v = 0.1;
        b.p(x, yy, pick(C.ROOF, clamp01(v), x, yy));
      }
    }
    // faîtage, bouts relevés
    b.r(X - wt - 4, top - 4, 2 * wt + 8, 4, C.ROOF[1]).r(X - wt - 4, top - 4, 2 * wt + 8, 1, C.ROOF[3]).r(X - wt - 4, top - 1, 2 * wt + 8, 1, C.ROOF[0]);
    for (const sx of [-1, 1]) {
      const ex = X + sx * (wt + 4) - (sx > 0 ? 1 : 0);
      b.r(ex - (sx > 0 ? 0 : 2), top - 7, 3, 4, C.ROOF[1]).r(ex + sx * 2 - (sx > 0 ? 0 : 0), top - 9, 2, 3, C.ROOF[0]);
    }
    for (const dx of [-74, 72]) b.r(X + dx, Y - 114, 3, 3, C.ROOF[0]).r(X + dx + (dx < 0 ? -2 : 2), Y - 117, 2, 3, C.ROOF[1]);
    // la plaque du nom, cerclée d'or
    b.r(X - 9, Y - 128, 18, 14, '#c9a24a').r(X - 8, Y - 127, 16, 12, '#2a2018');
    b.r(X - 2, Y - 125, 3, 2, '#c9a24a').r(X - 4, Y - 121, 7, 1, '#c9a24a').r(X - 1, Y - 119, 2, 2, '#c9a24a');
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
      if (st === 'canopy' && !map.solid(tx, ty + 1)) {
        // feuillage suspendu : des tiges de bambou montent du sol jusqu'à lui (il
        // est porté par ses bambous, il ne flotte pas) ; aux bouts du massif
        const lE = map.styleAt(tx - 1, ty) !== 'canopy', rE = map.styleAt(tx + 1, ty) !== 'canopy';
        if (!lE && !rE) continue;
        let bot = ty + 1; while (bot < map.h && !map.solid(tx, bot)) bot++;
        const y0 = (ty + 1) * TILE - 6, y1 = bot * TILE;
        for (let k = 0; k < 3; k++) {
          const xb = tx * TILE + (lE ? 1 + k * 5 : 12 - k * 5), lean = (lE ? -1 : 1) * (1 + k * 2);
          for (let y = y0; y < y1; y++) {
            const t = (y1 - y) / (y1 - y0), x = Math.round(xb + lean * t * t);
            const node = (y - y0 + k * 5) % 13 === 0;
            b.r(x, y, 3, 1, node ? '#2d401c' : C.BAMBOO[1 + (k % 2)]).p(x, y, node ? C.BAMBOO[4] : C.BAMBOO[3]).p(x + 2, y, C.BAMBOO[0]);
          }
        }
        continue;
      }
      if (st !== 'deck' && st !== 'beam' && st !== 'plank' && st !== 'shelf') continue;
      if (map.solid(tx, ty + 1)) continue;
      const lEnd = map.styleAt(tx - 1, ty) !== st, rEnd = map.styleAt(tx + 1, ty) !== st;
      if (!lEnd && !rEnd && tx % 3) continue;
      let bot = ty + 1; while (bot < map.h && !map.solid(tx, bot) && map.at(tx, bot) !== '~') bot++;
      // une passerelle (« - ») n'a que 6 px d'épaisseur : ses poteaux montent jusque sous ses planches
      const x = tx * TILE + (lEnd ? 2 : rEnd ? 11 : 6), y0 = ty * TILE + (st === 'plank' ? 6 : TILE), y1 = bot * TILE + (map.at(tx, bot) === '~' ? 10 : 0);
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
      const st = map.styleAt(tx, ty);
      if (st !== 'grove' && st !== 'canopy') continue;
      // bas d'un bosquet suspendu (feuillage bas) : des feuilles pendent dans le passage
      if (!map.solid(tx, ty + 1) && ty + 1 < map.h) {
        // quelques feuilles qui pendent, sans redescendre dans le passage (le bas du
        // massif est remonté de ~6 px, voir canopyColor)
        for (let x = tx * TILE; x < tx * TILE + TILE; x++) {
          if (ih(x, ty, 507) < 0.45) continue;
          const len = 1 + Math.floor(ih(x, ty, 505) * 3);
          for (let j = 0; j < len; j++) b.p(x + (j > 1 && ih(x, j, 506) < 0.5 ? 1 : 0), ty * TILE + 9 + j, j === len - 1 ? C.BAMBOO[4] : (x + j) % 3 ? C.BAMBOO[2] : C.BAMBOO[3]);
        }
      }
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
