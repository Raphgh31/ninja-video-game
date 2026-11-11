// Commandes tactiles dessinées dans le jeu (pixel art) :
// - joystick flottant sous le pouce gauche : gauche/droite = courir ; pousser
//   au-delà du cercle (contre un « mur » qui résiste) = sprinter ; bas = glissade ;
//   coup très rapide et court vers un côté puis relâché = dash ;
// - boutons ronds sous le pouce droit : saut (le plus gros), sabre, coup de pied,
//   shuriken.
// Les positions sont en pixels du jeu ; les doigts sont convertis via l'échelle.

const STICK = {
  radius: 16,        // course maximale du pouce
  dead: 4,           // zone morte
  flickOut: 0.85,    // un dash demande d'atteindre 85 % de la course...
  flickFast: 0.08,   // ... en moins de 0,08 s depuis la zone morte...
  flickBack: 0.15,   // ... puis de relâcher le joystick en moins de 0,15 s,
  flickFlat: 2,      // ... avec un geste franchement horizontal (|dx| > 2 × |dy|)
  down: 0.6,         // vers le bas au-delà de 60 % = glissade
  // sprint : le pouce peut sortir du cercle, mais il résiste (« mur » invisible)
  wall: 0.5,         // au-delà du cercle, le pouce suit le doigt deux fois moins vite
  maxOut: 10,        // il sort au plus de 10 px du cercle
  sprintOut: 4,      // sprint dès qu'il dépasse le cercle de 4 px...
  sprintBack: 2,     // ... et retour à la course sous 2 px (évite le clignotement)
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
  // même dessin que le shuriken du jeu (image « spin0 » de la forge), en
  // pixels doublés puis rogné d'1 px sur chaque bord : o = centre ajouré
  throw: [
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '...######...',
    '...######...',
    '#####oo#####',
    '#####oo#####',
    '...######...',
    '...######...',
    '.....##.....',
    '.....##.....',
    '.....##.....',
  ],
  // KAGE en coup de pied de côté : tête, buste en arrière, jambe tendue, jambe d'appui
  kick: [
    '.##..........',
    '####.........',
    '####.........',
    '.###.........',
    '.####.....###',
    '..#########..',
    '..######.....',
    '..###........',
    '..##.........',
    '..##.........',
    '.###.........',
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
  edgeSprint: 'rgba(159, 217, 139, 0.95)',   // vert de l'anneau d'énergie : on sprinte
  icon: '#e9e5da',
  iconDown: '#15171c',
  knob: 'rgba(233, 229, 218, 0.7)',
  iconSoft: 'rgba(220, 218, 212, 0.82)',   // étoile du bouton shuriken : légèrement grisée et transparente
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
    this.rotW = 0;                  // portrait : largeur de l'écran (jeu pivoté d'un quart de tour)
    this.buttons = [];
    this.pointers = new Map();      // pointerId -> { type: 'stick' | 'button', ... }
    this.stick = null;              // { id, ox, oy, x, y, outAt, outDir }
    this.sprintOn = false;          // sprint en cours (pouce sorti du cercle)
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
      { action: 'kick', x: w - 97, y: h - 44, r: 12 },
      { action: 'throw', x: w - 56, y: h - 61, r: 12 },
    ];
  }

  /** Portrait : le jeu est pivoté de 90° (son haut est à droite de l'écran). */
  setRotation(screenW) {
    this.rotW = screenW;
  }

  toGame(e) {
    if (this.rotW) return { x: e.clientY / this.scale, y: (this.rotW - e.clientX) / this.scale };
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
    } else if (this.onTap?.(p.x / this.w, p.y / this.h)) {
      // un appui sur le jeu lui-même (un coffre) : pris par le jeu, pas par le joystick
    } else if (p.x < this.w * 0.5 && !this.stick) {
      // le pouce se pose au centre du joystick : point de départ d'un éventuel coup rapide
      this.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y, outAt: -1, outDir: 0, leftDeadAt: performance.now() / 1000, wasDead: true };
      this.input.setHeld('stick', true);
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
      this.input.setHeld('stick', false);
      this.input.setHeld('stick_up', false);
      this.setSprint(false);
    }
  }

  /** Sprint par le joystick : actif tant que le pouce est sorti du cercle. */
  setSprint(on) {
    if (on === this.sprintOn) return;
    this.sprintOn = on;
    this.input.setHeld('sprint', on);
  }

  /**
   * Décalage du pouce. Dans le cercle, il suit le doigt ; au-delà, il résiste
   * (deux fois moins vite) et sort au plus de STICK.maxOut. out = dépassement du cercle.
   */
  offset() {
    const s = this.stick;
    const fx = s.x - s.ox, fy = s.y - s.oy;
    const d = Math.hypot(fx, fy);
    if (d <= STICK.radius) return { dx: fx, dy: fy, out: 0 };
    const k = STICK.radius + Math.min((d - STICK.radius) * STICK.wall, STICK.maxOut);
    return { dx: (fx * k) / d, dy: (fy * k) / d, out: k - STICK.radius };
  }

  updateStick() {
    const s = this.stick;
    const { dx, dy } = this.offset();
    const now = performance.now() / 1000;
    const inDead = Math.abs(dx) <= STICK.dead;
    this.input.setHeld('left', dx < -STICK.dead);
    this.input.setHeld('right', dx > STICK.dead);
    // lianes (chapitre 2) : tant que le joystick est touché, KAGE reste accroché ; vers le haut, il grimpe
    this.input.setHeld('stick', true);
    this.input.setHeld('stick_up', dy < -STICK.radius * STICK.down && Math.abs(dy) > Math.abs(dx));
    const wantDown = dy > STICK.radius * STICK.down && Math.abs(dy) > Math.abs(dx);
    // sprint : pouce poussé hors du cercle, vers un côté
    const { out } = this.offset();
    const sideways = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > STICK.dead;
    if (!this.sprintOn && sideways && out >= STICK.sprintOut) this.setSprint(true);
    else if (this.sprintOn && (!sideways || out < STICK.sprintBack)) this.setSprint(false);
    if (wantDown && !this.input.isHeld('down')) this.input.press('down');
    if (!wantDown) this.input.setHeld('down', false);

    // détection du coup rapide : sortie de la zone morte -> bord en < 0,12 s
    if (inDead) {
      // revenir au centre sans lâcher annule le coup : seul le relâchement compte
      s.leftDeadAt = now;
      s.wasDead = true;
      s.outAt = -1;
    } else if (s.wasDead) {
      // le pouce vient de quitter le centre : si le doigt était posé immobile,
      // on considère que le mouvement a commencé une image avant (≈ 16 ms)
      s.wasDead = false;
      s.leftDeadAt = Math.max(s.leftDeadAt, now - 0.016);
    }
    if (inDead) {
      // rien d'autre à vérifier
    } else if (s.outAt < 0 && Math.abs(dx) >= STICK.radius * STICK.flickOut) {
      const flat = Math.abs(dx) > STICK.flickFlat * Math.abs(dy);
      if (flat && s.leftDeadAt >= 0 && now - s.leftDeadAt <= STICK.flickFast) {
        s.outAt = now;
        s.outDir = Math.sign(dx);
      } else {
        s.outAt = Infinity;   // poussée lente : simple course
      }
    }
  }

  /** Le coup est validé seulement si le pouce est relâché assez vite après. */
  checkFlick(released) {
    const s = this.stick;
    if (!s || s.outAt < 0 || s.outAt === Infinity) return;
    const now = performance.now() / 1000;
    if (now - s.outAt <= STICK.flickBack) {
      this.input.pressed.add(s.outDir > 0 ? 'dash_right' : 'dash_left');
    }
    s.outAt = -1;
  }

  draw(ctx) {
    // joystick : socle et pouce
    const s = this.stick;
    const base = s ? { x: Math.round(s.ox), y: Math.round(s.oy) } : this.home;
    disc(ctx, base.x, base.y, STICK.radius + 4, COLORS.fill);
    // contour plus vif pendant le sprint (le pouce est sorti du cercle)
    circle(ctx, base.x, base.y, STICK.radius + 4, this.sprintOn ? COLORS.edgeSprint : COLORS.edge);
    const { dx, dy } = s ? this.offset() : { dx: 0, dy: 0 };
    disc(ctx, Math.round(base.x + dx), Math.round(base.y + dy), 7, COLORS.knob);

    // boutons
    for (const b of this.buttons) {
      disc(ctx, b.x, b.y, b.r, b.down ? COLORS.fillDown : COLORS.fill);
      circle(ctx, b.x, b.y, b.r, COLORS.edge);
      const c = b.down ? COLORS.iconDown : COLORS.icon;
      icon(ctx, ICONS[b.action], b.x, b.y, b.action === 'throw' && !b.down ? COLORS.iconSoft : c);
    }
  }
}
