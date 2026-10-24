// Keeps a copy of Carriage on the phone so it opens fast, even with weak signal on the MRT.
// Pages: try the network for 3 seconds, then fall back to the saved copy.
// Live bus times (another website) are never saved: they always come fresh.
const CACHE = "carriage-v1";
const SHELL = ["/", "/new-user", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
    const saved = await cache.match(req, { ignoreSearch: true });
    if (!saved) return fresh;
    const slow = new Promise(r => setTimeout(() => r(saved), 3000));
    return Promise.race([fresh.catch(() => saved), slow]);
  })());
});
