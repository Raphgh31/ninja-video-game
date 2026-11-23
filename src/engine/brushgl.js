// Le pinceau « en direct » (carte graphique) : repeint une image en pixels en touches d'aquarelle, à
// chaque image, pour tout ce qui bouge ou change (terrain, eau, pièges, effets, menus, intro).
// Demande de Raph (novembre 2026) : que tout le jeu adopte le style peint, de façon cohérente, avec des
// touches fines sur les détails et plus larges sur les aplats (le sol, le ciel), un peu courbes et
// aléatoires (pas de « briques »).
//
// Principe : deux motifs de touches (fines et larges), calculés une fois. Chaque texel du motif dit
// « je fais partie de telle touche » : le décalage vers le centre de la touche, et sa teinte (bord plus
// chargé, fin qui s'éclaircit). Pour chaque pixel de l'écran, on lit le motif à sa position dans le monde
// (les touches sont accrochées au monde : elles ne glissent pas quand la caméra bouge), puis la couleur
// de l'image au centre de la touche : toute la touche prend une seule couleur, comme un coup de pinceau.
// Là où l'image est détaillée (au centre d'une touche large), on prend les touches fines.

const T = 128;          // un motif couvre 128 × 128 pixels de jeu…
const R = 4;            // … à 4 texels par pixel de jeu (texture 512 × 512, qui se répète)

function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Un motif de touches (texture RGBA 512 × 512) : R, G = décalage vers le centre de la touche (pixels de
 * jeu, ×16, centré sur 128) ; B = teinte de la touche (×200). len, wid : taille en pixels de jeu.
 */
export function strokeMap({ len, wid, curve = 0.08, count, seed = 1 }) {
  const S = T * R, r = rand(seed);
  const ox = new Float32Array(S * S), oy = new Float32Array(S * S), sh = new Float32Array(S * S).fill(1);
  count ??= Math.round((T * T) / (len * wid) * 2.6);
  for (let k = 0; k < count; k++) {
    const cx = r() * T, cy = r() * T;
    const L = len * (0.7 + r() * 0.6), W = wid * (0.75 + r() * 0.5);
    const a = (r() - 0.5) * Math.PI * (0.55 + 0.45 * r()) + (r() < 0.5 ? 0 : Math.PI / 2) * (r() < 0.35 ? 1 : 0);
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const kv = (r() - 0.5) * 2 * curve / Math.max(1, L * 0.25);       // une petite courbe
    const tone = 0.97 + r() * 0.06;
    const rr = (L / 2 + W) * R;
    const x0 = Math.floor(cx * R - rr), x1 = Math.ceil(cx * R + rr), y0 = Math.floor(cy * R - rr), y1 = Math.ceil(cy * R + rr);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const tx = (px + 0.5) / R - cx, ty = (py + 0.5) / R - cy;
      const s = tx * dx + ty * dy;
      if (Math.abs(s) > L / 2) continue;
      const u = s / (L / 2);
      const half = (W / 2) * (u > 0.4 ? 1 - (u - 0.4) * 1.1 : u < -0.75 ? 0.6 + (u + 1) * 1.6 : 1);   // attaque ronde, fin effilée
      const lat = tx * nx + ty * ny - kv * s * s;
      if (Math.abs(lat) > half) continue;
      const i = (((py % S) + S) % S) * S + (((px % S) + S) % S);
      ox[i] = -tx; oy[i] = -ty;
      const edge = Math.abs(lat) / Math.max(0.01, half);
      sh[i] = tone * (edge > 0.72 ? 0.93 : 1) * (u > 0.6 ? 1.03 : 1);       // bord un peu chargé, fin plus claire
    }
  }
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = Math.max(0, Math.min(255, Math.round(128 + ox[i] * 16)));
    data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(128 + oy[i] * 16)));
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(sh[i] * 200)));
    data[i * 4 + 3] = 255;
  }
  return { data, size: S };
}

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
varying vec2 uv;
uniform sampler2D src, mapF, mapW, grain;
uniform vec2 size;       // taille de l'image source (pixels de jeu)
uniform vec2 cam;        // position du coin haut-gauche de l'image dans le monde (pixels de jeu)
uniform float detail, wide, ink, paper, soft, keep, amp, edge;
vec3 stroke(sampler2D m, vec2 g) {
  vec4 t = texture2D(m, fract((g + cam) / ${T}.0));
  return vec3((t.rg * 255.0 - 128.0) / 16.0, t.b * 255.0 / 200.0);
}
vec4 at1(vec2 g) { return texture2D(src, (floor(clamp(g, vec2(0.0), size - 0.5)) + 0.5) / size); }
// la couleur d'une touche : un léger mélange avec ses voisins (le tramage des pixels se fond dans la touche)
vec4 at(vec2 g) { return mix(at1(g), 0.25 * (at1(g + vec2(1.0, 0.0)) + at1(g + vec2(0.0, 1.0)) + at1(g - vec2(1.0, 0.0)) + at1(g - vec2(0.0, 1.0))), 0.55 * soft); }
void main() {
  vec2 g = uv * size;
  vec3 sw = stroke(mapW, g);
  vec2 cw = g + sw.xy;
  vec4 c0 = at1(cw);
  float d = max(distance(c0, at1(cw + vec2(2.0, 0.0))), distance(c0, at1(cw + vec2(0.0, 2.0))));
  vec3 s = (d > detail || wide < 0.5) ? stroke(mapF, g) : sw;
  vec4 c = at(g + amp * s.xy);
  // keep : la touche ne franchit pas un bord net (le point garde sa propre couleur) : les formes restent précises
  vec4 own = at1(g);
  if (keep > 0.0) {
    float k = abs(c.a - own.a) > 0.3 ? 1.0 : smoothstep(keep, keep + 0.2, distance(c.rgb, own.rgb));
    c = mix(c, own, k);
  }
  c.rgb *= mix(1.0, s.z, ink);
  // edge : un trait d'encre léger le long des bords nets (les formes se lisent)
  if (edge > 0.0) {
    float e = max(max(distance(own, at1(g + vec2(1.0, 0.0))), distance(own, at1(g - vec2(1.0, 0.0)))), max(distance(own, at1(g + vec2(0.0, 1.0))), distance(own, at1(g - vec2(0.0, 1.0)))));
    c.rgb *= 1.0 - edge * smoothstep(0.35, 0.7, e);
  }
  // le grain du papier, très discret
  float gr = texture2D(grain, fract((g + cam) / 64.0)).r;
  c.rgb *= 1.0 + (gr - 0.5) * paper;
  gl_FragColor = c;
}`;

/** Le moteur : une seule toile WebGL, partagée par tous les calques (jeu, menus, intro). */
export class BrushGL {
  constructor() {
    this.cv = document.createElement('canvas');
    const gl = this.gl = this.cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) { this.ok = false; return; }
    this.ok = true;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, data, size, repeat) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
      if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return t;
    };
    this.maps = {};
    const set = (name, unit, map) => { this.maps[name] = { unit, tex: tex(unit, map.data, map.size, true) }; };
    set('fine', 1, strokeMap({ len: 2.4, wid: 1.25, curve: 0.12, seed: 3 }));
    set('wide', 2, strokeMap({ len: 6.5, wid: 2.4, curve: 0.18, seed: 5 }));
    set('huge', 4, strokeMap({ len: 11, wid: 3.6, curve: 0.22, seed: 7 }));
    set('mid', 6, strokeMap({ len: 4, wid: 1.7, curve: 0.14, seed: 17 }));
    // (le premier plan : des touches un peu plus longues et plus droites, moins nombreuses : un trait plus continu)
    set('line', 7, strokeMap({ len: 5, wid: 1.4, curve: 0.04, seed: 19 }));
    set('tiny', 5, strokeMap({ len: 1.25, wid: 0.75, curve: 0.06, seed: 13 }));
    // le grain du papier (64 × 64 pixels de jeu, à 4 texels par pixel : 256)
    const gr = new Uint8Array(256 * 256 * 4), r = rand(9);
    for (let i = 0; i < 256 * 256; i++) { const v = 128 + (r() - 0.5) * 120; gr[i * 4] = gr[i * 4 + 1] = gr[i * 4 + 2] = v; gr[i * 4 + 3] = 255; }
    this.grain = tex(3, gr, 256, true);
    this.srcTex = tex(0, null, 0, false);
    this.u = {};
    for (const n of ['src', 'mapF', 'mapW', 'grain', 'size', 'cam', 'detail', 'wide', 'ink', 'paper', 'soft', 'keep', 'amp', 'edge']) this.u[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(this.u.src, 0); gl.uniform1i(this.u.grain, 3);
  }

  /**
   * Repeint src (toile en pixels de jeu) et le pose dans ctx (toile k fois plus fine), en (dx, dy) en pixels
   * de toile. o : { cam (coin haut-gauche dans le monde), fine : 'fine', wide : 'wide' | 'huge' | null (pas
   * de touches larges), detail (seuil), ink (force des bords de touche), paper (grain) }.
   */
  paint(ctx, src, k, o = {}) {
    if (!this.ok) { ctx.drawImage(src, 0, 0, src.width * k, src.height * k); return; }
    // (au-delà de 3 points par pixel de jeu — téléphones —, on peint à 2 puis on agrandit en douceur)
    const kk = k > 3 ? 2 : k, gl = this.gl, W = Math.round(src.width * kk), H = Math.round(src.height * kk);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const F = this.maps[o.fine ?? 'fine'], Wd = this.maps[o.wide ?? 'wide'] ?? F;
    gl.uniform1i(this.u.mapF, F.unit); gl.uniform1i(this.u.mapW, Wd.unit);
    gl.uniform2f(this.u.size, src.width, src.height);
    gl.uniform2f(this.u.cam, o.cam?.x ?? 0, o.cam?.y ?? 0);
    gl.uniform1f(this.u.detail, o.detail ?? 0.32);
    gl.uniform1f(this.u.wide, o.wide === null ? 0 : 1);
    gl.uniform1f(this.u.ink, o.ink ?? 1);
    gl.uniform1f(this.u.paper, o.paper ?? 0.08);
    gl.uniform1f(this.u.soft, o.soft ?? 1);
    gl.uniform1f(this.u.keep, o.keep ?? 0);
    gl.uniform1f(this.u.amp, o.amp ?? 1);
    gl.uniform1f(this.u.edge, o.edge ?? 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = kk !== k;
    ctx.drawImage(this.cv, o.dx ?? 0, o.dy ?? 0, src.width * k, src.height * k);
    ctx.restore();
  }
}

let shared = null;
/** Le moteur partagé (créé à la première demande). */
export function brushGL() { return (shared ??= new BrushGL()); }

/** Le réglage commun : style peint actif, et pixels d'écran par pixel de jeu (mis à jour par main.js). */
export const brushView = { on: false, k: 1 };

/**
 * Une toile peinte pour l'interface (intro, menus, boutique, salon) : on dessine en pixels de jeu sur
 * `src` ; `el` (dans la page, k fois plus fine) reçoit la version peinte à chaque present().
 */
export class BrushedCanvas {
  constructor(cls) {
    this.src = document.createElement('canvas');
    this.el = document.createElement('canvas');
    if (cls) this.el.className = cls;
    this.g = this.src.getContext('2d');
    this.d = this.el.getContext('2d');
    this.top = document.createElement('canvas');      // par-dessus la peinture : les textes lisses
    this.tg = this.top.getContext('2d');
  }

  size(w, h) {
    const k = brushView.k;
    if (this.src.width !== w || this.src.height !== h) { this.src.width = w; this.src.height = h; }
    if (this.el.width !== w * k || this.el.height !== h * k) { this.el.width = w * k; this.el.height = h * k; }
    this.el.style.width = `${w}px`; this.el.style.height = `${h}px`;
    if (this.top.width !== w * k || this.top.height !== h * k) { this.top.width = w * k; this.top.height = h * k; }
    this.tg.setTransform(k, 0, 0, k, 0, 0);
    this.g.imageSmoothingEnabled = false;
  }

  present(o = {}) {
    this.d.setTransform(1, 0, 0, 1, 0, 0);
    this.d.clearRect(0, 0, this.el.width, this.el.height);
    brushGL().paint(this.d, this.src, this.el.width / this.src.width, o);
    this.d.drawImage(this.top, 0, 0);
    this.tg.save(); this.tg.setTransform(1, 0, 0, 1, 0, 0); this.tg.clearRect(0, 0, this.top.width, this.top.height); this.tg.restore();
  }
}

/** Un texte lisse (police élégante, sans pixels), posé dans un contexte en pixels de jeu ; mis en cache. */
const smoothCache = new Map();
export function smoothText(ctx, renderSmooth, text, x, y, opts = {}, align = 'left') {
  const key = `${text}|${opts.font}|${opts.color}|${opts.outline}|${opts.spacing}`;
  let c = smoothCache.get(key);
  if (!c) { c = renderSmooth(text, opts); smoothCache.set(key, c); if (smoothCache.size > 400) smoothCache.delete(smoothCache.keys().next().value); }
  const w = c.width / c.P, h = c.height / c.P;
  const X = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const s = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, X, y, w, h);
  ctx.imageSmoothingEnabled = s;
  return w;
}
