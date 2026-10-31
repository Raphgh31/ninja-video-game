# ninja-video-game

Jeu de plateforme 2D rapide en pixel art. Personnage principal : **KAGE**, ninja noir.

![KAGE](docs/kage/kage_reference.png)

## Lancer le terrain d'essai

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # version de production dans dist/
```

Commandes : flèches pour courir, Espace pour sauter, Maj (ou J) pour le dash, ↑ + Maj pour le dash vertical, ↓ (ou K) pour glisser, H pour afficher la hitbox. Boutons tactiles sur mobile.

## Sprites

```bash
npm run sprites    # régénère assets/characters/kage/ et docs/kage/ (Python 3 + Pillow + numpy)
```

Documentation du personnage, des animations et des skins : [docs/kage/README.md](docs/kage/README.md).

## Structure

- `assets/` : ressources du jeu, servies telles quelles (`characters/kage/…`)
- `src/engine/` : chargement des sprites, skins, animations, entrées
- `src/game/` : joueur (machine d'états), niveau de test
- `tools/kage_forge/` : sources des sprites et outil d'export
- `docs/kage/` : planches de référence et aperçus animés
