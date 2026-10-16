"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Kamus kini menjadi tab di /admin/laporan-format — route lama dialihkan. */
export default function KamusVariabelRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/laporan-format?tab=kamus");
  }, [router]);
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Mengalihkan ke Format Laporan — tab Kamus Variabel…
    </div>
  );
}
