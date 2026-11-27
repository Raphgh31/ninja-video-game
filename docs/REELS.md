# Les Reels Instagram du jeu — guide technique

Comment on fabrique une vidéo de promotion de *The Ninja Adventure* (format Reel 9:16) **directement à partir du jeu**, sans logiciel de montage. Premier essai : l'intro « Week 1 » (27 novembre 2026), `docs/reels/week1_intro.mp4`, validée par Raph (« plutôt très propre »).

## 1. Le principe

1. **Tourner** : le jeu tourne dans un navigateur (Playwright), **piloté image par image** : l'horloge du jeu est mise en pause, et chaque image avance d'exactement 1/30 s (`page.clock.runFor`). Le ninja est conduit au clavier simulé (flèches, Espace…), l'heure du jour réglée à volonté (`__kage.cycle.t`). Chaque image est photographiée en **5×** (2240 × 1260 : le jeu entier, 448 × 252 pixels de jeu), **sans l'interface** (`window.__KAGE_CLEAN = true`). Aucune saccade, pixels nets.
2. **Monter** : chaque image du Reel (1080 × 1920) est composée dans une toile (`tools/reels/compose.js`) : le cadre du jeu recadré (1080 × 1260, soit 216 pixels de jeu de large) avec un **panoramique au pixel d'écran près**, les textes **dans la police du jeu** (`renderText` de `src/engine/pixelfont.js`, agrandis d'un nombre entier), les **traits d'encre en pixels de jeu** (5 × 5 pixels d'écran).
3. **Encoder** : ffmpeg, H.264, `yuv420p`, CRF 14, `+faststart`, 30 images/s (`tools/reels/monter.mjs`).

## 2. Les fichiers

- `tools/reels/tourner.cjs` : le tournage (chorégraphie de l'intro « Week 1 » : soleil levant, entrée en courant, saut + salto). Écrit `frames/gNNNN.png` et `track.json` (position du ninja et de la caméra à chaque image, pour le recadrage).
  `node tools/reels/tourner.cjs <dossier> dry 172 20` (à blanc, rapide, pour régler) puis `… shoot 172 20` (avec les images ; ~5 min pour 285 images).
- `tools/reels/compose.js` : le montage d'une image (textes, pinceaux, recadrage, transitions) ; `tools/reels/index.html` : la page qui le charge.
- `tools/reels/monter.mjs` : `node tools/reels/monter.mjs <dossier> <sortie.mp4> [n premières images]` (lance son propre serveur Vite sur le port 5291).
- `docs/reels/` : les Reels faits, leur planche d'images clés, leur `track.json`.

Le tournage demande le jeu construit et servi : `npm run build` puis `npx vite preview --port 5290 --strictPort` (en arrière-plan).

## 3. Les leçons (à ne pas refaire)

- **Mettre l'horloge en pause** après le chargement : `await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200))`. Sans cela, l'horloge simulée de Playwright continue d'avancer en temps réel, et chaque capture (lente : ~1 s en 5×) laisse le jeu courir : le ninja traverse tout le niveau.
- **Fenêtre de 2250 × 1440** pour que le jeu se mette à l'échelle 5× (vérifier : `#game` fait 2240 × 1260). En 4×, le cadre est trop petit dans le 9:16 et le ninja trop petit sur un téléphone.
- **Partir d'une aventure neuve** sans menu : `sessionStorage.setItem('kage-go', 'new')` et `window.__KAGE_SKIP_INTRO = true` avant le chargement ; cacher `.ui, header, footer, .state`.
- **Cacher le ninja** avant son entrée : remplacer `__kage.player.draw` par une fonction qui ne dessine rien tant que `window.__hide` est vrai.
- **Un saut complet** : tenir Espace (≈ 4 images), le relâcher, puis le rappuyer en l'air pour le salto (`keyboard.down`/`up`, pas `press`).
- **Vérifier sur une planche d'images clés** (une image toutes les ~0,5 s, à 270 × 480) puis une image en grand : c'est ainsi qu'on a vu le noir en trop, la tache d'encre brouillon et le sous-titre trop petit du premier jet.
- **Zones sûres d'Instagram** : rien d'important dans les ~220 premiers pixels (en haut) ni dans les ~400 derniers (légende et boutons) ; textes entre y ≈ 220 et y ≈ 1500, jamais collés au bord droit (boutons).
- **Rendu « pas IA »** : pas de flou, pas de dégradés criards, pas d'effets génériques ; tout dans le style du jeu (pixels nets, encre, or, nuit de l'intro).
- **Pas de son** dans le fichier : Raph ajoute la musique (tendance) sur Instagram. Les musiques du jeu viennent de vidéos (droits non acquis) : ne pas les mettre dans un Reel.

## 4. La mise en page validée (intro « Week 1 »)

- Fond `#0b0c12`, cadre du jeu à y = 440 (1080 × 1260), bords haut et bas fondus dans le noir sur 90 px.
- Textes du haut : police du jeu, corps `big` ×4 (crème `#efe6d2`) et ×6 (doré `#f2b866`) ; lettre à lettre à 26 lettres/s.
- Carte de titre : coup de pinceau sumi-e (`brushBand`) sur le ciel, *THE NINJA ADVENTURE* (corps `title` ×2) découvert de gauche à droite, trait doré dessous ; « WEEK 1 » (`big` ×4, doré) et la promesse (`big` ×3) au-dessus du cadre.
- Sortie : grand coup d'encre en diagonale (`inkWipe`) vers le noir, raccord pour la suite.
