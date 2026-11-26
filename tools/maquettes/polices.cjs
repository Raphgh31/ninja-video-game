const { chromium } = require('playwright');
const fs = require('fs');
const F = [
  // pixels nets
  { name: 'La police dessinée du jeu', note: 'pixels nets · déjà dans le code', game: 'pixel' },
  { name: 'Silkscreen', note: 'pixels nets · capitales hautes, très lisible', file: 'Silkscreen.ttf', fam: 'Silkscreen', pixel: true, small: 8, big: 16 },
  { name: 'Pixelify Sans', note: 'pixels nets · rond et doux', file: 'PixelifySans.ttf', fam: 'Pixelify', pixel: true, small: 11, big: 20 },
  { name: 'Jersey 10', note: 'pixels nets · étroit, sportif', file: 'Jersey10.ttf', fam: 'Jersey10', pixel: true, small: 12, big: 24 },
  { name: 'Micro 5', note: 'pixels nets · minuscule, très « console »', file: 'Micro5.ttf', fam: 'Micro5', pixel: true, small: 11, big: 22 },
  { name: 'VT323', note: 'pixels nets · terminal ancien', file: 'VT323.ttf', fam: 'VT323', pixel: true, small: 13, big: 26 },
  { name: 'DotGothic16', note: 'pixels nets · jeux japonais des années 90', file: 'DotGothic16.ttf', fam: 'DotGothic', pixel: true, small: 12, big: 22 },
  { name: 'Jacquard 12', note: 'pixels nets · gothique brodé', file: 'Jacquard12.ttf', fam: 'Jacquard', pixel: true, small: 12, big: 24 },
  { name: 'Handjet', note: 'pixels nets · grille de points', file: 'Handjet.ttf', fam: 'Handjet', pixel: true, small: 14, big: 26 },
  // esprit japonais : pinceau, estampe
  { name: 'Actuelle (Palatino)', note: 'lisse · celle du jeu aujourd\'hui', game: 'smooth' },
  { name: 'Shippori Mincho', note: 'lisse · mincho, livre japonais', file: 'ShipporiMincho.ttf', fam: 'Shippori', small: 9, big: 17 },
  { name: 'Zen Antique', note: 'lisse · vieille impression japonaise', file: 'ZenAntique.ttf', fam: 'ZenAntique', small: 9, big: 17 },
  { name: 'Sawarabi Mincho', note: 'lisse · mincho fin et sobre', file: 'SawarabiMincho.ttf', fam: 'Sawarabi', small: 9, big: 17 },
  { name: 'Kaisei Decol', note: 'lisse · mincho décoratif, chaleureux', file: 'KaiseiDecol.ttf', fam: 'Kaisei', small: 9, big: 17 },
  { name: 'Yuji Boku', note: 'lisse · pinceau sec', file: 'YujiBoku.ttf', fam: 'YujiBoku', small: 9, big: 18 },
  { name: 'Yuji Syuku', note: 'lisse · pinceau posé', file: 'YujiSyuku.ttf', fam: 'YujiSyuku', small: 9, big: 18 },
  { name: 'Yusei Magic', note: 'lisse · feutre à main levée', file: 'YuseiMagic.ttf', fam: 'Yusei', small: 9, big: 17 },
  // simples, arrondies, livres
  { name: 'Zen Maru Gothic', note: 'lisse · sans empattement arrondi, très simple', file: 'ZenMaruGothic.ttf', fam: 'ZenMaru', small: 9, big: 17 },
  { name: 'Kiwi Maru', note: 'lisse · arrondi, un peu de caractère', file: 'KiwiMaru.ttf', fam: 'Kiwi', small: 9, big: 17 },
  { name: 'M PLUS Rounded 1c', note: 'lisse · arrondi moderne', file: 'MPLUSRounded1c.ttf', fam: 'MPlus', small: 9, big: 17 },
  { name: 'IM Fell Double Pica', note: 'lisse · vieux livre imprimé', file: 'IMFELLDoublePica.ttf', fam: 'Fell', small: 10, big: 19 },
  { name: 'Alegreya SC', note: 'lisse · petites capitales de conte', file: 'AlegreyaSC.ttf', fam: 'Alegreya', small: 9, big: 17 },
  { name: 'Almendra', note: 'lisse · calligraphie de légende', file: 'Almendra.ttf', fam: 'Almendra', small: 10, big: 18 },
  { name: 'Spectral', note: 'lisse · serif fin, élégant', file: 'Spectral.ttf', fam: 'Spectral', small: 9, big: 17 },
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CERR', m.text()); });
  await p.goto('http://localhost:8766/.polices/planche.html#' + encodeURIComponent(JSON.stringify(F)));
  await p.waitForFunction(() => document.body.dataset.done === '1', null, { timeout: 60000 });
  const urls = await p.evaluate(() => [...document.querySelectorAll('canvas[data-i]')].map((c) => c.toDataURL('image/png')));
  fs.mkdirSync('tiles', { recursive: true });
  urls.forEach((u, i) => fs.writeFileSync(`tiles/${String(i + 1).padStart(2, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')));
  console.log(urls.length);
  await b.close();
})();
