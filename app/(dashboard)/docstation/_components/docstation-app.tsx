"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { WizardStepper } from "./wizard-stepper";
import { ModePicker } from "./mode-picker";
import { ScanConfigPanel } from "./scan-config-panel";
import { PrintOptionsPanel } from "./print-options-panel";
import { UploadPanel } from "./upload-panel";
import { SavePanel } from "./save-panel";
import { EditorStudio } from "./editor-studio";
import { PrinterStatusBadge } from "./printer-status-badge";
import { InlineProgress } from "./inline-progress";
import { usePrinterStatus } from "../_hooks/use-printer-status";
import { useDocStation } from "../_hooks/use-docstation";
import { useOpenCV } from "../_hooks/use-opencv";
import { loadPdfLib } from "@/lib/docstation/vendor-loader";
import { createPdf } from "@/lib/docstation/pdf";
import {
  DEFAULT_PRINT_CONFIG,
  DEFAULT_SAVE_CONFIG,
  DEFAULT_SCAN_CONFIG,
  type DocStationMode,
  type PrintConfig,
  type SaveConfig,
  type ScanConfig,
} from "./types";

/**
 * DocStation — orkestrator alur kerja scan & cetak.
 *
 * Modul React native bertema Sekolahku. Mesin (canvas/OpenCV/printer) berada di
 * `lib/docstation`; hook `use-docstation` menjembatani ke komponen UI.
 */
export function DocStationApp() {
  const [mode, setMode] = useState<DocStationMode | null>(null);
  const [step, setStep] = useState(1);
  // Menandai bahwa user memulai batch pindai lanjutan (append) dari editor.
  const [isRescanMode, setIsRescanMode] = useState(false);
  // Penanda auto-enhance global: hidup di orkestrator agar TIDAK ter-reset saat
  // EditorStudio di-unmount pada transisi step (mencegah batch lama di-enhance
  // ulang setelah Pindai Lagi).
  const autoEnhancedRef = useRef(false);

  const [scanConfig, setScanConfig] = useState<ScanConfig>(DEFAULT_SCAN_CONFIG);
  const [printConfig, setPrintConfig] = useState<PrintConfig>(DEFAULT_PRINT_CONFIG);
  const [saveConfig, setSaveConfig] = useState<SaveConfig>(DEFAULT_SAVE_CONFIG);
  const [printFiles, setPrintFiles] = useState<File[]>([]);
  const [readyToPrint, setReadyToPrint] = useState(false);
  // Menandai operasi cetak/simpan yang sedang berjalan di komponen ini.
  const [processing, setProcessing] = useState(false);

  const { printers: enginePrinters, defaultPrinter } = usePrinterStatus();
  const doc = useDocStation();
  const cv = useOpenCV();

  // Status sibuk gabungan: pindai, proses gambar (enhance/warp), atau cetak/simpan.
  const busy = doc.scanning || doc.busy || processing;

  // Muat vendor PDF di latar agar ekspor siap saat diminta.
  useEffect(() => {
    loadPdfLib().catch(() => {});
  }, []);

  // Daftar printer untuk dropdown: pakai hasil status; fallback ke default.
  const printers = useMemo(() => {
    if (enginePrinters.length > 0) return enginePrinters;
    return [{ ip: scanConfig.printerIp, name: "Printer Jaringan", online: undefined }];
  }, [enginePrinters, scanConfig.printerIp]);

  const scanPrinterIp = scanConfig.printerIp || defaultPrinter;
  const printPrinterIp = printConfig.printerIp || defaultPrinter;

  /**
   * Aksi tertunda yang menunggu konfirmasi pengguna saat status sibuk. Menyimpan
   * niat (ganti mode / reset sesi) agar tidak menghapus pekerjaan yang berjalan.
   */
  const [pendingAction, setPendingAction] = useState<
    { kind: "mode"; mode: DocStationMode } | { kind: "reset" } | null
  >(null);

  const confirmOpen = pendingAction !== null;

  /** Menjalankan perpindahan mode setelah sesi aman untuk direset. */
  const applyMode = useCallback(
    (m: DocStationMode) => {
      setMode(m);
      // Scan mulai dari konfigurasi (langkah 2); print dari unggah berkas (langkah 2).
      setStep(2);
      setIsRescanMode(false);
      autoEnhancedRef.current = false;
      setReadyToPrint(false);
      doc.resetSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.resetSession],
  );

  /** Mengembalikan alur ke langkah 1 dan mengosongkan sesi. */
  const applyReset = useCallback(() => {
    setMode(null);
    setStep(1);
    setIsRescanMode(false);
    autoEnhancedRef.current = false;
    doc.resetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.resetSession]);

  /**
   * Navigasi non-destruktif: hanya mengubah langkah wizard tanpa menyentuh
   * sesi dokumen (`doc.resetSession`). Dipakai tombol "Kembali" antar langkah
   * agar halaman & parameter yang sudah ada tetap utuh.
   */
  const goToStep = useCallback((n: number) => {
    setStep(n);
  }, []);

  const selectMode = useCallback(
    (m: DocStationMode) => {
      // Saat sibuk, tunda perpindahan mode agar reset sesi tidak menghapus
      // pekerjaan yang sedang berjalan — minta konfirmasi lebih dulu.
      if (busy) {
        setPendingAction({ kind: "mode", mode: m });
        return;
      }
      applyMode(m);
    },
    [busy, applyMode],
  );

  const reset = useCallback(() => {
    // Saat sibuk, minta konfirmasi sebelum menghapus sesi di tengah proses.
    if (busy) {
      setPendingAction({ kind: "reset" });
      return;
    }
    applyReset();
  }, [busy, applyReset]);

  /**
   * Membuka kembali langkah konfigurasi untuk memindai batch halaman baru.
   * Non-destruktif: tidak memanggil `resetSession`, halaman lama dipertahankan
   * dan hasil pindai baru akan di-append oleh `doc.scan()`.
   */
  const handleRescan = useCallback(() => {
    // Saat editor sedang sibuk (auto-enhance batch berjalan) jangan tinggalkan
    // step 3 — transisi akan meng-unmount EditorStudio dan meng-abort proses.
    if (busy) return;
    setIsRescanMode(true);
    setStep(2);
  }, [busy]);

  /** Melanjutkan aksi tertunda setelah pengguna mengonfirmasi. */
  const confirmPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (action.kind === "mode") {
      applyMode(action.mode);
      return;
    }
    applyReset();
  }, [pendingAction, applyMode, applyReset]);

  /** Menyiapkan halaman hasil editan menjadi berkas untuk dicetak. */
  const buildPrintFiles = useCallback(async () => {
    await loadPdfLib();
    const bytes = await createPdf(doc.stateRef.current, doc.stateRef.current.pages, {
      quality: 0.92,
      format: "jpeg",
      fitMode: "contain",
      paper: { paperSize: printConfig.paperSize, customWidth: printConfig.customWidth, customHeight: printConfig.customHeight },
    });
    return [
      {
        name: "Dokumen-Scan.pdf",
        bytes,
        contentType: "application/pdf" as const,
      },
    ];
  }, [doc.stateRef, printConfig.paperSize, printConfig.customWidth, printConfig.customHeight]);

  return (
    // Tinggi dikunci (bukan min-h-[70vh]) agar area kerja TIDAK memanjang
    // melewati bawah layar — konten panjang (mis. SavePanel) digulir di dalam
    // sendiri, dan preview kanvas berhenti tepat di tepi bawah viewport.
    // Padding sendiri diperlukan karena mode immersive menghapus padding `main`.
    <div className="flex min-h-full flex-col gap-3 px-3 py-3 md:h-full md:min-h-0 md:px-4 md:py-4">
      {/* Baris atas: langkah wizard (kiri) + status printer (kanan).
          Header internal DocStation dihapus agar ruang maksimal; status printer
          tetap terlihat di semua langkah. */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {mode ? (
            <WizardStepper mode={mode} step={step} />
          ) : (
            <WizardStepper mode="scan" step={1} disabled />
          )}
        </div>
        <PrinterStatusBadge printers={printers} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!mode && <ModePicker onSelect={selectMode} />}

        {mode === "scan" && (
          <>
            {step === 2 && doc.scanning && (
              <InlineProgress
                title="Proses Pemindaian Dokumen"
                status={doc.scanProgress?.message}
                percent={doc.scanProgress?.percent}
                onCancel={doc.cancelScan}
              />
            )}
            {step === 2 && !doc.scanning && (
              <ScanConfigPanel
                config={{ ...scanConfig, printerIp: scanPrinterIp }}
                printers={printers}
                onChange={(patch) => setScanConfig((c) => ({ ...c, ...patch }))}
                onScan={async () => {
                  const before = doc.stateRef.current.pages.length;
                  try {
                    const outcome = await doc.scan({ ...scanConfig, printerIp: scanPrinterIp });
                    const delta = doc.stateRef.current.pages.length - before;
                    // Laporkan hasil nyata ("Berhasil memindai X lembar ..."),
                    // termasuk saat dibatalkan di tengah jalan (lembar parsial).
                    if (outcome.message && (delta > 0 || outcome.aborted)) {
                      if (outcome.aborted) toast.info(outcome.message);
                      else toast.success(outcome.message);
                    }
                    if (delta > 0) {
                      // Ada halaman baru: lanjut ke editor (append ke batch lama).
                      setIsRescanMode(false);
                      setStep(3);
                    } else if (isRescanMode && !outcome.aborted) {
                      // Mode tambah halaman tapi tak ada yang masuk (mis. semua
                      // lembar kosong ter-skip) — tetap di konfigurasi. Batal
                      // sudah diumumkan lewat outcome.message, jangan diduplikasi.
                      toast.info("Semua lembar kosong terlewat");
                    }
                    // Bukan rescan & tanpa halaman: tetap di langkah 2 (perilaku lama).
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Gagal memindai dokumen");
                  }
                }}
                onBack={() => {
                  if (isRescanMode) {
                    // Kembali ke editor dengan sesi utuh (tanpa reset).
                    setIsRescanMode(false);
                    setStep(3);
                    return;
                  }
                  // Sesi awal tanpa halaman: keluar dari alur & kosongkan sesi.
                  if (doc.stateRef.current.pages.length === 0) {
                    reset();
                    return;
                  }
                  // Sudah punya halaman: navigasi non-destruktif ke langkah Mode.
                  goToStep(1);
                }}
              />
            )}
            {step === 3 && (
              <EditorStudio
                paperSize={scanConfig.paperSize}
                customWidth={scanConfig.customWidth}
                customHeight={scanConfig.customHeight}
                onProceed={() => setStep(4)}
                onRescan={handleRescan}
                doc={doc}
                cv={cv}
                autoEnhanceOnLoad={scanConfig.autoEnhance}
                autoEnhancedRef={autoEnhancedRef}
              />
            )}
            {step === 4 && (
              <>
                <SavePanel
                  config={saveConfig}
                  paperSize={scanConfig.paperSize}
                  customWidth={scanConfig.customWidth}
                  customHeight={scanConfig.customHeight}
                  pages={doc.pages}
                  engine={doc.stateRef.current}
                  saveToServer={doc.saveToServer}
                  onChange={(patch) => setSaveConfig((c) => ({ ...c, ...patch }))}
                  onBack={() => goToStep(3)}
                />
                <div className="mx-auto mt-4 flex w-full max-w-xl items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Ingin langsung cetak hasil edit?
                  </span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => {
                      setReadyToPrint(true);
                      setMode("print");
                      setStep(3);
                    }}
                  >
                    Lanjut ke Cetak →
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {mode === "print" && (
          <>
            {step === 2 && (
              <UploadPanel
                files={printFiles}
                busy={false}
                onAddFiles={(files) => setPrintFiles((prev) => [...prev, ...files])}
                onRemoveFile={(name) => setPrintFiles((prev) => prev.filter((f) => f.name !== name))}
                onNext={() => setStep(3)}
                onBack={() => goToStep(1)}
              />
            )}
            {step === 3 && (
              <>
                {readyToPrint && (
                  <div className="mx-auto mb-3 w-full max-w-2xl rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                    Halaman hasil scan & edit ({doc.pages.length}) akan dicetak sebagai PDF.
                  </div>
                )}
                <PrintOptionsPanel
                  config={{ ...printConfig, printerIp: printPrinterIp }}
                  printers={printers}
                  pageCount={readyToPrint ? doc.pages.length : printFiles.length}
                  onChange={(patch) => setPrintConfig((c) => ({ ...c, ...patch }))}
                  onPrint={async () => {
                    setProcessing(true);
                    try {
                      if (readyToPrint && doc.pages.length > 0) {
                        const printable = await buildPrintFiles();
                        await doc.print(printable, printPrinterIp, printConfig.method);
                        toast.success(`${printable.length} pekerjaan cetak dikirim ke printer`);
                        return;
                      }
                      if (printFiles.length === 0) {
                        toast.error("Belum ada berkas untuk dicetak");
                        return;
                      }
                      const printable = await Promise.all(
                        printFiles.map(async (f) => ({
                          name: f.name,
                          bytes: await f.arrayBuffer(),
                          contentType: f.type || "application/pdf",
                        })),
                      );
                      await doc.print(printable, printPrinterIp, printConfig.method);
                      toast.success(`${printable.length} pekerjaan cetak dikirim ke printer`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Gagal mencetak");
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  onBack={() => setStep(2)}
                />
              </>
            )}
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proses sedang berjalan</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "mode"
                ? "Masih ada proses yang berjalan. Mengganti mode akan mereset sesi dan menghapus pekerjaan yang belum selesai. Lanjutkan?"
                : "Masih ada proses yang berjalan. Mereset sesi akan menghapus pekerjaan yang belum selesai. Lanjutkan?"}
              {doc.busyLabel ? ` (${doc.busyLabel})` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tunggu</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Batalkan pindai yang berjalan agar reset benar-benar bersih.
                if (doc.scanning) doc.cancelScan();
                confirmPendingAction();
              }}
            >
              Ya, lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
