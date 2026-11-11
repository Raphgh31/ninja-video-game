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
| 9 | L'antre de la statue oubliée | 70 | Calme. On **grimpe aux lianes** de sa chevelure pour **rallumer la lanterne de chaque œil** ; les deux yeux allumés, **la mâchoire de pierre s'abaisse** sous nos yeux : la suite passe **par sa bouche** | **lianes à grimper**, mécanisme de la statue, caméra cadrée sur la statue entière | 1 · coffre dans la couronne de feuillage, tout en haut |
| 10 | Le souffle des lianes | 120 | **Lianes qui se balancent** au-dessus d'un ravin : on les attrape au vol, on prend de l'élan, on lâche ; d'abord une, puis des chaînes de 2 et 3, puis le final : **lâcher + dash au sommet de la courbe** pour atteindre une corniche | **lianes balancier** (nouvel état de KAGE, nouvelles animations) | 3 (début, milieu, avant le final) · corniche haute accessible seulement par un dash parfait |
| 11 | La descente vertigineuse | 150 | Fuite : un **éboulis de pierres moussues** dévale derrière KAGE. Pente en gradins : sprint, grands sauts, dashs par-dessus les brèches, une glissade sous un tronc couché | **éboulis poursuivant** (vitesse réglée sur le sprint, toujours visible et entendu avant d'être dangereux) | 2 (en haut, à mi-pente : l'éboulis repart de là) · ryō en l'air sur les trajectoires idéales |
| 12 | La lisière crépusculaire | 70 | Calme et récompense : derniers ryō, un dernier coffre, la lanterne finale, la sortie | fin de chapitre | 1 · coffre au pied du dernier grand arbre |

### Les mécaniques, précisément

- **Zone 4 — effondrement.** 14 travées de 5 cases. Le déclencheur est invisible, 2 travées après le début. Chaque colonne tombe **0,55 s après la précédente** (≈ 145 px/s : plus vite que la course à 96, à peine plus que le sprint à 140, d'où la nécessité de sauter loin et de dasher). Avant de tomber, une travée s'annonce 0,5 s : poussière, fissure, les dalles basculent vers l'arrière. KAGE pris dedans tombe dans le ravin et reprend à la lanterne posée juste avant le déclencheur ; le pont est alors **relevé** (comme les plateformes du corbeau). Trois brèches dans le pont : un saut, un sprint, un dash.
- **Zone 5 — bois vermoulu.** Une planche qui craque dès qu'on s'y pose, cède après 0,7 s, repousse 2,5 s plus tard.
- **Zone 6 — troncs flottants.** Ils dérivent lentement avec le courant (aller-retour entre deux rochers) ; chargés, ils s'enfoncent à ~14 px/s et sont submergés en ~1,6 s ; libérés, ils remontent. L'eau du torrent coûte 1 vie et ramène au dernier sol sûr, comme l'eau du Potager.
- **Zone 9 — la statue.** Les lianes de la statue ne se balancent pas : on s'y accroche et on **monte ou descend** (↑ / ↓, joystick). Chaque œil abrite une petite lanterne de pierre éteinte, qui s'allume au passage de KAGE (même geste que les lanternes de sauvegarde : aucune commande nouvelle). Deux yeux allumés : lueur turquoise dans les orbites, grondement, poussière de mousse, puis la mâchoire descend lentement (~4 s, comme les vantaux du temple), **toujours à l'écran** puisque la caméra cadre toute la statue. L'état est sauvegardé.
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
- **La statue** (zone 9), au plus près du modèle : visage monumental de pierre grise, front large, orbites sombres, nez droit, bouche en caverne ; coiffée et drapée de feuillage, de lianes et de mousse ; encadrée de deux piles de maçonnerie ; baignée d'une lumière venue d'en haut. ~13 cases de haut : elle tient entière dans l'image.
- **Règles du chapitre 1 appliquées d'emblée** : rien ne flotte (chaque branche tient à un tronc, chaque liane à une branche visible, y compris sur écran haut), le lointain passe toujours derrière le jouable, pas de coupe droite, bas des feuillages des passages bas peint 6 px au-dessus de la case.

## 4. Son

- **Musique** : la vidéo fournie (2 min 51 s) est préparée avec `tools/musique_boucle.py` (introduction puis boucle sans couture), champ `music` du chapitre.
- **Ambiance** (nouveau, synthétisée comme tous les bruitages, en stéréo, très discrète) : vent dans les feuilles, craquements de bois, gouttes sur la pierre (ruines, souterrain, statue), oiseaux lointains ; le mélange change selon la zone.
- **Bruitages** : effondrement, bois qui craque, tronc qui s'enfonce, liane (saisie, grincement, lâcher), lanternes des yeux, mâchoire de pierre, éboulis.

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
- **canopée** : un grand **pont suspendu** entre les deux grands troncs (à la place des branches 18 et 27 : `F.bridges`, `bridge_tree`) ; douze vieilles planches moussues qui suivent sa courbe, ploient sous KAGE et oscillent quand il atterrit (`FOREST.bridge`, `deckY`), trois planches pourries qui lâchent si on s'y attarde puis repoussent ; deux mains courantes de corde (celle de devant passe devant KAGE), suspentes, cordes porteuses, mousse ; au sol, **de l'eau entre les îlots** des lianes et des remontées (on ne traverse plus par en bas) ; une chute de trop haut dans l'eau est mortelle ;
- **arbre creux** : l'intérieur sombre descend jusqu'au fond du boyau (on ne voit plus le décor à travers), entrée en dégradé tramé ;
- **caverne aux perles** (zone 8, refaite) : plus profonde (`souterrain` = 46) ; après le cinquième palier du boyau, une chute de 10 cases dans la grande salle ; 166 cases au lieu de 98 : racines de chêne énormes (au plafond : glissade ; au sol : saut ; `oak_root`), galerie en contrebas, mare (dash), **clairière** haute de 15 cases avec une petite eau et le **grand arbre aux perles** au bord, salle aux papillons, puits de racines (10 cases de sauts muraux), couloir de sortie en bouche de caverne ; arbres à perles lumineuses (`pearl_tree`, perles qui scintillent dans `live.js`), papillons lumineux ; roche bleu-vert qui redevient terre vers la sortie, pénombre qui se lève peu à peu et lumière du jour qui entre (`dark.fade`) ;
- zone 10 : sur une liane qui se balance, sauter revient à lâcher (`hop` = 0 : un lâcher à l'extrême atteignait la corniche sans dash).

## 9. Reste à faire

1. **Retours de l'utilisateur** sur cette première version (zone par zone, en jouant la version de test).
2. Ennemis et boss du chapitre (des respirations sont prévues pour les accueillir), marchand de la Forêt (clairière de la zone 12).
3. Pistes de finition : feuillages de la canopée (aujourd'hui en plateaux, façon pins japonais), arrière du pavillon du temple plus proche de la vraie porte, intérieur du couloir sous l'éboulis de la statue.
