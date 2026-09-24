"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

  const [scanConfig, setScanConfig] = useState<ScanConfig>(DEFAULT_SCAN_CONFIG);
  const [printConfig, setPrintConfig] = useState<PrintConfig>(DEFAULT_PRINT_CONFIG);
  const [saveConfig, setSaveConfig] = useState<SaveConfig>(DEFAULT_SAVE_CONFIG);
  const [printFiles, setPrintFiles] = useState<File[]>([]);
  const [readyToPrint, setReadyToPrint] = useState(false);

  const { printers: enginePrinters, defaultPrinter } = usePrinterStatus();
  const doc = useDocStation();
  const cv = useOpenCV();

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

  const selectMode = useCallback(
    (m: DocStationMode) => {
      setMode(m);
      // Scan mulai dari konfigurasi (langkah 2); print dari unggah berkas (langkah 2).
      setStep(2);
      setReadyToPrint(false);
      doc.resetSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.resetSession],
  );

  const reset = useCallback(() => {
    setMode(null);
    setStep(1);
    doc.resetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.resetSession]);

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
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-extrabold text-primary">
            D
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              DocStation
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                Scan & Cetak
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Pusat operasional scan & cetak dokumen jaringan
            </p>
          </div>
        </div>
        <PrinterStatusBadge printers={printers} />
      </div>

      {mode && step > 1 && <WizardStepper mode={mode} step={step} />}

      <div className="flex flex-1 flex-col">
        {!mode && <ModePicker onSelect={selectMode} />}

        {mode === "scan" && (
          <>
            {step === 2 && doc.scanning && (
              <InlineProgress
                title="Proses Pemindaian Dokumen"
                status={doc.scanProgress?.message}
                percent={doc.scanProgress?.percent}
              />
            )}
            {step === 2 && !doc.scanning && (
              <ScanConfigPanel
                config={{ ...scanConfig, printerIp: scanPrinterIp }}
                printers={printers}
                onChange={(patch) => setScanConfig((c) => ({ ...c, ...patch }))}
                onScan={async () => {
                  try {
                    await doc.scan({ ...scanConfig, printerIp: scanPrinterIp });
                    setStep(3);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Gagal memindai dokumen");
                  }
                }}
                onBack={reset}
              />
            )}
            {step === 3 && (
              <EditorStudio
                paperSize={scanConfig.paperSize}
                customWidth={scanConfig.customWidth}
                customHeight={scanConfig.customHeight}
                onProceed={() => setStep(4)}
                doc={doc}
                cv={cv}
                autoEnhanceOnLoad={scanConfig.autoEnhance}
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
                  onBack={() => setStep(3)}
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
                onBack={reset}
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
                    }
                  }}
                  onBack={() => setStep(2)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
