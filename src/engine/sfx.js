// Sons synthétisés en direct (Web Audio), sans fichier : style rétro, assorti
// au pixel art. Chaque son est une petite recette (oscillateur et/ou bruit
// filtré, avec enveloppe). Le contexte audio démarre au premier geste du joueur.

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
let out = null;   // destination des sons de l'appel en cours (master, ou un gain selon la distance)
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
  o.connect(g).connect(out);
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
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

/** Pose une courbe sur un paramètre : pts = [[fraction de la durée, valeur], ...]. */
function curve(param, t, dur, pts, floor = 0.0001) {
  param.setValueAtTime(Math.max(floor, pts[0][1]), t);
  for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(Math.max(floor, pts[i][1]), t + pts[i][0] * dur);
}

/**
 * Souffle : bruit filtré dont la fréquence (f) et le volume (g, en fraction de
 * vol) suivent des courbes. am = { rate, depth } : volume modulé (rotation,
 * grain d'un frottement).
 */
function air({ dur, vol, type = 'bandpass', q = 1, f, g = [[0, 0], [0.3, 1], [1, 0]], delay = 0, am = null }) {
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  curve(fl.frequency, t, dur, f, 20);
  const e = ac.createGain();
  curve(e.gain, t, dur, g.map(([k, v]) => [k, v * vol]));
  let node = s.connect(fl).connect(e);
  if (am) {
    const m = ac.createGain();
    m.gain.value = 1 - am.depth / 2;
    const lfo = ac.createOscillator();
    lfo.type = am.type || 'sine';
    lfo.frequency.value = am.rate;
    const d = ac.createGain();
    d.gain.value = am.depth / 2;
    lfo.connect(d).connect(m.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
    node = node.connect(m);
  }
  node.connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

/** Tintement métallique : quelques partiels inharmoniques qui s'éteignent vite. */
function ring({ f = 3000, vol = 0.03, dur = 0.15, delay = 0 }) {
  [[1, 1], [1.51, 0.55], [2.17, 0.3]].forEach(([k, v], i) => tone({ f: f * k, dur: dur * (1 - i * 0.2), type: 'sine', vol: vol * v, attack: 0.001, delay }));
}

const rnd = (a, b) => a + Math.random() * (b - a);

// ---- recettes ---------------------------------------------------------------
const SOUNDS = {
  // pas de KAGE : petit choc mat sur la terre, légèrement différent à chaque fois
  step: ({ sprint, walk } = {}) => {
    const v = sprint ? 0.05 : walk ? 0.022 : 0.034;
    noise({ dur: 0.045, vol: v, type: 'lowpass', f: rnd(650, 1050), to: 300, q: 0.7, attack: 0.002 });
    tone({ f: rnd(100, 125), to: 60, dur: 0.035, type: 'sine', vol: v * 0.5, attack: 0.002 });
  },
  jump: () => {},   // pas de son au décollage : seule la réception s'entend
  // réception de KAGE : très léger, un petit choc mat
  land: ({ strength = 1 } = {}) => {
    noise({ dur: 0.08, vol: 0.05 * strength, type: 'lowpass', f: rnd(380, 460), to: 180, attack: 0.003 });
    tone({ f: 85, to: 52, dur: 0.07, type: 'sine', vol: 0.045 * strength, attack: 0.003 });
  },
  // réception d'un ennemi (son d'origine, plus lourd)
  enemyLand: ({ strength = 1 } = {}) => {
    noise({ dur: 0.09, vol: 0.12 * strength, type: 'lowpass', f: 500 });
    tone({ f: 95, to: 50, dur: 0.09, type: 'sine', vol: 0.12 * strength });
  },
  // whoosh : un souffle qui enfle, monte puis retombe, avec un peu de corps dans le grave
  dash: () => {
    air({ dur: 0.34, vol: 0.15, q: 0.9, f: [[0, 320], [0.42, 2100], [1, 520]], g: [[0, 0.02], [0.38, 1], [1, 0.01]] });
    air({ dur: 0.3, vol: 0.09, type: 'lowpass', q: 0.6, f: [[0, 180], [0.4, 650], [1, 200]], g: [[0, 0.02], [0.35, 1], [1, 0.01]] });
  },
  skid: () => noise({ dur: 0.16, vol: 0.07, f: 2600, q: 3 }),
  // glissade : frottement granuleux sur la terre, qui s'éteint avec l'élan
  slide: () => {
    air({ dur: 0.4, vol: 0.1, q: 0.8, f: [[0, 1100], [0.5, 800], [1, 450]], g: [[0, 0.05], [0.06, 1], [0.6, 0.7], [1, 0.01]], am: { rate: 27, depth: 0.7, type: 'sawtooth' } });
    air({ dur: 0.36, vol: 0.035, type: 'highpass', q: 0.7, f: [[0, 3200], [1, 2200]], g: [[0, 0.05], [0.05, 1], [1, 0.01]], am: { rate: 41, depth: 0.8 } });
  },
  wallGrab: () => noise({ dur: 0.05, vol: 0.06, type: 'highpass', f: 2200 }),
  wallSlide: () => noise({ dur: 0.07, vol: 0.025, f: 3200, q: 2 }),
  wallJump: () => { tone({ f: 320, to: 620, dur: 0.1, vol: 0.06 }); noise({ dur: 0.06, vol: 0.06, type: 'lowpass', f: 700 }); },
  // sabre dans le vide : la lame fend l'air (souffle fin, rapide et aigu)
  swing: () => {
    air({ dur: 0.15, vol: 0.13, q: 2.2, f: [[0, 1500], [0.4, 5200], [1, 2200]], g: [[0, 0.02], [0.35, 1], [1, 0.01]] });
    air({ dur: 0.1, vol: 0.05, type: 'highpass', q: 0.7, f: [[0, 4500], [1, 6500]], g: [[0, 0.02], [0.4, 1], [1, 0.01]], delay: 0.02 });
  },
  swingHeavy: () => {
    // armé (court frémissement métallique) puis la lame abattue : grand souffle qui descend
    tone({ f: 1800, to: 2400, dur: 0.12, type: 'triangle', vol: 0.03 });
    air({ dur: 0.26, vol: 0.16, q: 1.6, f: [[0, 1200], [0.35, 4200], [1, 900]], g: [[0, 0.02], [0.3, 1], [1, 0.01]], delay: 0.14 });
    air({ dur: 0.2, vol: 0.07, type: 'lowpass', q: 0.6, f: [[0, 300], [0.4, 900], [1, 250]], g: [[0, 0.02], [0.35, 1], [1, 0.01]], delay: 0.15 });
  },
  // sabre qui touche un ennemi : claquement de lame, tintement métallique et choc dans le corps
  bladeHit: ({ heavy = false } = {}) => {
    const k = heavy ? 1.25 : 1;
    noise({ dur: 0.03, vol: 0.16 * k, type: 'highpass', f: 3200, attack: 0.001 });
    air({ dur: 0.09, vol: 0.12 * k, q: 1.2, f: [[0, 3000], [1, 900]], g: [[0, 1], [1, 0.01]] });
    ring({ f: heavy ? 2100 : 2600, vol: 0.035 * k, dur: heavy ? 0.24 : 0.18 });
    noise({ dur: 0.11, vol: 0.14 * k, type: 'lowpass', f: 750, to: 200, attack: 0.002 });
    tone({ f: heavy ? 120 : 150, to: 55, dur: 0.12, type: 'sine', vol: 0.1 * k, attack: 0.002 });
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
  kick: () => noise({ dur: 0.1, vol: 0.08, f: 1800, to: 700, q: 1.3, attack: 0.01 }),
  breath: () => noise({ dur: 0.22, vol: 0.05, type: 'bandpass', f: 1300, to: 600, q: 0.7, attack: 0.03 }),
  enemyFall: () => tone({ f: 520, to: 160, dur: 0.45, type: 'triangle', vol: 0.05, attack: 0.02 }),
  coin: () => { tone({ f: 1568, dur: 0.05, type: 'square', vol: 0.035 }); tone({ f: 2093, dur: 0.09, type: 'square', vol: 0.03, delay: 0.05 }); },
  crate: () => { noise({ dur: 0.14, vol: 0.14, type: 'lowpass', f: 900, to: 300 }); tone({ f: 180, to: 90, dur: 0.1, type: 'triangle', vol: 0.06 }); },
  bell: () => { tone({ f: 1760, dur: 0.5, type: 'sine', vol: 0.05, attack: 0.002 }); tone({ f: 2637, dur: 0.35, type: 'sine', vol: 0.025, attack: 0.002 }); },
  kickHit: () => { noise({ dur: 0.08, vol: 0.16, type: 'lowpass', f: 700 }); tone({ f: 120, to: 70, dur: 0.09, type: 'sine', vol: 0.12 }); },
  // shuriken : petit déclic métallique au lâcher, puis il siffle en tournoyant
  throw: () => {
    ring({ f: 4200, vol: 0.022, dur: 0.06 });
    air({ dur: 0.26, vol: 0.09, q: 7, f: [[0, 3800], [1, 2300]], g: [[0, 0.05], [0.1, 1], [1, 0.01]], am: { rate: 46, depth: 0.85 } });
    tone({ f: 2900, to: 2300, dur: 0.22, type: 'sine', vol: 0.012, attack: 0.01 });
  },
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
  gong: () => {
    tone({ f: 330, dur: 1.4, type: 'sine', vol: 0.12, attack: 0.003 });
    tone({ f: 497, dur: 1.1, type: 'sine', vol: 0.06, attack: 0.003 });
    tone({ f: 822, dur: 0.7, type: 'triangle', vol: 0.03, attack: 0.003 });
    noise({ dur: 0.05, vol: 0.08, f: 1800 });
  },
  door: () => noise({ dur: 0.7, vol: 0.09, type: 'lowpass', f: 260, to: 120, attack: 0.1, delay: 0.25 }),
  checkpoint: () => { tone({ f: 1047, dur: 0.18, type: 'sine', vol: 0.05 }); tone({ f: 1319, dur: 0.25, type: 'sine', vol: 0.05, delay: 0.09 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: i === 3 ? 0.5 : 0.12, type: 'triangle', vol: 0.07, delay: i * 0.11 })),
  tateStep: () => { tone({ f: 75, to: 45, dur: 0.1, type: 'sine', vol: 0.11 }); noise({ dur: 0.06, vol: 0.05, type: 'lowpass', f: 300 }); },
  tateWindup: () => tone({ f: 70, to: 90, dur: 0.4, type: 'triangle', vol: 0.06, attack: 0.08 }),
  tateBash: () => { noise({ dur: 0.22, vol: 0.18, type: 'lowpass', f: 600, to: 300 }); tone({ f: 85, to: 40, dur: 0.25, type: 'sine', vol: 0.16 }); },
  tateStun: () => { tone({ f: 1250, to: 950, dur: 0.12, type: 'sine', vol: 0.05 }); tone({ f: 1500, to: 1100, dur: 0.12, type: 'sine', vol: 0.05, delay: 0.14 }); },
  tateKneel: () => noise({ dur: 0.15, vol: 0.12, type: 'lowpass', f: 400 }),
  // WARA : paille, bois léger, petits bruits comiques
  waraHop: () => { tone({ f: 330, to: 620, dur: 0.12, type: 'sine', vol: 0.045 }); noise({ dur: 0.05, vol: 0.035, f: 3000, q: 2 }); },
  waraWindup: () => { tone({ f: 600, to: 1300, dur: 0.16, type: 'triangle', vol: 0.05 }); tone({ f: 1300, to: 1100, dur: 0.08, type: 'triangle', vol: 0.035, delay: 0.16 }); },
  waraSpin: () => [0, 0.12, 0.24, 0.36].forEach((d) => noise({ dur: 0.1, vol: 0.06, f: 900, to: 2400, q: 1.2, attack: 0.02, delay: d })),
  waraDizzy: () => [0, 0.16, 0.32].forEach((d, i) => tone({ f: 1500 - i * 150, to: 1200 - i * 150, dur: 0.1, type: 'sine', vol: 0.035, delay: d })),
  waraBlock: () => { tone({ f: 420, dur: 0.06, type: 'triangle', vol: 0.06 }); noise({ dur: 0.05, vol: 0.06, type: 'lowpass', f: 1200 }); },
  waraHit: () => { noise({ dur: 0.12, vol: 0.14, f: 2200, to: 900, q: 0.8 }); tone({ f: 260, to: 140, dur: 0.1, type: 'triangle', vol: 0.05 }); },
  waraPoof: () => { noise({ dur: 0.3, vol: 0.14, type: 'lowpass', f: 2600, to: 400 }); tone({ f: 500, to: 180, dur: 0.22, type: 'sine', vol: 0.05 }); },
  tateFall: () => { noise({ dur: 0.32, vol: 0.28, type: 'lowpass', f: 320 }); tone({ f: 62, to: 30, dur: 0.36, type: 'sine', vol: 0.26 }); },
};

/**
 * Joue un son par son nom (sans effet si l'audio n'est pas encore débloqué).
 * gain < 1 : son atténué (un ennemi loin de l'écran), 0 : rien.
 */
export function play(name, opts, gain = 1) {
  if (muted || gain <= 0.01 || !ensure() || !SOUNDS[name]) return;
  if (gain < 0.99) {
    out = ac.createGain();
    out.gain.value = gain;
    out.connect(master);
    const o = out;
    setTimeout(() => o.disconnect(), 2500);
  } else {
    out = master;
  }
  SOUNDS[name](opts);
}
