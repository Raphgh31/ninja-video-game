// Planche des ouvertures du jeu (introduction au lancement), dessinée avec la vraie police,
// le vrai paysage du Potager (tools/intro/fond.png, scene.png : captures du jeu) et KAGE.
//   node tools/intro_planche.mjs <sortie.png> [paramètres d'adresse]
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const [out = 'planche.png', query = ''] = process.argv.slice(2);
const server = await createServer({ server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', (e) => console.error('ERREUR', e.message));
p.on('console', (m) => console.log(m.text()));
await p.goto(`http://localhost:${server.httpServer.address().port}/tools/intro/planche.html?${query}`);
await p.waitForFunction(() => window.__done, null, { timeout: 120000 });
await p.locator('#board').screenshot({ path: out });
await browser.close();
await server.close();
