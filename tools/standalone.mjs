// Produit dist/kage-standalone.html : le jeu complet en un seul fichier,
// jouable par double-clic (sans serveur). À lancer après `vite build`.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const base = 'characters/kage';
const embed = {};
const meta = JSON.parse(readFileSync(join(dist, base, 'kage.json'), 'utf8'));
embed[`./${base}/kage.json`] = meta;
embed[`./${base}/${meta.indexImage}`] =
  'data:image/png;base64,' + readFileSync(join(dist, base, meta.indexImage)).toString('base64');
for (const id of meta.skins) {
  embed[`./${base}/skins/${id}.json`] = JSON.parse(readFileSync(join(dist, base, 'skins', `${id}.json`), 'utf8'));
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.js'));
const css = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.css'));
html = html.replace(/<link rel="stylesheet"[^>]*>/, () =>
  `<style>${readFileSync(join(dist, 'assets', css), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*><\/script>/, () =>
  `<script>window.__KAGE_EMBED=${JSON.stringify(embed)};</script>\n` +
  `<script type="module">${readFileSync(join(dist, 'assets', js), 'utf8').replace(/<\/script/g, '<\\/script')}</script>`);
writeFileSync(join(dist, 'kage-standalone.html'), html);
console.log(`dist/kage-standalone.html (${Math.round(html.length / 1024)} Ko)`);
