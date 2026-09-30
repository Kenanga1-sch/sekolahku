"use client";

/**
 * layout-chrome-context.tsx — Kontrol "chrome" layout dashboard (topbar, padding
 * main, bottom nav) dari halaman yang membutuhkannya.
 *
 * Modul seperti Studio Format Laporan ingin area kerja seluas mungkin. Dengan
 * mode immersive, topbar (PWA/tema/notifikasi/avatar) dan padding main
 * disembunyikan, sementara side nav dibiarkan utuh (punya toggle sendiri).
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface LayoutChromeContextValue {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
}

const LayoutChromeContext = createContext<LayoutChromeContextValue>({
  immersive: false,
  setImmersive: () => {},
});

export function LayoutChromeProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  return (
    <LayoutChromeContext.Provider value={{ immersive, setImmersive }}>
      {children}
    </LayoutChromeContext.Provider>
  );
}

export function useLayoutChrome() {
  return useContext(LayoutChromeContext);
}

/**
 * Aktifkan mode immersive selama komponen yang memanggilnya ter-mount.
 * Otomatis dimatikan saat unmount sehingga keluar dari modul memulihkan chrome.
 */
export function useImmersiveLayout(active: boolean = true) {
  const { setImmersive } = useLayoutChrome();
  useEffect(() => {
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
