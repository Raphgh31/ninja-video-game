// Mode combat : les mécanismes d'une arène (pour l'instant, la rizière du gong,
// l'arène du Potager). Tout agit sur une liste de « combattants » (KAGE
// aujourd'hui ; les adversaires, pilotés ou en réseau, plus tard) : chacun a
// x, y (sous les pieds), vx, vy, onGround, state, box(), hurt(dmg, fromX).
//
//   - la grue de bambou : des tawara (balles de riz) suspendus ; un shuriken coupe
//     la corde, ils tombent sur celui qui est dessous, restent au sol (des marches),
//     puis la grue les remonte ;
//   - le gong : frappé (sabre, coup de pied, shuriken), il ouvre les vannes au pied
//     des bosquets ; une vague balaie la rizière basse vers le canal ;
//   - les échafaudages fragiles : seul le choc du rocher les fait s'effondrer ; on les
//     rebâtit un peu plus tard ;
//   - les bottes de foin : un tremplin ;
//   - les caisses : d'un coup de pied, elles filent au ras du sol ; il en retombe du ciel ;
//   - les bonus : cœurs (un point de vie) et paquets de shurikens.
// Le dessin est dans art.js ; les sons et les effets passent par onEvent (main.js).
import { TILE } from '../level.js';

export const ARENA = {
  // le rocher : il tombe vite ; dessous, on meurt ; à la réception, une onde de choc (quake px de part et d'autre) fait perdre une vie
  crane: { g: 2600, vmax: 980, dmg: 1, quake: 44, lower: 1.1, hoist: 2.6 },
  // le gong : la vanne gronde (delay), s'ouvre ; l'eau court (speed) tant que la vanne
  // reste ouverte (open), puis la nappe se vide dans le canal ; le gong se réarme (rearm)
  wave: { delay: 0.6, open: 1.8, speed: 250, push: 200, lift: 170, dmg: 1, rearm: 9, depth: 15 },
  hay: { min: 400, max: 540, keep: 0.9, minFall: 120, damp: 0.68, stop: 200 },
  scaffold: { warn: 0.32, rebuild: 7.5 },   // ils ne tombent que sous le choc du rocher, rebâtis ensuite
  crate: { kick: 270, friction: 330, dmg: 1, every: 11 },
  pickup: { heart: 17, firstHeart: 9, bundle: 10, firstBundle: 5, heal: 1 },
};

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Arena {
  constructor(level, def) {
    this.level = level;
    this.def = def;
    this.time = 0;
    this.track = new Map();     // par combattant : { vy, onGround } de l'image précédente
    // grue
    const c = def.crane;
    this.crane = c ? {
      ...c, state: 'hang', y: c.top * TILE, vy: 0, t: 0, hit: new Set(),
      ropeX: (c.x0 + c.w / 2) * TILE, floor: this.floorUnder(c.x0, c.w, c.top + c.h),
    } : null;
    if (this.crane) this.fillCrane(this.crane.top);
    // gong et vagues
    this.gong = def.gong ? { ...def.gong, ready: true, t: 9, ringT: -9 } : null;
    this.waves = [];
    this.quakes = [];           // ondes de choc du rocher (dessinées par art.js)
    // bottes de foin (tremplins)
    this.hay = (def.hay ?? []).map((h) => ({ ...h, squash: 0 }));
    // caisses glissantes, bonus
    this.sliding = [];
    this.crateClock = 0;
    this.pickups = [];
    this.heartClock = ARENA.pickup.heart - ARENA.pickup.firstHeart;
    this.bundleClock = ARENA.pickup.bundle - ARENA.pickup.firstBundle;
    this.spawnIndex = 0;
  }

  /** Ligne du premier sol sous les colonnes x0..x0+w-1, à partir de la ligne ty. */
  floorUnder(x0, w, ty) {
    let y = ty;
    for (; y < this.level.h; y++) {
      let hit = false;
      for (let x = x0; x < x0 + w; x++) if (this.level.solid(x, y) || this.level.ledge(x, y)) hit = true;
      if (hit) break;
    }
    return y;
  }

  /** Réapparition : un point d'apparition à tour de rôle (le plus loin des autres, plus tard). */
  nextSpawn() {
    const s = this.def.spawns[this.spawnIndex % this.def.spawns.length];
    this.spawnIndex++;
    return { ...s };
  }

  reset() {
    const c = this.crane;
    if (c) { this.fillCrane(null); c.state = 'hang'; c.y = c.top * TILE; c.vy = 0; c.t = 0; this.fillCrane(c.top); }
    if (this.gong) Object.assign(this.gong, { ready: true, t: 9, ringT: -9 });
    this.waves = [];
    for (const s of this.level.scaffolds) if (!s.up) this.rebuild(s, true);
    this.pickups = [];
  }

  // ---- grue ------------------------------------------------------------------
  fillCrane(top) {
    const c = this.crane, lv = this.level;
    for (let x = c.x0; x < c.x0 + c.w; x++) for (let y = 0; y < lv.h; y++) if (lv.at(x, y) === 'K') lv.setTile(x, y, '.');
    if (top == null) return;
    for (let x = c.x0; x < c.x0 + c.w; x++) for (let y = top; y < top + c.h; y++) lv.setTile(x, y, 'K');
  }

  /** Un shuriken (boîte box) coupe-t-il la corde de la grue ? */
  cutRope(box) {
    const c = this.crane;
    if (!c || c.state !== 'hang') return false;
    const y0 = c.boomY + 8, y1 = c.top * TILE - 6;
    if (box.x < c.ropeX + 3 && box.x + box.w > c.ropeX - 3 && box.y < y1 && box.y + box.h > y0) {
      c.state = 'fall';
      c.t = 0;
      c.vy = 0;
      c.y = c.top * TILE;
      c.hit = new Set();
      this.fillCrane(null);
      this.onEvent?.('ropeCut', { x: c.ropeX, y: (y0 + y1) / 2, id: 'arene' });
      return true;
    }
    return false;
  }

  craneBox() {
    const c = this.crane;
    return { x: c.x0 * TILE, y: c.y, w: c.w * TILE, h: c.h * TILE };
  }

  updateCrane(dt, fighters) {
    const c = this.crane;
    if (!c) return;
    c.t += dt;
    if (c.state === 'fall') {
      if (c.t < 0.06) return;                      // la corde claque, à peine un temps : le rocher tombe vite
      c.vy = Math.min(ARENA.crane.vmax, c.vy + ARENA.crane.g * dt);
      c.y += c.vy * dt;
      const box = this.craneBox();
      for (const f of fighters) {
        if (c.hit.has(f) || !alive(f)) continue;
        // celui qui est dessous est écrasé net (celui qui était debout dessus tombe avec)
        const fb = f.box();
        if (overlap({ ...box, x: box.x + 3, w: box.w - 6, y: box.y + box.h - 12, h: 12 }, fb) && fb.y > box.y + 6) {
          c.hit.add(f);
          f.die ? f.die() : f.hurt(99, f.x);
          this.onEvent?.('craneHit', { x: f.x, y: f.y - 16 });
        }
      }
      const land = (c.floor - c.h) * TILE;
      if (c.y >= land) {
        c.y = land;
        c.state = 'down';
        c.t = 0;
        this.fillCrane(c.floor - c.h);
        const cx = (c.x0 + c.w / 2) * TILE, floorY = c.floor * TILE, half = c.w * TILE / 2;
        for (const f of fighters) {
          if (!alive(f)) continue;
          const fb = f.box();
          // pris dessous au dernier moment : écrasé
          if (overlap({ ...this.craneBox(), x: this.craneBox().x + 3, w: this.craneBox().w - 6 }, fb) && !c.hit.has(f) && fb.y + fb.h > land + 6) {
            c.hit.add(f);
            f.die ? f.die() : f.hurt(99, f.x);
            continue;
          }
          // debout dessus : on le pose dessus
          if (overlap(this.craneBox(), fb)) { f.y = land; f.vy = Math.min(f.vy, 0); continue; }
          // l'onde de choc : ceux qui ont les pieds au sol près de la réception perdent une vie
          if (!c.hit.has(f) && Math.abs(f.x - cx) < half + ARENA.crane.quake && Math.abs(f.y - floorY) < 10) {
            c.hit.add(f);
            f.hurt(ARENA.crane.dmg, cx);
          }
        }
        this.quakes.push({ x: cx, y: floorY, w: c.w * TILE, t: 0 });
        // le choc du rocher fait trembler l'arène : les échafaudages fragiles s'effondrent (comme sous le corbeau)
        for (const sc of this.level.scaffolds) this.collapse(sc, cx);
        this.onEvent?.('craneLand', { x: cx, y: floorY, w: c.w * TILE, rock: true });
      }
    } else if (c.state === 'down') {
      if (c.t > c.recharge) { c.state = 'lower'; c.t = 0; this.onEvent?.('craneWinch', { x: c.ropeX, y: c.boomY }); }
    } else if (c.state === 'lower') {
      // le crochet descend jusqu'aux balles
      if (c.t > ARENA.crane.lower) {
        // personne debout dessus ? on attend qu'il descende
        const box = { ...this.craneBox(), y: this.craneBox().y - 4, h: 6 };
        if (fighters.some((f) => alive(f) && overlap(box, f.box()))) return;
        c.state = 'hoist'; c.t = 0;
        this.fillCrane(null);
        c.y0 = c.y;
      }
    } else if (c.state === 'hoist') {
      const k = Math.min(1, c.t / ARENA.crane.hoist), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      c.y = c.y0 + (c.top * TILE - c.y0) * e;
      if (k >= 1) {
        const hang = this.craneBox();
        if (fighters.some((f) => alive(f) && overlap(hang, f.box()))) return;
        c.state = 'hang'; c.t = 0;
        this.fillCrane(c.top);
        this.onEvent?.('craneReady', { x: c.ropeX, y: c.y });
      }
    }
  }

  // ---- gong et vagues --------------------------------------------------------------
  gongBox() { const g = this.gong; return { x: g.x - 16, y: g.y - 53, w: 32, h: 34 }; }

  /** Un coup (sabre, coup de pied, shuriken) frappe le gong. */
  hitGong(box) {
    const g = this.gong;
    if (!g || !overlap(box, this.gongBox())) return false;
    if (!g.ready) {
      if (this.time - g.ringT > 0.4) { g.ringT = this.time; this.onEvent?.('gongDull', { x: g.x, y: g.y - 28 }); }
      return true;
    }
    g.ready = false;
    g.t = 0;
    g.ringT = this.time;
    this.onEvent?.('gongArena', { x: g.x, y: g.y - 28 });
    for (const s of this.def.sluices) this.waves.push({ ...s, t: -ARENA.wave.delay, front: s.x, back: s.x, hit: new Set() });
    this.onEvent?.('sluiceRumble', { x: this.def.center, y: this.def.ground });
    return true;
  }

  updateWaves(dt, fighters) {
    const W = ARENA.wave, g = this.gong;
    if (g) {
      g.t += dt;
      if (!g.ready && g.t > W.rearm && !this.waves.length) { g.ready = true; this.onEvent?.('gongReady', { x: g.x, y: g.y - 28 }); }
    }
    const [c0, c1] = this.def.canal, ground = this.def.ground;
    for (const w of this.waves) {
      const was = w.t;
      w.t += dt;
      if (w.t < 0) continue;
      if (was < 0) this.onEvent?.('sluiceOpen', { x: w.x, y: ground, dir: w.dir });
      const end = w.dir > 0 ? c0 : c1;
      const adv = (x) => (w.dir > 0 ? Math.min(end, x + W.speed * dt) : Math.max(end, x - W.speed * dt));
      w.front = adv(w.front);
      if (w.t > W.open) w.back = adv(w.back);           // la vanne se referme : la nappe se vide dans le canal
      if (w.front === end && !w.fell) { w.fell = true; this.onEvent?.('waveFall', { x: end, y: ground, dir: w.dir }); }
      // ceux qui ont les pieds dans l'eau sont emportés vers le canal
      const x0 = Math.min(w.front, w.back), x1 = Math.max(w.front, w.back);
      for (const f of fighters) {
        if (!alive(f) || f.y < ground - 6 || f.y > ground + 2 || f.x < x0 - 3 || f.x > x1 + 3) continue;
        if (!w.hit.has(f)) {
          // le premier choc : touché, soulevé et projeté vers le canal
          w.hit.add(f);
          f.hurt(W.dmg, f.x - w.dir * 10);
          f.vy = -W.lift;
          f.onGround = false;
          this.onEvent?.('waveHit', { x: f.x, y: f.y, dir: w.dir });
        }
        // ensuite, tant qu'il a les pieds dans l'eau, le courant le porte
        f.vx = w.dir * W.push;
      }
      // les caisses posées dans la rizière basse partent avec l'eau
      const gy = ground / TILE - 1;
      for (const [key, cr] of this.level.crates) {
        if (cr.fall || cr.ty !== gy) continue;
        const cx = cr.tx * TILE + TILE / 2;
        if (cx < x0 - 4 || cx > x1 + 4) continue;
        if (this.level.at(cr.tx, gy - 1) === 'B') continue;   // une pile : celle du bas attend que celle du dessus soit partie
        this.level.crates.delete(key);
        this.level.setTile(cr.tx, cr.ty, '.');
        this.sliding.push({ x: cr.tx * TILE, y: cr.ty * TILE, ty: cr.ty, vx: w.dir * W.push * 1.1, by: null, t: 1, hit: new Set(), carried: w });
      }
    }
    this.waves = this.waves.filter((w) => w.front !== w.back || w.t < W.open);
  }

  // ---- foin, échafaudages ----------------------------------------------------------
  landings(dt, fighters) {
    const lv = this.level;
    for (const f of fighters) {
      const tr = this.track.get(f) ?? { vy: 0, onGround: true, state: f.state };
      if (alive(f) && f.onGround && !tr.onGround) {
        const fall = tr.vy, tx = Math.floor(f.x / TILE), ty = Math.round(f.y / TILE);
        // botte de foin : un tremplin (on rebondit d'autant plus haut qu'on tombait vite)
        const hay = this.hay.find((h) => ty === h.row && tx >= h.x0 && tx < h.x0 + h.w);
        // les rebonds s'amortissent : chaque rebond enchaîné sur le foin perd de sa force
        if (!hay) tr.chain = 0;
        const v = hay ? Math.max(ARENA.hay.min, Math.min(ARENA.hay.max, fall * ARENA.hay.keep + 120)) * ARENA.hay.damp ** (tr.chain ?? 0) : 0;
        if (hay && fall > ARENA.hay.minFall && v > ARENA.hay.stop) {
          tr.chain = (tr.chain ?? 0) + 1;
          f.vy = -v;
          f.onGround = false;
          f.fallFrom = f.y;
          f.airDash = true;
          f.flipUsed = false;
          if (f.setState) f.setState('jump');
          hay.squash = 1;
          this.onEvent?.('hayBounce', { x: f.x, y: f.y, k: v / ARENA.hay.max });
        }
      }
      this.track.set(f, { vy: f.vy, onGround: f.onGround, state: f.state, chain: tr.chain ?? 0 });
    }
    for (const h of this.hay) h.squash = Math.max(0, h.squash - dt * 4);
    // échafaudages tombés : rebâtis un peu plus tard
    for (const s of lv.scaffolds) if (!s.up && s.fallen && lv.time > s.fallAt + ARENA.scaffold.rebuild) this.rebuild(s);
  }

  collapse(s, x) {
    if (!s.up) return;
    s.up = false;
    s.fallAt = this.level.time + ARENA.scaffold.warn;
    s.fallen = false;
    this.onEvent?.('scaffoldsShake', { x });
  }

  rebuild(s, silent = false) {
    s.up = true;
    s.fallAt = -9;
    s.fallen = false;
    s.debris = null;
    s.builtAt = this.level.time;
    for (let i = 0; i < s.w; i++) this.level.setTile(s.x0 + i, s.row, '_');
    if (!silent) this.onEvent?.('scaffoldRebuild', { x: (s.x0 + s.w / 2) * TILE, y: s.row * TILE, w: s.w * TILE });
  }

  // ---- caisses ---------------------------------------------------------------------
  /** Coup de pied dans une caisse : elle part en glissant (renvoie le nombre de caisses). */
  kickCrates(box, dir, by) {
    const lv = this.level;
    let n = 0;
    for (const [key, cr] of lv.crates) {
      if (cr.fall) continue;
      const x = cr.tx * TILE, y = cr.ty * TILE;
      if (!overlap(box, { x, y, w: TILE, h: TILE })) continue;
      lv.crates.delete(key);
      lv.setTile(cr.tx, cr.ty, '.');
      this.sliding.push({ x, y, ty: cr.ty, vx: dir * ARENA.crate.kick, by, t: 0, hit: new Set() });
      this.onEvent?.('crateKick', { x: x + 8, y: y + 8, dir });
      n++;
    }
    return n;
  }

  updateCrates(dt, fighters) {
    const lv = this.level;
    for (const s of this.sliding) {
      s.t += dt;
      if (s.fall) {
        s.vy = Math.min(560, s.vy + 1100 * dt);
        s.y += s.vy * dt;
        const tx = Math.floor((s.x + 8) / TILE), below = Math.floor((s.y + TILE) / TILE);
        if (lv.at(tx, below) === '~' || below >= lv.h) { s.dead = true; this.onEvent?.('crateSplash', { x: s.x + 8, y: Math.min(s.y + 12, (lv.h - 2) * TILE) }); continue; }
        if (lv.solid(tx, below) || lv.ledge(tx, below)) { s.y = (below - 1) * TILE; s.ty = below - 1; s.fall = false; s.vx = 0; this.settle(s); }
        continue;
      }
      const sign = Math.sign(s.vx);
      const w = s.carried;
      const wet = w && this.waves.includes(w) && s.x + 8 >= Math.min(w.front, w.back) - 4 && s.x + 8 <= Math.max(w.front, w.back) + 4;
      if (!wet) s.vx -= sign * ARENA.crate.friction * dt;
      if (Math.sign(s.vx) !== sign) s.vx = 0;
      const nx = s.x + s.vx * dt;
      // un mur (ou une autre caisse) devant : elle s'y brise
      const front = sign > 0 ? Math.floor((nx + TILE - 1) / TILE) : Math.floor(nx / TILE);
      if (sign && (lv.solid(front, s.ty) || (lv.at(front, s.ty) === 'K'))) { s.dead = true; this.onEvent?.('crateBreak', { x: s.x + 8, y: s.y + 8 }); continue; }
      s.x = nx;
      // plus rien dessous : elle tombe (dans le canal, elle coule)
      const l = Math.floor((s.x + 3) / TILE), r = Math.floor((s.x + TILE - 4) / TILE);
      const held = (tx) => lv.solid(tx, s.ty + 1) || lv.ledge(tx, s.ty + 1);
      if (!held(l) && !held(r)) { s.fall = true; s.vy = 0; s.x = Math.round(s.x / TILE) * TILE; continue; }
      // elle renverse ceux qu'elle croise (pas celui qui l'a lancée, au départ)
      const box = { x: s.x + 1, y: s.y + 2, w: TILE - 2, h: TILE - 2 };
      for (const f of fighters) {
        if (s.hit.has(f) || !alive(f) || (f === s.by && s.t < 0.25)) continue;
        if (Math.abs(s.vx) > 60 && overlap(box, f.box())) {
          s.hit.add(f);
          f.hurt(ARENA.crate.dmg, s.x + 8 - Math.sign(s.vx) * 12);
          this.onEvent?.('crateHitFighter', { x: f.x, y: f.y - 10 });
        }
      }
      if (!s.vx) this.settle(s);
    }
    this.sliding = this.sliding.filter((s) => !s.dead && !s.done);
    // caisses tombées à l'eau (du ciel, ou poussées) : elles coulent
    for (const [key, cr] of lv.crates) {
      if (!cr.fall) continue;
      const below = Math.floor((cr.fall.y + TILE) / TILE);
      if (lv.at(cr.tx, below) === '~') { lv.crates.delete(key); this.onEvent?.('crateSplash', { x: cr.tx * TILE + 8, y: (lv.h - 2) * TILE }); }
    }
    // il en retombe du ciel quand il en manque
    const spots = this.def.crates ?? [];
    this.crateClock += dt;
    if (this.crateClock > ARENA.crate.every && lv.crates.size + this.sliding.length < spots.length) {
      this.crateClock = 0;
      const free = spots.filter((p) => lv.at(p.tx, p.ty) === '.' && (p.ty === Math.round(this.def.ground / TILE) - 1 || lv.at(p.tx, p.ty + 1) === 'B'));
      const p = free[Math.floor(Math.random() * free.length)];
      if (p) { this.dropCrate(p.tx); this.onEvent?.('crateDrop', { tx: p.tx }); }
    }
  }

  /** Une caisse tombe du ciel dans la colonne tx. */
  dropCrate(tx) {
    const key = `a${tx}_${Math.round(this.time * 100)}`;
    this.level.crates.set(key, { key, tx, ty: 0, fall: { y: -TILE * 2, vy: 0 } });
  }

  /** La caisse s'arrête : elle reprend une case (ou se brise si la place est prise). */
  settle(s) {
    const lv = this.level, tx = Math.round(s.x / TILE);
    if (lv.at(tx, s.ty) !== '.') { s.dead = true; this.onEvent?.('crateBreak', { x: s.x + 8, y: s.y + 8 }); return; }
    lv.setTile(tx, s.ty, 'B');
    const key = `s${tx}_${s.ty}_${Math.round(this.time * 100)}`;
    lv.crates.set(key, { key, tx, ty: s.ty, fall: null });
    s.done = true;
  }

  // ---- bonus -------------------------------------------------------------------------
  updatePickups(dt, fighters) {
    const P = ARENA.pickup;
    this.heartClock += dt;
    this.bundleClock += dt;
    const spawn = (kind, spots) => {
      const used = new Set(this.pickups.map((p) => p.spot));
      const free = spots.map((s, i) => [s, `${kind}${i}`]).filter(([, id]) => !used.has(id));
      if (!free.length) return;
      const [s, id] = free[Math.floor(Math.random() * free.length)];
      this.pickups.push({ kind, x: s.x, y: s.y, spot: id, t: 0 });
      this.onEvent?.('pickupAppear', { kind, x: s.x, y: s.y - 10, spot: id });
    };
    if (this.heartClock > P.heart && !this.pickups.some((p) => p.kind === 'heart')) { this.heartClock = 0; spawn('heart', this.def.hearts ?? []); }
    if (this.bundleClock > P.bundle && !this.pickups.some((p) => p.kind === 'bundle')) { this.bundleClock = 0; spawn('bundle', this.def.bundles ?? []); }
    for (const p of this.pickups) {
      p.t += dt;
      if (p.t < 0.35) continue;                    // il apparaît (on ne le prend pas au vol)
      const box = { x: p.x - 6, y: p.y - 18, w: 12, h: 16 };
      const f = fighters.find((ff) => alive(ff) && overlap(box, ff.box()));
      if (f) { p.taken = true; this.onEvent?.('pickup', { kind: p.kind, x: p.x, y: p.y - 10, fighter: f, spot: p.spot }); }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }

  // ---- image par image -----------------------------------------------------------
  update(dt, fighters) {
    this.time += dt;
    for (const q of this.quakes) q.t += dt;
    this.quakes = this.quakes.filter((q) => q.t < 1.2);
    this.updateCrane(dt, fighters);
    this.updateWaves(dt, fighters);
    this.landings(dt, fighters);
    this.updateCrates(dt, fighters);
    this.updatePickups(dt, fighters);
  }
}

function alive(f) { return f.state !== 'death' && f.state !== 'respawn'; }
