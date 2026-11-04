"""Planches de présentation de KARASU-KASHI : python3 tools/kage_forge/enemies/karasu_board.py

Sorties (docs/enemies/) :
  karasu_design.png      concept : anatomie annotée, expressions, échelle, palette
  karasu_poses.png       les poses clés de chaque animation
  karasu_arene.png       l'épouvantail géant, les projectiles, la porte du temple, le combat
  karasu_animations.gif  repos, vol et étourdissement en boucle
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import karasu  # noqa: E402
import tate  # noqa: E402
import wara  # noqa: E402
from karasu import DEFAULT, PAL, axis, crow, pose  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "docs/enemies"
PAPER = (226, 222, 212)
BG = (139, 152, 168)
INK = (24, 26, 32)
GREY = (80, 80, 86)
RED = (168, 67, 58)


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
    p = Path("/usr/share/fonts/truetype/dejavu") / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    return ImageFont.truetype(str(p), size)


def big(im, z):
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def wrap(d, text, xy, width, f, fill=INK, gap=4):
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


def kage(anim="idle", i=0):
    sheet = Image.open(ROOT / f"assets/characters/kage/anims/kage_{anim}.png").convert("RGBA")
    return sheet.crop((i * 48, 0, i * 48 + 48, 32))


def other(mod, name):
    return img(mod.POSES[name]() if callable(mod.POSES[name]) else mod.POSES[name], mod.PAL)


def panel(w, h, col=BG):
    return Image.new("RGBA", (w, h), col + (255,))


# ---------------------------------------------------------------------------
# 1. concept
# ---------------------------------------------------------------------------
def design():
    W, H = 1640, 1250
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((40, 26), "KARASU-KASHI — le corbeau du potager", fill=INK, font=font(34))
    d.text((40, 72), "Planche de design · mini-boss du chapitre 1 · perché sur un épouvantail géant · cellule 96×80 (KAGE : 48×32)", fill=GREY, font=font(16))
    # le corbeau en grand, annoté
    Z = 6
    P = dict(DEFAULT)
    hx, hy = axis(P, 11, -6)
    hx, hy = hx + 5, hy - 11
    a0 = P["bang"] + math.pi + 0.28
    tb = axis(P, -karasu.BODY_L + 3, 2)
    hip = axis(P, 2 - 4, karasu.BODY_T - 2)
    notes = [
        ((hx - 2, hy - 11), "Sugegasa de paille tressée, trop petit, de travers ; il glisse quand il est étourdi"),
        ((hx - 7, hy - 9), "Plumes rebelles sur la nuque"),
        ((hx + 4.5, hy - 1.5), "Œil ambré, pupille noire : le regard narquois tient à la paupière et au sourcil"),
        ((hx + 17, hy + 3.5), "Bec noir robuste, crochu, soies nasales sur la base"),
        ((hx + 4, hy + 10), "Gorge hérissée, comme le grand corbeau"),
        (axis(P, 0, -8), "Plumage : noir d'encre, charbon, bleu nuit ; reflets bleu pétrole et bleu métal"),
        (axis(P, -5, 7), "Haillon de tissu sombre noué à l'aile"),
        ((tb[0] + math.cos(a0) * 16, tb[1] + math.sin(a0) * 16), "Queue en longues plumes effilées, ficelle de chanvre nouée"),
        ((hip[0] - 2, hip[1] + 7), "Deux talismans de papier noués aux pattes, inscriptions rouges"),
        ((karasu.FX + 2, karasu.FY), "Pattes fines, serres acérées"),
    ]
    box = panel(karasu.W * Z, karasu.H * Z)
    box.alpha_composite(big(img(pose("idle")), Z))
    ox, oy = 40, 116
    im.paste(box, (ox, oy))
    tx = ox + karasu.W * Z + 40
    for k, ((px, py), text) in enumerate(notes):
        y = oy + 14 + k * 46
        sx, sy = ox + px * Z, oy + py * Z
        d.line([(sx, sy), (tx - 10, y + 8)], fill=INK, width=1)
        d.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], outline=INK, width=2)
        d.text((tx - 2, y), str(k + 1), fill=RED, font=font(17))
        wrap(d, text, (tx + 24, y), 380, font(15, False), gap=2)
    # histoire et caractère
    cx = tx + 430
    y = wrap(d, "Qui est-il ?", (cx, 116), 360, font(20))
    y = wrap(d, "Le maître autoproclamé du potager. Un talisman l'a rendu grand, malin et terriblement content de lui : il a fait de l'épouvantail géant son trône, pille les récoltes et bombarde quiconque approche avec les légumes volés. Arrogant, curieux, un peu ridicule, il ne supporte pas qu'on lui abîme son chapeau.", (cx, y + 6), 360, font(15, False))
    y = wrap(d, "Ce qu'il dit sans parler", (cx, y + 14), 360, font(20))
    y = wrap(d, "Ses yeux et sa tête font tout : il toise KAGE de haut, penche la tête quand il ne comprend pas, redresse son chapeau avec la patte, croasse pour provoquer avant certaines attaques, et prend un air profondément vexé quand on le touche.", (cx, y + 6), 360, font(15, False))
    y = wrap(d, "Rôle en jeu", (cx, y + 14), 360, font(20))
    wrap(d, "Le mini-boss du chapitre 1, à la sortie du potager. Il fait réviser tout ce qu'on a appris : le dash sous ses bombes, les shurikens quand il vole, la glissade sous son plongeon, le sabre quand il est coincé. Une fois vaincu, le talisman qui scellait la grande porte du temple se déchire et la porte s'ouvre.", (cx, y + 6), 360, font(15, False))
    # expressions
    y0 = oy + karasu.H * Z + 30
    d.text((40, y0), "Expressions : il communique par les yeux et la tête", fill=INK, font=font(19))
    EX = [("arrogant", dict()), ("curieux", dict(tilt=0.45, eye="curious", hatang=-0.12)), ("provocateur", dict(tilt=-0.35, beak=1.0, eye="angry", hatdy=-1, hatang=-0.45)),
          ("surpris", dict(eye="surprise", puff=1.2, hatdy=-3, beak=0.35)), ("il vise", dict(eye="glare", tilt=0.15)), ("vexé", dict(eye="hurt", tilt=-0.4, beak=0.5, puff=1.0, hatdy=-4, hatang=-0.9)),
          ("étourdi", dict(eye="dizzy", tilt=0.5, hat="askew", hatdx=3, hatdy=3, hatang=0.6, fx=("stars",)))]
    for k, (name, kw) in enumerate(EX):
        g = img(crow(**kw))
        cr = g.crop((int(hx) - 18, int(hy) - 18, int(hx) + 26, int(hy) + 16))
        x = 40 + k * 222
        pn = panel(cr.width * 5, cr.height * 5)
        pn.alpha_composite(big(cr, 5))
        im.paste(pn, (x, y0 + 34))
        d.text((x, y0 + 34 + cr.height * 5 + 6), name, fill=INK, font=font(15))
    # échelle
    ys = y0 + 34 + 34 * 5 + 50
    d.text((40, ys), "Échelle : KAGE, WARA, TATE et Karasu-Kashi (×3)", fill=INK, font=font(19))
    strip = panel(820, 260)
    base = 250
    x = 20
    sprites = [kage(), img(wara.POSES["repos_1"], wara.PAL),
               img(tate.POSES["marche_1"], tate.PAL).transpose(Image.FLIP_LEFT_RIGHT)]
    sprites.append(img(pose("idle")))
    for spr in sprites:
        s3 = big(spr, 3)
        strip.alpha_composite(s3, (x, base - s3.height + 6))
        x += s3.width + 10
    im.paste(strip, (40, ys + 32))
    # palette
    px0 = 900
    d.text((px0, ys), "Palette", fill=INK, font=font(19))
    groups = [("plumage", "kKbBiI"), ("reflets", "pPmM"), ("yeux", "eaAZn"), ("bec", "qQzv"), ("pattes", "lLtT"), ("chapeau", "hHyYc"), ("haillons", "rRX"), ("chanvre", "sS"), ("talismans", "wWx")]
    for k, (name, chars) in enumerate(groups):
        y = ys + 36 + k * 30
        d.text((px0, y + 4), name, fill=GREY, font=font(14, False))
        for i, ch in enumerate(chars):
            d.rectangle([px0 + 100 + i * 34, y, px0 + 128 + i * 34, y + 26], fill=rgb(PAL[ch]), outline=(60, 60, 60))
    im.save(OUT / "karasu_design.png")


# ---------------------------------------------------------------------------
# 2. poses
# ---------------------------------------------------------------------------
POSE_LIST = [
    ("Repos (respire, cligne, tourne la tête)", "idle", {}),
    ("Curieux : il penche la tête", "curious", {}),
    ("Croassement provocateur", "croak", {}),
    ("Envol : ailes ouvertes, paille qui vole", "takeoff", {}),
    ("Vol : ailes levées", "flight_up", {}),
    ("Vol : vol plané", "flight_mid", {}),
    ("Vol : ailes abaissées", "flight_down", {}),
    ("Plongeon : en flèche, serres en avant", "dive", {}),
    ("Coincé dans le sol, étourdi", "stunned", {}),
    ("Touché : recul, vexé, plumes", "hurt", {}),
    ("Il s'ébroue et replace son chapeau", None, dict(puff=2.2, eye="closed", tilt=0.35, hatdy=-3, hatang=0.2, fx=("feathers",))),
    ("Défaite : affalé, chapeau sur l'œil", "defeated", {}),
]


def poses():
    cols, Z = 4, 3
    cw, ch = karasu.W * Z + 30, karasu.H * Z + 46
    W, H = cols * cw + 50, 100 + math.ceil(len(POSE_LIST) / cols) * ch
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((30, 24), "Karasu-Kashi — les poses clés de chaque animation", fill=INK, font=font(28))
    d.text((30, 62), "Chaque pose sort du même squelette : le plumage, les reflets et les accessoires restent identiques d'une animation à l'autre.", fill=GREY, font=font(15))
    for k, (name, key, kw) in enumerate(POSE_LIST):
        x, y = 30 + (k % cols) * cw, 100 + (k // cols) * ch
        g = pose(key) if key else crow(**kw)
        pn = panel(karasu.W * Z, karasu.H * Z)
        pn.alpha_composite(big(img(g), Z))
        im.paste(pn, (x, y))
        d.text((x, y + karasu.H * Z + 6), name, fill=INK, font=font(14))
    im.save(OUT / "karasu_poses.png")


# ---------------------------------------------------------------------------
# 3. l'arène
# ---------------------------------------------------------------------------
def arene():
    W, H = 1640, 1060
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((40, 24), "Son royaume : l'épouvantail géant, ses bombes, la porte du temple", fill=INK, font=font(28))
    # scène : l'épouvantail avec le corbeau perché, KAGE pour l'échelle
    Z = 3
    sc = img(karasu.scarecrow())
    cr = img(pose("idle"))
    SH, GY = 640, 600                                       # hauteur de la scène, ligne du sol
    scene = Image.new("RGBA", (520, SH), (0, 0, 0, 0))
    for y in range(SH):                                   # ciel du potager
        t = y / SH
        ImageDraw.Draw(scene).line([(0, y), (520, y)], fill=(int(120 + 80 * t), int(170 + 50 * t), int(214 + 10 * t), 255))
    ImageDraw.Draw(scene).rectangle([0, GY, 520, SH], fill=(118, 86, 58, 255))
    ImageDraw.Draw(scene).rectangle([0, GY - 4, 520, GY + 1], fill=(126, 178, 72, 255))
    s3 = big(sc, Z)
    sx0, sy0 = 40, GY - karasu.SGROUND * Z
    scene.alpha_composite(s3, (sx0, sy0))
    c3 = big(cr, Z)
    scene.alpha_composite(c3, (sx0 + 58 * Z - karasu.FX * Z, sy0 + 25 * Z - karasu.FY * Z))   # perché au sommet
    k3 = big(kage(), Z)
    scene.alpha_composite(k3, (410, GY - 31 * Z))
    im.paste(scene, (40, 80))
    d.text((40, 80 + SH + 10), "Bois noueux, bras asymétriques, tuteurs de bambou, gerbes de paille dorée, cordes de chanvre, vieux haori indigo, faucille et gourde. Il s'y pose, s'y agrippe, en décolle : la structure oscille et perd quelques brins de paille.", fill=INK, font=font(14, False))
    # projectiles
    px0 = 600
    d.text((px0, 84), "Ses bombes (phase 1)", fill=INK, font=font(20))
    pa = panel(220, 150)
    pa.alpha_composite(big(img(karasu.acorn()), 8), (14, 20))
    im.paste(pa, (px0, 116))
    wrap(d, "Gland piquant : il éclate en une gerbe d'épines au sol. Petite zone, il en lâche plusieurs.", (px0 + 232, 120), 230, font(14, False))
    pt = panel(220, 170)
    pt.alpha_composite(big(img(karasu.turnip(1)), 8), (40, 10))
    im.paste(pt, (px0, 286))
    wrap(d, "Navet explosif : sa mèche (un talisman roulé) crépite, puis il explose en terre et en feuilles. Grande zone, on la quitte d'un dash.", (px0 + 232, 290), 230, font(14, False))
    # la porte
    gx = 1090
    d.text((gx, 84), "La porte du temple", fill=INK, font=font(20))
    g0, g1 = big(img(karasu.gate(0.0)), 2), big(img(karasu.gate(1.0)), 2)
    pg = panel(g0.width * 2 + 30, g0.height + 20)
    pg.alpha_composite(g0, (5, 10))
    pg.alpha_composite(g1, (g0.width + 25, 10))
    im.paste(pg, (gx, 116))
    wrap(d, "Scellée par un talisman et une corde sacrée tant que le corbeau règne. Vaincu, le talisman se déchire et les deux vantaux s'ouvrent : on passe, le chapitre est fini.", (gx, 116 + g0.height + 30), 440, font(14, False))
    # le combat
    y = 80 + SH + 50
    d.text((40, y), "Le combat, en trois temps", fill=INK, font=font(22))
    cols = [
        ("1 · Le bombardement", "Il décolle de l'épouvantail, se place en hauteur et lâche glands piquants et navets explosifs, en variant trajectoires, rythme et types. On esquive au dash ; en vol, il ne craint que les shurikens. Avant chaque salve : un croassement, la tête qui pointe la cible."),
        ("2 · Le plongeon", "Il fixe KAGE de ses yeux ambrés (regard plissé, pupilles serrées), replie les ailes, puis fond en diagonale, bec et serres en avant. La préparation dure assez pour être lue ; une glissade au bon moment fait passer sous lui."),
        ("3 · La fenêtre", "Manqué, il s'écrase dans le potager, le bec planté dans la terre, étourdi, chapeau de travers. C'est le moment du sabre : recul, petit arrêt sur image, plumes qui volent, mine vexée. Puis il se dégage, s'ébroue, replace son chapeau et regagne son perchoir."),
        ("Progression", "Début : attaques espacées, prévisibles. Milieu : plus de variations, enchaînements bombes puis plongeon. Fin : plus rapide et plus agressif, deux plongeons d'affilée, mais toujours une préparation lisible et une vraie fenêtre de réaction."),
    ]
    for k, (t, txt) in enumerate(cols):
        x = 40 + k * 400
        d.text((x, y + 40), t, fill=RED, font=font(17))
        wrap(d, txt, (x, y + 68), 370, font(14, False))
    wrap(d, "Barre de vie : un fin trait en haut de l'écran, aux couleurs du jeu, avec son nom en petites capitales. Sons : croassements (provocation, vexation), battements d'ailes, plumes, paille, chutes lourdes. Effets mesurés : chaque particule sert la lisibilité ou la sensation du coup.", (40, y + 230), 1560, font(14, False))
    im.save(OUT / "karasu_arene.png")


# ---------------------------------------------------------------------------
# 4. animations (aperçu)
# ---------------------------------------------------------------------------
def gif():
    Z = 3
    frames = []
    idle = [dict(), dict(by=55, puff=0.3), dict(by=55, puff=0.3, eye="closed"), dict(), dict(tilt=0.25, eye="curious"), dict(tilt=0.25, eye="curious")]
    fly = ["flight_up", "flight_mid", "flight_down", "flight_mid"]
    for i in range(12):
        fr = Image.new("RGBA", (karasu.W * Z * 3 + 40, karasu.H * Z + 20), BG + (255,))
        a = crow(**idle[i % len(idle)])
        b = pose(fly[i % 4])
        st = dict(karasu.POSES["stunned"], eye="dizzy" if i % 2 else "dizzy2", starphase=i * 0.5)
        c = crow(**st)
        for k, g in enumerate((a, b, c)):
            fr.alpha_composite(big(img(g), Z), (10 + k * (karasu.W * Z + 10), 10))
        frames.append(fr.convert("P", palette=Image.ADAPTIVE))
    frames[0].save(OUT / "karasu_animations.gif", save_all=True, append_images=frames[1:], duration=160, loop=0)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    design()
    poses()
    arene()
    gif()
    print("planches écrites dans", OUT)
