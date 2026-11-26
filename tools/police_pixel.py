"""La police en pixels du jeu, version moderne (26 novembre 2026, demande de Raph : « une police pixel moderne,
bien lisible, avec les pixels du jeu ») : Pixelify Sans (licence SIL OFL, Google Fonts), redessinée au pixel près
sur la grille de la police du jeu (src/engine/pixelfont.js : 3 lignes d'accents, 7 de corps, 2 de jambage).

Pixelify Sans est dessinée sur une grille de pixels (≈ 91,9 unités, 7 pixels de capitale) : on relit chaque contour
case par case (le centre de chaque case est-il dans la lettre ?), sans aucun lissage. Le résultat, des lignes
de « # » et de « . » comme la police dessinée à la main, est écrit dans src/engine/pixelglyphs.js.

    python3 tools/police_pixel.py      (demande : pip install fonttools pillow)
"""
import json
import os
import urllib.request

import numpy as np
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'polices', 'PixelifySans.ttf')
OUT = os.path.join(ROOT, 'src', 'engine', 'pixelglyphs.js')
URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/PixelifySans%5Bwght%5D.ttf'

ASC, BODY, DESC = 3, 7, 2
CHARS = ''.join(chr(c) for c in range(0x21, 0x7f)) + 'àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆōŌ«»’‘“”…·—–•×°'

if not os.path.exists(SRC):
    os.makedirs(os.path.dirname(SRC), exist_ok=True)
    urllib.request.urlretrieve(URL, SRC)
font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': 400})
gs, cmap = font.getGlyphSet(), font.getBestCmap()

BASE_Y, CAP_Y = -12, 631
S = (CAP_Y - BASE_Y) / BODY          # une case de la grille, en unités
K = 8                                # points de dessin par case (on lit le centre de chaque case)


def bitmap(ch):
    g = cmap.get(ord(ch))
    if g is None:
        return None
    pen = RecordingPen()
    gs[g].draw(pen)
    contours, cur = [], []
    for op, args in pen.value:
        if op == 'moveTo':
            cur = [args[0]]
        elif op in ('lineTo', 'qCurveTo', 'curveTo'):
            cur.extend(args)
        elif op in ('closePath', 'endPath'):
            if cur:
                contours.append(cur)
            cur = []
    if not contours:
        return None
    top = CAP_Y + ASC * S
    xs = [p[0] for c in contours for p in c]
    x0 = 60 + np.floor((min(xs) - 60) / S + 0.25) * S     # la grille des colonnes passe par x = 60
    cols = int(np.ceil((max(xs) - x0) / S - 0.25)) + 1
    W, H = cols * K, (ASC + BODY + DESC) * K
    mask = np.zeros((H, W), bool)
    for c in contours:      # pair-impair : les contours intérieurs creusent (le O, le A…)
        im = Image.new('1', (W, H), 0)
        ImageDraw.Draw(im).polygon([((x - x0) / S * K, (top - y) / S * K) for x, y in c], fill=1)
        mask ^= np.array(im, bool)
    rows = []
    for r in range(ASC + BODY + DESC):
        rows.append(''.join('#' if mask[r * K + K // 2, i * K + K // 2] else '.' for i in range(cols)))
    # bords vides retirés (la chasse est celle des pixels pleins ; l'espace entre lettres est celui du jeu)
    used = [i for i in range(cols) if any(r[i] == '#' for r in rows)]
    if not used:
        return None
    a, b = min(used), max(used) + 1
    return [r[a:b] for r in rows]


# les chiffres et le « r » de Pixelify se lisent mal à cette taille (le 5 ressemble à un S, le 7 s'arrondit,
# le r à un n, le a a une queue détachée ; N, M, W, Z, S… zigzaguent une fois relus au pixel) : ils gardent le dessin
# d'origine du jeu
KEEP = set('0123456789raàâäBKMNQRSTWXYZmw')
glyphs = {}
for ch in CHARS:
    if ch in KEEP:
        continue
    bm = bitmap(ch)
    if bm:
        glyphs[ch] = '/'.join(bm)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// La police en pixels du jeu, version moderne : Pixelify Sans (SIL OFL) relue au pixel près sur la grille\n'
            '// du jeu (3 lignes d\'accents, 7 de corps, 2 de jambage) — fichier généré par tools/police_pixel.py.\n')
    f.write('export const MODERN = ' + json.dumps(glyphs, ensure_ascii=False, indent=0).replace('\n', ' ') + ';\n')
print(f'{OUT} : {len(glyphs)} signes')
