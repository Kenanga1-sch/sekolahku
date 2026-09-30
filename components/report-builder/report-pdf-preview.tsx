"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, ZoomIn, ZoomOut, Maximize2, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateReportPdf, type ReportPdfInput } from "@/lib/report-pdf";
import { loadPdfJs, type PdfDocumentProxy, type PdfRenderTask } from "@/lib/letter-pdf-vendor";

type Props = ReportPdfInput;

/**
 * Fingerprint yang benar-benar sensitif terhadap perubahan layout:
 * jumlah lembar, kolom, sel, kertas/margin/density, serta dataset.
 */
export function reportPdfFingerprint(input: ReportPdfInput): string {
  return JSON.stringify({
    workbook: input.workbook,
    school: input.school,
    dataset: input.dataset,
    datasets: input.datasets,
    global: input.global,
  });
}

/**
 * Renderer PDF terisolasi — dipakai baik oleh panel utama maupun mode
 * fullscreen. Tidak memanggil komponen preview lain (menghindari nested
 * preview yang menyebabkan render ganda).
 */
function PdfCanvas({
  props,
  zoom,
  onStatus,
}: {
  props: Props;
  zoom: number;
  onStatus?: (s: { loading: boolean; numPages: number; error: string | null }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocumentProxy | null>(null);
  const renderTasksRef = useRef<PdfRenderTask[]>([]);
  const renderedZoomRef = useRef<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderPages = useCallback(
    async (pdfDoc: PdfDocumentProxy) => {
      const container = containerRef.current;
      if (!container) return;
      renderTasksRef.current.forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
      renderTasksRef.current = [];
      container.innerHTML = "";
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const availWidth = (container.clientWidth || 720) - 16;
        const scale = Math.min((availWidth / baseViewport.width) * zoom, 1.5 * zoom);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = "mx-auto block rounded-sm bg-white shadow-md ring-1 ring-black/5";

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const wrap = document.createElement("div");
        wrap.className = "mb-4 flex justify-center";
        wrap.appendChild(canvas);
        container.appendChild(wrap);

        const task = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTasksRef.current.push(task);
        await task.promise;
      }
      renderedZoomRef.current = zoom;
    },
    [zoom]
  );

  const fingerprint = reportPdfFingerprint(props);

  useEffect(() => {
    let active = true;
    setLoading(true);
    onStatus?.({ loading: true, numPages: 0, error: null });

    const timer = setTimeout(async () => {
      try {
        const blob = await generateReportPdf({ ...props, fileName: props.fileName || "Laporan" });
        const data = await blob.arrayBuffer();

        renderTasksRef.current.forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
        renderTasksRef.current = [];

        if (docRef.current) {
          try { await docRef.current.destroy(); } catch { /* ignore */ }
          docRef.current = null;
        }

        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;

        if (!active) {
          try { await pdfDoc.destroy(); } catch { /* ignore */ }
          return;
        }

        docRef.current = pdfDoc;
        await renderPages(pdfDoc);
        if (active) {
          setError(null);
          onStatus?.({ loading: false, numPages: pdfDoc.numPages, error: null });
        }
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Gagal membuat pratinjau PDF laporan";
        setError(msg);
        onStatus?.({ loading: false, numPages: 0, error: msg });
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fingerprint]);

  useEffect(() => {
    if (!loading && docRef.current && renderedZoomRef.current !== zoom) void renderPages(docRef.current);
  }, [zoom, loading, renderPages]);

  useEffect(() => {
    return () => {
      renderTasksRef.current.forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
      if (docRef.current) {
        docRef.current.destroy().catch(() => {});
        docRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyusun PDF laporan...
        </div>
      )}
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full flex-1 overflow-auto bg-slate-200 p-4 dark:bg-zinc-800/40" />
      )}
    </>
  );
}

export function ReportPdfPreview(props: Props) {
  const [zoom, setZoom] = useState(1);
  const [renderNonce, setRenderNonce] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [status, setStatus] = useState<{ loading: boolean; numPages: number; error: string | null }>({
    loading: true,
    numPages: 0,
    error: null,
  });

  const busy = status.loading;

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span className="truncate">
          {status.loading ? "Menyusun PDF..." : status.numPages > 0 ? `${status.numPages} halaman` : status.error ? "Gagal" : "Siap"}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
            disabled={busy || !!status.error} title="Perkecil"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <Button
            type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
            disabled={busy || !!status.error} title="Perbesar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom(1)}
            disabled={busy || !!status.error} title="Reset Zoom (100%)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setFullscreenOpen(true)}
            disabled={busy || !!status.error} title="Pratinjau Layar Penuh"
          >
            <Expand className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setRenderNonce((n) => n + 1)}
            title="Muat Ulang"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* renderNonce dipakai sebagai key agar Muat Ulang benar-benar me-render ulang */}
      <PdfCanvas key={renderNonce} props={props} zoom={zoom} onStatus={setStatus} />

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="flex h-[92vh] max-w-6xl flex-col p-4">
          <DialogHeader className="border-b pb-2">
            <DialogTitle className="text-base font-semibold">Pratinjau Layar Penuh Laporan</DialogTitle>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-zinc-100 dark:bg-zinc-950">
            {fullscreenOpen && <PdfCanvas props={props} zoom={zoom} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
