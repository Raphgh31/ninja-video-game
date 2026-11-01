# ninja-video-game

Jeu de plateforme 2D rapide en pixel art. Personnage principal : **KAGE**, ninja noir.

![KAGE](docs/kage/kage_reference.png)

## Lancer le terrain d'essai

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # version de production dans dist/
npm run standalone # dist/kage-standalone.html : jeu complet en un fichier, jouable par double-clic
npm test           # tests de bout en bout dans un vrai navigateur (26 vérifications, dont la faisabilité de chaque passage du niveau 1)
```

Commandes : flèches pour courir, Maj + flèche pour sprinter, double appui rapide sur ← ou → pour le dash, Espace pour sauter (contre un mur en l'air : saut mural), ↓ (ou C) pour glisser, J (ou X) pour le coup de sabre, K (ou V) pour lancer un shuriken, H pour afficher la hitbox, M pour couper le son. Sur mobile, le jeu passe en plein écran avec des commandes dans le jeu : joystick flottant sous le pouce gauche (coup très rapide et court vers un côté puis relâché = dash, vers le bas = glissade) et boutons ronds à droite (saut, sabre, shuriken) et petit interrupteur de sprint (il se coupe à l'arrêt ou quand l'énergie est vide). À jouer en paysage.

## Niveau 1

Le jeu s'ouvre sur le **Niveau 1** (le terrain d'essai reste accessible par l'en-tête ou en ajoutant `#terrain` à l'adresse). Il enchaîne toutes les mécaniques : TATE, fosse (saut), tunnel bas (glissade), fossé de 5 carreaux (sprint ou dash), deux TATE, fossé de 8 (sprint + saut + dash), puits (sauts muraux), gong à atteindre au shuriken pour ouvrir la porte, arène (coup aérien en se laissant tomber derrière TATE), pics, dernier TATE, torii d'arrivée. Trois lanternes servent de points de sauvegarde ; chronomètre et nombre de chutes à l'arrivée. Cartes : `src/game/maps.js`.

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
