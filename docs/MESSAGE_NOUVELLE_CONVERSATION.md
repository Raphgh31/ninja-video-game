# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**.

**Quatre messages spécialisés** existent, pour une conversation consacrée à un seul sujet :
- `docs/messages/MESSAGE_SKINS.md` : la création des skins du ninja ;
- `docs/messages/MESSAGE_ARENES.md` : les arènes, le duel, le mode combat à plusieurs ;
- `docs/messages/MESSAGE_CHAPITRES.md` : la création des chapitres de l'aventure ;
- `docs/messages/MESSAGE_SONS.md` : les sons et la musique, avec le connecteur **Splice**.

Celui-ci sert à la **conversation principale** : menus, interface, lumière, réglages, manettes, corrections, mises en ligne, et la préparation de la sortie sur Steam et sur téléphones.

---

Bonjour ! On reprend mon jeu. Tu es la **conversation principale** du projet.

**Le jeu** : *The Ninja Adventure*, un jeu de plateforme 2D rapide en pixel art, dans un Japon peint (rizières, forêts, montagnes). Le ninja **n'a pas de nom pour le joueur** : il s'appelle KAGE seulement dans le code et les fichiers, jamais à l'écran. Réponds toujours en **français**.

**Mon but** : le jeu fini dans quelques mois, je veux le **sortir sur Steam** (PC, Mac, Steam Deck) **et en application de téléphone**. Je vise **le meilleur rendu à chaque fois**.

**Ce qui existe** (tout est dans `main` et en ligne, 26 novembre 2026) :
- **le menu de l'intro** : Aventure · Arène · Mon ninja, dans le style « Les lanternes » (de petits mondes peints dans la nuit de l'intro, aucun cadre, aucune phrase d'aide).
- **l'aventure** :
  - le chapitre 1, **le Potager** : 9 zones, terminé, avec le boss **KARASU-KASHI**, le corbeau ;
  - le chapitre 2, **la Forêt** : 12 zones, première version complète, sans ennemis pour l'instant ;
  - un marchand par chapitre, une boutique de skins (« Le sentier de nuit »), des ryō, des lanternes de reprise, deux emplacements de sauvegarde.
- **les arènes** : la rizière du gong (Potager) et la clairière de la statue (Forêt), jusqu'à quatre en ligne, un salon plein écran ; modes **Duel**, **Souffle unique**, **Trois lames**, **Dix lames** ; le duel a sa parade, son choc des lames, son coup fatal au ralenti ; on peut jouer seul **contre le ninja de l'ombre** (Apprenti, Rōnin, Maître) ou s'entraîner au **Dojo** ; statistiques dans « Mon ninja ».
- **le ninja** : une trentaine d'animations (course, sprint, dash, glissade, saut mural, saltos, sabre, parade, shurikens, coups de pied, lianes, corde…) et 11 skins (Encre, paysan, émeraude, nocturne, blanc, brume, apprenti tengu, Samouraï déchu, pêcheur, Lumière d'or, trophée du corbeau).

**Les dernières décisions (25-26 novembre 2026)**, détaillées dans `CLAUDE.md` :
- **lumière** : « pixel art lumineux » (pixels nets, la beauté vient de la lumière), **cycle jour-nuit** (5 min de jour, 3 de nuit). **Le matin et le soir ont été refaits** : plus de « buée » terne ; le matin, un soleil levant très chaud, un ciel pêche et or, des montagnes rosies, quelques nappes de brume basses ; le soir, l'heure dorée puis le coucher derrière les montagnes, une lumière qui baisse peu à peu. Code `src/game/daylight.js` (`lowSun`, `drawMists`, calque `.grade-layer` en « produit », qui colore sans ternir). Sous terre, rien ne change avec l'heure.
- **fluidité** : 60 images/s visées partout ; accueil sans attente, et un **écran de chargement** (le ninja court à travers une journée) au choix d'une aventure ou d'une arène.
- **manettes** (PS5, Xbox…) en jeu et dans les menus : `src/engine/gamepad.js`.
- **la pause « La halte »** : le monde s'assombrit, une lanterne de pierre s'allume, des lucioles ; Reprendre · Menu principal (`src/game/pause.js`). On l'ouvre par Échap, le bouton Options, ou **le bouton du feu de camp** en haut à droite (toucher ou souris) — choisi par moi plutôt que les deux barres de tous les jeux.
- **la boutique « Le sentier de nuit »** : les skins le long d'un sentier, chacun près d'une lanterne de pierre ; celle du choix s'allume. Pied des montagnes enrichi (brume, pins éclairés par la lune, hameau aux fenêtres chaudes).
- **la police du jeu** : pixels modernes (Pixelify Sans relue au pixel près), voir `CLAUDE.md`.

**La sortie sur Steam et sur téléphones** (décidé le 26 novembre 2026, `docs/REPRISE.md` § 10) :
- **pas de Godot** : on garde JavaScript et Canvas ; à la fin, on emballe le même jeu avec **Electron ou Tauri** pour Steam (`steamworks.js` pour les succès et la sauvegarde dans le nuage) et **Capacitor** pour les téléphones ;
- **à régler avant la sortie** : les **droits des musiques** (elles viennent de vidéos que j'ai fournies : à remplacer ou à licencier), les sauvegardes dans un fichier, la mise en relation de Steam pour le jeu à plusieurs, les comptes des boutiques (Steam 100 $, Google Play 25 $, Apple 99 $/an), vérifier que le nom est libre ;
- **les sons** se font dans une conversation dédiée, avec **Splice** (`docs/messages/MESSAGE_SONS.md`).

**Technique** :
- Vite et JavaScript (modules ES), Canvas 2D, aucune bibliothèque de rendu. Image interne 448×252, mise à l'échelle entière (pixels nets).
- Tout le décor est **peint en code** : `src/game/potager/`, `src/game/foret/`, `src/game/arena/`.
- Les sprites sont **générés** par `tools/kage_forge/` (`npm run sprites`) : ne jamais éditer les PNG à la main.
- Sur téléphone : plein écran, même échelle que sur ordinateur, et le jeu pivote en portrait.

**Dépôt** : `raphgh31/ninja-video-game`, branche `main`. Travaille sur **une nouvelle branche**. D'autres conversations travaillent en parallèle (skins, arènes, chapitres, sons) : **avant de fusionner ou de publier, regarde leurs branches** (`git fetch`, branches `claude/…` en avance sur `main`) et **fusionne-les au lieu de les écraser** ; avant de publier un artefact, lis sa version en ligne (`get_artifact`) pour ne pas écraser une publication d'une autre conversation.

**Site** : https://raphgh31.github.io/ninja-video-game/ (mis en ligne à chaque push sur `main` par `.github/workflows/deploy.yml`). Si la mise en ligne échoue côté GitHub, ne force pas : dis-le-moi, je la relance à la main.

**Commandes** :
```bash
npm install
npm run sprites   # sprites (ninja, ennemis, boss) avec contrôles qualité
npm test          # carte mentale + build + versions autonomes + tests de bout en bout + tests de la Forêt
npm run dev       # le jeu en local ; #arene-potager, #arene-foret, #foret, #niveau-1, #terrain
```
Commence par `npm install` et `npm run build`. **Pour un petit changement visuel, ne lance pas toute la série de tests** (elle dure plusieurs minutes) : une capture suffit. Garde `npm test` pour la fin d'une série. Une dizaine de tests échouent déjà, sans lien avec les derniers changements : la boutique (ses tests datent d'avant « Le sentier de nuit »), l'intro, le combat du corbeau, la sortie du Potager ; la grange et un trou du Potager sont parfois instables. Ils sont à réparer un jour.

**Les artefacts claude.ai** (fabriqués par `npm run standalone`) :
- **« The Ninja Adventure Test »**, ma version d'essai :
  - https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (identifiant `cf7a5349-c737-467e-8a85-43de0e34b850`, `dist/kage-test.html`) ;
  - pas d'écran titre, un bouton « Réglages » en haut à droite : skins sans achat, chapitres et zones en un clic, arènes, Matin / Soir / Nuit, compteur d'images/s ;
  - **elle ne se publie que si je dis « publie » ou « publie test »** (alors sans redemander).
- **« The Ninja Adventure »**, le jeu pour tout le monde :
  - https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (identifiant `5f0bb94d-1fa1-48d5-b9b9-f829586682e6`, `dist/kage-standalone.html`, partagé publiquement : `shared_live: "public"`, `artifact_title: "The Ninja Adventure"`) ;
  - à la mise en ligne seulement.
- **La carte mentale** :
  - https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (identifiant `a200b822-069e-40b3-b26e-0d1f5b7689cf`) ;
  - fichier produit par `python3 tools/carte_mentale.py --artefact <fichier>`, republié à chaque changement du jeu.

**Mes règles** :
- applique **exactement** ce que je demande ;
- quand j'hésite, propose une **planche de comparaison** (3 ou 4 options côte à côte, en jeu) : je choisis, puis tu intègres ;
- montre le résultat : captures zoomées ou GIF (`tools/capture.cjs`), **regardées par toi d'abord** ;
- vérifie sur ordinateur et sur téléphone, en paysage (~844×390) et en portrait (~390×844) ;
- **planche de design avant tout nouveau personnage, ennemi ou skin** ;
- rendu « jeu indé soigné », jamais générique : de la profondeur, du volume, rien qui flotte, une lumière cohérente ; **transitions travaillées, jamais brutes** ;
- interface discrète et sobre ; **menus apaisants** : aucune phrase d'aide, le marchand ne parle pas ;
- **le son est toujours actif** (ni bouton « Son » ni touche M) ;
- commits et documentation en français ;
- **la carte mentale** (`docs/carte-mentale/index.html`) se met à jour dans le même commit que chaque changement du jeu (`npm run carte` vérifie) ;
- **ne fusionne rien et ne mets rien en ligne avant que je le demande** (à la fin d'une série) ; quand je dis « mets tout en ligne » : PR, fusion, site, et les trois artefacts ;
- **économise la consommation** : lis seulement ce qui est utile, vérifie par lots ;
- à la fin, un résumé clair et simple, avec les captures.

**Lis d'abord, dans l'ordre** :
1. `CLAUDE.md` : les règles du projet (toutes) ;
2. `docs/REPRISE.md` : l'état complet, les réglages, la carte des fichiers, l'historique ; **§ 10 : la sortie sur Steam et sur téléphones** ;
3. selon le sujet : `docs/SKINS.md`, `docs/ARENES.md`, `docs/GUIDE_CHAPITRE.md` et `docs/FORET.md`, `docs/MONDE.md`.

**Les fichiers à connaître** :
- `src/main.js` : boucle, échelle, caméra, écran titre, pause, bouton de la halte, arène et salon ;
- `src/game/daylight.js` : lumière et cycle jour-nuit ;
- `src/game/menu.js`, `menuart.js`, `intro.js` : menus et introduction ;
- `src/game/pause.js` : la halte ; `src/game/shop.js` : la boutique ;
- `src/engine/gamepad.js` : manettes ; `src/engine/touch.js` : commandes tactiles ;
- `src/loading/loader.js` : l'écran de chargement ;
- `src/game/save.js` et `profile.js` : deux aventures et le profil ;
- `src/game/player.js` : le ninja ;
- `src/game/arena/` : arènes et duel ; `src/game/multi.js`, `src/engine/net.js` : jeu à plusieurs ;
- `src/game/chapters/`, `src/game/potager/`, `src/game/foret/` : cartes et décors peints ;
- `tools/kage_forge/` : la forge des sprites ; `tools/maquettes/` : les planches de comparaison ;
- `tests/` : les tests.

Dis-moi quand tu as lu et compris, en quelques lignes, puis attends ma première demande.
