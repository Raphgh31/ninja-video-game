# ninja-video-game

Jeu de plateforme 2D rapide (esprit Geometry Dash), pixel art. Répondre en français.

## Reprise
- Message d'introduction pour une nouvelle conversation : `docs/MESSAGE_NOUVELLE_CONVERSATION.md` (à tenir à jour en fin de série).
- **Lire d'abord `docs/REPRISE.md`** : état du projet, décisions de design, valeurs de réglage, carte des fichiers, préférences de l'utilisateur, pistes restantes.
- **Site du jeu** : https://raphgh31.github.io/ninja-video-game/ — mis en ligne automatiquement par `.github/workflows/deploy.yml` à chaque push sur `main` (réglage du dépôt : *Settings → Pages → Source : GitHub Actions*). Après une fusion, vérifier que le workflow a réussi et tester le site.
- Version de test hors `main` : artefact claude.ai `5f0bb94d-1fa1-48d5-b9b9-f829586682e6` (https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm), à republier avec `dist/kage-test.html` (même jeu que `kage-standalone.html`, produit par `npm run standalone`, mais tous les skins se portent sans achat).
- **Cabine des skins** (artefact claude.ai `cf7a5349-c737-467e-8a85-43de0e34b850`, https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys, privé) : `dist/kage-skins.html` (produit par `npm run standalone`) : le Potager s'ouvre sans écran titre, avec une barre des skins en haut à droite (clic ou touches 1, 2…). À republier quand un skin est ajouté ou retouché.
- **Carte mentale** de tout le jeu : `docs/carte-mentale/index.html` (mode d'emploi dans son README), en ligne avec le jeu (…/ninja-video-game/carte-mentale/). **Règle de l'utilisateur : chaque modification du jeu met aussi la carte à jour**, dans le même commit (boîte ajoutée, état changé, chemins, résumé), puis republier l'artefact de la carte (https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi) avec `python3 tools/carte_mentale.py --artefact <fichier>`. `npm run carte` (inclus dans `npm test`, et vérifié sur chaque PR) échoue si elle a pris du retard.
- Direction choisie par l'utilisateur : un **monde unique** très long (zones, chapitres, sauvegarde, améliorations de KAGE), pas des niveaux séparés. Plan : `docs/MONDE.md` (carte : `tools/monde_carte.py`).

## Façon de travailler (préférences de l'utilisateur)
- Retouches visuelles précises et petites : appliquer exactement ce qui est demandé, montrer le résultat (capture ou GIF : `tools/capture.cjs`), republier l'artefact, résumer clairement.
- Interface discrète et lisible ; rendu « jeu indé soigné », jamais générique.
- Nouveau personnage ou ennemi : présenter une planche de design avant de l'intégrer en jeu.
- Commits et documentation en français.
- Fusion des PR et mise en ligne du site : **seulement à la fin d'une série de modifications** (quand l'utilisateur le demande ou change de conversation). Entre-temps : branche, commits, et republication de l'artefact de test.

## Pile
- Vite + JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. `npm run dev`, `npm run build`.
- Résolution interne **448×252** sur ordinateur (dézoom demandé par l'utilisateur, puis très léger rezoom : on voit loin sans que KAGE paraisse trop petit), mise à l'échelle **entière** uniquement (pixels nets, `imageSmoothingEnabled = false`).
- **Caméra posée, stable avant tout** (`CAM` dans `src/main.js`) : en largeur, zone morte (KAGE va de 30 % à 56 % de la largeur sans qu'elle bouge) puis rattrapage amorti ; en hauteur, des **paliers** : une marche, un saut ou un petit relief ne la font jamais bouger, seul un changement de sol de plus de 3,5 cases déclenche un recadrage, d'un seul mouvement franc et fluide (~0,6 s, lent-rapide-lent) ; sol à 86 % de la hauteur de l'image. La position est **arrondie au pixel une seule fois** et sert à tout dessiner (fond, terrain, personnages) : tout bouge ensemble. Coupe franche à la réapparition. Demande expresse de l'utilisateur : ne pas réintroduire de suivi vertical continu.
- **Paysage sur son propre calque** (`.bg-layer`, sous `#game`, à la résolution réelle de l'écran : `bgK` pixels d'écran par pixel de jeu) : les plans en parallaxe glissent au pixel d'écran près (les montagnes avancent d'un pixel d'écran à la fois au lieu de sauter de 4), demande de l'utilisateur. Le jeu (`#game`) est alors transparent là où il n'y a pas de terrain. Pour une capture, photographier la zone de jeu (les deux calques), pas seulement `#game`.
- Mobile (`pointer: coarse`) : plein écran, même cadrage que sur ordinateur (~252 px de jeu en hauteur) ; l'échelle est entière **en pixels réels de l'écran** (`devicePixelRatio`) et c'est la zone visible (`VIEW_W`/`VIEW_H`) qui s'ajuste. En portrait, tout le bloc de jeu pivote d'un quart de tour (classe `rotated`) : on tourne le téléphone vers la gauche, même avec la rotation bloquée. Commandes tactiles dessinées sur leur **propre calque** (`.touch-layer`, à l'ancienne échelle ~180 px de haut : elles gardent la taille validée sous le pouce ; `src/engine/touch.js`, `setRotation`).
- `assets/` est le `publicDir` de Vite : les chemins des ressources commencent à `./characters/...`.
- Boucle à pas fixe de 120 Hz (`src/main.js`).
- Sons synthétisés (`src/engine/sfx.js`, aucun fichier ; tous les sons remontés de 5 dB en novembre 2026) ; les sons des ennemis s'éteignent hors de l'écran (`sfxAt`). Musique : une piste par chapitre (`assets/music/`, `src/engine/music.js`, champ `music` du chapitre), introduction puis boucle sans couture, préparée par `tools/musique_boucle.py` (ne pas réencoder à la main : refaire depuis la source avec le script).

## Personnage KAGE
- Les PNG de `assets/characters/kage/` sont **générés** : ne jamais les éditer à la main. Modifier `tools/kage_forge/` puis `npm run sprites`.
- Le build échoue si un contrôle qualité échoue (pieds hors du sol, slot inconnu, pixel isolé) : corriger la pose, ne pas désactiver le contrôle.
- Poses dessinées en cellule 48×32 (le personnage occupe les 32 premières colonnes ; les 16 de droite servent au sabre), ancrage (16, 31) ; **à l'export, KAGE est agrandi de 20 %** (`tools/kage_forge/scale.py` : lignes et colonnes doublées, jamais de zoom) en cellule 57×36, ancrage (19, 35) ; TATE et WARA de même (`enemies/grow20.py`), pas KARASU-KASHI. Boîtes de collision du corps de KAGE inchangées (passages du niveau), zones de frappe et boîtes des ennemis agrandies ; orientation droite, retournement pour la gauche.
- Couleurs = palette slot → couleur (`skins/encre.json`), appliquée depuis `kage_sheet_index.png`. Skins en cours (planche `tools/kage_forge/skin_board.py`) : un skin change la palette, et ses **accessoires** (chapeau, masque…) peuvent changer la silhouette (accord de l'utilisateur) ; jamais les animations ni la boîte de collision.
- Chaque animation est liée à un état de `src/game/player.js` (même nom que dans `kage.json`).

## Niveaux
- Cartes ASCII dans `src/game/maps.js` (légende en tête du fichier) ; `Level` gère TATE (E), WARA (W), gong (C), porte (D), lanternes (P), arrivée (G), et pour les chapitres ryō (o), caisses (B, elles tombent sans support), marchand (M), bois (=), bambou (|), eau (~), bloc invisible (%), **passerelle `-`** (traversable par-dessous, on se pose dessus en retombant), **plateforme fragile `_`** (arène du boss, s'effondre) ; les blocs d'une grue (`K`) sont posés par le niveau.
- L'adresse sans `#` ouvre le **chapitre 1, le Potager** (écran titre, sauvegarde) ; `#niveau-1` l'ancien niveau 1, `#terrain` le terrain d'essai.
- Le Potager est construit zone par zone dans `src/game/chapters/potager.js` ; son décor est **peint en code** dans `src/game/potager/` (fond en parallaxe `backdrop.js`, tuiles `tiles.js`, décors `props.js`, terrain par tranches `world.js`, animations `live.js`, palette `palette.js`, outils `paint.js`). Tout est calculé une fois au chargement (~0,8 s), puis recopié à chaque image. Trous : 6 cases pour le dash, 5 pour le sprint ; passages bas d'une case pour la glissade ou le dash (le bas des feuillages et de l'étagère y est peint ~6 px plus haut que la case : KAGE glisse à 20-21 px de haut). Échelles : `Builder.ladder(bx, tx, rangée, h)`, du bout d'une plateforme au début de la suivante. **Chapitre 1 terminé** (novembre 2026, `docs/REPRISE.md` § 6 quinquies et sexies) : grue de bambou (`Builder.crane` ; son mât est une tour infranchissable par le haut), serre à quitter par la charpente, bosquets de bambous (posés au sol = murs pour le saut mural ; suspendus = feuillage bas), plateformes sur pilotis cultivées.
- Toute modification d'un passage du niveau 1 ou du Potager doit garder les tests de faisabilité de `tests/e2e.cjs` verts.

## Ennemis
- TATE : dessin dans `tools/kage_forge/enemies/tate.py`, export `build_tate.py` (inclus dans `npm run sprites`), comportement `src/game/tate.js`. Les PNG de `assets/characters/tate/` sont générés.
- WARA (épouvantail) : dessin dans `tools/kage_forge/enemies/wara.py`, export `build_wara.py` (inclus dans `npm run sprites`, avec contrôles qualité), planches `wara_board.py`, comportement `src/game/wara.js` (constantes `WARA`). Les PNG de `assets/characters/wara/` sont générés.
- KARASU-KASHI (mini-boss du Potager, zone 9) : dessin dans `tools/kage_forge/enemies/karasu.py`, export `build_karasu.py` (inclus dans `npm run sprites`), planches `karasu_board.py`, comportement `src/game/karasu.js` (constantes `KARASU`). Les PNG de `assets/characters/karasu/` sont générés. Refondu en novembre 2026 : il lâche des pierres prises sur deux tas de l'arène, vole deux fois plus haut (hors de portée depuis le sol), tombe bec planté quand un saut + sabre l'atteint depuis les plateformes fragiles (`_`), ce qui les effondre, puis plonge en arc. Il tient ses pierres dans ses serres (images `carry_`/`open_`, point `grip` dans `karasu.json`). Sa défaite ouvre la porte du temple (`level.doorOpen`, vantaux lents : `GATE_TIME`) et est sauvegardée (`bossDefeated`). La porte du temple est un pavillon peint en perspective dans `src/game/potager/temple.js`, au bout du monde (le chapitre s'arrête juste derrière) ; intérieur au choix (`INTERIORS`, `?porte=`). Fiche : `docs/enemies/README.md`.
- Un nouvel ennemi doit aussi être embarqué dans `tools/standalone.mjs` (sinon la version autonome ne démarre pas).

## Vérifications avant de pousser
- Carte mentale mise à jour pour ce changement (voir Reprise).
- `npm run sprites` puis `npm test` (carte mentale + build + version autonome + tests de bout en bout) sans échec.
- Tester dans un navigateur sur ordinateur, et en mode tactile en paysage (~844×390) et en portrait (~390×844).
