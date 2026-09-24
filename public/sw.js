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
// { title, body, url, tag, icon, image, actions:[{action,title,icon,url}] }.
// Wajib menampilkan notifikasi agar browser tidak menonaktifkan push
// (aturan userVisibleOnly).
//
// CATATAN nada dering: Web Notification API TIDAK menyediakan opsi `sound`.
// Bunyi notifikasi ditentukan sistem operasi dan tidak bisa dipaksa kustom
// dari web (berlaku di semua PWA, Android maupun iOS). Yang BISA dikendalikan
// adalah: pola getar (Android), pengulangan bunyi via renotify, dan durasi
// tampil via requireInteraction. Karena itu nilai-nilai di bawah dioptimalkan
// agar notifikasi terasa khas sekolah dan sulit terlewat.

// Pola getar khas SDN 1 Kenanga: tiga getaran tegas (mirip bel sekolah),
// berbeda dari getar notifikasi generik. iOS mengabaikan pola ini (memakai
// getar sistem), Android memakainya apa adanya.
const SEKOLAH_VIBRATE = [300, 120, 300, 120, 300];

function openInWindow(url) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    });
}

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
  const baseUrl = data.url || "/";
  const actionUrls = {};
  if (Array.isArray(data.actions)) {
    for (const a of data.actions) {
      if (a && a.action) actionUrls[a.action] = a.url || baseUrl;
    }
  }
  const title = data.title || "SDN 1 Kenanga";
  // Tag: payload boleh mengirim tag sendiri (mis. untuk menggabungkan notif
  // sejenis). Bila kosong, pakai tag default. Tag non-kosong WAJIB ada supaya
  // `renotify` valid — kalau tidak, showNotification melempar TypeError.
  const tag = data.tag || "sekolahku";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag,
    // renotify: bila notifikasi menimpa notifikasi lama bertag sama, tetap
    // berbunyi + bergetar ulang (tanpa ini penimpaan terjadi senyap).
    renotify: true,
    // Biarkan tampil sampai pengguna berinteraksi — notifikasi penting sekolah
    // (absen, izin, pengumuman) tidak boleh hilang sendiri sebelum dibaca.
    requireInteraction: true,
    data: { url: baseUrl, actionUrls },
    vibrate: SEKOLAH_VIBRATE,
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

// Klik badan notifikasi: buka/fokus halaman tujuan utama (data.url).
self.addEventListener("notificationclick", (event) => {
  const nd = event.notification.data || {};
  event.notification.close();
  event.waitUntil(openInWindow(nd.url || "/"));
});

// Klik TOMBOL AKSI (mis. "Ajukan Izin"): browser mengirim notificationaction,
// bukan notificationclick. Rute ke URL khusus aksi, fallback ke url notifikasi.
self.addEventListener("notificationaction", (event) => {
  const nd = event.notification.data || {};
  const target = (nd.actionUrls || {})[event.action] || nd.url || "/";
  event.notification.close();
  event.waitUntil(openInWindow(target));
});
