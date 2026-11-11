// Pilotes des tests de la Forêt (injectés dans la page après tests/foret_bot.js).
// Chaque P.xxx pilote KAGE dans une zone et renvoie ce qui s'est passé.
//   - lianes : P.vise prédit son vol avant de lâcher (comme un joueur qui vise) ;
//   - troncs flottants : P.logger prédit où il retombera avant de sauter.
// Utilisés par tests/foret.cjs et par les sondes de mise au point (tests/foret_sondes.cjs).
window.P = window.P || {};
var P = window.P;
P.z1 = () => { const z = __kage.level.zones; bot.place(4); const t = bot.runner(40, { until: (p) => p.x > z[1].x0 * 16 + 40 }); return ['z1', t, bot.col(), bot.row(), bot.p.state, __kage.save.ryo]; };
P.z2 = () => { const z = __kage.level.zones; bot.place(z[1].x0 + 2); const log = [];
  for (let i = 0; i < 6 && bot.p.x < z[2].x0 * 16; i++) { bot.runner(10, { until: (p) => p.x > z[2].x0 * 16 || (p.onGround && p.vx === 0 && __kage.level.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 4)) });
    log.push(['mur', bot.col(), bot.row()]); if (bot.p.x > z[2].x0 * 16) break; const top = bot.row() - (i === 0 ? 6 : 9); bot.wallClimb(10, top, 1, 1); bot.run(1, () => { bot.set({ right: true }); return bot.p.onGround; }); log.push(['haut', bot.col(), bot.row()]); }
  return ['z2', log, bot.col(), z[2].x0]; };
var Z = (i) => __kage.level.zones[i - 1];
// zone 3 : sans dash on tombe à l'eau ; avec dash on traverse toute la zone
P.z3nodash = () => { bot.place(Z(3).x0 + 2); const hp0 = bot.p.hp; bot.runner(6, { until: (p) => p.hp < hp0 || p.x > (Z(3).x0 + 16) * 16 }); return ['z3 sans dash', bot.p.hp < hp0, bot.col()]; };
P.z3 = () => { bot.place(Z(3).x0 + 2); const hp0 = bot.p.hp; const lost = []; let hp = hp0; const t = bot.runner(60, { dashGap: 5, rest: true, until: (p) => { if (p.hp < hp) { lost.push(bot.col()); hp = p.hp; } return p.x > Z(4).x0 * 16 + 30; } }); return ['z3', t, lost, bot.col(), Z(4).x0]; };
// zone 4 : en courant seulement on meurt ; avec sprint et dash on passe
P.z4run = () => { const c = __kage.level.forest.collapse; bot.place(Math.floor(c.respawnX / 16)); const t = bot.runner(20, { dashGap: 6, until: (p) => p.x > Z(5).x0 * 16 }); return ['z4 course seule', t, bot.dead(), bot.col(), Z(5).x0]; };
P.z4 = () => { const c = __kage.level.forest.collapse; bot.place(Math.floor(c.respawnX / 16)); const x1 = c.trigger + 15 * 16; const t = bot.runner(20, { dashGap: 6, sprint: (p) => p.x > x1, until: (p) => p.x > Z(5).x0 * 16 }); return ['z4', t, bot.dead(), bot.col(), Z(5).x0, Math.round(bot.p.energy.value * 100)]; };
// zone 5 : la montée
P.z5 = () => { bot.place(Z(5).x0 + 2); bot.runner(5, { until: (p) => p.onGround && __kage.level.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 5) && p.vx === 0 }); const a = [bot.col(), bot.row()];
  const log = []; let t = 0;
  const C = __kage.level.forest.def.galleries.x0 / 16;                // la falaise (la niche de la lanterne ouvre sur les galeries)
  for (let i = 0; i < 8 && bot.row() > 22; i++) { t += bot.wallClimb(12, 22, 1, 1, C + 1); bot.run(1, () => { bot.set({ right: bot.col() <= C }); return bot.p.onGround; }); log.push([bot.col(), bot.row(), bot.p.state, bot.p.ride ? 'planche' : '']); if (bot.p.onGround) { bot.clear(); bot.run(0.5); }
    // posé dans la niche de la lanterne (l'entrée des galeries) : on revient au bord du puits pour reprendre l'escalade
    if (bot.p.onGround && bot.col() > C + 1) { bot.run(2, () => { bot.set({ left: true, right: false }); return bot.col() <= C + 1; }); bot.clear(); bot.run(0.3); } }
  bot.runner(2); return ['z5', a, t, log, bot.col(), bot.row()]; };
// zone 6 : de tronc en tronc
// zone 7 : la canopée, depuis la première branche
P.z7 = () => { const l = __kage.level; let c = Z(7).x0 + 8; while (!l.ledge(c, 9)) c++; bot.place(c + 1, 9); const falls = []; let fell = false;
  const t = bot.runner(60, { sprintGap: 5, dashGap: 6, aim: true, rest: true, until: (p) => { if (p.y > 18 * 16 && !fell) { fell = true; falls.push(bot.col()); } return fell || p.x > (Z(8).x0 - 18) * 16; } });
  return ['z7', t, falls, bot.col(), bot.row(), Z(8).x0]; };
// fin de la canopée : on entre dans l'arbre creux et on tombe sous terre ; puis tout le souterrain
P.z8b = () => { const l = __kage.level; const log = []; const h = l.props.find((p) => p.type === 'hollow_giant');
  // de la grande salle (sous l'arbre creux) jusqu'à la sortie : courir, glisser, sauter, dasher ; contre un haut mur, sauts muraux
  bot.place(h.x + 3, 46); let sc = 0;
  for (let i = 0; i < 12 && bot.p.x <= Z(9).x0 * 16 + 20 && !bot.dead(); i++) {
    bot._stuck = 0;
    const t = bot.runner(40, { dashGap: 5, rest: true, until: (p) => { if (p.x > Z(9).x0 * 16 + 20 || bot.dead()) return true;
      const c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
      bot._stuck = p.onGround && Math.abs(p.vx) < 1 && l.solid(c + 1, r - 1) && l.solid(c + 1, r - 4) ? bot._stuck + 1 : 0; return bot._stuck > 30; } });
    log.push(['→', t.toFixed(1), bot.col(), bot.row(), bot.p.hp]);
    if (bot.p.x > Z(9).x0 * 16 + 20 || bot.dead()) break;
    sc = bot.col(); bot.wallClimb(10, bot.row() - 11, 1, 1); bot.run(1, () => { bot.set({ right: true }); return bot.p.onGround; }); log.push(['grimpe', bot.col(), bot.row()]);
  }
  return ['z8b', sc, log, Z(9).x0, __kage.save.ryo]; };
/** Du bout de la canopée, on entre dans l'arbre creux et on descend de palier en palier jusqu'à la caverne. */
P.pit = () => { const l = __kage.level, h = l.props.find((p) => p.type === 'hollow_giant'), pit = h.x + 1; const log = [];
  let c = pit - 1; while (!l.ledge(c, 10) && c > pit - 8) c--; bot.place(c, 10);
  let dir = 1;
  for (let i = 0; i < 8 && !bot.dead() && bot.row() < 46; i++) {
    bot.run(2.5, (p) => { bot.set({ right: dir > 0, left: dir < 0 }); return !p.onGround && p.vy > 0; });
    bot.clear(); bot.run(2.5, (p) => p.onGround || bot.dead());
    log.push([bot.col(), bot.row(), bot.p.state]);
    // sur un nœud du bois : on repart par le côté libre
    const r = bot.row();
    dir = l.ledge(pit + 2, r) ? -1 : 1;
  }
  return ['pit', log, bot.row(), bot.dead()]; };
P.z9 = () => { const f = __kage.level.forest, st = f.statue, l = __kage.level; const log = [];
  bot.place(Math.floor((st.cx - 64 - 40) / 16));
  bot.run(4, (p) => { bot.set({ right: p.x < st.cx - 64 - 8 }); return p.x >= st.cx - 64 - 8; });
  bot.clear(); bot.set({ up: true, right: true }); bot.tap('jump');
  bot.run(1.5, (p) => p.state === 'vine'); log.push(['liane 0', bot.p.state, Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y)]);
  bot.clear(); bot.set({ up: true });
  bot.run(6, (p) => st.ground - p.y >= 96); log.push(['monté', Math.round(st.ground - bot.p.y), bot.p.state]);
  const hop = (name) => { bot.clear(); bot.set({ right: true }); bot.tap('jump'); bot.run(0.05); bot.run(1.2, (p) => p.state === 'vine' || p.onGround); log.push([name, bot.p.state, Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y), f.vines.indexOf(bot.p.vine)]); };
  const level = (h) => { bot.clear(); bot.run(3, (p) => { const d = st.ground - p.y - h; bot.set({ up: d < -2, down: d > 2 }); return Math.abs(d) <= 2; }); bot.clear(); bot.set({ up: true }); bot.run(0.05); };
  // la hauteur à laquelle KAGE passe devant chaque œil (il s'allume à moins de 22 px)
  const hL = st.ground - st.eyes[0].y - 14, hR = st.ground - st.eyes[1].y - 14;
  hop('liane 1'); level(hL); log.push(['œil gauche', st.lit[0]]);
  bot.clear(); bot.set({ up: true }); bot.run(0.3);
  hop('liane 2'); level(Math.max(hL, hR) + 4); hop('liane 3'); level(hR); log.push(['œil droit', st.lit[1], Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y)]);
  bot.clear(); bot.run(5); log.push(['porte', +st.gate.toFixed(2), bot.p.state, bot.col(), bot.row(), f.statueOpen]);
  const t = bot.runner(12, { until: (p) => p.x > Z(10).x0 * 16 + 30 }); log.push(['sortie', t.toFixed(1), bot.col(), Z(10).x0]);
  return ['z9', log]; };
// zone 11 : l'éboulis
P.z11idle = () => { const S = __kage.level.forest.slide; bot.place(Math.floor(S.trigger / 16) + 2); bot.run(0.3, () => { bot.set({ right: true }); }); bot.clear(); const t = bot.run(12, () => bot.dead()); return ['z11 immobile', t.toFixed(1), bot.dead()]; };
P.z11 = (sprint) => { const S = __kage.level.forest.slide; bot.place(Z(11).x0 + 3); let min = 1e9;
  const t = bot.runner(60, { dashGap: 6, sprintGap: 5, aim: false, sprint: (p) => sprint && S.active && p.x - S.x < 110, until: (p) => { if (S.active) min = Math.min(min, p.x - S.x); return p.x > Z(12).x0 * 16 + 30; } });
  return ['z11' + (sprint ? '' : ' sans sprint'), t.toFixed(1), bot.dead(), bot.col(), Z(12).x0, Math.round(min), Math.round(bot.p.energy.value * 100)]; };
P.z11a = () => P.z11(true); P.z11b = () => P.z11(false);
P.z12 = () => { bot.place(Z(12).x0 + 2); const t = bot.runner(40, { until: () => __kage.run.won }); return ['z12', t.toFixed(1), __kage.run.won, bot.col()]; };
// Pilote « qui vise » pour les lianes balancier : avant de lâcher, il prédit son vol.
P.predict = (p, v, delay = 9) => { const f = __kage.level.forest, l = __kage.level, V = { g: 980, boost: 1.08, max: 300 };
  // le pendule continue ~delay pas avant le lâcher effectif (aucune poussée)
  let ang = v.angle, av = v.av; const r = p.vineR; const dt = 1 / 120;
  for (let i = 0; i < delay; i++) { av += (-(V.g / r) * Math.sin(ang) - 0.22 * av) * dt; ang += av * dt; }
  const vt = Math.max(-V.max, Math.min(V.max, av * r * V.boost));
  let x = v.ax + Math.sin(ang) * r - p.facing * 6, y = v.ay + Math.cos(ang) * r + 19, vx = vt * Math.cos(ang), vy = -vt * Math.sin(ang);
  let time = f.time; const qa = new Map(); for (const q of f.vines) qa.set(q, q.angle);
  const wind = () => { for (const q of f.vines) { if (q === v || q.still) continue; const tg = q.swing * Math.sin(time * f.omega(q) * 0.82 + q.phase); qa.set(q, qa.get(q) + (tg - qa.get(q)) * Math.min(1, dt * 4)); } };
  for (let i = 0; i < delay; i++) { time += dt; wind(); }
  for (let i = 0; i < 200; i++) {
    time += dt; wind(); vy = Math.min(420, vy + 980 * dt); if (Math.abs(vx) > 96) vx -= Math.sign(vx) * 70 * dt; x += vx * dt; y += vy * dt;
    // une autre liane devant ?
    for (const q of f.vines) { if (q === v || q.still || q.ax < v.ax) continue;
      const a = qa.get(q);
      const hx = x + 6, hy = y - 19, dx = hx - q.ax, dy = hy - q.ay, rr = Math.hypot(dx, dy); if (dy < 0 || rr > q.len + 6 || rr < 20) continue;
      const px = q.ax + Math.sin(a) * rr, py = q.ay + Math.cos(a) * rr; if (Math.hypot(hx - px, hy - py) < 9) return { kind: 'liane', q: f.vines.indexOf(q), x };
    }
    const fx = Math.floor((x + 6) / 16); if (l.solid(fx, Math.floor((y - 2) / 16)) || l.solid(fx, Math.floor((y - 14) / 16))) return null;   // il heurte un flanc
    const c = Math.floor(x / 16), rw = Math.floor(y / 16);
    // se poser : les deux pieds sur l'appui (pas tout au bord)
    if (vy > 0 && (l.solid(c, rw) || l.ledge(c, rw)) && !l.solid(c, rw - 1)) {
      const both = [x - 7, x + 7].every((xx) => l.solid(Math.floor(xx / 16), rw) || l.ledge(Math.floor(xx / 16), rw));
      return both ? { kind: 'sol', x, c } : null;
    }
    if (l.at(c, rw) === 'v' || y > l.h * 16) return null;
  }
  return null; };
P.vise = (seconds, o = {}) => { const f = __kage.level.forest, l = __kage.level; const sw = f.vines.filter((v) => !v.still); const ev = []; let lastV = null, rel = 0, dashed = false, plan = null;
  const t = bot.run(seconds, (p) => {
    if (o.until && o.until(p)) return true;
    if (bot.dead()) { ev.push(['mort', bot.col(), bot.row()]); return true; }
    if (p.state === 'vine') { const v = p.vine; if (v !== lastV) { ev.push(['liane', sw.indexOf(v), bot.col()]); lastV = v; dashed = false; }
      const last = v === sw[sw.length - 1];
      if (rel > 0) { bot.clear(); return false; }
      let go = null;
      if (v.av > 0.2 && v.angle > -0.1) { const pr = P.predict(p, v); if (pr && pr.x > v.ax + 40 && (o.accept ? o.accept(pr, v) : true)) go = pr; }
      if (last && o.dash && v.av > 0 && v.angle > (o.finalAngle ?? 0.6)) go = { kind: 'dash' };
      if (go) { bot.clear(); rel = 12; plan = go; ev.push(['lâche', go.kind + (go.q ?? '')]); }
      else {
        // un appui tout proche devant (pilier, corniche) : on grimpe le long de la liane pour passer au-dessus
        let top = null; const c0 = Math.floor(v.ax / 16);
        for (let c2 = c0 + 1; c2 <= c0 + 9 && top == null; c2++) for (let r2 = 28; r2 <= 40; r2++) if (l.solid(c2, r2)) { top = r2 * 16; break; }
        bot.set({ right: v.av >= 0, left: v.av < 0, up: top != null && p.y > top - 6 });
      }
      return false; }
    if (rel > 0) { rel = 0; }
    if (!p.onGround) { if (plan && plan.kind === 'sol') bot.set({ right: p.x < plan.x - 2, left: false }); else bot.set({ right: true, left: false });
      if (o.dash && lastV === sw[sw.length - 1] && !dashed && p.vy > -40 && p.airDash) { bot.dash(1); dashed = true; ev.push(['dash', bot.col(), bot.row()]); }
      return false; }
    if (lastV) { ev.push(['sol', bot.col(), bot.row()]); lastV = null; plan = null; }
    const c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
    const atEdge = !bot.groundAt(c + 1, r, 2) && p.x % 16 > 9;
    if (!atEdge) { bot.set({ right: true, jump: false }); return false; }
    const v = sw.find((q) => q.ax > p.x + 20); if (!v) { bot.set({ right: true }); return false; }
    // on saute quand la liane revient vers nous, son bout à quelques pas devant
    const tip = v.ax + Math.sin(v.angle) * v.len;
    if (!(v.av < -0.1 && tip - p.x < 72 && tip - p.x > 8)) { bot.clear(); return false; }
    bot.set({ right: true }); bot.tap('jump'); return false; });
  return [t, ev]; };
P.v10 = () => { bot.place(Z(10).x0 + 3); const [t, ev] = P.vise(90, { dash: true, until: (p) => p.x > Z(11).x0 * 16 + 16 && p.onGround }); return ['z10 vise', t.toFixed(1), ev.map((e) => e.join(':')).join(' '), bot.col(), Z(11).x0]; };
P.v10nodash = () => { const sw = __kage.level.forest.vines.filter((v) => !v.still); const last = sw[sw.length - 1]; bot.place(Math.floor(last.ax / 16) - 8);
  const [t, ev] = P.vise(25, { dash: false, until: (p) => p.onGround && p.x > last.ax + 40 }); return ['z10 sans dash', t.toFixed(1), ev.map((e) => e.join(':')).join(' '), bot.col(), bot.row(), bot.dead()]; };
// Pilote des troncs flottants : avant de sauter, il prédit où il retombera (tronc qui dérive ou rocher).
P.logPos = (g, t) => { let x = g.x, dir = g.dir; const dt = 1 / 120; for (let i = 0; i < t * 120; i++) { x += dir * g.speed * dt; if (x > g.x1) { x = g.x1; dir = -1; } else if (x < g.x0) { x = g.x0; dir = 1; } } return x; };
P.jumpPred = (p, speed, dash) => { const f = __kage.level.forest, l = __kage.level, dt = 1 / 120; let x = p.x, y = p.y, vx = speed, vy = -315, t = 0, dashT = -1;
  for (let i = 0; i < 180; i++) { t += dt;
    if (dash && dashT < 0 && vy > -40) dashT = 0;
    if (dashT >= 0 && dashT < 0.25) { dashT += dt; vy = 0; vx = dashT < 0.17 ? 290 : Math.max(96, vx - 4000 * dt); } else vy = Math.min(420, vy + 980 * dt);
    x += vx * dt; y += vy * dt;
    if (vy <= 0) continue;
    for (const g of f.logs) { if (g === p.ride) continue; const gx = P.logPos(g, t); if (x + 4 > gx + 2 && x - 4 < gx + g.w - 2 && y >= g.y0 && y - vy * dt <= g.y0 + 4) return { kind: 'tronc', g, x: gx + g.w / 2 - x }; }
    const c = Math.floor(x / 16), r = Math.floor(y / 16);
    if (l.at(c, r) === '~') return null;
    if (l.solid(c, r) && !l.solid(c, r - 1) && y - vy * dt <= r * 16 + 1) return { kind: 'sol', x: 0 };
    if (l.solid(Math.floor((x + 6) / 16), Math.floor((y - 4) / 16))) return null;
  }
  return null; };
P.logger = (seconds, o = {}) => { const f = __kage.level.forest, l = __kage.level; const ev = []; let air = null, lastRide = null;
  const t = bot.run(seconds, (p) => {
    if (o.until && o.until(p)) return true;
    if (bot.dead()) { ev.push(['mort', bot.col()]); return true; }
    if (p.hp < (P._hp ?? p.hp)) ev.push(['eau', bot.col()]); P._hp = p.hp;
    if (!p.onGround) { if (air) { bot.set({ right: true, sprint: air.speed > 100, jump: true }); if (air.dash && !air.done && p.vy > -40 && p.airDash) { bot.dash(1); air.done = true; } } return false; }
    if (p.ride !== lastRide) { if (p.ride) ev.push(['tronc', f.logs.indexOf(p.ride)]); lastRide = p.ride; }
    air = null;
    // souffler sur un rocher quand l'énergie baisse (comme un joueur)
    if (!p.ride && (p.energy.value < 0.6 || (P._rest && p.energy.value < 0.97))) { P._rest = true; bot.clear(); return false; }
    P._rest = false;
    const c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
    const wet = (cc) => l.at(cc, r) === '~' || l.at(cc, r + 1) === '~';
    if (!p.ride && !(wet(c + 1) && p.x % 16 > 8)) { bot.set({ right: true, left: false, sprint: false, jump: false }); return false; }
    // essayer : course, sprint, course + dash
    for (const [speed, dash] of [[96, false], [140, false], [96, true], [140, true]]) {
      if (dash && !o.dash) continue;
      const pr = P.jumpPred(p, speed, dash);
      if (pr) { air = { speed, dash, done: false }; ev.push(['saut', bot.col(), speed, dash ? 'dash' : '', pr.kind, Math.round(p.energy.value * 100)]); bot.set({ right: true, sprint: speed > 100 }); bot.tap('jump'); return false; }
    }
    // attendre : au milieu du tronc, ou au bord du rocher
    if (p.ride) { const m = p.ride.x + p.ride.w / 2; bot.set({ right: p.x < m - 3, left: p.x > m + 3, jump: false }); } else bot.clear();
    return false; });
  return [t, ev]; };
P.z6b = () => { bot.place(Z(6).x0 + 3); P._hp = bot.p.hp; const [t, ev] = P.logger(90, { dash: true, until: (p) => p.x > Z(7).x0 * 16 }); return ['z6', t.toFixed(1), ev.map((e) => e.join(':')).join(' '), bot.col(), Z(7).x0, bot.p.hp]; };
P.z6nodash = () => { bot.place(Z(6).x0 + 3); P._hp = P._hp0 = bot.p.hp; const [t, ev] = P.logger(60, { dash: false, until: (p) => p.x > Z(7).x0 * 16 || p.hp < P._hp0 }); return ['z6 sans dash', t.toFixed(1), ev.map((e) => e.join(':')).join(' '), bot.col(), bot.p.hp]; };
// zone 10 : sans dash, aucun lâcher de la dernière liane n'atteint la corniche (tous les angles, avec ou sans bond)
P.z10brut = () => { const sw = __kage.level.forest.vines.filter((v) => !v.still); const last = sw[sw.length - 1]; const res = []; let n = 0;
  for (let a = 0.2; a <= 1.0; a += 0.05) for (const jump of [false, true]) { bot.place(Math.floor(last.ax / 16) - 8); let gone = false; n++;
    P.vise(12, { dash: false, accept: () => false, until: (p) => { if (p.vine === last && !gone && p.vine.angle > a && p.vine.av > 0) { gone = true; bot.clear(); if (jump) bot.tap('jump'); }
      if (gone && !p.vine) bot.set({ right: true }); else if (gone) bot.clear(); return p.onGround && p.x > last.ax + 40; } });
    if (!bot.dead() && bot.p.onGround && bot.p.x > last.ax + 40) res.push(+a.toFixed(2) + (jump ? 'J' : '')); }
  return [n, res]; };
