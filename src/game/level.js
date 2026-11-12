// Niveau : grille de tuiles + éléments (TATE, WARA, gong, porte, lanternes, torii).
// Les cartes sont dans maps.js.
import { LEVELS } from './maps.js';
import { PotagerArt } from './potager/index.js';
import { ForetArt } from './foret/index.js';
import { Forest } from './foret/mechanics.js';

export const TILE = 16;
const DOOR_TIME = 0.6;   // s pour que la porte se lève
const GATE_TIME = 4.2;   // s pour que les vantaux de la porte du temple s'ouvrent (lentement, vers KAGE)

export class Level {
  constructor(id = 'niveau-1') {
    const def = LEVELS[id] ?? LEVELS['niveau-1'];
    this.id = LEVELS[id] ? id : 'niveau-1';
    this.name = def.name;
    const MAP = def.map;
    // chapitre (monde continu) : zones, décors, aides contextuelles, thème graphique
    this.theme = def.theme ?? 'ville';
    this.chapter = def.chapter ?? null;
    this.music = def.music ?? null;
    this.bossMusic = def.bossMusic ?? null;   // musique du combat (fondu enchaîné à l'entrée de l'arène)
    this.boss = def.boss ?? null;     // { type, x, y } : le boss du chapitre (et son perchoir)   // { src, loopStart, loopEnd } : musique du chapitre
    this.legacyCheckpoints = def.legacyCheckpoints ?? null;   // colonnes des lanternes d'origine (anciennes sauvegardes)
    this.next = def.next ?? null;
    this.nextId = def.nextId ?? null;        // chapitre suivant (on y enchaîne après l'arrivée)
    this.intro = def.intro ?? null;          // carte de titre à l'entrée du chapitre
    this.endText = def.endText ?? null;
    this.zones = (def.zones ?? []).map((z) => ({ ...z, px0: z.x0 * TILE, px1: z.x1 * TILE }));
    this.props = def.props ?? [];
    this.hints = def.hints ?? [];
    this.backdrops = def.backdrops ?? [];
    this.coins = [];         // ryō : { id, x, y, taken }
    this.crates = new Map(); // caisses : 'tx,ty' -> { tx, ty } (tant qu'elles ne sont pas brisées)
    // coffres à ouvrir (↑ / E) : { id, x (centre), y (sol), ryo, open, openedAt } ; dx : décalage (px), pour centrer un coffre dans un creux
    this.chests = this.props.filter((p) => p.type === 'chest')
      .map((p) => ({ id: p.id, x: p.x * TILE + TILE / 2 + (p.dx ?? 0), y: p.y * TILE, ryo: p.ryo ?? 10, open: false, openedAt: -9 }));
    this.merchant = null;
    this.time = 0;
    this.rows = MAP.map((r) => r.padEnd(MAP[0].length, '.'));
    this.targets = [];
    this.enemies = [];       // positions de départ des TATE
    this.waras = [];         // positions de départ des WARA
    this.gongs = [];
    this.checkpoints = [];
    this.goal = null;
    this.doorOpen = false;
    this.doorT = 0;
    this.doorTime = (def.props ?? []).some((p) => p.type === 'temple_gate') ? GATE_TIME : DOOR_TIME;
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
        else if (c === 'W') this.waras.push({ x: px, y: py });
        else if (c === 'C') this.gongs.push({ x: px, y: py, hit: false, t: 0 });
        else if (c === 'P') this.checkpoints.push({ x: px, y: py, lit: false, t: 0 });
        else if (c === 'G') this.goal = { x: px, y: py };
        else if (c === 'o') this.coins.push({ id: `o${x}_${y}`, x: px, y: py - TILE / 2, taken: false });
        else if (c === 'M') this.merchant = { x: px, y: py };
        else if (c === 'B') this.crates.set(`${x},${y}`, { key: `${x},${y}`, tx: x, ty: y, fall: null });
      }
      this.rows[y] = this.rows[y].replace(/[TEWCPGoM]/g, '.');
    }
    // lanternes dans l'ordre du parcours (de gauche à droite)
    this.checkpoints.sort((a, b) => a.x - b.x);
    // grues de bambou : un mur de blocs ficelés suspendu au-dessus d'une fosse ;
    // un shuriken dans la corde le fait tomber dans la fosse, qu'il comble (voir cutRope)
    this.cranes = (def.cranes ?? []).map((c) => ({ ...c, cut: false, cutAt: -9, drop: 0, landed: false }));
    // plateformes fragiles de l'arène du boss : { x0, w, row (cases), ground (ligne du sol dessous) }
    this.scaffolds = (def.boss?.scaffolds ?? []).map((s) => ({ ...s, up: true, fallAt: -9, fallen: false }));
    for (const c of this.cranes) this.fillCrane(c, c.top);
    // mécaniques vivantes de la Forêt (chapitre 2) : pont qui s'effondre, lianes, statue, éboulis…
    this.forest = def.forest ? new Forest(this, def.forest) : null;
    // chapitre peint (décors calculés une fois, au chargement)
    this.view = { w: 480, h: 270 };
    this.art = this.theme === 'potager' ? new PotagerArt(this) : this.theme === 'foret' ? new ForetArt(this) : null;
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
    this.time += dt;
    this.updateCrates(dt);
    this.updateCranes(dt);
    this.updateScaffolds();
    for (const t of this.targets) if (t.broken) t.t += dt;
    for (const g of this.gongs) g.t += dt;
    for (const c of this.checkpoints) c.t += dt;
    if (this.doorOpen) this.doorT = Math.min(this.doorTime, this.doorT + dt);
  }

  /** Gongs, lanternes, porte et torii (dessinés avec le décor). */
  drawProps(ctx, cam) {
    const R = (v) => Math.round(v);
    if (this.art) this.art.drawBehind(ctx, cam, this.view.w, this.view.h, this.time);
    // ryō : petite pièce d'or percée d'un trou carré, qui tourne
    for (const c of this.coins) {
      if (c.taken) continue;
      let cx = c.x, cy = c.y + Math.sin(this.time * 3 + c.x) * 1.2;
      if (c.fly) {
        // pièce qui jaillit du coffre : arc de sa sortie jusqu'à sa place
        const k = (this.time - c.fly.t0) / c.fly.dur;
        if (k < 0) continue;
        if (k < 1) {
          cx = c.fly.x0 + (c.x - c.fly.x0) * k;
          cy = c.fly.y0 + (c.y - c.fly.y0) * k - c.fly.h * 4 * k * (1 - k);
        } else c.fly = null;
      }
      const sx = R(cx - cam.x), sy = R(cy - cam.y);
      const w = [3, 2, 1, 2][Math.floor(this.time * 6 + c.x / 16) % 4];
      ctx.fillStyle = '#7a5a1c';
      ctx.fillRect(sx - w - 1, sy - 4, w * 2 + 2, 8);
      ctx.fillStyle = '#e8b93c';
      ctx.fillRect(sx - w, sy - 3, w * 2, 6);
      ctx.fillStyle = '#f7dc84';
      ctx.fillRect(sx - w, sy - 3, 1, 3);
      if (w > 1) { ctx.fillStyle = '#7a5a1c'; ctx.fillRect(sx - 1, sy - 1, 2, 2); }
    }
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
      if (this.art) {
        // lanterne de papier (andon) sur un poteau, coiffée d'un petit toit
        const glow = c.lit ? 0.75 + 0.25 * Math.sin(c.t * 4) : 0;
        if (c.lit) {
          for (let rr = 22; rr > 4; rr -= 4) {
            ctx.fillStyle = `rgba(255, 200, 110, ${(0.035 + (22 - rr) * 0.004) * glow})`;
            ctx.fillRect(sx - rr, sy - 30 - rr * 0.8, rr * 2 + 1, rr * 1.6);
          }
        }
        ctx.fillStyle = '#4a3220'; ctx.fillRect(sx - 1, sy - 22, 3, 22);
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(sx - 1, sy - 22, 1, 22);
        ctx.fillStyle = '#3a2c22'; ctx.fillRect(sx - 4, sy - 2, 9, 2);
        ctx.fillStyle = c.lit ? '#f6d27a' : '#b8ad92'; ctx.fillRect(sx - 4, sy - 33, 9, 11);
        ctx.fillStyle = c.lit ? '#fff1c4' : '#d6cdb6'; ctx.fillRect(sx - 3, sy - 32, 3, 9);
        ctx.fillStyle = c.lit ? '#e09a3c' : '#8f8672';
        ctx.fillRect(sx - 4, sy - 29, 9, 1); ctx.fillRect(sx - 4, sy - 25, 9, 1);
        ctx.fillStyle = '#2a2420'; ctx.fillRect(sx - 4, sy - 34, 9, 1); ctx.fillRect(sx - 4, sy - 22, 9, 1);
        ctx.fillStyle = '#3a3f4f'; ctx.fillRect(sx - 6, sy - 36, 13, 2); ctx.fillRect(sx - 4, sy - 38, 9, 2); ctx.fillRect(sx, sy - 40, 1, 2);
        continue;
      }
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
    const lift = (this.doorT / this.doorTime) * TILE * 4;
    for (let ty = 0; ty < this.h && !this.art; ty++) {   // (dans un chapitre peint, la porte a son propre dessin)
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
    // l'arrivée : un petit torii (sauf quand une grande porte de temple marque déjà la sortie)
    if (this.goal && !this.props?.some((p) => p.type === 'temple_gate')) {
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

  /** Devant les personnages (cascade). */
  drawForeground(ctx, cam) {
    if (this.art) this.art.drawFront(ctx, cam, this.view.w, this.view.h, this.time);
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
    return c === '#' || c === '=' || c === '|' || c === 'B' || c === '%' || c === 'K' || (c === 'D' && this.doorT < this.doorTime * 0.6)
      || (c === 'J' && !this.forest?.statueOpen);
  }

  /** Passerelle « - » (poutre de charpente, plateforme de bois légère) : on la
   *  traverse en sautant par-dessous, on se pose dessus en retombant. */
  ledge(tx, ty) {
    const c = this.at(tx, ty);
    return c === '-' || c === '_';      // « _ » : plateforme fragile de l'arène du boss (elle peut s'effondrer)
  }

  // --- plateformes fragiles de l'arène du boss (« _ ») -------------------------
  /** Toutes debout (début du combat, et après une chute de KAGE). */
  restoreScaffolds() {
    for (const s of this.scaffolds) {
      s.up = true;
      s.fallAt = -9;
      for (let i = 0; i < s.w; i++) this.setTile(s.x0 + i, s.row, '_');
    }
  }

  /** Le corbeau s'est écrasé : elles s'effondrent, les plus proches d'abord. */
  collapseScaffolds(fromX) {
    for (const s of this.scaffolds) {
      if (!s.up) continue;
      s.up = false;
      const cx = (s.x0 + s.w / 2) * TILE;
      s.fallAt = this.time + Math.min(0.5, Math.abs(cx - fromX) / 600);
      s.fallen = false;
    }
    this.onEvent?.('scaffoldsShake', { x: fromX });
  }

  updateScaffolds() {
    for (const s of this.scaffolds) {
      if (s.up || s.fallen || this.time < s.fallAt) continue;
      s.fallen = true;
      for (let i = 0; i < s.w; i++) this.setTile(s.x0 + i, s.row, '.');
      this.onEvent?.('scaffoldFall', { x: (s.x0 + s.w / 2) * TILE, y: s.row * TILE, w: s.w * TILE, ground: s.ground * TILE });
    }
  }

  setTile(tx, ty, ch) {
    if (ty < 0 || ty >= this.h || tx < 0 || tx >= this.w) return;
    this.rows[ty] = this.rows[ty].slice(0, tx) + ch + this.rows[ty].slice(tx + 1);
  }

  // --- caisses : elles tombent quand plus rien ne les porte --------------------
  /** Une caisse est portée par une tuile pleine, une passerelle ou une autre caisse. */
  crateSupported(cr) {
    return this.solid(cr.tx, cr.ty + 1) || this.ledge(cr.tx, cr.ty + 1) || cr.ty + 1 >= this.h;
  }

  updateCrates(dt) {
    for (const cr of this.crates.values()) {
      if (!cr.fall) {
        if (this.crateSupported(cr)) continue;
        this.setTile(cr.tx, cr.ty, '.');
        cr.fall = { y: cr.ty * TILE, vy: 0 };
      }
      const f = cr.fall;
      f.vy = Math.min(560, f.vy + 1100 * dt);
      f.y += f.vy * dt;
      // la caisse qui tombe sur KAGE le blesse (une fois) et le repousse
      const pl = this.player;
      if (pl && !f.hitPlayer && pl.state !== 'death' && pl.state !== 'respawn') {
        const b = pl.box(), x = cr.tx * TILE;
        if (b.x < x + TILE - 2 && b.x + b.w > x + 2 && b.y < f.y + TILE && b.y + b.h > f.y + 4) {
          f.hitPlayer = true;
          this.onEvent?.('crateHit', { x: x + TILE / 2, y: f.y + TILE });
        }
      }
      const below = Math.floor((f.y + TILE) / TILE);
      if (this.solid(cr.tx, below) || this.ledge(cr.tx, below) || below >= this.h) {
        cr.ty = below - 1;
        cr.fall = null;
        this.setTile(cr.tx, cr.ty, 'B');
        this.onEvent?.('crateLand', { x: cr.tx * TILE + TILE / 2, y: below * TILE, speed: f.vy });
      } else {
        cr.ty = Math.floor(f.y / TILE);
      }
    }
  }

  /** Pose les caisses sans support directement à leur place (reprise d'une sauvegarde). */
  settleCrates() {
    for (let moved = true; moved;) {
      moved = false;
      for (const cr of this.crates.values()) {
        if (this.crateSupported(cr)) continue;
        this.setTile(cr.tx, cr.ty, '.');
        cr.ty++;
        this.setTile(cr.tx, cr.ty, 'B');
        moved = true;
      }
    }
  }

  /** Haut du premier sol sous (tx, ty) : où retombe une pièce. */
  floorBelow(tx, ty) {
    let y = ty;
    while (y < this.h && !this.solid(tx, y) && !this.ledge(tx, y)) y++;
    return y;
  }

  // --- grues de bambou -----------------------------------------------------------
  /** Écrit les blocs de la grue c dans la grille, haut à la ligne top (et efface le reste). */
  fillCrane(c, top) {
    for (let x = c.x0; x < c.x0 + c.w; x++) {
      for (let y = c.top; y < c.top + 2 * c.h; y++) if (this.at(x, y) === 'K') this.setTile(x, y, '.');
      if (top == null) continue;
      for (let y = top; y < top + c.h; y++) this.setTile(x, y, 'K');
    }
  }

  /** Un shuriken (boîte box) coupe-t-il la corde d'une grue ? */
  cutRope(box) {
    for (const c of this.cranes) {
      if (c.cut) continue;
      if (box.x < c.ropeX + 3 && box.x + box.w > c.ropeX - 3 && box.y < c.ropeY1 && box.y + box.h > c.ropeY0) {
        c.cut = true;
        c.cutAt = this.time;
        c.drop = 0;
        c.vy = 0;
        this.fillCrane(c, null);                  // les blocs tombent : ils ne bloquent plus rien
        this.onEvent?.('ropeCut', { x: c.ropeX, y: (c.ropeY0 + c.ropeY1) / 2, id: c.id });
        return c;
      }
    }
    return null;
  }

  updateCranes(dt) {
    for (const c of this.cranes) {
      if (!c.cut || c.landed) continue;
      if (this.time - c.cutAt < 0.12) continue;   // la corde claque, un temps, puis la chute
      c.vy = Math.min(620, c.vy + 1300 * dt);
      c.drop += c.vy * dt;
      if (c.drop >= c.h * TILE) {
        c.drop = c.h * TILE;
        c.landed = true;
        this.fillCrane(c, c.top + c.h);           // la fosse est comblée, à ras du sol
        this.onEvent?.('craneLand', { x: (c.x0 + c.w / 2) * TILE, y: (c.top + 2 * c.h) * TILE, id: c.id, w: c.w * TILE });
      }
    }
  }

  /** Grue coupée lors d'une partie précédente : blocs déjà dans la fosse. */
  dropCrane(id) {
    const c = this.cranes.find((k) => k.id === id);
    if (!c || c.cut) return;
    c.cut = true;
    c.landed = true;
    c.drop = c.h * TILE;
    this.fillCrane(c, c.top + c.h);
  }

  // --- ryō et caisses --------------------------------------------------------
  /** Ramasse les ryō touchés ; renvoie la liste des pièces prises. */
  takeCoins(box) {
    const got = [];
    for (const c of this.coins) {
      if (c.taken || c.fly) continue;
      if (box.x < c.x + 4 && box.x + box.w > c.x - 4 && box.y < c.y + 5 && box.y + box.h > c.y - 5) {
        c.taken = true;
        got.push(c);
      }
    }
    return got;
  }

  /** Brise les caisses touchées (sabre, coup de pied) : chacune lâche un ryō. */
  breakCrates(box) {
    const broken = [];
    for (const [key, cr] of this.crates) {
      const x = cr.tx * TILE, y = cr.fall ? cr.fall.y : cr.ty * TILE;
      if (box.x < x + TILE && box.x + box.w > x && box.y < y + TILE && box.y + box.h > y) {
        this.crates.delete(key);
        if (!cr.fall) this.setTile(cr.tx, cr.ty, '.');
        // identifiant tiré de la place d'origine de la caisse (même si elle est tombée depuis)
        this.coins.push({ id: `c${key.replace(',', '_')}`, x: x + TILE / 2, y: y + TILE / 2, taken: false });
        broken.push({ key, x: x + TILE / 2, y: y + TILE / 2 });
      }
    }
    return broken;
  }

  /**
   * Ouvre un coffre : ses ryō jaillissent en gerbe et retombent devant lui, en
   * deux rangées (ramassées en passant, comme les autres). silent : reprise
   * d'une sauvegarde (pièces déjà posées, pas d'animation).
   */
  openChest(ch, silent = false) {
    if (ch.open) return [];
    ch.open = true;
    ch.openedAt = silent ? -9 : this.time;
    // places : deux rangées, de part et d'autre du coffre et au-dessus, les plus proches d'abord ;
    // seulement là où il y a un sol (terre, planche ou branche) et de l'air au-dessus : jamais dans un
    // mur, jamais dans le vide. S'il n'y a pas assez de place, le coffre donne moins de ryō.
    const row = Math.round(ch.y / TILE);
    const floor = (tx) => this.solid(tx, row) || this.ledge(tx, row);
    const free = (x, y) => !this.solid(Math.floor(x / TILE), Math.floor(y / TILE));
    const spots = [];
    for (const dy of [8, 20]) for (let k = -8; k <= 8; k++) {
      const dx = k * 12 + (dy === 20 ? 6 : 0);
      if (dy === 8 && Math.abs(dx) < 20) continue;                     // (le coffre est là)
      const x = ch.x + dx, tx = Math.floor(x / TILE);
      if (!floor(tx) || !free(x, ch.y - dy) || !free(x, ch.y - 2)) continue;
      // pas de mur entre le coffre et la pièce
      let ok = true;
      for (let q = Math.min(ch.x, x); q <= Math.max(ch.x, x); q += 4) if (!free(q, ch.y - 4) || !floor(Math.floor(q / TILE))) { ok = false; break; }
      if (ok) spots.push([dx, dy]);
    }
    spots.sort((a, b) => Math.abs(a[0]) + a[1] * 1.6 - (Math.abs(b[0]) + b[1] * 1.6));
    const out = [];
    for (let i = 0; i < Math.min(ch.ryo, spots.length); i++) {
      const [dx, dy] = spots[i];
      const c = { id: `k${ch.id}_${i}`, x: ch.x + dx, y: ch.y - dy, taken: false };
      if (!silent) c.fly = { x0: ch.x + (i % 5) * 3 - 6, y0: ch.y - 12, t0: this.time + 0.18 + i * 0.045, dur: 0.6, h: 26 + (i % 3) * 8 };
      this.coins.push(c);
      out.push(c);
    }
    return out;
  }

  /** Coffre devant lequel se tient KAGE (encore fermé), ou null. */
  chestNear(x, y) {
    return this.chests.find((c) => !c.open && Math.abs(x - c.x) < 26 && Math.abs(y - c.y) < 12) ?? null;
  }

  /** Applique une sauvegarde : ryō déjà pris, caisses déjà brisées, coffres ouverts. */
  applySave(save) {
    this.forest?.applySave(save);
    const taken = new Set(save.coins ?? []);
    for (const id of save.chests ?? []) {
      const ch = this.chests.find((c) => c.id === id);
      if (ch) this.openChest(ch, true);
    }
    for (const key of save.crates ?? []) {
      const cr = this.crates.get(key);
      if (!cr) continue;
      this.crates.delete(key);
      this.setTile(cr.tx, cr.ty, '.');
    }
    // les caisses restantes retombent d'un coup ; le ryō d'une caisse brisée est posé au sol sous elle
    this.settleCrates();
    for (const key of save.crates ?? []) {
      const [tx, ty] = key.split(',').map(Number);
      if (Number.isNaN(tx)) continue;
      const fy = this.floorBelow(tx, ty);
      this.coins.push({ id: `c${tx}_${ty}`, x: tx * TILE + TILE / 2, y: (fy - 1) * TILE + TILE / 2, taken: false });
    }
    for (const id of save.cranes ?? []) this.dropCrane(id);
    for (const c of this.coins) if (taken.has(c.id)) c.taken = true;
  }

  /** Zone où se trouve x (en pixels), ou null. */
  zoneAt(x) {
    return this.zones.find((z) => x >= z.px0 && x < z.px1) ?? null;
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

  /** Le vide d'un ravin (« v ») : on y meurt. */
  hitsVoid(box) {
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w - 1) / TILE);
    const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.at(tx, ty) === 'v') return true;
    return false;
  }

  /** Les pics ne tuent que dans leur moitié basse (plus juste pour le joueur). */
  hitsSpike(box) {
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w - 1) / TILE);
    const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const c = this.at(tx, ty);
        if (c === '~') {
          // eau : on y tombe dès qu'on y met les pieds
          const wy = ty * TILE + 4;
          if (box.y + box.h > wy) return true;
          continue;
        }
        if (c !== '^') continue;
        const sx = tx * TILE + 3, sy = ty * TILE + 8;
        if (box.x < sx + TILE - 6 && box.x + box.w > sx && box.y < sy + 8 && box.y + box.h > sy) return true;
      }
    }
    return false;
  }

  draw(ctx, cam, viewW, viewH) {
    if (this.art) {
      this.view = { w: viewW, h: viewH };
      this.art.drawBack(ctx, cam, viewW, viewH, this.time);
      return;
    }
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
