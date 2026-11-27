"""Planche d'un réglage à blanc : les vignettes d'un dossier, en grille, chacune numérotée (n° de l'image).
   python3 tools/reels/planche.py <dossier> <sortie.png> [colonnes]"""
import sys, glob, os
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(os.path.join(d, '*.png')))
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = 448, 252
out_im = Image.new('RGB', (w * cols, h * ((len(ims) + cols - 1) // cols)), (11, 12, 18))
dr = ImageDraw.Draw(out_im)
for i, (f, im) in enumerate(zip(fs, ims)):
    im = im.resize((w, h))
    x, y = (i % cols) * w, (i // cols) * h
    out_im.paste(im, (x, y))
    dr.text((x + 4, y + 2), os.path.basename(f)[1:-4].lstrip('0') or '0', fill=(255, 40, 40))
out_im.save(out)
