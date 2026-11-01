# ninja-video-game

Jeu de plateforme 2D rapide (esprit Geometry Dash), pixel art. Répondre en français.

## Pile
- Vite + JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. `npm run dev`, `npm run build`.
- Résolution interne 320×180 sur ordinateur, mise à l'échelle **entière** uniquement (pixels nets, `imageSmoothingEnabled = false`).
- Mobile (`pointer: coarse`) : plein écran, échelle toujours entière ; c'est la zone visible (`VIEW_W`/`VIEW_H`) qui s'adapte à l'écran. Commandes tactiles dessinées dans le canvas (`src/engine/touch.js`).
- `assets/` est le `publicDir` de Vite : les chemins des ressources commencent à `./characters/...`.
- Boucle à pas fixe de 120 Hz (`src/main.js`).

## Personnage KAGE
- Les PNG de `assets/characters/kage/` sont **générés** : ne jamais les éditer à la main. Modifier `tools/kage_forge/` puis `npm run sprites`.
- Le build échoue si un contrôle qualité échoue (pieds hors du sol, slot inconnu, pixel isolé) : corriger la pose, ne pas désactiver le contrôle.
- Cellule 48×32 (le personnage occupe les 32 premières colonnes ; les 16 de droite servent au sabre), ancrage (16, 31), orientation droite, retournement pour la gauche.
- Couleurs = palette slot → couleur (`skins/encre.json`), appliquée depuis `kage_sheet_index.png`. Les skins sont mis de côté pour l'instant (une seule palette) ; un futur skin ne changera jamais la silhouette.
- Chaque animation est liée à un état de `src/game/player.js` (même nom que dans `kage.json`).

## Niveaux
- Cartes ASCII dans `src/game/maps.js` (légende en tête du fichier) ; `Level` gère TATE (E), gong (C), porte (D), lanternes (P), arrivée (G). `#terrain` dans l'adresse ouvre le terrain d'essai, sinon le niveau 1.
- Toute modification d'un passage du niveau 1 doit garder les tests de faisabilité de `tests/e2e.cjs` verts.

## Ennemis
- TATE : dessin dans `tools/kage_forge/enemies/tate.py`, export `build_tate.py` (inclus dans `npm run sprites`), comportement `src/game/tate.js`. Les PNG de `assets/characters/tate/` sont générés.

## Vérifications avant de pousser
- `npm run sprites` puis `npm test` (build + version autonome + tests de bout en bout) sans échec.
- Tester dans un navigateur sur ordinateur, et en mode tactile en paysage (~844×390) et en portrait (~390×844).
