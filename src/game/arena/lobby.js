// Le salon de l'arène : un écran plein, avant (et entre) les combats. Le code de
// l'arène en grand (à donner aux amis), le mode du combat (choisi par l'hôte), les
// quatre places de joueurs ; l'hôte lance le combat, les invités voient ses choix.
// À la fin d'un combat, le résultat, puis retour au salon.
import { MODES } from '../multi.js';
import { SLOT_COLORS } from '../multi.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (text, cls, onClick) => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};

export class Lobby {
  /** root : le calque de l'interface (.ui). deps : { net, multi, meta, skins, onLaunch(modeId), onQuit() } */
  constructor(root, deps) {
    Object.assign(this, deps);
    this.root = root;
    this.mode = 'souffle';
    this.status = '';
    this.el = el('section', 'm-screen solid');
    this.el.dataset.salon = '';
    this.el.setAttribute('aria-label', "Salon de l'arène");
    root.append(this.el);
    this.visible = true;
    addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.onQuit(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const items = [...this.el.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      e.preventDefault(); e.stopPropagation();
      items[(i + d + items.length) % items.length].focus();
    }, true);
    this.render();
  }

  show() { this.visible = true; this.el.hidden = false; this.render(); }
  hide() { this.visible = false; this.el.hidden = true; }
  setStatus(text) { this.status = text; this.render(); }
  setMode(id) { if (MODES[id]) { this.mode = id; this.render(); } }

  /** Le petit portrait d'un joueur (tête et buste, à son skin). */
  face(skinId) {
    const cv = el('canvas', 'm-face');
    cv.width = 22; cv.height = 22;
    const g = cv.getContext('2d'), sk = this.skins[skinId] ?? this.skins.encre, f = this.meta.animations.idle.frames[0];
    g.imageSmoothingEnabled = false;
    g.drawImage(sk.sheet, f.x + 7, f.y + 3, 22, 22, 0, 0, 22, 22);
    return cv;
  }

  render() {
    const { net } = this, host = net.host, focused = document.activeElement?.dataset?.focusKey;
    const s = this.el;
    s.replaceChildren(el('div', 'm-veil'));
    const hd = el('header', 'm-hd');
    hd.append(el('h2', null, 'Arène'));
    const body = el('div', 'm-body');
    const grid = el('div', 'm-salon');
    // à gauche : le code, puis les modes
    const left = el('div');
    left.style.cssText = 'display:grid;align-content:start;gap:3px';
    left.append(el('p', 'm-lbl', "Code de l'arène"));
    const line = el('div', 'm-codeline');
    const code = el('p', 'm-codebig', net.code);
    code.dataset.salonCode = '';
    line.append(code);
    const copy = button('Copier', null, () => {
      navigator.clipboard?.writeText(net.code).then(() => { copy.textContent = 'Copié'; }).catch(() => {});
      setTimeout(() => { copy.textContent = 'Copier'; }, 1500);
    });
    copy.dataset.focusKey = 'copy';
    line.append(copy);
    left.append(line);
    const ml = el('p', 'm-lbl', 'Mode du combat');
    ml.style.marginTop = '4px';
    left.append(ml);
    const modes = el('div', 'm-modes');
    for (const [id, m] of Object.entries(MODES)) {
      const b = el(host ? 'button' : 'div', `m-mode${id === this.mode ? ' m-on' : ''}`);
      if (host) { b.type = 'button'; b.addEventListener('click', () => { this.mode = id; net.send({ t: 'mode', mode: id }); this.render(); }); b.dataset.focusKey = `mode-${id}`; }
      b.dataset.mode = id;
      b.append(el('p', 'm-n', m.name));
      modes.append(b);
    }
    left.append(modes);
    // la règle du mode choisi, seulement elle, sous les trois noms
    const rule = el('p', 'm-muted', MODES[this.mode].text);
    rule.dataset.modeRule = '';
    rule.style.setProperty('--pxw', '196');
    left.append(rule);
    // à droite : les quatre places
    const right = el('div');
    right.style.cssText = 'display:grid;align-content:start;gap:3px';
    right.append(el('p', 'm-lbl', `Joueurs · ${net.roster.length} / 4`));
    const slots = el('div', 'm-slots');
    for (let i = 0; i < 4; i++) {
      const p = net.roster.find((r) => r.slot === i);
      const slot = el('div', `m-slot${p ? ' m-full' : ''}`);
      const bar = el('span', 'm-bar');
      bar.style.background = p ? SLOT_COLORS[i] : '#2a2e36';
      slot.append(bar);
      if (p) {
        const me = p.id === net.id;
        slot.append(this.face(me ? this.multi.skinId() : this.multi.remotes.get(p.id)?.skin ?? 'encre'));
        slot.append(el('p', 'm-ink', me ? `${p.name} (toi)` : p.name));
        if (p.slot === 0) slot.append(el('p', 'm-tag m-gold', 'hôte'));
      }
      slots.append(slot);
    }
    right.append(slots);
    // un message seulement s'il y a quelque chose à dire (connexion, hôte parti…)
    if (this.status) {
      const msg = el('p', 'm-warm', this.status);
      msg.dataset.salonMsg = '';
      msg.style.setProperty('--pxw', '180');
      msg.style.marginTop = '4px';
      right.append(msg);
    }
    grid.append(left, right);
    body.append(grid);
    const ft = el('footer', 'm-ft');
    const quit = button("Quitter l'arène", 'm-link', () => this.onQuit());
    quit.dataset.quit = '';
    ft.append(quit);
    if (host) {
      const go = button('Lancer le combat', 'm-gold-btn', () => this.onLaunch(this.mode));
      go.dataset.launch = '';
      go.dataset.focusKey = 'launch';
      go.disabled = net.roster.length < 2;
      if (go.disabled) go.title = 'Il faut au moins deux joueurs';
      ft.append(go);
    }
    s.append(hd, body, ft);
    // garder le focus au même endroit après un nouveau rendu
    const keep = focused && s.querySelector(`[data-focus-key="${focused}"]`);
    if (keep) keep.focus();
    else if (this.visible && !s.contains(document.activeElement)) setTimeout(() => (s.querySelector('[data-launch]:not(:disabled)') ?? s.querySelector('[data-focus-key="copy"]'))?.focus(), 20);
  }

  /** Fin d'un combat : le vainqueur et les points, puis retour au salon. */
  result(winnerName, lines) {
    const s = this.el;
    this.visible = true;
    s.hidden = false;
    s.replaceChildren(el('div', 'm-veil'));
    const box = el('div', 'm-center');
    box.style.cssText = 'grid-row:1 / 4;align-content:center;gap:6px';
    box.append(el('p', 'm-lbl', MODES[this.mode]?.name ?? ''), el('p', 'm-big', winnerName ? `Victoire de ${winnerName}` : 'Égalité'));
    for (const l of lines) box.append(el('p', 'm-muted', l));
    s.append(box);
  }
}
