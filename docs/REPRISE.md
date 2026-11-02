# KAGE — document de reprise

Ce fichier résume tout le travail fait jusqu'ici (personnage, mécaniques, ennemi, niveau, outils) avec les décisions prises et leurs raisons. Il sert à reprendre le projet dans une nouvelle discussion sans rien perdre.

> **Pour reprendre** : ouvrir une nouvelle session Claude Code sur ce dépôt (branche `main`) et écrire :
> « Lis `CLAUDE.md`, `docs/REPRISE.md` et `docs/MONDE.md`, puis on continue le jeu KAGE : prochaine étape, la planche de design du marchand (direction choisie : le sage voyageur). »
>
> Tout est dans `main` (aucune PR ouverte, aucune tâche planifiée en cours). Dernière mise à jour : 2 novembre 2026.

---

## 1. Où en est le projet

- **Dépôt** : `raphgh31/ninja-video-game`. KAGE, TATE, WARA, le niveau 1 et le **chapitre 1 (le Potager, en greybox jouable)** sont dans `main`. Le plan du monde est dans `docs/MONDE.md` (carte : `tools/monde_carte.py`).
- **Site du jeu (public)** : <https://raphgh31.github.io/ninja-video-game/>, mis en ligne par GitHub Actions (`.github/workflows/deploy.yml`) à chaque push sur `main`.
- **Direction du jeu** : l'utilisateur a choisi un **monde unique** très long, avec sauvegarde, zones et chapitres de plus en plus exigeants et des améliorations de KAGE (plutôt que des niveaux séparés), parce que c'est ce qui fera l'originalité du jeu. Chapitres prévus : **potager** → champ des bambous (rizières) → forêt des grands arbres → village des basses montagnes → hautes montagnes → temple de pierre → dojo final. Monnaie : les **ryō**. Toutes les mécaniques sont actives dès le début (rien à débloquer) ; les attributs (vie, attaque…) progresseront par l'**expérience** et des paliers ; retour en arrière libre, avec des points de téléportation (cabanes de marchand). Plan détaillé : **`docs/MONDE.md`**.
- **Version de test** (page privée claude.ai) : <https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm>. Elle se met à jour en republiant `dist/kage-standalone.html` (identifiant de l'artefact : `5f0bb94d-1fa1-48d5-b9b9-f829586682e6`).
- **Contenu actuel** : le **chapitre 1, le Potager** (ouvert par défaut, voir § 6 bis), le personnage KAGE complet (20 animations, dont le coup de pied et la marche à bout de souffle), les ennemis TATE et WARA, un mini **Niveau 1** qui demande toutes les mécaniques, un terrain d'essai, une version mobile en plein écran (même cadrage que sur ordinateur ; en portrait le jeu pivote pour se jouer en tournant le téléphone vers la gauche), des sons synthétisés, des effets visuels et 52 tests automatiques. Le Potager a été **entièrement repeint** (§ 6 quater) : cadrage 448×252, caméra posée à paliers, grande chaîne de montagnes, décors riches et vivants.
- **Langue de travail** : français, dans les réponses comme dans le code (commentaires, documentation, messages de commit).

## 2. Commandes

```bash
npm install
npm run dev          # jeu en local (http://localhost:5173) : le Potager ; #niveau-1 = ancien niveau 1, #terrain = terrain d'essai
npm run sprites      # régénère tous les sprites (KAGE + TATE + WARA) avec contrôles qualité
npm run build        # version de production dans dist/
npm run standalone   # dist/kage-standalone.html : jeu complet en un seul fichier
npm test             # build + version autonome + 52 tests de bout en bout dans Chromium
```

Avant de pousser : `npm run sprites` puis `npm test` sans échec, et vérifier dans un navigateur (ordinateur, tactile paysage ~844×390 et portrait ~390×844).

## 3. Carte des fichiers

| Chemin | Rôle |
|---|---|
| `src/main.js` | boucle à pas fixe 120 Hz, mise à l'échelle, caméra, branchement des événements (sons, poussière), HUD, arrivée ; pour un chapitre : écran titre, sauvegarde, bannières de zone, aides contextuelles, ryō, caisses, marchand |
| `src/game/player.js` | KAGE : physique et machine d'états (constantes `P` en tête) |
| `src/game/energy.js` | énergie (constantes `ENERGY`), anneau en haut à gauche |
| `src/game/combat.js` | vie de KAGE et dégâts (`HEALTH`, `DAMAGE_TAKEN`, `DAMAGE_DEALT`) |
| `src/game/healthbar.js` | barres de vie fines au-dessus des personnages |
| `src/game/shuriken.js` | shurikens : stock, vol, plantés, ramassage (constantes `SHURIKEN`) |
| `src/game/tate.js` | ennemi TATE (constantes `TATE`) |
| `src/game/wara.js` | ennemi WARA (constantes `WARA`) |
| `src/game/fall.js` | chute des ennemis poussés dans le vide (coup de pied) ; en marchant, ils évitent le vide |
| `src/game/level.js` | niveau : tuiles, gong, porte, lanternes, torii, décor ; ryō, caisses, zones, marchand (chapitres) |
| `src/game/maps.js` | cartes ASCII (terrain d'essai, niveau 1), légende en tête ; branche les chapitres |
| `src/game/chapters/potager.js` | **chapitre 1** : carte construite zone par zone (petit constructeur `Builder`), décors, aides, zones |
| `src/game/potager/` | **décor peint du Potager** : `backdrop.js` (ciel, nuages, oiseaux, cinq plans de paysage en parallaxe, premier plan sombre), `tiles.js` (tuiles selon la zone : terre, murets de pierre sèche, pierre taillée, racines, poutres, étagère, branche, bambou, bosquet ; berges et eau des canaux), `props.js` (une cinquantaine de décors + décors automatiques), `world.js` (terrain peint par tranches de 512 px, à la demande), `live.js` (roue à eau, cascade, koïs, kappa, pluie, lumière de la grange, marchand, papillons, pétales…), `palette.js`, `paint.js` (bruit, tramage, pinceaux), `index.js` (point d'entrée) |
| `src/game/save.js` | sauvegarde automatique (`localStorage`, clé `kage.save.v1`) |
| `src/game/shop.js` | boutique du marchand : coquille d'interface (catégories vides, répliques) |
| `src/engine/input.js` | clavier |
| `src/engine/touch.js` | commandes tactiles dessinées dans le canvas (constantes `STICK`) |
| `src/engine/sprites.js` | chargement, recoloration par palette, lecteur d'animation |
| `src/engine/fx.js` | particules (poussière, étincelles), secousse, micro-arrêt |
| `src/engine/sfx.js` | sons synthétisés (Web Audio, aucun fichier) |
| `tools/kage_forge/` | **forge des sprites** : `palette.py`, `core.py`, `rig.py`, `art.py` (toutes les poses), `build.py` (export + contrôles), `preview.py` |
| `tools/kage_forge/enemies/` | TATE : `tate.py` (poses), `build_tate.py` (export jeu), `tate_board.py` (planche de design) ; WARA : `wara.py`, `build_wara.py`, `wara_board.py` |
| `tools/standalone.mjs` | fabrique la version en un seul fichier HTML |
| `tests/e2e.cjs` | 52 tests de bout en bout (Playwright) : terrain d'essai (`#terrain`), tactile, niveau 1 (`#niveau-1`), Potager (sans ancre) |
| `assets/characters/kage/`, `tate/`, `wara/` | sprites **générés** (ne jamais éditer à la main) |
| `docs/kage/README.md`, `docs/enemies/README.md` | documentation détaillée du personnage et des ennemis, planches et GIF |
| `docs/MONDE.md`, `tools/monde_carte.py` | plan du monde (7 chapitres) et carte schématique `docs/monde/carte_du_monde.png` |
| `.github/workflows/deploy.yml` | mise en ligne sur GitHub Pages à chaque push sur `main` |

## 4. Le personnage KAGE

### Design (décisions de l'utilisateur)
- Ninja noir, minimaliste, agile ; pixel art net, cellule **48×32** (le personnage occupe 32 colonnes, les 16 de droite servent au sabre), ancrage **(16, 31)** sous les pieds, orientation droite et retournement pour la gauche.
- **Visage et mains visibles** : bande de peau autour des yeux (yeux sombres) et mains couleur peau, demandés d'après une image de référence.
- **Pas de capuche pointue** (« chapeau de lutin » refusé) : capuche arrondie, **bandeau de foulard au front noué en papillon derrière la tête**, les deux pans (un long, un court, de longueur fixe) partent de ce nœud.
- **Garde basse** : jambe avant fléchie (genou devant la cheville), jambe arrière presque tendue, poing lointain levé. La version d'avant donnait des jambes tendues et cambrées.
- Palette unique « Encre » (`skins/encre.json`). Le système de palette par « slots » reste en place, mais **les skins sont mis de côté** (les exemples Cendre et Minuit ont été supprimés).

### Animations (20)
idle 4 · run 6 · sprint 6 · walk 4 · jump 4 · fall 3 · land 3 · dash 5 · attack 7 · kick 5 · throw 5 · hurt 2 · wall_slide 2 · wall_jump 2 · air_attack 6 · air_throw 4 · skid 2 · slide 3 · death 6 · respawn 3.
- **Coup de pied** : coup de pied de côté de karaté (yoko geri kekomi), d'après des images fournies par l'utilisateur : genou armé, hanche qui pivote, buste qui part en arrière, jambe tendue talon en avant à hauteur de poitrine, poings en garde. **Pied fléchi, orteils vers le haut** (pied `flex` dans `rig.py`), jambe raccourcie à la demande de l'utilisateur. **L'effort se voit** : yeux plissés au retrait, retour en garde tassé, bouffée d'expiration, goutte de sueur et bruit de souffle. Buste `back` dans `rig.py`.
- **Marche** (à bout de souffle) : tête basse, yeux plissés, bras ballants, petits pas, foulard qui pend.
- **Sprint** : buste plongé, corps bas, **bras tendus à l'horizontale vers l'arrière** (façon Naruto ; à l'origine, les bras remontaient trop).
- **Sabre au sol** : légère fente, demi-cercle devant (haut, avant, bas), lame longue et large (2 px), bras à demi tendu qui suit la lame.
- **Sabre en l'air** : **à deux mains**, lame levée au-dessus de la tête (bras derrière la tête pour garder le visage visible), temps d'arrêt, puis abattue devant en plongeant. Plus spectaculaire et plus de dégâts.
- **Glissade** : sur la hanche, façon ninja (refaite à la demande de l'utilisateur ; l'ancienne pose ressemblait à un grand écart). Buste incliné en arrière, fesses et hanche au sol, jambe avant pliée (genou relevé, main posée dessus), jambe arrière tendue devant, main d'appui au sol derrière, foulard à l'horizontale. Corps d'environ 26 px de long (ni trop allongé, ni trop ramassé). Tête sous la ligne 16 pour passer le tunnel. Buste `recline` dans `rig.py`.
- **Shuriken** : armé derrière la tête, **bras entièrement tendu au lâcher**.
- Le **dash vertical a été supprimé** à la demande de l'utilisateur.
- Méthode : chaque frame est posée à la main via le rig (articulations placées image par image). Mort et réapparition sont calculées à partir du sprite (découpe en blocs).

### Commandes
| Action | Clavier | Tactile |
|---|---|---|
| Courir | ← → | joystick flottant (moitié gauche de l'écran) |
| Sprint | **Maj** + flèche (Ctrl abandonné à cause des raccourcis du navigateur) | **pousser le joystick au-delà de son cercle** : au bord, un « mur » invisible résiste (le pouce suit deux fois moins vite) ; dès que le pouce sort du cercle de 4 px, KAGE sprinte et le contour devient vert ; il revient à la course quand le pouce rentre (sous 2 px). Réglages `STICK.wall`, `maxOut`, `sprintOut`, `sprintBack` dans `touch.js`. Le bouton de sprint a été supprimé |
| Dash | **double appui** rapide ← ← / → → | coup de joystick **très rapide, court, puis relâché** (le retour au centre sans lâcher ne compte pas) |
| Saut / saut mural | Espace | bouton rond (le plus gros, flèche) |
| Glissade | ↓ ou C | joystick vers le bas |
| Sabre | J ou X | bouton rond, icône de sabre |
| Shuriken | K ou V | bouton rond, icône du shuriken (même dessin que le sprite, sans contour, grisée) |
| Coup de pied | U ou Z | bouton rond à gauche du sabre, icône d'un ninja en coup de pied |
| Zones de collision / son | H / M | bouton « Son » en haut à droite |

### Valeurs de réglage (actuelles)
- **Vitesses** : course 96 px/s (baissée de 20 %), sprint 140, saut 315 (relâcher tôt = saut plus court), gravité 980, freinage au sol 1800 et **en l'air 450** (pour garder l'élan pendant le double appui du dash).
- **Dash** : 290 px/s, environ 57 px, 0,25 s ; un seul dash en l'air par saut.
- **Glissade** : 190 px/s, 0,36 s, vitesse minimale sous un plafond bas ; possible à l'arrêt en poussant une direction.
- **Saut mural** : glissade à 50 px/s maximum, poussée de 150 px/s, impulsion de 300 ; on peut rebondir d'un mur à l'autre mais **pas deux fois de suite sur le même mur**. Coûte 10 % d'énergie.
- **Dérapage** au demi-tour en pleine course (ou dans les 0,12 s qui suivent).
- **Énergie** (anneau en haut à gauche) : toutes les dépenses ont été réduites à 85 % (mêmes proportions) : course −3,4 %/s, sprint −13,6 %/s, dash −28 %, saut −8,5 %, sabre −10,2 %, **coup de pied −12,75 %** (un peu plus que le sabre), shuriken gratuit. Recharge +55 %/s à l'arrêt (après 0,35 s). Tolérance de 15 % du coût, pour pouvoir **enchaîner exactement 3 dashs**. À zéro : **à bout de souffle, KAGE ne peut plus que marcher** (34 px/s, nouvelle animation) et l'énergie remonte en marchant à 60 % de la vitesse à l'arrêt, jusqu'à 40 % ; sprint, dash, sabre et coup de pied sont refusés pendant ce temps. Le saut reste toujours possible.
- **Coup de pied** : **2 dégâts**, repousse l'ennemi (170 px/s, même TATE qui pare de face, même WARA pendant son moulinet). **Le recul peut l'envoyer dans le vide** : il tombe et, sur des pics ou hors du niveau, il est vaincu ; s'il retombe sur un sol plus bas, il reprend le combat. En marchant, les ennemis évitent toujours le vide d'eux-mêmes (`src/game/fall.js`) ; 0,35 s d'attente après le coup avant de pouvoir en relancer un ; portée équivalente au sabre.
- **Vie** : 5 points ; barre **fine (1 px), verte, continue, au-dessus de la tête**, de longueur 3 px par point de vie ; le vert descend en douceur et la portion perdue s'efface. Touché : recul, 0,3 s sans contrôle, 1 s d'invincibilité.
- **Dégâts subis** : charge de TATE 2, moulinet de WARA 1, pics 1 (puis retour au dernier sol sûr), chute hors du niveau = mort. **Dégâts infligés** : sabre 2, **sabre en l'air 3**, shuriken 1, coup de pied 2 (avec recul, jusque dans le vide). Ces valeurs sont **provisoires**, l'utilisateur pourra les changer.
- **Shuriken** : stock de **3** (affiché à côté de l'énergie), vitesse 260 px/s, touche un sol plat à **10 carreaux**, 0,35 s entre deux lancers. Il se **plante** dans les murs et le sol (au sol : deux inclinaisons tirées au hasard), puis se **ramasse** en passant dessus (après 0,3 s). Sorti du niveau, il revient dans le stock.
- **Joystick (dash)** : 85 % de la course en moins de 0,08 s, puis relâcher en moins de 0,15 s, geste horizontal.

## 5. L'ennemi TATE

- **Garde de temple au grand bouclier** : chapeau conique laqué à liseré rouge, masque de fer aux yeux ambrés, armure rouge sourd, vêtements indigo, jambes courtes (pas lourd), **talisman de papier dans le dos** (cordon de paille en bandoulière, papier qui ondule, **halo** qui pulse quand le dos est exposé).
- **Taille** : agrandi à la demande de l'utilisateur (+5 px de haut, +2 px de large par rapport au dessin d'origine) en doublant des lignes et des colonnes du dessin (`GROW_ROWS`, `GROW_COLS` dans `tate.py`) : le jeu n'accepte qu'une mise à l'échelle entière.
- **Comportement** : marche à 18 px/s, demi-tour lent (0,7 s), bloque tout de face (étincelles), corps solide sauf en glissade (on passe entre ses jambes), **charge au bouclier** après un élan de 0,45 s, étourdi 1,4 s s'il rate sa charge, 5 points de vie (3 coups de sabre), frappé seulement dans le dos.
- **Mort lourde en 4 temps** : un genou à terre (long), bascule, impact avec poussière, au sol, puis fondu.
- Ne traverse pas les murs et ne s'avance pas au-dessus du vide.

## 5 bis. L'ennemi WARA

- **Épouvantail du dojo**, mignon et un peu ridicule, d'après un modèle fourni par l'utilisateur. Il a un grand chapeau de paille à pointe pliée et une tête en toile de sac : deux points pour les yeux, un sourire, et une bouche cousue en zigzag quand il se fâche. Ses bras sont une traverse de bois (raccourcie à la demande de l'utilisateur), il porte une robe de paille allongée et se tient sur un long pieu. La paille est d'un beige sec, **pas doré**. **Pas d'œil-cible** : une première version avec un grand œil unique a été jugée trop inquiétante.
- **Comportement** : il sautille sur son pieu vers KAGE (repère à 120 px, bonds de 20 px). À 30 px, son **chapeau saute** (signal de 0,45 s), puis sa **traverse tourne en hélice** pendant 0,5 s et touche **des deux côtés** (1 dégât) : on ne le prend pas à revers, c'est l'inverse de TATE. Pendant le moulinet, la traverse pare le sabre. Ensuite, il a le **tournis** 0,9 s (chapeau sur les yeux, étoiles) : c'est le moment de frapper. Son corps n'est pas solide.
- **Taille** : réduit à la demande de l'utilisateur (-4 px de haut, -2 px de large) en retirant des lignes et des colonnes du dessin (`SHRINK_ROWS`, `SHRINK_COLS` dans `wara.py`), le pieu restant sur son ancrage.
- **Vie** : 2 points. Un coup de sabre suffit ; un shuriken le fait passer **abîmé** (paille qui sort, chapeau déchiré), et il devient alors plus vif. Tout coup interrompt son bond ou son signal.
- **Mort** : tranché, « pouf » de paille, il retombe en tas avec la tête et le chapeau dessus, et le talisman s'envole ; puis fondu.
- **Planches** : `docs/enemies/wara_*.png`, `wara_animations.gif`, `wara_en_jeu.gif`.

## 6. Le Niveau 1 et le terrain d'essai

- **Niveau 1** (`#niveau-1` ; il était ouvert par défaut avant le Potager ; 170×22 carreaux, carte dans `maps.js`) : TATE, fosse, **tunnel bas** (glissade obligatoire), **fossé de 5** (sprint ou dash), deux TATE, **fossé de 8** (sprint + saut + dash obligatoires), **puits** (sauts muraux jusqu'à une passerelle), **gong** à atteindre au shuriken (ouvre la porte), arène (coup aérien en se laissant tomber derrière TATE), bande de pics, dernier TATE, **torii** d'arrivée. **5 WARA** : un groupe de deux au début, deux après la première lanterne, un avant le fossé de 8. 3 lanternes de sauvegarde, chronomètre en chiffres pixel (en haut au centre), écran de fin (temps, chutes, « Rejouer »).
- **Terrain d'essai** (`#terrain`) : long sol plat à la demande de l'utilisateur, plus un puits et un mur isolé pour le saut mural, un TATE et un WARA.
- Les tests vérifient que chaque passage du niveau 1 est faisable et demande la bonne mécanique.

## 6 bis. Chapitre 1 — Le Potager (greybox jouable)

- **Ouvert par défaut** (adresse sans `#`), avec un **écran titre** : « Nouvelle partie » ou « Continuer ». Une seule carte continue de 522×22 carreaux, en **8 zones** : chemin des premières pousses (avancer, sauter, sprinter ; épouvantail au grand chapeau), cultures en terrasse (premier dash ; cache derrière la cascade d'irrigation), canaux d'irrigation (roue à eau ; saut, dash, sprint), vieux verger (premiers WARA, coup de pied), serre de bambou (trois passages en glissade, puis un enchaînement de sortie), grange abandonnée (caisses à briser au sabre), jardin des sentinelles (bassin aux carpes, pont rouge rompu, bosquet en glissade, un TATE, grande porte), comptoir du voyageur (marchand, puis la route vers les collines et la sortie).
- **Mesures de saut** (sol plat) : course 3,8 cases, sprint 5,5, course + dash 7,0 ; hauteur 3,1 cases. D'où des trous de **6 cases** pour le dash (5 s'il faut monter), **5** pour le sprint, et des passages bas d'**une case** (KAGE debout fait 22 px, en glissade 14 px).
- **Aides contextuelles** : une seule commande affichée à la fois, au moment où elle sert ; elle disparaît dès qu'elle est utilisée (ou après 9 s). Textes ordinateur et tactile dans `HINTS` (`main.js`).
- **Sauvegarde** : 3 lanternes (entrée du verger, sortie de la grange, jardin des sentinelles) enregistrent le point de reprise et affichent « Sauvegardé ». Les ryō ramassés et les caisses brisées sont enregistrés aussitôt.
- **Ryō** : pièces à ramasser (51 dans la carte, plus une par caisse), compteur sous les shurikens.
- **Marchand** : « ↑ / E : parler » devant son comptoir ouvre la boutique (le jeu se met en pause) ; catégories Apparences, Ressources, Objets, encore vides. Dessin **provisoire** en attendant sa planche de design.
- **Le décor est peint** (voir § 6 quater). Restent provisoires : le marchand (en attendant sa planche) et le petit nuisible (joué par des WARA).
- Les tests vérifient : chaque trou franchissable, le premier dash et le sprint réellement nécessaires, chaque passage bas uniquement en glissade, les caisses, les ryō, la sauvegarde et « Continuer », la boutique et la sortie.
- **Provisoires en jeu** : le « petit nuisible » voleur de légumes du verger est pour l'instant joué par des **WARA** ; l'épouvantail de la zone 1 est un WARA immobile qui se balance (décor) ; le marchand est un petit dessin codé (tenue indigo, ceinture orange, barbe blanche, grand chapeau, il compte ses pièces).

### Ce que le script de l'utilisateur (LDD du Potager) demande encore
L'utilisateur a fourni un script détaillé du chapitre (8 zones continues, environ 20 minutes). Ce qui est fait : les 8 zones et leur enchaînement de mécaniques, les aides contextuelles, les 3 sauvegardes automatiques avec icône, le marchand avec interaction et boutique vide (sans économie, comme demandé), la parallaxe de montagnes « début d'une grande aventure », les collines et rizières visibles à la fin. Ce qui reste :
- **Planches de design** (avant toute intégration) : le **marchand** (vieux, coloré, grand chapeau, gros sac), le **petit nuisible** (petites créatures qui volent les légumes, zone 4), les **décors et tuiles** de chaque zone (épouvantail au grand chapeau, cascade d'irrigation, roue à eau, verger, serre de bambou sous la pluie, grange sombre, jardin des sentinelles avec bassin aux carpes, pont rouge rompu et grande porte en bois, comptoir du voyageur).
- **Ambiance** : animations d'ambiance (oiseaux, feuilles, eau, pluie dans la serre, lucioles…), **sons d'ambiance et musique** par zone.
- **Intérieur sombre de la grange** (éclairage), **pluie** plus marquée dans la serre.

## 6 quater. Refonte visuelle du Potager (novembre 2026)

Demande de l'utilisateur : un Potager « riche et paisible », au niveau des jeux de référence en pixel art (Owlboy), avec des initiatives pour enrichir le décor. Ce qui a été fait :
- **Cadrage** : 448×252 (d'abord 480×270, puis très léger rezoom demandé : KAGE paraissait un poil trop petit). Le sol est bas dans l'image (86 %), le paysage occupe le haut. Sur téléphone, même cadrage (~252 px de haut) ; les commandes tactiles restent à leur taille validée (calque séparé).
- **Caméra posée, stable** (retour de l'utilisateur : le décor bougeait tout le temps, de façon désordonnée, quand KAGE montait ou descendait — « pas pro ») : en hauteur, des **paliers** (rien ne bouge pour une marche, un saut ou un petit relief ; au-delà de 3,5 cases de différence de sol, un seul recadrage franc et fluide de ~0,6 s) ; en largeur, zone morte et rattrapage amorti ; position **arrondie au pixel une seule fois** pour tout le dessin (avant, chaque plan et chaque sprite arrondissait de son côté : décalages d'un pixel en désordre). Réglages `CAM` dans `main.js`.
- **Défilement latéral fluide** (retour de l'utilisateur : les montagnes « tremblaient » en avançant) : le paysage est peint sur un calque à part, à la résolution réelle de l'écran, avec la position exacte de la caméra. Avant, les montagnes sautaient de 4 pixels d'écran d'un coup environ 3 fois par seconde ; maintenant elles glissent d'un pixel d'écran à la fois. Le terrain et les personnages restent en pixels de jeu nets.
- Mesure : course avec sauts dans la zone 1, 0 recadrage vertical ; dans les terrasses de la zone 2, 2. GIF : `docs/potager/camera_paliers.gif`.
- **Fond en parallaxe** (`potager/backdrop.js`), du plus loin au plus proche : ciel tramé et grands cumulus en relief ; la **grande chaîne enneigée** (trois rangs de sommets qui se chevauchent, arêtes, ravines, neige qui descend dans les couloirs, brume au pied), dominée par le **Mont Kagero**, sur l'épaule duquel on devine le **dojo final** et son sentier en lacets (« le début d'une grande aventure ») ; vols d'oiseaux ; mer de nuages ; **montagnes moyennes** boisées avec **aiguilles à falaises**, pins accrochés et cascades ; contreforts boisés, champs, temple et torii ; **village** (maisons au toit de chaume, pagode à cinq étages, cerisiers, fumées qui montent) ; lisière (grands arbres, cerisiers, bambous) ; **rizières en terrasses** qui apparaissent à l'approche de la sortie ; **premier plan sombre** (herbes, fougères, grandes feuilles) qui défile plus vite que le jeu.
- **Terrain** (`potager/tiles.js`) : d'après des références fournies par l'utilisateur. **Terre** : de la terre meuble (grain fin, peu contrasté, quelques gravillons) mêlée au hasard de **grosses mottes** (environ une cellule sur trois, cellules de Voronoï de 8,5 px, contour doux, arête claire en haut à gauche) ; brun un peu sec, moins chaud qu'avant mais plus chaud que la pierre, peu de nuances pour ne pas fatiguer l'œil ; flancs de terre **légèrement ondulés** (±1,5 px, jamais de coupe droite). **Murets de pierre sèche** : grosses pierres grises aux joints sombres, mousse, et silhouette qui suit les pierres (elles dépassent ou se creusent de 1 à 4 px). **Limite muret / terre** naturelle (`materialOf`) : chaque pierre tire un petit décalage au hasard, les dernières pierres s'enfoncent dans la terre, de la terre remonte entre elles, et quelques pierres à demi enterrées parsèment la terre sous le muret. Collisions inchangées (`earthPixel`, `stonePixel`, `paintOverhangs`) ; **tapis d'herbe épais** avec coulures en pointe, brins en touffes, herbe qui déborde des angles et coule sur les flancs ; brun chaud et orangé ; murets de pierre sèche moussus pour les terrasses ; pierre taillée pour les marches du jardin ; racines enchevêtrées sous la serre ; poutres de la grange ; étagère de bocaux ; grosse branche dans le verger ; bambou ligaturé ; bosquet de bambous ; berges de pierre et eau des canaux.
- **Décors** (`potager/props.js`, placés dans `chapters/potager.js`) : ferme au toit de chaume et tas de bois, panneau d'entrée, Jizō, épouvantails en vieux kimono, légumes feuillus (carottes, radis, navets, choux, poireaux), clôture de bambou, puits, charrette, séchoir à radis, paniers, butte en terrasses d'où tombe la cascade (bec de bambou), moulin à eau, roseaux et iris, lanternes de pierre, arbres fruitiers tortueux et voûte de branches du verger, échelle, serre (toiles déchirées, arceaux, lianes, étagères de graines, plantes suspendues, outils, treillis), grange (grand toit de chaume, mur de planches, contrefiches, outils suspendus, toiles d'araignée, meules, sacs), sanctuaire et torii, renards de pierre, pin taillé, azalées, bosquets, pas japonais, banc, pont rouge rompu, grande porte, échoppe du marchand (ombrelle rouge, auvent indigo, enseigne, marchandises), poteau indicateur. Plus des décors automatiques : buissons, fougères, roseaux et pousses de bambou derrière le chemin, poteaux sous les plateformes de bois, fleurs sauvages.
- **Ce qui bouge** (`potager/live.js`) : roue à eau (derrière la berge, elle plonge dans le canal), eau du bief, cascade et écume, reflets et nénuphars, poissons qui sautent, tonneaux qui flottent, **kappa pêcheur** qui plonge quand KAGE approche, koïs, fumées, pluie sur la serre et gouttes qui tombent par les déchirures, rais de lumière, pénombre de la grange avec halos de lanternes et poussières, lanternes et clochette de l'échoppe, papillons, pétales, feuilles, libellules, poussières dorées. Les lanternes de sauvegarde sont des lanternes de papier sur poteau.
- **Performances** : tout est peint une fois (~0,8 s au chargement), le terrain par tranches de 512 px peintes à la demande ; 60 images/s.
- Planche des 8 zones : `docs/potager/potager_zones.png` ; course : `docs/potager/potager_course.gif`.
- Tests ajoutés : cadrage 448×252 et sol en bas de l'image, stabilité (une marche ne bouge pas la caméra, un vrai changement de niveau la recadre d'un seul mouvement), caméra immobile pendant un saut, zone morte.

## 6 ter. Historique des grandes étapes (toutes fusionnées dans `main`)

1. **PR #1** : KAGE (forge des sprites, 18 animations d'origine), TATE, niveau 1, terrain d'essai, tactile.
2. **PR #2** : WARA (planches, plusieurs itérations de design : plus mignon, sans œil, couleur paille, moins large, chapeau recentré), TATE agrandi à 5 PV, WARA réduit, glissade refaite sur la hanche.
3. Mise en ligne GitHub Pages (workflow) et version mobile plein écran (même cadrage que l'ordinateur, rotation en portrait).
4. **Coup de pied** (yoko geri, 2 dégâts, recul jusque dans le vide), **marche à bout de souffle**, énergie à 85 %.
5. **Sprint tactile au joystick** (PR #8), bouton de sprint supprimé.
6. **Chapitre 1, le Potager**, en greybox jouable (PR #9).
7. **Plan du monde** avec les réponses de l'utilisateur (PR #3).
8. **Refonte visuelle du Potager** : cadrage 448×252, caméra posée à paliers, décor peint et animé (§ 6 quater).

## 7. Effets et sons

- **Poussière** : saut, atterrissage, dash, sprint, dérapage, glissade, murs, shuriken planté, pas et chute de TATE. **Étincelles**, **micro-arrêt de l'image** sur les coups, **secousses** de l'écran.
- **Sons synthétisés** (Web Audio, aucun fichier) pour toutes les actions, plus gong, porte, lanterne et arrivée. Ils ont été réglés « à l'aveugle » : **à faire valider à l'oreille**. Des fichiers audio fournis par l'utilisateur pourront les remplacer.

## 8. Préférences et façon de travailler de l'utilisateur

- Il itère par petites retouches visuelles très précises (« un poil », « très légèrement ») : appliquer exactement la retouche demandée, montrer le résultat (capture ou GIF), puis republier l'artefact.
- Il veut des éléments **discrets et lisibles** à l'écran (HUD, barres de vie), et un rendu « vrai jeu indé », pas générique.
- Pour les nouveaux personnages ou ennemis : **présenter une planche de design avant toute intégration en jeu**.
- Après chaque modification : `npm test`, commit en français, push sur la branche, republication de `dist/kage-standalone.html` sur l'artefact, puis un résumé clair.
- Il teste lui-même sur téléphone (le tactile est validé).
- **Il autorise Claude à fusionner les PR et à mettre en ligne lui-même** via GitHub (« dis-moi si quelque chose bloque »). Après une fusion : vérifier que le workflow « Mise en ligne (GitHub Pages) » a réussi. Le réseau de l'environnement Claude bloque `raphgh31.github.io` : on ne peut pas ouvrir le site en ligne d'ici, mais `dist/kage-standalone.html` est le même jeu (le tester avec Playwright).
- Il préfère qu'on lui présente les choix importants (ordre des chapitres, mécaniques) avant de coder, et qu'on avance par phases : greybox jouable, puis planches de design, puis art définitif.

## 9. Ce qui reste à faire (pistes discutées)

- **Prochaine étape conseillée** : la **planche de design du marchand** (direction choisie par l'utilisateur : le **sage voyageur** — vieil homme droit, chapeau conique très large, kimono rapiécé de tissus de toutes les couleurs, barbe longue, bâton de marche, sac en bandoulière), puis celle du **petit nuisible** qui vole les légumes. Ensuite : sons d'ambiance et musique par zone (oiseaux, eau, moulin, pluie, grange feutrée, clochettes), retouches du décor selon les retours de l'utilisateur.
- Questions encore ouvertes du plan du monde (`docs/MONDE.md`, § 10) : durée visée, histoire des talismans, détail des paliers d'expérience.
- Régler WARA en jouant (vitesse des bonds, durée du signal, du tournis).
- **Autres ennemis proposés** (non commencés) : Kunoichi de l'ombre (Kage-mane, lance des kunaïs), Lanterne volante (Chōchin, à vaincre au shuriken), Corbeau messager (Karasu, obstacle rapide), Sumo de pierre (Ishi, mini-boss avec onde de choc).
- Valider les sons, ajuster si besoin ; rééquilibrer vie et dégâts en jouant.
- Plus tard : skins, manette (écartée pour l'instant), vues de face et de dos dans la garde basse, musique.
