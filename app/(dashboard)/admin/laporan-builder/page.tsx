"use client";

/**
 * Halaman ini dulu berisi "Studio Format" (editor grid ala-Excel). Fitur itu
 * sudah dibongkar: satu-satunya cara membuat laporan kini lewat template file
 * .xlsx/.docx yang diunggah di Admin → Format Laporan.
 *
 * Halaman ini tinggal mengalihkan ke halaman itu supaya tautan/bookmark lama
 * tidak menabrak dinding kosong. (Static export tidak mendukung redirect server,
 * jadi pengalihan dilakukan di sisi klien.)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LaporanBuilderRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pengaturan?tab=laporan-format");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">
        Studio Format sudah tidak digunakan — mengalihkan ke Format Laporan…
      </p>
    </div>
  );
}