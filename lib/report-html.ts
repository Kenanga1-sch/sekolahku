/**
 * report-html.ts — HTML Print Generator untuk Report Builder.
 */

import type { ReportDocumentData } from "@/lib/config/report-document";
import type { ReportColumnConfig, ReportKPIItemConfig } from "@/lib/config/report-blocks";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import {
  processReportTable,
  processReportKPI,
  formatCellValue,
  formatRupiah,
} from "@/lib/report-engine";

export interface ReportHtmlInput {
  document: ReportDocumentData;
  school: LetterSchoolData;
  dataset?: Record<string, any>[];
  extraSummary?: Record<string, number | string>;
}

export function generateReportHtml({
  document: doc,
  school,
  dataset = [],
  extraSummary,
}: ReportHtmlInput): string {
  const paperSize = doc.paperSize || "A4";
  const orientation = doc.orientation || "portrait";

  const sizeCss =
    paperSize === "A4"
      ? `A4 ${orientation}`
      : paperSize === "F4"
        ? `215mm 330mm ${orientation}`
        : `legal ${orientation}`;

  let bodyHtml = "";

  for (const p of doc.pages) {
    let pageHtml = "";

    for (const b of p.blocks) {
      if (!b.enabled) continue;
      const d = b.data || {};

      switch (b.blockId) {
        case "kop_laporan": {
          if (p.useHeader === false) break;
          pageHtml += `
            <div class="kop">
              <div class="kop-header">
                ${school.logoUrl ? `<img src="${school.logoUrl}" class="logo" alt="Logo" />` : '<div class="logo"></div>'}
                <div class="kop-center">
                  <div class="gov">${school.governanceLine || ""}</div>
                  <div class="dept">${school.departmentLine || ""}</div>
                  <div class="school">${school.schoolName || ""}</div>
                  <div class="addr">${school.address || ""} • Telp: ${school.phone || "-"}</div>
                </div>
                <div class="logo"></div>
              </div>
            </div>`;
          break;
        }

        case "judul_laporan": {
          pageHtml += `
            <div class="title-wrap">
              <h2 class="title">${escapeHtml(String(d.judul || "LAPORAN"))}</h2>
              ${d.subjudul ? `<p class="subtitle">${escapeHtml(String(d.subjudul))}</p>` : ""}
            </div>`;
          break;
        }

        case "metadata_filter": {
          if (!d.keterangan) break;
          pageHtml += `<div class="filter-box">${escapeHtml(String(d.keterangan))}</div>`;
          break;
        }

        case "ringkasan_kpi": {
          const kpiConfig: ReportKPIItemConfig[] = Array.isArray(d.items) ? d.items : [];
          const kpiRes = processReportKPI(kpiConfig, dataset, extraSummary);
          if (kpiRes.items.length === 0) break;

          pageHtml += `
            <div class="kpi-grid">
              ${kpiRes.items
                .map(
                  (it) => `
                <div class="kpi-card">
                  <div class="kpi-label">${escapeHtml(it.label)}</div>
                  <div class="kpi-val">${escapeHtml(it.value)}</div>
                </div>`
                )
                .join("")}
            </div>`;
          break;
        }

        case "tabel_laporan": {
          const rawCols: ReportColumnConfig[] = Array.isArray(d.columns) ? d.columns : [];
          const tableRes = processReportTable(rawCols, dataset);
          const totalConfigWidth = tableRes.columns.reduce((acc, c) => acc + (c.width || 100), 0);

          let ths = "";
          tableRes.columns.forEach((c) => {
            const wPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
            ths += `<th style="width:${wPct};text-align:${c.align || "left"}">${escapeHtml(c.label)}</th>`;
          });

          let trs = "";
          tableRes.rows.forEach((r, idx) => {
            let tds = "";
            tableRes.columns.forEach((c) => {
              const wPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
              const formattedVal = formatCellValue(r[c.key], c.format);
              tds += `<td style="width:${wPct};text-align:${c.align || "left"}">${escapeHtml(formattedVal)}</td>`;
            });
            trs += `<tr class="${idx % 2 === 1 ? "even" : ""}">${tds}</tr>`;
          });

          let tfoot = "";
          if (tableRes.hasAutoSum) {
            let footTds = "";
            tableRes.columns.forEach((c, cIdx) => {
              const wPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
              let labelText = "";
              if (cIdx === 0) labelText = "TOTAL";
              else if (c.autoSum && tableRes.totals[c.key] !== null) {
                labelText =
                  c.format === "rupiah"
                    ? formatRupiah(tableRes.totals[c.key])
                    : String(tableRes.totals[c.key]);
              }
              footTds += `<th style="width:${wPct};text-align:${c.align || (cIdx === 0 ? "center" : "left")}">${escapeHtml(labelText)}</th>`;
            });
            tfoot = `<tfoot><tr>${footTds}</tr></tfoot>`;
          }

          pageHtml += `
            <table class="report-table">
              <thead><tr>${ths}</tr></thead>
              <tbody>${trs}</tbody>
              ${tfoot}
            </table>`;
          break;
        }

        case "catatan_penutup": {
          if (!d.text) break;
          pageHtml += `<p class="note">${escapeHtml(String(d.text))}</p>`;
          break;
        }

        case "tanda_tangan": {
          const ttdNama = String(d.nama || school.principalName || "");
          const ttdNip = String(d.nip || school.principalNip || "");
          pageHtml += `
            <div class="ttd-single">
              <div class="ttd-box">
                <p>${escapeHtml(String(d.jabatan || "Kepala Sekolah"))}</p>
                <div class="ttd-space"></div>
                <p><strong><u>${escapeHtml(ttdNama)}</u></strong></p>
                <p>NIP. ${escapeHtml(ttdNip)}</p>
              </div>
            </div>`;
          break;
        }

        case "tanda_tangan_ganda": {
          const ttdKananNama = String(d.kanan_nama || school.principalName || "");
          const ttdKananNip = String(d.kanan_nip || school.principalNip || "");
          pageHtml += `
            <div class="ttd-double">
              <div class="ttd-box">
                <p>${escapeHtml(String(d.kiri_jabatan || "Pihak I"))}</p>
                <div class="ttd-space"></div>
                <p><strong><u>${escapeHtml(String(d.kiri_nama || "-"))}</u></strong></p>
                ${d.kiri_nip ? `<p>NIP. ${escapeHtml(String(d.kiri_nip))}</p>` : ""}
              </div>
              <div class="ttd-box">
                <p>${escapeHtml(String(d.kanan_jabatan || "Kepala Sekolah"))}</p>
                <div class="ttd-space"></div>
                <p><strong><u>${escapeHtml(ttdKananNama)}</u></strong></p>
                <p>NIP. ${escapeHtml(ttdKananNip)}</p>
              </div>
            </div>`;
          break;
        }
      }
    }

    bodyHtml += `<div class="sheet">${pageHtml}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.reportName || "Laporan")}</title>
  <style>
    @page { size: ${sizeCss}; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; background: #f1f5f9; }
    .sheet { background: #fff; padding: 15mm; margin: 10px auto; max-width: 210mm; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    @media print {
      body { background: none; }
      .sheet { box-shadow: none; padding: 0; margin: 0; max-width: none; page-break-after: always; }
    }
    .kop { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .kop-header { display: flex; align-items: center; justify-content: space-between; }
    .logo { width: 60px; height: 60px; object-fit: contain; }
    .kop-center { text-align: center; flex: 1; padding: 0 10px; }
    .gov { font-size: 10pt; font-weight: bold; text-transform: uppercase; }
    .dept { font-size: 11pt; font-weight: bold; text-transform: uppercase; }
    .school { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
    .addr { font-size: 8pt; color: #334155; }
    .title-wrap { text-align: center; margin: 12px 0; }
    .title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0; }
    .subtitle { font-size: 9pt; color: #475569; margin: 0; }
    .filter-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 8.5pt; margin-bottom: 10px; border-radius: 4px; }
    .kpi-grid { display: flex; gap: 10px; margin-bottom: 12px; }
    .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; }
    .kpi-label { font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; }
    .kpi-val { font-size: 12pt; font-weight: bold; color: #0f172a; margin-top: 2px; }
    .report-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8.5pt; }
    .report-table th, .report-table td { border: 1px solid #94a3b8; padding: 5px 6px; }
    .report-table th { background: #e2e8f0; font-weight: bold; color: #0f172a; }
    .report-table tr.even { background: #f8fafc; }
    .report-table tfoot th { background: #e2e8f0; border-top: 2px solid #0f172a; }
    .note { font-size: 8pt; color: #475569; margin-top: 8px; }
    .ttd-single { display: flex; justify-content: flex-end; margin-top: 24px; }
    .ttd-double { display: flex; justify-content: space-between; margin-top: 24px; }
    .ttd-box { width: 220px; text-align: center; }
    .ttd-space { height: 50px; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
