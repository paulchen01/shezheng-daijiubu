// Build replaces the token with a digest of every release asset.
const CACHE_NAME = "shezheng-daijiubu-d6676e3f1ea75d30";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./app-core.mjs", "./pwa.js", "./backup.mjs", "./startup.js", "./assets/startup.webp", "./manifest.webmanifest", "./data/home-data.json", "./icons/apple-touch-icon.png", "./icons/favicon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable.png"];
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
    const response = await fetch(event.request);
    // The large question bank is deliberately downloaded after the home screen.
    // Once received, retain it for offline practice without making SW installation wait for it.
    if (response.ok && url.pathname.endsWith("/data/review-data.json")) await cache.put(event.request, response.clone());
    return response;
  })());
});
