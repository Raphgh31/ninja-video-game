// Monte un Reel : compose chaque image (tools/reels/compose.js, dans un navigateur, avec la police du jeu),
// puis les assemble en MP4 (H.264, 1080 × 1920, 30 images/s) avec ffmpeg.
//   node tools/reels/monter.mjs <dossier du tournage> <sortie.mp4> [premières images seulement]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [dir, out, only] = process.argv.slice(2);
const { chromium } = createRequire(import.meta.url)('playwright');
const track = JSON.parse(readFileSync(join(dir, 'track.json'), 'utf8'));
const frames = readdirSync(join(dir, 'frames')).filter((f) => f.endsWith('.png')).sort();
const n = Math.min(frames.length, track.length, only ? +only : Infinity);
const comp = join(dir, 'comp');
rmSync(comp, { recursive: true, force: true }); mkdirSync(comp, { recursive: true });

const server = await createServer({ server: { port: 5291, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:5291/tools/reels/index.html');
await page.evaluate(async ({ track, n }) => { const m = await import('/tools/reels/compose.js'); await m.setup({ track, n }); }, { track, n });
for (let f = 0; f < n; f++) {
  const src = 'data:image/png;base64,' + readFileSync(join(dir, 'frames', frames[f])).toString('base64');
  const url = await page.evaluate(([f, src]) => window.frame(f, src), [f, src]);
  writeFileSync(join(comp, `c${String(f).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
await server.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(comp, 'c%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart', out]);
console.log(`${n} images → ${out}`);
