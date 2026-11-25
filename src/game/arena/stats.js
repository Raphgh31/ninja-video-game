// Les statistiques d'arène du joueur, ses titres et ses récompenses (novembre 2026). Gardées dans le navigateur
// (localStorage « ninja.arene »), montrées dans « Mon ninja » et au salon.
//
// Recherche : on revient à un jeu de duel pour la revanche, mais aussi pour ce qu'on y construit. Des titres
// gagnés par des exploits (et non au temps passé), des récompenses qui ne changent rien au combat (la couleur
// de la traînée de la lame, un sceau d'encre à côté du nom), une rivalité (l'ennemi juré).

const KEY = 'ninja.arene';

/** Les titres : un exploit à accomplir ; la récompense qui va avec (traînée de lame, sceau). */
export const TITLES = [
  { id: 'premier_sang', name: 'Premier sang', how: 'Gagner un premier duel', test: (s) => s.wins >= 1, trail: 'argent', seal: 'goutte' },
  { id: 'lame_silencieuse', name: 'La lame silencieuse', how: 'Gagner une manche sans être touché', test: (s) => s.perfect >= 1, trail: 'lune', seal: 'lune' },
  { id: 'mur_acier', name: "Le mur d'acier", how: 'Réussir 25 parades', test: (s) => s.parries >= 25, trail: 'acier', seal: 'garde' },
  { id: 'renvoi', name: "L'étoile retournée", how: 'Renvoyer 5 shurikens', test: (s) => s.deflects >= 5, trail: 'or', seal: 'etoile' },
  { id: 'echo', name: "L'écho des lames", how: 'Provoquer 10 chocs de lames', test: (s) => s.clashes >= 10, trail: 'cuivre', seal: 'cloche' },
  { id: 'piege', name: 'Le maître des pièges', how: "Vaincre 3 fois par un piège de l'arène", test: (s) => s.trapKills >= 3, trail: 'eau', seal: 'vague' },
  { id: 'serie', name: 'Le vent qui ne tombe pas', how: 'Gagner 5 duels de suite', test: (s) => s.bestStreak >= 5, trail: 'vent', seal: 'vent' },
  { id: 'veteran', name: 'Vétéran des arènes', how: 'Livrer 25 duels', test: (s) => s.fights >= 25, trail: 'braise', seal: 'torii' },
  { id: 'fatal', name: 'Le dernier trait', how: 'Porter 10 coups fatals', test: (s) => s.fatals >= 10, trail: 'sang', seal: 'pinceau' },
];

/** Les traînées de lame (récompenses) : la couleur du sillage du sabre. */
export const TRAILS = {
  aucune: null,
  argent: ['#f4f6f8', '#b8c0cc'], lune: ['#f2f0ff', '#9fa6e8'], acier: ['#e6ecf2', '#6f7f90'], or: ['#fff3c4', '#e9b44c'],
  cuivre: ['#ffd8b0', '#c27040'], eau: ['#e6fbf4', '#5ccdc8'], vent: ['#f0fff0', '#8fd058'], braise: ['#fff0c8', '#e0602c'], sang: ['#ffd0d0', '#c0283a'],
};

function blank() {
  return { fights: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, rounds: 0, roundsWon: 0, perfect: 0, parries: 0, deflects: 0,
    clashes: 0, fatals: 0, trapKills: 0, arenas: {}, rivals: {}, titles: [], title: null, trail: 'aucune', seal: null };
}

export function loadStats() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}

export function saveStats(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* rien */ }
}

/** Un compteur pendant le combat ; à la fin, les titres nouvellement gagnés. */
export class ArenaStats {
  constructor() { this.s = loadStats(); this.fresh = []; }

  add(k, n = 1) { this.s[k] = (this.s[k] ?? 0) + n; this.check(); saveStats(this.s); }

  /** Un duel fini : victoire ou défaite, l'arène, les adversaires (l'ennemi juré : celui qui nous a le plus battu). */
  match({ won, arena, rivals = [] }) {
    const s = this.s;
    s.fights++;
    if (won) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); } else { s.losses++; s.streak = 0; }
    s.arenas[arena] = (s.arenas[arena] ?? 0) + 1;
    for (const r of rivals) {
      const e = (s.rivals[r] ??= { won: 0, lost: 0 });
      if (won) e.won++; else e.lost++;
    }
    this.check();
    saveStats(s);
  }

  /** Les titres atteints : on les ajoute (le premier devient le titre affiché, sa traînée et son sceau aussi). */
  check() {
    const s = this.s;
    for (const t of TITLES) {
      if (s.titles.includes(t.id) || !t.test(s)) continue;
      s.titles.push(t.id);
      this.fresh.push(t);
      if (!s.title) { s.title = t.id; s.trail = t.trail; s.seal = t.seal; }
    }
  }

  /** Les titres gagnés depuis le dernier appel. */
  takeFresh() { const f = this.fresh; this.fresh = []; return f; }

  get title() { return TITLES.find((t) => t.id === this.s.title) ?? null; }
  get trail() { return TRAILS[this.s.trail] ?? null; }
  get seal() { return this.s.seal; }

  /** Ce qu'on montre dans « Mon ninja » : quelques lignes, l'essentiel. */
  summary() {
    const s = this.s, rate = s.fights ? Math.round((100 * s.wins) / s.fights) : 0;
    const fav = Object.entries(s.arenas).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const nemesis = Object.entries(s.rivals).filter(([, e]) => e.lost > 0).sort((a, b) => b[1].lost - a[1].lost)[0];
    return { fights: s.fights, wins: s.wins, rate, best: s.bestStreak, parries: s.parries, fatals: s.fatals, fav, nemesis: nemesis ? nemesis[0] : null, titles: s.titles.length, title: this.title?.name ?? null };
  }

  /** Choisit le titre affiché (et sa traînée, son sceau), parmi ceux gagnés. */
  choose(id) {
    const t = TITLES.find((x) => x.id === id);
    if (!t || !this.s.titles.includes(id)) return;
    this.s.title = id; this.s.trail = t.trail; this.s.seal = t.seal;
    saveStats(this.s);
  }
}

/** Les sceaux d'encre (5×5 pixels) : à côté du nom, au salon et au-dessus de la tête. */
export const SEALS = {
  goutte: ['..#..', '.###.', '#####', '#####', '.###.'],
  lune: ['.###.', '##...', '#....', '##...', '.###.'],
  garde: ['..#..', '..#..', '#####', '..#..', '..#..'],
  etoile: ['..#..', '.###.', '#####', '.###.', '..#..'],
  cloche: ['.###.', '.###.', '#####', '#####', '..#..'],
  vague: ['.....', '.##..', '#..##', '.....', '#####'],
  vent: ['###..', '...#.', '####.', '....#', '###..'],
  torii: ['#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  pinceau: ['....#', '...#.', '..#..', '##...', '##...'],
};

/** Dessine un sceau (carré rouge, signe clair) en (x, y), dans le contexte du jeu. */
export function drawSeal(ctx, seal, x, y) {
  const m = SEALS[seal];
  if (!m) return;
  ctx.fillStyle = '#5a1418'; ctx.fillRect(x - 1, y - 1, 9, 9);
  ctx.fillStyle = '#b8282e'; ctx.fillRect(x, y, 7, 7);
  ctx.fillStyle = '#f6e2c8';
  m.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') ctx.fillRect(x + 1 + i, y + 1 + j, 1, 1); }));
}
