"""Planches de présentation de WARA : python3 tools/kage_forge/enemies/wara_board.py

Sorties (docs/enemies/) :
  wara_design.png      concept : anatomie annotée, histoire, échelle, palette
  wara_poses.png       toutes les poses, rangées par animation
  wara_gameplay.png    comportement et façons de le vaincre (mise en scène avec KAGE)
  wara_animations.gif  les animations en boucle, côte à côte
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import tate  # noqa: E402
import wara  # noqa: E402
from wara import H, PAL, POSES, W  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "docs/enemies"
PAPER = (226, 222, 212)
BG = (139, 152, 168)
INK = (24, 26, 32)
GREY = (80, 80, 86)
RED = (168, 67, 58)
GREEN = (78, 128, 82)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def img(grid, pal=PAL):
    im = Image.new("RGBA", (grid.shape[1], grid.shape[0]), (0, 0, 0, 0))
    px = im.load()
    for y in range(grid.shape[0]):
        for x in range(grid.shape[1]):
            c = grid[y, x]
            if c != ".":
                px[x, y] = rgb(pal[c]) + (255,)
    return im


def font(size, bold=True):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    p = Path("/usr/share/fonts/truetype/dejavu") / name
    return ImageFont.truetype(str(p), size) if p.exists() else ImageFont.load_default()


def kage(anim, i=0):
    sheet = Image.open(ROOT / f"assets/characters/kage/anims/kage_{anim}.png").convert("RGBA")
    return sheet.crop((i * 48, 0, i * 48 + 48, 32))


def big(im, z):
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def wrap(d, text, xy, width, f, fill=INK, gap=4):
    """Texte justifié à gauche, coupé à la largeur donnée ; renvoie le y suivant."""
    x, y = xy
    for para in text.split("\n"):
        line = ""
        for word in para.split(" "):
            test = (line + " " + word).strip()
            if d.textlength(test, font=f) > width and line:
                d.text((x, y), line, fill=fill, font=f)
                y += f.size + gap
                line = word
            else:
                line = test
        d.text((x, y), line, fill=fill, font=f)
        y += f.size + gap
    return y


# ---------------------------------------------------------------------------
# 1. concept
# ---------------------------------------------------------------------------
def design_board():
    Z = 12
    BW, BH = 1500, 870
    board = Image.new("RGB", (BW, BH), PAPER)
    d = ImageDraw.Draw(board)
    d.text((40, 28), "WARA — pantin de paille du dojo", fill=INK, font=font(32))
    d.text((40, 74), "Proposition de design · ennemi de base, mignon et un peu ridicule · cellule 48×32 comme KAGE · 2 points de vie",
           fill=GREY, font=font(15))

    # héros, recadré sur la silhouette
    hero = img(POSES["repos_1"]).crop((0, 2, 34, 32))
    hx, hy = 40, 120
    d.rectangle([hx, hy, hx + hero.width * Z - 1, hy + hero.height * Z - 1], fill=BG)
    b = big(hero, Z)
    board.paste(b, (hx, hy), b)

    # annotations : (point visé en pixels de la cellule, libellé)
    notes = [
        ((17, 7), "Chignon de paille : il trahit ses humeurs. Dressé tout droit, il va attaquer ; en vrille, il a le tournis"),
        ((15, 14), "Pas de visage : une grosse tête ronde en toile, cousue sur la paille"),
        ((14, 18), "Cou et taille serrés de cordes torsadées"),
        ((23, 20), "Bras : bottes de paille liées aux poignets, qui ballottent comme ceux d'un pantin"),
        ((18, 21), "Le talisman cloué sur la poitrine : c'est lui qui l'a réveillé"),
        ((11, 26), "Petite jupe de paille en cloche"),
        ((16, 29), "Pieu court à virole de fer : il avance en sautillant"),
    ]
    lx = hx + hero.width * Z + 60
    ly = hy + 6
    f = font(15, bold=False)
    for i, ((px, py), label) in enumerate(notes):
        ax = hx + px * Z + Z // 2
        ay = hy + (py - 2) * Z + Z // 2
        ty = ly + i * 52
        d.line([(ax, ay), (lx - 46, ty + 9), (lx - 12, ty + 9)], fill=INK, width=2)
        d.ellipse([ax - 5, ay - 5, ax + 5, ay + 5], outline=INK, width=2)
        d.text((lx - 8, ty), f"{i + 1}", fill=RED, font=font(16))
        wrap(d, label, (lx + 14, ty), 380, f)

    # histoire et rôle
    tx = lx + 440
    y = hy
    d.text((tx, y), "Histoire", fill=INK, font=font(18))
    y = wrap(d, "Les petits mannequins d'entraînement du dojo. Un talisman cloué sur leur poitrine les a "
                "réveillés : ils sautillent partout sur leur pieu et veulent jouer à la bagarre, sans trop savoir "
                "comment. Plus gênants que dangereux. Une fois battus, le talisman s'envole et ils redeviennent "
                "de simples mannequins.", (tx, y + 30), 400, f)
    y += 18
    d.text((tx, y), "Rôle en jeu", fill=INK, font=font(18))
    y = wrap(d, "L'ennemi le plus courant, en groupes de 2 ou 3 entre deux TATE. Il apprend le sabre et le bon "
                "moment pour frapper.", (tx, y + 30), 400, f)
    y += 18
    d.text((tx, y), "L'inverse de TATE", fill=INK, font=font(18))
    wrap(d, "TATE bloque tout de face : il faut passer dans son dos.\nWARA mouline des bras tout autour "
            "de lui : son dos n'est pas une faille. Il faut attendre la fin de son moulinet, quand il a le "
            "tournis, puis frapper.", (tx, y + 30), 400, f)

    # échelle : KAGE, WARA, TATE
    y0 = hy + hero.height * Z + 50
    d.text((40, y0), "Échelle : KAGE, WARA, TATE", fill=INK, font=font(16))
    row = Image.new("RGBA", (150, 32), BG + (255,))
    k = kage("idle")
    row.paste(k, (2, 0), k)
    w = img(POSES["repos_1"]).transpose(Image.FLIP_LEFT_RIGHT)
    row.paste(w, (44, 0), w)
    t = img(tate.POSES["marche_1"], tate.PAL).transpose(Image.FLIP_LEFT_RIGHT)
    row.paste(t, (96, 0), t)
    board.paste(big(row, 4), (40, y0 + 30))
    d.text((40 + 600 + 30, y0 + 30), "taille réelle ×2", fill=GREY, font=font(13))
    board.paste(big(row, 2), (40 + 600 + 30, y0 + 52))
    d.text((40 + 600 + 30, y0 + 130), "taille réelle", fill=GREY, font=font(13))
    board.paste(row, (40 + 600 + 30, y0 + 150))

    # palette
    px0 = 1000
    d.text((px0, y0), "Palette", fill=INK, font=font(16))
    groups = [("paille", "tTuU"), ("corde", "rR"), ("toile", "cC"), ("bois", "wW"),
              ("fer", "nNI"), ("papier", "pPe"), ("effets", "fFgGxXsa")]
    yy = y0 + 30
    for name, keys in groups:
        d.text((px0, yy + 6), name, fill=GREY, font=font(13, bold=False))
        for j, c in enumerate(keys):
            x = px0 + 80 + j * 34
            d.rectangle([x, yy, x + 26, yy + 26], fill=rgb(PAL[c]), outline=(60, 60, 60))
        yy += 34
    board.save(OUT / "wara_design.png")


# ---------------------------------------------------------------------------
# 2. poses
# ---------------------------------------------------------------------------
ROWS = [
    ("REPOS", "il se dandine, bras ballants, 2 × 0,35 s", [("repos_1", "1"), ("repos_2", "2")]),
    ("BOND", "il sautille, ~0,6 s par bond", [("bond_1_tasse", "1 · se ratatine"), ("bond_2_envol", "2 · raide comme un crayon"),
                                             ("bond_3_sommet", "3 · youpi !"), ("bond_4_atterrit", "4 · en accordéon")]),
    ("MOULINET", "attaque, touche des deux côtés", [("moulinet_1_elan", "1 · chignon dressé (signal)"),
                                                    ("moulinet_2", "2 · bras en hélice"), ("moulinet_3", "3 · de dos")]),
    ("VERTIGE", "après le moulinet : fenêtre pour frapper", [("vertige_1", "1 · tête qui penche"), ("vertige_2", "2 · de l'autre côté")]),
    ("TOUCHÉ", "1er coup, puis état abîmé", [("touche", "touché"), ("abime_repos", "abîmé (1 PV)"),
                                             ("abime_touche", "abîmé touché")]),
    ("MORT", "4 temps, puis fondu", [("mort_1_coupe", "1 · tranché"), ("mort_2_pouf", "2 · pouf !"),
                                    ("mort_3_en_tas", "3 · la tête sur le tas"), ("mort_4_libere", "4 · le talisman s'envole")]),
]


def poses_board():
    Z = 5
    cw, ch = W * Z, H * Z
    lw = 250
    BW = 40 + lw + 4 * (cw + 18)
    BH = 110 + len(ROWS) * (ch + 46) + 10
    board = Image.new("RGB", (BW, BH), PAPER)
    d = ImageDraw.Draw(board)
    d.text((40, 28), "WARA — toutes les poses", fill=INK, font=font(30))
    d.text((40, 70), "18 images · orientation droite (retournées pour la gauche) · ancrage sous le pieu, "
                     "comme KAGE", fill=GREY, font=font(15))
    for r, (title, sub, cells) in enumerate(ROWS):
        y = 110 + r * (ch + 46)
        d.text((40, y + 50), title, fill=INK, font=font(19))
        wrap(d, sub, (40, y + 80), lw - 30, font(14, bold=False), fill=GREY)
        for i, (key, label) in enumerate(cells):
            x = 40 + lw + i * (cw + 18)
            d.rectangle([x, y, x + cw - 1, y + ch - 1], fill=BG)
            g = big(img(POSES[key]), Z)
            board.paste(g, (x, y), g)
            d.text((x, y + ch + 6), label, fill=INK, font=font(14))
    board.save(OUT / "wara_poses.png")


# ---------------------------------------------------------------------------
# 3. comportement
# ---------------------------------------------------------------------------
def scene(items, zones=(), w=150, h=46, ground=40):
    """Petite scène au sol : items = (image, x_ancre, y_décalage, alpha)."""
    im = Image.new("RGBA", (w, h), BG + (255,))
    over = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for (x0, x1, col) in zones:
        od.rectangle([x0, ground - 26, x1, ground], fill=col)
    im.alpha_composite(over)
    d = ImageDraw.Draw(im)
    d.rectangle([0, ground + 1, w, h], fill=(92, 84, 72, 255))
    d.line([(0, ground + 1), (w, ground + 1)], fill=(126, 116, 98, 255))
    for (sprite, ax, dy, alpha) in items:
        s = sprite
        if alpha < 255:
            s = sprite.copy()
            a = s.getchannel("A").point(lambda v: v * alpha // 255)
            s.putalpha(a)
        im.alpha_composite(s, (ax - 16, ground - 31 + 1 + dy))
    return im


def gameplay_board():
    Z = 4
    wr = lambda k: img(POSES[k])
    wl = lambda k: img(POSES[k]).transpose(Image.FLIP_LEFT_RIGHT)
    kr = lambda a, i=0: kage(a, i)
    kl = lambda a, i=0: kage(a, i).transpose(Image.FLIP_LEFT_RIGHT)
    HIT = (200, 60, 50, 90)
    OPEN = (90, 170, 90, 90)
    panels = [
        ("1 · Il arrive en sautillant",
         "Petits bonds sur son pieu vers KAGE dès qu'il le voit (120 px), bras en l'air à chaque saut. Entre "
         "deux bonds, il se dandine pour lui faire face.",
         scene([(wl("bond_1_tasse"), 112, 0, 90), (wl("bond_3_sommet"), 92, -12, 140),
                (wl("bond_4_atterrit"), 72, 0, 255), (kr("idle"), 22, 0, 255)])),
        ("2 · Le signal : le chignon se dresse",
         "À moins de 30 px, son chignon se dresse tout droit et il lève un bras pendant 0,45 s, comme s'il "
         "remontait ses manches. C'est le moment de reculer ou de sauter.",
         scene([(wl("moulinet_1_elan"), 80, 0, 255), (kr("idle"), 46, 0, 255)])),
        ("3 · Moulinet : devant ET derrière",
         "Il mouline des bras en tous sens (0,5 s), des deux côtés à 22 px (1 dégât). Contrairement à TATE, "
         "passer dans son dos ne protège pas.",
         scene([(wr("moulinet_2"), 75, 0, 255), (kl("hurt"), 88, 0, 255)], zones=[(53, 97, HIT)])),
        ("4 · Vertige : frapper !",
         "Après son moulinet, il a le tournis 0,9 s : tête qui penche, chignon en vrille, sans défense. Un coup de sabre (2) suffit à l'abattre ; s'il "
         "survit, il passe à l'état abîmé.",
         scene([(wl("vertige_1"), 84, 0, 255), (kr("attack", 3), 58, 0, 255)], zones=[(66, 102, OPEN)])),
        ("5 · Abîmé : vexé",
         "Avec 1 point de vie, la paille sort par les coutures et son chignon se défait. Vexé, il sautille plus "
         "vite et son signal raccourcit à 0,3 s. Un coup de plus et il tombe.",
         scene([(wl("abime_repos"), 90, 0, 255), (kr("run", 2), 40, 0, 255)])),
        ("6 · Les autres réponses",
         "La glissade passe sous lui pendant un bond. Un shuriken (1) le fait vaciller et interrompt son "
         "élan. Le coup aérien (3) l'achève d'un coup.",
         scene([(wl("bond_3_sommet"), 80, -14, 255), (kr("slide", 1), 80, 0, 255)])),
    ]
    cols = 3
    pw, ph = 150 * Z, 46 * Z
    BW = 40 + cols * (pw + 30)
    BH = 120 + 2 * (ph + 120) + 250
    board = Image.new("RGB", (BW, BH), PAPER)
    d = ImageDraw.Draw(board)
    d.text((40, 28), "WARA — comportement et parades", fill=INK, font=font(30))
    d.text((40, 70), "Valeurs proposées, à ajuster manette en main · rouge : zone touchée · vert : fenêtre "
                     "pour frapper", fill=GREY, font=font(15))
    for i, (title, text, sc) in enumerate(panels):
        x = 40 + (i % cols) * (pw + 30)
        y = 120 + (i // cols) * (ph + 120)
        board.paste(big(sc, Z).convert("RGB"), (x, y))
        d.text((x, y + ph + 12), title, fill=INK, font=font(17))
        wrap(d, text, (x, y + ph + 40), pw - 10, font(14, bold=False))

    # tableau de réglages
    y = 120 + 2 * (ph + 120) + 10
    d.text((40, y), "Réglages proposés", fill=INK, font=font(18))
    rows = [
        ("Points de vie", "2  (sabre 2 → un seul coup suffit pendant le vertige ; shuriken 1)"),
        ("Bond", "hauteur 14 px, longueur ~20 px, un bond toutes les 0,7 s (0,45 s abîmé)"),
        ("Repère", "voit KAGE à 120 px ; signal à 30 px"),
        ("Moulinet", "signal 0,45 s (0,3 s abîmé), moulinet 0,5 s, portée 22 px des deux côtés, 1 dégât"),
        ("Vertige", "0,9 s sans défense, puis repos 0,6 s avant de pouvoir rebondir"),
        ("Corps", "pas solide : KAGE le traverse (il ne bloque pas le passage comme TATE)"),
    ]
    for j, (k, v) in enumerate(rows):
        yy = y + 36 + j * 28
        d.text((40, yy), k, fill=INK, font=font(14))
        d.text((220, yy), v, fill=INK, font=font(14, bold=False))
    board.save(OUT / "wara_gameplay.png")


# ---------------------------------------------------------------------------
# 4. animations en GIF, côte à côte
# ---------------------------------------------------------------------------
ANIMS = [
    ("repos", [("repos_1", 350), ("repos_2", 350)]),
    ("bond", [("repos_1", 240), ("bond_1_tasse", 120), ("bond_2_envol", 90), ("bond_3_sommet", 160),
              ("bond_2_envol", 90), ("bond_4_atterrit", 140), ("repos_1", 160)]),
    ("moulinet", [("repos_1", 300), ("moulinet_1_elan", 450), ("moulinet_2", 90), ("moulinet_3", 90),
                  ("moulinet_2", 90), ("moulinet_3", 90), ("moulinet_2", 90), ("moulinet_3", 90),
                      ("vertige_1", 220), ("vertige_2", 220), ("vertige_1", 220), ("vertige_2", 220)]),
    ("mort", [("abime_repos", 400), ("abime_touche", 160), ("mort_1_coupe", 260), ("mort_2_pouf", 200),
              ("mort_3_en_tas", 500), ("mort_4_libere", 900)]),
]
HOP_Y = {"bond_2_envol": -8, "bond_3_sommet": -14}      # hauteur du bond (gérée par le jeu)


def anim_gif():
    Z = 5
    tick = 10
    seqs = []
    for name, frames in ANIMS:
        seq = []
        for key, ms in frames:
            seq += [key] * (ms // tick)
        seqs.append(seq)
    total = max(len(s) for s in seqs)
    pw, ph = W * Z, (H + 16) * Z
    out, last, dur = [], None, 0
    for t in range(0, total, 2):
        frame = Image.new("RGB", (len(seqs) * (pw + 10) + 10, ph + 40), PAPER)
        d = ImageDraw.Draw(frame)
        for i, seq in enumerate(seqs):
            key = seq[t % len(seq)]
            cell = Image.new("RGBA", (W, H + 16), BG + (255,))
            g = img(POSES[key])
            cell.alpha_composite(g, (0, 16 + HOP_Y.get(key, 0)) if 16 + HOP_Y.get(key, 0) >= 0 else (0, 0))
            x = 10 + i * (pw + 10)
            frame.paste(big(cell, Z).convert("RGB"), (x, 10))
            d.text((x, ph + 16), ANIMS[i][0].upper(), fill=INK, font=font(14))
        sig = frame.tobytes()
        if sig == last:
            dur += tick * 2
            continue
        if out:
            out[-1][1] = dur
        out.append([frame, tick * 2])
        last, dur = sig, tick * 2
    out[-1][1] = dur
    out[0][0].save(OUT / "wara_animations.gif", save_all=True, append_images=[f for f, _ in out[1:]],
                   duration=[ms for _, ms in out], loop=0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    design_board()
    poses_board()
    gameplay_board()
    anim_gif()
    for n in ("wara_design.png", "wara_poses.png", "wara_gameplay.png", "wara_animations.gif"):
        print(OUT / n)


if __name__ == "__main__":
    main()
