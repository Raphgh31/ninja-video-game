"""Planche de design : KAGE sur une liane (accroché, balancé, grimpe).

    python3 tools/kage_forge/vine_board.py <sortie.png>
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from core import CH, CW, render  # noqa: E402
from preview import to_image  # noqa: E402
import vine  # noqa: E402

Z = 6
BG = (13, 19, 23)
PANEL = (63, 154, 163)           # la brume du sous-bois
INK, MUTED = (233, 229, 218), (143, 163, 160)
VINE = [(22, 105, 74), (46, 139, 87), (85, 174, 84)]


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def cell(frame, angle=0.0):
    """Une image, à la taille du jeu, sur fond de sous-bois, avec la liane derrière."""
    W, H = CW + 8, CH + 22
    ox, oy = 4, 18
    img = Image.new("RGBA", (W, H), PANEL + (255,))
    px = img.load()
    gx, gy = ox + vine.GRIP[0], oy + vine.GRIP[1] + 1
    # la liane : un trait de deux pixels qui passe par les mains, feuilles alternées
    for s in range(-40, 60):
        x = gx + math.sin(angle) * s * -1 if s < 0 else gx - math.sin(angle) * s
        x = gx - math.sin(angle) * s
        y = gy + math.cos(angle) * s
        xi, yi = int(round(x)), int(round(y))
        for k in (0, 1):
            if 0 <= xi + k < W and 0 <= yi < H:
                px[xi + k, yi] = VINE[k] + (255,)
        if s % 5 == 0:
            side = -1 if (s // 5) % 2 else 2
            for (dx, dy, c) in ((side, 0, 2), (side + (1 if side > 0 else -1), 1, 1)):
                if 0 <= xi + dx < W and 0 <= yi + dy < H:
                    px[xi + dx, yi + dy] = VINE[c] + (255,)
    img.alpha_composite(to_image(render(frame)), (ox, oy))
    return img


def row(draw, out, y, title, note, frames, angles=None):
    draw.text((24, y), title, font=font(20), fill=INK)
    draw.text((24, y + 28), note, font=font(14), fill=MUTED)
    x = 24
    for i, f in enumerate(frames):
        c = cell(f, angles[i] if angles else 0.0)
        out.paste(c.resize((c.width * Z, c.height * Z), Image.NEAREST), (x, y + 56))
        x += c.width * Z + 12
    return y + 56 + (CH + 22) * Z + 26


def main(dest):
    n = 5
    W = 24 * 2 + n * (CW + 8) * Z + (n - 1) * 12
    out = Image.new("RGB", (W, 60 + 3 * (56 + (CH + 22) * Z + 26) + 40), BG)
    d = ImageDraw.Draw(out)
    d.text((24, 16), "KAGE sur une liane — nouvelles animations (chapitre 2)", font=font(26), fill=INK)
    y = 62
    y = row(d, out, y, "Accroché", "Deux images : le corps pend, les jambes bougent à peine. La liane passe derrière ses mains.", vine.VINE_HANG)
    a = [0.6, 0.3, 0.0, -0.3, -0.6]
    y = row(d, out, y, "Balancé", "Cinq images, de l'arrière à l'avant : le jeu choisit l'image selon l'angle de la liane (le sprite n'est jamais tourné).", vine.VINE_SWING, a)
    y = row(d, out, y, "Grimpe", "Quatre images en boucle : une main après l'autre, les genoux remontent à tour de rôle (lianes de la statue).", vine.VINE_CLIMB)
    d.text((24, y - 8), "Lâcher : les animations de saut et de chute existantes. Dessins avant l'agrandissement de 20 % de l'export ; boîtes de collision inchangées.", font=font(14), fill=MUTED)
    out.save(dest)
    print(dest)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "vine_board.png")
