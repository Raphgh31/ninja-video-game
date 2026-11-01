"""TATE — garde au bouclier. Planche de design (avant intégration en jeu).

Dessin pixel par pixel : chaque pose est peinte sur une cellule 48x32 avec des
primitives (chaînes de pixels posées à des coordonnées), orientation droite.
Le contour extérieur est ajouté automatiquement, comme pour KAGE.
"""
import numpy as np

W, H = 48, 32

# palette propre à TATE (caractère -> couleur)
PAL = {
    "O": "#140e0d",                                   # contour
    "j": "#1f1513", "J": "#3a2522", "i": "#6a4136",   # chapeau laqué
    "r": "#8e3b34",                                   # liseré rouge du chapeau
    "m": "#2a2d34", "M": "#4c515c", "n": "#6d737e",   # masque de fer
    "e": "#f0c25a",                                   # yeux ambrés
    "c": "#1b2030", "C": "#2b3349", "k": "#46516c",   # vêtements indigo
    "a": "#5a2621", "A": "#8e3b34", "q": "#b25a4c",   # armure laquée
    "y": "#c9b48a", "Y": "#9c8762",                   # corde de paille
    "g": "#a39d8a", "G": "#76705f",                   # guêtres
    "s": "#3a2c22",                                   # sandales
    "w": "#4e321d", "V": "#6f4b2c", "v": "#946a40",   # bois du bouclier
    "b": "#33373f", "B": "#5f656f", "R": "#a3a9b3",   # fer, rivets
    "E": "#a8433a",                                   # emblème peint
    "p": "#e8e0c4", "P": "#c9bf9e",                   # talisman de papier
    "X": "#f4e7b8", "x": "#c9bd90",                   # étincelles / poussière (sans contour)
    "Z": "#f0c25a",                                   # étoiles d'étourdissement (sans contour)
    "h": "#f6dd8a", "l": "#d8b866",                   # halo du talisman (sans contour)
}
NO_OUTLINE = set("XxZhl")


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

    def outline(self):
        solid = (self.g != ".") & ~np.isin(self.g, list(NO_OUTLINE)) & (self.g != "O")
        near = np.zeros_like(solid)
        near[1:, :] |= solid[:-1, :]
        near[:-1, :] |= solid[1:, :]
        near[:, 1:] |= solid[:, :-1]
        near[:, :-1] |= solid[:, 1:]
        self.g[(self.g == ".") & near] = "O"
        return self.g


# ---------------------------------------------------------------------------
# pièces
# ---------------------------------------------------------------------------
HAT = [                       # jingasa : cône large et pointu, liseré rouge
    ".......J.......",
    ".....jjJii.....",
    "...jjjJJJii....",
    ".jjjjJJJJJJii..",
    "rrrrrrrrrrrrrrr",
]
HEAD = [                      # masque de fer, yeux ambrés vers l'avant
    ".cmMMMMn",
    ".cmMMeMe",
    ".cmnMnMn",
    "..cmmmm.",
]
TALISMAN = [                  # ofuda : bande de papier fine et longue, qui ondule vers
    "..y",                    # l'arrière, coin du bas replié (point faible)
    ".pp",
    ".Ep",
    "pp.",
    "Ep.",
    "pp.",
    "pE.",
    "Pp.",
    "P..",
]
HALO = [                      # halo doux autour du talisman (pulse lentement en jeu)
    "..lhl..",
    ".h...h.",
    "l.....l",
    "h......",
    "l......",
    "h......",
    "l......",
    "h.....l",
    ".h...h.",
    "..lhl..",
]


def back_gear(cv, bx, by, glow=False):
    """Talisman dans le dos + cordon de paille en bandoulière sur l'armure.
    (bx, by) = origine du buste."""
    if glow:
        cv.block(bx - 9, by - 3, HALO)
    cv.block(bx - 7, by - 2, TALISMAN)
    # cordon d'1 px : de l'attache du talisman, par-dessus l'épaule, puis en
    # diagonale sur le buste jusqu'à la hanche avant
    for x, y in [(bx - 4, by - 2), (bx - 3, by - 2), (bx - 2, by - 1), (bx - 1, by - 1),
                 (bx, by), (bx + 2, by + 1), (bx + 4, by + 2), (bx + 6, by + 3), (bx + 8, by + 4)]:
        cv.put(x, y, "y")


def shield(cv, x, y, h=23, tilt=0):
    """Grand bouclier vu de trois quarts : face en planches, tranche à droite."""
    for j in range(h):
        row = "VvVwVvV" + "ww"
        if j in (2, h // 2, h - 3):
            row = "BRBBBRB" + "bb"          # bandes de fer et rivets
        cv.put(x + (tilt if j < h // 2 else 0), y + j, row)
    # emblème : tomoe stylisé
    mx, my = x + 1 + tilt, y + h // 2 - 5
    cv.block(mx, my, [".EEE.", "EE.EE", "E..EE", "EEEE.", ".EE.."])


def body(cv, x, y, lean=0):
    """Buste en armure laquée, ceinture de corde, hakama."""
    cv.block(x + lean, y, [
        "..aAAqAc....",
        ".aAAAAAAc...",
        "aAqAAqAAa...",
        "aaAaaAaaa...",
        "aAAqAAqAa...",
    ])
    cv.block(x, y + 5, [
        "yYyyYyyYy...",
        ".cCCcCCkC...",
        ".cCCcCCCC...",
        "cCCkcCCCCc..",
    ])


def legs(cv, x, y, phase=0):
    """Jambes courtes et larges (pas lourd), guêtres claires, sandales ; phase = 0 / 1."""
    if phase == 0:
        cv.block(x, y, [
            ".cC.....cC..",
            ".gG.....gG..",
            "gG.......gG.",
            "ss........ss",
            "sss.......sss",
        ])
    else:
        cv.block(x, y, [
            "..cC...cC...",
            "..gG...gG...",
            ".gG.....gG..",
            ".ss.....ss..",
            ".sss....sss.",
        ])


def back_arm(cv, x, y, raised=False):
    rows = ["aA", "cC", "cC", "bB", "gG"] if not raised else ["aA", "cC", "bB", "gG"]
    cv.block(x, y, rows)


# ---------------------------------------------------------------------------
# poses
# ---------------------------------------------------------------------------
def walk(phase, glow=False):
    cv = Canvas()
    bob = 1 if phase else 0
    legs(cv, 9, 25, phase)
    back_arm(cv, 8, 16 + bob)
    body(cv, 10, 15 + bob)
    back_gear(cv, 10, 15 + bob, glow)
    cv.block(11, 11 + bob, HEAD)          # tête dans l'axe du cou
    cv.block(8, 6 + bob, HAT)
    shield(cv, 21, 9 + bob, h=21 - bob)   # le bouclier reste posé au sol
    return cv.outline()


def guard(glow=False, sparks=True):
    """Coup bloqué : le bouclier encaisse, étincelles devant, buste arc-bouté.
    Sans étincelles, la même pose sert d'élan avant le coup de bouclier."""
    cv = Canvas()
    legs(cv, 8, 25, 0)
    back_arm(cv, 7, 17)
    body(cv, 10, 16, lean=1)
    back_gear(cv, 10, 16, glow)
    cv.block(12, 12, HEAD)
    cv.block(9, 7, HAT)
    shield(cv, 22, 9, h=21, tilt=-1)
    if sparks:
        cv.block(31, 12, ["X.x", ".X.", "X.X", "..x"])
        cv.block(32, 20, ["x.X", ".X."])
    return cv.outline()


def bash(glow=False):
    """Coup de bouclier : il se jette en avant, bouclier projeté, poussière."""
    cv = Canvas()
    cv.block(9, 25, [
        "..cC......cC",
        ".gG.....gG..",
        "gG....gG....",
        "ss....ss....",
        "sss...sss...",
    ])
    back_arm(cv, 12, 16)
    body(cv, 13, 15, lean=2)
    back_gear(cv, 13, 15, glow)
    cv.block(15, 11, HEAD)
    cv.block(12, 6, HAT)
    shield(cv, 27, 8, h=22)
    cv.block(2, 28, ["x..x", ".xx."])
    return cv.outline()


def stunned(glow=False):
    """Étourdi après un coup de bouclier raté : chapeau de travers, bouclier bas."""
    cv = Canvas()
    legs(cv, 9, 25, 1)
    back_arm(cv, 8, 17)
    body(cv, 10, 16)
    back_gear(cv, 10, 16, glow)
    cv.block(10, 12, ["..cmMMMMn", ".cmMMMnMn", ".cmnMnMn.", "..cmmmm.."])
    cv.block(6, 8, ["......jJ........", "....jjJJii......", "..jjjJJJJii.....", "rrrrrrrrrrrrr..."])
    shield(cv, 21, 14, h=16)
    cv.block(9, 3, ["Z...Z", ".Z.Z.", "..Z.."])
    cv.block(19, 5, ["Z", ".", "Z"])
    return cv.outline()


def defeated():
    """Vaincu : bouclier fendu au sol, TATE à genoux, chapeau tombé."""
    cv = Canvas()
    cv.block(9, 26, [
        "cCCCcCCCC.",
        "gGGgGGs...",
        "sssss.....",
    ])
    body(cv, 10, 17, lean=1)
    back_gear(cv, 10, 17)
    cv.block(12, 13, ["..cmMMMMn", ".cmMMXMXn", ".cmnMnMn.", "..cmmmm.."])
    # bouclier tombé à plat, fendu
    cv.put(22, 28, "VvVw.VvVwVvBRB")
    cv.put(22, 29, "BRBBb.BBRBVvVw")
    cv.put(22, 30, "wwwww.wwwwwwww")
    # chapeau au sol
    cv.block(36, 24, ["...J...", "..jJi..", "rrrrrrr"])
    return cv.outline()


POSES = {
    "marche_1": walk(0),
    "marche_2": walk(1),
    "point_faible": walk(0, glow=True),
    "garde": guard(),
    "coup_de_bouclier": bash(),
    "etourdi": stunned(),
    "vaincu": defeated(),
}


# ---------------------------------------------------------------------------
# Jeu : ordre des images dans la planche, et poses équivalentes avec halo
# ---------------------------------------------------------------------------
GAME_FRAMES = [
    ("walk_1", lambda g=False: walk(0, g)),
    ("walk_2", lambda g=False: walk(1, g)),
    ("guard", guard),
    ("windup", lambda g=False: guard(g, sparks=False)),
    ("bash", bash),
    ("stunned", stunned),
    ("defeated", lambda g=False: defeated()),
]
