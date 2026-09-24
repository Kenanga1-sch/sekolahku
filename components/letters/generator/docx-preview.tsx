"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { createDocumentBlob } from "@/lib/docx";

interface DocxPreviewProps {
  /** URL template .docx */
  templateUrl: string | null | undefined;
  /** Data variabel untuk dirender ke template */
  data: Record<string, unknown>;
  /** Ukuran kertas (A4/F4/LEGAL) — memengaruhi lebar bingkai. */
  paperSize?: string;
  /** Orientasi (portrait/landscape). */
  orientation?: string;
  className?: string;
}

const PAPER_DIM: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  F4: { w: 215, h: 330 },
  LEGAL: { w: 216, h: 356 },
  LETTER: { w: 216, h: 279 },
};

/**
 * Pratinjau DOKUMEN SESUNGGUHNYA.
 *
 * Alur: render template .docx dengan docxtemplater (createDocumentBlob) →
 * konversi ke HTML dengan mammoth → tampilkan dalam bingkai kertas. Ini
 * menggantikan mockup HTML lama yang menampilkan teks hardcode dan tidak
 * mencerminkan isi dokumen yang sebenarnya.
 */
export function DocxPreview({
  templateUrl,
  data,
  paperSize = "A4",
  orientation = "portrait",
  className,
}: DocxPreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!templateUrl) {
      setHtml("");
      setError("Template DOCX tidak tersedia untuk dipratinjau.");
      return;
    }
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1. Render template dengan data → blob DOCX nyata.
        const blob = await createDocumentBlob(templateUrl, data as any);
        const arrayBuffer = await blob.arrayBuffer();

        // 2. Konversi DOCX → HTML untuk pratinjau.
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!active) return;
        setHtml(result.value || "");
      } catch (e) {
        if (!active) return;
        setError(
          e instanceof Error ? e.message : "Gagal memuat pratinjau dokumen."
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateUrl, JSON.stringify(data), paperSize, orientation]);

  const dim = PAPER_DIM[paperSize] || PAPER_DIM.A4;
  const isLandscape = orientation?.toLowerCase() === "landscape";
  const widthMm = isLandscape ? dim.h : dim.w;
  const minHeightMm = isLandscape ? dim.w : dim.h;

  return (
    <div className={className}>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Pratinjau isi dokumen (dari file .docx sebenarnya)
      </span>

      {loading && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Menyusun pratinjau…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Pratinjau tidak tersedia</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex justify-center overflow-auto rounded-2xl border border-slate-300 bg-slate-200 p-4 shadow-inner dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
          <div
            className="docx-preview-frame bg-white p-12 text-zinc-900 shadow-2xl"
            style={{ width: `${widthMm}mm`, minHeight: `${minHeightMm}mm` }}
          >
            {html ? (
              <div
                className="docx-preview-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-8 w-8" />
                Dokumen kosong.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Style khusus konten hasil konversi mammoth agar menyerupai Word. */}
      <style jsx global>{`
        .docx-preview-content {
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        .docx-preview-content p {
          margin: 0 0 0.5em;
        }
        .docx-preview-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5em 0;
        }
        .docx-preview-content td,
        .docx-preview-content th {
          border: 1px solid #999;
          padding: 4px 6px;
          vertical-align: top;
        }
        .docx-preview-content img {
          max-width: 100%;
        }
        .docx-preview-content h1,
        .docx-preview-content h2,
        .docx-preview-content h3 {
          text-align: center;
        }
      `}</style>
    </div>
  );
}
