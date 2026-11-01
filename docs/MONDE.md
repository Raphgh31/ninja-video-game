# KAGE — le monde (plan de conception)

> **Statut : proposition à valider.** Rien de ce plan n'est encore codé (le coup de pied, la marche et l'énergie, déjà faits, sont à part). Les noms, l'ordre des zones, la monnaie et le marchand sont des propositions ; les décisions déjà prises et les questions ouvertes sont regroupées à la fin.

![Carte schématique du monde](monde/carte_du_monde.png)

---

## 1. Le principe

- **Un seul monde continu**, parcouru d'ouest en est (et parfois vers le haut), sans menu de niveaux : on passe d'une zone à l'autre en marchant. C'est le choix de l'utilisateur, et ce qui fera l'originalité de KAGE.
- **Le rythme reste celui d'un jeu de plateforme rapide et exigeant** (esprit Geometry Dash, Celeste) : le monde est avant tout un **long parcours vers l'avant**, pas un labyrinthe qu'on explore lentement. On avance, ça accélère, ça se corse.
- **Une touche d'exploration** : à côté du chemin principal, des passages secondaires plus difficiles mènent à des secrets, à des raccourcis et à des pièces de monnaie. **Ce n'est jamais obligatoire pour finir le jeu.**
- **Aucune mécanique ne se débloque** (décision de l'utilisateur) : KAGE a **toutes ses capacités dès le début**. Ce qui change au fil du monde, c'est le terrain, les ennemis et l'exigence, pas le kit du joueur.
- **Les lanternes** (déjà en jeu) deviennent le cœur du système : point de retour après une chute **et** sauvegarde automatique.

## 2. L'histoire (en fond, jamais envahissante)

Les **talismans** déjà présents (sur TATE, sur WARA) deviennent le fil rouge : quelqu'un pose des talismans maudits qui réveillent les gardiens, les mannequins et les objets du pays. KAGE remonte la piste, zone après zone, jusqu'au temple de pierre où se trouve le **talisman maître**. À la fin de chaque zone, l'épreuve finale libère la zone (petite scène sans texte : les talismans s'envolent, comme à la mort de WARA).

Pas de dialogues longs : quelques panneaux, des images, des sons. L'histoire se lit dans le décor.

## 3. Les cinq zones

| # | Zone | Ambiance | Ennemis | Ce qu'on y apprend | Épreuve finale | Marchand |
|---|---|---|---|---|---|---|
| 1 | **Le dojo et son potager** | jour, bois clair, paille | WARA, TATE | toutes les bases (le niveau 1 actuel en est le noyau) | le grand gong du dojo, défendu par des TATE | oui, à la sortie du dojo |
| 2 | **La forêt de bambous** | brume, verts sourds, hauteur | Kage-mane (kunaïs) | bambous qui plient, hauteurs, se battre à distance | duel contre la cheffe Kage-mane | oui, dans une clairière |
| 3 | **Le village la nuit** | toits, lanternes, obscurité | Chōchin (lanternes volantes) | lumière et obscurité, courses sur les toits | la grande lanterne au-dessus du marché | oui, au marché de nuit |
| 4 | **La montagne** | vent, neige, glace | Karasu (corbeaux) | vent qui pousse, glace qui glisse, ascension verticale | l'ascension dans la tempête | oui, dans un refuge |
| 5 | **Le temple de pierre** | pierre, mousse, or terni | Ishi (sumo de pierre) et tous les autres | tout, combiné | **Ishi**, puis le talisman maître | oui, devant le temple (dernière visite) |

Chaque zone compte **4 à 6 « passages »** (une idée de gameplay chacun, d'environ 1 à 3 écrans), séparés par des lanternes, puis l'épreuve finale. Pour une première partie, compter environ **15 à 25 minutes par zone**, soit **1 h 30 à 2 h** au total (davantage pour tout trouver).

## 4. Comment la difficulté monte

- **Un passage = une idée.** Le passage la présente sans danger, puis avec un peu de pression ; le passage suivant la combine avec une idée plus ancienne.
- **L'épreuve finale d'une zone** demande tout ce que la zone a appris, sans lanterne au milieu (ou une seule).
- **La zone suivante** suppose que l'on maîtrise la précédente : la marge d'erreur se réduit (plateformes plus étroites, ennemis plus nombreux, moins de lanternes).
- **Des chemins de défi facultatifs**, plus durs, mènent aux secrets : les joueurs qui veulent plus de difficulté la trouvent là, sans bloquer les autres.

## 5. Monnaie, marchand et skins

**KAGE a toutes ses capacités dès le départ** (course, sprint, marche à bout de souffle, saut, saut mural, dash, glissade, sabre, coup aérien, coup de pied, shuriken). La progression ne passe pas par de nouvelles capacités, mais par **l'apparence** et la **collection**.

**La monnaie : les ryō** (petites pièces d'or percées, à proposer en planche de design)
- **Où les trouver** : posées sur le chemin, en plus grand nombre sur les chemins de défi et dans les secrets ; quelques-unes lâchées par les ennemis vaincus ; une bourse à chaque épreuve finale.
- **Affichage** : un compteur discret à côté du stock de shurikens, qui n'apparaît qu'au ramassage (comme l'anneau d'énergie).
- **Elles se gardent** : on ne les perd pas en tombant ; elles sont enregistrées avec la partie.

**Le marchand** (personnage à concevoir en planche de design, comme les ennemis)
- Un **marchand ambulant** que l'on retrouve **à plusieurs endroits du monde, à différents moments**, au moins une fois par zone, souvent juste après une lanterne. Il voyage plus vite que KAGE, on le croise au détour du chemin, et il a toujours un petit mot.
- Il vend des **skins de ninja** (tenues de KAGE) et des **skins d'armes** (sabre, shuriken), **à plusieurs prix**.
- **Son stock change selon la zone** : de nouveaux articles apparaissent au fil du voyage. Les anciens restent en vente, pour qu'on ne rate jamais rien définitivement.

**Les skins**
- **Tenue de KAGE** : une palette de couleurs différente sur la même silhouette. Le système de palette par « slots » existe déjà (`skins/encre.json`) : un skin de tenue ne touche jamais au dessin, seulement aux couleurs.
- **Armes** : un nouveau dessin ou de nouvelles couleurs pour la lame et le shuriken, sans changer leur portée ni leurs dégâts. **Les skins sont purement visuels.**
- **Fourchettes de prix** (à régler en jouant) : articles simples à environ 50 ryō, articles rares de 150 à 300 ryō, un ou deux articles de prestige très chers pour ceux qui fouillent tout.
- **Garde-robe** : on choisit sa tenue et ses armes à n'importe quelle lanterne, ou dans le menu pause.

**Autres trouvailles** (à confirmer) : des **parchemins** à collectionner (un dessin et quelques lignes d'histoire chacun).

## 6. La sauvegarde

- **Automatique** à chaque lanterne allumée : la dernière lanterne, les ryō, les skins achetés et équipés, les parchemins, les secrets trouvés, le temps de jeu total et le nombre de chutes.
- **Écran titre** : *Continuer* / *Nouvelle partie*. Trois emplacements de sauvegarde.
- **Au chargement**, KAGE repart de la dernière lanterne ; les ennemis de la zone reviennent (comme aujourd'hui quand on tombe).
- **Enregistrée dans le navigateur** (`localStorage`), avec un numéro de version pour pouvoir faire évoluer le format. Si le navigateur refuse d'enregistrer, le jeu fonctionne quand même (sans sauvegarde) et le signale discrètement.
- **Le chronomètre reste** : temps total de la partie, affiché à l'écran de fin, pour ceux qui veulent battre leur record.

## 7. Comment ce sera construit (technique)

- **Le monde est un assemblage de « salles »** décrites en cartes ASCII, comme `maps.js` aujourd'hui, une suite de fichiers par zone (`src/game/world/dojo.js`, etc.). Chaque salle est posée à une position dans une grande grille du monde.
- **Seule la zone courante (et ses voisines) est active** : mises à jour, ennemis et dessin, pour que le jeu reste fluide sur téléphone même avec un très grand monde. Les ennemis ne bougent que près de la caméra.
- **Passage d'une zone à l'autre** : un court fondu, le nom de la zone qui s'affiche en lettres pixel, la musique ou l'ambiance qui change.
- **Chaque zone a son décor** : jeu de tuiles, fond en parallaxe, palette. Comme pour les personnages, **planche de design d'abord**, puis intégration.
- **Tests** : comme aujourd'hui pour le niveau 1, chaque passage a son test de faisabilité. On vérifie aussi que chaque passage du chemin principal se franchit **avec les seules capacités disponibles à ce moment-là** (sinon le jeu pourrait bloquer).
- **Plus tard** : une carte du monde dans le menu pause (zones visitées et secrets trouvés) et l'installation du jeu sur le téléphone, comme une appli.

## 8. Ordre de construction proposé

1. **Le socle du monde** : écran titre, sauvegarde, système de salles et de zones, transitions, menu pause. Le niveau 1 actuel devient la première salle du dojo.
2. **Zone 1 complète** : planche du décor du dojo et du potager, passages, épreuve du gong. **Monnaie (ryō) et premier passage du marchand**, avec ses planches de design et un premier lot de skins.
3. **Zone 2**, avec Kage-mane : planche de design d'abord, comme pour WARA. Puis les zones 3, 4 et 5, chacune avec son ennemi, son passage du marchand et de nouveaux skins.
4. **En parallèle, au fil de l'eau** : sons validés à l'oreille, musique par zone, réglages de difficulté en jouant.

Chaque étape est mise en ligne sur le site dès qu'elle est fusionnée.

## 9. Décisions prises

- **Un monde unique** plutôt que des niveaux.
- **Aucune mécanique à débloquer** : toutes les capacités de KAGE sont actives dès le début.
- **Un marchand ambulant** croisé à plusieurs endroits et à plusieurs moments, qui vend des skins de ninja et d'armes à plusieurs prix, payés avec une **monnaie récoltée** en jouant.
- **Le coup de pied, la marche à bout de souffle et l'énergie à 85 %** sont faits et en ligne.

## 10. Questions ouvertes

1. **Les retours en arrière** : libres à tout moment, ou seulement par des raccourcis qui s'ouvrent ?
2. **Les zones et leur ordre** : te conviennent-ils ? Une zone à ajouter, retirer ou échanger ?
3. **La monnaie** : le nom « ryō » et les pièces d'or percées te vont-ils ?
4. **Les vies et l'énergie** : faut-il des trouvailles qui augmentent la vie ou l'énergie maximales (ce serait une progression, sans être une nouvelle mécanique), ou tout reste fixe ?
5. **La durée visée** : environ 2 h pour une première partie, ça te va ?
6. **L'histoire des talismans** : la garder comme fil rouge ?
