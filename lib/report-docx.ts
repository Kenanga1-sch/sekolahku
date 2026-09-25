/**
 * report-docx.ts — Microsoft Word (.docx) Generator untuk Report Builder.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import type { ReportDocumentData } from "@/lib/config/report-document";
import type { ReportColumnConfig, ReportKPIItemConfig } from "@/lib/config/report-blocks";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import {
  processReportTable,
  processReportKPI,
  formatCellValue,
  formatRupiah,
} from "@/lib/report-engine";

export interface ReportDocxInput {
  document: ReportDocumentData;
  school: LetterSchoolData;
  dataset?: Record<string, any>[];
  extraSummary?: Record<string, number | string>;
  fileName?: string;
}

export async function generateReportDocx({
  document: doc,
  school,
  dataset = [],
  extraSummary,
}: ReportDocxInput): Promise<Blob> {
  const sections: any[] = [];
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  for (const p of doc.pages) {
    const children: any[] = [];

    for (const b of p.blocks) {
      if (!b.enabled) continue;
      const d = b.data || {};

      switch (b.blockId) {
        case "kop_laporan": {
          if (p.useHeader === false) break;
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: school.governanceLine, bold: true, size: 20 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: school.departmentLine, bold: true, size: 22 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: school.schoolName, bold: true, size: 26 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${school.address} • Telp: ${school.phone}`, size: 16 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯", bold: true })],
            })
          );
          break;
        }

        case "judul_laporan": {
          children.push(
            new Paragraph(""),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(d.judul || "LAPORAN"), bold: true, size: 24 })],
            })
          );
          if (d.subjudul) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(d.subjudul), size: 18, color: "555555" })],
              })
            );
          }
          children.push(new Paragraph(""));
          break;
        }

        case "tabel_laporan": {
          const rawCols: ReportColumnConfig[] = Array.isArray(d.columns) ? d.columns : [];
          const tableRes = processReportTable(rawCols, dataset);
          const totalConfigWidth = tableRes.columns.reduce((acc, c) => acc + (c.width || 100), 0);

          // Header Row
          const headerCells = tableRes.columns.map((c) => {
            const wPct = Math.round(((c.width || 100) / totalConfigWidth) * 100);
            return new TableCell({
              width: { size: wPct, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment:
                    c.align === "right"
                      ? AlignmentType.RIGHT
                      : c.align === "center"
                        ? AlignmentType.CENTER
                        : AlignmentType.LEFT,
                  children: [new TextRun({ text: c.label, bold: true, size: 16 })],
                }),
              ],
            });
          });

          const tableRows = [new TableRow({ children: headerCells })];

          // Data Rows
          tableRes.rows.forEach((r) => {
            const cells = tableRes.columns.map((c) => {
              const wPct = Math.round(((c.width || 100) / totalConfigWidth) * 100);
              const formattedVal = formatCellValue(r[c.key], c.format);
              return new TableCell({
                width: { size: wPct, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment:
                      c.align === "right"
                        ? AlignmentType.RIGHT
                        : c.align === "center"
                          ? AlignmentType.CENTER
                          : AlignmentType.LEFT,
                    children: [new TextRun({ text: formattedVal, size: 16 })],
                  }),
                ],
              });
            });
            tableRows.push(new TableRow({ children: cells }));
          });

          // Footer Row / Auto-Sum
          if (tableRes.hasAutoSum) {
            const footCells = tableRes.columns.map((c, cIdx) => {
              const wPct = Math.round(((c.width || 100) / totalConfigWidth) * 100);
              let labelText = "";
              if (cIdx === 0) labelText = "TOTAL";
              else if (c.autoSum && tableRes.totals[c.key] !== null) {
                labelText =
                  c.format === "rupiah"
                    ? formatRupiah(tableRes.totals[c.key])
                    : String(tableRes.totals[c.key]);
              }

              return new TableCell({
                width: { size: wPct, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment:
                      c.align === "right"
                        ? AlignmentType.RIGHT
                        : c.align === "center" || cIdx === 0
                          ? AlignmentType.CENTER
                          : AlignmentType.LEFT,
                    children: [new TextRun({ text: labelText, bold: true, size: 16 })],
                  }),
                ],
              });
            });
            tableRows.push(new TableRow({ children: footCells }));
          }

          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          );
          break;
        }

        case "tanda_tangan": {
          children.push(
            new Paragraph(""),
            new Paragraph(""),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph("")] }),
                    new TableCell({
                      width: { size: 40, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(d.jabatan || "Kepala Sekolah"), size: 18 })] }),
                        new Paragraph(""),
                        new Paragraph(""),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(d.nama) || school.principalName, bold: true, underline: {}, size: 18 })] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${String(d.nip) || school.principalNip}`, size: 16 })] }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          );
          break;
        }
      }
    }

    sections.push({ children });
  }

  const wordDoc = new Document({ sections });
  return await Packer.toBlob(wordDoc);
}
