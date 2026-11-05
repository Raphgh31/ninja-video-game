"""Exporte WARA pour le jeu : python3 tools/kage_forge/enemies/build_wara.py

Sorties (assets/characters/wara/) :
  wara_sheet.png  images du personnage (une ligne, cellules 48x32, espacement 2)
  wara.json       cellules, ancrage, animations, boîtes de collision
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from wara import GAME_FRAMES, H, NO_OUTLINE, PAL, W  # noqa: E402
from grow20 import Grower  # noqa: E402

# +20 % (demande de l'utilisateur) : chapeau (2), robe (2), pieu ; colonnes de
# part et d'autre du pieu (x = 15-16), jamais sur les yeux
GROW = Grower(W, H, (16, 31), rows=(7, 11, 21, 24, 28), cols=(7, 11, 13, 19, 23, 27), no_outline=NO_OUTLINE, eyes="k")
SW, SH = GROW.W, GROW.H

ROOT = HERE.parents[2]
OUT = ROOT / "assets/characters/wara"
SPACING = 2
KNOWN = set(PAL) | {"."}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_img(grid):
    h, w = grid.shape
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            c = grid[y, x]
            if c != ".":
                px[x, y] = rgb(PAL[c]) + (255,)
    return im


def check(name, grid):
    """Contrôles qualité : couleurs connues, pieu posé au sol, aucun pixel isolé."""
    unknown = set(np.unique(grid)) - KNOWN
    if unknown:
        raise SystemExit(f"{name} : couleur inconnue {sorted(unknown)}")
    solid = (grid != ".") & (grid != "O") & ~np.isin(grid, list(NO_OUTLINE))
    if not name.startswith("death"):
        rows = np.where(solid.any(axis=1))[0]
        if rows.max() != 30:
            raise SystemExit(f"{name} : pieu hors du sol (bas = {rows.max()})")
    for y, x in zip(*np.where(solid)):
        n = solid[max(0, y - 1):y + 2, max(0, x - 1):x + 2].sum() - 1
        if n == 0:
            raise SystemExit(f"{name} : pixel isolé en ({x}, {y})")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = len(GAME_FRAMES)
    sheet = Image.new("RGBA", (n * (SW + SPACING) - SPACING, SH), (0, 0, 0, 0))
    frames = {}
    for i, (name, fn) in enumerate(GAME_FRAMES):
        grid = fn()
        check(name, grid)
        grid = GROW.grow(grid)
        x = i * (SW + SPACING)
        sheet.paste(to_img(grid), (x, 0))
        frames[name] = {"x": x, "y": 0, "w": SW, "h": SH}
    sheet.save(OUT / "wara_sheet.png")
    meta = {
        "name": "WARA",
        "image": "wara_sheet.png",
        "cell": {"w": SW, "h": SH},
        "pivot": {"x": GROW.PIVOT[0], "y": GROW.PIVOT[1], "note": "sous le pieu, comme KAGE (agrandi de 20 %, grow20.py)"},
        "facing": "right",
        "frames": frames,
        "animations": {
            "idle": {"frames": ["idle_1", "idle_2"], "fps": 3, "loop": True},
            "hop": {"frames": ["crouch", "rise", "apex", "land"], "loop": False,
                    "note": "choisies par le jeu selon la phase du bond"},
            "windup": {"frames": ["windup"], "loop": False},
            "spin": {"frames": ["spin_1", "spin_2"], "fps": 11, "loop": True},
            "dizzy": {"frames": ["dizzy_1", "dizzy_2"], "fps": 4, "loop": True},
            "hurt": {"frames": ["hurt"], "loop": False},
            "defeated": {"frames": ["death_cut", "death_poof", "death_pile", "death_free"],
                         "durations": [260, 200, 500, 0], "loop": False,
                         "note": "tranché, pouf, en tas, le talisman s'envole ; 0 = jusqu'à la fin"},
        },
        "tornSuffix": "_torn",
        "boxes": {k: GROW.box(v) for k, v in {
            "body": {"x": 10, "y": 10, "w": 12, "h": 21, "note": "corps (touché par le sabre et les shurikens)"},
            "spin": {"x": -5, "y": 12, "w": 42, "h": 16, "note": "traverse en hélice : touche des deux côtés"},
        }.items()},
    }
    (OUT / "wara.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"OK — WARA : {n} images")


if __name__ == "__main__":
    main()
