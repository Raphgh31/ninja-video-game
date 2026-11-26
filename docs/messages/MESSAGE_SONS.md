# Message d'introduction — les sons et la musique (avec Splice)

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**. Le connecteur **Splice** doit être actif dans la session.

---

Bonjour ! On reprend mon jeu, et **cette conversation est consacrée uniquement aux sons et à la musique**, avec le connecteur **Splice**.

**Le jeu** : *The Ninja Adventure*, un jeu de plateforme 2D rapide en pixel art, dans un Japon peint (rizières, forêts, montagnes). Le ninja **n'a pas de nom pour le joueur** : il s'appelle KAGE seulement dans le code, jamais à l'écran. Réponds toujours en **français**.

**Pourquoi cette conversation** : je veux sortir le jeu **sur Steam et en application de téléphone** dans quelques mois, avec le meilleur rendu possible. Aujourd'hui :
- presque tous les **bruitages sont synthétisés** par le code (`src/engine/sfx.js`, table `SOUNDS` : une centaine de sons — pas, saut, atterrissage, dash, glissade, salto, coups de sabre, parade, choc des lames, coup fatal, coups de pied, shurikens, ryō, caisses, cloche, gong, porte, lanternes, coffres, lianes, corde, éboulis, ennemis TATE et WARA, le corbeau…) ; ils marchent, mais restent un peu simples ;
- les **seuls sons enregistrés** sont les ailes et croassements du corbeau (`assets/sfx/`, table `SAMPLES` de `sfx.js`, découpés par `tools/sons_karasu.py`) ;
- l'**ambiance** de la Forêt est synthétisée aussi (`ambience` dans `sfx.js` : oiseaux, gouttes, craquements, grillons) ;
- les **musiques** (`assets/music/` : `intro.mp3`, `potager.mp3`, `foret.mp3`, `karasu.mp3`, préparées par `tools/musique_boucle.py` : introduction puis boucle sans couture) viennent de **vidéos que j'ai fournies** : **pour vendre le jeu, il faut des morceaux dont j'ai les droits**.

**Splice** : une bibliothèque de sons et de boucles, libres de droits pour un jeu vendu (à vérifier dans leurs conditions). Avec le connecteur, tu peux chercher (`describe_a_sound` : sons isolés « oneshot » ou boucles « loop » ; `prompt_to_stack` : un arrangement de plusieurs pistes) **avec mon compte gratuit** ; **chaque téléchargement (`download_asset`) coûte un crédit** de mon abonnement. Donc :
- **ne télécharge jamais rien sans mon accord explicite**, son par son ou par lot que j'ai validé ;
- un son déjà téléchargé ne coûte plus rien si on le reprend.

**Ce que j'attends, dans l'ordre** :
1. **la liste des sons du jeu** à améliorer, par familles (le ninja, les armes et le duel, l'aventure et les objets, les ennemis et le corbeau, les menus, les ambiances par chapitre), avec ce que chaque son doit évoquer ; commence par les plus entendus (pas, saut, sabre, shuriken, dash, ryō) ;
2. pour chaque son, **trois propositions Splice** à écouter (liens), en tenant compte du style : Japon traditionnel, pixel art, net et court, jamais « film d'action » ; les sons de combat doivent rester lisibles quand ils s'enchaînent vite ;
3. quand j'ai choisi, **un seul lot de téléchargements**, puis l'intégration : fichiers dans `assets/sfx/` (courts, en `.mp3` ou `.ogg`, normalisés, sans silence au début), lus par `SAMPLES` dans `sfx.js` (on garde le son synthétisé en secours), **embarqués dans la version autonome** (`tools/standalone.mjs`, comme ceux du corbeau) ;
4. ensuite, **les musiques** : une par chapitre, une pour l'intro, une pour le combat du corbeau, une pour les arènes et le duel ; ambiance japonaise (shakuhachi, koto, shamisen, taiko, flûtes), calme pendant l'exploration ; on peut monter une boucle avec `prompt_to_stack` ou chercher des boucles ; puis préparation par `tools/musique_boucle.py` (ne jamais réencoder à la main) ;
5. les **ambiances** par chapitre (rizière, forêt, nuit), en couches discrètes.

**Règles du son** (déjà en place) :
- **le son est toujours actif** : ni bouton « Son » ni touche M ;
- volume général `SFX_VOLUME` dans `sfx.js` ; les sons des ennemis s'éteignent hors de l'écran (`sfxAt`) ; musique : `src/engine/music.js` (`MUSIC.volume`, fondu enchaîné `switchTo`) ;
- **aucun son avant le premier geste** (règle des navigateurs : l'intro attend « Appuie sur une touche ») ;
- un son doit être **court et sans traîne** quand il se répète (pas, coups) ; varier légèrement la hauteur à chaque lecture pour éviter l'effet « mitraillette » ;
- tout doit marcher sur téléphone (fichiers légers : la version autonome fait déjà ~12 Mo).

**Méthode de travail** :
- pour comparer, fais-moi un **banc d'écoute** : une petite page (artefact claude.ai) avec les candidats côte à côte, ou les liens Splice numérotés ;
- teste chaque son **dans le jeu** (pas seulement seul) ;
- commits et documentation en français ; note chaque son retenu (nom Splice, pack, identifiant) dans `docs/SONS.md` (à créer), pour prouver les droits le jour de la sortie ;
- **la carte mentale** (`docs/carte-mentale/index.html`) se met à jour dans le même commit que chaque changement du jeu (`npm run carte` vérifie) ;
- travaille sur **une nouvelle branche** ; **ne fusionne rien et ne mets rien en ligne avant que je le demande**. D'autres conversations travaillent en parallèle (principale, skins, arènes, chapitres) : avant de fusionner, regarde leurs branches et fusionne-les au lieu de les écraser ;
- la **version de test** (artefact https://claude.ai/artifact/ScyWi7qXjftmdLs6Qxo7Ys, identifiant `cf7a5349-c737-467e-8a85-43de0e34b850`, `dist/kage-test.html`, fabriquée par `npm run standalone`) ne se publie **que si je dis « publie »** ; lis sa version en ligne (`get_artifact`) avant de publier ;
- **pour un petit changement, pas toute la série de tests** (`npm test` dure plusieurs minutes) : `npm run build` et un essai dans le jeu suffisent ; une dizaine de tests échouent déjà sans lien avec les sons ;
- **économise la consommation** : lis seulement ce qui est utile ; à la fin, un résumé clair et simple.

**Lis d'abord** :
1. `CLAUDE.md` : les règles du projet (surtout § Pile : sons, musique) ;
2. `docs/REPRISE.md` § 7 (effets et sons) et **§ 10** (sortie sur Steam et téléphones, Splice) ;
3. `src/engine/sfx.js` en survol (la table `SOUNDS`, `SAMPLES`, `play`, `ambience`) et `src/engine/music.js` ;
4. `tools/musique_boucle.py` et `tools/sons_karasu.py` (comment on prépare un son ou une musique).

**Commandes** :
```bash
npm install
npm run build
npm run dev        # le jeu en local ; #foret, #arene-potager, #arene-foret
npm run standalone # versions autonomes (dist/kage-standalone.html, dist/kage-test.html)
```

Dis-moi quand tu as lu et compris, en quelques lignes, puis commence par la **liste des sons** (étape 1), sans rien télécharger.
