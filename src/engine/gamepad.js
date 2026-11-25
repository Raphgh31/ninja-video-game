// Les manettes (25 novembre 2026, demande de Raph ; essayées avec la DualSense de la PS5). L'API Gamepad des
// navigateurs : la manette est lue à chaque image (poll), dans la disposition standard (Xbox, PlayStation,
// Switch Pro, MFi). Rien n'arrive avant le premier appui sur un de ses boutons (règle des navigateurs).
//
// En jeu, elle pilote les mêmes actions que le clavier (src/engine/input.js) :
//   stick gauche ou croix : se déplacer ; stick poussé à fond sur le côté : sprint ;
//   en diagonale bas-avant en courant : glissade ; haut franc : parler, tirer la corde, grimper ;
//   Croix (A) : sauter (salto au 2e appui en l'air) · Carré (X) : sabre · Rond (B) : coup de pied ·
//   Triangle (Y) : shuriken · R2 : dash à droite · L2 : dash à gauche · R1 ou L1 : parade (arène) ·
//   Options (Start) : pause.
// Dans les menus (intro, menus, boutique, salon, pause), elle devient des touches : la croix et le stick
// déplacent le choix (flèches, avec répétition), Croix valide (le bouton choisi), Rond revient (Échap).
//
// Petites vibrations aux coups (là où le navigateur le permet).

// les boutons de la disposition standard
const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, create: 8, options: 9, up: 12, down: 13, left: 14, right: 15 };
const ACT = { cross: 'jump', square: 'attack', circle: 'kick', triangle: 'throw' };
export const PAD = {
  dead: 0.32,        // zone morte du stick (gauche, droite)
  down: 0.5,         // bas : à partir de là (la diagonale bas-avant vaut glissade)
  up: 0.68,          // haut : il faut pousser franchement (on ne parle pas au marchand par accident)
  sprint: 0.93,      // stick poussé presque à fond sur le côté : sprint
  sprintBack: 0.8,   // (relâché en dessous)
  trigger: 0.45,     // gâchette enfoncée à moitié : dash
  repeat0: 0.38,     // menus : premier déplacement répété après…
  repeat: 0.13,      // … puis tous les…
};

export class Gamepads {
  /**
   * input : l'Input du jeu ; ui() : vrai quand un menu a la main ; onPause() : le bouton Options en jeu ;
   * onActive(on) : une manette vient de servir (on cache alors les commandes tactiles) ; confirm() : Croix,
   * d'abord proposée au jeu (l'intro), vrai si elle a servi.
   */
  constructor(input, { ui = () => false, onPause = () => {}, onActive = () => {}, confirm = () => false } = {}) {
    this.input = input;
    this.confirm = confirm;   // Croix d'abord proposée au jeu (l'intro qui se lance ou se passe) ; vrai si elle a servi
    this.ui = ui;
    this.onPause = onPause;
    this.onActive = onActive;
    this.prev = {};          // les boutons de l'image d'avant
    this.held = new Set();   // les actions tenues par la manette (on ne relâche que les siennes)
    this.trig = { l2: false, r2: false };
    this.sprint = false;
    this.nav = { dir: null, next: 0 };
    this.pad = null;         // la manette suivie (la première qui sert)
    this.active = false;
    addEventListener('gamepaddisconnected', (e) => { if (this.pad?.index === e.gamepad.index) { this.pad = null; this.releaseAll(); } });
  }

  /** Les manettes visibles (une liste vide si le navigateur ou la page les refusent). */
  list() {
    try { return [...(navigator.getGamepads?.() ?? [])].filter(Boolean); } catch { return []; }
  }

  /** À chaque image : lit la manette et met à jour les actions (ou les touches des menus). */
  poll() {
    const pads = this.list();
    if (!pads.length) { if (this.pad) { this.pad = null; this.releaseAll(); } return; }
    // la manette suivie : la première dont un bouton ou le stick a bougé
    let p = this.pad ? pads.find((g) => g.index === this.pad.index) : null;
    if (!p) p = pads.find((g) => g.buttons.some((b) => b.pressed) || Math.hypot(g.axes[0] ?? 0, g.axes[1] ?? 0) > 0.5);
    if (!p) return;
    this.pad = p;
    const btn = (k) => { const b = p.buttons[B[k]]; return !!b && (b.pressed || b.value > 0.5); };
    const val = (k) => p.buttons[B[k]]?.value ?? (btn(k) ? 1 : 0);
    const now = {};
    for (const k of Object.keys(B)) now[k] = btn(k);
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    const x = now.left ? -1 : now.right ? 1 : Math.abs(ax) > PAD.dead ? ax : 0;
    const y = now.up ? -1 : now.down ? 1 : ay;
    const any = Object.values(now).some(Boolean) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5;
    if (any && !this.active) { this.active = true; this.onActive(true); }
    if (this.ui()) {
      // un menu a la main : la manette ne joue pas, elle choisit
      if (this.held.size) this.releaseAll();
      this.menu(now, x, y);
    } else {
      this.nav.dir = null;
      this.game(now, val, x, y, ax, ay);
    }
    this.prev = now;
  }

  hold(a, on) {
    if (on === this.held.has(a)) return;
    if (on) this.held.add(a); else this.held.delete(a);
    this.input.setHeld(a, on);
  }

  releaseAll() {
    for (const a of [...this.held]) { this.held.delete(a); this.input.setHeld(a, false); }
    this.sprint = false;
  }

  game(now, val, x, y, ax, ay) {
    const fresh = (k) => now[k] && !this.prev[k];
    this.hold('left', x < 0);
    this.hold('right', x > 0);
    // bas : le stick (ou la croix) vers le bas ; en courant, la diagonale bas-avant donne la glissade
    this.hold('down', y > PAD.down);
    // haut : franc (stick vers le haut plus que sur le côté), ou la flèche haut de la croix
    const up = now.up || (ay < -PAD.up && Math.abs(ay) > Math.abs(ax));
    this.hold('up', up);
    this.hold('stick_up', up);
    // sprint : stick poussé presque à fond sur le côté (comme le pouce hors du cercle sur téléphone)
    const side = Math.abs(ax) > Math.abs(ay) ? Math.hypot(ax, ay) : 0;
    if (!this.sprint && side >= PAD.sprint) this.sprint = true;
    else if (this.sprint && side < PAD.sprintBack) this.sprint = false;
    this.hold('sprint', this.sprint);
    for (const [k, a] of Object.entries(ACT)) this.hold(a, now[k]);
    this.hold('parry', now.l1 || now.r1);   // la parade (mode Arène) : R1 ou L1
    // dash : R2 vers la droite, L2 vers la gauche (dès la mi-course)
    for (const [k, a] of [['r2', 'dash_right'], ['l2', 'dash_left']]) {
      const on = val(k) > PAD.trigger;
      if (on && !this.trig[k]) this.input.pressed.add(a);
      this.trig[k] = on;
    }
    if (fresh('options')) { this.releaseAll(); this.onPause(); }
  }

  /** Les menus : des touches (flèches répétées, Entrée sur le bouton choisi, Échap). */
  menu(now, x, y) {
    const fresh = (k) => now[k] && !this.prev[k];
    const t = performance.now() / 1000;
    const dir = Math.abs(x) >= Math.abs(y) ? (x < -0.5 ? 'ArrowLeft' : x > 0.5 ? 'ArrowRight' : null) : (y < -0.5 ? 'ArrowUp' : y > 0.5 ? 'ArrowDown' : null);
    if (dir !== this.nav.dir) { this.nav.dir = dir; if (dir) { key(dir); this.nav.next = t + PAD.repeat0; } }
    else if (dir && t >= this.nav.next) { key(dir); this.nav.next = t + PAD.repeat; }
    if (fresh('cross') && !this.confirm()) {
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON' && !el.disabled) el.click();
      else key('Enter', 'Enter');
    }
    if (fresh('circle') || fresh('options')) key('Escape', 'Escape');
  }

  /** Une petite vibration (coups, chutes), si la manette et le navigateur le permettent. */
  rumble(ms = 90, strong = 0.5, weak = 0.3) {
    const v = this.pad?.vibrationActuator;
    if (!v || !this.active) return;
    try { v.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch { /* rien */ }
  }
}

/** Une touche simulée, envoyée là où le clavier l'aurait été (l'élément choisi, sinon la page). */
function key(k, code = k) {
  const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key: k, code, bubbles: true, cancelable: true }));
}
