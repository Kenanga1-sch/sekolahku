"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, FileDown, Printer, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CanvasOverlay, type CanvasOverlayHandle } from "./canvas-overlay";
import { EditorToolbar } from "./editor-toolbar";
import { PageStrip } from "./page-strip";
import type { useDocStation } from "../_hooks/use-docstation";
import type { useOpenCV } from "../_hooks/use-opencv";
import { loadPdfLib } from "@/lib/docstation/vendor-loader";
import { createPdf } from "@/lib/docstation/pdf";
import type { DocStationTool } from "@/lib/docstation/state";
import type { PaperSize } from "./types";

interface EditorStudioProps {
  paperSize: PaperSize;
  customWidth?: number;
  customHeight?: number;
  onProceed: () => void;
  /** Membuka kembali langkah konfigurasi untuk memindai batch halaman baru. */
  onRescan?: () => void;
  doc: ReturnType<typeof useDocStation>;
  cv: ReturnType<typeof useOpenCV>;
  /** Jalankan perbaikan otomatis untuk semua halaman saat editor dibuka. */
  autoEnhanceOnLoad?: boolean;
  /**
   * Ref penanda "auto-enhance sudah dijalankan". Diberikan dari parent agar
   * tetap hidup lintas mount — EditorStudio di-unmount saat pindah step, jadi
   * ref lokal akan ter-reset dan batch lama ter-enhance ulang.
   */
  autoEnhancedRef?: React.MutableRefObject<boolean>;
}

const CV_STATUS_LABEL: Record<string, string> = {
  idle: "Pure-JS",
  loading: "Memuat…",
  ready: "OpenCV",
  error: "Pure-JS",
  cancelled: "Pure-JS",
};

/**
 * Menolak hasil worker yang bukan gambar valid. Menutup celah race lama di
 * mana pesan INITIALIZED (tanpa imageData) lolos cek `result.error` lalu
 * membuat `applyImageData(undefined)` meledak.
 */
function assertImageResult(
  result: Record<string, unknown>,
  label: string,
): asserts result is { imageData: ArrayBuffer; width: number; height: number } {
  const w = Number(result.width);
  const h = Number(result.height);
  if (
    !(result.imageData instanceof ArrayBuffer) ||
    result.imageData.byteLength === 0 ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w < 1 ||
    h < 1 ||
    w * h > 40_000_000
  ) {
    throw new Error(`Hasil ${label} tidak valid — coba lagi`);
  }
}

/**
 * Studio editor halaman: kanvas + toolbar + strip halaman. Menyatukan mesin
 * canvas, worker OpenCV (opsional), dan aksi pengeditan dari `useDocStation`.
 */
export function EditorStudio({ paperSize, customWidth, customHeight, onProceed, onRescan, doc, cv, autoEnhanceOnLoad, autoEnhancedRef: autoEnhancedRefProp }: EditorStudioProps) {
  const overlayHandle = useRef<CanvasOverlayHandle>(null);
  const [tool, setTool] = useState<DocStationTool>("none");
  const [brushSize, setBrushSize] = useState(20);
  const [cropMode, setCropMode] = useState(false);
  const [cropRegion, setCropRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  // Ref lokal sebagai cadangan bila parent tidak menyediakan ref bersama.
  const localAutoEnhancedRef = useRef(false);
  const autoEnhancedRef = autoEnhancedRefProp ?? localAutoEnhancedRef;
  // Penanda pembatalan untuk loop auto-enhance: dicek SETIAP iterasi agar tidak
  // ada setBusy/toast/selectPage setelah unmount atau saat mode/gambar berubah.
  const cancelledRef = useRef(false);
  const autoEnhanceAbortRef = useRef<AbortController | null>(null);

  const engine = doc.stateRef.current;
  const activePage = doc.pages.find((p) => p.id === doc.activeId);

  // Muat OpenCV secara diam-diam di latar; fallback pure-JS tetap jalan.
  useEffect(() => {
    void cv.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withBusy = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      doc.setBusy(true, label);
      try {
        await fn();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Operasi gagal");
      } finally {
        doc.setBusy(false);
      }
    },
    [doc],
  );

  // Resolusi kerja enhance: 2200 cukup untuk A4 tajam, hemat ~30% memori vs 2600.
  // PDF ekspor tetap 2600 (di pdf.ts) agar hasil cetak maksimal.
  const ENHANCE_MAX_DIMENSION = 2200;

  /**
   * Menyalin piksel kanvas ke buffer yang bisa ditransfer ke worker.
   * Buffer dikirim sebagai Transferable (zero-copy) — menghemat satu salinan
   * ~35MB per operasi pada 2600px.
   */
  const takeTransferable = (imageData: ImageData) => {
    const src = imageData.data;
    const copy = new Uint8ClampedArray(src.length);
    copy.set(src);
    return { buffer: copy.buffer, transfer: [copy.buffer] as Transferable[] };
  };

  const runEnhance = useCallback(
    (mode: "bw" | "bg" | "despeckle" | "punch-hole") => {
      const page = doc.pages.find((p) => p.id === doc.activeId);
      if (!page) return;
      const labels = {
        bw: "Magic B&W",
        bg: "Hapus bayangan",
        despeckle: "Despeckle",
        "punch-hole": "Hapus lubang binder",
      } as const;
      withBusy(`Memproses ${labels[mode]}…`, async () => {
        const temp = document.createElement("canvas");
        const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
        renderPageToCanvas(engine, page, temp, { maxDimension: ENHANCE_MAX_DIMENSION });
        const ctx = temp.getContext("2d")!;
        const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
        const messageMap = {
          bw: "ENHANCE_BW",
          bg: "ENHANCE_BG",
          despeckle: "ENHANCE_DESPECKLE",
          "punch-hole": "ENHANCE_PUNCH_HOLE",
        } as const;
        const { buffer, transfer } = takeTransferable(imageData);
        const result = await cv.run({
          type: messageMap[mode],
          payload: {
            imageData: buffer,
            width: temp.width,
            height: temp.height,
          },
          transfer,
        });
        if (result.error) throw new Error(String(result.error));
        await doc.applyImageData(result.imageData, result.width, result.height, true);
        toast.success(`${labels[mode]} selesai`);
      });
    },
    [cv, doc, engine, withBusy],
  );

  const runAdvanced = useCallback(
    (
      mode: "white-bg" | "illumination" | "despeckle-strong" | "stray-marks" | "adf-border" | "sharpen",
      strength: number,
    ) => {
      const page = doc.pages.find((p) => p.id === doc.activeId);
      if (!page) return;
      const labels: Record<string, string> = {
        "white-bg": "Background putih bersih",
        illumination: "Meratakan pencahayaan",
        "despeckle-strong": "Despeckle kuat",
        "stray-marks": "Hapus bintik/guratan",
        "adf-border": "Hapus strip tepi ADF",
        sharpen: "Mempertajam",
      };
      const messageMap: Record<string, string> = {
        "white-bg": "ENHANCE_WHITE_BG",
        illumination: "ENHANCE_ILLUMINATION",
        "despeckle-strong": "ENHANCE_DESPECKLE_STRONG",
        "stray-marks": "REMOVE_STRAY_MARKS",
        "adf-border": "REMOVE_ADF_BORDER",
        sharpen: "SHARPEN_USM",
      };
      withBusy(`${labels[mode]}…`, async () => {
        const temp = document.createElement("canvas");
        const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
        renderPageToCanvas(engine, page, temp, { maxDimension: ENHANCE_MAX_DIMENSION });
        const ctx = temp.getContext("2d")!;
        const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
        const { buffer, transfer } = takeTransferable(imageData);
        const payload: Record<string, unknown> = {
          imageData: buffer,
          width: temp.width,
          height: temp.height,
        };
        if (mode === "white-bg" || mode === "illumination") payload.strength = strength;
        if (mode === "sharpen") {
          payload.amount = strength;
          payload.radius = 1;
        }
        const result = await cv.run({ type: messageMap[mode] as never, payload, transfer });
        if (result.error) throw new Error(String(result.error));
        assertImageResult(result, labels[mode]);
        await doc.applyImageData(result.imageData, result.width, result.height, true);
        toast.success(`${labels[mode]} selesai`);
      });
    },
    [cv, doc, engine, withBusy],
  );

  const runAutoPipeline = useCallback(
    (mode: "color" | "gray" | "bw") => {
      const page = doc.pages.find((p) => p.id === doc.activeId);
      if (!page) return;
      withBusy("Perbaikan otomatis…", async () => {
        await pipelinePage(page.id, mode);
        toast.success("Perbaikan otomatis selesai");
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, engine, cv, withBusy],
  );

  /** Menjalankan AUTO_PIPELINE untuk satu halaman tertentu. */
  const pipelinePage = useCallback(
    async (pageId: string, mode: "color" | "gray" | "bw") => {
      const page = doc.stateRef.current.pages.find((p) => p.id === pageId);
      if (!page) return;
      const temp = document.createElement("canvas");
      const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
      renderPageToCanvas(engine, page, temp, { maxDimension: ENHANCE_MAX_DIMENSION });
      const ctx = temp.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
      const { buffer, transfer } = takeTransferable(imageData);
      const result = await cv.run({
        type: "AUTO_PIPELINE",
        payload: {
          imageData: buffer,
          width: temp.width,
          height: temp.height,
          mode,
          strength: 0.75,
        },
        transfer,
      });
      if (result.error) throw new Error(String(result.error));
      assertImageResult(result, "Perbaikan otomatis");
      await doc.applyImageDataForPage(page, result.imageData, result.width, result.height);
    },
    [cv, doc, engine],
  );

  // Jalankan perbaikan otomatis ke semua halaman saat editor dibuka (opsional).
  // AbortController + cancelledRef mencegah race condition saat unmount atau
  // ketika mode/gambar berubah di tengah loop (loop bisa mencapai 50 halaman).
  useEffect(() => {
    if (!autoEnhanceOnLoad || autoEnhancedRef.current) return;
    if (doc.pages.length === 0) return;
    autoEnhancedRef.current = true;

    const controller = new AbortController();
    autoEnhanceAbortRef.current = controller;
    cancelledRef.current = false;
    const signal = controller.signal;

    (async () => {
      doc.setBusy(true, "Perbaikan otomatis semua halaman…");
      try {
        // Salin daftar id agar aman saat halaman diganti citranya.
        const ids = doc.stateRef.current.pages.map((p) => p.id);
        for (const id of ids) {
          // Cek pembatalan SETIAP iterasi — berhenti sebelum kerja berikutnya.
          if (cancelledRef.current || signal.aborted) return;
          await pipelinePage(id, "color");
        }
        if (cancelledRef.current || signal.aborted) return;
        toast.success("Perbaikan otomatis selesai untuk semua halaman");
      } catch (err) {
        // Setelah unmount/abort jangan tampilkan toast.
        if (cancelledRef.current || signal.aborted) return;
        toast.error(err instanceof Error ? err.message : "Perbaikan otomatis gagal");
      } finally {
        // Hanya sentuh state bila belum dibatalkan (komponen masih terpasang).
        if (!cancelledRef.current && !signal.aborted) {
          doc.setBusy(false);
          doc.selectPage(doc.stateRef.current.activeId ?? "");
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
      controller.abort();
      if (autoEnhanceAbortRef.current === controller) {
        autoEnhanceAbortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnhanceOnLoad, doc.pages.length]);

  const runDeskew = useCallback(() => {
    const page = doc.pages.find((p) => p.id === doc.activeId);
    if (!page) return;
    withBusy("Auto-deskew…", async () => {
      const temp = document.createElement("canvas");
      const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
      renderPageToCanvas(engine, page, temp, { maxDimension: ENHANCE_MAX_DIMENSION });
      const ctx = temp.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
      const { buffer, transfer } = takeTransferable(imageData);
      const result = await cv.run({
        type: "DESKEW",
        payload: { imageData: buffer, width: temp.width, height: temp.height },
        transfer,
      });
      const angle = Number(result.angle || 0);
      if (result.error) throw new Error(String(result.error));
      if (!Number.isFinite(angle) || Math.abs(angle) > 45) {
        throw new Error("Hasil deskew tidak valid — coba lagi");
      }
      page.fineRotation = (page.fineRotation || 0) - angle;
      doc.selectPage(page.id);
      toast.success(`Auto-deskew selesai (${angle.toFixed(1)}°)`);
    });
  }, [cv, doc, engine, withBusy]);

  const runAutoWarp = useCallback(() => {
    const page = doc.pages.find((p) => p.id === doc.activeId);
    if (!page) return;
    withBusy("Mendeteksi tepi kertas…", async () => {
      const temp = document.createElement("canvas");
      const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
      renderPageToCanvas(engine, page, temp, { maxDimension: ENHANCE_MAX_DIMENSION });
      const ctx = temp.getContext("2d")!;
      const width = temp.width;
      const height = temp.height;
      const imageData = ctx.getImageData(0, 0, width, height);

      // 1. Deteksi 4 sudut kertas (OpenCV contour atau fallback pure-JS).
      const { buffer: detectBuffer, transfer: detectTransfer } = takeTransferable(imageData);
      const detected = await cv.run({
        type: "DETECT_PAPER",
        payload: { imageData: detectBuffer, width, height },
        transfer: detectTransfer,
      });
      let corners: number[] =
        Array.isArray(detected?.points) && detected.points.length === 4
          ? detected.points.flat()
          : [];
      if (corners.length !== 8 || !corners.every((v) => Number.isFinite(v))) {
        const margin = Math.round(Math.min(width, height) * 0.03);
        corners = [margin, margin, width - margin, margin, width - margin, height - margin, margin, height - margin];
      }

      // 2. Warp perspektif ke 4 sudut terdeteksi.
      // Ambil ulang piksel (buffer deteksi sudah ditransfer/neutered).
      const fresh = ctx.getImageData(0, 0, width, height);
      const { buffer: warpBuffer, transfer: warpTransfer } = takeTransferable(fresh);
      const result = await cv.run({
        type: "PERSPECTIVE_WARP",
        payload: {
          imageData: warpBuffer,
          width,
          height,
          points: corners,
          dstWidth: width,
          dstHeight: height,
        },
        transfer: warpTransfer,
      });
      if (result.error) throw new Error(String(result.error));
      assertImageResult(result, "Auto crop");
      await doc.applyImageData(result.imageData, result.width, result.height, true);
      toast.success("Auto crop (deteksi tepi kertas) selesai");
    });
  }, [cv, doc, engine, withBusy]);

  const handleApplyCrop = useCallback(() => {
    if (!cropRegion || !activePage) return;
    // Region dalam koordinat kanvas overlay (render maxDimension 2200 di cropPage).
    if (cropRegion.width < 4 || cropRegion.height < 4) {
      toast.error("Area crop terlalu kecil");
      return;
    }
    withBusy("Menerapkan crop…", async () => {
      await doc.cropActive(cropRegion, 2200, 2200);
      setCropMode(false);
      setCropRegion(null);
      toast.success("Crop diterapkan");
    });
  }, [activePage, cropRegion, doc, withBusy]);

  const handleStitch = useCallback(() => {
    const ids = [...selectedIds];
    const targets = ids.length >= 2 ? ids : doc.pages.slice(0, 2).map((p) => p.id);
    if (targets.length < 2) {
      toast.error("Pilih minimal 2 halaman untuk digabungkan");
      return;
    }
    withBusy("Menggabungkan halaman…", async () => {
      await doc.stitchSelected(targets, "vertical");
      setSelectedIds(new Set());
      toast.success("Halaman berhasil digabungkan");
    });
  }, [doc, selectedIds, withBusy]);

  const handleCardLayout = useCallback(() => {
    const index = doc.pages.findIndex((p) => p.id === doc.activeId);
    if (index < 0) return;
    const front = doc.pages[index];
    const back = doc.pages[index + 1] || doc.pages[0];
    withBusy("Membuat layout kartu ganda…", async () => {
      await doc.createCardLayout(front.id, back.id);
      toast.success("Layout kartu ganda dibuat");
    });
  }, [doc, withBusy]);

  const handleExportPdf = useCallback(() => {
    withBusy("Membuat PDF…", async () => {
      await loadPdfLib();
      const bytes = await createPdf(engine, doc.pages, {
        quality: 0.92,
        format: "jpeg",
        fitMode: "contain",
        paper: { paperSize, customWidth, customHeight },
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Dokumen-Scan.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF berhasil dibuat");
    });
  }, [doc.pages, engine, paperSize, customWidth, customHeight, withBusy]);

  // Saat crop diaktifkan dari toolbar, fokus toolbar masih berada di tombol.
  // Pindahkan fokus ke kanvas overlay agar handler panah/Enter langsung aktif
  // tanpa user harus mengklik kanvas lebih dulu (lihat CanvasOverlay.focusCanvas).
  useEffect(() => {
    if (!cropMode) return;
    overlayHandle.current?.focusCanvas();
  }, [cropMode]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const movePage = useCallback(
    (id: string, direction: -1 | 1) => {
      const list = engine.pages;
      const index = list.findIndex((p) => p.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
      // Mutasi urutan langsung — sinkronkan state React agar strip akurat.
      doc.syncOrder();
      doc.selectPage(id);
    },
    [doc, engine],
  );

  // Satu struktur untuk semua ukuran layar: default satu kolom (bertumpuk),
  // lalu pada >= lg berubah jadi grid tiga kolom (kiri strip, tengah kanvas,
  // kanan toolbar + aksi). Ini menghindari mount ganda CanvasOverlay.
  return (
    <div className="grid flex-1 gap-3 min-h-0 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      {/* KIRI — daftar halaman. Di >= lg jadi kolom thumbnail vertikal yang
          menggulir (orientation="vertical" di PageStrip); di < lg tetap strip
          horizontal persis seperti semula. */}
      <aside className="min-w-0 min-h-0 overflow-y-auto">
        <PageStrip
          orientation="vertical"
          pages={doc.pages}
          activeId={doc.activeId}
          selectedIds={selectedIds}
          onSelect={doc.selectPage}
          onToggleSelect={toggleSelect}
          onRemove={doc.removePage}
          onMove={movePage}
          busy={doc.busy}
        />
      </aside>

      {/* TENGAH — banner sibuk + kanvas pratinjau (satu-satunya area scroll). */}
      <main className="flex min-w-0 min-h-0 flex-col gap-3">
        {doc.busy && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary"
          >
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {doc.busyLabel || "Memproses…"}
          </div>
        )}

        <CanvasOverlay
          ref={overlayHandle}
          state={engine}
          page={activePage}
          tool={tool}
          brushSize={brushSize}
          brushColor={engine.brushColor}
          highlightColor={engine.highlightColor}
          cropMode={cropMode}
          cropRegion={cropRegion}
          zoom={zoom}
          busy={doc.busy}
          onCropRegionChange={setCropRegion}
          onChanged={() => doc.selectPage(doc.activeId ?? "")}
        />
      </main>

      {/* KANAN — toolbar edit + blok aksi (dipindah dari footer lama). */}
      <aside className="min-w-0 min-h-0 space-y-3 overflow-y-auto">
        <EditorToolbar
          activeTool={tool}
          brushSize={brushSize}
          onToolChange={setTool}
          onBrushSizeChange={setBrushSize}
          onRotate={doc.rotateActive}
          onFlip={doc.flipActive}
          onResetEdits={doc.resetActiveEdits}
          onCrop={() => {
            setTool("none");
            setCropMode((c) => !c);
            if (!cropRegion) setCropRegion(null);
          }}
          onApplyCrop={handleApplyCrop}
          onCancelCrop={() => {
            setCropMode(false);
            setCropRegion(null);
          }}
          cropMode={cropMode}
          onClearOverlays={() => {
            overlayHandle.current?.clearOverlays();
            toast.success("Anotasi dihapus");
          }}
          onEnhance={runEnhance}
          onAdvanced={runAdvanced}
          onDeskew={runDeskew}
          onAutoWarp={runAutoWarp}
          onAutoPipeline={runAutoPipeline}
          onStitch={handleStitch}
          onCardLayout={handleCardLayout}
          zoom={zoom}
          onZoomChange={setZoom}
          busy={doc.busy}
          hasPage={Boolean(activePage)}
          hasMultiplePages={doc.pages.length >= 2}
          cvStatus={CV_STATUS_LABEL[cv.status] ? cv.status : "idle"}
          adjustments={{
            brightness: activePage?.brightness ?? 0,
            contrast: activePage?.contrast ?? 0,
            gamma: activePage?.gamma ?? 1,
            grayscale: activePage?.grayscale ?? false,
          }}
          onAdjustmentsChange={doc.setActiveAdjustments}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">
            {doc.pages.length} halaman ·{" "}
            {selectedIds.size > 0 ? `${selectedIds.size} dipilih` : "tidak ada yang dipilih"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onRescan && (
              <Button
                type="button"
                variant="outline"
                onClick={onRescan}
                disabled={doc.busy}
                title="Pindai dan tambahkan halaman baru ke dokumen ini"
              >
                <ScanLine className="mr-1.5 h-4 w-4" />
                Pindai lagi
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleExportPdf} disabled={doc.pages.length === 0 || doc.busy}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Unduh PDF
            </Button>
            <Button type="button" onClick={onProceed} disabled={doc.pages.length === 0 || doc.busy}>
              <Printer className="mr-1.5 h-4 w-4" />
              Lanjut Cetak
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
