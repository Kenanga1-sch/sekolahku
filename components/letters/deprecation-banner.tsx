"use client";

import Link from "next/link";
import { AlertTriangle, Blocks, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface DeprecationBannerProps {
  /** Judul singkat jalur lama, mis. "Editor Surat Umum (TipTap)". */
  title?: string;
  /** Penjelasan singkat kenapa jalur ini ditinggalkan. */
  description?: string;
  /** Link ke editor modular pengganti. */
  modularHref?: string;
  className?: string;
}

/**
 * Banner peringatan bahwa sebuah jalur pembuatan surat lama (legacy) akan
 * ditinggalkan bertahap, dengan ajakan pindah ke Editor Surat Modular.
 *
 * Non-destruktif: hanya memberi tahu, tidak memblokir, agar pengguna yang sudah
 * terbiasa tidak terputus di tengah pekerjaan.
 */
export function DeprecationBanner({
  title = "Jalur ini akan ditinggalkan",
  description = "Cara ini masih bisa dipakai, tetapi akan dihentikan bertahap. Gunakan Editor Surat Modular yang menerapkan standar tata naskah dinas otomatis, pratinjau PDF nyata, dan blok siap pakai.",
  modularHref = "/arsip/surat-keluar/buat-modular",
  className,
}: DeprecationBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-90">{description}</p>
        </div>
      </div>
      <Link
        href={modularHref}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        <Blocks className="h-3.5 w-3.5" />
        Pakai Editor Modular
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
