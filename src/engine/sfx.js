// Sons synthétisés en direct (Web Audio), sans fichier : style rétro, assorti
// au pixel art. Chaque son est une petite recette (oscillateur et/ou bruit
// filtré, avec enveloppe). Le contexte audio démarre au premier geste du joueur.

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('kage-muted') === '1'; } catch { /* stockage indisponible */ }

function ensure() {
  if (ac) return ac.state === 'running';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.35;
  master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ac.state === 'running';
}

/** À appeler sur un geste du joueur (clavier, toucher) : débloque l'audio. */
export function unlockAudio() {
  ensure();
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
}

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('kage-muted', m ? '1' : '0'); } catch { /* stockage indisponible */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.35, ac.currentTime, 0.02);
}

function env(g, t, vol, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ f = 440, to = null, dur = 0.1, type = 'square', vol = 0.1, attack = 0.005, delay = 0 }) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  env(g, t, vol, attack, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.1, type = 'bandpass', f = 1000, to = null, q = 1, attack = 0.004, delay = 0 }) {
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  fl.Q.value = q;
  const g = ac.createGain();
  env(g, t, vol, attack, dur);
  s.connect(fl).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

// ---- recettes ---------------------------------------------------------------
const SOUNDS = {
  step: ({ sprint } = {}) => noise({ dur: 0.04, vol: sprint ? 0.07 : 0.045, f: 1700, to: 1100, q: 2 }),
  jump: () => { tone({ f: 260, to: 520, dur: 0.09, vol: 0.06 }); noise({ dur: 0.05, vol: 0.04, f: 2000 }); },
  land: ({ strength = 1 } = {}) => {
    noise({ dur: 0.09, vol: 0.12 * strength, type: 'lowpass', f: 500 });
    tone({ f: 95, to: 50, dur: 0.09, type: 'sine', vol: 0.12 * strength });
  },
  dash: () => noise({ dur: 0.2, vol: 0.16, f: 500, to: 2600, q: 1.5, attack: 0.02 }),
  skid: () => noise({ dur: 0.16, vol: 0.07, f: 2600, q: 3 }),
  slide: () => noise({ dur: 0.28, vol: 0.07, type: 'lowpass', f: 1400, to: 600, attack: 0.02 }),
  wallGrab: () => noise({ dur: 0.05, vol: 0.06, type: 'highpass', f: 2200 }),
  wallSlide: () => noise({ dur: 0.07, vol: 0.025, f: 3200, q: 2 }),
  wallJump: () => { tone({ f: 320, to: 620, dur: 0.1, vol: 0.06 }); noise({ dur: 0.06, vol: 0.06, type: 'lowpass', f: 700 }); },
  swing: () => noise({ dur: 0.13, vol: 0.11, f: 3200, to: 1100, q: 1.2, attack: 0.01 }),
  swingHeavy: () => {
    // armé (court frémissement métallique) puis grand souffle descendant
    tone({ f: 1800, to: 2400, dur: 0.12, type: 'triangle', vol: 0.03 });
    noise({ dur: 0.22, vol: 0.14, f: 2600, to: 500, q: 1.1, attack: 0.03, delay: 0.14 });
  },
  hit: () => {
    noise({ dur: 0.1, vol: 0.22, type: 'lowpass', f: 1000 });
    tone({ f: 150, to: 60, dur: 0.12, vol: 0.1 });
  },
  block: () => {
    tone({ f: 1400, dur: 0.22, type: 'triangle', vol: 0.07 });
    tone({ f: 2130, dur: 0.18, type: 'triangle', vol: 0.05 });
    noise({ dur: 0.05, vol: 0.08, type: 'highpass', f: 3000 });
  },
  throw: () => noise({ dur: 0.09, vol: 0.07, f: 4200, to: 1800, q: 2 }),
  stick: () => { tone({ f: 1900, dur: 0.03, vol: 0.05 }); noise({ dur: 0.035, vol: 0.06, type: 'highpass', f: 2500 }); },
  deflect: () => tone({ f: 2500, to: 1800, dur: 0.09, type: 'triangle', vol: 0.06 }),
  pickup: () => { tone({ f: 880, dur: 0.06, type: 'sine', vol: 0.07 }); tone({ f: 1320, dur: 0.08, type: 'sine', vol: 0.07, delay: 0.06 }); },
  empty: () => tone({ f: 210, dur: 0.04, vol: 0.04 }),
  hurt: () => { tone({ f: 320, to: 120, dur: 0.18, vol: 0.1 }); noise({ dur: 0.08, vol: 0.1, type: 'lowpass', f: 900 }); },
  death: () => {
    noise({ dur: 0.5, vol: 0.18, type: 'lowpass', f: 2200, to: 200 });
    tone({ f: 220, to: 55, dur: 0.42, vol: 0.09 });
  },
  respawn: () => [440, 660, 880].forEach((f, i) => tone({ f, dur: 0.07, type: 'sine', vol: 0.06, delay: i * 0.06 })),
  tateStep: () => { tone({ f: 75, to: 45, dur: 0.1, type: 'sine', vol: 0.11 }); noise({ dur: 0.06, vol: 0.05, type: 'lowpass', f: 300 }); },
  tateWindup: () => tone({ f: 70, to: 90, dur: 0.4, type: 'triangle', vol: 0.06, attack: 0.08 }),
  tateBash: () => { noise({ dur: 0.22, vol: 0.18, type: 'lowpass', f: 600, to: 300 }); tone({ f: 85, to: 40, dur: 0.25, type: 'sine', vol: 0.16 }); },
  tateStun: () => { tone({ f: 1250, to: 950, dur: 0.12, type: 'sine', vol: 0.05 }); tone({ f: 1500, to: 1100, dur: 0.12, type: 'sine', vol: 0.05, delay: 0.14 }); },
  tateKneel: () => noise({ dur: 0.15, vol: 0.12, type: 'lowpass', f: 400 }),
  tateFall: () => { noise({ dur: 0.32, vol: 0.28, type: 'lowpass', f: 320 }); tone({ f: 62, to: 30, dur: 0.36, type: 'sine', vol: 0.26 }); },
};

/** Joue un son par son nom (sans effet si l'audio n'est pas encore débloqué). */
export function play(name, opts) {
  if (muted || !ensure()) return;
  SOUNDS[name]?.(opts);
}
