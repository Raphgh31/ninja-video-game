# Les arènes — guide complet

Le **mode Arène** de *The Ninja Adventure* : des duels (jusqu'à quatre ninjas) dans une arène fermée, pleine de pièges, une arène par chapitre. Ce fichier dit tout ce qu'il faut savoir pour **retoucher l'arène du Potager** ou **construire l'arène d'un autre chapitre**. À lire avec `CLAUDE.md` (règles du projet) ; pour le contexte général, `docs/REPRISE.md`.

---

## 1. Où on en est (18 novembre 2026)

- **Deux arènes existent** : « la rizière du gong », l'arène du Potager (chapitre 1), et **« la clairière de la statue »**, l'arène de la Forêt (chapitre 2, § 7). On y joue :
  - depuis le menu de l'intro, **Arène → Nouvelle arène** : on choisit l'arène (flèches ← →), puis **Accueillir** : on arrive dans le salon, en hôte, avec un code de quatre signes ;
  - ou **Arène → Rejoindre une arène** : on tape le code de l'hôte ; l'invité arrive d'abord dans la rizière, apprend l'arène de l'hôte (message `arena`) et la rejoint aussitôt, avec le même code ;
  - seul, pour l'essayer : adresses `#arene-potager` et `#arene-foret`, ou boutons « Arène Potager » et « Arène Forêt » du panneau de la version de test.
- **Le salon** (plein écran) : le code en grand, le mode du combat, les quatre places. L'hôte choisit le mode et lance le combat.
- **Les trois modes**, noms choisis par l'utilisateur :
  - **Souffle unique** : une vie, le dernier debout gagne ;
  - **Trois lames** : le premier à 3 éliminations ;
  - **Dix lames** : le premier à 10.
- **Pas encore fait** (idées de l'utilisateur) : des adversaires pilotés par l'ordinateur, l'arène des chapitres suivants, les statistiques d'arène dans « Mon ninja » (combats, victoires, titres), changer d'arène depuis le salon (aujourd'hui : au menu, avant d'accueillir), un relais réseau pour les connexions qui refusent le pair-à-pair.
- **Jamais essayé ici en vrai réseau** : le service PeerJS n'est pas joignable depuis l'environnement de développement. Seul le transport local (deux onglets) est testé. L'utilisateur l'a essayé en ligne avec un ami.

---

## 2. Les fichiers

| Fichier | Rôle |
|---|---|
| `src/game/chapters/arene_potager.js` | **la carte** de l'arène (constructeur `Builder`, comme un chapitre) et sa définition `arena` (repères des pièges, points de départ, bonus) ; exporte `ARENE_POTAGER` |
| `src/game/chapters/arene_foret.js` | la carte de l'arène de la Forêt (`ARENE_FORET`) : sa définition `arena` (bassin, cœurs, points de départ, `camGround`) et sa définition `forest` (lianes, tronc flottant, planches vermoulues : les mécanismes du chapitre 2) |
| `src/game/arena/art_foret.js` | le dessin propre à l'arène de la Forêt (`ForetArenaArt`, hérite d'`ArenaArt`) : le temple et la statue au loin (glissés entre les plans du fond par `backdrop.vista`), la surface du bassin qui suit le niveau, la source, les bulles, les cœurs |
| `src/game/maps.js` | branche l'arène dans `LEVELS` (`'arene-potager': ARENE_POTAGER`) |
| `src/game/arena/arena.js` | **les mécanismes** (`Arena`, constantes `ARENA`) : grue et rocher, gong, vannes et vagues, échafaudages, foin, caisses, bonus, **bassin de la Forêt** (`ARENA.basin`, `updateBasin`) ; chaque arène n'a que les pièges qu'elle déclare ; tout agit sur une **liste de combattants** (pour de futurs adversaires) |
| `src/game/arena/art.js` | **le dessin** (`ArenaArt`) : canal, pontons, perches de séchage, étal, grue, rocher ficelé, ondes de choc, gong, vannes, vagues, caisses, cœurs |
| `src/game/arena/lobby.js` | **le salon** plein écran (`Lobby`) : nom de l'arène, code, modes, quatre places, résultat |
| `src/game/multi.js` | **le jeu à plusieurs** (`Multi`, `MODES`, `SLOT_COLORS`) : états à 20 Hz, autres ninjas, coups, points, début et fin d'un combat, pièges partagés |
| `src/engine/net.js` | **le réseau** (`Net`) : PeerJS (WebRTC) ou transport `local` (BroadcastChannel) ; codes (`randomCode`, `cleanCode`) |
| `src/game/menu.js` | menu Arène (Nouvelle arène et le choix de l'arène / Rejoindre) et écran du code |
| `src/main.js` | `startRoom` (salon et combat), `setCloseUp` (image rapprochée sur téléphone), `arenaCamY` (caméra), `clampCamX`, événements de l'arène (sons, effets) |
| `src/game/level.js` | `level.arena` (créée d'après `def.arena`), échafaudages (`def.arena.scaffolds`), `cutRope` et `hitGongs` délégués à l'arène |
| `src/game/potager/props.js` | `autoDecor` : pas de poteaux automatiques sous les rangées listées dans `ownSupports` |
| `tests/e2e.cjs` | tests des arènes : Potager (caméra, grue, gong, foin, échafaudages, caisses, cœurs, shurikens, plateforme du gong, téléphone, combat à deux, menu) ; Forêt (bassin, accès à chaque étage par un vrai saut, lianes, glissade sous le tronc couché, passerelle vermoulue, combat à deux : l'invité suit l'arène, le bassin et les planches partagés) |
| `tools/vues.mjs` | captures d'une carte (`node tools/vues.mjs arene-foret sortie 26 35,19`, variables `VW`, `VH`, `MOBILE`, `T` = instant du cycle du bassin) |

---

## 3. Comment l'arène du Potager est construite

Carte de 21 cases de haut (`H`), sol à la rangée 18 (`G`), 70 cases de large (`ARENA_W`) : **deux fois l'image**. L'utilisateur l'a voulue ainsi : on en voit la moitié, la caméra suit en largeur.

- **Bords** : deux bosquets de bambous (`|`, colonnes `L = 6` et `R = 63`), murs pour le saut mural. Un **plafond invisible** (`%`) haut au-dessus (rangée `G-16`), pour ne jamais passer par-dessus. Il a été remonté : un plafond trop bas faisait un « mur invisible » au-dessus de la structure du milieu.
- **Centre** : le **canal d'irrigation** (9 cases, mortel), ses murs de pierre et sa **passerelle de trois planches** sur pilotis (`-`).
- **Gauche** :
  - la **grue de bambou** et son **rocher ficelé**. Un shuriken lancé depuis la plateforme du treuil coupe la corde. Le rocher tombe vite et tue ce qui est dessous ; à la réception, une **onde de choc** et un nuage de poussière coûtent une vie à ceux qui sont tout près. Il reste au sol en marche, puis la grue le remonte (18 s).
  - Au même endroit : **foin** (tremplin) et une caisse.
- **Droite** : le **gong** sur sa tour, sur une plateforme de lattes claires qui déborde de 4 cases vers la gauche. Une jambe de force en triangle la tient ; on y monte d'un saut depuis le haut du potager.
  - Frappé (sabre, coup de pied, shuriken), il ouvre les **deux vannes** au pied des bosquets : un torrent puis une **vague** déferlent vers le canal. Elle emporte ceux qui ont les pieds dans l'eau, ainsi que les caisses.
  - Il se réarme en 9 s.
- **Étages** :
  - deux **potagers sur pilotis** cultivés (rangées `G-3` et `G-6`, échelles) ;
  - deux **échafaudages fragiles**, qui ne s'effondrent **que sous le choc du rocher** et sont rebâtis 7,5 s plus tard ;
  - les **perches de séchage du riz** (hasa, `G-9`) au-dessus du canal ;
  - l'étal ;
  - un **coin plat** avec une chaumière au fond ;
  - trois arbres (pommier, poirier, cerisier).
- **Bonus** : des **cœurs** de laque vermillon au nœud d'or (+1 vie). L'utilisateur a refusé les onigiri : il veut des objets propres au monde du jeu.
  - Plus de paquets de shurikens : **on ramasse les siens** là où ils sont plantés, et on réapparaît avec les trois.
- **Musique** : celle du combat contre le corbeau (`karasu.mp3`).

La définition `arena` (dans `arene_potager.js`) donne :
- les repères : `center`, `ground`, `walls`, `spawns` (4 points de départ) ;
- les pièges : `crane`, `gong`, `sluices`, `canal`, `rack`, `deck`, `gongDeck`, `hay`, `crates` ;
- `ownSupports` : les rangées qui ont leurs propres poteaux ;
- `scaffolds`, `hearts`, `bundles` (vide) ;
- les réglages des mécanismes sont dans `ARENA` (`arena.js`).

---

## 4. La caméra et l'échelle

- **En largeur** : `clampCamX` (main.js) se borne aux bosquets ; KAGE est suivi comme dans l'aventure.
- **En hauteur, sur ordinateur** (image de 252 px de haut) : presque fixe, sol à 85 % de l'image ; elle suit à peine un saut depuis l'étage du haut.
- **Sur téléphone, pendant un combat** :
  - **l'image est un cran plus proche** (`setCloseUp`, `closeUp` dans `fit()`). Demande de l'utilisateur : il trouvait le jeu « beaucoup trop petit » en combat sur téléphone ;
  - sur un téléphone allongé (844×390), l'image passe de 422×195 à 362×168 pixels de jeu. Le salon et les menus restent à l'échelle normale ;
  - la caméra n'a alors **que deux hauteurs** (`ARENA_CAM` dans `main.js`) :
    - en bas : au sol et sur les premières plateformes ;
    - en haut : une **montée légère** (environ 3,5 cases), juste ce qu'il faut pour que KAGE, debout sur l'étage le plus haut, garde la tête dans l'image.
  - On monte dès que KAGE se pose à 4,5 cases ou plus, et on redescend quand il se pose à 3,5 cases ou moins. Le passage se fait d'un seul mouvement de 0,6 s (lent, rapide, lent), comme les paliers de l'aventure.
  - **Pas de suivi vertical continu** : demande expresse de l'utilisateur, dans tout le jeu.

---

## 5. Le jeu à plusieurs

### Le réseau (`net.js`)

- **PeerJS** : les navigateurs se parlent directement (WebRTC). Le service public gratuit de PeerJS ne sert qu'à se trouver grâce au code (identifiant `the-ninja-game-salle-<CODE>`).
- **L'hôte** (celui qui accueille) tient la liste des joueurs (4 au plus) et **relaie** tous les messages.
- **Statuts** : `connexion`, `ouverte`, `connecté`, `introuvable`, `pleine`, `perdue`, `prise` (code déjà pris : on en tire un autre), `erreur`.
- **Codes** : quatre signes, sans I, O, 0 ni 1 (`randomCode`). `cleanCode` accepte encore un ancien « KAGE-… » saisi, mais le préfixe n'est plus jamais affiché.
- **Transport `local`** (`?net=local` ou `window.__KAGE_NET = 'local'`) : BroadcastChannel entre onglets, pour les tests.

### Le jeu (`multi.js`)

- Chacun joue son ninja et envoie son état **20 fois par seconde**, seulement pendant un combat. Pendant le salon, le jeu est en pause.
- Les autres ninjas sont dessinés lissés, avec leur skin, leur nom, la couleur de leur place et leur vie.
- **Un coup est décidé par l'écran de celui qui le porte** (sabre, coup de pied, shuriken : `strikeBox`). La victime reçoit `hit` et perd ses points de vie chez elle.
- **Points** :
  - une mort donne un point à l'autre joueur ; à plus de deux, à celui qui a touché en dernier ;
  - en Souffle unique, le mort est **éliminé** (il regarde la fin) ;
  - **l'hôte annonce la fin** (`checkEnd`, message `end`) : « Victoire de … », les points, puis retour au salon.
- **Pièges partagés** : les méthodes de l'arène sont enveloppées (`hookArena`) et diffusées (`gong`, `cut`, `kick`, `col`, et `crum` pour les planches vermoulues de la Forêt : `Forest.startCrumble`). Le bassin de la Forêt n'envoie rien : il suit l'horloge de l'arène, remise à zéro au départ du combat chez tous (`Arena.reset`, qui remet aussi le tronc flottant et les planches à leur place). Les bonus sont décidés par l'hôte (`pk`, `take`).
- **L'arène de l'hôte** : à chaque changement de la liste des joueurs, l'hôte envoie `arena` (l'identifiant de son niveau) ; un invité qui n'est pas dans la même arène la rejoint (même code, rechargement).
- **Messages** : `s` (état), `hit`, `ko`, `me` (skin), `arena`, `mode`, `start`, `out`, `end`, `throw`, `gong`, `cut`, `kick`, `col`, `crum`, `pk`, `take`.

### Le salon et le lancement (`lobby.js`, `startRoom`)

- **Le salon** :
  - le code (bouton « Copier ») ;
  - les **trois noms de modes seulement**, et dessous la règle du mode choisi, une seule fois. L'utilisateur ne veut pas de description sous chaque mode ;
  - les quatre places (portrait au skin, pseudo, « hôte ») ;
  - « Quitter l'arène » (ou Échap) et « Lancer le combat » (deux joueurs au moins).
- **Sobriété** (demande de l'utilisateur) : aucune consigne en petit gris. Un message n'apparaît que s'il y a quelque chose à dire (connexion, hôte parti).
- **Le pseudo** vient du profil (`ninja.profil`, écran « Mon ninja »).
- **Erreurs** :
  - une arène introuvable ou pleine ramène à l'écran du code, avec un message ;
  - un hôte qui part ramène ses invités au menu Arène.

---

## 6. Construire l'arène d'un autre chapitre

L'utilisateur veut **une arène par chapitre**, dans le style du chapitre (la Forêt est la suivante). La méthode est celle des chapitres (`docs/GUIDE_CHAPITRE.md`) : **proposer avant de construire**.

1. **Proposer** des éléments (pièges, étages, bonus, ambiance) tirés du chapitre. Pour le Potager, l'utilisateur a validé une liste avant toute construction, puis l'a corrigée : cœurs au lieu d'onigiri, rocher au lieu de sacs de riz, pas de galerie reliant les plateformes…
2. **La carte** : `src/game/chapters/arene_<chapitre>.js`, sur le modèle de `arene_potager.js` :
   - mêmes repères (`ground`, `walls`, `spawns` × 4) ;
   - deux fois la largeur de l'image ;
   - des bords qu'on ne franchit pas ;
   - un plafond invisible assez haut (on doit pouvoir sauter normalement depuis l'étage le plus haut) ;
   - trois étages : sol, premières plateformes (3 cases), étage du haut (6 à 9 cases). La caméra du téléphone est réglée pour ces hauteurs ; si l'arène monte plus haut, revoir `ARENA_CAM`.
3. **Brancher** :
   - l'entrée dans `LEVELS` (`maps.js`), avec un champ `arena` ;
   - le thème du décor (`theme`), la musique ;
   - le bouton du panneau de test, qui apparaît de lui-même pour tout niveau qui a `arena` ;
   - **le menu** : toute entrée de `LEVELS` qui a un champ `arena` apparaît d'elle-même dans le choix de « Nouvelle arène » (son nom, sans « Arène — ») ; « Accueillir » l'ouvre (`go()` dans `main.js`), les invités la suivent (message `arena`).
4. **Les mécanismes** :
   - réutiliser `Arena` quand c'est possible (grue, vagues, échafaudages, caisses, foin, cœurs) ;
   - un piège propre au chapitre s'ajoute dans `arena.js` (ou un fichier voisin) et agit sur la liste `fighters` ;
   - le dessiner dans `art.js` (ou un `art_<chapitre>.js`) ;
   - **le partager en réseau** dans `hookArena` (`multi.js`) : un message par action, appliqué chez les autres sans être renvoyé.
5. **Le dessin** :
   - peint en code, comme le chapitre (palette et outils du chapitre : `src/game/potager/`, `src/game/foret/`) ;
   - **rien ne flotte** : chaque plateforme a ses poteaux. `ownSupports` évite les poteaux automatiques en double ;
   - **pas de caisses en l'air** ; de la profondeur ; une lumière cohérente.
6. **Les tests** (`tests/e2e.cjs`) : chaque piège, l'accès à chaque plateforme (par un vrai saut au clavier), la caméra du téléphone, un combat à deux en transport local.
7. **Vérifier** sur ordinateur, sur téléphone en paysage et en portrait, en combat et dans le salon. Puis carte mentale, docs, et publication selon les règles de `CLAUDE.md`.

### Les leçons de l'arène du Potager (corrections demandées)

- **Taille** : d'abord 1,5 fois l'image, puis 2 fois (« on voit la moitié »).
- **Sur téléphone** : même échelle que sur ordinateur, puis un cran plus près en combat, avec deux hauteurs de caméra.
- **Retirés** :
  - les petites plateformes inutiles au bord de l'eau ;
  - les caisses qui tombaient du ciel, ou qui restaient en l'air ;
  - un mur invisible (plafond trop bas) ;
  - une galerie de planches entre le gong et le reste (refusée).
- **Agrandis** : la passerelle et le canal ; le gong ; les vagues, plus hautes et plus naturelles.
- **Rocher** : ses cordes aussi épaisses que la corde principale.
- **Échafaudages** : ils ne tombent que sous le rocher (pas à la réception d'un saut).
- **Atteindre chaque plateforme** sans acrobatie impossible : la plateforme du gong a été élargie vers la gauche, avec une jambe de force à l'extérieur.
- **Points simples** : un mort, un point pour l'autre.

---

## 7. L'arène de la Forêt : « la clairière de la statue » (18 novembre 2026)

Demande de l'utilisateur : une arène dans la direction artistique du chapitre 2 ; des **mécanismes légers** qui rendent le combat plus stratégique **sans en être le centre** ; des **supports qui font varier les niveaux, comme les troncs coupés** du décor de la Forêt ; en fond, **les plus beaux arbres, les montagnes, le temple et la statue** (la statue doit apparaître, sans mécanisme) ; de la cohérence (des variations du niveau de l'eau, des choses logiques), des **variations de densité**, un très bon rendu, rien de trop lourd. Fichiers : `src/game/chapters/arene_foret.js` (carte), `src/game/arena/arena.js` (bassin), `src/game/arena/art_foret.js` (dessin), `src/game/foret/` (tout le reste : terrain, souches, arbres, lianes, tronc flottant, planches, eau).

### Le plan (l'histoire du lieu)

Une clairière de la lisière, au **matin doré** (la lumière la plus lumineuse du chapitre). Au centre, **l'ancien bassin d'un sanctuaire**, bordé de pierres taillées, que la source remplit et vide lentement ; à gauche, **la vieille forêt** restée sauvage, dense ; à droite, **la coupe des bûcherons**, ouverte : des souches de toutes les hauteurs, des bûches, une passerelle de fortune — et l'arbre sacré, qu'ils ont épargné. Au loin, le temple d'où l'on vient et la statue oubliée, colossale, qui veille sur le bassin.

### Les éléments (de gauche à droite) — après les retouches du 24 novembre 2026

| Colonnes | Élément | Rôle |
|---|---|---|
| 4-5, 64-65 | deux grands fûts moussus (`|`) | les bords : sauts muraux, on n'en sort pas ; plafond invisible tout en haut (rangée 0) |
| 6-8 | fourrés, champignons | densité ; point de départ |
| 9-12 | **le tronc mort creux** (`hollow_giant` en miniature, `chicot: 6`) : cassé à 3 cases, deux parois à la même hauteur ; dedans, trois nœuds en quinconce | on y entre par le haut, on descend de nœud en nœud (3 cases à chaque fois) jusqu'à la grotte |
| 8-22, sous le sol | **la petite grotte** (`F.galleries`, `shade: 1.9`) : salle basse de 5 cases, voûte plus haute au milieu, une butte ; grands champignons qui luisent (`cave_mushroom`), petits champignons, arbre à perles, rideaux de racines, rai de jour | un passage caché, un cœur au fond ; la caméra y descend (`cave`), le soleil s'y efface (`caveAt`) |
| 21-22 | **le puits de racines** (`root_well`), sous le vieux chêne : deux racines en marche, un lacis de racines qui ferme le trou (`-`, on y marche) | la sortie de la grotte |
| 15-16 | souche (2 cases) | palier vers la branche basse |
| 23 | **le vieux chêne** : branche basse 14-25 (5 cases), grande branche 21-31 (8), **perchoir de la canopée** 19-25 (14) | |
| 25 | petit sanctuaire de pierre (`hokora`) | |
| 27 et 42 | bords du bassin en pierre taillée (`=`) | |
| 28-41 | **le bassin** : deux rochers (30-31, 38-39), chenal du tronc flottant (32-37) | le cœur stratégique |
| 24-45, rangée 7 | **la voûte** (`vine_arch`, `-`) : deux grosses branches qui se croisent, liées par une liane ; deux lianes (x 32,5 et 37,5, ~6 cases) | on passe d'un arbre à l'autre par le haut ; on se lance sur les lianes |
| 43-44 | **le rocher de la source** (2 cases) | marche ; le filet d'eau annonce la crue |
| 46 | **le grand cèdre** : branche basse 44-51, grande branche 38-48, **branche haute** 41-46 (14) | |
| 46 → 60, rangée 4 | **le pont suspendu** (`F.bridges`, `rotten: []`) | il ploie et oscille ; aucune planche ne lâche |
| 49-50, 53-54 | une souche (2 cases), une haute souche (4 cases) | paliers |
| 56 | l'arbre sacré épargné (décor) | |
| 60 | **le tronc de remontée** (`climb_trunk`) : branches en quinconce toutes les 2 cases, de 2 à 12 ; son feuillage juste au-dessus du bout du pont | on monte de la coupe à la canopée |

Retirés le 24 novembre 2026 (retours de l'utilisateur) : la pile de bûches et les tronçons (pas assez travaillés), le tronc couché (il coupait le tronc creux), la passerelle vermoulue et l'une des deux hautes souches (trop artificiel).

Arbres du décor (derrière) : bouleaux, un jeune pin. Fond (`backdrop.vista`) : le temple sur sa butte, la statue, la grande chaîne.

### Le bassin qui respire (`ARENA.basin`)

- **Cycle de 30,8 s** (durci le 24 novembre 2026 : un débutant doit s'y faire prendre), le même chez tous (horloge de l'arène, remise à zéro au lancement) : eau basse 12 s → l'eau monte en 2,2 s (la source gronde, des bulles) → elle affleure le dessus des rochers 0,9 s → elle les noie en 1,2 s → eau haute 11 s (surface à 2 px sous le bord) → elle redescend en 3,5 s.
- **Eau basse** : de rocher en tronc et de tronc en rocher. **Eau haute** : les rochers sont mortels, et le tronc flottant file 1,9 fois plus vite et s'enfonce 1,8 fois plus vite (`logSpeed`, `logSink` ; `sinkK` dans `mechanics.js`). On passe par le haut (la voûte, les lianes) ; depuis le tronc, on peut sauter à une liane.
- Les cases d'eau (`~`) suivent la surface : une rangée est mortelle dès que la surface dépasse son haut de 4 px.

### La caméra (`arenaCamY`)

- Le sol à 80 % de l'image (`camGround`). Sur ordinateur, elle suit KAGE vers le haut jusqu'à la canopée (`camTop: -14`). Dans la grotte (`cave`), elle descend : le sol de la grotte en bas de l'image.
- Sur téléphone, des paliers (jamais de suivi continu) : en bas ; en haut (dès 4,5 cases, jusqu'à la voûte : `camHigh: 11`) ; la canopée (dès 12 cases) ; la grotte.

### Réglages et leçons

- **Rien ne flotte** : chaque branche sort d'un tronc (le chêne, le cèdre, le tronc de remontée) ; la voûte relie les deux grands arbres ; le pont est noué aux deux fûts, juste sous un feuillage (l'utilisateur l'a demandé : accroché au-dessus du feuillage, il semblait pendre dans le vide).
- **Chaque étage par un vrai saut** (tests) : sol → souche → branche basse → grande branche → voûte → perchoir du chêne ou branche haute du cèdre ; à droite, rocher de la source → branche basse → grande branche ; souche → haute souche ; tronc de remontée → pont. Le tronc creux : on le franchit par-dessus, ou on y descend jusqu'à la grotte (sans dommage) ; on remonte par le puits.
- Les tests pilotent les sauts par les commandes du jeu (`input.press`) : au clavier simulé, deux essais trop rapprochés font un double appui, donc un dash.
- Le reflet de l'eau (`live.js`) ne copiait pas que la part visible quand l'eau sortait à gauche de l'image : il débordait sur la rive. Corrigé pour tout le jeu.

## 8. Le duel (25 novembre 2026) : ce qui fait d'un combat un moment

Demande de Raph : rendre les combats plus addictifs, « jeu professionnel » plutôt que « jeu cheap », d'après les
bons jeux de duel (Nidhogg, Samurai Gunn, TowerFall, Divekick, Smash, Street Fighter 6). Six chantiers, tous faits.

### 1. La sensation des coups (`combat.js` : `IMPACT`)
- Chaque coup a sa force : `sword`, `air`, `flip`, `riposte`, `kick`, `shuriken` → micro-arrêt (`stop`, le même chez
  l'attaquant et chez la victime), recul (`push`, `lift`), secousse seulement pour les lourds (`shake`). Le 26 novembre
  2026 : **le sabre fait à peine reculer** (un petit à-coup, `push` 40, sans soulever) ; **le coup de pied repousse
  loin** (`push` 300, à peine soulevé : un recul au sol qui glisse et ralentit, état `hurt`), pas un bond.
- La victime brille une ou deux images en blanc (`src/engine/silhouette.js`, `IMPACT.flash`), aussi chez les autres.
- Son en couches : `bladeHit` (le claquement de la lame) + `impact` (le coup sourd dans le corps) ; vibration courte.
- Toucher rend un peu d'énergie (`ENERGY.hitGain`) : l'attaque nourrit l'attaque.

### 2. La parade, le choc des lames, le shuriken renvoyé
- Images : `tools/kage_forge/duel.py` (planche `duel_board.py`) → animations `parry` (4), `parry_hit` (2), `stagger` (3),
  `victory` (4), `defeat` (2) ; boîte de la garde : `hitbox.parry` (`build.py`).
- Commandes : **F ou G** au clavier, **L1/R1** à la manette, un bouton de plus sur téléphone (lame tenue en travers,
  au-dessus du saut) ; en arène seulement (`player.canParry`, `touch.setParry`).
- Règles (`PARRY`) : la garde pare pendant ses trois premières images (~0,3 s), face au coup ; la parade réussie fait
  encaisser la lame (`parry_hit`), déséquilibre l'attaquant (`stagger`, sans commande) et ouvre la riposte
  (`riposteT`, 0,7 s : le sabre suivant porte **+1**, `kind: 'riposte'`) ; ratée, elle laisse à découvert
  (`PARRY.cooldown`) ; **le coup de pied brise la garde** (+1). Deux sabres actifs qui se rencontrent : **le choc des
  lames** (`clash` : chacun recule, riposte possible). Un shuriken qui touche une lame ou une garde levée est renvoyé
  vers son lanceur (`deflectGhosts`, `Shurikens.sendBack`, message `deflect`).
- En ligne : la parade est jugée **sur l'écran du défenseur** (là où il a appuyé) : message `hit` → `parried` ;
  le choc, sur l'écran de celui qui le voit (message `clash`).

### 3. Le rythme (`multi.js` : `MODES.duel`, manches)
- Mode **Duel** : deux manches gagnantes, une vie par manche (le vaincu reste à terre : `player.holdDeath`) ; places du
  duel face à face (`duelSpawns` des arènes). L'hôte arbitre : `round` → (coup fatal, revoir, score) → `roundStart`
  après `ROUND_PAUSE` (5,2 s, horloge du jeu : `roundClock`).
- **Manche décisive** (`decisive()`) : la lumière tombe (le soir), le cœur bat, la musique du combat.
- **La brume d'encre** (`DUEL.mistAt` : après 40 s de manche, modes à une vie) : elle avance des deux bords ; on s'y
  blesse ; elle laisse libre le bassin et ses deux rives.
- **Coup de pouce léger** : le cœur bonus apparaît plutôt près de celui qui est derrière (`arena.favorX`).

### 4. Le spectacle (`src/game/arena/duel.js`, calque `.duel-layer`)
- **L'ouverture** : bandes noires, vent, une feuille, « Manche 1 », le gong, « Combattez » ; la caméra entre les deux.
- **Le coup fatal** (le coup qui finit une manche : `final`) : ralenti à 16 %, zoom ×1,7 sur l'impact (les calques du
  jeu ensemble), le monde s'assombrit, un trait d'encre en diagonale traverse le vaincu, puis le retour.
- **Le revoir** : les 2,2 dernières secondes rejouées à 85 % (30 instantanés par seconde, la caméra de l'instant).
- **Les traces** : une tache d'encre éclaboussée reste au sol, sous chaque vaincu, jusqu'à la fin du duel.
- **La fin** : le vainqueur rengaine (`victory`), le vaincu met un genou à terre (`defeat`) ; le résultat s'écrit sur
  l'image du combat (`.duel-end`) : **Revanche** (quand tous l'ont demandée, l'hôte relance) ou **Salon**.

### 5. Ce qui fait revenir (`src/game/arena/stats.js`)
- Statistiques (localStorage `ninja.arene`), montrées dans **Mon ninja** (en haut à droite) : duels, victoires, série,
  parades, coups fatals, ennemi juré. **Neuf titres** gagnés par des exploits ; chacun donne un **sceau d'encre**
  (à côté du nom, au-dessus de la tête, au score) et une **couleur de lame** (`TRAILS`) — rien qui change le combat.
- **Le ninja de l'ombre** (`src/game/arena/bot.js`, menu Arène « Contre l'ombre ») : un vrai KAGE aux commandes
  virtuelles, par le même chemin qu'un adversaire en ligne (`src/engine/localnet.js`). **Refait le 26 novembre 2026**
  (retour de Raph : mouvements incohérents, bloqué contre les obstacles) :
  - **trois niveaux** choisis au menu : **l'Apprenti, le Rōnin, le Maître** (« ← Rōnin → », barre de trois crans ;
    `ninja.ombre`, `cfg.level`), et le **type de combat** comme contre un ami (« ← Duel → » : Duel, Souffle unique,
    Trois lames, Dix lames ; `ninja.ombre.mode`, `cfg.botMode`) ;
    réglages `BOT.levels` (réaction 0,38 / 0,22 / 0,10 s ; parade 12 / 50 / 88 % ; punition, riposte, coup de pied,
    feinte, dash, shuriken, distance, précision, adaptation) ;
  - **graphe des appuis** (`src/game/arena/nav.js`) : les appuis (cases où l'on tient debout), les sauts qu'il sait
    réussir (vraie physique du saut, plafonds vérifiés), les chutes, les glissades sous un passage bas ; Dijkstra ;
    refait toutes les 2 s (le bassin, les échafaudages) ; jamais un saut vers l'eau ou le vide ;
  - **perception** avec un temps de réaction (il voit les gestes passés, jamais les touches) et un **plan** tenu un
    moment (garder la distance, entrer, punir, feinter, reculer, lancer) ; dos à l'eau il ne recule plus ; il ne saute
    pas se poser sous un sabre ; pas de dash ni de coup de sabre qui le jetterait à l'eau ;
  - mesuré par des **matchs entre niveaux** (`brain()` : un cerveau mène le joueur) : le 3 bat le 2, le 2 bat le 1.
- **Le Dojo** (menu Arène) : l'ombre à quatre pas frappe à un rythme régulier ; on n'y meurt pas ; le bandeau compte
  les parades et les ripostes.

### 6. Le réseau
- États trente fois par seconde, horodatés ; les autres ninjas sont dessinés **un dixième de seconde dans le passé**,
  interpolés entre deux états (`INTERP`, `place`) : un mouvement fluide malgré le réseau. Ce n'est pas un « rollback »
  complet (à envisager si le jeu en ligne devient compétitif).
- La revanche d'un geste (`askAgain`, `again`).

### Réglages
`IMPACT`, `PARRY` (combat.js), `ENERGY.parry`/`parryGain`/`hitGain` (energy.js), `DUEL` (duel.js), `BOT` (bot.js),
`MODES`, `ROUND_PAUSE`, `INTERP` (multi.js). Tests : « duel : … », « contre l'ombre : … », « Dojo », « Mon ninja » dans
`tests/e2e.cjs`.
