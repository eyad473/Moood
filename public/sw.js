const CACHE = "abu-oreiban-v20-offline-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/lottie/abu-oreiban.json",
  "./assets/lottie/dashboard.json",
  "./assets/lottie/families.json",
  "./assets/lottie/records.json",
  "./assets/lottie/reports.json",
  "./assets/lottie/sync.json",
  "./assets/lottie/protection.json",
  "./assets/lottie/empty-data.json"
];
const LOTTIE_PLAYER = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // The animation JSON files are bundled locally and served offline from this cache.
  if (url.origin === self.location.origin && url.pathname.includes("/assets/lottie/")) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
    return;
  }

  // The player library is the only external runtime dependency. Once loaded online,
  // it is cached so the already-installed PWA can keep animating offline.
  if (url.href === LOTTIE_PLAYER) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
