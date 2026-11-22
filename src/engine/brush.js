// Le « pinceau » : repeint une image en pixels en petites touches d'aquarelle (essai du 22 novembre 2026,
// demande de Raph : variante B, des touches petites au premier plan et sur les détails, plus larges au
// loin ; elles suivent les formes ; contours fins seulement au premier plan ; le ninja traité comme le
// décor). L'image d'origine reste la source : on retouche les pixels comme avant, le pinceau refait la
// version peinte tout seul.
//
// Chaque pixel devient une touche : une ellipse allongée (longueur et largeur en pixels de jeu), de la
// couleur du pixel (un peu variée), orientée le long des contours (tenseur de structure), dont le bord
// est un peu plus chargé (le pigment s'accumule) et la fin s'effile. Les touches sont tirées d'un hasard
// fixé par la position : la même image donne toujours la même peinture (pas de « grouillement »).
// La sortie est P fois plus fine que l'image (P pixels de toile par pixel de jeu), découpée en tuiles
// (une toile ne peut pas être trop large).
import { canvas } from '../game/potager/paint.js';

const hash = (x, y, s) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Flou en boîte séparable (rayon r) d'un champ w × h, sur place. */
function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      t[y * w + x] = s / (2 * r + 1);
      s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s / (2 * r + 1);
      s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x];
    }
  }
}

/**
 * Repeint une toile. o : { P = 3 (finesse), len, wid (taille d'une touche, en pixels de jeu), step = 1
 * (une touche tous les step pixels), jitter (variation des couleurs), rim (bord plus chargé), horiz (touches
 * horizontales, pour le ciel), plume (contour fin autour des formes), seed, tile (largeur d'une tuile) }.
 * Rend { tiles: [{ x0, w, c }], P, w, h } ; à dessiner avec blit().
 */
export function paintCanvas(src, o = {}) {
  const P = o.P ?? 3, len = o.len ?? 2, wid = o.wid ?? 1.1, step = o.step ?? 1, seed = o.seed ?? 1;
  const jitter = o.jitter ?? 0.05, rim = o.rim ?? 0.14, TW = o.tile ?? 1024;
  if (!src.getContext) { const c = canvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); src = c; }   // (une image chargée)
  const w = src.width, h = src.height;
  const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  // l'orientation : le long des contours (tenseur de structure lissé) ; horizontale dans les aplats
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = sd[i * 4 + 3] < 8 ? 0 : 0.3 * sd[i * 4] + 0.55 * sd[i * 4 + 1] + 0.15 * sd[i * 4 + 2];
  const jxx = new Float32Array(w * h), jyy = new Float32Array(w * h), jxy = new Float32Array(w * h);
  if (!o.horiz) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1] + 0.5 * (lum[i - w + 1] - lum[i - w - 1] + lum[i + w + 1] - lum[i + w - 1]);
      const gy = lum[i + w] - lum[i - w] + 0.5 * (lum[i + w - 1] - lum[i - w - 1] + lum[i + w + 1] - lum[i - w + 1]);
      jxx[i] = gx * gx; jyy[i] = gy * gy; jxy[i] = gx * gy;
    }
    const r = Math.max(1, Math.round(len));
    boxBlur(jxx, w, h, r); boxBlur(jyy, w, h, r); boxBlur(jxy, w, h, r);
  }
  const tiles = [];
  const R = Math.ceil(len) + 1;
  for (let x0 = 0; x0 < w; x0 += TW) {
    const tw = Math.min(TW, w - x0), OW = tw * P, OH = h * P;
    const c = canvas(OW, OH), g = c.getContext('2d');
    const img = g.createImageData(OW, OH), d = img.data;
    // le fond : l'image d'origine, agrandie (sous les touches, il n'en reste presque rien)
    for (let y = 0; y < OH; y++) {
      const sy = (y / P) | 0;
      for (let x = 0; x < OW; x++) {
        const si = (sy * w + x0 + ((x / P) | 0)) * 4, oi = (y * OW + x) * 4;
        d[oi] = sd[si]; d[oi + 1] = sd[si + 1]; d[oi + 2] = sd[si + 2]; d[oi + 3] = sd[si + 3];
      }
    }
    const A = len * P / 2, B = wid * P / 2;
    // quatre passes mêlées : les touches se recouvrent dans un ordre qui varie
    for (let pass = 0; pass < 4; pass++) {
      for (let y = 0; y < h; y += 1) {
        for (let x = Math.max(0, x0 - R); x < Math.min(w, x0 + tw + R); x += 1) {
          if (step > 1 && ((x % step) || (y % step))) continue;
          const hv = hash(x, y, seed);
          if (((hv * 4) | 0) !== pass) continue;
          const si = (y * w + x) * 4, sa = sd[si + 3];
          if (sa < 10) continue;
          const i = y * w + x;
          let ang;
          if (o.horiz) ang = (hash(x, y, seed + 7) - 0.5) * 0.25;
          else {
            const a = jxx[i], b = jyy[i], cxy = jxy[i];
            const coh = Math.sqrt((a - b) * (a - b) + 4 * cxy * cxy) / (a + b + 1e-3);
            ang = coh > 0.2 ? 0.5 * Math.atan2(2 * cxy, a - b) + Math.PI / 2 : (hash(x, y, seed + 7) - 0.5) * 0.5;
            ang += (hash(x, y, seed + 3) - 0.5) * 0.35;
          }
          const k = 1 + (hash(x, y, seed + 5) - 0.5) * 2 * jitter;
          const r0 = sd[si] * k, g0 = sd[si + 1] * k, b0 = sd[si + 2] * k;
          const sz = 0.8 + hash(x, y, seed + 9) * 0.45;
          const a2 = A * sz, b2 = B * (0.85 + hash(x, y, seed + 11) * 0.3);
          const ca = Math.cos(ang), sa2 = Math.sin(ang);
          const cx = (x - x0 + 0.5) * P + (hash(x, y, seed + 13) - 0.5) * P * 0.6;
          const cy = (y + 0.5) * P + (hash(x, y, seed + 17) - 0.5) * P * 0.6;
          const rr = Math.ceil(a2) + 1;
          const xa = Math.max(0, Math.floor(cx - rr)), xb = Math.min(OW - 1, Math.ceil(cx + rr));
          const ya = Math.max(0, Math.floor(cy - rr)), yb = Math.min(OH - 1, Math.ceil(cy + rr));
          for (let py = ya; py <= yb; py++) {
            const dy = py + 0.5 - cy;
            for (let px = xa; px <= xb; px++) {
              const dx = px + 0.5 - cx;
              const u = (dx * ca + dy * sa2) / a2, v = (-dx * sa2 + dy * ca) / b2;
              const e = u * u + v * v;
              if (e > 1) continue;
              // la touche s'effile vers sa fin ; son bord est plus chargé
              const t = (u + 1) / 2;
              let s = 0.88 * (t > 0.72 ? 1 - (t - 0.72) * 2.2 : 1);
              if (s <= 0) continue;
              const dk = e > 0.62 ? 1 - rim : 1;
              const oi = (py * OW + px) * 4, oa = d[oi + 3];
              if (oa < 10) { d[oi] = r0 * dk; d[oi + 1] = g0 * dk; d[oi + 2] = b0 * dk; d[oi + 3] = sa * s; continue; }
              d[oi] += (r0 * dk - d[oi]) * s; d[oi + 1] += (g0 * dk - d[oi + 1]) * s; d[oi + 2] += (b0 * dk - d[oi + 2]) * s;
              if (sa * s > oa) d[oi + 3] = sa * s;
            }
          }
        }
      }
    }
    // le contour fin, à la plume, autour des formes (le premier plan)
    if (o.plume) {
      const pc = o.plumeCol ?? [40, 32, 26], pa = o.plumeA ?? 0.5;
      const al = new Uint8Array(OW * OH);
      for (let i = 0; i < OW * OH; i++) al[i] = d[i * 4 + 3] > 120 ? 1 : 0;
      for (let y = 1; y < OH - 1; y++) for (let x = 1; x < OW - 1; x++) {
        const i = y * OW + x;
        if (!al[i] || (al[i - 1] && al[i + 1] && al[i - OW] && al[i + OW])) continue;
        if (hash(x >> 2, y >> 2, seed + 21) < 0.18) continue;                    // le trait s'interrompt par endroits
        const s = pa * (0.7 + 0.3 * hash(x, y, seed + 23)), oi = i * 4;
        d[oi] += (pc[0] - d[oi]) * s; d[oi + 1] += (pc[1] - d[oi + 1]) * s; d[oi + 2] += (pc[2] - d[oi + 2]) * s;
      }
    }
    g.putImageData(img, 0, 0);
    tiles.push({ x0, w: tw, c });
  }
  return { tiles, P, w, h };
}

/**
 * Dessine une partie (sx, sy, sw, sh, en pixels de jeu) d'une image peinte, en (dx, dy), à la taille dw × dh
 * (par défaut sw × sh) : comme ctx.drawImage, mais à travers les tuiles.
 */
export function blit(ctx, pc, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
  const kx = dw / sw, ky = dh / sh, P = pc.P;
  for (const t of pc.tiles) {
    const a = Math.max(sx, t.x0), b = Math.min(sx + sw, t.x0 + t.w);
    if (b <= a) continue;
    ctx.drawImage(t.c, (a - t.x0) * P, sy * P, (b - a) * P, sh * P, dx + (a - sx) * kx, dy, (b - a) * kx, dh);
  }
}

/** Une feuille de sprites repeinte : une seule toile (pas de tuiles), avec son facteur P. */
export function paintSheet(sheet, o = {}) {
  const pc = paintCanvas(sheet, { len: 1.6, wid: 1.0, jitter: 0.04, rim: 0.12, tile: 1 << 20, ...o });
  const c = pc.tiles[0].c;
  c.P = pc.P;
  return c;
}
