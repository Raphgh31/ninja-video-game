"""KAGE sur une liane (chapitre 2) : accroché, balancé, grimpe.

Poses proposées en planche de design AVANT intégration (règle de l'utilisateur) :
elles ne sont pas encore dans ANIMS (art.py).

La liane passe juste devant lui, à x = 20-21 dans la cellule. Ses bras se
voient et restent COURTS (bras et avant-bras d'environ 3 pixels chacun, coude
très ouvert, environ 135°) : le bras proche part de l'épaule et tient la liane
devant la poitrine, sous le visage (la main ne se confond pas avec la peau du
visage) ; l'autre main la tient juste dessous. Les pieds reviennent sous les mains : il pend à la
liane, il n'est pas accroché à côté. Le jeu dessine la liane derrière lui et
choisit l'image du balancé selon l'angle du balancier : jamais de rotation.
"""
from art import F
from rig import pose

GRIP = (20, 14)         # point de la liane tenu par la main du haut (cellule 48x32)
HEAD = {}

# bras proche : épaule (15, 16) → coude (18, 16) → main (20, 14) ; main lointaine juste dessous
HANDS = dict(near_arm=[(18, 16), (20, 14)], far_arm=[(17, 18), (20, 17)], far_hand="hand")

# --- accroché : le corps pend, les jambes se balancent à peine ---------------
VINE_HANG = [
    F(pose(torso="up", tx=12, ty=15, **HEAD, **HANDS,
           near_leg=[(18, 25), (19, 28)], near_foot="point",
           far_leg=[(15, 25), (16, 28)], far_foot="down",
           tail_long=[(-2, 2), (-3, 5), (-3, 8), (-4, 11)],
           tail_short=[(-2, 2), (-2, 5), (-3, 7)])),
    F(pose(torso="up", tx=12, ty=15, **HEAD, **HANDS,
           near_leg=[(18, 25), (20, 28)], near_foot="point",
           far_leg=[(15, 25), (16, 28)], far_foot="down",
           tail_long=[(-2, 2), (-2, 5), (-3, 8), (-3, 11)],
           tail_short=[(-2, 2), (-3, 5), (-3, 7)])),
]

# --- balancé : cinq images, de l'arrière (0) à l'avant (4), choisies par l'angle ---
VINE_SWING = [
    # 0. tout en arrière : le corps traîne derrière les mains, jambes tendues vers l'arrière
    F(pose(torso="lean", tx=11, ty=15, **HEAD, **HANDS,
           near_leg=[(12, 24), (9, 26)], near_foot="back",
           far_leg=[(9, 23), (6, 24)], far_foot="back",
           tail_long=[(-3, 0), (-6, 1), (-8, 3), (-10, 6)],
           tail_short=[(-3, 1), (-5, 3), (-7, 5)])),
    # 1. en arrière
    F(pose(torso="up", tx=12, ty=15, **HEAD, **HANDS,
           near_leg=[(15, 25), (13, 28)], near_foot="down",
           far_leg=[(12, 25), (10, 27)], far_foot="back",
           tail_long=[(-3, 1), (-5, 3), (-6, 6), (-7, 9)],
           tail_short=[(-3, 1), (-4, 4), (-5, 6)])),
    # 2. à la verticale
    VINE_HANG[0],
    # 3. en avant : les jambes passent devant
    F(pose(torso="up", tx=12, ty=15, **HEAD, **HANDS,
           near_leg=[(19, 24), (20, 27)], near_foot="point",
           far_leg=[(16, 25), (16, 28)], far_foot="point",
           tail_long=[(-2, 2), (-4, 4), (-6, 6), (-8, 8)],
           tail_short=[(-2, 2), (-4, 4), (-6, 5)])),
    # 4. tout en avant : jambes lancées, buste en arrière, le foulard reste derrière
    F(pose(torso="back", tx=12, ty=15, **HEAD, **HANDS,
           near_leg=[(21, 23), (25, 23)], near_foot="flex",
           far_leg=[(19, 24), (23, 26)], far_foot="point",
           tail_long=[(-3, 0), (-6, 0), (-9, 1), (-11, 3)],
           tail_short=[(-3, 1), (-5, 2), (-8, 3)])),
]

# --- grimpe : une main après l'autre, les genoux remontent à tour de rôle ------
UP = dict(near_arm=[(18, 15), (20, 13)], far_arm=[(17, 19), (20, 18)], far_hand="hand")
MID = HANDS
DOWN = dict(near_arm=[(18, 17), (20, 16)], far_arm=[(18, 15), (21, 13)], far_hand="hand")
VINE_CLIMB = [
    F(pose(torso="up", tx=12, ty=15, **HEAD, **UP,
           near_leg=[(20, 23), (19, 26)], near_foot="tuck",
           far_leg=[(14, 25), (13, 28)], far_foot="down",
           tail_long=[(-2, 2), (-3, 5), (-3, 8), (-4, 11)], tail_short=[(-2, 2), (-2, 5), (-3, 7)])),
    F(pose(torso="up", tx=12, ty=15, **HEAD, **MID,
           near_leg=[(18, 24), (19, 27)], near_foot="point",
           far_leg=[(15, 24), (16, 27)], far_foot="down",
           tail_long=[(-2, 2), (-3, 5), (-4, 8), (-4, 12)], tail_short=[(-2, 2), (-3, 5), (-3, 8)])),
    F(pose(torso="up", tx=12, ty=15, **HEAD, **DOWN,
           near_leg=[(18, 25), (19, 28)], near_foot="point",
           far_leg=[(17, 23), (17, 26)], far_foot="tuck",
           tail_long=[(-2, 2), (-3, 5), (-3, 8), (-4, 11)], tail_short=[(-2, 2), (-2, 5), (-3, 7)])),
    F(pose(torso="up", tx=12, ty=15, **HEAD, **MID,
           near_leg=[(18, 24), (19, 27)], near_foot="point",
           far_leg=[(15, 24), (16, 27)], far_foot="down",
           tail_long=[(-2, 2), (-3, 5), (-4, 8), (-4, 12)], tail_short=[(-2, 2), (-3, 5), (-3, 8)])),
]

ANIMS = {
    "vine_hang": dict(frames=VINE_HANG, fps=3, loop=True, state="vine"),
    "vine_swing": dict(frames=VINE_SWING, fps=8, loop=False, state="vine"),
    "vine_climb": dict(frames=VINE_CLIMB, fps=8, loop=True, state="vine"),
}
