# KAGE — document de reprise

Ce fichier résume tout le travail fait jusqu'ici (personnage, mécaniques, ennemi, niveau, outils) avec les décisions prises et leurs raisons. Il sert à reprendre le projet dans une nouvelle discussion sans rien perdre.

> **Pour reprendre** : ouvrir une nouvelle session Claude Code sur ce dépôt (branche `claude/kage-ninja-character`, ou `main` une fois la PR fusionnée) et écrire :
> « Lis `docs/REPRISE.md` et `CLAUDE.md`, puis on continue le jeu KAGE. »

---

## 1. Où en est le projet

- **Dépôt** : `raphgh31/ninja-video-game`. La PR #1 (KAGE, TATE, niveau 1) est **fusionnée** dans `main`. L'ennemi WARA est sur la branche **`claude/wara-design`**, dans la **PR #2** (brouillon) : <https://github.com/Raphgh31/ninja-video-game/pull/2>.
- **Site du jeu (public)** : <https://raphgh31.github.io/ninja-video-game/>, mis en ligne par GitHub Actions (`.github/workflows/deploy.yml`) à chaque push sur `main`.
- **Direction du jeu** : l'utilisateur a choisi un **monde unique** très long, avec sauvegarde, zones et chapitres de plus en plus exigeants et des améliorations de KAGE (plutôt que des niveaux séparés), parce que c'est ce qui fera l'originalité du jeu. Le plan reste à écrire.
- **Version de test** (page privée claude.ai) : <https://claude.ai/artifact/Cjj8EJCrABmuHzWypJC2cm>. Elle se met à jour en republiant `dist/kage-standalone.html` (identifiant de l'artefact : `5f0bb94d-1fa1-48d5-b9b9-f829586682e6`).
- **Contenu actuel** : le personnage KAGE complet (18 animations), les ennemis TATE et WARA, un mini **Niveau 1** qui demande toutes les mécaniques, un terrain d'essai, une version mobile en plein écran (même cadrage que sur ordinateur ; en portrait le jeu pivote pour se jouer en tournant le téléphone vers la gauche), des sons synthétisés, des effets visuels et 31 tests automatiques.
- **Langue de travail** : français, dans les réponses comme dans le code (commentaires, documentation, messages de commit).

## 2. Commandes

```bash
npm install
npm run dev          # jeu en local (http://localhost:5173) ; ajouter #terrain pour le terrain d'essai
npm run sprites      # régénère tous les sprites (KAGE + TATE + WARA) avec contrôles qualité
npm run build        # version de production dans dist/
npm run standalone   # dist/kage-standalone.html : jeu complet en un seul fichier
npm test             # build + version autonome + 31 tests de bout en bout dans Chromium
```

Avant de pousser : `npm run sprites` puis `npm test` sans échec, et vérifier dans un navigateur (ordinateur, tactile paysage ~844×390 et portrait ~390×844).

## 3. Carte des fichiers

| Chemin | Rôle |
|---|---|
| `src/main.js` | boucle à pas fixe 120 Hz, mise à l'échelle, caméra, branchement des événements (sons, poussière), HUD, arrivée |
| `src/game/player.js` | KAGE : physique et machine d'états (constantes `P` en tête) |
| `src/game/energy.js` | énergie (constantes `ENERGY`), anneau en haut à gauche |
| `src/game/combat.js` | vie de KAGE et dégâts (`HEALTH`, `DAMAGE_TAKEN`, `DAMAGE_DEALT`) |
| `src/game/healthbar.js` | barres de vie fines au-dessus des personnages |
| `src/game/shuriken.js` | shurikens : stock, vol, plantés, ramassage (constantes `SHURIKEN`) |
| `src/game/tate.js` | ennemi TATE (constantes `TATE`) |
| `src/game/wara.js` | ennemi WARA (constantes `WARA`) |
| `src/game/level.js` | niveau : tuiles, gong, porte, lanternes, torii, décor |
| `src/game/maps.js` | cartes ASCII (terrain d'essai, niveau 1), légende en tête |
| `src/engine/input.js` | clavier |
| `src/engine/touch.js` | commandes tactiles dessinées dans le canvas (constantes `STICK`) |
| `src/engine/sprites.js` | chargement, recoloration par palette, lecteur d'animation |
| `src/engine/fx.js` | particules (poussière, étincelles), secousse, micro-arrêt |
| `src/engine/sfx.js` | sons synthétisés (Web Audio, aucun fichier) |
| `tools/kage_forge/` | **forge des sprites** : `palette.py`, `core.py`, `rig.py`, `art.py` (toutes les poses), `build.py` (export + contrôles), `preview.py` |
| `tools/kage_forge/enemies/` | TATE : `tate.py` (poses), `build_tate.py` (export jeu), `tate_board.py` (planche de design) ; WARA : `wara.py`, `build_wara.py`, `wara_board.py` |
| `tools/standalone.mjs` | fabrique la version en un seul fichier HTML |
| `tests/e2e.cjs` | tests de bout en bout (Playwright) |
| `assets/characters/kage/`, `assets/characters/tate/` | sprites **générés** (ne jamais éditer à la main) |
| `docs/kage/README.md`, `docs/enemies/README.md` | documentation détaillée du personnage et de l'ennemi, planches et GIF |

## 4. Le personnage KAGE

### Design (décisions de l'utilisateur)
- Ninja noir, minimaliste, agile ; pixel art net, cellule **48×32** (le personnage occupe 32 colonnes, les 16 de droite servent au sabre), ancrage **(16, 31)** sous les pieds, orientation droite et retournement pour la gauche.
- **Visage et mains visibles** : bande de peau autour des yeux (yeux sombres) et mains couleur peau, demandés d'après une image de référence.
- **Pas de capuche pointue** (« chapeau de lutin » refusé) : capuche arrondie, **bandeau de foulard au front noué en papillon derrière la tête**, les deux pans (un long, un court, de longueur fixe) partent de ce nœud.
- **Garde basse** : jambe avant fléchie (genou devant la cheville), jambe arrière presque tendue, poing lointain levé. La version d'avant donnait des jambes tendues et cambrées.
- Palette unique « Encre » (`skins/encre.json`). Le système de palette par « slots » reste en place, mais **les skins sont mis de côté** (les exemples Cendre et Minuit ont été supprimés).

### Animations (18)
idle 4 · run 6 · sprint 6 · jump 4 · fall 3 · land 3 · dash 5 · attack 7 · throw 5 · hurt 2 · wall_slide 2 · wall_jump 2 · air_attack 6 · air_throw 4 · skid 2 · slide 3 · death 6 · respawn 3.
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
| Sprint | **Maj** + flèche (Ctrl abandonné à cause des raccourcis du navigateur) | petit **interrupteur** rond à droite, avec la silhouette du ninja en sprint ; se coupe à l'arrêt ou à vide |
| Dash | **double appui** rapide ← ← / → → | coup de joystick **très rapide, court, puis relâché** (le retour au centre sans lâcher ne compte pas) |
| Saut / saut mural | Espace | bouton rond (le plus gros, flèche) |
| Glissade | ↓ ou C | joystick vers le bas |
| Sabre | J ou X | bouton rond, icône de sabre |
| Shuriken | K ou V | bouton rond, icône du shuriken (même dessin que le sprite, sans contour, grisée) |
| Zones de collision / son | H / M | bouton « Son » en haut à droite |

### Valeurs de réglage (actuelles)
- **Vitesses** : course 96 px/s (baissée de 20 %), sprint 140, saut 315 (relâcher tôt = saut plus court), gravité 980, freinage au sol 1800 et **en l'air 450** (pour garder l'élan pendant le double appui du dash).
- **Dash** : 290 px/s, environ 57 px, 0,25 s ; un seul dash en l'air par saut.
- **Glissade** : 190 px/s, 0,36 s, vitesse minimale sous un plafond bas ; possible à l'arrêt en poussant une direction.
- **Saut mural** : glissade à 50 px/s maximum, poussée de 150 px/s, impulsion de 300 ; on peut rebondir d'un mur à l'autre mais **pas deux fois de suite sur le même mur**. Coûte 10 % d'énergie.
- **Dérapage** au demi-tour en pleine course (ou dans les 0,12 s qui suivent).
- **Énergie** (anneau en haut à gauche) : course −4 %/s, sprint −16 %/s, recharge +55 %/s à l'arrêt (après 0,35 s), dash −1/3, saut −10 %, sabre −12 %, shuriken gratuit. Tolérance de 15 % du coût, pour pouvoir **enchaîner exactement 3 dashs**. À zéro : essoufflé (course à 65 %) jusqu'à 40 %. Le saut reste toujours possible.
- **Vie** : 5 points ; barre **fine (1 px), verte, continue, au-dessus de la tête**, de longueur 3 px par point de vie ; le vert descend en douceur et la portion perdue s'efface. Touché : recul, 0,3 s sans contrôle, 1 s d'invincibilité.
- **Dégâts subis** : charge de TATE 2, moulinet de WARA 1, pics 1 (puis retour au dernier sol sûr), chute hors du niveau = mort. **Dégâts infligés** : sabre 2, **sabre en l'air 3**, shuriken 1. Ces valeurs sont **provisoires**, l'utilisateur pourra les changer.
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

- **Niveau 1** (ouvert par défaut ; 170×22 carreaux, carte dans `maps.js`) : TATE, fosse, **tunnel bas** (glissade obligatoire), **fossé de 5** (sprint ou dash), deux TATE, **fossé de 8** (sprint + saut + dash obligatoires), **puits** (sauts muraux jusqu'à une passerelle), **gong** à atteindre au shuriken (ouvre la porte), arène (coup aérien en se laissant tomber derrière TATE), bande de pics, dernier TATE, **torii** d'arrivée. **5 WARA** : un groupe de deux au début, deux après la première lanterne, un avant le fossé de 8. 3 lanternes de sauvegarde, chronomètre en chiffres pixel (en haut au centre), écran de fin (temps, chutes, « Rejouer »).
- **Terrain d'essai** (`#terrain`) : long sol plat à la demande de l'utilisateur, plus un puits et un mur isolé pour le saut mural, un TATE et un WARA.
- Les tests vérifient que chaque passage du niveau 1 est faisable et demande la bonne mécanique.

## 7. Effets et sons

- **Poussière** : saut, atterrissage, dash, sprint, dérapage, glissade, murs, shuriken planté, pas et chute de TATE. **Étincelles**, **micro-arrêt de l'image** sur les coups, **secousses** de l'écran.
- **Sons synthétisés** (Web Audio, aucun fichier) pour toutes les actions, plus gong, porte, lanterne et arrivée. Ils ont été réglés « à l'aveugle » : **à faire valider à l'oreille**. Des fichiers audio fournis par l'utilisateur pourront les remplacer.

## 8. Préférences et façon de travailler de l'utilisateur

- Il itère par petites retouches visuelles très précises (« un poil », « très légèrement ») : appliquer exactement la retouche demandée, montrer le résultat (capture ou GIF), puis republier l'artefact.
- Il veut des éléments **discrets et lisibles** à l'écran (HUD, barres de vie), et un rendu « vrai jeu indé », pas générique.
- Pour les nouveaux personnages ou ennemis : **présenter une planche de design avant toute intégration en jeu**.
- Après chaque modification : `npm test`, commit en français, push sur la branche, republication de `dist/kage-standalone.html` sur l'artefact, puis un résumé clair.
- Il teste lui-même sur téléphone (le tactile est validé).

## 9. Ce qui reste à faire (pistes discutées)

- **Relire et fusionner la PR #2 (WARA).** Régler WARA en jouant (vitesse des bonds, durée du signal, du tournis).
- **Autres ennemis proposés** (non commencés) : Kunoichi de l'ombre (Kage-mane, lance des kunaïs), Lanterne volante (Chōchin, à vaincre au shuriken), Corbeau messager (Karasu, obstacle rapide), Sumo de pierre (Ishi, mini-boss avec onde de choc).
- Valider les sons, ajuster si besoin ; rééquilibrer vie et dégâts en jouant.
- Plus tard : skins, manette (écartée pour l'instant), vues de face et de dos dans la garde basse, musique.
