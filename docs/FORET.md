# Chapitre 2 — La Forêt (plan)

> **Statut (11 novembre 2026)** : **première version complète** (greybox, peinture, son, raccord, tests) — voir § 8. Historique : plan validé (phase 1) ; **planches d'ambiance et de la statue soumises** (phase 2 : `docs/foret/planche_ambiance.png`, `docs/foret/planche_statue.png`, régénérées par `node tools/foret_planche.mjs ambiance|statue <sortie.png>` avec le vrai code du décor : `src/game/foret/palette.js`, `layers.js`, `statue.js`). Planche des animations de liane de KAGE soumise aussi (`docs/foret/planche_kage_liane.png`, `python3 tools/kage_forge/vine_board.py <sortie.png>` ; poses dans `tools/kage_forge/vine.py`, pas encore dans `ANIMS` : à intégrer après accord). Réponses de l'utilisateur : passage du chapitre 1 au 2 par un fondu soigné et un peu long avec le titre du chapitre (le chapitre 1 était l'initiation, « le jeu commence ») ; horizon du chapitre 3 volontairement flou pour l'instant. Pas d'ennemis ni de boss pour l'instant (demande de l'utilisateur) : des respirations sont prévues pour les accueillir plus tard.

## 1. En bref

- **12 zones** sur une seule carte continue, environ **1 150 cases de long** (le Potager en fait 702) et **~60 cases de haut** (le Potager : 22), parce que le chapitre monte et descend vraiment : ascension dans les pins, canopée, souterrain, grande descente. Environ **30 à 35 minutes** pour une première partie.
- **Le voyage** : matin doré à la lisière → sous-bois profond bleu-vert → ruines → cime des arbres → sous terre → la statue → lianes → descente au soleil couchant → lisière au crépuscule. L'heure avance avec les zones.
- **Une idée par zone**, présentée sans danger puis sous pression, puis combinée avec les précédentes.
- **Lanternes** : une au début de chaque zone, plus une avant chaque passage difficile (17 prévues).
- **Aucun chargement** entre les zones : tout est peint une fois, le terrain par tranches à la demande, comme le Potager.

## 2. Les 12 zones

Profil : `1-2-3` au niveau du sol · `4` pont de ruines au-dessus d'un ravin · `5` on monte (≈ 28 cases) · `6` plateau du torrent · `7` cime des arbres (filet de rattrapage dessous) · `8` on redescend par un arbre creux, sous terre · `9` cirque de la statue · `10` ravin des lianes · `11` grande pente (≈ 35 cases de dénivelé) · `12` lisière.

| # | Zone | Longueur | L'idée de jeu | Nouveauté technique | Lanternes · secrets |
|---|---|---|---|---|---|
| 1 | La lisière ensoleillée | 80 | Marcher, sauter sur des rochers moussus et des souches ; rien de dangereux. KAGE sort de l'arrière de la porte du temple | — | 1 · ryō sur les souches hautes |
| 2 | Le sentier des fougères ancestrales | 90 | Racines géantes qui barrent le chemin : **saut mural obligatoire** entre deux troncs pour passer par-dessus (une fois simple, une fois plus haut) | **rideau de lierre** qui se tranche au sabre (cache) | 1 · ryō dans les creux d'écorce (en hauteur, saut mural), une cache derrière le lierre |
| 3 | La clairière aux eaux miroirs | 85 | Mares trop larges pour un saut : **dash en l'air obligatoire** (6 cases), puis deux à la suite avec un îlot | eau miroir (reflet du décor) | 1 · ryō sur un îlot à l'écart (saut + dash précis) |
| 4 | L'allée des piliers effondrés | 95 | Un pont de dalles sur des colonnes, au-dessus d'un ravin. Passé le déclencheur, **les colonnes s'affaissent une à une derrière KAGE** : sprint, sauts et un dash par-dessus une brèche | **effondrement en chaîne** (minuteur strict, annoncé : poussière, fissure, grondement) | 2 (début, juste avant le déclencheur) · un ryō par travée pour tracer la course |
| 5 | L'ascension des conifères | 60 (× 28 de haut) | On grimpe : **sauts muraux alternés** entre troncs serrés, avec de petits paliers de **bois vermoulu** qui cèdent après un instant | **plateforme qui cède** (craque, tombe, repousse) | 2 (bas, mi-hauteur) · ryō dans une cheminée latérale plus dure |
| 6 | Le torrent du bois ancien | 100 | **Troncs flottants** qui dérivent et **s'enfoncent sous le poids** de KAGE : sauter de tronc en tronc en rythme, dash pour les plus espacés ; rochers fixes pour souffler | **plateformes mobiles qui coulent** | 2 (rive, rocher du milieu) · ryō sur un tronc à contre-courant |
| 7 | La canopée suspendue | 110 | De branche en branche, tout en haut : **écarts mesurés au plus juste** (saut seul, sprint, dash, saut + dash). Une chute ne tue pas : on tombe sur le **sous-bois de rattrapage** et on remonte par un tronc | filet de rattrapage (remontées) | 2 · nid caché au-dessus du chemin (coffre) |
| 8 | Le souterrain des racines | 110 | Plafonds bas : **glissades**, dash sous les racines, courts sprints entre deux passages, un puits de racines en sauts muraux. Pénombre, champignons qui s'allument à l'approche | pénombre et halos (comme la grange) | 2 · alcôve de champignons (ryō) derrière un rideau de radicelles |
| 9 | L'antre de la statue oubliée | 70 | Calme. On **grimpe aux lianes** de sa chevelure pour **rallumer la lanterne de chaque œil** ; les deux yeux allumés, **la dalle d'une porte de pierre remonte** dans le pilier voisin : la suite passe **par le petit tunnel** | **lianes à grimper**, mécanisme de la statue, caméra cadrée sur la statue entière | 1 · coffre dans la couronne de feuillage, tout en haut |
| 10 | Le souffle des lianes | 120 | **Lianes qui se balancent** au-dessus d'un ravin : on les attrape au vol, on prend de l'élan, on lâche ; d'abord une, puis des chaînes de 2 et 3, puis le final : **lâcher + dash au sommet de la courbe** pour atteindre une corniche | **lianes balancier** (nouvel état de KAGE, nouvelles animations) | 3 (début, milieu, avant le final) · corniche haute accessible seulement par un dash parfait |
| 11 | La descente vertigineuse | 150 | Fuite : un **éboulis de pierres moussues** dévale derrière KAGE. Pente en gradins : sprint, grands sauts, dashs par-dessus les brèches, une glissade sous un tronc couché | **éboulis poursuivant** (vitesse réglée sur le sprint, toujours visible et entendu avant d'être dangereux) | 2 (en haut, à mi-pente : l'éboulis repart de là) · ryō en l'air sur les trajectoires idéales |
| 12 | La lisière crépusculaire | 70 | Calme et récompense : derniers ryō, un dernier coffre, la lanterne finale, la sortie | fin de chapitre | 1 · coffre au pied du dernier grand arbre |

### Les mécaniques, précisément

- **Zone 4 — effondrement.** 14 travées de 5 cases. Le déclencheur est invisible, 2 travées après le début. Chaque colonne tombe **0,55 s après la précédente** (≈ 145 px/s : plus vite que la course à 96, à peine plus que le sprint à 140, d'où la nécessité de sauter loin et de dasher). Avant de tomber, une travée s'annonce 0,5 s : poussière, fissure, les dalles basculent vers l'arrière. KAGE pris dedans tombe dans le ravin et reprend à la lanterne posée juste avant le déclencheur ; le pont est alors **relevé** (comme les plateformes du corbeau). Trois brèches dans le pont : un saut, un sprint, un dash.
- **Zone 5 — bois vermoulu.** Une planche qui craque dès qu'on s'y pose, cède après 0,7 s, repousse 2,5 s plus tard.
- **Zone 6 — troncs flottants.** Ils dérivent lentement avec le courant (aller-retour entre deux rochers) ; chargés, ils s'enfoncent à ~14 px/s et sont submergés en ~1,6 s ; libérés, ils remontent. L'eau du torrent coûte 1 vie et ramène au dernier sol sûr, comme l'eau du Potager.
- **Zone 9 — la statue.** Les lianes de la statue ne se balancent pas : on s'y accroche et on **monte ou descend** (↑ / ↓, joystick). Chaque œil abrite une petite lanterne de pierre éteinte, qui s'allume au passage de KAGE (même geste que les lanternes de sauvegarde : aucune commande nouvelle). Deux yeux allumés : la lumière filtre sous ses paupières baissées, les yeux gravés du linteau s'allument aussi, grondement, puis la dalle de la porte remonte lentement dans le mur (2,8 s) et découvre le tunnel. L'état est sauvegardé.
- **Zone 10 — lianes balancier.** Vraie physique de pendule. **On s'accroche tout seul** en touchant une liane en l'air, **tant qu'une direction est tenue** (flèche ou joystick touché) ; gauche / droite donnent de l'élan dans le sens du balancement ; **dès qu'on lâche tout, KAGE lâche la liane** et part avec la vitesse du balancier. Le dash en l'air reste disponible après le lâcher (c'est le final). Le bouton de saut permet aussi de quitter une liane d'un petit bond (indispensable sur les lianes immobiles de la statue). Les lianes ont un léger balancement propre, toutes au même rythme (le « vent magique »), pour qu'on puisse les lire. La zone 9 les présente sans danger, la zone 10 les met au-dessus du vide.
- **Zone 11 — éboulis.** Un front de pierres qui avance à vitesse réglée (un peu sous le sprint dans les lignes droites, il rattrape si on hésite), précédé de petits cailloux et d'un grondement. Touché : retour à la lanterne, l'éboulis repart d'en haut.
- **Toutes zones** : les pics n'existent pas dans la forêt ; les dangers sont l'eau, le vide, l'effondrement et l'éboulis.

## 3. Direction artistique

D'après les deux images de référence (bandes de forêt ; tête de pierre géante).

- **Palette** : verts émeraude `#1b4d3e` `#2e8b57` et mousses vives ; bruns `#3d2314` et écorce rousse ; pierre `#5c6f7b` ; turquoise pour l'eau et les lueurs ; jaune doré pour les rais. Tramage discret dans les ombres portées et les transitions de lumière. Lumière à gauche, comme partout.
- **Cinq plans** :
  0. ciel dégradé (du matin au crépuscule selon la zone), montagnes lointaines, cimes de conifères ;
  1. nappes de brume animées en boucle lente, poussières et lucioles dans les rais ;
  2. grands troncs massifs en arrière-plan (plusieurs profondeurs, bleuis par la brume), lianes pendantes, nuées d'oiseaux qui s'envolent à l'approche de KAGE ;
  3. le monde jouable ;
  4. premier plan : fougères et herbes sombres aux contours adoucis, ombres de feuillage qui filent.
- **Trois lumières** qui se fondent d'une zone à l'autre : matin doré (1-3), sous-bois profond bleu-vert (4-10), couchant (11-12) ; plus deux cas à part : le ciel ouvert de la canopée (7) et la pénombre bioluminescente du souterrain (8).
- **Matières du terrain** : humus et mousse épaisse, rochers moussus, racines, écorce (troncs = murs de saut mural), pierre taillée des ruines envahie de lierre, bois vermoulu, branches de la canopée.
- **La statue** (zone 9, refaite d'après le modèle de Raph, novembre 2026) : une tête de femme monumentale en pierre grise, le visage fin et ovale, la tête penchée vers la gauche, les paupières baissées, le regard mélancolique (sourcils relevés vers le milieu, coins des lèvres qui retombent, une traînée sombre comme une larme) ; son cou et la naissance des épaules, enfouis dans les fougères ; coiffée d'une couronne de feuillage en désordre, de touffes inégales sur les côtés et de lianes de toutes longueurs ; à sa droite, un pilier maçonné et la porte de pierre. ~15 cases de haut : elle tient entière dans l'image.
- **Règles du chapitre 1 appliquées d'emblée** : rien ne flotte (chaque branche tient à un tronc, chaque liane à une branche visible, y compris sur écran haut), le lointain passe toujours derrière le jouable, pas de coupe droite, bas des feuillages des passages bas peint 6 px au-dessus de la case.

## 4. Son

- **Musique** : la vidéo fournie (2 min 51 s) est préparée avec `tools/musique_boucle.py` (introduction puis boucle sans couture), champ `music` du chapitre.
- **Ambiance** (nouveau, synthétisée comme tous les bruitages, en stéréo, très discrète) : vent dans les feuilles, craquements de bois, gouttes sur la pierre (ruines, souterrain, statue), oiseaux lointains ; le mélange change selon la zone.
- **Bruitages** : effondrement, bois qui craque, tronc qui s'enfonce, liane (saisie, grincement, lâcher), lanternes des yeux, porte de pierre, éboulis.

## 5. Décisions prises (sans attendre, à corriger si besoin)

- **Pas de marchand** dans ce chapitre pour l'instant (non demandé) ; la clairière de la zone 12 pourra l'accueillir.
- **Aides contextuelles** : une seule, pour la liane (commande nouvelle). Le reste se lit dans le décor.
- **Sauvegarde** : même clé, même format ; les ryō, les skins et le boss vaincu suivent KAGE ; la progression est retenue par chapitre. Les sauvegardes existantes restent valables.
- **Tests** : une vingtaine, ciblés (un ou deux par zone : le passage est faisable, la mécanique voulue est nécessaire), au lieu d'une batterie exhaustive.
- **Nouvelles animations de KAGE** (accroché, balancé, grimpe, lâcher) : planche de design avant intégration.

## 6. Technique

- `src/game/chapters/builder.js` : le `Builder` sorti de `potager.js` (hauteur de carte variable), partagé par les deux chapitres.
- `src/game/chapters/foret.js` : la carte, zone par zone. Adresse `#foret` pendant le développement.
- `src/game/foret/` : la peinture (`backdrop`, `tiles`, `props`, `world`, `live`, `palette`, `statue`), sur le modèle de `src/game/potager/` ; `paint.js` est réutilisé.
- `src/game/level.js` : nouveaux éléments (travées qui s'effondrent, planches vermoulues, troncs flottants, lianes, statue, éboulis), chacun avec sa remise à zéro à la réapparition.
- `src/game/player.js` : état `vine` (accroché / balancé / grimpe) ; boîtes de collision inchangées.
- Caméra : inchangée (paliers) ; un **cadrage imposé par zone** est ajouté pour la statue (toute la statue dans l'image) et la montée de la zone 5.
- `tools/kage_forge/` : nouvelles poses de KAGE ; `tools/standalone.mjs` : musique embarquée.

## 7. Ordre de travail

1. **Plan** (ce document) — à valider.
2. **Planches** : ambiance (palette, cinq plans, trois lumières, matières), la statue, les animations de liane de KAGE.
3. **Greybox jouable** des 12 zones, avec toutes les mécaniques et les tests.
4. **Peinture**, puis ce qui bouge.
5. **Musique, ambiance, bruitages**, finitions ; raccord avec le chapitre 1.

## 8. État d'avancement (11 novembre 2026, fin de la série)

**Première version complète du chapitre**, sur la branche `claude/message-nouvelle-conversation-docs-t945e2` (non fusionnée, en attente des retours de l'utilisateur). Aperçu des 12 zones : `docs/foret/apercu_zones.png` ; carte de chapitre : `docs/foret/carte_chapitre.png`.

- **Greybox terminé et testé** : `tests/foret.cjs` (22 tests, dans `npm test`) — chaque passage se franchit et la mécanique voulue est nécessaire. Pilotes communs : `tests/foret_pilotes.js` (vol prédit sur les lianes, sauts prédits sur les troncs, souffle sur les rochers) ; sondes : `node tests/foret_sondes.cjs z3 z6b v10 z9 …`.
- **Réglages issus des essais** : lianes de la zone 10 plus longues (18 cases : elles pendent sous le niveau des piliers, on les attrape en les traversant) ; après un lâcher, KAGE **garde l'élan** jusqu'à l'atterrissage tant qu'il ne pousse pas à contre-sens (`player.fling`, léger freinage `flingDrag`) ; le bond (saut) reste franc sur les lianes immobiles de la statue mais n'est plus qu'un coup de reins (`hop`) sur une liane qui se balance ; au lâcher, KAGE est dégagé s'il est dans une paroi. Ravin final : **22 cases, corniche à G9 − 5** (avec le dash, lâcher entre 0,60 et 0,96 rad ; sans dash, aucun des 32 lâchers essayés n'y arrive). Zone 6 : dernier bras de 20 cases (saut de 6 cases depuis le dernier tronc : dash nécessaire).
- **Peinture** (`src/game/foret/`) : `backdrop.js` (fond à six plans par lumière, peints à la demande, fondu enchaîné ; sept lumières `MOODS` ; sol de référence du fond unique, qui descend le long de la grande pente : `bgSlope`, `bgRow`), `world.js` (terrain par tranches de 256 px : mousse, falaises en strates, plafonds à radicelles, ruines, troncs, niches sombres, bords irréguliers), `props.js` (décors peints une fois chacun ; ceux qui dessinent un bloc plein masquent ses tuiles), `live.js` (eau qui reflète le ciel, torrent, pont et colonnes, planches, troncs, lianes, statue et sa joue devant KAGE, éboulis, ombre des ravins, lucioles, oiseaux, pénombre et champignons du souterrain, premier plan), `index.js` (`ForetArt`, une pièce peinte d'avance par image). Chargement ~0,2 s, 60 images/s.
- **Son** : musique tirée de la vidéo de l'utilisateur (`assets/music/foret.mp3` : 12 s d'introduction, boucle de 140 s) ; 18 bruitages synthétisés ; ambiance stéréo par lumière (`ambience` dans `sfx.js`, `FOREST_AMB` dans `main.js`).
- **Raccord** : la porte du temple mène à la Forêt (fondu au noir, carte « Fin de l'initiation — Chapitre 2 — La Forêt — Le voyage commence », champ `intro`) ; la sauvegarde suit KAGE (ryō, skins, corbeau vaincu, temps ; `save.statue`) ; l'adresse sans ancre ouvre le chapitre en cours ; « Nouvelle partie » repart du chapitre 1 ; fin du chapitre 2 : écran de fin (`endText`).
- Caméra : cadrage imposé par la zone (`camGround` de la statue).

### Retours n° 1 de l'utilisateur (11 novembre 2026), appliqués
- son du torrent et de l'eau baissé de 6 dB (clapotis des troncs : −5 dB) ;
- caméra : elle ne descend plus quand KAGE tombe dans l'eau, un ravin ou d'un pont (tout le jeu) ;
- zone 2 : plus de triangle de terre au pied des racines géantes, plus de cavités noires sous les grands troncs (leur pied est un décor : KAGE passe devant ; le tronc sert toujours de mur pour le saut mural) ;
- zone 3 : l'arbre du gué pousse sur la pierre du milieu, sa branche est une case plus bas (3 cases : un saut) ;
- zone 4 : les dalles tombées ne restent plus peintes sur le pont (c'était le terrain qui les dessinait) ;
- **dégâts de chute** dans tout le jeu (au-delà de 10,5 cases : mort) ; la canopée est 4 cases plus haute (G7 = 9) : toute chute jusqu'au sous-bois tue ; des **lianes à grimper** pendent sous cinq branches (↑ puis un bond, ↑ tenu) ; l'arbre creux qui descend sous terre a des paliers en quinconce ;
- canopée : les arbres du fond sont de grands pins à plateaux (comme ceux où KAGE se tient), certains montrent leur cime, de petites lianes pendent ;
- souterrain : roche bleu-vert, mousse turquoise, fougères, spores lumineuses, lianes à perles de lumière, plus de champignons (turquoise et violets) avec leur halo coloré, pénombre moins dense ; au fond, de grands champignons lumineux et des mares qui luisent.

### Retours n° 2 (11 novembre 2026), appliqués
- lueur des champignons de la grotte adoucie ;
- ciel par heure du jour (`SKIES` dans `foret/backdrop.js`, module commun `src/game/sky.js`) : dégradé travaillé, soleil levant au matin, plein ciel à la canopée, soleil couchant, crépuscule et étoiles ; nuages fins teintés par la lumière, cirrus ; halo du soleil sur la forêt lointaine ;
- nuages du Potager refaits de la même façon (plus fins et élégants) ;
- la grande chaîne du chapitre 1 (Mont Kagero et le dojo) se voit toujours au loin, un quart plus grande (on s'en est rapproché), teintée par l'heure (`RANGE`, `RANGE_TINT` ; `paintFar(largeur, 1.25, 0.03)`).

### Retours n° 3 (11 novembre 2026), appliqués
- **canopée** : un grand **pont suspendu** entre les deux grands troncs (à la place des branches 18 et 27 : `F.bridges`, `bridge_tree`) ; de vieilles planches moussues qui suivent sa courbe, ploient sous KAGE et oscillent quand il atterrit (`FOREST.bridge`, `deckY`), trois planches pourries qui lâchent si on s'y attarde puis repoussent ; deux mains courantes de corde (celle de devant passe devant KAGE), suspentes, cordes porteuses, mousse ; au sol, **de l'eau entre les îlots** des lianes et des remontées (on ne traverse plus par en bas) ; une chute de trop haut dans l'eau est mortelle ;
- **canopée, retouche** (11 novembre 2026, demande de Raph : « tous les arbres sur la terre, rien qui dépasse sur l'eau ») : les arbres de la canopée sont posés à la main (`tree(cx, w)` dans `foret.js`, décor `canopy_trunk`) et leurs branches voisines en sortent (`branches()` de `props.js`) ; les îlots de terre sont **calculés depuis les pieds des arbres** (évasement des racines + une case de rive), des remontées et des lianes ; plus de flaque de moins de 3 cases. Les deux troncs du pont sont écartés (17 cases, 16 planches, 4 pourries) : dessous, une eau de 9 cases qu'on ne saute pas ; une autre de 9 cases après la deuxième remontée. Les grandes frondes du premier plan (`drawFore`, `live.js`) ne sont plus dessinées au-dessus de l'eau, et les herbes y sont découpées.
- **arbre creux** : l'intérieur sombre descend jusqu'au fond du boyau (on ne voit plus le décor à travers), entrée en dégradé tramé ;
- **caverne aux perles** (zone 8, refaite) : plus profonde (`souterrain` = 46) ; après le cinquième palier du boyau, une chute de 10 cases dans la grande salle ; 166 cases au lieu de 98 : racines de chêne énormes (au plafond : glissade ; au sol : saut ; `oak_root`), galerie en contrebas, mare (dash), **clairière** haute de 15 cases avec une petite eau et le **grand arbre aux perles** au bord, salle aux papillons, puits de racines (10 cases de sauts muraux), couloir de sortie en bouche de caverne ; arbres à perles lumineuses (`pearl_tree`, perles qui scintillent dans `live.js`), papillons lumineux ; roche bleu-vert qui redevient terre vers la sortie, pénombre qui se lève peu à peu et lumière du jour qui entre (`dark.fade`) ;
- zone 10 : sur une liane qui se balance, sauter revient à lâcher (`hop` = 0 : un lâcher à l'extrême atteignait la corniche sans dash).

### Retours n° 4 (11 novembre 2026), appliqués
- **pont suspendu** : une planche pourrie qui a lâché **ne revient jamais**, même après une réapparition (état `gone` dans `mechanics.js`) ; elle laisse un trou d'une case qu'on saute ;
- **eaux de la canopée infranchissables** : la portée maximale mesurée (sprint, saut, puis dash au meilleur moment) est d'environ **10,4 cases** ; les deux grandes eaux font maintenant **14 cases** (sous le pont, dont les troncs sont à 21 cases l'un de l'autre, 20 planches, 4 pourries ; et avant le grand arbre du nid, qui porte ses branches par de longs bras jusqu'à 6 cases). Test : `sous le pont, 14 cases d'eau…` ;
- **oasis souterraine** (zone 8) : la clairière passe à 42 cases ; au pied du grand arbre aux perles, un bassin de 13 cases avec un îlot au milieu (deux sauts de 5 cases) et un petit arbre à perles ; eau turquoise qui luit (`F.oasis`), reflets des perles qui scintillent, nénuphars aux fleurs lumineuses (dessinés sur l'eau, `live.js`), roseaux à massettes luisantes (`cave_reeds`) ;
- **eau profonde, sans fond visible** (tout le jeu) : dans la Forêt, le corps de l'eau descend à travers le lit (jusqu'à 14 cases) et devient opaque dès 14 px, puis fonce sans fin ; il passe aussi devant le pied des rochers et des piliers plantés dans l'eau. Dans le Potager, l'eau est déjà peinte opaque et la carte s'arrête dessous : rien à voir au fond ;
- **l'allée des piliers** (zone 4) : derrière et sous les piliers, une vraie gorge peinte (décor `ravine`, `props.js`) : falaise d'en face dans la brume (grandes dalles verticales, strates, coulures), bord moussu d'où pendent racines et lianes, corniches à fougères et buissons, vieilles colonnes cassées qui montent des profondeurs, deux nappes de brume ; l'ombre du ravin ne vient qu'à 7 cases sous le bord.

### Retours n° 5 (11 novembre 2026), appliqués
- **falaise de la gorge** (zone 4) : plus de contraste (fissures franches, arêtes claires, coulures), beaucoup plus de végétation (rideaux de mousse, touffes accrochées à la paroi, corniches deux fois plus nombreuses, lianes), et **plus de trame** : teintes en aplats, profondeur en fondu par paliers fins, brume et ombre du ravin en transparence ;
- **entrée de l'arbre creux** : le dégradé tramé est remplacé par un fondu continu et opaque, du bois encore éclairé vers le noir du boyau (une ligne à la fois, sans grain), qui ne laisse jamais voir le décor à travers.

### Retours n° 6 (11 novembre 2026), appliqués : les galeries de l'ascension
- **la butte** : la falaise de la zone 5 se prolonge en une butte de terre de 38 cases (le torrent et toute la suite sont décalés d'autant) ; en surface, les trois souches en escalier de la lisière (2, 2 puis 3 cases, la plus haute porte des ryō), deux jeunes pins ;
- **les galeries** (`F.galleries`, sous la butte) : on y entre par la niche de la lanterne, à mi-hauteur du puits. Une salle de croisement (champignons) ; **en haut**, un saut au bord du trou mène à une marche, un couloir qui monte, puis la **salle du coffre** (`galerie`, 10 ryō) : un arbre à perles, des champignons, un rai de jour qui tombe d'une fente du plafond ; **en bas**, le sol s'ouvre deux fois, un plafond bas (glissade), une grappe de champignons violets, puis un **fossé sans fond** de 4 cases, avec un cul-de-sac et trois ryō de l'autre côté ;
- **peinture** : un fond de galerie peint (`galleriesBack`, `props.js`) en retrait des murs (ombre sur le pourtour), strates d'argile ocre, lits de cailloux, grosses racines en travers, radicelles dont certaines luisent, spores, la lumière des champignons, de l'arbre et de la lanterne posée en fondu ; rideaux de racines aux entrées (`rootCurtain`) ; les parois prennent la mousse bleu-vert et les spores du souterrain (`world.inGal`) ; une pénombre légère sur les seuls couloirs, éclairée autour de KAGE, de la lanterne, des champignons (qui s'allument à son approche) et de l'arbre (`drawGalleries`, `live.js`) ; le fossé fond au noir ; pas de fougères du premier plan dans les galeries ;
- test : `zone 5 : par la niche de la lanterne, les galeries mènent au coffre…` ; le pilote de l'ascension ne s'engouffre plus dans la galerie (`wallClimb(…, maxCol)`).

### Retours n° 7 (11 novembre 2026), appliqués : coffres, branche qui rompt, grotte
- **ryō des coffres** (tous les coffres, `level.openChest`) : ils ne se posent plus qu'au-dessus d'un sol (terre, planche ou branche), sans mur entre eux et le coffre, sur deux rangées, les plus proches d'abord ; s'il manque de place, le coffre en donne moins (nid : 7 au lieu de 12). Test : `coffres : leurs ryō tombent sur un sol…` ;
- **plus de bouton « Ouvrir le coffre »** (tous les coffres, `drawChest` dans `potager/props.js`) : fermé, un reflet doré le balaie de loin en loin ; quand KAGE approche, il tressaute et une lueur dorée pulse derrière lui ; juste devant, il tressaute plus souvent et des étincelles scintillent autour du couvercle. On l'ouvre avec ↑, ou en le touchant du doigt (`touch.onTap` → `tapChest`, KAGE tout près) ;
- **le nid** (zone 7) : à droite du grand tronc, une petite branche puis celle du nid, qui partent vers la droite ; le coffre est posé dessus, entièrement hors du tronc ;
- **la grande branche de l'arbre du nid** (celle où l'on se pose en arrivant) **rompt** au bout de 0,38 s (`F.snaps`, `FOREST.snap`, `drawSnap`) : elle craque et s'affaisse, une fissure s'ouvre à la jointure, elle pivote vers le bas tenue par quelques fibres, puis se détache et tombe en tournant (copeaux, feuilles) ; au tronc reste un moignon aux échardes claires. Elle revient à la réapparition. Test : `la grande branche de l'arbre du nid rompt…` ;
- **grotte** : l'intérieur de l'arbre creux s'arrête au plafond de la caverne (il formait une colonne brune dans la salle) ; la roche sombre se prolonge en profondeur vers l'ouest (`F.dark.deep`) : un écran large ne voit plus de terre claire au bord gauche de la grotte ;
- **entrée de l'arbre creux** : le fond commence sous le haut de la paroi gauche, entre les deux parois (il ne dépasse plus du tronc), avec un rebord cassé d'écorce éclairée.

### Retours n° 8 (11 novembre 2026), appliqués : la statue refaite
- **la statue** (`statue.js`) : plus de mâchoire ni de bouche qui s'ouvre. Une tête de femme, sculptée comme un relief (une hauteur par pixel, éclairée du haut à gauche avec ses ombres portées) : ovale fin, menton étroit, sourcils fins relevés vers le milieu, paupières baissées (la ligne des cils), nez fin, lèvres pleines aux coins qui retombent, pommettes hautes ; la tête penche (`STATUE.tilt`, autour du haut du cou) ; le cou et la naissance des épaules, cachés par des fougères ; feuillage : couronne déchiquetée qui suit l'inclinaison, touffes inégales sur les côtés, 46 lianes de toutes longueurs (aucune ne cache un œil), mousse sur le nez et les joues. Les yeux allumés : la lumière filtre sous les paupières et coule sur les joues ;
- **la porte de pierre** (`stone_gate` dans `props.js`, `drawGate` dans `live.js`) : un pilier maçonné à droite de la tête, un linteau sculpté aux deux yeux clos gravés (ils s'allument avec ceux de la statue), un pilastre, un seuil ; la dalle (deux panneaux, un œil gravé, un anneau) remonte dans le mur en 2,8 s (`FOREST.statue.gateTime`) et découvre le tunnel. L'éboulis mal ordonné a disparu ;
- les lianes et les yeux de la mécanique sont calculés depuis la peinture (`eyeCenter`) ; le pilote de la zone 9 grimpe aux hauteurs des nouveaux yeux.

### Retours n° 9 (11 novembre 2026), appliqués : la statue au plus près du modèle
- proportions : visage plus plein (entre-deux), cou plus court et plus épais, relief et ombres plus marqués (profondeur `KZ` 58, occlusion des creux, ombres portées plus sombres) ;
- la tête penche vers le sol (`PITCH`, `fv`) : le front grandit, les traits descendent ; les yeux sont des orbites profondes sous des arcades lourdes qui y jettent leur ombre, paupières baissées ; les lianes du milieu s'arrêtent sur le front ;
- retouche suivante : la tête penche un peu vers la droite (`STATUE.tilt` 0,1) et moins vers le sol (`PITCH` 0,09) ; traits plus taillés (profils en arête `tri`, volume de base plus plan, mâchoire anguleuse), ombres en aplats nets, moins de lumière, plus de cerne sous les yeux ; feuillage : la couronne n'est plus un chapeau mais huit grappes inégales séparées de trous, les lianes plus éparses et de longueurs très variées (plus longues à droite) ;
- retouche suivante : la tête ne penche presque plus sur le côté (`tilt` 0,03) mais vers l'avant, le front qui plonge vers le sol (`PITCH` 0,22, `fv` : traits plus bas, nez long, bouche proche du nez, menton rentré) ; plus d'ombre noire autour des yeux (orbites peu creusées, pas d'occlusion autour des yeux) ; le feuillage descend sur le front (grappes en plus), qui n'est plus dégarni ;
- dernière retouche avant la mise en ligne : plus de trait sous les yeux, seulement une grande zone d'ombre sous l'arcade, plus sombre (le regard baissé) ; la tête penche davantage vers l'avant (`PITCH` 0,3) et un peu vers la droite (`tilt` 0,07), comme une statue qui commence à s'affaisser ; des fissures sur le cou (`cracks`), du lierre et de la mousse qui y grimpent, de petites fougères au pied ;
- **l'allumage des yeux est retiré du dessin** (demande de Raph : un nouveau mécanisme, sur le haut de la tête, viendra plus tard). En attendant, un déclencheur invisible devant chaque œil ouvre encore la porte.

## 9. Reste à faire

1. **Retours de l'utilisateur** sur cette première version (zone par zone, en jouant la version de test).
2. Ennemis et boss du chapitre (des respirations sont prévues pour les accueillir), marchand de la Forêt (clairière de la zone 12).
3. Pistes de finition : feuillages de la canopée (aujourd'hui en plateaux, façon pins japonais), arrière du pavillon du temple plus proche de la vraie porte, intérieur du couloir sous l'éboulis de la statue.
