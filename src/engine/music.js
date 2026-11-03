// Musique de fond : une piste par chapitre, jouée par Web Audio.
// La piste commence par une introduction jouée une fois, puis boucle sans
// couture entre loopStart et loopEnd (en secondes, marqués à la préparation du
// fichier : voir docs/REPRISE.md, § 7). Elle démarre au premier geste du joueur
// (contrainte des navigateurs) avec un fondu, s'atténue dans la boutique et
// s'éteint à la fin du chapitre.
import { musicOutput } from './sfx.js';

export const MUSIC = {
  volume: 0.016,   // ~8 dB sous les bruitages principaux (dash, sabre), pour qu'ils restent nets
  fadeIn: 2.5,     // s
  duck: 0.45,      // volume relatif pendant la boutique
};

/** Octets d'un fichier : intégré en data: (version autonome) ou chargé depuis le site. */
async function bytesOf(src) {
  const data = globalThis.__KAGE_EMBED?.[src];
  if (data) {
    const bin = atob(data.slice(data.indexOf(',') + 1));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error(`musique introuvable : ${src}`);
  return r.arrayBuffer();
}

export class Music {
  constructor() {
    this.track = null;      // { src, loopStart, loopEnd }
    this.bytes = null;      // promesse des octets (chargés dès le départ)
    this.buffer = null;
    this.source = null;
    this.gain = null;
    this.level = 1;         // 1, MUSIC.duck, ou 0 (fin)
    this.starting = false;
  }

  get playing() { return !!this.source; }

  /** Prépare la piste du chapitre (chargement en arrière-plan). */
  load(track) {
    this.track = track;
    this.bytes = track ? bytesOf(track.src).catch((e) => { console.warn(e.message); return null; }) : null;
  }

  /** À appeler sur chaque geste du joueur : démarre la piste dès que possible. */
  async start() {
    if (!this.track || this.source || this.starting || this.level === 0) return;
    const out = musicOutput();
    if (!out) return;
    this.starting = true;
    try {
      const { ac, bus } = out;
      if (ac.state !== 'running') await ac.resume().catch(() => {});
      if (!this.buffer) {
        const bytes = await this.bytes;
        if (!bytes) return;
        this.buffer = await ac.decodeAudioData(bytes.slice(0));
      }
      if (this.source || this.level === 0) return;
      const s = ac.createBufferSource();
      s.buffer = this.buffer;
      s.loop = true;
      s.loopStart = this.track.loopStart;
      s.loopEnd = this.track.loopEnd;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(MUSIC.volume * this.level, t + MUSIC.fadeIn);
      s.connect(g).connect(bus);
      s.start(t);
      this.source = s; this.gain = g; this.ac = ac;
    } catch (e) {
      console.warn('musique : ' + e.message);
    } finally {
      this.starting = false;
    }
  }

  /** Volume relatif (1 = normal), atteint en douceur. */
  setLevel(level, time = 0.4) {
    this.level = level;
    if (!this.gain) return;
    const t = this.ac.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), t);
    this.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, MUSIC.volume * level), t + time);
    if (level === 0) {
      const s = this.source;
      this.source = null;
      s.stop(t + time + 0.05);
    }
  }
}
