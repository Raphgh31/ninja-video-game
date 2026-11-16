# Les skins du ninja — guide complet

Tout ce qu'il faut savoir pour **créer un skin** du ninja de *The Ninja Adventure*, fidèle au modèle de l'utilisateur (Raph), et le mettre en vente chez le marchand. À lire avec `CLAUDE.md` (règles du projet) et `docs/kage/README.md` (le personnage et sa forge).

> Le ninja **n'a pas de nom pour le joueur** : « KAGE » ne sert que dans le code et les fichiers (`assets/characters/kage/`, `tools/kage_forge/`), jamais à l'écran (boutique, descriptions, menus).

---

## 1. Où on en est (16 novembre 2026, Samouraï déchu fait)

**Skins dans le jeu** (`assets/characters/kage/skins/`) :

| id | Nom | Rareté | Prix | Accessoires | Particularités |
|---|---|---|---|---|---|
| `encre` | Encre | origine | — | — | le skin d'origine, toujours possédé |
| `voyageur` | Le voyageur | commun | 100 | `ribbon`, `mino`, `sash`, `apron`, `kasa_leaf` | sugegasa tressé, manteau de feuilles et de paille, cordon doré |
| `paysan` | Paysan des rizières | commun | 100 | `notails`, `pants`, `dots`, `farmer`, `sash`, `kasa` | kimono vert, tonnelet et panier sur le dos, bambou |
| `samourai` | Samouraï déchu | rare | 550 | `arm_in`, `hakama`, `kusazuri`, `rag`, `sode`, `samurai_trim`, `kabuto` | kabuto aux cornes d'or en croissant et cimier rouge, pans au vent, grande épaulière carrée, cape en lambeaux, tassettes bordées d'or ; bras arrière rapproché du corps ; `barLift: 4` (barre de vie au-dessus des cornes) |
| `or` | Lumière d'or | légendaire | 600 | `flametails`, `halo`, `hipcloth`, `mantlet`, `sash`, `apron` | `aura: 'gold'` (éclat : `src/game/aura.js`), shurikens dorés (`projectileColors`), traînées d'or (`trail`), poussière d'or derrière les shurikens (`goldDust`, `src/game/shuriken.js`) |

**Brouillons** (`tools/kage_forge/skins_brouillon/`, hors du jeu) : un premier jet trop rapide, à **refaire un par un, fidèles au modèle** (le Samouraï déchu est fait, 16 novembre 2026) :

| Fichier | Nom | Prix prévu | Rareté |
|---|---|---|---|
| `blanc.json` | Le ninja blanc | 150 | commun |
| `ecarlate.json` | Le ninja écarlate | 150 | commun |
| `pourpre.json` | Ombre pourpre | 150 | peu commun |
| `pecheur.json` | Le pêcheur | 250 | peu commun |
| `hiver.json` | Souffle de l'hiver | 450 | épique |
| `renard.json` | Renard blanc | 500 | rare |

Le **vagabond** (premier skin) a été **retiré**.

Les **modèles** sont des planches dessinées par Raph : il les envoie en image dans la conversation. Il faut les lui redemander si on ne les a pas.

---

## 2. La règle d'or de l'utilisateur

- **Un skin à la fois, fidèle au modèle.** Demande expresse, après un premier jet de dix skins trop rapide et refusé. Chaque détail du modèle compte : couleurs, chapeau, motifs, ce qu'il porte sur le dos, le bas du vêtement, la forme du bandeau.
- **Planche de travail face au modèle d'abord**, intégration ensuite. Puis **planches d'animation complètes** : vérifier toutes les poses, pas seulement le repos.
- Un skin **change la palette** et peut **ajouter des accessoires** qui changent la silhouette (chapeau, cape, paquetage… accord de l'utilisateur). **Jamais** les animations ni la boîte de collision.
- Rendu « jeu indé soigné » : pixels nets, contour d'un pixel, lumière à gauche, rien de flou ni de générique.

---

## 3. Comment un skin est fait

**1. Une palette par « slots »** (`tools/kage_forge/palette.py`)
- Chaque pixel des poses est dessiné avec un **slot** sémantique (une lettre), jamais avec une couleur.
- Le jeu recolore la planche d'index `kage_sheet_index.png` avec la table slot → couleur du skin.
- Les slots : `O` contour ; `h H I` capuche ; `M` masque ; `N n` peau ; `E e` yeux ; `t T U` tenue ; `a A` brassards ; `l L` ceinture ; `d D` chaussures ; `f F G` bandeau ; `W w g` lame et poignée ; `k K` accessoire ; `x X z q` effets ; `r p P Q` chapeau ; `c C` cordelette ; `b B i` et `j J` équipement ; `s S u` auréole.

**2. Le fichier du skin** (`assets/characters/kage/skins/<id>.json`)

| Champ | Contenu |
|---|---|
| `id`, `name` | identifiant et nom affiché |
| `rarity` | `commun`, `peu commun`, `rare`, `épique` ou `légendaire` (couleurs : `RARITIES` dans `src/game/shop.js`) |
| `price` | prix en ryō |
| `description` | ce qu'il porte (boutique) |
| `blurb` | une phrase d'ambiance |
| `accessories` | la liste des accessoires |
| `colors` | **tous** les slots |

Champs facultatifs :
- `aura` : un éclat dessiné autour du ninja (`src/game/aura.js`) ;
- `projectileColors` : la couleur des shurikens ;
- `trail` : la couleur des traînées du sabre et du dash ;
- `barLift` : de combien de pixels remonter la barre de vie du ninja, pour un couvre-chef haut (les cornes du samouraï : 4).

**3. Les accessoires** (`tools/kage_forge/accessories.py`)
- Ils ne sont pas dessinés dans les poses. La forge **retrouve la tête** dans chaque image (`find_head` : la tête de profil a toujours la même forme) et le **dos** pose par pose, puis y pose l'accessoire avec son propre contour.
- Ce qui existe déjà :
  - **chapeaux** en tampons ASCII : `sugegasa`, `kasa`, `kasa_leaf`, `kitsune`, `cowl`… ; le `kabuto` du samouraï (bombe, cornes en croissant, cimier, et ses deux pans au vent qui remplacent ceux du bandeau ; dans les saltos, la forge garde les pans tracés à la traîne du nœud) ;
  - **capes et paquetages** qui suivent le dos : `cape(kind)`, `mino`, `pack` (`sack`, `net`), `farmer` ;
  - `ribbon` (pans du bandeau flottants), `notails` ;
  - `sash`, `apron`, `hipcloth`, `mantlet`, `pants`, `dots` ;
  - `halo`, `flametails`, `fur`, `cord` ;
  - samouraï : `sode` (épaulière), `rag` (cape en lambeaux, qui s'arrête au-dessus des pieds quelle que soit la pose), `kusazuri` (tassettes), `hakama` (les jambes, jusqu'à la jambe levée d'un coup de pied), `samurai_trim` (col, ceinture, épaule avant, chaussures), `arm_in` (le bras arrière rapproché d'un pixel du corps quand il pend derrière le dos).
- Un accessoire peut aussi **retirer** des pixels de la pose (les pans du bandeau rangés, un bras déplacé) : la forge marque ces pixels sur le calque (`ERASE`, index 255, `build.py`) et le jeu les efface avant de poser l'accessoire (`eraseMask`, `src/engine/sprites.js` ; de même `skin_sheets.py`). Avant le 16 novembre 2026, ce qu'un accessoire retirait restait visible en jeu.
- Les accessoires peignent dans les slots `gear` (`b B i`) et `gear2` (`j J`), plus ceux du chapeau (`r p P Q`) et de la cordelette (`c C`).
- Ils passent derrière la lame et les mains.

**4. L'export** : `npm run sprites` (`tools/kage_forge/build.py`)
- Lit tous les `skins/*.json` et ajoute leur id à `kage.json` (`skins`).
- Exporte pour chaque skin à accessoires un calque `kage_acc_<id>_index.png` (`accessorySheets` dans `kage.json`).
- **Échoue si un contrôle qualité échoue** : tête non retrouvée, slot inconnu, pixel isolé, pieds hors du sol. Corriger le dessin, jamais le contrôle.
- Le jeu fond le calque sur la planche du skin au chargement (`loadCharacter`, `src/engine/sprites.js`).
- **Agrandissement** : les poses sont dessinées en cellule 48×32, puis agrandies de 20 % à l'export (`scale.py`, cellule 57×36). Un accessoire se dessine à l'échelle des poses.

**5. Dans le jeu**
- Boutique plein écran du marchand (`src/game/shop.js`), rayon Apparences : cartes triées par prix, cadre à la couleur de la rareté, aperçu animé (repos, course, saut, sabre, sprint, coup de pied, shuriken), achat confirmé.
- Sauvegarde : `skins` (possédés) et `skin` (porté).
- Le skin porté s'affiche aussi :
  - dans le menu (carte « Aventure », écran « Mon ninja » où le ninja est en grand) ;
  - en arène : le ninja porte le skin de l'aventure en cours, et son portrait dans le salon (corrigé le 16 novembre 2026 : il y restait en Encre) ;
  - chez les autres joueurs en arène (message `me`).
- **Version de test** (« The Ninja Adventure Test », `dist/kage-test.html`) : tous les skins se portent sans achat (panneau en haut à droite, clic ou touches 1, 2…).
- **Version autonome** : `tools/standalone.mjs` embarque d'elle-même tous les skins listés dans `kage.json`.

---

## 4. La méthode, pas à pas

1. **Le modèle** : demander à Raph la planche du skin s'il ne l'a pas jointe, et la regarder en grand (zoom ×4 à ×8). Lister chaque élément à reproduire.
2. **Le fichier** :
   - partir du brouillon s'il existe (`skins_brouillon/<id>.json`), sinon d'un skin voisin ;
   - régler **toutes** les couleurs d'après le modèle ;
   - nom, rareté, prix, description, phrase.
3. **Les accessoires** : réutiliser ceux qui existent, ou en dessiner de nouveaux dans `accessories.py`. Un chapeau est un tampon ASCII ; une cape ou un paquetage suit le dos pose par pose.
4. **Planche de travail face au modèle** :
   ```bash
   python3 tools/kage_forge/skin_design.py <id> <sortie.png> <modèle.png> x0 y0 x1 y1
   ```
   Le modèle, le skin en grand, et le skin dans ses poses. **La regarder soi-même, zoomée, avant de la montrer**, puis la montrer à Raph et attendre son accord.
5. **Intégrer** :
   - déplacer le fichier dans `assets/characters/kage/skins/` ;
   - `npm run sprites` (contrôles qualité) ;
   - planches d'animation complètes : `python3 tools/kage_forge/skin_sheets.py <id>` → `docs/kage/skins/planche_<id>.png`. Vérifier **toutes** les poses : sabre, sprint, glissade, saltos, liane, corde, mort…
6. **Voir en jeu** :
   - `npm run standalone`, puis la version de test ;
   - captures avec `tools/capture.cjs`, sur ordinateur et sur téléphone ;
   - vérifier la boutique, le menu « Mon ninja » et l'arène.
7. **Finir** :
   - carte mentale (boîte des skins : `docs/carte-mentale/index.html`, `kage-skins`) ;
   - ce fichier (tableau du § 1) ;
   - `npm run sprites` puis `npm test` ;
   - commit en français, push, PR en brouillon ;
   - **version test publiée seulement quand Raph dit « publie-le »** ;
   - fusion et mise en ligne seulement à la fin de la série, quand il le demande.

**Effets spéciaux** (skins rares) :
- un éclat comme `aura: 'gold'` se dessine dans `src/game/aura.js` ;
- des effets sur les shurikens se règlent dans `src/game/shuriken.js` (comme la poussière d'or) ;
- les traînées se règlent avec le champ `trail`.

Tout reste **décoratif** : rien ne change au jeu.

---

## 5. Les fichiers

| Fichier | Rôle |
|---|---|
| `assets/characters/kage/skins/*.json` | les skins du jeu (écrits à la main) |
| `assets/characters/kage/kage.json`, `kage_sheet_index.png`, `kage_acc_<id>_index.png` | **générés** par `npm run sprites` : ne jamais les éditer à la main |
| `tools/kage_forge/palette.py` | les slots et leur ordre |
| `tools/kage_forge/accessories.py` | les accessoires |
| `tools/kage_forge/build.py`, `scale.py`, `core.py`, `art.py`, `rig.py` | la forge (poses, agrandissement, export, contrôles) |
| `tools/kage_forge/skin_design.py` | planche de travail face au modèle |
| `tools/kage_forge/skin_sheets.py` | planches d'animation complètes (`docs/kage/skins/`) |
| `tools/kage_forge/skin_board.py` | ancienne planche de design (encore utilisable) |
| `tools/kage_forge/skins_brouillon/` | brouillons hors du jeu |
| `src/engine/sprites.js` | chargement et recoloration (palette, accessoires et pixels qu'ils effacent, projectiles, traînées) |
| `src/game/shop.js` | boutique (`RARITIES`) |
| `src/game/aura.js` | éclat de Lumière d'or |
| `src/game/shuriken.js` | shurikens (couleurs, poussière d'or) |
| `docs/kage/skins/` | planches des skins faits |
