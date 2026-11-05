"""Rig de pose pour KAGE.

Ce n'est pas une animation automatique : chaque frame est une pose dont toutes
les articulations (coudes, mains, genoux, chevilles, points du foulard) sont
placées à la main. Le rig garantit seulement que les pièces dessinées à la main
(tête, torses, pieds, mains) gardent exactement les mêmes dimensions d'une
frame à l'autre, et que les membres ont une épaisseur constante.

Après la pose, des retouches pixel par pixel (blocs A) peuvent être appliquées.
"""
import numpy as np

from core import CELL, CH, CW, STAMPS, A, S, parse, stamp

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
# coup de pied de côté : buste qui part en arrière (épaules derrière les hanches)
TORSOS["back"] = dict(text="""
tTTUU...
tTTTTUU.
.tTTTTU.
.tTTTTTU
..tTTTUU
..lLLLLl
..tTTTTU
""", neck=(1, 0), sh_near=(3, 1), sh_far=(1, 1), hip_near=(5, 6), hip_far=(3, 6))
# glissade : assis sur la hanche, buste incliné en arrière (~45°), fesses au sol
TORSOS["recline"] = dict(text="""
tTTUU...
.tTTTUU.
..tTTTTU
..lLLLLl
..tTTTTU
.ttTTTTU
""", neck=(1, 0), sh_near=(3, 1), sh_far=(2, 1), hip_near=(6, 4), hip_far=(4, 4))
for k, v in TORSOS.items():
    stamp("torso_" + k, v["text"])

FEET = {
    # pieds tournés vers la droite ; l'origine est la cheville (coin haut-gauche)
    "flat": "DD.\nDDDD",
    "point": "DDD\n.DD",     # pied tendu (pointe vers l'avant/bas)
    "down": "DD\nDD\n.D",    # pointe vers le bas (jambe arrière levée)
    "back": "DDD\nD..",      # semelle vers l'arrière (poussée)
    "tuck": "DD\nDDD",
    # pied fléchi (coup de pied de côté) : talon en avant, orteils vers le haut.
    # Posé au bout du tibia et remonte au-dessus (voir FOOT_OFFSET).
    "flex": ".D\nDD\nDD\nDD",
}
FOOT_OFFSET = {"flex": (2, -2)}   # décalage depuis la cheville (par défaut : (0, 1), sous la cheville)
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
    """Toile de pose (voir aussi sword() pour le sabre tenu en main)."""
    def __init__(self):
        self.g = np.full((CH, CW), ".", dtype="<U1")

    def put(self, x, y, c):
        if 0 <= x < CW and 0 <= y < CH:
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
        mask = np.zeros((CH, CW), bool)
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
                    if 0 <= nx < CW and 0 <= ny < CH and not mask[ny, nx] \
                            and self.g[ny, nx] in "tTUlL":
                        self.g[ny, nx] = "O"
        for (x, y), c in layer.items():
            self.put(x, y, c)
        return mask

    def sword(self, hand, tip):
        """Sabre tenu dans la main (coin haut-gauche du tampon 2x2) : pommeau et
        garde en g, lame de 2 px (fil en acier W, dos en ombre w), pointe d'1 px."""
        cx, cy = hand[0] + 1, hand[1] + 1
        path = _line((cx, cy), tip)
        dx, dy = tip[0] - cx, tip[1] - cy
        n = max(abs(dx), abs(dy)) or 1
        pommel = (round(cx - dx / n * 2), round(cy - dy / n * 2))
        self.put(*pommel, "g")
        # épaisseur : décalage perpendiculaire d'1 px (sous la lame si elle est
        # plutôt horizontale, derrière elle si elle est plutôt verticale)
        ox, oy = ((0, 1) if abs(dx) >= abs(dy) else (-1 if dy < 0 else 1, 0))
        last = len(path) - 1
        for i, (x, y) in enumerate(path):
            if 2 <= i < last - 1:
                self.put(x + ox, y + oy, "w")
        for i, p in enumerate(path):
            if i <= 1:
                self.put(*p, "g")          # poignée + garde
            else:
                self.put(*p, "w" if i == last else "W")

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
         collar=True, hands=True, long_colors="GGFG", short_colors="ffF", blade=None,
         near_behind=False, back_arm=None, far_hand="hand_far"):
    """Construit une frame.

    near_arm/far_arm : [coude, main] (points absolus, coin haut-gauche 2x2)
    back_arm : [coude, main] d'un bras passé derrière le dos (part de l'épaule
               proche, dessiné sous le buste : seule la main dépasse)
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
            c.stamp(far_hand, *far_arm[-1])
    if back_arm:
        c.limb([sn] + back_arm, ["t", "a"])
        if hands:
            c.stamp("hand", *back_arm[-1])
    if far_leg:
        c.limb([hf] + far_leg, ["t", "t"])
        ax, ay = far_leg[-1]
        c.stamp(f"foot_{far_foot}_far", ax, ay + 1)
    c.stamp("torso_" + torso, tx, ty)
    if near_leg:
        c.limb([hn] + near_leg, ["T", "T"], sep=True)
        ax, ay = near_leg[-1]
        ox, oy = FOOT_OFFSET.get(near_foot, (0, 1))
        c.stamp(f"foot_{near_foot}", ax + ox, ay + oy)
    def draw_near_arm():
        c.limb([sn] + near_arm, ["T", "A"], sep=True)
        if blade:
            c.sword(near_arm[-1], blade)
        if hands:
            c.stamp("hand", *near_arm[-1])

    # bras levés au-dessus de la tête : dessinés derrière la tête (visage dégagé)
    if near_arm and near_behind:
        draw_near_arm()
    c.stamp(head, hx, hy)
    c.stamp("bow_r", hx - 1, hy + 2)
    if collar:
        c.stamp("collar_r", *collar_at)
    if near_arm and near_behind:
        # les mains et la lame restent visibles au-dessus de la tête
        if blade:
            c.sword(near_arm[-1], blade)
        if hands:
            c.stamp("hand", *near_arm[-1])
    if near_arm and not near_behind:
        c.limb([sn] + near_arm, ["T", "A"], sep=True)
        if blade:
            c.sword(near_arm[-1], blade)
        if hands:
            c.stamp("hand", *near_arm[-1])
    return c.g
