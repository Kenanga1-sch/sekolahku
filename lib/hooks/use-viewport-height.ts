"use client";

import { useEffect } from "react";

/**
 * Menjaga variabel CSS --app-vh (dalam px) agar tinggi viewport tetap
 * stabil di PWA mobile. Unit 100dvh pada Android Chrome terkadang gagal
 * diperbarui setelah keyboard muncul/hilang atau setelah navigasi, akibatnya
 * area chat "menyusut" dan baru kembali normal setelah halaman direfresh.
 * visualViewport melaporkan tinggi yang benar (termasuk saat keyboard
 * aktif) dan dipakai sebagai sumber kebenaran; 100dvh tetap jadi fallback
 * sebelum JS berjalan.
 */
export function useStableViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;

    const apply = () => {
      const h = vv ? vv.height : window.innerHeight;
      if (h > 0) {
        document.documentElement.style.setProperty("--app-vh", `${h}px`);
      }
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    if (vv) {
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
    }

    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      if (vv) {
        vv.removeEventListener("resize", apply);
        vv.removeEventListener("scroll", apply);
      }
    };
  }, []);
}
