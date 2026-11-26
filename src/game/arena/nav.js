// Le graphe des appuis d'une arène (26 novembre 2026), pour le ninja de l'ombre (bot.js) : où il peut se tenir,
// et comment passer d'un appui à l'autre (marcher, sauter, se laisser tomber), avec les vrais chiffres du saut
// de KAGE (player.js : P.jump, P.gravity, P.sprint). Il ne reste plus bloqué contre une souche ni ne saute
// dans l'eau : il va d'un appui à l'autre par des sauts qu'il sait réussir.
//
// Un « appui » : une suite de cases d'une même rangée où l'on tient debout (case pleine ou passerelle, deux
// cases libres au-dessus, pas d'eau). Le graphe se refait de temps en temps (le bassin qui monte, les
// échafaudages qui tombent, le rocher de la grue).
import { TILE } from '../level.js';

const JUMP = 315, G = 980, SPRINT = 140, MAX_FALL = 9;   // px/s, px/s², px/s, cases (la chute mortelle est à 10,5)

/** Temps de vol d'un saut plein pour atterrir `rise` px plus haut (négatif : plus bas), ou null s'il est trop haut. */
function airtime(rise) {
  const d = JUMP * JUMP - 2 * G * rise;
  if (d < 0) return null;
  return (JUMP + Math.sqrt(d)) / G;
}

export class NavGraph {
  /** avoid(tx, ty) : une case où il ne faut jamais se poser (le bassin de la Forêt). */
  constructor(level, avoid = () => false) {
    this.level = level;
    this.avoid = avoid;
    this.build();
  }

  standable(tx, ty) {
    const lv = this.level;
    if (!(lv.solid(tx, ty) || lv.ledge(tx, ty))) return false;
    if (lv.solid(tx, ty - 1) || lv.solid(tx, ty - 2)) return false;
    const c = lv.at(tx, ty), above = lv.at(tx, ty - 1);
    if (c === '~' || c === 'v' || above === '~' || above === 'v') return false;
    return !this.avoid(tx, ty);
  }

  /** Un saut de (ax, ay) à (bx, by) (centres des cases, en px, sous les pieds) est-il dégagé ? */
  clear(ax, ay, bx, by, rise) {
    const lv = this.level, top = Math.min(ay, by) / TILE - Math.max(2, rise / TILE + 2.5);
    // (au-dessus du départ, du milieu et de l'arrivée, jusqu'à la hauteur de chacun)
    for (const [x, y] of [[ax, ay], [(ax + bx) / 2, Math.min(ay, by)], [bx, by]]) {
      const tx = Math.floor(x / TILE);
      for (let ty = Math.floor(top); ty < y / TILE; ty++) if (lv.solid(tx, ty)) return false;
    }
    return true;
  }

  build() {
    const lv = this.level, segs = [];
    this.at = new Map();
    for (let ty = 1; ty < lv.h; ty++) {
      let start = -1;
      for (let tx = 0; tx <= lv.w; tx++) {
        const ok = tx < lv.w && this.standable(tx, ty);
        if (ok && start < 0) start = tx;
        if (!ok && start >= 0) {
          const s = { i: segs.length, ty, x0: start, x1: tx - 1, y: ty * TILE, edges: [] };
          segs.push(s);
          for (let x = start; x < tx; x++) this.at.set(x + ty * 4096, s);
          start = -1;
        }
      }
    }
    this.segs = segs;
    const cx = (tx) => tx * TILE + TILE / 2;
    for (const A of segs) {
      for (const B of segs) {
        if (A === B) continue;
        const rise = (A.ty - B.ty) * TILE;          // > 0 : B plus haut
        // un passage bas (une case de haut : sous un étal, une branche) : la glissade
        if (rise === 0 && (B.x0 > A.x1 || B.x1 < A.x0)) {
          const l = Math.min(A.x1, B.x1) + 1, r = Math.max(A.x0, B.x0) - 1;
          let low = r - l < 8;
          for (let x = l; low && x <= r; x++) low = (lv.solid(x, A.ty) || lv.ledge(x, A.ty)) && !lv.solid(x, A.ty - 1) && lv.at(x, A.ty - 1) !== '~';
          if (low) {
            const fx = B.x0 > A.x1 ? A.x1 : A.x0, lx = B.x0 > A.x1 ? B.x0 : B.x1;
            A.edges.push({ src: A, to: B, kind: 'slide', from: cx(fx), land: cx(lx), rise: 0, cost: Math.abs(cx(lx) - cx(fx)) + 4 });
            continue;
          }
        }
        if (rise > 3 * TILE || -rise > MAX_FALL * TILE) continue;
        const t = airtime(rise);
        if (!t) continue;
        const reach = SPRINT * t - 10;
        // les deux bouts les plus proches
        let fx, lx;
        if (B.x0 > A.x1) { fx = A.x1; lx = B.x0; }
        else if (B.x1 < A.x0) { fx = A.x0; lx = B.x1; }
        else {
          // l'un au-dessus de l'autre
          if (rise > 0) {
            // plus haut : une passerelle se traverse par-dessous ; un sol plein se contourne par son bord
            if (lv.ledge(B.x0, B.ty)) { const m = Math.max(A.x0, B.x0), n = Math.min(A.x1, B.x1); fx = lx = Math.round((m + n) / 2); }
            else if (B.x0 - 1 >= A.x0) { fx = B.x0 - 1; lx = B.x0; }
            else if (B.x1 + 1 <= A.x1) { fx = B.x1 + 1; lx = B.x1; }
            else continue;
          } else {
            // plus bas : on se laisse tomber par un bout de A qui donne sur B
            if (B.x1 > A.x1) { fx = A.x1; lx = Math.min(B.x1, A.x1 + 2); }
            else if (B.x0 < A.x0) { fx = A.x0; lx = Math.max(B.x0, A.x0 - 2); }
            else continue;
            if (!this.clear(cx(fx), A.y, cx(lx), B.y, 0)) continue;
            A.edges.push({ src: A, to: B, kind: 'drop', from: cx(fx), land: cx(lx), rise, cost: Math.abs(rise) / 4 + 6 });
            continue;
          }
        }
        const dist = Math.abs(cx(lx) - cx(fx));
        if (dist > reach) continue;
        if (!this.clear(cx(fx), A.y, cx(lx), B.y, Math.max(0, rise))) continue;
        A.edges.push({ src: A, to: B, kind: rise < 0 && dist < 20 ? 'drop' : 'jump', from: cx(fx), land: cx(lx), rise, cost: dist + 14 + Math.max(0, rise) / 3 });
      }
    }
  }

  /** L'appui sous (x, y) (les pieds), ou le premier en dessous (en l'air), ou null. */
  segUnder(x, y, below = 12) {
    const tx = Math.floor(x / TILE);
    for (let ty = Math.floor((y + 2) / TILE), n = 0; n < below; ty++, n++) {
      const s = this.at.get(tx + ty * 4096);
      if (s) return s;
      if (this.level.solid(tx, ty)) return null;
    }
    return null;
  }

  /** Le plus court chemin (Dijkstra) d'un appui à l'autre, en partant de x : la liste des passages. */
  path(A, B, x) {
    if (!A || !B) return null;
    if (A === B) return [];
    const dist = new Map([[A, 0]]), prev = new Map(), pos = new Map([[A, x]]), open = [A];
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const S = open.shift();
      if (S === B) break;
      for (const e of S.edges) {
        const d = dist.get(S) + Math.abs(e.from - pos.get(S)) + e.cost;
        if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prev.set(e.to, e); pos.set(e.to, e.land); open.push(e.to); }
      }
    }
    if (!prev.has(B)) return null;
    const out = [];
    for (let S = B; S !== A; S = prev.get(S).src) out.unshift(prev.get(S));
    return out;
  }
}
