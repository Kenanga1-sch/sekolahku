/**
 * Ekspor laporan bulanan presensi GTK ke Excel (.xlsx) dan PDF.
 * Memakai util yang sudah ada di repo: @e965/xlsx (SheetJS) + jspdf.
 *
 * Format: matriks GTK × tanggal (kode H/S/I/A), kolom rekap (H/S/I/A/%),
 * plus baris rekap harian. Hari libur/Minggu dikosongkan.
 */

import {
  daysInMonth,
  dateKey,
  statusLetter,
  gtkAttendancePct,
  overallAttendancePct,
  monthlyFilename,
  monthName,
  annualAttendancePct,
  overallAnnualPct,
  monthRangeLabel,
  rangeFilename,
  isBelowThreshold,
  type GtkMonthlyReport,
  type GtkAnnualReport,
} from "./index";

export interface ReportMeta {
  schoolName?: string;
  /** jenis laporan: 'gtk' | 'ekskul'. */
  scope?: "gtk" | "ekskul";
  /** Blok tanda tangan kepala sekolah di PDF. */
  principalName?: string;
  principalNip?: string;
  city?: string;
}

function headerTitle(report: GtkMonthlyReport, meta: ReportMeta): string {
  const label = meta.scope === "ekskul" ? "Presensi Ekstrakurikuler" : "Presensi GTK (Honorer & Pembina Ekskul)";
  return `${label} — ${monthName(report.month)} ${report.year}`;
}

/** Susun matriks tabel: ["No","NIP","Nama", "1".."n", "H","S","I","A","%"]. */
function buildMatrix(report: GtkMonthlyReport) {
  const totalDays = daysInMonth(report.year, report.month);
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);
  const header = ["No", "NIP", "Nama", ...dayNumbers.map(String), "H", "S", "I", "A", "%"];

  const body = report.rows.map((r, i) => {
    const pct = gtkAttendancePct(r, report.effectiveDays);
    const dayCells = dayNumbers.map((d) => statusLetter(r.dailyStatus[dateKey(report.year, report.month, d)] || ""));
    return [
      i + 1,
      r.nip || "-",
      r.name,
      ...dayCells,
      r.totalHadir,
      r.totalSakit,
      r.totalIzin,
      r.totalAlpha,
      pct === null ? "-" : pct,
    ] as (string | number)[];
  });

  // Baris rekap harian (jumlah hadir per tanggal).
  const dailyHadir = dayNumbers.map(
    (d) => report.rows.filter((r) => r.dailyStatus[dateKey(report.year, report.month, d)] === "hadir").length
  );
  const rekap = [
    "Jumlah",
    "",
    `${report.rows.length} GTK`,
    ...dailyHadir,
    report.rows.reduce((n, r) => n + r.totalHadir, 0),
    report.rows.reduce((n, r) => n + r.totalSakit, 0),
    report.rows.reduce((n, r) => n + r.totalIzin, 0),
    report.rows.reduce((n, r) => n + r.totalAlpha, 0),
    overallAttendancePct(report.rows, report.effectiveDays) ?? "-",
  ] as (string | number)[];

  return { header, body, rekap, totalDays };
}

/** Ekspor laporan bulanan GTK ke Excel. */
export async function exportMonthlyExcel(report: GtkMonthlyReport, meta: ReportMeta = {}): Promise<void> {
  const XLSX = await import("@e965/xlsx");
  const { header, body, rekap } = buildMatrix(report);

  const metaRows = [
    [meta.schoolName || "Sekolah"],
    [headerTitle(report, meta)],
    [`Hari Efektif: ${report.effectiveDays}`],
    [],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...metaRows, header, ...body, rekap]);

  ws["!cols"] = [
    { wch: 5 }, { wch: 22 }, { wch: 28 },
    ...Array.from({ length: daysInMonth(report.year, report.month) }, () => ({ wch: 3 })),
    { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 7 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presensi GTK");
  XLSX.writeFile(wb, `${monthlyFilename(report.year, report.month, meta.scope)}.xlsx`);
}

/** Ekspor laporan bulanan GTK ke PDF (matriks ringkas). */
export async function exportMonthlyPDF(report: GtkMonthlyReport, meta: ReportMeta = {}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { header, body, rekap } = buildMatrix(report);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(13);
  if (meta.schoolName) {
    doc.setFontSize(10);
    doc.text(meta.schoolName, 14, 12);
    doc.setFontSize(13);
  }
  doc.text(headerTitle(report, meta), 14, 20);
  doc.setFontSize(9);
  doc.text(`Hari efektif: ${report.effectiveDays}  |  Jumlah GTK: ${report.rows.length}`, 14, 26);

  autoTable(doc, {
    startY: 30,
    head: [header],
    body: [...body, rekap],
    styles: { fontSize: 6, cellPadding: 1, halign: "center" },
    headStyles: { fillColor: [79, 70, 229], fontSize: 6 },
    columnStyles: { 2: { halign: "left", cellWidth: 40 }, 1: { halign: "left" } },
    didParseCell: (data) => {
      // Warnai huruf status.
      const v = String(data.cell.raw ?? "");
      if (["H", "S", "I", "A"].includes(v)) {
        const colors: Record<string, [number, number, number]> = {
          H: [21, 128, 61],
          S: [180, 83, 9],
          I: [29, 78, 216],
          A: [220, 38, 38],
        };
        data.cell.styles.textColor = colors[v];
        data.cell.styles.fontStyle = "bold";
      }
      // Kolom terakhir (%) merah bila di bawah ambang.
      const lastIdx = header.length - 1;
      if (data.section === "body" && data.column.index === lastIdx) {
        const num = Number(v);
        if (!Number.isNaN(num) && isBelowThreshold(num)) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  drawSignature(doc, finalY + 8, meta, doc.internal.pageSize.getWidth());

  doc.save(`${monthlyFilename(report.year, report.month, meta.scope)}.pdf`);
}

/** Blok tanda tangan kepala sekolah di kanan bawah PDF. */
function drawSignature(doc: any, startY: number, meta: ReportMeta, pageWidth: number): void {
  // Cegah blok terpotong di tepi bawah halaman.
  const pageHeight = doc.internal.pageSize.getHeight();
  if (startY > pageHeight - 40) {
    doc.addPage();
    startY = 20;
  }
  const rightX = pageWidth - 20;
  doc.setFontSize(9);
  const place = meta.city || "";
  const dateStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  doc.text(place ? `${place}, ${dateStr}` : dateStr, rightX, startY, { align: "right" });
  doc.text("Kepala Sekolah,", rightX, startY + 6, { align: "right" });
  // Ruang tanda tangan.
  doc.text("(............................)", rightX, startY + 26, { align: "right" });
  const name = meta.principalName || "............................";
  doc.setFont("helvetica", "bold");
  doc.text(name, rightX, startY + 32, { align: "right" });
  doc.setFont("helvetica", "normal");
  if (meta.principalNip) {
    doc.text(`NIP. ${meta.principalNip}`, rightX, startY + 37, { align: "right" });
  }
}

/** Ekspor rekap tahunan/semester GTK ke Excel. */
export async function exportRangeExcel(report: GtkAnnualReport, meta: ReportMeta = {}): Promise<void> {
  const XLSX = await import("@e965/xlsx");
  const header = ["No", "NIP", "Nama", "Kepegawaian", "Ekskul", "H", "S", "I", "A", "Hari Efektif", "%"];
  const body = report.rows.map((r, i) => {
    const pct = annualAttendancePct(r);
    return [i + 1, r.nip || "-", r.name, r.employmentStatus || "-", r.extracurricular || "-",
      r.totalHadir, r.totalSakit, r.totalIzin, r.totalAlpha, r.effectiveDays, pct === null ? "-" : pct];
  });
  const rekap = ["Jumlah", "", `${report.rows.length} GTK`, "", "",
    report.rows.reduce((n, r) => n + r.totalHadir, 0),
    report.rows.reduce((n, r) => n + r.totalSakit, 0),
    report.rows.reduce((n, r) => n + r.totalIzin, 0),
    report.rows.reduce((n, r) => n + r.totalAlpha, 0),
    report.effectiveDays,
    overallAnnualPct(report.rows, report.effectiveDays) ?? "-"];

  const rangeLabel = monthRangeLabel(report.startMonth, report.endMonth, report.year);
  const ws = XLSX.utils.aoa_to_sheet([
    [meta.schoolName || "Sekolah"],
    [`Rekap Presensi GTK — ${rangeLabel}`],
    [`Hari Efektif: ${report.effectiveDays}`],
    [],
    header,
    ...body,
    rekap,
  ]);
  ws["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 16 },
    { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 12 }, { wch: 7 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap GTK");
  XLSX.writeFile(wb, `${rangeFilename(report.year, report.startMonth, report.endMonth, meta.scope)}.xlsx`);
}

/** Ekspor rekap tahunan/semester GTK ke PDF (dengan blok tanda tangan). */
export async function exportRangePDF(report: GtkAnnualReport, meta: ReportMeta = {}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const rangeLabel = monthRangeLabel(report.startMonth, report.endMonth, report.year);

  const doc = new jsPDF({ orientation: "portrait" });
  doc.setFontSize(13);
  if (meta.schoolName) {
    doc.setFontSize(10);
    doc.text(meta.schoolName, 14, 12);
    doc.setFontSize(13);
  }
  doc.text(meta.scope === "ekskul" ? `Rekap Presensi Ekskul — ${rangeLabel}` : `Rekap Presensi GTK — ${rangeLabel}`, 14, 20);
  doc.setFontSize(9);
  doc.text(`Hari efektif: ${report.effectiveDays}  |  Jumlah GTK: ${report.rows.length}`, 14, 26);

  autoTable(doc, {
    startY: 30,
    head: [["No", "Nama", "Kepegawaian", "H", "S", "I", "A", "Efektif", "%"]],
    body: [
      ...report.rows.map((r, i) => {
        const pct = annualAttendancePct(r);
        return [i + 1, r.name, r.employmentStatus || "-", r.totalHadir, r.totalSakit, r.totalIzin, r.totalAlpha, r.effectiveDays, pct === null ? "-" : pct];
      }),
      ["", `${report.rows.length} GTK`, "", report.rows.reduce((n, r) => n + r.totalHadir, 0),
        report.rows.reduce((n, r) => n + r.totalSakit, 0), report.rows.reduce((n, r) => n + r.totalIzin, 0),
        report.rows.reduce((n, r) => n + r.totalAlpha, 0), report.effectiveDays,
        overallAnnualPct(report.rows, report.effectiveDays) ?? "-"],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 1: { halign: "left" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 8) {
        const num = Number(String(data.cell.raw ?? ""));
        if (!Number.isNaN(num) && isBelowThreshold(num)) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  drawSignature(doc, finalY + 8, meta, doc.internal.pageSize.getWidth());

  doc.save(`${rangeFilename(report.year, report.startMonth, report.endMonth, meta.scope)}.pdf`);
}
