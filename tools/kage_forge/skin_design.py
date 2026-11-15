"""Planche de travail d'un skin : le modèle de Raph, le skin en grand, et dans ses poses.

usage : python3 skin_design.py <id> <sortie.png> <modèle.png> x0 y0 x1 y1
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from accessories import dress  # noqa: E402
from art import ANIMS  # noqa: E402
from core import CH, CW, render  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def img(g, colors):
    im = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    px = im.load()
    for y in range(CH):
        for x in range(CW):
            c = g[y, x]
            if c != ".":
                h = colors[c].lstrip("#")
                px[x, y] = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    return im


def main():
    sid, out, ref = sys.argv[1], sys.argv[2], sys.argv[3]
    box = tuple(map(int, sys.argv[4:8]))
    sk = json.loads((ROOT / f"assets/characters/kage/skins/{sid}.json").read_text())
    F = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s)
    board = Image.new("RGB", (1560, 1020), (243, 236, 224))
    d = ImageDraw.Draw(board)
    d.text((30, 18), f"{sk['name']} — {sk.get('price', 0)} ryō", fill=(40, 36, 32), font=F(28))
    r = Image.open(ref).convert("RGB").crop(box)
    r = r.resize((int(r.width * 420 / r.height), 420), Image.LANCZOS)
    board.paste(r, (30, 70))
    d.text((30, 496), "Modèle", fill=(110, 100, 90), font=F(16))
    g = dress(render(ANIMS["idle"]["frames"][0]), sk["accessories"])
    big = img(g, sk["colors"]).crop((0, 4, 34, 32)).resize((34 * 15, 28 * 15), Image.NEAREST)
    board.paste(big, (520, 70), big)
    d.text((520, 496), "Le skin (pose de repos, ×15)", fill=(110, 100, 90), font=F(16))
    # ×1 et ×3, sur un fond de forêt sombre et sur un fond clair
    for i, (bg, z) in enumerate((((40, 52, 44), 1), ((40, 52, 44), 3), ((214, 205, 186), 3))):
        im = img(g, sk["colors"]).resize((CW * z, CH * z), Image.NEAREST)
        x0 = 1080 + (0 if i == 0 else 60 + (i - 1) * 160)
        board.paste(Image.new("RGB", (CW * z + 8, CH * z + 8), bg), (x0 - 4, 66))
        board.paste(im, (x0, 70), im)
    poses = [("run", 0), ("run", 3), ("sprint", 1), ("jump", 1), ("fall", 1), ("attack", 3), ("kick", 3), ("throw", 3),
             ("dash", 2), ("slide", 1), ("wall_slide", 0), ("walk", 1), ("hurt", 0), ("air_attack", 2)]
    for k, (a, f) in enumerate(poses):
        g = dress(render(ANIMS[a]["frames"][f]), sk["accessories"])
        im = img(g, sk["colors"]).resize((CW * 5, CH * 5), Image.NEAREST)
        x, y = 30 + (k % 7) * 215, 540 + (k // 7) * 230
        board.paste(im, (x, y), im)
        d.text((x + 10, y + CH * 5 - 4), f"{a} {f}", fill=(130, 120, 110), font=F(13))
    board.save(out)


if __name__ == "__main__":
    main()
