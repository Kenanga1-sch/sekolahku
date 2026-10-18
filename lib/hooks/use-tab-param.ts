"use client";

import { useCallback, useEffect, useState } from "react";

interface UseTabParamOptions<T extends string> {
  /** Nama query param di URL. Default "tab". Diabaikan bila `hash` aktif. */
  param?: string;
  /** Daftar nilai tab yang sah; nilai URL di luar daftar akan diabaikan. */
  validTabs?: readonly T[];
  /** Simpan sebagai hash (#nilai) alih-alih query param (?param=nilai). */
  hash?: boolean;
}

/**
 * Menyimpan tab aktif di URL (?<param>=...) sehingga tab yang sama tetap
 * terbuka setelah halaman di-refresh, sekaligus mendukung deep-link /
 * bookmark (mis. /admin/siswa?tab=alumni). Pola ini sudah dipakai manual di
 * beberapa modul; hook ini menyatukannya agar konsisten.
 *
 * URL diperbarui lewat history.replaceState sehingga tidak menambah entri
 * riwayat (tombol back tidak "tersangkut" di tiap perpindahan tab).
 */
export function useTabParam<T extends string>(
  defaultTab: T,
  options: UseTabParamOptions<T> = {},
): [T, (tab: T) => void] {
  const { param = "tab", hash = false, validTabs } = options;
  const [activeTab, setActiveTab] = useState<T>(defaultTab);

  // Baca nilai awal dari URL saat mount; default dipakai bila tidak ada.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const raw = hash ? url.hash.replace(/^#/, "") : url.searchParams.get(param);
      const value = (raw || null) as T | null;
      if (value && (!validTabs || validTabs.includes(value))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi awal dari URL (agar tab tahan refresh) tidak bisa dilakukan di render tanpa memicu hydration mismatch
        setActiveTab((prev) => (prev === value ? prev : value));
      }
    } catch {
      /* abaikan URL yang tidak valid */
    }
  }, [param, hash, validTabs]);

  const setTab = useCallback(
    (tab: T) => {
      setActiveTab(tab);
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        if (hash) {
          if (url.hash.replace(/^#/, "") === tab) return;
          url.hash = tab;
        } else {
          if (url.searchParams.get(param) === tab) return;
          url.searchParams.set(param, tab);
        }
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        /* abaikan URL yang tidak valid */
      }
    },
    [param, hash],
  );

  return [activeTab, setTab];
}
