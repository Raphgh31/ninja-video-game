"""Rig de pose pour KAGE.

Ce n'est pas une animation automatique : chaque frame est une pose dont toutes
les articulations (coudes, mains, genoux, chevilles, points du foulard) sont
placées à la main. Le rig garantit seulement que les pièces dessinées à la main
(tête, torses, pieds, mains) gardent exactement les mêmes dimensions d'une
frame à l'autre, et que les membres ont une épaisseur constante.

Après la pose, des retouches pixel par pixel (blocs A) peuvent être appliquées.
"""
import numpy as np

from core import CELL, STAMPS, A, S, parse, stamp

# ---------------------------------------------------------------------------
# Tampons dessinés à la main
# ---------------------------------------------------------------------------

# Tête de profil droit : capuche arrondie, bandeau de foulard au front (G),
# noué derrière la tête (K/k) ; les deux pans du foulard partent de ce nœud.
stamp("head_r", """
............
...hhHHHHI..
..hHHHHHHHI.
.hhHHHHHHHHI
KKGGGGGGGGII
KkhHHnnnnnn.
.khHHNENNEN.
.hhHHNENNEN.
..hhHHHHHH..
...hhhHH....
""")

# Regard vers le haut (saut, dash vertical).
stamp("head_r_up", """
............
...hhHHHHI..
..hHHHHHHHI.
.hhHHHHHHHHI
KKGGGGGGGGII
KkhHHNENNEN.
.khHHNENNEN.
.hhHHnNNNNN.
..hhHHHHHH..
...hhhHH....
""")

# Yeux plissés (élan du dash, impact).
stamp("head_r_squint", """
............
...hhHHHHI..
..hHHHHHHHI.
.hhHHHHHHHHI
KKGGGGGGGGII
KkhHHnnnnnn.
.khHHnNNNNN.
.hhHHEENEEN.
..hhHHHHHH..
...hhhHH....
""")

# Col de la tunique, posé sous la tête.
# Nœud papillon du bandeau (deux boucles), posé derrière la tête.
stamp("bow_r", """
K.
KK
kK
KK
K.
""")

stamp("collar_r", """
FFFGGGF
fFFFFF.
""")

# Torses (épaules -> ceinture -> pan de tunique). Ancrages en coordonnées locales.
TORSOS = {
    "up": dict(text="""
.tTTUU.
tTTTTUU
tTTTTTU
tTTTTTU
tTTTTUU
lLLLLLl
tTTTTTU
""", neck=(0, 0), sh_near=(3, 1), sh_far=(1, 1), hip_near=(4, 6), hip_far=(1, 6)),
    "lean": dict(text="""
..tTTUU
.tTTTTUU
.tTTTTTU
tTTTTTU.
tTTTTUU.
lLLLLLl.
tTTTTTU.
""", neck=(1, 0), sh_near=(4, 1), sh_far=(2, 1), hip_near=(4, 6), hip_far=(1, 6)),
    "crouch": dict(text="""
.tTTUU.
tTTTTUU
tTTTTTU
lLLLLLl
tTTTTTU
""", neck=(0, 0), sh_near=(3, 1), sh_far=(1, 1), hip_near=(4, 4), hip_far=(1, 4)),
    "dive": dict(text="""
...tTTU
..tTTTUU
.tTTTTUU
tTTTTUU.
lLLLLl..
tTTTU...
""", neck=(2, 0), sh_near=(5, 1), sh_far=(3, 1), hip_near=(3, 5), hip_far=(1, 5)),
    "flat": dict(text="""
....tTTUU
.tTTTTTUU
tTTTTTTTU
lLtTTTTU.
tTl......
""", neck=(4, 0), sh_near=(6, 1), sh_far=(4, 1), hip_near=(2, 4), hip_far=(0, 4)),
}
for k, v in TORSOS.items():
    stamp("torso_" + k, v["text"])

FEET = {
    # pieds tournés vers la droite ; l'origine est la cheville (coin haut-gauche)
    "flat": "DD.\nDDDD",
    "point": "DDD\n.DD",     # pied tendu (pointe vers l'avant/bas)
    "down": "DD\nDD\n.D",    # pointe vers le bas (jambe arrière levée)
    "back": "DDD\nD..",      # semelle vers l'arrière (poussée)
    "tuck": "DD\nDDD",
}
for k, v in FEET.items():
    stamp("foot_" + k, v)
    stamp("foot_" + k + "_far", v.replace("D", "d"))

stamp("hand", "NN\nNn")
stamp("hand_far", "nn\nnn")


# ---------------------------------------------------------------------------
# Dessin
# ---------------------------------------------------------------------------

def _line(p0, p1):
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


class Canvas:
    def __init__(self):
        self.g = np.full((CELL, CELL), ".", dtype="<U1")

    def put(self, x, y, c):
        if 0 <= x < CELL and 0 <= y < CELL:
            self.g[y, x] = c
        else:
            raise ValueError(f"pixel hors cellule ({x},{y})")

    def blit(self, grid, x, y):
        h, w = grid.shape
        for gy in range(h):
            for gx in range(w):
                if grid[gy, gx] != ".":
                    self.put(x + gx, y + gy, grid[gy, gx])

    def stamp(self, name, x, y):
        self.blit(STAMPS[name], x, y)

    def limb(self, pts, colors, sep=False):
        """Membre de 2 px d'épaisseur passant par pts ; colors[i] pour le segment i.
        sep=True : liseré sombre là où le membre recouvre le corps (lisibilité)."""
        mask = np.zeros((CELL, CELL), bool)
        layer = {}
        for i in range(len(pts) - 1):
            for (x, y) in _line(pts[i], pts[i + 1]):
                for bx in (0, 1):
                    for by in (0, 1):
                        layer[(x + bx, y + by)] = colors[i]
                        mask[y + by, x + bx] = True
        if sep:
            for (x, y) in list(layer):
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < CELL and 0 <= ny < CELL and not mask[ny, nx] \
                            and self.g[ny, nx] in "tTUlL":
                        self.g[ny, nx] = "O"
        for (x, y), c in layer.items():
            self.put(x, y, c)
        return mask

    def ribbon(self, pts, colors, length):
        """Pan de foulard d'1 px suivant une polyligne, tronqué à `length` pixels :
        le tissu garde toujours la même longueur, seule sa forme change."""
        path = []
        for k in range(len(pts) - 1):
            for p in _line(pts[k], pts[k + 1]):
                if not path or path[-1] != p:
                    path.append(p)
        if len(path) < length:
            # prolonge dans la direction du dernier segment
            (x0, y0), (x1, y1) = pts[-2], pts[-1]
            far = (x1 + (x1 - x0) * 4, y1 + (y1 - y0) * 4)
            for p in _line(pts[-1], far)[1:]:
                path.append(p)
                if len(path) >= length:
                    break
        for i, p in enumerate(path[:length]):
            self.put(p[0], p[1], colors[i % len(colors)])


LONG_TAIL = 10   # longueur constante du pan long (px)
SHORT_TAIL = 6   # longueur constante du pan court (px)


def pose(*, torso, tx, ty, head="head_r", hx=None, hy=None,
         near_arm=None, far_arm=None, near_leg=None, far_leg=None,
         near_foot="flat", far_foot="flat", tail_long=None, tail_short=None,
         collar=True, hands=True, long_colors="GGFG", short_colors="ffF"):
    """Construit une frame.

    near_arm/far_arm : [coude, main] (points absolus, coin haut-gauche 2x2)
    near_leg/far_leg : [genou, cheville]
    tail_long/tail_short : points du foulard, relatifs au nœud (dx, dy)
    Par défaut la tête se pose au-dessus du cou du torse.
    """
    T = TORSOS[torso]
    c = Canvas()
    nx, ny = tx + T["neck"][0], ty + T["neck"][1]
    if hx is None:
        hx, hy = nx - 2, ny - 10
    collar_at = (hx + 2, hy + 9)
    kx, ky = hx, hy + 4          # nœud du bandeau, derrière la tête
    if tail_short:
        c.ribbon([(kx - 1, ky + 1)] + [(kx + dx, ky + dy) for dx, dy in tail_short],
                 short_colors, SHORT_TAIL)
    if tail_long:
        c.ribbon([(kx - 1, ky)] + [(kx + dx, ky + dy) for dx, dy in tail_long],
                 long_colors, LONG_TAIL)
    sf = (tx + T["sh_far"][0], ty + T["sh_far"][1])
    sn = (tx + T["sh_near"][0], ty + T["sh_near"][1])
    hf = (tx + T["hip_far"][0], ty + T["hip_far"][1])
    hn = (tx + T["hip_near"][0], ty + T["hip_near"][1])
    if far_arm:
        c.limb([sf] + far_arm, ["t", "a"])
        if hands:
            c.stamp("hand_far", *far_arm[-1])
    if far_leg:
        c.limb([hf] + far_leg, ["t", "t"])
        ax, ay = far_leg[-1]
        c.stamp(f"foot_{far_foot}_far", ax, ay + 1)
    c.stamp("torso_" + torso, tx, ty)
    if near_leg:
        c.limb([hn] + near_leg, ["T", "T"], sep=True)
        ax, ay = near_leg[-1]
        c.stamp(f"foot_{near_foot}", ax, ay + 1)
    c.stamp(head, hx, hy)
    c.stamp("bow_r", hx - 1, hy + 2)
    if collar:
        c.stamp("collar_r", *collar_at)
    if near_arm:
        c.limb([sn] + near_arm, ["T", "A"], sep=True)
        if hands:
            c.stamp("hand", *near_arm[-1])
    return c.g
