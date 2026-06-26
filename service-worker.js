const CACHE_NAME = "habit-app-v12";
const DEFAULT_NOTIFICATION_TITLE = "Habits";
const DEFAULT_NOTIFICATION_BODY = "Time to complete your habits";
const DEFAULT_NOTIFICATION_ICON = "icons/icon-192.png";
const DEFAULT_NOTIFICATION_BADGE = "icons/favicon-48.png";
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

function getPushPayload(event) {
    if (!event.data) return {};

    try {
        return event.data.json();
    } catch (error) {
        return {
            body: event.data.text()
        };
    }
}

function getNotificationTargetUrl(data = {}) {
    const target = data.click_action || data.url || "./";
    return new URL(target, self.registration.scope).href;
}

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

self.addEventListener("push", event => {
    const data = getPushPayload(event);
    const targetUrl = getNotificationTargetUrl(data);

    event.waitUntil(
        self.registration.showNotification(data.title || DEFAULT_NOTIFICATION_TITLE, {
            body: data.body || DEFAULT_NOTIFICATION_BODY,
            icon: data.icon || DEFAULT_NOTIFICATION_ICON,
            badge: data.badge || DEFAULT_NOTIFICATION_BADGE,
            tag: data.tag || "habit-daily-reminder",
            renotify: data.renotify !== false,
            requireInteraction: data.requireInteraction !== false,
            data: {
                url: targetUrl,
                click_action: targetUrl
            }
        })
    );
});

self.addEventListener("notificationclick", event => {
    const targetUrl = getNotificationTargetUrl(event.notification.data);

    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then(clientList => {
                const sameOriginClient = clientList.find(client => {
                    try {
                        return new URL(client.url).origin === new URL(targetUrl).origin;
                    } catch (error) {
                        return false;
                    }
                });

                if (sameOriginClient) {
                    if ("navigate" in sameOriginClient) {
                        return sameOriginClient.navigate(targetUrl)
                            .then(client => (client || sameOriginClient).focus());
                    }

                    return sameOriginClient.focus();
                }

                return self.clients.openWindow(targetUrl);
            })
    );
});
