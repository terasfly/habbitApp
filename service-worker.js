const CACHE_NAME = "habit-app-v1";
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./firebase.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

const CORE_ASSET_PATHS = new Set(
    CORE_ASSETS.map(asset => new URL(asset, self.registration.scope).pathname)
);

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const { request } = event;

    if (request.method !== "GET") return;

    const requestUrl = new URL(request.url);
    const isSameOrigin = requestUrl.origin === self.location.origin;

    if (request.mode === "navigate" && isSameOrigin) {
        event.respondWith(
            fetch(request).catch(() => caches.match("./index.html"))
        );
        return;
    }

    if (!isSameOrigin || !CORE_ASSET_PATHS.has(requestUrl.pathname)) return;

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
            return cachedResponse || fetch(request);
        })
    );
});
