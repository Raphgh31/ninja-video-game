// Tests de bout en bout : le jeu complet (dist/kage-standalone.html) dans un
// vrai navigateur. Lancement : npm test
const path = require('node:path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, '../dist/kage-standalone.html');
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
  const mReset = () => m.evaluate(() => { const g = window.__kage; g.player.respawn(true); g.player.x = 300; g.tate.x = 1700; g.shurikens.reset(); });

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
