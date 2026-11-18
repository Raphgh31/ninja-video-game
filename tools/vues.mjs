// Captures d'une carte (arènes, chapitres) servie par Vite, pour montrer un rendu.
//   node tools/vues.mjs <ancre> <préfixe de sortie> <colonne>[,<rangée du sol>] …
// KAGE est posé à chaque colonne (sans rangée : sur le plus haut sol plein), puis on photographie
// la zone de jeu. Variables : VW, VH (fenêtre), MOBILE (téléphone, échelle 3), SEL (élément à
// photographier), WAIT (ms), T (arène : instant du cycle du bassin), INFO (liste des zones).
import { createServer } from 'vite';
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/package.json')('playwright');
const [hash, out, ...pts] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 5299, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: +(process.env.VW || 896), height: +(process.env.VH || 504) }, ...(process.env.MOBILE ? { hasTouch: true, isMobile: true, deviceScaleFactor: 3 } : {}) });
p.on('pageerror', (e) => console.error('ERREUR', e.message));
p.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
await p.addInitScript((t) => { window.__KAGE_SKIP_INTRO = true; window.__T = t; }, process.env.T ? +process.env.T : null);
await p.goto(`http://localhost:${server.httpServer.address().port}/${process.env.Q || ''}#${hash}`);
await p.waitForFunction(() => window.__kage, null, { timeout: 60000 });
await p.waitForTimeout(800);
if (process.env.MENU) for (const sel of ['[data-menu="aventure"]', '[data-new]']) { await p.click(sel, { timeout: 500 }).catch(() => {}); await p.waitForTimeout(200); }
await p.waitForFunction(() => window.__kage, null, { timeout: 60000 }); await p.waitForTimeout(600);
await p.evaluate(() => { const t = document.querySelector('.title-screen'); if (t) t.hidden = true; const r = window.__kage.run; r.paused = false; r.title = false; document.querySelector('.menu')?.setAttribute('hidden', ''); });
if (process.env.INFO) console.log(await p.evaluate(() => JSON.stringify(window.__kage.level.zones.map(z => [z.id, z.name, z.mood, z.x0, z.x1]))));
for (const pt of pts) {
  const [tx, ty] = pt.split(',');
  await p.evaluate(([tx, ty]) => {
    const g = window.__kage, pl = g.player, l = g.level;
    let y;
    if (ty && ty !== "auto") y = +ty; else { y = l.h - 1; while (y > 0 && (l.solid(+tx, y - 1) || l.at(+tx, y - 1) === "~")) y--; }
    pl.x = +tx * 16 + 8; pl.y = y * 16; pl.vx = 0; pl.vy = 0; pl.setState('idle');
    g.snapCamera?.();
    if (window.__T != null && l.arena) l.arena.time = window.__T;
  }, [tx, ty]);
  await p.waitForTimeout(+(process.env.WAIT || 1800));
  await p.locator(process.env.SEL || '.stage, .game-wrap, main').first().screenshot({ path: `${out}_${tx}.png` }).catch(async () => p.screenshot({ path: `${out}_${tx}.png` }));
}
await browser.close(); await server.close();
