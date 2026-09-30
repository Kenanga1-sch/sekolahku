"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EnginePage } from "@/lib/docstation/state";

interface PageStripProps {
  pages: EnginePage[];
  activeId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  busy?: boolean;
  /**
   * Susunan daftar thumbnail. "horizontal" (default) = strip yang menggulir
   * ke samping. "vertical" = kolom thumbnail satu per baris yang menggulir ke
   * bawah pada layar >= lg (kolom kiri editor); di layar kecil (< lg) otomatis
   * kembali jadi strip horizontal agar tidak memakan tinggi layar. Ukuran
   * thumbnail dan kontrol aksi overlay tidak berubah.
   */
  orientation?: "horizontal" | "vertical";
}

/**
 * Strip thumbnail halaman: pilih aktif, centang untuk operasi multi-halaman.
 * Aksesibel: pemilihan lewat tombol (Enter/Space bawaan), kontrol aksi
 * selalu terlihat di layar sentuh dan muncul saat hover/fokus di desktop.
 */
export function PageStrip({
  pages,
  activeId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onRemove,
  onMove,
  busy,
  orientation = "horizontal",
}: PageStripProps) {
  if (pages.length === 0) return null;

  const vertical = orientation === "vertical";

  return (
    <ul
      aria-label="Daftar halaman"
      className={cn(
        "flex gap-1.5 rounded-2xl border border-border bg-card p-1.5",
        vertical
          ? // < lg tetap strip horizontal (hemat tinggi layar); >= lg berubah
            // jadi kolom thumbnail yang menggulir ke bawah.
            "items-center overflow-x-auto lg:h-full lg:flex-col lg:items-stretch lg:overflow-x-hidden lg:overflow-y-auto"
          : // Selalu strip horizontal, persis seperti semula.
            "items-center overflow-x-auto",
      )}
    >
      {pages.map((page, index) => {
        const active = page.id === activeId;
        const selected = selectedIds.has(page.id);
        return (
          <li
            key={page.id}
            className={cn(
              "group relative flex flex-shrink-0 items-center gap-1.5 overflow-hidden rounded-xl border-2 p-1 transition-all",
              active ? "border-primary shadow-sm" : "border-transparent hover:border-border",
              busy && "opacity-60",
            )}
          >
            {/* Thumbnail 56x48 + nomor halaman. Kontrol TIDAK lagi menimpa
                gambar — dulu 3 tombol (104px) dipaksa masuk ke lebar 80px
                sehingga selalu terpotong `overflow-hidden`. Checkbox jadi
                sibling (bukan di dalam tombol) agar klik-nya tak ikut
                memilih halaman. */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                aria-pressed={active}
                aria-label={`Pilih halaman ${index + 1}: ${page.name}`}
                disabled={busy}
                onClick={() => onSelect(page.id)}
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.sourceUrl}
                  alt=""
                  className="h-12 w-14 bg-white object-cover"
                />
                <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[9px] font-bold leading-4 text-white">
                  {index + 1}
                </span>
              </button>
              <label className="absolute right-0.5 top-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/70 bg-black/40">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                  checked={selected}
                  aria-label={`Pilih halaman ${index + 1} untuk operasi multi`}
                  disabled={busy}
                  onChange={() => onToggleSelect(page.id)}
                />
              </label>
            </div>

            {/* Aksi di samping thumbnail: selalu terlihat (di sentuh maupun
                desktop), punya ruang penuh, dan tak memakan tinggi baris. */}
            <div className="flex flex-shrink-0 items-center">
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={() => onMove(page.id, -1)}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Geser halaman ${index + 1} ke kiri`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(page.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label={`Hapus halaman ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy || index === pages.length - 1}
                onClick={() => onMove(page.id, 1)}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Geser halaman ${index + 1} ke kanan`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        );
      })}
      {busy && (
        <li role="status" className="px-2 text-xs text-muted-foreground">
          Memproses…
        </li>
      )}
    </ul>
  );
}
