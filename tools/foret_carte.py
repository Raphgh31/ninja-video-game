"""Carte greybox de la Forêt (chapitre 2), pour vérifier le tracé d'un coup d'œil.

    python3 tools/foret_carte.py <sortie.png> [zone]      # zone : 01 à 12 (sinon toute la carte, par bandes)
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
js = "import('%s/src/game/chapters/foret.js').then(m=>console.log(JSON.stringify({map:m.FORET.map,zones:m.FORET.zones,forest:m.FORET.forest,props:m.FORET.props})))" % ROOT
D = json.loads(subprocess.check_output(["node", "-e", js]))
COL = {'#': (92, 70, 48), '=': (120, 134, 142), '|': (122, 66, 38), '-': (190, 150, 90), '~': (60, 170, 180), 'v': (160, 30, 30),
       'J': (230, 120, 40), '%': (70, 70, 90), 'o': (250, 210, 70), 'P': (255, 150, 60), 'S': (255, 255, 255), 'G': (120, 255, 120), 'B': (160, 110, 60)}


def render(x0, x1, k=6):
    rows = D['map']
    H = len(rows)
    ys = [y for y in range(H) if any(rows[y][x] not in '.' for x in range(x0, x1))]
    y0, y1 = max(0, min(ys) - 14), H
    img = Image.new('RGB', ((x1 - x0) * k, (y1 - y0) * k), (24, 34, 40))
    d = ImageDraw.Draw(img)
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = rows[y][x]
            if c != '.':
                d.rectangle([(x - x0) * k, (y - y0) * k, (x - x0 + 1) * k - 1, (y - y0 + 1) * k - 1], fill=COL.get(c, (255, 0, 255)))
    T = 16
    px = lambda v: (v / T - x0) * k
    py = lambda v: (v / T - y0) * k
    F = D['forest']
    for v in F['vines']:
        d.line([px(v['ax']), py(v['ay']), px(v['ax']), py(v['ay'] + v['len'])], fill=(90, 220, 90), width=2)
        if v['swing']:
            import math
            for s in (-1, 1):
                d.line([px(v['ax']), py(v['ay']), px(v['ax'] + s * math.sin(v['swing']) * v['len']), py(v['ay'] + math.cos(v['swing']) * v['len'])], fill=(50, 120, 60))
    for l in F['logs']:
        d.rectangle([px(l['x0']), py(l['y']), px(l['x1'] + l['w']), py(l['y']) + 2], outline=(200, 140, 80))
    for c in F['crumbles']:
        d.rectangle([px(c['x']), py(c['y']), px(c['x'] + c['w']), py(c['y']) + 2], fill=(220, 190, 120))
    if F['statue']:
        for e in F['statue']['eyes']:
            d.ellipse([px(e['x']) - 3, py(e['y']) - 3, px(e['x']) + 3, py(e['y']) + 3], outline=(120, 240, 240))
    for z in D['zones']:
        if x0 <= z['x0'] < x1:
            d.line([(z['x0'] - x0) * k, 0, (z['x0'] - x0) * k, img.height], fill=(255, 255, 255))
            d.text(((z['x0'] - x0) * k + 3, 2), f"{z['id']} {z['name']} ({z['x1'] - z['x0']} cases)", fill=(255, 255, 255))
    for x in range(x0 - x0 % 10, x1, 10):
        d.text(((x - x0) * k, img.height - 10), str(x), fill=(150, 150, 150))
    return img


if __name__ == '__main__':
    out = sys.argv[1]
    if len(sys.argv) > 2:
        z = next(z for z in D['zones'] if z['id'] == sys.argv[2])
        render(max(0, z['x0'] - 4), min(len(D['map'][0]), z['x1'] + 4), 8).save(out)
    else:
        W = len(D['map'][0])
        parts = [render(a, min(W, a + 190), 5) for a in range(0, W, 190)]
        img = Image.new('RGB', (max(p.width for p in parts), sum(p.height + 6 for p in parts)), (0, 0, 0))
        y = 0
        for p in parts:
            img.paste(p, (0, y)); y += p.height + 6
        img.save(out)
    print(out, len(D['map'][0]), 'x', len(D['map']))
