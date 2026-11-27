// Week 1, plan 5 : la nuit sur le Potager — la maison du début de l'intro, sous la lune ; le ninja arrive en
// courant, s'arrête devant elle et reste là, tourné vers la lune (le plan sur lequel la vidéo se termine).
module.exports = {
  hash: '',
  debut: 50,
  N: Number(process.env.N5 ?? 206),
  heure: () => 400,
  async prepare(pg) {
    await pg.evaluate(() => { bot.place(Number(window.__C0 ?? 1)); window.__stop = false; });
  },
  ctl(f, k, bot) {
    const p = k.player, X = 16 * 21;
    if (!window.__stop && p.x < X) bot.set({ right: true });
    else { window.__stop = true; bot.clear(); }
    return {};
  },
};
