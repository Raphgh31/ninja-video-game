// Captures d'écran du Potager pour montrer une retouche à l'utilisateur.
//
//   node tools/capture.cjs <sortie> <colonne> [<colonne>…]
//     place KAGE au sol de chaque colonne (en cases de 16 px) et photographie la
//     zone de jeu entière (paysage + terrain) : <sortie>_<colonne>.png
//   node tools/capture.cjs --colline <sortie.png>
//     enregistre la colline en terrasses (zone 2) à sa résolution réelle, avec le
//     terrain du premier plan par-dessus : pratique pour zoomer sur un détail
//
// Variables : VW, VH (taille de la fenêtre, 1920×1200 par défaut), WAIT (ms
// d'attente avant chaque photo, 1500 par défaut), PAGE (fichier à ouvrir,
// dist/kage-standalone.html par défaut : lancer `npm run standalone` avant).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  const page = path.resolve(process.env.PAGE || 'dist/kage-standalone.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1920), height: +(process.env.VH || 1200) } });
  await p.addInitScript(() => { window.__KAGE_SKIP_INTRO = true; });   // pas d'introduction
  await p.goto('file://' + page);
  await p.waitForFunction(() => window.__kage);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForFunction(() => window.__kage);
  await p.waitForTimeout(300);
  await p.click('[data-new]').catch(() => {});
  await p.waitForTimeout(500);

  if (args[0] === '--colline') {
    const d = await p.evaluate(() => {
      const l = window.__kage.level, w = l.art.world, h = w.hills[0], CH = 512;
      const c = document.createElement('canvas');
      c.width = h.c.width; c.height = h.c.height;
      const g = c.getContext('2d');
      g.fillStyle = '#93c1e2'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(h.c, 0, 0);
      for (let i = Math.floor(h.x0 / CH); i <= Math.floor((h.x0 + h.c.width) / CH); i++) {
        w.ensure(i);
        if (w.back[i]) g.drawImage(w.back[i], i * CH - h.x0, 0);
      }
      return c.toDataURL();
    });
    fs.writeFileSync(args[1], Buffer.from(d.split(',')[1], 'base64'));
  } else {
    const [out, ...cols] = args;
    for (const tx of cols.map(Number)) {
      await p.evaluate((tx) => {
        const g = window.__kage, pl = g.player, l = g.level;
        let ty = l.h - 1;
        while (ty > 0 && l.solid(tx, ty - 1)) ty--;
        if (!l.solid(tx, l.h - 1)) { ty = 0; while (ty < l.h && !l.solid(tx, ty)) ty++; }
        pl.x = tx * 16 + 8; pl.y = ty * 16; pl.vx = 0; pl.vy = 0; pl.setState('idle');
      }, tx);
      await p.waitForTimeout(+(process.env.WAIT || 1500));
      await (await p.$('canvas')).screenshot({ path: `${out}_${tx}.png` });
    }
  }
  await b.close();
})();
