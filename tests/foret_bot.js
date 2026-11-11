// Petit pilote pour les tests de la Forêt : injecté dans la page, il tient des
// touches et fait avancer le jeu pas à pas (__kage.step), sans attendre le temps réel.
window.bot = {
  T: 16,
  get k() { return window.__kage; },
  get p() { return window.__kage.player; },
  set(keys) {                                   // { right: true, sprint: false… }
    for (const [a, on] of Object.entries(keys)) this.k.input.setHeld(a, on);
  },
  clear() { for (const a of ['left', 'right', 'up', 'down', 'sprint', 'jump', 'attack', 'stick']) this.k.input.setHeld(a, false); },
  /** Un appui : la touche est relâchée puis enfoncée (le saut reste tenu : saut de pleine hauteur). */
  tap(a) { this.k.input.setHeld(a, false); this.k.input.setHeld(a, true); if (a !== 'jump') this._untap = a; },
  dash(dir) { this.k.input.pressed.add(dir > 0 ? 'dash_right' : 'dash_left'); },
  /** Pose KAGE debout sur le sol de la colonne (ou à la ligne donnée), tout remis à neuf. */
  place(col, row = null) {
    const k = this.k, l = k.level, p = k.player;
    if (row == null) { row = 0; while (row < l.h && !(l.solid(col, row) || l.ledge(col, row))) row++; }
    l.spawn = { x: col * 16 + 8, y: row * 16 };
    p.respawn(true);
    this.clear();
    k.step(2);
    return row;
  },
  /** Avance d'au plus `seconds` ; fn(p, t) règle les touches et renvoie true pour arrêter. */
  run(seconds, fn) {
    const n = Math.round(seconds * 120);
    for (let i = 0; i < n; i++) {
      if (fn && fn(this.p, i / 120) === true) return i / 120;
      this.k.step(1);
      if (this._untap) { this.k.input.setHeld(this._untap, false); this._untap = null; }
    }
    return seconds;
  },
  col() { return Math.floor(this.p.x / 16); },
  row() { return Math.round(this.p.y / 16); },
  dead() { return this.p.state === 'death' || this.p.state === 'respawn'; },
  /** Y a-t-il du sol (ou une passerelle) juste devant, dans la colonne c ? */
  groundAt(c, fromRow, depth = 3) {
    const l = this.k.level;
    for (let r = fromRow; r < fromRow + depth; r++) if (l.solid(c, r) || l.ledge(c, r)) return true;
    // les planches du pont suspendu (plateformes mobiles) comptent comme un sol
    const plats = [...(l.forest?.bridges ?? []).flatMap((b) => b.planks), ...(l.forest?.snaps ?? [])];
    for (const p of plats) if (p.active && c * 16 + 8 >= p.x && c * 16 + 8 < p.x + p.w && p.y >= fromRow * 16 - 20 && p.y < (fromRow + depth) * 16) return true;
    return false;
  },
  /**
   * Coureur : va vers la droite, saute les marches et les trous, glisse sous les
   * plafonds bas. o : { sprint, dashGap (largeur de trou à partir de laquelle il dashe en l'air), until(p) }
   */
  runner(seconds, o = {}) {
    let airDashed = false;
    return this.run(seconds, (p) => {
      if (o.until && o.until(p)) return true;
      if (this.dead()) return true;
      const l = this.k.level, c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
      // souffler : à l'arrêt sur un sol sûr quand l'énergie est basse (comme un joueur entre deux obstacles)
      if (o.rest && p.onGround && !p.ride && (p.energy.value < 0.45 || (this._resting && p.energy.value < 0.97))) {
        this._resting = true; this.clear(); return false;
      }
      this._resting = false;
      this.set({ right: true, left: false, sprint: !!(typeof o.sprint === 'function' ? o.sprint(p) : o.sprint) });
      if (p.onGround) {
        airDashed = false;
        const wall = l.solid(c + 1, r - 1) && p.x % 16 > 6;
        const low = l.solid(c + 1, r - 2) && !l.solid(c + 1, r - 1);         // plafond bas devant : glissade
        // une simple marche vers le bas : on se laisse descendre, sans sauter
        const drop = !this.groundAt(c + 1, r, 2) && l.at(c + 1, r) !== '~' && l.at(c + 1, r + 1) !== '~' && this.groundAt(c + 1, r + 2, 2);
        const edge = !drop && (!this.groundAt(c + 1, r, 2) || l.at(c + 1, r) === '~') && p.x % 16 > 9;
        if (low && p.state !== 'slide') this.tap('down');
        else if ((wall || edge) && p.state !== 'slide') this.tap('jump');
        else this.set({ jump: false });
        if (edge) {
          const land = (cc) => l.at(cc, r) !== '~' && l.at(cc, r + 1) !== '~' && this.groundAt(cc, r - 2, 6);   // l'eau n'est pas un sol
          let w = 0; while (w < 12 && !land(c + 1 + w)) w++;
          let n = 0; while (n < 4 && land(c + 1 + w + n)) n++;
          this._gap = w; this._land = (c + 1 + w + Math.min(n, 3) / 2) * 16;        // où l'on veut retomber
          if (o.sprintGap && w >= o.sprintGap) this.set({ sprint: true });
        } else this._land = null;
      } else {
        if (o.sprintGap && this._gap >= o.sprintGap) this.set({ sprint: true });
        if (o.aim && this._land) this.set({ right: p.x < this._land - 3, left: p.x > this._land + 12 });
        if (!airDashed && o.dashGap && this._gap >= o.dashGap && p.vy > -40 && p.airDash) { this.dash(1); airDashed = true; }
      }
      return false;
    });
  },
  /**
   * Grimpe un puits en sauts muraux alternés, jusqu'à ce que les pieds passent au-dessus
   * de la ligne topRow (exitDir : en partant vers ce côté, pour se poser sur le bord).
   */
  wallClimb(seconds, topRow, firstSide = 1, exitDir = null, maxCol = null) {
    let side = firstSide;
    return this.run(seconds, (p) => {
      if (p.y < topRow * 16 - 2 && (p.onGround || p.vy > 0) && (exitDir == null || p.onGround || (p.state === 'wall_jump' && p.facing === exitDir))) return true;
      if (p.state === 'wall_jump') side = p.facing;          // il vient de quitter un mur : on vise l'autre
      if (maxCol != null && p.x > maxCol * 16 + 8) side = -1;  // une ouverture dans la paroi (galerie) : on n'y entre pas
      this.set({ right: side > 0, left: side < 0 });
      if (p.onGround || p.state === 'wall_slide') this.tap('jump');
      return false;
    });
  },
};
