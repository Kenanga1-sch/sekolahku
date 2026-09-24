"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAPER_SIZE_LABELS,
  type PaperSize,
  type PrintConfig,
  type PrintMethod,
} from "./types";

interface PrintOptionsPanelProps {
  config: PrintConfig;
  printers: { ip: string; name: string; online?: boolean }[];
  pageCount: number;
  onChange: (patch: Partial<PrintConfig>) => void;
  onPrint: () => void;
  onBack: () => void;
}

/** Langkah 3 (print): pilih printer, kertas, metode kirim, lalu cetak. */
export function PrintOptionsPanel({
  config,
  printers,
  pageCount,
  onChange,
  onPrint,
  onBack,
}: PrintOptionsPanelProps) {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          Pengaturan & Cetak
        </h2>
        <p className="text-sm text-muted-foreground">
          {pageCount} halaman siap dicetak.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Printer Target
          </Label>
          <Select value={config.printerIp} onValueChange={(v) => onChange({ printerIp: v })}>
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

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Metode Kirim
          </Label>
          <RadioGroup
            value={config.method}
            onValueChange={(v) => onChange({ method: v as PrintMethod })}
            className="flex h-10 items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="raw" id="print-method-raw" />
              <Label htmlFor="print-method-raw" className="cursor-pointer text-sm font-medium">
                RAW (9100)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ipp" id="print-method-ipp" />
              <Label htmlFor="print-method-ipp" className="cursor-pointer text-sm font-medium">
                IPP
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onPrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Cetak Sekarang
        </Button>
      </div>
    </section>
  );
}
