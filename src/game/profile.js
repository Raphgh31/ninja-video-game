// Le profil du joueur (« Mon ninja ») : son pseudo, qui sert en arène, et
// l'aventure que montre son profil (une des deux, souvent la plus avancée).
// Enregistré dans le navigateur ; le jeu fonctionne sans.
const KEY = 'ninja.profil';
const NAME_OK = /[A-Za-z0-9 \-]/;

/** Nettoie un pseudo : lettres, chiffres, espace et tiret, 10 signes au plus. */
export function cleanName(v) {
  return [...(v ?? '')].filter((c) => NAME_OK.test(c)).join('').slice(0, 10);
}

export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* rien */ }
  if (!p || typeof p !== 'object') {
    let old = null;
    try { old = localStorage.getItem('kage-nom'); } catch { /* rien */ }   // le pseudo d'avant le profil
    p = { name: cleanName(old) || `Ninja ${10 + Math.floor(Math.random() * 90)}`, shown: 1 };
    saveProfile(p);
  }
  p.name = cleanName(p.name).trim() || 'Ninja';
  p.shown = p.shown === 2 ? 2 : 1;
  return p;
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify({ name: p.name, shown: p.shown })); } catch { /* rien */ }
}
