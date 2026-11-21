
const CACHE = "afi-shell-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/afi-192.svg",
  "./icons/afi-512.svg",
  "./icons/afi-maskable-512.svg"
];

// Install and cache AFI files
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
      await self.skipWaiting();
    })()
  );
});

// Activate the new version
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key.startsWith("afi-shell-") && key !== CACHE)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// Load cached files when available
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);

      if (cached) return cached;

      try {
        return await fetch(event.request);
      } catch (error) {
        return caches.match("./index.html");
      }
    })()
  );
});
        
