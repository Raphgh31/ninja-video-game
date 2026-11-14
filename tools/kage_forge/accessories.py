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

# lignes 1 à 3 de toutes les têtes de profil (head_r, head_r_up, head_r_squint…)
HEAD_TOP = ["...hhHHHHI..", "..hHHHHHHHI.", ".hhHHHHHHHHI"]


def _rows(text):
    return [r for r in text.strip("\n").splitlines() if r.strip()]


_HEAD_PTS = [(i, k, c) for k, row in enumerate(HEAD_TOP) for i, c in enumerate(row) if c != "."]
# la lame ou les mains peuvent passer devant le haut de la tête (sabre levé) :
# on accepte quelques pixels masqués
HEAD_MIN = 0.8


def find_head(g):
    """(hx, hy) de la tête de profil dans la grille (meilleure correspondance), ou None."""
    best, pos = 0, None
    for y in range(CH - 3):
        for x in range(-1, CW - 11):
            n = sum(1 for i, k, c in _HEAD_PTS
                    if 0 <= x + i < CW and g[y + k, x + i] == c)
            if n > best:
                best, pos = n, (x, y - 1)
    return pos if best >= HEAD_MIN * len(_HEAD_PTS) else None


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


# ---------------------------------------------------------------------------
# Accessoires des skins de novembre 2026 (planches de Raph, n° 1 à 10)
# Lettres : b B i équipement (ombre / base / lumière), j J second matériau,
# r p P Q paille (chapeaux), O trait sombre (fentes des yeux d'un masque…)
# ---------------------------------------------------------------------------
STAMPS = {
    # kabuto du samouraï déchu : bombe laquée, visière qui avance, liseré d'or au front, couvre-nuque
    # (shikoro) qui descend sur la nuque, kuwagata : deux cornes d'or en V au-dessus du front
    "kabuto": dict(dx=-1, dy=-7, text="""
..J.........J..
..J.........J..
...J.......J...
....J.....J....
.....jJ.Jj.....
......jJj......
.....bbBjBBi...
...bbBBBBBBBBi.
..bBBBBBBBBBBi.
..bBBBiBBBBBBBi
.bBBBBBBBBBBBBi
bbjJJJJJJJJJJJJ
bBBBb..........
bBBBBb.........
.bBBBb.........
..bbb..........
"""),
    # masque de renard (kitsune) : visage blanc, oreilles pointues dedans rouges, marques rouges au front
    # et aux joues, fentes des yeux, museau qui avance, nez rouge
    "kitsune": dict(dx=5, dy=-3, face=True, text="""
.B.....B..
.BB...jB..
.BjB.BjB..
.BBBBBBBi.
BBBBBBBBBi
BBBBBBBBBi
BJJBBBJJBi
BBBBBBBBBB
BOOBOOBBBi
BBJBBJBBBBi
.BBBBBBBBBJ
.bBBBBBBBb.
...bbbbb...
"""),
    # capuche pourpre : un capuchon arrondi qui couvre le haut et l'arrière de la tête, ombre le front,
    # et retombe en pan sur la nuque et les épaules
    "cowl": dict(dx=0, dy=-2, text="""
.bi...........
..bbBBBBi.....
.bBBBBBBBBBi..
bBBBBBBBBBBBi.
bBBBBBBBBBBBBi
bBBBBBBBBBBBBb
bBBBbb........
bBBBb.........
bBBBb.........
bBBBb.........
.bBBb.........
.bBBBb........
..bBBb........
...bb.........
"""),
}


def stamp(name):
    S = STAMPS[name]
    rows = _rows(S["text"])

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
                x, y = hx + S["dx"] + i, hy + S["dy"] + j
                # un masque couvre aussi la peau du visage (bande des yeux), jamais les mains
                face = S.get("face") and hy + 4 <= y <= hy + 9 and hx + 3 <= x <= hx + 13 and g[y, x] in "NnEe"
                if 0 <= x < CW and 0 <= y < CH and (g[y, x] not in KEEP or face):
                    g[y, x] = c
                    mask[y, x] = True
        _outline(g, mask)
        return g, True
    return put


def _outline(g, mask):
    for y in range(CH):
        for x in range(CW):
            if mask[y, x] or g[y, x] != ".":
                continue
            if any(0 <= x + dx < CW and 0 <= y + dy < CH and mask[y + dy, x + dx]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g[y, x] = "O"


BODY = set("tTUaAlLdD")        # le corps (tunique, bras, ceinture, jambes) pour trouver le dos
BG = set(".O")                 # ce qui est derrière KAGE (fond, contour) : un équipement de dos s'y peint


TORSO = set("tTUlLdD")         # le torse et les jambes, sans les bras


def _back_edge(g, y, hx, body=None):
    """Colonne du bord arrière du corps à la rangée y (le pixel de corps le plus à gauche), ou None."""
    if not 0 <= y < CH:
        return None
    for x in range(max(0, hx - 6), min(CW, hx + 14)):
        if g[y, x] in (body or BODY):
            return x
    return None


def _h(*a):
    """Petit hasard déterministe (0..1) pour les textures des accessoires."""
    n = 0
    for v in a:
        n = (n * 1103515245 + int(v) * 2654435761 + 12345) & 0xFFFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0xFFFFFFFF
    return (n & 0xFFFF) / 65535


def cape(kind):
    """Une cape sur le dos, qui suit le bord arrière du corps pose par pose.
    mino (le voyageur) : manteau de feuilles et de paille ; un col arrondi derrière la nuque, il couvre l'épaule,
    s'évase jusqu'aux chevilles ; feuilles en écailles (vert, vert clair, ombre), feuilles sèches ocre, le bas
    qui roussit et s'effiloche en pointes.  fur (l'hiver) : fourrure claire en mèches."""
    def put(g):
        pos = find_head(g)
        if pos is None:
            return g, False
        hx, hy = pos
        g = g.copy()
        mask = np.zeros(g.shape, bool)
        ys, ye = (hy + 8, hy + 17) if kind == "mino" else (hy + 9, hy + 19)
        widths = [4, 5, 5, 6, 6, 6, 6, 7, 7, 7] if kind == "mino" else [3, 4, 5, 5, 6, 6, 7, 7, 7, 7, 7]
        TAILS = set("fFGkK")                       # les pans du bandeau passent sous la cape
        prev = None
        mino = kind == "mino"
        ARM = set("aANn")                         # le bras arrière, qui pend sous le manteau (mino)
        near_blade = lambda y, x: any(0 <= y + dy < CH and 0 <= x + dx < CW and g[y + dy, x + dx] in "gWw"
                                      for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
        for y in range(ys - (2 if mino else 1), ye + 3):
            if not 0 <= y < CH:
                continue
            xl = _back_edge(g, min(max(y, ys), ye), hx, TORSO if mino else BODY)
            if xl is None:
                xl = prev
            if xl is None:
                continue
            prev = xl
            k = y - ys
            if k < 0:                              # le col, arrondi, derrière la nuque, jusque sous le chapeau
                span = range(xl - (3 if k == -1 else 2), xl + 1)
            else:
                w = min(widths[min(k, len(widths) - 1)], xl - 1)   # (jamais coupée par le bord de l'image)
                inner = 2 if k < 3 else 0          # sur l'épaule : il recouvre le haut du dos
                span = range(xl - w, xl + inner)
            for x in span:
                if not 0 <= x < CW:
                    continue
                if g[y, x] in KEEP and not (mino and g[y, x] in ARM and x < xl and 0 <= k <= 7 and not near_blade(y, x)):
                    continue
                u = xl - 1 - x                      # distance derrière le dos
                if x >= xl:
                    if g[y, x] not in BODY and g[y, x] not in TAILS:
                        continue
                elif g[y, x] not in BG and g[y, x] not in TAILS and not (mino and g[y, x] in ARM):
                    continue
                # le bas : des pointes de longueurs inégales (une sur deux plus longue), des jours entre elles
                last = len(widths) - 3
                TIPS = (2, 0, 1, 2, 1, 0, 2, 1, 2)
                reach = TIPS[u % len(TIPS)] if u >= 0 else 0
                if k > last and k - last > reach:
                    continue
                if kind == "mino":
                    hh = _h(u, k, 3)
                    if k < 0:
                        c = "i" if x == xl - 1 else "B"
                    elif k > last:
                        c = "J" if k - last == reach else "j"                # les pointes : brunes, le bout ocre
                    elif k > last - 3 and hh < 0.3 + (k - last + 3) * 0.12:
                        c = "j" if hh < 0.18 else "J"                       # le bas qui roussit
                    elif (u + k // 3) % 3 == 0 and k % 3 != 0:
                        c = "b"                                             # l'ombre entre deux feuilles
                    elif k % 3 == 0 and (u + k // 3) % 3 != 0 and 1 <= u <= 6:
                        c = "i"                                             # le bord clair d'une feuille
                    else:
                        c = "B"
                    if 2 <= k <= last and _h(u, k, 11) < 0.05 + k * 0.012:
                        c = "J"                                             # une feuille sèche
                    if u == (widths[min(k, len(widths) - 1)] - 1 if k >= 0 else 1) and c in "Bi":
                        c = "b"                                             # le bord de la cape, à l'ombre
                else:
                    edge = x - (xl - widths[min(max(k, 0), len(widths) - 1)])
                    if (k > 9 or edge == 0) and (x * 7 + y * 3) % 3 == 0:
                        continue
                    c = "i" if (k < 3 or (x + y * 2) % 5 == 0) else ("B" if edge > 0 else "b")
                g[y, x] = c
                mask[y, x] = True
        _outline(g, mask)
        return g, True
    return put


# le grand sugegasa, dessiné à la main : bouton, cône (rayons de tresse plus sombres qui descendent du
# sommet, lumière sur le devant), bord sombre dont les deux bouts retombent
KASA = """
..........pPQ..........
..........rrr..........
........pPPPQQp........
......pPpPPPPQQQp......
....pPPpPpPPPpQQpQp....
..pPPpPPPpPPPpQQQpQQp..
pPPpPPPPpPPPPPpQQQQpQQp
rrrrrrrrrrrrrrrrrrrrrrr
r.....................r
"""
# le même, plus petit (le voyageur) : même forme triangulaire, un rang de cône en moins
KASA_S = """
........pPQ........
........rrr........
......pPPPQQp......
....pPpPPPPQQQp....
..pPPpPpPPPpQQpQp..
pPPpPPPpPPPpQQQpQQp
rrrrrrrrrrrrrrrrrrr
r.................r
"""
# un brin de feuille glissé dans la paille, à l'arrière du sommet (colonne, rangée, lettre)
KASA_LEAF = [(6, 1, "i"), (7, 1, "i"), (8, 1, "B"), (9, 1, "b"), (5, 2, "i"), (6, 2, "B"), (7, 2, "b")]


def notails(g):
    """Les pans du bandeau qui pendent derrière la tête sont retirés (paysan : son paquetage est sur le dos)."""
    return ribbon(g, flutter=False)


def ribbon(g, flutter=True):
    """Le voyageur : les pans du bandeau qui pendent derrière lui sont rangés sous le manteau ; seul un ruban
    vert flotte vers l'arrière, sous le bord du chapeau (comme sur le modèle)."""
    pos = find_head(g)
    if pos is None:
        return g, False
    hx, hy = pos
    g = g.copy()
    for y in range(CH):
        for x in range(0, min(CW, hx + 2)):
            if g[y, x] in "fFGkK" and y > hy + 3:
                g[y, x] = "."
    # le contour devenu orphelin
    for y in range(CH):
        for x in range(CW):
            if g[y, x] == "O" and not any(0 <= y + dy < CH and 0 <= x + dx < CW and g[y + dy, x + dx] not in ".O"
                                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1))):
                g[y, x] = "."
    if not flutter:
        return g, True
    mask = np.zeros(g.shape, bool)
    for dx, dy, c in ((-1, 5, "F"), (0, 5, "F"), (-2, 5, "G"), (-3, 5, "G"), (-1, 6, "f"), (-2, 6, "f"), (-3, 6, "F"),
                      (-4, 6, "G"), (-5, 6, "G"), (-6, 7, "F"), (-5, 7, "f"), (-7, 7, "G")):
        x, y = hx + dx, hy + dy
        if 0 <= x < CW and 0 <= y < CH and g[y, x] in BG:
            g[y, x] = c
            mask[y, x] = True
    _outline(g, mask)
    return g, True


# le paquetage du paysan des rizières, sur le dos (son bord droit contre le dos, rangée 0 = hy + 4) :
# un tonnelet de bois doré cerclé de deux cercles sombres, son couvercle et une louche de bois qui en dépasse ;
# dessous, un panier de paille brune tressée
FARMER_PACK = """
.J......
..J.....
..jJ....
..CcQC..
.rrrrrr.
.CccQcC.
.CccQcC.
.rrrrrr.
..CcQC..
..jJJj..
.jJjJjj.
.jJJjJj.
..jjjj..
"""


def farmer(g):
    """Le paquetage du paysan : le tonnelet et le panier sur le dos, la tige de bambou qui dépasse derrière le
    chapeau (son bout noué de jaune), et le manche d'un outil qui descend en travers, derrière les jambes."""
    pos = find_head(g)
    if pos is None:
        return g, False
    hx, hy = pos
    xl = _back_edge(g, hy + 12, hx, TORSO)
    if xl is None:
        xl = _back_edge(g, hy + 13, hx, TORSO)
    if xl is None:
        return g, False
    g = g.copy()
    mask = np.zeros(g.shape, bool)

    def put(x, y, c, over=BG):
        if 0 <= x < CW and 0 <= y < CH and g[y, x] in over:
            g[y, x] = c
            mask[y, x] = True
    # le tonnelet et le panier
    rows = _rows(FARMER_PACK)
    x0 = xl - len(rows[0]) + 2
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c != ".":
                put(x0 + i, hy + 4 + j, c)
    # la tige de bambou, glissée derrière le paquetage, qui dépasse au-dessus du chapeau
    bx = x0 + 2
    for y in range(hy - 3, hy + 10):
        put(bx, y, "f" if (y - hy) % 3 == 0 else "G")          # une tige fine, ses nœuds plus sombres
    put(bx, hy - 4, "c")                                       # le nœud jaune au bout
    # le manche de l'outil, en travers derrière les jambes
    for k in range(9):
        put(xl - 1 - k, hy + 13 + k, "J")
        put(xl - 1 - k, hy + 14 + k, "j")
    _outline(g, mask)
    return g, True


def pants(g):
    """Le pantalon sombre (sous la ceinture), avec des pièces vertes aux genoux."""
    belt = None
    for y in range(CH):
        if "lL" in "".join(g[y]):
            belt = y
            break
    if belt is None:
        return g, False
    g = g.copy()
    for y in range(belt + 1, CH):
        for x in range(CW):
            c = g[y, x]
            if c in "tTU":
                g[y, x] = {"t": "b", "T": "B", "U": "B"}[c]
                if y - belt in (2, 3) and _h(x, y, 21) < 0.45:
                    g[y, x] = "i"                                # une pièce verte
    return g, True


def dots(g):
    """Le kimono vert du paysan : un semis de petites feuilles jaunes, accroché à la ceinture (il suit le corps)."""
    belt = None
    for y in range(CH):
        row = "".join(g[y])
        if "lL" in row:
            belt, bx = y, row.find("lL")
            break
    if belt is None:
        return g, False
    g = g.copy()
    for y in range(max(0, belt - 6), belt):
        for x in range(CW):
            if g[y, x] == "T" and (x - bx) % 3 == 1 and (belt - y) % 2 == 0 and _h(x - bx, belt - y, 5) < 0.6:
                g[y, x] = "Q"
    return g, True


def kasa(leaf=False, small=False):
    rows = [list(r) for r in _rows(KASA_S if small else KASA)]
    if leaf:
        for x, y, c in KASA_LEAF:
            rows[y][x - (2 if small else 0)] = c
    return "\n".join("".join(r) for r in rows)


def sash(g):
    """Cordon tressé en bandoulière (voyageur, paysan) : de l'épaule avant jusqu'à la hanche arrière, en
    pointillés dorés (fil clair, fil sombre), sur la tunique seulement ; et la boucle dorée de la ceinture."""
    for y in range(CH):
        row = "".join(g[y])
        x = row.find("lL")
        if x < 0:
            continue
        g = g.copy()
        for k in range(5):
            cx, cy = x + 6 - k, y - 5 + k
            if 0 <= cy < CH and 0 <= cx < CW and g[cy, cx] in "tTUFG":
                g[cy, cx] = "c" if k % 2 == 0 else "C"
        # la boucle : au milieu de la ceinture
        e = x
        while e < CW and g[y, e] in "lL":
            e += 1
        mid = (x + e) // 2
        if g[y, mid] in "lL":
            g[y, mid] = "c"
        return g, True
    return g, False


def apron(g):
    """Le pan de tunique vert qui tombe de la ceinture, devant les jambes (voyageur, paysan)."""
    for y in range(CH):
        row = "".join(g[y])
        x = row.find("lL")
        if x < 0:
            continue
        e = x
        while e < CW and g[y, e] in "lL":
            e += 1
        g = g.copy()
        mask = np.zeros(g.shape, bool)
        mid = (x + e) // 2
        for j, w in ((1, 2), (2, 2), (3, 1)):
            for xx in range(mid - 1, mid - 1 + w + (1 if j == 1 else 0)):
                if 0 <= y + j < CH and 0 <= xx < CW and g[y + j, xx] in "tTUO":
                    g[y + j, xx] = "i" if (j == 1 and xx == mid - 1) else ("B" if j < 3 else "b")
                    mask[y + j, xx] = True
        return g, True
    return g, False


STAMPS["kasa_leaf"] = dict(dx=-4, dy=-2, text=kasa(leaf=True, small=True))
STAMPS["kasa"] = dict(dx=-6, dy=-3, text=kasa())


PACKS = {
    # le sac du paysan des rizières : toile jaune nouée en haut
    "sack": """
..jJj..
.bBBBi.
bBBBBBi
bBBiBBi
bBBBBBi
bBBBBBi
.bBBBi.
..bbb..
""",
    # le filet du pêcheur roulé sur le dos : la maille claire sur le fond, un flotteur de liège
    "net": """
...bBBb...
.bBjBjBjb.
bjBjBjBjBb
BjBjBjBjBj
bBjBjBjBjb
BjBjBjBjBj
bjBjBjBjBb
.bjBjBjBb.
..bBBBb...
...jJ.....
""",
}


def pack(name):
    """Un paquetage sur le dos (sac, filet) : derrière KAGE, son bord droit contre le dos."""
    rows = _rows(PACKS[name])

    def put(g):
        pos = find_head(g)
        if pos is None:
            return g, False
        hx, hy = pos
        xl = _back_edge(g, hy + 13, hx)
        if xl is None:
            return g, False
        g = g.copy()
        mask = np.zeros(g.shape, bool)
        w, h = len(rows[0]), len(rows)
        x0, y0 = xl - w + 2, hy + 9
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                x, y = x0 + i, y0 + j
                if c != "." and 0 <= x < CW and 0 <= y < CH and g[y, x] in BG:
                    g[y, x] = c
                    mask[y, x] = True
        _outline(g, mask)
        return g, True
    return put


def halo(g):
    """L'auréole d'or derrière la tête (légendaire) : un anneau, et quatre éclats."""
    pos = find_head(g)
    if pos is None:
        return g, False
    hx, hy = pos
    g = g.copy()
    cx, cy, r = hx + 5.5, hy + 3.5, 8.2
    for y in range(CH):
        for x in range(CW):
            if g[y, x] not in BG:
                continue
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if abs(d - r) < 0.62:
                g[y, x] = "j" if y > cy + 3 else "J"
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = int(round(cx + dx * (r + 2))), int(round(cy + dy * (r + 2)))
        for ox, oy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + ox < CW and 0 <= y + oy < CH and g[y + oy, x + ox] in BG:
                g[y + oy, x + ox] = "i" if (ox, oy) == (0, 0) else "J"
    return g, True


def accessory(name):
    if name == "cord":
        return cord
    if name in STAMPS:
        return stamp(name)
    if name in ("mino", "fur"):
        return cape(name)
    if name == "ribbon":
        return ribbon
    if name == "notails":
        return notails
    if name == "farmer":
        return farmer
    if name == "pants":
        return pants
    if name == "dots":
        return dots
    if name == "sash":
        return sash
    if name == "apron":
        return apron
    if name in PACKS:
        return pack(name)
    if name == "halo":
        return halo
    return hat(name)


def fill_holes(g):
    """Les petits jours de fond enfermés par un accessoire (entre un pan du bandeau et la cape…) : ombre."""
    H, W = g.shape
    seen = np.zeros(g.shape, bool)
    for y0 in range(H):
        for x0 in range(W):
            if g[y0, x0] != "." or seen[y0, x0]:
                continue
            stack, comp, edge = [(y0, x0)], [], False
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                if y in (0, H - 1) or x in (0, W - 1):
                    edge = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and g[ny, nx] == ".":
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if not edge and len(comp) <= 8:
                for y, x in comp:
                    g[y, x] = "O"
    return g


def dress(g, names):
    """Grille habillée des accessoires (dans l'ordre : la cordelette avant le chapeau)."""
    base = g
    for n in names:
        g, _ = accessory(n)(g)
    if any(n in ("mino", "fur") for n in names):
        g = g.copy() if g is base else g
        g = fill_holes(g)
    return g


def overlay(g, names):
    """Calque d'accessoires seul : les pixels qui changent une fois habillé."""
    d = dress(g, names)
    out = np.full(g.shape, ".", dtype="<U1")
    m = d != g
    out[m] = d[m]
    return out
