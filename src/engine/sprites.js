// Chargement d'un personnage décrit par un fichier de métadonnées (ex. kage.json),
// recoloration par skin et lecture des animations.

// Version autonome (un seul fichier HTML) : les ressources sont intégrées dans
// window.__KAGE_EMBED, indexées par leur chemin.
const embedded = (url) => globalThis.__KAGE_EMBED?.[url];

async function loadJson(url) {
  return embedded(url) ?? (await fetch(url)).json();
}

export async function loadImage(url) {
  const img = new Image();
  img.src = embedded(url) ?? url;
  await img.decode();
  return img;
}

const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Applique un skin à la carte d'index : chaque pixel porte l'index de son slot
 * dans le canal rouge (1..n), le skin donne la couleur de chaque slot.
 * Les animations restent strictement identiques d'un skin à l'autre.
 */
export function applySkin(indexImage, meta, skin) {
  const { width: w, height: h } = indexImage;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(indexImage, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const lut = [];
  for (const { index, slot } of meta.slots) lut[index] = hexToRgb(skin.colors[slot]);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const c = lut[px[i]];
    if (!c) continue;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function loadCharacter(baseUrl, metaFile, skinIds) {
  const meta = await loadJson(`${baseUrl}/${metaFile}`);
  const indexImage = await loadImage(`${baseUrl}/${meta.indexImage}`);
  const projIndex = {};
  for (const [name, p] of Object.entries(meta.projectiles ?? {})) {
    projIndex[name] = await loadImage(`${baseUrl}/${p.indexImage}`);
  }
  const skins = {};
  for (const id of skinIds ?? meta.skins) {
    const skin = await loadJson(`${baseUrl}/skins/${id}.json`);
    const projectiles = {};
    for (const [name, img] of Object.entries(projIndex)) projectiles[name] = applySkin(img, meta, skin);
    skins[id] = { ...skin, sheet: applySkin(indexImage, meta, skin), projectiles };
  }
  return { meta, skins };
}

/** Lecteur d'animation : durées par frame, boucle partielle (loopStart). */
export class Animator {
  constructor(meta) {
    this.meta = meta;
    this.name = null;
    this.frame = 0;
    this.time = 0;
    this.finished = false;
  }

  play(name, { restart = false } = {}) {
    if (!this.meta.animations[name]) throw new Error(`animation inconnue : ${name}`);
    if (this.name === name && !restart) return;
    this.name = name;
    this.frame = 0;
    this.time = 0;
    this.finished = false;
  }

  get anim() {
    return this.meta.animations[this.name];
  }

  update(dt) {
    const a = this.anim;
    this.time += dt * 1000;
    while (this.time >= a.frames[this.frame].duration) {
      this.time -= a.frames[this.frame].duration;
      if (this.frame < a.frameCount - 1) {
        this.frame++;
      } else if (a.loop) {
        this.frame = a.loopStart;
      } else {
        this.finished = true;
        this.time = 0;
        break;
      }
    }
  }

  /** Dessine la frame courante ; (x, y) = point d'ancrage (sous les pieds). */
  draw(ctx, sheet, x, y, facing = 1) {
    const f = this.anim.frames[this.frame];
    const { pivot } = this.meta;
    const dx = Math.round(x);
    const dy = Math.round(y) - pivot.y;
    ctx.save();
    if (facing < 0 && this.meta.flipForLeft) {
      ctx.translate(dx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -pivot.x, dy, f.w, f.h);
    } else {
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, dx - pivot.x, dy, f.w, f.h);
    }
    ctx.restore();
  }
}
