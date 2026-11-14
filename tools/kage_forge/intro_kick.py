"""KAGE — coup de pied sauté de l'introduction (tobi yoko geri), dessiné exprès pour elle.

Pose classique d'après les références de l'utilisateur (novembre 2026) : buste penché en arrière,
tête droite tournée vers la cible ; jambe d'attaque tendue presque à l'horizontale, un peu montante,
talon en avant ; l'autre jambe repliée sous le corps, genou devant, talon vers les fesses ; bras
avant plié en garde devant la poitrine, poing arrière tiré à la hanche (hikite) ; bandeau au vent.
Trois temps : l'élan (genoux ramenés), l'armé, le coup tendu — l'image où KAGE se fige.

Coordonnées de la cellule 48×32 (orientation droite), comme art.py ; agrandi de 20 % à l'export.
"""
from core import Frame, G
from rig import pose

TAIL_L = [(-3, -1), (-6, -1), (-9, 0), (-12, 0)]
TAIL_S = [(-3, 1), (-6, 2), (-8, 3)]


def at(dx, dy=0, **kw):
    """La pose décalée de (dx, dy) : tout le corps (buste, tête, genoux, chevilles, coudes, mains)."""
    kw = dict(kw)
    kw["tx"] += dx
    kw["ty"] += dy
    if kw.get("hx") is not None:
        kw["hx"] += dx
        kw["hy"] += dy
    for k in ("near_leg", "far_leg", "near_arm", "far_arm", "back_arm"):
        if kw.get(k):
            kw[k] = [(x + dx, y + dy) for x, y in kw[k]]
    return Frame([G(pose(**kw))])


# les trois temps, avant tout décalage (l'intro et le jeu les posent chacun à leur place)
ELAN = dict(torso="up", tx=12, ty=13,
            near_leg=[(20, 18), (17, 22)], near_foot="down",
            far_leg=[(16, 19), (13, 22)], far_foot="down",
            near_arm=[(18, 16), (20, 14)], far_arm=[(11, 16), (10, 18)], far_hand="hand",
            tail_long=[(-3, 0), (-6, 1), (-9, 3), (-11, 5)], tail_short=[(-3, 2), (-5, 4), (-7, 6)])
ARME = dict(torso="back", tx=10, ty=13, head="head_r_squint", hx=8, hy=3,
            near_leg=[(19, 15), (16, 19)], near_foot="flex",
            far_leg=[(16, 22), (10, 23)], far_foot="back",
            near_arm=[(17, 16), (21, 13)], far_arm=[(6, 15), (6, 18)], far_hand="hand",
            tail_long=TAIL_L, tail_short=TAIL_S)
COUP = dict(torso="back", tx=9, ty=13, head="head_r_squint", hx=6, hy=3,
            near_leg=[(21, 17), (28, 15)], near_foot="flex",
            far_leg=[(17, 23), (10, 24)], far_foot="back",
            near_arm=[(17, 14), (20, 10)], far_arm=[(5, 15), (6, 18)], far_hand="hand",
            tail_long=TAIL_L, tail_short=TAIL_S)

INTRO_KICK = [
    # 1. l'élan : les deux genoux ramenés devant, le corps en boule qui monte
    at(6, **ELAN),
    # 2. l'armé : le buste part en arrière, le genou d'attaque monte haut devant, talon vers la cible
    at(8, **ARME),
    # 3. le coup : buste en arrière, jambe tendue un peu montante, talon en avant ; l'autre repliée
    #    dessous en « L » (genou devant, talon vers les fesses) ; garde devant, poing arrière à la hanche
    at(8, **COUP),
]

# En jeu (coup de pied en l'air, état « air_kick ») : les mêmes poses, le buste calé sur celui du
# saut (tx = 12, à un ou deux pixels près), un peu plus bas (les pieds près du bas de la cellule, comme au sommet d'un saut) ;
# le bandeau, un peu plus court, tient dans la cellule.
TAIL_GAME = [(-3, -1), (-5, -1), (-7, 0)]
TAIL_GAME_S = [(-3, 1), (-5, 2), (-6, 3)]
AIR_KICK_ELAN = at(0, 4, **ELAN)
AIR_KICK_ARME = at(3, 4, **{**ARME, "tail_long": TAIL_GAME, "tail_short": TAIL_GAME_S})
AIR_KICK_COUP = at(4, 4, **{**COUP, "tail_long": TAIL_GAME, "tail_short": TAIL_GAME_S})
# élan, armé, coup (la frappe), puis la jambe se replie (l'armé) avant de retomber
AIR_KICK = [AIR_KICK_ELAN, AIR_KICK_ARME, AIR_KICK_COUP, AIR_KICK_ARME]
AIR_KICK_DURATIONS = [40, 60, 150, 90]
AIR_KICK_HIT = 2   # image où le coup porte
HOLD = 2   # l'image où KAGE se fige au centre de la lune
