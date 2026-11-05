// Vérifie que la carte mentale (docs/carte-mentale/index.html) suit le jeu.
//
//   node tools/carte_mentale_verif.mjs                 # vérifie (lancé par npm test et sur chaque PR)
//   node tools/carte_mentale_verif.mjs --site <dest>   # écrit la copie mise en ligne (retard = avertissement)
//
// Échoue si la carte a pris du retard sur le code : fichier cité qui n'existe plus,
// zone du Potager ou ennemi sans boîte, nombre d'animations ou de tests périmé,
// renvoi vers une boîte inconnue, numéro de ligne qui ne pointe plus sur sa zone.
// Le message dit quoi corriger dans la liste BRANCHES.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'docs/carte-mentale/index.html');
const html = readFileSync(PAGE, 'utf8');
const read = p => readFileSync(join(ROOT, p), 'utf8');

const start = html.indexOf('const BRANCHES = [');
const end = html.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('liste BRANCHES introuvable dans index.html');
const BRANCHES = new Function(`return ${html.slice(start + 'const BRANCHES = '.length, end + 2)};`)();

const errors = [];
const STATES = ['fait', 'encours', 'provisoire', 'afaire', 'idee'];
const leaves = BRANCHES.flatMap(b => b.leaves);
const byId = new Map();
for (const l of leaves) {
  if (byId.has(l.id)) errors.push(`boîte en double : ${l.id}`);
  byId.set(l.id, l);
  if (!STATES.includes(l.s)) errors.push(`${l.id} : état « ${l.s} » inconnu (${STATES.join(', ')})`);
}

// 1. fichiers et images cités
for (const l of leaves) {
  const paths = [...(l.files || []), ...(l.links || []).map(([, u]) => u).filter(u => !/^https?:/.test(u))];
  for (const f of paths) {
    const [p, anchor] = f.split('#');
    if (!existsSync(join(ROOT, p))) { errors.push(`${l.id} : « ${p} » n'existe plus`); continue; }
    if (anchor && /^L\d+$/.test(anchor)) {
      const n = +anchor.slice(1);
      const line = read(p).split('\n')[n - 1] ?? '';
      const zone = l.id.match(/^pot-z(\d\d)$/);
      if (zone && !line.includes(`b.zone('${zone[1]}'`)) {
        const real = read(p).split('\n').findIndex(x => x.includes(`b.zone('${zone[1]}'`)) + 1;
        errors.push(`${l.id} : la zone ${zone[1]} est maintenant ligne ${real} de ${p} (la carte dit ${n})`);
      }
    }
  }
  for (const id of l.see || []) if (!byId.has(id)) errors.push(`${l.id} : renvoi vers une boîte inconnue « ${id} »`);
}

// 2. chaque zone du Potager a sa boîte
for (const m of read('src/game/chapters/potager.js').matchAll(/b\.zone\('(\d\d)',\s*(['"])(.*?)\2\)/g)) {
  const l = byId.get(`pot-z${m[1]}`);
  if (!l) errors.push(`zone ${m[1]} « ${m[3]} » sans boîte : ajouter pot-z${m[1]} dans la branche potager`);
  else if (!l.t.includes(m[3])) errors.push(`pot-z${m[1]} : le titre devrait contenir « ${m[3]} »`);
}

// 3. chaque personnage de assets/characters a sa boîte (KAGE a sa branche)
for (const name of readdirSync(join(ROOT, 'assets/characters'))) {
  if (name === 'kage') continue;
  if (!byId.has(`ennemi-${name}`)) errors.push(`assets/characters/${name} sans boîte : ajouter ennemi-${name} dans la branche ennemis`);
}

// 4. nombres affichés
const anims = Object.keys(JSON.parse(read('assets/characters/kage/kage.json')).animations).length;
const ta = byId.get('kage-anims');
if (ta && !ta.t.startsWith(`${anims} `)) errors.push(`kage-anims : KAGE a maintenant ${anims} animations (titre « ${ta.t} »)`);
const tests = (read('tests/e2e.cjs').match(/^\s*(await\s+)?test\(/gm) || []).length;
const tt = byId.get('tech-tests');
if (tt && !tt.t.startsWith(`${tests} `)) errors.push(`tech-tests : il y a maintenant ${tests} tests (titre « ${tt.t} »)`);

// copie mise en ligne avec le site : la date et le commit de la mise en ligne remplacent l'état écrit à la main
const i = process.argv.indexOf('--site');
if (i > 0) {
  const dest = process.argv[i + 1];
  let sha = process.env.GITHUB_SHA || '';
  try { sha ||= execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch {}
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' });
  const out = html.replace(/<p id="etat">.*?<\/p>/, `<p id="etat">en ligne · ${date} · ${sha.slice(0, 7)}</p>`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, out);
  console.log(`copie en ligne : ${dest}`);
}

if (errors.length) {
  console.error(`Carte mentale à mettre à jour (docs/carte-mentale/index.html, liste BRANCHES) :\n- ${errors.join('\n- ')}`);
  // à la mise en ligne, une carte en retard ne doit pas bloquer le jeu : simple avertissement
  if (i < 0) process.exit(1);
} else console.log(`carte mentale : à jour (${BRANCHES.length} branches, ${leaves.length} boîtes)`);
