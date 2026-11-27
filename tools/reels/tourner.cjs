// Tournage d'un Reel : le jeu (npx vite preview, port 5290) piloté image par image par l'horloge de Playwright.
//   node tools/reels/tourner.cjs <dossier> shoot [x du saut] [x d'entrée]  (dry : à blanc, sans images)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [, , S, mode = 'dry', JUMPX = '230', ENTRY = '20'] = process.argv;
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1800, height: 1180 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.clock.install();
  await pg.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; window.__KAGE_CLEAN = true; sessionStorage.setItem('kage-go', 'new'); });
  await pg.goto('http://localhost:5290/');
  for (let i = 0; i < 40 && !(await pg.evaluate(() => !!window.__kage?.level && !window.__kage.run.title)); i++) await pg.clock.runFor(100);
  await pg.addStyleTag({ content: '.ui, header, footer, .state { visibility: hidden !important; }' });
  // l'horloge du jeu ne bouge plus d'elle-même : seul runFor la fait avancer (sinon chaque capture, lente, laisse le jeu tourner)
  await pg.clock.pauseAt(await pg.evaluate(() => Date.now() + 200));
  await pg.evaluate(() => { const k = window.__kage, d = k.player.draw; k.player.draw = function (...a) { if (!window.__hide) d.apply(this, a); }; window.__hide = true; k.cycle.t = 464; });
  await pg.clock.runFor(1200);
  const box = await pg.locator('#game').boundingBox();
  const N = 285, log = [], ENTRYF = 75;
  // l'heure : de la fin de la nuit (t = −16) au matin (t = +38), de plus en plus lentement
  const T = (s) => { const u = Math.min(1, s / 7.5); return ((-16 + 54 * (1 - (1 - u) ** 1.6)) + 480) % 480; };
  let phase = 0, jf = 0;
  for (let f = 0; f < N; f++) {
    const s = f / 30;
    await pg.evaluate((t) => { window.__kage.cycle.t = t; }, T(s));
    if (f === ENTRYF) {
      await pg.evaluate((x) => { const p = window.__kage.player; p.x = x; p.vx = 0; window.__hide = false; }, +ENTRY);
      await pg.keyboard.down('ArrowRight'); phase = 1;
    }
    const st = await pg.evaluate(() => { const k = window.__kage, p = k.player; return { x: p.x, y: p.y, cx: k.camera.x, cy: k.camera.y, g: p.onGround, s: p.state, fl: !!p.flip }; });
    if (phase === 1 && st.x >= +JUMPX) { await pg.keyboard.down('Space'); phase = 2; jf = f; }
    else if (phase === 2 && f === jf + 4) { await pg.keyboard.up('Space'); phase = 3; }
    else if (phase === 3 && f === jf + 5) { await pg.keyboard.down('Space'); phase = 4; }
    else if (phase === 4 && f === jf + 9) { await pg.keyboard.up('Space'); phase = 5; }
    else if (phase === 5 && f > jf + 14 && st.g) { await pg.keyboard.up('ArrowRight'); phase = 6; }
    await pg.clock.runFor(1000 / 30);
    log.push({ f, ...st, hide: f < ENTRYF });
    if (mode === 'shoot') await pg.screenshot({ path: `${S}/frames/g${String(f).padStart(4, '0')}.png`, clip: box });
  }
  fs.writeFileSync(`${S}/track.json`, JSON.stringify(log));
  for (const l of log.filter((l, i) => i % 6 === 0 || (l.f > 125 && l.f < 160))) if (l.f >= 54) console.log(l.f, Math.round(l.x), Math.round(l.x - l.cx), Math.round(l.y), l.g, l.s, l.fl);
  await b.close();
})();
