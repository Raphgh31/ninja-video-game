"""KAGE — poses de toutes les animations (orientation de référence : droite).

Coordonnées absolues dans la cellule 48x32 (personnage sur x 0..31, sabre jusqu'à 47), y vers le bas. Les pieds au sol
touchent la ligne 30 (cheville en y=28 avec un pied « flat ») ; la ligne 31
reçoit le contour. Chaque frame est posée individuellement.
"""
from core import A, G, S, Frame
from rig import pose


def F(grid, *retouches, **meta):
    return Frame([G(grid), *retouches], meta=meta)


# ---------------------------------------------------------------------------
# IDLE — respiration : le buste descend d'1 px, le foulard ondule doucement
# ---------------------------------------------------------------------------
# Garde basse : jambe avant fléchie (genou en avant de la cheville), jambe
# arrière presque tendue vers l'arrière, poing lointain levé devant.
STANCE = dict(near_leg=[(19, 26), (18, 28)], far_leg=[(11, 26), (9, 28)],
              near_arm=[(17, 22), (18, 23)], far_arm=[(16, 21), (19, 20)])
STANCE_LOW = dict(near_leg=[(19, 27), (18, 28)], far_leg=[(11, 27), (9, 28)],
                  near_arm=[(17, 23), (18, 24)], far_arm=[(16, 22), (19, 21)])

IDLE = [
    F(pose(torso="up", tx=12, ty=19, **STANCE,
           tail_long=[(-2, 1), (-4, 3), (-5, 6), (-6, 10)],
           tail_short=[(-2, 2), (-3, 4), (-3, 8)])),
    F(pose(torso="up", tx=12, ty=19, **STANCE,
           tail_long=[(-2, 1), (-4, 3), (-6, 6), (-7, 10)],
           tail_short=[(-2, 2), (-3, 4), (-4, 8)])),
    F(pose(torso="up", tx=12, ty=20, **STANCE_LOW,
           tail_long=[(-2, 1), (-4, 3), (-6, 5), (-8, 9)],
           tail_short=[(-2, 2), (-4, 4), (-4, 8)])),
    F(pose(torso="up", tx=12, ty=20, **STANCE_LOW,
           tail_long=[(-2, 1), (-4, 3), (-5, 6), (-5, 10)],
           tail_short=[(-2, 2), (-3, 5), (-3, 8)])),
]

# ---------------------------------------------------------------------------
# RUN — cycle 6 temps : contact / appui / passage, puis l'autre jambe
# ---------------------------------------------------------------------------
RUN_TAILS = [
    ([(-3, 0), (-6, -1), (-9, 0), (-13, 1)], [(-3, 2), (-6, 2), (-9, 3)]),
    ([(-3, 0), (-6, 0), (-9, -1), (-13, -1)], [(-3, 2), (-6, 3), (-9, 3)]),
    ([(-3, 0), (-6, 1), (-9, 1), (-13, 0)], [(-3, 2), (-6, 2), (-9, 1)]),
    ([(-3, -1), (-6, -1), (-9, 0), (-13, 1)], [(-3, 2), (-6, 3), (-9, 2)]),
    ([(-3, 0), (-6, 0), (-9, 1), (-13, 0)], [(-3, 2), (-6, 2), (-9, 3)]),
    ([(-3, 0), (-6, 1), (-9, 0), (-13, -1)], [(-3, 2), (-6, 3), (-9, 3)]),
]
RUN = [
    # 1. contact — jambe proche devant, bras proche derrière
    F(pose(torso="lean", tx=12, ty=18,
           near_leg=[(18, 26), (20, 28)], far_leg=[(11, 25), (9, 26)], far_foot="down",
           near_arm=[(14, 21), (12, 22)], far_arm=[(17, 21), (19, 20)],
           tail_long=RUN_TAILS[0][0], tail_short=RUN_TAILS[0][1])),
    # 2. appui — le poids descend, genou plié
    F(pose(torso="lean", tx=12, ty=19,
           near_leg=[(18, 26), (17, 28)], far_leg=[(12, 26), (10, 26)], far_foot="down",
           near_arm=[(15, 22), (13, 24)], far_arm=[(17, 22), (19, 22)],
           tail_long=RUN_TAILS[1][0], tail_short=RUN_TAILS[1][1])),
    # 3. passage — jambe lointaine ramenée devant, corps au plus haut
    F(pose(torso="lean", tx=12, ty=17,
           near_leg=[(16, 25), (15, 28)], far_leg=[(17, 24), (17, 26)], far_foot="tuck",
           near_arm=[(16, 21), (15, 23)], far_arm=[(14, 21), (14, 23)],
           tail_long=RUN_TAILS[2][0], tail_short=RUN_TAILS[2][1])),
    # 4. contact — jambe lointaine devant, bras proche devant
    F(pose(torso="lean", tx=12, ty=18,
           far_leg=[(17, 26), (19, 28)], near_leg=[(13, 25), (11, 26)], near_foot="down",
           near_arm=[(18, 21), (20, 20)], far_arm=[(13, 21), (11, 22)],
           tail_long=RUN_TAILS[3][0], tail_short=RUN_TAILS[3][1])),
    # 5. appui
    F(pose(torso="lean", tx=12, ty=19,
           far_leg=[(17, 26), (16, 28)], near_leg=[(14, 26), (12, 26)], near_foot="down",
           near_arm=[(18, 22), (20, 22)], far_arm=[(13, 22), (12, 24)],
           tail_long=RUN_TAILS[4][0], tail_short=RUN_TAILS[4][1])),
    # 6. passage — jambe proche ramenée devant
    F(pose(torso="lean", tx=12, ty=17,
           far_leg=[(14, 25), (13, 28)], near_leg=[(18, 24), (18, 26)], near_foot="tuck",
           near_arm=[(16, 21), (16, 23)], far_arm=[(14, 21), (13, 23)],
           tail_long=RUN_TAILS[5][0], tail_short=RUN_TAILS[5][1])),
]

# ---------------------------------------------------------------------------
# JUMP — anticipation, impulsion, montée, sommet
# ---------------------------------------------------------------------------
JUMP = [
    # 1. compression : genoux pliés, bras ramenés en arrière
    F(pose(torso="crouch", tx=12, ty=21,
           near_leg=[(18, 26), (17, 28)], far_leg=[(14, 27), (12, 28)],
           near_arm=[(14, 23), (12, 24)], far_arm=[(12, 23), (10, 23)],
           tail_long=[(-2, 1), (-4, 3), (-6, 5), (-7, 9)],
           tail_short=[(-2, 2), (-3, 4), (-4, 7)])),
    # 2. impulsion : jambes tendues, pointes de pied, bras lancés vers le haut
    F(pose(torso="up", tx=12, ty=17, head="head_r_up",
           near_leg=[(16, 25), (16, 27)], near_foot="point",
           far_leg=[(13, 25), (12, 27)], far_foot="down",
           near_arm=[(17, 17), (19, 15)], far_arm=[(15, 16), (16, 14)],
           tail_long=[(-2, 2), (-3, 5), (-4, 8), (-5, 12)],
           tail_short=[(-2, 2), (-3, 5), (-3, 8)])),
    # 3. montée : genoux qui remontent, le foulard traîne vers le bas
    F(pose(torso="up", tx=12, ty=16, head="head_r_up",
           near_leg=[(18, 23), (17, 25)], near_foot="tuck",
           far_leg=[(14, 24), (13, 26)], far_foot="down",
           near_arm=[(17, 18), (19, 17)], far_arm=[(14, 18), (15, 16)],
           tail_long=[(-3, 1), (-5, 4), (-6, 7), (-8, 10)],
           tail_short=[(-2, 2), (-4, 4), (-5, 7)])),
    # 4. sommet : position groupée, bras ouverts, foulard qui flotte
    F(pose(torso="crouch", tx=12, ty=18,
           near_leg=[(18, 23), (17, 25)], near_foot="tuck",
           far_leg=[(15, 24), (13, 25)], far_foot="down",
           near_arm=[(17, 20), (19, 20)], far_arm=[(12, 19), (10, 18)],
           tail_long=[(-3, -1), (-5, -3), (-8, -4), (-10, -7)],
           tail_short=[(-3, 0), (-5, -1), (-7, -1)])),
]

# ---------------------------------------------------------------------------
# FALL — bras levés, jambes tendues vers le sol, foulard tiré vers le haut
# ---------------------------------------------------------------------------
FALL = [
    F(pose(torso="up", tx=12, ty=17,
           near_leg=[(17, 25), (17, 27)], near_foot="point",
           far_leg=[(13, 25), (12, 26)], far_foot="down",
           near_arm=[(17, 17), (19, 15)], far_arm=[(12, 17), (10, 15)],
           tail_long=[(-2, -1), (-4, -4), (-5, -7), (-6, -11)],
           tail_short=[(-3, 0), (-6, -1), (-8, -2)])),
    F(pose(torso="up", tx=12, ty=17,
           near_leg=[(17, 25), (18, 27)], near_foot="point",
           far_leg=[(13, 25), (12, 27)], far_foot="down",
           near_arm=[(18, 17), (20, 16)], far_arm=[(12, 17), (10, 16)],
           tail_long=[(-2, -1), (-5, -3), (-6, -6), (-8, -10)],
           tail_short=[(-3, 0), (-6, 0), (-8, -1)])),
    F(pose(torso="up", tx=12, ty=17,
           near_leg=[(17, 25), (17, 27)], near_foot="point",
           far_leg=[(13, 25), (13, 27)], far_foot="down",
           near_arm=[(17, 16), (18, 14)], far_arm=[(12, 16), (11, 14)],
           tail_long=[(-2, -1), (-3, -4), (-5, -7), (-5, -11)],
           tail_short=[(-3, 0), (-6, -1), (-8, -1)])),
]

# ---------------------------------------------------------------------------
# LAND — contact, compression, retour
# ---------------------------------------------------------------------------
LAND = [
    F(pose(torso="crouch", tx=12, ty=21,
           near_leg=[(18, 26), (18, 28)], far_leg=[(13, 27), (11, 28)],
           near_arm=[(17, 23), (19, 24)], far_arm=[(12, 22), (10, 21)],
           tail_long=[(-2, -1), (-5, -2), (-7, -4), (-10, -6)],
           tail_short=[(-2, 0), (-5, -1), (-7, -2)])),
    F(pose(torso="crouch", tx=12, ty=22,
           near_leg=[(18, 27), (18, 28)], far_leg=[(13, 27), (11, 28)],
           near_arm=[(17, 24), (19, 25)], far_arm=[(12, 24), (10, 24)],
           tail_long=[(-3, 0), (-6, 0), (-8, 1), (-11, 2)],
           tail_short=[(-3, 1), (-5, 2), (-7, 3)])),
    F(pose(torso="up", tx=12, ty=20, **STANCE_LOW,
           tail_long=[(-2, 1), (-5, 3), (-7, 5), (-9, 8)],
           tail_short=[(-2, 2), (-4, 4), (-5, 7)])),
]

# ---------------------------------------------------------------------------
# DASH — élan, propulsion, vitesse max (x2), freinage
# ---------------------------------------------------------------------------
STREAKS_A = A("""
zzzz...zz
.........
...zzzzz.
.........
.........
zzz..zzz.
""", x=0, top=19)
STREAKS_B = A("""
..zzzzz..
.........
zzz...zzz
.........
.........
..zzzz...
""", x=0, top=18)

DASH = [
    # 1. élan : on se ramasse vers l'arrière
    F(pose(torso="crouch", tx=11, ty=21, head="head_r_squint",
           near_leg=[(16, 26), (17, 28)], far_leg=[(12, 27), (10, 28)],
           near_arm=[(13, 23), (11, 23)], far_arm=[(11, 22), (9, 22)],
           tail_long=[(-2, 0), (-4, 2), (-7, 3), (-9, 6)],
           tail_short=[(-2, 1), (-4, 3), (-5, 6)])),
    # 2. propulsion : buste plongé, jambes poussent derrière
    F(pose(torso="dive", tx=13, ty=19, head="head_r_squint",
           near_leg=[(14, 26), (11, 27)], near_foot="back",
           far_leg=[(12, 25), (9, 25)], far_foot="back",
           near_arm=[(18, 22), (20, 22)], far_arm=[(16, 21), (18, 21)],
           tail_long=[(-4, 0), (-8, 0), (-12, 1)],
           tail_short=[(-4, 1), (-7, 2), (-9, 2)]), STREAKS_A),
    # 3. vitesse max : silhouette compacte, membres repliés
    F(pose(torso="flat", tx=11, ty=21, head="head_r_squint",
           near_leg=[(13, 27), (10, 27)], near_foot="tuck",
           far_leg=[(11, 26), (8, 26)], far_foot="tuck",
           near_arm=[(19, 23), (20, 24)], far_arm=[(17, 22), (19, 22)],
           tail_long=[(-4, 0), (-8, 0), (-12, 0)],
           tail_short=[(-4, 1), (-8, 1), (-10, 1)]), STREAKS_B),
    # 4. vitesse max (bis) : le foulard claque
    F(pose(torso="flat", tx=11, ty=21, head="head_r_squint",
           near_leg=[(13, 27), (10, 27)], near_foot="tuck",
           far_leg=[(11, 26), (8, 26)], far_foot="tuck",
           near_arm=[(19, 23), (20, 24)], far_arm=[(17, 22), (19, 22)],
           tail_long=[(-4, -1), (-8, 0), (-12, -1)],
           tail_short=[(-4, 2), (-8, 2), (-10, 3)]), STREAKS_A),
    # 5. freinage : on se redresse, le pied avant accroche le sol
    F(pose(torso="lean", tx=12, ty=19,
           near_leg=[(18, 26), (20, 28)], far_leg=[(13, 26), (11, 27)], far_foot="down",
           near_arm=[(18, 21), (20, 21)], far_arm=[(13, 21), (11, 21)],
           tail_long=[(-3, -1), (-6, -1), (-9, 0), (-12, 2)],
           tail_short=[(-3, 1), (-6, 1), (-8, 2)])),
]

# ---------------------------------------------------------------------------
# SLIDE — plongée au ras du sol, glissade (x2)
# ---------------------------------------------------------------------------
SLIDE = [
    F(pose(torso="dive", tx=12, ty=22,
           near_leg=[(17, 27), (19, 28)], near_foot="flat",
           far_leg=[(12, 28), (10, 28)], far_foot="back",
           near_arm=[(19, 25), (21, 26)], far_arm=[(16, 24), (18, 24)],
           tail_long=[(-3, -1), (-6, -2), (-9, -2), (-12, -1)],
           tail_short=[(-3, 1), (-6, 1), (-8, 1)])),
    F(pose(torso="flat", tx=11, ty=24,
           near_leg=[(16, 28), (19, 28)], near_foot="point",
           far_leg=[(9, 28), (7, 28)], far_foot="back",
           near_arm=[(19, 26), (21, 27)], far_arm=[(16, 25), (18, 25)],
           tail_long=[(-4, -1), (-8, -1), (-12, 0)],
           tail_short=[(-4, 1), (-7, 1), (-9, 2)]),
      A("x.x\n.x.", x=22, bottom=30)),
    F(pose(torso="flat", tx=11, ty=24,
           near_leg=[(16, 28), (19, 28)], near_foot="point",
           far_leg=[(9, 28), (7, 28)], far_foot="back",
           near_arm=[(19, 26), (21, 27)], far_arm=[(16, 25), (18, 25)],
           tail_long=[(-4, 0), (-8, -1), (-12, -1)],
           tail_short=[(-4, 1), (-7, 2), (-9, 1)]),
      A("..x\nx..", x=23, bottom=30)),
]

ANIMS_POSED = {
    "idle": IDLE, "run": RUN, "jump": JUMP, "fall": FALL, "land": LAND,
    "dash": DASH, "slide": SLIDE,
}

# ---------------------------------------------------------------------------
# DEATH / RESPAWN — désassemblage en blocs de pixels, puis recomposition
# ---------------------------------------------------------------------------
import random  # noqa: E402

import numpy as np  # noqa: E402

from core import CELL, CH, CW, add_outline, render, stamp  # noqa: E402

# 1. impact : recul, bras projetés, yeux plissés (posé à la main)
HIT = F(pose(torso="up", tx=11, ty=17, head="head_r_squint",
             near_leg=[(15, 25), (16, 27)], near_foot="point",
             far_leg=[(12, 25), (11, 27)], far_foot="down",
             near_arm=[(17, 17), (19, 16)], far_arm=[(11, 17), (9, 16)],
             tail_long=[(-2, -1), (-5, -2), (-7, -5), (-9, -8)],
             tail_short=[(-2, 0), (-4, -2), (-6, -3)]))

BLOCK = 3
CENTER = (16, 21)


def _blocks(grid):
    """Découpe la silhouette en blocs 3x3 ; trajectoire chorégraphiée par bloc
    (direction depuis le centre du corps + petite variation fixe, puis gravité)."""
    rnd = random.Random(7)
    out = []
    for by in range(0, CH, BLOCK):
        for bx in range(0, CW, BLOCK):
            sub = grid[by:by + BLOCK, bx:bx + BLOCK]
            filled = sub[sub != "."]
            if filled.size == 0:
                continue
            cx, cy = bx + 1, by + 1
            dx, dy = cx - CENTER[0], cy - CENTER[1]
            n = max(1.0, (dx * dx + dy * dy) ** 0.5)
            sp = 1.6 + rnd.random() * 1.2
            vx, vy = dx / n * sp + rnd.uniform(-0.5, 0.5), dy / n * sp - 1.0 + rnd.uniform(-0.4, 0.4)
            # couleur dominante (hors contour) pour les petits fragments
            inner = [c for c in filled if c != "O"] or list(filled)
            dom = max(set(inner), key=inner.count)
            out.append(dict(x=bx, y=by, sub=sub.copy(), vx=vx, vy=vy, dom=dom, k=rnd.random()))
    return out


def _death_frame(blocks, t):
    g = np.full((CH, CW), ".", dtype="<U1")
    for b in blocks:
        d = (0, 0.9, 2.4, 4.2, 6.0)[t]
        x = round(b["x"] + b["vx"] * d)
        y = round(b["y"] + b["vy"] * d + 0.35 * t * t)
        if t == 1:      # blocs entiers, légèrement disjoints
            pieces = [(x + i, y + j, b["sub"][j, i]) for j in range(b["sub"].shape[0])
                      for i in range(b["sub"].shape[1]) if b["sub"][j, i] != "."]
        elif t == 2:    # blocs 2x2 en couleur dominante, bord clair
            c = "X" if b["k"] < 0.25 else ("x" if b["dom"] in "OhtdfM" else b["dom"])
            pieces = [(x, y, c), (x + 1, y, c), (x, y + 1, "x"), (x + 1, y + 1, "x")]
        elif t == 3:    # fragments d'1 px
            pieces = [(x, y, "X" if b["k"] < 0.45 else "x")]
        else:           # dernières étincelles
            pieces = [(x, y, "q")] if b["k"] < 0.3 else []
        for px, py, c in pieces:
            if 0 <= px < CW and 0 <= py < CH:
                g[py, px] = c
    return g


_hit = render(HIT)
_blk = _blocks(_hit)
_flash = np.where(_hit == ".", ".", np.where(_hit == "O", "O", "X"))
_flash[np.isin(_hit, ["E"])] = "q"

DEATH = [HIT,
         Frame([G(_flash)], outline=False),
         Frame([G(_death_frame(_blk, 1))], outline=False),
         Frame([G(_death_frame(_blk, 2))], outline=False),
         Frame([G(_death_frame(_blk, 3))], outline=False),
         Frame([G(_death_frame(_blk, 4))], outline=False)]

_idle0 = render(IDLE[0])
_iblk = _blocks(_idle0)


def _converge(blocks, t, keep_below=None):
    g = np.full((CH, CW), ".", dtype="<U1")
    if keep_below is not None:
        g[keep_below:] = _idle0[keep_below:]
    for b in blocks:
        if keep_below is not None and b["y"] >= keep_below:
            continue
        x = round(b["x"] + b["vx"] * t)
        y = round(b["y"] + b["vy"] * t)
        if keep_below is None:
            c = "X" if b["k"] < 0.4 else "x"
            pieces = [(x, y, c), (x + 1, y, c), (x, y + 1, "x"), (x + 1, y + 1, "x")]
        else:
            c = "x" if b["dom"] in "OhtdfM" else b["dom"]
            pieces = [(x + i, y + j, c) for i in range(2) for j in range(2)]
            pieces[0] = (x, y, "X")
        for px, py, c in pieces:
            if 0 <= px < CW and 0 <= py < CH and g[py, px] == ".":
                g[py, px] = c
    return g


_rim = np.where(_idle0 == "O", "X", _idle0)
RESPAWN = [
    Frame([G(_converge(_iblk, 2.2))], outline=False),
    Frame([G(_converge(_iblk, 0.8, keep_below=22))], outline=False),
    Frame([G(_rim)], outline=False),
]


# ---------------------------------------------------------------------------
# ATTACK — sabre : saisie, dégainé en légère fente, demi-cercle devant lui
# (haut -> avant -> bas), suivi, rengainé, retour en garde
# ---------------------------------------------------------------------------
import math  # noqa: E402

SLASH_C = (17, 20)   # centre du demi-cercle : l'épaule proche pendant la fente


def slash(a0, a1, layers):
    """Traînée de lame : arc de cercle (angles en degrés, 0 = devant, -90 = haut).
    layers = [(rayon, slot), ...] ; dessinée sous le personnage, sans contour."""
    g = np.full((CH, CW), ".", dtype="<U1")
    for r, c in layers:
        for k in range(0, 1 + int(abs(a1 - a0) * 2)):
            a = math.radians(a0 + (a1 - a0) * k / max(1, int(abs(a1 - a0) * 2)))
            x = round(SLASH_C[0] + r * math.cos(a))
            y = round(SLASH_C[1] + r * math.sin(a))
            if 0 <= x < CW and 0 <= y < 31:
                g[y, x] = c
    return G(g)


LUNGE = dict(torso="lean", tx=13, ty=19,
             near_leg=[(19, 26), (21, 28)], far_leg=[(12, 26), (10, 28)],
             far_arm=[(14, 22), (13, 24)],
             tail_long=[(-3, 0), (-6, 1), (-9, 2), (-11, 4)],
             tail_short=[(-3, 1), (-5, 3), (-7, 4)])

ATTACK = [
    # 1. saisie : main proche sur la poignée, à la hanche ; on se tasse
    F(pose(torso="up", tx=12, ty=20, near_leg=STANCE_LOW["near_leg"], far_leg=STANCE_LOW["far_leg"],
           near_arm=[(16, 23), (14, 24)], far_arm=[(13, 22), (12, 24)],
           tail_long=[(-2, 1), (-4, 3), (-6, 5), (-8, 9)],
           tail_short=[(-2, 2), (-4, 4), (-4, 8)])),
    # 2. dégainé : fente avant, bras qui se déplie, lame dressée devant le visage
    F(pose(**LUNGE, head="head_r_squint", near_arm=[(19, 19), (21, 16)], blade=(26, 3))),
    # 3. demi-cercle : bras à demi tendu devant, lame à l'horizontale
    Frame([slash(-76, -6, [(20, "q"), (19, "X")]),
           G(pose(**LUNGE, head="head_r_squint", near_arm=[(20, 20), (23, 19)], blade=(36, 17)))]),
    # 4. demi-cercle : le bras accompagne la lame qui descend devant les pieds
    Frame([slash(-76, -12, [(19, "X")]), slash(-12, 52, [(20, "q"), (19, "X")]),
           G(pose(**LUNGE, head="head_r_squint", near_arm=[(20, 22), (23, 23)], blade=(35, 30)))]),
    # 5. suivi : bras encore tendu vers le bas, la traînée s'éteint
    Frame([slash(14, 50, [(19, "z")]),
           G(pose(**{**LUNGE, "ty": 20, "near_leg": [(20, 27), (21, 28)], "far_leg": [(12, 27), (10, 28)]},
                  near_arm=[(19, 23), (22, 25)], blade=(32, 30)))]),
    # 6. rengainé : la lame revient à la hanche et glisse vers l'arrière
    F(pose(torso="up", tx=12, ty=20, near_leg=STANCE_LOW["near_leg"], far_leg=STANCE_LOW["far_leg"],
           near_arm=[(16, 22), (15, 23)], far_arm=[(13, 22), (12, 24)], blade=(9, 25),
           tail_long=[(-3, 0), (-5, 2), (-7, 4), (-9, 7)],
           tail_short=[(-2, 1), (-4, 3), (-5, 6)])),
    # 7. retour en garde, main encore sur la poignée
    F(pose(torso="up", tx=12, ty=19, near_leg=STANCE["near_leg"], far_leg=STANCE["far_leg"],
           near_arm=[(16, 22), (15, 23)], far_arm=STANCE["far_arm"],
           tail_long=[(-2, 1), (-4, 3), (-5, 6), (-6, 10)],
           tail_short=[(-2, 2), (-3, 4), (-3, 8)])),
]

# ---------------------------------------------------------------------------
# THROW — lancer de shuriken : armé derrière la tête, bascule, bras tendu au
# lâcher, accompagnement, retour en garde
# ---------------------------------------------------------------------------
STAR_HAND = ".W.\nWgW\n.W."      # shuriken tenu entre les doigts


def holding(x, y):
    return A(STAR_HAND, x=x, top=y)


THROW_RELEASE = {"frame": 2, "x": 28, "y": 20}   # point de lâcher dans la cellule

THROW = [
    # 1. armé : main proche ramenée haut derrière la tête, bras lointain pointé (visée)
    Frame([G(pose(torso="up", tx=12, ty=19, near_leg=STANCE["near_leg"], far_leg=STANCE["far_leg"],
                  near_arm=[(13, 18), (10, 16)], far_arm=[(17, 21), (21, 20)],
                  tail_long=[(-2, 1), (-4, 3), (-5, 6), (-6, 10)],
                  tail_short=[(-2, 2), (-3, 4), (-3, 8)])),
           holding(9, 14)]),
    # 2. tension maximale : le buste recule, le bras armé va encore plus loin
    Frame([G(pose(torso="up", tx=11, ty=20, near_leg=[(17, 27), (18, 28)], far_leg=[(10, 27), (8, 28)],
                  near_arm=[(12, 19), (9, 18)], far_arm=[(16, 22), (21, 21)],
                  tail_long=[(-2, 1), (-4, 3), (-6, 5), (-7, 9)],
                  tail_short=[(-2, 2), (-4, 4), (-4, 8)])),
           holding(7, 16)]),
    # 3. lâcher : bascule en fente, bras proche entièrement tendu vers l'avant
    Frame([A("zz.zzz", x=33, top=20),
           G(pose(**{**LUNGE, "far_arm": [(13, 22), (11, 23)]}, head="head_r_squint",
                  near_arm=[(21, 20), (25, 20)]))]),
    # 4. accompagnement : le bras reste tendu et descend un peu, le buste suit
    F(pose(**{**LUNGE, "far_arm": [(13, 22), (11, 24)]}, near_arm=[(21, 21), (24, 23)])),
    # 5. retour en garde
    F(pose(torso="up", tx=12, ty=20, near_leg=STANCE_LOW["near_leg"], far_leg=STANCE_LOW["far_leg"],
           near_arm=[(17, 23), (18, 24)], far_arm=STANCE_LOW["far_arm"],
           tail_long=[(-2, 1), (-4, 3), (-6, 5), (-8, 9)],
           tail_short=[(-2, 2), (-4, 4), (-4, 8)])),
]

# Projectile : cellules 10x10. Rotation (2 images), puis planté dans un mur
# (mur à droite) et planté dans le sol en biais (lancé vers la droite : une lame
# entière ressort vers l'arrière, une demi-lame vers l'avant), en plus petit. L'ancre est le point
# posé sur la surface touchée.
SHURIKEN = {
    "spin0": ("""
...W...
...W...
..WWW..
WWWgWWW
..WWW..
...W...
...W...
""", (4, 4)),
    "spin1": ("""
W.....W
.W...W.
..WwW..
..wgw..
..WwW..
.W...W.
W.....W
""", (4, 4)),
    "stuck_wall": ("""
..W
WWg
..W
""", (3, 2)),
    "stuck_ground": ("""
W......
.WW...W
.WWw.Ww
..WwgW.
""", (5, 4)),
}

# ---------------------------------------------------------------------------
# SPRINT — course « ninja » : buste plongé, corps plus bas, bras tendus vers
# l'arrière, grandes foulées, foulard tendu à l'horizontale
# ---------------------------------------------------------------------------
def _sprint(ty, near_leg, far_leg, near_foot="flat", far_foot="flat", tails=0, streak=False):
    long_t = [[(-4, 0), (-8, 0), (-12, 1)], [(-4, 0), (-8, -1), (-12, 0)]][tails]
    short_t = [[(-4, 1), (-7, 2), (-9, 2)], [(-4, 2), (-7, 2), (-9, 3)]][tails]
    g = pose(torso="dive", tx=14, ty=ty,
             near_leg=near_leg, far_leg=far_leg, near_foot=near_foot, far_foot=far_foot,
             # bras tendus vers l'arrière, à l'horizontale (le proche passe devant le buste)
             near_arm=[(14, ty + 1), (9, ty + 1)], far_arm=[(12, ty), (7, ty)],
             tail_long=long_t, tail_short=short_t)
    ops = [G(g)]
    if streak:
        ops.append(A("zzz..zz", x=0, top=27))
    return Frame(ops)


SPRINT = [
    # contact : jambe proche lancée loin devant
    _sprint(20, near_leg=[(20, 26), (23, 28)], far_leg=[(12, 26), (9, 27)], far_foot="down", streak=True),
    # appui : le corps descend sur la jambe avant
    _sprint(21, near_leg=[(20, 27), (19, 28)], far_leg=[(13, 27), (10, 27)], far_foot="down", tails=1),
    # passage : jambe lointaine ramenée sous le corps
    _sprint(19, near_leg=[(17, 26), (16, 28)], far_leg=[(19, 25), (19, 26)], far_foot="tuck"),
    # contact : jambe lointaine lancée devant
    _sprint(20, far_leg=[(19, 26), (22, 28)], near_leg=[(13, 26), (10, 27)], near_foot="down", streak=True, tails=1),
    # appui
    _sprint(21, far_leg=[(19, 27), (18, 28)], near_leg=[(14, 27), (11, 27)], near_foot="down"),
    # passage : jambe proche ramenée
    _sprint(19, far_leg=[(15, 26), (14, 28)], near_leg=[(20, 25), (20, 26)], near_foot="tuck", tails=1),
]

# ---------------------------------------------------------------------------
# VUES — face, dos, profil gauche, profil droit
# ---------------------------------------------------------------------------
stamp("head_f", """
............
...hhHHHHI..
..hHHHHHHHI.
.hHHHHHHHHHI
.fGGGGGGGGGG
.hHnnnnnnnHI
.hHNENNNENHI
.hHNENNNENHI
.hhHHHHHHHI.
..hhHHHHHI..
""")
stamp("head_b", """
............
..hhHHHHhh..
.hHHHHHHHHh.
hHHKHHHHKHHh
fGGKKKKKKGGf
hHHKKkkKKHHh
hHHKHHHHKHHh
hHHHHHHHHHHh
.hhHHHHHHHh.
..hhHHHHhh..
""")
# Profil gauche : nœud du bandeau vu du côté éloigné (plus sombre)
stamp("head_r_fartip", """
............
...hhHHHHI..
..hHHHHHHHI.
.hhHHHHHHHHI
kkGGGGGGGGII
kkhHHnnnnnn.
.khHHNENNEN.
.hhHHNENNEN.
..hhHHHHHH..
...hhhHH....
""")

VIEW_FRONT = Frame([
    A("""
G.
GF
.G
.G
..G
""", x=21, top=12),
    S("head_f", 10, 8),
    A("""
...fFGGGGF..
..tFFFFFFFU.
.ttTTTTTTUU.
tTtTTTTTTUTU
tTtTTTTTTUTU
aAtTTTTTTUaA
aAlLLLLLLlaA
NntTTTTTTUNN
nn.tTT.TU.Nn
...tTT.TU...
...tTT.TU...
...tTT.TU...
..ddDD.DDD..
..ddDD.DDD..
""", x=10, top=17),
])

VIEW_BACK = Frame([
    S("head_b", 10, 8),
    A("""
...fFFFFFf..
..tFFFFFFFt.
.ttTTTTTTtt.
tTtTTTTTTtTt
tTtTTTTTTtTt
aAtTTTTTTtAa
aAlLLLLLLlAa
nntTTTTTTtnn
nn.tTT.TT.nn
...tTT.TT...
...tTT.TT...
...tTT.TT...
..ddDD.DDdd.
..ddDD.DDdd.
""", x=10, top=17),
    A("""
.G..f
.G..f
G....f
G....f
G....f
G.....
.G....
.G....
.G....
""", x=13, top=14),
])

VIEW_RIGHT = IDLE[0]
# Profil gauche : vrai dessin (pan long côté éloigné, sombre ; pan court côté
# proche, clair ; pointe de capuche éloignée), puis orienté vers la gauche.
_left = render(F(pose(torso="up", tx=12, ty=19, head="head_r_fartip", **STANCE,
                      tail_long=[(-3, 2), (-4, 4), (-5, 7), (-6, 11)],
                      tail_short=[(-2, 1), (-4, 3), (-5, 6)],
                      long_colors="ffF", short_colors="GGFG")))
VIEW_LEFT = Frame([G(np.fliplr(_left))], outline=False)

VIEWS = {"front": VIEW_FRONT, "back": VIEW_BACK, "left": VIEW_LEFT, "right": VIEW_RIGHT}

# ---------------------------------------------------------------------------
# Métadonnées de lecture
# ---------------------------------------------------------------------------
ANIMS = {
    "idle":          dict(frames=IDLE,    fps=6,  loop=True,  state="idle"),
    "run":           dict(frames=RUN,     fps=12, loop=True,  state="run"),
    "sprint":        dict(frames=SPRINT,  fps=16, loop=True,  state="sprint"),
    "jump":          dict(frames=JUMP,    fps=14, loop=False, state="jump"),
    "fall":          dict(frames=FALL,    fps=10, loop=True,  state="fall"),
    "land":          dict(frames=LAND,    fps=18, loop=False, state="land"),
    "dash":          dict(frames=DASH,    fps=20, loop=False, state="dash"),
    "attack":        dict(frames=ATTACK,  fps=16, loop=False, state="attack",
                          durations=[60, 50, 40, 45, 70, 70, 70]),
    "throw":         dict(frames=THROW,   fps=14, loop=False, state="throw",
                          durations=[80, 60, 45, 90, 90], release=THROW_RELEASE),
    "slide":         dict(frames=SLIDE,   fps=12, loop=True,  loop_start=1, state="slide"),
    "death":         dict(frames=DEATH,   fps=14, loop=False, state="death"),
    "respawn":       dict(frames=RESPAWN, fps=10, loop=False, state="respawn"),
}
