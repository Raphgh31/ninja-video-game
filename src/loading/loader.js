// L'écran de chargement (24 novembre 2026, idée de Raph) : le ninja court, lentement, à travers une journée.
// Comme dans les écrans de chargement de ce genre de jeux, il court presque sur place pendant que le monde
// défile derrière lui, en parallaxe (une boucle sans fin) : les deux chaînes de montagnes de l'intro (et du
// Potager), très lentes ; le sentier et ses lanternes de pierre ; un premier plan d'herbes sombres, plus vite.
// La journée passe : il entre à gauche au petit matin et gagne peu à peu la droite ; la lune décrit un cercle
// (basse à gauche le matin, en haut à midi quand il est au milieu, basse à droite le soir), le soir rosit la
// neige des sommets, il sort de l'image, la nuit passe (étoiles, lanternes allumées, lucioles), et il
// réapparaît à gauche avec le jour.
//
// Ce fichier n'est pas un module du jeu : vite.config.js le copie tel quel dans index.html, avec ses images
// intégrées (la course du ninja, les deux chaînes : tools/ecran_chargement.mjs), pour qu'il démarre avant
// tout le reste. Le dessin tourne dans un worker (une toile « hors écran ») : il continue de s'animer pendant
// que le jeu calcule d'un seul tenant. Sans worker possible, il tourne ici même (et peut se figer par moments).
(function () {
  const root = document.querySelector('.loading');
  if (!root) return;

  /**
   * La scène, dessinée en pixels de jeu (W × H) puis agrandie k fois, nette. Rien d'extérieur : elle est
   * recopiée telle quelle dans le worker. mk(w, h) : une toile.
   */
  function scene(out, mk) {
    let W = 448, H = 252, K = 1, P = null, g = null, sky = null, L = null, lg = null;
    const IMG = { far: null, mid: null, run: null };
    const NIGHT_IMG = {}, GLOW = {}, DARK = {};
    // la journée : 16 s de course (de l'aube au soir), 3,6 s de nuit sans lui
    const DAY = 16, NIGHT = 3.6, CYCLE = DAY + NIGHT;
    // la course lente : l'animation à 8 images/s (au lieu de 12 en jeu, à 96 px/s) : ses pieds avancent de
    // 64 px/s ; il gagne la droite à (W + 52) / DAY, le sentier défile du reste
    const FPS = 8, FOOT = 96 * FPS / 12;
    const rnd = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    // chaque couleur du décor a trois moments (nuit, crépuscule, jour) ; tone() les mêle selon la lumière
    const PAL = {
      skyTop: ['#04060f', '#2a2a5e', '#3d74ba'], skyMid: ['#0a1022', '#8a5a7e', '#73a3d6'], skyLow: ['#16203a', '#f2a273', '#bcdaf0'],
      earth: ['#07080b', '#241a1c', '#3f3022'], earthDk: ['#040506', '#170f12', '#2a2017'], path: ['#14161c', '#4a3a36', '#6c5a44'],
      grass: ['#0f1a1a', '#55663a', '#6a9a3e'], grassLt: ['#1a2a28', '#8a8a4a', '#9cc458'],
      stone: ['#262a36', '#6a6070', '#8e8e94'], cloud: ['#1c2244', '#f0b4a0', '#f6f8fb'], fore: ['#020304', '#120c10', '#1a2418'],
    };
    for (const k in PAL) PAL[k] = PAL[k].map(hex);
    // les couleurs de nuit des montagnes, celles de l'intro (une encre bleue, de la crête au pied)
    const NFAR = ['#04070b', '#0a111c', '#121c2c', '#1b293e', '#273a54', '#3a4f6c', '#52698a'].map(hex);
    const NMID = ['#04070b', '#081019', '#0e1824', '#152234', '#1f2e44', '#2c3f58'].map(hex);
    let light = 1;
    const tone = (k) => { const p = PAL[k]; return light < 0.5 ? mix(p[0], p[1], light * 2) : mix(p[1], p[2], (light - 0.5) * 2); };

    let gy = 0, stars = [], clouds = [];
    function build() {
      gy = Math.round(H * 0.84);
      stars = Array.from({ length: Math.round(W * H / 520) }, (_, i) => ({ x: Math.floor(rnd(i, 1) * W), y: Math.floor(Math.pow(rnd(i, 2), 1.6) * H * 0.62), b: rnd(i, 3), p: rnd(i, 4) * 6.28, big: rnd(i, 5) > 0.93 }));
      clouds = [0, 1, 2, 3].map((i) => ({ x: rnd(i, 31) * (W + 120), y: H * (0.08 + rnd(i, 32) * 0.22), w: 26 + Math.floor(rnd(i, 33) * 34), v: 1.5 + rnd(i, 34) * 2.5 }));
      sky = g.createImageData(W, H);
      L = mk(W, H); lg = L.getContext('2d');
    }
    // le sentier : une ligne qui ondule (périodique, pour défiler sans fin), en coordonnées du monde
    const pathAt = (wx) => Math.round(gy + 2.2 * Math.sin(wx * 0.031) + 1.5 * Math.sin(wx * 0.083 + 1.3) + 0.8 * Math.sin(wx * 0.19 + 0.4));

    /** Les versions de nuit (couleurs de l'intro, selon la clarté) et la neige qui rosit, peintes une fois. */
    function prepMountains(name, ramp) {
      const im = IMG[name], w = im.width, h = im.height;
      const c = mk(w, h), cg = c.getContext('2d');
      cg.drawImage(im, 0, 0);
      const d = cg.getImageData(0, 0, w, h).data;
      const night = cg.createImageData(w, h), nd = night.data;
      const glow = cg.createImageData(w, h), gd = glow.data;
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (d[o + 3] < 8) continue;
        const l = (0.3 * d[o] + 0.55 * d[o + 1] + 0.15 * d[o + 2]) / 255;
        const x = i % w, y = (i / w) | 0;
        const th = BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
        const k = Math.max(0, Math.min(ramp.length - 1, Math.round(l * (ramp.length - 1) * 1.05 - 0.4 + th * 0.9)));
        nd[o] = ramp[k][0]; nd[o + 1] = ramp[k][1]; nd[o + 2] = ramp[k][2]; nd[o + 3] = d[o + 3];
        // la neige et les crêtes claires : elles prendront la lumière rose du soir et du matin
        if (l > 0.72) { const a = Math.min(1, (l - 0.72) / 0.2); gd[o] = 255; gd[o + 1] = 150; gd[o + 2] = 130; gd[o + 3] = 255 * a; }
      }
      const nc = mk(w, h); nc.getContext('2d').putImageData(night, 0, 0);
      const gc = mk(w, h); gc.getContext('2d').putImageData(glow, 0, 0);
      NIGHT_IMG[name] = nc; GLOW[name] = gc;
    }

    function drawSky(alt, t) {
      const d = sky.data;
      const top = tone('skyTop'), midc = tone('skyMid'), low = tone('skyLow');
      for (let y = 0; y < H; y++) {
        const f = Math.min(1, y / gy);
        const c0 = f < 0.55 ? mix(top, midc, f / 0.55) : mix(midc, low, (f - 0.55) / 0.45);
        // des bandes de couleur tramées, comme le ciel du jeu
        for (let x = 0; x < W; x++) {
          const th = BAYER[(y & 3) * 4 + (x & 3)] / 16, q = 6, o = (y * W + x) * 4;
          d[o] = Math.floor(c0[0] / q + th) * q; d[o + 1] = Math.floor(c0[1] / q + th) * q; d[o + 2] = Math.floor(c0[2] / q + th) * q; d[o + 3] = 255;
        }
      }
      g.putImageData(sky, 0, 0);
      const night = ss(0.14, -0.25, alt);
      if (night > 0.02) for (const s of stars) {
        const a = night * (0.35 + 0.65 * s.b) * (0.5 + 0.5 * Math.sin(t * (1.1 + s.b * 2.2) + s.p));
        g.fillStyle = `rgba(226,232,255,${a.toFixed(2)})`; g.fillRect(s.x, s.y, 1, 1);
        if (s.big && a > 0.5) { g.fillStyle = `rgba(226,232,255,${(a * 0.3).toFixed(2)})`; g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
      }
    }

    function drawMoon(mx, my) {
      const R = Math.max(7, Math.round(H * 0.045)), x0 = Math.round(mx), y0 = Math.round(my);
      // sa clarté : des disques de plus en plus larges et pâles (des paliers nets, comme le jeu)
      const halo = mix([255, 232, 196], [180, 198, 255], 1 - light);
      for (const [f, a] of [[3.4, 0.04], [2.6, 0.05], [1.9, 0.07], [1.4, 0.11]]) {
        const r = Math.round(R * f);
        g.fillStyle = css(halo, (a * (0.8 + 0.7 * (1 - light))).toFixed(3));
        for (let yy = -r; yy <= r; yy++) { const ww = Math.floor(Math.sqrt(r * r - yy * yy)); g.fillRect(x0 - ww, y0 + yy, ww * 2 + 1, 1); }
      }
      const base = mix([226, 222, 210], [248, 244, 232], light);
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
        const dd = xx * xx + yy * yy;
        if (dd > R * R) continue;
        const k = Math.sqrt(dd) / R;
        let l = 0.95 - 0.2 * k - 0.18 * Math.max(0, (xx + yy) / R) + (rnd(xx >> 1, yy >> 1, 5) - 0.5) * 0.1;
        if (rnd((xx + 9) >> 2, (yy + 5) >> 2, 6) > 0.84 && k < 0.82) l -= 0.1;   // des mers sombres
        g.fillStyle = css(base.map((v) => v * (0.7 + 0.3 * Math.max(0, Math.min(1, l)))));
        g.fillRect(x0 + xx, y0 + yy, 1, 1);
      }
    }

    function drawClouds(t) {
      const c = tone('cloud'), under = mix(c, tone('skyMid'), 0.3);
      for (const cl of clouds) {
        const x = Math.round(((cl.x - t * cl.v) % (W + 120) + W + 120) % (W + 120)) - 60, y = Math.round(cl.y);
        g.fillStyle = css(c, 0.9);
        g.fillRect(x, y, cl.w, 2); g.fillRect(x + 4, y - 2, cl.w - 10, 2); g.fillRect(x + 9, y - 3, Math.round(cl.w * 0.35), 1);
        g.fillStyle = css(under, 0.85); g.fillRect(x + 2, y + 2, cl.w - 4, 1);
      }
    }

    function drawBirds(t, alt) {
      if (alt < 0.2) return;
      g.fillStyle = css(mix(tone('skyTop'), [0, 0, 0], 0.55), Math.min(1, (alt - 0.2) * 4).toFixed(2));
      for (let i = 0; i < 3; i++) {
        const x = Math.round(W + 20 - ((t * (7 + i * 1.5) + i * 140) % (W + 60))), y = Math.round(H * (0.2 + i * 0.045) + Math.sin(t * 1.7 + i) * 2);
        const wing = Math.floor(t * 4 + i) % 2;
        g.fillRect(x - 2, y - wing, 2, 1); g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - wing, 2, 1);
      }
    }

    /** Une chaîne : son dessin du jour, sa version de nuit en fondu, la neige qui rosit au soir et au matin. */
    function drawRange(name, off, y, n, glow, warm) {
      const im = IMG[name], w = im.width, x0 = -(((Math.round(off) % w) + w) % w);
      lg.clearRect(0, 0, W, H);
      for (let x = x0; x < W; x += w) {
        lg.globalAlpha = 1; lg.drawImage(im, x, y);
        if (n > 0.01) { lg.globalAlpha = n; lg.drawImage(NIGHT_IMG[name], x, y); }
        if (glow > 0.01) { lg.globalAlpha = glow; lg.drawImage(GLOW[name], x, y); }
      }
      lg.globalAlpha = 1;
      // la chaleur du soir et du matin sur toute la chaîne (seulement ses pixels)
      if (warm > 0.01) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = `rgba(255,140,100,${(0.2 * warm).toFixed(3)})`; lg.fillRect(0, 0, W, H); lg.globalCompositeOperation = 'source-over'; }
      g.drawImage(L, 0, 0);
    }

    function drawGround(scroll, t, lampOn) {
      const e = tone('earth'), ed = tone('earthDk'), pa = tone('path'), gr = tone('grass'), gl = tone('grassLt'), st0 = tone('stone');
      const s0 = Math.round(scroll);
      for (let x = 0; x < W; x++) {
        const wx = x + s0, y = pathAt(wx);
        g.fillStyle = css(e); g.fillRect(x, y + 1, 1, H - y);
        // le sentier, tassé et plus clair, sous l'herbe du bord ; la terre fonce vers le bas
        g.fillStyle = css(pa); g.fillRect(x, y + 2, 1, 3 + (rnd(Math.floor(wx / 3), 43) > 0.6 ? 1 : 0));
        g.fillStyle = css(ed); g.fillRect(x, y + 8 + (rnd(wx, 41) > 0.5 ? 1 : 0), 1, H - y);
        g.fillStyle = css(gr); g.fillRect(x, y, 1, 2);
        const r = rnd(wx, 44);
        if (r > 0.72) { g.fillStyle = css(gl); g.fillRect(x, y - (r > 0.9 ? 2 : 1), 1, r > 0.9 ? 2 : 1); }
        if (rnd(wx, 46) > 0.965) { g.fillStyle = css(st0, 0.7); g.fillRect(x, y + 10 + Math.floor(rnd(wx, 47) * (H - y - 12)), 2, 1); }
      }
      // les lanternes de pierre, le long du sentier (une tous les 190 px du monde), allumées le soir
      const step = 210;
      for (let k = Math.floor((s0 - 80) / step); k * step < s0 + W + 20; k++) {
        const wx = k * step + 60, lx = wx - s0, y = pathAt(wx);
        // une lanterne de pierre (tōrō), comme celles du Potager : socle, fût, plateau, chambre à lumière, toit relevé
        const S1 = mix(st0, [0, 0, 0], 0.45), S2 = mix(st0, [0, 0, 0], 0.22), S3 = st0, S4 = mix(st0, [255, 244, 228], 0.22);
        const X = lx, Y = y + 1;
        g.fillStyle = css(S2); g.fillRect(X - 7, Y - 3, 15, 3); g.fillStyle = css(S4); g.fillRect(X - 7, Y - 3, 15, 1);
        g.fillStyle = css(S3); g.fillRect(X - 3, Y - 16, 7, 13); g.fillStyle = css(S4); g.fillRect(X - 3, Y - 16, 2, 13); g.fillStyle = css(S1); g.fillRect(X + 2, Y - 16, 2, 13);
        g.fillStyle = css(S2); g.fillRect(X - 6, Y - 19, 13, 3); g.fillStyle = css(S4); g.fillRect(X - 6, Y - 19, 13, 1);
        g.fillStyle = css(S3); g.fillRect(X - 5, Y - 26, 11, 7); g.fillStyle = css(S1); g.fillRect(X - 3, Y - 25, 7, 5);
        for (let j = 0; j < 5; j++) { g.fillStyle = css(j === 0 ? S1 : j > 2 ? S2 : S3); g.fillRect(X - 9 + j, Y - 27 - j, 19 - j * 2, 1); }
        g.fillStyle = css(S2); g.fillRect(X - 10, Y - 28, 1, 1); g.fillRect(X + 10, Y - 28, 1, 1);
        g.fillStyle = css(S3); g.fillRect(X - 1, Y - 34, 3, 3); g.fillStyle = css(S4); g.fillRect(X, Y - 35, 1, 1);
        const fl = 0.86 + 0.14 * Math.sin(t * 9 + k * 2.1) * Math.sin(t * 4.3 + k);
        // la flamme, dans la chambre (éteinte le jour : un creux sombre)
        if (lampOn > 0.05) {
          g.fillStyle = `rgba(255,${(150 + 40 * fl) | 0},70,${(0.4 + 0.6 * lampOn).toFixed(2)})`; g.fillRect(X - 2, Y - 24, 5, 3);
          g.fillStyle = `rgba(255,${(226 + 25 * fl) | 0},160,${(0.4 + 0.6 * lampOn).toFixed(2)})`; g.fillRect(X - 1, Y - 24, 3, 2);
        }
        if (lampOn > 0.05) {
          // sa lumière : des paliers ronds, chauds, qui éclairent le sentier autour
          g.globalCompositeOperation = 'lighter';
          for (const [r, a] of [[30, 0.03], [21, 0.045], [13, 0.065], [7, 0.1]]) {
            g.fillStyle = `rgba(255,170,90,${(a * lampOn * fl).toFixed(3)})`;
            for (let yy = -r; yy <= r; yy++) { const ww = Math.floor(Math.sqrt(r * r - yy * yy) * 1.3); g.fillRect(X - ww, Y - 22 + Math.round(yy * 0.8), ww * 2 + 1, 1); }
          }
          g.globalCompositeOperation = 'source-over';
        }
      }
    }

    /** Le premier plan : des herbes hautes, sombres, qui passent plus vite (la profondeur). */
    function drawFore(scroll) {
      const s = Math.round(scroll * 1.5), step = 37;
      g.fillStyle = css(tone('fore'));
      for (let k = Math.floor(s / step) - 1; k * step < s + W + step; k++) {
        if (rnd(k, 71) < 0.55) continue;
        const x0 = Math.round(k * step - s + rnd(k, 72) * 20), n = 3 + Math.floor(rnd(k, 73) * 5);
        for (let i = 0; i < n; i++) {
          const hgt = 6 + Math.floor(rnd(k, i, 74) * 14), lean = (rnd(k, i, 75) - 0.5) * 0.6, bx = x0 + i * 2;
          for (let j = 0; j < hgt; j++) g.fillRect(Math.round(bx + lean * j * j / hgt), H - 1 - j, 1, 1);
        }
        g.fillRect(x0 - 2, H - 3, n * 2 + 5, 3);
      }
    }

    // le monde défile au rythme des pieds (moins ce que le ninja gagne à l'écran), sans fin
    const scrollAt = (t) => t * (FOOT - (W + 52) / DAY);

    function drawNinja(t, u) {
      const im = IMG.run;
      if (!im || u > DAY) return;
      const x = -26 + (W + 52) * (u / DAY);
      const y = pathAt(Math.round(x + scrollAt(t)));
      const f = Math.floor(t * FPS) % 6;
      const dx = Math.round(x) - 19, dy = y - 35 + 1;
      // une ombre douce sous ses pieds
      g.fillStyle = `rgba(0,0,0,${(0.18 + 0.1 * light).toFixed(2)})`; g.fillRect(dx + 12, y + 1, 15, 1); g.fillRect(dx + 14, y + 2, 11, 1);
      g.drawImage(im, f * 57, 0, 57, 36, dx, dy, 57, 36);
      const dark = 1 - Math.min(1, light * 1.25);
      if (dark > 0.02) { g.globalAlpha = dark * 0.7; g.drawImage(DARK.run, f * 57, 0, 57, 36, dx, dy, 57, 36); g.globalAlpha = 1; }
    }

    function drawFireflies(t, night, scroll) {
      if (night < 0.05) return;
      for (let i = 0; i < 12; i++) {
        const x = Math.round(((rnd(i, 61) * W * 1.4 - scroll * 0.6 + Math.sin(t * 0.7 + i) * 8) % W + W) % W);
        const y = Math.round(gy - 6 - rnd(i, 62) * H * 0.18 + Math.sin(t * 1.3 + i * 2) * 3);
        const a = night * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7));
        g.fillStyle = `rgba(200,255,140,${(a * 0.22).toFixed(2)})`; g.fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle = `rgba(226,255,170,${a.toFixed(2)})`; g.fillRect(x, y, 1, 1);
      }
    }

    return {
      /** w, h : la toile de sortie (pixels de l'écran) ; k : pixels d'écran par pixel de jeu. */
      resize(w, h, k) {
        K = k; W = Math.ceil(w / k); H = Math.ceil(h / k);
        out.width = W * k; out.height = H * k;
        P = mk(W, H); g = P.getContext('2d');
        build();
      },
      setImages(im) {
        Object.assign(IMG, im);
        if (im.far) prepMountains('far', NFAR);
        if (im.mid) prepMountains('mid', NMID);
        if (im.run) {
          const c = mk(im.run.width, im.run.height), d = c.getContext('2d');
          d.drawImage(im.run, 0, 0);
          d.globalCompositeOperation = 'source-atop'; d.fillStyle = '#080a18'; d.fillRect(0, 0, c.width, c.height);
          DARK.run = c;
        }
      },
      frame(t) {
        if (!g) return;
        const u = t % CYCLE;
        // la lune : un cercle — de l'horizon gauche (matin) au sommet (midi) à l'horizon droit (soir), puis sous la terre
        const a = u < DAY ? Math.PI * (1 - u / DAY) : -Math.PI * ((u - DAY) / NIGHT);
        const alt = Math.sin(a);
        const mx = W / 2 + Math.cos(a) * W * 0.44, my = gy - 10 - Math.sin(a) * H * 0.66;
        light = ss(-0.22, 0.12, alt) * 0.5 + ss(0.08, 0.5, alt) * 0.5;
        const n = ss(0.12, -0.2, alt), warm = alt > -0.15 ? Math.max(0, 1 - Math.abs(alt) / 0.32) : 0;
        const lampOn = ss(0.22, 0.0, alt), sc = scrollAt(t);
        drawSky(alt, t);
        drawClouds(t);
        drawBirds(t, alt);
        if (my < gy + 14) drawMoon(mx, my);
        // les deux chaînes de l'intro, posées comme dans l'intro, défilant très lentement (parallaxe)
        if (IMG.far) drawRange('far', sc * 0.05, gy - 236 + 12, n, warm * 0.75, warm);
        if (IMG.mid) drawRange('mid', sc * 0.12 + 300, gy - 176 + 10, n, warm * 0.55, warm);
        // le pied des montagnes se fond dans la brume du bas du ciel
        const hz = tone('skyLow');
        for (let i = 0; i < 6; i++) { g.fillStyle = css(hz, 0.045); g.fillRect(0, gy - 28 + i * 4, W, 32 - i * 4); }
        drawGround(sc, t, lampOn);
        drawNinja(t, u);
        drawFireflies(t, n, sc);
        drawFore(sc);
        const o = out.getContext('2d');
        o.imageSmoothingEnabled = false;
        o.drawImage(P, 0, 0, W * K, H * K);
      },
    };
  }

  // --- la toile, à la taille de l'écran (pivotée en portrait sur téléphone, comme le jeu) ---
  const cv = document.createElement('canvas');
  cv.className = 'loading__scene';
  root.textContent = '';
  root.appendChild(cv);
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const rot = window.matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth;
    const w = rot ? innerHeight : innerWidth, h = rot ? innerWidth : innerHeight;
    // la même échelle que le jeu : environ 252 pixels de jeu en hauteur, jamais plus de 448 de large
    let k = Math.max(1, Math.round((h * dpr) / 252), Math.round((w * dpr) / 448));
    while (k > 1 && (w * dpr) / k < 360) k--;
    cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    cv.style.transform = rot ? `translate(${innerWidth}px, 0) rotate(90deg)` : '';
    return { w: Math.round(w * dpr), h: Math.round(h * dpr), k };
  }
  let size = layout();
  const SRC = { run: '__NINJA_RUN__', far: '__MONTAGNES_LOIN__', mid: '__MONTAGNES_MILIEU__' };
  const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
  const images = Promise.all(Object.entries(SRC).map(([k, u]) => load(u).then((im) => [k, im])));

  let worker = null, raf = 0, local = null;
  try {
    if (typeof OffscreenCanvas === 'undefined' || !cv.transferControlToOffscreen) throw new Error('pas de toile hors écran');
    const off = cv.transferControlToOffscreen();
    const src = `const scene = ${scene.toString()};
      let S = null, t0 = performance.now();
      const loop = () => { S.frame((performance.now() - t0) / 1000); (self.requestAnimationFrame || ((f) => setTimeout(f, 16)))(loop); };
      self.onmessage = (e) => {
        const m = e.data;
        if (m.canvas) { S = scene(m.canvas, (w, h) => new OffscreenCanvas(w, h)); S.resize(m.w, m.h, m.k); loop(); }
        if (m.size) S.resize(m.w, m.h, m.k);
        if (m.images) S.setImages(m.images);
      };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.postMessage({ canvas: off, ...size }, [off]);
    images.then(async (list) => {
      const bmp = {};
      for (const [k, im] of list) if (im) bmp[k] = await createImageBitmap(im);
      worker?.postMessage({ images: bmp }, Object.values(bmp));
    });
  } catch (err) {
    // sans worker : la même scène, ici (elle peut se figer pendant les gros calculs du chargement)
    worker = null;
    local = scene(cv, (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
    local.resize(size.w, size.h, size.k);
    images.then((list) => local.setImages(Object.fromEntries(list.filter(([, im]) => im))));
    const t0 = performance.now();
    const loop = () => { local.frame((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    loop();
  }
  addEventListener('resize', () => { size = layout(); worker?.postMessage({ size: true, ...size }); local?.resize(size.w, size.h, size.k); });
  // le jeu est prêt : l'écran s'efface (main.js), puis on arrête la scène
  const stop = setInterval(() => {
    if (document.body.contains(root)) return;
    clearInterval(stop);
    worker?.terminate(); cancelAnimationFrame(raf);
  }, 500);
})();
