"""Palette indexée de KAGE.

Chaque pixel d'un sprite est dessiné avec un *slot* sémantique (un caractère
ASCII), jamais avec une couleur directe. Un skin n'est qu'une table
slot -> couleur. Les animations restent donc identiques d'un skin à l'autre.

Slots regroupés par partie (= calque exportable) :
    outline   O                  contour extérieur (généré automatiquement)
    hood      h H I              capuche : ombre / base / reflet
    mask      M                  masque (bas du visage)
    skin      N n                peau visible : bande des yeux et mains / ombre
    eyes      E e                yeux : pupille / reflet
    outfit    t T U              tunique, jambes : ombre / base / reflet
    bracers   a A                protections d'avant-bras : ombre / reflet
    belt      l L                ceinture : ombre / base
    shoes     d D                chaussures : ombre / base
    scarf     f F G              foulard : ombre / base / reflet
    blade     W w                lame du sabre : acier / ombre
    hilt      g                  poignée et garde du sabre
    accessory k K                nœud du foulard (emplacement cosmétique)
    fx        x X z q            effets : bloc sombre / bloc clair / traînée / éclat
"""

# slot -> (partie, rôle)
SLOTS = {
    "O": ("outline", "line"),
    "h": ("hood", "shadow"),
    "H": ("hood", "base"),
    "I": ("hood", "light"),
    "M": ("mask", "base"),
    "N": ("skin", "base"),
    "n": ("skin", "shadow"),
    "E": ("eyes", "glow"),
    "e": ("eyes", "dim"),
    "t": ("outfit", "shadow"),
    "T": ("outfit", "base"),
    "U": ("outfit", "light"),
    "a": ("bracers", "shadow"),
    "A": ("bracers", "light"),
    "l": ("belt", "shadow"),
    "L": ("belt", "base"),
    "d": ("shoes", "shadow"),
    "D": ("shoes", "base"),
    "f": ("scarf", "shadow"),
    "F": ("scarf", "base"),
    "G": ("scarf", "light"),
    "W": ("blade", "light"),
    "w": ("blade", "shadow"),
    "g": ("hilt", "base"),
    "k": ("accessory", "shadow"),
    "K": ("accessory", "base"),
    "x": ("fx", "dark"),
    "X": ("fx", "light"),
    "z": ("fx", "streak"),
    "q": ("fx", "spark"),
}

PARTS = [
    "outline", "hood", "mask", "skin", "eyes", "outfit", "bracers",
    "belt", "shoes", "scarf", "blade", "hilt", "accessory", "fx",
]

# Ordre stable des slots : sert d'index dans la carte d'index (R = index).
SLOT_ORDER = list(SLOTS.keys())

# Slots qui ne reçoivent pas de contour automatique (effets flottants).
NO_OUTLINE = set("xXzq")
