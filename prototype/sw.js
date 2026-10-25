// Keeps a copy of Carriage on the phone so it opens fast, even with weak signal on the MRT.
// Pages: try the network for 3 seconds, then fall back to the saved copy.
// Live bus times (another website) are never saved: they always come fresh.
const CACHE = "carriage-v4";
const SHELL = ["/", "/new-user", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/apple-touch-icon.png",
  "/vendor/leaflet/leaflet.js", "/vendor/leaflet/leaflet.css"];

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
    const saved = await cache.match(req, { ignoreSearch: true });
    let usedSaved = false;
    const fresh = fetch(req).then(res => {
      if (res.ok) {
        cache.put(req, res.clone());
        // The saved copy was shown because the network was slow, and this one is different: tell the page
        const changed = saved && (res.headers.get("etag") || res.headers.get("last-modified")) !== (saved.headers.get("etag") || saved.headers.get("last-modified"));
        if (usedSaved && changed && req.mode === "navigate")
          self.clients.get(e.resultingClientId || e.clientId).then(c => c && c.postMessage({ type: "updated" }));
      }
      return res;
    });
    if (!saved) return fresh;
    const slow = new Promise(r => setTimeout(() => { usedSaved = true; r(saved); }, 3000));
    return Promise.race([fresh.catch(() => { usedSaved = true; return saved; }), slow]);
  })());
});

// Tapping a ride notification ("How was your ride?") opens the app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(list => list.length ? list[0].focus() : self.clients.openWindow("/")));
});
