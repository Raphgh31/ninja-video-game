"""Planches d'animation complètes de chaque skin (vérification et documentation).

usage : python3 skin_sheets.py [id …]  → docs/kage/skins/planche_<id>.png

Chaque planche est la planche de KAGE (mêmes animations, mêmes images) recolorée avec la palette du skin,
avec ses accessoires (kage_acc_<id>_index.png) posés par-dessus — exactement ce que fait le jeu (sprites.js).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
K = ROOT / "assets/characters/kage"
OUT = ROOT / "docs/kage/skins"


def recolor(idx, slots, colors):
    a = np.array(idx.convert("RGBA"))
    out = np.zeros_like(a)
    for s in slots:
        m = (a[..., 3] > 0) & (a[..., 0] == s["index"])
        h = colors[s["slot"]].lstrip("#")
        out[m] = [int(h[i:i + 2], 16) for i in (0, 2, 4)] + [255]
    return Image.fromarray(out, "RGBA")


def main(ids):
    meta = json.loads((K / "kage.json").read_text())
    idx = Image.open(K / meta["indexImage"])
    OUT.mkdir(parents=True, exist_ok=True)
    for sid in ids:
        sk = json.loads((K / "skins" / f"{sid}.json").read_text())
        sheet = recolor(idx, meta["slots"], sk["colors"])
        acc = meta.get("accessorySheets", {}).get(sid)
        if acc:
            sheet.alpha_composite(recolor(Image.open(K / acc), meta["slots"], sk["colors"]))
        z = 2
        board = Image.new("RGB", (sheet.width * z + 40, sheet.height * z + 60), (243, 236, 224))
        board.paste(sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST), (20, 50), sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST))
        ImageDraw.Draw(board).text((20, 14), f"{sk['name']} — {sk.get('rarity', '')} — {sk.get('price', 0)} ryō — toutes les animations", fill=(40, 36, 32), font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22))
        board.save(OUT / f"planche_{sid}.png")
        print("planche", sid)


if __name__ == "__main__":
    main(sys.argv[1:] or [p.stem for p in sorted((K / "skins").glob("*.json"))])
