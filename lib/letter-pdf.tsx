/**
 * letter-pdf.tsx — Renderer PDF surat modular (100% di klien).
 *
 * Menggunakan @react-pdf/renderer untuk menyusun PDF dari LetterDocumentData
 * (multi-halaman) mengikuti standar baku (font/margin) per jenis surat.
 * Tidak ada render di server → nol beban tambahan untuk server.
 *
 * Catatan integrasi Next.js:
 *  - File ini HARUS diimpor secara dinamis (next/dynamic, { ssr: false }) karena
 *    @react-pdf/renderer menyentuh API browser.
 *  - Font: menggunakan font standar PDF bawaan (Helvetica/Times/Courier) agar
 *    tidak perlu memuat berkas font eksternal. "Arial" ≈ Helvetica,
 *    "Bookman Old Style" ≈ Times, "Times New Roman" = Times.
 *
 * Refactor: helper (buildStyles, rich-text, renderBlock, renderKop,
 * renderGenericTable) dipecah ke modul sibling — zero behavior change.
 */

import React from "react";
import { Document, Page, Text, pdf } from "@react-pdf/renderer";
import type { LetterPage } from "@/lib/config/letter-document";
import { getPaperSizePt } from "@/lib/config/letter-document";
import { buildStyles } from "./letter-pdf-styles";
import { renderBlock } from "./letter-pdf-blocks";
import type { BlockRenderCtx } from "./letter-pdf-rich";
import type { LetterPdfInput } from "./letter-pdf-types";

export type { LetterSchoolData, LetterPdfInput } from "./letter-pdf-types";

function renderPage(
  page: LetterPage,
  ctx: BlockRenderCtx,
  index: number,
  total: number,
  paper: [number, number],
  showFooter: boolean,
  watermark: string
): React.ReactElement {
  // Halaman tanpa kop: lewati blok kop_surat (mis. halaman lampiran).
  const useHeader = page.useHeader !== false;
  return (
    <Page size={paper} style={ctx.styles.page} key={page.id} wrap>
      {watermark ? (
        <Text
          style={{
            position: "absolute",
            top: "40%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 60,
            color: "#e5e5e5",
            transform: "rotate(-30deg)",
          }}
          fixed
        >
          {watermark}
        </Text>
      ) : null}
      {page.blocks
        .filter((b) => b.enabled && !(b.blockId === "kop_surat" && !useHeader))
        .map((inst) => (
          <React.Fragment key={inst.instanceId}>
            {renderBlock(inst, ctx)}
          </React.Fragment>
        ))}
      {showFooter ? (
        <Text
          style={ctx.styles.footer}
          render={({ pageNumber, totalPages }) =>
            total > 1 ? `Halaman ${pageNumber} dari ${totalPages}` : ""
          }
          fixed
        />
      ) : null}
    </Page>
  );
}

export function LetterDocument({ standard, document, school, vars }: LetterPdfInput) {
  const styles = buildStyles(standard);
  const ctx: BlockRenderCtx = { styles, school, vars, standard };
  const pages = document.pages.length > 0 ? document.pages : [{ id: "empty", name: "Surat", blocks: [], useHeader: true }];
  const total = pages.length;
  const paper = getPaperSizePt(document.paperSize, document.orientation);

  return (
    <Document>
      {pages.map((p, i) =>
        renderPage(p, ctx, i, total, paper, document.showFooter !== false, document.watermark || "")
      )}
    </Document>
  );
}

/** Menghasilkan Blob PDF dari dokumen surat (dijalankan di klien). */
export async function generateLetterPdf(input: LetterPdfInput): Promise<Blob> {
  return pdf(<LetterDocument {...input} />).toBlob();
}
