"""WARA — pantin de paille du dojo maudit. Planche de design (avant intégration en jeu).

Un mannequin d'entraînement (makiwara) cloué par un grand clou de fer qui
retient un talisman de malédiction. Il bondit sur son pieu et tournoie avec sa
traverse de bois. Dessin pixel par pixel sur une cellule 48x32, orientation
droite, contour extérieur ajouté automatiquement (comme KAGE et TATE).
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
    "k": "#1d1a20",                                   # encre (œil peint, coutures)
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
# cellule ; le pieu est en x = 15-16 (ancrage 16 comme KAGE). Les autres poses
# remplacent ou décalent des parties : WARA reste identique d'une image à l'autre.
# ---------------------------------------------------------------------------
MASTER = {
    "head": (11, 5, [
        "......uU",               # chignon de paille (chonmage) replié vers l'avant
        "....uUTu",
        "...rRu",                 # lien du chignon
        ".tuUuUuUt",
        "tTuCkkkccC",             # masque de toile cousu sur la paille ;
        "RuckccckcC",             # œil unique : une cible de tir à l'arc (mato)
        "tTckceckcC",             # peinte à l'encre, centre rouge
        "tuckccckcC",
        "tTcckkkccC",
        ".tuCcccCC",
    ]),
    "neck": (11, 15, ["..tRrRr"]),
    "torso": (11, 16, [
        "tuTUuUuTut",
        "TuTuUuTuUu",
        "TuTUuNIuTu",             # tête du clou de fer
        "tTuUuuppuTt",            # talisman cloué
        ".tuTuUepTt",
    ]),
    "arm_l": (4, 16, [
        "...Uu..",
        "..uTuRu",                # botte de paille liée au poignet
        "...ttrt",
    ]),
    "arm_r": (21, 16, [
        "..uU",
        "RuTu",
        "trt.",
    ]),
    "waist": (11, 21, ["..rRrRpprR"]),
    "skirt": (9, 22, [
        "...tuTUuPUut",
        "..tuTuUuTuUut",
        ".tuT.uUu.TuTt",
        "tT.u.T..u.u.Tt",
        "t...T....u...t",
    ]),
}
ORDER = ["skirt", "waist", "torso", "neck", "head", "arm_l", "arm_r"]
NAIL = (16, 18)           # tête du clou (sur la poitrine)
NAIL_TIP = (9, 19)        # pointe qui ressort dans le dos
PUPIL = (16, 11)          # centre de l'ensō

# ---------------------------------------------------------------------------
# variantes de parties (mêmes repères que MASTER)
# ---------------------------------------------------------------------------
HEAD_TORN = [                 # masque déchiré, paille qui jaillit, centre de la cible en braise
    "u.....uU.U",
    ".u..uUTuU",
    "...r.u",
    ".tuUuUuUtu",
    "tTuCkkkuU",
    "RuckccuU",
    "tTckcgckcC",
    "tuckccckcC",
    "tTcckkkccC",
    ".tuCcccCC",
]
HEAD_TURNED = [               # tournée vers l'arrière : on voit le nœud du masque
    "..uUu",
    ".uUTUu",
    "...Rr",
    ".tuUuUuUt",
    "CtTuUuTuTt",
    "cCuTRrRuTt",
    "kCTuRuRuTt",
    "cCuTuRuTut",
    "CtTuUuTuTt",
    ".tuTuUtt",
]
HEAD_BACK = [                 # vue de dos (pendant le tour)
    "...uUu",
    "..uUTUu",
    "....rR",
    ".tuUuUuUt",
    "tTuUuTuTut",
    "tuTuRrRuTt",
    "tTuRuuRuTt",
    "tuTuRRuTut",
    "tTuUuTuTut",
    ".tuTuUtt",
]
TORSO_TORN = [                # corde du cou tranchée : le buste s'ébouriffe
    "tuTUuUuTut.U",
    "TuTuUuTuUu",
    "TuTUuNIuTu",
    "tTuUuuppuTt",
    ".tuTuUepTt",
]
NECK_TORN = ["..t.R.Rr"]
ARM_L_UP = ["...uU", "..uTuR", "...trt"]
ARM_R_UP = [".Uu", "RuTu", "rt"]
ARM_L_EXT = [                 # bras tendus à l'horizontale (tournoiement)
    "Uu........",
    "uTRuTuUuTuT",
    ".trttTttTtt",
]
ARM_R_EXT = [
    "........uU",
    "TuTuUuTuRTu",
    "tTttTttrtt",
]
SKIRT_SQUASH = (8, 23, [
    "...tuTUuPUutt",
    ".ttuTuUuTuUutt",
    "tuT.uUu..TuTut",
    "T..u.T....u..Tt",
])
SKIRT_STRETCH = (9, 22, [
    "...tuTUuPUut",
    "...tuTuUuTut",
    "....tuT.uTt",
    "....T.u.T.t",
    "....t..T..t",
    ".......t",
])
SKIRT_OPEN = (6, 22, [        # au sommet du bond, la jupe s'ouvre en corolle
    "......tuTUuPUut",
    "....ttuTuUuTuUutt",
    "..tuT..uU..u..TuTt",
    ".tT...u...T....uTt",
    "t.....T.......u...t",
])


def stake(cv, top=25, x=CX - 1, bottom=GROUND):
    """Pieu de bois (2 px), virole de fer en bas."""
    for y in range(top, bottom - 1):
        cv.put(x, y, "Ww")
    cv.put(x, bottom - 1, "NI")
    cv.put(x, bottom, "nN")


def draw(cv, parts=None, shift=None, skip=(), stake_top=25, pupil=None):
    """Compose WARA. parts remplace des lignes (ou (x, y, lignes)), shift décale (dx, dy)."""
    parts = parts or {}
    shift = shift or {}
    stake(cv, stake_top)
    for name in ORDER:
        if name in skip:
            continue
        x, y, rows = MASTER[name]
        alt = parts.get(name)
        if isinstance(alt, tuple):
            x, y, rows = alt
        elif alt is not None:
            rows = alt
        dx, dy = shift.get(name, (0, 0))
        cv.block(x + dx, y + dy, rows)
    tdx, tdy = shift.get("torso", (0, 0))
    if "torso" not in skip:
        cv.put(NAIL_TIP[0] + tdx, NAIL_TIP[1] + tdy, "n")
    hdx, hdy = shift.get("head", (0, 0))
    if parts.get("head") is None and pupil:
        cv.put(PUPIL[0] + hdx, PUPIL[1] + hdy, pupil)


def body_up(dy, dx=0):
    return {n: (dx, dy) for n in ("head", "neck", "torso", "arm_l", "arm_r", "waist")}


def glow_nail(cv, dx=0, dy=0, strong=False):
    """Lueur de braise autour de la tête du clou (signal d'attaque)."""
    x, y = NAIL[0] + 2 + dx, NAIL[1] + dy
    cv.pixels([(x, y), (x, y - 1)], "g")
    if strong:
        cv.pixels([(x + 1, y), (x, y - 2), (x + 1, y + 1)], "G")


def _torn(parts, torn):
    if torn:
        parts.setdefault("head", HEAD_TORN)
        parts.update({"torso": TORSO_TORN, "neck": NECK_TORN})
    return parts


# ---------------------------------------------------------------------------
# poses
# ---------------------------------------------------------------------------
def idle(phase=0, torn=False):
    """Repos : il se balance sur son pieu, le chignon dodeline."""
    cv = Canvas()
    sh = body_up(phase)
    sh["head"] = (phase, phase)
    draw(cv, _torn({}, torn), sh)
    if torn:
        glow_nail(cv, 0, phase)
    return cv.outline()


def hop_crouch(torn=False):
    """Bond 1 : il se tasse, la jupe s'écrase."""
    cv = Canvas()
    sh = body_up(3)
    sh["arm_l"] = (-1, 4)
    sh["arm_r"] = (1, 4)
    draw(cv, _torn({"skirt": SKIRT_SQUASH}, torn), sh, stake_top=26, pupil=None)
    cv.put(CX - 7, GROUND, "x............x")
    return cv.outline()


def hop_rise(torn=False):
    """Bond 2 : il s'étire en quittant le sol, la jupe traîne."""
    cv = Canvas()
    sh = body_up(-1)
    sh["arm_l"] = (1, -3)
    sh["arm_r"] = (0, -3)
    draw(cv, _torn({"skirt": SKIRT_STRETCH, "arm_l": ARM_L_UP, "arm_r": ARM_R_UP}, torn), sh)
    return cv.outline()


def hop_air(torn=False):
    """Bond 3 : au sommet, la paille s'ouvre en corolle."""
    cv = Canvas()
    draw(cv, _torn({"skirt": SKIRT_OPEN}, torn), {"arm_l": (-1, -1), "arm_r": (1, -1)})
    cv.pixels([(4, 25), (28, 24), (3, 27)], "f")
    return cv.outline()


def hop_land(torn=False):
    """Bond 4 : atterrissage lourd, poussière, brins qui s'échappent."""
    cv = Canvas()
    sh = body_up(3)
    sh["head"] = (0, 2)
    sh["arm_l"] = (-1, 5)
    sh["arm_r"] = (1, 5)
    draw(cv, _torn({"skirt": SKIRT_SQUASH}, torn), sh, stake_top=26)
    cv.block(3, GROUND - 2, ["x...................x", ".xX.................Xx", "..x..................x"])
    cv.pixels([(6, 15), (27, 13), (29, 18)], "F")
    return cv.outline()


def spin_windup():
    """Tournoiement 1 : il se tord, un bras lancé derrière lui ; l'œil-cible s'allume (signal)."""
    cv = Canvas()
    sh = {"head": (-2, 1), "neck": (-1, 0), "torso": (-1, 0), "arm_l": (-4, -1), "arm_r": (-5, 1)}
    draw(cv, {"arm_l": ARM_L_EXT, "arm_r": [".uU", "RuTu", ".tt"]}, sh, pupil="g")
    glow_nail(cv, -1, 0, strong=True)
    cv.pixels([(PUPIL[0] - 2, PUPIL[1] - 2), (PUPIL[0] - 1, PUPIL[1] - 3)], "G")
    return cv.outline()


def spin_open():
    """Tournoiement 2 : bras tendus, la paille fouette devant et derrière."""
    cv = Canvas()
    draw(cv, {"head": HEAD_BACK, "arm_l": ARM_L_EXT, "arm_r": ARM_R_EXT},
         {"arm_l": (-4, 0), "arm_r": (0, 0)}, pupil=None)
    cv.put(1, 13, "sss")
    cv.put(0, 20, "ss")
    cv.put(32, 14, "sss")
    cv.put(33, 20, "ss")
    cv.put(36, 17, "s")
    return cv.outline()


def spin_front():
    """Tournoiement 3 : de face, bras raccourcis par la perspective, traînées enroulées."""
    cv = Canvas()
    draw(cv, {"arm_l": [".Uu", "uTuR", ".trt"], "arm_r": ["uU.", "RuTu", "rtt"]},
         {"arm_l": (5, 0), "arm_r": (-3, 0)}, pupil="g")
    cv.put(1, 14, "sss........................sss")
    cv.put(0, 17, "s..............................s")
    cv.put(2, 21, "ss..........................ss")
    glow_nail(cv)
    return cv.outline()


def dizzy(phase=0):
    """Vertige : il titube après son tour — la fenêtre pour frapper."""
    cv = Canvas()
    sh = body_up(0)
    sh["head"] = (1 - 2 * phase, 1)
    sh["arm_l"] = (0, 1 - phase)
    sh["arm_r"] = (0, phase)
    draw(cv, {}, sh, pupil=None)
    x = 13 + (1 - 2 * phase)
    cv.block(x, 1, [".F..f.", "f....F", "..f...", ] if phase == 0 else ["..f.F.", "F.....", ".f..f."])
    return cv.outline()


def hurt(torn=False):
    """Touché : il plie en arrière, la paille est arrachée par la lame."""
    cv = Canvas()
    sh = {"head": (-2, 1), "neck": (-1, 0), "torso": (-1, 0), "arm_l": (-2, 1), "arm_r": (-1, -1)}
    draw(cv, _torn({}, torn), sh, pupil=None)
    cv.pixels([(27, 14), (29, 16), (28, 21), (31, 13), (26, 10)], "F")
    cv.pixels([(30, 19), (32, 15), (33, 21)], "f")
    cv.block(25, 15, ["X..", ".X.", "..X"])
    if torn:
        glow_nail(cv, -1, 0)
    return cv.outline()


# ---------------------------------------------------------------------------
# Mort en 4 temps : tranché, éclatement, effondrement, le talisman brûle
# ---------------------------------------------------------------------------
def death_cut():
    """Mort 1 : tranché en biais ; le haut glisse le long de la coupe."""
    cv = Canvas()
    draw(cv, _torn({}, True))
    g = cv.g
    line = lambda x: 22 - (x - CX) * 2 // 3          # diagonale montante vers l'avant
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
    glow_nail(cv, 2, 1, strong=True)
    return cv.outline()


def death_burst():
    """Mort 2 : la paille éclate, la tête s'envole, les bras tombent."""
    cv = Canvas()
    stake(cv, 24)
    x, y, rows = MASTER["skirt"]
    cv.block(x, y + 1, rows[1:])
    cv.block(x, y, ["..u.T.uU.T.u"])
    cv.block(26, 3, HEAD_TORN[3:])                         # la tête part en vrille
    cv.block(31, 0, ["uU", ".r"])
    cv.block(16, 12, ["NI", "pp", "ep", "pe"])             # le clou s'arrache avec le talisman
    for (px, py, c) in [(4, 9, "F"), (7, 13, "f"), (2, 16, "F"), (9, 6, "f"), (21, 10, "F"),
                        (18, 3, "f"), (36, 15, "F"), (33, 18, "f"), (12, 8, "F"), (23, 15, "f"),
                        (1, 11, "f"), (39, 9, "F"), (10, 17, "f"), (27, 19, "F"), (14, 4, "F"),
                        (5, 19, "f"), (37, 21, "f"), (20, 7, "f"), (24, 2, "F")]:
        cv.put(px, py, c)
    cv.block(5, 12, ["...Uu", "..uTR", ".uTt.", "tt..."])       # bras qui retombent
    cv.block(27, 17, ["uU..", ".RuT", "..tt"])
    return cv.outline()


def _pile(cv):
    """Tas de paille, pieu couché, tête qui a roulé sur le côté."""
    cv.block(7, 25, [
        "..........u..T.......",
        ".......tuTUu.uTu.T...",
        "....tuTuUuTuUuTuTuut.",
        "..tTuUuTuTuUuTuTuTuTt",
        ".tuTrRrRtuTUuTuTrRrRt",
    ])
    cv.put(29, 29, "WWWWWWWWNI")
    cv.put(29, 30, "wwwwwwwwnN")
    cv.block(0, 25, [".tuUuUt.", "tTuCccCc", "RuckkccC", "tTkcckcC", ".tckkcC."])   # tête au sol


def death_collapse():
    """Mort 3 : tout retombe en tas ; le clou reste planté dans la paille."""
    cv = Canvas()
    _pile(cv)
    cv.block(18, 22, ["NI", "nN", ".n"])
    cv.block(20, 21, ["pp", "ep", "pe", "P."])
    cv.block(9, 27, ["x..x", ".xx."])
    cv.put(23, 23, "x.x")
    return cv.outline()


def death_burn():
    """Mort 4 : le talisman se consume ; la malédiction s'éteint."""
    cv = Canvas()
    _pile(cv)
    cv.block(18, 22, ["NI", "nN", ".n"])
    cv.block(20, 22, ["Gp", "ga", ".a"])
    cv.pixels([(21, 19), (23, 16), (22, 13), (24, 10)], "a")
    cv.pixels([(22, 20), (20, 15)], "g")
    return cv.outline()


POSES = {
    "repos_1": idle(0),
    "repos_2": idle(1),
    "bond_1_tasse": hop_crouch(),
    "bond_2_envol": hop_rise(),
    "bond_3_sommet": hop_air(),
    "bond_4_atterrit": hop_land(),
    "tour_1_elan": spin_windup(),
    "tour_2_dos": spin_open(),
    "tour_3_face": spin_front(),
    "vertige_1": dizzy(0),
    "vertige_2": dizzy(1),
    "touche": hurt(),
    "abime_repos": idle(0, torn=True),
    "abime_touche": hurt(torn=True),
    "mort_1_coupe": death_cut(),
    "mort_2_eclate": death_burst(),
    "mort_3_effondre": death_collapse(),
    "mort_4_braise": death_burn(),
}
