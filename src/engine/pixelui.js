// Interface en pixels : chaque texte de la page est remplacé à l'affichage par
// un petit canvas tracé avec la police du jeu (pixelfont.js). Le texte reste
// dans la page (lecteurs d'écran, tests, `textContent`) mais à taille nulle ;
// un observateur redessine le canvas dès que le texte ou l'état change.
//
// Réglages lus dans le CSS de l'élément :
//   color, text-transform: uppercase, text-align ;
//   --pxf : small | big | title      --pxw : largeur maximale (retour à la ligne)
//   --pxs : interlettrage (pixels)   --pxo : couleur d'un contour d'un pixel
//   --pxl : pixels ajoutés entre deux lignes
import { renderText } from './pixelfont.js';

const cache = new WeakMap();   // élément → { key, cv }

function textOf(el) {
  let s = '';
  for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue;
  return s.replace(/\s+/g, ' ').trim();
}

function paint(el) {
  if (!(el instanceof HTMLElement) || el.tagName === 'CANVAS') return;
  const text = textOf(el);
  const old = cache.get(el);
  if (!text) {
    if (old) { old.cv.remove(); cache.delete(el); }
    return;
  }
  const cs = getComputedStyle(el);
  const num = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  const opts = {
    font: cs.getPropertyValue('--pxf').trim() || 'small',
    color: cs.color,
    outline: cs.getPropertyValue('--pxo').trim(),
    maxW: num('--pxw'),
    spacing: num('--pxs'),
    leading: num('--pxl'),
    align: cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left',
  };
  const shown = cs.textTransform === 'uppercase' ? text.toUpperCase() : text;
  const key = `${shown}|${opts.font}|${opts.color}|${opts.outline}|${opts.maxW}|${opts.spacing}|${opts.leading}|${opts.align}`;
  if (old && old.key === key) {
    if (old.cv.parentNode !== el) el.append(old.cv);
    return;
  }
  const cv = renderText(shown, opts);
  cv.className = 'pxt';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.setProperty('--pw', cv.width);
  cv.style.setProperty('--ph', cv.height);
  old?.cv.remove();
  el.append(cv);
  cache.set(el, { key, cv });
}

function scan(root) {
  if (!(root instanceof HTMLElement)) return;
  paint(root);
  for (const el of root.querySelectorAll('*')) paint(el);
}

const ours = (n) => n.nodeType === 1 && n.classList.contains('pxt');

/** Met en pixels tous les textes sous les racines données, et les tient à jour. */
export function pixelUI(roots) {
  const obs = new MutationObserver((muts) => {
    const todo = new Set();
    for (const m of muts) {
      if (m.type === 'characterData') { if (m.target.parentElement) todo.add(m.target.parentElement); continue; }
      if (m.type === 'attributes') { todo.add(m.target); for (const el of m.target.querySelectorAll('*')) todo.add(el); continue; }
      const nodes = [...m.addedNodes, ...m.removedNodes];
      if (nodes.length && nodes.every(ours)) continue;          // nos propres canvas
      todo.add(m.target);
      for (const n of m.addedNodes) if (n.nodeType === 1 && !ours(n)) { todo.add(n); for (const el of n.querySelectorAll('*')) todo.add(el); }
    }
    for (const el of todo) if (el.isConnected) paint(el);
  });
  // survol et focus changent parfois la couleur du texte : on redessine
  const repaint = (e) => {
    const t = e.target instanceof Element ? e.target.closest('button, a') : null;
    if (t) requestAnimationFrame(() => scan(t));
  };
  for (const root of roots) {
    if (!root) continue;
    scan(root);
    obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-current', 'disabled'] });
    for (const ev of ['pointerover', 'pointerout', 'focusin', 'focusout']) root.addEventListener(ev, repaint);
  }
}
