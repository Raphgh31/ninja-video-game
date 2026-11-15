#!/usr/bin/env python3
"""Prépare la musique d'un chapitre : introduction jouée une fois, puis boucle sans couture.

Étape 1 — chercher les points de boucle (deux passages de même harmonie, même
rythme et même niveau, distants d'un nombre entier de mesures) :

    python3 tools/musique_boucle.py chercher source.wav

Étape 2 — fabriquer le fichier du jeu :

    python3 tools/musique_boucle.py monter source.wav assets/music/potager.mp3 \
        --debut 0.45 --a 25.340 --b 115.339 --bpm 64

    - égalisation légère pour laisser la place aux bruitages : coupe sous 30 Hz,
      creux de 2 dB vers 3,2 kHz (lame, shuriken), aigus adoucis au-dessus de 10 kHz ;
    - fondu enchaîné à puissance constante d'un temps (ou de --fondu secondes : la
      musique du boss fond sa fin dans son début sur deux mesures), qui se termine
      sur le temps fort B (la fin de boucle se fond dans ce qui précède A) ;
    - après B, une marge de 0,4 s recopiée depuis A : la boucle reste sans couture
      même si le décodeur du navigateur décale le son (±0,2 s) ;
    - volume ramené à -16 LUFS (gain fixe, crêtes sous -1,5 dB), MP3 160 kb/s ;
    - affiche loopStart / loopEnd à reporter dans la définition du chapitre
      (champ `music`), en secondes du fichier produit.

Variante — une piste jouée en entier, sans boucle (la musique de l'introduction) :

    python3 tools/musique_boucle.py entier source.wav assets/music/intro.mp3 --debut 0.3 --note 10.60

    mêmes égalisation, volume et encodage ; --note : l'attaque de la première vraie note dans la
    source (affichée en secondes du fichier produit, pour caler l'image dessus).

La source se tire d'une vidéo avec :  ffmpeg -i video.mov -vn -c:a pcm_s16le source.wav
Demande : numpy et ffmpeg.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 44100


def lire(path, eq=False):
    """Lit un fichier audio en stéréo flottant 44,1 kHz (avec l'égalisation si demandé)."""
    filtres = ['-af', 'highpass=f=30:poles=2,equalizer=f=3200:t=q:w=0.9:g=-2,treble=g=-1.5:f=10000'] if eq else []
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(path), *filtres, '-ac', '2', '-ar', str(SR),
                          '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def chercher(path):
    x = lire(path)
    m = x.mean(1)
    H, N = 512, 2048
    fr = np.lib.stride_tricks.sliding_window_view(m, N)[::H] * np.hanning(N)
    S = np.abs(np.fft.rfft(fr, axis=1))
    fps = SR / H
    freqs = np.fft.rfftfreq(N, 1 / SR)
    L = np.log1p(S * 10)
    flux = np.maximum(0, np.diff(L, axis=0, prepend=L[:1])).sum(1)
    flux = np.maximum(0, flux - np.convolve(flux, np.ones(16) / 16, 'same'))
    # tempo : autocorrélation des attaques
    seg = flux[len(flux) // 6: -len(flux) // 20]
    ac = np.correlate(seg - seg.mean(), seg - seg.mean(), 'full')[len(seg) - 1:]
    tempos = sorted(((sum(np.interp(60 / bpm * fps * k, np.arange(len(ac)), ac) for k in (1, 2, 4)), bpm)
                     for bpm in np.arange(50, 180, 0.25)), reverse=True)
    print('tempo probable :', ', '.join(f'{b:g} BPM' for _, b in tempos[:3]))
    # chroma (harmonie) et niveau, puis comparaison de fenêtres (4 s avant, 2 s après)
    ok = (freqs > 60) & (freqs < 4000)
    pc = np.round(12 * np.log2(freqs[ok] / 440)).astype(int) % 12
    C = np.stack([S[:, ok][:, pc == k].sum(1) for k in range(12)], 1)
    C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-9
    lr = np.log(np.sqrt((fr ** 2).mean(1)) + 1e-5)
    fl = flux / (flux.std() + 1e-9)
    F = lambda s: int(round(s * fps))
    Wb, Wa = F(4), F(2)
    dur = len(m) / SR
    res = []
    for a in range(F(8), F(dur * 0.5), 2):
        for b in range(a + F(dur * 0.3), F(dur - 3), 2):
            ch = (C[a - Wb:a + Wa] * C[b - Wb:b + Wa]).sum(1).mean()
            ry = np.corrcoef(fl[a - Wb:a + Wa], fl[b - Wb:b + Wa])[0, 1]
            lv = -np.abs(lr[a - Wb:a + Wa] - lr[b - Wb:b + Wa]).mean()
            res.append((ch + 0.5 * ry + 0.3 * lv, a / fps, b / fps))
    res.sort(reverse=True)
    vus = []
    for r in res:
        if all(abs(r[1] - v[1]) > 1.5 or abs(r[2] - v[2]) > 1.5 for v in vus):
            vus.append(r)
        if len(vus) == 6:
            break
    print('meilleurs couples (affiner ensuite A et B sur un temps fort) :')
    for s, a, b in vus:
        print(f'  score {s:.3f}   A = {a:7.2f} s   B = {b:7.2f} s   boucle {b - a:6.2f} s')


def encoder(out, dst):
    """Ramène le volume à -16 LUFS (crêtes sous -1,5 dB) et encode en MP3 160 kb/s ; renvoie le gain appliqué."""
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / 'monte.wav'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        str(wav)], input=np.clip(out, -1, 1).astype(np.float32).tobytes(), check=True)
        mes = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(wav), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr.splitlines()
        I = float(next(l for l in mes if l.strip().startswith('I:')).split()[1])
        TP = float(next(l for l in mes if l.strip().startswith('Peak:')).split()[1])
        gain = min(-16 - I, -1.5 - TP)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-af', f'volume={gain:.2f}dB',
                        '-c:a', 'libmp3lame', '-b:a', '160k', str(dst)], check=True)
    return gain


def entier(src, dst, debut, note):
    """Une piste jouée une fois en entier (introduction du jeu) : début coupé, fin adoucie (0,5 s)."""
    x = lire(src, eq=True)
    out = x[int(round(debut * SR)):].copy()
    fi, fo = int(0.005 * SR), int(0.5 * SR)
    out[:fi] *= np.linspace(0, 1, fi)[:, None]
    out[-fo:] *= np.linspace(1, 0, fo)[:, None]
    gain = encoder(out, dst)
    print(f'{dst} : {len(out) / SR:.3f} s, gain {gain:+.1f} dB')
    print('à reporter dans intro.js :', json.dumps({'note': round(note - debut, 3), 'length': round(len(out) / SR, 3)}))


def monter(src, dst, debut, A, B, bpm, marge=0.40, fondu=None):
    x = lire(src, eq=True)
    a, b, s0 = (int(round(v * SR)) for v in (A, B, debut))
    nx, nm = int(round((fondu or 60 / bpm) * SR)), int(round(marge * SR))
    t = np.linspace(0, np.pi / 2, nx, endpoint=False)[:, None]
    fondu = np.cos(t) * x[b - nx:b] + np.sin(t) * x[a - nx:a]
    out = np.concatenate([x[s0:b - nx], fondu, x[a:a + nm]])
    fi, fo = int(0.005 * SR), int(0.05 * SR)
    out[:fi] *= np.linspace(0, 1, fi)[:, None]
    out[-fo:] *= np.linspace(1, 0, fo)[:, None]
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / 'monte.wav'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        str(wav)], input=np.clip(out, -1, 1).astype(np.float32).tobytes(), check=True)
        mes = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(wav), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr.splitlines()
        I = float(next(l for l in mes if l.strip().startswith('I:')).split()[1])
        TP = float(next(l for l in mes if l.strip().startswith('Peak:')).split()[1])
        gain = min(-16 - I, -1.5 - TP)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-af', f'volume={gain:.2f}dB',
                        '-c:a', 'libmp3lame', '-b:a', '160k', str(dst)], check=True)
    boucle = {'loopStart': round(A + marge / 2 - debut, 4), 'loopEnd': round(B + marge / 2 - debut, 4)}
    print(f'{dst} : {len(out) / SR:.2f} s, gain {gain:+.1f} dB')
    print('à reporter dans le chapitre :', json.dumps(boucle))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('chercher'); c.add_argument('source')
    m = sub.add_parser('monter'); m.add_argument('source'); m.add_argument('sortie')
    m.add_argument('--debut', type=float, default=0.0, help='début du fichier (s), avant le premier son')
    m.add_argument('--a', type=float, required=True, help='point de retour de la boucle (temps fort, s)')
    m.add_argument('--b', type=float, required=True, help='fin de la boucle (même temps fort, une section plus loin)')
    m.add_argument('--bpm', type=float, required=True, help='tempo (durée du fondu enchaîné : un temps)')
    m.add_argument('--fondu', type=float, default=None, help='durée du fondu enchaîné (s), au lieu d\'un temps : une transition plus douce')
    e = sub.add_parser('entier'); e.add_argument('source'); e.add_argument('sortie')
    e.add_argument('--debut', type=float, default=0.0, help='début du fichier (s), avant le premier son')
    e.add_argument('--note', type=float, required=True, help='attaque de la première vraie note dans la source (s)')
    args = ap.parse_args()
    if args.cmd == 'chercher':
        chercher(args.source)
    elif args.cmd == 'entier':
        entier(args.source, args.sortie, args.debut, args.note)
    else:
        monter(args.source, args.sortie, args.debut, args.a, args.b, args.bpm, fondu=args.fondu)
    sys.exit(0)
