"""Carte mentale du jeu (docs/carte-mentale/index.html).

    python3 tools/carte_mentale.py                 # remet à jour les images des personnages
    python3 tools/carte_mentale.py --artefact X    # écrit aussi en X la version à publier sur claude.ai

Le contenu de la carte (branches, boîtes, textes, chemins) se modifie directement
dans index.html (liste BRANCHES). Ce script ne touche qu'à la ligne « const SPRITES = … ; »,
qu'il remplit avec des images tirées des sprites générés du jeu.
"""
import argparse
import base64
import io
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / 'docs' / 'carte-mentale' / 'index.html'
CH = ROOT / 'assets' / 'characters'


def uri(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def cell(name, frame):
    meta = json.loads((CH / name / f'{name}.json').read_text())
    c = meta['frames'][frame]
    sheet = Image.open(CH / name / meta['image']).convert('RGBA')
    im = sheet.crop((c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h']))
    return im.crop(im.getbbox())


def sprites():
    frames = [Image.open(CH / 'kage' / 'frames' / f'kage_idle_{i:02d}.png').convert('RGBA') for i in range(4)]
    boxes = [f.getbbox() for f in frames]
    bb = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    out = {'kage': [uri(f.crop(bb)) for f in frames]}
    for key in ('kage_attack_03', 'kage_kick_02'):
        im = Image.open(CH / 'kage' / 'frames' / f'{key}.png').convert('RGBA')
        out[key] = uri(im.crop(im.getbbox()))
    out['tate'] = uri(cell('tate', 'walk_1'))
    out['wara'] = uri(cell('wara', 'idle_1'))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artefact', help='chemin de la version à publier (sans doctype, html, head ni body)')
    args = ap.parse_args()

    html = PAGE.read_text(encoding='utf-8')
    line = 'const SPRITES = ' + json.dumps(sprites(), separators=(',', ':')) + ';'
    html, n = re.subn(r'^const SPRITES = .*;$', lambda _: line, html, count=1, flags=re.M)
    if n != 1:
        raise SystemExit('ligne « const SPRITES = … ; » introuvable dans index.html')
    PAGE.write_text(html, encoding='utf-8')
    print(f'{PAGE.relative_to(ROOT)} : images à jour')

    if args.artefact:
        # claude.ai ajoute lui-même doctype, <html>, <head> et <body> : on les retire.
        frag = re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*', '', html, flags=re.I)
        frag = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', '', frag)
        frag = re.sub(r'</head>\s*<body>\s*', '', frag)
        frag = re.sub(r'\s*</body>\s*</html>\s*$', '\n', frag)
        Path(args.artefact).write_text(frag, encoding='utf-8')
        print(f'{args.artefact} : version à publier')


if __name__ == '__main__':
    main()
