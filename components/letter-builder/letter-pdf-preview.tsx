"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
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
export function LetterPdfPreview(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocumentProxy | null>(null);
  const renderTasksRef = useRef<PdfRenderTask[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        // Lebar konten mengikuti kolom tersedia; skala dihitung per halaman.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          if (!active) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const availWidth = (container.clientWidth || 720) - 16;
          const scale = Math.min(availWidth / baseViewport.width, 1.5);
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
  }, [
    JSON.stringify(props.document),
    JSON.stringify(props.vars),
    props.standard,
  ]);

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
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyusun pratinjau…
        </div>
      )}
      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full overflow-auto bg-slate-200 p-4 dark:bg-zinc-800/40"
        />
      )}
    </div>
  );
}
