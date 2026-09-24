"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LETTER_BLOCK_DEFINITIONS,
  LETTER_BLOCK_GROUPS,
  getBlockDefinition,
  type LetterBlockGroup,
  type LetterBlockInstance,
} from "@/lib/config/letter-blocks";
import { cn } from "@/lib/utils";

interface BlockPaletteProps {
  /** Blok yang sudah terpasang (untuk menonaktifkan blok tunggal yang sudah ada). */
  blocks: LetterBlockInstance[];
  /** Callback saat sebuah blok dipilih untuk ditambahkan. */
  onAdd: (blockId: string) => void;
  /**
   * Arah tata letak daftar blok:
   *  - "grid"    : kartu bertumpuk (cocok untuk sidebar/tab mobile)
   *  - "ribbon"  : tombol rapat dalam baris yang bisa di-scroll horizontal
   */
  layout?: "grid" | "ribbon";
  className?: string;
}

/**
 * Palet blok: filter grup + daftar tombol "Tambah Blok".
 *
 * Komponen ini dipakai bersama oleh ribbon desktop (layout="ribbon") dan
 * tab "Tambah" pada mobile (layout="grid"). Menyimpan state filter grup di
 * dalamnya agar kedua konteks tetap mandiri.
 */
export function BlockPalette({
  blocks,
  onAdd,
  layout = "grid",
  className,
}: BlockPaletteProps) {
  const [pickGroup, setPickGroup] = useState<LetterBlockGroup | "all">("all");

  const usedSingle = useMemo(
    () =>
      new Set(
        blocks
          .filter((b) => !getBlockDefinition(b.blockId)?.repeatable)
          .map((b) => b.blockId)
      ),
    [blocks]
  );

  const visibleDefs = useMemo(
    () =>
      LETTER_BLOCK_DEFINITIONS.filter(
        (d) => pickGroup === "all" || d.group === pickGroup
      ),
    [pickGroup]
  );

  const isRibbon = layout === "ribbon";

  return (
    <div className={cn("flex flex-col gap-2", isRibbon && "min-w-0", className)}>
      {/* Filter grup */}
      <div
        className={cn(
          "flex items-center gap-1",
          isRibbon ? "overflow-x-auto pb-0.5" : "flex-wrap"
        )}
      >
        <Badge
          variant={pickGroup === "all" ? "default" : "outline"}
          className="shrink-0 cursor-pointer text-[10px]"
          onClick={() => setPickGroup("all")}
        >
          Semua
        </Badge>
        {LETTER_BLOCK_GROUPS.map((g) => (
          <Badge
            key={g.id}
            variant={pickGroup === g.id ? "default" : "outline"}
            className="shrink-0 cursor-pointer text-[10px]"
            onClick={() => setPickGroup(g.id)}
          >
            {g.label}
          </Badge>
        ))}
      </div>

      {/* Daftar tombol blok */}
      <div
        className={cn(
          isRibbon
            ? "flex items-stretch gap-1.5 overflow-x-auto pb-1"
            : "grid grid-cols-1 gap-1"
        )}
      >
        {visibleDefs.map((def) => {
          const disabled = !def.repeatable && usedSingle.has(def.id);
          if (isRibbon) {
            return (
              <button
                key={def.id}
                type="button"
                disabled={disabled}
                title={disabled ? "Sudah ditambahkan" : def.description}
                onClick={() => onAdd(def.id)}
                className={cn(
                  "flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-card px-2 py-2 text-center transition-colors",
                  "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                  disabled && "cursor-not-allowed opacity-40 hover:border-inherit hover:bg-card"
                )}
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span className="line-clamp-2 text-[10px] font-medium leading-tight">
                  {def.label}
                </span>
              </button>
            );
          }
          return (
            <Button
              key={def.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-auto justify-start py-1.5 text-left"
              onClick={() => onAdd(def.id)}
            >
              <Plus className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="flex flex-col">
                <span className="text-xs font-medium">{def.label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {disabled ? "Sudah ditambahkan" : def.description}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
