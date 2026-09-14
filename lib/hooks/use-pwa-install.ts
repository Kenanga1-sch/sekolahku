"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/**
 * Hook PWA install: menangkap `beforeinstallprompt` dan menyediakan
 * `promptInstall()` untuk memicu browser install dialog.
 *
 * - Android Chrome/Edge/Samsung: memicu native install dialog.
 * - iOS Safari: tidak ada event `beforeinstallprompt`; komponen UI
 *   menampilkan instruksi manual "Tambahkan ke Layar Utama".
 * - Desktop Chrome/Edge: install dialog muncul.
 * - Tidak memenuhi syarat: hook mengembalikan `canInstall: false`.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Cek apakah sudah ter-install (standalone mode).
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);
    if (standalone) console.log("[PWA] Already installed (standalone mode)");

    // iOS tidak mengirim beforeinstallprompt.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    if (ios) console.log("[PWA] iOS detected — manual install only");

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("[PWA] beforeinstallprompt fired — install available");
    };

    window.addEventListener("beforeinstallprompt", handler);
    console.log("[PWA] Listening for beforeinstallprompt...");
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome === "accepted";
  };

  return {
    /** true jika browser mendukung install dan belum ter-install */
    canInstall: !!deferredPrompt && !isInstalled,
    /** true jika sudah dalam mode standalone (ter-install) */
    isInstalled,
    /** true jika iOS Safari (perlu instruksi manual) */
    isIOS,
    /** true jika browser menampilkan native install prompt */
    canPrompt: !!deferredPrompt,
    /** Munculkan dialog install browser */
    promptInstall,
  };
}
