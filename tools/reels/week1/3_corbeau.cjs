// Week 1, plan 3 : le corbeau à l'heure dorée — le ninja grimpe sur la plateforme fragile, le corbeau arrive une
// pierre dans les serres, saut + sabre : il tombe bec planté, les plateformes s'effondrent, un dernier coup.
module.exports = {
  hash: '',
  debut: 12,
  N: 116,
  heure: (f) => 272 + f * 0.04,
  async prepare(pg) {
    await pg.evaluate(() => {
      const k = window.__kage, b = k.boss, l = k.level, sc = l.scaffolds[0], a = b.arena[0] / 16;
      bot.place(a + 9);
      b.reset(); b.engaged = true; b.hp = 6;   // (le dernier coup le blesse sans le vaincre : sa pose « vaincu » est pâle à l’image)
      b.setState('carry'); b.carry = { size: 0 }; b.rocksLeft = 3;
      b.x = (sc.x0 + 2) * 16 + 150; b.y = b.groundY - 76; b.facing = -1;
      k.player.hp = 5; k.player.hurt = () => false;
      window.__s = { ph: 0, t: 0, sc };
    });
  },
  ctl(f, k, bot) {
    const S = window.__s, p = k.player, b = k.boss, inp = k.input;
    for (const a of ['attack']) inp.setHeld(a, false);
    S.t++;
    const go = (ph) => { S.ph = ph; S.t = 0; };
    const midSc = (S.sc.x0 + 2) * 16;
    if (S.ph === 0) { bot.set({ right: true }); if (p.x > (S.sc.x0 - 2) * 16 + 4) { bot.tap('jump'); go(1); } }
    else if (S.ph === 1) { if (S.t > 5) inp.setHeld('jump', false); bot.set({ right: p.x < midSc - 4 }); if (p.onGround && S.t > 5) { bot.clear(); go(2); } }
    else if (S.ph === 2) { if (Math.abs(b.x - p.x) < +(window.__dx ?? 34) && b.state === 'carry') { bot.tap('jump'); go(3); } }
    else if (S.ph === 3) { if (S.t === +(window.__ta ?? 6)) bot.tap('attack'); if (S.t === 9) inp.setHeld('jump', false); if (S.t > 12) go(4); }
    else if (S.ph === 4) { if (b.state === 'stuck' || b.state === 'crash') { const d = b.x - p.x; p.facing = Math.sign(d) || 1; bot.set({ right: d > 26, left: d < -26 }); if (Math.abs(d) <= 26 && p.onGround && b.state === 'stuck') { bot.clear(); p.facing = Math.sign(d); bot.tap('attack'); go(5); } } }
    else if (S.ph === 5) { bot.clear(); }
    return { bx: b.x - k.camera.x, by: b.y - k.camera.y, note: `${S.ph}:${b.state}:${b.hp}:${Math.round(b.x - p.x)}` };
  },
};
