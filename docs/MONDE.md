# KAGE — le monde (plan de conception)

> **Statut : proposition à valider.** Rien de ce plan n'est encore codé. Les noms, l'ordre des zones et les améliorations sont des propositions ; les questions ouvertes sont regroupées à la fin.

![Carte schématique du monde](monde/carte_du_monde.png)

---

## 1. Le principe

- **Un seul monde continu**, parcouru d'ouest en est (et parfois vers le haut), sans menu de niveaux : on passe d'une zone à l'autre en marchant. C'est le choix de l'utilisateur, et ce qui fera l'originalité de KAGE.
- **Le rythme reste celui d'un jeu de plateforme rapide et exigeant** (esprit Geometry Dash, Celeste) : le monde est avant tout un **long parcours vers l'avant**, pas un labyrinthe qu'on explore lentement. On avance, ça accélère, ça se corse.
- **Une touche d'exploration** (« metroidvania léger ») : à côté du chemin principal, des passages secondaires mènent à des secrets et à des raccourcis. Certains ne s'ouvrent qu'avec une amélioration obtenue plus loin : on peut revenir les chercher, **mais ce n'est jamais obligatoire pour finir le jeu**.
- **Les lanternes** (déjà en jeu) deviennent le cœur du système : point de retour après une chute **et** sauvegarde automatique.

## 2. L'histoire (en fond, jamais envahissante)

Les **talismans** déjà présents (sur TATE, sur WARA) deviennent le fil rouge : quelqu'un pose des talismans maudits qui réveillent les gardiens, les mannequins et les objets du pays. KAGE remonte la piste, zone après zone, jusqu'au temple de pierre où se trouve le **talisman maître**. À la fin de chaque zone, l'épreuve finale libère la zone (petite scène sans texte : les talismans s'envolent, comme à la mort de WARA).

Pas de dialogues longs : quelques panneaux, des images, des sons. L'histoire se lit dans le décor.

## 3. Les cinq zones

| # | Zone | Ambiance | Ennemis | Ce qu'on y apprend | Épreuve finale | Amélioration gagnée |
|---|---|---|---|---|---|---|
| 1 | **Le dojo et son potager** | jour, bois clair, paille | WARA, TATE | toutes les bases (le niveau 1 actuel en est le noyau) | le grand gong du dojo, défendu par des TATE | **Kaginawa** (grappin) |
| 2 | **La forêt de bambous** | brume, verts sourds, hauteur | Kage-mane (kunaïs) | grappin, bambous qui plient, se battre à distance | duel contre la cheffe Kage-mane | **Saut de l'ombre** (double saut) |
| 3 | **Le village la nuit** | toits, lanternes, obscurité | Chōchin (lanternes volantes) | lumière et obscurité, courses sur les toits | la grande lanterne au-dessus du marché | **Shuriken de braise** (allume, brûle le papier et la paille) |
| 4 | **La montagne** | vent, neige, glace | Karasu (corbeaux) | vent qui pousse, glace qui glisse, ascension verticale | l'ascension dans la tempête | **Dash d'ombre** (traverse les projectiles et certains ennemis) |
| 5 | **Le temple de pierre** | pierre, mousse, or terni | Ishi (sumo de pierre) et tous les autres | tout, combiné | **Ishi**, puis le talisman maître | fin du jeu |

Chaque zone compte **4 à 6 « passages »** (une idée de gameplay chacun, d'environ 1 à 3 écrans), séparés par des lanternes, puis l'épreuve finale. Pour une première partie, compter environ **15 à 25 minutes par zone**, soit **1 h 30 à 2 h** au total (davantage pour tout trouver).

## 4. Comment la difficulté monte

- **Un passage = une idée.** Le passage la présente sans danger, puis avec un peu de pression ; le passage suivant la combine avec une idée plus ancienne.
- **L'épreuve finale d'une zone** demande tout ce que la zone a appris, sans lanterne au milieu (ou une seule).
- **La zone suivante** suppose que l'on maîtrise la précédente : la marge d'erreur se réduit (plateformes plus étroites, ennemis plus nombreux, moins de lanternes).
- **Des chemins de défi facultatifs**, plus durs, mènent aux secrets : les joueurs qui veulent plus de difficulté la trouvent là, sans bloquer les autres.

## 5. Les améliorations de KAGE

**KAGE commence avec tout son kit actuel** : course, sprint, saut, dash, glissade, saut mural, sabre, coup aérien, shuriken. Le niveau 1 actuel apprend déjà tout cela et devient le cœur de la zone 1.

Les améliorations ajoutent des **capacités nouvelles**, une par zone. Chacune ouvre une nouvelle façon de jouer, et des passages secrets dans les zones précédentes :

| Amélioration | Effet | Ce qu'elle ouvre |
|---|---|---|
| Kaginawa (grappin) | s'accrocher à des anneaux de fer et se balancer | grands vides, anneaux cachés dans le dojo |
| Saut de l'ombre (double saut) | un second saut en l'air | rebords trop hauts, raccourcis |
| Shuriken de braise | allume les lanternes éteintes, brûle les portes de papier et les bottes de paille | passages murés de papier, pièces sombres |
| Dash d'ombre | pendant le dash, KAGE traverse les projectiles et les petits ennemis | couloirs de kunaïs, corbeaux en nuée |

S'y ajoutent des **trouvailles cachées**, rangées dans les secrets :
- **Perles de vie** : 3 perles = +1 point de vie (5 au départ, jusqu'à 8).
- **Rouleaux d'énergie** : énergie maximale un peu plus haute.
- **Étui à shurikens** : +1 shuriken de stock (3 au départ, jusqu'à 5).
- **Parchemins** (à collectionner) : un dessin et quelques lignes d'histoire par parchemin.

## 6. La sauvegarde

- **Automatique** à chaque lanterne allumée : la dernière lanterne, les améliorations, les trouvailles, les parchemins, le temps de jeu total et le nombre de chutes.
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
2. **Zone 1 complète** : planche du décor du dojo et du potager, passages, épreuve du gong, puis l'amélioration *Kaginawa* (planche, animations de KAGE, intégration).
3. **Zone 2**, avec Kage-mane : planche de design d'abord, comme pour WARA. Puis les zones 3, 4 et 5, chacune avec son ennemi et son amélioration.
4. **En parallèle, au fil de l'eau** : sons validés à l'oreille, musique par zone, réglages de difficulté en jouant.

Chaque étape est mise en ligne sur le site dès qu'elle est fusionnée.

## 9. Questions ouvertes

1. **Le kit de départ** : KAGE commence-t-il bien avec toutes ses capacités actuelles, les améliorations ajoutant des capacités nouvelles ? (Autre option : retirer certaines capacités au départ, par exemple le dash, pour les faire gagner.)
2. **Les retours en arrière** : libres à tout moment, ou seulement par des raccourcis qui s'ouvrent au fil du jeu ?
3. **Les zones et leur ordre** : te conviennent-ils ? Une zone à ajouter, retirer ou échanger ?
4. **Les améliorations** : lesquelles te plaisent, lesquelles changer ?
5. **La durée visée** : environ 2 h pour une première partie, ça te va ?
6. **L'histoire des talismans** : la garder comme fil rouge ?
