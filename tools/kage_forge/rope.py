"""KAGE — tirer la corde (zone 9 de la Forêt : la corde du bloc de pierre, passée sur une poulie).

KAGE tourne le dos à la poulie et halte la corde passée par-dessus son épaule : buste penché en avant,
les deux mains serrées devant l'épaule, jambes arc-boutées ; il avance pas à pas, la jambe arrière
poussant sur la pointe du pied. La tête plisse les yeux sous l'effort ; le bandeau pend, sans vent.
La corde n'est pas dans le dessin : le jeu la trace des mains (GRIP) au haut de l'épaule (SHOULDER),
puis jusqu'à la poulie (ainsi elle garde la couleur de la corde, quel que soit le skin).

Cellule 48×32 (orientation droite, la poulie est derrière, à gauche), comme art.py.
"""
from core import Frame, G
from rig import pose

HANG_L = [(-1, 2), (-2, 4), (-2, 7), (-3, 10)]      # le bandeau pend dans le dos
HANG_S = [(-1, 2), (-1, 4), (-2, 7)]
ARMS = dict(near_arm=[(18, 25), (21, 21)], far_arm=[(17, 24), (20, 21)], far_hand="hand")


def haul(ty, near_leg, far_leg, near_foot="flat", far_foot="flat", sway=0):
    # buste plongé en avant (il pèse de tout son poids), la tête portée en avant, au-dessus des mains
    nx, ny = 11 + 2, ty
    return Frame([G(pose(torso="dive", tx=11, ty=ty, head="head_r_squint", hx=nx, hy=ny - 9, **ARMS,
                         near_leg=near_leg, far_leg=far_leg, near_foot=near_foot, far_foot=far_foot,
                         tail_long=[(dx, dy + sway) for dx, dy in HANG_L], tail_short=HANG_S))])


ROPE_PULL = [
    # 1. appui : la jambe avant fléchie en avant, l'arrière tendue, sur la pointe (elle pousse)
    haul(19, near_leg=[(19, 24), (20, 28)], far_leg=[(10, 25), (7, 27)], far_foot="back"),
    # 2. passage : tassé sur la jambe d'appui, l'autre jambe ramenée
    haul(20, near_leg=[(17, 25), (16, 28)], far_leg=[(15, 24), (14, 27)], far_foot="down", sway=1),
    # 3. appui de l'autre jambe
    haul(19, near_leg=[(10, 25), (7, 27)], far_leg=[(19, 24), (20, 28)], near_foot="back"),
    # 4. passage
    haul(20, near_leg=[(15, 24), (14, 27)], far_leg=[(17, 25), (16, 28)], near_foot="down", sway=1),
]
ROPE_PULL_DURATIONS = [260, 200, 260, 200]          # lent : il peine
# la corde : des mains (GRIP) au haut de l'épaule (SHOULDER), dans la cellule 48×32, image par image
ROPE_GRIP = [(21, 22), (21, 23), (21, 22), (21, 23)]
ROPE_SHOULDER = [(12, 20), (12, 21), (12, 20), (12, 21)]
