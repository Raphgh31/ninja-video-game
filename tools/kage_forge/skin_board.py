"""Planche de design d'un skin de KAGE (avant intégration en jeu).

usage : python3 skin_board.py <id> <sortie.png> [référence.png x0 y0 x1 y1]

Un skin = une palette (slot -> couleur) + éventuellement un accessoire posé
sur la tête (chapeau…), dessiné ici par-dessus chaque image : la tête de
profil a toujours la même forme, on la retrouve dans l'image et on y pose
l'accessoire, puis on lui ajoute son propre contour.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from art import ANIMS  # noqa: E402
from core import CH, CW, render  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ENCRE = json.loads((ROOT / "assets/characters/kage/skins/encre.json").read_text())["colors"]

# ---------------------------------------------------------------------------
# Accessoires (tampons ASCII) : slots du chapeau
#   r  dessous du bord (ombre) · p paille ombre · P paille · Q paille éclairée
# ---------------------------------------------------------------------------
HATS = {
    # sugegasa : grand chapeau conique de paille, rayons tressés, petite pointe.
    # (dx, dy) = position du coin haut-gauche par rapport à la tête (hx, hy)
    "sugegasa": dict(dx=-2, dy=-1, text="""
.......rQ.......
......pPPQ......
....pPpPPPQQ....
..pPPpPPPPpPQQ..
pPpPPPPpPPPPPPQQ
rrrrrrrrrrrrrrrr
"""),
}

SKINS = {
    "vagabond": dict(
        name="Le vagabond",
        rarity="Commun",
        hat="sugegasa",
        cord=True,
        colors={**ENCRE,
                # capuche, tenue : bleu nuit au lieu du noir
                "h": "#141824", "H": "#1f2636", "I": "#3a4661",
                "M": "#0b0d13",
                "t": "#141925", "T": "#212939", "U": "#3a4559",
                # pièces vert mousse : avant-bras, pan de ceinture
                "a": "#3a4931", "A": "#5e7246",
                "l": "#2c3826", "L": "#4b5d3c",
                "d": "#0d0f15", "D": "#252a35",
                # foulard ardoise
                "f": "#181c26", "F": "#2b313f", "G": "#485164",
                "k": "#2b313f", "K": "#485164",
                # chapeau de paille
                "c": "#c9a246", "C": "#8e6d2a", "r": "#3e2c1a", "p": "#8d6a38", "P": "#b88f4f", "Q": "#dcbc7c"},
    ),
}

HEAD_TOP = ["...hhHHHHI..", "..hHHHHHHHI.", ".hhHHHHHHHHI"]   # lignes 1-3 des têtes de profil


def parse(text):
    rows = [r for r in text.strip("\n").splitlines() if r.strip()]
    return rows


def find_head(g):
    """(hx, hy) de la tête de profil dans la grille, ou None."""
    for y in range(CH - 3):
        for x in range(-1, CW - 11):
            ok = True
            for k, row in enumerate(HEAD_TOP):
                for i, c in enumerate(row):
                    if c == ".":
                        continue
                    gx = x + i
                    if not (0 <= gx < CW) or g[y + k, gx] != c:
                        ok = False
                        break
                if not ok:
                    break
            if ok:
                return x, y - 1
    return None


def with_hat(g, hat):
    g = g.copy()
    pos = find_head(g)
    if pos is None:
        return g, False
    hx, hy = pos
    H = HATS[hat]
    rows = parse(H["text"])
    mask = np.zeros(g.shape, bool)
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c == ".":
                continue
            x, y = hx + H["dx"] + i, hy + H["dy"] + j
            if 0 <= x < CW and 0 <= y < CH:
                g[y, x] = c
                mask[y, x] = True
    # contour propre au chapeau (voisinage 4), par-dessus le reste
    for y in range(CH):
        for x in range(CW):
            if mask[y, x]:
                continue
            if any(0 <= x + dx < CW and 0 <= y + dy < CH and mask[y + dy, x + dx]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                # contour seulement sur le fond : sous le bord, le chapeau touche la tête
                # directement (le liseré sombre du bord suffit, pas de double trait noir)
                if g[y, x] == ".":
                    g[y, x] = "O"
    return g, True


BELT = "lLLLLLl"


def with_cord(g):
    """Cordelette dorée en bandoulière (de l'épaule avant à la hanche arrière),
    posée seulement sur la tunique (jamais sur un bras ou une main)."""
    g = g.copy()
    for y in range(CH):
        row = "".join(g[y])
        x = row.find("lLL")      # bord arrière de la ceinture
        if x < 0:
            continue
        for k in range(4):        # de l'épaule avant à la hanche arrière
            cx, cy = x + 5 - k, y - 4 + k
            if 0 <= cy and g[cy, cx] in "tTU":
                g[cy, cx] = "c" if k % 2 else "C"
        return g
    return g


def dress(g, S):
    if S.get("cord"):
        g = with_cord(g)
    return with_hat(g, S["hat"])


def to_img(g, colors, bg=None):
    im = Image.new("RGBA", (CW, CH), bg or (0, 0, 0, 0))
    px = im.load()
    for y in range(CH):
        for x in range(CW):
            c = g[y, x]
            if c != ".":
                h = colors[c].lstrip("#")
                px[x, y] = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    return im


def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",):
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    sid, out = sys.argv[1], sys.argv[2]
    ref = None
    if len(sys.argv) > 3:
        x0, y0, x1, y1 = map(int, sys.argv[4:8])
        ref = Image.open(sys.argv[3]).convert("RGB").crop((x0, y0, x1, y1))
    S = SKINS[sid]
    PAPER, INK = (243, 236, 224), (40, 36, 32)
    poses = [("idle", 0), ("idle", 2), ("run", 0), ("run", 3), ("sprint", 1), ("jump", 1),
             ("fall", 1), ("dash", 2), ("attack", 3), ("kick", 3), ("throw", 3), ("slide", 1),
             ("wall_slide", 0), ("air_attack", 2), ("hurt", 0), ("walk", 1)]
    z = 6
    W = 1500
    img = Image.new("RGB", (W, 1130), PAPER)
    d = ImageDraw.Draw(img)
    d.text((40, 28), f"Skin — {S['name']}", fill=INK, font=font(30))
    d.text((40, 70), f"{S['rarity']} · palette + chapeau ({S['hat']}) · même animation, même boîte de collision",
            fill=(110, 100, 90), font=font(16))

    # 1. grand : avant (Encre) / après / référence
    zz = 12
    base = render(ANIMS["idle"]["frames"][0])
    hat, _ = dress(base, S)
    y0 = 110
    for i, (lab, g, cols) in enumerate((("Encre (actuel)", base, ENCRE), (S["name"], hat, S["colors"]))):
        im = to_img(g, cols).crop((0, 2, 32, 32)).resize((32 * zz, 30 * zz), Image.NEAREST)
        img.paste(im, (40 + i * 420, y0 + 28), im)
        d.text((40 + i * 420, y0), lab, fill=INK, font=font(18))
    if ref is not None:
        r = ref.resize((int(ref.width * 360 / ref.height), 360), Image.LANCZOS)
        img.paste(r, (900, y0 + 28))
        d.text((900, y0), "Référence (ta planche, n° 1)", fill=INK, font=font(18))

    # 2. poses clés
    y1 = 530
    d.text((40, y1), "Dans les animations", fill=INK, font=font(18))
    ok_all = True
    for k, (a, f) in enumerate(poses):
        g, ok = dress(render(ANIMS[a]["frames"][f]), S)
        ok_all &= ok
        im = to_img(g, S["colors"]).resize((CW * z, CH * z), Image.NEAREST)
        cx, cy = 40 + (k % 8) * 180, y1 + 30 + (k // 8) * 200
        img.paste(im, (cx - 20, cy), im)
        d.text((cx, cy + CH * z - 6), f"{a} {f}", fill=(120, 110, 100), font=font(13))

    # 3. taille réelle et ×2, sur un fond du potager
    y2 = 1050
    d.text((40, y2), "Taille réelle / ×2 / ×3", fill=INK, font=font(16))
    for i, s in enumerate((1, 2, 3)):
        im = to_img(hat, S["colors"]).resize((CW * s, CH * s), Image.NEAREST)
        img.paste(im, (300 + i * 120, y2 - 20 * (s - 1)), im)

    # 4. palette
    px0 = 760
    d.text((px0, y2), "Palette", fill=INK, font=font(16))
    groups = [("capuche", "hHI"), ("tenue", "tTU"), ("vert mousse", "aAlL"), ("foulard", "fFG"), ("paille", "rpPQ"), ("cordelette", "Cc")]
    xx = px0 + 80
    for name, slots in groups:
        for j, c in enumerate(slots):
            h = S["colors"][c].lstrip("#")
            d.rectangle((xx + j * 18, y2 - 2, xx + j * 18 + 16, y2 + 14),
                        fill=tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)))
        d.text((xx, y2 + 20), name, fill=(120, 110, 100), font=font(12))
        xx += len(slots) * 18 + 40
    img.save(out)
    print("chapeau posé sur toutes les poses :", ok_all)


if __name__ == "__main__":
    main()
