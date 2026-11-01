// Commandes tactiles dessinées dans le jeu (pixel art) :
// - joystick flottant sous le pouce gauche (gauche/droite = courir, bas = glissade,
//   coup très rapide et court vers un côté = dash) ;
// - boutons ronds sous le pouce droit : saut (le plus gros), sabre, shuriken.
// Les positions sont en pixels du jeu ; les doigts sont convertis via l'échelle.

const STICK = {
  radius: 16,        // course maximale du pouce
  dead: 4,           // zone morte
  flickOut: 0.7,     // un dash demande d'atteindre 70 % de la course...
  flickFast: 0.12,   // ... en moins de 0,12 s depuis la zone morte...
  flickBack: 0.22,   // ... puis de revenir (ou relâcher) en moins de 0,22 s
  down: 0.6,         // vers le bas au-delà de 60 % = glissade
};

// Icônes en pixel art (# = pixel allumé), lisibles d'un coup d'œil sous le pouce.
const ICONS = {
  jump: [
    '.....#.....',
    '....###....',
    '...#####...',
    '..#######..',
    '.#########.',
    '....###....',
    '....###....',
    '....###....',
    '....###....',
  ],
  // même dessin que le shuriken du jeu (image « spin0 » de la forge), affiché
  // en pixels doublés : # = lame, o = centre ajouré
  throw: [
    '...#...',
    '...#...',
    '..###..',
    '###o###',
    '..###..',
    '...#...',
    '...#...',
  ],
  attack: [
    '...........##',
    '..........###',
    '.........###.',
    '........###..',
    '.......###...',
    '......###....',
    '.....###.....',
    '.#..###......',
    '.#####.......',
    '..###........',
    '.##.##.......',
    '##...#.......',
    '#............',
  ],
};

const COLORS = {
  fill: 'rgba(10, 12, 16, 0.38)',
  fillDown: 'rgba(233, 229, 218, 0.42)',
  edge: 'rgba(233, 229, 218, 0.6)',
  icon: '#e9e5da',
  iconDown: '#15171c',
  knob: 'rgba(233, 229, 218, 0.7)',
  iconEdge: 'rgba(6, 7, 10, 0.55)',
};

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.5 && d > r - 0.5) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/** Icône avec contour sombre translucide (aspect d'un sprite), pixels agrandis k fois. */
function outlinedIcon(ctx, src, cx, cy, color, edge, k = 1) {
  const rows = src.flatMap((r) => Array(k).fill([...r].map((c) => c.repeat(k)).join('')));
  const h = rows.length, w = rows[0].length;
  const at = (x, y) => (rows[y] && rows[y][x]) || '.';
  const ox = cx - (w >> 1), oy = cy - (h >> 1);
  ctx.fillStyle = edge;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (at(x, y) !== '.') continue;
      if ([at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].includes('#')) ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  icon(ctx, rows, cx, cy, color);
}

function icon(ctx, rows, cx, cy, color) {
  const h = rows.length, w = rows[0].length;
  ctx.fillStyle = color;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) if (row[x] === '#') ctx.fillRect(cx - (w >> 1) + x, cy - (h >> 1) + y, 1, 1);
  });
}

export class TouchControls {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;
    this.scale = 1;
    this.buttons = [];
    this.pointers = new Map();      // pointerId -> { type: 'stick' | 'button', ... }
    this.stick = null;              // { id, ox, oy, x, y, outAt, outDir }
    this.layout(320, 180, 1);

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    canvas.addEventListener('pointermove', (e) => this.move(e), opts);
    for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, (e) => this.up(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  layout(w, h, scale) {
    this.w = w;
    this.h = h;
    this.scale = scale;
    this.home = { x: 34, y: h - 34 };   // position du joystick au repos
    this.buttons = [
      { action: 'jump', x: w - 28, y: h - 30, r: 17 },
      { action: 'attack', x: w - 68, y: h - 22, r: 14 },
      { action: 'throw', x: w - 56, y: h - 62, r: 14 },
    ];
  }

  toGame(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / this.scale, y: (e.clientY - rect.top) / this.scale };
  }

  hitButton(p) {
    return this.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 5);
  }

  down(e) {
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.toGame(e);
    const b = this.hitButton(p);
    if (b) {
      this.pointers.set(e.pointerId, { type: 'button', button: b });
      b.down = true;
      this.input.press(b.action);
    } else if (p.x < this.w * 0.5 && !this.stick) {
      // le pouce se pose au centre du joystick : point de départ d'un éventuel coup rapide
      this.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y, outAt: -1, outDir: 0, leftDeadAt: performance.now() / 1000 };
      this.pointers.set(e.pointerId, { type: 'stick' });
    }
  }

  move(e) {
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    e.preventDefault();
    const p = this.toGame(e);
    s.x = p.x;
    s.y = p.y;
    this.updateStick();
  }

  up(e) {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    e.preventDefault();
    this.pointers.delete(e.pointerId);
    if (info.type === 'button') {
      info.button.down = false;
      this.input.release(info.button.action);
    } else if (this.stick && this.stick.id === e.pointerId) {
      this.checkFlick(true);
      this.stick = null;
      this.input.setHeld('left', false);
      this.input.setHeld('right', false);
      this.input.setHeld('down', false);
    }
  }

  /** Décalage du pouce, limité à la course du joystick. */
  offset() {
    const s = this.stick;
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK.radius) {
      dx *= STICK.radius / d;
      dy *= STICK.radius / d;
    }
    return { dx, dy };
  }

  updateStick() {
    const s = this.stick;
    const { dx, dy } = this.offset();
    const now = performance.now() / 1000;
    const inDead = Math.abs(dx) <= STICK.dead;
    this.input.setHeld('left', dx < -STICK.dead);
    this.input.setHeld('right', dx > STICK.dead);
    const wantDown = dy > STICK.radius * STICK.down && Math.abs(dy) > Math.abs(dx);
    if (wantDown && !this.input.isHeld('down')) this.input.press('down');
    if (!wantDown) this.input.setHeld('down', false);

    // détection du coup rapide : sortie de la zone morte -> bord en < 0,12 s
    if (inDead) {
      this.checkFlick(false);
      s.leftDeadAt = now;
      s.outAt = -1;
    } else if (s.outAt < 0 && Math.abs(dx) >= STICK.radius * STICK.flickOut) {
      if (s.leftDeadAt >= 0 && now - s.leftDeadAt <= STICK.flickFast) {
        s.outAt = now;
        s.outDir = Math.sign(dx);
      } else {
        s.outAt = Infinity;   // poussée lente : simple course
      }
    }
  }

  /** Le coup est validé s'il revient au centre (ou si on relâche) assez vite. */
  checkFlick(released) {
    const s = this.stick;
    if (!s || s.outAt < 0 || s.outAt === Infinity) return;
    const now = performance.now() / 1000;
    if (now - s.outAt <= STICK.flickBack) {
      this.input.pressed.add(s.outDir > 0 ? 'dash_right' : 'dash_left');
      // on garde un instant la direction pour que le dash parte du bon côté
      if (!released) s.leftDeadAt = now;
    }
    s.outAt = -1;
  }

  draw(ctx) {
    // joystick : socle et pouce
    const s = this.stick;
    const base = s ? { x: Math.round(s.ox), y: Math.round(s.oy) } : this.home;
    disc(ctx, base.x, base.y, STICK.radius + 4, COLORS.fill);
    circle(ctx, base.x, base.y, STICK.radius + 4, COLORS.edge);
    const { dx, dy } = s ? this.offset() : { dx: 0, dy: 0 };
    disc(ctx, Math.round(base.x + dx), Math.round(base.y + dy), 7, COLORS.knob);

    // boutons
    for (const b of this.buttons) {
      disc(ctx, b.x, b.y, b.r, b.down ? COLORS.fillDown : COLORS.fill);
      circle(ctx, b.x, b.y, b.r, COLORS.edge);
      const c = b.down ? COLORS.iconDown : COLORS.icon;
      if (b.action === 'throw') outlinedIcon(ctx, ICONS.throw, b.x, b.y, c, COLORS.iconEdge, 2);
      else icon(ctx, ICONS[b.action], b.x, b.y, c);
    }
  }
}
