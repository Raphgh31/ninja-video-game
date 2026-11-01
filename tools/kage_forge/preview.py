"""Aperçu agrandi avec grille, pour relire les frames pendant le dessin.

usage : python3 preview.py <module> <nom_anim|all> [sortie.png]
"""
import importlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from core import CH, CW, render

ROOT = Path(__file__).resolve().parents[2]
SKIN = json.loads((ROOT / "assets/characters/kage/skins/encre.json").read_text())["colors"]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_image(grid, skin=SKIN, bg=None):
    img = Image.new("RGBA", (CW, CH), bg or (0, 0, 0, 0))
    px = img.load()
    for y in range(CH):
        for x in range(CW):
            c = grid[y, x]
            if c != ".":
                px[x, y] = hex2rgb(skin[c]) + (255,)
    return img


def sheet(frames, z=10, bgs=((150, 162, 176), (226, 222, 210), (58, 66, 80))):
    n = len(frames)
    W = n * (CW * z + 8) + 8
    H = len(bgs) * (CH * z + 8) + 8 + (len(bgs)) * (CH * 2 + 8)
    out = Image.new("RGB", (W, H), (30, 30, 30))
    d = ImageDraw.Draw(out)
    for r, bg in enumerate(bgs):
        for i, g in enumerate(frames):
            im = to_image(g, bg=bg + (255,)).resize((CW * z, CH * z), Image.NEAREST)
            ox, oy = 8 + i * (CW * z + 8), 8 + r * (CH * z + 8)
            out.paste(im, (ox, oy))
            if r == 0:
                for k in range(0, CW + 1, 4):
                    col = (90, 90, 90) if k % 8 else (60, 60, 60)
                    d.line([(ox + k * z, oy), (ox + k * z, oy + CH * z)], fill=col)
                    if k <= CH:
                        d.line([(ox, oy + k * z), (ox + CW * z, oy + k * z)], fill=col)
    # taille réelle x2
    base = 8 + len(bgs) * (CH * z + 8)
    for r, bg in enumerate(bgs):
        for i, g in enumerate(frames):
            im = to_image(g, bg=bg + (255,)).resize((CW * 2, CH * 2), Image.NEAREST)
            out.paste(im, (8 + i * (CW * 2 + 8), base + r * (CH * 2 + 8)))
    return out


if __name__ == "__main__":
    mod = importlib.import_module(sys.argv[1])
    name = sys.argv[2]
    if name == "views":
        frames = [render(f) for f in mod.VIEWS.values()]
    else:
        frames = [render(f) for f in mod.ANIMS[name]["frames"]]
    dest = sys.argv[3] if len(sys.argv) > 3 else f"/tmp/prev_{name}.png"
    sheet(frames).save(dest)
    print(dest)
