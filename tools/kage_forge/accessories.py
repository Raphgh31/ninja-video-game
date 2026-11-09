"""Accessoires des skins de KAGE (chapeau, cordelette…).

Un skin = une palette (slot -> couleur) + des accessoires. Les accessoires ne
sont pas dessinés dans les poses : la tête de profil a toujours la même forme,
on la retrouve dans chaque image et on y pose l'accessoire (avec son propre
contour, sur le fond seulement). Ils peuvent changer la silhouette (accord de
l'utilisateur), jamais les animations ni la boîte de collision.

build.py exporte, pour chaque skin qui en a, un calque d'index séparé
(kage_acc_<skin>_index.png) que le jeu pose par-dessus la planche du skin.
"""
import numpy as np

from core import CH, CW

# ---------------------------------------------------------------------------
# Chapeaux (tampons ASCII) : r bord (ombre) · p paille ombre · P paille · Q lumière
# (dx, dy) = coin haut-gauche du tampon par rapport à la tête (hx, hy)
# ---------------------------------------------------------------------------
HATS = {
    # sugegasa : chapeau conique de paille, rayons tressés, petite pointe ;
    # le bord recouvre la ligne du bandeau (posé bas sur la tête)
    "sugegasa": dict(dx=-2, dy=-1, text="""
.......rQ.......
......pPPQ......
....pPpPPPQQ....
..pPPpPPPPpPQQ..
pPpPPPPpPPPPPPQQ
rrrrrrrrrrrrrrrr
"""),
}

# lignes 1 à 3 de toutes les têtes de profil (head_r, head_r_up, head_r_squint…),
# et de la tête vue de dos (head_bs : KAGE qui entre dans la porte du temple)
HEAD_TOP = ["...hhHHHHI..", "..hHHHHHHHI.", ".hhHHHHHHHHI"]
HEAD_TOP_BACK = ["...hhHHhh...", "..hHHHHHHh..", ".hHKHHHHKHh."]


def _rows(text):
    return [r for r in text.strip("\n").splitlines() if r.strip()]


_HEAD_PTS = [(i, k, c) for k, row in enumerate(HEAD_TOP) for i, c in enumerate(row) if c != "."]
_HEAD_PTS_BACK = [(i, k, c) for k, row in enumerate(HEAD_TOP_BACK) for i, c in enumerate(row) if c != "."]
# la lame ou les mains peuvent passer devant le haut de la tête (sabre levé) :
# on accepte quelques pixels masqués
HEAD_MIN = 0.8


def find_head(g):
    """(hx, hy) de la tête (de profil, ou de dos) dans la grille (meilleure correspondance), ou None."""
    for pts in (_HEAD_PTS, _HEAD_PTS_BACK):
        best, pos = 0, None
        for y in range(CH - 3):
            for x in range(-1, CW - 11):
                n = sum(1 for i, k, c in pts
                        if 0 <= x + i < CW and g[y + k, x + i] == c)
                if n > best:
                    best, pos = n, (x, y - 1)
        if best >= HEAD_MIN * len(pts):
            return pos
    return None


# pixels que le chapeau ne recouvre jamais : lame, poignée, mains, avant-bras
# (sabre levé au-dessus de la tête, lame qui passe devant le visage)
KEEP = set("WwgNnAa")


def hat(name):
    H = HATS[name]
    rows = _rows(H["text"])

    def put(g):
        pos = find_head(g)
        if pos is None:
            return g, False
        hx, hy = pos
        g = g.copy()
        mask = np.zeros(g.shape, bool)
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c == ".":
                    continue
                x, y = hx + H["dx"] + i, hy + H["dy"] + j
                if 0 <= x < CW and 0 <= y < CH and g[y, x] not in KEEP:
                    g[y, x] = c
                    mask[y, x] = True
        # contour du chapeau, sur le fond seulement : sous le bord, il touche la
        # tête directement (le liseré sombre du bord suffit, pas de double trait)
        for y in range(CH):
            for x in range(CW):
                if mask[y, x] or g[y, x] != ".":
                    continue
                if any(0 <= x + dx < CW and 0 <= y + dy < CH and mask[y + dy, x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    g[y, x] = "O"
        return g, True
    return put


def cord(g):
    """Cordelette en bandoulière, de l'épaule avant à la hanche arrière, posée
    seulement sur la tunique (jamais sur un bras ou une main)."""
    for y in range(CH):
        x = "".join(g[y]).find("lLL")      # bord arrière de la ceinture
        if x < 0:
            continue
        g = g.copy()
        for k in range(4):
            cx, cy = x + 5 - k, y - 4 + k
            if 0 <= cy and g[cy, cx] in "tTU":
                g[cy, cx] = "c" if k % 2 else "C"
        return g, True
    return g, False


def accessory(name):
    if name == "cord":
        return cord
    return hat(name)


def dress(g, names):
    """Grille habillée des accessoires (dans l'ordre : la cordelette avant le chapeau)."""
    for n in names:
        g, _ = accessory(n)(g)
    return g


def overlay(g, names):
    """Calque d'accessoires seul : les pixels qui changent une fois habillé."""
    d = dress(g, names)
    out = np.full(g.shape, ".", dtype="<U1")
    m = d != g
    out[m] = d[m]
    return out
