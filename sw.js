const CACHE = "bjango-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./css/game.css",
  "./js/physics.js",
  "./js/audio.js",
  "./js/levels.js",
  "./js/game.js",
  "./manifest.json",
  "./assets/sfx/ugh.wav",
  "./assets/sfx/ugh-2.wav",
  "./assets/sfx/ugh-3.wav",
  "./assets/sfx/pan-ping.wav",
  "./assets/sfx/drop-1.wav",
  "./assets/sfx/drop-2.wav",
  "./assets/sfx/drop-3.wav",
  "./assets/sfx/drop-4.wav",
  "./assets/sfx/gun-1.wav",
  "./assets/sfx/wood-1.wav",
  "./assets/sfx/cock-1.wav",
  "./assets/sfx/plate-1.wav",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const live = fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => hit);
      return hit || live;
    })
  );
});
