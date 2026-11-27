// Outils communs du tournage des Reels : ouvrir le jeu sur un lieu, le figer, le piloter image par image.
// (Le jeu doit être servi : npm run build puis npx vite preview --port 5290 --strictPort.)
const { chromium } = require('playwright');

const URL = 'http://localhost:5290/';

/**
 * Ouvre le jeu (aventure neuve, sans menu ni interface), horloge en pause.
 * hash : '' (le Potager), 'foret', 'arene-foret'… ; scale : 5 pour tourner (2240 × 1260), 2 pour repérer.
 * salle : pour une arène, la configuration du combat (ex. { mode: 'bot', arena: 'arene-foret', level: 3, botMode: 'duel' }).
 */
async function ouvrir({ hash = '', scale = 5, salle = null, avant = null } = {}) {
  const b = await chromium.launch();
  const vp = scale === 5 ? { width: 2250, height: 1440 } : { width: 448 * scale + 10, height: 252 * scale + 60 };
  const pg = await b.newPage({ viewport: vp });
  pg.on('pageerror', (e) => console.log('ERR', e.message));
  await pg.clock.install();
  await pg.addInitScript((salle) => {
    window.__KAGE_SKIP_INTRO = true; window.__KAGE_CLEAN = true;
    if (salle) { sessionStorage.setItem('kage-salle', JSON.stringify({ name: 'Raph', ...salle })); sessionStorage.setItem('kage-sans-intro', '1'); }
    else sessionStorage.setItem('kage-go', 'new');
  }, salle);
  if (avant) await pg.addInitScript(avant);
  await pg.goto(URL + (hash ? '#' + hash : ''));
  // (le chargement prend du temps réel : on laisse passer les deux horloges)
  for (let i = 0; i < 300 && !(await pg.evaluate(() => !!window.__kage?.level && !window.__kage.run.title)); i++) { await pg.clock.runFor(100); await new Promise((r) => setTimeout(r, 100)); }
  await pg.addStyleTag({ content: '.ui, header, footer, .state, .salle, .halt-btn, .boss, .lab, .duel-end { visibility: hidden !important; }' });
  // (une machine chargée peut dépasser le moment visé : on vise un peu plus loin et on réessaie)
  for (let d = 400; ; d *= 2) { try { await pg.clock.pauseAt(await pg.evaluate((d) => Date.now() + d, d)); break; } catch (e) { if (d > 20000) throw e; } }
  await pg.evaluate(() => {
    const k = window.__kage, d = k.player.draw;
    k.player.draw = function (...a) { if (!window.__hide) d.apply(this, a); };
  });
  const box = async () => pg.locator('#game').boundingBox();
  return { b, pg, box };
}

/** Pose le ninja au début de la zone i (comme gotoZone de main.js) ou à une case (tx) donnée. */
async function poser(pg, { zone = null, tx = null, dy = 0 } = {}) {
  return pg.evaluate(({ zone, tx, dy }) => {
    const k = window.__kage, l = k.level, p = k.player;
    if (zone != null) tx = l.zones[zone].x0 + 3;
    let ty = 0;
    while (ty < l.h && !l.solid(tx, ty)) ty++;
    l.checkpoints.forEach((c) => { c.lit = c.x < tx * 16; });
    l.spawn = { x: tx * 16 + 8, y: ty * 16 + dy };
    p.respawn(true);
    return { x: p.x, y: p.y };
  }, { zone, tx, dy });
}

/** L'état utile à chaque image (pour le recadrage au montage). */
const etat = (pg) => pg.evaluate(() => {
  const k = window.__kage, p = k.player;
  return { x: p.x, y: p.y, cx: k.camera.x, cy: k.camera.y, g: p.onGround, s: p.state, fl: !!p.flip, t: k.cycle.t };
});

module.exports = { ouvrir, poser, etat };
