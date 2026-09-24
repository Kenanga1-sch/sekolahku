"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
}

/** Strip thumbnail halaman: pilih aktif, centang untuk operasi multi-halaman. */
export function PageStrip({
  pages,
  activeId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onRemove,
  onMove,
  busy,
}: PageStripProps) {
  if (pages.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">
      {pages.map((page, index) => {
        const active = page.id === activeId;
        const selected = selectedIds.has(page.id);
        return (
          <div
            key={page.id}
            className={cn(
              "group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
              active ? "border-primary shadow-sm" : "border-transparent hover:border-border",
            )}
            onClick={() => onSelect(page.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.sourceUrl}
              alt={page.name}
              className="h-20 w-16 bg-white object-cover"
            />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {index + 1}
            </span>

            <label
              className="absolute right-1 top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded border border-white/70 bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="h-3 w-3 cursor-pointer accent-primary"
                checked={selected}
                onChange={() => onToggleSelect(page.id)}
              />
            </label>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(page.id, -1);
                }}
                className="p-1 text-white/80 hover:text-white disabled:opacity-30"
                title="Geser ke kiri"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(page.id);
                }}
                className="p-1 text-white/80 hover:text-red-400"
                title="Hapus halaman"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy || index === pages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(page.id, 1);
                }}
                className="p-1 text-white/80 hover:text-white disabled:opacity-30"
                title="Geser ke kanan"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      {busy && (
        <span className="px-2 text-xs text-muted-foreground">Memproses…</span>
      )}
      <span className="sr-only">
        <Button type="button" variant="ghost" />
      </span>
    </div>
  );
}
