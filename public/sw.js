/// <reference lib="webworker" />

const CACHE_NAME = 'sekolahku-v1';
const OFFLINE_URL = '/offline';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/offline',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cache offline page and essential assets
            await cache.addAll(PRECACHE_ASSETS);
            // Force this SW to become active
            self.skipWaiting();
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Remove old caches
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
            // Take control of all pages immediately
            self.clients.claim();
        })()
    );
});

// Fetch event - network-first with offline fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Chrome extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // Skip API requests - always go to network
    if (url.pathname.startsWith('/api/')) return;

    // Skip PocketBase requests
    if (url.hostname.includes('pocketbase') || url.port === '8090' || url.port === '8092') return;

    // Handle navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Try network first
                    const networkResponse = await fetch(request);
                    // Cache successful responses
                    if (networkResponse.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    // Network failed, try cache
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return offline page as fallback
                    const offlineResponse = await caches.match(OFFLINE_URL);
                    if (offlineResponse) {
                        return offlineResponse;
                    }
                    // Last resort - return a simple offline message
                    return new Response('Anda sedang offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    });
                }
            })()
        );
        return;
    }

    // Handle static assets (JS, CSS, images)
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
        url.pathname.startsWith('/_next/')
    ) {
        event.respondWith(
            (async () => {
                // Try cache first for static assets
                const cachedResponse = await caches.match(request);
                if (cachedResponse) {
                    // Return cache but also update in background
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, response);
                            });
                        }
                    });
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    // Return nothing for failed static assets
                    return new Response('', { status: 408 });
                }
            })()
        );
        return;
    }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
