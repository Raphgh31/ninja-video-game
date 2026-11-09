// Musique de fond, jouée par Web Audio : la piste du chapitre, et des pistes de
// moment (le combat contre KARASU-KASHI) vers lesquelles on passe en fondu
// enchaîné. Chaque piste commence par une introduction jouée une fois, puis
// boucle sans couture entre loopStart et loopEnd (en secondes, marqués à la
// préparation du fichier par tools/musique_boucle.py : voir docs/REPRISE.md,
// § 7). La musique démarre au premier geste du joueur (contrainte des
// navigateurs) avec un fondu, s'atténue dans la boutique et s'éteint à la fin
// du chapitre.
import { musicOutput } from './sfx.js';
import { bytesOf } from './bytes.js';

export const MUSIC = {
  volume: 0.0567,  // 0,016 puis +3 dB, +3 dB, puis +5 dB avec tous les sons, à la demande de l'utilisateur
  fadeIn: 2.5,     // s
  duck: 0.45,      // volume relatif pendant la boutique
};

export class Music {
  constructor() {
    this.voices = {};       // nom -> { track, bytes, buffer, source, gain }
    this.active = 'main';   // la piste qu'on entend (les autres sont muettes ou arrêtées)
    this.level = 1;         // 1, MUSIC.duck, ou 0 (fin)
    this.ac = null;
  }

  get playing() { return !!this.voices[this.active]?.source; }

  /** Prépare la piste du chapitre (chargement en arrière-plan). */
  load(track) { this.add('main', track); }

  /** Prépare une autre piste (track.gain : son volume relatif, 1 par défaut). */
  add(key, track) {
    if (!track) return;
    this.voices[key] = { track, bytes: bytesOf(track.src).catch((e) => { console.warn(e.message); return null; }), buffer: null, source: null, gain: null };
  }

  target(v) { return Math.max(0.0001, MUSIC.volume * (v.track.gain ?? 1) * this.level); }

  /** À appeler sur chaque geste du joueur : démarre la piste en cours dès que possible. */
  async start() {
    if (this.level === 0) return;
    await this.startVoice(this.active, MUSIC.fadeIn);
  }

  /** Lance une piste depuis son début, avec un fondu d'entrée (après un délai). */
  async startVoice(key, fade, delay = 0) {
    const v = this.voices[key];
    if (!v || v.source || v.starting) return;
    const out = musicOutput();
    if (!out) return;
    v.starting = true;
    try {
      const { ac, bus } = out;
      if (ac.state !== 'running') await ac.resume().catch(() => {});
      if (!v.buffer) {
        const bytes = await v.bytes;
        if (!bytes) return;
        v.buffer = await ac.decodeAudioData(bytes.slice(0));
      }
      // la piste a pu changer pendant le chargement : on ne lance que la piste voulue
      if (v.source || this.level === 0 || this.active !== key) return;
      const s = ac.createBufferSource();
      s.buffer = v.buffer;
      s.loop = true;
      s.loopStart = v.track.loopStart;
      s.loopEnd = v.track.loopEnd;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(this.target(v), t + delay + fade);
      s.connect(g).connect(bus);
      s.start(t);
      v.source = s; v.gain = g; this.ac = ac;
    } catch (e) {
      console.warn('musique : ' + e.message);
    } finally {
      v.starting = false;
    }
  }

  /**
   * Passe en fondu enchaîné à une autre piste : celle qu'on quitte descend
   * doucement (fadeOut), la nouvelle monte doucement (fadeIn, après delay).
   * La piste du chapitre continue en silence (on la retrouve là où elle en
   * était) ; une piste de moment s'arrête et repartira de son début.
   */
  switchTo(key, { fadeOut = 4, fadeIn = 6, delay = 1 } = {}) {
    if (key === this.active || !this.voices[key]) return;
    const prev = this.voices[this.active], prevKey = this.active;
    this.active = key;
    if (prev?.gain) {
      const t = this.ac.currentTime;
      prev.gain.gain.cancelScheduledValues(t);
      prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), t);
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeOut);
      if (prevKey !== 'main') {
        const s = prev.source;
        prev.source = null; prev.gain = null;
        s.stop(t + fadeOut + 0.1);
      }
    }
    if (this.level === 0) return;
    const v = this.voices[key];
    if (v.gain) {
      const t = this.ac.currentTime;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t + delay);
      v.gain.gain.exponentialRampToValueAtTime(this.target(v), t + delay + fadeIn);
    } else {
      this.startVoice(key, fadeIn, delay);
    }
  }

  /** Volume relatif (1 = normal), atteint en douceur ; 0 éteint toute la musique. */
  setLevel(level, time = 0.4) {
    this.level = level;
    if (!this.ac) return;
    const t = this.ac.currentTime;
    for (const [key, v] of Object.entries(this.voices)) {
      if (!v.gain) continue;
      const to = key === this.active ? this.target(v) : 0.0001;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
      v.gain.gain.exponentialRampToValueAtTime(level === 0 ? 0.0001 : to, t + time);
      if (level === 0) {
        const s = v.source;
        v.source = null; v.gain = null;
        s.stop(t + time + 0.05);
      }
    }
  }
}
