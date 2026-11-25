// Fabrique les planches de comparaison (pause, boutique) : lance un serveur Vite, ouvre tools/maquettes/
// planches.js dans un navigateur, enregistre chaque maquette, puis les assemble (planches.py).
//   node tools/maquettes/planches.mjs <dossier de sortie>
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'tools/maquettes/sortie';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5288, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:5288/tools/maquettes/planches.js');
await page.addScriptTag({ type: 'module', url: '/tools/maquettes/planches.js' });
await page.waitForFunction(() => window.__planches, null, { timeout: 30000 });
const res = await page.evaluate(() => window.__planches());
for (const [k, u] of Object.entries(res)) writeFileSync(`${out}/${k}.png`, Buffer.from(u.split(',')[1], 'base64'));
console.log('maquettes :', Object.keys(res).join(', '));
await browser.close();
await server.close();
