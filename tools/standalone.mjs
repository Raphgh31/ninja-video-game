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
for (const p of Object.values(meta.projectiles ?? {})) {
  embed[`./${base}/${p.indexImage}`] =
    'data:image/png;base64,' + readFileSync(join(dist, base, p.indexImage)).toString('base64');
}
for (const id of meta.skins) {
  embed[`./${base}/skins/${id}.json`] = JSON.parse(readFileSync(join(dist, base, 'skins', `${id}.json`), 'utf8'));
}
for (const f of Object.values(meta.accessorySheets ?? {})) {
  embed[`./${base}/${f}`] = 'data:image/png;base64,' + readFileSync(join(dist, base, f)).toString('base64');
}

// ennemis
const tbase = 'characters/tate';
const tmeta = JSON.parse(readFileSync(join(dist, tbase, 'tate.json'), 'utf8'));
embed[`./${tbase}/tate.json`] = tmeta;
for (const f of [tmeta.image, tmeta.glowImage]) {
  embed[`./${tbase}/${f}`] = 'data:image/png;base64,' + readFileSync(join(dist, tbase, f)).toString('base64');
}
const wbase = 'characters/wara';
const wmeta = JSON.parse(readFileSync(join(dist, wbase, 'wara.json'), 'utf8'));
embed[`./${wbase}/wara.json`] = wmeta;
embed[`./${wbase}/${wmeta.image}`] = 'data:image/png;base64,' + readFileSync(join(dist, wbase, wmeta.image)).toString('base64');
const kbase = 'characters/karasu';
const kmeta = JSON.parse(readFileSync(join(dist, kbase, 'karasu.json'), 'utf8'));
embed[`./${kbase}/karasu.json`] = kmeta;
for (const f of [kmeta.image, kmeta.perchImage, kmeta.itemImage]) {
  embed[`./${kbase}/${f}`] = 'data:image/png;base64,' + readFileSync(join(dist, kbase, f)).toString('base64');
}

// musiques des chapitres, et sons enregistrés (ailes et croassements du corbeau)
for (const dir of ['music', 'sfx']) {
  for (const f of readdirSync(join(dist, dir))) {
    embed[`./${dir}/${f}`] = 'data:audio/mpeg;base64,' + readFileSync(join(dist, dir, f)).toString('base64');
  }
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.js'));
const css = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.css'));
html = html.replace(/<link rel="stylesheet"[^>]*>/, () =>
  `<style>${readFileSync(join(dist, 'assets', css), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*><\/script>/, () =>
  `<script>window.__KAGE_EMBED=${JSON.stringify(embed)};${process.env.KAGE_TEST ? 'window.__KAGE_TEST=true;' : ''}</script>\n` +
  `<script type="module">${readFileSync(join(dist, 'assets', js), 'utf8').replace(/<\/script/g, '<\\/script')}</script>`);
const out = process.env.KAGE_TEST ? 'kage-test.html' : 'kage-standalone.html';
writeFileSync(join(dist, out), html);
console.log(`dist/${out} (${Math.round(html.length / 1024)} Ko)`);
