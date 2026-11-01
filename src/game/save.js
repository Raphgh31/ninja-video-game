// Sauvegarde automatique d'un chapitre, dans le navigateur (localStorage).
// Enregistrée à chaque lanterne, à chaque ryō ramassé, à chaque caisse brisée
// et à la rencontre du marchand. Si le navigateur refuse d'enregistrer, le jeu
// fonctionne quand même (sans sauvegarde).

const KEY = 'kage.save.v1';
const VERSION = 1;

export function emptySave(chapter) {
  return {
    v: VERSION,
    chapter,
    checkpoint: -1,      // indice de la dernière lanterne allumée (-1 : départ)
    ryo: 0,
    coins: [],           // ryō déjà ramassés (identifiants)
    crates: [],          // caisses déjà brisées
    merchantMet: false,
    time: 0,             // temps de jeu total (s)
    falls: 0,
    done: false,         // chapitre terminé
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === VERSION ? s : null;
  } catch {
    return null;
  }
}

/** Enregistre ; renvoie false si le navigateur a refusé. */
export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* rien */ }
}
