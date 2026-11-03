# Carte mentale du jeu

`index.html` est une carte de tout le jeu KAGE : KAGE au centre, dix branches (personnage, ennemis, habitants, monde, Potager, décor, son, systèmes, technique, suivi du projet) et, au bout, une boîte par élément. Un clic sur une boîte ouvre ses détails : résumé, repères chiffrés, fichiers du dépôt (liens GitHub), planches et GIF, éléments liés.

- **En ligne** (suit `main`, republiée à chaque fusion) : <https://raphgh31.github.io/ninja-video-game/carte-mentale/>.
- **Ouvrir** : double-cliquer sur `index.html`, ou la page privée claude.ai <https://claude.ai/artifact/M1H94uhbSYCRyFAp1Scvzi> (à republier avec la version produite par `--artefact`).
- **Se déplacer** : glisser ; molette ou pincement pour zoomer ; « Tout » pour revoir toute la carte ; un clic sur une branche zoome dessus.
- **Chercher** : le champ du haut cherche dans les titres, les textes et les chemins (« dash », « grange », « sfx.js »…) ; Entrée ouvre le premier résultat.
- **Filtrer** par état : Fait, En cours, Provisoire, À faire, Idée (la forme de la pastille dit l'état).
- **Lien direct** vers une boîte : `index.html#ennemi-wara`.

## Tenir la carte à jour

**Règle : chaque modification du jeu met aussi la carte à jour, dans le même commit.** Nouvel élément → nouvelle boîte ; élément terminé ou commencé → changer son état ; fichier déplacé → corriger ses chemins ; puis republier la page claude.ai.

`npm run carte` (lancé par `npm test` et par le workflow « Carte mentale à jour » sur chaque PR) échoue si la carte a pris du retard, et dit quoi corriger :
- un fichier ou une image cités qui n'existent plus ;
- une zone du Potager (`b.zone(...)`) ou un personnage de `assets/characters/` sans boîte ;
- un numéro de ligne qui ne pointe plus sur sa zone ;
- le nombre d'animations de KAGE ou de tests qui a changé ;
- un renvoi « Voir aussi » vers une boîte inconnue.

La copie en ligne est écrite à la mise en ligne par `node tools/carte_mentale_verif.mjs --site dist/carte-mentale/index.html`, avec la date et le commit.

Le contenu est dans la liste `BRANCHES` du fichier (une boîte = `id`, `t` titre, `s` état, `d` ligne courte, `txt`, `keys`, `files`, `links`, `see`). Pour ajouter un élément, copier une boîte voisine et changer son `id`, son titre et son état ; la mise en page se fait toute seule.

Les images des personnages sont tirées des sprites générés :

```bash
python3 tools/carte_mentale.py                                  # remet à jour les images
python3 tools/carte_mentale.py --artefact /chemin/carte.html    # + version à publier sur claude.ai
```
