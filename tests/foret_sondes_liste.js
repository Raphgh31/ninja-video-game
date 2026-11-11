const Z = (i) => __kage.level.zones[i - 1];
// zone 3 : sans dash on tombe à l'eau ; avec dash on traverse toute la zone
P.z3nodash = () => { bot.place(Z(3).x0 + 2); const hp0 = bot.p.hp; bot.runner(6, { until: (p) => p.hp < hp0 || p.x > (Z(3).x0 + 16) * 16 }); return ['z3 sans dash', bot.p.hp < hp0, bot.col()]; };
P.z3 = () => { bot.place(Z(3).x0 + 2); const hp0 = bot.p.hp; const lost = []; let hp = hp0; const t = bot.runner(60, { dashGap: 5, rest: true, until: (p) => { if (p.hp < hp) { lost.push(bot.col()); hp = p.hp; } return p.x > Z(4).x0 * 16 + 30; } }); return ['z3', t, lost, bot.col(), Z(4).x0]; };
// zone 4 : en courant seulement on meurt ; avec sprint et dash on passe
P.z4run = () => { const c = __kage.level.forest.collapse; bot.place(Math.floor(c.respawnX / 16)); const t = bot.runner(20, { dashGap: 6, until: (p) => p.x > Z(5).x0 * 16 }); return ['z4 course seule', t, bot.dead(), bot.col(), Z(5).x0]; };
P.z4 = () => { const c = __kage.level.forest.collapse; bot.place(Math.floor(c.respawnX / 16)); const x1 = c.trigger + 15 * 16; const t = bot.runner(20, { dashGap: 6, sprint: (p) => p.x > x1, until: (p) => p.x > Z(5).x0 * 16 }); return ['z4', t, bot.dead(), bot.col(), Z(5).x0, Math.round(bot.p.energy.value * 100)]; };
// zone 5 : la montée
P.z5 = () => { bot.place(Z(5).x0 + 2); bot.runner(5, { until: (p) => p.onGround && __kage.level.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 5) && p.vx === 0 }); const a = [bot.col(), bot.row()];
  const log = []; let t = 0;
  for (let i = 0; i < 8 && bot.row() > 22; i++) { t += bot.wallClimb(12, 22, 1); log.push([bot.col(), bot.row(), bot.p.state, bot.p.ride ? 'planche' : '']); if (bot.p.onGround) { bot.clear(); bot.run(0.5); } }
  bot.runner(2); return ['z5', a, t, log, bot.col(), bot.row()]; };
// zone 6 : de tronc en tronc
P.z6 = () => { bot.place(Z(6).x0 + 3); const f = __kage.level.forest, l = __kage.level; const hp0 = bot.p.hp; let hp = hp0; const lost = []; let tgt = null; let waited = 0;
  const groundAhead = (p) => { const r = Math.round(p.y / 16); for (let c = Math.floor(p.x / 16) + 1; c < Math.floor(p.x / 16) + 9; c++) if (l.solid(c, r) || l.solid(c, r - 1) || l.solid(c, r + 1)) { if (!l.solid(c, 21) && !l.solid(c,22)) continue; return { x: c * 16, w: 48, ground: true }; } return null; };
  const t = bot.run(120, (p) => {
    if (p.hp < hp) { lost.push(bot.col()); hp = p.hp; }
    if (p.x > Z(7).x0 * 16 || bot.dead()) return true;
    if (!p.onGround) { bot.set({ jump: true }); if (tgt) { const cx = tgt.x + Math.min(tgt.w, 32) / 2; bot.set({ right: p.x < cx - 2, left: p.x > cx + 8 }); if (tgt.far && p.vy > -30 && p.airDash && cx - p.x > 40) bot.dash(1); } return false; }
    const c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
    const onLog = p.ride;
    const nextCol = c + 1;
    const waterAhead = l.at(nextCol, 22) === '~' && !l.solid(nextCol, 21);
    if (!onLog && !(waterAhead && p.x % 16 > 8)) { bot.set({ right: true, left: false, jump: false }); tgt = null; return false; }
    // au bord de l'eau, ou sur un tronc : viser le prochain appui
    const logs = f.logs.filter((g) => g !== onLog && g.x + g.w / 2 > p.x + 6).sort((a, b) => a.x - b.x);
    const g = groundAhead(p);
    let best = logs[0]; if (g && (!best || g.x <= best.x + 8)) best = g;
    if (!best) { bot.set({ right: true }); return false; }
    const d = best.x + Math.min(best.w, 32) / 2 - p.x;
    const urgent = onLog && onLog.sink > 6;
    if (d < 56 || (urgent && d < 110) || (waited > 6 && d < 104)) { tgt = { ...best, far: d >= 56 }; bot.set({ right: true, left: false }); bot.tap('jump'); waited = 0; }
    else { bot.set({ right: false, left: false }); if (onLog) { const m = onLog.x + onLog.w / 2; bot.set({ right: p.x < m - 3, left: p.x > m + 3 }); } waited += 1 / 120; }
    return false; });
  return ['z6', t, lost, bot.col(), Z(7).x0, bot.dead()]; };
// zone 7 : la canopée, depuis la première branche
P.z7 = () => { const l = __kage.level; let c = Z(7).x0 + 8; while (!l.ledge(c, 13)) c++; bot.place(c + 1, 13); const falls = []; let fell = false;
  const t = bot.runner(60, { sprintGap: 5, dashGap: 6, aim: true, rest: true, until: (p) => { if (p.y > 20 * 16 && !fell) { fell = true; falls.push(bot.col()); } return fell || p.x > (Z(8).x0 - 14) * 16; } });
  return ['z7', t, falls, bot.col(), bot.row(), Z(8).x0]; };
P.z7d = () => { const l = __kage.level; let c = Z(7).x0 + 8; while (!l.ledge(c, 13)) c++; bot.place(c + 1, 13); const log = []; let last = '';
  bot.runner(25, { sprintGap: 5, dashGap: 6, aim: true, rest: true, until: (p) => { const s = [p.state, bot.col(), bot.row(), Math.round(p.vx), bot._resting ? 'R' : '', bot._gap].join(); if (s !== last) { log.push(s + ',' + Math.round(p.energy.value * 100)); last = s; } return p.y > 20 * 16; } });
  const rows = []; for (let r = 9; r < 16; r++) { let s = ''; for (let c2 = 455; c2 < 475; c2++) s += l.at(c2, r); rows.push(s); }
  return [log.slice(-22), rows]; };
// fin de la canopée : on entre dans l'arbre creux et on tombe sous terre ; puis tout le souterrain
P.z8 = () => { const l = __kage.level; bot.place(Z(8).x0 - 12, 14); const log = [];
  bot.runner(8, { until: (p) => p.y > 34 * 16 && p.onGround }); log.push(['arrivée', bot.col(), bot.row(), bot.p.hp]);
  for (let i = 0; i < 6; i++) {
    const t = bot.runner(40, { dashGap: 5, rest: true, until: (p) => p.x > Z(9).x0 * 16 + 20 || bot.dead() || (p.onGround && p.vx === 0 && p.state === 'idle' && !bot._resting && l.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 4) && bot._stuck++ > 40) || (bot._stuck = l.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 1) ? bot._stuck || 0 : 0, false) });
    log.push(['→', t.toFixed(1), bot.col(), bot.row(), bot.p.state]);
    if (bot.p.x > Z(9).x0 * 16 || bot.dead()) break;
    bot.wallClimb(8, bot.row() - 7, 1); log.push(['grimpe', bot.col(), bot.row()]);
  }
  return ['z8', log, Z(9).x0, bot.p.hp]; };
P.z8b = () => { const l = __kage.level; const log = [];
  let sc = Z(8).x0; const open = (c) => { for (let r = 26; r < 36; r++) if (l.solid(c, r)) return false; return true; }; while (!open(sc)) sc++;
  bot.place(Z(8).x0 + 1, 36);
  let t = bot.runner(40, { dashGap: 5, rest: true, until: (p) => p.x > (sc + 1) * 16 + 4 || bot.dead() }); log.push(['au puits', t.toFixed(1), bot.col(), bot.row(), bot.p.hp]);
  t = bot.wallClimb(10, 29, 1); bot.run(0.6, () => { bot.set({ right: true }); }); log.push(['grimpe', t.toFixed(1), bot.col(), bot.row()]);
  t = bot.runner(40, { dashGap: 5, rest: true, until: (p) => p.x > Z(9).x0 * 16 + 20 || bot.dead() }); log.push(['sortie', t.toFixed(1), bot.col(), bot.row(), bot.p.hp]);
  return ['z8b', sc, log, Z(9).x0, __kage.save.ryo]; };
P.z8c = () => { bot.place(585, 29); const log = []; let last = '';
  bot.runner(6, { until: (p) => { const s = [p.state, bot.col(), bot.row(), Math.round(p.vx), p.onGround ? 'G' : ''].join(); if (s !== last) { log.push(s); last = s; } return false; } }); return log.slice(0, 40); };
P.z9 = () => { const f = __kage.level.forest, st = f.statue, l = __kage.level; const log = [];
  bot.place(Math.floor((st.cx - 64 - 40) / 16));
  bot.run(4, (p) => { bot.set({ right: p.x < st.cx - 64 - 8 }); return p.x >= st.cx - 64 - 8; });
  bot.clear(); bot.set({ up: true, right: true }); bot.tap('jump');
  bot.run(1.5, (p) => p.state === 'vine'); log.push(['liane 0', bot.p.state, Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y)]);
  bot.clear(); bot.set({ up: true });
  bot.run(6, (p) => st.ground - p.y >= 96); log.push(['monté', Math.round(st.ground - bot.p.y), bot.p.state]);
  const hop = (name) => { bot.clear(); bot.set({ right: true }); bot.tap('jump'); bot.run(0.05); bot.run(1.2, (p) => p.state === 'vine' || p.onGround); log.push([name, bot.p.state, Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y), f.vines.indexOf(bot.p.vine)]); };
  const level = (h) => { bot.clear(); bot.run(3, (p) => { const d = st.ground - p.y - h; bot.set({ up: d < -2, down: d > 2 }); return Math.abs(d) <= 2; }); bot.clear(); bot.set({ up: true }); bot.run(0.05); };
  hop('liane 1'); level(96); log.push(['œil gauche', st.lit[0]]);
  bot.clear(); bot.set({ up: true }); bot.run(0.3);
  hop('liane 2'); level(100); hop('liane 3'); level(96); log.push(['œil droit', st.lit[1], Math.round(bot.p.x - st.cx), Math.round(st.ground - bot.p.y)]);
  bot.clear(); bot.run(7.5); log.push(['mâchoire', +st.jaw.toFixed(2), bot.p.state, bot.col(), bot.row(), f.statueOpen]);
  const t = bot.runner(12, { until: (p) => p.x > Z(10).x0 * 16 + 30 }); log.push(['sortie', t.toFixed(1), bot.col(), Z(10).x0]);
  return ['z9', log]; };
// zone 10 : de liane en liane ; dash au sommet de la courbe sur la dernière
P.swinger = (seconds, o = {}) => { const f = __kage.level.forest, l = __kage.level; let rel = 0, dashed = false, lastV = null; const ev = [];
  const sw = f.vines.filter((v) => !v.still); const lastVine = sw[sw.length - 1];
  const t = bot.run(seconds, (p) => {
    if (o.until && o.until(p)) return true;
    if (bot.dead()) { ev.push(['mort', bot.col(), bot.row()]); return true; }
    if (p.state === 'vine') { const v = p.vine; if (v !== lastV) { ev.push(['liane', f.vines.indexOf(v), bot.col()]); lastV = v; dashed = false; }
      // un appui tout proche devant : on lâche tôt, en douceur ; sinon on prend de l'élan
      let near = false; const hc = Math.floor(p.x / 16); for (let c2 = Math.floor(v.ax / 16) + 5; c2 <= Math.floor(v.ax / 16) + 9 && !near; c2++) for (let r2 = 30; r2 <= 37; r2++) if (l.solid(c2, r2) && !l.solid(c2, r2 - 1)) { near = v !== lastVine; break; }
      const go = near ? (v.angle > 0.3 && v.av < 0.3 && v.av > -0.15) : (v.angle > (o.angle ?? 0.4) && v.av > 0.15);
      if (go) { bot.clear(); rel = 10; } else bot.set({ right: v.av >= 0, left: v.av < 0, up: false });
      return false; }
    if (rel > 0) { rel--; bot.clear(); return false; }
    if (!p.onGround) { bot.set({ right: true, left: false });
      if (o.dash && lastV === lastVine && !dashed && p.vy > -60 && p.airDash) { bot.dash(1); dashed = true; ev.push(['dash', bot.col(), bot.row()]); }
      return false; }
    const c = Math.floor(p.x / 16), r = Math.round(p.y / 16);
    const atEdge = !bot.groundAt(c + 1, r, 2) && p.x % 16 > 9;
    if (atEdge) { // on attend que la prochaine liane revienne vers le bord
      const v = sw.find((q) => q.ax > p.x + 20); const e = v ? f.vinePoint(v) : null;
      if (v && !(v.angle < -0.2 && Math.abs(v.av) < 0.75)) { bot.clear(); return false; }
      bot.set({ right: true, left: false }); bot.tap('jump');
    } else { bot.set({ right: true, left: false, jump: false }); }
    return false; });
  return [t, ev]; };
P.z10 = () => { bot.place(Z(10).x0 + 3); const [t, ev] = P.swinger(90, { dash: true, until: (p) => p.x > Z(11).x0 * 16 + 16 && p.onGround }); return ['z10', t.toFixed(1), ev, bot.col(), bot.row(), Z(11).x0]; };
P.z10nodash = () => { const f = __kage.level.forest; const sw = f.vines.filter((v) => !v.still); const last = sw[sw.length - 1]; bot.place(Math.floor(last.ax / 16) - 8);
  const [t, ev] = P.swinger(20, { dash: false, until: (p) => p.onGround && p.x > last.ax + 40 }); return ['z10 sans dash', t.toFixed(1), ev, bot.col(), bot.row(), bot.dead()]; };
// zone 11 : l'éboulis
P.z11idle = () => { const S = __kage.level.forest.slide; bot.place(Math.floor(S.trigger / 16) + 2); bot.run(0.3, () => { bot.set({ right: true }); }); bot.clear(); const t = bot.run(12, () => bot.dead()); return ['z11 immobile', t.toFixed(1), bot.dead()]; };
P.z11 = (sprint) => { const S = __kage.level.forest.slide; bot.place(Z(11).x0 + 3); let min = 1e9;
  const t = bot.runner(60, { dashGap: 6, sprintGap: 5, aim: false, sprint: (p) => sprint && S.active && p.x - S.x < 110, until: (p) => { if (S.active) min = Math.min(min, p.x - S.x); return p.x > Z(12).x0 * 16 + 30; } });
  return ['z11' + (sprint ? '' : ' sans sprint'), t.toFixed(1), bot.dead(), bot.col(), Z(12).x0, Math.round(min), Math.round(bot.p.energy.value * 100)]; };
P.z11a = () => P.z11(true); P.z11b = () => P.z11(false);
P.z12 = () => { bot.place(Z(12).x0 + 2); const t = bot.runner(40, { until: () => __kage.run.won }); return ['z12', t.toFixed(1), __kage.run.won, bot.col()]; };
P.z11t = () => { const S = __kage.level.forest.slide; bot.place(Z(11).x0 + 3); const log = []; let lc = 0; let last = '';
  bot.runner(40, { dashGap: 6, sprintGap: 5, sprint: (p) => S.active && p.x - S.x < 110, until: (p, t) => { const c = bot.col(); if (c >= lc + 6) { lc = c; log.push([c, bot.row(), Math.round(p.x - S.x), p.state, Math.round(p.energy.value * 100)]); } return p.x > Z(12).x0 * 16 + 30; } });
  return [log, bot.col(), bot.row(), bot.p.state]; };
P.z11u = () => { bot.place(824, 44); const log = []; let last = '';
  bot.runner(6, { dashGap: 6, sprintGap: 5, until: (p) => { const s = [p.state, bot.col(), bot.row(), Math.round(p.vx), Math.round(p.vy), bot._gap].join(); if (s !== last) { log.push(s); last = s; } return bot.dead(); } }); return [log.slice(-14), bot.p.hp, __kage.level.forest.slide.active, Math.round(__kage.level.forest.slide.x / 16)]; };
P.z11v = () => { const S = __kage.level.forest.slide; bot.place(Z(11).x0 + 3); const log = []; let last = '';
  bot.runner(40, { dashGap: 6, sprintGap: 5, sprint: (p) => S.active && p.x - S.x < 110, until: (p) => { if (bot.col() >= 829) { const s = [p.state, bot.col(), bot.row(), Math.round(p.vx), Math.round(p.x - S.x), bot._gap, p.hp].join(); if (s !== last) { log.push(s); last = s; } } return false; } });
  return log.filter((s, i) => i % 4 === 0).slice(0, 30); };
P.z11w = () => { const S = __kage.level.forest.slide; bot.place(Z(11).x0 + 3); const log = []; let last = '';
  bot.runner(40, { dashGap: 6, sprintGap: 5, until: (p) => { if (bot.col() >= 822) { const s = [p.state, bot.col(), bot.row(), bot._gap].join(); if (s !== last) { log.push(s); last = s; } } return bot.dead(); } });
  return log.slice(0, 26); };
P.z10t = () => { bot.place(Z(10).x0 + 3); const f = __kage.level.forest; const log = []; let last = '';
  P.swinger(30, { until: (p) => { const v = f.vines[6]; const s = [p.state, bot.col(), bot.row(), v.angle.toFixed(1), p.vine ? f.vines.indexOf(p.vine) : ''].join(); if (bot.col() >= 694 && s !== last) { log.push(s); last = s; } return false; } }); return log.filter((s, i) => i % 2 === 0).slice(0, 40); };
P.z10u = () => { bot.place(Z(10).x0 + 3); const f = __kage.level.forest; const v7 = f.vines[7]; let best = [1e9]; const log = [];
  P.swinger(30, { until: (p) => { if (p.lastVine === f.vines[6] && !p.vine) { const hx = p.x + p.facing * 6, hy = p.y - 19; const dx = hx - v7.ax, dy = hy - v7.ay; const r = Math.hypot(dx, dy); const q = f.vinePoint(v7, Math.min(r, v7.len)); const d = Math.hypot(hx - q.x, hy - q.y);
      if (d < best[0]) best = [Math.round(d), Math.round(r), v7.len, bot.col(), bot.row(), v7.angle.toFixed(2), p.state, Math.round(p.vx), Math.round(p.vy), __kage.input.isHeld('right'), +p.vineCd.toFixed(2)]; } return false; } });
  return best; };
