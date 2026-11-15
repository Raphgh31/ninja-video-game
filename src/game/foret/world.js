// Le terrain de la Forêt, peint par tranches de 256 × 256 px à la demande (la
// carte fait 15 600 × 1 150 px : quatre fois le Potager, on ne peut pas tout
// peindre au chargement) :
//   - « # » humus sous un épais tapis de mousse ; sous terre, des parois et des
//     plafonds de terre d'où pendent des radicelles ; le fond des mares ;
//   - « = » pierre taillée des ruines, joints moussus ;
//   - « | » troncs (murs du saut mural) : écorce rousse, en cylindre ;
//   - les bords ne sont jamais droits (mousse qui déborde, flancs ondulés) ;
//   - herbes, fougères, fleurs et champignons sur les surfaces, quelques
//     fougères devant KAGE (couche avant).
// Les éléments vivants (travées, troncs flottants, eau…) sont peints par live.js ;
// les décors (props.js) peuvent masquer les tuiles qu'ils dessinent eux-mêmes.
import { Pix, ih, noise1, noise2, fbm2, pick, worley, bayer } from '../potager/paint.js';
import * as C from './palette.js';
import * as L from './layers.js';

const TILE = 16;
const CH = 256;

/** Tampon de pixels décalé : on y peint en coordonnées du monde, il ne garde que sa fenêtre. */
export class Window extends Pix {
  constructor(x0, y0, w, h) { super(w, h); this.x0 = x0; this.y0 = y0; }
  set(x, y, col, a = 255) { super.set(Math.round(x) - this.x0, Math.round(y) - this.y0, col, a); }
  alpha(x, y) { return super.alpha(Math.round(x) - this.x0, Math.round(y) - this.y0); }
}

const PAINTED = { '#': 1, '=': 2, '|': 3 };
const EARTH = ['#1a110b', '#271a11', '#362416', '#47301d', '#5a3f27', '#6e5033', '#86663f'];   // terre des falaises

export class ForetWorld {
  constructor(level, mask) {
    this.level = level;
    this.w = level.w; this.h = level.h;
    // la carte d'origine (les travées du pont tombent, la peinture ne bouge pas)
    this.rows = level.rows.slice();
    this.mask = mask;                       // Set de 'tx,ty' : tuiles dessinées par un décor
    this.dark = level.forest?.dark ?? null;
    this.gal = level.forest?.def?.galleries ?? level.forest?.galleries ?? null;
    this.hollows = level.forest?.def?.hollows ?? [];
    // les pentes (zone 11) : la hauteur du sol, pixel par pixel, sur leurs colonnes
    this.slopeTop = new Map();
    for (const q of (level.forest?.def?.slopes ?? []).filter((q) => !q.pile)) for (let x = q.x0; x < q.x1; x++) this.slopeTop.set(x, q.y0 + ((x - q.x0) * (q.y1 - q.y0)) / (q.x1 - q.x0));
    this.nx = Math.ceil(level.width / CH);
    this.ny = Math.ceil(level.height / CH);
    this.back = new Map();
    this.front = new Map();
    this.empty = new Set();
    this.queue = [];
  }

  /** Nature d'une tuile pour la peinture : 0 vide, 1 humus, 2 ruine, 3 tronc, 9 plein non peint (décor, porte). */
  kind(tx, ty) {
    if (tx < 0 || tx >= this.w) return 1;
    if (ty < 0 || ty >= this.h) return 0;
    const c = this.rows[ty][tx];
    const k = PAINTED[c] ?? 0;
    if (k && this.mask.has(tx + ',' + ty)) return 9;
    return k;
  }
  air(tx, ty) { const k = this.kind(tx, ty); return k === 0; }
  slopeCol(tx) { return this.slopeTop.has(tx * TILE); }
  /** Une case d'une colonne en pente : la terre commence à la surface en biais (le dessous des tuiles suit). */
  paintSlopeTile(pix, tx, ty) {
    for (let px = 0; px < TILE; px++) {
      const x = tx * TILE + px, st = this.slopeTop.get(x);
      for (let py = 0; py < TILE; py++) {
        const y = ty * TILE + py, d = y - Math.round(st);
        if (d < 0) continue;
        pix.set(x, y, this.humus(x, y, d, 99, 99, 99, false));
      }
    }
  }
  ch(tx, ty) { return tx < 0 || tx >= this.w || ty < 0 || ty >= this.h ? '.' : this.rows[ty][tx]; }
  under(x, y) { const d = this.dark; return (!!d && x > d.x0 && x < d.x1 && y > d.y0 + 2 * TILE) || this.inGal(x, y); }
  /** Les galeries de terre de la zone 5 (un avant-goût du souterrain). */
  inGal(x, y, from = 'under') { const g = this.gal; return !!g && x >= g[from] && x < g.x1 && y >= g.y0 && y < g.y1; }
  underDark(x, y) { const d = this.dark; return !!d && x > d.x0 && x < d.x1 && y > d.y0 + 2 * TILE; }

  key(i, j) { return i + ',' + j; }

  ensure(i, j) {
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return;
    const k = this.key(i, j);
    if (this.back.has(k) || this.empty.has(k)) return;
    const x0 = i * CH, y0 = j * CH;
    const tx0 = Math.floor(x0 / TILE) - 2, tx1 = Math.ceil((x0 + CH) / TILE) + 2;
    const ty0 = Math.floor(y0 / TILE) - 2, ty1 = Math.ceil((y0 + CH) / TILE) + 2;
    let any = false;
    for (let ty = ty0; ty <= ty1 && !any; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const kk = this.kind(tx, ty);
      if (kk && kk !== 9 && tx >= 0 && tx < this.w) { any = true; break; }
    }
    if (!any) { this.empty.add(k); return; }
    const back = new Window(x0, y0, CH, CH), front = new Window(x0, y0, CH, CH);
    this.paintTiles(back, x0, y0);
    const hasFront = this.paintSurface(back, front, tx0, tx1, ty0, ty1);
    this.back.set(k, back.done());
    if (hasFront) this.front.set(k, front.done());
  }

  // -------------------------------------------------------------------------
  paintTiles(pix, x0, y0) {
    for (let ty = Math.floor(y0 / TILE); ty < Math.ceil((y0 + CH) / TILE); ty++) {
      for (let tx = Math.floor(x0 / TILE); tx < Math.ceil((x0 + CH) / TILE); tx++) {
        const k = this.kind(tx, ty);
        if (this.slopeCol(tx) && k !== 9) { this.paintSlopeTile(pix, tx, ty); continue; }
        if (!k || k === 9) {
          const hb = !k && this.hollowBase(tx, ty);
          if (hb) {
            // le pied d'un grand tronc : un décor, KAGE passe devant (même écorce que le tronc)
            for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) pix.set(tx * TILE + px, ty * TILE + py, this.bark(tx, ty, tx * TILE + px, ty * TILE + py, hb));
            continue;
          }
          if (!k && this.niche(tx, ty)) this.cavity(pix, tx, ty);
          this.bulges(pix, tx, ty);
          continue;
        }
        // la masse au-dessus et au-dessous : distance au vide (dessus moussu, plafond)
        const solidK = (r) => this.kind(tx, r) !== 0;
        const solidT = (r) => { const kk = this.kind(tx, r); return kk !== 0 && kk !== 9; };   // (sous un décor : la mousse continue, cachée par lui)
        let top = ty, q = 0; while (q < 4 && solidT(top - 1)) { top--; q++; }
        if (solidT(top - 1)) top -= 40;
        let bot = ty; q = 0; while (q < 2 && solidK(bot + 1)) { bot++; q++; }
        if (solidK(bot + 1)) bot += 40;
        const wet = this.ch(tx, top - 1) === '~';
        const airL = this.air(tx - 1, ty), airR = this.air(tx + 1, ty);
        // distance (en cases) à la paroi la plus proche, à gauche et à droite : les grandes falaises
        let dl = 0; while (dl < 6 && !this.air(tx - 1 - dl, ty)) dl++;
        let dr = 0; while (dr < 6 && !this.air(tx + 1 + dr, ty)) dr++;
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const x = tx * TILE + px, y = ty * TILE + py;
          const dTop = y - top * TILE, dBot = (bot + 1) * TILE - 1 - y;
          // flancs ondulés : la paroi rentre de 0 à 2 px par endroits
          if (airL && px < 2 && px < Math.round((noise1(y * 0.19 + tx * 1.7, 11) - 0.45) * 4) && dTop > 3) continue;
          if (airR && px > 13 && 15 - px < Math.round((noise1(y * 0.19 + tx * 2.3, 12) - 0.45) * 4) && dTop > 3) continue;
          let col;
          if (k === 1) col = this.humus(x, y, dTop, dBot, airL ? px : 99, airR ? 15 - px : 99, wet, dl < 6 ? dl * TILE + px : 999, dr < 6 ? dr * TILE + 15 - px : 999);
          else if (k === 2) col = this.ruin(x, y, dTop, dBot, airL ? px : 99, airR ? 15 - px : 99);
          else col = this.bark(tx, ty, x, y);
          if (col) pix.set(x, y, col);
        }
      }
    }
  }

  /** Case vide enfermée (creux d'écorce, niche, galerie souterraine) : on voit le fond, pas le ciel. */
  niche(tx, ty) {
    if (this.inGal(tx * TILE, ty * TILE, 'x0')) return false;          // les galeries ont leur propre fond (props.js)
    const c = this.ch(tx, ty);
    if (c === '~' || c === 'v') return false;
    let up = 0; while (up < 5 && this.air(tx, ty - 1 - up)) up++;
    let dn = 0; while (dn < 4 && this.air(tx, ty + 1 + dn)) dn++;
    // (un creux sous l'écorce peut avoir trois cases de haut : la cavité du coffre de l'arbre aux cavités)
    if (up >= 5 || dn >= (up + dn < 3 && this.kind(tx, ty - 1 - up) === 3 ? 3 : 2)) return false;
    const bark = this.kind(tx, ty - 1 - up) === 3 || this.kind(tx - 1, ty) === 3;
    // sous terre, la caverne a son propre fond (roche, troncs, lueurs) : pas de « fond de creux » peint
    // case par case par-dessus — ces carrés presque noirs ressortaient en rectangles dans le halo de KAGE
    if (!bark && this.underDark(tx * TILE, ty * TILE)) return false;
    return bark || this.under(tx * TILE, ty * TILE) || (!this.air(tx - 1, ty) || !this.air(tx + 1, ty) || !this.air(tx - 2, ty) || !this.air(tx + 2, ty));
  }

  cavity(pix, tx, ty) {
    let up = 0; while (up < 5 && this.air(tx, ty - 1 - up)) up++;
    const bark = this.kind(tx, ty - 1 - up) === 3 || this.kind(tx - 1, ty) === 3;
    if (bark && this.kind(tx, ty - 1 - up) === 3) return this.barkHollow(pix, tx, ty);
    const ramp = bark ? ['#0b0605', '#140c08', '#1e130c', '#2a1a10'] : ['#07090a', '#0d0f0f', '#141512', '#1c1b16'];
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const x = tx * TILE + px, y = ty * TILE + py;
      const v = 0.35 + (noise2(x * 0.15, y * 0.15, 31) - 0.5) * 0.35 + (bark ? (noise2(x * 0.6, y * 0.05, 32) - 0.5) * 0.3 : 0) - (py / TILE) * 0.1;
      pix.set(x, y, pick(ramp, v, x, y));
    }
  }

  /**
   * Creux dans l'écorce d'un grand tronc (détours) : une cavité en arc, pas un rectangle. Le haut
   * s'arrondit dans le bois, un liseré d'écorce claire en fait le tour (côté lumière), le fond est
   * sombre et chaud, plus clair vers l'ouverture ; un rebord de bois moussu au seuil.
   */
  barkHollow(pix, tx, ty) {
    // l'étendue du creux : les cases vides entre le bois, autour de celle-ci
    const hole = (a, r) => this.air(a, r) && this.kind(a, r - 1 - (() => { let u = 0; while (u < 5 && this.air(a, r - 1 - u)) u++; return u; })()) === 3;
    let a = tx; while (a > tx - 4 && hole(a - 1, ty)) a--;
    let z = tx; while (z < tx + 4 && hole(z + 1, ty)) z++;
    let t = ty; while (t > ty - 5 && this.air(tx, t - 1)) t--;
    let bt = ty; while (bt < ty + 4 && this.air(tx, bt + 1)) bt++;
    const openL = this.air(a - 1, ty) ? 1 : 0, openR = this.air(z + 1, ty) ? 1 : 0;
    const x0 = a * TILE, x1 = (z + 1) * TILE - 1, y0 = t * TILE, y1 = (bt + 1) * TILE - 1;
    const cx = (x0 + x1) / 2, rx = (x1 - x0 + 1) / 2 + 2, ry = Math.min(rx * 0.9, (y1 - y0 + 1) * 0.55);
    const D = ['#080403', '#110906', '#1b0f09', '#28170d', '#3a2213', '#4f301a'];
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const x = tx * TILE + px, y = ty * TILE + py;
      // la voûte : un demi-ovale au-dessus, des parois droites dessous ; le bord ondule un peu
      const wob = (noise1(x * 0.3 + y * 0.2, 43) - 0.5) * 1.6;
      const vy = y0 + ry, nx = (x - cx) / rx;
      const out = y < vy ? nx * nx + Math.pow((y - vy) / ry, 2) > 1 + wob * 0.05 : false;
      // côté ouvert : le creux débouche franchement ; côté bois : la paroi arrondit le coin du bas
      const side = (!openL && x - x0 < 2 + wob) || (!openR && x1 - x < 2 + wob);
      if (out || side) { pix.set(x, y, this.bark(tx, ty, x, y)); continue; }
      // distance au bord de la voûte (pour le liseré)
      const e = y < vy ? 1 - Math.sqrt(nx * nx + Math.pow((y - vy) / ry, 2)) : Math.min(1, (Math.min(x - x0, x1 - x) + 2) / rx);
      const lip = e * rx;
      if (lip < 1.6 && y < y1 - 4) { pix.set(x, y, x < cx ? (y < vy ? C.BARK[4] : C.BARK[3]) : C.BARK[1]); continue; }
      if (lip < 3 && y < y1 - 4) { pix.set(x, y, x < cx ? C.BARK[2] : D[1]); continue; }
      // le seuil : un rebord de bois usé, moussu sur le dessus (côté ouverture)
      if (y > y1 - 3) {
        const top = y === y1 - 2;
        pix.set(x, y, top ? (noise1(x * 0.4, 44) > 0.55 ? C.MOSS[4] : C.BARK[4]) : C.BARK[2]);
        continue;
      }
      // le fond : sombre et chaud, la lumière entre par l'ouverture et tombe en bas
      const fromOpen = openL ? (x - x0) / (x1 - x0 + 1) : openR ? (x1 - x) / (x1 - x0 + 1) : 0.5;
      let v = 0.42 - fromOpen * 0.22 - Math.max(0, 1 - (y - y0) / (ry * 1.6)) * 0.2 + (noise2(x * 0.5, y * 0.08, 45) - 0.5) * 0.18;
      if (Math.abs(noise2(x * 0.35, y * 0.05, 46) - 0.5) < 0.04) v -= 0.12;                // fibres du bois
      pix.set(x, y, pick(D, v, x, y));
    }
  }

  /** Bourrelets de mousse et de terre qui débordent dans le vide, contre un flanc ; sous un plafond, la terre pend un peu. */
  bulges(pix, tx, ty) {
    const up = this.kind(tx, ty - 1);
    if ((up === 1 || up === 2) && this.kind(tx, ty) === 0 && this.ch(tx, ty) !== "~") {
      for (let px = 0; px < TILE; px++) {
        const x = tx * TILE + px, hang = Math.round((noise1(x * 0.16 + ty * 3.1, 76) - 0.38) * 6);
        for (let q = 0; q < hang; q++) pix.set(x, ty * TILE + q, up === 2 ? C.RUIN[1] : this.under(x, ty * TILE) ? '#0a141a' : C.HUMUS[1]);
      }
    }
    for (const side of [-1, 1]) {
      const k = this.kind(tx - side, ty);
      if (k !== 1 && k !== 2) continue;
      if (this.air(tx - side, ty - 1) && ty >= 0) continue;            // (le dessus a sa propre mousse)
      for (let py = 0; py < TILE; py++) {
        const y = ty * TILE + py;
        const b = Math.round((noise1(y * 0.19 + (tx - side) * (side < 0 ? 2.3 : 1.7), side < 0 ? 12 : 11) - 0.62) * 5);
        for (let q = 0; q < b; q++) {
          const x = side < 0 ? tx * TILE + q : (tx + 1) * TILE - 1 - q;
          pix.set(x, y, k === 2 ? C.RUIN[side < 0 ? 1 : 3] : side < 0 ? C.HUMUS[1] : C.HUMUS[4]);
        }
      }
    }
  }

  /** Paroi d'une falaise de terre : strates, pierres prises, mousse sur la face éclairée (à gauche). */
  cliff(x, y, fL, fR) {
    const band = y + (noise1(x * 0.035, 21) - 0.5) * 12, layer = Math.floor(band / 9);
    let v = 0.4 + (ih(layer, 0, 22) - 0.5) * 0.3 + (noise2(x * 0.12, y * 0.3, 23) - 0.5) * 0.22;
    if (fL < fR) v += 0.32 * Math.pow(Math.max(0, 1 - fL / 90), 2);
    else v -= 0.2 * Math.pow(Math.max(0, 1 - fR / 70), 1.5);
    v -= 0.14 * Math.min(1, Math.min(fL, fR) / 120);                                   // au cœur de la masse : plus sombre
    if (((band % 9) + 9) % 9 < 1) v -= 0.22;                                              // le joint entre deux strates
    const st = worley(x, y * 1.4, 13, 24, 0.8);
    if (st.id > 0.9 && st.d < 3.2 + (st.id - 0.9) * 14) return st.d2 - st.d < 0.9 ? C.HUMUS[0] : pick(C.ROCK, v + 0.12 - st.dy * 0.04, x, y);
    if (fL < 14 && fbm2(x * 0.1, y * 0.06, 3, 25) > 0.6) return pick(this.inGal(x, y) ? ['#0b2a2a', '#10403c', '#17594c', '#20705a', '#2e8b6a'] : C.MOSS, v + 0.05, x, y);   // (dans les galeries : la mousse bleu-vert du souterrain)
    if (Math.abs(fbm2(x * 0.05, y * 0.012, 2, 26) - 0.5) < 0.012) return C.BARK[2];          // racines qui traversent la terre
    if (fR < 3) return C.HUMUS[0];
    return pick(EARTH, v, x, y);
  }

  /** Sous terre : une roche sombre bleu-vert (la caverne aux champignons), mousse turquoise au sol. */
  caveRock(x, y, dTop, dBot, dL, dR) {
    const R = ['#060c10', '#0a141a', '#0f1e25', '#152a32', '#1d3840', '#28494f', '#355d60'];
    if (dTop < 4) return dTop === 0 ? (ih(x, 2, 5) < 0.5 ? '#2e8b6a' : '#20705a') : pick(['#0b2a2a', '#10403c', '#17594c'], 0.7 - dTop / 5, x, y);
    const w = worley(x, y * 1.2, 11, 71, 0.85);
    let v = 0.42 + (w.id - 0.5) * 0.3 + (noise2(x * 0.12, y * 0.12, 72) - 0.5) * 0.2 - Math.min(0.25, dTop / 200);
    if (dTop < 14) v += 0.12;
    if (dBot < 10) v -= 0.12;
    if (dR < 4) v -= 0.2; else if (dL < 4) v += 0.15;
    if (w.d2 - w.d < 0.8) return R[0];
    if (fbm2(x * 0.08, y * 0.08, 2, 73) > 0.68 && dTop < 40) return pick(['#0b2a2a', '#10403c', '#17594c', '#20705a'], v, x, y);   // mousse sur la roche
    return pick(R, v, x, y);
  }

  humus(x, y, dTop, dBot, dL, dR, wet, fL = 999, fR = 999) {
    const d = this.dark;
    // la roche bleu-vert de la caverne ; vers la sortie, elle redevient peu à peu la terre de la forêt (tramé)
    const out = d?.fade && x > d.x1 - d.fade ? (x - (d.x1 - d.fade)) / d.fade : 0;
    if (!wet && d && x > d.x0 && x < d.x1 && y > d.y0 + 6 + (bayer(x, y) + noise1(x * 0.05, 74) * 0.6) * 30 && !(out > 0 && (bayer(x, y) * 0.7 + noise1(y * 0.2, 75) * 0.3) < out)) return this.caveRock(x, y, dTop, dBot, dL, dR);
    if (!wet && d?.deep && x > d.deep.x0 && x <= d.x0 && y > d.deep.y0 + noise1(x * 0.05, 76) * 40) return this.caveRock(x, y, dTop, dBot, dL, dR);   // (la roche continue en profondeur)
    if (!wet && dTop >= 44 && dBot >= 16 && !this.underDark(x, y)) return this.cliff(x, y, fL, fR);
    const under = this.under(x, y);
    if (wet && dTop < 10) {
      // le fond d'une mare : galets et vase sombres
      const w = worley(x, y, 6, 41, 0.8);
      if (w.d2 - w.d < 0.8) return C.HUMUS[0];
      return pick(dTop < 3 ? C.PEBBLE : C.ROCK, 0.5 - dTop / 14 + (w.id - 0.5) * 0.4, x, y);
    }
    if (dTop < 44 && !(under && dTop > 6 && dBot < 18)) {
      let c = under && dTop < 7 ? (dTop === 0 ? (ih(x, 2, 5) < 0.5 ? C.MOSS[3] : C.MOSS[2]) : pick(C.MOSS, 0.35 - dTop / 20, x, y)) : L.groundColor(x, y, dTop);
      if (dR < 3 && dTop > 4) c = C.HUMUS[0];
      else if (dL < 2 && dTop > 4) c = dTop < 10 ? (under ? '#20705a' : C.MOSS[4]) : C.HUMUS[5];
      return c;
    }
    if (dBot < 16) {
      // plafond de terre (souterrain, dessous d'une corniche) : plus sombre vers le bas, radicelles
      if (dBot < 9 && ih(x, Math.floor(y / 5), 7) < 0.09) return C.BARK[2];
      if (dBot < 2) return C.HUMUS[0];
      return pick(C.HUMUS, 0.12 + (16 - dBot) * 0.01 + (noise2(x * 0.3, y * 0.3, 8) - 0.5) * 0.25, x, y);
    }
    // en profondeur : un humus sombre, à peine marbré, et des pierres prises dans la terre
    let v = 0.3 + (noise2(x * 0.045, y * 0.045, 4) - 0.5) * 0.3 + (noise2(x * 0.2, y * 0.2, 5) - 0.5) * 0.12 - Math.min(0.12, dTop / 900);
    if (dR < 4) v -= 0.18; else if (dL < 4) v += 0.12;
    if (ih(x >> 4, y >> 4, 13) < 0.06) {
      const cx = (x >> 4) * 16 + 8 + Math.floor((ih(x >> 4, y >> 4, 14) - 0.5) * 6), cy = (y >> 4) * 16 + 8;
      const dx = (x - cx) / 6, dy = (y - cy) / 4;
      if (dx * dx + dy * dy < 1) return pick(C.ROCK, 0.45 - dx * 0.2 - dy * 0.3, x, y);
      if (dx * dx + dy * dy < 1.35) return C.HUMUS[0];
    }
    return pick(C.HUMUS, v, x, y);
  }

  ruin(x, y, dTop, dBot, dL, dR) {
    if (dTop > 2 * TILE + Math.floor(noise1(x * 0.3, 68) * 6)) return this.humus(x, y, 99, dBot, dL, dR, false);   // le dallage repose sur la terre
    // assises de 16 px, blocs de largeurs inégales, décalés d'une assise à l'autre
    const course = Math.floor(y / TILE), j = y - course * TILE;
    const off = Math.floor(ih(course, 0, 61) * 30);
    const unit = 22 + Math.floor(ih(course, 1, 61) * 14);
    const bi = Math.floor((x + off) / unit), i = (x + off) - bi * unit;
    let v = 0.42 + (ih(bi, course, 62) - 0.5) * 0.28 + (fbm2(x * 0.2, y * 0.2, 2, 63) - 0.5) * 0.2;
    if (dTop < TILE) v += 0.16;
    if (this.under(x, y)) v -= 0.18;
    if (j === TILE - 1 || i === unit - 1) return C.RUIN[0];                 // joints
    if (j === 0 || i === 0) v += 0.15;                                        // arêtes éclairées
    if (dR < 2) v -= 0.25; else if (dL < 2) v += 0.12;
    if (ih(bi, course, 65) < 0.18 && i + j < 4) return C.RUIN[0];             // coin ébréché
    // mousse sur le dessus et dans les joints, lierre par plaques
    const m = fbm2(x * 0.09, y * 0.11, 3, 66) + (dTop < 5 ? 0.3 : 0) - 0.08;
    if (dTop === 0) return ih(x, 1, 67) < 0.6 ? C.MOSS[5] : C.MOSS[4];
    if (m > 0.66) return pick(C.MOSS, v + 0.05 + (dTop < 5 ? 0.25 : 0), x, y);
    return pick(C.RUIN, v, x, y);
  }

  /** Case du passage au pied d'un grand tronc (zones 2 et 5) : { a, b } (colonnes du tronc), ou null. */
  hollowBase(tx, ty) {
    for (const h of this.hollows) if (tx >= h.x0 && tx < h.x0 + h.w && ty >= h.ground - h.open && ty < h.ground) return { a: h.x0, b: h.x0 + h.w - 1 };
    return null;
  }

  bark(tx, ty, x, y, run = null) {
    // la largeur du tronc à cette hauteur (course de « | »)
    let a = tx; while (!run && this.kind(a - 1, ty) === 3) a--;
    let b = tx; while (!run && this.kind(b + 1, ty) === 3) b++;
    if (run) { a = run.a; b = run.b; }
    const x0 = a * TILE, w = (b - a + 1) * TILE;
    const u = (x - x0) / w, i = x - x0;
    const cyl = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
    let v = 0.1 + 0.78 * Math.pow(1 - u, 1.25) * (0.55 + 0.45 * cyl) + (noise2(i * 0.8, y * 0.22, a + 2) - 0.5) * 0.2;
    const plate = fbm2(i * 0.3 + a, y * 0.028, 2, a + 1);
    const m = fbm2(i * 0.1 + a * 0.7, y * 0.03, 3, a + 3) + (1 - u) * 0.3 - 0.12;
    if (m > 0.74) return pick(C.MOSS, 0.2 + 0.5 * (1 - u) + (noise2(i * 0.55, y * 0.55, a + 9) - 0.5) * 0.4, x, y);
    if (Math.abs(plate - 0.5) < 0.026) return u < 0.5 ? C.BARK[1] : C.BARK[0];
    if (this.under(x, y)) v -= 0.15;
    return pick(C.BARK, v, x, y);
  }

  // -------------------------------------------------------------------------
  /** Herbes, fougères, fleurs, champignons ; radicelles sous les plafonds. Renvoie true si la couche avant a reçu quelque chose. */
  paintSurface(back, front, tx0, tx1, ty0, ty1) {
    let anyFront = false;
    // le long des pentes : herbes couchées par le vent de l'éboulis, fougères, cailloux, fleurs
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.slopeCol(tx)) continue;
      const tyS = Math.floor(this.slopeTop.get(tx * TILE + 8) / TILE);
      if (tyS < ty0 || tyS > ty1) continue;
      for (let q = 0; q < 4; q++) {
        const x = tx * TILE + 1 + q * 4 + Math.floor(ih(tx, q, 140) * 3), y = Math.round(this.slopeTop.get(x)) - 1;
        if (ih(tx, q, 141) < 0.6) L.grassTuft(back, x, y, 2 + Math.floor(ih(tx, q, 142) * 4), C.FERN, tx * 5 + q);
      }
      const r = ih(tx, 0, 143), xm = tx * TILE + 8, ym = Math.round(this.slopeTop.get(xm));
      if (r < 0.14) L.fern(back, xm, ym, 7 + Math.floor(ih(tx, 1, 144) * 5), C.FERN, tx);
      else if (r < 0.3) L.rock(back, xm, ym + 2, 3 + Math.floor(ih(tx, 2, 145) * 3), 3 + Math.floor(ih(tx, 3, 146) * 2), tx);
      else if (r < 0.36) { const f = [C.FLOWER.white, C.FLOWER.yellow, C.FLOWER.violet][Math.floor(ih(tx, 4, 147) * 3)]; for (let q = 0; q < 3; q++) { const fx = xm - 4 + q * 4, fy = Math.round(this.slopeTop.get(fx)), fh = 3 + (q % 2); for (let s2 = 1; s2 < fh; s2++) back.set(fx, fy - s2, C.FERN[2]); back.set(fx, fy - fh, f); } }
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const k = this.kind(tx, ty);
      if (k !== 1 && k !== 2) continue;
      if (this.slopeCol(tx)) continue;                                  // (la pente a sa propre surface)
      const x = tx * TILE, y = ty * TILE;
      const c = this.ch(tx, ty - 1);
      const under = this.under(x, y);
      // dessus à l'air libre (pas sous l'eau, pas sous un décor)
      if (this.air(tx, ty - 1) && c !== '~' && c !== 'v' && c !== 'J') {
        const r = ih(tx, ty, 71);
        if (under) {
          // la mousse et les petites fougères de la caverne (bleu-vert, comme sous une lumière de champignons)
          const CAVE = ['#0b2a2a', '#10403c', '#17594c', '#20705a', '#2e8b6a', '#4fae86'];
          if (r < 0.45) L.grassTuft(back, x + 3 + Math.floor(ih(tx, ty, 72) * 10), y - 1, 2 + Math.floor(ih(tx, ty, 73) * 4), CAVE, tx);
          if (r > 0.8) L.fern(back, x + 8, y, 6 + Math.floor(ih(tx, ty, 74) * 4), CAVE, tx);
          for (let q = 0; q < 3; q++) if (ih(tx, ty, 120 + q) < 0.3) back.set(x + 2 + q * 5, y - 1, q % 2 ? '#6fd6ee' : '#a67cf0');   // spores qui luisent dans la mousse
          continue;
        }
        if (k === 2) {
          if (r < 0.35) L.grassTuft(back, x + 3 + Math.floor(ih(tx, ty, 72) * 10), y - 1, 2 + Math.floor(ih(tx, ty, 73) * 4), C.FERN, tx);
          continue;
        }
        for (let s = 0; s < 3; s++) if (ih(tx, ty, 80 + s) < 0.55) L.grassTuft(back, x + 2 + s * 5 + Math.floor(ih(tx, ty, 83 + s) * 3), y - 1, 2 + Math.floor(ih(tx, ty, 86 + s) * 5), C.FERN, tx * 3 + s);
        if (r < 0.16) L.fern(back, x + 8, y, 7 + Math.floor(ih(tx, ty, 74) * 6), C.FERN, tx);
        else if (r < 0.2) { L.mushroom(back, x + 5, y, 2); L.mushroom(back, x + 9, y, 3); }
        else if (r < 0.27) {
          const f = [C.FLOWER.white, C.FLOWER.yellow, C.FLOWER.violet, C.FLOWER.pink][Math.floor(ih(tx, ty, 75) * 4)];
          for (let q = 0; q < 3; q++) { const fx = x + 3 + q * 4, fh = 3 + (q % 2) * 2; for (let s = 1; s < fh; s++) back.set(fx, y - s, C.FERN[2]); back.set(fx, y - fh, f); }
        }
        // devant KAGE, de loin en loin : une fougère sombre (pas sur les lanternes ni les passages étroits)
        if (ih(tx, ty, 76) < 0.07 && this.air(tx, ty - 2) && this.air(tx, ty - 3) && this.ch(tx, ty - 1) !== 'P') {
          L.fern(front, x + 8, y + 2, 9 + Math.floor(ih(tx, ty, 77) * 5), [C.FERN[0], C.FERN[0], C.FERN[1], C.FERN[1], C.FERN[2], C.FERN[3]], tx + 5);
          anyFront = true;
        }
      }
      // sous terre, de loin en loin : une liane qui pend du plafond, ses perles de lumière
      if (k === 1 && under && this.air(tx, ty + 1) && this.air(tx, ty + 2) && ih(tx, ty, 130) < 0.12) {
        const lx = x + 4 + Math.floor(ih(tx, ty, 131) * 8), len = 8 + Math.floor(ih(tx, ty, 132) * 16);
        for (let q = 0; q < len; q++) back.set(lx + Math.round(Math.sin(q * 0.4 + tx) * 0.8), y + TILE + q, q % 4 === 3 ? (ih(tx, q, 133) < 0.5 ? '#6fd6ee' : '#c4fbff') : '#10403c');
      }
      // dessous d'un plafond : radicelles et racines qui pendent
      if (k === 1 && this.air(tx, ty + 1) && this.ch(tx, ty + 1) !== '~') {
        for (let s = 0; s < 3; s++) {
          if (ih(tx, ty, 90 + s) > (under ? 0.7 : 0.45)) continue;
          const rx = x + 2 + s * 5 + Math.floor(ih(tx, ty, 93 + s) * 3), len = 3 + Math.floor(ih(tx, ty, 96 + s) * (under ? 11 : 6));
          for (let q = 0; q < len; q++) back.set(rx + Math.round(Math.sin(q * 0.5 + s) * 0.8), y + TILE + q, q > len - 3 ? C.BARK[3] : C.BARK[1]);
        }
      }
    }
    return anyFront;
  }

  // -------------------------------------------------------------------------
  chunks(cam, viewW, viewH) {
    const i0 = Math.floor(cam.x / CH), i1 = Math.floor((cam.x + viewW) / CH);
    const j0 = Math.floor(Math.max(0, cam.y) / CH), j1 = Math.floor((cam.y + viewH) / CH);
    return { i0, i1, j0, j1 };
  }

  /** Une tranche d'avance par image (les voisines de l'écran d'abord). */
  idle(cam, viewW, viewH) {
    const { i0, i1, j0, j1 } = this.chunks(cam, viewW, viewH);
    for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) {
      if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
      const k = this.key(i, j);
      if (!this.back.has(k) && !this.empty.has(k)) { this.ensure(i, j); return; }
    }
  }

  draw(ctx, layer, cam, viewW, viewH) {
    const map = layer === 'front' ? this.front : this.back;
    const { i0, i1, j0, j1 } = this.chunks(cam, viewW, viewH);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (layer === 'back') this.ensure(i, j);
      const img = map.get(this.key(i, j));
      if (img) ctx.drawImage(img, i * CH - cam.x, j * CH - cam.y);
    }
  }
}
