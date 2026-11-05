"""Exporte KARASU-KASHI pour le jeu : python3 tools/kage_forge/enemies/build_karasu.py

Sorties (assets/characters/karasu/) :
  karasu_sheet.png  le corbeau (une ligne, cellules 96x80, espacement 2)
  karasu_perch.png  l'épouvantail géant, cinq inclinaisons (cellules 120x140)
  karasu_items.png  projectiles : gland piquant, navet explosif (cellules 14x18)
  karasu.json       cellules, ancrages, animations, boîtes de collision
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import karasu  # noqa: E402
from karasu import FX, FY, GAME_FRAMES, H, ITEM_FRAMES, NO_OUTLINE, PAL, PERCH_FRAMES, SGROUND, SH, SW, W  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "assets/characters/karasu"
SPACING = 2
KNOWN = set(PAL) | {"."}
GROUNDED = ("idle", "look", "hatfix", "croak", "takeoff_1", "hurt", "shake", "crash", "stuck", "defeat_2", "defeat_3")
IW, IH = 14, 18


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_img(grid):
    hh, ww = grid.shape
    im = Image.new("RGBA", (ww, hh), (0, 0, 0, 0))
    px = im.load()
    for y in range(hh):
        for x in range(ww):
            c = grid[y, x]
            if c != ".":
                px[x, y] = rgb(PAL[c]) + (255,)
    return im


def check(name, grid, ground=None):
    """Contrôles qualité : couleurs connues, pattes au sol, aucun pixel isolé."""
    unknown = set(np.unique(grid)) - KNOWN
    if unknown:
        raise SystemExit(f"{name} : couleur inconnue {sorted(unknown)}")
    solid = (grid != ".") & (grid != "O") & ~np.isin(grid, list(NO_OUTLINE))
    if ground is not None:
        rows = np.where(solid.any(axis=1))[0]
        if rows.max() != ground:
            raise SystemExit(f"{name} : pattes hors du sol (bas = {rows.max()}, attendu {ground})")
    for y, x in zip(*np.where(solid)):
        n = solid[max(0, y - 1):y + 2, max(0, x - 1):x + 2].sum() - 1
        if n == 0:
            raise SystemExit(f"{name} : pixel isolé en ({x}, {y})")


def bbox(grid):
    solid = (grid != ".") & ~np.isin(grid, list(NO_OUTLINE))
    ys, xs = np.where(solid)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def strip(frames, w, h, ground_of=None):
    sheet = Image.new("RGBA", (len(frames) * (w + SPACING) - SPACING, h), (0, 0, 0, 0))
    rects, grids = {}, {}
    for i, (name, fn) in enumerate(frames):
        grid = fn()
        check(name, grid, ground_of(name) if ground_of else None)
        x = i * (w + SPACING)
        sheet.paste(to_img(grid), (x, 0))
        rects[name] = {"x": x, "y": 0, "w": w, "h": h}
        grids[name] = grid
    return sheet, rects, grids


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    grounded = lambda n: FY if n.startswith(GROUNDED) else None   # noqa: E731
    sheet, frames, grids = strip(GAME_FRAMES, W, H, grounded)
    sheet.save(OUT / "karasu_sheet.png")
    perch, pframes, _ = strip(PERCH_FRAMES, SW, SH, lambda n: SGROUND)
    perch.save(OUT / "karasu_perch.png")
    items, iframes, _ = strip(ITEM_FRAMES, IW, IH)
    items.save(OUT / "karasu_items.png")

    # boîtes de collision, mesurées sur le dessin (le corps, sans la queue ni le chapeau)
    def box(name, shrink=(0.18, 0.1, 0.12, 0.0)):
        x0, y0, x1, y1 = bbox(grids[name])
        w, h = x1 - x0, y1 - y0
        return {"x": int(x0 + w * shrink[0]), "y": int(y0 + h * shrink[1]), "w": int(w * (1 - shrink[0] - shrink[2])), "h": int(h * (1 - shrink[1] - shrink[3]))}
    meta = {
        "name": "KARASU-KASHI",
        "image": "karasu_sheet.png",
        "perchImage": "karasu_perch.png",
        "itemImage": "karasu_items.png",
        "cell": {"w": W, "h": H},
        "pivot": {"x": FX, "y": FY, "note": "sous les pattes"},
        "perchCell": {"w": SW, "h": SH},
        "perchPivot": {"x": 58, "y": SGROUND, "note": "pied du poteau"},
        "perchTop": {"x": 58, "y": 25, "note": "là où il se pose"},
        "itemCell": {"w": IW, "h": IH},
        "facing": "right",
        "frames": {**frames, **pframes, **iframes},
        "animations": {
            "idle": {"frames": ["idle_1", "idle_2", "idle_2", "idle_1", "idle_3", "idle_1"], "durations": [500, 380, 380, 500, 110, 700], "loop": True},
            "look": {"frames": ["look_1", "look_2", "look_2", "look_1"], "durations": [260, 500, 300, 260], "loop": False},
            "hatfix": {"frames": ["hatfix_1", "hatfix_2", "idle_1"], "durations": [240, 240, 200], "loop": False},
            "croak": {"frames": ["croak_1", "croak_2", "croak_1", "croak_2"], "durations": [90, 220, 90, 260], "loop": False},
            "takeoff": {"frames": ["takeoff_1", "takeoff_2"], "durations": [200, 160], "loop": False},
            "fly": {"frames": ["fly_1", "fly_2", "fly_3", "fly_2"], "durations": [90, 70, 110, 70], "loop": True},
            "drop": {"frames": ["drop_1", "drop_2"], "durations": [120, 200], "loop": False},
            "aim": {"frames": ["aim_1", "aim_2"], "durations": [140, 140], "loop": True},
            "dive": {"frames": ["dive_1", "dive_2"], "durations": [80, 80], "loop": True},
            "crash": {"frames": ["crash"], "loop": False},
            "stuck": {"frames": ["stuck_1", "stuck_2"], "durations": [160, 160], "loop": True},
            "stuckHit": {"frames": ["stuck_hit"], "loop": False},
            "hurt": {"frames": ["hurt"], "loop": False},
            "shake": {"frames": ["shake_1", "shake_2", "shake_1", "shake_2", "shake_3"], "durations": [90, 90, 90, 90, 260], "loop": False},
            "defeated": {"frames": ["defeat_1", "defeat_2", "defeat_3"], "durations": [260, 220, 0], "loop": False},
            "perch": {"frames": [n for n, _ in PERCH_FRAMES], "note": "inclinaison -1 à 1, choisie par le jeu"},
            "acorn": {"frames": ["acorn_1", "acorn_2"], "durations": [80, 80], "loop": True},
            "turnip": {"frames": ["turnip_1", "turnip_2"], "durations": [90, 90], "loop": True},
        },
        "boxes": {
            "perched": box("idle_1", (0.3, 0.12, 0.12, 0.08)),
            "flying": box("fly_2", (0.2, 0.2, 0.15, 0.0)),   # les pattes pendantes comptent : à portée d'un saut
            "dive": box("dive_1", (0.25, 0.15, 0.1, 0.05)),
            "stuck": box("stuck_1", (0.12, 0.12, 0.2, 0.0)),
        },
    }
    (OUT / "karasu.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"OK — KARASU-KASHI : {len(GAME_FRAMES)} images, épouvantail {len(PERCH_FRAMES)}, projectiles {len(ITEM_FRAMES)}")


if __name__ == "__main__":
    main()
