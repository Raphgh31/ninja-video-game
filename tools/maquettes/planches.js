// Maquettes (planches de comparaison) : le menu de pause et la présentation des skins chez le marchand,
// dessinés avec les outils du jeu (src/game/menuart.js : lanternes, flammes, tablettes, coups de pinceau ;
// police lisse ; les vrais skins). Lancé par tools/maquettes/planches.mjs dans un navigateur (serveur Vite).
import { loadCharacter } from '/src/engine/sprites.js';
import { renderSmooth } from '/src/engine/pixelfont.js';
import { smoothText } from '/src/engine/brushgl.js';
import { canvas, pick, ih, noise1, bayer } from '/src/game/potager/paint.js';
import { Pen, INK, WOOD, stoneLantern, drawFlame, ema, rope, stroke, ground, flat, NinjaArt } from '/src/game/menuart.js';
import { skinOrder, RARITIES } from '/src/game/shop.js';

const W = 448, H = 252, K = 3;
const VERM = '#b8432f', INKD = '#1b120b', GOLD = '#e8c35a', SOFT = '#8f8a7e';
const WASHI = ['#b9ab8c', '#cdbf9f', '#ddd0b2', '#e8dcc0', '#f1e7cf'];
const GILT = ['#6e5222', '#8f6c2c', '#b08a3a', '#c9a24a', '#ddb95e', '#efd07a'];
const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });

function voile(g, a, col = '6,8,14') {
  g.fillStyle = `rgba(${col},${a})`; g.fillRect(0, 0, W, H);
  // une vignette sombre sur les bords (le regard va au centre)
  const p = new Pen(g);
  p.shade(0, 0, W, H, (x, y) => { const d = Math.hypot((x - W / 2) / (W * 0.62), (y - H / 2) / (H * 0.7)); return d > 0.6 ? ['#05070b', Math.min(0.55, (d - 0.6) * 1.4)] : null; });
}

/** Une scène : pix(g, T) peint en pixels de jeu ; T(texte, x, y, opts) pose une écriture lisse par-dessus. */
function scene(bg, pix) {
  const c = canvas(W, H), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (bg) g.drawImage(bg, 0, 0, W, H);
  const texts = [];
  pix(g, (t, x, y, o = {}) => texts.push([t, x, y, o]));
  const big = canvas(W * K, H * K), b = big.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, W * K, H * K);
  b.setTransform(K, 0, 0, K, 0, 0);
  for (const [t, x, y, o] of texts) smoothText(b, renderSmooth, t, x, y, { font: o.font ?? 'small', color: o.color ?? INK, outline: o.outline }, o.align ?? 'left');
  return big.toDataURL('image/png');
}

/** Papier washi (fibres, grain) dans un rectangle. */
function washi(p, x, y, w, h, light = 0) {
  p.shade(x, y, w, h, (px, py) => {
    let v = 0.62 + light + (noise1(px * 0.21 + py * 0.9, 41) - 0.5) * 0.18 + (ih(px, py, 42) - 0.5) * 0.08;
    if (noise1(px * 0.05 + py * 0.37, 43) > 0.86) v -= 0.12;          // une fibre
    const e = Math.min(px - x, x + w - 1 - px, py - y, y + h - 1 - py);
    if (e < 2) v -= 0.2 - e * 0.08;
    return pick(WASHI, v, px, py, 0.3);
  });
}

/** Un sceau vermillon (hanko) carré, avec son signe en réserve. */
function hanko(p, x, y, s = 9) {
  p.shade(x, y, s, s, (px, py) => (ih(px, py, 51) > 0.92 ? null : VERM));
  const m = '#f2e2cf';
  p.r(x + 2, y + 2, s - 4, 1, m); p.r(x + Math.floor(s / 2), y + 2, 1, s - 4, m); p.r(x + 2, y + s - 3, s - 4, 1, m);
  p.r(x + 2, y + Math.floor(s / 2), 2, 1, m); p.r(x + s - 4, y + Math.floor(s / 2), 2, 1, m);
}

// ============================ LA PAUSE ===================================================================

/** A · Le rouleau suspendu (kakemono) : il se déroule depuis le haut, sur le jeu assombri. */
function pauseRouleau(g, T) {
  voile(g, 0.5);
  const p = new Pen(g), cx = W / 2, w = 118, x = cx - w / 2, y0 = 26, y1 = 206;
  // la cordelette et le clou
  p.line(cx - 34, y0 - 1, cx, 6, '#3a2a1c'); p.line(cx + 34, y0 - 1, cx, 6, '#3a2a1c');
  p.r(cx - 1, 4, 3, 3, '#8c7f68'); p.px(cx - 1, 4, '#b0a284');
  // la soie du montage (indigo, un motif discret), puis le papier
  p.shade(x, y0, w, y1 - y0, (px, py) => {
    const v = 0.45 + ((px + py * 2) % 9 === 0 ? 0.25 : 0) + (ih(px, py, 61) - 0.5) * 0.1;
    return pick(['#141a2c', '#1d2540', '#283252', '#36406a'], v, px, py, 0.3);
  });
  washi(p, x + 9, y0 + 14, w - 18, y1 - y0 - 30);
  // les baguettes (haut) et le rouleau (bas, avec ses embouts)
  p.r(x - 3, y0 - 3, w + 6, 4, WOOD[3]); p.r(x - 3, y0 - 3, w + 6, 1, WOOD[5]); p.r(x - 3, y0, w + 6, 1, WOOD[1]);
  p.r(x - 2, y1 - 2, w + 4, 6, WOOD[2]); p.r(x - 2, y1 - 2, w + 4, 1, WOOD[4]); p.r(x - 2, y1 + 3, w + 4, 1, WOOD[0]);
  for (const ex of [x - 7, x + w + 2]) { p.r(ex, y1 - 3, 5, 8, '#2a1c11'); p.r(ex + 1, y1 - 2, 3, 6, '#c9a24a'); p.px(ex + 1, y1 - 2, '#efd07a'); }
  // le contenu, à l'encre
  T('Halte', cx, y0 + 26, { font: 'big', color: INKD, align: 'center' });
  hanko(p, cx + 26, y0 + 30, 9);
  stroke(g, cx, y0 + 58, 64, 1, '#3a2c20', '#7a6a52');
  T('Reprendre', cx, y0 + 76, { color: INKD, align: 'center' });
  stroke(g, cx, y0 + 92, 52, 1, VERM, '#d27a5c');
  T('Menu principal', cx, y0 + 104, { color: '#5a4c3a', align: 'center' });
  // dans le bas du papier, une montagne au lavis (deux encres), comme une signature du paysage
  p.shade(x + 14, y1 - 52, w - 28, 34, (px, py) => {
    const u = (px - x - 14) / (w - 28), peak = y1 - 48 + Math.abs(u - 0.42) * 52 + Math.sin(u * 23) * 1.5, back = y1 - 40 + Math.abs(u - 0.75) * 40;
    if (py >= peak) return ['#3a3026', 0.55 + (py - peak) / 60];
    if (py >= back) return ['#6a5c48', 0.35];
    return null;
  });
}

/** B · La halte : une lanterne de pierre s'allume au sol ; le ninja s'y repose ; les choix dans sa lumière. */
function pauseHalte(art) {
  return (g, T) => {
    voile(g, 0.72, '5,7,14');
    const p = new Pen(g), gy = H - 34;
    ground(p, flat(gy));
    const lan = stoneLantern(p, 200, gy, 2.2);
    drawFlame(g, lan, 1, 1.1, 0.4, 1);
    // des lucioles
    for (let i = 0; i < 9; i++) { const x = 80 + Math.round(ih(i, 1, 71) * 300), y = 60 + Math.round(ih(i, 2, 71) * 120); p.px(x, y, '#d8ff9a'); g.fillStyle = 'rgba(200,255,140,0.18)'; g.fillRect(x - 1, y - 1, 3, 3); }
    T('Halte', 262, 92, { color: SOFT });
    T('Reprendre', 262, 112, { font: 'big', color: '#f3d9a0' });
    stroke(g, 262 + 44, 141, 90, 1, '#f3d9a0', '#b08a5a');
    T('Menu principal', 262, 150, { color: '#9c968a' });
  };
}

/** C · Les tablettes : deux ema suspendues à une corde ; celle qu'on choisit s'éclaire et oscille. */
function pauseTablettes(g, T) {
  voile(g, 0.62);
  const p = new Pen(g);
  const ry = rope(p, 128, 320, 44, 9, H + 4);
  const hang = (cx, w, h, dim, icon) => {
    const top = ry(cx) + 1;
    p.line(cx - 6, top, cx - 2, top + 8, '#7b6d52'); p.line(cx + 6, top, cx + 2, top + 8, '#7b6d52');
    const t = ema(p, cx - w / 2, top + 8, w, h, dim);
    const b = t.body, c = dim ? '#3a2818' : INKD, mx = Math.round(b.x + b.w / 2), my = Math.round(b.y + b.h / 2);
    if (icon === 'play') for (let j = -6; j <= 6; j++) p.r(mx - 4, my + j, Math.round((6 - Math.abs(j)) * 1.3) + 1, 1, c);
    else { for (let j = 0; j < 6; j++) p.r(mx - j - 1, my - 7 + j, 2 * j + 3, 1, c); p.r(mx - 5, my - 1, 11, 7, c); p.r(mx - 1, my + 2, 3, 4, dim ? '#5e4229' : '#9a7244'); }
    return t;
  };
  // la tablette choisie : éclairée par une lueur chaude, un peu plus bas (elle vient d'osciller)
  p.shade(124, 40, 120, 120, (x, y) => { const d = Math.hypot(x - 184, y - 96) / 56; return d < 1 ? ['#f0a848', Math.floor((1 - d) * 4 + bayer(x, y)) / 4 * 0.16] : null; });
  hang(184, 46, 56, false, 'play');
  hang(264, 46, 56, true, 'home');
  T('Reprendre', 184, 154, { color: INK, align: 'center' });
  stroke(g, 184, 170, 56, 1);
  T('Menu principal', 264, 154, { color: '#8a857a', align: 'center' });
  T('Halte', 224, 18, { color: SOFT, align: 'center' });
}

// ============================ LA BOUTIQUE ================================================================

function info(T, sk, x, y, align = 'left', owned = false) {
  const rar = RARITIES[sk.rarity ?? 'origine'] ?? RARITIES.commun;
  T(rar.name, x, y, { color: rar.color, align });
  T(sk.name, x, y + 12, { font: 'big', color: INK, align });
  T(owned ? 'Porter' : `Acheter · ${sk.price} ryō`, x, y + 42, { color: INK, align });
}
function header(T, title = 'Le comptoir du voyageur') {
  T(title, 16, 8, {});
  T('250 ryō', W - 16, 8, { color: GOLD, align: 'right' });
  T('Reprendre la route', W - 16, H - 18, { color: '#9c968a', align: 'right' });
}

/** B · Le tansu : un meuble à alcôves ; chaque skin dans sa niche, celle du milieu éclairée et plus grande. */
function shopTansu(art, ids, sel, skins) {
  return (g, T) => {
    g.fillStyle = 'rgba(6,8,12,0.9)'; g.fillRect(0, 0, W, H);
    const p = new Pen(g), i0 = ids.indexOf(sel);
    const x0 = 58, x1 = W - 58, top = 96, bot = 214;
    // le meuble : bois sombre, encadrements, ferrures
    p.shade(x0, top, x1 - x0, bot - top, (x, y) => pick(WOOD, 0.42 + (noise1(x * 0.06 + Math.floor((y - top) / 5) * 3.1, 7) - 0.5) * 0.3, x, y, 0.3));
    p.r(x0, top, x1 - x0, 2, WOOD[5]); p.r(x0, bot - 2, x1 - x0, 2, WOOD[0]); p.r(x0 - 4, bot, x1 - x0 + 8, 4, WOOD[2]); p.r(x0 - 4, bot, x1 - x0 + 8, 1, WOOD[4]);
    const niches = [[-2, 42], [-1, 46], [0, 74], [1, 46], [2, 42]];
    let x = x0 + 6;
    for (const [d, w] of niches) {
      const big = d === 0, ny = big ? top + 6 : top + 30, nh = bot - 8 - ny;
      p.shade(x, ny, w, nh, (px, py) => pick(['#07090c', '#0c0f14', '#131820'], 0.35 + (py - ny) / nh * 0.4, px, py, 0.4));
      p.r(x - 1, ny - 1, w + 2, 1, WOOD[4]); p.r(x - 1, ny, 1, nh, WOOD[1]); p.r(x + w, ny, 1, nh, WOOD[4]);
      for (const fx of [x - 2, x + w - 1]) { p.r(fx, ny + nh - 6, 3, 3, '#8a6a34'); p.px(fx, ny + nh - 6, '#c9a24a'); }   // ferrures
      const id = ids[(i0 + d + ids.length) % ids.length];
      if (big) {
        // une lumière tombe du haut de la niche, sur le skin choisi
        p.shade(x, ny, w, nh, (px, py) => { const u = Math.abs(px - (x + w / 2)) / (w / 2 * (0.4 + (py - ny) / nh * 0.6)); return u < 1 ? ['#f0b060', (1 - u) * 0.16] : null; });
        art.draw(g, id, x + w / 2, ny + nh - 2, { k: 2, t: 0.2, tint: null });
      } else art.draw(g, id, x + w / 2, ny + nh - 2, { k: 1, t: 0.6 + d, tint: 'rgba(6,8,14,0.5)' });
      if (!big) T(skins[id].price ? `${skins[id].price}` : '—', x + w / 2, ny + nh + 1, { color: '#7c7668', align: 'center' });
      x += w + 6;
    }
    T('‹', x0 - 16, 140, { font: 'big', color: '#8a857a' }); T('›', x1 + 8, 140, { font: 'big', color: '#8a857a' });
    header(T);
    info(T, skins[sel], W / 2, 28, 'center');
    stroke(g, W / 2, 85, 92, 1);
  };
}

/** C · Le sentier : la nuit de l'intro ; les skins attendent sur un sentier, chacun près d'une lanterne ; on avance de l'un à l'autre. */
function shopSentier(art, ids, sel, skins, far) {
  return (g, T) => {
    const p = new Pen(g);
    p.shade(0, 0, W, H, (x, y) => pick(['#04060c', '#060a14', '#0a101f', '#0f182b', '#15203a'], y / (H * 0.7), x, y, 0.6));
    for (let i = 0; i < 70; i++) p.px(Math.floor(ih(i, 1, 81) * W), Math.floor(ih(i, 2, 81) * 120), i % 7 ? '#3e4a66' : '#a7b2c8');
    // la lune et les montagnes (celles de l'intro, en encre de nuit)
    p.shade(W - 98, 18, 30, 30, (x, y) => (Math.hypot(x - (W - 83), y - 33) < 13 ? pick(['#8d93a6', '#b5b8c4', '#d7d6cf', '#ece8da'], 0.8 - Math.hypot(x - (W - 83), y - 33) / 30, x, y, 0.5) : null));
    if (far) {
      const m = canvas(far.width, far.height), mg = m.getContext('2d'); mg.drawImage(far, 0, 0);
      mg.globalCompositeOperation = 'source-atop'; mg.fillStyle = 'rgba(14,22,40,0.82)'; mg.fillRect(0, 0, m.width, m.height);
      g.drawImage(m, 380, 0, W, far.height, 0, H - 96 - far.height + 40, W, far.height);
    }
    const gy = (x) => Math.round(H - 40 - Math.sin((x / W) * Math.PI) * 10);
    ground(p, gy);
    const i0 = ids.indexOf(sel);
    for (const d of [-2, -1, 1, 2, 0]) {
      const cx = W / 2 + d * 92, id = ids[(i0 + d + ids.length) % ids.length], near = d === 0;
      const lan = stoneLantern(p, cx - (near ? 30 : 18), gy(cx), near ? 1.3 : 0.9);
      drawFlame(g, lan, near ? 1 : 0.18, near ? 1 : 0.4, 0.5, d + 3);
      art.draw(g, id, cx + 4, gy(cx) + 1, { k: near ? 2 : 1, t: 0.5 + d, tint: near ? 'rgba(40,24,8,0.12)' : 'rgba(6,8,14,0.55)' });
      if (!near) T(skins[id].price ? `${skins[id].price} ryō` : 'trophée', cx + 4, gy(cx) + 6, { color: '#6e6a62', align: 'center' });
    }
    header(T);
    info(T, skins[sel], W / 2, 34, 'center');
    stroke(g, W / 2, 91, 92, 1);
  };
}

/** D · Le rouleau des apparences : à gauche le ninja en grand ; à droite, tous les skins en médaillons sur un rouleau. */
function shopRouleau(art, ids, sel, skins) {
  return (g, T) => {
    g.fillStyle = 'rgba(6,8,12,0.9)'; g.fillRect(0, 0, W, H);
    const p = new Pen(g);
    // le ninja choisi, sur un socle de pierre, sous une lueur
    p.shade(30, 60, 140, 150, (x, y) => { const d = Math.hypot((x - 100) / 70, (y - 150) / 80); return d < 1 ? ['#f0a848', (1 - d) * 0.12] : null; });
    p.r(64, 196, 72, 5, '#2e3a4e'); p.r(64, 196, 72, 1, '#43536c'); p.r(60, 201, 80, 3, '#212a38');
    art.draw(g, sel, 100, 196, { k: 3, t: 0.2, tint: null });
    // le rouleau
    const x = 214, y = 30, w = 214, h = 176;
    p.r(x - 4, y - 4, w + 8, 4, WOOD[3]); p.r(x - 4, y - 4, w + 8, 1, WOOD[5]);
    washi(p, x, y, w, h);
    p.r(x - 3, y + h, w + 6, 5, WOOD[2]); p.r(x - 3, y + h, w + 6, 1, WOOD[4]);
    const cols = 5, cell = 38, gx = x + 12, gy0 = y + 10;
    ids.forEach((id, i) => {
      const c = i % cols, r = Math.floor(i / cols), mx = gx + c * cell + 16, my = gy0 + r * 46 + 16;
      const on = id === sel;
      // le médaillon : un disque de papier plus sombre, cerclé d'encre (vermillon pour le choix)
      p.shade(mx - 15, my - 15, 31, 31, (px, py) => { const d = Math.hypot(px - mx, py - my); return d > 15 ? null : d > 13.4 ? (on ? VERM : '#6a5a44') : pick(WASHI, on ? 0.45 : 0.3, px, py, 0.3); });
      // le haut du ninja, dans le médaillon (recadré)
      const tmp = canvas(32, 30), tg = tmp.getContext('2d');
      art.draw(tg, id, 16, 40, { k: 1, t: 0.4, tint: null });
      tg.globalCompositeOperation = 'destination-in'; tg.beginPath(); tg.arc(16, 15, 13, 0, 7); tg.fill();
      g.drawImage(tmp, mx - 16, my - 15);
      const s = skins[id];
      T(s.reward ? 'trophée' : s.price ? `${s.price}` : 'porté', mx, my + 17, { color: on ? '#7a2a1c' : '#6a5a44', align: 'center' });
    });
    header(T);
    info(T, skins[sel], 24, 24);
  };
}

/** E · Le paravent : un paravent à feuille d'or, trois volets ; le skin choisi peint sur celui du milieu. */
function shopParavent(art, ids, sel, skins) {
  return (g, T) => {
    g.fillStyle = 'rgba(6,8,12,0.9)'; g.fillRect(0, 0, W, H);
    const p = new Pen(g), i0 = ids.indexOf(sel), top = 34, bot = 176;
    const panels = [[66, 96, -1], [162, 124, 0], [286, 96, 1]];
    for (const [x, w, d] of panels) {
      const mid = d === 0;
      // la feuille d'or, des nuages stylisés (bandes), un pli éclairé d'un côté
      p.shade(x, top, w, bot - top, (px, py) => {
        let v = 0.55 + (ih(px >> 2, py >> 2, 91) - 0.5) * 0.12 + (mid ? 0.1 : -0.12);
        const band = Math.sin((px - x) * 0.09 + (py - top) * 0.02 + d) * 6;
        if (Math.abs(py - (top + 30 + band)) < 4 || Math.abs(py - (bot - 34 - band)) < 3) v += 0.18;
        v += (d < 0 ? -1 : d > 0 ? 1 : 0) * ((px - x) / w - 0.5) * 0.25;
        return pick(GILT, v, px, py, 0.35);
      });
      p.r(x - 2, top - 3, w + 4, 3, '#1a0f08'); p.r(x - 2, bot, w + 4, 3, '#1a0f08'); p.r(x - 2, top, 2, bot - top, '#2a180c'); p.r(x + w, top, 2, bot - top, '#2a180c');
      // le sol peint sur l'or, et le skin
      p.r(x + 8, bot - 18, w - 16, 1, '#8f6c2c');
      const id = ids[(i0 + d + ids.length) % ids.length];
      art.draw(g, id, x + w / 2, bot - 18, { k: mid ? 3 : 2, t: 0.3 + d, tint: mid ? null : 'rgba(40,24,8,0.35)' });
    }
    header(T);
    info(T, skins[sel], W / 2, bot + 8, 'center');
    stroke(g, W / 2, bot + 64, 92, 1);
    T('‹', 40, 96, { font: 'big', color: '#8a857a' }); T('›', W - 50, 96, { font: 'big', color: '#8a857a' });
  };
}

window.__planches = async () => {
  const { meta, skins } = await loadCharacter('/assets/characters/kage', 'kage.json');
  const art = new NinjaArt(meta, skins);
  const ids = skinOrder(skins), sel = ids.includes('samourai') ? 'samourai' : ids[3];
  const [fondF, fondP, far] = await Promise.all(['/tools/maquettes/fond_foret.png', '/tools/maquettes/fond_potager.png', '/assets/loading/montagnes_loin.png'].map(load));
  return {
    pauseA: scene(fondF, pauseRouleau),
    pauseB: scene(fondF, pauseHalte(art)),
    pauseC: scene(fondF, pauseTablettes),
    shopB: scene(fondP, shopTansu(art, ids, sel, skins)),
    shopC: scene(null, shopSentier(art, ids, sel, skins, far)),
    shopD: scene(fondP, shopRouleau(art, ids, sel, skins)),
    shopE: scene(fondP, shopParavent(art, ids, sel, skins)),
  };
};
