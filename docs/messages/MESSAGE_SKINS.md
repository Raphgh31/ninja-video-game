# Message d'introduction — création de skins

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**.

---

Bonjour ! On reprend mon jeu, et **cette conversation est consacrée uniquement à la **création des skins** du ninja**.

**Le jeu** : *The Ninja Adventure* (ex « The Ninja Game »), un jeu de plateforme 2D rapide en pixel art, dans un Japon peint (rizières, forêts, montagnes). Le ninja **n'a pas de nom pour le joueur** : il s'appelle KAGE seulement dans le code et les fichiers, jamais à l'écran. Réponds toujours en **français**.

**Ce qui existe** (tout est dans `main` et en ligne, 16 novembre 2026) :
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
  - 4 skins : Encre, le voyageur, le paysan, Lumière d'or ; 7 autres en brouillon.

**Technique** :
- Vite et JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. Image interne 448×252, mise à l'échelle entière (pixels nets).
- Tout le décor est **peint en code** : `src/game/potager/`, `src/game/foret/`.
- Les sprites sont **générés** par `tools/kage_forge/` (`npm run sprites`) : ne jamais éditer les PNG à la main.
- Interface en police pixel (`src/engine/pixelfont.js`, `pixelui.js`).
- Sur téléphone : plein écran, même échelle que sur ordinateur, et le jeu pivote en portrait.

**Dépôt** : `raphgh31/ninja-video-game`, branche `main`. Travaille sur **une nouvelle branche**.

**Site** : https://raphgh31.github.io/ninja-video-game/ (mis en ligne à chaque push sur `main`).

**Commandes** :
```bash
npm install
npm run sprites   # sprites (ninja, ennemis, boss) avec contrôles qualité
npm test          # carte mentale + build + versions autonomes + 93 tests de bout en bout + 32 de la Forêt
npm run dev       # le jeu en local ; #arene-potager, #foret, #niveau-1, #terrain
```
Commence par `npm install`, `npm run sprites` et `npm test` pour connaître l'état réel.

**Les artefacts claude.ai** (fabriqués par `npm run standalone`) :
- **« The Ninja Adventure Test »**, ma version d'essai :
  - https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (identifiant `cf7a5349-c737-467e-8a85-43de0e34b850`, `dist/kage-test.html`, `shared_live: "public"`) ;
  - pas d'écran titre, un panneau en haut à droite : skins sans achat, chapitres et zones en un clic, bouton Arène ;
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
- interface discrète et sobre ;
- commits et documentation en français ;
- **la carte mentale** (`docs/carte-mentale/index.html`) se met à jour dans le même commit que chaque changement du jeu (`npm run carte` vérifie) ;
- `npm run sprites` puis `npm test` verts avant de pousser ;
- **ne fusionne rien et ne mets rien en ligne avant que je le demande** (à la fin d'une série) ;
- **économise la consommation** : lis seulement ce qui est utile, vérifie par lots ;
- à la fin, un résumé clair et simple, avec les captures.

**Lis d'abord, dans l'ordre** :
1. `CLAUDE.md` : les règles du projet (toutes) ;
2. **`docs/SKINS.md`** : le guide complet des skins (état, fabrication, accessoires, méthode pas à pas, fichiers) ;
3. `docs/kage/README.md` : le personnage et sa forge ;
4. `tools/kage_forge/accessories.py` et `palette.py` en survol, puis un skin fini (`assets/characters/kage/skins/or.json`) comme modèle.

**L'essentiel des skins** :
- un skin = une palette (slot → couleur, `assets/characters/kage/skins/<id>.json`) + des **accessoires** dessinés par la forge (`tools/kage_forge/accessories.py`) ;
- les accessoires peuvent changer la silhouette (chapeau, cape, paquetage), **jamais les animations ni la boîte de collision** ;
- **règle expresse** : **un skin à la fois, fidèle à mon modèle**. Je t'envoie la planche du modèle en image ; demande-la si je l'oublie ;
- d'abord la planche de travail face au modèle (`tools/kage_forge/skin_design.py`), que tu regardes zoomée avant de me la montrer ; puis, après mon accord, l'intégration et les planches d'animation complètes (`skin_sheets.py`), chaque pose vérifiée ;
- les skins rares peuvent avoir un éclat (`src/game/aura.js`, comme Lumière d'or), des shurikens et des traînées de couleur. Tout reste décoratif ;
- un skin se voit dans la boutique du marchand (`src/game/shop.js`), dans « Mon ninja », dans les cartes Aventure et dans l'arène ;
- je l'essaie dans la version test (skins sans achat).

**Ce qui attend** :
- les **sept skins en brouillon** (`tools/kage_forge/skins_brouillon/`), à refaire **un par un, fidèles à mes modèles** : le ninja blanc (150 ryō), le ninja écarlate (150), Ombre pourpre (150), le pêcheur (250), Souffle de l'hiver (450), Renard blanc (500), Samouraï déchu (550) ;
- puis d'autres skins que je te proposerai.

Dis-moi quand tu as lu et compris, en quelques lignes, puis attends ma première demande.
