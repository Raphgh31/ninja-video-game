// Terrain d'essai : un long sol plat, fermé par un mur à chaque extrémité.
// # = bloc   ^ = pics   S = départ   T = cible d'entraînement (se brise au sabre)
export const TILE = 16;

const MAP = [
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '........................................................................................................................',
  '#......................................................................................................................#',
  '#......................................................................................................................#',
  '#...S..................................................................................................................#',
  '########################################################################################################################',
  '########################################################################################################################',
  '########################################################################################################################',
];

export class Level {
  constructor() {
    this.rows = MAP.map((r) => r.padEnd(MAP[0].length, '.'));
    this.targets = [];
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
        if (this.rows[y][x] !== 'T') continue;
        this.targets.push({ x: x * TILE + TILE / 2, y: (y + 1) * TILE, broken: false, t: 0, dir: 1 });
      }
      this.rows[y] = this.rows[y].replaceAll('T', '.');
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

  solid(tx, ty) { return this.at(tx, ty) === '#'; }

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
    ctx.fillStyle = '#7f8b9b';
    for (let i = 0; i < 9; i++) {
      const x = Math.round(((i * 97 - cam.x * 0.25) % (viewW + 80) + viewW + 80) % (viewW + 80)) - 40;
      ctx.fillRect(x, viewH - 120 - (i % 3) * 18, 34 + (i % 4) * 9, 140);
    }
    ctx.fillStyle = '#a3adba';
    ctx.fillRect(0, viewH - 30, viewW, 30);

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
