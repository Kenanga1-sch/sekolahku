"use client";

import { useEffect, useState } from "react";

import { ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  capsMaxMMLabel,
  esclRegionUnits,
  fetchScannerCaps,
  regionExceedsCaps,
  supportedResolutions,
  type ScannerCaps,
} from "@/lib/docstation/escl-caps";
import {
  PAPER_SIZE_LABELS,
  PRESET_LABELS,
  RESOLUTION_OPTIONS,
  SOURCE_LABELS,
  type PaperSize,
  type ScanConfig,
  type ScanPreset,
  type ScanSource,
} from "./types";

interface ScanConfigPanelProps {
  config: ScanConfig;
  printers: { ip: string; name: string; online?: boolean }[];
  onChange: (patch: Partial<ScanConfig>) => void;
  onScan: () => void;
  onBack: () => void;
}

/** Langkah 2 (scan): pilih printer, ukuran kertas, sumber, preset, resolusi. */
export function ScanConfigPanel({
  config,
  printers,
  onChange,
  onScan,
  onBack,
}: ScanConfigPanelProps) {
  // Kemampuan printer (DPI didukung & batas area) — diambil saat printer
  // dipilih; bila gagal, panel tetap memakai daftar statis. State menyimpan
  // IP pemilik caps agar hasil lambat dari printer lama tidak terpakai.
  const [capsState, setCapsState] = useState<{ ip: string; caps: ScannerCaps | null } | null>(null);
  useEffect(() => {
    if (!config.printerIp) return;
    let cancelled = false;
    const ac = new AbortController();
    fetchScannerCaps(config.printerIp, ac.signal)
      .then((c) => {
        if (!cancelled) setCapsState({ ip: config.printerIp, caps: c });
      })
      .catch(() => {
        if (!cancelled) setCapsState({ ip: config.printerIp, caps: null });
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [config.printerIp]);

  const caps = capsState && capsState.ip === config.printerIp ? capsState.caps : null;

  const resolutionOptions = supportedResolutions(caps, config.source, RESOLUTION_OPTIONS);

  // DPI yang tak didukung printer (mis. sisa sesi lama) → koreksi otomatis.
  useEffect(() => {
    if (caps && !resolutionOptions.includes(config.resolution)) {
      onChange({
        resolution: resolutionOptions.includes(300)
          ? 300
          : resolutionOptions[resolutionOptions.length - 1],
      });
    }
  }, [caps, config.resolution, onChange, resolutionOptions]);

  const region = esclRegionUnits(config.paperSize, config.customWidth, config.customHeight);
  const oversize = regionExceedsCaps(region, caps, config.source);
  const oversizeLabel = capsMaxMMLabel(caps, config.source);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          Konfigurasi Scan
        </h2>
        <p className="text-sm text-muted-foreground">
          Atur target printer dan parameter pemindaian.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Printer Target
          </Label>
          <Select
            value={config.printerIp}
            onValueChange={(v) => onChange({ printerIp: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih printer" />
            </SelectTrigger>
            <SelectContent>
              {printers.map((p) => (
                <SelectItem key={p.ip} value={p.ip}>
                  {p.ip} — {p.name}
                  {p.online === false ? " (Offline)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Ukuran Kertas
          </Label>
          <Select
            value={config.paperSize}
            onValueChange={(v) => onChange({ paperSize: v as PaperSize })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAPER_SIZE_LABELS) as PaperSize[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PAPER_SIZE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {config.paperSize === "custom" && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                Lebar (mm)
              </Label>
              <Input
                type="number"
                min={10}
                max={2000}
                value={config.customWidth ?? 210}
                onChange={(e) => onChange({ customWidth: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                Tinggi (mm)
              </Label>
              <Input
                type="number"
                min={10}
                max={2000}
                value={config.customHeight ?? 297}
                onChange={(e) => onChange({ customHeight: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {oversize && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive sm:col-span-2">
            {config.source === "adf" ? "Panjang kertas melebihi kapasitas ADF" : "Ukuran kertas melebihi area kaca"}{" "}
            printer (maks {oversizeLabel}) — hasil scan akan dipotong printer.
          </p>
        )}

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Sumber Masukan
          </Label>
          <Select
            value={config.source}
            onValueChange={(v) => onChange({ source: v as ScanSource })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SOURCE_LABELS) as ScanSource[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SOURCE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Preset Warna
          </Label>
          <Select
            value={config.preset}
            onValueChange={(v) => onChange({ preset: v as ScanPreset })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as ScanPreset[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PRESET_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Resolusi (DPI)
          </Label>
          <Select
            value={String(config.resolution)}
            onValueChange={(v) => onChange({ resolution: Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resolutionOptions.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r} DPI
                  {r === 300 ? " (Standar Arsip)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
          <Checkbox
            checked={config.autoEnhance ?? false}
            onCheckedChange={(v) => onChange({ autoEnhance: v === true })}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Perbaiki otomatis hasil scan</span>
            <span className="block text-xs text-muted-foreground">
              Auto-crop tepi kertas, deskew, dan bersihkan background setiap halaman.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
          <Checkbox
            checked={config.skipBlank ?? false}
            onCheckedChange={(v) => onChange({ skipBlank: v === true })}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Lewati halaman kosong</span>
            <span className="block text-xs text-muted-foreground">
              Berguna untuk pemindaian ADF: halaman tanpa konten akan dibuang otomatis.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onScan} className="gap-2">
          <ScanLine className="h-4 w-4" />
          Mulai Pindai Sekarang
        </Button>
      </div>
    </section>
  );
}
