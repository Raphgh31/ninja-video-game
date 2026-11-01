"""Carte schématique du monde (vue de côté) : python3 tools/monde_carte.py

Sortie : docs/monde/carte_du_monde.png. Schéma de conception, pas un décor de jeu.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/monde"
PAPER = (226, 222, 212)
INK = (24, 26, 32)
GREY = (90, 90, 96)
RED = (168, 67, 58)

ZONES = [
    # nom, ennemi(s), cabane du marchand (téléportation), couleur du ciel, couleur du sol, hauteurs du relief (0..1)
    ("1 · Le potager", "WARA, TATE, petit nuisible", "comptoir du voyageur", (200, 212, 220), (150, 120, 80),
     [0.16, 0.16, 0.2, 0.18, 0.24, 0.22]),
    ("2 · Le champ des bambous", "à concevoir", "au bord des rizières", (196, 214, 196), (120, 150, 92),
     [0.22, 0.26, 0.24, 0.3, 0.28, 0.32]),
    ("3 · La forêt des grands arbres", "Kage-mane (piste)", "dans une clairière", (160, 184, 164), (78, 104, 72),
     [0.32, 0.42, 0.36, 0.48, 0.42, 0.46]),
    ("4 · Le village des basses montagnes", "Chōchin (piste)", "au marché", (178, 176, 196), (110, 92, 84),
     [0.46, 0.44, 0.5, 0.48, 0.54, 0.52]),
    ("5 · Les hautes montagnes", "Karasu (piste)", "dans un refuge", (210, 218, 228), (232, 236, 240),
     [0.52, 0.62, 0.7, 0.78, 0.86, 0.9]),
    ("6 · Le temple de pierre", "Ishi (piste)", "devant le temple", (150, 146, 136), (118, 120, 110),
     [0.9, 0.86, 0.88, 0.84, 0.84, 0.82]),
    ("7 · Le dojo final", "l'épreuve ultime", "à la porte du dojo", (120, 96, 92), (90, 70, 58),
     [0.82, 0.82, 0.86, 0.86, 0.9, 0.9]),
]


def font(size, bold=True):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    p = Path("/usr/share/fonts/truetype/dejavu") / name
    return ImageFont.truetype(str(p), size) if p.exists() else ImageFont.load_default()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    W, H = 2560, 860
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((40, 26), "KAGE — le monde, vu de côté", fill=INK, font=font(30))
    d.text((40, 70), "Un seul monde continu, d'ouest en est · ● lanterne (sauvegarde)   "
                     "┄ chemin de défi / secret (ryō)   ★ épreuve finale", fill=GREY, font=font(15))
    x0, top, bottom = 40, 120, 640
    zw = (W - 80) // len(ZONES)
    hmax = bottom - top - 120
    prev_y = None
    for i, (name, foes, upgrade, sky, ground, hs) in enumerate(ZONES):
        zx = x0 + i * zw
        d.rectangle([zx, top, zx + zw - 1, bottom], fill=sky)
        # relief : lignes brisées de la hauteur du sol
        pts = []
        n = len(hs)
        for k, h in enumerate(hs):
            x = zx + round(k * zw / (n - 1))
            y = bottom - 40 - round(h * hmax)
            pts.append((x, y))
        if prev_y is not None:
            pts[0] = (pts[0][0], prev_y)
        prev_y = pts[-1][1]
        steps = []
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):      # en marches d'escalier, façon plateformes
            mx = (ax + bx) // 2
            steps += [(ax, ay), (mx, ay), (mx, by)]
        steps.append(pts[-1])
        d.polygon(steps + [(zx + zw - 1, bottom), (zx, bottom)], fill=ground)
        d.line(steps, fill=INK, width=3)
        # lanternes : une par passage
        for k in range(1, n - 1):
            x, y = pts[k]
            mx = (pts[k][0] + pts[k + 1][0]) // 2 - 18
            d.ellipse([mx - 7, y - 24, mx + 7, y - 10], fill=(240, 194, 90), outline=INK, width=2)
        # passage secret : une branche en pointillés au-dessus du chemin
        sx, sy = pts[2]
        for j in range(0, zw // 2 - 20, 14):
            d.line([(sx + j, sy - 70), (sx + j + 7, sy - 70)], fill=INK, width=2)
        d.line([(sx, sy - 10), (sx, sy - 70)], fill=INK, width=1)
        # épreuve finale
        fx, fy = pts[-1]
        d.text((fx - 34, fy - 52), "★", fill=RED, font=font(30))
        # séparation et étiquettes
        if i:
            d.line([(zx, top), (zx, bottom)], fill=PAPER, width=4)
        ty = bottom + 20
        d.text((zx + 8, ty), name, fill=INK, font=font(16))
        d.text((zx + 8, ty + 34), f"Ennemis : {foes}", fill=INK, font=font(15, bold=False))
        d.text((zx + 8, ty + 60), "Cabane du marchand (téléportation) :", fill=GREY, font=font(13, bold=False))
        d.text((zx + 8, ty + 80), upgrade, fill=RED, font=font(16))
    # KAGE au départ, flèche de progression
    d.text((x0 + 10, top + 12), "départ →", fill=INK, font=font(16))
    d.line([(x0 + 10, bottom + 150), (W - 60, bottom + 150)], fill=INK, width=3)
    d.polygon([(W - 60, bottom + 142), (W - 44, bottom + 150), (W - 60, bottom + 158)], fill=INK)
    d.text((x0 + 10, bottom + 160), "la difficulté monte d'un chapitre à l'autre · environ 20 min par chapitre · retour en arrière libre",
           fill=GREY, font=font(14, bold=False))
    im.save(OUT / "carte_du_monde.png")
    print(OUT / "carte_du_monde.png")


if __name__ == "__main__":
    main()
