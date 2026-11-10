# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game` (branche `main`). Le brief du chapitre 2 viendra dans un second message.

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout le décor est peint en code). Réponds toujours en français.

Cette conversation sert à **construire le chapitre 2**, une forêt dense et mystérieuse. Je t'enverrai le brief détaillé dans mon prochain message. Le chapitre 1 a demandé une très longue série de retouches avant d'être comme je le voulais : cette fois, je veux une première version **la plus soignée possible**, pour avoir le moins de modifications à faire ensuite. Prends ton temps, vérifie toi-même chaque résultat (captures zoomées, tests), et ne me montre que ce qui est vraiment abouti.

**Avant toute chose, lis dans l'ordre :**
1. `CLAUDE.md` : les règles du projet et ma façon de travailler ;
2. `docs/GUIDE_CHAPITRE.md` : **le plus important pour cette conversation** — la méthode par phases que j'attends, tout ce que j'ai fait corriger dans le chapitre 1 (à anticiper), l'architecture pour brancher un nouveau chapitre, et la liste de contrôle avant de me montrer une étape ;
3. `docs/REPRISE.md` : l'état complet du jeu, les décisions, les valeurs de réglage, la carte des fichiers, mes préférences (§ 8) ;
4. `docs/MONDE.md` : le plan du monde (je suis en train de refaire l'organisation des chapitres ; le chapitre 2 est la forêt) ;
5. `docs/enemies/README.md` : les ennemis TATE, WARA et le mini-boss KARASU-KASHI ;
6. `docs/carte-mentale/README.md` : la carte mentale de tout le jeu. **Règle : chaque modification du jeu la met aussi à jour, dans le même commit** (`npm run carte` le vérifie, `npm test` le lance).

Regarde aussi le code du chapitre 1 avant de concevoir quoi que ce soit : `src/game/chapters/potager.js` (la carte construite zone par zone), `src/game/potager/` (le décor peint) et `src/game/potager/temple.js`, dont l'intérieur montre déjà un coin de la forêt du chapitre 2 (`paintInterior`, intérieur `foret`). Lance `npm install` puis `npm test` pour vérifier que tout fonctionne.

**Où on en est** : tout est dans `main` et en ligne (https://raphgh31.github.io/ninja-video-game/). Le **chapitre 1, le Potager**, est terminé et retouché : 9 zones, 10 lanternes, le marchand, des énigmes (grue de bambou, serre à quitter par la charpente, bosquets), le mini-boss KARASU-KASHI avec sa musique et ses sons. À la fin, la porte du temple s'ouvre sous les yeux du joueur, KAGE passe derrière et disparaît, puis l'écran de fin s'affiche. 75 tests automatiques passent.

- Le jeu tel que tout le monde le verra : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm — à republier avec `dist/kage-standalone.html` à chaque étape.
- Ma version de test (privée : skins sans achat, chapitres et zones en un clic) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys — à republier avec `dist/kage-test.html` à chaque étape.
- Carte mentale : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (`python3 tools/carte_mentale.py --artefact <fichier>`).

**Ma façon de travailler, en bref** (le détail est dans les fichiers) :
- avance **par phases** : plan du chapitre, puis planches de design (décor et chaque nouvel ennemi, toujours avant de les intégrer), puis greybox jouable, puis peinture, puis sons et finitions ; montre-moi chaque phase avant la suivante ;
- si un point de mon brief est ambigu et change le travail, demande-moi avant, en une fois, avec des propositions ; sinon décide avec bon sens et dis-le ;
- montre les résultats en captures ou GIF (y compris téléphone en paysage et en portrait), republie la version de test, résume clairement et simplement ;
- travaille sur une branche, commits en français ; **ne fusionne pas et ne mets pas le site en ligne à chaque étape** : on le fera à la fin de la série, quand je le demanderai ;
- vérifie avant de me montrer : `npm run sprites`, `npm test`, et la liste de contrôle du guide.

Quand tu as tout lu, fais-moi un court résumé de l'état du jeu et de ce que tu as compris de mes attentes, puis attends mon brief du chapitre 2.
