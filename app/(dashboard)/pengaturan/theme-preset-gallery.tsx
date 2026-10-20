"use client";

import { useMemo, useState } from "react";
import { Bookmark, Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrandTheme } from "@/lib/theme";
import type { ThemePreset } from "@/lib/theme-presets";

const ALL = "Semua";

interface ThemePresetGalleryProps {
  presets: ThemePreset[];
  activeTheme: BrandTheme;
  onApply: (preset: ThemePreset) => void;
  onSaveCurrent: () => void;
  saving?: boolean;
}

function themeKey(theme: BrandTheme): string {
  return [
    theme.primary,
    theme.secondary,
    theme.accent,
    theme.background,
    theme.public_bg,
    theme.foreground,
    theme.muted_foreground,
    theme.border,
    theme.radius,
  ]
    .join("|")
    .toLowerCase();
}

function Swatches({ preset }: { preset: ThemePreset }) {
  const colors = [
    preset.theme.primary,
    preset.theme.secondary,
    preset.theme.accent,
    preset.theme.background,
  ];
  return (
    <span className="flex overflow-hidden rounded-md border border-line/70" aria-hidden="true">
      {colors.map((color, i) => (
        <span key={i} className="h-5 w-5" style={{ background: color }} />
      ))}
    </span>
  );
}

/**
 * Galeri preset tema: pencarian + filter keluarga warna + penanda preset aktif.
 * Klik kartu hanya mengisi draft (belum menyimpan) — lihat tab-landing-sections.
 */
export default function ThemePresetGallery({
  presets,
  activeTheme,
  onApply,
  onSaveCurrent,
  saving = false,
}: ThemePresetGalleryProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string>(ALL);

  const families = useMemo(() => {
    const seen = new Set<string>();
    for (const preset of presets) {
      if (preset.family) seen.add(preset.family);
    }
    return [ALL, ...Array.from(seen).sort((a, b) => a.localeCompare(b, "id"))];
  }, [presets]);

  const activeKey = themeKey(activeTheme);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets.filter((preset) => {
      if (family !== ALL && preset.family !== family) return false;
      if (!q) return true;
      return (
        preset.name.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        (preset.family ?? "").toLowerCase().includes(q)
      );
    });
  }, [presets, query, family]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari preset (mis. sekolah, teal, hangat)"
            aria-label="Cari preset tema"
            className="h-9 pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onSaveCurrent} disabled={saving}>
          <Bookmark className="mr-1 h-3.5 w-3.5" /> Simpan preset ini
        </Button>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {families.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFamily(item)}
            aria-pressed={family === item}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              family === item
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line/70 bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-line/70 bg-surface-muted/40 p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Tidak ada preset yang cocok. Coba kata kunci lain.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((preset) => {
              const isActive = themeKey(preset.theme) === activeKey;
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => onApply(preset)}
                    title={preset.description}
                    aria-pressed={isActive}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border bg-surface p-2.5 text-left transition-colors",
                      isActive
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-line/70 hover:border-primary/40"
                    )}
                  >
                    <Swatches preset={preset} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-tight">
                        {preset.name}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {preset.family ?? "Lain"}
                      </span>
                    </span>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {filtered.length} dari {presets.length} preset. Ketuk preset untuk memuatnya ke draft —
        preview di bawah langsung berubah, lalu tekan <strong>Simpan Tema</strong> agar berlaku
        untuk seluruh situs.
      </p>
    </div>
  );
}
