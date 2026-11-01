# ninja-video-game

Jeu de plateforme 2D rapide (esprit Geometry Dash), pixel art. Répondre en français.

## Pile
- Vite + JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. `npm run dev`, `npm run build`.
- Résolution interne 320×180, mise à l'échelle **entière** uniquement (pixels nets, `imageSmoothingEnabled = false`).
- `assets/` est le `publicDir` de Vite : les chemins des ressources commencent à `./characters/...`.
- Boucle à pas fixe de 120 Hz (`src/main.js`).

## Personnage KAGE
- Les PNG de `assets/characters/kage/` sont **générés** : ne jamais les éditer à la main. Modifier `tools/kage_forge/` puis `npm run sprites`.
- Le build échoue si un contrôle qualité échoue (pieds hors du sol, slot inconnu, pixel isolé) : corriger la pose, ne pas désactiver le contrôle.
- Cellule 48×32 (le personnage occupe les 32 premières colonnes ; les 16 de droite servent au sabre), ancrage (16, 31), orientation droite, retournement pour la gauche.
- Skins = tables slot → couleur (`skins/*.json`), appliquées depuis `kage_sheet_index.png`. Un skin ne change jamais la silhouette.
- Chaque animation est liée à un état de `src/game/player.js` (même nom que dans `kage.json`).

## Vérifications avant de pousser
- `npm run sprites` puis `npm run build` sans erreur.
- Tester dans un navigateur sur ordinateur et à ~390 px de large (commandes tactiles).
