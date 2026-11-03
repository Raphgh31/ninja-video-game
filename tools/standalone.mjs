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

// musiques des chapitres
for (const f of readdirSync(join(dist, 'music'))) {
  embed[`./music/${f}`] = 'data:audio/mpeg;base64,' + readFileSync(join(dist, 'music', f)).toString('base64');
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
