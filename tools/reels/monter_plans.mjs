// Monte un Reel fait de plusieurs plans tournés (tools/reels/plan.cjs) : chaque image du Reel est composée dans
// un navigateur par le module de montage (ex. tools/reels/week1_suite.js, avec la police du jeu), qui reçoit les
// images des plans actifs à cet instant (deux pendant un raccord), puis ffmpeg assemble le MP4.
//   node tools/reels/monter_plans.mjs <montage.json> <dossier des tournages> <sortie.mp4>
//   node tools/reels/monter_plans.mjs <montage.json> <dossier des tournages> <planche.png> --images 0,30,60…
//     (quelques images seulement, en planche, pour vérifier sans tout monter)
// montage.json : { "module": "/tools/reels/week1_suite.js", "n": <images>, "plans": [{ "nom", "a" (1re image du
// Reel), "n" (nombre d'images) }] } ; les images d'un plan : <dossier>/<nom>/frames/gNNNN.png, et son track.json.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const [mfile, base, out, flag, list] = process.argv.slice(2);
const montage = JSON.parse(readFileSync(mfile, 'utf8'));
const trackOf = (nom) => { const f = join(base, nom, 'track.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [{ x: 0, cx: 0 }]; };
const tracks = Object.fromEntries(montage.plans.map((p) => [p.nom, trackOf(p.nom)]));
const only = flag === '--images' ? list.split(',').map(Number) : null;
const frames = only ?? Array.from({ length: montage.n }, (_, i) => i);
const comp = join(dirname(out), 'comp');
rmSync(comp, { recursive: true, force: true }); mkdirSync(comp, { recursive: true });

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ server: { port: 5291, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'log') console.log('page', m.text()); });
await page.goto('http://localhost:5291/tools/reels/index.html');
await page.evaluate(async ({ mod, tracks, montage }) => { const m = await import(mod); await m.setup({ tracks, montage }); }, { mod: montage.module, tracks, montage });
const png = (nom, i) => {
  const f = join(base, nom, 'frames', `g${String(i).padStart(4, '0')}.png`);
  return existsSync(f) ? 'data:image/png;base64,' + readFileSync(f).toString('base64') : null;
};
for (const [k, f] of frames.entries()) {
  const srcs = {};
  for (const p of montage.plans) if (f >= p.a && f < p.a + p.n) srcs[p.nom] = png(p.nom, Math.min(f - p.a, tracks[p.nom].length - 1));
  const url = await page.evaluate(([f, srcs]) => window.frame(f, srcs), [f, srcs]);
  writeFileSync(join(comp, `c${String(only ? k : f).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
await server.close();
if (only) {
  // la planche : les images demandées, réduites au quart, numérotées par leur temps
  execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image, ImageDraw
fs = sorted(glob.glob('${comp}/c*.png')); ts = [${frames.join(',')}]
cols = min(8, len(fs)); w, h = 270, 480
o = Image.new('RGB', (w * cols, h * ((len(fs) + cols - 1) // cols)), (40, 40, 40)); d = ImageDraw.Draw(o)
for i, f in enumerate(fs):
    x, y = (i % cols) * w, (i // cols) * h
    o.paste(Image.open(f).convert('RGB').resize((w, h)), (x, y)); d.text((x + 3, y + 2), '%.1fs' % (ts[i] / 30), fill=(255, 60, 60))
o.save('${out}')`]);
  console.log(`${frames.length} images → ${out}`);
} else {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(comp, 'c%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart', out]);
  console.log(`${frames.length} images → ${out}`);
}
