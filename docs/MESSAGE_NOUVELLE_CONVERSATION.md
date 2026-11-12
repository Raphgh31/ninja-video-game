# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `claude/message-nouvelle-conversation-docs-t945e2`** (la série en cours y est, dans la PR #26 en brouillon, pas encore fusionnée dans `main`).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout le décor est peint en code). Réponds toujours en français.

**Où on en est** : le chapitre 1 (le Potager) et la première version du chapitre 2 (la Forêt, 12 zones) sont dans `main` (PR #25). La série en cours est sur la branche `claude/message-nouvelle-conversation-docs-t945e2`, **PR #26 en brouillon, non fusionnée** :
- **saltos avant et arrière** de KAGE (salto groupé, deuxième appui sur saut en l'air, au clavier comme sur téléphone ; arrière si la direction tenue s'oppose au départ ; envolée bridée, jamais plus haut ni plus loin qu'un saut normal ; pas de salto pendant les sauts muraux) ;
- **coup du salto** : le sabre en l'air pendant ou juste après un salto, 4 dégâts (la lame tremble, s'allume, éclat de lumière à l'impact) ;
- **quatre détours dans la Forêt**, chacun avec son coffre : la cabane du guetteur (zone 1), l'arbre aux cavités (zone 2), l'arche de racines et son petit sanctuaire (zone 3), le belvédère du grand cèdre (zone 12).

Continue sur cette branche. Je vais te donner mes retours après avoir joué ; applique exactement ce que je demande, montre-moi le résultat (captures zoomées ou GIF), et **ne fusionne rien avant que je le demande**. **Économise la consommation** : lis seulement ce qui est utile, vérifie par lots.

**Lis d'abord, dans l'ordre :**
1. `CLAUDE.md` : règles du projet et ma façon de travailler ;
2. `docs/FORET.md` : le chapitre 2, ses retours appliqués (n° 1 à 10, dont les détours), ce qui reste (§ 9) ;
3. `docs/REPRISE.md`, § 4 (KAGE : animations, saltos, coup du salto, commandes) et § 9 (pistes), seulement au besoin ;
4. `docs/GUIDE_CHAPITRE.md` si on construit ou retouche un chapitre.

Lance `npm install`, puis `npm run sprites` et `npm test` (80 tests de bout en bout + 31 tests de la Forêt) pour connaître l'état réel. Planche des détours : `docs/foret/detours.png`.

**Les artefacts** (`npm run standalone` les fabrique) — **demande-moi toujours l'autorisation avant de publier** :
- « The Ninja Game Test », ma version d'essai, privée (skins sans achat, chapitres et zones en un clic) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (`dist/kage-test.html`, publier sans `shared_live`) — à republier à chaque étape ;
- « The Ninja Game », le jeu pour tout le monde : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (`dist/kage-standalone.html`) — à la mise en ligne ;
- la carte mentale : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (`python3 tools/carte_mentale.py --artefact <fichier>`) — à la mise en ligne.

**À faire plus tard (déjà demandé)** : le nouveau mécanisme de la statue de la zone 9 (monter sur le haut de sa tête pour ouvrir la porte de pierre ; un déclencheur invisible devant ses yeux la remplace en attendant) ; les skins suivants ; les ennemis du chapitre 2 ; le marchand.

**Rappels** : commits en français sur la branche ; carte mentale mise à jour avec chaque changement du jeu (`npm run carte`) ; les PNG de KAGE sont générés (`tools/kage_forge/`, puis `npm run sprites`) ; vérifie toi-même (captures zoomées, ordinateur, téléphone en paysage et en portrait) ; tests de faisabilité verts (`tests/foret.cjs`) ; à la fin, un résumé clair et simple avec les captures.
