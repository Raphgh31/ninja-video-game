#!/usr/bin/env python3
"""Découpe les sons de KARASU-KASHI dans les enregistrements fournis par l'utilisateur.

    python3 tools/sons_karasu.py ailes.wav croassements.wav

(une source se tire d'une vidéo avec : ffmpeg -i video.mov -vn -c:a pcm_s16le source.wav)

Sorties (assets/sfx/, MP3 mono 96 kb/s) :
  karasu_aile_1..3.mp3  trois coups d'aile vers le bas (le « vouf »), pris à
                        1,665 s, 3,695 s et 6,725 s de l'enregistrement : 0,39 s
                        chacun, attaque au tout début du fichier (le jeu le joue
                        quand l'aile descend : image fly_3 / carry_3) ;
  karasu_croa_long.mp3  trois croassements (cris à 2,47, 3,56 et 4,65 s, 0,55 s
                        chacun, un toutes les 1,1 s) : le début du combat ;
  karasu_croa.mp3       deux croassements (cris à 7,51 et 8,62 s) : chaque retour
                        au perchoir.

Chaque son : coupure sous 80 Hz, fondu d'entrée de 4 ms, fondu de sortie,
crête ramenée à -3 dB (l'enregistrement des ailes sature par endroits).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'sfx'


def lire(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(path), '-af', 'highpass=f=80:poles=2', '-ac', '1',
                          '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def couper(x, t0, t1, fin=0.08):
    s = x[int(t0 * SR):int(t1 * SR)].copy()
    fi, fo = int(0.004 * SR), int(fin * SR)
    s[:fi] *= np.linspace(0, 1, fi)
    s[-fo:] *= np.linspace(1, 0, fo) ** 2
    return s * (10 ** (-3 / 20) / (np.abs(s).max() + 1e-9))


def ecrire(s, nom):
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / 's.wav'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', str(wav)],
                       input=s.astype(np.float32).tobytes(), check=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '96k',
                        str(OUT / nom)], check=True)
    print(f'{OUT / nom} : {len(s) / SR:.2f} s')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    ailes, croa = lire(sys.argv[1]), lire(sys.argv[2])
    for k, t in enumerate((1.665, 3.695, 6.725), 1):
        ecrire(couper(ailes, t - 0.005, t + 0.385, fin=0.12), f'karasu_aile_{k}.mp3')
    ecrire(couper(croa, 2.44, 5.45, fin=0.25), 'karasu_croa_long.mp3')
    ecrire(couper(croa, 7.48, 9.40, fin=0.24), 'karasu_croa.mp3')
