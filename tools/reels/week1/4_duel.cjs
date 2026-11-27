// Week 1, plan 4 : le duel, la nuit, dans la clairière de la statue (arène de la Forêt) — le ninja (mené par le
// cerveau du ninja de l'ombre, au niveau du Maître) contre l'ombre (niveau de l'Apprenti).
module.exports = {
  hash: 'arene-potager',
  salle: { mode: 'bot', arena: 'arene-potager', level: 1, botMode: 'duel' },
  debut: 118,
  N: 125,
  // la nuit tombe pendant le combat : du coucher du soleil (300) à la nuit (368), juste avant le coup fatal
  heure: (f) => 300 + 68 * Math.min(1, Math.max(0, (f - 150) / 60)) ** 1.3,
  graine: +(process.env.GRAINE ?? 7),
  async prepare(pg) {
    for (let i = 0; i < 30 && !(await pg.evaluate(() => !!window.__kage.bot?.player)); i++) await pg.clock.runFor(100);
    await pg.evaluate(() => { window.__br = null; window.__kage.multi.hideTags = true; });
  },
  ctl(f, k) {
    const bp = k.bot?.player;
    if (!window.__br && bp) window.__br = k.brain({ level: k.level, player: k.player, foe: bp, foeShurikens: k.bot.shurikens, shurikens: k.shurikens, rank: 2 });
    for (let i = 0; i < 4; i++) { if (window.__br && !k.run.paused) window.__br.step(1 / 120, k.input); k.step(1); }
    return { stepped: true, ph: k.duel?.phase, bx: bp ? bp.x - k.camera.x : null, note: `${k.player.hp}/${bp?.hp} ${k.duel?.phase ?? ''} ${bp?.state ?? ''}` };
  },
};
