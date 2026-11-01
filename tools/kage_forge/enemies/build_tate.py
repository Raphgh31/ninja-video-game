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

ROOT = HERE.parents[2]
OUT = ROOT / "assets/characters/tate"
SPACING = 2


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_img(grid, only=None):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    for y in range(H):
        for x in range(W):
            c = grid[y, x]
            if c == "." or (only is not None and c not in only):
                continue
            px[x, y] = rgb(PAL[c]) + (255,)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = len(GAME_FRAMES)
    sheet = Image.new("RGBA", (n * (W + SPACING) - SPACING, H), (0, 0, 0, 0))
    glow = sheet.copy()
    frames = {}
    for i, (name, fn) in enumerate(GAME_FRAMES):
        plain = fn(False)
        lit = fn(True)
        x = i * (W + SPACING)
        sheet.paste(to_img(plain), (x, 0))
        halo = lit.copy()
        halo[(lit == plain)] = "."          # ne garder que le halo
        glow.paste(to_img(halo), (x, 0))
        # contrôle : les pieds doivent toucher la ligne d'ancrage (sauf « vaincu »)
        rows = [y for y in range(H) if any(c not in (".",) and c not in NO_OUTLINE for c in plain[y])]
        if name != "defeated" and max(rows) != 30:
            raise SystemExit(f"{name} : pieds hors du sol (bas = {max(rows)})")
        frames[name] = {"x": x, "y": 0, "w": W, "h": H}
    sheet.save(OUT / "tate_sheet.png")
    glow.save(OUT / "tate_glow.png")
    meta = {
        "name": "TATE",
        "image": "tate_sheet.png",
        "glowImage": "tate_glow.png",
        "cell": {"w": W, "h": H},
        "pivot": {"x": 15, "y": 30, "note": "sous les pieds"},
        "facing": "right",
        "frames": frames,
        "animations": {
            "walk": {"frames": ["walk_1", "walk_2"], "fps": 3, "loop": True},
            "guard": {"frames": ["guard"], "fps": 1, "loop": False},
            "windup": {"frames": ["windup"], "fps": 1, "loop": False},
            "bash": {"frames": ["bash"], "fps": 1, "loop": False},
            "stunned": {"frames": ["stunned"], "fps": 1, "loop": False},
            "defeated": {"frames": ["defeated"], "fps": 1, "loop": False},
        },
        "boxes": {
            "body": {"x": 8, "y": 8, "w": 14, "h": 23, "note": "corps solide"},
            "shield": {"x": 21, "y": 9, "w": 10, "h": 22, "note": "bouclier (bloque de face)"},
            "bash": {"x": 26, "y": 8, "w": 12, "h": 23, "note": "bouclier projeté : touche KAGE"},
        },
    }
    (OUT / "tate.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"OK — TATE : {n} images")


if __name__ == "__main__":
    main()
