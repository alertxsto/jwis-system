// JWIS service worker.
// Cache names are build-stamped at bundle time (vite config replaces
// __BUILD_ID__), so every new deploy activates a fresh cache and `activate`
// evicts the previous one. Navigations and /index.html are NETWORK-FIRST —
// users must never be pinned to a stale build — with cache as offline
// fallback only. Hashed /assets/* are immutable by name, so cache-first is
// safe there.
const CACHE_NAME = "jwis-__BUILD_ID__";
const APP_SHELL = ["/", "/field", "/manifest.webmanifest", "/jwis-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function cachePut(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(request, response))
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Network-first for navigations and the shell: a deploy must reach users
  // without manual cache clearing.
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => cachePut(request, response))
        .catch(() => caches.match("/"));
    }),
  );
});
