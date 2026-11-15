// Mode combat : le dessin de l'arène du Potager (la rizière du gong), dans le
// style du chapitre (palette du Potager, lumière du haut à gauche, contours
// sombres sans noir pur). Les pièces fixes sont peintes une fois ; ce qui bouge
// (corde, balles de riz, gong, vannes, vague, foin, bonus) est dessiné à chaque image.
import { canvas, Brush, pick, noise2, ih } from '../potager/paint.js';
import * as C from '../potager/palette.js';
import { paintProp } from '../potager/props.js';
import { ARENA } from './arena.js';

const TILE = 16;
const R = Math.round;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const OUT = '#2a1d14';           // contour chaud (jamais de noir pur)
const ROPE = ['#3b2a1c', '#8a6a40', '#c9a46c'];

// ---------------------------------------------------------------------------
// sprites peints une fois
// ---------------------------------------------------------------------------

/** Un tawara : balle de riz en paille, couchée, liée de trois cordes, couvercle tressé au bout. */
function tawara(b, x, y, w, h, seed, capRight) {
  for (let j = 0; j < h; j++) {
    // section ronde : plus sombre en bas, reflet en haut
    const t = j / (h - 1), round = Math.sin(t * Math.PI);
    const inset = j === 0 || j === h - 1 ? 2 : j === 1 || j === h - 2 ? 1 : 0;
    for (let i = inset; i < w - inset; i++) {
      let v = 0.25 + round * 0.55 - t * 0.2 + (noise2((x + i) * 0.9, (y + j) * 0.35, seed) - 0.5) * 0.35;
      if ((i + j * 3) % 5 === 0) v -= 0.08;                         // brins de paille
      b.p(x + i, y + j, pick(C.STRAW, clamp01(v), x + i, y + j));
    }
  }
  // contour
  for (let i = 2; i < w - 2; i++) { b.p(x + i, y, OUT); b.p(x + i, y + h - 1, OUT); }
  for (let j = 2; j < h - 2; j++) { b.p(x, y + j, OUT); b.p(x + w - 1, y + j, OUT); }
  b.p(x + 1, y + 1, OUT).p(x + w - 2, y + 1, OUT).p(x + 1, y + h - 2, OUT).p(x + w - 2, y + h - 2, OUT);
  // trois liens de corde
  for (const k of [0.24, 0.5, 0.76]) {
    const lx = x + R(w * k);
    for (let j = 1; j < h - 1; j++) b.p(lx, y + j, j % 3 === 0 ? ROPE[2] : ROPE[0]);
  }
  // couvercle tressé (sandawara) : une rosace au bout de la balle
  const cx = capRight ? x + w - 3 : x + 2, cy = y + h / 2;
  for (let j = -3; j <= 3; j++) for (let i = -1; i <= 1; i++) {
    const v = 0.35 + (Math.abs(j) % 2) * 0.25 - Math.abs(j) * 0.04;
    b.p(cx + i, R(cy + j - 0.5), pick(C.THATCH, clamp01(v), cx + i, j));
  }
  b.p(cx, R(cy - 0.5), C.THATCH[0]);
}

/** Les quatre balles de la grue (2 × 2 cases), dans leur filet de corde. */
function bundleSprite() {
  const c = canvas(32, 32), b = new Brush(c.getContext('2d'));
  tawara(b, 0, 18, 16, 14, 3, false);
  tawara(b, 16, 18, 16, 14, 7, true);
  tawara(b, 1, 5, 15, 13, 11, false);
  tawara(b, 16, 5, 15, 13, 13, true);
  // filet : mailles losangées par-dessus
  for (let y = 4; y < 31; y += 5) for (let x = (y % 10 ? 2 : 4); x < 31; x += 6) {
    b.p(x, y, ROPE[1]);
    if (x + 1 < 32) b.p(x + 1, y + 1, ROPE[0]);
  }
  // cordes du filet qui remontent vers le joug
  for (let i = 0; i < 5; i++) { b.p(4 + i, 4 - Math.min(4, i), ROPE[1]); b.p(27 - i, 4 - Math.min(4, i), ROPE[1]); }
  return c;
}

/** Botte de foin tremplin (deux cases), peinte comme celles du chapitre. */
function haySprite(w) {
  const c = canvas(w * TILE + 12, TILE + 6), g = c.getContext('2d');
  g.translate(6 - 0, TILE + 2);
  paintProp(new Brush(g), { type: 'hay_stack', x: 0, y: 0, cols: Array(w).fill(1), step: true }, {}, 'ground');
  // la corde de cerclage plus marquée : on la lit comme un objet souple
  return c;
}

/** Le bâti du gong : deux poteaux laqués, linteau aux bouts relevés (comme un petit torii). */
function gongFrame() {
  const c = canvas(40, 52), b = new Brush(c.getContext('2d'));
  const RED = C.RED;
  // poteaux
  for (const px of [5, 32]) {
    b.r(px, 8, 3, 44, RED[2]).r(px, 8, 1, 44, RED[4]).r(px + 2, 8, 1, 44, RED[0]);
    b.r(px - 1, 48, 5, 4, C.STONE[2]).r(px - 1, 48, 5, 1, C.STONE[4]);           // socle de pierre
  }
  // linteau (kasagi) : noir laqué, bouts relevés
  b.r(1, 3, 38, 3, '#2c262a').r(1, 3, 38, 1, '#57505a');
  b.p(0, 2, '#2c262a').p(39, 2, '#2c262a').p(0, 1, '#2c262a').p(39, 1, '#2c262a');
  b.r(3, 6, 34, 2, RED[2]).r(3, 6, 34, 1, RED[4]);                             // second linteau
  b.r(18, 6, 4, 4, RED[1]);                                                     // plaque centrale
  // corde tressée qui tient le disque
  return c;
}

/** Disque du gong (bronze), rayon 11, prêt (clair) ou au repos (terni). */
function gongDisc(dim) {
  const c = canvas(26, 26), b = new Brush(c.getContext('2d'));
  const BR = dim ? ['#3e2f1c', '#5a4428', '#76593a', '#8f7148', '#a8875a'] : ['#4a3418', '#6f4f22', '#9a7034', '#c0924a', '#e5c27a'];
  for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) {
    const d = Math.hypot(x, y);
    if (d > 11.3) continue;
    let v = 0.55 - (x + y) * 0.022;
    if (d > 9.6) v -= 0.25;                     // rebord
    if (d < 9.6 && d > 8.4) v += 0.12;           // filet en relief
    if (d < 3.4) v += 0.18;                      // bossette centrale
    if (d < 2) v -= 0.1;
    b.p(13 + x, 13 + y, pick(BR, clamp01(v), x, y));
  }
  for (let a = 0; a < 6.28; a += 0.05) b.p(R(13 + Math.cos(a) * 11.4), R(13 + Math.sin(a) * 11.4), OUT);
  if (!dim) { b.p(9, 8, '#fff2c4').p(10, 8, '#f6dc94').p(9, 9, '#f6dc94'); }
  return c;
}

/** Vanne : cadre de pierre sèche, au pied du bosquet ; la planche est dessinée à part. */
function sluiceFrame(dir) {
  const c = canvas(20, 22), b = new Brush(c.getContext('2d'));
  const S = C.STONE;
  const stone = (x, y, w, h, seed) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = 0.55 - j / h * 0.25 - i / w * 0.1 + (noise2(x + i, y + j, seed) - 0.5) * 0.3;
      if (i === 0 || j === 0) v += 0.15;
      if (i === w - 1 || j === h - 1) v -= 0.25;
      b.p(x + i, y + j, pick(S, clamp01(v), x + i, y + j));
    }
  };
  stone(0, 4, 5, 18, 1);  stone(15, 4, 5, 18, 2);       // jambages
  stone(0, 0, 20, 5, 3);                               // linteau
  b.r(5, 5, 10, 17, '#1d2a2e');                        // l'ombre du conduit
  b.r(5, 5, 10, 1, '#13191c');
  // mousse au pied, côté canal
  for (let i = 0; i < 6; i++) b.p(dir > 0 ? 15 + i % 5 : i % 5, 21 - (i % 2), C.MOSS[1 + (i % 3)]);
  return c;
}

/** Cœur : laque vermillon cerclée d'encre, reflet en coup de pinceau, nœud d'or et ses deux brins (comme un charme de sanctuaire). */
function heartSprite(glint) {
  const c = canvas(17, 19), b = new Brush(c.getContext('2d'));
  const M = [
    '..xxxx...xxxx..',
    '.xRRRRx.xRRRRx.',
    'xRHHRRRxRRRRRRx',
    'xRHRRRRRRRRRRRx',
    'xRHRRRRRRRRRRdx',
    'xRRRRRRRRRRRRdx',
    '.xRRRRRRRRRRdx.',
    '..xRRRRRRRRdx..',
    '...xRRRRRRdx...',
    '....xRRRRdx....',
    '.....xRRdx.....',
    '......xdx......',
    '.......x.......',
  ];
  const col = { x: '#3a1218', R: '#d23c3c', H: '#ff9a8a', d: '#8e2128' };
  M.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) b.p(x + 1, y + 5, col[ch]); }));
  if (glint) b.p(3, 8, '#fff4ec').p(3, 9, '#ffd8cc').p(4, 7, '#ffd8cc');
  // nœud d'or au creux du cœur, deux brins qui retombent sur ses lobes
  b.r(7, 4, 3, 3, '#e8b93c').p(8, 4, '#fbe39a').p(7, 6, '#a9781e').p(9, 6, '#a9781e');
  b.p(6, 3, '#e8b93c').p(5, 2, '#e8b93c').p(10, 3, '#e8b93c').p(11, 2, '#e8b93c').p(6, 2, '#fbe39a');
  b.p(6, 7, '#c9952e').p(10, 7, '#c9952e');
  return c;
}

/** Paquet de trois shurikens, posé sur un petit linge rouge plié et noué. */
function bundleOfStars() {
  const c = canvas(19, 14), b = new Brush(c.getContext('2d'));
  // le linge (furoshiki) : un losange de tissu rouge, ourlé
  const RED = C.RED;
  for (let y = 0; y < 5; y++) { const w = 15 - y * 2; b.r(9 - (w >> 1), 9 + y, w, 1, y === 0 ? RED[3] : RED[2]); }
  b.r(2, 9, 15, 1, RED[4]).p(9, 13, RED[1]).p(8, 12, RED[1]).p(10, 12, RED[1]);
  const star = (cx, cy) => {
    b.p(cx, cy - 4, '#e6e9ee').p(cx, cy - 3, '#c9ced6').p(cx - 4, cy, '#e6e9ee').p(cx - 3, cy, '#c9ced6');
    b.p(cx + 4, cy, '#6d737e').p(cx + 3, cy, '#9aa1ac').p(cx, cy + 4, '#6d737e').p(cx, cy + 3, '#9aa1ac');
    b.r(cx - 2, cy - 2, 5, 5, '#5d636e').r(cx - 1, cy - 1, 3, 3, '#7a808c').p(cx, cy, '#2a2d33').p(cx - 1, cy - 1, '#f4f6f8');
    b.p(cx - 2, cy - 2, '#2f333b').p(cx + 2, cy + 2, '#2f333b').p(cx + 2, cy - 2, '#2f333b').p(cx - 2, cy + 2, '#2f333b');
  };
  star(5, 7); star(13, 7); star(9, 4);
  // le cordon qui les tient
  b.r(3, 8, 13, 1, RED[1]).p(9, 9, RED[3]).p(8, 10, RED[1]).p(10, 10, RED[1]);
  return c;
}

// ---------------------------------------------------------------------------

export class ArenaArt {
  constructor(level) {
    this.level = level;
    this.a = level.arena;
    this.bundle = bundleSprite();
    this.frame = gongFrame();
    this.disc = [gongDisc(false), gongDisc(true)];
    this.sluice = [sluiceFrame(1), sluiceFrame(-1)];
    this.hay = this.a.hay.map((h) => ({ h, img: haySprite(h.w) }));
    this.heart = [heartSprite(false), heartSprite(true)];
    this.stars = bundleOfStars();
  }

  // ---- derrière les personnages -------------------------------------------------
  drawBack(ctx, cam, time) {
    const ox = -R(cam.x), oy = -R(cam.y);
    this.drawCanal(ctx, ox, oy, time);
    this.drawDecks(ctx, ox, oy);
    this.drawRack(ctx, ox, oy, time);
    this.drawStall(ctx, ox, oy, time);
    this.drawCrane(ctx, ox, oy, time);
    this.drawGong(ctx, ox, oy, time);
    for (const k of [0, 1]) this.drawSluice(ctx, ox, oy, time, k);
    for (const { h, img } of this.hay) {
      const sq = h.squash, x = h.x0 * TILE + ox - 6, base = (h.row + 1) * TILE + oy + 2;
      const k = 1 - 0.32 * Math.sin(sq * Math.PI) * sq, w = img.width * (1 + (1 - k) * 0.5);
      ctx.drawImage(img, R(x - (w - img.width) / 2), R(base - img.height * k), R(w), R(img.height * k));
    }
    this.drawCrates(ctx, ox, oy);
    this.drawPickups(ctx, ox, oy, time);
  }

  // ---- devant (l'eau de la vague passe sur les pieds) -------------------------
  drawFront(ctx, cam, time) {
    const ox = -R(cam.x), oy = -R(cam.y);
    for (const w of this.a.waves) this.drawWave(ctx, ox, oy, time, w);
  }

  // ---- le canal d'irrigation : murs de pierre sèche, eau courante, passerelle sur pilotis ----
  drawCanal(ctx, ox, oy, time) {
    const [c0, c1] = this.a.def.canal, ground = this.a.def.ground, lv = this.level;
    if (!this.canalImg) {
      // le mur du fond et les deux parois, peints une fois
      const w = c1 - c0, h = lv.height - ground;
      const cv = canvas(w, h), b = new Brush(cv.getContext('2d'));
      const S = C.STONE;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const row = Math.floor(y / 6), off = row % 2 ? 5 : 0, col = Math.floor((x + off) / 10);
        const jx = (x + off) % 10 === 0, jy = y % 6 === 0;
        let v = 0.32 + (noise2(col * 3.1, row * 2.7, 9) - 0.5) * 0.35 - y / h * 0.25 + (noise2(x * 0.8, y * 0.8, 4) - 0.5) * 0.12;
        if (jx || jy) v = 0.02;
        b.p(x, y, pick(S, clamp01(v), x, y));
      }
      // mousse au bord, coulures sombres au-dessus de l'eau
      for (let x = 0; x < w; x++) {
        const m = 1 + (ih(x, 1, 7) * 3 | 0);
        for (let j = 0; j < m; j++) b.p(x, j, C.MOSS[1 + ((x + j) % 3)]);
        if (ih(x, 2, 8) < 0.18) for (let j = 4; j < 10 + ih(x, 3, 8) * 6; j++) b.p(x, j, '#3a3a2e');
      }
      this.canalImg = cv;
    }
    const x = c0 + ox, gy = ground + oy;
    ctx.drawImage(this.canalImg, x, gy);
    // l'eau : nappe sombre, reflets du ciel qui ondulent, courant qui file vers l'aval
    const wy = gy + 16, W = C.WATER, w = c1 - c0, bottom = lv.height + oy;
    ctx.fillStyle = W[1]; ctx.fillRect(x, wy, w, bottom - wy);
    ctx.fillStyle = W[0]; ctx.fillRect(x, wy + 6, w, bottom - wy - 6);
    ctx.fillStyle = W[3]; ctx.fillRect(x, wy, w, 1);
    for (let i = 0; i < w; i++) {
      const k = Math.sin(i * 0.45 + time * 2.2) + Math.sin(i * 0.13 - time * 1.3);
      if (k > 1.1) { ctx.fillStyle = W[4]; ctx.fillRect(x + i, wy + 1, 1, 1); }
      if (k < -1.3) { ctx.fillStyle = W[2]; ctx.fillRect(x + i, wy + 3, 1, 1); }
      if ((i * 7 + R(time * 18)) % 23 === 0) { ctx.fillStyle = W[3]; ctx.fillRect(x + i, wy + 4 + (i % 3), 3, 1); }
    }
    // reflets des parois
    ctx.fillStyle = 'rgba(20, 40, 50, 0.35)'; ctx.fillRect(x, wy + 1, 3, bottom - wy); ctx.fillRect(x + w - 3, wy + 1, 3, bottom - wy);
    // la passerelle : deux pilotis de bois plantés dans l'eau, et leurs remous
    for (let tx = 0; tx < lv.w; tx++) {
      if (lv.at(tx, ground / TILE) !== '-') continue;
      const px = tx * TILE + ox + (lv.at(tx - 1, ground / TILE) !== '-' ? 3 : 10);
      ctx.fillStyle = C.WOOD[1]; ctx.fillRect(px, gy + 5, 3, bottom - gy);
      ctx.fillStyle = C.WOOD[3]; ctx.fillRect(px, gy + 5, 1, wy - gy - 5);
      ctx.fillStyle = W[5]; ctx.fillRect(px - 1 + R(Math.sin(time * 3 + tx)), wy, 5, 1);
    }
    // ses planches (repeintes par-dessus le mur du canal), ficelées
    for (let tx = 0; tx < lv.w; tx++) {
      if (lv.at(tx, ground / TILE) !== '-') continue;
      const px = tx * TILE + ox, lE = lv.at(tx - 1, ground / TILE) !== '-', rE = lv.at(tx + 1, ground / TILE) !== '-';
      for (let i = 0; i < 16; i += 4) {
        const dy = (i / 4 + tx) % 2;
        ctx.fillStyle = C.WOOD[4]; ctx.fillRect(px + i, gy + dy, 3, 1);
        ctx.fillStyle = C.WOOD[3]; ctx.fillRect(px + i, gy + 1 + dy, 3, 3);
        ctx.fillStyle = C.WOOD[1]; ctx.fillRect(px + i, gy + 4 + dy, 3, 1);
      }
      ctx.fillStyle = C.WOOD[1]; ctx.fillRect(px + (lE ? 1 : 0), gy + 3, 16 - (lE ? 1 : 0) - (rE ? 1 : 0), 2);   // longeron
      ctx.fillStyle = OUT; ctx.fillRect(px + 7, gy + 1, 2, 3);
    }
  }

  // ---- supports : la plateforme du treuil (en porte-à-faux sur le bosquet), celle du gong ----
  drawDecks(ctx, ox, oy) {
    const d = this.a.def, B = C.BAMBOO, W = C.WOOD, ground = d.ground + oy;
    if (d.deck) {
      // deux jambes de force en bambou, ligaturées au bosquet, sous les planches
      const x0 = d.deck.x0 * TILE + ox, x1 = (d.deck.x1 + 1) * TILE + ox, y = d.deck.row * TILE + oy + 5;
      for (const [xa, ya, xb] of [[x0, y + 26, x1 - 6], [x0, y + 14, x0 + 22]]) {
        const n = Math.max(xb - xa, 1);
        for (let i = 0; i <= n; i++) {
          const yy = R(ya + (y - ya) * (i / n));
          ctx.fillStyle = B[2]; ctx.fillRect(xa + i, yy, 1, 3);
          ctx.fillStyle = B[4]; ctx.fillRect(xa + i, yy, 1, 1);
          ctx.fillStyle = B[0]; ctx.fillRect(xa + i, yy + 2, 1, 1);
        }
        ctx.fillStyle = OUT; ctx.fillRect(xa - 1, ya - 1, 3, 4); ctx.fillRect(xb - 1, y - 1, 3, 3);
      }
      ctx.fillStyle = B[1]; ctx.fillRect(x0, y, x1 - x0, 2);                 // longeron de bambou sous les planches
    }
    if (d.gongDeck) {
      const x0 = d.gongDeck.x0 * TILE + ox, x1 = (d.gongDeck.x1 + 1) * TILE + ox, y = (d.gongDeck.row + 1) * TILE + oy;
      for (const px of [x0 + 3, x1 - 7]) {
        ctx.fillStyle = W[2]; ctx.fillRect(px, y, 4, ground - y);
        ctx.fillStyle = W[4]; ctx.fillRect(px, y, 1, ground - y);
        ctx.fillStyle = W[0]; ctx.fillRect(px + 3, y, 1, ground - y);
        ctx.fillStyle = C.STONE[2]; ctx.fillRect(px - 1, ground - 3, 6, 3);
        ctx.fillStyle = C.STONE[4]; ctx.fillRect(px - 1, ground - 3, 6, 1);
      }
      // croisillons de corde et traverse
      ctx.fillStyle = W[1]; ctx.fillRect(x0 + 3, y + 40, x1 - x0 - 6, 3);
      ctx.fillStyle = W[3]; ctx.fillRect(x0 + 3, y + 40, x1 - x0 - 6, 1);
      ctx.fillStyle = '#6a5038';
      const w = x1 - x0 - 14;
      for (let i = 0; i < w; i += 2) { ctx.fillRect(x0 + 7 + i, y + 3 + R(i * 36 / w), 1, 1); ctx.fillRect(x1 - 8 - i, y + 3 + R(i * 36 / w), 1, 1); }
      for (let i = 0; i < w; i += 2) { ctx.fillRect(x0 + 7 + i, y + 46 + R(i * 70 / w), 1, 1); ctx.fillRect(x1 - 8 - i, y + 46 + R(i * 70 / w), 1, 1); }
    }
  }

  // ---- les perches de séchage du riz (hasa), au-dessus du canal -----------------
  drawRack(ctx, ox, oy, time) {
    const lv = this.level;
    // la grande perche : de part et d'autre du canal, deux poteaux et la traverse
    const { x0, x1, row } = this.a.def.rack;
    const top = row * TILE + oy, ground = this.a.def.ground + oy;
    const B = C.BAMBOO;
    const pole = (x) => {
      ctx.fillStyle = B[1]; ctx.fillRect(x, top - 10, 4, ground - top + 10);
      ctx.fillStyle = B[3]; ctx.fillRect(x, top - 10, 1, ground - top + 10);
      ctx.fillStyle = B[0]; ctx.fillRect(x + 3, top - 10, 1, ground - top + 10);
      for (let y = top - 4; y < ground; y += 15) { ctx.fillStyle = B[0]; ctx.fillRect(x, y, 4, 1); ctx.fillStyle = B[4]; ctx.fillRect(x, y + 1, 4, 1); }
      // jambes de force en X jusqu'au sol
      ctx.fillStyle = '#5b4a36';
      ctx.fillRect(x + 1, top - 12, 2, 2);
    };
    const L = x0 * TILE + ox + 2, Rr = (x1 + 1) * TILE + ox - 6;
    // traverse basse, où sèchent les gerbes de riz (derrière le passage)
    const low = top + 26;
    ctx.fillStyle = B[2]; ctx.fillRect(L, low, Rr - L + 4, 3);
    ctx.fillStyle = B[4]; ctx.fillRect(L, low, Rr - L + 4, 1);
    // gerbes de riz à cheval sur la perche : tailles, inclinaisons et teintes variées,
    // serrées par endroits, plus clairsemées ailleurs (on les a mises à sécher à la main)
    for (let x = L + 5, i = 0; x < Rr - 3; i++) {
      const n = ih(i, 3, 5), wide = n < 0.3 ? 3 : 4, h = 8 + R(ih(i, 4, 5) * 7);
      const sway = Math.sin(time * 1.3 + i * 0.9) * (0.4 + n * 0.5), lean = (ih(i, 6, 5) - 0.5) * 3;
      const ramp = n < 0.15 ? C.THATCH : C.STRAW, tip = n > 0.8 ? '#b8892c' : '#c9a03a';
      ctx.fillStyle = ramp[1]; ctx.fillRect(x, low - 2, wide, 2);                         // le pli sur la perche
      for (let j = 0; j < h; j++) {
        const k = j / h, dx = R((lean + sway) * k * k);
        ctx.fillStyle = ramp[2]; ctx.fillRect(x + dx, low + 3 + j, wide, 1);
        ctx.fillStyle = ramp[3]; ctx.fillRect(x + dx, low + 3 + j, 1, 1);
        ctx.fillStyle = ramp[0]; ctx.fillRect(x + dx + wide - 1, low + 3 + j, 1, 1);
      }
      const ex = x + R(lean + sway);
      ctx.fillStyle = tip; ctx.fillRect(ex - (wide > 3 ? 1 : 0), low + 2 + h, wide + 1, 2);   // les épis, plus lourds
      ctx.fillStyle = '#e8c35a'; ctx.fillRect(ex, low + 2 + h, 1, 1);
      if (n > 0.55) { ctx.fillStyle = tip; ctx.fillRect(ex + wide, low + 1 + h, 1, 2); }
      ctx.fillStyle = ROPE[0]; ctx.fillRect(x, low + 3, wide, 1);                           // lien
      x += wide + 1 + (ih(i, 7, 5) < 0.25 ? 3 : 0);
    }
    pole(L - 2); pole(Rr);
    // haubans de corde vers le sol, de chaque côté
    ctx.fillStyle = '#5b4a36';
    for (let i = 0; i < 30; i++) { ctx.fillRect(L - 4 - i, top - 4 + i * 4, 1, 1); ctx.fillRect(Rr + 6 + i, top - 4 + i * 4, 1, 1); }
  }

  // ---- l'étal du marché : poteaux, auvent de toile ----------------------------------
  drawStall(ctx, ox, oy, time) {
    const lv = this.level, g = this.a.def.ground / TILE;
    let x0 = Infinity, x1 = -Infinity;
    for (let x = 0; x < lv.w; x++) if (lv.at(x, g - 2) === '=') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x0 === Infinity) return;
    const roofB = (g - 1) * TILE + oy, ground = g * TILE + oy, L = x0 * TILE + ox, Rr = (x1 + 1) * TILE + ox;
    const W = C.WOOD;
    for (const px of [L + 1, Rr - 4]) {
      ctx.fillStyle = W[1]; ctx.fillRect(px, roofB, 3, ground - roofB);
      ctx.fillStyle = W[3]; ctx.fillRect(px, roofB, 1, ground - roofB);
    }
    // noren : bandes de toile indigo sous le bord du toit (on passe dessous en glissade)
    for (let x = L + 5, i = 0; x < Rr - 5; x += 7, i++) {
      const sway = R(Math.sin(time * 2 + i) * 0.5);
      ctx.fillStyle = C.CLOTH[1]; ctx.fillRect(x + sway, roofB, 6, 4);
      ctx.fillStyle = C.CLOTH[2]; ctx.fillRect(x + sway, roofB, 6, 1);
      ctx.fillStyle = C.PAPER[2]; if (i === 1) ctx.fillRect(x + 2 + sway, roofB + 1, 2, 2);   // le mon de la boutique
    }
  }

  // ---- la grue de bambou --------------------------------------------------------------
  drawCrane(ctx, ox, oy, time) {
    const c = this.a.crane;
    if (!c) return;
    const B = C.BAMBOO, ground = this.a.def.ground + oy;
    const mx = R(c.mastX) + ox, by = R(c.boomY) + oy, tipX = R(c.ropeX) + ox;
    const pole = (x, y0, y1, w = 4) => {
      ctx.fillStyle = B[2]; ctx.fillRect(x, y0, w, y1 - y0);
      ctx.fillStyle = B[4]; ctx.fillRect(x, y0, 1, y1 - y0);
      ctx.fillStyle = B[0]; ctx.fillRect(x + w - 1, y0, 1, y1 - y0);
      for (let y = y0 + 6; y < y1; y += 14) { ctx.fillStyle = B[0]; ctx.fillRect(x, y, w, 1); ctx.fillStyle = B[5]; ctx.fillRect(x, y + 1, w, 1); }
    };
    const beam = (x0, x1, y, h = 4) => {
      ctx.fillStyle = B[2]; ctx.fillRect(x0, y, x1 - x0, h);
      ctx.fillStyle = B[4]; ctx.fillRect(x0, y, x1 - x0, 1);
      ctx.fillStyle = B[0]; ctx.fillRect(x0, y + h - 1, x1 - x0, 1);
      for (let x = x0 + 9; x < x1; x += 17) { ctx.fillStyle = B[0]; ctx.fillRect(x, y, 1, h); ctx.fillStyle = B[5]; ctx.fillRect(x + 1, y, 1, h); }
    };
    const lash = (x, y) => { ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 1, 7, 2); ctx.fillRect(x - 2, y + 2, 5, 1); };
    // mât : deux bambous liés, haubans
    pole(mx, by - 8, ground);
    pole(mx - 5, by + 12, ground, 3);
    for (const y of [by + 2, by + 34, by + 70, ground - 14]) lash(mx + 1, y);
    // flèche, jambe de force
    beam(mx - 16, tipX + 8, by, 4);
    ctx.fillStyle = B[1];
    for (let i = 0; i < 22; i++) ctx.fillRect(mx + 3 + i, by + 26 - i, 2, 2);
    lash(mx + 2, by + 2);
    // contrepoids : panier de pierres au bout du bras court
    const cwx = mx - 12, swing = Math.sin(time * 1.3) * 1.2;
    ctx.fillStyle = '#5b4a36'; ctx.fillRect(cwx + 1, by + 4, 1, 9);
    ctx.fillStyle = '#7a6040'; ctx.fillRect(R(cwx - 4 + swing), by + 13, 11, 8);
    ctx.fillStyle = '#5b4a36'; ctx.fillRect(R(cwx - 4 + swing), by + 13, 11, 1); ctx.fillRect(R(cwx - 4 + swing), by + 17, 11, 1);
    ctx.fillStyle = C.STONE[3]; ctx.fillRect(R(cwx - 2 + swing), by + 10, 4, 3); ctx.fillRect(R(cwx + 2 + swing), by + 11, 3, 2);
    // la corde court le long de la flèche, de la poulie au treuil
    ctx.fillStyle = ROPE[1]; ctx.fillRect(mx + 4, by + 5, tipX - mx - 6, 1);
    const wy = R(c.top * TILE - 2 * TILE) + oy - 6;          // treuil, à hauteur de la plateforme
    ctx.fillStyle = ROPE[1]; ctx.fillRect(mx + 4, by + 5, 1, wy - by - 3);
    // treuil : tambour et manivelle (il tourne quand la grue remonte les balles)
    const turning = c.state === 'lower' || c.state === 'hoist';
    const rot = turning ? Math.floor(time * 12) % 4 : 0;
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(mx + 2, wy, 10, 7);
    ctx.fillStyle = '#9a7448'; for (let y = wy + 1; y < wy + 7; y += 2) ctx.fillRect(mx + 2, y + (rot % 2), 10, 1);
    ctx.fillStyle = C.WOOD[1];
    const crank = [[0, -4], [3, 0], [0, 3], [-3, 0]][rot];
    ctx.fillRect(mx + 13, wy + 3, 2, 2); ctx.fillRect(mx + 13 + crank[0], wy + 3 + crank[1], 2, 2);
    // poulie
    ctx.fillStyle = C.WOOD[1]; ctx.fillRect(tipX - 3, by + 3, 6, 6);
    ctx.fillStyle = C.WOOD[4]; ctx.fillRect(tipX - 2, by + 4, 4, 1);
    ctx.fillStyle = OUT; ctx.fillRect(tipX - 1, by + 5, 2, 2);
    // la corde et les balles
    const bx = c.x0 * TILE + ox, yb = R(c.y) + oy;
    const line = (x0, y0, x1, y1, sway) => {
      const n = Math.max(1, Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = R(x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * sway), y = R(y0 + (y1 - y0) * t);
        ctx.fillStyle = ROPE[1]; ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = ROPE[0]; ctx.fillRect(x + 1, y, 1, 1);
        if (i % 4 === 0) { ctx.fillStyle = ROPE[2]; ctx.fillRect(x, y, 1, 1); }
      }
    };
    const hook = (x, y) => {
      ctx.fillStyle = '#5d636e'; ctx.fillRect(x - 1, y, 3, 3); ctx.fillRect(x + 1, y + 3, 2, 3); ctx.fillRect(x - 2, y + 5, 4, 1);
      ctx.fillStyle = '#9aa1ac'; ctx.fillRect(x - 1, y, 1, 2);
    };
    const yoke = (y) => {
      ctx.fillStyle = C.WOOD[1]; ctx.fillRect(bx + 3, y, c.w * TILE - 6, 3);
      ctx.fillStyle = C.WOOD[4]; ctx.fillRect(bx + 3, y, c.w * TILE - 6, 1);
      ctx.fillStyle = ROPE[1];
      for (let i = 0; i < 6; i++) { ctx.fillRect(tipX - 1 - i * 2, y - 6 + i, 1, 1); ctx.fillRect(tipX + i * 2, y - 6 + i, 1, 1); }
    };
    if (c.state === 'hang' || c.state === 'hoist') {
      const sway = c.state === 'hang' ? Math.sin(time * 1.1) * 0.6 : 0;
      line(tipX, by + 8, tipX, yb - 12, sway);
      hook(tipX, yb - 12);
      yoke(yb - 4);
    } else if (c.state === 'fall' || c.state === 'down') {
      // la corde coupée : un bout qui remonte en battant, l'autre retombé sur les balles
      const t = c.state === 'fall' ? c.t : c.t + 1, rec = Math.min(1, t / 0.5);
      const len = (c.top * TILE + oy - by - 20) * (0.6 - 0.3 * rec);
      const sway = Math.sin(t * 7) * 6 * Math.exp(-t * 1.6);
      line(tipX, by + 8, tipX + sway, by + 8 + len, sway * 0.4);
      ctx.fillStyle = ROPE[1];
      for (let i = 0; i < 9; i++) ctx.fillRect(bx + 8 + i, yb - 1 + (i > 5 ? 1 : 0), 1, 1);
    } else if (c.state === 'lower') {
      // le crochet redescend chercher les balles
      const k = Math.min(1, c.t / ARENA.crane.lower);
      const yh = by + 10 + (yb - 12 - by - 10) * k;
      line(tipX, by + 8, tipX, yh, Math.sin(time * 3) * 0.8);
      hook(tipX, R(yh));
      ctx.fillStyle = ROPE[1];
      for (let i = 0; i < 9; i++) ctx.fillRect(bx + 8 + i, yb - 1, 1, 1);
    }
    ctx.drawImage(this.bundle, bx, yb);
  }

  // ---- le gong ---------------------------------------------------------------------------
  drawGong(ctx, ox, oy, time) {
    const g = this.a.gong;
    if (!g) return;
    const x = R(g.x) + ox, y = R(g.y) + oy;
    ctx.drawImage(this.frame, x - 20, y - 52);
    const since = this.a.time - g.ringT;
    const wob = since < 1 ? Math.sin(since * 46) * 2.2 * (1 - since) : 0;
    const swing = Math.sin(time * 0.9) * 0.4 + (since < 1.4 ? Math.sin(since * 9) * 1.5 * (1.4 - since) : 0);
    const cx = R(x + swing + wob), cy = y - 27;
    // cordes tressées
    ctx.fillStyle = C.RED[3];
    for (let i = 0; i < 12; i++) { ctx.fillRect(R(x - 6 + (cx - x) * i / 12 - i * 0.1), y - 44 + i, 1, 1); ctx.fillRect(R(x + 6 + (cx - x) * i / 12 + i * 0.1), y - 44 + i, 1, 1); }
    ctx.drawImage(this.disc[g.ready ? 0 : 1], cx - 13, cy - 13);
    // prêt : un reflet passe lentement sur le bronze
    if (g.ready) {
      const k = (time * 0.35) % 1;
      if (k < 0.3) {
        const a = -2.4 + k * 9;
        ctx.fillStyle = 'rgba(255, 240, 190, 0.55)';
        for (let r = 3; r < 9; r++) ctx.fillRect(R(cx + Math.cos(a) * r), R(cy + Math.sin(a) * r), 1, 1);
      }
    }
    // maillet suspendu au poteau
    ctx.fillStyle = C.WOOD[2]; ctx.fillRect(x + 15, y - 30, 1, 14);
    ctx.fillStyle = C.PAPER[1]; ctx.fillRect(x + 13, y - 17, 5, 4);
    ctx.fillStyle = C.PAPER[3]; ctx.fillRect(x + 13, y - 17, 5, 1);
    // ondes du son : deux cercles qui s'éloignent
    if (since < 0.9) {
      for (const d of [0, 0.25]) {
        const k = since - d;
        if (k < 0 || k > 0.65) continue;
        const r = 13 + k * 40;
        ctx.fillStyle = `rgba(255, 226, 150, ${0.5 * (1 - k / 0.65)})`;
        for (let a = 0; a < 6.28; a += 0.12) ctx.fillRect(R(cx + Math.cos(a) * r), R(cy + Math.sin(a) * r * 0.9), 1, 1);
      }
    }
  }

  // ---- les vannes, au pied des bosquets ------------------------------------------------
  drawSluice(ctx, ox, oy, time, k) {
    const s = this.a.def.sluices[k];
    if (!s) return;
    const ground = this.a.def.ground + oy;
    const x = R(s.dir > 0 ? s.x : s.x - 20) + ox;
    ctx.drawImage(this.sluice[k], x, ground - 22);
    // la planche : elle tremble (le gong vient de sonner), se lève, retombe
    const w = this.a.waves.find((ww) => ww.x === s.x);
    let lift = 0, shake = 0;
    if (w) {
      if (w.t < 0) shake = R(Math.sin(time * 60));
      else lift = Math.min(12, w.t * 50) * (w.t > ARENA.wave.open ? Math.max(0, 1 - (w.t - ARENA.wave.open) * 3) : 1);
    }
    const gy = ground - 17 - R(lift);
    ctx.fillStyle = C.WOOD[2]; ctx.fillRect(x + 5 + shake, gy, 10, 17);
    ctx.fillStyle = C.WOOD[4]; ctx.fillRect(x + 5 + shake, gy, 10, 1);
    ctx.fillStyle = C.WOOD[1]; ctx.fillRect(x + 5 + shake, gy + 6, 10, 1); ctx.fillRect(x + 5 + shake, gy + 12, 10, 1);
    ctx.fillStyle = '#6b6f78'; ctx.fillRect(x + 9 + shake, gy - 6, 2, 6);            // tige de levage
    ctx.fillStyle = '#9aa1ac'; ctx.fillRect(x + 9 + shake, gy - 6, 1, 6);
    // un filet d'eau qui suinte sous la planche (et qui gicle quand elle tremble)
    const wy = ground - 2;
    ctx.fillStyle = C.WATER[4];
    const drip = (time * 6 + k) % 1;
    ctx.fillRect(x + 7 + R(drip * 4), wy, 2, 1);
    if (shake) { ctx.fillStyle = C.WATER[5]; ctx.fillRect(x + 6, gy + 17, 8, 1); ctx.fillRect(x + (s.dir > 0 ? 16 : 1), wy - 3 - R(Math.random() * 3), 1, 1); }
  }

  // ---- la vague -----------------------------------------------------------------------
  // Une nappe d'eau qui déferle de la vanne vers le canal : un rouleau haut au front,
  // qui se recourbe et mousse, un courant strié derrière ; quand la vanne se referme,
  // la nappe s'amincit et se vide dans le canal en cascade.
  drawWave(ctx, ox, oy, time, w) {
    if (w.t < 0) return;
    const D = ARENA.wave.depth, ground = this.a.def.ground + oy, W = C.WATER;
    const x0 = Math.min(w.front, w.back), x1 = Math.max(w.front, w.back);
    if (x1 - x0 < 1) return;
    const draining = w.t > ARENA.wave.open;
    for (let x = R(x0); x < R(x1); x++) {
      const fromFront = Math.abs(w.front - x), fromBack = Math.abs(x - w.back);
      // profil : rouleau au front (jusqu'à D + 5 px), nappe de D/2 derrière, bord arrière effilé
      const roll = Math.max(0, 1 - fromFront / 22);
      let h = D * 0.5 + roll * roll * (D * 0.5 + 5) * (w.fell ? 0.55 : 1);
      h *= Math.min(1, fromBack / 14 + (draining ? 0.15 : 0.7));
      h += Math.sin(x * 0.3 - time * 13 * w.dir) * 1.1 + Math.sin(x * 0.11 + time * 5) * 0.6;
      h = Math.max(1, R(h));
      const sx = x + ox;
      for (let j = 0; j < h; j++) {
        const v = j / h;
        ctx.fillStyle = v < 0.18 ? W[4] : v < 0.5 ? W[3] : v < 0.8 ? W[2] : W[1];
        ctx.fillRect(sx, ground - h + j, 1, 1);
      }
      // stries du courant (elles filent vers le canal)
      if ((x - R(time * 120 * w.dir)) % 9 === 0 && h > 3) { ctx.fillStyle = W[5]; ctx.fillRect(sx, ground - h + 2 + (x % 3), 1, 1); }
      // écume sur la crête
      if (fromFront < 8 || (x + R(time * 70 * w.dir)) % 11 === 0) { ctx.fillStyle = W[5]; ctx.fillRect(sx, ground - h, 1, 1); }
      if (fromFront < 5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, ground - h - 1, 1, 2); }
    }
    // le rouleau se recourbe vers l'avant : une lèvre d'écume qui déborde
    if (!w.fell || !draining) {
      const fx = R(w.front) + ox, top = ground - D - 5;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) ctx.fillRect(fx + w.dir * i, top + R(i * i * 0.35), 1, 2);
      ctx.fillStyle = W[5];
      ctx.fillRect(fx + w.dir * 5, top + 9, 1, 3);
    }
    // embruns au front
    for (let i = 0; i < 8; i++) {
      const px = R(w.front + ox - w.dir * (i * 2 + ((time * 50 + i * 7) % 5)));
      const py = ground - D - 3 - R(Math.abs(Math.sin(time * 9 + i * 1.7)) * 9);
      ctx.fillStyle = i % 2 ? W[5] : '#ffffff';
      ctx.fillRect(px, py, 1, 1);
    }
    // arrivée au canal : une nappe qui retombe dans l'eau, en cascade
    if (w.fell && w.back !== w.front) {
      const ex = R(w.front) + ox, wy = ground + 16;
      const thick = draining ? 2 : 4;
      for (let y = ground - 6; y < wy; y++) {
        const off = R((y - ground + 6) * 0.3) * w.dir;
        ctx.fillStyle = (y + R(time * 40)) % 4 === 0 ? W[5] : W[3];
        ctx.fillRect(ex + off - (w.dir > 0 ? 0 : thick - 1), y, thick, 1);
      }
      ctx.fillStyle = W[5];
      for (let i = 0; i < 6; i++) ctx.fillRect(ex + w.dir * (5 + i * 2), wy - 1 - R(Math.abs(Math.sin(time * 11 + i)) * 5), 1, 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ex + w.dir * 4 - 2, wy, 6, 1);
    }
  }


  // ---- caisses qui glissent -------------------------------------------------------------
  drawCrates(ctx, ox, oy) {
    const img = this.level.art?.crate;
    if (!img) return;
    for (const s of this.a.sliding) {
      const tilt = s.fall ? 0 : Math.max(-1, Math.min(1, s.vx / 200));
      ctx.drawImage(img, R(s.x) + ox, R(s.y) + oy + (Math.abs(tilt) > 0.6 ? -1 : 0));
      // poussière de frottement
      if (!s.fall && Math.abs(s.vx) > 40) {
        ctx.fillStyle = 'rgba(160, 128, 92, 0.55)';
        const bx = R(s.x) + ox + (s.vx > 0 ? -2 : 16);
        ctx.fillRect(bx, R(s.y) + oy + 13, 2, 2);
      }
    }
  }

  // ---- bonus : cœurs et paquets de shurikens ---------------------------------------------
  drawPickups(ctx, ox, oy, time) {
    for (const p of this.a.pickups) {
      const appear = Math.min(1, p.t / 0.35);
      const bob = R(Math.sin(time * 3 + p.x) * 1.5);
      const x = R(p.x) + ox, y = R(p.y) + oy - 14 + bob;
      const heart = p.kind === 'heart';
      // halo : rond, doux, qui respire
      const glow = heart ? '255, 110, 100' : '255, 228, 160', pulse = 0.75 + 0.25 * Math.sin(time * 4 + p.x);
      for (let r = 12; r > 2; r -= 2) {
        ctx.fillStyle = `rgba(${glow}, ${0.06 * appear * pulse})`;
        for (let yy = -r; yy <= r; yy++) { const half = R(Math.sqrt(r * r - yy * yy)); ctx.fillRect(x - half, y + yy, half * 2 + 1, 1); }
      }
      // ombre au sol, qui rétrécit quand il monte
      ctx.fillStyle = 'rgba(30, 20, 10, 0.28)';
      const sw = 7 - (bob > 0 ? 0 : 1);
      ctx.fillRect(x - sw, R(p.y) + oy - 1, sw * 2 + 1, 1);
      ctx.save();
      ctx.globalAlpha = appear;
      if (heart) {
        const img = this.heart[(time * 1.5) % 2 < 0.15 ? 1 : 0];
        const beat = (time * 1.6 + p.x) % 1 < 0.1 ? 1 : 0;            // il bat, doucement
        ctx.drawImage(img, x - 8 - beat, y - 10 - beat, 17 + beat * 2, 19 + beat * 2);
      } else {
        ctx.drawImage(this.stars, x - 9, y - 6);
      }
      ctx.restore();
      // scintillements autour
      const tw = (time * 2.3 + p.x * 0.1) % 1;
      if (tw < 0.25) {
        const a = p.x + Math.floor(time * 2.3) * 2.1, sx = x + R(Math.cos(a) * 10), sy = y + R(Math.sin(a) * 9);
        ctx.fillStyle = heart ? '#ffe0da' : '#fff6d8';
        ctx.fillRect(sx, sy, 1, 1);
        if (tw < 0.12) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      }
      // apparition : quelques éclats qui se resserrent
      if (p.t < 0.5) {
        const k = p.t / 0.5;
        ctx.fillStyle = heart ? '#ffd0c8' : '#fff1c4';
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + time;
          ctx.fillRect(R(x + Math.cos(a) * 16 * (1 - k)), R(y + Math.sin(a) * 16 * (1 - k)), 1, 1);
        }
      }
    }
  }
}
