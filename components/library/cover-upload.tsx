// Field sampul buku bersama untuk modul Perpustakaan (Binding & Tambah/Edit
// Buku): menerima upload gambar seperti biasa ATAU scan langsung dari printer
// LAN via lapisan murni DocStation (lib/docstation/api.ts) — tanpa membuka
// halaman DocStation penuh.
//
// Hasil scan discrop manual lewat bingkai 8-titik-handle (ScanCropFrame)
// lalu dikirim ke endpoint yang sudah ada: POST /api/library/catalog/cover
// (multipart `file` + opsional `isbn`). Tidak ada perubahan backend.

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrinterInfo } from "@/app/(dashboard)/docstation/_components/types";
import { RESOLUTION_OPTIONS } from "@/app/(dashboard)/docstation/_components/types";
import { goPost } from "@/lib/api-client";
import { fetchPrinters, requestScan } from "@/lib/docstation/api";
import { fetchScannerCaps, supportedResolutions } from "@/lib/docstation/escl-caps";
import getCroppedImg from "@/lib/crop-image";
import { cn, compressImage } from "@/lib/utils";

import {
  ScanCropFrame,
  type NaturalArea,
  type ScanCropFrameHandle,
} from "./scan-crop-frame";

/**
 * Resolusi scan sampul: DPI TERENDAH yang didukung printer terpilih
 * (mis. Canon G7000 = 75, Epson L6270 = 100). Bila caps tak terbaca,
 * pakai 100 — aman untuk kedua printer di jaringan.
 */
async function lowestDpi(printerIp: string): Promise<number> {
  const caps = await fetchScannerCaps(printerIp).catch(() => null);
  if (!caps) return 100;
  return supportedResolutions(caps, "flatbed", RESOLUTION_OPTIONS)[0] ?? 100;
}

/** Validasi → kompres → POST ke endpoint cover; mengembalikan URL publik. */
export async function uploadCoverFile(file: File, isbn?: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar");
  let uploadFile = file;
  try {
    uploadFile = await compressImage(file, 600, 0.85);
  } catch (error) {
    console.error("Cover image compression failed:", error);
  }
  const formData = new FormData();
  formData.append("file", uploadFile);
  if (isbn) formData.append("isbn", isbn);
  const data = await goPost<{ error?: string; url?: string }>(
    "/api/library/catalog/cover",
    formData,
  );
  if (data?.error || !data?.url) throw new Error(data?.error || "Gagal mengunggah sampul.");
  return data.url;
}

export interface CoverFieldProps {
  coverUrl?: string;
  isbn?: string;
  onCoverChange: (url: string) => void;
  /** "sm" = kotak lebar tetap (dialog Tambah/Edit), "fluid" = ikut kolom grid. */
  size?: "sm" | "fluid";
  /** Pembungkus opsional (mis. kolom grid pada Binding). */
  wrapperClassName?: string;
  /** Caption opsional di bawah kotak. */
  caption?: React.ReactNode;
  /** Dipanggil saat upload file berjalan (dipakai halaman utk men-disable form). */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Kotak sampul: klik = upload file seperti biasa; tersedia juga tombol
 * Pindai untuk mengambil gambar langsung dari scanner printer.
 */
export function CoverField({
  coverUrl,
  isbn,
  onCoverChange,
  size = "sm",
  wrapperClassName,
  caption,
  onBusyChange,
}: CoverFieldProps) {
  const inputId = useId();
  const [scanOpen, setScanOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onBusyChange?.(true);
    setUploading(true);
    try {
      const url = await uploadCoverFile(file, isbn);
      onCoverChange(url);
      toast.success("Sampul berhasil diunggah!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error && error.message !== "File harus berupa gambar"
          ? error.message
          : "Terjadi kesalahan saat mengunggah.",
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  const content = (
    <>
      {coverUrl ? (
        <div
          className={cn(
            "group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center shadow-sm",
            size === "sm" ? "w-24 flex-shrink-0" : "w-full",
          )}
        >
          <img
            src={coverUrl}
            alt="Sampul"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Label
              htmlFor={inputId}
              title="Unggah gambar"
              className="cursor-pointer rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <Upload className="h-4 w-4" />
              <span className="sr-only">Unggah gambar</span>
            </Label>
            <button
              type="button"
              title="Pindai sampul"
              aria-label="Pindai sampul"
              onClick={() => setScanOpen(true)}
              className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/50 flex flex-col items-center justify-center text-center transition-colors hover:border-muted-foreground/40",
            size === "sm" ? "w-24 flex-shrink-0 p-2" : "w-full p-4",
          )}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <Upload
            className={cn(
              "mb-1 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/60",
              size === "sm" ? "h-5 w-5" : "h-8 w-8 mb-2",
            )}
          />
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 sm:text-[10px]">
            Upload Sampul
          </p>
          <button
            type="button"
            title="Pindai sampul"
            aria-label="Pindai sampul"
            onClick={(e) => {
              e.stopPropagation();
              setScanOpen(true);
            }}
            className="absolute bottom-1.5 right-1.5 rounded-md border border-border bg-background/80 p-1 text-muted-foreground transition-colors hover:text-primary"
          >
            <ScanLine className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <input
        type="file"
        id={inputId}
        className="hidden"
        accept="image/*"
        onChange={handleFile}
        disabled={uploading}
      />
      {caption ? (
        <p className="text-center text-[10px] italic text-muted-foreground">{caption}</p>
      ) : null}
      <CoverScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        isbn={isbn}
        onCoverChange={onCoverChange}
      />
    </>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{content}</div>;
  }
  return content;
}

export interface CoverScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isbn?: string;
  onCoverChange: (url: string) => void;
}

/** Dialog dua tahap: pilih printer → pindai → sesuaikan hasil (crop) → upload. */
export function CoverScanDialog({ open, onOpenChange, isbn, onCoverChange }: CoverScanDialogProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printerIp, setPrinterIp] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [step, setStep] = useState<"scan" | "crop">("scan");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [areaPixels, setAreaPixels] = useState<NaturalArea | null>(null);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scanUrlRef = useRef<string | null>(null);
  const frameApiRef = useRef<ScanCropFrameHandle>(null);

  // Bebaskan objectURL hasil scan saat komponen dilepas.
  useEffect(() => {
    return () => {
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
    };
  }, []);

  // Muat daftar printer saat dialog dibuka (hanya sekali; gagal → coba lagi
  // pada pembukaan berikutnya).
  useEffect(() => {
    if (!open || printers.length > 0) return;
    let cancelled = false;
    fetchPrinters()
      .then((cfg) => {
        if (cancelled) return;
        setPrinters(cfg.printers);
        setPrinterIp((prev) => prev || cfg.defaultPrinter || cfg.printers[0]?.ip || "");
      })
      .catch(() => {
        if (!cancelled) toast.error("Gagal memuat daftar printer");
      });
    return () => {
      cancelled = true;
    };
  }, [open, printers.length]);

  const resetScan = () => {
    abortRef.current?.abort();
    if (scanUrlRef.current) {
      URL.revokeObjectURL(scanUrlRef.current);
      scanUrlRef.current = null;
    }
    setImageSrc(null);
    setStep("scan");
    setAreaPixels(null);
    setProgress(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetScan();
      setScanning(false);
      setSaving(false);
    }
    onOpenChange(next);
  };

  const startScan = async () => {
    if (!printerIp) {
      toast.error("Pilih printer terlebih dahulu");
      return;
    }
    const aborter = new AbortController();
    abortRef.current = aborter;
    setScanning(true);
    setProgress({ message: "Menyiapkan pemindaian…", percent: 0 });
    try {
      const resolution = await lowestDpi(printerIp);
      const outcome = await requestScan({
        resolution,
        preset: "color",
        paperSize: "a4",
        source: "flatbed",
        printerIp,
        onProgress: (message, percent) => setProgress({ message, percent }),
        signal: aborter.signal,
      });
      const blob = outcome.blobs[0];
      if (!blob) {
        toast.error("Tidak ada hasil scan dari printer");
        return;
      }
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
      const url = URL.createObjectURL(blob);
      scanUrlRef.current = url;
      setImageSrc(url);
      setAreaPixels(null);
      setStep("crop");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(error instanceof Error ? error.message : "Gagal memindai sampul");
      }
    } finally {
      setScanning(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const applyCrop = async () => {
    if (!imageSrc || !areaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, areaPixels);
      if (!blob) throw new Error("Gagal memotong hasil scan");
      const file = new File([blob], "cover-scan.jpg", { type: "image/jpeg" });
      const url = await uploadCoverFile(file, isbn);
      onCoverChange(url);
      toast.success("Sampul dari hasil scan terpasang!");
      handleOpenChange(false);
    } catch (error) {
      console.error("Scan cover upload error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah hasil scan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pindai Sampul Buku</DialogTitle>
          <DialogDescription>
            Pindai sampul dari printer, sesuaikan hasilnya, lalu pasang ke formulir.
          </DialogDescription>
        </DialogHeader>

        {step === "scan" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cover-scan-printer">Printer</Label>
              <Select
                value={printerIp || undefined}
                onValueChange={setPrinterIp}
                disabled={scanning || printers.length === 0}
              >
                <SelectTrigger id="cover-scan-printer">
                  <SelectValue
                    placeholder={printers.length > 0 ? "Pilih printer" : "Memuat printer…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.ip} value={p.ip}>
                      {p.name}
                      {p.online === false ? " (Offline)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Setelan tetap: A4 · warna · kaca datar ·{" "}
              <span className="font-semibold text-foreground">resolusi terendah printer</span>{" "}
              (hemat waktu, cukup untuk sampul).
            </p>
            {progress && (
              <p className="text-xs font-medium text-primary" aria-live="polite">
                {progress.message} ({progress.percent}%)
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative h-72 w-full overflow-hidden rounded-md bg-black">
              {imageSrc && (
                <ScanCropFrame
                  key={imageSrc}
                  ref={frameApiRef}
                  imageSrc={imageSrc}
                  onAreaChange={setAreaPixels}
                />
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Bingkai sudah membingkai gambar. Tarik 8 titik di sudut/tepi untuk
                memotong, seret di dalam bingkai untuk menggeser, atau seret di luar
                untuk membuat bingkai baru.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => frameApiRef.current?.reset()}
              >
                Penuh
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === "scan" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={scanning}>
                Batal
              </Button>
              {scanning ? (
                <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
                  Hentikan
                </Button>
              ) : (
                <Button onClick={startScan} disabled={!printerIp || printers.length === 0}>
                  <ScanLine className="mr-1.5 h-4 w-4" /> Mulai Pindai
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetScan();
                }}
                disabled={saving}
              >
                Pindai Ulang
              </Button>
              <Button onClick={applyCrop} disabled={!areaPixels || saving}>
                {saving ? "Mengunggah…" : "Gunakan Sampul"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
