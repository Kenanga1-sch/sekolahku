"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Format Laporan pindah ke Pengaturan → tab "Format Laporan". */
export default function LaporanFormatRedirect() {
  const router = useRouter();
  useEffect(() => {
    const qs = window.location.search;
    const sub = new URLSearchParams(qs).get("tab") === "kamus" ? "&sub=kamus" : "";
    router.replace(`/pengaturan?tab=laporan-format${sub}`);
  }, [router]);
  return <div className="p-6 text-sm text-muted-foreground">Mengalihkan ke Pengaturan — Format Laporan…</div>;
}
