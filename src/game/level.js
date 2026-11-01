// Niveau : grille de tuiles + éléments (TATE, gong, porte, lanternes, torii).
// Les cartes sont dans maps.js.
import { LEVELS } from './maps.js';

export const TILE = 16;
const DOOR_TIME = 0.6;   // s pour que la porte se lève

export class Level {
  constructor(id = 'niveau-1') {
    const def = LEVELS[id] ?? LEVELS['niveau-1'];
    this.id = LEVELS[id] ? id : 'niveau-1';
    this.name = def.name;
    const MAP = def.map;
    this.rows = MAP.map((r) => r.padEnd(MAP[0].length, '.'));
    this.targets = [];
    this.enemies = [];       // positions de départ des TATE
    this.gongs = [];
    this.checkpoints = [];
    this.goal = null;
    this.doorOpen = false;
    this.doorT = 0;
    this.h = this.rows.length;
    this.w = this.rows[0].length;
    this.width = this.w * TILE;
    this.height = this.h * TILE;
    for (let y = 0; y < this.h; y++) {
      const x = this.rows[y].indexOf('S');
      if (x >= 0) {
        this.spawn = { x: x * TILE + TILE / 2, y: (y + 1) * TILE };
        this.rows[y] = this.rows[y].replace('S', '.');
      }
      for (let x = 0; x < this.w; x++) {
        const c = this.rows[y][x];
        const px = x * TILE + TILE / 2, py = (y + 1) * TILE;
        if (c === 'T') this.targets.push({ x: px, y: py, broken: false, t: 0, dir: 1 });
        else if (c === 'E') this.enemies.push({ x: px, y: py });
        else if (c === 'C') this.gongs.push({ x: px, y: py, hit: false, t: 0 });
        else if (c === 'P') this.checkpoints.push({ x: px, y: py, lit: false, t: 0 });
        else if (c === 'G') this.goal = { x: px, y: py };
      }
      this.rows[y] = this.rows[y].replace(/[TECPG]/g, '.');
    }
  }

  // --- cibles d'entraînement -------------------------------------------------
  targetBox(t) { return { x: t.x - 5, y: t.y - 18, w: 10, h: 18 }; }

  resetTargets() {
    for (const t of this.targets) { t.broken = false; t.t = 0; }
  }

  /** Brise les cibles touchées par la zone d'attaque ; renvoie le nombre de cibles brisées. */
  hitTargets(box, dir) {
    let n = 0;
    for (const t of this.targets) {
      if (t.broken) continue;
      const b = this.targetBox(t);
      if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) {
        t.broken = true;
        t.t = 0;
        t.dir = dir;
        n++;
      }
    }
    return n;
  }

  update(dt) {
    for (const t of this.targets) if (t.broken) t.t += dt;
    for (const g of this.gongs) g.t += dt;
    for (const c of this.checkpoints) c.t += dt;
    if (this.doorOpen) this.doorT = Math.min(DOOR_TIME, this.doorT + dt);
  }

  /** Gongs, lanternes, porte et torii (dessinés avec le décor). */
  drawProps(ctx, cam) {
    const R = (v) => Math.round(v);
    for (const g of this.gongs) {
      const sx = R(g.x - cam.x), sy = R(g.y - cam.y);
      // portique en bois
      ctx.fillStyle = '#4e321d';
      ctx.fillRect(sx - 8, sy - 16, 2, 16);
      ctx.fillRect(sx + 6, sy - 16, 2, 16);
      ctx.fillRect(sx - 9, sy - 17, 18, 2);
      // disque de bronze : il vibre quand il est frappé
      const wob = g.hit && g.t < 0.8 ? Math.round(Math.sin(g.t * 50) * (1 - g.t / 0.8)) : 0;
      ctx.fillStyle = g.hit ? '#b98a3e' : '#9c7a3c';
      for (let y = -5; y <= 5; y++) {
        const half = Math.floor(Math.sqrt(30 - y * y));
        ctx.fillRect(sx - half + wob, sy - 8 + y, half * 2 + 1, 1);
      }
      ctx.fillStyle = g.hit ? '#e2c071' : '#c9a35a';
      ctx.fillRect(sx - 2 + wob, sy - 10, 3, 3);
      ctx.fillStyle = '#5a4020';
      ctx.fillRect(sx - 8 + wob, sy - 8, 1, 1);
    }
    for (const c of this.checkpoints) {
      const sx = R(c.x - cam.x), sy = R(c.y - cam.y);
      ctx.fillStyle = '#3a2c22';
      ctx.fillRect(sx, sy - 20, 1, 20);                     // poteau
      ctx.fillRect(sx - 3, sy - 21, 7, 1);
      const glow = c.lit ? 0.75 + 0.25 * Math.sin(c.t * 4) : 0;
      ctx.fillStyle = c.lit ? '#f0c25a' : '#8f8a7a';         // lanterne de papier
      ctx.fillRect(sx - 2, sy - 19, 5, 6);
      ctx.fillStyle = c.lit ? '#d8963a' : '#6d6858';
      ctx.fillRect(sx - 2, sy - 17, 5, 1);
      if (c.lit) {
        ctx.globalAlpha = 0.25 * glow;
        ctx.fillStyle = '#f6dd8a';
        ctx.fillRect(sx - 5, sy - 22, 11, 12);
        ctx.globalAlpha = 1;
      }
    }
    // porte : planches cerclées de fer, qui se lève quand le gong a sonné
    const lift = (this.doorT / DOOR_TIME) * TILE * 4;
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        if (this.rows[ty][tx] !== 'D') continue;
        const sx = tx * TILE - R(cam.x), sy = ty * TILE - R(cam.y) - R(lift);
        ctx.fillStyle = '#5b3a22';
        ctx.fillRect(sx + 2, sy, 12, TILE);
        ctx.fillStyle = '#7d5533';
        ctx.fillRect(sx + 4, sy, 2, TILE);
        ctx.fillRect(sx + 9, sy, 2, TILE);
        ctx.fillStyle = '#3b3f47';
        ctx.fillRect(sx + 2, sy + 6, 12, 2);
      }
    }
    if (this.goal) {
      const sx = R(this.goal.x - cam.x), sy = R(this.goal.y - cam.y);
      ctx.fillStyle = '#a8433a';                             // torii
      ctx.fillRect(sx - 14, sy - 40, 4, 40);
      ctx.fillRect(sx + 10, sy - 40, 4, 40);
      ctx.fillRect(sx - 18, sy - 44, 36, 4);
      ctx.fillRect(sx - 15, sy - 34, 30, 3);
      ctx.fillStyle = '#1f1513';
      ctx.fillRect(sx - 20, sy - 47, 40, 3);
      ctx.fillRect(sx - 15, sy - 2, 6, 2);
      ctx.fillRect(sx + 9, sy - 2, 6, 2);
    }
  }

  drawTargets(ctx, cam) {
    for (const t of this.targets) {
      const sx = Math.round(t.x - cam.x), sy = Math.round(t.y - cam.y);
      if (!t.broken) {
        ctx.fillStyle = '#6b5236';                 // poteau
        ctx.fillRect(sx - 1, sy - 6, 2, 6);
        ctx.fillStyle = '#b89a62';                 // botte de paille
        ctx.fillRect(sx - 4, sy - 18, 8, 13);
        ctx.fillStyle = '#9c8050';
        ctx.fillRect(sx - 4, sy - 14, 8, 1);       // liens
        ctx.fillRect(sx - 4, sy - 9, 8, 1);
        ctx.fillRect(sx + 3, sy - 18, 1, 13);
      } else if (t.t < 0.6) {
        // la partie haute est tranchée, glisse et tombe ; la base reste
        const k = t.t / 0.6;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#b89a62';
        const dx = Math.round(t.dir * (3 + 14 * k)), dy = Math.round(40 * k * k);
        ctx.fillRect(sx - 4 + dx, sy - 18 + dy, 8, 6);
        ctx.globalAlpha = 1;
      }
      if (t.broken) {
        ctx.fillStyle = '#6b5236';
        ctx.fillRect(sx - 1, sy - 6, 2, 6);
        ctx.fillStyle = '#b89a62';
        ctx.fillRect(sx - 4, sy - 11, 8, 6);
        ctx.fillStyle = '#9c8050';
        ctx.fillRect(sx - 4, sy - 9, 8, 1);
      }
    }
  }

  at(tx, ty) {
    if (tx < 0 || tx >= this.w) return '#';
    if (ty < 0) return '.';
    if (ty >= this.h) return '.';
    return this.rows[ty][tx];
  }

  solid(tx, ty) {
    const c = this.at(tx, ty);
    return c === '#' || (c === 'D' && this.doorT < DOOR_TIME * 0.6);
  }

  // --- gong et porte ----------------------------------------------------------
  gongBox(g) { return { x: g.x - 7, y: g.y - 15, w: 14, h: 15 }; }

  /** Un coup (shuriken ou sabre) frappe un gong : ouvre les portes. */
  hitGongs(box) {
    let n = 0;
    for (const g of this.gongs) {
      if (g.hit) continue;
      const b = this.gongBox(g);
      if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) {
        g.hit = true;
        g.t = 0;
        this.doorOpen = true;
        this.onEvent?.('gong', { x: g.x, y: g.y - 8 });
        n++;
      }
    }
    return n;
  }

  // --- lanternes (points de sauvegarde) et arrivée -----------------------------
  /** Allume la lanterne franchie et déplace le point de réapparition. */
  checkProgress(px, py) {
    for (const c of this.checkpoints) {
      if (!c.lit && px >= c.x - 4 && Math.abs(py - c.y) < 40) {
        c.lit = true;
        c.t = 0;
        this.spawn = { x: c.x, y: c.y };
        this.onEvent?.('checkpoint', { x: c.x, y: c.y });
      }
    }
    return this.goal && px >= this.goal.x && Math.abs(py - this.goal.y) < 48;
  }

  /** Les pics ne tuent que dans leur moitié basse (plus juste pour le joueur). */
  hitsSpike(box) {
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w - 1) / TILE);
    const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.at(tx, ty) !== '^') continue;
        const sx = tx * TILE + 3, sy = ty * TILE + 8;
        if (box.x < sx + TILE - 6 && box.x + box.w > sx && box.y < sy + 8 && box.y + box.h > sy) return true;
      }
    }
    return false;
  }

  draw(ctx, cam, viewW, viewH) {
    // fond : aplats désaturés, plus clairs que le personnage pour qu'il reste lisible
    ctx.fillStyle = '#8d99a8';
    ctx.fillRect(0, 0, viewW, viewH);
    // silhouettes d'immeubles en parallaxe, posées sur le vrai sol du niveau
    const ground = Math.round((this.h - 3) * TILE - cam.y);   // haut du sol, à l'écran
    ctx.fillStyle = '#7f8b9b';
    for (let i = 0; i < 9; i++) {
      const x = Math.round(((i * 97 - cam.x * 0.25) % (viewW + 80) + viewW + 80) % (viewW + 80)) - 40;
      const top = ground - 96 - (i % 3) * 18;
      ctx.fillRect(x, top, 34 + (i % 4) * 9, viewH + 200);
    }
    // bande claire au pied des immeubles (visible seulement dans les fosses)
    ctx.fillStyle = '#a3adba';
    ctx.fillRect(0, ground + 2, viewW, viewH + 200);

    const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + viewW) / TILE);
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.at(tx, ty);
        const sx = tx * TILE - Math.round(cam.x), sy = ty * TILE - Math.round(cam.y);
        if (t === '#') {
          ctx.fillStyle = '#d9d3c4';
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = '#c3bcab';
          ctx.fillRect(sx, sy + TILE - 3, TILE, 3);
          ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
          if (!this.solid(tx, ty - 1)) {
            ctx.fillStyle = '#efeadf';
            ctx.fillRect(sx, sy, TILE, 2);
          }
        } else if (t === '^') {
          ctx.fillStyle = '#5b3a3a';
          for (let k = 0; k < 2; k++) {
            const bx = sx + 1 + k * 7;
            for (let r = 0; r < 7; r++) ctx.fillRect(bx + 3 - Math.floor(r / 2), sy + 9 + r, 1 + 2 * Math.floor(r / 2), 1);
          }
        }
      }
    }
  }
}
