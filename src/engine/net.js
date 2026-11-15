// Jeu à plusieurs : les salles. Un joueur crée une salle et reçoit un code de
// quatre signes (KAGE-7F3Q) ; les autres le tapent pour la rejoindre (4 joueurs
// au plus). Les navigateurs se parlent directement (WebRTC, par PeerJS : un
// service public gratuit sert seulement à se trouver grâce au code). Celui qui a
// créé la salle en est l'hôte : il tient la liste des joueurs et relaie les
// messages des uns aux autres.
//
// Deux transports :
//   - « peer » : PeerJS, le vrai jeu en ligne ;
//   - « local » : un BroadcastChannel entre onglets du même navigateur (essais,
//     tests automatiques ; aucune connexion réseau).
//
// Messages : objets { t: type, … } ; reçus avec l'identifiant de l'envoyeur.

import { Peer } from 'peerjs';

export const MAX_PLAYERS = 4;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sans I, O, 0, 1 : on ne les confond pas en les dictant
const PREFIX = 'the-ninja-game-salle-';

/** Un code de salle au hasard : quatre signes. */
export function randomCode() {
  let s = '';
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (const v of buf) s += ALPHABET[v % ALPHABET.length];
  return s;
}

/** Nettoie un code tapé par le joueur (majuscules, signes permis, 4 au plus). */
export function cleanCode(s) {
  return (s ?? '').toUpperCase().replace(/^KAGE-?/, '').split('').filter((c) => ALPHABET.includes(c)).join('').slice(0, 4);
}

export class Net {
  /**
   * opts : { code, host (bool), name, transport ('peer' | 'local') }
   * Événements (à brancher) : onStatus(état, détail), onRoster(joueurs), onMessage(de, msg).
   * États : 'connexion', 'ouverte' (hôte prêt), 'connecté', 'introuvable', 'pleine', 'perdue', 'erreur'.
   */
  constructor(opts) {
    this.code = opts.code;
    this.host = !!opts.host;
    this.name = opts.name;
    this.transport = opts.transport ?? 'peer';
    this.id = null;
    this.roster = [];          // [{ id, name, slot }] : tenue par l'hôte, envoyée à tous
    this.conns = new Map();    // hôte (peer) : id → connexion ; invité : 'hote' → connexion
    this.status = 'connexion';
  }

  setStatus(s, detail) { this.status = s; this.onStatus?.(s, detail); }

  async start() {
    if (this.transport === 'local') return this.startLocal();
    const hostId = PREFIX + this.code.toLowerCase();
    this.peer = this.host ? new Peer(hostId) : new Peer();
    this.peer.on('open', (id) => {
      this.id = id;
      if (this.host) {
        this.roster = [{ id, name: this.name, slot: 0 }];
        this.setStatus('ouverte');
        this.onRoster?.(this.roster);
      } else {
        const c = this.peer.connect(hostId, { reliable: true, metadata: { name: this.name } });
        this.bindGuest(c);
      }
    });
    this.peer.on('connection', (c) => this.host && this.bindHost(c));
    this.peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') this.setStatus('introuvable');
      else if (e.type === 'unavailable-id') this.setStatus('prise');       // le code est déjà pris : on en tire un autre
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') this.setStatus('erreur', 'Pas de connexion au service des salles');
      else this.setStatus('erreur', e.type);
    });
    this.peer.on('disconnected', () => { if (this.status !== 'perdue') this.peer.reconnect?.(); });
  }

  // --- PeerJS : côté hôte ---------------------------------------------------------
  bindHost(c) {
    c.on('open', () => {
      if (this.roster.length >= MAX_PLAYERS) { c.send({ t: 'pleine' }); setTimeout(() => c.close(), 300); return; }
      this.conns.set(c.peer, c);
      this.join(c.peer, c.metadata?.name ?? 'Ninja');
    });
    c.on('data', (m) => this.fromGuest(c.peer, m));
    c.on('close', () => this.leave(c.peer));
    c.on('error', () => this.leave(c.peer));
  }

  // --- PeerJS : côté invité ---------------------------------------------------------
  bindGuest(c) {
    this.conns.set('hote', c);
    const timer = setTimeout(() => { if (this.status === 'connexion') this.setStatus('introuvable'); }, 12000);
    c.on('open', () => { clearTimeout(timer); });
    c.on('data', (m) => this.fromHost(m));
    c.on('close', () => this.setStatus('perdue'));
  }

  // --- transport local (BroadcastChannel) : mêmes règles, sans réseau ----------------------
  startLocal() {
    this.id = `${this.host ? 'h' : 'g'}${Math.random().toString(36).slice(2, 8)}`;
    this.ch = new BroadcastChannel(PREFIX + this.code);
    this.ch.onmessage = (e) => {
      const { from, to, toHost, m } = e.data;
      if (from === this.id || (to && to !== this.id)) return;
      if (this.host) {
        if (!toHost) return;
        if (m.t === 'hello') {
          if (this.roster.length >= MAX_PLAYERS) { this.ch.postMessage({ from: this.id, to: from, m: { t: 'pleine' } }); return; }
          this.conns.set(from, true);
          this.join(from, m.name);
        } else if (m.t === 'bye') this.leave(from);
        else this.fromGuest(from, m);
      } else if (!toHost) {
        if (m.t === 'hote?') this.ch.postMessage({ from: this.id, toHost: true, m: { t: 'hello', name: this.name } });
        else this.fromHost(m);
      }
    };
    if (this.host) {
      this.roster = [{ id: this.id, name: this.name, slot: 0 }];
      this.setStatus('ouverte');
      this.onRoster?.(this.roster);
      this.ch.postMessage({ from: this.id, m: { t: 'hote?' } });   // des invités attendaient déjà ?
    } else {
      this.ch.postMessage({ from: this.id, toHost: true, m: { t: 'hello', name: this.name } });
      setTimeout(() => { if (this.status === 'connexion') this.setStatus('introuvable'); }, 4000);
    }
    addEventListener('pagehide', () => this.ch.postMessage({ from: this.id, toHost: true, m: { t: 'bye' } }));
  }

  // --- l'hôte tient la liste et relaie -----------------------------------------------
  join(id, name) {
    const used = new Set(this.roster.map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    this.roster.push({ id, name: String(name ?? 'Ninja').slice(0, 12), slot });
    this.sendTo(id, { t: 'bienvenue', id, code: this.code });
    this.broadcast({ t: 'roster', roster: this.roster });
    this.onRoster?.(this.roster);
  }

  leave(id) {
    if (!this.roster.some((p) => p.id === id)) return;
    this.roster = this.roster.filter((p) => p.id !== id);
    this.conns.delete(id);
    this.broadcast({ t: 'roster', roster: this.roster });
    this.onRoster?.(this.roster);
  }

  fromGuest(id, m) {
    if (!this.roster.some((p) => p.id === id)) return;
    // relayé aux autres invités, puis traité ici
    for (const p of this.roster) if (p.id !== id && p.id !== this.id) this.sendTo(p.id, { ...m, from: id });
    this.onMessage?.(id, m);
  }

  fromHost(m) {
    if (m.t === 'pleine') { this.setStatus('pleine'); return; }
    if (m.t === 'bienvenue') { this.id = this.transport === 'local' ? this.id : m.id; this.setStatus('connecté'); return; }
    if (m.t === 'roster') { this.roster = m.roster; this.onRoster?.(this.roster); return; }
    const from = m.from ?? this.roster.find((p) => p.slot === 0)?.id;
    this.onMessage?.(from, m);
  }

  sendTo(id, m) {
    if (this.transport === 'local') { this.ch.postMessage({ from: this.id, to: id, m }); return; }
    const c = this.conns.get(id);
    if (c?.open) c.send(m);
  }

  broadcast(m) {
    if (this.transport === 'local') { this.ch.postMessage({ from: this.id, m }); return; }
    for (const c of this.conns.values()) if (c.open) c.send(m);
  }

  /** Envoie un message à tous les autres joueurs de la salle. */
  send(m) {
    if (this.host) { this.broadcast(m); return; }
    if (this.transport === 'local') { this.ch.postMessage({ from: this.id, toHost: true, m }); return; }
    const c = this.conns.get('hote');
    if (c?.open) c.send(m);
  }

  close() {
    if (this.transport === 'local') { this.ch?.postMessage({ from: this.id, toHost: true, m: { t: 'bye' } }); this.ch?.close(); return; }
    this.peer?.destroy();
  }
}
