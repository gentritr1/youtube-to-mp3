try {
    importScripts('/service-worker-assets.js');
} catch (error) {
    console.error('[Service Worker] Failed to load generated asset manifest.', error);
}

const CACHE_NAME = `yt-converter-${self.__STATIC_ASSET_VERSION || 'dev'}`;
const APP_ID_META_MARKER = '<meta name="sw-app-id" content="youtube-to-mp3">';
const STATIC_ASSETS = Array.isArray(self.__STATIC_ASSETS)
    ? self.__STATIC_ASSETS
    : ['/', '/index.html', '/manifest.json'];
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Offline</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0f; color: #f4f7fb; }
        main { width: min(32rem, calc(100vw - 2rem)); padding: 1.5rem; border-radius: 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        h1 { margin: 0 0 0.75rem; font-size: 1.5rem; }
        p { margin: 0 0 1rem; line-height: 1.6; color: rgba(244,247,251,0.82); }
        button { border: 0; border-radius: 999px; padding: 0.8rem 1.1rem; font: inherit; font-weight: 700; cursor: pointer; background: #38bdf8; color: #041018; }
    </style>
</head>
<body>
    <main>
        <h1>You are offline</h1>
        <p>This page is not available from cache yet. Check your connection and try loading it again.</p>
        <button type="button" id="retry-btn">Retry</button>
    </main>
    <script>
        document.getElementById('retry-btn')?.addEventListener('click', () => window.location.reload());
    </script>
</body>
</html>`;

self.addEventListener('install', (event) => {
    // Precache static assets
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Precaching app shell');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    // Clean up old caches if any
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME).map((cacheName) => {
                    console.log('[Service Worker] Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

async function clearAppCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames
            .filter((name) => name.startsWith('yt-converter-'))
            .map((cacheName) => caches.delete(cacheName))
    );
}

async function unregisterIfForeignDocument(response) {
    if (!response || !response.ok) {
        return false;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
        return false;
    }

    const html = await response.clone().text();
    if (html.includes(APP_ID_META_MARKER)) {
        return false;
    }

    console.log('[Service Worker] Foreign HTML detected, unregistering.');
    await clearAppCaches();
    await self.registration.unregister();
    return true;
}

self.addEventListener('fetch', (event) => {
    // Ignore API calls and non-GET requests
    const requestUrl = new URL(event.request.url);
    const pathname = requestUrl.pathname;
    if (event.request.method !== 'GET' || pathname === '/api' || pathname.startsWith('/api/')) {
        return;
    }

    // Workaround for Chrome DevTools bug with extension requests
    if (event.request.url.startsWith('chrome-extension://')) return;

    // Best Practice: Network First for HTML to assure the latest markup
    const acceptHeader = event.request.headers.get('accept');
    if (event.request.mode === 'navigate' || (acceptHeader && acceptHeader.includes('text/html'))) {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(event.request);

                    if (requestUrl.origin === self.location.origin) {
                        const foreignDocument = await unregisterIfForeignDocument(networkResponse);
                        if (foreignDocument) {
                            return networkResponse;
                        }
                    }

                    const cache = await caches.open(CACHE_NAME);
                    if (networkResponse && networkResponse.ok) {
                        await cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch {
                    // Fallback to cache
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return new Response(OFFLINE_HTML, {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
            })()
        );
        return;
    }

    // Best Practice: Cache First for static assets like scripts, styles, and images
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Ensure valid response before caching
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch((err) => {
                console.log('[Service Worker] Fetch failed.', err);
                return caches.match(event.request).then((cacheRes) => {
                    if (cacheRes) return cacheRes;
                    return new Response('', { status: 503, statusText: 'Service Unavailable' });
                });
            });
        })
    );
});
