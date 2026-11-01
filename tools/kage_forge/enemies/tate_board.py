"""Planche de présentation de TATE : python3 tools/kage_forge/enemies/tate_board.py"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from tate import PAL, POSES, H, W  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "docs/enemies"
BG = (139, 152, 168)
INK = (24, 26, 32)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def img(grid, pal=PAL):
    im = Image.new("RGBA", (grid.shape[1], grid.shape[0]), (0, 0, 0, 0))
    px = im.load()
    for y in range(grid.shape[0]):
        for x in range(grid.shape[1]):
            c = grid[y, x]
            if c != ".":
                px[x, y] = rgb(pal[c]) + (255,)
    return im


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    Z = 6
    names = {"marche_1": "MARCHE 1", "marche_2": "MARCHE 2", "garde": "GARDE (coup bloqué)",
             "coup_de_bouclier": "COUP DE BOUCLIER", "etourdi": "ÉTOURDI", "vaincu": "VAINCU"}
    cw, ch = W * Z, H * Z
    cols = 3
    rows = (len(POSES) + cols - 1) // cols
    BW = 40 + cols * (cw + 24)
    BH = 110 + rows * (ch + 50) + 330
    board = Image.new("RGB", (BW, BH), (226, 222, 212))
    d = ImageDraw.Draw(board)
    d.text((40, 28), "TATE — garde au bouclier", fill=INK, font=font(30))
    d.text((40, 70), "Proposition de design · cellule 48×32 comme KAGE · point faible : le talisman dans le dos",
           fill=(80, 80, 86), font=font(15))
    for i, (k, g) in enumerate(POSES.items()):
        x = 40 + (i % cols) * (cw + 24)
        y = 110 + (i // cols) * (ch + 50)
        d.rectangle([x, y, x + cw - 1, y + ch - 1], fill=BG)
        big = img(g).resize((cw, ch), Image.NEAREST)
        board.paste(big, (x, y), big)
        d.text((x, y + ch + 8), names[k], fill=INK, font=font(16))

    # comparaison de taille avec KAGE (même échelle), puis taille réelle
    y0 = 110 + rows * (ch + 50) + 10
    d.text((40, y0), "Échelle : TATE à côté de KAGE", fill=INK, font=font(16))
    kage_sheet = Image.open(ROOT / "assets/characters/kage/anims/kage_idle.png")
    kage = kage_sheet.crop((0, 0, 48, 32))
    pair = Image.new("RGBA", (96, 32), BG + (255,))
    pair.paste(kage, (4, 0), kage)
    tate = img(POSES["marche_1"]).transpose(Image.FLIP_LEFT_RIGHT)   # face à KAGE
    pair.paste(tate, (44, 0), tate)
    big = pair.resize((96 * 4, 32 * 4), Image.NEAREST)
    board.paste(big, (40, y0 + 30))
    d.text((40 + 96 * 4 + 30, y0 + 30), "taille réelle ×2", fill=(80, 80, 86), font=font(13))
    board.paste(pair.resize((192, 64), Image.NEAREST), (40 + 96 * 4 + 30, y0 + 52))
    d.text((40 + 96 * 4 + 30, y0 + 130), "taille réelle", fill=(80, 80, 86), font=font(13))
    board.paste(pair, (40 + 96 * 4 + 30, y0 + 150))

    # palette
    px0 = 40 + 96 * 4 + 260
    d.text((px0, y0), "Palette", fill=INK, font=font(16))
    keys = [k for k in PAL if k not in "XxZ"]
    for j, k in enumerate(keys):
        x = px0 + (j % 8) * 34
        y = y0 + 30 + (j // 8) * 34
        d.rectangle([x, y, x + 26, y + 26], fill=rgb(PAL[k]), outline=(60, 60, 60))
    board.save(OUT / "tate_design.png")

    # marche animée
    frames = []
    for k in ("marche_1", "marche_2"):
        f = Image.new("RGBA", (W * 6, H * 6), BG + (255,))
        b = img(POSES[k]).resize((W * 6, H * 6), Image.NEAREST)
        f.paste(b, (0, 0), b)
        frames.append(f.convert("RGB"))
    frames[0].save(OUT / "tate_marche.gif", save_all=True, append_images=frames[1:], duration=260, loop=0)
    print(OUT / "tate_design.png")


if __name__ == "__main__":
    main()
