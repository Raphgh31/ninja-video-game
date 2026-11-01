// Illustration du chapitre 1 (Le Potager), au stade greybox : fond en parallaxe
// (le début d'une grande aventure : montagnes enneigées au loin), tuiles et
// décors dessinés pixel par pixel. Ces dessins seront remplacés par les décors
// définitifs après validation des planches de design.
const TILE = 16;   // taille d'une tuile (comme level.js, sans import circulaire)

const R = Math.round;
const PAL = {
  sky: ['#a7c4d6', '#b5cdd9', '#c3d6da', '#d2ddd8', '#e0e2d2', '#ebe3c9'],
  far: '#9fb1c2', farShade: '#8ea1b4', snow: '#eef2f2', snowShade: '#d3dde3',
  mid: '#87a39b', midShade: '#7a968e',
  hill: '#7f9e6c', hillLight: '#93b07a', hillDark: '#6c8a5b',
  roof: '#5b4a46', wall: '#d8cdb4', pagoda: '#6e3d36',
  trees: '#5d7c52', treesDark: '#4f6c46',
  cloud: '#f1f4f1', cloudShade: '#dfe7e7',
  paddy: '#a9c98a', paddyWater: '#b9d4d4',
  soil: '#8a6a46', soilDark: '#76593a', soilLight: '#9a7a52',
  grass: '#7fb05a', grassLight: '#9cc96a', grassDark: '#5d8a42',
  wood: '#a77a4a', woodLight: '#c8965c', woodDark: '#6b4a2b',
  bamboo: '#8fb070', bambooLight: '#b5d18e', bambooDark: '#6d8f52',
  crate: '#b07d45', crateDark: '#6b4a2b',
  water: '#5fa8b8', waterLight: '#9fd4dc', waterDeep: '#4b8fa1', lily: '#6aa055',
};

// petit hasard déterministe (même dessin à chaque image)
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// fond en parallaxe
// ---------------------------------------------------------------------------
const FAR_PEAKS = [
  { p: 40, h: 118, s: 0.95 }, { p: 210, h: 158, s: 1.05 }, { p: 330, h: 104, s: 0.85 },
  { p: 470, h: 142, s: 1.0 }, { p: 600, h: 96, s: 0.8 },
];
const FAR_PERIOD = 700;

function ridgeFar(wx) {
  let best = 0;
  for (const pk of FAR_PEAKS) {
    let d = Math.abs(((wx - pk.p) % FAR_PERIOD + FAR_PERIOD) % FAR_PERIOD);
    d = Math.min(d, FAR_PERIOD - d);
    // flancs irréguliers : petites cassures pour un relief en pixel art
    const h = pk.h - d * pk.s - (Math.floor(d / 7) % 2) * 2;
    if (h > best) best = h;
  }
  return best;
}

export function drawBackground(ctx, cam, viewW, viewH, level, time) {
  const groundY = R(19 * TILE - cam.y);            // haut du sol de référence, à l'écran
  // ciel : bandes, plus chaudes vers l'horizon
  const skyTop = groundY - 230;
  for (let i = 0; i < PAL.sky.length; i++) {
    ctx.fillStyle = PAL.sky[i];
    const y0 = i === 0 ? 0 : skyTop + i * 26;
    ctx.fillRect(0, y0, viewW, viewH);
  }
  // nuages qui dérivent lentement
  for (let i = 0; i < 6; i++) {
    const span = viewW + 140;
    const cx = (((i * 173 + time * (3 + i % 3)) - cam.x * 0.04) % span + span) % span - 70;
    const cy = groundY - 205 + (i % 3) * 22 + (i % 2) * 7;
    const w = 26 + (i % 3) * 12;
    ctx.fillStyle = PAL.cloudShade;
    ctx.fillRect(R(cx), R(cy) + 3, w, 4);
    ctx.fillStyle = PAL.cloud;
    ctx.fillRect(R(cx) + 3, R(cy), w - 8, 4);
    ctx.fillRect(R(cx) + 8, R(cy) - 3, w - 18, 3);
  }
  // grandes montagnes enneigées : très loin (elles bougent à peine)
  const baseFar = groundY - 44;
  for (let sx = 0; sx < viewW; sx++) {
    const wx = sx + cam.x * 0.06;
    const h = ridgeFar(wx);
    if (h <= 0) continue;
    const top = baseFar - R(h);
    const slope = ridgeFar(wx + 1) - h;
    ctx.fillStyle = slope > 0 ? PAL.far : PAL.farShade;
    ctx.fillRect(sx, top, 1, baseFar - top + 2);
    if (h > 78) {                                    // neiges éternelles
      const snow = R((h - 78) * 0.55) + 2;
      ctx.fillStyle = slope > 0 ? PAL.snow : PAL.snowShade;
      ctx.fillRect(sx, top, 1, snow);
    }
  }
  // montagnes moyennes, plus proches
  const baseMid = groundY - 22;
  for (let sx = 0; sx < viewW; sx++) {
    const wx = sx + cam.x * 0.14;
    const h = 46 + 18 * Math.sin(wx / 53) + 12 * Math.sin(wx / 23 + 1.7) + 6 * Math.sin(wx / 9);
    const top = baseMid - R(h);
    ctx.fillStyle = Math.sin(wx / 53 + 0.4) > Math.sin(wx / 53) ? PAL.mid : PAL.midShade;
    ctx.fillRect(sx, top, 1, viewH);
  }
  // collines cultivées, village, pagode ; rizières au loin vers la fin du chapitre
  const baseHill = groundY - 6;
  const f = 0.3;
  const endZone = level.zones.length ? level.zones[level.zones.length - 1].x0 : Infinity;
  for (let sx = 0; sx < viewW; sx++) {
    const wx = sx + cam.x * f;
    const h = 24 + 10 * Math.sin(wx / 37) + 5 * Math.sin(wx / 13 + 2);
    const top = baseHill - R(h);
    ctx.fillStyle = PAL.hill;
    ctx.fillRect(sx, top, 1, viewH);
    ctx.fillStyle = PAL.hillLight;
    ctx.fillRect(sx, top, 1, 2);
    // rizières en terrasses : elles apparaissent quand on approche de la sortie
    const worldX = wx / f;
    if (worldX > endZone - 300) {
      for (let k = 0; k < 4; k++) {
        const ly = top + 5 + k * 5;
        ctx.fillStyle = (k + Math.floor(wx / 19)) % 2 ? PAL.paddyWater : PAL.paddy;
        ctx.fillRect(sx, ly, 1, 2);
      }
    }
  }
  // maisons et pagode sur les collines
  for (let i = 0; i < 8; i++) {
    const hx = i * 160 + 40;
    const sx = R(hx - cam.x * f) % (viewW + 400);
    if (sx < -30 || sx > viewW + 30) continue;
    const top = baseHill - R(24 + 10 * Math.sin((sx + cam.x * f) / 37) + 5 * Math.sin((sx + cam.x * f) / 13 + 2));
    if (i % 4 === 2) {                               // pagode à étages
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = PAL.pagoda;
        ctx.fillRect(sx - 8 + k * 2, top - 6 - k * 6, 17 - k * 4, 2);
        ctx.fillStyle = PAL.wall;
        ctx.fillRect(sx - 5 + k * 2, top - 4 - k * 6, 11 - k * 4, 4);
      }
      ctx.fillStyle = PAL.pagoda;
      ctx.fillRect(sx, top - 32, 1, 6);
    } else {
      ctx.fillStyle = PAL.wall;
      ctx.fillRect(sx - 5, top - 5, 11, 5);
      ctx.fillStyle = PAL.roof;
      ctx.fillRect(sx - 7, top - 8, 15, 3);
      ctx.fillRect(sx - 5, top - 9, 11, 1);
    }
  }
  // lisière d'arbres, juste derrière le potager
  const baseTrees = groundY + 2;
  for (let sx = 0; sx < viewW; sx++) {
    const wx = sx + cam.x * 0.55;
    const k = Math.floor(wx / 9);
    const local = wx - k * 9;
    const crown = 10 + hash(k) * 14;
    const h = crown - Math.abs(local - 4.5) * 1.1;
    ctx.fillStyle = hash(k + 7) > 0.5 ? PAL.trees : PAL.treesDark;
    ctx.fillRect(sx, baseTrees - R(h) - 6, 1, viewH);
  }
}

// ---------------------------------------------------------------------------
// fonds de zone (intérieur de la serre, de la grange)
// ---------------------------------------------------------------------------
export function drawBackdrops(ctx, cam, level, time) {
  for (const b of level.backdrops) {
    const x0 = b.x0 * TILE - R(cam.x), x1 = b.x1 * TILE - R(cam.x);
    const y0 = b.y0 * TILE - R(cam.y), y1 = b.y1 * TILE - R(cam.y);
    if (x1 < 0 || x0 > 2000) continue;
    if (b.type === 'serre') {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#b9cfa9';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.bambooDark;
      for (let x = x0; x < x1; x += 3 * TILE) ctx.fillRect(x, y0, 2, y1 - y0);
      // pluie : les gouttes glissent sur la toile et tombent sur les feuilles
      ctx.fillStyle = '#e3eef0';
      for (let i = 0; i < 24; i++) {
        const dx = R(hash(i) * (x1 - x0));
        const dy = R(((time * 70 + hash(i + 3) * 200) % (y1 - y0)));
        ctx.fillRect(x0 + dx, y0 + dy, 1, 3);
      }
    } else if (b.type === 'grange') {
      ctx.fillStyle = '#3d2e23';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#4a382a';
      for (let y = y0 + 6; y < y1; y += 9) ctx.fillRect(x0, y, x1 - x0, 1);
      ctx.fillStyle = '#2e2219';
      for (let x = x0 + 40; x < x1; x += 96) ctx.fillRect(x, y0, 4, y1 - y0);   // poteaux
      // rais de lumière à travers les planches
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#f6dd8a';
      for (let x = x0 + 70; x < x1; x += 130) ctx.fillRect(x, y0, 6, y1 - y0);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// tuiles
// ---------------------------------------------------------------------------
export function drawTile(ctx, t, sx, sy, level, tx, ty, time) {
  const open = (dx, dy) => !level.solid(tx + dx, ty + dy) && level.at(tx + dx, ty + dy) !== '~';
  if (t === '#') {
    ctx.fillStyle = PAL.soil;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = PAL.soilDark;
    const n = hash(tx * 31 + ty * 17);
    ctx.fillRect(sx + R(n * 11) + 1, sy + 5 + R(n * 6), 3, 2);
    ctx.fillRect(sx + R(hash(tx + ty * 7) * 12) + 1, sy + 11, 2, 1);
    ctx.fillStyle = PAL.soilLight;
    ctx.fillRect(sx + R(hash(tx * 3 + ty) * 13), sy + 2 + R(n * 4), 2, 1);
    if (open(-1, 0)) { ctx.fillStyle = PAL.soilDark; ctx.fillRect(sx, sy, 1, TILE); }
    if (open(1, 0)) { ctx.fillStyle = PAL.soilDark; ctx.fillRect(sx + TILE - 1, sy, 1, TILE); }
    if (open(0, -1)) {                               // herbe sur le dessus
      ctx.fillStyle = PAL.grassDark;
      ctx.fillRect(sx, sy + 3, TILE, 1);
      ctx.fillStyle = PAL.grass;
      ctx.fillRect(sx, sy, TILE, 3);
      ctx.fillStyle = PAL.grassLight;
      for (let k = 0; k < 3; k++) ctx.fillRect(sx + R(hash(tx * 5 + k) * 14), sy - 1, 1, 2);
    }
  } else if (t === '=') {
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = PAL.woodLight;
    ctx.fillRect(sx, sy, TILE, 2);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
    ctx.fillRect(sx + ((tx % 2) ? 5 : 11), sy + 2, 1, TILE - 4);
    ctx.fillRect(sx, sy + 8, TILE, 1);
  } else if (t === '|') {
    ctx.fillStyle = PAL.bambooDark;
    ctx.fillRect(sx, sy, TILE, TILE);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = PAL.bamboo;
      ctx.fillRect(sx + 1 + k * 5, sy, 4, TILE);
      ctx.fillStyle = PAL.bambooLight;
      ctx.fillRect(sx + 1 + k * 5, sy, 1, TILE);
      ctx.fillStyle = PAL.bambooDark;
      ctx.fillRect(sx + 1 + k * 5, sy + ((tx + k + ty) % 2 ? 4 : 11), 4, 1);   // nœuds
    }
  } else if (t === 'B') {
    ctx.fillStyle = PAL.crateDark;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = PAL.crate;
    ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = PAL.crateDark;
    ctx.fillRect(sx + 1, sy + 7, TILE - 2, 1);
    for (let k = 0; k < 12; k++) ctx.fillRect(sx + 2 + k, sy + 2 + k, 1, 1);
    ctx.fillStyle = '#d3a165';
    ctx.fillRect(sx + 1, sy + 1, TILE - 2, 1);
  } else if (t === '~') {
    const surface = level.at(tx, ty - 1) !== '~';
    ctx.fillStyle = surface ? PAL.water : PAL.waterDeep;
    ctx.fillRect(sx, sy, TILE, TILE);
    if (surface) {
      const w = R(Math.sin(time * 2 + tx) * 2);
      ctx.fillStyle = PAL.waterLight;
      ctx.fillRect(sx + 3 + w, sy + 1, 5, 1);
      ctx.fillRect(sx + 10 - w, sy + 4, 3, 1);
      if (hash(tx * 13) > 0.7) {                     // nénuphar
        ctx.fillStyle = PAL.lily;
        ctx.fillRect(sx + 5, sy, 5, 2);
        ctx.fillStyle = '#e9a8b8';
        ctx.fillRect(sx + 7, sy - 1, 1, 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// décors (derrière les personnages) ; cascade et feuillage devant
// ---------------------------------------------------------------------------
function tree(ctx, sx, sy, kind, time) {
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(sx - 2, sy - 30, 4, 30);
  ctx.fillRect(sx - 6, sy - 26, 4, 2);
  ctx.fillRect(sx + 2, sy - 22, 5, 2);
  const canopy = kind === 'cerisier' ? ['#e8b4c0', '#f3cfd6', '#cf93a3'] : ['#6f9b4f', '#88b562', '#5a8240'];
  ctx.fillStyle = canopy[2];
  ctx.fillRect(sx - 15, sy - 44, 30, 16);
  ctx.fillStyle = canopy[0];
  ctx.fillRect(sx - 14, sy - 46, 28, 14);
  ctx.fillRect(sx - 10, sy - 50, 20, 4);
  ctx.fillStyle = canopy[1];
  ctx.fillRect(sx - 9, sy - 48, 10, 3);
  if (kind === 'pommier' || kind === 'poirier' || kind === 'fruit') {
    ctx.fillStyle = kind === 'poirier' ? '#e2c95a' : '#c8473c';
    for (let k = 0; k < 5; k++) ctx.fillRect(sx - 11 + R(hash(k + sx) * 22), sy - 44 + R(hash(k * 3) * 10), 2, 2);
  }
  if (kind === 'cerisier') {                         // pétales qui tombent
    ctx.fillStyle = '#f3cfd6';
    for (let k = 0; k < 4; k++) {
      const t = (time * 0.35 + hash(k + sx * 0.1)) % 1;
      ctx.fillRect(sx - 12 + R(hash(k) * 24 + Math.sin(time * 2 + k) * 3), sy - 30 + R(t * 30), 1, 1);
    }
  }
}

export function drawProps(ctx, cam, level, time) {
  for (const p of level.props) {
    const sx = R(p.x * TILE + TILE / 2 - cam.x), sy = R(p.y * TILE - cam.y);
    if (sx < -120 || sx > 520) continue;
    switch (p.type) {
      case 'house': {                                // maison au fond, plus pâle
        ctx.fillStyle = '#c9bfa6'; ctx.fillRect(sx - 18, sy - 22, 36, 22);
        ctx.fillStyle = '#6a5a52'; ctx.fillRect(sx - 23, sy - 30, 46, 8); ctx.fillRect(sx - 17, sy - 34, 34, 4);
        ctx.fillStyle = '#8d7a5e'; ctx.fillRect(sx - 4, sy - 14, 8, 14);
        ctx.fillStyle = '#e8dec6'; ctx.fillRect(sx - 14, sy - 17, 6, 5); ctx.fillRect(sx + 8, sy - 17, 6, 5);
        // fumée de la cheminée
        ctx.fillStyle = '#e4e6e2';
        for (let k = 0; k < 3; k++) ctx.fillRect(sx + 12 + R(Math.sin(time + k) * 2), sy - 40 - k * 6 - R((time * 6) % 6), 3, 3);
        break;
      }
      case 'mill': {
        ctx.fillStyle = '#b9ab8e'; ctx.fillRect(sx - 14, sy - 26, 28, 26);
        ctx.fillStyle = '#5e4c44'; ctx.fillRect(sx - 18, sy - 32, 36, 6);
        ctx.fillStyle = '#7a5a3a';
        for (let k = 0; k < 6; k++) {
          const a = time * 0.8 + k * Math.PI / 3;
          ctx.fillRect(sx + 18 + R(Math.cos(a) * 9), sy - 10 + R(Math.sin(a) * 9), 2, 2);
        }
        break;
      }
      case 'crops': {
        const colors = { carottes: '#e08a3c', radis: '#d9607a', navets: '#efe9da', choux: '#7fb05a' };
        for (let k = 0; k < p.w * 2; k++) {
          const cx = R(p.x * TILE - cam.x) + 3 + k * 8;
          ctx.fillStyle = '#5d8a42'; ctx.fillRect(cx, sy - 5, 1, 4); ctx.fillRect(cx - 2, sy - 6, 2, 2); ctx.fillRect(cx + 1, sy - 6, 2, 2);
          ctx.fillStyle = colors[p.kind] ?? '#e08a3c'; ctx.fillRect(cx - 1, sy - 2, 3, 2);
        }
        break;
      }
      case 'fence':
        ctx.fillStyle = PAL.bambooDark;
        ctx.fillRect(sx - 7, sy - 10, 14, 2);
        ctx.fillStyle = PAL.bamboo;
        for (let k = -6; k <= 6; k += 4) ctx.fillRect(sx + k, sy - 12, 2, 12);
        break;
      case 'stone':
        ctx.fillStyle = '#8f9a8a'; ctx.fillRect(sx - 6, sy - 5, 12, 5);
        ctx.fillStyle = '#6c9a54'; ctx.fillRect(sx - 5, sy - 6, 8, 2);
        break;
      case 'tree': tree(ctx, sx, sy, p.kind, time); break;
      case 'baskets':
        ctx.fillStyle = '#9b7442'; ctx.fillRect(sx - 6, sy - 7, 12, 7);
        ctx.fillStyle = '#c69a5c'; ctx.fillRect(sx - 6, sy - 7, 12, 1); ctx.fillRect(sx - 6, sy - 4, 12, 1);
        ctx.fillStyle = '#e08a3c'; ctx.fillRect(sx - 4, sy - 9, 3, 2); ctx.fillRect(sx + 1, sy - 10, 3, 3);
        ctx.fillStyle = '#7fb05a'; ctx.fillRect(sx - 1, sy - 11, 2, 3);
        if (p.stolen) { ctx.fillStyle = '#e08a3c'; ctx.fillRect(sx + 9, sy - 2, 3, 2); ctx.fillRect(sx + 14, sy - 2, 2, 2); }
        break;
      case 'bridge':
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(R(p.x * TILE - cam.x), sy - 9, p.w * TILE, 1);
        for (let k = 0; k <= p.w; k += 2) ctx.fillRect(R(p.x * TILE - cam.x) + k * TILE, sy - 10, 2, 10);
        break;
      case 'waterwheel': {
        const r = p.r * TILE;
        ctx.fillStyle = '#6b4a2b';
        for (let a = 0; a < Math.PI * 2; a += 0.05) ctx.fillRect(sx + R(Math.cos(a) * r), sy - 6 + R(Math.sin(a) * r), 2, 2);
        for (let k = 0; k < 8; k++) {
          const a = time * 0.6 + k * Math.PI / 4;
          for (let d = 0; d < r; d += 2) ctx.fillRect(sx + R(Math.cos(a) * d), sy - 6 + R(Math.sin(a) * d), 1, 1);
          ctx.fillStyle = '#a77a4a';
          ctx.fillRect(sx + R(Math.cos(a) * r) - 2, sy - 6 + R(Math.sin(a) * r) - 2, 4, 4);
          ctx.fillStyle = '#6b4a2b';
        }
        ctx.fillStyle = '#3f2e20'; ctx.fillRect(sx - 2, sy - 8, 4, 4);
        break;
      }
      case 'reeds':
        ctx.fillStyle = '#6f8f4a';
        for (let k = 0; k < p.w * 3; k++) {
          const cx = R(p.x * TILE - cam.x) + k * 5 + 2;
          ctx.fillRect(cx + R(Math.sin(time * 1.5 + k) * 1), sy - 12 - (k % 3) * 2, 1, 12 + (k % 3) * 2);
        }
        break;
      case 'ladder':
        ctx.fillStyle = PAL.woodDark;
        ctx.fillRect(sx - 4, sy - p.h * TILE, 1, p.h * TILE);
        ctx.fillRect(sx + 3, sy - p.h * TILE, 1, p.h * TILE);
        for (let y = 4; y < p.h * TILE; y += 6) ctx.fillRect(sx - 4, sy - y, 8, 1);
        break;
      case 'lantern_stone':
        ctx.fillStyle = '#9a9a8c'; ctx.fillRect(sx - 2, sy - 10, 4, 10); ctx.fillRect(sx - 5, sy - 16, 10, 2);
        ctx.fillRect(sx - 4, sy - 14, 8, 4); ctx.fillRect(sx - 3, sy - 18, 6, 2);
        ctx.fillStyle = '#f0c25a'; ctx.fillRect(sx - 1, sy - 13, 2, 2);
        break;
      case 'pots':
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#b5653d'; ctx.fillRect(sx - 10 + k * 8, sy - 6, 6, 6);
          ctx.fillStyle = '#6aa055'; ctx.fillRect(sx - 9 + k * 8, sy - 9, 4, 3);
        }
        break;
      case 'barn_door':
        ctx.fillStyle = '#5b3a22'; ctx.fillRect(sx - 8, sy - 44, 6, 44);
        ctx.fillStyle = '#3d2e23'; ctx.fillRect(sx - 2, sy - 44, 4, 44);
        ctx.fillStyle = '#7a4b2c'; ctx.fillRect(sx - 12, sy - 52, 40, 6);   // auvent de la grange
        break;
      case 'hay':
        ctx.fillStyle = '#c9a85a'; ctx.fillRect(sx - 9, sy - 10, 18, 10);
        ctx.fillStyle = '#a8883f'; ctx.fillRect(sx - 9, sy - 6, 18, 1);
        ctx.fillStyle = '#e1c57a'; ctx.fillRect(sx - 9, sy - 10, 18, 1);
        break;
      case 'shrine':
        ctx.fillStyle = '#7a3a30'; ctx.fillRect(sx - 9, sy - 18, 18, 2);
        ctx.fillStyle = '#a8433a'; ctx.fillRect(sx - 7, sy - 16, 14, 10);
        ctx.fillStyle = '#5b4a46'; ctx.fillRect(sx - 6, sy - 6, 12, 6);
        ctx.fillStyle = '#f0e8d4'; ctx.fillRect(sx - 1, sy - 13, 2, 4);
        break;
      case 'fox':
        ctx.fillStyle = '#b8b5a8'; ctx.fillRect(sx - 3, sy - 4, 7, 4); ctx.fillRect(sx - 2, sy - 10, 5, 6);
        ctx.fillRect(sx - 2, sy - 12, 1, 2); ctx.fillRect(sx + 2, sy - 12, 1, 2);
        ctx.fillStyle = '#c8473c'; ctx.fillRect(sx - 2, sy - 6, 5, 2);   // bavoir rouge
        break;
      case 'koi':
        for (let k = 0; k < 3; k++) {
          const fx = R(p.x * TILE - cam.x) + 8 + R(((time * 14 + k * 37) % (p.w * TILE - 16)));
          ctx.fillStyle = k === 1 ? '#f2f0e8' : '#e8873a';
          ctx.fillRect(fx, sy + 6 + k * 3, 5, 2);
          ctx.fillRect(fx - 2, sy + 6 + k * 3, 1, 2);
        }
        break;
      case 'bridge_red': {
        const x0 = R(p.x * TILE - cam.x);
        ctx.fillStyle = '#b5443a';
        for (let k = 0; k < p.w * TILE; k++) {
          const t = k / (p.w * TILE);
          if (p.broken && t > 0.38 && t < 0.62) continue;   // la travée rompue
          const arc = R(Math.sin(t * Math.PI) * 8);
          ctx.fillRect(x0 + k, sy - 12 - arc, 1, 2);
          if (k % 10 === 0) ctx.fillRect(x0 + k, sy - 12 - arc, 1, 10);
        }
        break;
      }
      case 'gate':
        ctx.fillStyle = '#5b3a22'; ctx.fillRect(sx - 18, sy - 60, 5, 60); ctx.fillRect(sx + 13, sy - 60, 5, 60);
        ctx.fillStyle = '#3f2e20'; ctx.fillRect(sx - 24, sy - 66, 48, 6);
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(sx - 13, sy - 56, 4, 56); ctx.fillRect(sx + 9, sy - 56, 4, 56);   // battants ouverts
        break;
      case 'stall': {                                // le comptoir du voyageur
        // marchand PROVISOIRE (en attendant sa planche de design) : vieil homme
        // au grand chapeau, tenue colorée ; il compte ses pièces
        {
          const bob = Math.floor(time * 2) % 2;
          ctx.fillStyle = '#2f4e7c'; ctx.fillRect(sx - 5, sy - 26 + bob, 10, 14);      // tenue indigo
          ctx.fillStyle = '#d8823a'; ctx.fillRect(sx - 5, sy - 19 + bob, 10, 2);       // ceinture orange
          ctx.fillStyle = '#e8c39a'; ctx.fillRect(sx - 3, sy - 31 + bob, 6, 5);        // visage
          ctx.fillStyle = '#f2f0e8'; ctx.fillRect(sx - 3, sy - 27 + bob, 6, 3);        // barbe blanche
          ctx.fillStyle = '#c9a85a'; ctx.fillRect(sx - 10, sy - 34 + bob, 20, 2);      // grand chapeau
          ctx.fillRect(sx - 6, sy - 36 + bob, 12, 2); ctx.fillRect(sx - 3, sy - 37 + bob, 6, 1);
          ctx.fillStyle = '#e8c39a'; ctx.fillRect(sx + 4, sy - 17, 3, 2);              // main qui compte
          ctx.fillStyle = '#e8b93c'; ctx.fillRect(sx + 6, sy - 17 - (Math.floor(time * 4) % 3), 2, 2);
        }
        ctx.fillStyle = '#8e6a44'; ctx.fillRect(sx - 20, sy - 14, 40, 14);
        ctx.fillStyle = '#b8895a'; ctx.fillRect(sx - 20, sy - 14, 40, 2);
        ctx.fillStyle = '#5b3a22'; ctx.fillRect(sx - 19, sy - 40, 2, 26); ctx.fillRect(sx + 17, sy - 40, 2, 26);
        ctx.fillStyle = '#3e6c8c'; ctx.fillRect(sx - 26, sy - 46, 52, 6);   // auvent de tissu
        ctx.fillStyle = '#e9dcc0';
        for (let k = -24; k < 26; k += 8) ctx.fillRect(sx + k, sy - 46, 4, 6);
        for (const lx of [-14, 12]) {                // lanternes qui oscillent
          const sw = R(Math.sin(time * 2 + lx) * 1.5);
          ctx.fillStyle = '#c8473c'; ctx.fillRect(sx + lx + sw, sy - 38, 4, 5);
          ctx.fillStyle = '#f0c25a'; ctx.fillRect(sx + lx + sw + 1, sy - 37, 2, 3);
        }
        ctx.fillStyle = '#c9a85a'; ctx.fillRect(sx + 22, sy - 12, 10, 12);    // sac de voyage
        ctx.fillStyle = '#a8883f'; ctx.fillRect(sx + 22, sy - 8, 10, 1);
        break;
      }
      case 'signpost':
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(sx - 1, sy - 20, 2, 20);
        ctx.fillStyle = '#c8965c'; ctx.fillRect(sx - 2, sy - 20, 16, 5);
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(sx + 1, sy - 18, 9, 1);
        break;
      default:
    }
  }
}

/** Devant les personnages : la cascade (elle cache à moitié la cache secrète). */
export function drawForeground(ctx, cam, level, time) {
  for (const p of level.props) {
    if (p.type !== 'waterfall') continue;
    const sx = R(p.x * TILE - cam.x), top = R((p.y - p.h) * TILE - cam.y), bottom = R(p.y * TILE - cam.y) + 2 * TILE;
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PAL.water;
    ctx.fillRect(sx - 6, top, 28, bottom - top);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PAL.waterLight;
    for (let k = 0; k < 7; k++) {
      const y = top + R((time * 90 + k * 23) % (bottom - top));
      ctx.fillRect(sx - 4 + k * 4, y, 1, 6);
    }
    ctx.globalAlpha = 1;
  }
}
