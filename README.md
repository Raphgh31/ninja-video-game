# ninja-video-game

Jeu de plateforme 2D rapide en pixel art. Personnage principal : **KAGE**, ninja noir.

![KAGE](docs/kage/kage_reference.png)

## Lancer le terrain d'essai

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # version de production dans dist/
npm run standalone # dist/kage-standalone.html : jeu complet en un fichier, jouable par double-clic
```

Commandes : flèches pour courir, Maj + flèche pour sprinter, double appui rapide sur ← ou → pour le dash, Espace pour sauter, ↓ (ou C) pour glisser, J (ou X) pour le coup de sabre, K (ou V) pour lancer un shuriken, H pour afficher la hitbox. Sur mobile, le jeu passe en plein écran avec des commandes dans le jeu : joystick flottant sous le pouce gauche (coup très rapide et court vers un côté puis relâché = dash, vers le bas = glissade) et boutons ronds à droite (saut, sabre, shuriken) et petit interrupteur de sprint (il se coupe à l'arrêt ou quand l'énergie est vide). À jouer en paysage.

## Sprites

```bash
npm run sprites    # régénère assets/characters/kage/ et docs/kage/ (Python 3 + Pillow + numpy)
```

Documentation du personnage, des animations et de la palette : [docs/kage/README.md](docs/kage/README.md). Ennemis : [docs/enemies/README.md](docs/enemies/README.md).

## Structure

- `assets/` : ressources du jeu, servies telles quelles (`characters/kage/…`)
- `src/engine/` : chargement des sprites, palette, animations, entrées
- `src/game/` : joueur (machine d'états), niveau de test
- `tools/kage_forge/` : sources des sprites et outil d'export
- `docs/kage/` : planches de référence et aperçus animés
