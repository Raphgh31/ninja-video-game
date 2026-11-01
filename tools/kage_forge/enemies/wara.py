"""WARA — pantin de paille du dojo. Planche de design (avant intégration en jeu).

Un petit mannequin d'entraînement, réveillé par un talisman cloué sur sa
poitrine. Pas de visage : une tête ronde en toile, et un chignon de paille qui
trahit ses humeurs (dressé = il va attaquer, en vrille = il a le tournis).
Gestuelle de pantin désarticulé. Dessin pixel par pixel sur une cellule 48x32,
orientation droite, contour extérieur ajouté automatiquement (comme KAGE et TATE).
"""
import numpy as np

W, H = 48, 32
CX = 16          # axe du pieu (même ancrage que KAGE)
GROUND = 30      # dernière ligne pleine ; la ligne 31 reçoit le contour

PAL = {
    "O": "#17120c",                                   # contour
    "t": "#5e4a22", "T": "#8c7234", "u": "#bd9f52",   # paille : ombre, médium, clair
    "U": "#e2c97c",                                   # paille : reflet
    "r": "#3e2c1a", "R": "#6e5133",                   # corde torsadée
    "c": "#b9a684", "C": "#8b7b5f",                   # toile du masque
    "w": "#2f2217", "W": "#5a4129",                   # bois : pieu, traverse
    "n": "#383c45", "N": "#727985", "I": "#b7bdc6",   # fer du clou et de la virole
    "p": "#e8e0c4", "P": "#c4b994",                   # papier du talisman
    "e": "#a8433a",                                   # encre rouge du talisman
    # sans contour
    "f": "#c9ab5c", "F": "#ead48c",                   # brins de paille qui volent
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
# Pose maîtresse (repos). Chaque partie = (x, y, lignes) en coordonnées de
# cellule ; le pieu est en x = 15-16 (ancrage 16 comme KAGE). Proportions de
# poupée : grosse tête ronde, petit corps, pieu court.
# ---------------------------------------------------------------------------
MASTER = {
    "sprout": (11, 7, [            # chignon de paille, replié vers l'avant
        "......uU",
        ".....uUu",
    ]),
    "head": (11, 9, [
        "....rR",                  # lien du chignon
        "..tuUuUut",
        ".tTuUuUuTt",
        "tTuCccccCt",              # visage : toile vierge, cousue sur la paille
        "RuccccccCC",
        "tTcccccccC",
        "tuCcccccCC",
        ".tTCccCCt",
        "..tuTuTt",
    ]),
    "neck": (11, 18, ["..tRrRr"]),
    "torso": (11, 19, [
        ".tuTUuUuTt",
        "tTuTUuNIuT",              # tête du clou
        "tuTuUuppTt",              # talisman
    ]),
    "arm_l": (4, 19, [
        "...Uu..",
        "..uTuRu",                 # botte de paille liée au poignet
        "...ttrt",
    ]),
    "arm_r": (21, 19, [
        "..uU",
        "RuTu",
        "trt.",
    ]),
    "waist": (11, 22, ["..rRrRepR"]),
    "skirt": (9, 23, [            # jupe en cloche, effilochée au bord
        "...ttTtuPtTt",
        "..tuTuUuTuUut",
        ".tuTuUuTuUuTt",
        "tT.u.T.uU.u.Tt",
    ]),
}
ORDER = ["skirt", "waist", "torso", "neck", "head", "sprout", "arm_l", "arm_r"]
NAIL = (17, 20)           # tête du clou (sur la poitrine)
STAKE_TOP = 26

# ---------------------------------------------------------------------------
# variantes de parties : (x, y, lignes) absolus
# ---------------------------------------------------------------------------
SPROUT_UP = (11, 3, [         # chignon dressé tout droit : il va attaquer
    "...U.U",
    "...uUu",
    "....Uu",
    "....uU",
    "....uU",
    "....uU",
])
SPROUT_DROOP = (8, 8, [       # chignon retombé en vrille : il a le tournis
    "uUu.....",
    "U.uU....",
    ".Uu.uU..",
])
SPROUT_FLAT = (12, 7, [       # chignon aplati vers l'arrière (élan du bond)
    "uUUu...",
    "..uUu..",
])
SPROUT_TORN = (11, 6, [       # chignon à moitié défait
    "...U..uU",
    "u...uU.u",
    ".u..uUu.",
])
HEAD_TORN = (11, 9, [         # la paille sort par les coutures
    "U...rR..u",
    ".utuUuUutU",
    ".tTuUuUuTt",
    "tTuCccc.uU",
    "RuccccuU.",
    "tTcccccCu",
    "tuCcccccCC",
    ".tTCccCCt",
    "..tuTuTt",
])
TORSO_TORN = (11, 19, [
    "utuTUuUuTt.U",
    "tTuTUuNIuT",
    "tuTuUuppTt",
])
HEAD_BACK = (11, 9, [         # vue de dos : nœud du masque
    "....rR",
    "..tuUuUut",
    ".tTuUuUuTt",
    "tTuUuTuTut",
    "tuTuRrRuTt",
    "tTuRuuRuTt",
    "tuTuRRuTut",
    ".tTuUuTut",
    "..tuTuTt",
])
# bras : levés (youpi), ballants, collés au corps, en moulinet
ARM_L_UP = (5, 13, ["Uu...", "uTu..", ".uTu.", "..uR.", "...tu", "....tt"])
ARM_R_UP = (21, 13, ["...uU", "..uTu", ".uTu.", ".Ru..", "tu...", "t...."])
ARM_L_LIMP = (6, 19, ["...tuT", "..uTu.", ".Ru...", "uU...."])
ARM_R_LIMP = (21, 19, ["Tut...", ".uTu..", "...uR.", "....Uu"])
ARM_L_TUCK = (8, 19, ["..tu", ".uTu", ".uR.", ".Uu."])
ARM_R_TUCK = (21, 19, ["ut..", "uTu.", ".Ru.", ".uU."])
ARM_L_OUT = (0, 19, ["Uu.........", "uTRuTuUuTuT", ".trttTttTtt"])
ARM_R_OUT = (21, 19, ["........uU", "TuTuUuTuRTu", "tTttTttrtt"])

SKIRT_SQUASH = (7, 24, [
    ".....tuTUuPuUt",
    "...ttuTuUuTuUutt",
    ".tuT.uUu...TuTut",
    "T...u.T.....u..Tt",
])
SKIRT_STRETCH = (10, 23, [
    "..tuTUuPuU",
    "..tuTuUuTt",
    "..tuT.uTt",
    "...T.u.T",
    "...t..T",
])
SKIRT_OPEN = (5, 23, [        # au sommet du bond, la jupe s'ouvre en corolle
    ".......tuTUuPuUt",
    ".....ttuTuUuTuUutt",
    "...tuT..uU..u..TuTt",
    "..tT...u...T....uTt",
    ".t.....T.......u...t",
])


def stake(cv, top=STAKE_TOP, x=CX - 1, bottom=GROUND):
    """Pieu de bois (2 px), virole de fer en bas."""
    for y in range(top, bottom - 1):
        cv.put(x, y, "Ww")
    cv.put(x, bottom - 1, "NI")
    cv.put(x, bottom, "nN")


def draw(cv, parts=None, shift=None, skip=(), stake_top=STAKE_TOP):
    """Compose WARA. parts remplace des parties (x, y, lignes), shift les décale de (dx, dy)."""
    parts = parts or {}
    shift = shift or {}
    stake(cv, stake_top)
    for name in ORDER:
        if name in skip:
            continue
        x, y, rows = parts.get(name, MASTER[name])
        dx, dy = shift.get(name, (0, 0))
        cv.block(x + dx, y + dy, rows)


UPPER = ("sprout", "head", "neck", "torso", "arm_l", "arm_r", "waist")


def lift(dy, dx=0, names=UPPER):
    return {n: (dx, dy) for n in names}


def glow_nail(cv, dx=0, dy=0, strong=False):
    """Lueur sur le clou (le talisman se réveille)."""
    x, y = NAIL[0] + 2 + dx, NAIL[1] + dy
    cv.pixels([(x, y), (x, y - 1)], "g")
    if strong:
        cv.pixels([(x + 1, y), (x, y - 2)], "G")


def _torn(parts, torn):
    if torn:
        parts.setdefault("head", HEAD_TORN)
        parts.setdefault("sprout", SPROUT_TORN)
        parts.setdefault("torso", TORSO_TORN)
    return parts


def star(cv, x, y):
    """Petite étoile de vertige."""
    cv.pixels([(x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)], "F")
    cv.put(x, y, "X")


# ---------------------------------------------------------------------------
# poses
# ---------------------------------------------------------------------------
def idle(phase=0, torn=False):
    """Repos : il se dandine sur son pieu, un bras ballant puis l'autre."""
    cv = Canvas()
    if phase == 0:
        parts = {"arm_r": ARM_R_LIMP}
        sh = {"sprout": (1, 0)}
    else:
        parts = {"arm_l": ARM_L_LIMP}
        sh = lift(1, -1, ("head", "sprout", "neck"))
        sh["sprout"] = (-2, 1)
    draw(cv, _torn(parts, torn), sh)
    return cv.outline()


def hop_crouch(torn=False):
    """Bond 1 : il se ratatine, bras collés, prêt à jaillir."""
    cv = Canvas()
    parts = _torn({"skirt": SKIRT_SQUASH, "arm_l": ARM_L_TUCK, "arm_r": ARM_R_TUCK}, torn)
    sh = lift(3)
    sh["head"] = (0, 3)
    draw(cv, parts, sh, stake_top=27)
    cv.put(CX - 8, GROUND, "x..............x")
    return cv.outline()


def hop_rise(torn=False):
    """Bond 2 : il file vers le haut, raide comme un crayon, chignon aplati."""
    cv = Canvas()
    parts = _torn({"skirt": SKIRT_STRETCH, "arm_l": ARM_L_TUCK, "arm_r": ARM_R_TUCK,
                   "sprout": SPROUT_FLAT}, torn)
    draw(cv, parts, lift(-1))
    return cv.outline()


def hop_air(torn=False):
    """Bond 3 : au sommet, bras en l'air — youpi !"""
    cv = Canvas()
    parts = _torn({"skirt": SKIRT_OPEN, "arm_l": ARM_L_UP, "arm_r": ARM_R_UP}, torn)
    draw(cv, parts)
    cv.pixels([(4, 26), (28, 25), (2, 28)], "f")
    return cv.outline()


def hop_land(torn=False):
    """Bond 4 : atterrissage en accordéon, les bras rebondissent."""
    cv = Canvas()
    parts = _torn({"skirt": SKIRT_SQUASH, "arm_l": ARM_L_LIMP, "arm_r": ARM_R_LIMP}, torn)
    sh = lift(3)
    sh["head"] = (0, 2)
    sh["sprout"] = (1, 1)
    draw(cv, parts, sh, stake_top=27)
    cv.block(3, GROUND - 2, ["x...................x", ".xX.................Xx", "..x..................x"])
    cv.pixels([(7, 17), (26, 15)], "F")
    return cv.outline()


def spin_windup():
    """Moulinet 1 : le chignon se dresse d'un coup, il remonte ses manches (signal)."""
    cv = Canvas()
    parts = {"sprout": SPROUT_UP, "arm_l": ARM_L_UP, "arm_r": ARM_R_TUCK, "skirt": SKIRT_SQUASH}
    sh = lift(2)
    sh["sprout"] = (0, 2)
    draw(cv, parts, sh, stake_top=27)
    glow_nail(cv, 0, 2, strong=True)
    cv.pixels([(13, 3), (19, 3), (12, 6), (20, 6)], "X")   # traits de surprise
    return cv.outline()


def spin_a():
    """Moulinet 2 : bras en hélice (gauche en haut, droit en bas), paille qui vole."""
    cv = Canvas()
    parts = {"sprout": SPROUT_UP, "arm_l": ARM_L_UP, "arm_r": ARM_R_LIMP}
    draw(cv, parts, {"sprout": (-1, 1)})
    cv.put(1, 12, "ss")
    cv.put(0, 16, "s")
    cv.put(29, 26, "ss")
    cv.put(31, 22, "s")
    cv.pixels([(3, 21), (30, 14)], "f")
    glow_nail(cv)
    return cv.outline()


def spin_b():
    """Moulinet 3 : de dos, bras inversés (droit en haut, gauche en bas)."""
    cv = Canvas()
    parts = {"head": HEAD_BACK, "sprout": SPROUT_UP, "arm_l": ARM_L_LIMP, "arm_r": ARM_R_UP}
    draw(cv, parts, {"sprout": (1, 1)})
    cv.put(30, 12, "ss")
    cv.put(32, 16, "s")
    cv.put(1, 26, "ss")
    cv.put(0, 22, "s")
    cv.pixels([(29, 21), (2, 14)], "f")
    return cv.outline()


def dizzy(phase=0):
    """Vertige : tête penchée, bras ballants, chignon en vrille, étoiles."""
    cv = Canvas()
    side = 1 if phase == 0 else -1
    parts = {"sprout": SPROUT_DROOP, "arm_l": ARM_L_LIMP, "arm_r": ARM_R_LIMP}
    sh = {"head": (side, 1), "sprout": (side + (4 if side < 0 else 0), 1), "neck": (0, 0)}
    draw(cv, parts, sh)
    if phase == 0:
        star(cv, 10, 5)
        star(cv, 22, 3)
        cv.put(16, 2, "F")
    else:
        star(cv, 14, 2)
        star(cv, 24, 6)
        cv.put(9, 4, "F")
    return cv.outline()


def hurt(torn=False):
    """Touché : il bondit en arrière, bras en l'air, le chignon s'envole presque."""
    cv = Canvas()
    parts = _torn({"arm_l": ARM_L_UP, "arm_r": ARM_R_UP}, torn)
    parts["sprout"] = SPROUT_UP if not torn else SPROUT_TORN
    sh = lift(-1, -2)
    sh["head"] = (-3, -1)
    sh["sprout"] = (-4, -2)
    draw(cv, parts, sh)
    cv.pixels([(27, 17), (29, 19), (28, 23), (31, 15), (26, 12)], "F")
    cv.pixels([(30, 21), (32, 17), (33, 23)], "f")
    cv.block(24, 18, ["X..", ".X.", "..X"])
    return cv.outline()


# ---------------------------------------------------------------------------
# Mort en 4 temps : tranché, pouf, en tas, le talisman s'envole
# ---------------------------------------------------------------------------
def death_cut():
    """Mort 1 : tranché en biais ; le haut glisse, l'air étonné (chignon dressé)."""
    cv = Canvas()
    draw(cv, _torn({"sprout": SPROUT_UP, "arm_l": ARM_L_UP, "arm_r": ARM_R_UP}, True))
    g = cv.g
    line = lambda x: 23 - (x - CX) * 2 // 3
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
    for x in range(3, 30):
        y = line(x)
        if 0 <= y < H and g[y, x] == ".":
            g[y, x] = "X"
    return cv.outline()


def death_poof():
    """Mort 2 : pouf ! un nuage de paille ; la tête saute en l'air."""
    cv = Canvas()
    stake(cv, 25)
    cv.block(9, 24, ["..tuT.uUu.TuTt", "tT.u.T..u.uTt"])
    x, y, rows = MASTER["head"]
    cv.block(22, 1, rows[1:])                                  # la tête saute
    cv.block(27, 0, ["uU"])
    cv.block(15, 13, ["pp", "ep", "pe"])                       # talisman décroché
    for (px, py, c) in [(4, 9, "F"), (7, 14, "f"), (2, 17, "F"), (9, 6, "f"), (19, 9, "F"),
                        (13, 4, "f"), (35, 13, "F"), (32, 18, "f"), (11, 9, "F"), (24, 15, "f"),
                        (1, 12, "f"), (37, 8, "F"), (10, 18, "f"), (27, 19, "F"), (6, 3, "F"),
                        (5, 21, "f"), (36, 21, "f"), (18, 6, "f"), (21, 18, "F")]:
        cv.put(px, py, c)
    cv.block(6, 18, ["x.xx.", "xx..x", ".x.x."])                 # petit nuage
    cv.block(24, 20, [".xx.x", "x..xx"])
    cv.block(3, 12, ["Uu..", ".uTR", "..tt"])                  # bras qui retombent
    cv.block(30, 9, ["..uU", "RuT.", "tt.."])
    return cv.outline()


def _pile(cv):
    """Tas de paille, bras qui dépassent, la tête posée dessus comme une cerise."""
    cv.block(6, 26, [
        "...........u..T.....",
        ".......tuTUu.uTu.T..",
        "...tuTuUuTuUuTuTuut.",
        ".tTuUuTuTuUuTuTuTuTt",
    ])
    cv.block(3, 27, ["Uu.", "uTR"])                            # bras qui dépassent
    cv.block(26, 27, [".uU", "RuT"])
    x, y, rows = MASTER["head"]
    cv.block(11, 18, rows[1:])
    cv.block(16, 16, ["uU", "uUu"])                            # chignon tout mou


def death_pile():
    """Mort 3 : il retombe en tas, la tête atterrit dessus."""
    cv = Canvas()
    _pile(cv)
    cv.block(4, 29, ["x..x", ".xx."])
    cv.block(27, 25, ["x.x"])
    star(cv, 8, 15)
    star(cv, 25, 13)
    return cv.outline()


def death_free():
    """Mort 4 : le talisman s'envole en voletant ; WARA redevient un simple mannequin."""
    cv = Canvas()
    _pile(cv)
    cv.block(23, 4, ["pp", "ep", "pe", ".P"])                 # le talisman s'en va
    cv.pixels([(21, 9), (22, 11), (20, 13)], "a")
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
