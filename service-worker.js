const CACHE_NAME = 'yt-converter-v6'; // AGENT: BUMP THIS VERSION on any UI/Logic change!

// Assets to cache for offline support
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/js/features.js',
    '/js/batch.js',
    '/js/snake-game.js',
    '/js/visualizer.js',
    '/css/base.css',
    '/css/animations.css',
    '/css/layout/main.css',
    '/css/components/form.css',
    '/css/components/results.css',
    '/css/components/conversion-animations.css',
    '/css/components/features.css',
    '/css/components/batch.css',
    '/css/components/nerd-stats.css',
    '/css/components/lyrics.css',
    '/css/components/game.css',
    '/css/components/guess-track.css',
    '/js/guess-track.js',
    '/css/utils/helpers.css',
    '/manifest.json',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
];

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

self.addEventListener('fetch', (event) => {
    // Ignore API calls and non-GET requests
    const pathname = new URL(event.request.url).pathname;
    if (event.request.method !== 'GET' || pathname === '/api' || pathname.startsWith('/api/')) {
        return;
    }

    // Workaround for Chrome DevTools bug with extension requests
    if (event.request.url.startsWith('chrome-extension://')) return;

    // Best Practice: Network First for HTML to assure the latest markup
    const acceptHeader = event.request.headers.get('accept');
    if (event.request.mode === 'navigate' || (acceptHeader && acceptHeader.includes('text/html'))) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        // If we had an offline.html, we'd return it here
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'text/html' }
                        });
                    });
                })
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
