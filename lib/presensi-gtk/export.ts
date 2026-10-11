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
  type GtkMonthlyReport,
} from "./index";

export interface ReportMeta {
  schoolName?: string;
  /** jenis laporan: 'gtk' | 'ekskul'. */
  scope?: "gtk" | "ekskul";
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
    },
  });

  doc.save(`${monthlyFilename(report.year, report.month, meta.scope)}.pdf`);
}
