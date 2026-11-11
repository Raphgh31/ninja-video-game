# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `site-web/peaceful-meitner-6vgn54`** (le chapitre 2 y est en cours ; rien n'est fusionné dans `main`).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout le décor est peint en code). Réponds toujours en français.

Cette conversation **continue la construction du chapitre 2, la Forêt**, commencée dans une conversation précédente devenue trop longue. Travaille sur la branche `site-web/peaceful-meitner-6vgn54`. **Ne t'arrête pas pour me poser des questions : fais tout le reste du chapitre, je te ferai un retour à la fin.** Je veux une première version la plus soignée possible. **Économise la consommation** : lis seulement ce qui est utile, vérifie par lots (plusieurs zones par commande), évite les allers-retours minuscules, une vingtaine de tests ciblés suffit.

**Lis d'abord, dans l'ordre :**
1. `CLAUDE.md` : règles du projet et ma façon de travailler ;
2. `docs/FORET.md` : **le plus important** — mon brief résumé, le plan des 12 zones, **l'état d'avancement (§ 8) et ce qui reste à faire (§ 9)** ;
3. `docs/GUIDE_CHAPITRE.md` : tout ce que j'ai fait corriger dans le chapitre 1 (à anticiper) et la liste de contrôle ;
4. `docs/REPRISE.md` seulement au besoin (état complet du jeu, carte des fichiers).

Regarde les trois planches validées avant de peindre : `docs/foret/planche_ambiance.png`, `docs/foret/planche_statue.png`, `docs/foret/planche_kage_liane.png`. Lance `npm install`, puis `npm run sprites` et `npm test` pour connaître l'état réel avant de continuer.

**Les artefacts** (à republier à la fin, avec `npm run standalone`) :
- « The Ninja Game », le jeu pour tout le monde : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (`dist/kage-standalone.html`) ;
- « The Ninja Game Test », ma version d'essai (skins sans achat, chapitres et zones en un clic) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (`dist/kage-test.html`) ;
- la carte mentale : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (`python3 tools/carte_mentale.py --artefact <fichier>`).

**Rappels** : commits en français sur la branche, pas de fusion ni de mise en ligne avant que je le demande ; carte mentale mise à jour avec chaque changement du jeu ; vérifie toi-même (captures zoomées, ordinateur, téléphone en paysage et en portrait, écran haut) et ne me montre que ce qui est abouti ; à la fin, un résumé clair et simple avec les captures.
