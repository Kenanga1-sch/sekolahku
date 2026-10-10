"use client";

import { useEffect, useState } from "react";

/**
 * Mengetahui apakah tab saat ini terlihat (document.visibilityState).
 *
 * Dipakai untuk menghentikan kamera + loop decode scan saat pengguna pindah
 * aplikasi atau layar HP mati — sumber utama HP panas/boros baterai pada
 * halaman dengan pemindai terus-menerus.
 *
 * Mengembalikan true bila tab terlihat. Aman untuk SSR (default true).
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
