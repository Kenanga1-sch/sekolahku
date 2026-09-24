"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateLetterPdf, type LetterPdfInput } from "@/lib/letter-pdf";
import {
  loadPdfJs,
  type PdfDocumentProxy,
  type PdfRenderTask,
} from "@/lib/letter-pdf-vendor";

type Props = LetterPdfInput;

/**
 * Pratinjau PDF surat.
 *
 * PDF dirender ke <canvas> memakai pdf.js (bukan <iframe src="blob:...pdf">).
 * Alasan: CSP proyek memakai `object-src 'none'` yang memblokir PDF viewer
 * bawaan di dalam iframe ("This content is blocked"). pdf.js me-render murni
 * ke canvas sehingga tidak perlu melonggarkan CSP.
 *
 * Debound 400ms agar tidak render ulang tiap ketikan.
 */

/** Versi struktur dokumen ringan (menggantikan JSON.stringify dokumen). */
function docFingerprint(input: LetterPdfInput): string {
  const pages = input.document.pages || [];
  let blocks = 0;
  let dataLen = 0;
  for (const p of pages) {
    for (const b of p.blocks) {
      blocks += 1;
      for (const v of Object.values(b.data)) {
        dataLen += String(v ?? "").length;
      }
      if (!b.enabled) blocks -= 0.5;
    }
  }
  return `${pages.length}:${blocks}:${dataLen}:${input.vars ? Object.keys(input.vars).length : 0}`;
}

export function LetterPdfPreview(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocumentProxy | null>(null);
  const renderTasksRef = useRef<PdfRenderTask[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [renderNonce, setRenderNonce] = useState(0);

  const renderPages = useCallback(async (pdfDoc: PdfDocumentProxy) => {
    const container = containerRef.current;
    if (!container) return;
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
      canvas.className =
        "mx-auto block rounded-sm bg-white shadow-md ring-1 ring-black/5";

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
  }, [zoom]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        // 1. Susun PDF dari blok (100% di klien).
        const blob = await generateLetterPdf({
          ...props,
          fileName: props.fileName || "Surat",
        });
        const data = await blob.arrayBuffer();

        // 2. Bersihkan dokumen & task sebelumnya.
        renderTasksRef.current.forEach((t) => {
          try {
            t.cancel();
          } catch {
            /* ignore */
          }
        });
        renderTasksRef.current = [];
        if (docRef.current) {
          try {
            await docRef.current.destroy();
          } catch {
            /* ignore */
          }
          docRef.current = null;
        }

        // 3. Muat ke pdf.js & render tiap halaman ke canvas.
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;
        if (!active) {
          try {
            await pdfDoc.destroy();
          } catch {
            /* ignore */
          }
          return;
        }
        docRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);

        await renderPages(pdfDoc);
        if (active) setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Gagal membuat pratinjau");
      } finally {
        if (active) setLoading(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docFingerprint(props), JSON.stringify(props.vars), props.standard, renderNonce]);

  // Bersihkan dokumen pdf.js saat unmount agar tidak bocor.
  useEffect(() => {
    return () => {
      renderTasksRef.current.forEach((t) => {
        try {
          t.cancel();
        } catch {
          /* ignore */
        }
      });
      if (docRef.current) {
        docRef.current.destroy().catch(() => {});
        docRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Bilah kontrol pratinjau */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span className="truncate">
          {loading
            ? "Menyusun…"
            : numPages > 0
              ? `${numPages} halaman`
              : error
                ? "Gagal"
                : "Siap"}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
            disabled={loading || !!error}
            aria-label="Perkecil pratinjau"
            title="Perkecil"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
            disabled={loading || !!error}
            aria-label="Perbesar pratinjau"
            title="Perbesar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setZoom(1);
              setRenderNonce((n) => n + 1);
            }}
            disabled={loading || !!error}
            aria-label="Pas ke layar dan muat ulang"
            title="Muat ulang"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRenderNonce((n) => n + 1)}
            disabled={loading || !!error}
            aria-label="Muat ulang pratinjau"
            title="Muat ulang"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyusun pratinjau…
        </div>
      )}
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full flex-1 overflow-auto bg-slate-200 p-4 dark:bg-zinc-800/40"
        />
      )}
    </div>
  );
}
