// Week 1, plan 2 : la Forêt à midi — la course, un saut sur la liane, le balancier, le lâcher (zone 10, « Le souffle des lianes »).
module.exports = {
  hash: 'foret',
  debut: 205,
  N: 112,
  heure: () => 150,
  async prepare(pg) {
    await pg.evaluate(() => { bot.place(__kage.level.zones[9].x0 + 2); window.__st = {}; });
  },
  ctl(f, k, bot) {
    const [, ev] = P.vise(4 / 120, { st: window.__st });
    return { stepped: true, note: ev.map((e) => e.join(':')).join(' ') || undefined };
  },
};
