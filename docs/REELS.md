# Les Reels Instagram du jeu — guide technique

Comment on fabrique une vidéo de promotion de *The Ninja Adventure* (format Reel 9:16) **directement à partir du jeu**, sans logiciel de montage. Premier essai : l'intro « Week 1 » (27 novembre 2026), `docs/reels/week1_intro.mp4`, validée par Raph (« plutôt très propre »). Puis la vidéo « Week 1 » complète (intro + suite, script A « Une journée dans le jeu », 27 novembre 2026) : `docs/reels/week1.mp4` (30,8 s).

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

## 5. La vidéo « Week 1 » complète (script A : une journée dans le jeu)

`docs/reels/week1.mp4` (30,8 s, 1080 × 1920, 30 images/s, sans son) = l'intro (coupée à 9,2 s : moins de noir avant la suite) + la suite (21,6 s), planche `docs/reels/week1_planche.png`, recadrages des plans dans `docs/reels/week1/`. Déroulé de la suite (temps de la vidéo entière) :

| Temps | Plan (heure du jeu) | Textes |
|---|---|---|
| 9,2 – 13,5 | Le Potager au matin, le vieux verger : course, un épouvantail abattu au sabre, saut sur le talus, un second | « Two worlds so far. » · « WORLD 1 · THE GARDEN » |
| 13,3 – 16,9 | La Forêt à midi, « Le souffle des lianes » : balancier, lâcher, atterrissage, saut sur la liane suivante | « WORLD 2 · THE FOREST » |
| 16,7 – 20,6 | Le corbeau à l'heure dorée : sur la plateforme fragile, saut + sabre, il tombe, les plateformes s'effondrent, un dernier coup | « A crow boss. » · « It throws rocks. » |
| 20,2 – 24,3 | Le duel dans la rizière : la nuit tombe pendant le combat, la lune se lève, coup fatal (ralenti du jeu) | « Online duels. » · « Best of three. » |
| 23,9 – 30,8 | La maison du début de l'intro, la nuit, sous la lune ; le ninja s'y arrête ; carte de fin : coup de pinceau sur le ciel, le titre, trait doré ; fondu au noir (la boucle d'Instagram repart du noir de l'intro) | « Soon on Steam & mobile. » · « Made alone, week by week. » puis « Follow to help it grow. » · « Week 2 is coming. » |

**Les outils (pour tous les Reels à plusieurs plans)** :
- `tools/reels/plan.cjs <plan> <dossier> dry|shoot` : un plan (fichier `tools/reels/week1/*.cjs` : lieu, heure image par image, mise en place, `ctl` joué dans la page à chaque image). Le jeu n'avance que par `__kage.step` (4 pas de 1/120 s par image), le ninja est piloté **dans la page** (le pilote des tests, `tests/foret_bot.js` et `tests/foret_pilotes.js` : `bot.runner`, `P.vise` pour les lianes, `bot.tap`…), et **`Math.random` a une graine** : le réglage à blanc et le tournage donnent exactement les mêmes images. `debut` : images jouées sans être tournées (la mise en place). `dry` : une vignette toutes les 5 images, en 2×, et la planche `dry.png` (~10 s par plan au lieu de ~3 min).
- `tools/reels/jeu.cjs` : ouvrir le jeu (aventure neuve ou arène contre l'ombre : `salle`), le figer, poser le ninja.
- `tools/reels/monter_plans.mjs <montage.json> <dossier des tournages> <sortie.mp4>` (ou `<planche.png> --images 0,30,…` pour vérifier quelques images sans tout monter) ; `tools/reels/week1/montage.json` place les plans dans le temps (chevauchement de 10 images aux raccords).
- `tools/reels/week1_suite.js` : le montage (recadrage amorti par plan, raccords, textes, carte de fin) ; `tools/reels/encre.js` : les outils communs (textes, pinceaux, balayage), partagés avec `compose.js` (l'intro).

Commandes (le jeu servi sur le port 5290) :
```bash
node tools/reels/plan.cjs tools/reels/week1/3_corbeau.cjs /tmp/w1/3_corbeau dry
node tools/reels/plan.cjs tools/reels/week1/3_corbeau.cjs /tmp/w1/3_corbeau shoot
node tools/reels/monter_plans.mjs tools/reels/week1/montage.json /tmp/w1 /tmp/w1/suite.mp4
```

**Leçons** :
- **Le raccord au pinceau** (`brushCut`) : le plan suivant se découvre derrière un bord déchiqueté qui balaie le cadre de gauche à droite (le haut d'abord), avec un liseré d'encre de 2-3 pixels de jeu ; 10 images (0,33 s). Vif, dans le style du jeu, jamais une coupe sèche.
- **Textes** : la phrase du haut en `big` ×5 si elle tient dans 1000 px (sinon ×4 : au-delà de ~21 lettres) ; la ligne dorée toujours un cran plus petite. ×3 est trop petit sur un téléphone pour une phrase principale.
- **À éviter à l'image** : les textes du jeu en français (« Manche 1 », « Combattez », « Revoir », « Manche à … » : couper le duel avant `duel.phase === 'replay'`), les noms au-dessus des ninjas (`multi.hideTags = true`), le clignotement d'invincibilité (rendre le ninja intouchable par `player.hurt = () => false`, pas par `invuln`), la pose « vaincu » du corbeau (pâle : lui laisser des points de vie).
- **Lisibilité de nuit** : la canopée de l'arène de la Forêt, la nuit, est trop sombre (ninjas noirs sur fond sombre) ; la rizière de l'arène du Potager, du coucher du soleil à la nuit, se lit bien.
- **Plusieurs tournages en parallèle** : la machine chargée dépasse les délais (chargement, `clock.pauseAt`) ; `jeu.cjs` attend et réessaie. Trois tournages en même temps : ~6 min pour les cinq plans.
- **Assemblage** : `ffmpeg … -filter_complex "[0:v]trim=end_frame=276…concat"` (une seule réencodage, CRF 14).
