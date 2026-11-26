// Un « réseau » dans la page : deux bouts reliés directement, avec la même interface que Net (net.js).
// Sert au ninja de l'ombre (arena/bot.js) : il joue par le même chemin qu'un vrai adversaire en ligne
// (états, coups, parades, manches), sans aucun service extérieur.
//
// Les messages sont remis un peu plus tard (une micro-tâche, ou au début du pas suivant du jeu) : jamais au
// milieu du calcul de celui qui les envoie, comme sur un vrai réseau.

class LocalEnd {
  constructor(pair, id, name, host) {
    this.pair = pair;
    this.id = id;
    this.name = name;
    this.host = host;
    this.code = 'OMBR';
    this.transport = 'local';
    this.status = 'connexion';
    this.conns = new Map();
    this.inbox = [];
  }

  get roster() { return this.pair.roster; }
  set roster(r) { this.pair.roster = r; }
  setStatus(s, d) { this.status = s; this.onStatus?.(s, d); }

  start() {
    this.setStatus(this.host ? 'ouverte' : 'connecté');
    queueMicrotask(() => this.onRoster?.(this.roster));
    return Promise.resolve();
  }

  /** Envoyé à l'autre bout : remis à la prochaine micro-tâche, ou au début du prochain pas du jeu (pump). */
  send(m) {
    if (this.closed) return;
    const other = this.pair.other(this);
    other.inbox.push([this.id, JSON.parse(JSON.stringify(m))]);
    if (!other.queued) { other.queued = true; queueMicrotask(() => other.pump()); }
  }

  /** Remet les messages reçus (multi.js l'appelle au début de chaque pas : l'ordre reste celui du jeu). */
  pump() {
    this.queued = false;
    while (this.inbox.length && !this.closed) { const [from, m] = this.inbox.shift(); this.onMessage?.(from, m); }
  }

  sendTo(id, m) { this.send(m); }
  broadcast(m) { this.send(m); }
  close() { this.closed = true; }
}

/** Deux bouts : l'hôte (le joueur) et l'invité (l'ordinateur). */
export function localPair(hostName, guestName, { bot = true } = {}) {
  const pair = {
    roster: [{ id: 'moi', name: hostName, slot: 0 }, { id: 'ombre', name: guestName, slot: 1, bot }],
    other(e) { return e === this.a ? this.b : this.a; },
  };
  pair.a = new LocalEnd(pair, 'moi', hostName, true);
  pair.b = new LocalEnd(pair, 'ombre', guestName, false);
  return [pair.a, pair.b];
}
