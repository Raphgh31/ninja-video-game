// Fond de la Forêt : le ciel, puis six plans en parallaxe, du plus loin au plus
// proche (crêtes et cimes lointaines, fûts et sapins dans la brume, nappe de
// brume, fûts et sapins plus proches, brume basse, arbres géants), une voûte de
// feuillage en haut de l'image et des rais de lumière.
//
// Chaque lumière (matin, sous-bois, canopée, sanctuaire, couchant, crépuscule,
// souterrain) a son jeu de bandes, peint à la demande (celle de la zone où l'on
// est d'abord, les voisines ensuite, un plan par image) ; entre deux zones de
// lumières différentes, les deux jeux se fondent l'un dans l'autre.
//
// Le fond est posé sur un sol de référence unique (la lisière, ligne 50) : quand
// KAGE grimpe (ascension, canopée), la forêt lointaine descend sous lui ; quand il
// dévale la pente, elle remonte. Les bandes se prolongent vers le haut (fûts) et
// vers le bas (sous-bois) : aucune coupe ne se voit, quelle que soit la hauteur.
import { canvas, ih, pick, bayer, hazeRamp } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

const TILE = 16;
const W = 768;                 // largeur d'une bande (elle se répète sans couture)
const H = 252;                 // hauteur d'une bande
const GY = 217;                // ligne de sol dans la bande (86 %)
const REF_ROW = 50;            // sol de référence du fond, en cases
const GROUND_AT = 0.86;
const BLEND = 12 * TILE;       // largeur du fondu entre deux lumières

// défilement horizontal (fx), vertical (fy) ; drift : la brume glisse toute seule (px/s)
const PLANES = [
  { id: 'far', fx: 0.04, fy: 0.05, up: false },
  { id: 'firs', fx: 0.1, fy: 0.1, up: true },
  { id: 'mistA', fx: 0.14, fy: 0.13, drift: 2.2, mist: true },
  { id: 'near', fx: 0.2, fy: 0.18, up: true },
  { id: 'mistB', fx: 0.28, fy: 0.24, drift: 3.6, mist: true },
  { id: 'giants', fx: 0.38, fy: 0.32, up: true },
];
const VAULT = { fx: 0.45, h: 74 };

const n = (k) => Math.round((k * W) / 448);   // nombre d'éléments, à densité égale

// ---------------------------------------------------------------------------
// peinture des plans d'une lumière
// ---------------------------------------------------------------------------
function paintPlane(id, mood) {
  const strip = () => new L.Strip(W, H);
  const p = strip();
  if (mood.cave) return paintCavePlane(id, p, mood);
  switch (id) {
    case 'far':
      L.paintRidges(p, GY - 74, mood, 3);
      L.firRow(p, GY - 50, n(24), 22, 50, 0.2, mood.firs[0], 11, 5);
      break;
    case 'firs':
      L.stems(p, GY - 30, n(15), 2, 5, mood.stems[0], 13);
      L.firRow(p, GY - 28, n(12), 46, 92, 0.19, mood.firs[1], 17, 6);
      break;
    case 'mistA':
      L.paintMist(p, mood.haze, 41, (t) => Math.max(0, 1 - Math.abs(t - 0.66) / 0.2), 1.25);
      break;
    case 'near':
      L.stems(p, GY - 12, n(8), 4, 10, mood.stems[1], 19);
      L.firRow(p, GY - 8, n(6), 84, 150, 0.17, mood.firs[2], 23, 5);
      break;
    case 'mistB':
      L.paintMist(p, mood.haze, 47, (t) => Math.max(0, 1 - Math.abs(t - 0.8) / 0.16), 1.2);
      break;
    case 'giants': {
      const bark = L.hazeRamp(C.BARK, mood.depth, mood.tint), moss = L.hazeRamp(C.MOSS, mood.depth, mood.tint);
      const leaf = L.hazeRamp(C.LEAF, mood.depth, mood.tint * 0.8);
      if (mood.crowns) {
        // vus d'en haut : des houppiers ronds, leurs troncs plongent dans la brume
        for (let i = 0; i < n(7); i++) {
          const x = Math.round((i + 0.2 + ih(i, 3, 41) * 0.6) * W / n(7)), top = 70 + Math.floor(ih(i, 4, 41) * 50);
          L.bigTrunk(p, x, 8 + Math.floor(ih(i, 6, 41) * 8), H, 40 + i, bark, moss, { top: top + 10, roots: 0 });
          L.bush(p, x, top + 26, 30 + Math.floor(ih(i, 5, 41) * 18), 22 + Math.floor(ih(i, 7, 41) * 10), leaf, 51 + i);
        }
        for (let i = 0; i < n(12); i++) {
          const x = Math.round((i + ih(i, 8, 41)) * W / n(12));
          L.bush(p, x, H + 4, 26 + Math.floor(ih(i, 9, 41) * 20), 40 + Math.floor(ih(i, 10, 41) * 26), leaf, 71 + i);
        }
        break;
      }
      for (let i = 0; i < n(3); i++) {
        const fx = (i + 0.15 + ih(i, 2, 29) * 0.7) / n(3);
        L.bigTrunk(p, Math.round(W * fx), 26 + Math.floor(ih(i, 1, 29) * 18), GY + 3, 3 + i * 5, bark, moss);
      }
      for (let i = 0; i < n(9); i++) {
        const x = Math.round((i + 0.2 + ih(i, 3, 3) * 0.6) * W / n(9));
        L.bush(p, x, GY + 2, 14 + Math.floor(ih(i, 4, 3) * 16), 9 + Math.floor(ih(i, 5, 3) * 9), leaf, 31 + i);
      }
      // le pied du plan : un sous-bois sombre jusqu'en bas
      for (let x = 0; x < W; x++) for (let y = GY + 2 + Math.floor(ih(x, 1, 5) * 3); y < H; y++) if (!p.alpha(x, y)) p.set(x, y, leaf[0]);
      break;
    }
    default: break;
  }
  return p.done();
}

/** Sous terre : une paroi de terre au loin, des racines qui pendent, des points de lumière. */
function paintCavePlane(id, p, mood) {
  if (id === 'far') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = 0.35 + (L.pf(x, W, 0.05, 3, 7) - 0.5) * 0.4 + Math.sin((y / H) * Math.PI) * 0.15;
      p.set(x, y, pick(['#06090b', '#0a0f12', '#0e1518', '#121b1e'], v, x, y));
    }
    // filons de lueurs (champignons lointains)
    for (let i = 0; i < n(26); i++) {
      const x = Math.floor(ih(i, 1, 9) * W), y = 40 + Math.floor(ih(i, 2, 9) * 170);
      p.set(x, y, C.GLOW[2 + (i % 2)]);
      if (i % 3 === 0) p.set(x + 1, y, C.GLOW[2], 120);
    }
  } else if (id === 'firs' || id === 'near' || id === 'giants') {
    const k = { firs: 0, near: 1, giants: 2 }[id];
    const ramp = [['#0b0d0d', '#0f1211', '#151a18', '#1c2220'], ['#0e0c0a', '#14110e', '#1c1813', '#251f19'], ['#120e0b', '#1b1510', '#261d15', '#33271c']][k];
    // racines épaisses qui descendent de la voûte jusqu'au sol, entrelacées
    const cnt = [n(10), n(7), n(4)][k];
    for (let i = 0; i < cnt; i++) {
      const x0 = Math.floor(((i + ih(i, 4, k)) * W) / cnt), w = [3, 5, 9][k] + Math.floor(ih(i, 5, k) * [3, 4, 8][k]);
      for (let y = 0; y < H; y++) {
        const sway = Math.round(Math.sin(y * 0.03 + i * 1.7) * (4 + k * 3));
        for (let dx = 0; dx < w; dx++) {
          const u = dx / w;
          p.set(x0 + sway + dx, y, ramp[u < 0.25 ? 3 : u > 0.7 ? 0 : (ih(dx, y >> 2, i) < 0.15 ? 1 : 2)]);
        }
      }
      // radicelles
      for (let r = 0; r < 4 + k * 2; r++) {
        const y0 = Math.floor(ih(i, r, k + 7) * 160), len = 8 + Math.floor(ih(i, r, k + 8) * 30), side = ih(i, r, k + 9) < 0.5 ? -1 : 1;
        for (let s = 0; s < len; s++) p.set(x0 + (side < 0 ? 0 : w) + side * Math.round(s * 0.5), y0 + s, ramp[1]);
      }
    }
  } else if (id === 'mistA' || id === 'mistB') {
    L.paintMist(p, mood.haze, id === 'mistA' ? 43 : 49, (t) => Math.max(0, 1 - Math.abs(t - 0.85) / 0.14), 1.1);
  }
  return p.done();
}

function paintVault(mood) {
  const p = new L.Strip(W, VAULT.h);
  const leaf = L.hazeRamp(C.LEAF, mood.depth, mood.tint * 0.55);
  L.paintCanopy(p, 46, leaf, 29);
  return p.done();
}

function paintRays(mood) {
  const p = new L.Sheet(W, H);
  const list = [];
  for (let i = 0; i < n(5); i++) list.push({ x: (i + ih(i, 1, 77) * 0.6) * W / n(5) - 40, w: 8 + Math.floor(ih(i, 2, 77) * 24), len: H * (0.7 + ih(i, 3, 77) * 0.3) });
  L.paintRays(p, list, mood.ray, mood.rayA);
  return p.done();
}

/** Le ciel : un dégradé à la hauteur de l'image (4 px de large, étiré). */
function paintSky(mood, h) {
  const p = new L.Sheet(4, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) {
    let v = (y / h) * 0.95;
    if (mood.glow) v += Math.max(0, 1 - Math.abs(y / h - mood.glow.y) / mood.glow.r) * mood.glow.k * 0.5;
    p.set(x, y, pick(mood.sky, v, x, y, 0.8));
  }
  return p.done();
}

// ---------------------------------------------------------------------------
export class ForetBackdrop {
  constructor(level) {
    this.level = level;
    this.zones = level.zones;
    this.dark = level.forest?.dark ?? null;
    this.sets = {};                 // mood -> { planes: { id: canvas }, vault, rays, sky, skyH }
    this.k = 1;
    this.tmp = null;
    // la lumière de la première zone tout de suite ; les autres à la demande
    this.need(this.zones[0]?.mood ?? 'matin', true);
  }

  set(mood) { return (this.sets[mood] ??= { planes: {}, vault: null, rays: null, sky: null, skyH: 0 }); }

  /** Peint ce qui manque d'une lumière (tout, ou une seule pièce si !all). Renvoie true s'il a peint. */
  need(mood, all = false) {
    const m = C.MOODS[mood] ?? C.MOODS.sousbois, s = this.set(mood);
    for (const pl of PLANES) {
      if (s.planes[pl.id]) continue;
      s.planes[pl.id] = paintPlane(pl.id, m);
      if (!all) return true;
    }
    if (!s.vault && !m.cave && !m.crowns) { s.vault = paintVault(m); if (!all) return true; }
    if (!s.rays && !m.cave) { s.rays = paintRays(m); if (!all) return true; }
    return false;
  }

  ready(mood) {
    const m = C.MOODS[mood], s = this.sets[mood];
    return !!s && PLANES.every((pl) => s.planes[pl.id]) && (s.vault || m.cave || m.crowns) && (s.rays || m.cave);
  }

  /** Lumières à mélanger pour cette caméra : [{ mood, w }] (poids décroissants). */
  weights(cam, viewW, viewH) {
    const cx = cam.x + viewW / 2, cy = cam.y + viewH * 0.6;
    const zs = this.zones;
    let i = zs.findIndex((z) => cx >= z.px0 && cx < z.px1);
    if (i < 0) i = cx < zs[0].px0 ? 0 : zs.length - 1;
    const z = zs[i];
    let out = [{ mood: z.mood, w: 1 }];
    // près d'une frontière avec une lumière différente : fondu enchaîné
    const prev = zs[i - 1], next = zs[i + 1];
    if (next && next.mood !== z.mood && cx > z.px1 - BLEND / 2) {
      const t = (cx - (z.px1 - BLEND / 2)) / BLEND;
      out = [{ mood: z.mood, w: 1 - t }, { mood: next.mood, w: t }];
    } else if (prev && prev.mood !== z.mood && cx < z.px0 + BLEND / 2) {
      const t = (z.px0 + BLEND / 2 - cx) / BLEND;
      out = [{ mood: z.mood, w: 1 - t }, { mood: prev.mood, w: t }];
    }
    // sous terre : la paroi du souterrain remplace le ciel dès qu'on descend
    const d = this.dark;
    if (d && cx > d.x0 && cx < d.x1) {
      const t = Math.max(0, Math.min(1, (cy - d.y0) / 64));
      if (t > 0) {
        out = out.map((o) => ({ mood: o.mood, w: o.w * (1 - t) })).filter((o) => o.mood !== 'souterrain');
        out.push({ mood: 'souterrain', w: t });
      }
    }
    return out.filter((o) => o.w > 0.002).sort((a, b) => b.w - a.w);
  }

  /** À chaque image : peint une pièce d'avance (lumières des zones voisines). */
  idle(cam, viewW) {
    const cx = cam.x + viewW / 2, zs = this.zones;
    let i = zs.findIndex((z) => cx >= z.px0 && cx < z.px1);
    if (i < 0) i = 0;
    const order = [zs[i], zs[i + 1], zs[i - 1], zs[i + 2]].filter(Boolean).map((z) => z.mood);
    if (this.dark && i >= 5 && i <= 8) order.push('souterrain');
    for (const m of order) if (!this.ready(m)) { this.need(m); return; }
  }

  q(v) { return Math.round(v * this.k) / this.k; }

  /** k = pixels d'écran par pixel de jeu (le contexte est déjà mis à l'échelle). */
  draw(ctx, cam, viewW, viewH, time, k = 1) {
    this.k = k;
    const list = this.weights(cam, viewW, viewH);
    for (const o of list) if (!this.ready(o.mood)) this.need(o.mood, true);
    this.drawMood(ctx, list[0].mood, cam, viewW, viewH, time);
    if (list.length > 1) {
      // fondu exact : la seconde lumière est composée à part, puis posée par-dessus
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      if (!this.tmp || this.tmp.width !== cw || this.tmp.height !== ch) this.tmp = canvas(cw, ch);
      const g = this.tmp.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(ctx.getTransform());
      g.imageSmoothingEnabled = false;
      for (let j = 1; j < list.length; j++) {
        this.drawMood(g, list[j].mood, cam, viewW, viewH, time);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = list[j].w / (list[0].w + list[j].w) * (j === 1 ? 1 : 0.5);
        ctx.drawImage(this.tmp, 0, 0);
        ctx.restore();
      }
    }
  }

  /**
   * Sol de référence du fond à cette abscisse (en cases) : celui de la lisière,
   * sauf où la zone en fixe un autre (bgRow) ; une zone en pente (bgSlope) passe
   * doucement de celui d'avant à celui d'après (la grande descente).
   */
  refRow(x) {
    const zs = this.zones;
    let i = zs.findIndex((z) => x >= z.px0 && x < z.px1);
    if (i < 0) i = x < zs[0].px0 ? 0 : zs.length - 1;
    const at = (k) => { for (let j = k; j >= 0; j--) if (zs[j].bgRow != null) return zs[j].bgRow; return REF_ROW; };
    const z = zs[i];
    if (z.bgSlope && zs[i + 1]) {
      const t = Math.max(0, Math.min(1, (x - z.px0) / (z.px1 - z.px0)));
      const a = at(i - 1), b = zs[i + 1].bgRow ?? a;
      return a + (b - a) * (t * t * (3 - 2 * t));
    }
    return at(i);
  }

  /** Base d'un plan à l'écran : il suit la caméra en hauteur d'une fraction fy. */
  planeY(pl, cam, viewH) {
    const ref = viewH * GROUND_AT, gy = this.refRow(cam.x + 240) * TILE - cam.y;
    return this.q(ref + (gy - ref) * pl.fy) - GY;
  }

  drawMood(ctx, mood, cam, viewW, viewH, time) {
    const s = this.sets[mood], m = C.MOODS[mood] ?? C.MOODS.sousbois;
    if (s.skyH !== viewH) { s.sky = paintSky(m, viewH); s.skyH = viewH; }
    ctx.drawImage(s.sky, 0, 0, 4, viewH, 0, 0, viewW, viewH);
    for (const pl of PLANES) {
      const img = s.planes[pl.id];
      const y = this.planeY(pl, cam, viewH);
      const off = this.q(cam.x * pl.fx + (pl.drift ?? 0) * time);
      this.tile(ctx, img, off, y, H, viewW);
      if (pl.mist) continue;
      // au-dessus de la bande : les fûts continuent ; en dessous : le sous-bois
      if (pl.up && y > 0) this.stretch(ctx, img, off, 0, 1, 0, y, viewW);
      if (y + H < viewH) this.stretch(ctx, img, off, H - 1, 1, y + H, viewH - (y + H), viewW);
    }
    if (s.vault) {
      // voûte de feuillage, accrochée en haut de l'image (rien ne flotte : elle sort du cadre)
      const off = this.q(cam.x * VAULT.fx);
      this.tile(ctx, s.vault, off, -6, VAULT.h, viewW);
    }
    if (s.rays) {
      const off = this.q(cam.x * 0.3 + Math.sin(time * 0.07) * 20);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 0.5);
      this.tile(ctx, s.rays, off, 0, Math.min(H, viewH), viewW, viewH / H);
      ctx.globalAlpha = 1;
    }
  }

  /** Recopie une bande périodique (décalage off) à la hauteur y. */
  tile(ctx, img, off, y, h, viewW, sy = 1) {
    let sx = ((off % W) + W) % W;
    const fl = Math.floor(sx), frac = sx - fl;
    let dx = -frac, x = fl;
    while (dx < viewW) {
      const w = Math.min(W - x, viewW - dx + 1);
      ctx.drawImage(img, x, 0, w, h, dx, y, w, h * sy);
      dx += w; x = 0;
    }
  }

  /** Étire la ligne sy de la bande sur la hauteur h (prolongement vers le haut ou le bas). */
  stretch(ctx, img, off, sy, sh, y, h, viewW) {
    if (h <= 0) return;
    let sx = ((off % W) + W) % W;
    const fl = Math.floor(sx), frac = sx - fl;
    let dx = -frac, x = fl;
    while (dx < viewW) {
      const w = Math.min(W - x, viewW - dx + 1);
      ctx.drawImage(img, x, sy, w, sh, dx, y, w, h + 0.5);
      dx += w; x = 0;
    }
  }
}
