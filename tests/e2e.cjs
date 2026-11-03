// Tests de bout en bout : le jeu complet (dist/kage-standalone.html) dans un
// vrai navigateur. Lancement : npm test
const path = require('node:path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '../dist/kage-standalone.html');
const BASE = PAGE + '#niveau-1';   // le niveau d'essai d'origine
const FILE = PAGE + '#terrain';
// sans ancre : le chapitre 1, le Potager (écran titre, sauvegarde)
const results = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const k = page.keyboard;
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const S = () => ev(() => {
    const g = window.__kage, p = g.player;
    return { state: p.state, x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, energy: p.energy.value,
      facing: p.facing, tate: g.tate.state, tateHp: g.tate.hp, stock: g.shurikens.stock,
      stuck: g.shurikens.stuck.length, flying: g.shurikens.flying.length };
  });
  // remet la scène à zéro : KAGE en (x, y), TATE au loin, énergie et vie pleines
  const reset = async (x = 300, y = 192, tateX = 1700) => {
    await ev(([x, y, tx]) => {
      const g = window.__kage;
      g.player.respawn(true); g.player.x = x; g.player.y = y;
      g.tate.reset(); g.tate.x = tx; g.tate.cooldown = 99;
      for (const w of g.waras) { w.reset(); w.x = w.home + 4000; w.rest = 99; }
      g.shurikens.reset();
    }, [x, y, tateX]);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Space']) await k.up(key);
    await wait(120);
  };
  async function test(name, fn) {
    try {
      await fn();
      results.push(['ok', name]);
    } catch (e) {
      results.push(['ÉCHEC', `${name} — ${e.message}`]);
    }
  }
  const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

  await page.goto(FILE);
  await page.waitForFunction(() => window.__kage);
  await wait(300);

  await test('course normale à 96 px/s', async () => {
    await reset();
    await k.down('ArrowRight'); await wait(500);
    const s = await S(); await k.up('ArrowRight');
    expect(near(s.vx, 96, 1), `vx = ${s.vx}`);
  });

  await test('sprint (Maj) à 140 px/s, plus gourmand en énergie', async () => {
    await reset();
    await k.down('ArrowRight'); await k.down('ShiftLeft'); await wait(400);
    const a = await S(); await wait(1000); const b = await S();
    await k.up('ShiftLeft'); await k.up('ArrowRight');
    expect(a.state === 'sprint' && near(a.vx, 140, 1), `état ${a.state}, vx ${a.vx}`);
    expect(near(a.energy - b.energy, 0.136, 0.03), `conso ${(a.energy - b.energy).toFixed(3)}/s`);
  });

  await test('saut : 8,5 % d\'énergie (toutes les dépenses à 85 %)', async () => {
    await reset();
    await k.press('Space'); await wait(80);
    const s = await S();
    expect(near(s.energy, 0.915, 0.01), `énergie ${s.energy}`);
  });

  await test('à bout de souffle : KAGE marche lentement et l\'énergie remonte (moins vite qu\'à l\'arrêt)', async () => {
    await reset();
    await ev(() => { const e = window.__kage.player.energy; e.value = 0.05; e.exhausted = true; });
    await k.down('ArrowRight'); await wait(500);
    const a = await S(); await wait(1000); const b = await S();
    await k.up('ArrowRight');
    const walkGain = b.energy - a.energy;
    await ev(() => { const e = window.__kage.player.energy; e.value = 0.05; e.exhausted = true; });
    await wait(500); const c = await S(); await wait(1000); const d = await S();
    const idleGain = d.energy - c.energy;
    expect(a.state === 'walk' && near(a.vx, 34, 1), `état ${a.state}, vx ${a.vx}`);
    expect(walkGain > 0.2 && walkGain < idleGain, `marche +${walkGain.toFixed(2)}/s, arrêt +${idleGain.toFixed(2)}/s`);
  });

  await test('3 dashs enchaînés, le 4e refusé', async () => {
    await reset();
    const out = [];
    for (let i = 0; i < 4; i++) {
      await k.press('ArrowRight'); await wait(40); await k.press('ArrowRight'); await wait(30);
      out.push((await S()).state); await wait(260);
    }
    expect(out.slice(0, 3).every((s) => s === 'dash') && out[3] !== 'dash', out.join(','));
  });

  await test('dérapage au demi-tour en pleine course', async () => {
    await reset();
    await k.down('ArrowRight'); await wait(500); await k.up('ArrowRight');
    await k.down('ArrowLeft');
    const seen = new Set();
    for (let i = 0; i < 20; i++) { seen.add((await S()).state); await wait(10); }
    await k.up('ArrowLeft');
    expect(seen.has('skid'), `états vus : ${[...seen].join(', ')}`);
  });

  await test('sabre de face : bloqué par TATE', async () => {
    await reset(440, 192, 480);
    await ev(() => { window.__kage.tate.facing = -1; window.__kage.player.facing = 1; });
    await k.press('KeyJ'); await wait(200);
    const s = await S();
    expect(s.tateHp === 5, `vie TATE ${s.tateHp}`);
  });

  await test('sabre dans le dos : -2 ; shuriken dans le dos : -1', async () => {
    await reset(500, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.setState('stunned'); g.tate.timer = -5; g.player.facing = -1; });
    await k.press('KeyJ'); await wait(500);
    const a = await S();
    await ev(() => { const g = window.__kage; g.player.x = 560; g.player.facing = -1; });
    await wait(50); await k.press('KeyK'); await wait(500);
    const b = await S();
    expect(a.tateHp === 3 && b.tateHp === 2, `vie TATE ${a.tateHp} puis ${b.tateHp}`);
  });

  await test('charge de TATE : -2 vies, état « hurt », invincibilité', async () => {
    await reset(440, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.cooldown = 0; });
    let s;
    for (let i = 0; i < 150; i++) { s = await S(); if (s.hp < 5) break; await wait(15); }
    expect(s.hp === 3 && s.state === 'hurt', `vie ${s.hp}, état ${s.state}`);
    const again = await ev(() => window.__kage.player.hurt(2, 0));
    expect(again === false, 'second coup accepté pendant l\'invincibilité');
  });

  await test('shuriken : portée de 10 carreaux sur sol plat, puis ramassé', async () => {
    await reset(300);
    await k.press('KeyK'); await wait(1000);
    const st = await ev(() => window.__kage.shurikens.stuck[0]);
    expect(st && near(st.x - 312, 160, 3), `planté à ${st && st.x - 312} px`);
    expect((await S()).stock === 2, 'stock non décrémenté');
    await ev(() => { window.__kage.player.x = 455; });
    await k.down('ArrowRight'); await wait(300); await k.up('ArrowRight');
    expect((await S()).stock === 3, 'shuriken non ramassé');
  });

  await test('délai entre deux lancers de shuriken', async () => {
    await reset(300);
    await k.press('KeyK'); await wait(380); await k.press('KeyK'); await wait(60);
    const s = await S();
    expect(s.stock === 2, `stock ${s.stock} (deux lancers trop rapprochés)`);
  });

  await test('glissade murale puis saut mural', async () => {
    await reset(1156, 120);
    await k.down('ArrowLeft'); await wait(250);
    const a = await S();
    expect(a.state === 'wall_slide' && a.vy <= 50.5, `état ${a.state}, vy ${a.vy}`);
    await k.press('Space'); await wait(40);
    const b = await S(); await k.up('ArrowLeft');
    expect(b.state === 'wall_jump' && b.vx > 0, `état ${b.state}, vx ${b.vx}`);
  });

  await test('pas deux sauts muraux d\'affilée sur le même mur', async () => {
    await reset(1156, 120);
    await k.down('ArrowLeft'); await wait(200);
    await k.press('Space'); await wait(120);
    await wait(250);                    // revient contre le même mur (gauche)
    await k.press('Space'); await wait(40);
    const s = await S(); await k.up('ArrowLeft');
    expect(s.state !== 'wall_jump', `état ${s.state}`);
  });

  await test('rebond d\'un mur à l\'autre autorisé', async () => {
    await reset(1156, 120);
    await k.down('ArrowLeft'); await wait(200);
    await k.press('Space'); await k.up('ArrowLeft'); await wait(30);
    await k.down('ArrowRight');
    let s;
    for (let i = 0; i < 40; i++) { s = await S(); if (s.state === 'wall_slide') break; await wait(10); }
    await k.press('Space'); await wait(40);
    s = await S(); await k.up('ArrowRight');
    expect(s.state === 'wall_jump' && s.vx < 0, `état ${s.state}, vx ${s.vx}`);
  });

  await test('sabre et shuriken en l\'air', async () => {
    await reset(300);
    await k.press('Space'); await wait(120); await k.press('KeyJ'); await wait(30);
    const a = await S();
    await reset(300);
    await k.press('Space'); await wait(120); await k.press('KeyK'); await wait(30);
    const b = await S();
    expect(a.state === 'air_attack' && b.state === 'air_throw', `${a.state} / ${b.state}`);
  });

  await test('coup aérien : 3 dégâts dans le dos', async () => {
    await reset(500, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.setState('stunned'); g.tate.timer = -5; g.player.facing = -1; });
    await k.press('Space'); await wait(110); await k.press('KeyJ');
    let hp = 5;
    for (let i = 0; i < 60; i++) { hp = (await S()).tateHp; if (hp < 5) break; await wait(10); }
    expect(hp === 2, `vie TATE ${hp} (attendu 5 - 3 = 2)`);
  });

  // ---- coup de pied ----------------------------------------------------------
  await test('coup de pied : TATE pare de face mais recule', async () => {
    await reset(440, 192, 470);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.player.facing = 1; });
    const x0 = await ev(() => window.__kage.tate.x);
    await k.press('KeyU');
    let s, x1 = x0;
    for (let i = 0; i < 60; i++) { x1 = await ev(() => window.__kage.tate.x); if (x1 > x0 + 4) break; await wait(15); }
    s = await S();
    expect(s.tateHp === 5 && x1 > x0 + 4, `vie TATE ${s.tateHp}, recul ${(x1 - x0).toFixed(1)} px`);
  });

  await test('coup de pied : plus cher que le sabre, et pas deux d\'affilée trop vite', async () => {
    await reset();
    await k.press('KeyU'); await wait(40);
    const a = await S();
    await wait(60); await k.press('KeyU'); await wait(40);
    const b = await S();
    expect(near(1 - a.energy, 0.1275, 0.01) && a.state === 'kick', `coût ${(1 - a.energy).toFixed(3)}, état ${a.state}`);
    expect(near(b.energy, a.energy, 0.005), `second coup accepté trop tôt (énergie ${a.energy.toFixed(3)} -> ${b.energy.toFixed(3)})`);
    for (let i = 0; i < 80; i++) { if ((await S()).state !== 'kick') break; await wait(15); }
    await wait(450);   // délai de 0,35 s après la fin du coup
    await k.press('KeyU'); await wait(40);
    const c = await S();
    expect(c.state === 'kick', `après le délai : état ${c.state}`);
  });

  // ---- WARA ------------------------------------------------------------------
  // place le premier WARA en x, au repos (ni bond ni moulinet sauf si demandé)
  const wara = (x, o = {}) => ev(([x, o]) => {
    const w = window.__kage.wara;
    w.reset(); w.x = x; w.facing = o.facing ?? -1; w.rest = o.rest ?? 99; w.cooldown = o.cooldown ?? 99;
    if (o.state) { w.setState(o.state); w.timer = -5; }
  }, [x, o]);
  const W = () => ev(() => { const w = window.__kage.wara; return { st: w.state, hp: w.hp, x: w.x, f: w.frameName() }; });
  // attend qu'une condition sur WARA soit vraie (en temps de jeu, pas en millisecondes fixes)
  const until = async (cond, tries = 100) => {
    let w;
    for (let i = 0; i < tries; i++) { w = await W(); if (cond(w)) return w; await wait(15); }
    return w;
  };
  // attend la fin du coup de sabre de KAGE
  const swingDone = async () => {
    for (let i = 0; i < 100; i++) { if ((await S()).state === 'attack') break; await wait(10); }
    for (let i = 0; i < 100; i++) { if ((await S()).state !== 'attack') return; await wait(15); }
  };

  await test('WARA : un coup de sabre l\'abat (2 PV)', async () => {
    await reset(400); await wara(424);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyJ');
    const w = await until((x) => x.st === 'defeated');
    expect(w.st === 'defeated' && w.hp <= 0, `état ${w.st}, vie ${w.hp}`);
  });

  await test('WARA : un shuriken -1, il passe abîmé', async () => {
    await reset(400); await wara(470);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyK');
    const w = await until((x) => x.hp < 2);
    expect(w.hp === 1 && w.f.endsWith('_torn'), `vie ${w.hp}, image ${w.f}`);
  });

  await test('WARA : son moulinet touche KAGE même dans son dos (-1)', async () => {
    await reset(400); await wara(388, { facing: -1, cooldown: 0 });
    await ev(() => { window.__kage.player.facing = 1; });
    let s, w;
    for (let i = 0; i < 120; i++) { s = await S(); if (s.hp < 5) break; await wait(15); }
    w = await W();
    expect(s.hp === 4 && w.st === 'spin', `vie ${s.hp}, WARA ${w.st}`);
  });

  await test('WARA : la traverse pare le sabre pendant le moulinet, pas pendant le tournis', async () => {
    await reset(400);
    // KAGE invincible AVANT le moulinet : sinon le moulinet peut le repousser hors de portée
    await ev(() => { const g = window.__kage; g.player.facing = 1; g.player.invuln = 99; });
    await wara(424, { state: 'spin' });
    await k.press('KeyJ'); await swingDone();
    const a = await W();
    await wait(200);
    await ev(() => { const pl = window.__kage.player; pl.x = 400; pl.vx = 0; pl.facing = 1; });
    await wara(424, { state: 'dizzy' });
    await k.press('KeyJ');
    const b = await until((x) => x.st === 'defeated');
    await ev(() => { window.__kage.player.invuln = 0; });
    expect(a.hp === 2 && b.st === 'defeated', `moulinet : vie ${a.hp} ; tournis : ${b.st}`);
  });

  await test('WARA : un coup de pied l\'abat (2 dégâts)', async () => {
    await reset(400); await wara(424);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyU');
    const w = await until((x) => x.st === 'defeated');
    expect(w.st === 'defeated' && w.hp <= 0, `état ${w.st}, vie ${w.hp}`);
  });

  await test('WARA : il sautille vers KAGE', async () => {
    await reset(400); await wara(500, { rest: 0 });
    const seen = new Set();
    for (let i = 0; i < 80; i++) { seen.add((await W()).st); await wait(15); }
    const w = await W();
    expect(w.x < 490 && seen.has('air'), `x ${w.x}, états ${[...seen].join(', ')}`);
  });

  await test('touche M : coupe le son', async () => {
    const before = await page.locator('.mute').getAttribute('aria-pressed');
    await k.press('KeyM'); await wait(60);
    const after = await page.locator('.mute').getAttribute('aria-pressed');
    await k.press('KeyM');
    expect(before === 'false' && after === 'true', `${before} -> ${after}`);
  });

  // ---- tactile ---------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx.newPage();
  m.on('pageerror', (e) => errors.push('[tactile] ' + e.message));
  await m.goto(FILE); await m.waitForFunction(() => window.__kage); await m.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(m);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const mState = () => m.evaluate(() => window.__kage.player.state);
  const mReset = () => m.evaluate(() => { const g = window.__kage; g.player.respawn(true); g.player.x = 300; g.tate.x = 1700; for (const w of g.waras) w.x = w.home + 4000; g.shurikens.reset(); });

  await test('tactile : boutons saut, sabre, shuriken', async () => {
    const got = [];
    for (const [x, y] of [[788, 330], [708, 346], [732, 268]]) {
      await mReset(); await m.waitForTimeout(250);
      await T('touchStart', [[x, y, 2]]); await m.waitForTimeout(60);
      got.push(await mState()); await T('touchEnd', []); await m.waitForTimeout(500);
    }
    expect(got.join(',') === 'jump,attack,throw', got.join(','));
  });

  await test('tactile : joystick dans le cercle = course, poussé hors du cercle = sprint', async () => {
    await mReset(); await m.waitForTimeout(250);
    const st = () => m.evaluate(() => { const g = window.__kage; return { s: g.player.state, sprint: g.touch.sprintOn }; });
    await T('touchStart', [[90, 300, 1]]); await m.waitForTimeout(30);
    await T('touchMove', [[106, 300, 1]]); await m.waitForTimeout(400);    // 8 px de jeu : dans le cercle
    const a = await st();
    await T('touchMove', [[130, 300, 1]]); await T('touchMove', [[150, 300, 1]]); await m.waitForTimeout(400);  // poussé loin
    const b = await st();
    await T('touchMove', [[112, 300, 1]]); await m.waitForTimeout(400);    // revient dans le cercle
    const c = await st();
    await T('touchEnd', []); await m.waitForTimeout(300);
    expect(a.s === 'run' && !a.sprint, `léger : ${a.s}`);
    expect(b.s === 'sprint' && b.sprint, `poussé : ${b.s}`);
    expect(c.s === 'run' && !c.sprint, `relâché : ${c.s}`);
  });

  await test('tactile : dash au coup de joystick relâché, pas au retour au centre', async () => {
    await mReset(); await m.waitForTimeout(250);
    await T('touchStart', [[90, 300, 1]]); await m.waitForTimeout(20);
    await T('touchMove', [[107, 300, 1]]); await T('touchMove', [[124, 300, 1]]); await T('touchEnd', []);
    await m.waitForTimeout(30);
    const a = await mState();
    await m.waitForTimeout(400); await mReset(); await m.waitForTimeout(250);
    await T('touchStart', [[90, 300, 1]]); await m.waitForTimeout(20);
    await T('touchMove', [[107, 300, 1]]); await T('touchMove', [[124, 300, 1]]);
    await T('touchMove', [[107, 300, 1]]); await T('touchMove', [[90, 300, 1]]); await m.waitForTimeout(30);
    const b = await mState(); await T('touchEnd', []);
    expect(a === 'dash' && b !== 'dash', `relâché : ${a} ; retour au centre : ${b}`);
  });


  // ---- niveau 1 : chaque passage est faisable, et demande la bonne mécanique ----
  const lv = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  lv.on('pageerror', (e) => errors.push('[niveau 1] ' + e.message));
  await lv.goto(BASE); await lv.waitForFunction(() => window.__kage); await lv.waitForTimeout(300);
  const L = lv.keyboard, lw = (ms) => lv.waitForTimeout(ms);
  const LS = () => lv.evaluate(() => { const pl = window.__kage.player; return { st: pl.state, x: pl.x, y: pl.y, tx: Math.floor(pl.x / 16) }; });
  // place KAGE (TATE écartés pour isoler chaque passage)
  const at = (tx, y) => lv.evaluate(([tx, y]) => {
    const g = window.__kage, pl = g.player;
    pl.x = tx * 16 + 8; pl.y = y; pl.vx = 0; pl.vy = 0; pl.invuln = 0; pl.hp = 5;
    pl.energy.value = 1; pl.energy.exhausted = false; pl.onGround = true; pl.setState('idle');
    for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; }
    for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; w.cooldown = 99; }
  }, [tx, y]);
  const runJump = async (sprint, dash) => {
    await L.down('ArrowRight'); if (sprint) await L.down('ShiftLeft');
    await lw(560); await L.down('Space'); await lw(250);
    if (dash) { await L.up('ArrowRight'); await L.press('ArrowRight'); await lw(40); await L.press('ArrowRight'); await L.down('ArrowRight'); }
    await lw(200); await L.up('Space'); await lw(500);
    await L.up('ShiftLeft'); await L.up('ArrowRight');
  };

  await test('niveau 1 : 5 TATE, 5 WARA, 3 lanternes, un gong, une arrivée', async () => {
    const i = await lv.evaluate(() => { const g = window.__kage; return [g.tates.length, g.waras.length, g.level.checkpoints.length, g.level.gongs.length, !!g.level.goal]; });
    expect(i.join() === '5,5,3,1,true', i.join());
  });

  await test('niveau 1 : un TATE poussé d\'un coup de pied au bord de la fosse tombe et est vaincu', async () => {
    await at(21, 304);
    await lv.evaluate(() => {
      const g = window.__kage, t = g.tates[0];
      t.reset(); t.x = 24 * 16 - 6; t.facing = -1; t.cooldown = 99;
      g.player.x = t.x - 26; g.player.facing = 1;
    });
    await lw(50);
    await L.press('KeyU');
    let r;
    for (let i = 0; i < 120; i++) {
      r = await lv.evaluate(() => { const t = window.__kage.tates[0]; return { st: t.state, gone: t.gone, y: t.y, falling: t.falling }; });
      if (r.gone) break;
      await lw(15);
    }
    expect(r.st === 'defeated' && r.gone, `état ${r.st}, disparu ${r.gone}, y ${Math.round(r.y)}`);
  });

  await test('niveau 1 : le tunnel ne se passe qu\'en glissade', async () => {
    await at(29, 304); await L.down('ArrowRight'); await lw(800);
    const standing = (await LS()).tx;
    await L.press('ArrowDown'); await lw(1300); await L.up('ArrowRight');
    const slid = (await LS()).tx;
    expect(standing < 32 && slid >= 39, `debout : colonne ${standing} ; en glissade : colonne ${slid}`);
  });

  await test('niveau 1 : fossé de 5 = sprint (une course simple ne suffit pas)', async () => {
    await at(45, 304); await runJump(false, false); const a = (await LS()).tx;
    await at(45, 304); await runJump(true, false); const b = (await LS()).tx;
    expect(a < 55 && b >= 55, `course : ${a} ; sprint : ${b}`);
  });

  await test('niveau 1 : fossé de 8 = sprint + saut + dash', async () => {
    await at(75, 304); await runJump(true, false); const a = (await LS()).tx;
    await at(75, 304); await runJump(true, true); const b = (await LS()).tx;
    expect(a < 88 && b >= 88, `sans dash : ${a} ; avec dash : ${b}`);
  });

  await test('niveau 1 : le puits se remonte en sauts muraux jusqu\'à la passerelle', async () => {
    await at(97, 304); await lw(150);
    let side = -1;
    await L.down('Space'); await lw(60); await L.up('Space');
    for (let i = 0; i < 14; i++) {
      const key = side < 0 ? 'ArrowLeft' : 'ArrowRight';
      await L.down(key);
      for (let j = 0; j < 50; j++) { if ((await LS()).st === 'wall_slide') break; await lw(10); }
      await L.down('Space'); await lw(40); await L.up(key); await lw(60); await L.up('Space');
      side = -side;
      if ((await LS()).y < 150) break;
    }
    await L.down('ArrowRight'); await lw(600); await L.up('ArrowRight');
    const s = await LS();
    expect(s.y <= 144 && s.tx >= 101, `y ${s.y}, colonne ${s.tx}`);
  });

  await test('niveau 1 : le gong au shuriken ouvre la porte', async () => {
    await at(112, 144); await lv.evaluate(() => { window.__kage.player.facing = 1; window.__kage.player.x += 2; });
    await lw(150); await L.press('KeyK'); await lw(900);
    await at(132, 304); await lw(700);
    await L.down('ArrowRight'); await lw(700); await L.up('ArrowRight');
    const s = await LS();
    const open = await lv.evaluate(() => window.__kage.level.doorOpen);
    expect(open && s.tx > 135, `porte ouverte : ${open}, colonne ${s.tx}`);
  });

  await test('niveau 1 : le torii affiche l\'écran de fin', async () => {
    await at(162, 304); await L.down('ArrowRight'); await lw(1200); await L.up('ArrowRight'); await lw(200);
    const shown = await lv.evaluate(() => !document.querySelector('.win').hidden);
    expect(shown, 'écran de fin absent');
  });

  // ---- chapitre 1 : le Potager ----
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  pg.setDefaultTimeout(8000);
  pg.on('pageerror', (e) => errors.push('[potager] ' + e.message));
  // compte les sons réellement joués (chaque source audio démarrée)
  await pg.addInitScript(() => {
    window.__sons = 0;
    const AC = window.AudioContext;
    for (const m of ['createBufferSource', 'createOscillator']) {
      const orig = AC.prototype[m];
      AC.prototype[m] = function () { const n = orig.call(this); const st = n.start.bind(n); n.start = (...a) => { window.__sons++; st(...a); }; return n; };
    }
  });
  await pg.goto(PAGE); await pg.waitForFunction(() => window.__kage); await pg.waitForTimeout(300);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => window.__kage); await pg.waitForTimeout(300);
  const PK = pg.keyboard, pw = (ms) => pg.waitForTimeout(ms);
  const PS = () => pg.evaluate(() => { const pl = window.__kage.player; return { st: pl.state, x: pl.x, y: pl.y, tx: Math.floor(pl.x / 16), hp: pl.hp, ground: pl.onGround }; });
  const SAVE = () => pg.evaluate(() => JSON.parse(localStorage.getItem('kage.save.v1') || 'null'));
  // KAGE posé sur le sol (le plus bas : sous les toits et mezzanines) de la colonne tx, ennemis écartés
  const pat = (tx) => pg.evaluate((tx) => {
    const g = window.__kage, pl = g.player, l = g.level;
    let ty = l.h - 1; while (ty > 0 && l.solid(tx, ty - 1)) ty--;
    if (!l.solid(tx, l.h - 1)) { ty = 0; while (ty < l.h && !l.solid(tx, ty)) ty++; }   // passerelle au-dessus de l'eau
    pl.x = tx * 16 + 8; pl.y = ty * 16; pl.vx = 0; pl.vy = 0; pl.invuln = 0; pl.hp = 5;
    pl.energy.value = 1; pl.energy.exhausted = false; pl.onGround = true; pl.setState('idle');
    for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; }
    for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; w.cooldown = 99; }
  }, tx);
  // trous du chapitre (colonnes sans aucun sol : eau ou vide) : [début, largeur, haut à gauche, haut à droite]
  const holes = await pg.evaluate(() => {
    const l = window.__kage.level, top = (x) => { let y = 0; while (y < l.h && !l.solid(x, y)) y++; return y; };
    const out = []; let x = 0;
    while (x < l.w) { if (top(x) >= l.h) { const s = x; while (x < l.w && top(x) >= l.h) x++; out.push([s, x - s, top(s - 1), top(x)]); } else x++; }
    return out;
  });
  // élan jusqu'au bord du trou, saut, dash éventuel ; renvoie l'état à l'arrivée
  const leap = async ([gs, w, lt], { sprint = false, dash = false } = {}) => {
    let c = gs - 1; while (c > gs - 5 && w > 3 && (await pg.evaluate(([c, lt]) => { const l = window.__kage.level; return l.solid(c, lt) && !l.solid(c, lt - 1); }, [c - 1, lt]))) c--;
    await pat(c);
    if (w <= 3) {   // petit canal : un saut court, sans élan, et on s'arrête à l'atterrissage
      await PK.down('ArrowRight'); await PK.down('Space'); await pw(420);
      await PK.up('ArrowRight'); await PK.up('Space'); await pw(400);
      return PS();
    }
    const run = Math.max(60, Math.round(((gs * 16 - 3) - (c * 16 + 8)) / (sprint ? 140 : 96) * 1000));
    await PK.down('ArrowRight'); if (sprint) await PK.down('ShiftLeft');
    await pw(run); await PK.down('Space'); await pw(250);
    if (dash) { await PK.up('ArrowRight'); await PK.press('ArrowRight'); await pw(40); await PK.press('ArrowRight'); await PK.down('ArrowRight'); }
    await pw(200); await PK.up('Space'); await pw(450);
    await PK.up('ShiftLeft'); await PK.up('ArrowRight'); await pw(250);
    return PS();
  };
  const landed = (s, [gs, w, , rt]) => s.tx >= gs + w && s.y === rt * 16 && s.hp === 5 && s.st !== 'death' && s.st !== 'respawn';

  await test('potager : écran titre, puis 8 zones, 3 lanternes, un marchand et une sortie', async () => {
    const shown = await pg.evaluate(() => !document.querySelector('.title-screen').hidden);
    await pg.click('[data-new]'); await pw(200);
    const i = await pg.evaluate(() => { const g = window.__kage, l = g.level; return [l.zones.length, l.checkpoints.length, !!l.merchant, !!l.goal, g.run.paused]; });
    expect(shown && i.join() === '8,3,true,true,false', `titre ${shown}, ${i.join()}`);
  });

  await test('potager : silence à l\'arrêt (ennemis hors de l\'écran inaudibles), pas qui suivent la course et s\'arrêtent avec KAGE', async () => {
    await pat(4); await PK.press('ShiftLeft'); await pw(200);
    await pg.evaluate(() => { window.__sons = 0; });
    await pw(1500);
    const still = await pg.evaluate(() => window.__sons);
    await pg.evaluate(() => {
      const pl = window.__kage.player, o = pl.onEvent; window.__pas = 0;
      pl.onEvent = (n, d) => { if (n === 'step') window.__pas++; o(n, d); };
    });
    await PK.down('ArrowRight'); await pw(1000); await PK.up('ArrowRight'); await pw(200);
    const running = await pg.evaluate(() => window.__pas);
    await pg.evaluate(() => { window.__pas = 0; window.__sons = 0; });
    await pw(1000);
    const after = await pg.evaluate(() => [window.__pas, window.__sons]);
    expect(still === 0 && running >= 3 && after[0] === 0 && after[1] === 0, `sons à l'arrêt ${still}, pas en 1 s de course ${running}, après l'arrêt : pas ${after[0]}, sons ${after[1]}`);
  });

  await test('potager : cadrage 448×252, sol en bas de l\'image', async () => {
    await pat(60); await pw(1500);
    const r = await pg.evaluate(() => { const g = window.__kage, v = g.view(); return { w: v.w, h: v.h, feet: g.player.y - g.camera.y }; });
    expect(r.w === 448 && r.h === 252 && r.feet > 252 * 0.8 && r.feet < 252 * 0.92, `vue ${r.w}×${r.h}, pieds à ${Math.round(r.feet)} px`);
  });

  await test('potager : stabilité — une marche ne bouge pas la caméra, un vrai changement de niveau la recadre d\'un seul mouvement', async () => {
    await pat(29); await pw(1500);                       // sol de référence (zone 1)
    const y0 = await pg.evaluate(() => window.__kage.camera.y);
    await pat(34); await pw(900);                        // sur le muret, deux cases plus haut
    const y1 = await pg.evaluate(() => window.__kage.camera.y);
    await pat(95); await pw(120);                        // terrasse, quatre cases plus haut
    const ys = [];
    for (let i = 0; i < 14; i++) { ys.push(await pg.evaluate(() => window.__kage.camera.y)); await pw(70); }
    // un seul mouvement : la caméra va toujours dans le même sens, puis s'arrête
    let monotone = true;
    for (let i = 1; i < ys.length; i++) if (ys[i] > ys[i - 1] + 0.01) monotone = false;
    const still = Math.abs(ys[ys.length - 1] - ys[ys.length - 2]) < 0.01;
    const integer = await pg.evaluate(() => { const c = window.__kage.camera; return [c.x, c.y]; });
    expect(Math.abs(y1 - y0) < 0.01 && ys[0] - ys[ys.length - 1] > 40 && monotone && still,
      `marche : ${(y1 - y0).toFixed(2)} px ; terrasse : ${ys.map((v) => v.toFixed(0)).join(' ')} ; caméra ${integer.map((v) => v.toFixed(2)).join(', ')}`);
  });

  await test('potager : la caméra ne suit pas les sauts', async () => {
    await pat(60); await pw(1500);
    const y0 = await pg.evaluate(() => window.__kage.camera.y);
    await PK.down('Space');
    let dev = 0;
    for (let i = 0; i < 12; i++) { await pw(50); dev = Math.max(dev, Math.abs((await pg.evaluate(() => window.__kage.camera.y)) - y0)); }
    await PK.up('Space'); await pw(400);
    expect(dev < 1, `la caméra a bougé de ${dev.toFixed(1)} px pendant le saut`);
  });

  await test('potager : zone morte — un petit pas ne déplace pas la caméra, une longue course si', async () => {
    await pat(60); await pw(300);
    await pg.evaluate(() => { const g = window.__kage; g.camera.x = g.player.x - g.view().w * 0.4; });
    await pw(100);
    const x0 = await pg.evaluate(() => window.__kage.camera.x);
    await PK.down('ArrowRight'); await pw(300); await PK.up('ArrowRight'); await pw(200);
    const x1 = await pg.evaluate(() => window.__kage.camera.x);
    await PK.down('ArrowRight'); await PK.down('ShiftLeft'); await pw(1500); await PK.up('ShiftLeft'); await PK.up('ArrowRight'); await pw(200);
    const x2 = await pg.evaluate(() => window.__kage.camera.x);
    expect(Math.abs(x1 - x0) < 0.5 && x2 - x1 > 100, `petit pas : ${(x1 - x0).toFixed(1)} px ; longue course : ${(x2 - x1).toFixed(0)} px`);
  });

  await test('potager : chaque trou se franchit (saut, ou saut + dash pour les grands)', async () => {
    const bad = [];
    for (const h of holes) {
      const s = await leap(h, { dash: h[1] > 3 });
      if (!landed(s, h)) bad.push(`trou ${h[0]}+${h[1]} → colonne ${s.tx}, y ${s.y}, ${s.st}`);
    }
    expect(holes.length >= 8 && bad.length === 0, `${holes.length} trous ; ${bad.join(' ; ')}`);
  });

  await test('potager : le premier trou du dash (zone 2) demande vraiment le dash', async () => {
    const h = holes.find((h) => h[0] > 79 && h[1] === 6);
    const a = await leap(h), b = await leap(h, { dash: true });
    expect(!landed(a, h) && landed(b, h), `sans dash : colonne ${a.tx} ; avec dash : colonne ${b.tx}`);
  });

  await test('potager : le trou du sprint (zone 3) demande le sprint', async () => {
    const h = holes.find((h) => h[0] > 141 && h[1] === 5 && h[2] === h[3]);
    const a = await leap(h), b = await leap(h, { sprint: true });
    expect(!landed(a, h) && landed(b, h), `course : colonne ${a.tx} ; sprint : colonne ${b.tx}`);
  });

  await test('potager : les passages bas de la serre et du jardin ne se passent qu\'en glissade', async () => {
    // passages bas : une seule case libre au-dessus du sol
    const lows = await pg.evaluate(() => {
      const l = window.__kage.level, out = []; let x = 0;
      const low = (x) => { let y = l.h - 1; while (y > 0 && l.solid(x, y - 1)) y--; return y > 1 && l.solid(x, y - 2) && !l.solid(x, y - 1) && l.solid(x, y); };
      while (x < l.w) { if (low(x)) { const s = x; while (x < l.w && low(x)) x++; out.push([s, x - s]); } else x++; }
      return out;
    });
    const bad = [];
    for (const [s0, w] of lows) {
      await pat(s0 - 3); await PK.down('ArrowRight'); await pw(700); await PK.up('ArrowRight'); await pw(100);
      const standing = (await PS()).tx;
      await pat(s0 - 3); await PK.down('ArrowRight'); await pw(150); await PK.press('ArrowDown'); await pw(1300); await PK.up('ArrowRight'); await pw(100);
      const slid = (await PS()).tx;
      if (!(standing < s0 && slid >= s0 + w)) bad.push(`passage ${s0}+${w} : debout ${standing}, glissade ${slid}`);
    }
    expect(lows.length >= 5 && bad.length === 0, `${lows.length} passages ; ${bad.join(' ; ')}`);
  });

  // les tests suivants repartent d'une partie neuve
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
  await pg.click('[data-new]'); await pw(200);

  await test('potager : une caisse de la grange se brise au sabre et lâche un ryō', async () => {
    const before = await pg.evaluate(() => { const l = window.__kage.level; const [k, c] = [...l.crates.entries()].find(([, c]) => c.ty === l.h - 4); return { k, tx: c.tx, n: l.crates.size, coins: l.coins.length }; });
    await pat(before.tx - 2); await pg.evaluate(() => { window.__kage.player.facing = 1; });
    await pw(80); await PK.press('KeyJ'); await pw(400);
    const after = await pg.evaluate(() => { const l = window.__kage.level; return { n: l.crates.size, coins: l.coins.length }; });
    // un coup peut briser deux caisses d'une même pile : un ryō par caisse
    expect(after.n < before.n && after.coins - before.coins === before.n - after.n, `caisses ${before.n} → ${after.n}, ryō ${before.coins} → ${after.coins}`);
  });

  await test('potager : un ryō ramassé est compté et enregistré', async () => {
    // un ryō à hauteur de hanche, au-dessus du sol
    const c = await pg.evaluate(() => {
      const l = window.__kage.level;
      const ground = (tx) => { let y = l.h - 1; while (y > 0 && l.solid(tx, y - 1)) y--; return y; };
      const c = l.coins.find((c) => !c.taken && c.y === ground(Math.floor(c.x / 16)) * 16 - 24);
      return { id: c.id, tx: Math.floor(c.x / 16) };
    });
    const before = (await SAVE())?.ryo ?? 0;
    await pat(c.tx); await pw(300);
    const s = await SAVE();
    expect(s && s.ryo === before + 1 && s.coins.includes(c.id), `ryō ${before} → ${s && s.ryo}`);
  });

  await test('potager : une lanterne enregistre la partie (icône « enregistré »)', async () => {
    const c = await pg.evaluate(() => Math.floor(window.__kage.level.checkpoints[1].x / 16));
    await pat(c - 2); await PK.down('ArrowRight'); await pw(500); await PK.up('ArrowRight'); await pw(150);
    const icon = await pg.evaluate(() => document.querySelector('.saved').classList.contains('on'));
    const s = await SAVE();
    expect(s && s.checkpoint === 1 && icon, `point de reprise ${s && s.checkpoint}, icône ${icon}`);
  });

  await test('potager : « Continuer » reprend à la dernière lanterne, avec les ryō', async () => {
    const before = await SAVE();
    await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
    const cont = await pg.evaluate(() => !document.querySelector('[data-continue]').hidden);
    await pg.click('[data-continue]'); await pw(300);
    const r = await pg.evaluate(() => { const g = window.__kage, l = g.level; return { px: g.player.x, lx: l.checkpoints[1].x, taken: l.coins.filter((c) => c.taken).map((c) => c.id) }; });
    expect(cont && Math.abs(r.px - r.lx) < 24 && before.coins.every((id) => r.taken.includes(id)), `continuer ${cont}, KAGE ${Math.round(r.px)} / lanterne ${r.lx}`);
  });

  await test('potager : le marchand ouvre la boutique (↑) et Échap la referme', async () => {
    const mx = await pg.evaluate(() => Math.floor(window.__kage.level.merchant.x / 16));
    await pat(mx - 1); await pw(200);
    const talk = await pg.evaluate(() => !document.querySelector('.talk').hidden);
    await PK.press('ArrowUp'); await pw(200);
    const open = await pg.evaluate(() => [!document.querySelector('.shop').hidden, window.__kage.run.paused, document.querySelectorAll('[data-tabs] button').length]);
    await PK.press('Escape'); await pw(200);
    const closed = await pg.evaluate(() => [document.querySelector('.shop').hidden, window.__kage.run.paused]);
    expect(talk && open[0] && open[1] && open[2] === 3 && closed[0] && !closed[1], `parler ${talk}, ouverte ${open.join()}, fermée ${closed.join()}`);
  });

  await test('potager : la sortie termine le chapitre', async () => {
    const gx = await pg.evaluate(() => Math.floor(window.__kage.level.goal.x / 16));
    await pat(gx - 4); await PK.down('ArrowRight'); await pw(900); await PK.up('ArrowRight'); await pw(300);
    const r = await pg.evaluate(() => [!document.querySelector('.win').hidden, document.querySelector('.win__title').textContent]);
    const s = await SAVE();
    expect(r[0] && /Potager/.test(r[1]) && s.done, `fin ${r.join(' / ')}, sauvegarde terminée ${s && s.done}`);
  });

  await test('aucune erreur dans la console', async () => {
    expect(errors.length === 0, errors.join(' | '));
  });

  await browser.close();
  let failed = 0;
  for (const [status, name] of results) {
    if (status !== 'ok') failed++;
    console.log(`${status === 'ok' ? '  ok   ' : '  ÉCHEC'}  ${name}`);
  }
  console.log(`\n${results.length - failed}/${results.length} tests réussis`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
