"""Agrandissement de 20 % des ennemis (TATE, WARA), demande de l'utilisateur.

Même méthode que pour KAGE (tools/kage_forge/scale.py) : pas de zoom, on double
quelques lignes et colonnes choisies du dessin fini, puis on retrace le contour.
Les lignes sont toutes au-dessus du sol, les colonnes réparties de part et
d'autre de l'ancrage : les pieds restent sur l'ancrage. Une colonne qui tombe
sur un œil est décalée d'un pixel (les yeux restent fins).
"""
import numpy as np

FACTOR = 1.2


class Grower:
    def __init__(self, w, h, pivot, rows, cols, no_outline, eyes=""):
        self.w, self.h, self.pivot = w, h, pivot
        self.rows, self.cols = tuple(sorted(rows)), tuple(sorted(cols))
        self.no_outline = set(no_outline) | {"O", "."}
        self.eyes = set(eyes)
        assert all(r < pivot[1] for r in self.rows), "les lignes doublées doivent être au-dessus du sol"
        self.W, self.H = w + len(self.cols), h + len(self.rows)
        self.PIVOT = (pivot[0] + sum(1 for c in self.cols if c < pivot[0]), pivot[1] + len(self.rows))

    def plan(self, g):
        cols, used = [], set()
        for c in self.cols:
            left = c < self.pivot[0]
            x = c
            for d in (0, 1, -1, 2, -2):
                xx = c + d
                if (xx < self.pivot[0]) != left or xx in used or not (0 <= xx < self.w):
                    continue
                if not any(ch in self.eyes for ch in g[:, xx]):
                    x = xx
                    break
            used.add(x)
            cols.append(x)
        return self.rows, tuple(sorted(cols))

    def grow(self, g, p=None):
        rows, cols = p or self.plan(g)
        g = g.copy()
        empty = np.pad(g == ".", 1, constant_values=True)
        touch = empty[:-2, 1:-1] | empty[2:, 1:-1] | empty[1:-1, :-2] | empty[1:-1, 2:]
        g[(g == "O") & touch] = "."                       # contour extérieur retiré, liserés gardés
        for r in sorted(rows, reverse=True):
            g = np.vstack([g[:r + 1], g[r:r + 1], g[r + 1:]])
        for c in sorted(cols, reverse=True):
            g = np.hstack([g[:, :c + 1], g[:, c:c + 1], g[:, c + 1:]])
        solid = ~np.isin(g, list(self.no_outline))
        near = np.zeros_like(solid)
        near[1:, :] |= solid[:-1, :]
        near[:-1, :] |= solid[1:, :]
        near[:, 1:] |= solid[:, :-1]
        near[:, :-1] |= solid[:, 1:]
        g[(g == ".") & near] = "O"
        return g

    def box(self, b):
        """Boîte de la petite cellule vers la grande, agrandie de 20 % autour de l'ancrage."""
        out = dict(b)
        out["x"] = round(self.PIVOT[0] + (b["x"] - self.pivot[0]) * FACTOR)
        out["y"] = round(self.PIVOT[1] + (b["y"] - self.pivot[1]) * FACTOR)
        out["w"] = round(b["w"] * FACTOR)
        out["h"] = round(b["h"] * FACTOR)
        return out
