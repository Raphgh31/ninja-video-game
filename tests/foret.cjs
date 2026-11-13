// Tests de la Forêt (chapitre 2) : un ou deux par zone — le passage est faisable,
// la mécanique voulue est nécessaire (les raccourcis échouent). KAGE est piloté
// pas à pas (__kage.step) par tests/foret_bot.js et tests/foret_pilotes.js.
// Lancement : npm test (après npm run standalone), ou SEUL=« texte » node tests/foret.cjs
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '../dist/kage-test.html') + '#foret';
const results = [];

async function main() {
  const browser = await chromium.launch();
  // l'introduction du lancement est passée dans les tests (window.__KAGE_SKIP_INTRO) ; un test la joue
  const rawNewPage = browser.newPage.bind(browser), rawNewContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await rawNewContext(o); await c.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; }); return c; };
  browser.newPage = async (o) => { const p = await rawNewPage(o); await p.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; }); return p; };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__kage && window.__kage.level.theme === 'foret');
  for (const f of ['foret_bot.js', 'foret_pilotes.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, f), 'utf8') });
  const run = (name, ...args) => page.evaluate(([n, a]) => P[n](...a), [name, args]);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  async function test(name, fn) {
    if (process.env.SEUL && !name.includes(process.env.SEUL)) return;
    try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['ÉCHEC', `${name} — ${e.message}`]); }
  }
  const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

  await test('forêt : 12 zones, une lanterne au début de chaque zone (la 1re : le départ), une arrivée', async () => {
    const r = await ev(() => { const l = __kage.level; return [l.zones.length, l.zones.filter((z, i) => i === 0 || l.checkpoints.some((c) => c.x >= z.px0 - 14 * 16 && c.x < z.px0 + 16 * 16)).length, l.checkpoints.length, !!l.goal]; });
    expect(r[0] === 12 && r[1] === 12 && r[2] >= 17 && r[3], `zones ${r[0]}, zones avec lanterne au début ${r[1]}, lanternes ${r[2]}, arrivée ${r[3]}`);
  });

  await test('forêt : la peinture se prépare vite (moins de 0,6 s au chargement)', async () => {
    const ms = await ev(() => __kage.level.art.buildMs);
    expect(ms < 600, `${ms} ms`);
  });

  await test('zone 1 : on marche jusqu\'à la zone 2 en ramassant des ryō', async () => {
    const r = await run('z1');
    expect(r[1] < 40 && r[5] > 0, JSON.stringify(r));
  });

  await test('zone 2 : les racines géantes se passent en sauts muraux', async () => {
    const r = await run('z2');
    expect(r[2] >= r[3], JSON.stringify(r));
  });

  await test('zone 3 : sans dash on tombe à l\'eau ; avec le dash on traverse sans perdre de vie', async () => {
    const a = await run('z3nodash'), b = await run('z3');
    expect(a[1] === true && b[2].length === 0 && b[3] >= b[4], `${JSON.stringify(a)} ${JSON.stringify(b)}`);
  });

  await test('zone 4 : le pont s\'effondre derrière KAGE — en courant on tombe, en sprintant on passe', async () => {
    const a = await run('z4run'), b = await run('z4');
    expect(a[2] === true && b[2] === false && b[3] >= b[4], `${JSON.stringify(a)} ${JSON.stringify(b)}`);
  });

  await test('zone 4 : retombé, le pont est relevé à la lanterne', async () => {
    await run('z4run');
    await ev(() => { bot.clear(); bot.run(3); });
    const r = await ev(() => { const f = __kage.level.forest; return [f.spans.every((s) => s.state === 'up'), f.collapse.active]; });
    expect(r[0] && !r[1], JSON.stringify(r));
  });

  await test('zone 5 : on grimpe au plateau en sauts muraux (les planches vermoulues cèdent)', async () => {
    const r = await run('z5');
    expect(r[r.length - 1] <= 22, JSON.stringify(r));
  });

  await test('zone 5 : par la niche de la lanterne, les galeries mènent au coffre (en haut) et à un fossé mortel (en bas)', async () => {
    const r = await ev(() => {
      const g = __kage.level.forest.def.galleries, c = g.x0 / 16, out = {};
      // un saut au bord du trou de la salle de croisement : on atteint la marche, puis le coffre
      bot.place(c + 2, 37); bot.clear(); let jumped = false, air = false;
      bot.run(3, (q) => { bot.set({ right: true }); if (!jumped && q.onGround && q.x > (c + 11) * 16 + 10) { bot.tap('jump'); jumped = true; } if (jumped && !q.onGround) air = true; return air && q.onGround; });
      out.marche = [bot.col() - c, bot.row()];
      bot.clear(); bot.runner(8, { until: (q) => q.x > (c + 29) * 16 });
      out.coffre = [bot.col() - c, bot.row(), bot.dead(), !!__kage.level.chestNear(bot.p.x, bot.p.y)];
      // sans sauter : on tombe dans la galerie du bas, on glisse sous le plafond bas, et le fossé tue
      bot.place(c + 9, 37); bot.clear(); let died = false;
      bot.runner(8, { until: (q) => { if (q.state === 'death') died = true; return died; } });
      out.fosse = [died, bot.col() - c];
      return out;
    });
    expect(r.marche[1] === 35 && r.coffre[0] >= 29 && r.coffre[1] === 32 && !r.coffre[2] && r.fosse[0], JSON.stringify(r));
  });

  await test('zone 6 : de tronc en tronc, on traverse le torrent sans perdre de vie', async () => {
    const r = await run('z6b');
    expect(r[3] >= r[4] && !/eau/.test(r[2]), JSON.stringify(r).slice(0, 400));
  });

  await test('zone 6 : depuis le dernier tronc, sans dash, on tombe à l\'eau', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, g = f.logs[f.logs.length - 1], l = __kage.level;
      // KAGE sur le dernier tronc, au plus près de la rive (le tronc ne bouge plus pendant l'essai)
      bot.place(Math.floor(g.x1 / 16) - 2); g.x = g.x1; g.speed = 0;
      const p = bot.p; p.x = g.x + g.w - 6; p.y = g.y; p.vy = 0; __kage.step(2);
      const hp = p.hp;
      // (l'eau est mortelle : la chute s'y termine)
      bot.run(1.5, (pp) => { bot.set({ right: true, sprint: true }); if (pp.onGround && pp.ride) bot.tap('jump'); return pp.state === 'death' || (pp.onGround && !pp.ride && pp.x > g.x + g.w + 8); });
      return [p.state === 'death', Math.floor(p.x / 16)];
    });
    expect(r[0], JSON.stringify(r));
  });

  await test('zone 7 : la canopée se traverse de branche en branche', async () => {
    const r = await run('z7');
    expect(r[2].length === 0 && r[3] >= r[5] - 18, JSON.stringify(r));
  });

  await test('zone 7 : une chute de la canopée jusqu\'au sous-bois est mortelle (plus de 10,5 cases)', async () => {
    const r = await ev(() => {
      const l = __kage.level; let c = l.zones[6].x0 + 30; while (!l.ledge(c, 9)) c++;
      bot.place(c, 9); bot.p.y += 20; bot.p.onGround = false;
      let died = false; bot.run(2.5, () => { if (bot.p.state === 'death') died = true; return died; });
      return [died];
    });
    expect(r[0], JSON.stringify(r));
  });

  await test('zone 7 : depuis le sous-bois, une liane permet de remonter sur une branche (↑ puis un bond)', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, l = __kage.level, z = l.zones[6];
      const v = f.vines.find((q) => q.still && q.ax > z.px0 && q.ax < z.px1);
      bot.place(Math.floor(v.ax / 16) - 2, 22);
      bot.run(1.2, (p) => { bot.set({ right: true }); if (p.onGround && p.x > v.ax - 20) bot.tap('jump'); return p.state === 'vine'; });
      const grabbed = bot.p.state === 'vine';
      bot.clear(); bot.set({ up: true }); bot.run(4, (p) => p.vineR <= 23);
      bot.tap('jump');                       // ↑ toujours tenu : un bond droit vers le haut, à travers la branche
      bot.run(1.5, (p) => { if (p.state !== 'vine') bot.clear(); return p.onGround && p.state !== 'vine'; });
      return [grabbed, bot.row(), bot.dead()];
    });
    expect(r[0] && r[1] < 14 && !r[2], JSON.stringify(r));
  });

  await test('zone 8 : la caverne aux perles se traverse (racines, galerie, mare, clairière, puits de racines)', async () => {
    const r = await run('z8b');
    expect(r[2][r[2].length - 1][2] >= r[3], JSON.stringify(r));
  });

  await test('zone 8 : par l\'arbre creux, on descend de palier en palier, puis une chute de 10 cases (sans dégâts) dans la caverne', async () => {
    const r = await run('pit');
    expect(r[2] === 46 && !r[3], JSON.stringify(r));
  });

  await test('zone 7 : le pont suspendu ploie et oscille quand KAGE s\'y pose ; une planche pourrie lâche si on s\'y attarde, pour de bon', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, B = f.bridges[0];
      for (const q of B.planks) if (q.rotten) { q.state = 'idle'; q.active = true; q.t = 0; q.vy = 0; }   // (le passage de la canopée les a cassées)
      const p = B.planks.find((q) => q.rotten);
      bot.place(Math.floor(B.x0 / 16) - 1, 8); bot.clear();
      const pl = bot.p; pl.x = p.x + 8; pl.y = B.y - 30; pl.vy = 0; pl.onGround = false; pl.fallFrom = pl.y;
      let amp = 0, rode = false;
      bot.run(1.6, (q) => { amp = Math.max(amp, B.amp); if (q.ride === p) rode = true; return p.state === 'fall'; });
      const fell = p.state;
      bot.run(6, () => false);                      // une planche tombée ne revient jamais, même après une réapparition
      return [rode, +amp.toFixed(1), fell, p.state, p.active];
    });
    expect(r[0] && r[1] > 1 && r[2] === 'fall' && r[3] === 'gone' && !r[4], JSON.stringify(r));
  });

  await test('zone 7 : planches espacées — on court sur le pont entier, mais le trou d\'une planche tombée ne se passe qu\'en sautant', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, B = f.bridges[0];
      const fresh = () => { for (const q of B.planks) { q.state = 'idle'; q.active = true; q.t = 0; q.vy = 0; q.rotten = false; } B.amp = 0; B.dipX = null; };
      // KAGE posé sur la planche i, puis sprint vers la droite (jump : sauter juste avant le trou)
      const cross = (i, jumpAt) => {
        const p0 = B.planks[i]; bot.place(Math.floor(B.x0 / 16) - 1, 8); bot.clear();
        const pl = bot.p; pl.x = p0.x + p0.w / 2; pl.y = p0.y - 2; pl.vy = 0; pl.onGround = false; pl.fallFrom = pl.y; __kage.step(4);
        let jumped = false;
        bot.run(3, (q) => { bot.set({ right: true, sprint: true }); if (jumpAt != null && !jumped && q.onGround && q.x > jumpAt) { bot.tap('jump'); jumped = true; } return q.state === 'death' || q.x > B.x1 + 24; });
        return bot.p.state === 'death' ? 'mort' : bot.p.x > B.x1 + 24 ? 'passé' : 'arrêté';
      };
      fresh(); const whole = cross(0);
      fresh(); const hole = B.planks[6]; hole.state = 'gone'; hole.active = false;
      const sprint = cross(2);
      fresh(); hole.state = 'gone'; hole.active = false;
      const jump = cross(2, hole.x - 18);
      fresh();
      return [B.planks.length, B.planks[1].x - (B.planks[0].x + B.planks[0].w), whole, sprint, jump];
    });
    expect(r[1] <= 6 && r[2] === 'passé' && r[3] === 'mort' && r[4] === 'passé', JSON.stringify(r));
  });

  await test('zone 7 : au sol, de l\'eau entre les îlots des lianes : on ne traverse pas la canopée par en bas', async () => {
    const r = await ev(() => {
      const l = __kage.level, z = l.zones[6]; let water = 0;
      for (let c = z.x0 + 8; c < z.x1 - 10; c++) if (l.at(c, 22) === '~') water++;
      bot.place(z.x0 + 2, 22); const hp = bot.p.hp;
      bot.runner(12, { sprintGap: 5, dashGap: 6, until: (p) => p.state === 'death' || p.hp < hp || p.x > (z.x0 + 60) * 16 });
      return [water, bot.p.state === 'death' || bot.p.hp < hp, bot.col(), z.x0 + 60];
    });
    expect(r[0] > 20 && r[1] && r[2] < r[3], JSON.stringify(r));
  });

  await test('zone 7 : sous le pont, 14 cases d\'eau : même sprint + saut + dash au meilleur moment n\'atteignent pas l\'autre rive', async () => {
    const r = await ev(() => {
      const l = __kage.level, z = l.zones[6];
      let edge = z.x0 + 8; while (l.at(edge + 1, 22) !== '~') edge++;          // la dernière case de terre avant l'eau
      let far = edge + 1; while (l.at(far, 22) === '~') far++;                   // la première case de l'autre rive
      let best = 0;
      for (let d = 0; d <= 0.66; d += 0.03) {
        bot.place(z.x0 + 1, 22); bot.clear(); bot.set({ right: true, sprint: true });
        let t = -1, dashed = false, x = 0;
        bot.run(6, (q) => {
          if (t < 0 && q.x >= edge * 16 + 12) { t = 0; bot.tap('jump'); }
          if (t >= 0) { t += 1 / 120; if (!dashed && t >= d) { bot.dash(1); dashed = true; } x = Math.max(x, q.x); }
          return t > 0.1 && (q.onGround || q.state === 'death' || q.y > 23 * 16);
        });
        best = Math.max(best, bot.p.onGround && bot.p.state !== 'death' ? bot.p.x : 0);
      }
      return [far - edge - 1, Math.floor(best / 16), far];
    });
    expect(r[0] >= 14 && r[1] < r[2], JSON.stringify(r));
  });

  await test('zone 7 : la grande branche de l\'arbre du nid rompt sous KAGE presque aussitôt, et revient à la réapparition', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, q = f.snaps[0];
      bot.place(Math.floor(q.x / 16) + 1, Math.round(q.y0 / 16)); bot.clear();
      let broke = -1, t = 0;
      bot.run(1.5, () => { t += 1 / 120; if (broke < 0 && !q.active) broke = t; return false; });
      const fell = bot.p.y > q.y0 + 40 || bot.p.state === 'death';
      bot.run(9, () => q.state === 'idle');          // KAGE tombe, meurt, réapparaît
      return [+broke.toFixed(2), fell, q.state, q.active];
    });
    expect(r[0] > 0.2 && r[0] < 0.6 && r[1] && r[2] === 'idle' && r[3], JSON.stringify(r));
  });

  await test('détours : la cabane du guetteur, l\'arbre aux cavités, l\'arche de racines, le belvédère — on y monte, le coffre s\'ouvre, on redescend sans dégâts', async () => {
    const r = await ev(() => {
      const L = __kage.level, out = {};
      const chest = (id) => {
        const ch = L.chests.find((c) => c.id === id);
        bot.run(3, (q) => { bot.set({ right: q.x < ch.x - 6, left: q.x > ch.x + 6 }); return !!L.chestNear(q.x, q.y) && Math.abs(q.x - ch.x) < 8; }); bot.clear();
        bot.tap('up'); bot.run(2.5); bot.clear(); bot.run(0.2);
        return ch.open;
      };
      const down = (dir, row) => { bot.run(8, (q) => { bot.set({ right: dir > 0, left: dir < 0, sprint: true }); return bot.dead() || (q.onGround && Math.round(q.y / 16) >= row); }); bot.clear(); return !bot.dead() && bot.row() === row; };
      const id = (k) => L.props.find((p) => p.type === 'chest' && p.id === k);
      // la cabane : l'échelle de corde, la plateforme à 9 cases, le coffre dans la cabane ; on saute de la plateforme
      let c = id('guetteur'); bot.place(c.x - 9, 50); bot.boughs(10, c.y);
      out.guetteur = [bot.row() === c.y, chest('guetteur'), down(1, 50)];
      // l'arbre aux cavités : sept branches le long du tronc, le coffre dans la plus haute cavité ; on redescend en courant
      c = id('cavites'); bot.place(c.x - 5, 50); bot.boughs(20, c.y);
      out.cavites = [bot.row() === c.y, chest('cavites'), down(-1, 50)];
      // l'arche : deux racines en marche, un saut sur la motte ; on en saute de l'autre côté
      c = id('arche'); bot.place(c.x - 7, 50); bot.boughs(6, c.y + 3);
      bot.tap('jump'); bot.run(1, (q, t) => { bot.set({ right: q.vy > -150 }); return t > 0.1 && q.onGround; }); bot.clear();
      out.arche = [bot.row() === c.y, chest('arche'), down(1, 50)];
      // le belvédère : on monte d'un côté du cèdre, on redescend de l'autre
      c = id('belvedere'); bot.place(c.x - 4, 62); bot.boughs(15, c.y);
      out.belvedere = [bot.row() === c.y, chest('belvedere'), down(1, 62)];
      return out;
    });
    expect(Object.values(r).every((v) => v.every(Boolean)), JSON.stringify(r));
  });

  await test('coffres : leurs ryō tombent sur un sol, jamais dans un mur ni dans le vide', async () => {
    const r = await ev(() => {
      const l = __kage.level, bad = [];
      for (const ch of l.chests) {
        const row = Math.round(ch.y / 16);
        for (const c of l.openChest(ch, true)) {
          const tx = Math.floor(c.x / 16);
          if (l.solid(tx, Math.floor(c.y / 16)) || !(l.solid(tx, row) || l.ledge(tx, row))) bad.push([ch.id, tx, Math.floor(c.y / 16)]);
        }
      }
      return [l.chests.length, bad];
    });
    expect(r[0] >= 4 && r[1].length === 0, JSON.stringify(r));
  });

  await test('zone 9 : le bloc ficelé ferme le tunnel, même en glissade, tant que la corde n\'est pas coincée', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, R = f.rope; bot.place(R.door - 4, R.ground / 16);
      bot.run(2, () => { bot.set({ right: true }); });
      const walk = bot.col();
      bot.place(R.door - 4, R.ground / 16); bot.run(0.4, () => { bot.set({ right: true }); }); bot.tap('down'); bot.run(1.2, () => { bot.set({ right: true }); });
      return [walk, bot.col(), R.door, f.statueOpen];
    });
    expect(r[0] < r[2] && r[1] < r[2] && !r[3], JSON.stringify(r));
  });

  await test('zone 9 : la liane de la grande branche ne s\'attrape que depuis la tête de la statue ; elle mène à la branche', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, st = f.statue, R = f.rope, G = st.ground / 16;
      const vN = f.vines.find((v) => Math.abs(v.ax - st.cx) < 200 && Math.abs(v.ay - R.branchY) < 8), v0 = f.vines.filter((v) => Math.abs(v.ax - st.cx) < 96).sort((a, b) => a.ax - b.ax)[0];
      const climbTo = (v, approach) => {
        bot.run(2, (p) => { bot.set({ right: approach > 0 ? p.x < v.ax - 10 : false, left: approach < 0 ? p.x > v.ax + 10 : false, up: true }); if (p.onGround && Math.abs(p.x - v.ax) < 14) bot.tap('jump'); return p.state === 'vine'; });
        const got = bot.p.vine === v; bot.clear(); bot.set({ up: true }); bot.run(5, (p) => p.vineR <= 23);
        bot.tap('jump'); bot.run(1.5, (p) => { if (p.state !== 'vine') bot.clear(); return p.onGround && p.state !== 'vine'; });
        return got;
      };
      // depuis le sol, sous la liane de la branche : hors de portée
      bot.place(Math.floor(vN.ax / 16) - 1, G); bot.run(1.5, (p) => { bot.set({ right: p.x < vN.ax - 10, up: true }); if (p.onGround && Math.abs(p.x - vN.ax) < 14) bot.tap('jump'); return p.state === 'vine'; });
      const fromGround = bot.p.vine === vN; bot.clear(); bot.run(1);
      // la grande mèche de gauche (depuis le sol), puis, d'un saut, la liane de l'œil gauche, jusqu'en haut : la couronne
      bot.place(Math.floor(v0.ax / 16) - 2, G);
      bot.run(2, (p) => { bot.set({ right: p.x < v0.ax - 10, up: true }); if (p.onGround && Math.abs(p.x - v0.ax) < 14) bot.tap('jump'); return p.state === 'vine'; });
      const lock = bot.p.vine === v0; bot.clear(); bot.set({ up: true }); bot.run(6, (p) => st.ground - p.y >= 96);
      const v1 = f.vines.filter((v) => Math.abs(v.ax - st.cx) < 96).sort((a, b) => a.ax - b.ax)[1];
      bot.clear(); bot.set({ right: true }); bot.tap('jump'); bot.run(0.05); bot.run(1.2, (p) => p.state === 'vine' || p.onGround);
      bot.clear(); bot.set({ up: true }); bot.run(5, (p) => p.vineR <= 23);
      bot.tap('jump'); bot.run(1.5, (p) => { if (p.state !== 'vine') bot.clear(); return p.onGround && p.state !== 'vine'; });
      const crown = bot.row(); void v1;
      // de la couronne : la main sous la liane de la branche, un saut ↑ tenu l'attrape ; on grimpe ; un bond sur la branche
      bot.run(3, (p) => { const h = p.x + p.facing * 6 - vN.ax; bot.set({ right: h < -3, left: h > 3, up: true }); return Math.abs(h) <= 3 && p.onGround; });
      bot.set({ left: false, right: false, up: true }); bot.tap('jump'); bot.run(1.2, (p) => p.state === 'vine');
      const got = bot.p.vine === vN; bot.clear(); bot.set({ up: true }); bot.run(5, (p) => p.vineR <= 23);
      bot.tap('jump'); bot.run(1.5, (p) => { if (p.state !== 'vine') bot.clear(); return p.onGround && p.state !== 'vine'; });
      return [fromGround, lock, crown, G - 13, got, bot.row(), Math.round(R.branchY / 16), bot.dead()];
    });
    expect(!r[0] && r[1] && r[2] === r[3] && r[4] && r[5] === r[6] && !r[7], JSON.stringify(r));
  });

  await test('zone 9 : la corde — lâchée trop tôt, le bloc retombe ; tirée au-delà du rameau, elle s\'y coince ; le bloc levé ne se passe qu\'en glissade', async () => {
    const r = await ev(() => {
      const f = __kage.level.forest, R = f.rope, pl = bot.p;
      const onBranch = () => { bot.place(Math.floor(R.end / 16), Math.round(R.branchY / 16)); pl.x = R.end - 30; pl.y = R.branchY; pl.vy = 0; __kage.step(4); bot.run(1, (p) => { bot.set({ right: p.x < R.end - 8 }); return p.x >= R.end - 8; }); bot.clear(); };
      const haul = (s) => { bot.tap('up'); bot.run(0.1); const held = pl.state === 'rope_pull'; bot.run(s, () => { bot.set({ left: true }); }); const pull = R.pull, en = pl.energy.value; bot.clear(); bot.tap('jump'); bot.run(3); return [held, Math.round(pull), en]; };
      onBranch(); const early = haul(1); const back = [R.state, Math.round(R.lift)];
      // tirer coûte cher : à bout de souffle, KAGE tient la corde sans pouvoir tirer (on la rend avant de lâcher)
      onBranch(); bot.tap('up'); bot.run(0.1); bot.run(4.6, () => { bot.set({ left: true }); });
      const tired = [pl.state, pl.energy.exhausted, Math.round(R.pull), R.max]; bot.run(0.6, () => { bot.set({ left: true }); }); tired.push(Math.round(R.pull) - tired[2]);
      bot.run(2, () => { bot.set({ left: true }); }); tired.push(Math.round(R.pull) - tired[2]); bot.clear(); bot.run(3, () => { bot.set({ right: true }); }); bot.clear(); bot.tap('jump'); bot.run(4); tired.push(R.state);
      onBranch(); const e0 = pl.energy.value; const far = haul(3.6); far[2] = +(e0 - far[2]).toFixed(2); const caught = [R.state, Math.round(R.lift), __kage.level.solid(R.door, R.ground / 16 - 1), __kage.level.solid(R.door, R.ground / 16 - 2)];
      // en bas : debout, on bute ; en glissade, on passe
      bot.place(R.door - 4, R.ground / 16); bot.run(1.5, () => { bot.set({ right: true }); }); const walk = bot.col();
      bot.place(R.door - 4, R.ground / 16); bot.run(0.4, () => { bot.set({ right: true }); }); bot.tap('down'); bot.run(1.5, () => { bot.set({ right: true }); }); bot.clear(); bot.run(0.5);
      return { early, back, tired, far, caught, walk, slide: bot.col(), door: R.door, saved: __kage.save.statue };
    });
    expect(r.tired[0] === 'rope_pull' && r.tired[1] && r.tired[2] < r.tired[3] && r.tired[4] === 0 && r.tired[5] > 0 && r.tired[6] === 'rest' && r.far[2] > 0.5 && r.early[0] && r.back[0] === 'rest' && r.back[1] === 0 && r.far[0] && r.caught[0] === 'caught' && r.caught[1] === 16 && !r.caught[2] && r.caught[3]
      && r.walk < r.door && r.slide > r.door && r.saved === true, JSON.stringify(r));
  });

  await test('zone 10 : de liane en liane ; au bout, lâcher au sommet de la courbe et dasher vers la corniche', async () => {
    const r = await ev(() => { bot.place(Z(10).x0 + 3); const v0 = __kage.level.forest.vines.filter((q) => !q.still)[0]; const tr = []; let n = 0;
      const [t, ev] = P.vise(90, { dash: true, finalAngle: 0.76, until: (p) => { if (n++ % 8 === 0 && tr.length < 40) tr.push([Math.round(p.x), Math.round(p.y), p.state, +v0.angle.toFixed(2), +v0.av.toFixed(2), __kage.input.isHeld('right') ? 'R' : '-', __kage.input.isHeld('left') ? 'L' : '-'].join(',')); return p.x > Z(11).x0 * 16 + 16 && p.onGround; } }); window.__tr = tr; return [t, ev.filter((e) => e[0] === "liane").length, bot.col(), Z(11).x0, bot.dead(), JSON.stringify(ev).slice(0, 200), Math.round(bot.p.energy.value * 100), bot.p.hp]; });
    if (r[4]) console.log((await ev(() => window.__tr)).join(' | '));
    expect(!r[4] && r[1] >= 5 && r[2] >= r[3], JSON.stringify(r));
  });

  await test('zone 10 : sans dash, la corniche finale est hors d\'atteinte (32 lâchers essayés, avec ou sans bond)', async () => {
    const r = await run('z10brut');
    expect(r[0] >= 30 && r[1].length === 0, JSON.stringify(r));
  });

  await test('zone 11 : immobile, l\'éboulis emporte KAGE', async () => {
    const r = await run('z11idle');
    expect(r[2] === true, JSON.stringify(r));
  });

  await test('zone 11 : en courant et en sprintant, on dévale la pente devant l\'éboulis', async () => {
    const r = await run('z11a');
    expect(r[2] === false && r[3] >= r[4], JSON.stringify(r));
  });

  await test('zone 12 : la sortie termine le chapitre', async () => {
    const r = await run('z12');
    const end = await ev(() => [!document.querySelector('.win').hidden, document.querySelector('.win__next').textContent]);
    expect(r[2] === true && end[0] && /suite/.test(end[1]), `${JSON.stringify(r)} ${end.join(' / ')}`);
  });

  await test('forêt : aucune erreur dans la console', async () => {
    expect(errors.length === 0, errors.join(' | '));
  });

  await browser.close();
  let failed = 0;
  for (const [status, name] of results) {
    if (status !== 'ok') failed++;
    console.log(`${status === 'ok' ? '  ok   ' : '  ÉCHEC'}  ${name}`);
  }
  console.log(`\n${results.length - failed}/${results.length} tests de la Forêt réussis`);
  process.exit(failed ? 1 : 0);
}
main();
