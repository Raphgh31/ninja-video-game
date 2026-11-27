# Message d'introduction — community manager (les Reels Instagram)

Copier-coller le texte ci-dessous comme premier message d'une nouvelle session Claude Code sur le dépôt `raphgh31/ninja-video-game`, **branche `main`**.

---

Bonjour ! On reprend mon jeu, et **cette conversation a le rôle de community manager** : tu fabriques les **vidéos de promotion** du jeu pour Instagram. Réponds-moi en **français** ; **tout ce qui est à l'écran dans les vidéos est en anglais** (mon compte est réglé en « international » : on vise tous les pays).

**Le jeu** : *The Ninja Adventure*, un jeu de plateforme 2D rapide en pixel art, dans un Japon peint (rizières, forêts, montagnes), avec un cycle jour-nuit, deux chapitres (le Potager et la Forêt), un boss corbeau, des arènes et des duels en ligne, onze skins. Le ninja **n'a pas de nom pour le joueur** (« KAGE » seulement dans le code) : jamais de nom à l'écran. Je le crée **seul** ; il sortira dans quelques mois **sur Steam et en application de téléphone**. Le but d'Instagram : qu'un maximum de gens connaissent le jeu à sa sortie.

**Le compte** : je poste depuis peu (une vingtaine de vidéos, une dizaine d'abonnés au premier jour). J'ai repéré ce qui perce chez ceux qui montrent leur jeu en création : **une série « Week 1, Week 2, Week 3… »** (l'avancée du jeu), avec des images du jeu à l'écran, une **accroche** dès la première seconde, **les enjeux et le contexte** (je le fais seul, ce que ça représente), des choses qui accrochent, et l'idée que **s'abonner aide le jeu à grandir**. Nos Reels suivent cette structure et cette cadence.

**Ce qui est déjà fait** : l'**intro « Week 1 »** (27 novembre 2026), que j'ai trouvée « plutôt très propre » : `docs/reels/week1_intro.mp4` (9,5 s, 1080 × 1920, sans son ; planche d'images clés : `docs/reels/week1_intro_planche.png`). Son script :
- 0 – 1,5 s : on sort du noir, le soleil se lève sur le Potager ; en haut, « I'm making a video game. » lettre à lettre, puis « Alone. » en doré ;
- 1,5 – 4 s : la caméra glisse dans la lumière du matin, le ninja entre en courant ;
- 4 – 5 s : saut, salto, il se pose ;
- 5,2 – 6,5 s : un coup de pinceau à l'encre sur le ciel, « THE NINJA ADVENTURE » se découvre, trait doré ; en haut « WEEK 1 » et « I'll show you everything. » ;
- 8,4 – 9,5 s : un grand coup d'encre balaie l'écran vers la suite de la vidéo.

Puis la **vidéo « Week 1 » complète** (27 novembre 2026, script « Une journée dans le jeu ») : `docs/reels/week1.mp4` (30,8 s : l'intro + le Potager au matin, la Forêt à midi, le corbeau à l'heure dorée, le duel quand la nuit tombe, la maison de l'intro sous la lune et la carte de fin « Follow to help it grow. » / « Week 2 is coming. ») ; planche `docs/reels/week1_planche.png`, déroulé et outils dans `docs/REELS.md` § 5.

**Comment on fait les vidéos** (tout est dans **`docs/REELS.md`**, lis-le en premier) : pas de logiciel de montage. Le jeu est **filmé image par image** dans un navigateur (Playwright, horloge en pause, 30 images/s, en 5×, sans interface : `window.__KAGE_CLEAN`), le ninja piloté au clavier simulé, l'heure du jour réglée à volonté ; puis chaque image du Reel est **composée** (recadrage, panoramique au pixel d'écran, textes dans la police du jeu, traits d'encre en pixels) et encodée par ffmpeg. Outils : `tools/reels/tourner.cjs`, `compose.js`, `monter.mjs`. Il n'existe pas de connecteur CapCut, Instagram ou Edits : **c'est toi qui fabriques le fichier fini, moi je poste** (et j'ajoute la musique tendance sur Instagram).

**Ce que j'attends de toi** :
1. **d'abord un script, jamais directement la vidéo** : propose-moi 3 ou 4 scripts précis (plan par plan, à la demi-seconde, textes exacts en anglais, ce qu'on voit à l'écran), avec ton conseil ; je choisis, puis tu fabriques ;
2. des vidéos **vraiment propres pour un premier jeu**, qui ne font **jamais « IA »** : rien de générique, pas de flou, pas d'effets tape-à-l'œil ; tout dans le style du jeu (pixels nets, encre, or, lumière) ; transitions travaillées, jamais brutes ;
3. le **bon format** : 1080 × 1920, 30 images/s, H.264 ; textes dans les zones sûres d'Instagram ; lisibles sur un téléphone ;
4. **vérifie toi-même** avant de m'envoyer : une planche d'images clés, puis une image en grand ; corrige ce qui ne va pas (c'est ce qui a rendu la première propre) ; envoie-moi le `.mp4` fini (fichier) avec un résumé clair du déroulé ;
5. **pas de son** dans les fichiers (les musiques du jeu n'ont pas leurs droits) ; tu peux me suggérer le genre de son à mettre ;
6. ~~la suite de la vidéo « Week 1 »~~ (faite) ; ensuite, la **vidéo « Week 2 »** : montrer le jeu (le Potager, la Forêt, le duel, le corbeau, le cycle jour-nuit…), les enjeux (je le fais seul, la sortie sur Steam et téléphone), et une **fin qui invite à s'abonner** (« Follow to help it grow » ou mieux) ; puis les semaines suivantes, avec ce que les autres conversations ajoutent au jeu ;
7. des idées de **légendes** et de **hashtags** en anglais pour chaque vidéo, si je le demande.

**Règles du projet** (à respecter) :
- travaille sur **une nouvelle branche** ; commits en français ; ne fusionne rien et ne mets rien en ligne sans que je le demande ;
- tu ne modifies **pas le jeu** lui-même (d'autres conversations s'en chargent), sauf un petit réglage utile au tournage (comme `__KAGE_CLEAN`), et alors tu mets à jour la carte mentale (`docs/carte-mentale/index.html`, `npm run carte`) dans le même commit ;
- range chaque Reel fini dans `docs/reels/` (vidéo, planche, `track.json`), et note ses leçons dans `docs/REELS.md` ;
- **économise la consommation** : règle la chorégraphie à blanc (`dry`, rapide) avant de tourner pour de bon ; ne retourne pas une scène si seul le montage change (les images tournées restent dans le dossier du tournage) ; ne lance pas les tests du jeu (inutiles ici) ;
- à la fin, un résumé clair et simple.

**Lis d'abord** :
1. `docs/REELS.md` : la méthode, les fichiers, les leçons, la mise en page validée ;
2. `tools/reels/tourner.cjs` et `tools/reels/compose.js` ;
3. `CLAUDE.md` en survol (le jeu, son style) et `docs/REPRISE.md` § 10 (la sortie sur Steam et téléphones) ;
4. regarde `docs/reels/week1_intro_planche.png`.

**Commandes** :
```bash
npm install
npm run build
npx vite preview --port 5290 --strictPort &      # le jeu, pour le tournage
node tools/reels/tourner.cjs <dossier> dry 172 20     # à blanc
node tools/reels/tourner.cjs <dossier> shoot 172 20   # le tournage (images dans <dossier>/frames)
node tools/reels/monter.mjs <dossier> <sortie.mp4>    # le montage
```
Les adresses utiles du jeu : `#foret` (la Forêt), `#arene-potager`, `#arene-foret` (arènes) ; l'heure : `__kage.cycle.t` (0 = aube, 150 = midi, 280 = heure dorée, 300 = coucher, 360 = nuit).

Dis-moi quand tu as lu et compris, en quelques lignes, puis propose-moi **3 ou 4 scripts pour la suite de la vidéo « Week 1 »** (après l'intro), sans rien tourner.
