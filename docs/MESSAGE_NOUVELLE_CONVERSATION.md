# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game` (branche `main`).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D). Réponds toujours en français.

**Avant toute chose, lis dans l'ordre :**
1. `CLAUDE.md` (règles du projet et façon de travailler),
2. `docs/REPRISE.md` (état complet du jeu, décisions, valeurs de réglage, carte des fichiers, mes préférences, ce qui reste à faire — surtout le § 9),
3. `docs/MONDE.md` (plan du monde : 7 chapitres),
4. `docs/enemies/README.md` (TATE, WARA et le mini-boss KARASU-KASHI).

**Où on en est** : tout est dans `main` et en ligne (https://raphgh31.github.io/ninja-video-game/). Le chapitre 1, le Potager, est jouable de bout en bout : 9 zones, une lanterne de sauvegarde au début de chaque zone, le marchand, et le mini-boss **KARASU-KASHI** (le corbeau au grand chapeau de paille) dans la zone 9, dont la défaite ouvre la porte du temple et termine le chapitre. 64 tests automatiques passent. Version de test : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (à republier avec `dist/kage-standalone.html`).

**Ce qui attend mon avis** :
- la nouvelle **pose de repos de KAGE** (un bras derrière le dos dont seule la main ressort à la hanche, l'autre armé, poing devant la poitrine) — 3e essai, planche `docs/kage/pose_repos.png` ;
- est-ce que le **sprint** doit marcher seulement avec **Maj droite** (pour l'instant, les deux Maj) ;
- le réglage du boss en jouant (vie, cadence, durée de la fenêtre au sabre).

**Rappel de ma façon de travailler** : retouches précises, appliquer exactement ce que je demande, me montrer le résultat (captures ou GIF, y compris téléphone en paysage et en portrait), republier la version de test, résumer clairement. Pour un nouveau personnage ou ennemi : planche de design d'abord. Travaille sur une branche, commits en français ; **ne fusionne pas et ne mets pas le site en ligne à chaque retouche** : on le fera à la fin d'une série de modifications, quand je changerai de conversation.

Quand tu as tout lu, fais-moi un court résumé de l'état du jeu et attends ma prochaine demande.
