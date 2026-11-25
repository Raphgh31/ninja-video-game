# Message d'introduction — création de chapitres

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**.

---

Bonjour ! On reprend mon jeu, et **cette conversation est consacrée uniquement à la **création des chapitres** de l'aventure (décors, zones, mécaniques, ennemis, boss)**.

**Le jeu** : *The Ninja Adventure* (ex « The Ninja Game »), un jeu de plateforme 2D rapide en pixel art, dans un Japon peint (rizières, forêts, montagnes). Le ninja **n'a pas de nom pour le joueur** : il s'appelle KAGE seulement dans le code et les fichiers, jamais à l'écran. Réponds toujours en **français**.

**Ce qui existe** (tout est dans `main` et en ligne, 17 novembre 2026) :
- **le menu de l'intro** : Aventure · Arène · Mon ninja. Il est sobre : aucune consigne ni sous-titre en petit gris.
  - Aventure : deux aventures en parallèle (continuer, nouvelle, effacer).
  - Arène : Nouvelle arène (« Accueillir ») ou Rejoindre avec un code de 4 signes.
  - Mon ninja : le ninja en grand, son pseudo, l'aventure affichée.
- **l'aventure** :
  - le chapitre 1, **le Potager** : 9 zones, terminé, avec le boss **KARASU-KASHI**, le corbeau ;
  - le chapitre 2, **la Forêt** : 12 zones, première version complète et retouchée, sans ennemis pour l'instant ;
  - un marchand et sa boutique de skins, des ryō (la monnaie), des lanternes de reprise, une sauvegarde.
- **l'arène du Potager**, « la rizière du gong », pour jouer jusqu'à quatre en ligne :
  - un salon plein écran ;
  - trois modes : **Souffle unique**, **Trois lames**, **Dix lames** ;
  - une grue et son rocher ficelé, un gong et des vagues, des échafaudages, des cœurs.
- **le ninja** :
  - 28 animations : course, sprint, dash, glissade, saut mural, saltos, sabre, shurikens, coups de pied, lianes, corde… ;
  - 6 skins : Encre, le paysan, l'apprenti tengu, le Samouraï déchu, le pêcheur (canne à pêche et micro-poissons), Lumière d'or ; 5 autres en brouillon.

**Technique** :
- Vite et JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. Image interne 448×252, mise à l'échelle entière (pixels nets).
- Tout le décor est **peint en code** : `src/game/potager/`, `src/game/foret/`.
- **Rendu « pixel art lumineux »** (23-24 novembre 2026, après l'essai abandonné d'une aquarelle) : pixels nets, ninja compris ; la beauté vient de la lumière (étalonnage et liseré peints une fois par tranche de décor, rais, halos, brume, lucioles), **cycle jour-nuit** (5 min de jour, 3 de nuit, lune et étoiles) et **fluidité constante** (60 images/s visées partout ; mémoire constante, rien de lourd peint en pleine partie). Tout est décrit dans `CLAUDE.md` (§ Pile) ; code : `src/game/daylight.js`. Planches : `docs/textures/`.
- **Depuis le 24-25 novembre 2026** : l'accueil arrive sans attente (le monde se charge au choix d'une aventure ou d'une arène, derrière un **écran de chargement** où le ninja court à travers une journée, `src/loading/loader.js`) ; **sous terre**, la lumière ne suit pas le cycle jour-nuit ; **manettes** (PS5, Xbox…) en jeu et dans les menus, avec un **écran de pause** (Options ou Échap) : `src/engine/gamepad.js`. Détails dans `CLAUDE.md`.
- Les sprites sont **générés** par `tools/kage_forge/` (`npm run sprites`) : ne jamais éditer les PNG à la main.
- Interface en police pixel (`src/engine/pixelfont.js`, `pixelui.js`).
- Sur téléphone : plein écran, même échelle que sur ordinateur, et le jeu pivote en portrait.

**Dépôt** : `raphgh31/ninja-video-game`, branche `main`. Travaille sur **une nouvelle branche**.

**Site** : https://raphgh31.github.io/ninja-video-game/ (mis en ligne à chaque push sur `main`).

**Commandes** :
```bash
npm install
npm run sprites   # sprites (ninja, ennemis, boss) avec contrôles qualité
npm test          # carte mentale + build + versions autonomes + 97 tests de bout en bout + 32 de la Forêt
npm run dev       # le jeu en local ; #arene-potager, #foret, #niveau-1, #terrain
```
Commence par `npm install`, `npm run sprites` et `npm test` pour connaître l'état réel.

**Les artefacts claude.ai** (fabriqués par `npm run standalone`) :
- **« The Ninja Adventure Test »**, ma version d'essai :
  - https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (identifiant `cf7a5349-c737-467e-8a85-43de0e34b850`, `dist/kage-test.html`, `shared_live: "public"`) ;
  - pas d'écran titre, un bouton « Réglages » en haut à droite ouvre et ferme le panneau : skins sans achat, chapitres et zones en un clic, bouton Arène ;
  - **elle ne se publie que si je dis « publie-le »** (alors sans redemander) ; si je ne dis rien, ne la publie pas.
- **« The Ninja Adventure »**, le jeu pour tout le monde :
  - https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (identifiant `5f0bb94d-1fa1-48d5-b9b9-f829586682e6`, `dist/kage-standalone.html`, `shared_live: "public"`) ;
  - à la mise en ligne seulement.
- **La carte mentale** :
  - https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (identifiant `a200b822-069e-40b3-b26e-0d1f5b7689cf`) ;
  - fichier produit par `python3 tools/carte_mentale.py --artefact <fichier>`, à la mise en ligne.

**Mes règles** :
- applique **exactement** ce que je demande ;
- montre le résultat : captures zoomées ou GIF (`tools/capture.cjs`), regardées par toi d'abord ;
- vérifie sur ordinateur et sur téléphone, en paysage (~844×390) et en portrait (~390×844) ;
- **planche de design avant tout nouveau personnage, ennemi ou skin** ;
- rendu « jeu indé soigné », jamais générique : de la profondeur, du volume, rien qui flotte, une lumière cohérente ;
- interface discrète et sobre ; **menus apaisants** : aucune phrase d'aide, le marchand ne parle pas, le jeu laisse le joueur s'aventurer ;
- **le son est toujours actif** (ni bouton « Son » ni touche M : le joueur passe son téléphone en silencieux) ;
- commits et documentation en français ;
- **la carte mentale** (`docs/carte-mentale/index.html`) se met à jour dans le même commit que chaque changement du jeu (`npm run carte` vérifie) ;
- `npm run sprites` puis `npm test` verts avant de pousser ;
- **ne fusionne rien et ne mets rien en ligne avant que je le demande** (à la fin d'une série) ;
- **économise la consommation** : lis seulement ce qui est utile, vérifie par lots ;
- à la fin, un résumé clair et simple, avec les captures.

**Lis d'abord, dans l'ordre** :
1. `CLAUDE.md` : les règles du projet (toutes) ;
2. **`docs/GUIDE_CHAPITRE.md`** : la méthode par phases, les leçons du chapitre 1 (tout ce que j'ai fait corriger), l'architecture d'un chapitre, la liste de contrôle ;
3. **`docs/FORET.md`** : le chapitre 2 en entier (zones, direction artistique, retours appliqués n° 1 à 18, ce qui reste au § 9) ;
4. `docs/MONDE.md` : le plan du monde (je refais l'organisation des chapitres : demande-moi la suite) ;
5. `docs/REPRISE.md`, seulement au besoin : état complet, réglages, carte des fichiers, historique.

**L'essentiel des chapitres** :
- un **monde unique** très long : des chapitres de zones, avec lanternes de reprise, ryō, caisses, coffres, marchand, secrets ;
- la sauvegarde suit le ninja d'un chapitre à l'autre : la porte du temple, au bout du Potager, mène à la Forêt ;
- un chapitre = une carte construite zone par zone (`src/game/chapters/<chapitre>.js`, constructeur `Builder`) et un décor **peint en code** (`src/game/<chapitre>/` : fond en parallaxe, tuiles, décors, terrain par tranches, animations) ;
- **toutes les mécaniques du ninja sont actives dès le début**, et chaque passage doit la demander vraiment ;
- **tests de faisabilité** : chaque trou, chaque passage bas, chaque énigme (`tests/e2e.cjs`, `tests/foret.cjs` et ses pilotes `tests/foret_pilotes.js`) ;
- repères : trou de 6 cases pour le dash, 5 pour le sprint ; passage bas d'une case pour la glissade ; chute mortelle au-delà de 10,5 cases ; l'eau et les grands vides sont mortels ;
- **caméra posée** : zone morte en largeur, paliers en hauteur, un seul recadrage fluide au-delà de 3,5 cases. **Jamais de suivi vertical continu** ;
- **phases** : plan → planches (ambiance, puis une par ennemi ou personnage) → greybox jouable → peinture → sons et musique → finitions. Montre chaque étape ;
- un nouveau chapitre apparaît de lui-même dans le panneau de la version test (entrée de `LEVELS` avec un champ `chapter`) ;
- un nouvel ennemi doit être embarqué dans `tools/standalone.mjs`.

**Ce qui attend** :
- **la Forêt** (chapitre 2) : ses ennemis et son boss (des respirations sont prévues pour eux), son marchand (clairière de la zone 12), les finitions de `docs/FORET.md` § 9 ;
- **le chapitre 3** et les suivants, dès que je t'aurai donné leur brief ;
- les retouches que je te demanderai en jouant.

Dis-moi quand tu as lu et compris, en quelques lignes, puis attends ma première demande.
