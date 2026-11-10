// Octets d'un fichier (musique, échantillon sonore) : intégré en data: dans la
// version autonome (window.__KAGE_EMBED), sinon chargé depuis le site.
export async function bytesOf(src) {
  const data = globalThis.__KAGE_EMBED?.[src];
  if (data) {
    const bin = atob(data.slice(data.indexOf(',') + 1));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error(`fichier introuvable : ${src}`);
  return r.arrayBuffer();
}
