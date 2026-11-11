# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `claude/message-nouvelle-conversation-docs-t945e2`** (la première version complète du chapitre 2 y est ; rien n'est fusionné dans `main`).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout le décor est peint en code). Réponds toujours en français.

Le **chapitre 2, la Forêt**, a une **première version complète** (12 zones jouables, peintes, sonorisées, raccordées au chapitre 1 par la porte du temple, 30 tests). Travaille sur la branche `claude/message-nouvelle-conversation-docs-t945e2`. Je vais te donner mes retours après avoir joué ; applique exactement ce que je demande, montre-moi le résultat (captures zoomées), et ne fusionne rien avant que je le demande. **Économise la consommation** : lis seulement ce qui est utile, vérifie par lots.

**Lis d'abord, dans l'ordre :**
1. `CLAUDE.md` : règles du projet et ma façon de travailler ;
2. `docs/FORET.md` : le plan du chapitre, **l'état (§ 8) et ce qui reste (§ 9)**, les réglages ;
3. `docs/GUIDE_CHAPITRE.md` : les leçons du chapitre 1 (à respecter dans chaque retouche) ;
4. `docs/REPRISE.md` seulement au besoin.

Aperçu des 12 zones : `docs/foret/apercu_zones.png`. Lance `npm install`, puis `npm run sprites` et `npm test` (76 + 30 tests) pour connaître l'état réel.

**Les artefacts** (à republier à chaque étape, avec `npm run standalone`) :
- « The Ninja Game », le jeu pour tout le monde : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (`dist/kage-standalone.html`) ;
- « The Ninja Game Test », ma version d'essai (skins sans achat, chapitres et zones en un clic) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (`dist/kage-test.html`) ;
- la carte mentale : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (`python3 tools/carte_mentale.py --artefact <fichier>`).

**Rappels** : commits en français sur la branche ; carte mentale mise à jour avec chaque changement du jeu ; vérifie toi-même (captures zoomées, ordinateur, téléphone en paysage et en portrait, écran haut) ; tests de faisabilité verts (`tests/foret.cjs`) ; à la fin, un résumé clair et simple avec les captures.
