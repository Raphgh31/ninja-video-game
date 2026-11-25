// La lumière du monde (« pixel art lumineux », 23 novembre 2026) et le cycle du jour et de la nuit.
//
// Les pixels restent nets ; tout le reste est lumière :
//   - étalonnage et liseré de lumière sur le bord des formes (dans le rendu en direct de la carte graphique,
//     src/engine/brushgl.js : shader(), passé au rendu du monde) ;
//   - le fond : brume teintée des lointains, haut du ciel qui fonce comme une estampe ; la nuit, ciel
//     nocturne, étoiles qui scintillent et lune, posés entre le ciel et les plans (backdrop()) ;
//   - un calque de lumière par-dessus le jeu (.light-layer, mélangé en « écran ») : soleil, rais, halos des
//     lanternes, poussières dorées le jour, lucioles la nuit, rougeoiement du soir (frame()) ;
//   - la nuit, l'ombre sur le monde, percée de flaques de lumière autour des lanternes (night()).
// Le cycle : 5 minutes de jour, 3 de nuit, avec des fondus de 30 s (le soir, l'aube).

import { canvas, ih } from './potager/paint.js';
import { paintMoon } from './intro.js';

export const CYCLE = { day: 300, night: 180, ramp: 30 };
const LEN = CYCLE.day + CYCLE.night;
const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** L'heure du monde : t en secondes depuis l'aube (0 … 480). */
export class DayCycle {
  constructor(t = 20) { this.t = t; }
  update(dt) { this.t = ((this.t + dt) % LEN + LEN) % LEN; }
  /** 0 le jour, 1 la nuit. */
  get night() {
    const t = this.t, h = CYCLE.ramp / 2, a = CYCLE.day - h, b = CYCLE.day + h, c = LEN - h;
    if (t < h) return 1 - ss((t + h) / CYCLE.ramp);
    if (t < a) return 0;
    if (t < b) return ss((t - a) / CYCLE.ramp);
    if (t < c) return 1;
    return 1 - ss((t - c) / CYCLE.ramp);
  }
  /** Le rougeoiement du soir et de l'aube (0 … 1, au milieu des fondus). */
  get dusk() {
    const t = this.t, h = CYCLE.ramp / 2, R = CYCLE.ramp * 1.6;
    const near = (x) => Math.max(0, 1 - Math.abs(x) / (R / 2));
    return Math.max(near(t - CYCLE.day), near(t - LEN), near(t));
  }
  /** Se place à un moment : 'matin', 'soir', 'nuit', 'aube'. */
  set(when) { this.t = { matin: 40, midi: 150, soir: CYCLE.day, nuit: CYCLE.day + 60, aube: LEN - 6 }[when] ?? this.t; }
}

/** Les réglages de lumière de chaque chapitre (couleurs, place du soleil, force des effets). */
const THEMES = {
  potager: {
    sun: [0.06, -0.06], back: false, rays: { from: 0.35, to: 1.25, n: 7 },
    haze: [204, 219, 245], hazeK: 0.26, deep: [43, 77, 158], deepK: 0.3,
    shadow: [0.2, 0.24, 0.5], high: [1, 0.84, 0.58], rim: [1, 0.88, 0.62], rimK: 0.3,
    sunCol: [255, 226, 170], sunK: 0.24, raysK: 0.2, mote: [255, 244, 214],
  },
  foret: {
    sun: [0.64, 0.3], back: true, rays: { from: 0.5, to: 2.9, n: 6 },
    haze: [242, 189, 178], hazeK: 0.22, deep: [51, 33, 87], deepK: 0.26,
    shadow: [0.22, 0.14, 0.36], high: [1, 0.7, 0.42], rim: [1, 0.72, 0.42], rimK: 0.36,
    sunCol: [255, 184, 120], sunK: 0.26, raysK: 0.24, mote: [255, 216, 130],
  },
};
const NIGHT_SKY = ['#0a0f26', '#1d2350', '#2f3466'];
const NIGHT_LAND = '#141a3c';
const NIGHT_GAME = '#10142e';
const MOON_RIM = [0.62, 0.7, 0.95];

/**
 * La lumière, peinte une fois dans une tranche de décor fixe (terrain, décors) : étalonnage (ombres froides,
 * lumières chaudes, un peu plus de couleur) et liseré de lumière sur le bord des formes, en pixels de jeu.
 * (Ce que faisait la carte graphique à chaque image : une fois pour toutes, c'est bien plus léger.)
 */
export function bakeLight(c, themeName, o = null) {
  const T = THEMES[themeName];
  if (!T || !c || !c.width || !c.height) return c;
  // o = { x, y, under } : la place de la tranche dans le monde ; ce qui est sous terre (under ≥ 0,5) garde ses
  // couleurs d'origine (la caverne, les galeries : leur ambiance ne change jamais)
  const under = o?.under ?? null, ox = o?.x ?? 0, oy = o?.y ?? 0;
  const g = c.getContext('2d', { willReadFrequently: true }), w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h), d = img.data, a0 = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a0[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  const [sr, sg, sb] = T.shadow, [hr, hg, hb] = T.high, [rr, rg, rb] = T.rim, rk = T.rimK, back = T.back;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    if (d[o + 3] < 3) continue;
    if (under && under(ox + x, oy + y) >= 0.5) continue;
    let r = d[o] / 255, gg = d[o + 1] / 255, b = d[o + 2] / 255;
    const l = r * 0.3 + gg * 0.59 + b * 0.11;
    r = l + (r - l) * 1.12; gg = l + (gg - l) * 1.12; b = l + (b - l) * 1.12;
    r = (r - 0.5) * 1.06 + 0.5; gg = (gg - 0.5) * 1.06 + 0.5; b = (b - 0.5) * 1.06 + 0.5;
    const ws = Math.max(0, Math.min(1, 1 - l * 2.2)) * 0.26, wh = Math.max(0, Math.min(1, (l - 0.55) * 2.2)) * 0.13;
    r += (sr - r) * ws; gg += (sg - gg) * ws; b += (sb - b) * ws;
    r = 1 - (1 - r) * (1 - hr * wh); gg = 1 - (1 - gg) * (1 - hg * wh); b = 1 - (1 - b) * (1 - hb * wh);
    // le liseré : le dessus des formes, et le côté tourné vers la lumière (les deux en contre-jour)
    const up = y > 0 && !a0[i - w], lf = x > 0 && !a0[i - 1], rt = x < w - 1 && !a0[i + 1];
    const e = Math.min(1, (up ? 1 : 0) + (back ? 0.5 * ((lf ? 1 : 0) + (rt ? 1 : 0)) : (lf ? 0.6 : 0))) * rk;
    if (e > 0) { r = 1 - (1 - r) * (1 - rr * e); gg = 1 - (1 - gg) * (1 - rg * e); b = 1 - (1 - b) * (1 - rb * e); }
    d[o] = r * 255; d[o + 1] = gg * 255; d[o + 2] = b * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

export class Lights {
  /** gameCanvas : le calque du jeu ; le calque de lumière se pose juste au-dessus. */
  constructor(gameCanvas) {
    this.el = document.createElement('canvas');
    this.el.className = 'light-layer';
    this.el.hidden = true;
    gameCanvas.after(this.el);
    this.vig = document.createElement('div');
    this.vig.className = 'vignette';
    this.vig.hidden = true;
    this.el.after(this.vig);
    this.g = this.el.getContext('2d');
    this.dark = canvas(1, 1);                      // l'ombre de la nuit sur le monde, percée de lumière
    this.warm = canvas(1, 1);                      // la teinte chaude des flaques de lumière
    this.planes = null;                            // les plans du fond, la nuit (dessinés à part)
    this.moon = paintMoon(13);
    this.stars = Array.from({ length: 90 }, (_, i) => ({ x: ih(i, 1, 71), y: ih(i, 2, 71) ** 1.4 * 0.55, b: ih(i, 3, 71), p: ih(i, 4, 71) * 6.28, big: ih(i, 5, 71) > 0.93 }));
    this.motes = Array.from({ length: 34 }, (_, i) => ({ x: ih(i, 6, 73), y: 0.12 + ih(i, 7, 73) * 0.78, s: 0.4 + ih(i, 8, 73), p: ih(i, 9, 73) * 6.28, f: 0.35 + ih(i, 10, 73) * 0.5 }));
    this.rayCache = new Map();
    this.quality = 2;                              // 2 : tout ; 1 : sans les rais ; 0 : ni rais ni poussières (appareils lents)
  }

  theme(level) { return THEMES[level?.theme] ?? null; }

  /** Montre ou cache les calques (seulement dans les chapitres). */
  show(on) { this.el.hidden = !on; this.vig.hidden = !on; }

  resize(w, h, cssW, cssH) {
    if (this.el.width !== w || this.el.height !== h) { this.el.width = w; this.el.height = h; }
    this.el.style.width = cssW; this.el.style.height = cssH;
    this.vig.style.width = cssW; this.vig.style.height = cssH;
    for (const c of [this.dark, this.warm]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  /** Les réglages du rendu du monde (étalonnage, liseré), selon l'heure. */
  shader(level, cycle) {
    const T = this.theme(level);
    if (!T) return null;
    const n = cycle.night, d = cycle.dusk;
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    return {
      grade: 1 - 0.4 * n,
      rim: T.rimK * (1 - n) + 0.16 * n,
      back: T.back,
      shadow: mix(T.shadow, [0.12, 0.14, 0.34], n),
      high: mix(T.high, [1, 0.62, 0.36], d * 0.7),
      rimCol: mix(mix(T.rim, [1, 0.62, 0.36], d * 0.6), MOON_RIM, n),
    };
  }

  /**
   * Le fond : de jour, les plans puis la brume et le ciel d'estampe ; la nuit, le ciel, le ciel nocturne,
   * les étoiles et la lune, puis les plans (dessinés à part et assombris : la lune reste derrière eux).
   */
  /** Sous terre (0 … 1, adouci) : là où est le ninja ; le cycle du jour et de la nuit ne descend pas sous terre. */
  underAt(level, cam, w, h, time) {
    const p = level.player, f = level.art?.undergroundAt;
    const u = f ? (p ? level.art.undergroundAt(p.x, p.y - 14) : level.art.undergroundAt(cam.x + w / 2, cam.y + h / 2)) : 0;
    const dt = Math.min(0.1, Math.max(0, time - (this.uT ?? time))); this.uT = time;
    this.uS = this.uS == null ? u : this.uS + (u - this.uS) * Math.min(1, dt * 2.5);
    return this.uS;
  }

  backdrop(bg, backdrop, level, cam, w, h, time, k, cycle) {
    const under = this.underAt(level, cam, w, h, time);
    backdrop.under = under;
    // (le ciel et les plans du fond gardent l'heure : seul ce qui est sous terre y échappe, dans night())
    // (dans une zone toute souterraine, la caverne, le fond aussi reste hors du cycle)
    const zc = level.art?.caveAt?.(cam.x + w / 2) ?? 0;
    const T = this.theme(level), n = T ? cycle.night * (1 - zc) : 0, d = T ? cycle.dusk * (1 - zc) : 0;
    if (n < 0.01 || !backdrop.drawSkyOnly) {
      backdrop.draw(bg, cam, w, h, time, k);
    } else {
      backdrop.drawSkyOnly(bg, cam, w, h, time);
      // le ciel de nuit, par-dessus celui du jour, et un rougeoiement à l'horizon au soir
      const gr = bg.createLinearGradient(0, 0, 0, h * 0.8);
      gr.addColorStop(0, NIGHT_SKY[0]); gr.addColorStop(0.6, NIGHT_SKY[1]); gr.addColorStop(1, NIGHT_SKY[2]);
      bg.globalAlpha = n; bg.fillStyle = gr; bg.fillRect(0, 0, w, h); bg.globalAlpha = 1;
      if (d > 0.01) {
        const gw = bg.createLinearGradient(0, h * 0.25, 0, h * 0.8);
        gw.addColorStop(0, 'rgba(255,140,90,0)'); gw.addColorStop(1, `rgba(255,140,90,${(0.45 * d).toFixed(3)})`);
        bg.fillStyle = gw; bg.fillRect(0, 0, w, h);
      }
      // les étoiles, qui scintillent
      for (const s of this.stars) {
        const a = n * (0.35 + 0.65 * s.b) * (0.55 + 0.45 * Math.sin(time * (1.1 + s.b) + s.p));
        if (a < 0.05) continue;
        const x = Math.round(((s.x * w - cam.x * 0.004) % w + w) % w), y = Math.round(s.y * h);
        bg.globalAlpha = Math.min(1, a);
        bg.fillStyle = s.big ? '#fff6dc' : '#dfe6ff';
        bg.fillRect(x, y, 1, 1);
        if (s.big && a > 0.6) { bg.globalAlpha = a * 0.35; bg.fillRect(x - 1, y, 3, 1); bg.fillRect(x, y - 1, 1, 3); }
      }
      // la lune : elle monte en même temps que la nuit tombe
      const M = this.moon, mx = Math.round(w * 0.74 - cam.x * 0.003), my = Math.round(h * (0.46 - 0.3 * n));
      bg.globalAlpha = Math.min(1, n * 1.2);
      bg.imageSmoothingEnabled = false;
      bg.drawImage(M.c, mx - M.o, my - M.o);
      bg.globalAlpha = 1;
      // les plans, à part, assombris (seulement leurs pixels), puis posés sur le ciel
      const cw = bg.canvas.width, ch = bg.canvas.height;
      if (!this.planes || this.planes.width !== cw || this.planes.height !== ch) this.planes = canvas(cw, ch);
      const p = this.planes.getContext('2d');
      p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, cw, ch);
      p.setTransform(k, 0, 0, k, 0, 0); p.imageSmoothingEnabled = false;
      backdrop.draw(p, cam, w, h, time, k, false);
      p.setTransform(1, 0, 0, 1, 0, 0);
      p.globalCompositeOperation = 'source-atop';
      p.globalAlpha = 0.68 * n; p.fillStyle = NIGHT_LAND; p.fillRect(0, 0, cw, ch);
      if (d > 0.01) { p.globalAlpha = 0.16 * d; p.fillStyle = '#ff9a5a'; p.fillRect(0, 0, cw, ch); }
      p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';
      bg.save(); bg.setTransform(1, 0, 0, 1, 0, 0); bg.drawImage(this.planes, 0, 0); bg.restore();
    }
    if (!T) return;
    if (level.art?.caveAt?.(cam.x + w / 2)) return;   // (sous terre : ni brume ni ciel)
    // le jour : la brume des lointains (plus haut = plus loin) et le haut du ciel qui fonce (estampe)
    const day = (1 - n) * (1 - under);
    if (day > 0.01) {
      const hz = bg.createLinearGradient(0, 0, 0, h * 0.82);
      hz.addColorStop(0, rgba(T.haze, T.hazeK * day)); hz.addColorStop(1, rgba(T.haze, 0));
      bg.fillStyle = hz; bg.fillRect(0, 0, w, h);
      const dp = bg.createLinearGradient(0, 0, 0, h * 0.32);
      dp.addColorStop(0, rgba(T.deep, T.deepK * day)); dp.addColorStop(1, rgba(T.deep, 0));
      bg.fillStyle = dp; bg.fillRect(0, 0, w, h);
      if (d > 0.01 && n < 0.01) {
        const gw = bg.createLinearGradient(0, h * 0.2, 0, h);
        gw.addColorStop(0, 'rgba(255,140,90,0)'); gw.addColorStop(1, `rgba(255,140,90,${(0.3 * d).toFixed(3)})`);
        bg.fillStyle = gw; bg.fillRect(0, 0, w, h);
      }
    }
  }

  /** La nuit sur le monde (calque du jeu) : l'ombre, percée de flaques de lumière chaude autour des lanternes. */
  night(ctx, level, cam, w, h, sources, cycle) {
    const T = this.theme(level), n = T ? cycle.night : 0, d = T ? cycle.dusk : 0;
    if (n < 0.01 && d < 0.01) return;
    const dg = this.dark.getContext('2d'), wg = this.warm.getContext('2d');
    dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, w, h);
    dg.fillStyle = NIGHT_GAME; dg.globalAlpha = 0.66 * n; dg.fillRect(0, 0, w, h); dg.globalAlpha = 1;
    if (d > 0.01) { dg.fillStyle = `rgba(255,130,70,${(0.14 * d).toFixed(3)})`; dg.fillRect(0, 0, w, h); }
    dg.globalCompositeOperation = 'destination-out';
    wg.clearRect(0, 0, w, h);
    // sous terre, ni nuit ni soir : on y retire l'ombre (avec un fondu sous le bord haut)
    for (const r of level.art?.undergroundRects?.() ?? []) {
      const x0 = Math.max(-1, r.x0 - cam.x), x1 = Math.min(w + 1, r.x1 - cam.x), y0 = Math.max(-1, r.y0 - cam.y), y1 = Math.min(h + 1, r.y1 - cam.y);
      if (x1 <= x0 || y1 <= y0) continue;
      if (r.fade > 0 && r.y0 - cam.y > -r.fade) {
        const top = r.y0 - cam.y, gr = dg.createLinearGradient(0, top, 0, top + r.fade);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        dg.fillStyle = gr;
      } else dg.fillStyle = '#000';
      dg.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    for (const s of sources) {
      const x = s.x - cam.x, y = s.y - cam.y, R = 52 * s.r;
      if (x < -R || x > w + R || y < -R || y > h + R) continue;
      const fl = 0.93 + 0.07 * Math.sin(cycle.t * 7 + s.x);
      let gr = dg.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(0,0,0,${(0.78 * s.k * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.fillRect(x - R, y - R, R * 2, R * 2);
      gr = wg.createRadialGradient(x, y, 0, x, y, R * 0.8);
      gr.addColorStop(0, `rgba(255,170,90,${(0.34 * s.k * n * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,170,90,0)');
      wg.fillStyle = gr; wg.fillRect(x - R, y - R, R * 2, R * 2);
    }
    dg.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';   // (seulement là où le monde est peint : le fond a sa nuit)
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.dark, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(this.warm, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  /** Les rais du soleil, peints une fois par chapitre et par taille d'image (à basse définition : doux). */
  raysOf(T, w, h) {
    const key = `${T.sun}|${w}|${h}`;
    let c = this.rayCache.get(key);
    if (c) return c;
    const q = 4, cw = Math.ceil(w / q), ch = Math.ceil(h / q);
    c = canvas(cw, ch);
    const g = c.getContext('2d'), sx = T.sun[0] * cw, sy = T.sun[1] * ch, L = Math.hypot(cw, ch);
    for (let i = 0; i < T.rays.n; i++) {
      const a = T.rays.from + (T.rays.to - T.rays.from) * (i + 0.5 + (ih(i, 1, 91) - 0.5) * 0.7) / T.rays.n;
      const wd = 0.03 + ih(i, 2, 91) * 0.045, k = 0.45 + ih(i, 3, 91) * 0.55;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, L * 0.95);
      gr.addColorStop(0, `rgba(255,255,255,${k.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(a - wd) * L, sy + Math.sin(a - wd) * L);
      g.lineTo(sx + Math.cos(a + wd) * L, sy + Math.sin(a + wd) * L);
      g.closePath(); g.fill();
    }
    this.rayCache.set(key, c);
    return c;
  }

  /** Le calque de lumière (mélangé en « écran ») : soleil, rais, halos, poussières ou lucioles, soir. */
  frame(level, cam, w, h, time, sources, cycle) {
    const g = this.g, T = this.theme(level);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!T) return;
    const under = this.uS ?? 0, cave = Math.max(under, level.art?.caveAt?.(cam.x + w / 2) ?? 0);
    const n = cycle.night * (1 - cave), d = cycle.dusk * (1 - cave), day = (1 - cycle.night) * (1 - cave);
    g.imageSmoothingEnabled = true;
    // le soleil et ses rais sont accrochés au ciel : quand la caméra descend (sous terre, au fond d'un ravin),
    // ils restent en haut et sortent de l'image au lieu de la suivre
    const bd = level.art?.backdrop, sky = bd?.groundAt ? Math.min(0, bd.groundAt(1, cam, h) - Math.round(h * 0.86)) : 0;
    g.save(); g.translate(0, sky);
    if (day > 0.01) {
      // le soleil qui baigne la scène depuis sa direction, et ses rais qui respirent lentement
      const sx = T.sun[0] * w, sy = T.sun[1] * h, R = Math.max(w, h) * 0.85;
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, R);
      sg.addColorStop(0, rgba(T.sunCol, T.sunK * day)); sg.addColorStop(1, rgba(T.sunCol, 0));
      g.fillStyle = sg; g.fillRect(0, 0, w, h);
      if (this.quality >= 2) {
        g.globalAlpha = T.raysK * day * (0.8 + 0.2 * Math.sin(time * 0.35));
        g.drawImage(this.raysOf(T, w, h), 0, 0, w, h);
        g.globalAlpha = 1;
      }
    }
    g.restore();
    if (d > 0.01) {
      const gw = g.createLinearGradient(0, h * 0.3, 0, h);
      gw.addColorStop(0, 'rgba(255,120,60,0)'); gw.addColorStop(1, `rgba(255,120,60,${(0.16 * d).toFixed(3)})`);
      g.fillStyle = gw; g.fillRect(0, 0, w, h);
    }
    // halos des lanternes (plus présents la nuit)
    for (const s of sources) {
      const x = s.x - cam.x, y = s.y - cam.y, R = (18 + 18 * n) * s.r * 1.6;
      if (x < -R || x > w + R || y < -R || y > h + R) continue;
      const fl = 0.9 + 0.1 * Math.sin(time * 6.3 + s.x * 0.1) * Math.sin(time * 3.1 + s.y);
      const a = (0.2 + 0.34 * n) * s.k * fl;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(255,190,110,${a.toFixed(3)})`); gr.addColorStop(0.35, `rgba(255,160,80,${(a * 0.45).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,150,70,0)');
      g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    // poussières dorées le jour, lucioles la nuit (au pixel près, avec un petit halo)
    for (const m of this.quality >= 1 ? this.motes : []) {
      const x = Math.round(((m.x * w * 1.3 - cam.x * m.f + Math.sin(time * 0.3 * m.s + m.p) * 14 + time * 3 * m.s) % w + w) % w);
      const y = Math.round(m.y * h + Math.sin(time * 0.5 * m.s + m.p * 2) * 8 - (cam.y * m.f * 0.2) % 20);
      const tw = 0.5 + 0.5 * Math.sin(time * (n > 0.5 ? 2.2 : 1.2) * m.s + m.p);
      const a = (day * 0.45 + n * 0.85) * tw * (1 - cave);
      if (a < 0.05) continue;
      const col = n > 0.5 ? [220, 255, 140] : T.mote;
      g.fillStyle = rgba(col, a * 0.25); g.fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle = rgba(col, a); g.fillRect(x, y, 1, 1);
    }
  }
}
