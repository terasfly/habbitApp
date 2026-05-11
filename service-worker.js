const CACHE_NAME = "habit-app-v10";
const CORE_ASSETS = [
    "./",
    "index.html",
    "style.css",
    "language-switcher.css",
    "script.js",
    "language-switcher.js",
    "firebase.js",
    "manifest.json",
    "icons/apple-touch-icon.png",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/favicon-16.png",
    "icons/favicon-32.png",
    "icons/favicon-48.png",
    "icons/apple-splash-1290x2796.png",
    "icons/apple-splash-1179x2556.png",
    "icons/apple-splash-1170x2532.png",
    "icons/apple-splash-1284x2778.png",
    "icons/apple-splash-1242x2688.png",
    "icons/apple-splash-1125x2436.png",
    "icons/apple-splash-828x1792.png",
    "icons/apple-splash-1242x2208.png",
    "icons/apple-splash-750x1334.png",
    "favicon.ico"
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
            fetch(request).catch(() => caches.match("index.html"))
        );
        return;
    }

    if (!isSameOrigin || !CORE_ASSET_PATHS.has(requestUrl.pathname)) return;

    if (requestUrl.pathname.endsWith(".js") || requestUrl.pathname.endsWith(".css")) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request, { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
            return cachedResponse || fetch(request);
        })
    );
});
