"""Planche des propositions de bouton de pause (« La halte »), 25 novembre 2026.
   python3 tools/maquettes/bouton_pause.py <capture du jeu 448×252 ou plus> <sortie.png>"""
import sys
from PIL import Image, ImageDraw, ImageFont

INK, WARM, DIM = (232, 222, 196), (243, 180, 90), (150, 140, 120)
ICONS = {
  'A · La lanterne de pierre': [
    '.....#.....', '....###....', '..#######..', '...#####...', '...#ooo#...', '...#ooo#...',
    '...#####...', '..#######..', '....###....', '....###....', '..#######..'],
  'B · Le feu de camp': [
    '.....o.....', '....oo.....', '....oo.o...', '...ooo.oo..', '..oooooooo.', '..ooo##ooo.',
    '...oo##oo..', '#..oooooo.#', '.##.oooo.##', '...######..', '.##......##'],
  'C · Le sablier': [
    '###########', '.#.......#.', '.#.ooooo.#.', '..#.ooo.#..', '...#.o.#...', '....#o#....',
    '...#.o.#...', '..#.....#..', '.#..ooo..#.', '.#ooooooo#.', '###########'],
  'D · Le croissant de lune': [
    '....###....', '..###......', '.###.......', '.##........', '###......o.', '###........',
    '###....o...', '.##........', '.###.......', '..###......', '....###....'],
  'E · Le torii': [
    '###########', '.#########.', '..#.....#..', '###########', '..#..o..#..', '..#.....#..',
    '..#.....#..', '..#.....#..', '..#.....#..', '..#.....#..', '.###...###.'],
  'F · Le bol de thé fumant': [
    '...#...#...', '....#...#..', '...#...#...', '....#...#..', '...........', '###########',
    '.#ooooooo#.', '.#.......#.', '..#.....#..', '...#####...', '..#######..'],
}
HOUSE = ['....#....', '...#.#...', '..#...#..', '.#.....#.', '#########', '.#.....#.', '.#..#..#.', '.#..#..#.', '.#######.']

def draw(img, grid, x, y, k=1, ink=INK, warm=WARM, outline=None):
    d = ImageDraw.Draw(img)
    if outline:
        # un contour sombre d'un pixel, pour rester lisible sur un fond clair
        H, Wd = len(grid), len(grid[0])
        on = lambda i, j: 0 <= j < H and 0 <= i < Wd and grid[j][i] in '#o'
        for j in range(-1, H + 1):
            for i in range(-1, Wd + 1):
                if not on(i, j) and any(on(i + a, j + b) for a in (-1, 0, 1) for b in (-1, 0, 1)):
                    d.rectangle([x + i * k, y + j * k, x + (i + 1) * k - 1, y + (j + 1) * k - 1], fill=outline)
    for j, row in enumerate(grid):
        for i, c in enumerate(row):
            if c in '#o':
                d.rectangle([x + i * k, y + j * k, x + (i + 1) * k - 1, y + (j + 1) * k - 1], fill=ink if c == '#' else warm)

shot = Image.open(sys.argv[1]).convert('RGB').resize((448, 252), Image.NEAREST)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 26)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 18)
CW, CH = 980, 330
board = Image.new('RGB', (CW * 2 + 60, CH * 3 + 140), (14, 16, 24))
bd = ImageDraw.Draw(board)
bd.text((30, 24), 'Le bouton de la halte — six propositions (11 × 11 pixels de jeu)', font=font, fill=INK)
bd.text((30, 62), 'À gauche : le logo agrandi ×12, et la petite maison des menus pour comparer la taille. À droite : en jeu, en haut à droite, avec un contour sombre (zoom ×4).', font=small, fill=DIM)
for n, (name, grid) in enumerate(ICONS.items()):
    ox, oy = 30 + (n % 2) * (CW + 0), 110 + (n // 2) * CH
    bd.rectangle([ox, oy, ox + CW - 20, oy + CH - 20], fill=(20, 23, 34))
    bd.text((ox + 16, oy + 10), name, font=font, fill=INK)
    draw(board, grid, ox + 30, oy + 60, 12)
    draw(board, HOUSE, ox + 200, oy + 180, 6)
    g = shot.copy()
    draw(g, grid, 448 - 18 - 11, 7, 1, outline=(22, 20, 30))
    g = g.crop((448 - 112, 0, 448, 63)).resize((448, 252), Image.NEAREST)
    board.paste(g, (ox + CW - 20 - 448 - 14, oy + 50))
board.save(sys.argv[2])
