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


def at(dx, **kw):
    """La pose décalée de dx colonnes (tout le corps : buste, genoux, chevilles, coudes, mains)."""
    kw = dict(kw)
    kw["tx"] += dx
    if kw.get("hx") is not None:
        kw["hx"] += dx
    for k in ("near_leg", "far_leg", "near_arm", "far_arm", "back_arm"):
        if kw.get(k):
            kw[k] = [(x + dx, y) for x, y in kw[k]]
    return Frame([G(pose(**kw))])


INTRO_KICK = [
    # 1. l'élan : les deux genoux ramenés devant, le corps en boule qui monte
    at(6, torso="up", tx=12, ty=13,
       near_leg=[(20, 18), (17, 22)], near_foot="down",
       far_leg=[(16, 19), (13, 22)], far_foot="down",
       near_arm=[(18, 16), (20, 14)], far_arm=[(11, 16), (10, 18)], far_hand="hand",
       tail_long=[(-3, 0), (-6, 1), (-9, 3), (-11, 5)], tail_short=[(-3, 2), (-5, 4), (-7, 6)]),
    # 2. l'armé : le buste part en arrière, le genou d'attaque monte haut devant, talon vers la cible
    at(8, torso="back", tx=10, ty=13, head="head_r_squint", hx=8, hy=3,
       near_leg=[(19, 15), (16, 19)], near_foot="flex",
       far_leg=[(16, 22), (10, 23)], far_foot="back",
       near_arm=[(17, 16), (21, 13)], far_arm=[(6, 15), (6, 18)], far_hand="hand",
       tail_long=TAIL_L, tail_short=TAIL_S),
    # 3. le coup : buste en arrière, jambe tendue un peu montante, talon en avant ; l'autre repliée
    #    dessous en « L » (genou devant, talon vers les fesses) ; garde devant, poing arrière à la hanche
    at(8, torso="back", tx=9, ty=13, head="head_r_squint", hx=6, hy=3,
       near_leg=[(21, 17), (28, 15)], near_foot="flex",
       far_leg=[(17, 23), (10, 24)], far_foot="back",
       near_arm=[(17, 14), (20, 10)], far_arm=[(5, 15), (6, 18)], far_hand="hand",
       tail_long=TAIL_L, tail_short=TAIL_S),
]
HOLD = 2   # l'image où KAGE se fige au centre de la lune
