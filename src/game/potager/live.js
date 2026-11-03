// Tout ce qui bouge dans le Potager : la roue à eau, l'eau qui coule, les koïs,
// la pluie de la serre, la lumière de la grange, la fumée, le marchand, et la vie
// sauvage (papillons, pétales, feuilles, libellules, poussières dans la lumière).
import { ih, rng } from './paint.js';
import * as C from './palette.js';
import { TILE } from './tiles.js';
import { hillGeom, atticGeom } from './props.js';

const R = Math.round;

export class Live {
  constructor(level, map) {
    this.level = level;
    this.map = map;
    const P = level.props;
    this.wheels = P.filter((p) => p.type === 'waterwheel');
    this.falls = P.filter((p) => p.type === 'waterfall');
    this.koi = P.filter((p) => p.type === 'koi');
    this.mills = P.filter((p) => p.type === 'mill');
    this.lanterns = P.filter((p) => p.type === 'lantern_stone');
    this.houses = P.filter((p) => p.type === 'house');
    this.stalls = P.filter((p) => p.type === 'stall');
    this.serre = level.backdrops.find((b) => b.type === 'serre');
    this.grange = level.backdrops.find((b) => b.type === 'grange');
    const gr = P.find((p) => p.type === 'grenier');
    this.attic = gr ? { p: gr, g: atticGeom(gr), blink: 3.1 } : null;
    this.kappas = P.filter((p) => p.type === 'kappa').map((p) => ({ p, state: 'sit', t: 0 }));
    this.barrels = P.filter((p) => p.type === 'barrel');
    this.hills = P.filter((p) => p.type === 'terraces_bg').map((p) => hillGeom(p));
    // colonnes d'eau (pour les reflets et les poissons qui sautent)
    this.water = [];
    for (let tx = 0; tx < map.w; tx++) {
      let ty = 0; while (ty < map.h && map.at(tx, ty) !== '~' && !map.solid(tx, ty)) ty++;
      if (map.at(tx, ty) === '~') this.water.push({ tx, ty });
    }
    this.parts = [];
    this.last = 0;
    this.r = rng(4242);
  }

  zoneAt(wx) {
    return this.map.zone[Math.max(0, Math.min(this.map.w - 1, Math.floor(wx / TILE)))];
  }

  // -------------------------------------------------------------------------
  // la colline au loin : son ruisseau et sa cascade (derrière le terrain et
  // les plateformes du premier plan)
  // -------------------------------------------------------------------------
  drawHill(ctx, cam, viewW, viewH, time) {
    const vis = (x, m = 80) => x - cam.x > -m && x - cam.x < viewW + m;
    // le ruisseau de la colline : l'eau ondule sur les replats, ruisselle sur les murs
    for (const h of this.hills) {
      if (!vis(h.mx, 400)) continue;
      for (const row of h.rows) {
        const sy = R(row.y - cam.y);
        if (sy < -2 || sy > viewH) continue;
        const q = h.band((row.x0 + row.x1) >> 1, row.y);
        if (!q) continue;
        const w = row.x1 - row.x0;
        if (q.part === 'wall') {
          ctx.fillStyle = '#ffffff';
          for (let k = 0; k < 3; k++) {
            const x = row.x0 + 1 + ((k * 7 + R(row.y * 3 - time * 40)) % (w - 1) + (w - 1)) % (w - 1);
            ctx.fillRect(R(x - cam.x), sy, 1, 1);
          }
        } else {
          ctx.fillStyle = q.f < 0.3 ? '#ffffff' : C.WATER[5];
          for (let k = 0; k < 2; k++) {
            const x = row.x0 + 1 + ((k * 11 + R(time * 9 + row.y * 5)) % (w - 1) + (w - 1)) % (w - 1);
            ctx.fillRect(R(x - cam.x), sy, 2, 1);
          }
          if (q.f < 0.15) {                                          // éclaboussures au pied de la chute
            ctx.fillStyle = '#ffffff';
            const a = time * 5 + row.y;
            ctx.fillRect(R(row.x0 - 2 - cam.x), sy - 1 - R(Math.abs(Math.sin(a)) * 2), 1, 1);
            ctx.fillRect(R(row.x1 + 2 - cam.x), sy - 1 - R(Math.abs(Math.cos(a)) * 2), 1, 1);
          }
        }
      }
      // l'eau qui franchit le rocher
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) ctx.fillRect(R(h.weir.x - 10 + ((time * 16 + k * 5) % 20) - cam.x), R(h.weir.y - 14 + ((time * 30 + k * 4) % 14) - cam.y), 1, 2);
    }
    for (const f of this.falls) {
      let gy = f.y; while (gy < this.map.h && this.map.at(f.x + 1, gy) !== '#') gy++;
      // elle tombe derrière la terrasse (la colline est au loin) : le bas est caché par le terrain
      const X = f.x * TILE + 8, top = f.top ?? (f.y - f.h) * TILE - 2, bottom = gy * TILE + 10;
      if (!vis(X)) continue;
      const sx = R(X - cam.x), t0 = R(top - cam.y), b0 = R(bottom - cam.y), H = b0 - t0;
      // le rideau d'eau : plus étroit au déversoir, il s'évase en tombant
      for (let y = 0; y < H; y++) {
        const k = y / H, half = R(10 + k * 4);
        // dense et écumeuse au départ (dans le prolongement du rocher), elle s'éclaircit en tombant
        ctx.globalAlpha = 0.58 + 0.37 * Math.max(0, 1 - k * 3.5);
        ctx.fillStyle = k < 0.12 ? C.WATER[4] : C.WATER[3]; ctx.fillRect(sx - half, t0 + y, half * 2, 1);
        ctx.fillStyle = C.WATER[4]; ctx.fillRect(sx - half, t0 + y, 2, 1); ctx.fillRect(sx + 2, t0 + y, 2, 1);
        if (k < 0.18) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - half + ((y * 5) % (half * 2)), t0 + y, 2, 1); }
      }
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 11, t0, 22, 1);                    // la lèvre du déversoir
      ctx.fillStyle = C.WATER[5];
      for (let k = 0; k < 10; k++) {                                             // filets qui descendent
        const y = R((time * 120 + k * 31) % H);
        ctx.fillRect(sx - 10 + k * 2 + R((y / H) * (k - 5) * 0.8), t0 + y, 1, 6);
      }
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 6; k++) {                                              // bruine
        const a = (time * 0.8 + k * 0.17) % 1;
        ctx.fillRect(sx - 16 + k * 6 + R(Math.sin(time + k) * 3), b0 - 14 - R(a * 14), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // -------------------------------------------------------------------------
  // derrière les personnages
  // -------------------------------------------------------------------------
  drawBehind(ctx, cam, viewW, viewH, time) {
    const vis = (x, m = 80) => x - cam.x > -m && x - cam.x < viewW + m;
    if (this.attic && vis(this.attic.p.owl.x)) this.owl(ctx, cam, time);
    // reflets mouvants à la surface de l'eau
    for (const w of this.water) {
      const wx = w.tx * TILE;
      if (!vis(wx, 20)) continue;
      const sx = R(wx - cam.x), sy = R(w.ty * TILE - cam.y);
      ctx.fillStyle = C.WATER[5];
      const o = R(Math.sin(time * 1.6 + w.tx) * 3);
      ctx.fillRect(sx + 3 + o, sy + 3, 5, 1);
      ctx.fillRect(sx + 10 - o, sy + 7, 3, 1);
      ctx.fillStyle = C.WATER[4];
      ctx.fillRect(sx + ((w.tx * 7 + R(time * 6)) % 16), sy + 11, 2, 1);
      // nénuphars
      if (ih(w.tx, 0, 3) > 0.62) {
        const lx = sx + 3 + R(Math.sin(time * 0.5 + w.tx) * 1.5);
        ctx.fillStyle = C.LEAF[2]; ctx.fillRect(lx, sy - 1, 7, 2);
        ctx.fillStyle = C.LEAF[3]; ctx.fillRect(lx + 1, sy - 1, 3, 1);
        ctx.fillStyle = C.LEAF[0]; ctx.fillRect(lx + 4, sy, 1, 1);
        if (ih(w.tx, 1, 3) > 0.5) { ctx.fillStyle = C.BLOSSOM[3]; ctx.fillRect(lx + 2, sy - 3, 3, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(lx + 3, sy - 3, 1, 1); }
      }
    }
    // poissons qui sautent dans les canaux
    for (const w of this.water) {
      if (this.zoneAt(w.tx * TILE) !== '03' || !vis(w.tx * TILE)) continue;
      const cyc = (time * 0.25 + ih(w.tx, 5, 1) * 7) % 7;
      if (cyc > 0.6 || ih(w.tx, 6, 1) < 0.6) continue;
      const k = cyc / 0.6, sx = R(w.tx * TILE + 4 + k * 8 - cam.x), sy = R(w.ty * TILE - Math.sin(k * Math.PI) * 12 - cam.y);
      ctx.fillStyle = '#c9d2d6'; ctx.fillRect(sx, sy, 4, 2);
      ctx.fillStyle = '#7d8a8f'; ctx.fillRect(sx - 1, sy, 1, 2); ctx.fillRect(sx, sy + 1, 4, 1);
    }
    // eau qui court dans le bief du moulin
    for (const m of this.mills) {
      const X = m.x * TILE + 8, Y = m.y * TILE;
      if (!vis(X, 200)) continue;
      const fx0 = X - 70 + 60 - 6, fx1 = m.flume ?? X, fy = Y - 70 + 1;
      ctx.fillStyle = C.WATER[5];
      for (let x = fx0 + ((time * 40) % 9); x < fx1; x += 9) ctx.fillRect(R(x - cam.x), R(fy - cam.y), 3, 1);
    }
    // la roue à eau : derrière la berge, elle plonge dans le canal
    for (const w of this.wheels) {
      const X = w.x * TILE + (w.dx ?? 0), Y = w.y * TILE - (w.lift ?? 10), r = (w.r ?? 3) * TILE;
      if (!vis(X, r + 20)) continue;
      ctx.save();
      // découpe : seulement là où il n'y a pas de terrain
      ctx.beginPath();
      for (let tx = Math.floor((X - r) / TILE) - 1; tx <= Math.ceil((X + r) / TILE) + 1; tx++) {
        for (let ty = Math.floor((Y - r) / TILE) - 1; ty <= Math.ceil((Y + r) / TILE) + 1; ty++) {
          if (!this.map.solid(tx, ty)) ctx.rect(tx * TILE - cam.x, ty * TILE - cam.y, TILE, TILE);
        }
      }
      ctx.clip();
      this.drawWheel(ctx, R(X - cam.x), R(Y - cam.y), r, time);
      // l'eau qui tombe du bief sur les pales
      ctx.fillStyle = 'rgba(200, 236, 238, 0.8)';
      for (let k = 0; k < 6; k++) {
        const yy = (time * 90 + k * 13) % (r * 1.2);
        ctx.fillRect(R(X - 22 - cam.x) + (k % 3), R(Y - r - 10 + yy - cam.y), 1, 4);
      }
      ctx.restore();
    }
    // koïs dans le bassin du jardin
    for (const k of this.koi) {
      const x0 = k.x * TILE, w = (k.w ?? 6) * TILE, y = k.y * TILE;
      if (!vis(x0, 40)) continue;
      for (let i = 0; i < 4; i++) {
        const t = time * (0.18 + i * 0.05) + i * 2;
        const fx = x0 + w / 2 + Math.sin(t) * (w / 2 - 10), dir = Math.cos(t) > 0 ? 1 : -1;
        const fy = y + 6 + i * 3 + R(Math.sin(t * 2.3) * 1.5);
        const col = [['#e8873a', '#f4f0e6'], ['#f4f0e6', '#d9482f'], ['#e8a03a', '#e8a03a'], ['#2c2a2a', '#e8873a']][i];
        const sx = R(fx - cam.x), sy = R(fy - cam.y);
        ctx.fillStyle = col[0]; ctx.fillRect(sx - 3, sy, 7, 2);
        ctx.fillStyle = col[1]; ctx.fillRect(sx - 1 + dir, sy, 2, 1);
        ctx.fillStyle = col[0]; ctx.fillRect(sx - 4 * dir - (dir > 0 ? 1 : -1), sy - (R(time * 6 + i) % 2), 1, 2);
      }
    }
    // tonneaux qui flottent dans les canaux
    for (const bl of this.barrels) {
      const X = bl.x * TILE, Y = bl.y * TILE;
      if (!vis(X)) continue;
      const sx = R(X - cam.x + Math.sin(time * 0.6 + bl.x) * 3), sy = R(Y - cam.y + Math.sin(time * 1.7 + bl.x) * 1.2);
      ctx.fillStyle = C.WOOD[2]; ctx.fillRect(sx - 6, sy - 6, 12, 8);
      ctx.fillStyle = C.WOOD[4]; ctx.fillRect(sx - 6, sy - 6, 12, 2);
      ctx.fillStyle = C.WOOD[3]; ctx.fillRect(sx - 5, sy - 6, 10, 1);
      ctx.fillStyle = '#3b3f47'; ctx.fillRect(sx - 3, sy - 6, 1, 8); ctx.fillRect(sx + 3, sy - 6, 1, 8);
      ctx.fillStyle = C.WATER[5]; ctx.fillRect(sx - 8, sy + 1, 3, 1); ctx.fillRect(sx + 6, sy + 1, 3, 1);
    }
    // le kappa pêcheur : il plonge quand KAGE approche, puis revient
    const pl = this.level.player;
    for (const k of this.kappas) {
      const X = k.p.x * TILE + 8, Y = k.p.y * TILE;
      if (!vis(X)) continue;
      k.t += 1 / 60;
      const near = pl && Math.abs(pl.x - X) < 90;
      if (k.state === 'sit' && near) { k.state = 'dive'; k.t = 0; }
      else if (k.state === 'dive' && k.t > 0.7) { k.state = 'gone'; k.t = 0; }
      else if (k.state === 'gone' && k.t > 5 && !near) { k.state = 'sit'; k.t = 0; }
      const sx = R(X - cam.x), sy = R(Y - cam.y);
      // la pierre
      ctx.fillStyle = C.STONE[1]; ctx.fillRect(sx - 7, sy - 3, 14, 5);
      ctx.fillStyle = C.STONE[3]; ctx.fillRect(sx - 6, sy - 4, 11, 2);
      ctx.fillStyle = C.MOSS[2]; ctx.fillRect(sx - 5, sy - 5, 6, 1);
      if (k.state === 'sit') {
        const bob = Math.floor(time * 1.5) % 2;
        ctx.fillStyle = '#4f7a3a'; ctx.fillRect(sx - 3, sy - 12 + bob, 7, 8);       // corps
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(sx + 2, sy - 11 + bob, 3, 6);       // carapace
        ctx.fillStyle = '#6fa04c'; ctx.fillRect(sx - 3, sy - 16 + bob, 6, 5);       // tête
        ctx.fillStyle = '#d7e3e6'; ctx.fillRect(sx - 2, sy - 17 + bob, 4, 1);       // l'assiette d'eau
        ctx.fillStyle = '#e8c35a'; ctx.fillRect(sx - 5, sy - 14 + bob, 2, 1);       // bec
        ctx.fillStyle = '#1a1410'; ctx.fillRect(sx - 2, sy - 15 + bob, 1, 1);
        ctx.fillStyle = C.WOOD[3];                                                    // canne à pêche
        for (let i = 0; i < 14; i++) ctx.fillRect(sx - 4 - i, sy - 12 - Math.round(i * 0.7) + bob, 1, 1);
        ctx.fillStyle = 'rgba(240, 240, 230, 0.7)';
        for (let i = 0; i < 12; i++) ctx.fillRect(sx - 18, sy - 22 + i * 2, 1, 1);
        ctx.fillStyle = C.RED[3]; ctx.fillRect(sx - 19, sy + 1 + R(Math.sin(time * 3)), 2, 1);
      } else if (k.state === 'dive') {
        const a = k.t / 0.7;
        ctx.fillStyle = '#4f7a3a'; ctx.fillRect(sx + 2 + R(a * 6), sy - 10 + R(a * a * 16), 6, 6);
        if (a > 0.5) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(sx + 4 + i * 2, sy + 2 - R(Math.sin(i + a * 6) * 3), 1, 2); }
      } else if (k.t < 1.2) {
        ctx.fillStyle = C.WATER[5]; ctx.fillRect(sx + 2 - R(k.t * 5), sy + 2, 2, 1); ctx.fillRect(sx + 10 + R(k.t * 5), sy + 2, 2, 1);
      }
    }
    // fumée de la ferme
    for (const h of this.houses) {
      const X = h.x * TILE + 8 + 30, Y = h.y * TILE - 6 - 30 - 40;
      if (!vis(X)) continue;
      this.smoke(ctx, X - cam.x, Y - cam.y, time, 1);
    }
    // l'échoppe : clochette, lanternes, et le marchand (dessin provisoire)
    for (const s of this.stalls) {
      const X = s.x * TILE + 8, Y = s.y * TILE;
      if (!vis(X)) continue;
      const sx = R(X - cam.x), sy = R(Y - cam.y);
      for (const lx of [-26, 24]) {
        const sw = R(Math.sin(time * 1.8 + lx) * 1.5);
        ctx.fillStyle = '#3a2e22'; ctx.fillRect(sx + lx + 2, sy - 50, 1, 6);
        ctx.fillStyle = C.RED[3]; ctx.fillRect(sx + lx + sw, sy - 44, 6, 8);
        ctx.fillStyle = C.GLOW[1]; ctx.fillRect(sx + lx + sw + 1, sy - 43, 4, 6);
        ctx.fillStyle = C.GLOW[3]; ctx.fillRect(sx + lx + sw + 2, sy - 42, 2, 3);
        ctx.fillStyle = '#2a2420'; ctx.fillRect(sx + lx + sw, sy - 45, 6, 1); ctx.fillRect(sx + lx + sw, sy - 36, 6, 1);
      }
      const bell = R(Math.sin(time * 2.4) * 1.2);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(sx - 2 + bell, sy - 47, 4, 4);
      ctx.fillStyle = '#e8c76a'; ctx.fillRect(sx - 2 + bell, sy - 47, 1, 2);
      this.merchant(ctx, sx, sy, time);
    }
  }

  drawWheel(ctx, cx, cy, r, time) {
    // jante, rayons, pales ; elle tourne lentement
    const a0 = time * 0.55;
    ctx.fillStyle = C.WOOD[1];
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      ctx.fillRect(cx + R(Math.cos(a) * r), cy + R(Math.sin(a) * r), 3, 3);
      ctx.fillRect(cx + R(Math.cos(a) * (r - 9)), cy + R(Math.sin(a) * (r - 9)), 2, 2);
    }
    ctx.fillStyle = C.WOOD[3];
    for (let a = 0; a < Math.PI * 2; a += 0.04) ctx.fillRect(cx + R(Math.cos(a) * r), cy + R(Math.sin(a) * r), 1, 1);
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k * Math.PI) / 6;
      ctx.fillStyle = C.WOOD[2];
      for (let d = 4; d < r - 8; d += 1.5) ctx.fillRect(cx + R(Math.cos(a) * d), cy + R(Math.sin(a) * d), 2, 2);
      // pale
      const px = cx + Math.cos(a) * (r + 2), py = cy + Math.sin(a) * (r + 2);
      ctx.fillStyle = C.WOOD[3];
      for (let d = -5; d <= 5; d++) ctx.fillRect(R(px + Math.cos(a + Math.PI / 2) * d * 0.3 + Math.cos(a) * d * 0.5), R(py + Math.sin(a + Math.PI / 2) * d * 0.3 + Math.sin(a) * d * 0.5), 3, 2);
    }
    ctx.fillStyle = C.WOOD[0]; ctx.fillRect(cx - 4, cy - 4, 9, 9);
    ctx.fillStyle = '#5b5e66'; ctx.fillRect(cx - 2, cy - 2, 5, 5);
  }

  smoke(ctx, x, y, time, k) {
    for (let i = 0; i < 7; i++) {
      const t = ((time * 0.35 + i / 7) % 1);
      const px = x + Math.sin(t * 5 + i) * 3 + t * 10, py = y - t * 40 * k;
      const s = 2 + Math.round(t * 4);
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.fillStyle = '#eef0ec';
      ctx.fillRect(R(px), R(py), s, s);
    }
    ctx.globalAlpha = 1;
  }

  merchant(ctx, sx, sy, time) {
    // marchand PROVISOIRE (en attendant sa planche de design) : vieil homme au grand
    // chapeau, tenue colorée ; il compte ses pièces derrière son comptoir
    const bob = Math.floor(time * 2) % 2;
    const y = sy - 18;
    ctx.fillStyle = '#2f4e7c'; ctx.fillRect(sx - 5, y - 14 + bob, 10, 14);
    ctx.fillStyle = '#d8823a'; ctx.fillRect(sx - 5, y - 7 + bob, 10, 2);
    ctx.fillStyle = '#e8c39a'; ctx.fillRect(sx - 3, y - 19 + bob, 6, 5);
    ctx.fillStyle = '#f2f0e8'; ctx.fillRect(sx - 3, y - 15 + bob, 6, 3);
    ctx.fillStyle = '#c9a85a'; ctx.fillRect(sx - 10, y - 22 + bob, 20, 2);
    ctx.fillRect(sx - 6, y - 24 + bob, 12, 2); ctx.fillRect(sx - 3, y - 25 + bob, 6, 1);
    ctx.fillStyle = '#e8c39a'; ctx.fillRect(sx + 4, y - 4, 3, 2);
    ctx.fillStyle = '#e8b93c'; ctx.fillRect(sx + 6, y - 4 - (Math.floor(time * 4) % 3), 2, 2);
  }

  // -------------------------------------------------------------------------
  // devant les personnages
  // -------------------------------------------------------------------------
  /** Le grenier : pénombre qui suit la forme du toit, rai de la lucarne et poussières. */
  atticLight(ctx, cam, time) {
    const g = this.attic.g;
    ctx.fillStyle = 'rgba(16, 10, 8, 0.34)';
    for (let yy = g.top - 6; yy < g.bottom; yy += 2) {
      const [xa, xb] = g.span(yy);
      ctx.fillRect(R(xa - cam.x), R(yy - cam.y), R(xb - xa) + 1, 2);
    }
    ctx.fillStyle = 'rgba(16, 10, 8, 0.22)';                                 // le haut, sous le chaume
    for (let yy = g.top - 6; yy < g.top + 12; yy += 2) {
      const [xa, xb] = g.span(yy);
      ctx.fillRect(R(xa - cam.x), R(yy - cam.y), R(xb - xa) + 1, 2);
    }
    // la lucarne : son halo, puis le rai qui descend sur le plancher
    const wx = g.floorX0 + 48, wy = g.top + 26;
    for (let rr = 18; rr > 4; rr -= 4) {
      ctx.fillStyle = `rgba(255, 214, 140, ${0.03 + (18 - rr) * 0.005})`;
      ctx.fillRect(R(wx + 12 - rr - cam.x), R(wy + 8 - rr * 0.7 - cam.y), rr * 2, R(rr * 1.4));
    }
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#ffe6a6';
    for (let k = 0; wy + 16 + k * 4 < g.floorY; k++) ctx.fillRect(R(wx + 2 + k * 2 - cam.x), R(wy + 16 + k * 4 - cam.y), 22, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 236, 190, 0.85)';
    for (let i = 0; i < 12; i++) {
      const k = (ih(i, 2, 13) * 30 + time * 3) % 30;
      const px = wx + 4 + k * 0.6 * 2 + ih(i, 3, 13) * 18 + Math.sin(time * 0.7 + i) * 2;
      const py = wy + 16 + k * 1.2;
      if (py < g.floorY - 1) ctx.fillRect(R(px - cam.x), R(py - cam.y), 1, 1);
    }
  }

  /** La chouette du grenier : elle cligne des yeux et suit KAGE du regard. */
  owl(ctx, cam, time) {
    const o = this.attic.p.owl, pl = this.level.player;
    const x = R(o.x - cam.x), y = R(o.y - cam.y);
    const dx = pl ? pl.x - o.x : 99, near = Math.abs(dx) < 170 && Math.abs((pl?.y ?? 0) - o.y) < 150;
    const look = near ? Math.sign(dx) : 0;
    const blink = (time % 4.3) < 0.13 || (time % 9.7) > 9.55;
    const bob = near && Math.abs(dx) < 50 ? R(Math.sin(time * 9) * 0.6) : 0;   // KAGE tout près : elle s'agite un peu
    const f = (c, a, b2, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b2 + bob, w, h); };
    // corps
    f('#5c452c', -4, -10, 9, 10); f('#7a5d3c', -3, -11, 7, 11); f('#94744c', -2, -10, 5, 9);
    for (const [a, b2] of [[-1, -5], [1, -4], [0, -3], [-1, -2], [1, -1]]) f('#c9b089', a, b2, 1, 1);   // poitrail moucheté
    f('#5c452c', -4, -6, 1, 5); f('#5c452c', 4, -6, 1, 5);                  // ailes repliées
    // tête : disque facial, aigrettes
    f('#6b5134', -4, -16, 9, 6); f('#d2bd94', -3, -15, 7, 4);
    f('#5c452c', -4, -17, 2, 2); f('#5c452c', 3, -17, 2, 2);
    if (blink) { f('#7a5d3c', -3, -14, 2, 1); f('#7a5d3c', 1, -14, 2, 1); }
    else {
      f('#f0b030', -3, -15, 2, 2); f('#f0b030', 1, -15, 2, 2);
      f('#14100c', -3 + (look > 0 ? 1 : 0), -14, 1, 1); f('#14100c', 1 + (look > 0 ? 1 : 0), -14, 1, 1);
    }
    f('#3a2e22', 0, -13, 1, 1);                                             // bec
    f('#c8a050', -2, 0, 1, 1); f('#c8a050', 1, 0, 1, 1);                    // serres sur le perchoir
  }

  drawFront(ctx, cam, viewW, viewH, time) {
    const dt = Math.min(0.05, Math.max(0, time - this.last));
    this.last = time;
    const vis = (x, m = 80) => x - cam.x > -m && x - cam.x < viewW + m;
    // la cascade d'irrigation : elle cache à moitié la cache secrète
    // la serre : pluie sur la toile, gouttes qui tombent sur les feuilles, rais de lumière
    if (this.serre) {
      const x0 = this.serre.x0 * TILE, x1 = this.serre.x1 * TILE, y0 = this.serre.y0 * TILE, y1 = this.serre.y1 * TILE;
      if (x1 - cam.x > -20 && x0 - cam.x < viewW + 20) {
        ctx.fillStyle = 'rgba(214, 230, 236, 0.75)';
        for (let i = 0; i < 70; i++) {                            // pluie dehors, sur le toit
          const rx = x0 - 40 + ih(i, 0, 7) * (x1 - x0 + 80);
          const span = y0 - 30 + 40;
          const ry = ((time * 180 + ih(i, 1, 7) * 400) % span) - 40 + (cam.y > 0 ? 0 : 0);
          ctx.fillRect(R(rx - cam.x - ry * 0.12), R(ry - cam.y), 1, 4);
        }
        for (let i = 0; i < 16; i++) {                            // gouttes qui passent par les déchirures
          const dx = x0 + 20 + ih(i, 2, 7) * (x1 - x0 - 40);
          const cyc = (time * 0.7 + ih(i, 3, 7)) % 1.6;
          if (cyc > 1) {
            if (cyc < 1.15) {                                      // éclaboussure
              ctx.fillStyle = 'rgba(220, 240, 245, 0.8)';
              ctx.fillRect(R(dx - cam.x) - 2, R(y1 - 2 - cam.y), 1, 1); ctx.fillRect(R(dx - cam.x) + 2, R(y1 - 3 - cam.y), 1, 1);
            }
            continue;
          }
          const dy = y0 + 2 + cyc * cyc * (y1 - y0 - 4);
          ctx.fillStyle = 'rgba(214, 238, 246, 0.9)';
          ctx.fillRect(R(dx - cam.x), R(dy - cam.y), 1, 2);
        }
        ctx.globalAlpha = 0.07 + 0.03 * Math.sin(time * 0.8);
        ctx.fillStyle = '#fff6d0';
        for (let x = x0 + 60; x < x1; x += 140) {                // rais de lumière obliques
          for (let k = 0; k < 18; k++) ctx.fillRect(R(x + k * 2 - cam.x), R(y0 + k * 6 - cam.y), 12, 8);
        }
        ctx.globalAlpha = 1;
      }
    }
    // la grange : pénombre, halos des lanternes, poussière dans la lumière
    if (this.grange) {
      const x0 = this.grange.x0 * TILE, x1 = this.grange.x1 * TILE, y0 = this.grange.y0 * TILE, y1 = this.grange.y1 * TILE;
      if (x1 - cam.x > -20 && x0 - cam.x < viewW + 20) {
        ctx.fillStyle = 'rgba(16, 10, 8, 0.32)';
        ctx.fillRect(R(x0 + 6 - cam.x), R(y0 - cam.y), x1 - x0 - 12, y1 - y0);
        ctx.fillStyle = 'rgba(16, 10, 8, 0.25)';
        ctx.fillRect(R(x0 + 6 - cam.x), R(y0 - cam.y), x1 - x0 - 12, 14);
        // lanternes suspendues : halo chaud
        for (let x = x0 + 80; x < x1 - 40; x += 180) {
          const sx = R(x - cam.x), sy = R(y0 + 26 - cam.y), sw = R(Math.sin(time * 1.3 + x) * 1);
          const a = this.attic?.g, hang = a && (x < a.floorX0 || x >= a.floorX1) ? a.top : y0;   // pendue à l'entrait si pas de plancher
          ctx.fillStyle = '#2a2420'; ctx.fillRect(sx + 2, R(hang - cam.y), 1, y0 + 20 - hang);
          for (let rr = 26; rr > 6; rr -= 5) {
            ctx.fillStyle = `rgba(255, 196, 110, ${0.05 + (26 - rr) * 0.004})`;
            ctx.fillRect(sx + 2 - rr + sw, sy + 4 - rr * 0.7, rr * 2, rr * 1.4);
          }
          ctx.fillStyle = C.RED[2]; ctx.fillRect(sx + sw, sy, 6, 8);
          ctx.fillStyle = C.GLOW[2]; ctx.fillRect(sx + 1 + sw, sy + 1, 4, 6);
          ctx.fillStyle = '#2a2420'; ctx.fillRect(sx + sw, sy - 1, 6, 1); ctx.fillRect(sx + sw, sy + 8, 6, 1);
        }
        // rai de lumière de la fenêtre haute et poussières
        const wx = x0 + (x1 - x0) * 0.62;
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#ffe6a6';
        for (let k = 0; k < 26; k++) ctx.fillRect(R(wx - k * 3 - cam.x), R(y0 + 36 + k * 5 - cam.y), 26, 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255, 236, 190, 0.8)';
        for (let i = 0; i < 26; i++) {
          const px = wx - 60 + ih(i, 0, 11) * 90 + Math.sin(time * 0.6 + i) * 6;
          const py = y0 + 40 + ((ih(i, 1, 11) * 120 + time * 4) % 120);
          ctx.fillRect(R(px - cam.x), R(py - cam.y), 1, 1);
        }
        if (this.attic) this.atticLight(ctx, cam, time);
      }
    }
    this.ambient(ctx, cam, viewW, viewH, time, dt);
  }

  // -------------------------------------------------------------------------
  // la vie sauvage : papillons, pétales, feuilles, libellules
  // -------------------------------------------------------------------------
  ambient(ctx, cam, viewW, viewH, time, dt) {
    const z = this.zoneAt(cam.x + viewW / 2);
    const want = {
      butterfly: { '01': 4, '02': 3, '07': 3, '08': 3, '04': 1 }[z] ?? 0,
      petal: { '04': 16, '07': 14, '01': 3, '08': 4 }[z] ?? 0,
      leaf: { '04': 5, '03': 2 }[z] ?? 0,
      dragonfly: { '03': 3, '07': 1 }[z] ?? 0,
      mote: { '07': 6, '08': 6, '01': 3 }[z] ?? 0,
    };
    const r = this.r;
    // les particules qui sortent de l'écran disparaissent ; on en refait au besoin
    this.parts = this.parts.filter((p) => p.x > cam.x - 60 && p.x < cam.x + viewW + 60 && p.y < cam.y + viewH + 20 && p.life > 0);
    for (const [kind, n] of Object.entries(want)) {
      const have = this.parts.filter((p) => p.kind === kind).length;
      for (let i = have; i < n; i++) {
        const x = cam.x + r() * viewW, y = cam.y + (kind === 'petal' || kind === 'leaf' ? -10 - r() * 60 : viewH * (0.35 + r() * 0.45));
        this.parts.push({ kind, x, y, vx: 0, vy: 0, t: r() * 10, life: 30 + r() * 30, c: r(), seed: r() * 100 });
      }
    }
    for (const p of this.parts) {
      p.t += dt; p.life -= dt;
      switch (p.kind) {
        case 'butterfly': {
          p.vx += (Math.sin(p.t * 0.7 + p.seed) * 18 - p.vx) * dt;
          p.vy += (Math.cos(p.t * 1.1 + p.seed) * 10 - p.vy) * dt;
          p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.t * 9) * 0.25;
          const flap = Math.sin(p.t * 22) > 0;
          const col = p.c < 0.4 ? '#fbf7ee' : p.c < 0.7 ? '#f4d35e' : '#ec9a54';
          const sx = R(p.x - cam.x), sy = R(p.y - cam.y);
          ctx.fillStyle = col;
          if (flap) { ctx.fillRect(sx - 2, sy - 1, 2, 2); ctx.fillRect(sx + 1, sy - 1, 2, 2); } else { ctx.fillRect(sx - 1, sy - 2, 1, 2); ctx.fillRect(sx + 1, sy - 2, 1, 2); }
          ctx.fillStyle = '#2a2420'; ctx.fillRect(sx, sy - 1, 1, 2);
          break;
        }
        case 'petal':
        case 'leaf': {
          p.x += (Math.sin(p.t * 1.6 + p.seed) * 14 + 8) * dt;
          p.y += (p.kind === 'leaf' ? 16 : 12) * dt;
          const sx = R(p.x - cam.x), sy = R(p.y - cam.y);
          const flip = Math.sin(p.t * 5 + p.seed) > 0;
          ctx.fillStyle = p.kind === 'petal' ? (p.c < 0.5 ? C.BLOSSOM[3] : C.BLOSSOM[2]) : (p.c < 0.5 ? C.LEAF[3] : '#d4a83a');
          ctx.fillRect(sx, sy, flip ? 2 : 1, flip ? 1 : 2);
          if (p.kind === 'leaf') ctx.fillRect(sx + 1, sy + 1, 1, 1);
          break;
        }
        case 'dragonfly': {
          if (Math.floor(p.t * 0.8) !== p.hop) {                 // vol par à-coups
            p.hop = Math.floor(p.t * 0.8);
            p.vx = (r() - 0.5) * 120; p.vy = (r() - 0.5) * 40;
          }
          p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const sx = R(p.x - cam.x), sy = R(p.y - cam.y);
          ctx.fillStyle = '#3f8fae'; ctx.fillRect(sx - 3, sy, 6, 1);
          ctx.fillStyle = Math.sin(p.t * 40) > 0 ? 'rgba(230, 245, 255, 0.85)' : 'rgba(230, 245, 255, 0.4)';
          ctx.fillRect(sx - 1, sy - 2, 1, 2); ctx.fillRect(sx + 1, sy - 2, 1, 2);
          break;
        }
        case 'mote': {
          p.x += Math.sin(p.t * 0.5 + p.seed) * 4 * dt + 3 * dt;
          p.y -= 2 * dt;
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(p.t * 2 + p.seed);
          ctx.fillStyle = '#fff3c4';
          ctx.fillRect(R(p.x - cam.x), R(p.y - cam.y), 1, 1);
          ctx.globalAlpha = 1;
          break;
        }
        default:
      }
    }
  }
}
