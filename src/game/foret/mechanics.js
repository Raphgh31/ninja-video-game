// Mécaniques vivantes de la Forêt (chapitre 2), déclarées dans chapters/foret.js :
//   - travées du pont qui s'effondrent une à une (zone 4) ;
//   - planches de bois vermoulu qui cèdent (zone 5) ;
//   - troncs flottants qui dérivent et s'enfoncent (zone 6) ;
//   - lianes : immobiles (on y grimpe) ou balancier (on s'y balance) (zones 9 et 10) ;
//   - la statue : deux yeux à rallumer, puis la porte de pierre qui remonte (zone 9) ;
//   - l'éboulis qui dévale la pente (zone 11).
// Le niveau l'instancie (level.forest) ; le joueur s'en sert pour se poser sur une
// plateforme mobile et pour l'état « vine ». Tout se remet en place à la
// réapparition de KAGE (reset), sauf la statue, qui est sauvegardée.

const TILE = 16;

export const FOREST = {
  collapse: { grace: 0.7, speed: 107, warn: 0.5 },      // le front d'effondrement avance à 107 px/s (course 96, sprint 140)
  crumble: { hold: 0.7, back: 2.6 },
  snap: { hold: 0.38, hinge: 0.16 },   // la branche qui rompt (zone 7) : elle tient 0,38 s, pivote 0,16 s à sa jointure, puis tombe
  // planches de 18 px séparées de 6 px : les jours se marchent sans tomber, mais une planche tombée laisse
  // un trou de 30 px qu'aucun sprint ne passe sans sauter (une planche ne rattrape KAGE qu'à 9 px sous elle)
  bridge: { plankW: 18, plankGap: 6, rotten: [2, 5, 8, 10], hold: 0.45, bounce: 3.5, maxAmp: 6, damp: 1.6, freq: 9, dip: 5 },   // pont suspendu (canopée)                   // la planche cède après 0,7 s, repousse 2,6 s plus tard
  log: { sink: 5.6, rise: 9, max: 13, bob: 1.2 },      // px/s ; pieds dans l'eau à ~9 px d'enfoncement (~1,6 s)
  vine: {
    g: 980,            // pesanteur du balancier
    pump: 2.6,         // élan donné par gauche / droite (rad/s²)
    damp: 0.22,        // frottement d'une liane balancier
    dampStill: 3.2,    // frottement d'une liane immobile (statue)
    climb: 46,         // px/s le long de la liane
    grab: 12,          // distance (px) à laquelle la main attrape la liane
    letGo: 0.07,       // s sans aucune direction avant de lâcher
    cooldown: 0.42,    // s avant de pouvoir rattraper la même liane
    jumpUp: 320,       // impulsion du bond pour quitter une liane immobile (statue, canopée : de quoi passer sur la branche)
    hop: 0,            // sur une liane qui se balance, sauter revient à lâcher (l'élan vient du balancier)
    boost: 1.08,       // l'élan du balancier est rendu à KAGE, très légèrement amplifié
    gripX: 6, gripY: 19,   // la main, par rapport au point d'ancrage de KAGE (sous ses pieds)
    minR: 22,          // on ne monte pas plus près de l'accroche
    maxAngle: 1.0,
    pumpAngle: 0.62,   // au-delà, gauche / droite ne donnent plus d'élan
    maxSpeed: 300,     // vitesse rendue au lâcher, au plus (px/s)
  },
  statue: { reach: 22, delay: 0.9, gateTime: 2.8 },   // la dalle de la porte remonte en 2,8 s
  slide: { margin: 6 },
};

export class Forest {
  constructor(level, def) {
    this.level = level;
    this.def = def;
    this.time = 0;
    this.spans = def.spans.map((s) => ({ ...s, state: 'up', fallAt: -9, at: 0 }));
    this.collapse = def.collapse ? { ...def.collapse, active: false, t: 0 } : null;
    if (this.collapse) {
      const C = FOREST.collapse;
      this.spans.forEach((s, i) => {
        s.at = Math.max(0.3 * (i + 1), C.grace + ((s.x0 + s.w) * TILE - this.collapse.trigger) / C.speed);
      });
    }
    this.crumbles = def.crumbles.map((c) => ({ kind: 'crumble', x: c.x, y: c.y, y0: c.y, w: c.w, state: 'idle', t: 0, active: true, dx: 0, dy: 0, load: false, vy: 0 }));
    this.logs = def.logs.map((l) => ({
      kind: 'log', x0: l.x0, x1: l.x1, w: l.w, d: l.d ?? 11, speed: Math.abs(l.speed), dir: l.speed < 0 ? -1 : 1,
      x: l.x0 + (l.x1 - l.x0) * (l.start ?? 0), y: l.y, y0: l.y, sink: 0, active: true, dx: 0, dy: 0, load: false, phase: l.x0 * 0.07,
    }));
    // le pont suspendu : des planches espacées, centrées entre les deux troncs ; les pourries lâchent sous le pied
    this.bridges = (def.bridges ?? []).map((br) => {
      const B = { ...br, amp: 0, t: 0, dipX: null, loaded: false, planks: [] };
      const { plankW: w, plankGap: g } = FOREST.bridge, n = Math.floor((br.x1 - br.x0 + g) / (w + g));
      const x0 = br.x0 + Math.floor((br.x1 - br.x0 - (n * (w + g) - g)) / 2);
      for (let i = 0; i < n; i++) {
        B.planks.push({ kind: 'plank', bridge: B, i, x: x0 + i * (w + g), w, y: br.y, y0: br.y, active: true, state: 'idle', t: 0, dx: 0, dy: 0, vy: 0, load: false, rotten: FOREST.bridge.rotten.includes(i) });
      }
      return B;
    });
    this.snaps = (def.snaps ?? []).map((q) => ({ kind: 'snap', x: q.x0 * TILE, y: q.row * TILE, y0: q.row * TILE, w: q.w * TILE, host: q.host, state: 'idle', t: 0, active: true, dx: 0, dy: 0, load: false, ang: 0, fx: 0, fy: 0, vx: 0, vy: 0 }));
    this.platforms = [...this.snaps, ...this.crumbles, ...this.logs, ...this.bridges.flatMap((b) => b.planks)];
    this.vines = def.vines.map((v, i) => ({ ...v, i, angle: 0, av: 0, rider: null, still: !v.swing }));
    this.statue = def.statue ? { ...def.statue, lit: [false, false], litAt: [-9, -9], wake: -1, gate: 0 } : null;
    this.slide = def.slide ? { ...def.slide, x: def.slide.start, from: def.slide.trigger, active: false, done: false } : null;
    this.dark = def.dark ?? null;
  }

  emit(name, data = {}) { this.level.onEvent?.(name, data); }

  /** La statue est-elle ouverte (la porte de pierre ne bloque plus) ? */
  get statueOpen() { return !!this.statue && this.statue.gate >= 0.85; }

  // --- sauvegarde ---------------------------------------------------------------
  applySave(s) {
    if (this.statue && s?.statue) { this.statue.lit = [true, true]; this.statue.wake = 0; this.statue.gate = 1; }
  }

  // --- réapparition de KAGE : tout se remet en place ------------------------------
  reset(spawn) {
    for (const s of this.spans) {
      if (s.state === 'down') for (let i = 0; i < s.w; i++) this.level.setTile(s.x0 + i, s.row, '=');
      s.state = 'up'; s.fallAt = -9;
    }
    if (this.collapse) { this.collapse.active = false; this.collapse.t = 0; }
    for (const c of this.crumbles) { c.state = 'idle'; c.t = 0; c.y = c.y0; c.vy = 0; c.active = true; }
    for (const q of this.snaps) Object.assign(q, { state: 'idle', t: 0, y: q.y0, active: true, ang: 0, fx: 0, fy: 0, vx: 0, vy: 0 });   // la branche revient
    for (const l of this.logs) { l.sink = 0; l.y = l.y0; }
    for (const B of this.bridges) { B.amp = 0; B.dipX = null; for (const p of B.planks) { if (p.state === 'fall' || p.state === 'gone') { p.state = 'gone'; p.active = false; continue; } p.state = 'idle'; p.t = 0; p.active = true; p.vy = 0; p.y = this.deckY(B, p.x + p.w / 2); } }
    for (const v of this.vines) v.rider = null;
    if (this.slide) {
      const S = this.slide;
      S.active = false; S.done = false;
      // reprise à mi-pente : l'éboulis repart de derrière la lanterne, dès que KAGE s'en éloigne
      const mid = spawn && spawn.x > S.trigger;
      S.x = mid ? spawn.x - 11 * TILE : S.start;
      S.from = mid ? spawn.x + 12 : S.trigger;
    }
  }

  // --- plateformes mobiles (bois vermoulu, troncs flottants) ----------------------
  /** Plateforme sur laquelle la boîte se pose en retombant de dy pixels ; sinon null. */
  platformUnder(box, dy) {
    const feet = box.y + box.h;
    for (const p of this.platforms) {
      if (!p.active) continue;
      if (box.x + box.w <= p.x + 1 || box.x >= p.x + p.w - 1) continue;
      // (les planches du pont suivent sa courbe : on monte de l'une à l'autre comme sur une petite marche)
      const tol = p.kind === 'plank' ? 9 : 4;
      if (feet >= p.y && feet - dy <= p.y + tol + Math.max(0, p.dy)) return p;
    }
    return null;
  }

  update(dt, player) {
    this.time += dt;
    const alive = player.state !== 'death' && player.state !== 'respawn';
    this.updateCollapse(dt, player, alive);
    this.updateCrumbles(dt);
    this.updateSnaps(dt);
    this.updateBridges(dt, player);
    this.updateLogs(dt);
    this.updateVines(dt);
    this.updateStatue(dt, player, alive);
    this.updateSlide(dt, player, alive);
    for (const p of this.platforms) p.load = false;
  }

  // --- zone 4 : le pont s'effondre --------------------------------------------------
  updateCollapse(dt, player, alive) {
    const c = this.collapse;
    if (!c) return;
    if (!c.active) {
      if (alive && player.x > c.trigger && player.x < (this.spans[this.spans.length - 1].x0 + 8) * TILE) {
        c.active = true; c.t = 0;
        this.emit('collapseStart', { x: c.trigger });
      }
      return;
    }
    c.t += dt;
    for (const s of this.spans) {
      if (s.state === 'up' && c.t >= s.at - FOREST.collapse.warn) {
        s.state = 'warn';
        this.emit('spanWarn', { x: (s.x0 + s.w / 2) * TILE, y: s.row * TILE, w: s.w * TILE });
      }
      if (s.state === 'warn' && c.t >= s.at) {
        s.state = 'down'; s.fallAt = this.time;
        for (let i = 0; i < s.w; i++) this.level.setTile(s.x0 + i, s.row, '.');
        this.emit('spanFall', { x: (s.x0 + s.w / 2) * TILE, y: s.row * TILE, w: s.w * TILE });
      }
    }
  }

  // --- zone 5 : bois vermoulu -------------------------------------------------------
  updateCrumbles(dt) {
    const C = FOREST.crumble;
    for (const c of this.crumbles) {
      c.dx = 0; c.dy = 0;
      if (c.state === 'idle') {
        if (c.load) { c.state = 'shake'; c.t = 0; this.emit('crumbleCreak', { x: c.x + c.w / 2, y: c.y }); }
      } else if (c.state === 'shake') {
        c.t += dt;
        if (c.t >= C.hold) { c.state = 'fall'; c.t = 0; c.active = false; c.vy = 20; this.emit('crumbleFall', { x: c.x + c.w / 2, y: c.y, w: c.w }); }
      } else if (c.state === 'fall') {
        c.t += dt; c.vy += 700 * dt; c.y += c.vy * dt;
        if (c.t >= C.back) { c.state = 'grow'; c.t = 0; c.y = c.y0; c.vy = 0; c.active = true; }
      } else if (c.state === 'grow') {
        c.t += dt;
        if (c.t >= 0.35) c.state = 'idle';
      }
    }
  }

  // --- zone 7 : la branche qui rompt -------------------------------------------------------
  updateSnaps(dt) {
    const S = FOREST.snap;
    for (const q of this.snaps) {
      q.dx = 0; q.dy = 0;
      if (q.state === 'idle') {
        if (q.load) { q.state = 'crack'; q.t = 0; this.emit('branchCrack', { x: q.x + q.w, y: q.y }); }
      } else if (q.state === 'crack') {
        // elle craque et s'affaisse d'un pixel, puis d'un autre : KAGE la sent céder sous lui
        q.t += dt;
        const ny = q.y0 + (q.t > S.hold * 0.45 ? 2 : 1);
        q.dy = ny - q.y; q.y = ny;
        if (q.t >= S.hold) { q.state = 'hinge'; q.t = 0; q.active = false; this.emit('branchSnap', { x: q.x + q.w, y: q.y, w: q.w }); }
      } else if (q.state === 'hinge' || q.state === 'fall') {
        q.t += dt;
        if (q.state === 'hinge') {
          // encore tenue par quelques fibres : elle pivote vers le bas à sa jointure avec le tronc
          q.ang = -0.42 * Math.pow(Math.min(1, q.t / S.hinge), 1.6);
          if (q.t >= S.hinge) { q.state = 'fall'; q.t = 0; q.vx = -24; q.vy = 40; }
        } else {
          // détachée : elle tombe en tournant, et s'éloigne un peu du tronc
          q.vy += 900 * dt; q.fx += q.vx * dt; q.fy += q.vy * dt; q.ang -= 1.7 * dt;
          if (q.t > 2.2) q.state = 'gone';
        }
      }
    }
  }

  // --- zone 7 : le pont suspendu --------------------------------------------------------
  /** Hauteur du tablier à l'abscisse x (courbe, creux sous KAGE, oscillation). */
  deckY(B, x) {
    const W = FOREST.bridge, u = Math.max(0, Math.min(1, (x - B.x0) / (B.x1 - B.x0))), s = Math.sin(Math.PI * u);
    const dip = B.dipX == null ? 0 : W.dip * Math.exp(-(((x - B.dipX) / 40) ** 2)) * Math.min(1, s * 2.5);
    return B.y + B.sag * s + dip + B.amp * s * Math.sin(B.t * W.freq);
  }

  updateBridges(dt, player) {
    const W = FOREST.bridge;
    for (const B of this.bridges) {
      const loaded = B.planks.some((p) => p.load);
      if (loaded && !B.loaded) {
        // KAGE s'y pose : le pont accuse le coup, oscille, craque
        B.amp = Math.min(W.maxAmp, B.amp + W.bounce * Math.min(1.4, Math.max(0.5, (player.lastFall ?? 200) / 220)));
        this.emit('bridgeCreak', { x: player.x, y: B.y });
      }
      B.loaded = loaded;
      B.t += dt;
      B.amp *= Math.exp(-dt * W.damp);
      // le creux suit KAGE en douceur ; il se relâche quand il quitte le pont
      const target = loaded ? player.x : null;
      if (target != null) B.dipX = B.dipX == null ? target : B.dipX + (target - B.dipX) * Math.min(1, dt * 10);
      else if (B.dipX != null && B.amp < 0.3) B.dipX = null;
      for (const p of B.planks) {
        p.dx = 0;
        if (p.state === 'fall') {
          p.t += dt; p.vy += 700 * dt; const py = p.y; p.y += p.vy * dt; p.dy = p.y - py;
          if (p.t >= 1.2) p.state = 'gone';            // une planche tombée ne revient jamais (demande de Raph)
          continue;
        }
        if (p.state === 'gone') continue;
        if (p.rotten && p.state === 'idle' && p.load) { p.state = 'shake'; p.t = 0; this.emit('crumbleCreak', { x: p.x + p.w / 2, y: p.y }); }
        if (p.state === 'shake') {
          p.t += dt;
          if (p.t >= W.hold) { p.state = 'fall'; p.t = 0; p.active = false; p.vy = 30; this.emit('plankFall', { x: p.x + p.w / 2, y: p.y }); continue; }
        }
        if (p.state === 'grow') { p.t += dt; if (p.t >= 0.4) p.state = 'idle'; }
        const ny = this.deckY(B, p.x + p.w / 2);
        p.dy = ny - p.y; p.y = ny;
      }
    }
  }

  // --- zone 6 : troncs flottants ------------------------------------------------------
  updateLogs(dt) {
    const L = FOREST.log;
    for (const l of this.logs) {
      const px = l.x, py = l.y;
      l.x += l.dir * l.speed * dt;
      if (l.x > l.x1) { l.x = l.x1; l.dir = -1; } else if (l.x < l.x0) { l.x = l.x0; l.dir = 1; }
      const was = l.sink;
      l.sink = l.load ? Math.min(L.max, l.sink + L.sink * dt) : Math.max(0, l.sink - L.rise * dt);
      if (l.load && was === 0) this.emit('logDip', { x: l.x + l.w / 2, y: l.y });
      l.y = l.y0 + l.sink + Math.sin(this.time * 2.1 + l.phase) * L.bob * (l.load ? 0.3 : 1);
      l.dx = l.x - px; l.dy = l.y - py;
    }
  }

  // --- lianes -----------------------------------------------------------------------------
  /** Pulsation propre d'une liane (rad/s). */
  omega(v) { return Math.sqrt(FOREST.vine.g / v.len); }

  updateVines(dt) {
    for (const v of this.vines) {
      if (v.rider) continue;
      // sans cavalier : le vent la balance (toutes au même rythme), ou elle frémit à peine
      const w = this.omega(v) * 0.82;
      const target = v.still ? Math.sin(this.time * 0.9 + v.i * 1.7) * 0.018 : v.swing * Math.sin(this.time * w + v.phase);
      const next = v.angle + (target - v.angle) * Math.min(1, dt * 4);
      v.av = (next - v.angle) / Math.max(dt, 1e-4);
      v.angle = next;
    }
  }

  /** Bout d'une liane à la distance r de son accroche. */
  vinePoint(v, r = v.len) { return { x: v.ax + Math.sin(v.angle) * r, y: v.ay + Math.cos(v.angle) * r }; }

  /** KAGE est en l'air, une direction tenue : attrape-t-il une liane ? */
  tryGrab(player, input) {
    const V = FOREST.vine;
    if (!this.vines.length || player.onGround) return false;
    if (!(input.isHeld('left') || input.isHeld('right') || input.isHeld('up') || input.isHeld('down') || input.isHeld('stick'))) return false;
    const hx = player.x + player.facing * V.gripX, hy = player.y - V.gripY;
    for (const v of this.vines) {
      if (v === player.lastVine && player.vineCd > 0) continue;
      const dx = hx - v.ax, dy = hy - v.ay;
      const r = Math.hypot(dx, dy);
      if (r < V.minR - 6 || r > v.len + 8 || dy < 0) continue;
      const p = this.vinePoint(v, Math.min(r, v.len));
      if (Math.hypot(hx - p.x, hy - p.y) > V.grab) continue;
      player.vine = v;
      player.vineR = Math.max(V.minR, Math.min(v.len - 2, r));
      player.vineHold = 0;
      v.rider = player;
      // l'élan de KAGE passe à la liane
      const c = Math.cos(v.angle), s = Math.sin(v.angle);
      const vt = (player.vx * c - player.vy * s) / player.vineR;
      v.av = v.still ? vt * 0.25 : v.av * 0.35 + vt * 0.85;
      player.vx = 0; player.vy = 0;
      player.setState('vine');
      player.emit('vine_grab', { still: v.still });
      return true;
    }
    return false;
  }

  /** État « vine » du joueur : balancier, grimpe, lâcher. */
  rideVine(player, dt, input) {
    const V = FOREST.vine, v = player.vine;
    const L = input.isHeld('left'), R = input.isHeld('right');
    const U = input.isHeld('up') || input.isHeld('stick_up'), D = input.isHeld('down');
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    player.vineHold = L || R || U || D || input.isHeld('stick') ? 0 : player.vineHold + dt;
    // grimpe
    let r = player.vineR;
    if (U && !D) r -= V.climb * dt;
    if (D && !U) r += V.climb * dt;
    r = Math.max(V.minR, Math.min(v.len - 2, r));
    const climbing = r !== player.vineR;
    player.vineR = r;
    // balancier : pesanteur, frottement, élan donné par le joueur
    let acc = -(V.g / r) * Math.sin(v.angle) - (v.still ? V.dampStill : V.damp) * v.av;
    // (on ne pousse plus au-delà d'un certain angle : le balancier reste lisible)
    if (Math.abs(v.angle) < V.pumpAngle || Math.sign(v.angle) !== dir) acc += dir * V.pump * (v.still ? 0.25 : 1) * Math.cos(v.angle);
    v.av += acc * dt;
    v.angle += v.av * dt;
    if (Math.abs(v.angle) > V.maxAngle) { v.angle = Math.sign(v.angle) * V.maxAngle; v.av = 0; }
    if (dir) player.facing = dir;
    else if (!v.still && Math.abs(v.av) > 0.5) player.facing = Math.sign(v.av);
    const p = this.vinePoint(v, r);
    player.x = p.x - player.facing * V.gripX;
    player.y = p.y + V.gripY;

    player.onGround = false;
    // animation : grimpe, balancé (image choisie par l'angle), ou accroché
    const a = player.anim;
    if (climbing) {
      a.play('vine_climb');
      const f0 = a.frame;
      a.update(dt);
      if (a.frame !== f0 && a.frame % 2 === 0) player.emit('vine_step');
    } else if (!v.still && (Math.abs(v.angle) > 0.12 || Math.abs(v.av) > 0.4)) {
      a.play('vine_swing');
      a.frame = Math.max(0, Math.min(4, 2 + Math.round(((v.angle * player.facing) / 0.55) * 2)));
    } else {
      a.play('vine');
      a.update(dt);
    }
    // lâcher : plus aucune direction, un bond (saut), ou un dash
    const dash = input.wasPressed('dash_right') ? 1 : input.wasPressed('dash_left') ? -1 : 0;
    if (dash) this.release(player, { dash });
    else if (input.wasPressed('jump')) this.release(player, { jump: true, dir });
    else if (player.vineHold > V.letGo) this.release(player, {});
  }

  /** La boîte de KAGE touche-t-elle une tuile pleine ? */
  hitsWall(player) {
    const b = player.box(), lv = this.level;
    for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w - 1) / TILE); x++) {
      for (let y = Math.floor(b.y / TILE); y <= Math.floor((b.y + b.h - 1) / TILE); y++) if (lv.solid(x, y)) return true;
    }
    return false;
  }

  release(player, { jump = false, dir = 0, dash = 0 } = {}) {
    const V = FOREST.vine, v = player.vine;
    if (!v) return;
    const r = player.vineR;
    const vt = Math.max(-V.maxSpeed, Math.min(V.maxSpeed, v.av * r * V.boost));
    player.vx = vt * Math.cos(v.angle);
    player.vy = -vt * Math.sin(v.angle);
    // le bond : franc sur une liane immobile (on passe d'une mèche à l'autre), un simple
    // coup de reins sur une liane qui se balance (l'élan vient du balancier, pas du saut)
    if (jump && v.still) { player.vy = Math.min(player.vy, 0) - V.jumpUp; player.vx += dir * 70; }
    else if (jump) player.vy -= V.hop;
    v.rider = null;
    player.vine = null;
    player.lastVine = v;
    // le balancier a pu le mener contre un pilier : on le dégage (par le haut s'il dépasse à peine, sinon sur le côté)
    if (this.hitsWall(player)) {
      const x0 = player.x, y0 = player.y;
      let ok = false;
      for (let d = 1; d <= 18 && !ok; d++) { player.y = y0 - d; ok = !this.hitsWall(player); }
      for (let d = 1; d <= 20 && !ok; d++) for (const sx of [-1, 1]) { player.y = y0; player.x = x0 + sx * d; if (!this.hitsWall(player)) { ok = true; break; } }
      if (!ok) { player.x = x0; player.y = y0; }
      if (ok && player.y < y0) player.vy = Math.min(player.vy, 0);
    }
    player.vineCd = V.cooldown;
    player.airDash = true;
    player.fling = true;
    player.jumpBuffer = 0;
    player.emit('vine_release', { jump });
    if (dash) {
      player.airDash = false;
      player.facing = dash;
      player.emit('dash', { dir: dash });
      player.setState('dash');
    } else {
      player.setState(player.vy < 0 ? 'jump' : 'fall');
      if (player.vy < 0) player.anim.frame = Math.min(2, player.anim.anim.frameCount - 1);
    }
  }

  // --- zone 9 : la statue -------------------------------------------------------------------
  updateStatue(dt, player, alive) {
    const s = this.statue;
    if (!s) return;
    const S = FOREST.statue;
    if (alive) {
      s.eyes.forEach((e, i) => {
        if (s.lit[i]) return;
        if (Math.abs(player.x - e.x) < S.reach && Math.abs(player.y - 14 - e.y) < S.reach) {
          s.lit[i] = true; s.litAt[i] = this.time;
          this.emit('eyeLit', { x: e.x, y: e.y, both: s.lit[0] && s.lit[1] });
        }
      });
    }
    if (s.lit[0] && s.lit[1] && s.gate < 1) {
      if (s.wake < 0) s.wake = this.time;
      if (this.time - s.wake >= S.delay) {
        const dx = s.door * TILE + 8;
        if (s.gate === 0) this.emit('gateOpen', { x: dx, y: s.ground });
        const before = s.gate;
        s.gate = Math.min(1, s.gate + dt / S.gateTime);
        if (before < 1 && s.gate >= 1) this.emit('gateDone', { x: dx, y: s.ground });
      }
    }
  }

  // --- zone 11 : l'éboulis ------------------------------------------------------------------
  updateSlide(dt, player, alive) {
    const S = this.slide;
    if (!S || S.done) return;
    if (!S.active) {
      if (alive && player.x > S.from && player.x < S.end) { S.active = true; this.emit('slideStart', { x: S.x }); }
      return;
    }
    const k = Math.max(0, Math.min(1, (S.x - S.start) / (S.end - S.start)));
    S.x += (S.speed + (S.speedEnd - S.speed) * k) * dt;
    if (S.x >= S.end) { S.x = S.end; S.active = false; S.done = true; this.emit('slideEnd', { x: S.x }); return; }
    if (alive && player.x < S.x - FOREST.slide.margin && player.x > S.start - 32) {
      this.emit('slideHit', { x: player.x, y: player.y });
      player.die();
    }
  }
}
