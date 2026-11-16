# Les arènes — guide complet

Le **mode Arène** de *The Ninja Adventure* : des duels (jusqu'à quatre ninjas) dans une arène fermée, pleine de pièges, une arène par chapitre. Ce fichier dit tout ce qu'il faut savoir pour **retoucher l'arène du Potager** ou **construire l'arène d'un autre chapitre**. À lire avec `CLAUDE.md` (règles du projet) ; pour le contexte général, `docs/REPRISE.md`.

---

## 1. Où on en est (16 novembre 2026)

- **Une arène existe : « la rizière du gong »**, l'arène du Potager (chapitre 1). On y joue :
  - depuis le menu de l'intro, **Arène → Nouvelle arène (Accueillir)** : on arrive dans le salon, en hôte, avec un code de quatre signes ;
  - ou **Arène → Rejoindre une arène** : on tape le code de l'hôte ;
  - seul, pour l'essayer : adresse `#arene-potager`, ou bouton « Arène » du panneau de la version de test.
- **Le salon** (plein écran) : le code en grand, le mode du combat, les quatre places. L'hôte choisit le mode et lance le combat.
- **Les trois modes**, noms choisis par l'utilisateur :
  - **Souffle unique** : une vie, le dernier debout gagne ;
  - **Trois lames** : le premier à 3 éliminations ;
  - **Dix lames** : le premier à 10.
- **Pas encore fait** (idées de l'utilisateur) : des adversaires pilotés par l'ordinateur, une arène par chapitre (la Forêt est la suivante), les statistiques d'arène dans « Mon ninja » (combats, victoires, titres), le choix de l'arène dans le salon, un relais réseau pour les connexions qui refusent le pair-à-pair.
- **Jamais essayé ici en vrai réseau** : le service PeerJS n'est pas joignable depuis l'environnement de développement. Seul le transport local (deux onglets) est testé. L'utilisateur l'a essayé en ligne avec un ami.

---

## 2. Les fichiers

| Fichier | Rôle |
|---|---|
| `src/game/chapters/arene_potager.js` | **la carte** de l'arène (constructeur `Builder`, comme un chapitre) et sa définition `arena` (repères des pièges, points de départ, bonus) ; exporte `ARENE_POTAGER` |
| `src/game/maps.js` | branche l'arène dans `LEVELS` (`'arene-potager': ARENE_POTAGER`) |
| `src/game/arena/arena.js` | **les mécanismes** (`Arena`, constantes `ARENA`) : grue et rocher, gong, vannes et vagues, échafaudages, foin, caisses, bonus ; tout agit sur une **liste de combattants** (pour de futurs adversaires) |
| `src/game/arena/art.js` | **le dessin** (`ArenaArt`) : canal, pontons, perches de séchage, étal, grue, rocher ficelé, ondes de choc, gong, vannes, vagues, caisses, cœurs |
| `src/game/arena/lobby.js` | **le salon** plein écran (`Lobby`) : code, modes, quatre places, résultat |
| `src/game/multi.js` | **le jeu à plusieurs** (`Multi`, `MODES`, `SLOT_COLORS`) : états à 20 Hz, autres ninjas, coups, points, début et fin d'un combat, pièges partagés |
| `src/engine/net.js` | **le réseau** (`Net`) : PeerJS (WebRTC) ou transport `local` (BroadcastChannel) ; codes (`randomCode`, `cleanCode`) |
| `src/game/menu.js` | menu Arène (Nouvelle arène / Rejoindre) et écran du code |
| `src/main.js` | `startRoom` (salon et combat), `setCloseUp` (image rapprochée sur téléphone), `arenaCamY` (caméra), `clampCamX`, événements de l'arène (sons, effets) |
| `src/game/level.js` | `level.arena` (créée d'après `def.arena`), échafaudages (`def.arena.scaffolds`), `cutRope` et `hitGongs` délégués à l'arène |
| `src/game/potager/props.js` | `autoDecor` : pas de poteaux automatiques sous les rangées listées dans `ownSupports` |
| `tests/e2e.cjs` | tests de l'arène (caméra, grue, gong, foin, échafaudages, caisses, cœurs, shurikens, plateforme du gong, téléphone, combat à deux, menu) |

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
- **Pièges partagés** : les méthodes de l'arène sont enveloppées (`hookArena`) et diffusées (`gong`, `cut`, `kick`, `col`). Les bonus sont décidés par l'hôte (`pk`, `take`).
- **Messages** : `s` (état), `hit`, `ko`, `me` (skin), `mode`, `start`, `out`, `end`, `throw`, `gong`, `cut`, `kick`, `col`, `pk`, `take`.

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
   - **le menu** : aujourd'hui « Accueillir » ouvre `#arene-potager` (`go()` dans `main.js`). Avec plusieurs arènes, il faudra choisir l'arène dans le salon : l'hôte la choisit, le message part avec `start`.
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
