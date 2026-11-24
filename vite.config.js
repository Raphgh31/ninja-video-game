import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// L'écran de chargement (src/loading/loader.js) est copié tel quel dans index.html, avec ses images intégrées
// (la course du ninja ; les montagnes de l'intro, peintes par tools/ecran_chargement.mjs) : il démarre avant tout le reste du jeu (et dans la version autonome, en un seul fichier).
function loadingScreen() {
  return {
    name: 'ecran-de-chargement',
    transformIndexHtml(html) {
      const png = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
      const code = readFileSync('src/loading/loader.js', 'utf8')
        .replace("'__NINJA_RUN__'", () => `'${png('assets/characters/kage/anims/kage_run.png')}'`)
        .replace("'__MONTAGNES_LOIN__'", () => `'${png('assets/loading/montagnes_loin.png')}'`)
        .replace("'__MONTAGNES_MILIEU__'", () => `'${png('assets/loading/montagnes_milieu.png')}'`);
      return html.replace('<!-- ecran-de-chargement -->', () => `<script>${code}</script>`);
    },
  };
}

// Les assets du jeu vivent dans /assets et sont servis tels quels.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { target: 'es2022' },
  plugins: [loadingScreen()],
});
