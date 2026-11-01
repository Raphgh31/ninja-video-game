"""Composition des frames de pixel art à partir de grilles ASCII indexées.

Une frame est une liste d'opérations appliquées dans l'ordre (calques) :
    A(texte, x, bottom|top)   bloc ASCII dessiné à la main
    S(nom, x, y, flip=False)  tampon réutilisable (ex. la tête, dessinée une fois
                              par orientation pour garantir sa constance)
'.' est transparent. Le contour extérieur 'O' est ajouté automatiquement
(voisinage 4, comme le filtre « Outline » d'Aseprite) ; un 'O' dessiné à la
main est conservé tel quel.
"""
from dataclasses import dataclass, field

import numpy as np

from palette import NO_OUTLINE, SLOTS

CW, CH = 48, 32   # cellule : 48 de large (place devant pour le sabre), 32 de haut
CELL = CH
GROUND = 30  # dernière ligne intérieure ; la ligne 31 accueille le contour des pieds

STAMPS: dict[str, np.ndarray] = {}


def parse(text: str) -> np.ndarray:
    rows = [ln.strip() for ln in text.strip("\n").splitlines() if ln.strip()]
    w = max(len(r) for r in rows)
    grid = np.full((len(rows), w), ".", dtype="<U1")
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != "." and c not in SLOTS:
                raise ValueError(f"caractère inconnu {c!r} dans:\n{text}")
            grid[y, x] = c
    return grid


def stamp(name: str, text: str) -> None:
    STAMPS[name] = parse(text)


@dataclass
class A:
    text: str
    x: int = 0
    bottom: int | None = GROUND
    top: int | None = None


@dataclass
class S:
    name: str
    x: int
    y: int
    flip: bool = False


@dataclass
class G:
    """Grille déjà composée (pose du rig)."""
    grid: object


@dataclass
class Frame:
    ops: list
    outline: bool = True
    tag: str = ""
    meta: dict = field(default_factory=dict)


def _blit(canvas: np.ndarray, grid: np.ndarray, x: int, y: int) -> None:
    h, w = grid.shape
    for gy in range(h):
        for gx in range(w):
            c = grid[gy, gx]
            if c == ".":
                continue
            cx, cy = x + gx, y + gy
            if 0 <= cx < CW and 0 <= cy < CH:
                canvas[cy, cx] = c
            else:
                raise ValueError(f"pixel hors cellule ({cx},{cy})")


def add_outline(canvas: np.ndarray) -> np.ndarray:
    solid = np.isin(canvas, [s for s in SLOTS if s not in NO_OUTLINE and s != "O"])
    empty = canvas == "."
    near = np.zeros_like(solid)
    near[1:, :] |= solid[:-1, :]
    near[:-1, :] |= solid[1:, :]
    near[:, 1:] |= solid[:, :-1]
    near[:, :-1] |= solid[:, 1:]
    out = canvas.copy()
    out[empty & near] = "O"
    return out


def render(frame: Frame) -> np.ndarray:
    canvas = np.full((CH, CW), ".", dtype="<U1")
    for op in frame.ops:
        if isinstance(op, A):
            g = parse(op.text)
            y = op.top if op.top is not None else op.bottom - g.shape[0] + 1
            _blit(canvas, g, op.x, y)
        elif isinstance(op, S):
            g = STAMPS[op.name]
            if op.flip:
                g = np.fliplr(g)
            _blit(canvas, g, op.x, op.y)
        elif isinstance(op, G):
            _blit(canvas, op.grid, 0, 0)
        else:
            raise TypeError(op)
    if frame.outline:
        canvas = add_outline(canvas)
    return canvas
