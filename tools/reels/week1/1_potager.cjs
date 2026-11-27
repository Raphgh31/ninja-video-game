// Week 1, plan 1 : le Potager au matin — la course dans les cultures, un épouvantail (WARA) abattu au sabre.
module.exports = {
  hash: '',
  N: Number(process.env.N1 ?? 132),
  debut: Number(process.env.D1 ?? 38),
  heure: () => Number(process.env.T1 ?? 45),
  async prepare(pg) {
    const z = Number(process.env.Z1 ?? 3), x0 = Number(process.env.X1 ?? 1);
    const w = await pg.evaluate(([z, x0]) => { bot.place(__kage.level.zones[z].x0 + x0); __kage.player.hurt = () => false; window.__a = 0;
      return __kage.waras.map((w) => `${Math.round(w.x / 16)},${Math.round(w.y / 16)}`).join(' '); }, [z, x0]);
    console.log('WARA', w);
  },
  ctl(f, k, bot) {
    const p = k.player;
    k.input.setHeld('attack', false);
    const foe = k.waras.find((w) => w.state !== 'defeated' && w.x - p.x > -4 && w.x - p.x < 34 && Math.abs(w.y - p.y) < 20);
    if (foe && p.onGround) {
      bot.set({ right: false, left: false, sprint: false, jump: false }); p.facing = 1;
      if (window.__a++ % 9 === 0) bot.tap('attack');
      for (let i = 0; i < 4; i++) k.step(1);
      return { stepped: true, note: `wara ${foe.hp} ${foe.state}` };
    }
    window.__a = 0;
    bot.runner(4 / 120, { dashGap: 4, aim: true });
    return { stepped: true };
  },
};
