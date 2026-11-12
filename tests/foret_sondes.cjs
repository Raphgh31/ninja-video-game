// Sondes de mise au point de la Forêt (pas des tests) : après « npm run standalone »,
//   node tests/foret_sondes.cjs z3 z4 z6b v10 z9 z11a z12
// Chaque sonde (tests/foret_pilotes.js) pilote KAGE dans une zone et affiche ce qui s'est passé.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } }); await p.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve('dist/kage-test.html') + '#foret'); await p.waitForFunction(() => window.__kage);
  for (const f of [path.join(__dirname, 'foret_bot.js'), process.env.PILOTES || path.join(__dirname, 'foret_pilotes.js')]) await p.addScriptTag({ content: fs.readFileSync(f, 'utf8') });
  for (const name of process.argv.slice(2)) {
    try { console.log(JSON.stringify(await p.evaluate((n) => P[n](), name))); } catch (e) { console.log(name, 'ERREUR', e.message.split('\n')[0]); }
  }
  await b.close();
})();
