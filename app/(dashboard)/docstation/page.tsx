"use client";

import { useEffect } from "react";

import { loadPdfLib } from "@/lib/docstation/vendor-loader";
import { DocStationApp } from "./_components/docstation-app";

/**
 * DocStation — pusat operasional scan (eSCL) & cetak (IPP/RAW) dokumen.
 *
 * Modul React native bertema Sekolahku. Mesin (canvas/OpenCV/printer) telah
 * dipindah ke `lib/docstation`. Vendor PDFLib dimuat di sini agar PDF siap
 * sebelum pengguna memicu ekspor.
 */
export default function DocStationPage() {
  useEffect(() => {
    // Muat awal, abaikan kegagalan (dipanggil ulang saat ekspor PDF bila perlu).
    loadPdfLib().catch(() => {});
  }, []);

  return <DocStationApp />;
}
