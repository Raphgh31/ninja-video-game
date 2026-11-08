"""Agrandissement de KAGE (+20 %, demande de l'utilisateur), sans zoom flou.

En pixel art, un agrandissement de 20 % ne se fait pas par un zoom (un pixel
sur cinq doublé au hasard) : comme pour TATE, on double quelques lignes et
quelques colonnes choisies du dessin, puis on retrace le contour.

- Lignes : repérées sur la tête (retrouvée dans chaque image), pour qu'une même
  partie du corps grandisse dans toutes les animations : capuche, menton (sous
  les yeux), buste, cuisses. Jamais une ligne des yeux.
- Colonnes : fixes dans la cellule, autant de chaque côté du point d'ancrage
  (sous les pieds), pour que KAGE ne glisse pas d'une image à l'autre ; décalées
  d'un pixel si elles tombent sur un œil.

Les poses (art.py) restent dessinées dans la cellule 48×32 ; l'export
(build.py) les agrandit en BIG_W×BIG_H, ancrage BIG_PIVOT.
"""
import numpy as np

from accessories import find_head
from core import CH, CW, add_outline

PIVOT = (16, 31)
ROWS_REL = (2, 8, 12, 17)            # par rapport au haut de la tête (hy) : capuche, menton, buste, cuisses
COLS = (4, 9, 13, 20, 24, 28, 35, 40, 45)   # 3 à gauche des pieds, 3 à droite, 3 pour la lame
HEAD_FALLBACK = (10, 9)              # tête de la pose de repos (vues, mort et réapparition)
EYES = set("Ee")

BIG_W, BIG_H = CW + len(COLS), CH + len(ROWS_REL)
BIG_PIVOT = (PIVOT[0] + sum(1 for c in COLS if c < PIVOT[0]), PIVOT[1] + len(ROWS_REL))
FACTOR = 1.2


def plan(g):
    """Lignes et colonnes à doubler pour cette image (indices dans la cellule 48×32)."""
    hx, hy = find_head(g) or HEAD_FALLBACK
    rows, used = [], set()
    for r in ROWS_REL:
        y = min(hy + r, PIVOT[1] - 1)            # toujours au-dessus du sol : l'ancrage ne bouge pas
        while y in used or (y >= 0 and any(c in EYES for c in g[y])):
            y -= 1
        y = max(0, y)
        while y in used:
            y += 1
        used.add(y)
        rows.append(y)
    cols, usedc = [], set()
    for c in COLS:
        left = c < PIVOT[0]
        for d in (0, 1, -1, 2, -2):
            x = c + d
            if (x < PIVOT[0]) != left or x in usedc or not (0 <= x < CW):
                continue
            if not any(ch in EYES for ch in g[:, x]):
                break
        else:
            x = c
        usedc.add(x)
        cols.append(x)
    return sorted(rows), sorted(cols)


def strip_outline(g):
    """Retire le contour extérieur (les « O » qui touchent le vide) ; garde les liserés intérieurs."""
    g = g.copy()
    empty = np.pad(g == ".", 1, constant_values=True)
    touch = empty[:-2, 1:-1] | empty[2:, 1:-1] | empty[1:-1, :-2] | empty[1:-1, 2:]
    g[(g == "O") & touch] = "."
    return g


def grow(g, p):
    rows, cols = p
    g = strip_outline(g)
    for r in sorted(rows, reverse=True):
        g = np.vstack([g[:r + 1], g[r:r + 1], g[r + 1:]])
    for c in sorted(cols, reverse=True):
        g = np.hstack([g[:, :c + 1], g[:, c:c + 1], g[:, c + 1:]])
    return add_outline(g)


def big(g):
    return grow(g, plan(g))


def box(b, body=False):
    """Boîte de la cellule 48×32 vers la grande cellule. body : boîte de collision du
    corps, gardée à sa taille (les passages du niveau sont faits pour elle) ; sinon
    (zones de frappe), agrandie de 20 % autour de l'ancrage, comme l'arme dessinée."""
    out = dict(b)
    if body:
        out["x"] = b["x"] + BIG_PIVOT[0] - PIVOT[0]
        out["y"] = b["y"] + BIG_PIVOT[1] - PIVOT[1]
        return out
    out["x"] = round(BIG_PIVOT[0] + (b["x"] - PIVOT[0]) * FACTOR)
    out["y"] = round(BIG_PIVOT[1] + (b["y"] - PIVOT[1]) * FACTOR)
    out["w"] = round(b["w"] * FACTOR)
    out["h"] = round(b["h"] * FACTOR)
    return out


def point(x, y):
    return round(BIG_PIVOT[0] + (x - PIVOT[0]) * FACTOR), round(BIG_PIVOT[1] + (y - PIVOT[1]) * FACTOR)
