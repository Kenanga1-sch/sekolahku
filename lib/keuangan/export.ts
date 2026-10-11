/**
 * Ekspor laporan modul Keuangan ke Excel (.xlsx) dan PDF.
 * Memakai util yang sudah ada di repo: @e965/xlsx (SheetJS) + jspdf.
 */

import { formatRupiah, directionLabel, type FinanceTransaction, type FinanceMonthlyRecap, type FinanceSummary } from "./index";

function fmtDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface FinanceExportMeta {
  unitName: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Ekspor daftar transaksi ke Excel. */
export async function exportTransactionsExcel(txns: FinanceTransaction[], meta: FinanceExportMeta): Promise<void> {
  const XLSX = await import("@e965/xlsx");
  const rows = txns.map((t) => ({
    Tanggal: fmtDate(t.txDate),
    Jenis: directionLabel(t.direction),
    Kategori: t.categoryName || "-",
    Uraian: t.description || "-",
    Pihak: t.party || "-",
    "Berat/Kg": t.quantity ?? "",
    "Harga Satuan": t.unitPrice ?? "",
    Jumlah: t.amount,
    Nota: t.reference || "-",
    "Diinput Oleh": t.createdByName || "-",
  }));

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Catatan: "Tidak ada transaksi" }]);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 32 }, { wch: 20 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = (meta.unitName || "Keuangan").slice(0, 28);
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Keuangan");
  const fname = `keuangan-${(meta.unitName || "transaksi").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/** Ekspor rekap bulanan ke Excel. */
export async function exportMonthlyExcel(recaps: FinanceMonthlyRecap[], meta: FinanceExportMeta): Promise<void> {
  const XLSX = await import("@e965/xlsx");
  const rows = recaps.map((r) => ({
    Periode: r.period,
    Pemasukan: r.totalIn,
    Pengeluaran: r.totalOut,
    "Selisih Bersih": r.net,
    "Jumlah Transaksi": r.txCount,
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Catatan: "Tidak ada data" }]);
  ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Bulanan");
  XLSX.writeFile(wb, `keuangan-rekap-${(meta.unitName || "unit").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`);
}

/** Ekspor laporan transaksi ke PDF (dengan ringkasan saldo). */
export async function exportTransactionsPDF(
  txns: FinanceTransaction[],
  summary: FinanceSummary | null,
  meta: FinanceExportMeta,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Laporan Keuangan — ${meta.unitName || "Semua Unit"}`, 14, 16);
  doc.setFontSize(9);
  const periode =
    meta.dateFrom || meta.dateTo
      ? `Periode: ${meta.dateFrom || "awal"} s/d ${meta.dateTo || "sekarang"}`
      : `Dicetak: ${new Date().toLocaleString("id-ID")}`;
  doc.text(periode, 14, 22);

  let startY = 28;
  if (summary) {
    doc.setFontSize(10);
    doc.text(
      `Pemasukan: ${formatRupiah(summary.totalIn)}   |   Pengeluaran: ${formatRupiah(summary.totalOut)}   |   Saldo: ${formatRupiah(summary.balance)}`,
      14,
      28,
    );
    startY = 34;
  }

  autoTable(doc, {
    startY,
    head: [["Tanggal", "Jenis", "Kategori", "Uraian", "Pihak", "Berat (Kg)", "Harga", "Jumlah"]],
    body: txns.map((t) => [
      fmtDate(t.txDate),
      directionLabel(t.direction),
      t.categoryName || "-",
      t.description || "-",
      t.party || "-",
      t.quantity != null ? String(t.quantity) : "-",
      t.unitPrice != null ? formatRupiah(t.unitPrice) : "-",
      formatRupiah(t.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: { 7: { halign: "right" } },
  });

  doc.save(`keuangan-${(meta.unitName || "laporan").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`);
}
