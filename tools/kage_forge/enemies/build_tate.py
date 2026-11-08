"""Exporte TATE pour le jeu : python3 tools/kage_forge/enemies/build_tate.py

Sorties (assets/characters/tate/) :
  tate_sheet.png  images du personnage (une ligne, cellules 48x32, espacement 2)
  tate_glow.png   halo du talisman seul, même disposition (surcouche pulsée en jeu)
  tate.json       cellules, ancrage, animations, boîtes de collision
"""
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from tate import GAME_FRAMES, H, NO_OUTLINE, PAL, W  # noqa: E402
from grow20 import Grower  # noqa: E402

# +20 % (demande de l'utilisateur) : chapeau, cuirasse (2), hakama (2), jambes ;
# colonnes de part et d'autre de l'ancrage, dont deux dans le bouclier
GROW = Grower(W, H, (15, 30), rows=(3, 11, 14, 18, 21, 25), cols=(4, 9, 12, 19, 25, 29), no_outline=NO_OUTLINE, eyes="e")
SW, SH = GROW.W, GROW.H

ROOT = HERE.parents[2]
OUT = ROOT / "assets/characters/tate"
SPACING = 2


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_img(grid, only=None):
    h, w = grid.shape
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            c = grid[y, x]
            if c == "." or (only is not None and c not in only):
                continue
            px[x, y] = rgb(PAL[c]) + (255,)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = len(GAME_FRAMES)
    sheet = Image.new("RGBA", (n * (SW + SPACING) - SPACING, SH), (0, 0, 0, 0))
    glow = sheet.copy()
    frames = {}
    for i, (name, fn) in enumerate(GAME_FRAMES):
        plain0 = fn(False)
        # contrôle : les pieds doivent toucher la ligne d'ancrage (sauf « vaincu »)
        rows = [y for y in range(H) if any(c not in (".",) and c not in NO_OUTLINE for c in plain0[y])]
        if not name.startswith("defeat") and max(rows) != 30:
            raise SystemExit(f"{name} : pieds hors du sol (bas = {max(rows)})")
        p = GROW.plan(plain0)
        plain = GROW.grow(plain0, p)
        lit = GROW.grow(fn(True), p)
        x = i * (SW + SPACING)
        sheet.paste(to_img(plain), (x, 0))
        halo = lit.copy()
        halo[(lit == plain)] = "."          # ne garder que le halo
        glow.paste(to_img(halo), (x, 0))
        frames[name] = {"x": x, "y": 0, "w": SW, "h": SH}
    sheet.save(OUT / "tate_sheet.png")
    glow.save(OUT / "tate_glow.png")
    meta = {
        "name": "TATE",
        "image": "tate_sheet.png",
        "glowImage": "tate_glow.png",
        "cell": {"w": SW, "h": SH},
        "pivot": {"x": GROW.PIVOT[0], "y": GROW.PIVOT[1], "note": "sous les pieds (agrandi de 20 %, grow20.py)"},
        "facing": "right",
        "frames": frames,
        "animations": {
            "walk": {"frames": ["walk_1", "walk_2"], "fps": 3, "loop": True},
            "guard": {"frames": ["guard"], "fps": 1, "loop": False},
            "windup": {"frames": ["windup"], "fps": 1, "loop": False},
            "bash": {"frames": ["bash"], "fps": 1, "loop": False},
            "stunned": {"frames": ["stunned"], "fps": 1, "loop": False},
            "defeated": {"frames": ["defeat_kneel", "defeat_topple", "defeat_impact", "defeat_down"],
                         "durations": [600, 120, 220, 0], "loop": False,
                         "note": "un genou à terre (long), bascule (rapide), impact, au sol ; 0 = jusqu'à la fin"},
        },
        "boxes": {k: GROW.box(v) for k, v in {
            "body": {"x": 8, "y": 5, "w": 15, "h": 26, "note": "corps solide"},
            "shield": {"x": 22, "y": 6, "w": 10, "h": 25, "note": "bouclier (bloque de face)"},
            "bash": {"x": 27, "y": 5, "w": 12, "h": 26, "note": "bouclier projeté : touche KAGE"},
        }.items()},
    }
    (OUT / "tate.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"OK — TATE : {n} images")


if __name__ == "__main__":
    main()
