"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Save, CloudUpload, Folder, Archive } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPdf } from "@/lib/docstation/pdf";
import { renderPageToCanvas } from "@/lib/docstation/canvas";
import { loadPdfLib } from "@/lib/docstation/vendor-loader";
import { uploadFileWithProgress } from "@/lib/cloudstorage/api";
import { archiveScanFile } from "@/lib/docstation/api";
import { FolderPickerDialog } from "@/app/(dashboard)/cloud-storage/_components/folder-picker-dialog";
import type { SaveConfig, SaveFormat, SaveLocation, PaperSize } from "./types";

interface SavePanelProps {
  config: SaveConfig;
  paperSize: PaperSize;
  customWidth?: number;
  customHeight?: number;
  pages: { id: string; name: string; rotation: number; fineRotation: number }[];
  engine: import("@/lib/docstation/state").EngineState;
  saveToServer: (file: import("@/lib/docstation/api").PrintableFile) => Promise<void>;
  onChange: (patch: Partial<SaveConfig>) => void;
  onBack: () => void;
}

/** Mengunduh satu berkas dari memori. */
function downloadBlob(file: { name: string; bytes: Uint8Array; contentType: string }) {
  const blob = new Blob([file.bytes as BlobPart], { type: file.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Mengunggah berkas hasil scan ke Cloud Storage pribadi pengguna. */
async function uploadToCloud(
  file: { name: string; bytes: Uint8Array; contentType: string },
  parentId: string | null,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
) {
  const blob = new Blob([file.bytes as BlobPart], { type: file.contentType });
  const asFile = new File([blob], file.name, { type: file.contentType });
  await uploadFileWithProgress(asFile, parentId, onProgress ?? (() => {}), signal);
}

/**
 * Langkah 4 (scan): susun PDF/gambar dari halaman dan simpan ke unduhan atau
 * server sekolah.
 */
export function SavePanel({
  config,
  paperSize,
  customWidth,
  customHeight,
  pages,
  engine,
  saveToServer,
  onChange,
  onBack,
}: SavePanelProps) {
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onProgress = (percent: number) => setUploadPercent(percent);

  const handleSave = async () => {
    if (pages.length === 0) {
      toast.error("Belum ada halaman untuk disimpan");
      return;
    }
    setBusy(true);
    setUploadPercent(null);
    const aborter = new AbortController();
    abortRef.current = aborter;
    try {
      const baseName = config.fileName || "Dokumen-Scan";
      if (config.format === "pdf") {
        await loadPdfLib();
        const bytes = await createPdf(engine, engine.pages, {
          quality: 0.92,
          format: "jpeg",
          fitMode: "contain",
          paper: { paperSize, customWidth, customHeight },
        });
        const file = {
          name: `${baseName}.pdf`,
          bytes,
          contentType: "application/pdf",
        };
        if (config.location === "download") {
          downloadBlob(file);
          toast.success("PDF berhasil diunduh");
        } else if (config.location === "cloud") {
          await uploadToCloud(file, config.cloudParentId ?? null, onProgress, aborter.signal);
          toast.success("PDF tersimpan di Cloud Storage");
        } else if (config.location === "arsip") {
          const meta = config.archive;
          if (!meta || !meta.subject.trim() || !meta.party.trim()) {
            toast.error("Perihal dan pengirim/tujuan wajib diisi");
            return;
          }
          const res = await archiveScanFile(file, {
            category: meta.category,
            originalNumber: meta.originalNumber,
            party: meta.party,
            subject: meta.subject,
            dateOfLetter: meta.dateOfLetter,
            receivedAt: meta.receivedAt,
            classificationCode: meta.classificationCode,
            notes: meta.notes,
          });
          toast.success(
            meta.category === "surat-masuk"
              ? "Surat masuk berhasil diarsipkan"
              : `Surat keluar berhasil diarsipkan${res.mailNumber ? ` (${res.mailNumber})` : ""}`,
          );
        } else {
          await saveToServer(file);
          toast.success("PDF tersimpan di server");
        }
        return;
      }

      // Format gambar (jpg/png) — hanya mendukung unduhan/server/cloud.
      if (config.location === "arsip") {
        toast.error("Arsip persuratan hanya mendukung format PDF. Pilih format PDF.");
        return;
      }
      const format = config.format;
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const ext = format;
      const done: { name: string; bytes: Uint8Array; contentType: string }[] = [];
      for (const page of engine.pages) {
        const canvas = document.createElement("canvas");
        renderPageToCanvas(engine, page, canvas, { maxDimension: 2600 });
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, mime, 0.92),
        );
        if (!blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        done.push({ name: `${baseName}-${page.name}.${ext}`, bytes, contentType: mime });
      }

      if (config.location === "download") {
        for (const file of done) downloadBlob(file);
        toast.success(`${done.length} berkas diunduh`);
      } else if (config.location === "cloud") {
        for (const file of done) await uploadToCloud(file, config.cloudParentId ?? null, onProgress, aborter.signal);
        toast.success(`${done.length} berkas tersimpan di Cloud Storage`);
      } else {
        for (const file of done) await saveToServer(file);
        toast.success(`${done.length} berkas tersimpan di server`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      abortRef.current = null;
      setUploadPercent(null);
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-xl space-y-6 py-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          Simpan Hasil
        </h2>
        <p className="text-sm text-muted-foreground">
          {pages.length} halaman siap disimpan.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="save-filename" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Nama Berkas
          </Label>
          <Input
            id="save-filename"
            value={config.fileName}
            onChange={(e) => onChange({ fileName: e.target.value })}
            placeholder="Dokumen-Scan"
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Format
          </Label>
          <Select value={config.format} onValueChange={(v) => onChange({ format: v as SaveFormat })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF (Semua halaman)</SelectItem>
              <SelectItem value="jpg">JPG (Per halaman)</SelectItem>
              <SelectItem value="png">PNG (Per halaman)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
            Lokasi
          </Label>
          <RadioGroup
            value={config.location}
            onValueChange={(v) => onChange({ location: v as SaveLocation })}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="download" id="save-loc-download" />
              <Label htmlFor="save-loc-download" className="cursor-pointer text-sm font-medium">
                Unduh ke Perangkat
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="server" id="save-loc-server" />
              <Label htmlFor="save-loc-server" className="cursor-pointer text-sm font-medium">
                Simpan di Server Sekolah
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cloud" id="save-loc-cloud" />
              <Label htmlFor="save-loc-cloud" className="cursor-pointer text-sm font-medium">
                Simpan ke Cloud Storage
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="arsip" id="save-loc-arsip" />
              <Label htmlFor="save-loc-arsip" className="cursor-pointer text-sm font-medium">
                Arsipkan ke e-Arsip Persuratan
              </Label>
            </div>
          </RadioGroup>

          {config.location === "cloud" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border p-3">
              <Folder className="h-4 w-4 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Folder tujuan</p>
                <p className="truncate text-sm font-medium">
                  {config.cloudParentName || "Beranda (akar)"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                Ubah
              </Button>
            </div>
          )}

          {config.location === "arsip" && config.archive && (
            <div className="mt-3 space-y-3 rounded-lg border border-dashed border-border p-3">
              {config.format !== "pdf" && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Arsip persuratan hanya mendukung format PDF. Ubah format ke PDF.
                </p>
              )}
              <div>
                <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                  Jenis Arsip
                </Label>
                <Select
                  value={config.archive.category}
                  onValueChange={(v) =>
                    onChange({
                      archive: { ...config.archive!, category: v as "surat-masuk" | "surat-keluar" },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surat-masuk">Surat Masuk</SelectItem>
                    <SelectItem value="surat-keluar">Surat Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="arsip-subject" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                  Perihal <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="arsip-subject"
                  value={config.archive.subject}
                  onChange={(e) => onChange({ archive: { ...config.archive!, subject: e.target.value } })}
                  placeholder="Perihal surat"
                />
              </div>

              <div>
                <Label htmlFor="arsip-party" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                  {config.archive.category === "surat-masuk" ? "Pengirim" : "Tujuan"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="arsip-party"
                  value={config.archive.party}
                  onChange={(e) => onChange({ archive: { ...config.archive!, party: e.target.value } })}
                  placeholder={config.archive.category === "surat-masuk" ? "Instansi pengirim" : "Instansi/perorangan tujuan"}
                />
              </div>

              {config.archive.category === "surat-masuk" && (
                <div>
                  <Label htmlFor="arsip-original-number" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                    Nomor Surat Asli
                  </Label>
                  <Input
                    id="arsip-original-number"
                    value={config.archive.originalNumber}
                    onChange={(e) => onChange({ archive: { ...config.archive!, originalNumber: e.target.value } })}
                    placeholder="Nomor surat dari pengirim"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="arsip-date" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                    Tanggal Surat
                  </Label>
                  <DateInput
                    id="arsip-date"
                    type="date"
                    value={config.archive.dateOfLetter}
                    onChange={(e) => onChange({ archive: { ...config.archive!, dateOfLetter: e.target.value } })}
                  />
                </div>
                {config.archive.category === "surat-masuk" && (
                  <div>
                    <Label htmlFor="arsip-received" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                      Tanggal Diterima
                    </Label>
                    <DateInput
                      id="arsip-received"
                      type="date"
                      value={config.archive.receivedAt}
                      onChange={(e) => onChange({ archive: { ...config.archive!, receivedAt: e.target.value } })}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="arsip-classification" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                  Kode Klasifikasi
                </Label>
                <Input
                  id="arsip-classification"
                  value={config.archive.classificationCode}
                  onChange={(e) => onChange({ archive: { ...config.archive!, classificationCode: e.target.value } })}
                  placeholder="mis. 421"
                />
              </div>

              <div>
                <Label htmlFor="arsip-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider">
                  Catatan
                </Label>
                <Textarea
                  id="arsip-notes"
                  value={config.archive.notes}
                  onChange={(e) => onChange({ archive: { ...config.archive!, notes: e.target.value } })}
                  placeholder="Catatan tambahan (opsional)"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pemilih folder Cloud Storage */}
      {pickerOpen && (
        <FolderPickerDialog
          title="Pilih Folder Cloud Storage"
          onClose={() => setPickerOpen(false)}
          onPick={(folderId, name) => {
            onChange({
              cloudParentId: folderId,
              cloudParentName: name,
            });
            setPickerOpen(false);
          }}
        />
      )}

      {busy && uploadPercent !== null && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Mengunggah ke Cloud…</span>
            <span>{uploadPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, uploadPercent))}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Batalkan unggahan
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          ← Kembali ke Edit
        </Button>
        <Button onClick={handleSave} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : config.location === "download" ? <Download className="h-4 w-4" /> : config.location === "cloud" ? <CloudUpload className="h-4 w-4" /> : config.location === "arsip" ? <Archive className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {busy ? "Memproses…" : "Simpan"}
        </Button>
      </div>
    </section>
  );
}
