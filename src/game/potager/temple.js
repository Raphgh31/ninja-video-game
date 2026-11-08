// La grande porte du temple, au bout du monde du Potager.
//
// Un pavillon de porte (rōmon) vu de trois quarts : sa façade est tournée vers
// KAGE (qui arrive par la gauche), son flanc droit fuit vers le fond, et un mur
// d'enceinte à cinq lignes blanches part vers le premier plan jusqu'au bord du
// monde : on ne voit rien derrière. Tout est peint en vraie perspective (une
// petite caméra : chaque point (u, v, w) du pavillon est projeté), une fois au
// chargement, sauf les deux vantaux, qui pivotent lentement vers KAGE quand le
// corbeau est vaincu, et la vie du passage (poussière de lumière).
//
// Repère du pavillon : u le long de la façade (vers la droite), v vers le haut
// (0 = le sol), w vers l'avant (hors de la façade, vers KAGE). Le passage fait
// 72 px de large (u de -36 à 36) et 92 px de haut ; il s'enfonce de 64 px.
//
// L'intérieur du passage (ce qu'on aperçoit au fond) a plusieurs versions à
// essayer (INTERIORS) ; la version retenue est DEFAULT_INTERIOR.
import { canvas, Brush, pick, ih, noise2, fbm2, mixHex } from './paint.js';
import * as C from './palette.js';

const TILE = 16;
const R = Math.round;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const TH = (28 * Math.PI) / 180;     // la façade est tournée de 28° vers KAGE
const CS = Math.cos(TH), SN = Math.sin(TH);
const D = 260;                       // distance de la caméra (force de la perspective)
const EYE = 30;                      // hauteur des yeux au-dessus du sol (ligne d'horizon)
const VX = -90;                      // point de fuite : un peu à gauche de la porte (là d'où vient KAGE)
const DEPTH = 64;                    // profondeur du passage
const OPEN_H = 92;                   // hauteur du passage
const SILL = 4;                      // le seuil de pierre
const LEAF = { w: 36, v0: SILL, v1: 90 };
const OPEN_ANGLE = 62;               // degrés : les vantaux ne s'ouvrent pas en grand

export const INTERIORS = {
  bambous: 'Le sentier des bambous (un avant-goût du chapitre 2)',
  escalier: "L'escalier de pierre, entre deux lanternes",
  torii: 'Les mille torii, jusqu\'à la lumière',
  brume: 'Le voile de brume dorée',
};
export const DEFAULT_INTERIOR = 'bambous';

// ---------------------------------------------------------------------------
// l'intérieur : un tableau de 72 × 92 px (vu au fond du passage)
// ---------------------------------------------------------------------------
const PW = 72, PH = 92;

function paintInterior(kind) {
  const c = canvas(PW, PH), b = new Brush(c.getContext('2d'));
  const sky = (y, top, bot) => mixHex(top, bot, clamp01(y / PH));
  if (kind === 'bambous') {
    // un sentier de dalles qui s'enfonce entre de hauts bambous, dans une brume
    // verte et dorée ; la lumière vient du bout du sentier
    for (let y = 0; y < PH; y++) b.r(0, y, PW, 1, sky(y, '#f3efc6', '#cfe0b0'));
    const glowX = 36, glowY = 50;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const d = Math.hypot((x - glowX) / 30, (y - glowY) / 34);
      if (d < 1 && ih(x, y, 3) < (1 - d) * 0.9) b.p(x, y, '#fff8dc');
    }
    // trois rangées de bambous, de plus en plus nettes vers l'avant
    const rows = [
      { n: 9, col: ['#b9cf9a', '#c8dbaa'], w: 2, y0: 52, haze: 0.7 },
      { n: 7, col: ['#8fb170', '#a4c27f'], w: 3, y0: 60, haze: 0.4 },
      { n: 5, col: [C.BAMBOO[2], C.BAMBOO[3]], w: 4, y0: 74, haze: 0 },
    ];
    rows.forEach((r, k) => {
      for (let i = 0; i < r.n; i++) {
        const side = i % 2 ? 1 : -1;
        const off = 6 + Math.floor(ih(i, k, 7) * 22) + k * 4;
        const x = R(glowX + side * off - r.w / 2);
        if (Math.abs(x + r.w / 2 - glowX) < 5 + k * 3) continue;
        for (let y = 0; y < r.y0 + 6; y++) {
          b.r(x, y, r.w, 1, r.col[0]).p(x, y, r.col[1]);
          if ((y + i * 5) % (11 + k * 3) === 0) b.r(x - (k > 1 ? 1 : 0), y, r.w + (k > 1 ? 2 : 0), 1, mixHex(r.col[0], '#2e4a1e', 0.35 - r.haze * 0.3));
        }
        for (let l = 0; l < 3 + k; l++) {                       // feuilles en éventail
          const ly = 6 + Math.floor(ih(i, l, 8 + k) * (r.y0 - 20)), dir = l % 2 ? 1 : -1;
          for (let j = 0; j < 5 + k * 2; j++) b.p(x + r.w / 2 + dir * j, ly + R(j * j * 0.08), j % 3 ? r.col[1] : r.col[0]);
        }
      }
    });
    // le sentier de dalles, qui fuit vers la lumière
    for (let y = 58; y < PH; y++) {
      const t = (y - 58) / (PH - 58), half = 3 + t * 30;
      for (let x = R(glowX - half); x <= R(glowX + half); x++) {
        const row = Math.floor(Math.pow(t, 0.7) * 9), joint = (y === 58 + R(Math.pow(row / 9, 1 / 0.7) * (PH - 58)));
        const slab = Math.floor((x - glowX) / (4 + t * 10) + row * 0.5);
        const v = 0.62 - t * 0.25 + (ih(slab, row, 11) - 0.5) * 0.18;
        b.p(x, y, joint ? C.STONE[1] : pick(C.STONE, v, x, y));
      }
    }
    for (let y = 58; y < PH; y += 1) {                          // mousse au bord du sentier
      const t = (y - 58) / (PH - 58), half = 3 + t * 30;
      if (ih(y, 1, 12) < 0.6) b.p(R(glowX - half) - 1, y, C.MOSS[2]);
      if (ih(y, 2, 12) < 0.6) b.p(R(glowX + half) + 1, y, C.MOSS[1]);
    }
    // deux lanternes de pierre allumées, au loin
    for (const lx of [glowX - 13, glowX + 12]) {
      b.r(lx, 52, 3, 9, C.STONE[3]).r(lx - 1, 50, 5, 2, C.STONE[2]).r(lx, 53, 3, 2, C.GLOW[2]).p(lx + 1, 53, C.GLOW[3]);
    }
    // bancs de brume
    for (let y = 40; y < 80; y++) for (let x = 0; x < PW; x++) {
      const m = fbm2(x * 0.06, y * 0.18, 3, 21);
      if (m > 0.58 && ih(x, y, 13) < (m - 0.58) * 4) b.p(x, y, 'rgba(250, 250, 236, 0.55)');
    }
  } else if (kind === 'escalier') {
    // un escalier de pierre moussue qui monte vers une lumière chaude ; un torii
    // en haut, deux lanternes allumées sur les côtés
    for (let y = 0; y < PH; y++) b.r(0, y, PW, 1, sky(y, '#ffe7b0', '#9a8a78'));
    for (let y = 0; y < 34; y++) for (let x = 0; x < PW; x++) {
      const d = Math.hypot((x - 36) / 26, (y - 20) / 20);
      if (d < 1 && ih(x, y, 4) < (1 - d)) b.p(x, y, '#fff4d0');
    }
    b.r(28, 14, 17, 2, C.RED[2]).r(27, 13, 19, 1, C.RED[1]).r(30, 18, 13, 1, C.RED[2]).r(30, 14, 2, 18, C.RED[2]).r(41, 14, 2, 18, C.RED[2]);
    // les marches : de plus en plus larges et hautes vers l'avant
    let y = 32;
    for (let k = 0; y < PH; k++) {
      const h = 2 + Math.floor(k * 0.55), half = 8 + k * 3.2;
      for (let j = 0; j < h && y + j < PH; j++) {
        for (let x = R(36 - half); x <= R(36 + half); x++) {
          const v = j === 0 ? 0.85 - k * 0.03 : 0.42 - k * 0.02 + (ih(x >> 2, k, 5) - 0.5) * 0.15;
          b.p(x, y + j, pick(C.STONE, v, x, y + j));
        }
      }
      for (let x = R(36 - half); x <= R(36 + half); x += 3) if (ih(x, k, 6) < 0.35) b.p(x, y + h - 1, C.MOSS[1]);
      y += h;
    }
    // murets moussus de chaque côté
    for (let yy = 30; yy < PH; yy++) {
      const t = (yy - 30) / (PH - 30), edge = 8 + t * 3.2 * 18;
      for (let x = 0; x < PW; x++) {
        if (Math.abs(x - 36) <= edge + 1) continue;
        const v = 0.3 + (fbm2(x * 0.2, yy * 0.2, 2, 7) - 0.5) * 0.4 - t * 0.1;
        b.p(x, yy, fbm2(x * 0.15, yy * 0.3, 2, 9) > 0.6 ? pick(C.MOSS, v + 0.2, x, yy) : pick(C.STONE, v, x, yy));
      }
    }
    for (const [lx, ly, s] of [[18, 40, 1], [54, 40, 1], [8, 62, 2], [62, 62, 2]]) {
      b.r(lx - s, ly, 2 + s * 2, 8 * s, C.STONE[2]).r(lx - s - 1, ly - 2, 4 + s * 2, 2, C.STONE[1]);
      b.r(lx - s + 1, ly + 1, s * 2, 2 + s * 2, C.GLOW[1]).p(lx, ly + 2, C.GLOW[3]);
    }
  } else if (kind === 'torii') {
    // une allée de torii vermillon serrés (senbon torii) qui fuit vers la lumière
    for (let y = 0; y < PH; y++) b.r(0, y, PW, 1, sky(y, '#3a2a24', '#22180f'));
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const d = Math.hypot((x - 36) / 14, (y - 44) / 22);
      if (d < 1) b.p(x, y, mixHex('#fff3cf', '#e9b56a', d));
    }
    for (let k = 14; k >= 0; k--) {
      const s = 0.18 + k * 0.06, hw = 36 * s * 1.15, top = 44 - 50 * s, bot = 44 + 46 * s;
      const fog = clamp01(1 - k / 14);
      const col = mixHex(C.RED[3], '#f2c88a', fog * 0.85), dark = mixHex(C.RED[1], '#d9a46a', fog * 0.85);
      const pw = Math.max(1, R(4 * s));
      b.r(R(36 - hw), R(top), pw, R(bot - top), col).r(R(36 + hw) - pw, R(top), pw, R(bot - top), dark);
      b.r(R(36 - hw - 3 * s), R(top - 2 * s), R(2 * hw + 6 * s), Math.max(1, R(3 * s)), col);
      b.r(R(36 - hw), R(top + 5 * s), R(2 * hw), Math.max(1, R(2 * s)), dark);
    }
    for (let y = 70; y < PH; y++) for (let x = 0; x < PW; x++) {
      const t = (y - 70) / 22;
      if (Math.abs(x - 36) < 8 + t * 30) b.p(x, y, pick(C.STONE, 0.35 - t * 0.15 + (ih(x >> 2, y >> 2, 4) - 0.5) * 0.15, x, y));
    }
  } else {
    // brume dorée : un voile qui tourne lentement, des pétales en suspens
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const a = Math.atan2(y - 46, x - 36), d = Math.hypot(x - 36, (y - 46) * 0.8) / 46;
      const sw = fbm2(Math.cos(a + d * 3) * 2 + 5, Math.sin(a + d * 3) * 2 + d * 4, 4, 33);
      const v = clamp01(1 - d * 0.9 + (sw - 0.5) * 0.7);
      b.p(x, y, pick(['#8a6a3a', '#b88f4e', '#dcb46a', '#f2d48e', '#fff0c4', '#fffbea'], v, x, y));
    }
    for (let k = 0; k < 14; k++) {
      const px = Math.floor(ih(k, 1, 40) * PW), py = Math.floor(ih(k, 2, 40) * PH);
      b.r(px, py, 2, 1, C.BLOSSOM[2]).p(px, py + 1, C.BLOSSOM[1]);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// la porte
// ---------------------------------------------------------------------------
export class TempleGate {
  /** p : le décor « temple_gate » (x : la case du milieu du passage, y : la ligne du sol). */
  constructor(p, interior = DEFAULT_INTERIOR) {
    this.X = p.x * TILE + 8;
    this.G = p.y * TILE;
    this.vx = this.X + VX;
    this.build(interior);
  }

  /** Échelle de la perspective en un point du sol (u, w). */
  scaleAt(u, w) {
    return D / (D - u * SN - w * CS);
  }

  /** Projette un point du pavillon (u, v, w) à l'écran (coordonnées du monde). */
  proj(u, v, w) {
    const x = this.X + u * CS - w * SN, z = -u * SN - w * CS, k = D / (D + z);
    return { x: this.vx + (x - this.vx) * k, y: this.G - EYE + (EYE - v) * k };
  }

  build(interior) {
    this.interior = interior;
    this.ox = this.X - 170;
    this.oy = this.G - 190;
    const W = 300, H = 214;
    const mk = () => { const c = canvas(W, H), g = c.getContext('2d'); g.translate(-this.ox, -this.oy); return { c, b: new Brush(g) }; };
    const back = mk(), front = mk(), seal = mk();
    this.paintBack(back.b, paintInterior(interior));
    this.paintFront(front.b);
    this.paintSeal(seal.b);
    this.back = back.c; this.front = front.c; this.seal = seal.c;
    // le tableau du fond, projeté : pour la poussière de lumière qui y flotte
    this.pic = { o: [-36, SILL, -DEPTH] };
  }

  /** Remplit une surface : pt(i, j) -> [u, v, w], tex(i, j) -> couleur (ou rien). */
  surf(b, la, lb, pt, tex, step = 0.5) {
    for (let i = 0; i <= la; i += step) {
      for (let j = 0; j <= lb; j += step) {
        const col = tex(i, j);
        if (!col) continue;
        const [u, v, w] = pt(i, j), s = this.proj(u, v, w);
        b.p(Math.floor(s.x), Math.floor(s.y), col);
      }
    }
  }

  // --- le passage : le tableau au fond, le sol, le plafond, le mur de gauche ---
  paintBack(b, pic) {
    const px = pic.getContext('2d').getImageData(0, 0, PW, PH).data;
    const at = (x, y) => {
      const k = (Math.min(PH - 1, Math.max(0, y)) * PW + Math.min(PW - 1, Math.max(0, x))) * 4;
      return `rgb(${px[k]}, ${px[k + 1]}, ${px[k + 2]})`;
    };
    const H = OPEN_H - SILL;
    this.surf(b, 72, H, (i, j) => [-36 + i, SILL + j, -DEPTH], (i, j) => at(Math.floor(i), PH - 1 - Math.floor((j / H) * PH)));
    // le sol : de grandes dalles, éclairées par la lumière du fond
    this.surf(b, 72, DEPTH, (i, j) => [-36 + i, SILL, -DEPTH + j], (i, j) => {
      const si = Math.floor(i / 12), sj = Math.floor(j / 10);
      if (i % 12 < 0.6 || j % 10 < 0.6) return C.STONE[0];
      const v = 0.6 - (j / DEPTH) * 0.45 + (ih(si, sj, 51) - 0.5) * 0.15;
      return pick(C.STONE, v, R(i), R(j));
    });
    // le plafond : des solives sombres
    this.surf(b, 72, DEPTH, (i, j) => [-36 + i, OPEN_H, -DEPTH + j], (i, j) => (j % 9 < 2 ? C.WOOD[1] : '#1c130d'));
    // le mur de gauche : soubassement de bois, enduit, poteaux ; plus clair au fond
    this.surf(b, DEPTH, H, (i, j) => [-36, SILL + j, -DEPTH + i], (i, j) => {
      const light = 1 - i / DEPTH;
      if (i % 21 < 3) return pick(C.WOOD, 0.15 + light * 0.4, R(i), R(j));
      if (j < 26) return pick(C.WOOD, 0.1 + light * 0.35 + ((i % 5) < 0.6 ? -0.08 : 0), R(i), R(j));
      if (Math.abs(j - 26) < 1.5 || Math.abs(j - 64) < 1.5) return C.WOOD[1];
      return pick(C.PLASTER, 0.05 + light * 0.55, R(i), R(j));
    });
  }

  // --- le pavillon : murs, piliers, poutres, toit, seuil, enceinte ---
  paintFront(b) {
    const plaster = (i, j, v0) => pick(C.PLASTER, v0 + (noise2(i * 0.3, j * 0.3, 61) - 0.5) * 0.12, R(i), R(j));
    const tiles = (i, j, v0) => {
      const ridge = (i % 4) < 1.2, course = (j % 4) < 0.8;
      return pick(C.ROOF, clamp01(v0 + (ridge ? -0.2 : (i % 4) < 2.4 ? 0.12 : 0) + (course ? -0.12 : 0)), R(i), R(j));
    };
    // 1. le mur d'enceinte de gauche (au fond) : enduit, lignes blanches, chaperon de tuiles
    const wall = (i, j, light) => {
      if (j < 10) return pick(C.STONE, 0.35 + light * 0.2 + (ih(Math.floor(i / 6), Math.floor(j / 5), 62) - 0.5) * 0.2, R(i), R(j));
      if (j > 22 && j < 50 && (j - 24) % 6 < 1.2) return C.PLASTER[4];                       // les cinq lignes blanches
      return pick(['#8a6a3c', '#a57f4a', '#c09a5e', '#d6b479'], 0.3 + light * 0.4 + (noise2(i * 0.2, j * 0.2, 63) - 0.5) * 0.15, R(i), R(j));
    };
    this.surf(b, 48, 62, (i, j) => [-118 + i, -6 + j, -2], (i, j) => wall(i, j + 6, 0.3));
    this.surf(b, 50, 7, (i, j) => [-120 + i, 56 + j, 2], (i, j) => tiles(i, j, j > 5 ? 0.75 : 0.35));
    // 2. le flanc droit du pavillon (il fuit vers le fond)
    this.surf(b, 44, 108, (i, j) => [70, -4 + j, -i], (i, j) => {
      if (i % 22 < 3) return pick(C.WOOD, 0.22, R(i), R(j));
      if (j < 28) return pick(C.WOOD, 0.18 + ((i % 6) < 0.6 ? -0.08 : 0), R(i), R(j));
      if (Math.abs(j - 28) < 1.6 || Math.abs(j - 70) < 1.6) return C.WOOD[1];
      return plaster(i, j, 0.38);
    });
    // 3. la façade : deux panneaux d'enduit encadrés de bois, la frise au-dessus du passage
    for (const u0 of [-70, 48]) {
      this.surf(b, 22, 104, (i, j) => [u0 + i, -4 + j, 0], (i, j) => {
        if (i < 2.5 || i > 19.5) return pick(C.WOOD, 0.35, R(i), R(j));
        if (j < 30) return pick(C.WOOD, 0.3 + ((i % 5) < 0.6 ? -0.1 : 0) + (j > 28 ? 0.2 : 0), R(i), R(j));
        if (Math.abs(j - 30) < 1.6 || Math.abs(j - 72) < 1.6) return C.WOOD[1];
        // une fenêtre à barreaux dans chaque panneau
        if (j > 44 && j < 64 && i > 5 && i < 17) return (i % 3) < 1 ? C.WOOD[1] : '#2a201a';
        return plaster(i, j, 0.62);
      });
    }
    this.surf(b, 96, 10, (i, j) => [-48 + i, OPEN_H + j, 1], (i, j) => {
      if (j < 1.2 || j > 8.8) return C.WOOD[1];
      return (i % 6) < 1.2 ? C.WOOD[2] : (Math.floor(i / 6) + Math.floor(j / 3)) % 2 ? '#2a201a' : C.WOOD[1];   // claire-voie
    });
    // le haut du mur, sous l'avant-toit (derrière les poutres) : rien ne se voit au travers
    this.surf(b, 144, 26, (i, j) => [-72 + i, 98 + j, -1], (i, j) => {
      if ((i % 24) < 2.5) return C.WOOD[1];
      if (j < 1.5 || j > 24) return '#20160f';
      return pick(C.PLASTER, 0.35 + (noise2(i * 0.3, j * 0.3, 65) - 0.5) * 0.1, R(i), R(j));
    });
    // 4. le seuil de pierre (une marche) devant tout le pavillon
    this.surf(b, 150, 22, (i, j) => [-75 + i, SILL, -6 + j], (i, j) => {
      if ((i % 15) < 0.6 || (j % 11) < 0.6) return C.STONE[1];
      return pick(C.STONE, 0.66 + (ih(Math.floor(i / 15), Math.floor(j / 11), 64) - 0.5) * 0.15, R(i), R(j));
    });
    this.surf(b, 150, 10, (i, j) => [-75 + i, -6 + j, 16], (i, j) => (j > 9 ? C.STONE[4] : (i % 15) < 0.6 ? C.STONE[0] : pick(C.STONE, 0.35, R(i), R(j))));
    this.surf(b, 22, 10, (i, j) => [75, -6 + j, 16 - i], (i, j) => pick(C.STONE, 0.22, R(i), R(j)));
    // 5. les piliers vermillon (face, puis côté droit plus sombre), sur leurs socles
    for (const u0 of [-49, 36]) {
      this.surf(b, 13, 8, (i, j) => [u0 - 1 + i, SILL + j, 6], () => '#2a2420');
      this.surf(b, 13, 104, (i, j) => [u0 + i, SILL + 8 + j, 5], (i) => C.RED[i < 2 ? 4 : i < 6 ? 3 : i < 10 ? 2 : 1]);
      this.surf(b, 10, 104, (i, j) => [u0 + 13, SILL + 8 + j, 5 - i], () => C.RED[1]);
    }
    // 6. la traverse (nuki) et le grand linteau
    this.surf(b, 156, 6, (i, j) => [-78 + i, 98 + j, 7], (i, j) => (j > 5 ? C.RED[4] : j < 1 ? C.RED[0] : C.RED[3]));
    this.surf(b, 10, 6, (i, j) => [78, 98 + j, 7 - i], () => C.RED[1]);
    this.surf(b, 168, 6, (i, j) => [-84 + i, 110 + j, 8], (i, j) => (j > 5 ? C.RED[4] : j < 1 ? C.RED[0] : C.RED[2]));
    this.surf(b, 12, 6, (i, j) => [84, 110 + j, 8 - i], () => C.RED[0]);
    // le dessous de l'avant-toit : chevrons sombres (on le voit d'en bas)
    this.surf(b, 184, 26, (i, j) => [-92 + i, 121, 6 + j], (i, j) => ((i % 5) < 1.6 ? C.WOOD[1] : j > 23 ? C.WOOD[2] : '#1a120c'));
    // les consoles (kumimono) sous l'avant-toit : bois sombre, bouts dorés
    this.surf(b, 156, 6, (i, j) => [-78 + i, 116 + j, 10], (i, j) => ((i % 13) < 4 ? (j > 4 ? '#c9a24a' : C.WOOD[2]) : '#20160f'));
    // 7. le toit : la croupe de droite, puis le grand pan de devant, aux coins relevés
    const lift = (u, j) => (Math.abs(u) > 72 ? Math.pow((Math.abs(u) - 72) / 18, 2) * 7 * (1 - j) : 0);
    this.surf(b, 64, 1, (i, j) => {
      const eu = 90, ev = 120 + lift(eu, 0), ew = 32 - i, au = 66, av = 150, aw = 0;
      return [eu + (au - eu) * j, ev + (av - ev) * j, ew + (aw - ew) * j];
    }, (i, j) => tiles(i * 0.8, j * 30, 0.32 - j * 0.1), 0.02);
    this.surf(b, 180, 40, (i, j) => {
      const u = -90 + i, t = j / 40;
      return [u, 120 + lift(u, t) + 30 * t, 32 - 32 * t];
    }, (i, j) => {
      if (j < 2) return j < 1 ? C.ROOF[0] : (i % 4) < 2 ? C.PLASTER[3] : C.ROOF[2];       // le bord : bouts de tuiles ronds
      return tiles(i, j, 0.5 + (j / 40) * 0.15 - Math.abs(i - 90) / 900);
    });
    // le faîtage, et ses deux tuiles d'about (oni-ita) relevées
    this.surf(b, 136, 7, (i, j) => [-68 + i, 149 + j, 2], (i, j) => (j < 1 ? C.ROOF[0] : j > 6 ? C.ROOF[3] : C.ROOF[1]));
    for (const u0 of [-72, 66]) this.surf(b, 6, 11, (i, j) => [u0 + i, 147 + j, 3], (i, j) => (j > 10 || i < 0.6 ? C.ROOF[4] : C.ROOF[1]));
    // 8. la plaque du nom, cerclée d'or
    this.surf(b, 20, 15, (i, j) => [-10 + i, 96 + j, 11], (i, j) => {
      if (i < 1.2 || i > 18.8 || j < 1.2 || j > 13.8) return '#c9a24a';
      const glyph = [[9, 4], [10, 4], [8, 7], [9, 7], [10, 7], [11, 7], [9, 10], [10, 10], [9, 11]];
      return glyph.some(([gx, gy]) => Math.floor(i) === gx && Math.floor(j) === gy) ? '#e8c860' : '#2a2018';
    });
    // 9. le mur d'enceinte de droite : il vient vers nous jusqu'au bord du monde
    this.surf(b, 96, 66, (i, j) => [70 + i, -10 + j, 0], (i, j) => wall(i, j + 6, 0.5 - i / 400), 0.4);
    this.surf(b, 100, 8, (i, j) => [68 + i, 56 + j, 4], (i, j) => tiles(i, j, j > 6 ? 0.8 : 0.4), 0.4);
    // la lanterne de bronze suspendue sous l'avant-toit, à gauche
    this.surf(b, 8, 14, (i, j) => [-62 + i, 92 + j, 14], (i, j) => (j < 2 || j > 12 ? '#5a4a2a' : (i % 3) < 1 ? '#5a4a2a' : '#e6b450'));
  }

  // --- le sceau : la corde sacrée tendue en travers et le talisman (porte fermée) ---
  paintSeal(b) {
    this.surf(b, 72, 3, (i, j) => [-36 + i, 82 - Math.sin((i / 72) * Math.PI) * 6 + j, 3], (i, j) => ((Math.floor(i) + Math.floor(j)) % 3 ? '#86704a' : '#4f3b22'));
    for (let k = 0; k < 5; k++) {
      const u = -28 + k * 14;
      const v = 80 - Math.sin(((u + 36) / 72) * Math.PI) * 6;
      this.surf(b, 3, 10, (i, j) => [u + i + (j > 5 ? 1 : 0), v - j, 3.5], () => C.PAPER[3]);
    }
    this.surf(b, 12, 44, (i, j) => [-6 + i, 30 + j, 4], (i, j) => {
      if (i < 0.8 || i > 11.2) return C.PAPER[0];
      const y = Math.floor(44 - j);
      if (y % 6 === 4 && i > 3 && i < 9) return C.RED[2];
      if (y % 6 === 1 && Math.abs(i - 6 + ((y / 6) % 2 ? 2 : -1)) < 1.2) return C.RED[2];
      return C.PAPER[2];
    });
  }

  // --- en jeu ---------------------------------------------------------------
  /** o : ouverture des vantaux, de 0 à 1 (déjà adoucie). */
  draw(ctx, cam, time, o) {
    const ox = R(this.ox - cam.x), oy = R(this.oy - cam.y);
    ctx.drawImage(this.back, ox, oy);
    this.motes(ctx, cam, time, o);
    this.inside?.(ctx, cam, this);                // KAGE qui s'enfonce dans le passage (main.js)
    ctx.drawImage(this.front, ox, oy);
    // les vantaux : celui de gauche (au fond) d'abord ; ouverts aux trois quarts,
    // ils cachent encore une part du passage
    const phi = o * (OPEN_ANGLE * Math.PI) / 180;
    this.leaf(ctx, cam, -1, phi);
    this.leaf(ctx, cam, 1, phi);
    if (o <= 0) ctx.drawImage(this.seal, ox + R(Math.sin(time * 2.1) * 0.4), oy);
  }

  /** Poussière de lumière qui flotte au fond du passage. */
  motes(ctx, cam, time, o) {
    if (o <= 0.02) return;
    for (let k = 0; k < 16; k++) {
      const u = -30 + ih(k, 1, 90) * 60, cyc = (time * (0.05 + ih(k, 2, 90) * 0.06) + ih(k, 3, 90)) % 1;
      const v = SILL + 6 + cyc * 70, w = -DEPTH + 4 + ih(k, 4, 90) * 40;
      const s = this.proj(u + Math.sin(time * 0.8 + k) * 3, v, w);
      ctx.globalAlpha = Math.min(1, o * 1.5) * Math.sin(cyc * Math.PI) * 0.8;
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(R(s.x - cam.x), R(s.y - cam.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Un vantail : planches verticales, trois pentures cloutées d'or, un anneau de bronze. */
  leaf(ctx, cam, side, phi) {
    // gond : au bord du passage ; fermé, le vantail est dans le plan de la façade ;
    // il pivote vers l'avant (vers KAGE)
    const hu = side * 36, du = -side * Math.cos(phi), dw = Math.sin(phi);
    // face visible : le dehors (pentures dorées) ou le dedans (bois nu, contre-fiche)
    const nu = side < 0 ? -Math.sin(phi) : Math.sin(phi), nw = Math.cos(phi);
    const outside = -nu * SN - nw * CS < 0;
    const lightF = outside ? 0.55 + 0.3 * Math.cos(phi) : 0.3;
    const cols = [];
    for (let t = 0; t <= LEAF.w; t += 0.5) {
      const u = hu + du * t, w = dw * t;
      const a = this.proj(u, LEAF.v0, w), z = this.proj(u, LEAF.v1, w);
      cols.push({ t, x: R(a.x - cam.x), y0: R(z.y - cam.y), y1: R(a.y - cam.y), k: (a.y - z.y) / (LEAF.v1 - LEAF.v0), base: a.y - cam.y });
    }
    const W = C.WOOD;
    for (const c of cols) {
      const seam = (c.t % 6) < 0.6, edge = c.t > LEAF.w - 0.6;
      const v = seam || edge ? 0.12 : 0.3 + (Math.floor(c.t / 6) % 2 ? 0.1 : 0) + lightF * 0.4;
      ctx.fillStyle = pick(W, v, c.x, 0);
      ctx.fillRect(c.x, c.y0, 1, c.y1 - c.y0);
      if (outside) {
        for (const hv of [14, 46, 74]) {                       // pentures et clous dorés
          const y = R(c.base - (hv - LEAF.v0) * c.k);
          ctx.fillStyle = '#7a5c24'; ctx.fillRect(c.x, y, 1, Math.max(2, R(3 * c.k)));
          if ((c.t % 5) < 0.6) { ctx.fillStyle = '#e8c45e'; ctx.fillRect(c.x, y + 1, 1, 1); }
        }
        if (Math.abs(c.t - (LEAF.w - 6)) < 2.5) {               // l'anneau de bronze
          const y = R(c.base - (44 - LEAF.v0) * c.k);
          ctx.fillStyle = '#c9a24a';
          const d = Math.abs(c.t - (LEAF.w - 6));
          if (d > 1.6) ctx.fillRect(c.x, y - 1, 1, 4); else { ctx.fillRect(c.x, y - 2, 1, 1); ctx.fillRect(c.x, y + 3, 1, 1); }
        }
      } else {
        // le dedans : une contre-fiche en diagonale
        const y = R(c.base - (LEAF.v0 + 6 + (c.t / LEAF.w) * 70 - LEAF.v0) * c.k);
        ctx.fillStyle = W[1]; ctx.fillRect(c.x, y, 1, Math.max(2, R(4 * c.k)));
      }
      ctx.fillStyle = '#140d08';                                  // ombre au pied
      ctx.fillRect(c.x, c.y1 - 1, 1, 1);
    }
  }
}
