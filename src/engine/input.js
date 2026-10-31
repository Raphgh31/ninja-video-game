// Clavier + boutons tactiles. `pressed` = appui sur cette frame, `held` = maintenu.
// Double appui rapide sur gauche ou droite = dash dans cette direction.
const DOUBLE_TAP = 0.25; // s
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyL: 'jump',
  KeyK: 'slide', KeyC: 'slide',
  KeyH: 'debug',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.lastTap = { left: -1, right: -1 };
    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      this.press(a);
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    addEventListener('blur', () => this.held.clear());
  }

  bindTouch(root) {
    for (const btn of root.querySelectorAll('[data-action]')) {
      const actions = btn.dataset.action.split(' ');
      const down = (e) => {
        e.preventDefault();
        for (const a of actions) this.press(a);
        btn.classList.add('is-down');
      };
      const up = (e) => {
        e.preventDefault();
        for (const a of actions) this.held.delete(a);
        btn.classList.remove('is-down');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
  }

  press(a) {
    if (!this.held.has(a)) {
      this.pressed.add(a);
      if (a === 'left' || a === 'right') {
        const now = performance.now() / 1000;
        if (now - this.lastTap[a] < DOUBLE_TAP) {
          this.pressed.add(`dash_${a}`);
          this.lastTap[a] = -1;   // un triple appui ne relance pas un 2e dash
        } else {
          this.lastTap[a] = now;
        }
      }
    }
    this.held.add(a);
  }

  isHeld(a) { return this.held.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); }
}
