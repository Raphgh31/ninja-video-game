"""KARASU-KASHI — le corbeau du potager, mini-boss du chapitre 1.

Un grand corbeau japonais, rusé, arrogant et un peu excentrique, perché sur un
épouvantail géant. Il porte un minuscule chapeau de paille tressée (sugegasa)
posé de travers, des haillons sombres aux ailes, des ficelles de chanvre
nouées aux plumes et deux talismans de papier aux pattes.

Dessin : pas de blocs ASCII ici (le personnage est grand et ses ailes changent
de forme à chaque pose) mais un petit squelette, comme le rig de KAGE : chaque
pose règle l'angle du corps, la tête, les yeux, le bec, les ailes (plume par
plume), la queue, les pattes et le chapeau. Le plumage est ainsi identique d'une
animation à l'autre. Chaque plume est un fuseau effilé, ombré du noir d'encre
à l'indigo, bordé d'un reflet bleu pétrole du côté de la lumière (en haut à
gauche) et séparé de la suivante par un liseré d'encre.
Sortie : grille de caractères (palette ci-dessous), contour extérieur ajouté
automatiquement, comme KAGE, TATE et WARA. Orientation droite.
"""
import math

import numpy as np

W, H = 96, 80          # cellule
FX, FY = 48, 76        # ancrage : sous les pattes (dernière ligne pleine = 76)

PAL = {
    "O": "#0a0b11",                                    # contour
    # plumage : noir d'encre, charbon, bleu nuit, indigo
    "k": "#0c0d12", "K": "#13151d", "b": "#1b1e2a", "B": "#242938", "i": "#2f3549", "I": "#3d455e",
    # reflets : bleu pétrole, bleu métal
    "p": "#1d4752", "P": "#2c6a78", "m": "#4f7aa8", "M": "#8fb3d8",
    # yeux
    "a": "#e3a12a", "A": "#ffd35e", "Z": "#fff3c0", "e": "#7a3d10", "n": "#0b0a0c",
    # bec
    "q": "#15161c", "Q": "#2d3039", "z": "#5d6270", "v": "#4a2a2a",
    # pattes et serres
    "l": "#2a2729", "L": "#4b4547", "t": "#cfc6b2", "T": "#8f877a",
    # chapeau de paille (sugegasa) et sa cordelette
    "h": "#5c5134", "H": "#8c7f57", "y": "#c2ae78", "Y": "#e2d29d", "c": "#3e2c1a",
    # haillons de tissu sombre
    "r": "#231d2a", "R": "#3a3044", "X": "#52465c",
    # ficelles de chanvre
    "s": "#7f6a42", "S": "#b39b66",
    # talismans de papier
    "w": "#ece4c8", "W": "#c4b894", "x": "#b0322a",
    # sans contour : effets
    "f": "#2c3350", "F": "#4d5a85",                    # plumes qui volent (corps)
    "o": "#ffe39a", "u": "#fff8d8",                    # étoiles du tournis
    "d": "#b49a72", "D": "#d8c49a",                    # poussière, terre
    "g": "#c2a35a", "G": "#e6cf8e",                    # brins de paille
}
NO_OUTLINE = set("fFouDdgG")

PLUM = "kKbBiI"     # du plus sombre au plus clair
SHEEN = "pPmM"


def ramp(r, v):
    v = max(0.0, min(0.999, v))
    return r[int(v * len(r))]


def h01(*a):
    """Petit bruit déterministe dans [0, 1)."""
    n = 0
    for k in a:
        n = (n * 1103515245 + int(k * 7919) + 12345) & 0x7FFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0x7FFFFFFF
    return (n % 10007) / 10007


class Canvas:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.g = np.full((h, w), ".", dtype="<U1")

    def p(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if c and c != "." and 0 <= x < self.w and 0 <= y < self.h:
            self.g[y, x] = c

    def shape(self, inside, color, box):
        """Remplit les pixels dont le centre est dans la forme ; color(x, y, info) -> lettre."""
        x0, y0, x1, y1 = (int(math.floor(box[0])) - 1, int(math.floor(box[1])) - 1, int(math.ceil(box[2])) + 1, int(math.ceil(box[3])) + 1)
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                info = inside(x + 0.5, y + 0.5)
                if info is not None:
                    c = color(x, y, info)
                    if c:
                        self.g[y, x] = c

    def outline(self):
        g = self.g
        # nettoyage : un pixel orphelin (sans aucun voisin, diagonales comprises) est retiré
        solid = (g != ".") & ~np.isin(g, list(NO_OUTLINE))
        pad = np.pad(solid, 1)
        n = sum(pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
        g[solid & (n == 0)] = "."
        solid = (g != ".") & ~np.isin(g, list(NO_OUTLINE)) & (g != "O")
        near = np.zeros_like(solid)
        near[1:, :] |= solid[:-1, :]
        near[:-1, :] |= solid[1:, :]
        near[:, 1:] |= solid[:, :-1]
        near[:, :-1] |= solid[:, 1:]
        g[(g == ".") & near] = "O"
        return g


# ---------------------------------------------------------------------------
# formes de base
# ---------------------------------------------------------------------------
def ellipse(c, cx, cy, rx, ry, ang, color):
    ca, sa = math.cos(ang), math.sin(ang)

    def inside(x, y):
        dx, dy = x - cx, y - cy
        u = (dx * ca + dy * sa) / rx
        v = (-dx * sa + dy * ca) / ry
        d = u * u + v * v
        return (u, v, d) if d <= 1 else None
    R = max(rx, ry)
    c.shape(inside, color, (cx - R, cy - R, cx + R, cy + R))


def feather(c, bx, by, ang, length, width, tone=0.45, sheen=0.0, seed=0, tip=0.55, edge=True, curve=0.0):
    """Une plume : fuseau de (bx, by) vers l'angle donné ; largeur pleine jusqu'à
    `tip` de sa longueur puis effilée. sheen : force du reflet bleu pétrole sur
    le bord éclairé. curve : la plume se courbe (fraction de la longueur)."""
    ca, sa = math.cos(ang), math.sin(ang)
    nx, ny = -sa, ca                                # côté « gauche » de la plume

    def inside(x, y):
        dx, dy = x - bx, y - by
        s = (dx * ca + dy * sa) / length
        if s < -0.05 or s > 1.0:
            return None
        off = curve * length * s * s                # courbure : le bout part sur le côté
        d = (dx * nx + dy * ny) - off
        half = width / 2 * (1 if s < tip else max(0.0, (1 - s) / (1 - tip)) ** 0.8)
        half = max(half, 0.0)
        if abs(d) > half + 0.05 or half < 0.25:
            return None
        return (s, d / max(0.5, half))
    color = lambda x, y, q: feather_px(q[0], q[1], tone, sheen, seed, x, y, ang, edge)  # noqa: E731
    L = length + width
    c.shape(inside, color, (bx - L, by - L, bx + L, by + L))


def feather_px(s, d, tone, sheen, seed, x, y, ang, edge):
    # côté éclairé : celui qui regarde en haut à gauche
    lit_side = 1 if (-math.sin(ang) * -0.6 + math.cos(ang) * -0.8) > 0 else -1
    dd = d * lit_side
    v = tone - 0.18 * s + (h01(seed, int(s * 6)) - 0.5) * 0.12
    if edge and dd < -0.62:
        return "k"                                  # liseré d'encre : sépare des voisines
    if sheen > 0 and dd > 0.35:
        sv = sheen * (1 - abs(s - 0.45)) + (h01(seed, x, y) - 0.5) * 0.15
        if sv > 0.25:
            return "m" if (sv > 0.72 and dd > 0.75) else "P" if sv > 0.45 else "p"
    if abs(d) < 0.18 and s > 0.15 and s < 0.85 and tone > 0.3:
        v -= 0.12                                   # le rachis, un peu plus sombre
    return ramp(PLUM, v + dd * 0.1)


def poly(c, pts, color):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]

    def inside(x, y):
        n, ins = len(pts), False
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                ins = not ins
            j = i
        return (x, y) if ins else None
    c.shape(inside, color, (min(xs), min(ys), max(xs), max(ys)))


def line(c, x0, y0, x1, y1, col, w=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        t = i / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        for k in range(w):
            c.p(x + (k if abs(y1 - y0) > abs(x1 - x0) else 0), y + (0 if abs(y1 - y0) > abs(x1 - x0) else k), col)


def rot(px, py, ox, oy, a):
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = px - ox, py - oy
    return ox + dx * ca - dy * sa, oy + dx * sa + dy * ca


# ---------------------------------------------------------------------------
# le corbeau
# ---------------------------------------------------------------------------
DEFAULT = dict(
    bx=45, by=54, bang=-0.62,          # corps (centre, angle : redressé, poitrine en avant)
    hx=None, hy=None, tilt=0.0,        # tête (par défaut sur le cou)
    eye="smug", beak=0.0,              # expression, ouverture du bec (0 à 1)
    wings="folded", wing=0.0,          # ailes : folded | spread (wing = angle) | tucked | droop
    tail=0.0, legs="stand",            # queue (angle en plus), pattes : stand | tuck | grab | splay
    hat="on", hatdx=0, hatdy=0, hatang=-0.17,
    fx=(),                             # effets : stars, feathers, dust, straw
    puff=0.0,                          # plumage gonflé (surprise, ébrouement)
)
BODY_L, BODY_T = 16.5, 12.0           # demi-longueur et demi-épaisseur du corps


def axis(P, d, n=0.0):
    """Point du corps : d le long de l'axe (vers la poitrine), n de côté (vers le dos si < 0)."""
    a = P["bang"]
    return (P["bx"] + math.cos(a) * d - math.sin(a) * n, P["by"] + math.sin(a) * d + math.cos(a) * n)


def crow(**kw):
    P = dict(DEFAULT, **kw)
    c = Canvas()
    ba = P["bang"]
    if P.get("headpos") == "front":                    # en vol : la tête prolonge le corps
        hx, hy = axis(P, BODY_L + 5, -4)
    else:
        nx, ny = axis(P, 11, -6)                       # posé : la tête se dresse sur le cou
        hx, hy = nx + 5, ny - 11
    if P["hx"] is not None:                            # tête placée à la main (défaite)
        hx, hy = P["hx"], P["hy"]
    hx += P.get("hdx", 0)
    hy += P.get("hdy", 0)
    P["_head"] = (hx, hy)
    if P["wings"] in ("spread", "droop"):
        wing(c, P, far=True)                           # aile lointaine, derrière le corps
    tail(c, P)
    legs(c, P)
    body(c, P)
    neck(c, P, hx, hy)
    if P["wings"] == "folded":
        folded_wing(c, P)
    elif P["wings"] == "tucked":
        tucked_wing(c, P)
    else:
        wing(c, P, far=False)
    head(c, hx, hy, P)
    c.outline()
    effects(c, P, hx, hy)
    return c.g


def body(c, P):
    puff = P["puff"]
    bx, by = P["bx"], P["by"]

    def col(x, y, q):
        u, v, d = q                                    # u : vers la poitrine, v : vers le ventre
        lt = 0.42 - 0.3 * v + 0.06 * u
        if d > 0.8:
            lt += 0.16 if v < -0.2 else -0.14          # liseré de lumière sur le dos, ombre dessous
        # poitrine : écailles de plumes en quinconce (petits arcs sombres)
        if u > 0.0 and v > -0.3 and d < 0.85:
            row = int(y) // 4
            if int(y) % 4 == 3 and (int(x) + row * 2) % 4 in (1, 2):
                lt -= 0.13
            elif int(y) % 4 == 0 and (int(x) + row * 2) % 4 in (1, 2):
                lt += 0.1
            if u > 0.55:
                lt += 0.06                               # la poitrine bombée prend la lumière
        # dos : reflet bleu pétrole sur l'arrondi
        if v < -0.55 and d < 0.9 and (int(x) + int(y)) % 3 != 0:
            return "p" if (int(x) * 2 + int(y)) % 5 else "P"
        return ramp(PLUM, lt)
    ellipse(c, bx, by, BODY_L + puff, BODY_T + puff * 0.8, P["bang"], col)
    # la poitrine généreuse, bombée en avant
    cx, cy = axis(P, 7, 4)
    ellipse(c, cx, cy, 11 + puff, 10 + puff, P["bang"] + 0.5, lambda x, y, q: col(x, y, (0.4 + q[0] * 0.5, q[1] * 0.7 + 0.15, q[2] * 0.8)))


def neck(c, P, hx, hy):
    ax, ay = axis(P, 9, -3)
    bx2, by2 = axis(P, 14, 6)
    pts = [(ax - 6, ay - 2), (hx - 8, hy + 1), (hx + 2, hy + 7), (bx2 + 2, by2 - 2)]
    poly(c, pts, lambda x, y, q: ramp(PLUM, 0.4 - (x - hx) * 0.01 - ((int(x) * 2 + int(y)) % 5 == 0) * 0.12))
    # plumes hérissées de la gorge (la « barbe » du grand corbeau)
    for k in range(5):
        x0, y0 = hx + 2 + k * 1.5, hy + 6 + k * 0.6
        feather(c, x0, y0, 1.85 - k * 0.12, 7 + (k % 2) * 2, 3, tone=0.42, sheen=0.5 if k % 2 else 0.0, seed=150 + k, tip=0.35, edge=k % 2 == 0)


def tail(c, P):
    bx, by = axis(P, -BODY_L + 3, 2)
    a0 = P["bang"] + math.pi + 0.28 + P["tail"]          # prolonge le dos, un peu vers le bas
    for i, (da, L, w, tone, sh) in enumerate([(-0.22, 25, 6, 0.3, 0.3), (0.22, 25, 6, 0.32, 0.3), (-0.09, 30, 6, 0.42, 0.75), (0.09, 29, 6, 0.4, 0.6), (0.0, 32, 7, 0.5, 0.85)]):
        feather(c, bx, by, a0 + da, L, w, tone=tone, sheen=sh, seed=40 + i, tip=0.72)
    # ficelle de chanvre nouée autour de la plume centrale
    tx, ty = bx + math.cos(a0) * 16, by + math.sin(a0) * 16
    nxv, nyv = -math.sin(a0), math.cos(a0)
    for k in range(-3, 4):
        c.p(tx + nxv * k, ty + nyv * k, "S" if k % 2 else "s")
    c.p(tx + nxv * 3 + 1, ty + nyv * 3 + 1, "s")
    c.p(tx + nxv * 3 + 1, ty + nyv * 3 + 2, "S")


def legs(c, P):
    mode = P["legs"]
    if mode == "tuck":
        return
    for k, side in enumerate((-1, 1)):
        hipx, hipy = axis(P, 2 + side * 4, BODY_T - (4 if mode == "splay" else 2))
        if mode == "stand":
            fx, fy = FX + side * 4 - 1, FY
        elif mode == "sit":                              # assis, pattes tendues devant lui (défaite)
            fx, fy = hipx + 11 + k * 4, FY - 1
        elif mode == "grab":                             # serres tendues vers l'avant (plongeon)
            fx, fy = hipx + 13 + k * 3, hipy + 8 - k * 3
        else:                                             # splay : pattes raides en l'air
            fx, fy = hipx + side * 5, hipy - 15
        n = int(max(abs(fx - hipx), abs(fy - hipy)))
        for i in range(n + 1):
            t = i / max(1, n)
            x, y = hipx + (fx - hipx) * t, hipy + (fy - hipy) * t
            c.p(x, y, "L" if i % 2 else "l")
            c.p(x + 1, y, "l")
        if mode == "stand":
            for dx, dy in ((4, 0), (2, 0), (-3, 0)):
                line(c, fx, fy, fx + dx, fy + dy, "l")
                c.p(fx + dx + (1 if dx > 0 else -1), fy + dy, "t")
            c.p(fx + 5, fy - 1, "T")
        else:
            d = 1 if mode == "grab" else -1                # assis : les doigts pointent en l'air
            for dx, dy in ((4, -2), (5, 1), (2, 3)):
                line(c, fx, fy, fx + dx, fy + dy * d, "l")
                c.p(fx + dx + 1, fy + dy * d, "t")
                c.p(fx + dx + 1, fy + (dy + 1) * d, "T")
        # talisman de papier noué à la patte, inscriptions rouges
        tx, ty = hipx + (fx - hipx) * 0.3, hipy + (fy - hipy) * 0.3
        c.p(tx, ty, "s"); c.p(tx + 1, ty, "S"); c.p(tx - 1, ty, "s")     # le lien de chanvre autour de la patte
        sway = 0 if mode == "stand" else -1
        px0 = tx - 3 if side < 0 else tx + 2                              # le papier pend à côté de la patte
        for j in range(1, 8):
            o = (j * sway) // 3
            c.p(px0 + o, ty + j, "W" if j in (1, 7) else "w")
            c.p(px0 + 1 + o, ty + j, "w" if j < 7 else "W")
        c.p(px0, ty + 3, "x"); c.p(px0 + 1, ty + 3, "x"); c.p(px0 + 1, ty + 5, "x"); c.p(px0, ty + 6, "x")


def folded_wing(c, P):
    # aile repliée le long du flanc : grandes rémiges (pointes croisées sur la
    # queue), secondaires, couvertures en écailles, scapulaires sur l'épaule
    sx, sy = axis(P, 6, -7)                              # épaule
    back = P["bang"] + math.pi + 0.06
    for i in range(4):
        feather(c, sx - 1 + i * 0.4, sy + 2 + i * 1.6, back - 0.04 * i, 25 - i * 1.5, 7, tone=0.34 + i * 0.03, sheen=0.9, seed=10 + i, tip=0.6)
    for i in range(4):
        feather(c, sx + 1 + i * 0.3, sy + 1.5 + i * 1.7, back + 0.02, 19 - i, 7, tone=0.44, sheen=0.55, seed=20 + i, tip=0.58)

    def cov(x, y, q):
        u, v, d = q
        row = int((v + 1) * 2.2)
        lt = 0.58 - 0.18 * v - 0.08 * row
        if (int(y) + int(x * 0.5)) % 3 == 2:
            lt -= 0.18
        if v < -0.55 and d < 0.9:
            return "m" if d > 0.6 and (int(x) % 3 == 0) else "P" if (int(x) + int(y)) % 3 else "p"
        return ramp(PLUM, lt)
    cx, cy = axis(P, 0, -3)
    ellipse(c, cx, cy, 12, 7, P["bang"] - 0.05, cov)
    rx, ry = axis(P, -5, 3)                              # noué au bord de l'aile
    rag(c, rx, ry, P)


def tucked_wing(c, P):
    """Plongeon : les deux ailes à demi repliées, en flèche vers l'arrière."""
    back = P["bang"] + math.pi
    for far in (True, False):
        sx, sy = axis(P, 5, -7 - (2 if far else 0))
        tone = 0.24 if far else 0.42
        for i in range(5):
            feather(c, sx - i, sy - i * 0.6 - (3 if far else 0), back - 0.32 - (0.12 if far else 0) + i * 0.07, 29 - i * 1.5, 6, tone=tone, sheen=0 if far else 0.9, seed=60 + i + far * 10, tip=0.62)
        cx, cy = axis(P, 1, -5 - (2 if far else 0))
        ellipse(c, cx, cy, 11, 5, back - 0.25, lambda x, y, q, f=far: ramp(PLUM, (0.3 if f else 0.58) - 0.25 * q[1]) if f or q[1] > -0.45 or (int(x) + int(y)) % 3 == 0 else "P")
    rx, ry = axis(P, -2, -2)
    rag(c, rx, ry, P, wind=True)


def wing(c, P, far=False):
    """Aile ouverte, vue de côté. P['wing'] : direction du bras (radians, depuis
    l'épaule) : -1.9 levée, -2.6 en arrière (vol plané), 2.3 abaissée.
    Bord de fuite (secondaires) vers l'arrière ; au bout, six rémiges primaires
    écartées comme des doigts : la signature du corbeau."""
    sx, sy = axis(P, 6, -7)
    a = P["wing"] + (0.22 if far else 0.0)            # l'aile lointaine suit avec un léger retard
    if far:
        sx, sy = sx - 2, sy - 1
    span = 0.85 if far else 1.0
    tone = 0.22 if far else 0.46
    ex, ey = sx + math.cos(a) * 19 * span, sy + math.sin(a) * 19 * span      # poignet
    back = math.pi + P["bang"]                           # vers la queue

    def toward(x, t):                                    # tourne l'angle x vers « back » d'une fraction t
        d = (back - x + math.pi) % (2 * math.pi) - math.pi
        return x + d * t
    for i in range(7):                                   # secondaires, de l'épaule au poignet
        t = i / 6
        px, py = sx + (ex - sx) * t, sy + (ey - sy) * t
        feather(c, px, py, toward(a, 0.72 - t * 0.2), (17 - t * 2) * span, 7, tone=tone, sheen=0 if far else 0.5, seed=80 + i + far * 20, tip=0.6)
    for i in range(6):                                   # primaires : les doigts, du bout vers l'arrière
        fa = toward(a, -0.08 + i * 0.12)
        L = (27 - i * 1.2) * span
        feather(c, ex, ey, fa, L, 6, tone=tone - 0.04, sheen=0 if far else 0.9, seed=100 + i + far * 20, tip=0.5)

    def cov(x, y, q):
        u, v, d = q
        lt = (0.28 if far else 0.58) - 0.2 * v - (0.15 if (int(y) + int(u * 5)) % 3 == 2 else 0)
        if not far and v < -0.45 and d < 0.9:
            return "m" if d > 0.6 and int(x) % 3 == 0 else "P" if (int(x) + int(y)) % 3 else "p"
        return ramp(PLUM, lt)
    ang = math.atan2(ey - sy, ex - sx)
    ellipse(c, (sx + ex) / 2, (sy + ey) / 2, 12 * span, 6.5, ang, cov)
    if not far:
        mx, my = sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55
        rag(c, mx + math.cos(back) * 3, my + 3, P, wind=True)


def rag(c, x, y, P, wind=False):
    """Un haillon de tissu sombre noué à l'aile : un pan trapézoïdal, un pli,
    le bas effiloché en dents ; au vent, il part en arrière."""
    lean = -0.55 if wind else 0.12
    for j in range(9):
        w = 5 + j // 3
        for i in range(w):
            if j == 8 and i % 2:                         # bord effiloché, en dents
                continue
            if j == 7 and i % 3 == 2:
                continue
            col = "X" if i == 1 else "R" if i < w - 2 else "r"
            if i == 3 and j > 1:
                col = "r"                                 # le pli
            c.p(x - w / 2 + i + j * lean, y + j, col)
    for k in range(-3, 3):                               # le nœud de chanvre
        c.p(x + k, y - 1, "S" if k % 2 else "s")
    c.p(x + 2, y, "s"); c.p(x + 3, y + 1, "S")


def head(c, hx, hy, P):
    tilt = P["tilt"]
    r = 11.0

    def col(x, y, q):
        u, v, d = q
        lt = 0.5 - 0.28 * v - 0.14 * u
        if d > 0.8:
            lt -= 0.16
        if 0.55 < d < 0.82 and v < -0.15 and u < 0.1:
            return "P" if d < 0.68 and v < -0.5 else "p"    # un arc de reflet pétrole sur la nuque
        if (int(x) + 2 * int(y)) % 7 == 0:
            lt -= 0.08
        return ramp(PLUM, lt)
    ellipse(c, hx, hy, r, r * 0.9, tilt, col)
    if P["hat"] == "on":                                 # cordelette du chapeau : derrière la joue, sous le bec
        x0, y0 = rot(hx - 4 + P["hatdx"], hy - 7.5 + P["hatdy"], hx, hy, tilt)
        x1, y1 = rot(hx + 3, hy + 9, hx, hy, tilt)
        line(c, x0, y0, x1, y1, "c")
    beak(c, hx, hy, P)
    eye(c, hx, hy, P)
    # plumes rebelles sur la nuque
    for k, (dx, ang, L) in enumerate(((-7, -2.45, 7), (-4, -2.1, 8), (-1, -1.8, 6))):
        x0, y0 = rot(hx + dx, hy - 7, hx, hy, tilt)
        feather(c, x0, y0, ang + tilt, L, 3, tone=0.4, sheen=0.6, seed=170 + k, tip=0.35, edge=False, curve=-0.3)
    hat(c, hx, hy, P)


def beak(c, hx, hy, P):
    tilt, op = P["tilt"], P["beak"]
    bx0, by0 = rot(hx + 8, hy + 2, hx, hy, tilt)
    # mandibule supérieure : épaisse, l'arête bombée, crochue au bout
    up = [(-1, -3.8), (5, -3.6), (10, -2.4), (14, -0.2), (15.2, 1.8), (14.4, 3.0), (13, 1.4), (7, 0.6), (-1, 1.0)]
    lo = [(-1, 1.0), (7, 1.0 + op * 2.8), (12, 1.6 + op * 5.0), (12.6, 2.6 + op * 5.0), (7, 3.4 + op * 3.0), (-1, 4.2)]

    def tr(pts):
        return [rot(bx0 + px, by0 + py, bx0, by0, tilt) for px, py in pts]

    def ucol(x, y, q):
        dx, dy = rot(x + 0.5, y + 0.5, bx0, by0, -tilt)
        dx -= bx0; dy -= by0
        if dy < -2.4 and 0 < dx < 11:
            return "z"                                 # l'arête éclairée
        return "Q" if dy < 0 else "q"
    if op > 0.05:
        poly(c, tr([(0, 0.6), (11, 1.6 + op * 2.5), (11, 2.4 + op * 3.5), (0, 3.2)]), lambda x, y, q: "v")
    if P["eye"] == "ko":                                  # la langue tirée
        for k in range(4):
            x, y = rot(bx0 + 6 + k, by0 + 2.5 + op * 3 + (k > 1), bx0, by0, tilt)
            c.p(x, y, "x")
    poly(c, tr(lo), lambda x, y, q: "Q" if rot(x + 0.5, y + 0.5, bx0, by0, -tilt)[1] - by0 < 2.2 + op * 2 else "q")
    poly(c, tr(up), ucol)
    # soies nasales : une touffe de petites plumes couvre la base du bec
    for k in range(4):
        x, y = rot(bx0 - 1 + k * 1.4, by0 - 3.2 + k * 0.4, bx0, by0, tilt)
        c.p(x, y, "I" if k % 2 else "i")
        c.p(x + 1, y + 1, "B")


EYES = {
    #            5x5 : a ambre, A clair, Z éclat, n pupille, e cerne, B/K paupière
    "smug":     ["KKKKK", "Bbbbb", "aaAnn", "eaann", ".eaa."],     # paupière lourde : narquois
    "curious":  [".eae.", "eaAZa", "aaann", "eaann", ".eae."],     # rond, pupille en avant
    "angry":    ["KK...", "bKKK.", "aAaKn", "eaann", ".eaa."],     # sourcil en V
    "surprise": [".eae.", "eaZaa", "aaAna", "eaaaa", ".eae."],     # écarquillé, petite pupille
    "dizzy":    [".eae.", "eannа".replace("а", "a"), "anaaa", "eaanZ", ".eae."],
    "dizzy2":   [".eae.", "eaana", "aaana", "enaaa", ".eae."],
    "closed":   [".....", "KKKKK", "eKKKe", ".....", "....."],
    "glare":    ["KKKKK", "bKKKK", "aaAnn", "eaann", "....."],     # il fixe sa cible avant de plonger
    "hurt":     ["K....", "bKK..", ".bKKK", "eaann", "....."],     # vexé, plissé
    "ko":       ["n...n", ".n.n.", "..n..", ".n.n.", "n...n"],
}


def eye(c, hx, hy, P):
    tilt = P["tilt"]
    x, y = rot(hx + 4.5, hy - 1.5, hx, hy, tilt)
    x, y = int(round(x)), int(round(y))
    for j, row in enumerate(EYES[P["eye"]]):
        for i, ch in enumerate(row):
            if ch != ".":
                c.p(x + i - 2, y + j - 2, ch)
    # sourcil de plumes : il fait tout le caractère du regard
    if P["eye"] in ("smug", "glare"):
        for i in range(-3, 4):
            c.p(x + i, y - 3 - (1 if i < -1 else 0), "k")
    elif P["eye"] in ("angry", "hurt"):
        for i in range(-3, 4):
            c.p(x + i, y - 4 + (i + 3) // 2, "k")
    elif P["eye"] in ("curious", "surprise"):
        for i in range(-2, 3):
            c.p(x + i, y - 5 + abs(i) // 2, "k")


def hat(c, hx, hy, P):
    if P["hat"] == "off":
        return
    ang = P["hatang"] + P["tilt"] * 0.7
    cx, cy = rot(hx - 1 + P["hatdx"], hy - 7.6 + P["hatdy"], hx, hy, P["tilt"])
    # sugegasa : un grand cône de paille tressée, bien trop grand pour lui,
    # posé de travers ; la même paille sèche que les WARA
    w2, h = 14.0, 7.0

    def inside(x, y):
        dx, dy = x - cx, y - cy
        u = dx * math.cos(-ang) - dy * math.sin(-ang)
        v = dx * math.sin(-ang) + dy * math.cos(-ang)
        if v > 1.4 or v < -h:
            return None
        half = w2 * (v + h) / (h + 1.4) if v < 0 else w2 + 0.4
        if v > 0.3 and abs(u) > w2 - 0.5 - h01(int(u), 5) * 1.5:
            return None                                       # le bord, effiloché
        return (u, v) if abs(u) <= half else None

    def col(x, y, q):
        u, v = q
        if v > 0.35:
            return "t" if abs(u) > w2 - 2 else "h"           # dessous du rebord, dans l'ombre
        # brins qui rayonnent de la pointe, recoupés par les rangs de tressage
        r = math.atan2(u, v + h + 0.01)
        strand = int(r * 9 + 20) % 2
        ring = int((v + h) * 1.05) % 2
        lt = 0.56 - u * 0.025 - (v + h) * 0.025 + (0.24 if strand == ring else -0.1)
        if int(v + h) % 3 == 2 and int(u * 2) % 3 == 0:
            lt -= 0.25                                       # mailles plus sombres : la tresse se lit
        return "hHyY"[max(0, min(3, int(lt * 4)))]
    c.shape(inside, col, (cx - 18, cy - 12, cx + 18, cy + 5))
    tx, ty = rot(cx, cy - h - 0.4, cx, cy, ang)
    c.p(tx, ty, "Y")                                          # le nœud de la pointe
    c.p(tx, ty - 1, "y")
    # brins irréguliers qui dépassent du bord, comme sur les chapeaux des WARA
    for k, (dx, dy, L) in enumerate(((-14.6, 1.2, 3), (14.4, 0.8, 2), (-9, 1.6, 2), (6, 1.8, 3), (11.5, 1.5, 1))):
        for j in range(L):
            x, y = rot(cx + dx + (-j * 0.7 if dx < 0 else j * 0.7), cy + dy + j * 0.8, cx, cy, ang)
            c.p(x, y, "y" if j % 2 else "H")
    # la cordelette : un nœud au rebord
    kx, ky = rot(cx - 3, cy + 1.2, cx, cy, ang)
    c.p(kx, ky, "c"); c.p(kx + 1, ky, "c")


def effects(c, P, hx, hy):
    fx = P["fx"]
    if "stars" in fx:
        k = P.get("starphase", 0)
        for i in range(3):
            a = k + i * 2.1
            x, y = hx + math.cos(a) * 12, hy - 12 + math.sin(a) * 3.5
            c.p(x, y, "o")
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c.p(x + dx, y + dy, "u" if (i + dx) % 2 else "o")
    if "feathers" in fx:
        for i in range(5):
            x = hx - 30 + h01(i, 3) * 50
            y = hy - 6 + h01(i, 4) * 40
            a = h01(i, 5) * 3
            for j in range(4):
                c.p(x + math.cos(a) * j, y + math.sin(a) * j, "F" if j == 0 else "f")
    if "hatbelly" in fx:                                  # le chapeau a atterri sur son ventre
        q = Canvas()
        hat(q, P["bx"] + 2, P["by"] - 4, dict(P, hat="askew", hatdx=0, hatdy=0, hatang=0.35, tilt=0.0))
        q.outline()
        m = q.g != "."
        c.g[m] = q.g[m]
    if "dust" in fx:
        for i in range(16):
            x = FX - 30 + h01(i, 6) * 64
            y = FY - h01(i, 7) * 8
            c.p(x, y, "D" if i % 3 else "d")
            c.p(x + 1, y, "d")
    if "straw" in fx:
        for i in range(6):
            x = FX - 24 + h01(i, 8) * 50
            y = FY - 30 + h01(i, 9) * 30
            line(c, x, y, x + 3 * math.cos(i), y + 2 * math.sin(i), "G" if i % 2 else "g")


# ---------------------------------------------------------------------------
# poses de la planche
# ---------------------------------------------------------------------------
POSES = {
    "idle": dict(),
    "croak": dict(tilt=-0.35, beak=1.0, eye="angry", hatdy=-1, hatang=-0.45),
    "curious": dict(tilt=0.45, eye="curious", hatang=-0.12),
    "flight_up": dict(bx=48, by=48, bang=-0.12, headpos="front", wings="spread", wing=-1.85, legs="tuck", eye="angry", tail=0.15, hatang=-0.5, hatdy=-1),
    "flight_mid": dict(bx=48, by=47, bang=-0.08, headpos="front", wings="spread", wing=-2.55, legs="tuck", eye="smug", tail=0.08, hatang=-0.38),
    "flight_down": dict(bx=48, by=44, bang=-0.02, headpos="front", wings="spread", wing=2.35, legs="tuck", eye="angry", tail=0.0, hatang=-0.25, hatdy=1),
    "dive": dict(bx=44, by=40, bang=0.62, headpos="front", wings="tucked", legs="grab", eye="glare", beak=0.25, tail=0.12, hatdy=2, hatdx=-3, hatang=-0.9),
    "takeoff": dict(bx=45, by=52, bang=-0.75, wings="spread", wing=-1.75, eye="angry", beak=0.3, hatdy=-2, hatang=-0.55, fx=("straw",)),
    "stunned": dict(bx=42, by=45, bang=1.0, headpos="front", hdy=0, wings="droop", wing=2.5, legs="splay", eye="dizzy", tilt=0.9, hat="askew", hatdx=-5, hatdy=-2, hatang=-1.3, fx=("stars", "dust")),
    "hurt": dict(bx=42, bang=-0.45, tilt=-0.5, eye="hurt", beak=0.6, puff=1.5, hatdy=-5, hatang=-0.95, fx=("feathers",)),
    "defeated": dict(bx=40, by=60, bang=-1.25, wings="droop", wing=2.55, legs="sit", eye="ko", tilt=-0.75, beak=0.8, hat="askew", hatdx=4, hatdy=5, hatang=0.55, puff=0.8, fx=("feathers", "dust")),
}


def pose(name):
    return crow(**POSES[name])


if __name__ == "__main__":
    import sys
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else "karasu_test.png"
    names = list(POSES)
    Z = 4
    sheet = Image.new("RGBA", (W * Z * 5, H * Z * 2), (139, 152, 168, 255))
    for k, n in enumerate(names):
        g = pose(n)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        px = im.load()
        for y in range(H):
            for x in range(W):
                ch = g[y, x]
                if ch != ".":
                    hx = PAL[ch].lstrip("#")
                    px[x, y] = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
        sheet.alpha_composite(im.resize((W * Z, H * Z), Image.NEAREST), ((k % 5) * W * Z, (k // 5) * H * Z))
    sheet.save(out)
    print(out)


# ---------------------------------------------------------------------------
# l'épouvantail géant : le perchoir de Karasu-Kashi (fait partie du combat)
# ---------------------------------------------------------------------------
PAL.update({
    "1": "#24180f", "2": "#3f2b1a", "3": "#614329", "4": "#8a6540", "5": "#b08654",   # bois ancien
    "6": "#4c6626", "7": "#77933a", "8": "#a9c062",                                   # bambou
    "9": "#7d6232", "0": "#ad8c4c", "+": "#d4b56e", "=": "#ecd79a",                   # paille dorée
    "-": "#4f3b22", "~": "#86704a",                                                   # corde de chanvre
    "!": "#2f3a58", "?": "#4b5a82", "&": "#7a2e2a", "^": "#a5463a",                   # tissus : indigo délavé, rouge
    "%": "#6f737b", "$": "#b9bec6", "@": "#8a6a2a", "#": "#c08a3a",                   # métal de la faucille, gourde
})
SW, SH = 120, 140
SGROUND = 136


def scarecrow(sway=0.0):
    """L'épouvantail géant, vu de face. sway : oscillation (-1 à 1) quand le corbeau
    décolle ou se pose : tout ce qui est au-dessus du sol penche un peu."""
    c = Canvas(SW, SH)

    def lean(y):                                       # décalage horizontal selon la hauteur
        return sway * (SGROUND - y) / SGROUND * 4

    def wood(x, y, q, base=0.5):
        g = h01(int(x) // 2, int(y) // 5, 7)
        v = base + (g - 0.5) * 0.3 + (0.12 if int(x) % 4 == 0 else 0)
        if h01(int(x), int(y) // 3, 9) > 0.93:
            v -= 0.3                                    # nœuds, fentes
        return "12345"[max(0, min(4, int(v * 5)))]

    # tuteurs de bambou qui se croisent derrière
    for (x0, y0, x1, y1) in ((28, SGROUND, 62, 36), (94, SGROUND, 52, 70)):
        n = int(math.hypot(x1 - x0, y1 - y0))
        for i in range(n):
            t = i / n
            x, y = x0 + (x1 - x0) * t + lean(y0 + (y1 - y0) * t), y0 + (y1 - y0) * t
            node = i % 13 == 0
            c.p(x, y, "6" if not node else "8"); c.p(x + 1, y, "7" if not node else "8"); c.p(x + 2, y, "6")
    # le poteau central, noueux et un peu tordu
    for y in range(26, SGROUND + 1):
        cx = 58 + math.sin(y * 0.06) * 2 + lean(y)
        w = 4.5 + (SGROUND - y) * -0.012 + (1 if 90 < y < 98 else 0)
        for x in range(int(cx - w), int(cx + w) + 1):
            u = (x - cx) / w
            c.p(x, y, wood(x, y, None, 0.55 - u * 0.25))
    # le sommet : un perchoir aplati, entouré de corde
    for x in range(52, 66):
        c.p(x + lean(26), 25, "4"); c.p(x + lean(26), 26, "3")
    for y in range(28, 33):
        for x in range(53, 64):
            c.p(x + lean(y), y, "-" if (x + y) % 2 else "~")
    # deux grands bras, asymétriques : le gauche long et affaissé, le droit relevé et fourchu
    def branch(x0, y0, x1, y1, w0, w1, sag):
        n = int(abs(x1 - x0))
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            yc = y0 + (y1 - y0) * t + sag * math.sin(t * math.pi)
            w = w0 + (w1 - w0) * t
            for dy in range(-int(w), int(w) + 1):
                c.p(x + lean(yc), yc + dy, wood(x, yc + dy, None, 0.58 - dy / max(1, w) * 0.28))
    branch(56, 58, 4, 66, 3.2, 1.6, 5)
    branch(60, 54, 112, 48, 3.0, 1.4, -3)
    branch(98, 50, 110, 40, 1.2, 0.8, 0)                # la fourche
    for (x, y, dx, dy) in ((22, 64, -2, -5), (36, 63, 1, -6), (84, 52, 2, -5)):   # petits rameaux
        line(c, x + lean(y), y, x + dx + lean(y), y + dy, "3")
    def sheaf(cx, y0, y1, top, bot, seed, ties=()):
        """Une gerbe de paille : brins verticaux serrés, silhouette qui s'évase et
        s'effiloche, liée de cordes ; ombrée à droite, éclairée à gauche."""
        for y in range(y0, y1):
            t = (y - y0) / max(1, y1 - y0)
            half = top + (bot - top) * t ** 1.3 + (math.sin(y * 0.9 + seed) * 0.8)
            for x in range(int(cx - half - 1), int(cx + half + 2)):
                u = (x - cx) / max(1, half)
                if abs(u) > 1.0 + h01(x, y // 2, seed) * 0.25:
                    continue                                  # bord irrégulier, brins qui dépassent
                strand = h01(x, seed, 3)                      # chaque colonne = un brin
                v = 0.68 - u * 0.3 + (strand - 0.5) * 0.35 - t * 0.08
                if (y + int(strand * 7)) % 9 == 0:
                    v -= 0.25                                 # petites cassures du brin
                c.p(x + lean(y), y, "90+="[max(0, min(3, int(v * 4)))])
        for k in range(int(bot * 1.6)):                       # brins qui pendent sous la gerbe
            x = cx - bot + k * 1.25 + h01(k, seed) * 1.5
            for j in range(2 + int(h01(k, seed, 5) * 6)):
                c.p(x + lean(y1) + (j // 3) * (1 if k % 2 else -1), y1 + j, "0" if j % 2 else "9")
        for yb in ties:                                       # liens : la corde serre et creuse la gerbe
            t = (yb - y0) / max(1, y1 - y0)
            half = top + (bot - top) * t ** 1.3
            for x in range(int(cx - half), int(cx + half) + 1):
                c.p(x + lean(yb), yb, "-" if x % 2 else "~")
                c.p(x + lean(yb), yb + 1, "-")
            c.p(cx - half - 1 + lean(yb), yb + 2, "~"); c.p(cx - half - 1 + lean(yb), yb + 3, "-")   # bout de corde
    sheaf(58, 58, 104, 12, 19, 1, ties=(66, 90))
    sheaf(10, 64, 84, 3, 8, 2, ties=(66,))                # gerbes nouées aux bouts des bras, qui pendent
    sheaf(104, 49, 64, 3, 6, 3, ties=(51,))
    # cordes de chanvre : la ligature en croix au carrefour des bras, une boucle qui pend
    for k in range(-6, 7):
        c.p(58 + k + lean(56), 52 + k * 0.6, "~" if k % 2 else "-")
        c.p(58 + k + lean(56), 60 - k * 0.6, "-" if k % 2 else "~")
    for t in range(18):
        a = t / 17 * math.pi
        c.p(80 + math.cos(a) * 5 + lean(60), 53 + math.sin(a) * 9, "~" if t % 2 else "-")
    # le vieux haori indigo délavé jeté sur le bras gauche, bord en lambeaux
    for y in range(64, 96):
        x0 = 18 + (y - 64) * 0.15
        x1 = 40 - (y - 64) * 0.25
        for x in range(int(x0), int(x1) + 1):
            if y > 88 and (x + y) % 3 == 0:
                continue
            fold = (x - 18) % 7 == 0
            v = "!" if fold or x > x1 - 2 else "?"
            if (x * 7 + y * 3) % 23 == 0:
                v = "!"
            c.p(x + lean(y), y, v)
    # un pan de tissu rouge noué au bras droit, qui flotte
    for j in range(12):
        for i in range(3):
            c.p(90 + i + j * 0.4 + lean(55), 55 + j, "&" if i else "^")
    # décorations agricoles : une faucille et une gourde suspendues
    line(c, 72 + lean(54), 55, 72 + lean(54), 66, "-")
    for t in range(9):
        a = math.pi * 0.2 + t / 8 * math.pi * 0.9
        c.p(72 + math.cos(a) * 5 + lean(70), 70 + math.sin(a) * 4, "$" if t < 6 else "%")
    c.p(72 + lean(68), 67, "3"); c.p(72 + lean(68), 68, "3")
    line(c, 28 + lean(65), 66, 28 + lean(65), 72, "-")
    for y in range(73, 84):
        r = 2.6 if y < 77 else 4.0 - abs(y - 80) * 0.25
        for x in range(int(28 - r), int(28 + r) + 1):
            c.p(x + lean(y), y, "#" if x < 28 else "@")
    c.outline()
    return c.g


# ---------------------------------------------------------------------------
# projectiles
# ---------------------------------------------------------------------------
def acorn(spin=0):
    """Gland piquant : chapeau à écailles, épines. 12x12."""
    c = Canvas(12, 12)
    ellipse(c, 6, 7.2, 3.6, 3.8, 0.0, lambda x, y, q: "5" if q[0] < -0.2 else "4" if q[1] < 0.3 else "3")
    for x in range(2, 10):                                # la cupule à écailles
        for y in (3, 4):
            c.p(x, y, "2" if (x + y) % 2 else "3")
    c.p(6, 2, "2"); c.p(6, 1, "1")
    for k in range(6):                                    # épines
        a = spin + k * math.pi / 3
        c.p(6 + math.cos(a) * 5, 7 + math.sin(a) * 5, "$")
    c.outline()
    return c.g


def turnip(lit=0):
    """Navet explosif : racine blanche et violette, fanes, mèche de talisman qui crépite."""
    c = Canvas(14, 18)
    ellipse(c, 7, 11, 4.5, 4.8, 0.0, lambda x, y, q: "w" if q[1] > -0.2 and q[0] < 0.4 else "W" if q[1] > -0.2 else "x" if q[1] < -0.55 else "^")
    line(c, 7, 15, 7, 17, "W")
    for dx in (-2, 0, 2):                                 # fanes
        line(c, 7, 6, 7 + dx * 1.5, 1, "7")
        c.p(7 + dx * 1.5, 1, "8")
    for j in range(3):                                    # la mèche : un talisman roulé
        c.p(10 + j, 7 - j, "w")
    c.p(13, 4, "o" if lit else "u")
    c.outline()
    return c.g


# ---------------------------------------------------------------------------
# la grande porte du temple : fermée par un talisman tant que le corbeau règne
# (elle sera peinte dans le décor du Potager ; ici, le concept)
# ---------------------------------------------------------------------------
PAL.update({
    "(": "#3a3d46", ")": "#5a5e69", "[": "#7d828e", "]": "#a7acb6",     # tuiles grises
    "{": "#5a1f1a", "}": "#8a2f25", "<": "#b2442f", ">": "#d0664a",     # bois laqué vermillon
    "|": "#2a2018", "/": "#4a3826", "\\": "#6d5338",                    # vantaux : bois sombre
    ":": "#c9a24a", ";": "#f0d27a",                                     # ferrures dorées
    "_": "#bfc4cc", ",": "#e6dcc0", "'": "#fff2c8",                     # pierre, lumière du passage
})
GW, GH = 120, 132


def gate(opened=0.0):
    """La porte du temple, vue de face. opened : 0 fermée, 1 grande ouverte."""
    c = Canvas(GW, GH)
    # le seuil de pierre
    for y in range(124, 131):
        for x in range(8, 112):
            c.p(x, y, "_" if (x // 9 + y) % 7 else "[")
    # le passage (visible quand les vantaux s'ouvrent) : la lumière du chemin
    for y in range(32, 124):
        for x in range(24, 96):
            t = (y - 32) / 92
            c.p(x, y, "'" if t < 0.45 else "," if t < 0.8 else "_")
    # les vantaux : ils pivotent vers l'intérieur et s'amincissent
    leaf = 36 * (1 - opened * 0.82)
    for side in (-1, 1):
        x0 = 24 if side < 0 else 96 - leaf
        for y in range(32, 124):
            for i in range(int(leaf)):
                x = x0 + i
                plank = (i * 36 // max(1, int(leaf))) // 6
                v = "/" if (plank + (side > 0)) % 2 else "\\"
                if (i * 36 // max(1, int(leaf))) % 6 == 0:
                    v = "|"
                c.p(x, y, v)
            for yy in (44, 76, 108):                    # pentures et clous dorés
                for i in range(int(leaf)):
                    c.p(x0 + i, yy, ":" if i % 4 else ";")
        if opened < 0.4:                                  # anneaux de bronze
            cx = 56 if side < 0 else 63
            for a in range(10):
                c.p(cx + math.cos(a * 0.63) * 2.5, 82 + math.sin(a * 0.63) * 2.5, ":")
    # le talisman qui scelle les deux vantaux (déchiré quand la porte s'ouvre)
    if opened < 0.05:
        for y in range(54, 96):
            for x in range(55, 65):
                c.p(x, y, "w" if (x + y) % 9 else "W")
        for y in range(58, 92, 5):
            line(c, 57, y, 62, y + 2, "x")
        for x in range(26, 94):                           # la corde sacrée tendue en travers
            c.p(x, 50 + math.sin((x - 26) / 68 * math.pi) * 4, "~" if x % 2 else "-")
    # piliers vermillon et linteaux
    for x0 in (12, 96):
        for y in range(22, 124):
            for x in range(x0, x0 + 12):
                u = (x - x0) / 12
                c.p(x, y, "{" if u > 0.8 else ">" if u < 0.18 else "<" if u < 0.5 else "}")
        for y in range(118, 124):
            for x in range(x0 - 1, x0 + 13):
                c.p(x, y, ")")
    for y in range(24, 32):                               # nuki (traverse)
        for x in range(6, 114):
            c.p(x, y, "<" if y < 26 else "}" if y < 30 else "{")
    # le grand toit de tuiles, bords relevés
    for j in range(16):
        half = 52 + j * 0.9 + (j > 12) * (j - 12) * 2.5
        y = 7 + j
        for x in range(int(60 - half), int(60 + half)):
            v = "(" if j == 15 else "]" if x % 4 == 0 else "[" if j < 6 else ")"
            c.p(x, y, v)
    for x in range(30, 90):
        c.p(x, 5, "("); c.p(x, 6, ")")                    # le faîtage
    for dx in (-60, 59):                                  # les coins relevés
        c.p(60 + dx, 20, ")"); c.p(60 + dx + (1 if dx > 0 else -1), 19, "]")
    # la plaque du nom, au centre
    for y in range(10, 18):
        for x in range(54, 66):
            c.p(x, y, ";" if y in (10, 17) or x in (54, 65) else "|")
    c.p(59, 12, ":"); c.p(60, 14, ":"); c.p(59, 15, ":")
    c.outline()
    return c.g


# ---------------------------------------------------------------------------
# images du jeu (dans l'ordre de la feuille) ; les plumes, la poussière, les
# épines et la terre sont des particules en jeu, pas des pixels figés ici
# ---------------------------------------------------------------------------
def _p(name, clip=False, **kw):
    base = dict(POSES[name]) if name else {}
    base.update(kw)
    base["fx"] = tuple(f for f in base.get("fx", ()) if f in ("stars",))

    def make():
        g = crow(**base)
        if clip:                                         # planté dans la terre : coupé net à la surface du sol
            g[FY + 1:, :] = "."
            for _ in range(2):                           # les bouts coupés qui restent seuls disparaissent
                solid = (g != ".") & (g != "O") & ~np.isin(g, list(NO_OUTLINE))
                pad = np.pad(solid, 1)
                n = sum(pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
                g[solid & (n == 0)] = "."
            # un contour orphelin (sans pixel plein à côté) disparaît aussi
            solid = (g != ".") & (g != "O")
            pad = np.pad(solid, 1)
            n = sum(pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
            g[(g == "O") & (n == 0)] = "."
        return g
    return make


GAME_FRAMES = [
    # perché : il respire, cligne, toise KAGE
    ("idle_1", _p("idle")),
    ("idle_2", _p("idle", puff=0.5)),
    ("idle_3", _p("idle", puff=0.5, eye="closed")),
    ("look_1", _p("curious")),
    ("look_2", _p("curious", tilt=0.6, hatang=0.0)),
    ("hatfix_1", _p("idle", tilt=-0.15, hatdy=-3, hatang=0.15, eye="closed")),
    ("hatfix_2", _p("idle", tilt=0.05, hatdy=-1, hatang=-0.05)),
    ("croak_1", _p("croak", beak=0.5)),
    ("croak_2", _p("croak")),
    # envol, vol, largage
    ("takeoff_1", _p("idle", puff=0.6, eye="angry", wings="spread", wing=-2.15, hatang=-0.3)),
    ("takeoff_2", _p("takeoff")),
    ("fly_1", _p("flight_up")),
    ("fly_2", _p("flight_mid")),
    ("fly_3", _p("flight_down")),
    ("drop_1", _p("flight_mid", bang=0.2, legs="grab", beak=0.4, eye="smug")),
    ("drop_2", _p("flight_down", bang=0.25, legs="grab", beak=0.8, eye="angry")),
    # il vise, il plonge
    ("aim_1", _p("flight_mid", eye="glare", wing=-2.15, bang=0.2)),
    ("aim_2", _p("flight_up", eye="glare", wing=-1.6, bang=0.3, beak=0.2)),
    ("dive_1", _p("dive")),
    ("dive_2", _p("dive", beak=0.5, hatdy=3)),
    # écrasé, coincé, étourdi, touché
    ("crash", _p("stunned", clip=True, eye="surprise", puff=1.4, hatdy=-6, hatang=-1.6)),
    ("stuck_1", _p("stunned", clip=True, eye="dizzy", starphase=0.0)),
    ("stuck_2", _p("stunned", clip=True, eye="dizzy2", starphase=1.0)),
    ("stuck_hit", _p("stunned", clip=True, eye="hurt", puff=1.0, tilt=0.75, fx=())),
    ("hurt", _p("hurt", fx=())),
    # il s'ébroue, replace son chapeau, repart
    ("shake_1", _p("idle", puff=2.2, eye="closed", tilt=0.35, hatdy=-3, hatang=0.25)),
    ("shake_2", _p("idle", puff=1.6, eye="closed", tilt=-0.3, hatdy=-2, hatang=-0.6)),
    ("shake_3", _p("idle", eye="smug", hatang=-0.17)),
    # défaite
    ("defeat_1", _p("hurt", eye="surprise", beak=1.0, hatdy=-8, hatang=-1.2, fx=())),
    ("defeat_2", _p("defeated", clip=True, bang=-0.95, by=58, tilt=-0.4, hatdy=-2, fx=())),
    ("defeat_3", _p("defeated", clip=True, fx=())),
]

PERCH_FRAMES = [(f"perch_{i}", (lambda s: (lambda: scarecrow(s)))(s)) for i, s in enumerate((-1.0, -0.5, 0.0, 0.5, 1.0))]
ITEM_FRAMES = [
    ("acorn_1", lambda: acorn(0.0)), ("acorn_2", lambda: acorn(0.5)),
    ("turnip_1", lambda: turnip(0)), ("turnip_2", lambda: turnip(1)),
]
