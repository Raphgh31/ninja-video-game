# Message pour ouvrir une nouvelle conversation

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`** (la série précédente, PR #26, y est fusionnée et en ligne).

---

Bonjour ! On reprend mon jeu **The Ninja Game** (le ninja s'appelle KAGE), un jeu de plateforme 2D rapide en pixel art (Vite + JavaScript, Canvas 2D, tout le décor est peint en code). Réponds toujours en français.

**Où on en est** (tout est dans `main` et en ligne, PR #26 fusionnée le 14 novembre 2026) : le chapitre 1 (le Potager) est terminé ; le chapitre 2 (la Forêt, 12 zones) a été beaucoup retouché :
- **introduction** au lancement (titre à l'encre, lune, KAGE en coup de pied sauté, musique) ; **coup de pied sauté** en jeu ; **saltos** et **coup du salto** ;
- l'**eau et les grands vides sont mortels** dans tout le jeu ;
- **détours** de la Forêt (cabane du guetteur, arbre aux cavités, arche de racines, belvédère) ;
- **zone 9, la statue** : un bloc de granit ficelé ferme le tunnel ; on monte sur la tête de la statue, on attrape la liane de la grande branche, on tire la corde de la poulie (nouvelle animation `rope_pull`) jusqu'à la coincer dans le rameau en Y ; le bloc reste levé, on passe en glissade ;
- **zone 10, les lianes** : courtes, souples, balancier lent et naturel ; un saut au bon moment propulse plus haut et plus loin ; arbres tous différents, feuillus ;
- **zone 11, la descente** : on gravit par paliers un grand amas de rochers, il s'effondre derrière KAGE ; un éboulis dense le poursuit sur de vraies pentes (souches, troncs, rochers, une arche de pierre à passer en glissade) et s'arrête en tas au pied de la pente ;
- **boutique du marchand plein écran** (cartes des skins, aperçu animé, achat confirmé) ; **skins** : Encre, **le voyageur** et **le paysan des rizières** (100 ryō chacun), fidèles à mes planches.

Je vais te donner mes retours après avoir joué ; applique exactement ce que je demande, montre-moi le résultat (captures zoomées ou GIF), et **ne fusionne rien avant que je le demande**. Travaille sur une nouvelle branche. **Économise la consommation** : lis seulement ce qui est utile, vérifie par lots.

**Lis d'abord, dans l'ordre :**
1. `CLAUDE.md` : règles du projet et ma façon de travailler ;
2. `docs/FORET.md` : le chapitre 2, ses retours appliqués (n° 1 à 18), ce qui reste (§ 9) ;
3. `docs/REPRISE.md`, seulement au besoin ;
4. `docs/GUIDE_CHAPITRE.md` si on construit ou retouche un chapitre.

Lance `npm install`, puis `npm run sprites` et `npm test` (82 tests de bout en bout + 32 tests de la Forêt) pour connaître l'état réel.

**Les artefacts** (`npm run standalone` les fabrique) — **demande-moi toujours l'autorisation avant de publier** :
- « The Ninja Game Test », ma version d'essai, privée (skins sans achat, chapitres et zones en un clic) : https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys (`dist/kage-test.html`, publier sans `shared_live`) — à republier à chaque étape ;
- « The Ninja Game », le jeu pour tout le monde : https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm (`dist/kage-standalone.html`, `shared_live: "public"`) — à la mise en ligne ;
- la carte mentale : https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi (`python3 tools/carte_mentale.py --artefact <fichier>`) — à la mise en ligne.

**À faire plus tard (déjà demandé)** : les **huit autres skins** de mes planches, **un par un, fidèles au modèle** (brouillons dans `tools/kage_forge/skins_brouillon/` : ninja blanc 150, écarlate 150, Ombre pourpre 150, Lumière d'or 800, pêcheur 250, Souffle de l'hiver 450, Renard blanc 500, Samouraï déchu 550 ryō ; planche de travail `tools/kage_forge/skin_design.py`) ; les ennemis du chapitre 2.

**Rappels** : commits en français ; carte mentale mise à jour avec chaque changement du jeu (`npm run carte`) ; les PNG de KAGE sont générés (`tools/kage_forge/`, puis `npm run sprites`) ; vérifie toi-même (captures zoomées, ordinateur, téléphone en paysage et en portrait) ; tests de faisabilité verts (`tests/foret.cjs`) ; à la fin, un résumé clair et simple avec les captures.
