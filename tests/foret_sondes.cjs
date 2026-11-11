// Sondes de mise au point de la Forêt (pas des tests) : après « npm run standalone »,
//   PROBES=tests/foret_sondes_liste.js node tests/foret_sondes.cjs z3 z4 z7 z8b z9 z10 z11a z12
// Chaque sonde pilote KAGE (tests/foret_bot.js) dans une zone et affiche ce qui s'est passé.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const P = {
  z1: () => { const z = __kage.level.zones; bot.place(4); const t = bot.runner(40, { until: (p) => p.x > z[1].x0 * 16 + 40 }); return ['z1', t, bot.col(), bot.row(), bot.p.state, __kage.save.ryo]; },
  z2a: () => { const z = __kage.level.zones[1]; bot.place(z.x0 + 2); bot.runner(6, { until: (p) => p.x > (z.x0 + 16) * 16 }); const a = [bot.col(), bot.row()];
    const t = bot.wallClimb(8, 44, 1); const b2 = [bot.col(), bot.row(), bot.p.state]; bot.runner(3); return ['z2a', a, t, b2, bot.col(), bot.row()]; },
  z2: () => { const z = __kage.level.zones; bot.place(z[1].x0 + 2); const log = [];
    for (let i = 0; i < 6 && bot.p.x < z[2].x0 * 16; i++) { bot.runner(10, { until: (p) => p.x > z[2].x0 * 16 || (p.onGround && p.vx === 0 && __kage.level.solid(Math.floor(p.x / 16) + 1, Math.round(p.y / 16) - 4)) });
      log.push(['mur', bot.col(), bot.row()]); if (bot.p.x > z[2].x0 * 16) break; const top = bot.row() - (i === 0 ? 6 : 9); bot.wallClimb(10, top, 1); log.push(['haut', bot.col(), bot.row()]); }
    return ['z2', log, bot.col(), z[2].x0]; },
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve('dist/kage-test.html') + '#foret'); await p.waitForFunction(() => window.__kage);
  await p.addScriptTag({ content: fs.readFileSync('tests/foret_bot.js', 'utf8') });
  const extra = process.env.PROBES ? fs.readFileSync(process.env.PROBES, 'utf8') : '';
  for (const name of process.argv.slice(2)) {
    const src = extra ? `(() => { const P = {}; ${extra}; return P['${name}'](); })()` : `(${P[name].toString()})()`;
    try { console.log(JSON.stringify(await p.evaluate(src))); } catch (e) { console.log(name, 'ERREUR', e.message.split('\n')[0]); }
  }
  await b.close();
})();
