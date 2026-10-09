// Verifikasi nyata xlsx→PDF LibreOffice: F4 landscape + jumlah halaman.
//
// Test ini menjalankan soffice sungguhan (±10–30 detik per konversi) —
// dilewati otomatis bila binary tak ada (CI) atau template asli tak ada
// (hanya mesin dev/analisis yang punya /tmp/daftar-hadir-murid.xlsx).
// Kepastian penuh ada di container: scripts/verify-template-pdf.sh.
import { execFile, execFileSync } from "node:child_process";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { fillPresensiWorksheet } from "./presensi-excel";
import { buildDayColumns } from "./presensi-report";
import type { DayColumn, MatrixRow } from "./presensi-report";

const execFileAsync = promisify(execFile);
const TEMPLATE = "/tmp/daftar-hadir-murid.xlsx";

function hasSoffice(): boolean {
  try {
    execFileSync("soffice", ["--version"], { timeout: 20000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasPdfinfo(): boolean {
  try {
    execFileSync("pdfinfo", ["-v"], { timeout: 5000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const RUN = fsSync.existsSync(TEMPLATE) && hasSoffice();

/** Isi template dengan n siswa → tulis .xlsx sementara → konversi via soffice. */
async function fillAndConvert(studentCount: number): Promise<{ pdf: string; tmp: string }> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fsSync.readFileSync(TEMPLATE) as never);
  const ws = wb.worksheets[0];

  const columns: DayColumn[] = buildDayColumns(2026, 10, []);
  const rows: MatrixRow[] = Array.from({ length: studentCount }, (_, i) => ({
    studentId: `s${i}`,
    studentName: `Siswa ${i + 1}`,
    nis: `100${i}`,
    className: "Kelas 1A",
    dailyStatus: { 1: "H", 2: i === 1 ? "S" : "H", 5: "A", 6: "I" },
    totalHadir: 20, totalSakit: 1, totalIzin: 1, totalAlpha: 1,
  }));
  const res = await fillPresensiWorksheet(ws as never, {
    rows, columns, effectiveDays: 24,
    scalars: {
      sekolahNama: "UPTD SDN 1 KENANGA", sekolahAlamat: "Jl. Kenanga", sekolahTelepon: "0234",
      kepalaSekolahNama: "Drs. Test, M.Pd", kepalaSekolahNip: "19680101 199003 1 001",
      waliKelasNama: "Siti, S.Pd", waliKelasNip: "19870202 201101 2 002",
      kelas: "Kelas 1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027",
      hariEfektif: 24, tanggalCetak: "7 Oktober 2026", tempatTtd: "Indramayu",
    },
    paperSize: "F4", orientation: "landscape",
  });
  expect(res.rowCount).toBe(studentCount);

  const tmp = fsSync.mkdtempSync(path.join(os.tmpdir(), "printkit-verify-"));
  const xlsx = path.join(tmp, "daftar-hadir.xlsx");
  fsSync.writeFileSync(xlsx, Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer));

  await execFileAsync("soffice", [
    "--headless", "--norestore",
    `-env:UserInstallation=file://${tmp}/lo-profile`,
    "--convert-to", "pdf", "--outdir", tmp, xlsx,
  ], { timeout: 120000, env: { ...process.env, HOME: tmp } });

  const pdf = path.join(tmp, "daftar-hadir.pdf");
  if (!fsSync.existsSync(pdf)) throw new Error("soffice tidak menghasilkan PDF");
  return { pdf, tmp };
}

/** Ukuran halaman pertama dalam mm via pdfinfo (bila ada) atau regex MediaBox. */
function firstPageSizeMm(pdf: string): { w: number; h: number } {
  if (hasPdfinfo()) {
    const out = execFileSync("pdfinfo", [pdf], { encoding: "latin1", timeout: 15000 });
    const m = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(out);
    if (m) return { w: (Number(m[1]) * 25.4) / 72, h: (Number(m[2]) * 25.4) / 72 };
  }
  const buf = fsSync.readFileSync(pdf).toString("latin1");
  const m = /MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(buf);
  if (!m) throw new Error("MediaBox tidak ditemukan (kompresi objek stream?)");
  return { w: (Number(m[1]) * 25.4) / 72, h: (Number(m[2]) * 25.4) / 72 };
}

function pdfPageCount(pdf: string): number {
  if (hasPdfinfo()) {
    const out = execFileSync("pdfinfo", [pdf], { encoding: "latin1", timeout: 15000 });
    const m = /^Pages:\s+(\d+)/m.exec(out);
    if (m) return Number(m[1]);
  }
  const buf = fsSync.readFileSync(pdf).toString("latin1");
  return (buf.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

describe.skipIf(!RUN)("verifikasi PDF LibreOffice (F4 landscape)", () => {
  it("10 siswa → 1 halaman F4 landscape (±2mm)", async () => {
    const { pdf, tmp } = await fillAndConvert(10);
    try {
      const { w, h } = firstPageSizeMm(pdf);
      // F4 = 215,9×330,2 mm; landscape → 330,2 × 215,9 mm (±2mm toleransi LO).
      expect(Math.abs(w - 330.2)).toBeLessThanOrEqual(2);
      expect(Math.abs(h - 215.9)).toBeLessThanOrEqual(2);
      expect(pdfPageCount(pdf)).toBe(1);
    } finally {
      fsSync.rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  it("40 siswa → 2 halaman (fit kolom, tinggi natural)", async () => {
    const { pdf, tmp } = await fillAndConvert(40);
    try {
      expect(pdfPageCount(pdf)).toBe(2);
    } finally {
      fsSync.rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});
