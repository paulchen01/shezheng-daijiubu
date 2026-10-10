// Build replaces the token with a digest of every release asset.
const CACHE_NAME = "shezheng-daijiubu-fff2fcb0f95fc170";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./app-core.mjs", "./pwa.js", "./backup.mjs", "./manifest.webmanifest", "./data/review-data.json", "./icons/apple-touch-icon.png", "./icons/favicon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" })))));
});
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("shezheng-daijiubu-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === "navigate" && (url.pathname === new URL("./", self.location).pathname || url.pathname.endsWith("/index.html"))) return cache.match("./index.html");
    return fetch(event.request);
  })());
});
