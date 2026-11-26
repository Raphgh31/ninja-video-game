"""La police du jeu (26 novembre 2026, choix de Raph sur les planches docs/polices/ : n° 17, Yusei Magic).

Réduit la police (tools/polices/YuseiMagic.ttf, licence SIL OFL, Google Fonts) aux seuls signes dont le jeu a
besoin (latin, accents, ponctuation française, flèches, puces), la compresse (woff2) et l'écrit, en base 64,
dans src/engine/fontdata.js : la police voyage dans le code, la version autonome n'a rien à télécharger.

    python3 tools/police_jeu.py        (demande : pip install fonttools brotli)
"""
import base64
import io
import os

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'polices', 'YuseiMagic.ttf')
OUT = os.path.join(ROOT, 'src', 'engine', 'fontdata.js')

TEXT = ''.join(chr(c) for c in range(0x20, 0x7f)) + ''.join(chr(c) for c in range(0xa0, 0x180)) \
    + '«»‘’“”…·—–•←→↑↓×°№ōŌœŒ' + '✓✗'

if not os.path.exists(SRC):    # (la police complète, 3 Mo, n'est pas gardée dans le dépôt)
    import urllib.request
    os.makedirs(os.path.dirname(SRC), exist_ok=True)
    urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/yuseimagic/YuseiMagic-Regular.ttf', SRC)
font = TTFont(SRC)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['kern', 'liga', 'calt']
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(text=TEXT)
sub.subset(font)
buf = io.BytesIO()
font.flavor = 'woff2'
font.save(buf)
data = base64.b64encode(buf.getvalue()).decode()
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// La police du jeu : Yusei Magic (SIL OFL), réduite aux signes du jeu — fichier généré par\n'
            '// tools/police_jeu.py, ne pas éditer à la main.\n')
    f.write(f"export const GAME_FONT = 'Yusei Magic';\nexport const GAME_FONT_WOFF2 = '{data}';\n")
print(f'{OUT} : {len(buf.getvalue()) // 1024} Ko')
