# Message d'introduction — création des arènes

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**.

---

Bonjour ! On reprend mon jeu, et **cette conversation est consacrée uniquement à la **création des arènes** (le mode combat à plusieurs)**.

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
2. **`docs/ARENES.md`** : le guide complet des arènes (état, fichiers, l'arène du Potager pièce par pièce, caméra, réseau, salon et modes, méthode pour une nouvelle arène, leçons) ;
3. `src/game/chapters/arene_potager.js` (la carte), puis `src/game/arena/arena.js` (les mécanismes) en survol ;
4. `docs/GUIDE_CHAPITRE.md` § 2 : ce que je regarde dans un décor (leçons du chapitre 1) ;
5. pour le style d'un chapitre : `src/game/potager/` (le Potager) ou `docs/FORET.md` et `src/game/foret/` (la Forêt).

**L'essentiel des arènes** :
- **une arène par chapitre**, dans le style du chapitre ;
- l'arène du Potager est faite (« la rizière du gong ») : deux fois la largeur de l'image, trois étages, un canal mortel au centre, une grue et son rocher ficelé, un gong qui lâche une vague, des échafaudages qui s'effondrent sous le rocher, du foin, des caisses, des cœurs ;
- on joue jusqu'à quatre (PeerJS : l'hôte accueille et relaie), dans un salon plein écran (code, mode, quatre places). L'hôte lance ; un mort donne un point à l'autre ;
- modes : **Souffle unique**, **Trois lames**, **Dix lames** (`MODES` dans `src/game/multi.js`) ;
- **sur téléphone, en combat, l'image est un cran plus proche**, et la caméra n'a que deux hauteurs : en bas, et en haut, une montée légère d'un seul mouvement. **Jamais de suivi vertical continu** ;
- tout piège nouveau doit être **partagé en réseau** (`hookArena` dans `multi.js`) et testé (`tests/e2e.cjs`, combat à deux en transport local `?net=local`) ;
- **propose-moi les éléments d'une arène avant de la construire** : j'ai validé puis corrigé chaque élément de la première. Pas d'objets étrangers au monde du jeu, rien qui flotte, chaque plateforme atteignable par un vrai saut ;
- le service PeerJS n'est pas joignable depuis ton environnement : seul le transport local s'y teste.

**Ce qui attend** :
- **l'arène de la Forêt** (chapitre 2), à proposer d'abord ;
- le choix de l'arène dans le salon quand il y en aura plusieurs ;
- plus tard : des adversaires pilotés par l'ordinateur, les statistiques d'arène dans « Mon ninja » (combats, victoires, titres) ;
- les retouches que je te demanderai sur l'arène du Potager.

Dis-moi quand tu as lu et compris, en quelques lignes, puis attends ma première demande.
