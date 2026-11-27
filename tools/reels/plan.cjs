// Tournage d'un plan de Reel, piloté dans la page : le jeu n'avance que par pas exacts (__kage.step, 4 pas de
// 1/120 s par image de 1/30 s), le ninja est conduit par le plan (window.__ctl, qui tient les touches du jeu
// comme le pilote des tests, tests/foret_bot.js), le hasard est fixé (Math.random à graine) : le réglage à
// blanc et le tournage donnent exactement les mêmes images.
//   node tools/reels/plan.cjs <plan.cjs> <dossier> dry    (à blanc : une petite image toutes les 5, en 2×, et la planche)
//   node tools/reels/plan.cjs <plan.cjs> <dossier> shoot  (le tournage, en 5× : <dossier>/frames/gNNNN.png)
// Un plan (tools/reels/week1/*.cjs) exporte : { hash, salle, N, heure(f), prepare(pg, outils), ctl (fonction
// jouée dans la page à chaque image : (f, k, bot) => …) }.
const fs = require('fs');
const path = require('path');
const { ouvrir, etat } = require('./jeu.cjs');

(async () => {
  const [, , planFile, dir, mode = 'dry', only] = process.argv;
  const plan = require(path.resolve(planFile));
  const shoot = mode === 'shoot';
  fs.rmSync(path.join(dir, shoot ? 'frames' : 'dry'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, shoot ? 'frames' : 'dry'), { recursive: true });
  const graine = plan.graine ?? 7;
  const { b, pg, box } = await ouvrir({
    hash: plan.hash ?? '', scale: shoot ? 5 : 2, salle: plan.salle ?? null,
    avant: `(() => { let s = ${graine} >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`,
  });
  // le pilote des tests (touches tenues, appuis, dash) : tests/foret_bot.js, et ceux de la Forêt
  await pg.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../../tests/foret_bot.js'), 'utf8') });
  await pg.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../../tests/foret_pilotes.js'), 'utf8') });
  await pg.evaluate(() => { window.__kage.step(1); });           // le temps réel est suspendu : seul le plan fait avancer le jeu
  if (plan.prepare) await plan.prepare(pg);
  const src = plan.ctl.toString();
  await pg.evaluate(`window.__ctl = ${/^(async\s+)?function|^\(|=>/.test(src.split('{')[0]) ? src : 'function ' + src};`);
  await pg.clock.runFor(100);
  const clip = await box();
  // plan.debut : les images d'avant se jouent sans être tournées (la mise en place) ; la première tournée est la n° 0
  const D = plan.debut ?? 0, N = Math.min(plan.N, only ? +only : Infinity), log = [];
  for (let f = 0; f < D + N; f++) {
    if (plan.heure) await pg.evaluate((t) => { window.__kage.cycle.t = t; }, plan.heure(f));
    const note = await pg.evaluate((f) => { const k = window.__kage; const r = window.__ctl(f, k, window.bot); if (!(r && r.stepped)) k.step(4); return r ?? null; }, f);
    await pg.clock.runFor(1000 / 30);           // (même pendant la mise en place : les minuteries du jeu restent à l'heure)
    if (f < D) continue;
    const st = await etat(pg), i = f - D;
    log.push({ f: i, ...st, ...(note && typeof note === 'object' ? note : {}) });
    if (shoot) await pg.screenshot({ path: `${dir}/frames/g${String(i).padStart(4, '0')}.png`, clip });
    else if (i % 5 === 0) await pg.screenshot({ path: `${dir}/dry/d${String(i).padStart(4, '0')}.png`, clip });
  }
  fs.writeFileSync(`${dir}/track.json`, JSON.stringify(log));
  await b.close();
  if (!shoot) {
    // la planche du réglage à blanc (une vignette toutes les 5 images, numérotées)
    const { execFileSync } = require('child_process');
    execFileSync('python3', [path.join(__dirname, 'planche.py'), path.join(dir, 'dry'), path.join(dir, 'dry.png')]);
  }
  for (const l of log.filter((l, i) => l.f % 10 === 0 || (l.note && l.note !== log[i - 1]?.note))) console.log(l.f, Math.round(l.x), Math.round(l.y), Math.round(l.x - l.cx), Math.round(l.cy), l.s, l.g ? 'sol' : '', l.note ?? '');
})();
