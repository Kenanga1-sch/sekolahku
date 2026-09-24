"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, FileDown, Printer } from "lucide-react";
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
  doc: ReturnType<typeof useDocStation>;
  cv: ReturnType<typeof useOpenCV>;
  /** Jalankan perbaikan otomatis untuk semua halaman saat editor dibuka. */
  autoEnhanceOnLoad?: boolean;
}

const CV_STATUS_LABEL: Record<string, string> = {
  idle: "Pure-JS",
  loading: "Memuat…",
  ready: "OpenCV",
  error: "Pure-JS",
  cancelled: "Pure-JS",
};

/**
 * Studio editor halaman: kanvas + toolbar + strip halaman. Menyatukan mesin
 * canvas, worker OpenCV (opsional), dan aksi pengeditan dari `useDocStation`.
 */
export function EditorStudio({ paperSize, customWidth, customHeight, onProceed, doc, cv, autoEnhanceOnLoad }: EditorStudioProps) {
  const overlayHandle = useRef<CanvasOverlayHandle>(null);
  const [tool, setTool] = useState<DocStationTool>("none");
  const [brushSize, setBrushSize] = useState(20);
  const [cropMode, setCropMode] = useState(false);
  const [cropRegion, setCropRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const autoEnhancedRef = useRef(false);

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
        renderPageToCanvas(engine, page, temp, { maxDimension: 2600 });
        const ctx = temp.getContext("2d")!;
        const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
        const messageMap = {
          bw: "ENHANCE_BW",
          bg: "ENHANCE_BG",
          despeckle: "ENHANCE_DESPECKLE",
          "punch-hole": "ENHANCE_PUNCH_HOLE",
        } as const;
        const result = await cv.run({
          type: messageMap[mode],
          payload: {
            imageData: imageData.data.buffer.slice(0),
            width: temp.width,
            height: temp.height,
          },
          transfer: [],
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
        renderPageToCanvas(engine, page, temp, { maxDimension: 2600 });
        const ctx = temp.getContext("2d")!;
        const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
        const payload: Record<string, unknown> = {
          imageData: imageData.data.buffer.slice(0),
          width: temp.width,
          height: temp.height,
        };
        if (mode === "white-bg" || mode === "illumination") payload.strength = strength;
        if (mode === "sharpen") {
          payload.amount = strength;
          payload.radius = 1;
        }
        const result = await cv.run({ type: messageMap[mode] as never, payload });
        if (result.error) throw new Error(String(result.error));
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
      renderPageToCanvas(engine, page, temp, { maxDimension: 2600 });
      const ctx = temp.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
      const result = await cv.run({
        type: "AUTO_PIPELINE",
        payload: {
          imageData: imageData.data.buffer.slice(0),
          width: temp.width,
          height: temp.height,
          mode,
          strength: 0.75,
        },
      });
      if (result.error) throw new Error(String(result.error));
      await doc.applyImageDataForPage(page, result.imageData, result.width, result.height);
    },
    [cv, doc, engine],
  );

  // Jalankan perbaikan otomatis ke semua halaman saat editor dibuka (opsional).
  useEffect(() => {
    if (!autoEnhanceOnLoad || autoEnhancedRef.current) return;
    if (doc.pages.length === 0) return;
    autoEnhancedRef.current = true;
    (async () => {
      doc.setBusy(true, "Perbaikan otomatis semua halaman…");
      try {
        // Salin daftar id agar aman saat halaman diganti citranya.
        const ids = doc.stateRef.current.pages.map((p) => p.id);
        for (const id of ids) {
          await pipelinePage(id, "color");
        }
        toast.success("Perbaikan otomatis selesai untuk semua halaman");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Perbaikan otomatis gagal");
      } finally {
        doc.setBusy(false);
        doc.selectPage(doc.stateRef.current.activeId ?? "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnhanceOnLoad, doc.pages.length]);

  const runDeskew = useCallback(() => {
    const page = doc.pages.find((p) => p.id === doc.activeId);
    if (!page) return;
    withBusy("Auto-deskew…", async () => {
      const temp = document.createElement("canvas");
      const { renderPageToCanvas } = await import("@/lib/docstation/canvas");
      renderPageToCanvas(engine, page, temp, { maxDimension: 2200 });
      const ctx = temp.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
      const result = await cv.run({
        type: "DESKEW",
        payload: { imageData: imageData.data.buffer.slice(0), width: temp.width, height: temp.height },
      });
      const angle = Number(result.angle || 0);
      page.fineRotation = (page.fineRotation || 0) - angle;
      doc.setBusy(false);
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
      renderPageToCanvas(engine, page, temp, { maxDimension: 2200 });
      const ctx = temp.getContext("2d")!;
      const width = temp.width;
      const height = temp.height;
      const imageData = ctx.getImageData(0, 0, width, height);

      // 1. Deteksi 4 sudut kertas (OpenCV contour atau fallback pure-JS).
      const detected = await cv.run({
        type: "DETECT_PAPER",
        payload: { imageData: imageData.data.buffer.slice(0), width, height },
      });
      let corners: number[] =
        Array.isArray(detected?.points) && detected.points.length === 4
          ? detected.points.flat()
          : [];
      if (corners.length !== 8) {
        const margin = Math.round(Math.min(width, height) * 0.03);
        corners = [margin, margin, width - margin, margin, width - margin, height - margin, margin, height - margin];
      }

      // 2. Warp perspektif ke 4 sudut terdeteksi.
      const result = await cv.run({
        type: "PERSPECTIVE_WARP",
        payload: {
          imageData: imageData.data.buffer.slice(0),
          width,
          height,
          points: corners,
          dstWidth: width,
          dstHeight: height,
        },
      });
      if (result.error) throw new Error(String(result.error));
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
      doc.selectPage(id);
    },
    [doc, engine],
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
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

      {doc.busy && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {doc.busyLabel || "Memproses…"}
        </div>
      )}

      <PageStrip
        pages={doc.pages}
        activeId={doc.activeId}
        selectedIds={selectedIds}
        onSelect={doc.selectPage}
        onToggleSelect={toggleSelect}
        onRemove={doc.removePage}
        onMove={movePage}
        busy={doc.busy}
      />

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
        onCropRegionChange={setCropRegion}
        onChanged={() => doc.selectPage(doc.activeId ?? "")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {doc.pages.length} halaman ·{" "}
          {selectedIds.size > 0 ? `${selectedIds.size} dipilih` : "tidak ada yang dipilih"}
        </div>
        <div className="flex items-center gap-2">
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
    </div>
  );
}
