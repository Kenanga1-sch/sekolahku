"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Kamus kini menjadi sub-tab di Pengaturan → Format Laporan → Kamus Variabel. */
export default function KamusVariabelRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pengaturan?tab=laporan-format&sub=kamus");
  }, [router]);
  return <div className="p-6 text-sm text-muted-foreground">Mengalihkan ke Pengaturan — Kamus Variabel…</div>;
}
