# Construire un nouveau chapitre — guide pour Claude

Ce guide est écrit pour la session qui construira le **chapitre 2** (une forêt dense et mystérieuse), puis les suivants. Il réunit trois choses : **la méthode de travail** que l'utilisateur attend, **l'architecture** à suivre pour brancher un chapitre, et **les leçons du chapitre 1** : tout ce que l'utilisateur a fait corriger pendant des semaines de retouches. Le but : livrer une première version si soignée qu'il reste le moins de retouches possible.

À lire avec `CLAUDE.md` (règles du projet), `docs/REPRISE.md` (état complet, valeurs de réglage, carte des fichiers) et `docs/MONDE.md` (plan du monde).

---

## 1. La méthode : par phases, en montrant à chaque étape

L'utilisateur préfère qu'on lui présente les choix importants **avant** de coder, et qu'on avance par phases. Une erreur de direction vue sur une planche coûte une phrase ; vue dans un chapitre peint, elle coûte une journée.

1. **Lire et comprendre son brief.** S'il est ambigu sur un point qui change le travail (une mécanique, l'ordre des zones, la fin du chapitre), **demander avant de faire** — en une seule fois, avec des propositions concrètes. Ne pas demander ce qu'on peut décider avec bon sens : le dire et avancer.
2. **Plan du chapitre** (court, en français, sans jargon) : les zones une par une (une idée de gameplay par zone, comment la difficulté monte), les lanternes, les secrets et les ryō, les énigmes, les ennemis, le boss, la musique, l'ambiance. Le lui soumettre.
3. **Planches de design** avant toute intégration : planche d'ambiance du décor (palette, plans du fond, tuiles, quelques décors), puis **une planche par nouvel ennemi ou personnage** (poses, animations clés, taille à côté de KAGE). Règle de l'utilisateur, jamais d'exception. Les outils des planches existantes servent de modèle (`tools/kage_forge/enemies/*_board.py`).
4. **Greybox jouable** : la carte en tuiles, toutes les zones, les mécaniques, les lanternes, les tests de faisabilité. Vérifier qu'aucun raccourci ne contourne une énigme (§ 4).
5. **Peinture** : fond en parallaxe, tuiles, décors, puis ce qui bouge (eau, feuillage, faune, lumière).
6. **Sons et musique**, puis finitions.

À chaque étape : captures (et GIF pour ce qui bouge) prises avec `tools/capture.cjs`, **regardées et zoomées par soi-même avant de les montrer** (×4 à ×8 sur les détails), republication de la version de test, résumé clair. Vérifier aussi sur téléphone, en paysage (~844×390) et en portrait (~390×844), et sur un écran haut (iPad : il joue aussi sur iPad).

**Pendant la série** : branche, commits en français, carte mentale mise à jour dans le même commit, artefact de test republié. **Pas de fusion ni de mise en ligne à chaque étape** : à la fin de la série seulement (quand il le demande ou change de conversation).

---

## 2. Ce que l'utilisateur regarde (leçons du chapitre 1)

Chaque point ci-dessous est une correction qu'il a réellement demandée. Les anticiper, c'est éviter autant d'allers-retours.

### La profondeur et le volume
- **Cohérence de la profondeur** : ce qui est loin passe derrière ce qui est proche (cascade derrière les plateformes, colline derrière le bloc de pierre). Un décor de fond ne doit jamais passer devant le terrain jouable.
- **Du volume partout** : rien de « plat », pas de « feuille de papier », de « dalle de béton », de cercle parfait. Les rizières faisaient « feuille de papier » : il a fallu leur donner une ombre au fond, une diguette éclairée devant, des rangs qui suivent la courbe.
- **Irrégularité naturelle** : jamais de coupe droite (flancs de terre ondulés, pierres qui dépassent, gradins de largeurs différentes, bords de feuillage déchiquetés).
- **Une lumière cohérente** : éclairé à gauche, ombre à droite, partout.

### Rien ne flotte, tout tient
C'est la correction la plus fréquente :
- les poteaux des pilotis s'arrêtaient sous les planches : les plateformes semblaient flotter ;
- un bloc de pierre « lévitait » au-dessus de la grue ;
- un poteau de la tour de bambou « lévitait » en haut ;
- des échelles ne touchaient pas les plateformes (une échelle part du **bout** de la plateforme du dessous et s'accroche au **début** de celle du dessus : `Builder.ladder`) ;
- l'escalier de bois devait être **cloué à deux limons de biais**, avec assez de marches (au moins 4) ;
- les poteaux d'angle de la grange montaient dans le chaume ;
- une voûte de branches peinte à hauteur fixe « flottait » sur les écrans plus hauts (iPad).

**Règle** : tout objet a un appui visible (poteau, corde, mur, sol). Vérifier chaque élément suspendu ou porté sur une capture zoomée, et sur un écran haut.

### Le jeu doit vraiment demander la mécanique
- La grue a été refaite trois fois : « on peut juste sauter dessus » ; « éloigne la grue encore beaucoup » ; il fallait que **seul le shuriken** permette de passer. **Pour chaque énigme, tester que la solution voulue est nécessaire et que les raccourcis échouent** (sprint, saut + dash, saut mural, passer par-dessus) : tests dans `tests/e2e.cjs` (voir ceux de la grue).
- Les zones où l'on doit beaucoup recommencer frustrent : il a demandé des **lanternes plus fréquentes** (une au début de chaque zone, plus une avant chaque énigme difficile).
- Difficulté : il cherche « le juste milieu ». Pour le boss, monter la difficulté par sorties (3, 3, puis 4 pierres) et toujours **annoncer** le danger (ombre au sol avant la chute d'une pierre).
- Récompenser la curiosité : des ryō en hauteur (toit de la serre, poutre de charpente, grenier), un coffre caché.

### KAGE et les personnages
- **Taille réelle, silhouette fine** : il a refusé une vue de dos de KAGE qui « se tassait » et paraissait plus petite. Ne jamais rapetisser ni écraser KAGE.
- **Passages bas** : KAGE glisse à 20-21 px de haut dans un passage de 16 px. Peindre le bas des feuillages et étagères **~6 px plus haut que la case**, sinon sa tête est dans les feuilles (les collisions ne changent pas).
- **Personnalité des ennemis** : le corbeau toise KAGE sur son perchoir et croasse avant d'attaquer, il tient visiblement sa pierre dans ses serres (pas une pierre qui pend). Montrer les gestes, pas seulement l'effet.
- Il a fini par **supprimer l'animation d'entrée dans la porte** : il préfère que le joueur garde la main. Éviter les cinématiques qui retirent le contrôle.

### Ce qui se passe doit se passer sous ses yeux
- La porte du temple s'ouvrait dès la défaite du corbeau, hors de l'image : il a demandé qu'elle s'ouvre **quand KAGE la voit**. Tout événement important (porte, effondrement, apparition) se déclenche quand il est à l'écran.

### Le son
- Sons **discrets** et **synchronisés avec l'image** : le battement d'ailes du corbeau suit la descente de l'aile ; il a demandé de le rendre plus lent et plus bas.
- Musique : fondus enchaînés doux, mais pas trop lents ; la musique du boss commence **un peu avant** l'arène. Les boucles doivent repartir sans couture (`tools/musique_boucle.py`, option `--fondu`).
- Les sons des ennemis hors de l'écran sont muets (`sfxAt`).

### L'image
- **Stabilité avant tout** : caméra à paliers, aucun suivi vertical continu (demande expresse). Le paysage glisse au pixel d'écran près (calque `.bg-layer`).
- **Interface discrète et lisible** : barres fines, peu de texte, une aide contextuelle à la fois.
- Rendu « jeu indé soigné » (référence citée : Owlboy), jamais générique.

---

## 3. L'architecture : brancher un chapitre

### Comment le chapitre 1 est branché
| Élément | Où | Remarque |
|---|---|---|
| Définition du chapitre | `src/game/chapters/potager.js`, `export const POTAGER` | `name`, `map` (lignes ASCII), `zones`, `props`, `hints`, `backdrops`, `cranes`, `legacyCheckpoints`, `boss`, `theme`, `chapter`, `music`, `bossMusic`, `next` |
| Construction de la carte | même fichier, classe `Builder` | `flat`, `gap`, `block`, `row`, `ladder`, `on`, `coins`, `zone`, `prop`, `propBack`, `hint`, `crane`, `backdrop` ; hauteur `H = 22`, sol de référence `G = 19` |
| Enregistrement | `src/game/maps.js`, `LEVELS` | l'adresse sans `#` ouvre `potager` ; `#niveau-1`, `#terrain` |
| Légende des tuiles | en tête de `maps.js` et de `potager.js` | `#` `=` `|` `~` `-` `_` `%` `B` `o` `W` `E` `P` `M` `S` `G` `D` `K` |
| Peinture | `src/game/potager/` (`index.js` = `PotagerArt` : `drawBack`, `drawBehind`, `drawFront`) | branchée par `level.js` : `this.art = this.theme === 'potager' ? new PotagerArt(this) : null` |
| Outils de peinture | `potager/paint.js` (bruit, tramage, `Brush`, `canvas`, `pick`), `potager/palette.js` | génériques : à réutiliser |
| Fond en parallaxe | `potager/backdrop.js` | peint sur son propre calque à la résolution de l'écran (`hiBackdrop`, voir `main.js`) |
| Terrain | `potager/tiles.js` (matières par zone), `potager/world.js` (tranches de 512 px peintes à la demande) | |
| Décors | `potager/props.js` (+ décors automatiques : poteaux des passerelles…) | |
| Ce qui bouge | `potager/live.js` | eau, feuillages, faune, lumière, marchand |
| Porte de fin | `potager/temple.js` | perspective peinte ; son intérieur montre déjà la forêt du chapitre 2 (`paintInterior`, `foret`) |
| Boss | `src/game/karasu.js` + sprites `tools/kage_forge/enemies/karasu*.py` | chargé dans `main.js` si `level.boss` |
| Musique | `assets/music/`, `src/engine/music.js`, champs `music` / `bossMusic` | préparer avec `tools/musique_boucle.py` |
| Sauvegarde | `src/game/save.js` | **une seule sauvegarde, liée à un chapitre** (`chapter`) : voir § 3.2 |
| Version autonome | `tools/standalone.mjs` | embarque sprites, musiques, sons : **tout nouvel ennemi, musique ou son doit y être ajouté** |
| Tests | `tests/e2e.cjs` | les repères sont cherchés dans la carte (pas de numéros de colonne en dur) |

### 3.1 Ce qu'il faudra créer pour le chapitre 2
- `src/game/chapters/<chapitre>.js` sur le modèle de `potager.js`. Le `Builder` est aujourd'hui dans `potager.js` : le **sortir dans un module commun** (`src/game/chapters/builder.js`) pour le partager, sans changer le Potager (les tests le vérifient).
- Un dossier de peinture `src/game/<theme>/` sur le modèle de `src/game/potager/` (`index.js` exposant `drawBack`, `drawBehind`, `drawFront`) ; brancher le thème dans `level.js` (aujourd'hui seul `potager` a une peinture). Réutiliser `paint.js` et la logique de `world.js` (les sortir dans un module commun si besoin).
- L'entrée dans `LEVELS` (`maps.js`), avec une adresse (`#chapitre-2` par exemple) pour l'ouvrir directement pendant le développement.
- Les nouveaux ennemis : dessin dans `tools/kage_forge/enemies/`, export ajouté à `npm run sprites`, contrôles qualité, comportement dans `src/game/`, embarqué dans `tools/standalone.mjs`, fiche dans `docs/enemies/README.md`.
- Les tests de faisabilité de chaque passage, comme pour le Potager.
- La carte mentale : une branche ou des boîtes pour le chapitre 2 (`docs/carte-mentale/index.html`, liste `BRANCHES`).

### 3.2 Décisions à soumettre à l'utilisateur (le code ne les tranche pas encore)
- **Le passage du chapitre 1 au chapitre 2.** Aujourd'hui, KAGE passe derrière la porte du temple et l'écran de fin s'affiche (« la suite arrive bientôt », champ `next`). Le monde se veut **continu** (`docs/MONDE.md`) : proposer comment on entre dans la forêt (enchaînement direct après la porte, ou écran de chapitre puis chargement) et ce que devient l'écran de fin.
- **La sauvegarde entre chapitres** : elle est liée à un seul chapitre ; les ryō, les skins achetés et le boss vaincu doivent suivre KAGE d'un chapitre à l'autre (sans casser les sauvegardes existantes : champ `v`, clé `kage.save.v1`).
- **Le marchand du chapitre 2** (une cabane par chapitre, point de téléportation prévu dans `MONDE.md`) et les **aides contextuelles** (prévues pour le premier chapitre seulement).

---

## 4. Liste de contrôle avant de montrer une étape

- [ ] Chaque énigme : la solution voulue fonctionne, **les raccourcis échouent** (testé).
- [ ] Chaque trou et chaque passage est franchissable (gabarits : saut 3,8 cases, sprint 5,5, course + dash 7, hauteur 3,1 ; trou de dash 6 cases, de sprint 5 ; passage bas d'une case).
- [ ] Une lanterne au début de chaque zone et avant chaque passage difficile.
- [ ] Aucun objet ne flotte ; tout a un appui visible ; échelles et escaliers bien accrochés.
- [ ] Profondeur cohérente, volume, irrégularité, lumière de gauche.
- [ ] Bas des feuillages des passages bas peint ~6 px au-dessus de la case.
- [ ] Les blocs invisibles `%` suivent exactement ce que montre la peinture (toit, foin, mât…).
- [ ] Les événements importants se déclenchent à l'écran.
- [ ] Sons discrets, synchronisés ; musique en boucle sans couture.
- [ ] Captures regardées et zoomées par soi-même ; ordinateur, téléphone paysage et portrait, écran haut.
- [ ] Chargement raisonnable (tout est peint une fois au chargement : ~0,8 s pour le Potager) et 60 images/s.
- [ ] `npm run sprites` puis `npm test` sans échec ; carte mentale à jour dans le même commit.
- [ ] Version de test republiée (`dist/kage-test.html`), résumé clair en français.

## 5. Pièges techniques connus
- Les PNG des personnages sont **générés** : ne jamais les éditer, modifier la forge puis `npm run sprites`. Le build échoue si un contrôle qualité échoue : corriger la pose, jamais le contrôle.
- Boîtes de collision du corps de KAGE inchangées (`default`, `slide`, `dash`) : les passages sont faits pour elles.
- Pixels nets : échelle entière seulement, `imageSmoothingEnabled = false`, position de la caméra arrondie une seule fois.
- Pour une capture, photographier toute la zone de jeu (le calque du paysage `.bg-layer` est sous `#game`, qui est transparent hors du terrain).
- Le réseau de l'environnement Claude bloque le site en ligne : tester `dist/kage-standalone.html` (même jeu) avec Playwright.
- Ne pas réencoder une musique à la main : refaire depuis la source avec `tools/musique_boucle.py`.
