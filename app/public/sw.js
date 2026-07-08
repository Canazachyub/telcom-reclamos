// Service worker mínimo — instalable + app-shell offline. NO cachea la API de Apps Script.
// Estrategia: HTML network-first (siempre lo último online; caché si estás offline);
//             assets con hash cache-first (rápidos y offline). Cross-origin (API) va directo a red.
const CACHE = "telcom-reclamos-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // solo mismo origen (la SPA en GitHub Pages); la API de Apps Script (otro origen) pasa directo a la red
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const esNav = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (esNav) {
    // HTML: network-first (evita servir una versión vieja de la app)
    e.respondWith(
      fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return res; })
        .catch(() => caches.match(e.request))
    );
  } else {
    // assets con hash: cache-first (offline + rápido)
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return res;
      }))
    );
  }
});
