// DES iDocs — isolated PWA worker.
// This worker may only cache URLs inside /iDocs/ and only manages its own cache namespace.
const CACHE_NAME = "des-idocs-shell-v3";
const CACHE_PREFIX = "des-idocs-";
const APP_SCOPE = new URL(self.registration.scope);
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./iDocs-icon.png",
  "./iApps-icon.png"
].map(path => new URL(path, APP_SCOPE).href);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== APP_SCOPE.origin || !url.pathname.startsWith(APP_SCOPE.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (request.mode === "navigate") {
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return cached || (await cache.match(new URL("index.html", APP_SCOPE).href)) || Response.error();
      }
    }

    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok &&
          ["script", "style", "image", "font"].includes(request.destination)) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
