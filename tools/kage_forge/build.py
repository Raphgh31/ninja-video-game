"""Exporte tous les livrables de KAGE à partir des poses (art.py).

usage : python3 tools/kage_forge/build.py
Sorties : assets/characters/kage/  et  docs/kage/
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from art import ANIMS, SHURIKEN, VIEWS  # noqa: E402
from core import CH, CW, add_outline, parse, render  # noqa: E402
from palette import NO_OUTLINE, PARTS, SLOT_ORDER, SLOTS  # noqa: E402
from accessories import dress, find_head  # noqa: E402
import scale  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/characters/kage"
DOCS = ROOT / "docs/kage"
SPACING = 2
PIVOT = (16, 31)          # milieu bas de la cellule : point d'ancrage des pieds
GROUNDED = {"idle", "run", "sprint", "land", "slide", "skid", "kick", "walk", "enter"}


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_skins():
    skins = {}
    for p in sorted((OUT / "skins").glob("*.json")):
        d = json.loads(p.read_text())
        missing = set(SLOTS) - set(d["colors"])
        assert not missing, f"skin {p.name} : slots manquants {missing}"
        skins[d["id"]] = d
    return skins


def to_rgba(grid, colors, only=None):
    a = np.zeros(grid.shape + (4,), np.uint8)
    for s in SLOTS:
        if only is not None and s not in only:
            continue
        m = grid == s
        if m.any():
            a[m] = hex2rgb(colors[s]) + (255,)
    return Image.fromarray(a, "RGBA")


def to_index(grid):
    a = np.zeros(grid.shape + (4,), np.uint8)
    for i, s in enumerate(SLOT_ORDER):
        m = grid == s
        a[m] = (i + 1, 0, 0, 255)
    return Image.fromarray(a, "RGBA")


def qa(name, grids):
    problems = []
    for i, g in enumerate(grids):
        unknown = set(np.unique(g)) - set(SLOTS) - {"."}
        if unknown:
            problems.append(f"{name}[{i}] slots inconnus {unknown}")
        if name in GROUNDED:
            body = np.isin(g, [s for s in SLOTS if s not in NO_OUTLINE])
            rows = np.where(body.any(axis=1))[0]
            if rows.max() != 31:
                problems.append(f"{name}[{i}] pieds non alignés au sol (bas = {rows.max()})")
        # pixels parasites : pixel de corps isolé (aucun voisin plein)
        solid = g != "."
        for y, x in zip(*np.where(solid & ~np.isin(g, list(NO_OUTLINE)))):
            nb = solid[max(0, y - 1):y + 2, max(0, x - 1):x + 2].sum() - 1
            if nb == 0 and name not in ("death", "respawn"):
                problems.append(f"{name}[{i}] pixel isolé en ({x},{y})")
    return problems


def main():
    global CW, CH
    skins = load_skins()
    ref = skins["encre"]["colors"]
    order = list(ANIMS)
    rendered = {k: [render(f) for f in v["frames"]] for k, v in ANIMS.items()}
    views = {k: render(f) for k, f in VIEWS.items()}

    problems = []
    for k, g in rendered.items():
        problems += qa(k, g)
    for k, g in views.items():
        problems += qa("view_" + k, [g])
    if problems:
        print("\n".join(problems))
        raise SystemExit("Contrôle qualité : échec")

    # agrandissement de 20 % (scale.py) : les poses sont dessinées en 48×32, le
    # jeu reçoit des cellules plus grandes ; les contrôles se font sur le dessin
    small = rendered
    plans = {k: [scale.plan(g) for g in v] for k, v in small.items()}
    rendered = {k: [scale.grow(g, p) for g, p in zip(small[k], plans[k])] for k in order}
    views = {k: scale.big(g) for k, g in views.items()}
    CW, CH = scale.BIG_W, scale.BIG_H

    for d in ("anims", "frames", "layers", "views"):
        shutil.rmtree(OUT / d, ignore_errors=True)
        (OUT / d).mkdir(parents=True)

    sx, sy = CW + SPACING, CH + SPACING
    cols = max(len(v) for v in rendered.values())
    W, H = cols * sx - SPACING, len(order) * sy - SPACING

    def sheet(fn):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for r, k in enumerate(order):
            for c, g in enumerate(rendered[k]):
                im.paste(fn(g), (c * sx, r * sy))
        return im

    # planche de référence + carte d'index + calques
    sheet(lambda g: to_rgba(g, ref)).save(OUT / "kage_sheet.png")
    sheet(to_index).save(OUT / "kage_sheet_index.png")
    # calques d'accessoires des skins (chapeau, cordelette…), posés par le jeu
    # par-dessus la planche du skin ; même disposition que la carte d'index
    acc_sheets = {}
    for sid, sk in skins.items():
        names = sk.get("accessories") or []
        if not names:
            continue
        # (sur les images de base : c'est là que l'accessoire est posé, avant l'agrandissement)
        nohead = [f"{k}[{i}]" for k in order for i, g in enumerate(small[k])
                  if k not in ("death", "respawn") and find_head(g) is None]
        if nohead:
            raise SystemExit(f"Accessoires du skin {sid} : tête introuvable dans {', '.join(nohead)}")
        f = f"kage_acc_{sid}_index.png"
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for r, k in enumerate(order):
            for c, (g0, p) in enumerate(zip(small[k], plans[k])):
                # même agrandissement que l'image nue : seuls les pixels qui changent
                dg, bg = scale.grow(dress(g0, names), p), rendered[k][c]
                ov = np.full(bg.shape, ".", dtype="<U1")
                ov[dg != bg] = dg[dg != bg]
                im.paste(to_index(ov), (c * sx, r * sy))
        im.save(OUT / f)
        acc_sheets[sid] = f
    for part in PARTS:
        slots = {s for s, (p, _) in SLOTS.items() if p == part}
        sheet(lambda g, slots=slots: to_rgba(g, ref, only=slots)).save(OUT / "layers" / f"kage_{part}.png")
    # silhouette pleine (masque)
    sheet(lambda g: Image.fromarray(
        np.dstack([np.zeros((CH, CW, 3), np.uint8),
                   np.where((g != ".") & ~np.isin(g, list(NO_OUTLINE)), 255, 0).astype(np.uint8)]),
        "RGBA")).save(OUT / "layers" / "kage_silhouette.png")


    # animations individuelles
    for k in order:
        strip = Image.new("RGBA", (CW * len(rendered[k]), CH), (0, 0, 0, 0))
        for i, g in enumerate(rendered[k]):
            im = to_rgba(g, ref)
            strip.paste(im, (i * CW, 0))
            im.save(OUT / "frames" / f"kage_{k}_{i:02d}.png")
        strip.save(OUT / "anims" / f"kage_{k}.png")

    # vues
    vorder = ["front", "back", "left", "right"]
    vs = Image.new("RGBA", (4 * sx - SPACING, CH), (0, 0, 0, 0))
    for i, k in enumerate(vorder):
        im = to_rgba(views[k], ref)
        vs.paste(im, (i * sx, 0))
        im.save(OUT / "views" / f"kage_view_{k}.png")
    vs.save(OUT / "kage_views.png")

    # projectile : shuriken (cellules 12x12, contour auto, partie enfoncée coupée)
    SC = 12
    proj = {}
    cells = []
    for name, (text, anchor) in SHURIKEN.items():
        g = np.full((SC, SC), ".", dtype="<U1")
        art = parse(text)
        g[1:1 + art.shape[0], 1:1 + art.shape[1]] = art
        g = add_outline(g)
        ax, ay = anchor
        if name == "stuck_wall":
            g[:, ax + 1:] = "."          # ce qui dépasse dans le mur n'est pas visible
        if name == "stuck_ground":
            g[ay + 1:, :] = "."          # idem dans le sol
        cells.append((name, g, (ax, ay)))
        if name == "stuck_ground":
            # même image en miroir : demi-lame vers l'arrière, lame entière vers l'avant
            cells.append(("stuck_ground_b", np.fliplr(g), (SC - 1 - ax, ay)))
    sh_rgba = Image.new("RGBA", (SC * len(cells), SC), (0, 0, 0, 0))
    sh_idx = Image.new("RGBA", (SC * len(cells), SC), (0, 0, 0, 0))
    for i, (name, g, (ax, ay)) in enumerate(cells):
        sh_rgba.paste(to_rgba(g, ref), (i * SC, 0))
        sh_idx.paste(to_index(g), (i * SC, 0))
        proj[name] = {"x": i * SC, "y": 0, "w": SC, "h": SC, "anchor": {"x": ax, "y": ay}}
    sh_rgba.save(OUT / "kage_shuriken.png")
    sh_idx.save(OUT / "kage_shuriken_index.png")

    # métadonnées
    meta = {
        "name": "KAGE",
        "version": 1,
        "image": "kage_sheet.png",
        "indexImage": "kage_sheet_index.png",
        "cell": {"w": CW, "h": CH},
        "spacing": SPACING,
        "margin": 0,
        "pivot": {"x": scale.BIG_PIVOT[0], "y": scale.BIG_PIVOT[1], "note": "sous les pieds (cellule agrandie de 20 %, scale.py)"},
        "facing": "right",
        "flipForLeft": True,
        "hitbox": {k: scale.box(v, body=k in ("default", "slide", "dash")) for k, v in {
            "default": {"x": 12, "y": 9, "w": 9, "h": 22},
            "slide": {"x": 13, "y": 17, "w": 15, "h": 14},
            "dash": {"x": 10, "y": 15, "w": 13, "h": 16},   # un passage bas d'une case (16 px) se franchit au dash
            "air_attack": {"x": 18, "y": 0, "w": 22, "h": 32, "frames": [2, 3, 4],
                           "note": "coup aérien à deux mains (du haut vers l'avant et le bas)"},
            "kick": {"x": 18, "y": 11, "w": 21, "h": 13, "frames": [1, 2],
                     "note": "coup de pied de côté (détente et impact)"},
            "attack": {"x": 19, "y": 0, "w": 20, "h": 31, "frames": [2, 3, 4],
                       "note": "zone de frappe du sabre, active sur les frames listées"},
        }.items()},
        "slots": [{"index": i + 1, "slot": s, "part": SLOTS[s][0], "role": SLOTS[s][1]}
                  for i, s in enumerate(SLOT_ORDER)],
        "animations": {},
        "views": {k: {"x": i * sx, "y": 0, "w": CW, "h": CH, "image": "kage_views.png"}
                  for i, k in enumerate(vorder)},
        "skins": sorted(skins),
        "accessorySheets": acc_sheets,
        "projectiles": {
            "shuriken": {
                "image": "kage_shuriken.png",
                "indexImage": "kage_shuriken_index.png",
                "frames": proj,
                "spin": ["fly0", "fly1"],
                "hud": "spin0",
                "ground": ["stuck_ground", "stuck_ground_b"],
                "note": "stuck_wall : mur à droite (retourner pour un mur à gauche) ; ancre = point sur la surface",
            }
        },
    }
    for r, k in enumerate(order):
        a = ANIMS[k]
        ms = round(1000 / a["fps"])
        meta["animations"][k] = {
            "row": r,
            "frameCount": len(rendered[k]),
            "fps": a["fps"],
            "loop": a["loop"],
            "loopStart": a.get("loop_start", 0),
            "state": a["state"],
            "strip": f"anims/kage_{k}.png",
            **({"release": {**a["release"], **dict(zip("xy", scale.point(a["release"]["x"], a["release"]["y"])))}}
               if "release" in a else {}),
            "frames": [{"x": c * sx, "y": r * sy, "w": CW, "h": CH,
                        "duration": a.get("durations", [ms] * len(rendered[k]))[c]}
                       for c in range(len(rendered[k]))],
        }
    (OUT / "kage.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))

    build_docs(rendered, views, skins, order, vorder)
    total = sum(len(v) for v in rendered.values())
    print(f"OK — {len(order)} animations, {total} frames, {len(views)} vues")


# ---------------------------------------------------------------------------
# Planches de présentation (documentation, avec texte — hors sprites)
# ---------------------------------------------------------------------------
BG = (139, 152, 168)
INK = (24, 26, 32)


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def build_docs(rendered, views, skins, order, vorder):
    shutil.rmtree(DOCS / "previews", ignore_errors=True)
    (DOCS / "previews").mkdir(parents=True)
    ref = skins["encre"]["colors"]
    Z = 8

    # planche de référence : 4 vues + taille réelle + palette
    labels = {"front": "FACE", "back": "DOS", "left": "PROFIL GAUCHE", "right": "PROFIL DROIT"}
    cw = CH * Z
    sq = lambda g: g[:, :CH]   # les vues tiennent dans les 32 premières colonnes
    W = 40 + 4 * (cw + 24)
    H = 120 + cw + 290
    im = Image.new("RGB", (W, H), (226, 222, 212))
    d = ImageDraw.Draw(im)
    d.text((40, 30), "KAGE — planche de référence", fill=INK, font=font(30))
    d.text((40, 70), "Skin « Encre » (référence) · cellule 48×32 · ancrage des pieds en (16, 31)",
           fill=(80, 80, 86), font=font(16))
    for i, k in enumerate(vorder):
        x = 40 + i * (cw + 24)
        d.rectangle([x, 110, x + cw - 1, 110 + cw - 1], fill=BG)
        big = to_rgba(sq(views[k]), ref).resize((cw, cw), Image.NEAREST)
        im.paste(big, (x, 110), big)
        d.text((x, 120 + cw), labels[k], fill=INK, font=font(16))
        small = to_rgba(sq(views[k]), ref)
        im.paste(small, (x + cw - 40, 120 + cw), small)
        x2 = small.resize((64, 64), Image.NEAREST)
        im.paste(x2, (x + cw - 120, 120 + cw - 18), x2)
    # palette
    y = 175 + cw
    d.text((40, y), "Palette par slot", fill=INK, font=font(16))
    per_row = 14
    for i, s in enumerate(SLOT_ORDER):
        x = 40 + (i % per_row) * 76
        yy = y + (i // per_row) * 120
        d.rectangle([x, yy + 28, x + 40, yy + 68], fill=hex2rgb(ref[s]), outline=(60, 60, 60))
        d.text((x + 2, yy + 74), s, fill=INK, font=font(14))
        d.text((x + 2, yy + 92), SLOTS[s][0], fill=(90, 90, 96), font=font(10))
    im.save(DOCS / "kage_reference.png")

    # planche d'animations annotée
    Z2 = 4
    cw2, ch2 = CW * Z2, CH * Z2
    cols = max(len(v) for v in rendered.values())
    W = 230 + cols * (cw2 + 10)
    H = 30 + len(order) * (ch2 + 10)
    im = Image.new("RGB", (W, H), (226, 222, 212))
    d = ImageDraw.Draw(im)
    for r, k in enumerate(order):
        y = 20 + r * (ch2 + 10)
        a = ANIMS[k]
        d.text((20, y + 30), k.upper(), fill=INK, font=font(18))
        d.text((20, y + 56), f"{len(rendered[k])} frames · {a['fps']} i/s"
               f"{' · boucle' if a['loop'] else ''}", fill=(80, 80, 86), font=font(13))
        for c, g in enumerate(rendered[k]):
            x = 230 + c * (cw2 + 10)
            d.rectangle([x, y, x + cw2 - 1, y + ch2 - 1], fill=BG)
            big = to_rgba(g, ref).resize((cw2, ch2), Image.NEAREST)
            im.paste(big, (x, y), big)
    im.save(DOCS / "kage_animations.png")

    # GIF de contrôle par animation (x6, fond neutre, 2 boucles)
    Z3 = 6
    for k in order:
        a = ANIMS[k]
        frames = []
        for g in rendered[k]:
            f = Image.new("RGBA", (CW * Z3, CH * Z3), BG + (255,))
            big = to_rgba(g, ref).resize((CW * Z3, CH * Z3), Image.NEAREST)
            f.paste(big, (0, 0), big)
            frames.append(f.convert("RGB"))
        dur = round(1000 / a["fps"])
        durs = list(a.get("durations", [dur] * len(frames)))
        if not a["loop"]:
            durs[-1] = 600
        frames[0].save(DOCS / "previews" / f"kage_{k}.gif", save_all=True,
                       append_images=frames[1:], duration=durs, loop=0, disposal=2)


if __name__ == "__main__":
    main()
