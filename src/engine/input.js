// Clavier + boutons tactiles. `pressed` = appui sur cette frame, `held` = maintenu.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', KeyZ: 'up',   // direction (dash vertical)
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyL: 'jump',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyJ: 'dash', KeyX: 'dash',
  KeyK: 'slide', KeyC: 'slide',
  KeyH: 'debug',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
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
        for (const a of actions) {
          if (!this.held.has(a)) this.pressed.add(a);
          this.held.add(a);
        }
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

  isHeld(a) { return this.held.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); }
}
