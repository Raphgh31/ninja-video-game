// Photographie les écrans de la maquette des menus (tools/menus_planche/index.html).
//   node tools/menus_planche/planche.cjs <dossier>
// Lance un serveur Vite le temps des photos ; une image par écran (×3).
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const out = path.resolve(process.argv[2] || 'docs/menus');
fs.mkdirSync(out, { recursive: true });
const vite = spawn('npx', ['vite', '--port', '5179', '--strictPort'], { cwd: path.resolve(__dirname, '../..'), stdio: 'pipe' });
const ready = new Promise((ok) => vite.stdout.on('data', (d) => { if (/Local/.test(String(d))) ok(); }));
(async () => {
  await ready;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1420, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5179/tools/menus_planche/index.html');
  await p.waitForFunction(() => window.__pret, null, { timeout: 30000 });
  await p.waitForTimeout(400);
  for (const id of ['menu', 'aventure', 'arene', 'rejoindre', 'salon', 'ninja']) {
    const wrap = await p.$(`.wrap:has(#s-${id})`);
    await wrap.screenshot({ path: path.join(out, `menu_${id}.png`) });
  }
  console.log(errs.join(' / ') || 'ok');
  await b.close(); vite.kill();
})().catch((e) => { console.error(e); vite.kill(); process.exit(1); });
