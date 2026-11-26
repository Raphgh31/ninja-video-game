"""Planche de design : les gestes du duel (parade, parade réussie, déséquilibre, victoire, défaite).

    python3 tools/kage_forge/duel_board.py <planche.png>
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from core import CH, CW, render  # noqa: E402
from preview import to_image  # noqa: E402
import duel  # noqa: E402

SKINS = Path(__file__).parents[2] / "assets" / "characters" / "kage" / "skins"
BG, PANEL = (16, 20, 24), (54, 66, 74)
ROWS = [("parade", duel.PARRY), ("parade réussie", duel.PARRY_HIT), ("déséquilibre", duel.STAGGER),
        ("victoire", duel.VICTORY), ("défaite", duel.DEFEAT)]


def colors(name):
    return json.loads((SKINS / f"{name}.json").read_text())["colors"]


def board(out, z=7):
    n = max(len(f) for _, f in ROWS)
    W, H = 20 + n * (CW * z + 10), 20 + len(ROWS) * (CH * z + 26)
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    c = colors("encre")
    for r, (name, frames) in enumerate(ROWS):
        y = 20 + r * (CH * z + 26)
        d.text((20, y - 14), name, fill=(220, 214, 196))
        for i, f in enumerate(frames):
            cell = to_image(render(f), c, bg=PANEL + (255,)).resize((CW * z, CH * z), Image.NEAREST)
            dd = ImageDraw.Draw(cell)
            dd.rectangle([0, 31 * z + z, CW * z, CH * z], fill=(74, 58, 40))
            im.paste(cell, (20 + i * (CW * z + 10), y))
    im.save(out)


if __name__ == "__main__":
    board(sys.argv[1])
