import { describe, it, expect } from "vitest";
import {
  processReportTable,
  processReportKPI,
  formatRupiah,
  formatNumber,
  formatDateIndo,
} from "./report-engine";
import type { ReportColumnConfig, ReportKPIItemConfig } from "./config/report-blocks";

describe("report-engine", () => {
  it("formatRupiah menghitung & memformat mata uang Indonesia", () => {
    expect(formatRupiah(1500000)).toContain("1.500.000");
    expect(formatRupiah(0)).toContain("0");
    expect(formatRupiah(null)).toContain("0");
  });

  it("formatNumber memformat angka ribuan", () => {
    expect(formatNumber(12540)).toBe("12.540");
    expect(formatNumber(0)).toBe("0");
  });

  it("formatDateIndo mengubah string ISO ke tanggal Indo", () => {
    expect(formatDateIndo("2026-09-25")).toBe("25 September 2026");
  });

  it("processReportTable menghitung Auto-Sum untuk kolom numerik", () => {
    const columns: ReportColumnConfig[] = [
      { key: "no", label: "No", align: "center" },
      { key: "nama", label: "Nama", align: "left" },
      { key: "setoran", label: "Setoran", align: "right", autoSum: true, format: "rupiah" },
      { key: "penarikan", label: "Penarikan", align: "right", autoSum: true, format: "rupiah" },
    ];

    const dataset = [
      { nama: "Ahmad", setoran: 500000, penarikan: 100000 },
      { nama: "Budi", setoran: 700000, penarikan: 200000 },
    ];

    const res = processReportTable(columns, dataset);

    expect(res.hasAutoSum).toBe(true);
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].no).toBe(1);
    expect(res.rows[1].no).toBe(2);
    expect(res.totals.setoran).toBe(1200000);
    expect(res.totals.penarikan).toBe(300000);
  });

  it("processReportKPI menghitung statistik ringkasan KPI", () => {
    const kpiItems: ReportKPIItemConfig[] = [
      { label: "Total Baris", key: "total_items", format: "number" },
      { label: "Total Nominal", key: "nominal", format: "rupiah" },
    ];

    const dataset = [
      { nominal: 50000 },
      { nominal: 150000 },
    ];

    const res = processReportKPI(kpiItems, dataset);
    expect(res.items.length).toBe(2);
    expect(res.items[0].value).toBe("2");
    expect(res.items[1].value).toContain("200.000");
  });
});
