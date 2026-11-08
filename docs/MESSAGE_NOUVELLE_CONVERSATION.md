# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game` (branche `main`).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout est peint en code). Réponds toujours en français.

**Avant toute chose, lis dans l'ordre :**
1. `CLAUDE.md` (règles du projet et façon de travailler),
2. `docs/REPRISE.md` (état complet du jeu, décisions, valeurs de réglage, carte des fichiers, mes préférences ; surtout le § 6 quinquies, ce qui vient d'être fait, et le § 9, ce qui reste à faire),
3. `docs/MONDE.md` (plan du monde : 7 chapitres),
4. `docs/enemies/README.md` (TATE, WARA et le mini-boss KARASU-KASHI, refondu),
5. `docs/carte-mentale/README.md` : la carte mentale de tout le jeu (`docs/carte-mentale/index.html`). **Règle : chaque modification du jeu la met aussi à jour, dans le même commit** (`npm run carte` le vérifie, et `npm test` le lance).

**Où on en est** : tout est dans `main` et en ligne (https://raphgh31.github.io/ninja-video-game/). **Le chapitre 1, le Potager, est terminé** : 9 zones (702 cases), 10 lanternes, le marchand, des énigmes (la grue de bambou à couper au shuriken après des sauts muraux, la serre à quitter par la charpente, des bosquets de bambous à passer au dash ou en sauts muraux), des plateformes de bois cultivées sur pilotis, des caisses qui tombent, un coffre au grenier, et le mini-boss **KARASU-KASHI** refondu (il lâche des pierres prises au sol, vole deux fois plus haut, tombe bec planté quand on le frappe en sautant depuis des plateformes fragiles qui s'effondrent ensuite, puis plonge en arc). Sa défaite ouvre la porte du temple et termine le chapitre. Les skins ont commencé (le vagabond, 50 ryō chez le marchand). KAGE, TATE et WARA ont été agrandis de 20 %. 72 tests automatiques passent.

- Version de test : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (à republier avec `dist/kage-test.html` : même jeu, mais tous les skins se portent sans achat).
- Cabine des skins (privée) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (à republier avec `dist/kage-skins.html`).
- Carte mentale en ligne : https://raphgh31.github.io/ninja-video-game/carte-mentale/ (page claude.ai : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi).

**Ce qui attend mon avis** :
- le **nouveau combat contre KARASU-KASHI** et les nouvelles énigmes, à régler en jouant ;
- les **skins suivants** (n° 2 à 9 sur ma planche ; planche de design d'abord, puis la cabine des skins pour les essayer) ;
- est-ce que le **sprint** doit marcher seulement avec **Maj droite** (pour l'instant, les deux Maj).

**Rappel de ma façon de travailler** : retouches précises, appliquer exactement ce que je demande, me montrer le résultat (captures ou GIF, y compris téléphone en paysage et en portrait), republier la version de test, résumer clairement. Pour un nouveau personnage ou ennemi : planche de design d'abord. Si une demande n'est pas claire, demande-moi avant de la faire. Travaille sur une branche, commits en français ; **ne fusionne pas et ne mets pas le site en ligne à chaque retouche** : on le fera à la fin d'une série de modifications, quand je changerai de conversation.

Quand tu as tout lu, fais-moi un court résumé de l'état du jeu et attends ma prochaine demande.
