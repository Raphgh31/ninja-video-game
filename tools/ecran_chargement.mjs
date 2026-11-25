// Peint, une fois, les montagnes de l'écran de chargement : les deux chaînes de l'intro (et du Potager),
// `paintFar` et `paintMid` de src/game/potager/backdrop.js, en longues bandes (elles défilent lentement
// derrière le ninja sans jamais se répéter). Elles sont peintes dans un vrai navigateur (le décor est
// peint en code sur des toiles), puis enregistrées dans assets/loading/ ; vite.config.js les intègre
// à la page avec src/loading/loader.js.
//
//   node tools/ecran_chargement.mjs
//
// À relancer si le dessin des montagnes change.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

// (Playwright est installé pour tout le système : on le trouve par require)
const { chromium } = createRequire(import.meta.url)('playwright');

const LONG = 2400;   // largeur voulue de la grande chaîne, en pixels de jeu

const server = await createServer({ server: { port: 5287, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5287/__vide').catch(() => {});   // (une page vide du serveur : on y importe le décor)
const out = await page.evaluate(async (LONG) => {
  const m = await import('/src/game/potager/backdrop.js');
  // paintFar(L) : largeur 1200 + (L − 480) × 0,035 ; paintMid : 1200 + (L − 480) × 0,085
  const far = m.paintFar(480 + (LONG - 1204) / 0.035);
  const mid = m.paintMid(480 + (LONG - 1204) / 0.085);
  const url = (c) => c.toDataURL('image/png');
  return { far: url(far.img), mid: url(mid.img), farPlane: far.plane, midPlane: mid.plane, farW: far.img.width, midW: mid.img.width };
}, LONG);
mkdirSync('assets/loading', { recursive: true });
const save = (name, u) => writeFileSync(`assets/loading/${name}`, Buffer.from(u.split(',')[1], 'base64'));
save('montagnes_loin.png', out.far);
save('montagnes_milieu.png', out.mid);
writeFileSync('assets/loading/montagnes.json', JSON.stringify({ far: out.farPlane, mid: out.midPlane, farW: out.farW, midW: out.midW }, null, 2) + '\n');
console.log(`montagnes : loin ${out.farW} px (${out.farPlane.h} de haut), milieu ${out.midW} px (${out.midPlane.h} de haut)`);
await browser.close();
await server.close();
