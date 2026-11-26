"""KAGE — les gestes du duel (mode Arène, novembre 2026).

  - PARRY : la parade. Il lève la garde (le sabre à deux mains, dressé en travers devant lui,
    pointe vers le haut et l'avant), la tient, ramassé sur ses appuis, puis la relâche.
  - PARRY_HIT : la parade réussie. La lame encaisse le coup (elle recule d'un cran, gerbe
    d'étincelles au point de contact), puis revient aussitôt vers l'avant : la riposte est prête.
  - STAGGER : déséquilibré (il a frappé dans une parade, ou les deux lames se sont choquées) :
    buste rejeté en arrière, le bras du sabre emporté vers le haut et l'arrière, sur les talons.
  - VICTORY : la fin du duel, vainqueur. Il fait tourner la lame et la rengaine lentement, droit.
  - DEFEAT : la fin du duel, vaincu : un genou à terre, la tête basse, le sabre planté devant lui.

Cellule 48×32 (orientation droite), ancrage (16, 31), comme art.py.
"""
from core import A, Frame, G
from rig import pose


def F(grid, *retouches):
    return Frame([G(grid), *retouches])


def two_hands(hand, tip):
    """Seconde main sur la poignée, 2 px derrière la première (côté pommeau) — comme art.py."""
    hx, hy = hand
    dx, dy = tip[0] - (hx + 1), tip[1] - (hy + 1)
    n = max(abs(dx), abs(dy)) or 1
    return (round(hx - 2 * dx / n), round(hy - 2 * dy / n))


# appuis de la garde : jambes écartées, fléchies, le poids sur l'avant
GUARD_LEGS = dict(near_leg=[(20, 27), (21, 28)], far_leg=[(11, 27), (9, 28)])
TAILS_STILL = dict(tail_long=[(-2, 1), (-4, 3), (-6, 5), (-8, 9)], tail_short=[(-2, 2), (-4, 4), (-4, 8)])
TAILS_WIND = dict(tail_long=[(-2, 0), (-4, 2), (-7, 3), (-9, 6)], tail_short=[(-2, 1), (-4, 3), (-5, 6)])


def guard(hand, tip, ty=20, tx=12, head="head_r_squint", tails=TAILS_STILL, elbow=None, legs=GUARD_LEGS):
    """Le sabre tenu à deux mains : main avant `hand`, pointe `tip`."""
    ex, ey = elbow or (hand[0] - 3, hand[1] + 3)
    return pose(torso="up", tx=tx, ty=ty, head=head, **legs,
                near_arm=[(ex, ey), hand], far_arm=[(ex - 2, ey + 1), two_hands(hand, tip)], blade=tip, **tails)


SPARK_BIG = "q...q\n.qWq.\n.WWW.\n.qWq.\nq...q"
SPARK_MID = ".q.\nqWq\n.q."

PARRY = [
    # 1. il lève la garde : la lame monte en travers devant le buste
    F(guard((19, 20), (23, 6), ty=20, head="head_r")),
    # 2. la garde : lame dressée, pointe en avant, ramassé sur ses appuis (fenêtre de la parade)
    F(guard((20, 19), (26, 3), ty=21)),
    # 3. tenue : le foulard flotte, la lame frémit d'un pixel
    F(guard((20, 19), (27, 3), ty=21, tails=TAILS_WIND)),
    # 4. relâche : la lame redescend à la hanche
    F(pose(torso="up", tx=12, ty=20, near_leg=[(19, 27), (18, 28)], far_leg=[(11, 27), (9, 28)],
           near_arm=[(16, 22), (15, 23)], far_arm=[(13, 22), (12, 24)], blade=(9, 25), **TAILS_STILL)),
]
PARRY_DURATIONS = [40, 150, 120, 90]

PARRY_HIT = [
    # 1. le choc : la lame encaisse et recule d'un cran, gerbe d'étincelles au contact ; il plie
    Frame([G(guard((19, 20), (22, 4), ty=21, tx=11, tails=TAILS_WIND,
                   legs=dict(near_leg=[(19, 27), (20, 28)], far_leg=[(10, 27), (7, 28)]))),
           A(SPARK_BIG, x=21, top=7)]),
    # 2. la riposte est prête : la lame revient en avant, l'éclat s'éteint
    Frame([G(guard((20, 19), (28, 5), ty=20, tails=TAILS_STILL)), A(SPARK_MID, x=25, top=8)]),
]
PARRY_HIT_DURATIONS = [110, 160]

STAGGER = [
    # 1. rejeté en arrière : buste basculé, le sabre emporté vers le haut et l'arrière, sur les talons
    F(pose(torso="back", tx=10, ty=19, head="head_r_squint",
           near_leg=[(19, 26), (22, 28)], near_foot="point", far_leg=[(12, 26), (11, 28)], far_foot="flat",
           near_arm=[(13, 18), (10, 14)], far_arm=[(15, 21), (19, 19)], blade=(3, 5),
           tail_long=[(-1, -2), (-2, -5), (-1, -8)], tail_short=[(-2, -1), (-3, -3), (-3, -6)]),
      A("X.\n.X", x=4, top=4)),
    # 2. il vacille : les bras battent, il cherche son équilibre
    F(pose(torso="back", tx=10, ty=20, head="head_r_squint",
           near_leg=[(19, 27), (21, 28)], near_foot="flat", far_leg=[(12, 27), (10, 28)], far_foot="flat",
           near_arm=[(13, 19), (11, 15)], far_arm=[(15, 22), (20, 21)], blade=(5, 4),
           tail_long=[(-2, -1), (-3, -4), (-3, -7)], tail_short=[(-2, 0), (-4, -2), (-4, -5)])),
    # 3. il se rattrape : le buste revient, le sabre redescend
    F(pose(torso="up", tx=11, ty=20, head="head_r_squint", near_leg=[(19, 27), (20, 28)], far_leg=[(11, 27), (9, 28)],
           near_arm=[(15, 21), (14, 17)], far_arm=[(14, 22), (18, 22)], blade=(9, 6), **TAILS_STILL)),
]
STAGGER_DURATIONS = [120, 160, 140]

VICTORY = [
    # 1. il fait tourner la lame devant lui, pointe vers le bas
    F(pose(torso="up", tx=12, ty=19, near_leg=[(18, 26), (18, 28)], far_leg=[(12, 26), (11, 28)],
           near_arm=[(17, 21), (20, 22)], far_arm=[(13, 22), (12, 24)], blade=(26, 30), **TAILS_WIND)),
    # 2. la lame remonte, à plat devant la poitrine (le geste qui chasse le sang de la lame)
    F(pose(torso="up", tx=12, ty=19, near_leg=[(18, 26), (18, 28)], far_leg=[(12, 26), (11, 28)],
           near_arm=[(17, 20), (21, 20)], far_arm=[(13, 22), (12, 24)], blade=(34, 20), **TAILS_WIND)),
    # 3. il la ramène vers le fourreau, à la hanche gauche
    F(pose(torso="up", tx=12, ty=19, near_leg=[(18, 26), (18, 28)], far_leg=[(12, 26), (11, 28)],
           near_arm=[(16, 21), (13, 23)], far_arm=[(13, 22), (11, 24)], blade=(26, 21), **TAILS_WIND)),
    # 4. rengainé : droit, immobile, le foulard au vent
    F(pose(torso="up", tx=12, ty=19, near_leg=[(18, 26), (18, 28)], far_leg=[(12, 26), (11, 28)],
           near_arm=[(15, 22), (13, 23)], far_arm=[(13, 22), (12, 24)],
           tail_long=[(-3, 0), (-6, 0), (-9, 1), (-12, 2)], tail_short=[(-3, 1), (-5, 1), (-7, 2)])),
]
VICTORY_DURATIONS = [140, 180, 200, 600]

DEFEAT = [
    # 1. il fléchit : le genou avant cède, le sabre descend
    F(pose(torso="up", tx=12, ty=21, head="head_r_squint", near_leg=[(19, 27), (19, 28)], far_leg=[(12, 27), (11, 28)],
           near_arm=[(17, 23), (20, 25)], far_arm=[(14, 23), (13, 25)], blade=(25, 31), **TAILS_STILL)),
    # 2. un genou à terre, la tête basse, les deux mains sur la garde du sabre planté devant lui
    F(pose(torso="lean", tx=12, ty=22, head="head_r_squint", hx=13, hy=13,
           near_leg=[(19, 26), (19, 28)], far_leg=[(14, 29), (10, 29)], far_foot="back",
           near_arm=[(18, 24), (21, 24)], far_arm=[(16, 25), two_hands((21, 24), (23, 31))], blade=(23, 31),
           tail_long=[(-1, 2), (-2, 4), (-2, 7), (-3, 9)], tail_short=[(-1, 2), (-2, 4), (-2, 7)])),
]
DEFEAT_DURATIONS = [160, 900]
