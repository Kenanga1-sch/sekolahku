"use client";

/**
 * Utilitas Web Push (PWA) untuk browser. Push hanya aktif di HTTPS
 * (atau localhost). Di iOS wajib PWA ditambahkan ke Home Screen dulu.
 */

import { goFetch, goGet, goPost } from "@/lib/api-client";

export type PushSupportState = "unsupported" | "ios-needs-install" | "ready";

export interface PushStatus {
  enabled: boolean; // server punya VAPID keys
  devices: number;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

/** Konversi VAPID public key (base64url) ke ArrayBuffer untuk subscribe. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/** Deteksi dukungan push & kondisi khusus iOS. */
export function getPushSupportState(): PushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIOS && !isStandalone) {
    return "ios-needs-install";
  }
  return "ready";
}

export async function getPushStatus(): Promise<PushStatus> {
  const support = getPushSupportState();
  const permission: NotificationPermission | "unsupported" =
    "Notification" in window ? Notification.permission : "unsupported";
  let subscribed = false;
  let devices = 0;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    }
  } catch {
    subscribed = false;
  }
  try {
    const res = await goGet<{ enabled: boolean; devices: number }>("/api/push/status");
    devices = res?.devices || 0;
    return { enabled: !!res?.enabled, devices, permission, subscribed: subscribed && devices > 0 };
  } catch {
    return { enabled: false, devices: 0, permission, subscribed };
  }
}

/** Minta izin + subscribe + simpan ke server. Melempar Error berpesan. */
export async function enablePush(): Promise<number> {
  if (getPushSupportState() === "ios-needs-install") {
    throw new Error("Di iPhone/iPad, tambahkan dulu situs ini ke Home Screen, lalu buka dari ikon tersebut.");
  }
  if (getPushSupportState() === "unsupported") {
    throw new Error("Perangkat/browser ini tidak mendukung notifikasi push.");
  }

  const keyRes = await goGet<{ enabled: boolean; publicKey: string }>("/api/public/push/vapid-key");
  if (!keyRes?.enabled || !keyRes.publicKey) {
    throw new Error("Notifikasi push belum diaktifkan oleh server.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.");
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey),
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Gagal membaca data subscription browser.");
  }

  const res = await goPost<{ devices: number }>("/api/push/subscribe", {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: navigator.userAgent,
  });
  return res?.devices || 1;
}

/** Lepas langganan: unsubscribe browser + hapus di server. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await goFetch("/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch {
    // diamkan — tujuan utamanya berhenti menerima notifikasi.
  }
}

/** Kirim notifikasi uji (khusus admin) ke perangkat sendiri. */
export async function sendTestPush(): Promise<number> {
  const res = await goPost<{ sent: number }>("/api/push/test");
  return res?.sent || 0;
}
