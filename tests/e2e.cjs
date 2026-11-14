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
  // l'introduction du lancement est passée dans les tests (window.__KAGE_SKIP_INTRO) ; un test la joue
  const rawNewContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await rawNewContext(o); await c.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; }); return c; };
  const rawNewPage = browser.newPage.bind(browser);
  browser.newPage = async (o) => { const p = await rawNewPage(o); await p.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; }); return p; };
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
  // SEUL=« texte » : ne lance que les tests dont le nom contient ce texte (mise au point rapide)
  async function test(name, fn) {
    if (process.env.SEUL && !name.includes(process.env.SEUL)) return;
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

  await test('saut : 6,8 % d\'énergie (toutes les dépenses à 68 % : 85 %, puis −20 %)', async () => {
    await reset();
    await k.press('Space'); await wait(80);
    const s = await S();
    expect(near(s.energy, 0.932, 0.01), `énergie ${s.energy}`);
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

  await test('4 dashs enchaînés (énergie −20 %), le 5e refusé', async () => {
    await reset();
    const out = [];
    for (let i = 0; i < 5; i++) {
      await k.press('ArrowRight'); await wait(40); await k.press('ArrowRight'); await wait(30);
      out.push((await S()).state); await wait(260);
    }
    expect(out.slice(0, 4).every((s) => s === 'dash') && out[4] !== 'dash', out.join(','));
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

  await test('salto au 2e appui sur saut : avant, arrière (← tenue) ; un saut simple n\'en fait pas', async () => {
    // inAir : la direction n'est tenue qu'une fois en l'air (sinon, tenue au sol, KAGE se retournerait
    // avant de décoller et le salto serait, à juste titre, un salto avant)
    const jumpWith = async (key, second, inAir = false) => {
      await reset(); await ev(() => { window.__kage.player.facing = 1; });
      if (key && !inAir) await k.down(key);
      await k.down('Space'); await wait(60);
      if (key && inAir) await k.down(key);
      await wait(60); await k.up('Space');
      if (second) { await k.down('Space'); await wait(40); await k.up('Space'); }
      const seen = new Set(), frames = new Set(), facing = new Set();
      let y0 = null, top = 0;
      for (let i = 0; i < 70; i++) {
        const q = await ev(() => { const p = window.__kage.player; return { s: p.state, f: p.anim.frame, d: p.facing, y: p.y }; });
        seen.add(q.s); if (q.s === 'flip' || q.s === 'backflip') { frames.add(q.f); facing.add(q.d); }
        y0 ??= q.y; top = Math.max(top, 192 - q.y);
        await wait(16);
      }
      if (key) await k.up(key);
      return { seen: [...seen], frames: [...frames].sort((a, b) => a - b), facing: [...facing], top: Math.round(top) };
    };
    const av = await jumpWith('ArrowRight', true), ar = await jumpWith('ArrowLeft', true, true), dr = await jumpWith('ArrowRight', false);
    expect(av.seen.includes('flip') && av.frames.includes(5) && av.frames.includes(10), `avant : ${JSON.stringify(av)}`);
    expect(ar.seen.includes('backflip') && ar.facing.join() === '1' && ar.frames.includes(5), `arrière (KAGE garde son orientation) : ${JSON.stringify(ar)}`);
    expect(dr.seen.includes('jump') && !dr.seen.includes('flip') && !dr.seen.includes('backflip'), `saut simple en courant : ${dr.seen.join(',')}`);
    expect(av.top <= 50 + 10, `envolée bridée : ${av.top} px au plus haut (saut plein : 50)`);
  });

  await test('sabre de face : bloqué par TATE', async () => {
    await reset(440, 192, 480);
    await ev(() => { window.__kage.tate.facing = -1; window.__kage.player.facing = 1; });
    await k.press('KeyX'); await wait(200);
    const s = await S();
    expect(s.tateHp === 5, `vie TATE ${s.tateHp}`);
  });

  await test('sabre dans le dos : -2 ; shuriken dans le dos : -1', async () => {
    await reset(500, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.setState('stunned'); g.tate.timer = -5; g.player.facing = -1; });
    await k.press('KeyX'); await wait(500);
    const a = await S();
    await ev(() => { const g = window.__kage; g.player.x = 560; g.player.facing = -1; });
    await wait(50); await k.press('KeyV'); await wait(500);
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
    await k.press('KeyV'); await wait(1000);
    const st = await ev(() => window.__kage.shurikens.stuck[0]);
    expect(st && near(st.x - 312, 160, 3), `planté à ${st && st.x - 312} px`);
    expect((await S()).stock === 2, 'stock non décrémenté');
    await ev(() => { window.__kage.player.x = 455; });
    await k.down('ArrowRight'); await wait(300); await k.up('ArrowRight');
    expect((await S()).stock === 3, 'shuriken non ramassé');
  });

  await test('délai entre deux lancers de shuriken', async () => {
    await reset(300);
    await k.press('KeyV'); await wait(380); await k.press('KeyV'); await wait(60);
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

  await test('enchaînement de sauts muraux à coups de saut répétés : aucun salto', async () => {
    await reset(1156, 120);
    const r = await ev(() => {
      const g = window.__kage, inp = g.input, seen = new Set(), pl = g.player;
      let walls = 0, dir = -1;
      const emit = pl.emit; pl.emit = function (n, d) { if (n === 'wall_jump') { walls++; dir = -dir; } return emit.call(this, n, d); };
      for (let n = 0; n < 240; n++) {
        inp.setHeld('left', dir < 0); inp.setHeld('right', dir > 0);
        if (n % 9 === 0) { inp.setHeld('jump', false); g.step(1); inp.setHeld('jump', true); }   // appuis rapprochés, comme un joueur pressé
        g.step(1);
        seen.add(pl.state);
        if (pl.onGround) break;            // (de retour au sol : un nouveau saut peut de nouveau faire un salto)
      }
      pl.emit = emit;
      g.resume();                          // (retour au temps réel pour les tests suivants)
      for (const a of ['left', 'right', 'jump']) inp.setHeld(a, false);
      return { walls, seen: [...seen] };
    });
    expect(r.walls >= 2 && !r.seen.includes('flip') && !r.seen.includes('backflip'), JSON.stringify(r));
  });

  await test('coup du salto : sabre en l\'air après un salto = 4 dégâts (3 sans salto), éclat de lumière', async () => {
    await reset();
    const r = await ev(() => {
      const g = window.__kage, inp = g.input, pl = g.player, w = g.waras[0], out = [];
      for (const flip of [true, false]) {
        pl.respawn(true); pl.x = 300; pl.y = 192; pl.facing = 1;
        w.reset(); w.x = 370; w.hp = 10; w.rest = 99;
        const ev = new Set(), emit = pl.emit; pl.emit = function (n, d) { ev.add(n); return emit.call(this, n, d); };
        inp.setHeld('right', true);
        inp.setHeld('jump', true); g.step(12); inp.setHeld('jump', false); g.step(1);
        if (flip) { inp.setHeld('jump', true); g.step(40); inp.setHeld('jump', false); }
        inp.pressed.add('attack'); g.step(1);
        const state = pl.state;
        for (let n = 0; n < 150 && !pl.onGround; n++) g.step(1);
        g.step(30);
        pl.emit = emit; inp.setHeld('right', false);
        out.push({ state, hp: w.hp, flash: ev.has('blade_flash') });
      }
      g.resume();
      return out;
    });
    expect(r[0].state === 'flip_attack' && r[0].hp === 6 && r[0].flash, `après un salto : ${JSON.stringify(r[0])}`);
    expect(r[1].state === 'air_attack' && r[1].hp === 7 && !r[1].flash, `sans salto : ${JSON.stringify(r[1])}`);
  });

  await test('sabre et shuriken en l\'air', async () => {
    await reset(300);
    await k.press('Space'); await wait(120); await k.press('KeyX'); await wait(30);
    const a = await S();
    await reset(300);
    await k.press('Space'); await wait(120); await k.press('KeyV'); await wait(30);
    const b = await S();
    expect(a.state === 'air_attack' && b.state === 'air_throw', `${a.state} / ${b.state}`);
  });

  await test('coup aérien : 3 dégâts dans le dos', async () => {
    await reset(500, 192, 480);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.tate.setState('stunned'); g.tate.timer = -5; g.player.facing = -1; });
    await k.press('Space'); await wait(110); await k.press('KeyX');
    let hp = 5;
    for (let i = 0; i < 60; i++) { hp = (await S()).tateHp; if (hp < 5) break; await wait(10); }
    expect(hp === 2, `vie TATE ${hp} (attendu 5 - 3 = 2)`);
  });

  // ---- coup de pied ----------------------------------------------------------
  await test('coup de pied : TATE pare de face mais recule', async () => {
    await reset(440, 192, 470);
    await ev(() => { const g = window.__kage; g.tate.facing = -1; g.player.facing = 1; });
    const x0 = await ev(() => window.__kage.tate.x);
    await k.press('KeyB');
    let s, x1 = x0;
    for (let i = 0; i < 60; i++) { x1 = await ev(() => window.__kage.tate.x); if (x1 > x0 + 4) break; await wait(15); }
    s = await S();
    expect(s.tateHp === 5 && x1 > x0 + 4, `vie TATE ${s.tateHp}, recul ${(x1 - x0).toFixed(1)} px`);
  });

  await test('coup de pied : plus cher que le sabre, et pas deux d\'affilée trop vite', async () => {
    await reset();
    await k.press('KeyB'); await wait(40);
    const a = await S();
    await wait(60); await k.press('KeyB'); await wait(40);
    const b = await S();
    expect(near(1 - a.energy, 0.102, 0.01) && a.state === 'kick', `coût ${(1 - a.energy).toFixed(3)}, état ${a.state}`);
    expect(near(b.energy, a.energy, 0.005), `second coup accepté trop tôt (énergie ${a.energy.toFixed(3)} -> ${b.energy.toFixed(3)})`);
    for (let i = 0; i < 80; i++) { if ((await S()).state !== 'kick') break; await wait(15); }
    await wait(450);   // délai de 0,35 s après la fin du coup
    await k.press('KeyB'); await wait(40);
    const c = await S();
    expect(c.state === 'kick', `après le délai : état ${c.state}`);
  });

  await test('coup de pied sauté : en l\'air, le coup de pied a sa propre animation (celle de l\'intro) et frappe jambe tendue', async () => {
    await reset(); await wait(450);   // délai du coup de pied précédent
    await k.down('Space'); await wait(120); await k.up('Space');
    await k.press('KeyB'); await wait(30);
    const a = await S();
    let box = null, f = -1;
    for (let i = 0; i < 40 && !box; i++) { [box, f] = await ev(() => { const p = window.__kage.player, b = p.kickBox(); return [b && { x: b.x, w: b.w, px: p.x }, p.anim.frame]; }); if (!box) await wait(10); }
    for (let i = 0; i < 120; i++) { const s = await S(); if (s.state !== 'air_kick' && s.state !== 'fall') break; await wait(15); }
    const c = await S();
    expect(a.state === 'air_kick' && box && f === 2 && box.x > box.px && ['land', 'idle', 'run'].includes(c.state),
      `état ${a.state}, zone ${JSON.stringify(box)} (image ${f}), à la fin ${c.state}`);
    await wait(400);   // le délai du coup de pied, pour les tests suivants
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
    await k.press('KeyX');
    const w = await until((x) => x.st === 'defeated');
    expect(w.st === 'defeated' && w.hp <= 0, `état ${w.st}, vie ${w.hp}`);
  });

  await test('WARA : un shuriken -1, il passe abîmé', async () => {
    await reset(400); await wara(470);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyV');
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
    await k.press('KeyX'); await swingDone();
    const a = await W();
    await wait(200);
    await ev(() => { const pl = window.__kage.player; pl.x = 400; pl.vx = 0; pl.facing = 1; });
    await wara(424, { state: 'dizzy' });
    await k.press('KeyX');
    const b = await until((x) => x.st === 'defeated');
    await ev(() => { window.__kage.player.invuln = 0; });
    expect(a.hp === 2 && b.st === 'defeated', `moulinet : vie ${a.hp} ; tournis : ${b.st}`);
  });

  await test('WARA : un coup de pied l\'abat (2 dégâts)', async () => {
    await reset(400); await wara(424);
    await ev(() => { window.__kage.player.facing = 1; });
    await k.press('KeyB');
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

  await test('tactile : deuxième appui sur le bouton saut = salto', async () => {
    await mReset(); await m.evaluate(() => { window.__kage.player.facing = 1; }); await m.waitForTimeout(250);
    await T('touchStart', [[788, 330, 2]]); await m.waitForTimeout(120); await T('touchEnd', []);
    await m.waitForTimeout(40);
    await T('touchStart', [[788, 330, 3]]); await m.waitForTimeout(40); await T('touchEnd', []);
    const seen = new Set();
    for (let i = 0; i < 12; i++) { seen.add(await mState()); await m.waitForTimeout(30); }
    await m.waitForTimeout(600);
    expect(seen.has('flip'), `états vus : ${[...seen].join(', ')}`);
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
    await L.press('KeyB');
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
    await lw(150); await L.press('KeyV'); await lw(900);
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
    if (!l.solid(tx, l.h - 1)) { ty = 0; while (ty < l.h && !l.solid(tx, ty) && !l.ledge(tx, ty)) ty++; }   // passerelle au-dessus de l'eau
    pl.x = tx * 16 + 8; pl.y = ty * 16; pl.vx = 0; pl.vy = 0; pl.invuln = 0; pl.hp = 5;
    pl.energy.value = 1; pl.energy.exhausted = false; pl.onGround = true; pl.setState('idle');
    for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; }
    for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; w.cooldown = 99; }
    if (g.boss && g.boss.state !== 'defeated') g.boss.reset();
  }, tx);
  // trous du chapitre (colonnes sans aucun sol : eau ou vide) : [début, largeur, haut à gauche, haut à droite]
  const holes = await pg.evaluate(() => {
    // une passerelle « - » compte comme un sol (plateformes sur pilotis)
    const l = window.__kage.level, top = (x) => { let y = 0; while (y < l.h && !l.solid(x, y) && !l.ledge(x, y)) y++; return y; };
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

  await test('potager : écran titre, puis 9 zones, 9 lanternes, un marchand, un boss et une sortie', async () => {
    const shown = await pg.evaluate(() => !document.querySelector('.title-screen').hidden);
    await pg.click('[data-new]'); await pw(200);
    const i = await pg.evaluate(() => { const g = window.__kage, l = g.level; return [l.zones.length, l.checkpoints.length, !!l.merchant, !!l.goal, g.run.paused, g.boss?.meta.name]; });
    // une lanterne au début de chaque zone, plus quelques-unes avant les épreuves
    expect(shown && i[0] === 9 && i[1] >= 9 && i.slice(2).join() === 'true,true,false,KARASU-KASHI', `titre ${shown}, ${i.join()}`);
  });

  await test('potager : dégâts de chute — de la poutre de la serre (10 cases), KAGE se pose ; du toit (13 cases), il meurt', async () => {
    const drop = async (roof) => {
      await pg.evaluate((roof) => {
        const g = window.__kage, pl = g.player, l = g.level;
        const s = l.backdrops.find((b) => b.type === 'serre');
        // la poutre dépasse de la serre (on se laisse tomber dehors) ; le toit s'arrête à son bord
        const row = roof ? s.y0 : s.y1 - 10, col = roof ? s.x0 : s.x1 + 1;   // (le toit : par son bout gauche, rien en dessous)
        pl.x = col * 16 + 8; pl.y = row * 16; pl.fallFrom = pl.y; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.invuln = 0; pl.hp = 5; pl.setState('idle');
      }, roof);
      const key = roof ? 'ArrowLeft' : 'ArrowRight';
      await PK.down(key); await pw(220); await PK.up(key);
      let died = false;
      for (let i = 0; i < 20 && !died; i++) { await pw(60); died = await pg.evaluate(() => window.__kage.player.state === 'death'); }
      await pw(1400);
      return died;
    };
    const beam = await drop(false), roof = await drop(true);
    expect(!beam && roof, `poutre : mort ${beam}, toit : mort ${roof}`);
  });

  await test('potager : la musique démarre au premier geste, avec son introduction puis sa boucle', async () => {
    await pw(1500);
    const m = await pg.evaluate(() => { const m = window.__kage.music, v = m.voices.main; return [m.playing && m.active === 'main', v.source?.loop, v.source?.loopStart, v.source?.loopEnd, v.buffer?.duration ?? 0]; });
    expect(m[0] && m[1] && m[2] > 20 && Math.abs(m[3] - m[2] - 90) < 0.01 && m[4] >= m[3], `musique ${m.join(' / ')}`);
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

  // repères de terrain (le chapitre s'allonge : on les cherche au lieu de fixer des colonnes)
  const spots = await pg.evaluate(() => {
    const l = window.__kage.level, G = 19, top = (x) => { let y = 0; while (y < l.h && !l.solid(x, y)) y++; return y; };
    const z1 = l.zones.find((z) => z.id === '01'), z2 = l.zones.find((z) => z.id === '02');
    let wall = -1;
    for (let x = z1.x0; x < z1.x1 - 3 && wall < 0; x++) if ([0, 1, 2].every((k) => top(x + k) === G - 2)) wall = x + 1;
    let terrace = -1;
    for (let x = z2.x0; x < z2.x1 - 3 && terrace < 0; x++) if ([0, 1, 2].every((k) => top(x + k) === G - 4)) terrace = x + 1;
    return { flat: z1.x0 + 20, wall, terrace };
  });

  await test('potager : cadrage 448×252, sol en bas de l\'image', async () => {
    await pat(spots.flat); await pw(1500);
    const r = await pg.evaluate(() => { const g = window.__kage, v = g.view(); return { w: v.w, h: v.h, feet: g.player.y - g.camera.y }; });
    expect(r.w === 448 && r.h === 252 && r.feet > 252 * 0.8 && r.feet < 252 * 0.92, `vue ${r.w}×${r.h}, pieds à ${Math.round(r.feet)} px`);
  });

  await test('potager : stabilité — une marche ne bouge pas la caméra, un vrai changement de niveau la recadre d\'un seul mouvement', async () => {
    await pat(spots.wall - 4); await pw(1500);           // sol de référence (zone 1)
    const y0 = await pg.evaluate(() => window.__kage.camera.y);
    await pat(spots.wall); await pw(900);                // sur le muret, deux cases plus haut
    const y1 = await pg.evaluate(() => window.__kage.camera.y);
    await pat(spots.terrace); await pw(120);             // terrasse, quatre cases plus haut
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
    await pat(spots.flat); await pw(1500);
    const y0 = await pg.evaluate(() => window.__kage.camera.y);
    await PK.down('Space');
    let dev = 0;
    for (let i = 0; i < 12; i++) { await pw(50); dev = Math.max(dev, Math.abs((await pg.evaluate(() => window.__kage.camera.y)) - y0)); }
    await PK.up('Space'); await pw(400);
    expect(dev < 1, `la caméra a bougé de ${dev.toFixed(1)} px pendant le saut`);
  });

  await test('potager : zone morte — un petit pas ne déplace pas la caméra, une longue course si', async () => {
    await pat(spots.flat); await pw(300);
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
    const z = await pg.evaluate(() => window.__kage.level.zones.find((z) => z.id === '02').x0);
    const h = holes.find((h) => h[0] > z && h[1] === 6);
    const a = await leap(h), b = await leap(h, { dash: true });
    expect(!landed(a, h) && landed(b, h), `sans dash : colonne ${a.tx} ; avec dash : colonne ${b.tx}`);
  });

  await test('potager : le trou du sprint (zone 3) demande le sprint', async () => {
    const z = await pg.evaluate(() => window.__kage.level.zones.find((z) => z.id === '03').x0);
    const h = holes.find((h) => h[0] > z && h[1] === 5 && h[2] === h[3]);
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

  await test('potager : la grue de bambou — mur de blocs infranchissable ; dash sous les bambous, sauts muraux jusqu\'à la plateforme, shuriken dans la corde : les blocs comblent la fosse', async () => {
    const c = await pg.evaluate(() => window.__kage.level.cranes[0]);
    const s0 = c.x0 - 21, K = PK;               // début du plateau de l'énigme (la grue est 21 cases plus loin)
    const put = (tx, ty) => pg.evaluate(([tx, ty]) => { const g = window.__kage, p = g.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; p.onGround = true; p.setState('idle'); p.energy.value = 1; p.hp = 5; g.shurikens.stock = 3; }, [tx, ty]);
    // le mur de blocs bouche le passage (on est arrêté devant, même en sautant)
    await put(s0 + 9, 16); await K.down('ArrowRight'); await K.down('Space'); await pw(300); await K.up('Space'); await pw(900); await K.up('ArrowRight'); await pw(150);
    const blocked = (await PS()).tx < c.x0;
    // en marchant, le premier mur de bambous arrête KAGE ; au dash, il passe dessous
    await put(s0 + 1, 16); await K.down('ArrowRight'); await pw(900); await K.up('ArrowRight'); await pw(100);
    const walk = (await PS()).tx;
    await put(s0 + 1, 16); await K.down('ArrowRight'); await pw(120); await K.up('ArrowRight'); await K.press('ArrowRight'); await pw(30); await K.press('ArrowRight'); await pw(700);
    const dashed = (await PS()).tx;
    // sauts muraux d'un mur de bambous à l'autre, jusqu'à la plateforme de la grue
    let dir = 'ArrowRight';
    await K.down(dir); await K.down('Space'); await pw(200); await K.up('Space');
    for (let i = 0; i < 14; i++) {
      for (let t = 0; t < 40; t++) { const s = await PS(); if (s.st === 'wall_slide' || s.ground) break; await pw(15); }
      const s = await PS();
      if (s.ground && s.y <= c.top * 16 - 16) break;
      await K.press('Space'); await K.up(dir); dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'; await K.down(dir); await pw(60);
    }
    await K.up(dir); await pw(500);
    const up = await PS();
    // au bout de la plateforme, la corde est à trois cases : le sabre ne l'atteint pas, le shuriken oui
    await pg.evaluate(() => { const l = window.__kage.level, c = l.cranes[0], p = window.__kage.player; let tx = c.x0 - 1; while (tx > 0 && l.rows[c.top - 1][tx] !== '-') tx--; p.x = tx * 16 + 12; p.facing = 1; }); await pw(100);
    const reach = await pg.evaluate((c) => c.ropeX - window.__kage.player.x, c);
    await K.press('KeyC'); await pw(1500);
    const cr = await pg.evaluate(() => { const c = window.__kage.level.cranes[0], l = window.__kage.level; return { cut: c.cut, landed: c.landed, filled: l.solid(c.x0, c.top + c.h) && l.solid(c.x0, c.top + 2 * c.h - 1), open: !l.solid(c.x0, c.top) }; });
    await K.down('ArrowRight'); await pw(4400); await K.up('ArrowRight'); await pw(200);   // 12 cases de vide, la fosse comblée, puis sous le mât
    const past = (await PS()).tx;
    const saved = await SAVE();
    expect(blocked && walk < s0 + 3 && dashed > s0 + 3 && dashed < s0 + 7 && up.y === (c.top - 1) * 16 && reach > 150 && cr.cut && cr.landed && cr.filled && cr.open && past > c.x0 + 6 && saved.cranes.includes(c.id),
      `bloqué ${blocked}, marche ${walk - s0}, dash ${dashed - s0}, en haut y=${up.y} (${up.tx - s0}), corde à ${reach} px, grue ${JSON.stringify(cr)}, après ${past - s0}, sauvegarde ${saved.cranes}`);
  });

  await test('potager : la grue — loin de la plateforme : sprint, saut et dash ne mènent pas sur les blocs ; sur eux, le mât bloque', async () => {
    const c = await pg.evaluate(() => window.__kage.level.cranes[0]);
    // la grue a déjà été coupée par le test précédent : on la remet en place pour ce test
    await pg.evaluate(() => { const l = window.__kage.level, c = l.cranes[0]; c.cut = false; c.landed = false; c.drop = 0; l.fillCrane(c, c.top); });
    const edge = await pg.evaluate(() => { const l = window.__kage.level, c = l.cranes[0]; let tx = c.x0 - 1; while (tx > 0 && l.rows[c.top - 1][tx] !== '-') tx--; return tx; });
    const place = (tx) => pg.evaluate(([tx, ty]) => { const g = window.__kage, p = g.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; p.onGround = true; p.setState('idle'); p.energy.value = 1; p.hp = 5; }, [tx, c.top - 1]);
    // le meilleur élan : sprint, saut au bord, dash en l'air
    await place(edge - 4); await pw(150);
    await PK.down('ShiftLeft'); await PK.down('ArrowRight');
    for (let i = 0; i < 80; i++) { const s = await PS(); if (s.tx >= edge) break; await pw(10); }
    await PK.down('Space'); await pw(250); await PK.up('ArrowRight'); await PK.press('ArrowRight'); await PK.press('ArrowRight'); await PK.down('ArrowRight');
    let far = 0;
    for (let i = 0; i < 80; i++) { const s = await PS(); if (s.y <= c.top * 16) far = Math.max(far, s.x); if (s.ground && i > 10) break; await pw(15); }
    await PK.up('Space'); await PK.up('ArrowRight'); await PK.up('ShiftLeft'); await pw(200);
    const landed = await PS();
    // posé sur les blocs (on ne peut pas y aller, mais au cas où) : le mât empêche de passer
    await pg.evaluate(([tx, ty]) => { const g = window.__kage, p = g.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; p.onGround = true; p.setState('idle'); }, [c.x0, c.top]);
    await pw(150);
    await PK.down('ArrowRight'); await pw(300); await PK.press('Space'); await pw(500); await PK.press('Space'); await pw(600); await PK.up('ArrowRight'); await pw(400);
    const s = await PS();
    expect(far < c.x0 * 16 - 16 && landed.y > c.top * 16 && s.tx <= c.x0 + c.w - 1,
      `portée à hauteur des blocs ${Math.round(far / 16 * 10) / 10} (blocs en ${c.x0}), posé y=${landed.y}, sur les blocs puis vers la droite : colonne ${s.tx - c.x0}`);
  });

  await test('potager : la grue — un escalier de bois raide ramène du sol à la plateforme', async () => {
    const st = await pg.evaluate(() => { const p = window.__kage.level.props.find((q) => q.type === 'stair'); return { foot: p.foot, top: p.top }; });
    await pg.evaluate(([tx, ty]) => { const g = window.__kage, p = g.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; p.onGround = true; p.setState('idle'); p.energy.value = 1; p.hp = 5; }, [st.foot[0] + 2, st.foot[1]]);
    await pw(400);
    for (let i = 0; i < 6; i++) {
      for (let t = 0; t < 40 && !(await PS()).ground; t++) await pw(15);   // posé avant chaque saut
      await PK.down('ArrowLeft'); await pw(60); await PK.down('Space'); await pw(230); await PK.up('Space'); await pw(120); await PK.up('ArrowLeft'); await pw(450);
      const s = await PS();
      if (s.y === st.top[1] * 16) break;
      if (s.ground && s.tx < st.top[0]) await pg.evaluate(([tx, ty]) => { const p = window.__kage.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; }, [st.foot[0] + 2, st.foot[1]]);   // passé sous l'escalier : on recommence
    }
    const s = await PS();
    expect(s.ground && s.y === st.top[1] * 16, `KAGE y=${s.y} (plateforme : ${st.top[1] * 16}), colonne ${s.tx}`);
  });

  await test('potager : la serre se quitte par la charpente — sortie au sol bouchée par les bambous, sauts muraux dans le puits, on traverse la poutre par-dessous', async () => {
    const z = await pg.evaluate(() => { const l = window.__kage.level, z = l.zones.find((z) => z.id === '05'), sr = l.backdrops.find((b) => b.type === 'serre'); return { x0: sr.x0, x1: sr.x1 }; });
    const put = (tx, ty) => pg.evaluate(([tx, ty]) => { const g = window.__kage, p = g.player; p.x = tx * 16 + 8; p.y = ty * 16; p.vx = 0; p.vy = 0; p.onGround = true; p.setState('idle'); p.energy.value = 1; p.hp = 5; }, [tx, ty]);
    // dans le puits, contre le mur de bambous de la sortie : on ne passe pas en marchant
    await put(z.x1 - 4, 19); await PK.down('ArrowRight'); await pw(900); await PK.up('ArrowRight'); await pw(100);
    const blocked = (await PS()).tx < z.x1 - 3;
    let dir = 'ArrowRight';
    await PK.down(dir); await PK.down('Space'); await pw(200); await PK.up('Space');
    for (let i = 0; i < 16; i++) {
      for (let t = 0; t < 40; t++) { const s = await PS(); if (s.st === 'wall_slide' || s.ground) break; await pw(15); }
      const s = await PS();
      if (s.ground && s.y <= 9 * 16) break;
      await PK.press('Space'); await PK.up(dir); dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'; await PK.down(dir); await pw(60);
    }
    await PK.up(dir); await pw(400);
    const beam = await PS();
    await PK.down('ArrowRight'); await pw(1600); await PK.up('ArrowRight'); await pw(700);
    const out = await PS();
    expect(blocked && beam.y === 9 * 16 && beam.ground && out.tx > z.x1 && out.y === 19 * 16 && out.hp === 5,
      `bloqué ${blocked}, sur la poutre y=${beam.y} (${beam.ground}), dehors colonne ${out.tx - z.x1} après la serre, y=${out.y}`);
  });

  // les tests suivants repartent d'une partie neuve
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
  await pg.click('[data-new]'); await pw(200);

  await test('potager : une caisse de la grange se brise au sabre et lâche un ryō', async () => {
    const before = await pg.evaluate(() => { const l = window.__kage.level; const [k, c] = [...l.crates.entries()].find(([, c]) => c.ty === l.h - 4); return { k, tx: c.tx, n: l.crates.size, coins: l.coins.length }; });
    await pat(before.tx - 2); await pg.evaluate(() => { window.__kage.player.facing = 1; });
    await pw(80); await PK.press('KeyX');
    // attend que la lame atteigne la caisse (au plus 1,5 s), sans dépendre d'un délai fixe
    await pg.waitForFunction((n) => window.__kage.level.crates.size < n, before.n, { timeout: 1500 }).catch(() => {});
    await pw(100);
    const after = await pg.evaluate(() => { const g = window.__kage, l = g.level; return { n: l.crates.size, coins: l.coins.length, st: `${g.player.state} x=${Math.round(g.player.x)} sens=${g.player.facing}` }; });
    // un coup peut briser deux caisses d'une même pile : un ryō par caisse
    expect(after.n < before.n && after.coins - before.coins === before.n - after.n, `caisses ${before.n} → ${after.n}, ryō ${before.coins} → ${after.coins}, KAGE ${after.st}`);
  });

  await test('potager : grange — la caisse du haut retombe quand on brise celles du dessous ; les marches de foin ne se brisent pas', async () => {
    const st = await pg.evaluate(() => {
      const l = window.__kage.level, col = {};
      for (const c of l.crates.values()) (col[c.tx] ??= []).push(c.ty);
      const tx = +Object.keys(col).find((k) => col[k].length === 4);
      return { tx, rows: col[tx].sort((a, b) => a - b) };
    });
    for (const ty of [18, 17, 16]) await pg.evaluate(([tx, ty]) => window.__kage.level.breakCrates({ x: tx * 16 + 4, y: ty * 16 + 4, w: 8, h: 8 }), [st.tx, ty]);
    await pw(900);
    const after = await pg.evaluate((tx) => [...window.__kage.level.crates.values()].filter((c) => c.tx === tx).map((c) => `${c.ty}${c.fall ? '+' : ''}`), st.tx);
    // les marches de foin (« % ») : un coup de sabre n'y fait rien
    const hay = await pg.evaluate(() => {
      const l = window.__kage.level, h = l.props.find((p) => p.type === 'hay_stack' && p.y === 19 && !p.step);
      const n = l.breakCrates({ x: h.x * 16, y: 17 * 16, w: 32, h: 32 }).length;
      return { n, solid: l.solid(h.x + 1, 17) && l.solid(h.x + 1, 18) && l.solid(h.x, 18) };
    });
    expect(st.rows.join() === '15,16,17,18' && after.join() === '18' && hay.n === 0 && hay.solid, `pile ${st.rows}, après ${after}, foin ${JSON.stringify(hay)}`);
  });

  await test('potager : grange — l\'escalier de foin (incassable) mène de la marche haute à la mezzanine', async () => {
    const st = await pg.evaluate(() => {
      const l = window.__kage.level, h = l.props.find((p) => p.type === 'hay_stack' && p.step);
      return { x: h.x, n: l.breakCrates({ x: h.x * 16, y: 17 * 16, w: 32, h: 32 }).length, solid: l.solid(h.x, 17) && l.solid(h.x + 1, 18) };
    });
    await pg.evaluate((x) => { const g = window.__kage, pl = g.player; pl.x = x * 16 + 8; pl.y = 17 * 16; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle'); pl.hp = 5; pl.energy.value = 1;
      for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; } for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; } }, st.x);
    await pw(200);
    // un saut en diagonale vers la gauche, comme un joueur
    await PK.down('Space'); await PK.down('ArrowLeft'); await pw(300); await PK.up('Space'); await pw(250); await PK.up('ArrowLeft'); await pw(450);
    const s = await PS();
    expect(st.n === 0 && st.solid && s.ground && s.y === 15 * 16, `foin brisé ${st.n}, plein ${st.solid}, KAGE y=${s.y} (${s.ground})`);
  });

  await test('potager : le grenier de la grange (3e étage) se rejoint par les bottes de foin, avec ses ryō', async () => {
    const at = await pg.evaluate(() => { const l = window.__kage.level, gr = l.props.find((p) => p.type === 'grenier'); return { step: gr.step, floor: gr.floor, x0: gr.floorX0, x1: gr.floorX1, top: l.coins.filter((c) => Math.floor(c.y / 16) === gr.floor - 1 && c.x / 16 >= gr.floorX0 && c.x / 16 <= gr.floorX1 + 1).length }; });
    // KAGE sur la mezzanine, au bout, juste à droite de la botte de foin
    await pg.evaluate((sx) => { const g = window.__kage, pl = g.player; pl.x = (sx + 1) * 16 + 8; pl.y = 15 * 16; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle'); pl.hp = 5; pl.energy.value = 1;
      for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; } for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; } }, at.step.x);
    await pw(200);
    // comme un joueur : on saute, puis on se dirige
    await PK.down('Space'); await pw(110); await PK.down('ArrowLeft'); await pw(200); await PK.up('Space'); await pw(140); await PK.up('ArrowLeft'); await pw(400);
    const hay = await PS();
    await PK.down('Space'); await pw(110); await PK.down('ArrowLeft'); await pw(240); await PK.up('Space'); await pw(200); await PK.up('ArrowLeft'); await pw(400);
    const up = await PS();
    await PK.down('ArrowLeft'); await pw(1600); await PK.up('ArrowLeft'); await pw(200);
    const got = await pg.evaluate((gr) => window.__kage.level.coins.filter((c) => c.taken && Math.floor(c.y / 16) === gr.floor - 1 && c.x / 16 >= gr.x0 && c.x / 16 <= gr.x1 + 1).length, at);
    expect(at.top >= 5 && hay.y >= at.step.y0 * 16 && hay.y <= at.step.y1 * 16 && up.y === at.floor * 16 && up.ground && got >= 4, `ryō au grenier ${at.top}, sur le foin y=${hay.y}, au grenier y=${up.y} (${up.ground}), ramassés ${got}`);
  });

  await test('potager : le coffre du grenier s\'ouvre (↑, sans bouton) et donne 10 ryō ; la poutre du milieu porte 3 ryō', async () => {
    const ch = await pg.evaluate(() => { const c = window.__kage.level.chests[0]; return { id: c.id, x: c.x, y: c.y, open: c.open }; });
    const put = (x, y) => pg.evaluate(([x, y]) => { const g = window.__kage, pl = g.player; pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle'); pl.hp = 5; pl.invuln = 0;
      for (const t of g.tates) { t.x = t.home + 4000; t.cooldown = 99; } for (const w of g.waras) { w.x = w.home + 4000; w.rest = 99; } }, [x, y]);
    await put(ch.x - 12, ch.y); await pw(250);
    const label = await pg.evaluate(() => document.querySelector('.talk').hidden ? 'aucun' : document.querySelector('[data-talk]').textContent);   // plus de bouton : le coffre scintille
    const ryo0 = await pg.evaluate(() => window.__kage.save.ryo);
    await PK.press('ArrowUp'); await pw(1400);
    const st = await pg.evaluate((id) => { const l = window.__kage.level, k = l.coins.filter((c) => c.id.startsWith('k' + id)); return { open: l.chests[0].open, n: k.length, flying: k.filter((c) => c.fly).length, talk: document.querySelector('.talk').hidden }; }, ch.id);
    // on ramasse en passant devant le coffre, d'un bout à l'autre du plancher
    for (let dx = -70; dx <= 96; dx += 6) { await put(ch.x + dx, ch.y); await pw(25); }
    const ryo1 = await pg.evaluate(() => window.__kage.save.ryo);
    const saved = await SAVE();
    // poutre du milieu de la grange : 3 ryō, ramassés debout dessus
    const beam = await pg.evaluate(() => { const l = window.__kage.level, gr = l.props.find((p) => p.type === 'grenier');
      return l.coins.filter((c) => c.x / 16 > gr.gx0 + 20 && c.x / 16 < gr.gx1 && Math.floor(c.y / 16) === 13).map((c) => c.x); });
    for (const x of beam) { await put(x, 14 * 16); await pw(40); }
    const beamGot = await pg.evaluate((xs) => window.__kage.level.coins.filter((c) => xs.includes(c.x) && c.taken).length, beam);
    expect(label === 'aucun' && st.open && st.n === 10 && st.flying === 0 && st.talk && ryo1 - ryo0 === 10
      && saved.chests.includes(ch.id) && beam.length === 3 && beamGot === 3,
      `bouton « ${label} », coffre ${JSON.stringify(st)}, ryō +${ryo1 - ryo0}, sauvegarde ${saved.chests}, poutre ${beam.length} (ramassés ${beamGot})`);
  });

  await test('potager : le toit de la grange cache le grenier, et s\'efface quand KAGE monte sur la mezzanine', async () => {
    const put = (tx, ty) => pg.evaluate(([tx, ty]) => { const pl = window.__kage.player; pl.x = tx * 16 + 8; pl.y = ty * 16; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle'); }, [tx, ty]);
    const alpha = () => pg.evaluate(() => window.__kage.level.art.live.attic.alpha);
    const g0 = await pg.evaluate(() => window.__kage.level.props.find((p) => p.type === 'grenier').gx0);
    await put(g0 + 12, 19); await pw(700); const sol = await alpha();
    await put(g0 + 11, 15); await pw(700); const haut = await alpha();
    await put(g0 + 12, 19); await pw(700); const retour = await alpha();
    expect(sol > 0.95 && haut < 0.2 && retour > 0.95, `opacité du toit : au sol ${sol.toFixed(2)}, sur la mezzanine ${haut.toFixed(2)}, de retour au sol ${retour.toFixed(2)}`);
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
    // la première lanterne encore éteinte (les tests précédents ont pu en allumer)
    const k = await pg.evaluate(() => { const l = window.__kage.level, i = l.checkpoints.findIndex((c) => !c.lit); return { i, x: l.checkpoints[i].x }; });
    await pat(Math.floor(k.x / 16) - 2); await PK.down('ArrowRight'); await pw(500); await PK.up('ArrowRight'); await pw(150);
    const icon = await pg.evaluate(() => document.querySelector('.saved').classList.contains('on'));
    const s = await SAVE();
    expect(s && s.checkpoint === k.i && s.checkpointX === k.x && icon, `point de reprise ${s && s.checkpoint} (${s && s.checkpointX}) / attendu ${k.i} (${k.x}), icône ${icon}`);
  });

  await test('potager : un point de reprise au début de chaque zone (2 à 9)', async () => {
    const r = await pg.evaluate(() => { const l = window.__kage.level; return l.zones.slice(1).map((z) => [z.id, l.checkpoints.some((c) => c.x >= z.px0 - 4 * 16 && c.x <= z.px0 + 8 * 16)]); });
    const missing = r.filter(([, ok]) => !ok).map(([id]) => id);
    expect(missing.length === 0, `zones sans point de reprise : ${missing.join(', ')}`);
  });

  await test('potager : « Continuer » reprend à la dernière lanterne, avec les ryō et le coffre ouvert', async () => {
    const before = await SAVE();
    await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
    const cont = await pg.evaluate(() => !document.querySelector('[data-continue]').hidden);
    await pg.click('[data-continue]'); await pw(300);
    const r = await pg.evaluate((lx) => { const g = window.__kage, l = g.level; return { px: g.player.x, lx, taken: l.coins.filter((c) => c.taken).map((c) => c.id),
      chest: l.chests[0].open, chestCoins: l.coins.filter((c) => c.id.startsWith('k')).length }; }, before.checkpointX);
    expect(cont && Math.abs(r.px - r.lx) < 24 && before.coins.every((id) => r.taken.includes(id)) && r.chest && r.chestCoins === 10,
      `continuer ${cont}, KAGE ${Math.round(r.px)} / lanterne ${r.lx}, coffre ouvert ${r.chest} (${r.chestCoins} ryō)`);
  });

  await test('potager : une sauvegarde d\'avant les nouvelles lanternes reprend à la bonne lanterne', async () => {
    // ancienne sauvegarde : seulement l'indice (1) parmi les 3 lanternes d'origine
    const want = await pg.evaluate(() => {
      const l = window.__kage.level, cols = new Set(l.legacyCheckpoints);
      const old = l.checkpoints.filter((k) => cols.has(Math.floor(k.x / 16))).sort((a, b) => a.y - b.y || a.x - b.x);
      const s = JSON.parse(localStorage.getItem('kage.save.v1'));
      localStorage.setItem('kage.save.v1', JSON.stringify({ ...s, checkpoint: 1, checkpointX: undefined }));
      return { x: old[1].x, cols: l.legacyCheckpoints.length };
    });
    await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
    await pg.click('[data-continue]'); await pw(300);
    const r = await pg.evaluate(() => { const g = window.__kage; return { px: g.player.x, lit: g.level.checkpoints.filter((c) => c.lit).length }; });
    const lit = await pg.evaluate((x) => window.__kage.level.checkpoints.filter((c) => c.x <= x).length, want.x);
    expect(want.cols === 3 && Math.abs(r.px - want.x) < 24 && r.lit === lit, `KAGE ${Math.round(r.px)} / lanterne ${want.x}, allumées ${r.lit}/${lit}`);
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

  await test('potager : boutique plein écran — tous les skins en vente ; une carte ouvre le skin en grand ; l\'achat se confirme, se porte et est sauvegardé', async () => {
    const mx = await pg.evaluate(() => Math.floor(window.__kage.level.merchant.x / 16));
    await pat(mx - 1); await pw(200);
    const before = await pg.evaluate(() => window.__kage.save.ryo);
    await pg.evaluate(() => { window.__kage.save.ryo = 40; });
    await PK.press('ArrowUp'); await pw(200);
    // tout l'écran de jeu, et les douze skins (du moins cher au plus cher)
    const look = await pg.evaluate(() => { const s = document.querySelector('.shop').getBoundingClientRect(), g = document.querySelector('#game').getBoundingClientRect();
      return [Math.abs(s.width - g.width) < 4 && Math.abs(s.height - g.height) < 4, [...document.querySelectorAll('.shop__card')].map((c) => c.dataset.skin).join()]; });
    const detail = () => pg.evaluate(() => [document.querySelector('.shop__name')?.textContent, document.querySelector('[data-action]')?.textContent ?? '', !!document.querySelector('[data-confirm]')]);
    await pg.click('[data-skin="paysan"]'); await pw(100);
    const shown = await detail();
    // trop pauvre : pas de confirmation, rien ne change
    await pg.click('[data-action]'); await pw(100);
    const poor = [...await detail(), ...await pg.evaluate(() => [window.__kage.save.ryo, window.__kage.skin])];
    await pg.evaluate(() => { window.__kage.save.ryo = 130; });
    await pg.click('[data-action]'); await pw(100);
    const ask = await detail();
    await pg.click('[data-confirm]'); await pw(100);
    const bought = await pg.evaluate(() => [window.__kage.save.ryo, window.__kage.skin, document.querySelector('[data-purse]').textContent,
      document.querySelector('[data-action]').textContent, document.querySelector('[data-skin="paysan"] .shop__tag').textContent]);
    // retour à Encre puis de nouveau le paysan, sans payer
    await pg.click('[data-skin="encre"]'); await pw(100);
    await pg.click('[data-action]'); await pw(100);
    const back = await pg.evaluate(() => [window.__kage.skin, document.querySelector('[data-skin="paysan"] .shop__tag').textContent]);
    await pg.click('[data-skin="paysan"]'); await pw(100);
    await pg.click('[data-action]'); await pw(100);
    await PK.press('Escape'); await pw(200);
    const saved = await SAVE();
    expect(look[0] && look[1] === 'encre,voyageur,paysan'
      && shown.join() === 'Paysan des rizières,Acheter · 100 ryō,false' && poor.join() === 'Paysan des rizières,Acheter · 100 ryō,false,40,encre'
      && ask[2] === true && bought.join() === '30,paysan,30 ryō,Porté,Porté' && back.join() === 'encre,Acquis'
      && saved.skin === 'paysan' && saved.skins.join() === 'encre,paysan' && saved.ryo === 30,
      `écran ${look.join(' ')} · détail ${shown.join()} · pauvre ${poor.join()} · question ${ask.join()} · acheté ${bought.join()} · retour ${back.join()} · sauvegarde ${saved.skin} ${saved.skins} ${saved.ryo}`);
    await pg.evaluate((r) => { window.__kage.save.ryo = r; window.__kage.save.skin = 'encre'; window.__kage.save.skins = ['encre']; }, before);
  });

  await test('introduction : un geste la lance, l\'encre, la lune, KAGE figé au centre de la lune ; une touche la passe, le menu lance la partie et l\'intro s\'efface', async () => {
    const ictx = await rawNewContext({ viewport: { width: 1280, height: 720 } }), ip = await ictx.newPage();
    await ip.goto(PAGE); await ip.waitForFunction(() => window.__kage && window.__kage.intro);
    await ip.evaluate(() => localStorage.clear()); await ip.reload(); await ip.waitForFunction(() => window.__kage && window.__kage.intro);
    // elle attend le geste qui lance l'intro et sa musique (sauf si le navigateur joue déjà du son)
    await ip.waitForTimeout(300);
    const g = await ip.evaluate(() => [window.__kage.intro.gated, window.__kage.intro.t]);
    if (g[0]) { await ip.keyboard.press('KeyX'); }
    await ip.waitForTimeout(600);
    const a = await ip.evaluate(() => { const it = window.__kage.intro, v = window.__kage.view(), t = document.querySelector('.title-screen');
      return [it.el.width === v.w && it.el.height === v.h, t.classList.contains('waiting'), window.__kage.run.paused, it.t > 0 && it.t < 6,
        it.titleY > it.moonY1 + 40 && it.menuY + 16 <= v.h]; });
    await ip.keyboard.press('KeyZ');
    await ip.waitForFunction(() => document.activeElement?.dataset.new != null, null, { timeout: 3000 }).catch(() => {});
    const b = await ip.evaluate(() => { const it = window.__kage.intro; const k = it.kage(it.t), s = it.silhouette(k.i);
      return [it.menuShown, document.querySelector('.title-screen').classList.contains('waiting'), k.i === window.__kage.intro.meta.intro.hold, document.activeElement?.dataset.new != null, Math.abs(k.x + s.cx - it.moonX) <= 1 && Math.abs(k.y + s.cy - it.moonY1) <= 1]; });
    await ip.click('[data-new]'); await ip.waitForTimeout(400);
    const c = await ip.evaluate(() => [document.querySelector('.title-screen').hidden, window.__kage.intro?.el.classList.contains('out'), window.__kage.run.paused]);
    await ip.waitForTimeout(1600);
    const d = await ip.evaluate(() => [window.__kage.intro, document.querySelectorAll('.intro').length]);
    // jouée jusqu'au bout (en accéléré, par la boucle de l'intro elle-même) : le menu arrive, KAGE est figé en coup de pied
    const ip2 = await ictx.newPage();
    await ip2.goto(PAGE); await ip2.waitForFunction(() => window.__kage && window.__kage.intro);
    const e = await ip2.evaluate(() => { const it = window.__kage.intro, title = document.querySelector('.title-screen'); it.stop(); it.begin(false);
      for (let i = 0; i < 16 * 60; i++) { it.update(1 / 60); it.draw(); }
      const r = [it.menuShown, it.kage(it.t).i === it.meta.intro.hold, title.classList.contains('waiting')];
      // la musique finie (≈ 64 s) : fondu au noir, le menu s'efface, puis tout recommence depuis le noir
      let faded = false;
      for (let i = 0; i < 52 * 60; i++) { it.update(1 / 60); if (it.fading && title.classList.contains('waiting')) faded = true; if (it.t < 1) break; }
      return [...r, faded, it.t < 1 && !it.menuShown && !it.gated]; });
    // comme dans un artefact claude.ai : le son est encore suspendu au moment du geste qui lance l'intro
    // (il ne se débloque qu'un instant après) ; la musique doit quand même partir
    const ip3 = await ictx.newPage();
    await ip3.goto(PAGE); await ip3.waitForFunction(() => window.__kage && window.__kage.intro); await ip3.waitForTimeout(500);
    await ip3.evaluate(async () => { const it = window.__kage.intro; if (it.out) { it.stopVoice(0); await it.out.ac.suspend(); } it.gated = true; it.clock = null; });
    // au clic : le bouton qui se pose ne la lance pas encore (pas partout permis pour le son), le bouton relâché si
    await ip3.mouse.move(640, 300); await ip3.mouse.down(); await ip3.waitForTimeout(80);
    const waited = await ip3.evaluate(() => window.__kage.intro.gated);
    await ip3.mouse.up();
    const heard = await ip3.waitForFunction(() => window.__kage.intro.clock && window.__kage.intro.voice, null, { timeout: 4000 }).then(() => true, () => false);
    // l'intro déjà lancée sans musique (le premier geste n'a rien débloqué) : le geste suivant la relance
    await ip3.evaluate(async () => { const it = window.__kage.intro; it.stopVoice(0); await it.out.ac.suspend(); it.clock = null; });
    await ip3.keyboard.press('KeyX');
    const again = await ip3.waitForFunction(() => window.__kage.intro.clock && window.__kage.intro.voice, null, { timeout: 4000 }).then(() => true, () => false);
    await ictx.close();
    expect(waited && heard && again, `la musique de l'intro (attente au bouton posé : ${waited}, part au clic : ${heard}, au geste suivant : ${again})`);
    expect(e.join() === 'true,true,false,true,true', `jouée jusqu'au bout, puis en boucle ${e}`);
    expect(a.join() === 'true,true,true,true,true' && (g[0] || g[1] > 0) && b.join() === 'true,false,true,true,true' && c.join() === 'true,true,false' && d.join() === ',0',
      `début ${a} · passée ${b} · lancée ${c} · retirée ${d}`);
  });

  await test('version de test : pas d\'écran titre ; le panneau change le skin (clic, touches), saute de zone en zone et liste les chapitres', async () => {
    const lp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await lp.goto('file://' + path.resolve(__dirname, '../dist/kage-test.html')); await lp.waitForFunction(() => window.__kage);
    await lp.evaluate(() => localStorage.clear()); await lp.reload(); await lp.waitForFunction(() => window.__kage); await lp.waitForTimeout(400);
    const r0 = await lp.evaluate(() => [document.querySelector('.title-screen').hidden, window.__kage.run.paused, window.__kage.skin, document.querySelectorAll('.skinlab button').length]);
    await lp.keyboard.press('2'); await lp.waitForTimeout(100);
    const r2 = await lp.evaluate(() => window.__kage.skin);
    await lp.click('.skinlab [data-skin="encre"]'); await lp.waitForTimeout(100);
    const r1 = await lp.evaluate(() => window.__kage.skin);
    // zone suivante, deux fois : KAGE est posé dans la zone 3, à sa lanterne
    await lp.click('[data-zone="next"]'); await lp.waitForTimeout(150);
    await lp.click('[data-zone="next"]'); await lp.waitForTimeout(400);
    const z = await lp.evaluate(() => { const k = window.__kage, zo = k.level.zoneAt(k.player.x); return [zo.id, document.querySelector('[data-zones] span').textContent, k.player.onGround || k.player.state === 'respawn' || k.player.state === 'idle']; });
    const chapters = await lp.evaluate(() => [...document.querySelectorAll('[data-lab-chapter]')].map((b) => `${b.dataset.labChapter}:${b.getAttribute('aria-pressed')}`));
    await lp.close();
    expect(r0.join() === 'true,false,encre,3' && r2 === 'paysan' && r1 === 'encre' && z[0] === '03' && z[1] === 'Zone 03' && chapters[0] === 'potager:true',
      `ouverture ${r0.join()}, touche 2 ${r2}, clic ${r1}, zone ${z.join()}, chapitres ${chapters.join()}`);
  });

  await test('version de test : tous les skins se portent sans achat', async () => {
    const tp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await tp.goto('file://' + path.resolve(__dirname, '../dist/kage-test.html')); await tp.waitForFunction(() => window.__kage);
    await tp.evaluate(() => localStorage.clear()); await tp.reload(); await tp.waitForFunction(() => window.__kage); await tp.waitForTimeout(300);
    await tp.evaluate(() => {
      const g = window.__kage, pl = g.player, l = g.level, tx = Math.floor(l.merchant.x / 16) - 1;
      let ty = l.h - 1; while (ty > 0 && l.solid(tx, ty - 1)) ty--;
      pl.x = tx * 16 + 8; pl.y = ty * 16; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle');
    });
    await tp.waitForTimeout(300);
    await tp.keyboard.press('ArrowUp'); await tp.waitForTimeout(200);
    await tp.click('[data-skin="paysan"]'); await tp.waitForTimeout(100);
    const label = await tp.evaluate(() => document.querySelector('[data-action]')?.textContent);
    await tp.click('[data-action]'); await tp.waitForTimeout(100);
    const r = await tp.evaluate(() => [window.__kage.skin, window.__kage.save.ryo]);
    await tp.close();
    expect(label === 'Porter' && r.join() === 'paysan,0', `bouton ${label}, skin ${r.join()}`);
  });

  // ---- zone 9 : KARASU-KASHI, le corbeau du potager ----
  const B = await pg.evaluate(() => { const b = window.__kage.boss; return { a0: b.arena[0] / 16, a1: b.arena[1] / 16, ground: b.groundY }; });
  const gateOpen = () => pg.evaluate((a1) => { const l = window.__kage.level; return !l.solid(a1, l.boss.y - 1); }, B.a1);

  await test('potager : zone 9 — le corbeau attend sur son épouvantail, la porte du temple est fermée', async () => {
    // juste avant l'arène : le combat commence dès qu'on y entre (KARASU.engageX)
    await pat(B.a0 - 1); await pw(300);
    const r = await pg.evaluate(() => { const b = window.__kage.boss; return [b.state, b.engaged, document.querySelector('.boss').classList.contains('on')]; });
    expect(r.join() === 'perch,false,false' && !(await gateOpen()), `corbeau ${r.join()}, porte ouverte ${await gateOpen()}`);
  });

  await test('potager : en entrant dans l\'arène, il croasse sur son perchoir (la musique du combat monte), puis s\'envole ; sa barre de vie apparaît en haut', async () => {
    await pat(B.a0 + 9); await pw(1600);
    const r = await pg.evaluate(() => { const b = window.__kage.boss; return [b.engaged, b.flying, b.state, document.querySelector('.boss').classList.contains('on'), window.__kage.music.active]; });
    await pw(2800);
    const later = await pg.evaluate(() => window.__kage.boss.flying);
    expect(r.join() === 'true,false,taunt,true,boss' && later, `à 1,6 s : engagé, en vol, état, barre, musique ${r.join()} ; à 4,4 s en vol ${later}`);
  });

  await test('potager : plongeon — debout, KAGE est touché (2) ; en glissade, il passe dessous', async () => {
    const r = await pg.evaluate(() => {
      const g = window.__kage, b = g.boss, hb = g.player.meta.hitbox, piv = g.player.meta.pivot, out = [];
      for (const kind of ['default', 'slide']) for (const side of [-1, 1]) for (const dist of [70, 96, 130]) {
        const h = hb[kind], px = (b.arena[0] + b.arena[1]) / 2;
        const fake = { x: px, y: b.groundY, vx: 0, state: kind === 'slide' ? 'slide' : 'idle', facing: -side, dmg: 0,
          box() { const ox = this.facing > 0 ? h.x - piv.x : piv.x - (h.x + h.w); return { x: this.x + ox, y: this.y - piv.y + h.y, w: h.w, h: h.h }; },
          hurt(d) { this.dmg += d; return true; } };
        b.reset(); b.engaged = true; b.x = px + side * dist; b.y = b.groundY - 50;
        b.startDive(fake, 0);
        for (let n = 0; n < 600 && b.state === 'dive'; n++) { b.update(1 / 120, fake); b.interact(fake); }
        out.push(`${kind}:${fake.dmg}:${b.state}`);
      }
      b.reset();
      return out;
    });
    const bad = r.filter((x) => !(x.startsWith('default') ? x.endsWith(':2:pullup') : x.endsWith(':0:crash')));
    expect(bad.length === 0, bad.join(' '));
  });

  await test('potager : en vol (2× plus haut), hors de portée depuis le sol ; d\'une plateforme, saut + sabre : il tombe bec planté et les plateformes s\'effondrent ; planté, le sabre le blesse', async () => {
    // le corbeau, une pierre dans les serres, au-dessus de KAGE (au sol ou sur une plateforme)
    const put = (onScaffold) => pg.evaluate(([onScaffold, a]) => {
      const g = window.__kage, b = g.boss, pl = g.player, l = g.level, sc = l.scaffolds[0];
      b.reset(); b.engaged = true;
      const x = onScaffold ? (sc.x0 + 1) * 16 + 8 : (a[0] + a[1]) * 8, y = onScaffold ? sc.row * 16 : b.groundY;
      pl.x = x; pl.y = y; pl.facing = 1; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.setState('idle'); pl.hp = 5; pl.invuln = 9; pl.energy.value = 1; g.shurikens.reset();
      b.setState('carry'); b.carry = { size: 0 }; b.rocksLeft = 3; b.x = x + 4; b.y = b.groundY - 76; b.facing = -1;
      return b.hp;
    }, [onScaffold, [B.a0, B.a1]]);
    const st = () => pg.evaluate(() => { const b = window.__kage.boss; return { hp: b.hp, st: b.state, up: window.__kage.level.scaffolds.map((s) => s.up).join('') }; });
    // depuis le sol : saut + sabre, puis saut + shuriken
    const h0 = await put(false);
    await PK.down('Space'); await pw(230); await PK.press('KeyX'); await pw(60); await PK.up('Space'); await pw(500);
    const sword = await st();
    await put(false);
    await PK.down('Space'); await pw(250); await PK.press('KeyC'); await PK.up('Space'); await pw(500);
    const shur = await st();
    // depuis la plateforme basse : saut + sabre
    await put(true);
    await PK.down('Space'); await pw(230); await PK.press('KeyX'); await pw(60); await PK.up('Space'); await pw(250);
    const knock = await st();
    await pw(1800);
    const after = await st();
    // planté dans le sol : le sabre le blesse
    await pg.evaluate(([a0, a1]) => { const g = window.__kage, b = g.boss, pl = g.player, x = (a0 + a1) * 8;
      pl.x = x; pl.y = b.groundY; pl.facing = 1; pl.vx = 0; pl.setState('idle'); pl.invuln = 9; b.setState('stuck'); b.x = x + 22; b.y = b.groundY; b.play('stuck'); }, [B.a0, B.a1]);
    const before = (await st()).hp;
    await PK.press('KeyX'); await pw(450);
    const stuck = (await st()).hp;
    expect(sword.hp === h0 && shur.hp === h0 && knock.st === 'knocked' && knock.hp < h0 && ['crash', 'stuck'].includes(after.st) && after.up === 'falsefalsefalsefalse' && stuck === before - 2,
      `sol : sabre ${sword.hp}/${sword.st}, shuriken ${shur.hp} ; plateforme : ${JSON.stringify(knock)} puis ${JSON.stringify(after)} ; planté ${before} → ${stuck}`);
    await pg.evaluate(() => window.__kage.boss.reset());
  });

  await test('potager : les plateformes restent debout tant qu\'il ne s\'est pas écrasé ; il ne plonge qu\'une fois elles tombées, en arc', async () => {
    const r = await pg.evaluate(([a0, a1]) => {
      const g = window.__kage, b = g.boss, l = g.level, x = (a0 + a1) * 8;
      const fake = { x, y: b.groundY, vx: 0, state: 'idle', box() { return { x: this.x - 4, y: this.y - 22, w: 9, h: 22 }; }, hurt() { return true; } };
      const run = (secs) => { const seen = new Set(); for (let n = 0; n < secs * 120; n++) { b.update(1 / 120, fake); l.update(1 / 120); seen.add(b.state); } return seen; };
      b.reset(); b.engaged = true; b.setState('taunt');
      const withUp = run(25);
      l.collapseScaffolds(x); run(1);
      b.reset(); l.collapseScaffolds(x); b.engaged = true; b.setState('taunt');
      // reset() les a relevées : on les refait tomber pour la suite
      for (const s of l.scaffolds) { s.up = false; s.fallAt = -9; }
      l.update(1 / 120);
      const ys = [];
      let dove = false;
      for (let n = 0; n < 40 * 120 && !dove; n++) { b.update(1 / 120, fake); if (b.state === 'dive') { ys.push(b.y); } else if (ys.length) dove = true; }
      // l'arc : il remonte d'abord un peu, puis descend jusqu'au sol
      const minY = Math.min(...ys), riseFirst = ys.length > 3 && minY < ys[0] - 2;
      const out = { grabbed: withUp.has('grab'), thrown: withUp.has('release'), noDiveWhileUp: !withUp.has('dive'), dove: ys.length > 0, riseFirst, ends: b.state };
      b.reset();
      return out;
    }, [B.a0, B.a1]);
    expect(r.grabbed && r.thrown && r.noDiveWhileUp && r.dove && r.riseFirst && ['crash', 'stuck'].includes(r.ends), JSON.stringify(r));
  });

  await test('potager : vaincu, il s\'affale ; le talisman se déchire et la porte du temple s\'ouvre (sauvegardé)', async () => {
    await pg.evaluate(([a0, a1]) => {
      const g = window.__kage, b = g.boss, pl = g.player, x = (a0 + a1) * 8;
      pl.x = x; pl.y = b.groundY; pl.facing = 1; pl.setState('idle'); pl.invuln = 9;
      b.reset(); b.engaged = true; b.setState('stuck'); b.hp = 2; b.x = x + 22; b.y = b.groundY;
    }, [B.a0, B.a1]);
    await PK.press('KeyX'); await pw(300);
    const st = await pg.evaluate(() => window.__kage.boss.state);
    const closed = !(await gateOpen());
    // la porte est loin, hors de l'image : elle attend que KAGE la voie
    await pw(2500);
    const stillClosed = !(await gateOpen()) && !(await pg.evaluate(() => window.__kage.level.doorOpen));
    // KAGE s'approche : elle s'ouvre devant lui (le talisman se déchire, puis les vantaux, lentement)
    await pat(B.a1 - 7); await pw(4200);
    const s = await SAVE();
    const bar = await pg.evaluate(() => document.querySelector('.boss').classList.contains('on'));
    expect(st === 'defeated' && closed && stillClosed && (await gateOpen()) && s.bossDefeated && !bar, `état ${st}, fermée juste après ${closed}, toujours fermée hors de vue ${stillClosed}, ouverte devant KAGE ${await gateOpen()}, sauvegarde ${s.bossDefeated}, barre ${bar}`);
  });

  await test('potager : « Continuer » après sa défaite — il reste vaincu ; la porte s\'ouvre devant KAGE', async () => {
    await pg.reload(); await pg.waitForFunction(() => window.__kage); await pw(300);
    await pg.click('[data-continue]'); await pw(300);
    const st = await pg.evaluate(() => window.__kage.boss.state);
    await pat(B.a1 - 7); await pw(4200);
    expect(st === 'defeated' && (await gateOpen()), `corbeau ${st}, porte ouverte ${await gateOpen()}`);
  });

  await test('potager : la sortie mène au chapitre 2 — fondu au noir, titre de la Forêt, la partie continue (ryō gardés)', async () => {
    const gx = await pg.evaluate(() => Math.floor(window.__kage.level.goal.x / 16));
    const ryo0 = (await SAVE()).ryo;
    // KAGE continue d'avancer, passe derrière la porte (on ne le voit plus), puis le fondu
    await pat(gx - 8); await PK.down('ArrowRight'); await pw(2600); await PK.up('ArrowRight'); await pw(600);
    const card = await pg.evaluate(() => { const c = document.querySelector('.chapter-card'); return [!c.hidden, c.textContent.replace(/\s+/g, ' ').trim()]; });
    const s = await SAVE();
    expect(card[0] && /La Forêt/.test(card[1]) && s.chapter === 'foret' && s.intro && s.ryo === ryo0, `carte ${card.join(' / ')}, sauvegarde ${JSON.stringify(s && { c: s.chapter, ryo: s.ryo, intro: s.intro })}`);
    // la page se recharge sur la Forêt : pas d'écran titre, KAGE au départ, la carte s'efface
    await pg.waitForFunction(() => window.__kage && window.__kage.level.theme === 'foret', null, { timeout: 20000 });
    await pw(800);
    const r = await pg.evaluate(() => [document.querySelector('.title-screen').hidden, Math.floor(window.__kage.player.x / 16), !document.querySelector('.chapter-card').hidden]);
    await pw(5000);
    const r2 = await pg.evaluate(() => [document.querySelector('.chapter-card').hidden, window.__kage.save.ryo]);
    expect(r[0] && r[1] < 10 && r[2] && r2[0] && r2[1] === ryo0, `forêt : titre caché ${r[0]}, colonne ${r[1]}, carte ${r[2]} → ${r2.join(' / ')}`);
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
