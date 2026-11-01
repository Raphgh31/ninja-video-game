"""WARA — l'épouvantail du dojo. Planche de design (avant intégration en jeu).

Un petit épouvantail réveillé par un talisman cloué sur sa poitrine : grand
chapeau de paille à pointe pliée, tête en toile de sac (deux points pour les
yeux, un sourire), bras en traverse de bois, poncho de paille, long pieu.
Le chapeau trahit ses humeurs (il saute de la tête = il va attaquer, il tombe
sur les yeux = il a le tournis) ; la traverse tourne en hélice pour attaquer.
Dessin pixel par pixel sur une cellule 48x32, orientation droite, contour
extérieur ajouté automatiquement (comme KAGE et TATE).
"""
import math
import numpy as np

W, H = 48, 32
CX = 16          # axe du pieu (même ancrage que KAGE)
GROUND = 30      # dernière ligne pleine ; la ligne 31 reçoit le contour

PAL = {
    "O": "#17120c",                                   # contour
    "t": "#5c5134", "T": "#8c7f57", "u": "#c2ae78",   # paille : ombre, médium, clair
    "U": "#e2d29d",                                   # paille : reflet
    "r": "#3e2c1a", "R": "#6e5133",                   # corde torsadée
    "c": "#cbbd9f", "C": "#978b73",                   # toile de sac du visage
    "k": "#2a2420",                                   # yeux et bouche (fil sombre)
    "w": "#2f2217", "W": "#5a4129",                   # bois : pieu, traverse
    "n": "#383c45", "N": "#727985", "I": "#b7bdc6",   # fer du clou et de la virole
    "p": "#e8e0c4", "P": "#c4b994",                   # papier du talisman
    "e": "#a8433a",                                   # encre rouge du talisman
    # sans contour
    "f": "#c2b384", "F": "#e4d9b2",                   # brins de paille qui volent
    "g": "#ff6a3d", "G": "#ffc06e",                   # lueur du clou / braise
    "x": "#c9bd90", "X": "#f4e7b8",                   # poussière, trait de coupe
    "s": "#e6dcc0",                                   # traînée du tournoiement
    "a": "#6d6a66",                                   # cendre
}
NO_OUTLINE = set("fFgGxXsa")


class Canvas:
    def __init__(self):
        self.g = np.full((H, W), ".", dtype="<U1")

    def put(self, x, y, text):
        for i, c in enumerate(text):
            if c != "." and 0 <= x + i < W and 0 <= y < H:
                self.g[y, x + i] = c

    def block(self, x, y, rows):
        for j, r in enumerate(rows):
            self.put(x, y + j, r)

    def pixels(self, pts, c):
        for x, y in pts:
            self.put(x, y, c)

    def outline(self):
        solid = (self.g != ".") & ~np.isin(self.g, list(NO_OUTLINE)) & (self.g != "O")
        near = np.zeros_like(solid)
        near[1:, :] |= solid[:-1, :]
        near[:-1, :] |= solid[1:, :]
        near[:, 1:] |= solid[:, :-1]
        near[:, :-1] |= solid[:, 1:]
        self.g[(self.g == ".") & near] = "O"
        return self.g


def flipped(grid):
    return np.fliplr(grid).copy()


# ---------------------------------------------------------------------------
# Pièces (coordonnées de cellule). Pieu en x = 15-16 (ancrage 16 comme KAGE).
# ---------------------------------------------------------------------------
HAT = [                       # grand chapeau de paille, pointe pliée vers l'arrière
    "...Uu",
    "...uTu",
    "....tuU",
    ".....tuUu",
    ".....tTuUuU",
    "....tTuUuTuUu",
    "....rRrRrRrRrR",
    "..TuUuUuTuUuTuUuu",
    ".tTuTuUuTuUuTuTuUuUu",
    "...............tTuTu",
    ".................tt",
]
HAT_UP = [                    # pointe dressée (le chapeau saute : il va attaquer)
    ".........U",
    "........uU",
    "........Tu",
    ".......tuU",
    "......tTuUu",
    ".....tTuUuTu",
    "....rRrRrRrRrR",
    "..TuUuUuTuUuTuUuu",
    ".tTuTuUuTuUuTuTuUuUu",
    "...............tTuTu",
    ".................tt",
]
HAT_TORN = [                  # bord déchiré, paille qui pend, pointe cassée
    "....",
    ".....u",
    "....tuU.u",
    ".....tuUu",
    ".....tTuUuU",
    "....tTuUuTuUu",
    "....rRr..RrRrR",
    "..TuUuU..UuTuUuu",
    ".tTuT.u.TuUuTuT.uUu",
    "...u.....u.....tT.Tu",
    ".................t",
]
HAT_XY = (3, 1)

FACE = [                      # toile de sac : deux points pour les yeux, un sourire
    "..CcccccC.",
    ".CccccccccC",
    ".ccckcccckc",
    ".cccccccccC",
    ".cckcccckcC",
    ".ccCkkkkcCC",
    "..CcCcCcCC",
]
FACE_GRR = [                  # fâché : bouche cousue en zigzag
    "..CcccccC.",
    ".CccccccccC",
    ".ccckcccckc",
    ".cccccccccC",
    ".cckckckccC",
    "..CckckcCC",
    "..CcCcCcCC",
]
FACE_OUCH = [                 # aïe : yeux plissés, bouche en o
    "..CcccccC.",
    ".CccccccccC",
    ".cckkccckkc",
    ".cccccccccC",
    ".ccccckkccC",
    ".ccCckkcCCC",
    "..CcCcCcCC",
]
FACE_WOOZY = [                # tournis : bouche ondulée (les yeux sont sous le chapeau)
    "..CcccccC.",
    ".CccccccccC",
    ".ccckcccckc",
    ".cccccccccC",
    ".cckcckcccC",
    ".ccCkCckkCC",
    "..CcCcCcCC",
]
FACE_TORN = [                 # couture qui lâche : la paille sort par la joue
    "..CcccccC.",
    ".CcccccccU",
    ".ccckccckuU",
    ".cccccccuT",
    ".cckcccckU",
    ".ccCkkkkcCu",
    "..CcCcCcCC",
]
FACE_XY = (11, 9)

PONCHO = [                    # robe de paille en pans, effilochée en bas
    "....tuUuTut....",
    "...tuTUutTuUt..",
    "...tuTuUtTuUt..",
    "..tuTuUutTuUut.",
    "..tuTuUutTuUuT.",
    ".tuTuUuTtuTuUuT",
    ".tuTuUuTtuTuUuT",
    "tuTuUuTutTuTuUT",
    "tuTuUuTutTuTuUt",
    "tT.uU.TutuT.uUt",
    "t..T..u.t..T..t",
]
PONCHO_SQUASH = [
    ".....tuUuTut.....",
    "....tuTUutTuUt...",
    "...tuTuUutTuUut..",
    "..tuTuUuTtuTuUuT.",
    ".tuTuUuTutTuTuUuT",
    "tuTuUuTuutTuuTuUt",
    "tT.uU.TutuT.uU.Tt",
    "t...T..u.t..T...t",
]
PONCHO_STRETCH = [
    "...tuUuTut...",
    "...tuTUtTuU..",
    "..tuTuUtTuUt.",
    "..tuTuUtTuUt.",
    "..tuTUutTuTt.",
    "..tuTuUtTuUt.",
    ".tuTuUtTuUuT.",
    ".tuTuUtTuUuT.",
    ".tuTUutTuTuT.",
    ".tT.uUtT.uTt.",
    ".t..T..t..u.t",
    "....t.....t..",
]
PONCHO_OPEN = [               # en corolle au sommet du bond
    ".......tuUuTut.....",
    "......tuTUutTuUt...",
    ".....tuTuUutTuUut..",
    "....tuTuUuTtuTuUuT.",
    "...tuTuUuTutTuTuUuT",
    "..ttuTu.uTtuT.uUuTt",
    ".tuT..uU.t.Tu..uU.T",
    "tT....T..t..T....uT",
    "t.....u..t.......t.",
]
PONCHO_TORN = [
    "....tuUuTut....",
    "...tuTUutTuUt.U",
    "...tuTuU.TuUt..",
    "..tuTu..tTuUut.",
    "..tuTuU..tTuUT.",
    ".tuTuU.TtuT.uuT",
    ".tuT.UuTt.TuUuT",
    "tuTu..TutTu..UT",
    "tuT.UuTutT.uU.t",
    "tT...T.utuT..Ut",
    "t......u.t.....t",
]
PONCHO_X = 9
PONCHO_Y = 16


def stake(cv, top=22, x=CX - 1, bottom=GROUND):
    """Pieu de bois (2 px), virole de fer en bas."""
    for y in range(top, bottom - 1):
        cv.put(x, y, "Ww")
    cv.put(x, bottom - 1, "NI")
    cv.put(x, bottom, "nN")


def bar(cv, cx=CX, cy=16, half=10, angle=0.0, tufts=True):
    """Bras : traverse de bois (2 px d'épaisseur) inclinée de `angle` degrés,
    touffes de paille aux deux bouts."""
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    steep = abs(dy) > abs(dx)
    pts = []
    for i in range(-half, half + 1):
        x, y = round(cx + i * dx), round(cy + i * dy)
        pts.append((x, y))
        cv.put(x, y, "W")
        if steep:
            cv.put(x + 1, y, "w")
        else:
            cv.put(x, y + 1, "w")
    if tufts:
        for (x, y), side in ((pts[0], -1), (pts[-1], 1)):
            ox, oy = round(side * dx * 1.5), round(side * dy * 1.5)
            cv.pixels([(x + ox, y + oy), (x + ox, y + oy + 1)], "u")
            cv.pixels([(x + ox - 1, y + oy + 1), (x + ox + 1, y + oy + 1)], "T")
            cv.pixels([(x + 2 * ox, y + 2 * oy), (x + ox, y + oy - 1)], "U")
            cv.pixels([(x + ox - 1, y + oy + 2), (x + ox + 1, y + oy + 2)], "t")


def talisman(cv, dx=0, dy=0):
    cv.block(19 + dx, 18 + dy, ["NI", "pp", "ep", "pe", "P."])


def glow_nail(cv, dx=0, dy=0, strong=False):
    """Lueur sur le clou du talisman (il se réveille)."""
    x, y = 21 + dx, 18 + dy
    cv.pixels([(x, y), (x, y - 1)], "g")
    if strong:
        cv.pixels([(x + 1, y), (x, y - 2)], "G")


def figure(cv, *, face=FACE, hat=HAT, hat_d=(0, 0), face_d=(0, 0), poncho=PONCHO, poncho_d=(0, 0),
           arm=0.0, arm_d=(0, 0), stake_top=22, body_d=(0, 0), torn=False, arm_front=False):
    """Assemble l'épouvantail. *_d = décalages (dx, dy) ; arm = inclinaison de la traverse."""
    bx, by = body_d
    stake(cv, stake_top)
    if not arm_front:
        bar(cv, CX + bx + arm_d[0], 16 + by + arm_d[1], angle=arm)
    pd = PONCHO_TORN if torn and poncho is PONCHO else poncho
    cv.block(PONCHO_X + bx + poncho_d[0] - (len(pd[0]) - len(PONCHO[0])) // 2, PONCHO_Y + by + poncho_d[1], pd)
    talisman(cv, bx + poncho_d[0], by + poncho_d[1])
    cv.put(13 + bx, 16 + by, "rRrRr")                          # col noué
    f = FACE_TORN if torn and face is FACE else face
    cv.block(FACE_XY[0] + bx + face_d[0], FACE_XY[1] + by + face_d[1], f)
    h = HAT_TORN if torn and hat is HAT else hat
    cv.block(HAT_XY[0] + bx + hat_d[0], HAT_XY[1] + by + hat_d[1], h)
    if arm_front:                                              # en hélice : devant le corps
        bar(cv, CX + bx + arm_d[0], 16 + by + arm_d[1], half=9, angle=arm)


def star(cv, x, y):
    """Petite étoile de vertige."""
    cv.pixels([(x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)], "F")
    cv.put(x, y, "X")


# ---------------------------------------------------------------------------
# poses
# ---------------------------------------------------------------------------
def idle(phase=0, torn=False):
    """Repos : il se dandine, la traverse penche d'un côté puis de l'autre."""
    cv = Canvas()
    if phase == 0:
        figure(cv, arm=-6, torn=torn)
    else:
        figure(cv, arm=6, hat_d=(-1, 1), face_d=(0, 1), body_d=(0, 0), torn=torn)
    if torn:
        glow_nail(cv)
    return cv.outline()


def hop_crouch(torn=False):
    """Bond 1 : il se ratatine, le chapeau s'enfonce."""
    cv = Canvas()
    figure(cv, poncho=PONCHO_SQUASH, poncho_d=(0, 3), arm_d=(0, 3), face_d=(0, 3), hat_d=(0, 4),
           stake_top=24, torn=torn)
    cv.put(CX - 8, GROUND, "x..............x")
    return cv.outline()


def hop_rise(torn=False):
    """Bond 2 : il file vers le haut ; le chapeau, en retard, lui tombe sur les yeux."""
    cv = Canvas()
    figure(cv, poncho=PONCHO_STRETCH, poncho_d=(1, -1), arm_d=(0, -1), face_d=(0, -1), hat_d=(0, 1),
           arm=-4, torn=torn)
    return cv.outline()


def hop_air(torn=False):
    """Bond 3 : au sommet, le chapeau flotte au-dessus de sa tête — youpi !"""
    cv = Canvas()
    figure(cv, poncho=PONCHO_OPEN, poncho_d=(0, 2), arm=8, hat=HAT_UP, hat_d=(0, -1), torn=torn)
    cv.pixels([(4, 26), (28, 25), (2, 28)], "f")
    return cv.outline()


def hop_land(torn=False):
    """Bond 4 : atterrissage en accordéon, le chapeau retombe sur le nez."""
    cv = Canvas()
    figure(cv, poncho=PONCHO_SQUASH, poncho_d=(0, 3), arm_d=(0, 3), face_d=(0, 3), hat_d=(0, 5),
           arm=-5, stake_top=24, torn=torn)
    cv.block(3, GROUND - 2, ["x...................x", ".xX.................Xx", "..x..................x"])
    cv.pixels([(7, 12), (26, 10)], "F")
    return cv.outline()


def spin_windup():
    """Moulinet 1 (signal) : le chapeau saute, pointe dressée ; il fronce sa bouche cousue."""
    cv = Canvas()
    figure(cv, face=FACE_GRR, hat=HAT_UP, hat_d=(0, -1), arm=-20, poncho=PONCHO_SQUASH,
           poncho_d=(0, 2), face_d=(0, 1), arm_d=(0, 1))
    glow_nail(cv, 0, 2, strong=True)
    cv.pixels([(9, 2), (8, 4), (21, 1), (22, 3)], "X")          # traits de surprise
    return cv.outline()


def spin_a():
    """Moulinet 2 : la traverse tourne en hélice (penchée vers l'avant)."""
    cv = Canvas()
    figure(cv, face=FACE_GRR, arm=32, arm_front=True)
    cv.put(1, 8, "ss")
    cv.put(3, 6, "s")
    cv.put(28, 25, "ss")
    cv.put(27, 27, "s")
    cv.pixels([(4, 21), (29, 9)], "f")
    glow_nail(cv)
    return cv.outline()


def spin_b():
    """Moulinet 3 : la traverse continue son tour (penchée vers l'arrière)."""
    cv = Canvas()
    figure(cv, face=FACE_GRR, arm=-32, hat_d=(1, 0), arm_front=True)
    cv.put(28, 8, "ss")
    cv.put(27, 6, "s")
    cv.put(2, 25, "ss")
    cv.put(4, 27, "s")
    cv.pixels([(29, 21), (3, 9)], "f")
    return cv.outline()


def dizzy(phase=0):
    """Vertige : chapeau tombé sur les yeux, traverse de travers, étoiles."""
    cv = Canvas()
    side = 1 if phase == 0 else -1
    figure(cv, face=FACE_WOOZY, hat_d=(side, 3), arm=12 * side)
    if phase == 0:
        star(cv, 9, 4)
        star(cv, 24, 2)
        cv.put(17, 1, "F")
    else:
        star(cv, 13, 1)
        star(cv, 27, 5)
        cv.put(7, 3, "F")
    return cv.outline()


def hurt(torn=False):
    """Touché : il plie en arrière, yeux plissés, le chapeau saute de travers."""
    cv = Canvas()
    figure(cv, face=FACE_OUCH, hat=HAT_UP, hat_d=(-3, -1), face_d=(-1, 0), arm=-25,
           poncho_d=(-1, 0), body_d=(0, 0), torn=torn)
    cv.pixels([(27, 14), (29, 16), (28, 21), (31, 12), (26, 9)], "F")
    cv.pixels([(30, 19), (32, 15), (33, 21)], "f")
    cv.block(24, 15, ["X..", ".X.", "..X"])
    return cv.outline()


# ---------------------------------------------------------------------------
# Mort en 4 temps : tranché, pouf, en tas, le talisman s'envole
# ---------------------------------------------------------------------------
def death_cut():
    """Mort 1 : tranché en biais ; le haut glisse, l'air ahuri."""
    cv = Canvas()
    figure(cv, face=FACE_OUCH, hat=HAT_UP, torn=True)
    g = cv.g
    line = lambda x: 21 - (x - CX) * 2 // 3
    upper = np.full_like(g, ".")
    for y in range(H):
        for x in range(W):
            if g[y, x] != "." and y < line(x):
                upper[y, x] = g[y, x]
                g[y, x] = "."
    for y in range(H - 1, -1, -1):
        for x in range(W - 1, -1, -1):
            if upper[y, x] != "." and y + 1 < H and x + 2 < W:
                g[y + 1, x + 2] = upper[y, x]
    for x in range(2, 31):
        y = line(x)
        if 0 <= y < H and g[y, x] == ".":
            g[y, x] = "X"
    return cv.outline()


def death_poof():
    """Mort 2 : pouf ! la paille s'envole, le chapeau et la tête sautent en l'air."""
    cv = Canvas()
    stake(cv, 22)
    cv.block(PONCHO_X, 25, PONCHO[-2:])
    cv.block(24, 4, FACE_OUCH)
    cv.block(27, 0, HAT[5:9])
    bar(cv, 9, 12, half=6, angle=35, tufts=False)
    cv.block(15, 13, ["pp", "ep", "pe"])
    for (px, py, c) in [(4, 9, "F"), (7, 15, "f"), (2, 18, "F"), (9, 6, "f"), (19, 9, "F"),
                        (13, 4, "f"), (36, 13, "F"), (33, 18, "f"), (11, 19, "F"), (22, 16, "f"),
                        (1, 12, "f"), (38, 8, "F"), (10, 22, "f"), (27, 19, "F"), (6, 3, "F"),
                        (5, 21, "f"), (36, 21, "f"), (18, 6, "f"), (21, 19, "F")]:
        cv.put(px, py, c)
    cv.block(5, 17, ["x.xx.", "xx..x", ".x.x."])
    cv.block(24, 21, [".xx.x", "x..xx"])
    return cv.outline()


def _pile(cv):
    """Tas de paille, traverse couchée, tête posée dessus avec le chapeau."""
    bar(cv, 23, 30, half=8, angle=0, tufts=False)
    cv.block(4, 25, [
        "............u..T.......",
        ".........tuTUu.uTu.T...",
        ".....tuTuUuTuUuTuTuut..",
        "..tTuUuTuTuUuTuTuTuTut.",
        ".tuTuUuTuTuUuTuTuTuTuTt",
    ])
    cv.block(10, 19, FACE[:6])
    cv.block(4, 12, HAT[3:9])


def death_pile():
    """Mort 3 : il retombe en tas, la tête (et le chapeau) atterrissent dessus."""
    cv = Canvas()
    _pile(cv)
    cv.block(2, 29, ["x..x", ".xx."])
    cv.block(29, 26, ["x.x"])
    star(cv, 6, 9)
    star(cv, 25, 11)
    return cv.outline()


def death_free():
    """Mort 4 : le talisman s'envole en voletant ; WARA redevient un épouvantail."""
    cv = Canvas()
    _pile(cv)
    cv.block(26, 3, ["pp", "ep", "pe", ".P"])
    cv.pixels([(24, 8), (25, 10), (23, 12)], "a")
    return cv.outline()


POSES = {
    "repos_1": idle(0),
    "repos_2": idle(1),
    "bond_1_tasse": hop_crouch(),
    "bond_2_envol": hop_rise(),
    "bond_3_sommet": hop_air(),
    "bond_4_atterrit": hop_land(),
    "moulinet_1_elan": spin_windup(),
    "moulinet_2": spin_a(),
    "moulinet_3": spin_b(),
    "vertige_1": dizzy(0),
    "vertige_2": dizzy(1),
    "touche": hurt(),
    "abime_repos": idle(0, torn=True),
    "abime_touche": hurt(torn=True),
    "mort_1_coupe": death_cut(),
    "mort_2_pouf": death_poof(),
    "mort_3_en_tas": death_pile(),
    "mort_4_libere": death_free(),
}
