"""Saltos de KAGE : salto avant groupé (flip) et salto arrière groupé (backflip).

Le mouvement (d'après la gymnastique) :
  1. impulsion : jambes qui se tendent, bras lancés (vers l'avant et le haut pour le
     salto avant ; au-dessus de la tête, poitrine ouverte, pour le salto arrière) ;
  2. groupé : les genoux montent à la poitrine, les mains attrapent les tibias
     juste sous les genoux, le menton rentre ; KAGE devient une boule ;
  3. rotation en boule (de 45° en 45°) ;
  4. ouverture : les mains lâchent, les jambes se tendent vers le sol, les bras
     s'ouvrent pour freiner la rotation ;
  5. réception (jambes tendues, puis l'atterrissage habituel).

Les images droites (impulsion, groupé, ouverture) sont posées au rig, comme toutes
les autres. La boule tournée est calculée : le dessin agrandi (scale.py) de la
boule droite est tourné à la manière de RotSprite (agrandi ×8 par Scale2x, tourné,
puis réduit), ce qui garde des pixels nets. Le chapeau des skins est posé avant la
rotation : il tourne avec la tête.

Le bandeau, lui, ne tourne pas avec le corps : ses deux pans sont redessinés sur
chaque image, à la traîne du nœud (le chemin qu'a suivi le nœud pendant la rotation,
le déplacement du corps et un peu de gravité).
"""
import math

import numpy as np

from core import add_outline, render
from art import F
from rig import pose
import scale

# ---------------------------------------------------------------------------
# Poses droites (cellule 48×32, orientation droite, ancrage des pieds (16, 31))
# Les images en l'air gardent leur centre près du centre de la boîte de collision.
# ---------------------------------------------------------------------------

# impulsion du salto avant : jambes tendues, pointes de pied, bras lancés devant et en haut
TAKEOFF_FRONT = dict(torso="lean", tx=12, ty=17, head="head_r",
                     near_leg=[(16, 25), (16, 27)], near_foot="point",
                     far_leg=[(13, 25), (12, 27)], far_foot="down",
                     near_arm=[(20, 16), (23, 14)], far_arm=[(18, 16), (21, 14)])

# impulsion du salto arrière : poitrine ouverte, regard vers le haut, bras au-dessus de la tête
TAKEOFF_BACK = dict(torso="back", tx=11, ty=17, head="head_r_up",
                    near_leg=[(17, 25), (17, 27)], near_foot="point",
                    far_leg=[(14, 25), (14, 27)], far_foot="down",
                    near_arm=[(12, 14), (9, 11)], far_arm=[(11, 15), (8, 13)], near_behind=True)

# début du groupé : les genoux montent, les mains descendent vers les tibias
TUCK_IN = dict(torso="crouch", tx=12, ty=19,
               near_leg=[(20, 22), (19, 26)], near_foot="tuck",
               far_leg=[(17, 23), (16, 27)], far_foot="tuck",
               near_arm=[(17, 22), (19, 22)], far_arm=[(15, 22), (17, 22)])

# la boule : genoux à la poitrine, mains sur les tibias, menton rentré (tête un peu avancée)
TUCK = dict(torso="crouch", tx=12, ty=19, hx=11, hy=10,
            near_leg=[(20, 20), (19, 24)], near_foot="tuck",
            far_leg=[(18, 20), (17, 24)], far_foot="tuck",
            near_arm=[(17, 23), (19, 21)], far_arm=[(15, 22), (17, 21)])

# ouverture : jambes qui se tendent vers le sol, bras ouverts (un devant, un derrière)
OPEN = dict(torso="up", tx=12, ty=17,
            near_leg=[(17, 24), (17, 27)], near_foot="point",
            far_leg=[(13, 24), (12, 27)], far_foot="down",
            near_arm=[(19, 18), (22, 17)], far_arm=[(11, 18), (8, 16)])

# réception : jambes tendues prêtes à amortir, bras écartés pour l'équilibre
LANDING = dict(torso="up", tx=12, ty=18,
               near_leg=[(17, 25), (18, 28)], near_foot="flat",
               far_leg=[(13, 25), (12, 28)], far_foot="flat",
               near_arm=[(19, 20), (22, 19)], far_arm=[(11, 19), (8, 18)])


def small(p, **extra):
    """Pose -> grille 48×32 (contour compris), sans les pans du bandeau (ils sont ajoutés après)."""
    return render(F(pose(**p, **extra)))


# ---------------------------------------------------------------------------
# Rotation façon RotSprite, sur des grilles de slots (pas de couleurs mélangées)
# ---------------------------------------------------------------------------
def _scale2x(g):
    """Scale2x (EPX) sur une grille de caractères : double la taille en gardant les arêtes nettes."""
    h, w = g.shape
    p = np.pad(g, 1, mode="edge")
    B, D, E, F_, H = p[:-2, 1:-1], p[1:-1, :-2], p[1:-1, 1:-1], p[1:-1, 2:], p[2:, 1:-1]
    out = np.empty((h * 2, w * 2), dtype=g.dtype)
    c = (B != H) & (D != F_)
    out[0::2, 0::2] = np.where(c & (D == B), D, E)
    out[0::2, 1::2] = np.where(c & (B == F_), F_, E)
    out[1::2, 0::2] = np.where(c & (D == H), D, E)
    out[1::2, 1::2] = np.where(c & (H == F_), F_, E)
    return out


def rotate(g, deg, center):
    """Tourne la grille de `deg` degrés (sens horaire à l'écran) autour de `center` (x, y)."""
    if deg % 360 == 0:
        return g.copy()
    big = _scale2x(_scale2x(_scale2x(g)))          # ×8
    h, w = g.shape
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    out = np.full(g.shape, ".", dtype=g.dtype)
    cx, cy = center
    ys, xs = np.mgrid[0:h, 0:w]
    # point source (rotation inverse) au centre de chaque pixel
    dx, dy = xs + 0.5 - cx, ys + 0.5 - cy
    sx = cx + dx * ca + dy * sa
    sy = cy - dx * sa + dy * ca
    bx, by = np.floor(sx * 8).astype(int), np.floor(sy * 8).astype(int)
    ok = (bx >= 0) & (by >= 0) & (bx < w * 8) & (by < h * 8)
    out[ok] = big[by[ok], bx[ok]]
    return out


def clean(g):
    """Retire les pixels isolés que la rotation peut laisser (aucun voisin plein)."""
    g = g.copy()
    solid = g != "."
    p = np.pad(solid, 1)
    nb = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx]
             for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
    g[solid & (nb == 0)] = "."
    return g


# ---------------------------------------------------------------------------
# Le bandeau : deux pans à la traîne du nœud
# ---------------------------------------------------------------------------
LONG_TAIL, SHORT_TAIL = 12, 7            # longueurs (cellule agrandie)
LONG_COLORS, SHORT_COLORS = "GGFG", "ffF"
SPIN_KEEP = 0.85                          # élan de la rotation que le tissu garde
AIR = 0.5                                 # part de la vitesse du corps que l'air retire au tissu (il traîne derrière)


def _line(p0, p1):
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err, pts = dx + dy, []
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def _rot(p, c, deg):
    a = math.radians(deg)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))


def tail(knot, center, theta, omega, v, length, gravity=60.0, start=(0, 0)):
    """Pan de foulard : chaque point du tissu est là où était le nœud il y a τ secondes
    (le corps a tourné de omega·τ et avancé de v·τ depuis), et il est tombé un peu."""
    pts, t = [], 0.0
    k0 = (knot[0] + start[0], knot[1] + start[1])
    while t < 0.4:
        p = _rot(k0, center, theta - omega * t) if omega else _rot(k0, center, theta)
        # ce bout de tissu a quitté le nœud il y a t secondes avec la vitesse du nœud
        # (corps + rotation), puis l'air l'a freiné (KEEP : part d'élan gardée)
        rx, ry = p[0] - center[0], p[1] - center[1]
        w = math.radians(omega)
        tvx, tvy = -w * ry, w * rx                    # vitesse due à la rotation (sens horaire > 0)
        # (en chute libre, corps et tissu tombent ensemble : seule la résistance de l'air les sépare)
        x = p[0] - v[0] * t * AIR + tvx * t * SPIN_KEEP
        y = p[1] - v[1] * t * AIR + tvy * t * SPIN_KEEP + 0.5 * gravity * t * t
        pts.append((round(x), round(y)))
        t += 0.004
    path = []
    for a, b in zip(pts, pts[1:]):
        for q in _line(a, b):
            if not path or path[-1] != q:
                path.append(q)
    return path


def draw_tails(g, knot, center, theta, omega, v):
    """Dessine les deux pans derrière le corps (sur le vide seulement)."""
    g = g.copy()
    h, w = g.shape
    for length, colors, start, grav in ((SHORT_TAIL, SHORT_COLORS, (0, 1), 90.0),
                                         (LONG_TAIL, LONG_COLORS, (0, 0), 50.0)):
        # le tissu se compte à partir du moment où il sort de derrière le corps
        i = 0
        for (x, y) in tail(knot, center, theta, omega, v, length, grav, start):
            if not (0 <= x < w and 0 <= y < h) or i >= length:
                break
            if g[y, x] == ".":
                g[y, x] = colors[i % len(colors)]
                i += 1
            elif i:
                i += 1                                  # repasse derrière le corps : il reste caché
    return g


# ---------------------------------------------------------------------------
# Les séquences
# ---------------------------------------------------------------------------
SPIN = 720.0                              # vitesse de rotation en boule (°/s) : un tour en 0,5 s
BULK = {"tuck_in": 2, "ball": 3, "open": 1}   # lignes et colonnes ajoutées au corps seul (en boule, KAGE paraissait plus petit ; la tête ne change pas)


def _grow(p, acc):
    from accessories import dress
    g0 = small(p)
    plan = scale.plan(g0)                  # (sur l'image nue : même agrandissement avec ou sans chapeau)
    return scale.strip_outline(scale.grow(dress(g0, acc) if acc else g0, plan))


def _spread(n, lo, hi, bad):
    """n indices répartis dans [lo, hi], en évitant `bad` (lignes ou colonnes des yeux)."""
    out = []
    for i in range(n):
        x = round(lo + (hi - lo) * (i + 1) / (n + 1))
        for d in (0, 1, -1, 2, -2, 3, -3):
            if lo <= x + d <= hi and x + d not in bad and x + d not in out:
                x += d
                break
        out.append(x)
    return sorted(out)


HEAD = list("hHIEe")                      # capuche et yeux : la tête, gardée à sa taille


def bulk(g, n):
    """Agrandit le CORPS de n lignes et n colonnes doublées (jamais de zoom) ; la tête garde
    sa taille (demande de l'utilisateur : elle est déjà un peu grosse). Le corps est sous la
    tête dans les poses du salto : on étire seulement les lignes sous le bas de la capuche,
    recentrées sous le cou, puis toute l'image est recentrée dans la cellule."""
    if n <= 0:
        return g
    H, W = g.shape
    ys, xs = np.where(g != ".")
    cy, cx = ys.mean(), xs.mean()
    hb = int(np.where(np.isin(g, HEAD).any(1))[0].max())      # dernière ligne de la tête
    top, low = g[:hb + 1], g[hb + 1:]
    ly, lx = np.where(low != ".")
    rows = _spread(n, ly.min(), ly.max() - 1, set())
    cols = _spread(n, lx.min() + 1, lx.max() - 1, set())
    for r in reversed(rows):
        low = np.vstack([low[:r + 1], low[r:r + 1], low[r + 1:]])
    neck = (lx.min() + lx.max()) / 2
    for c in reversed(cols):
        low = np.hstack([low[:, :c + 1], low[:, c:c + 1], low[:, c + 1:]])
    ly2, lx2 = np.where(low != ".")
    shift = round((lx2.min() + lx2.max()) / 2 - neck)          # le corps reste centré sous le cou
    pts = [(y, x, top[y, x]) for y, x in zip(*np.where(top != "."))]
    pts += [(y + hb + 1, x - shift, low[y, x]) for y, x in zip(ly2, lx2)]
    my = sum(p[0] for p in pts) / len(pts); mx = sum(p[1] for p in pts) / len(pts)
    dy, dx = round(my - cy), round(mx - cx)                    # recentrer dans la cellule d'origine
    out = np.full(g.shape, ".", dtype=g.dtype)
    for y, x, v in pts:
        ny, nx = y - dy, x - dx
        if not (0 <= ny < H and 0 <= nx < W) and v in "rpPQcCbBijJO":
            continue                       # (le bout d'un accessoire de skin peut déborder : on le rogne)
        assert 0 <= ny < H and 0 <= nx < W, "salto : le corps agrandi sort de la cellule"
        out[ny, nx] = v
    return out


def _knot(g):
    ys, xs = np.where(np.isin(g, ["K", "k"]))
    if not len(xs):
        return None                                # (un skin sans pans de bandeau : voyageur, paysan…)
    return (float(xs.min()), float(ys.mean()))     # le côté arrière du nœud : les pans en partent


def _center(g):
    ys, xs = np.where(g != ".")
    return (xs.mean() + 0.5, ys.mean() + 0.5)


def _finish(g, knot, center, theta, omega, v):
    if knot is None:
        return add_outline(clean(g))
    return add_outline(clean(draw_tails(g, knot, center, theta, omega, v)))


def frames(kind, acc=None):
    """Images agrandies (57×36) du salto ; kind = 'front' ou 'back'. acc : accessoires du skin."""
    s = 1 if kind == "front" else -1
    out = []
    # 1. impulsion : le corps monte vite, le foulard pend dessous
    p = TAKEOFF_FRONT if kind == "front" else TAKEOFF_BACK
    g = _grow(p, acc)
    out.append(_finish(g, _knot(g), _center(g), 0, 0, (55 * s, -300)))
    # 2. début du groupé : la rotation s'amorce
    g = bulk(_grow(TUCK_IN, acc), BULK["tuck_in"])
    out.append(_finish(g, _knot(g), _center(g), 0, 300 * s, (60 * s, -200)))
    # 3. la boule, de 45° en 45° ; elle monte, passe le sommet, redescend
    ball = bulk(_grow(TUCK, acc), BULK["ball"])
    c, k = _center(ball), _knot(ball)
    for i, a in enumerate(range(45, 360, 45)):
        vy = -110 + i * 40                 # (envolée bridée : il monte doucement, flotte, redescend)
        g = rotate(ball, a * s, c)
        out.append(_finish(g, k, c, a * s, SPIN * s, (60 * s, vy)))      # (tail() tourne le nœud lui-même)
    # 4. ouverture : la rotation freine, les jambes vont chercher le sol
    g = bulk(_grow(OPEN, acc), BULK["open"])
    out.append(_finish(g, _knot(g), _center(g), 0, 220 * s, (55 * s, 200)))
    # 5. réception : jambes tendues, le foulard flotte au-dessus
    g = _grow(LANDING, acc)
    out.append(_finish(g, _knot(g), _center(g), 0, 0, (60 * s, 280)))
    return out


# durées (ms), reprises en jeu (player.js) : environ 0,95 s du deuxième appui à la réception
DURATIONS = [130, 100] + [70] * 7 + [100, 140]
ANIMS = {
    "flip": dict(build=lambda acc=None: frames("front", acc), fps=16, loop=False, state="flip", durations=DURATIONS),
    "backflip": dict(build=lambda acc=None: frames("back", acc), fps=16, loop=False, state="backflip", durations=DURATIONS),
}
