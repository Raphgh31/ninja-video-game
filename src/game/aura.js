// L'éclat d'un skin légendaire (Lumière d'or) : un orbe doré qui flotte devant KAGE, deux volutes de lumière
// qui tournent autour de ses jambes, une poussière d'étincelles. Purement décoratif : rien ne change au jeu.
// (x, y) : les pieds de KAGE à l'écran ; facing : 1 vers la droite ; k : taille d'un pixel (2 dans la boutique).

const GOLD = ['#a8741c', '#e3b04a', '#f7dc8a', '#fff6d0'];

export function drawAura(ctx, x, y, facing, t, k = 1) {
  const px = (X, Y, c, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(Math.round(X) * k, Math.round(Y) * k, k, k); };
  ctx.save();
  // les volutes : deux spirales de points dorés, l'une derrière, l'autre devant les jambes ; elles tournent
  for (const [ox, oy, dir, ph] of [[-11, -7, 1, 0], [10, -5, -1, 2.1]]) {
    for (let i = 0; i < 22; i++) {
      const u = i / 21, a = u * 4.4 + t * 1.6 * dir + ph, r = 1.5 + u * 6.5;
      const X = x + facing * (ox + Math.cos(a) * r), Y = y + oy + Math.sin(a) * r * 0.7 - u * 4;
      const glint = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.6);
      px(X, Y, GOLD[1 + (i % 3 === 0 ? 1 : 0)], (0.55 + 0.45 * glint) * (1 - u * 0.35));
    }
  }
  // l'orbe : il flotte devant sa poitrine, monte et descend, un halo pâle qui palpite
  const bob = Math.sin(t * 2.2) * 1.5, cx = x + facing * 15, cy = y - 24 + bob, pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > 6.2 || d < 4) continue;
    if ((dx + dy) % 2) px(cx + dx, cy + dy, GOLD[2], 0.2 + 0.25 * pulse);
  }
  // une pierre de lumière à facettes : rebord sombre, cœur clair, un reflet
  const ORB = ['...0...', '..011..', '.01221.', '0122331', '.12332.', '..122..', '...1...'];
  ORB.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') px(cx - 3 + i, cy - 3 + j, GOLD[+c], 1); }));
  px(cx - 1, cy - 1, GOLD[3], 0.6 + 0.4 * pulse);
  // la poussière de lumière : des étincelles qui tournent et scintillent
  for (let i = 0; i < 9; i++) {
    const a = t * (0.9 + (i % 3) * 0.25) + i * 0.7, r = 11 + (i % 4) * 3 + Math.sin(t * 2 + i) * 2;
    const X = x + Math.cos(a) * r, Y = y - 16 + Math.sin(a) * r * 0.8 - ((t * 9 + i * 7) % 10);
    const s = 0.5 + 0.5 * Math.sin(t * 6 + i * 2.1);
    px(X, Y, i % 3 ? GOLD[2] : GOLD[3], 0.25 + 0.6 * s);
    if (s > 0.85) { px(X - 1, Y, GOLD[2], 0.6); px(X + 1, Y, GOLD[2], 0.6); px(X, Y - 1, GOLD[2], 0.6); px(X, Y + 1, GOLD[2], 0.6); }
  }
  ctx.restore();
}
