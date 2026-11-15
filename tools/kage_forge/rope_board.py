"""Planche de design : KAGE tire la corde (zone 9 de la Forêt).

    python3 tools/kage_forge/rope_board.py <planche.png> [<cycle.gif>]
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from core import CH, CW, render  # noqa: E402
from preview import to_image  # noqa: E402
import rope  # noqa: E402

SKINS = Path(__file__).parents[2] / "assets" / "characters" / "kage" / "skins"
ROPE = [(62, 48, 32), (92, 74, 46), (125, 102, 64), (160, 135, 86)]
BG, PANEL = (16, 20, 24), (54, 66, 74)


def skin(name):
    return json.loads((SKINS / f"{name}.json").read_text())["colors"]


def cell(g, i, colors, z, bg=PANEL, haul=0):
    """Une image agrandie ×z, la corde tracée des mains à l'épaule, puis en arrière jusqu'au bord."""
    im = to_image(g, colors, bg=bg + (255,)).resize((CW * z, CH * z), Image.NEAREST)
    d = ImageDraw.Draw(im)
    gx, gy = rope.ROPE_GRIP[i]
    sx, sy = rope.ROPE_SHOULDER[i]
    pts = [(gx + 0.5, gy + 0.5), (sx + 0.5, sy + 0.5), (-2, sy + 2.5)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n):
            x = x0 + (x1 - x0) * k / n
            y = y0 + (y1 - y0) * k / n
            c = ROPE[2] if (int(x) + haul) % 2 else ROPE[1]
            d.rectangle([int(x) * z, int(y) * z, int(x) * z + z - 1, int(y) * z + z - 1], fill=c)
    # le sol (la grande branche)
    d.rectangle([0, 31 * z, CW * z, CH * z], fill=(74, 52, 32))
    return im


def board(out, gif=None):
    frames = [render(f) for f in rope.ROPE_PULL]
    z = 8
    W = 16 + len(frames) * (CW * z + 12)
    H = 16 + 2 * (CH * z + 12)
    im = Image.new("RGB", (W, H), BG)
    for row, name in enumerate(["encre", "voyageur"]):
        for i, g in enumerate(frames):
            im.paste(cell(g, i, skin(name), z, haul=i), (16 + i * (CW * z + 12), 16 + row * (CH * z + 12)))
    im.save(out)
    if gif:
        seq = []
        for k in range(16):
            i = k % len(frames)
            seq.append(cell(frames[i], i, skin("encre"), 4, haul=k).convert("RGB"))
        seq[0].save(gif, save_all=True, append_images=seq[1:], loop=0,
                    duration=[rope.ROPE_PULL_DURATIONS[k % 4] for k in range(16)])


if __name__ == "__main__":
    board(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
