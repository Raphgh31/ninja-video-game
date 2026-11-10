// Planches de design de la Forêt (chapitre 2), peintes avec le vrai code du décor.
//   node tools/foret_planche.mjs <page> <sortie.png> [paramètres d'adresse]
//   page : essai (une vue), ambiance, statue — fichiers de tools/foret/
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const [page = 'essai', out = 'planche.png', query = ''] = process.argv.slice(2);
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', (e) => console.error('ERREUR', e.message));
p.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
await p.goto(`http://localhost:${server.httpServer.address().port}/tools/foret/${page}.html?${query}`);
await p.waitForFunction(() => window.__done, null, { timeout: 120000 });
console.log('peint en', await p.evaluate(() => window.__ms), 'ms');
await p.locator('#board').screenshot({ path: out });
await browser.close();
await server.close();
