// Sauvegarde automatique d'un chapitre, dans le navigateur (localStorage).
// Enregistrée à chaque lanterne, à chaque ryō ramassé, à chaque caisse brisée
// et à la rencontre du marchand. Si le navigateur refuse d'enregistrer, le jeu
// fonctionne quand même (sans sauvegarde).

// Deux aventures au plus (deux emplacements) : la première garde la clé d'origine
// (les parties d'avant restent dans l'emplacement 1) ; l'aventure en cours est
// celle de l'emplacement choisi dans le menu (« ninja.aventure »).
const KEYS = { 1: 'kage.save.v1', 2: 'kage.save.v1.b' };
const SLOT_KEY = 'ninja.aventure';
const VERSION = 1;
export const SLOTS = [1, 2];

/** L'emplacement de l'aventure en cours (1 ou 2). */
export function currentSlot() {
  try { return localStorage.getItem(SLOT_KEY) === '2' ? 2 : 1; } catch { return 1; }
}

export function setSlot(n) {
  try { localStorage.setItem(SLOT_KEY, String(n === 2 ? 2 : 1)); } catch { /* rien */ }
}

export function emptySave(chapter) {
  return {
    v: VERSION,
    chapter,
    checkpoint: -1,      // indice de la dernière lanterne allumée (-1 : départ)
    checkpointX: null,   // position (px) de cette lanterne : c'est elle qui sert à la reprise
    ryo: 0,
    coins: [],           // ryō déjà ramassés (identifiants)
    crates: [],          // caisses déjà brisées
    chests: [],          // coffres déjà ouverts
    cranes: [],          // grues dont la corde a été coupée (blocs dans la fosse)
    merchantMet: false,
    skins: ['encre'],    // skins de KAGE possédés (achetés chez le marchand)
    skin: 'encre',       // skin porté
    bossDefeated: false, // KARASU-KASHI vaincu : la porte du temple reste ouverte
    time: 0,             // temps de jeu total (s)
    falls: 0,
    done: false,         // chapitre terminé
  };
}

export function loadSave(slot = currentSlot()) {
  try {
    const raw = localStorage.getItem(KEYS[slot] ?? KEYS[1]);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === VERSION ? s : null;
  } catch {
    return null;
  }
}

/** Enregistre ; renvoie false si le navigateur a refusé. */
export function writeSave(s, slot = currentSlot()) {
  try {
    localStorage.setItem(KEYS[slot] ?? KEYS[1], JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(slot = currentSlot()) {
  try { localStorage.removeItem(KEYS[slot] ?? KEYS[1]); } catch { /* rien */ }
}

/** Les deux emplacements : [{ slot, save (ou null) }]. */
export function listSaves() {
  return SLOTS.map((slot) => ({ slot, save: loadSave(slot) }));
}
