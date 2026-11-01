// Tests de bout en bout : le jeu complet (dist/kage-standalone.html) dans un
// vrai navigateur. Lancement : npm test
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = 'file://' + path.resolve(__dirname, '../dist/kage-standalone.html');
const FILE = BASE + '#terrain';
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
    expect(near(a.energy - b.energy, 0.16, 0.03), `conso ${(a.energy - b.energy).toFixed(3)}/s`);
  });

  await test('saut : 10 % d\'énergie', async () => {
    await reset();
    await k.press('Space'); await wait(80);
    const s = await S();
    expect(near(s.energy, 0.9, 0.01), `énergie ${s.energy}`);
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
    expect(s.tateHp === 4, `vie TATE ${s.tateHp}`);
  });

  await test('sabre dans le dos : -2 ; shuriken dans le dos : -1', async () => {
    await reset(500, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.setState('stunned'); g.tate.timer = -5; g.player.facing = -1; });
    await k.press('KeyJ'); await wait(500);
    const a = await S();
    await ev(() => { const g = window.__kage; g.player.x = 560; g.player.facing = -1; });
    await wait(50); await k.press('KeyK'); await wait(500);
    const b = await S();
    expect(a.tateHp === 2 && b.tateHp === 1, `vie TATE ${a.tateHp} puis ${b.tateHp}`);
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
    let hp = 4;
    for (let i = 0; i < 60; i++) { hp = (await S()).tateHp; if (hp < 4) break; await wait(10); }
    expect(hp === 1, `vie TATE ${hp} (attendu 4 - 3 = 1)`);
  });

  // ---- WARA ------------------------------------------------------------------
  // place le premier WARA en x, au repos (ni bond ni moulinet sauf si demandé)
  const wara = (x, o = {}) => ev(([x, o]) => {
    const w = window.__kage.wara;
    w.reset(); w.x = x; w.facing = o.facing ?? -1; w.rest = o.rest ?? 99; w.cooldown = o.cooldown ?? 99;
    if (o.state) { w.setState(o.state); w.timer = -5; }
  }, [x, o]);
  const W = () => ev(() => { const w = window.__kage.wara; return { st: w.state, hp: w.hp, x: w.x, f: w.frameName() }; });

  await test('WARA : un coup de sabre l\'abat (2 PV)', async () => {
    await reset(400); await wara(424);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyJ'); await wait(300);
    const w = await W();
    expect(w.st === 'defeated' && w.hp <= 0, `état ${w.st}, vie ${w.hp}`);
  });

  await test('WARA : un shuriken -1, il passe abîmé', async () => {
    await reset(400); await wara(470);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyK'); await wait(400);
    const w = await W();
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
    await reset(400); await wara(424, { state: 'spin' });
    await ev(() => { const g = window.__kage; g.player.facing = 1; g.player.invuln = 99; });
    await k.press('KeyJ'); await wait(300);
    const a = await W();
    await wait(400); await wara(424, { state: 'dizzy' });
    await k.press('KeyJ'); await wait(300);
    const b = await W();
    await ev(() => { window.__kage.player.invuln = 0; });
    expect(a.hp === 2 && b.st === 'defeated', `moulinet : vie ${a.hp} ; tournis : ${b.st}`);
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
