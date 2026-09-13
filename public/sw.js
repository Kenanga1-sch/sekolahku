// Cache name dibangkitkan oleh scripts/gen-sw-precache.mjs (content hash)
// supaya tiap build me-emptikan cache lama.
const CACHE_NAME = "sekolahku-v16";
const OFFLINE_URL = "/offline";

// Daftar aset yang diprecache (generate di build via self.__precacheManifest).
// Jika belum diinjeksi (jalankan manual / dev), pakai daftar fallback agar SW
// tetap valid. Di localhost SW tidak pernah ter-pasang (lihat layout.tsx).
const PRECACHE_ASSETS = self.__precacheManifest || [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

const CACHE_URLS = new Set(PRECACHE_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (
    url.hostname.includes("pocketbase") ||
    url.port === "8090" ||
    url.port === "8092"
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
          return new Response("Anda sedang offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
    ) ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("", { status: 408 });
        }
      })(),
    );
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ===== Web Push =====
// Notifikasi dari server (absen, tabungan, pengumuman, dst). Payload JSON
// { title, body, url, tag }. Wajib menampilkan notifikasi agar browser
// tidak menonaktifkan push (aturan userVisibleOnly).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "SDN 1 Kenanga",
      body: event.data ? event.data.text() : "",
    };
  }
  const title = data.title || "SDN 1 Kenanga";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
    // actions & image bersifat opsional; browser lama mengabaikannya.
    actions: (data.actions || []).map((a) => ({
      action: a.action,
      title: a.title,
      icon: a.icon || undefined,
    })),
    ...(data.image ? { image: data.image } : {}),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Klik notifikasi membuka/fokus ke halaman terkait. Jika ada tombol aksi
// (event.action), tetap buka data.url (aksi "create-leave" → form izin).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
