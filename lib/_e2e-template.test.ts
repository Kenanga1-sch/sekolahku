// ONE-OFF: verifikasi fill dengan template asli (dihapus setelah pakai).
import { describe, expect, it } from "vitest";
import { fillPresensiWorksheet } from "./presensi-excel";
import type { DayColumn, MatrixRow } from "./presensi-report";
import { buildDayColumns } from "./presensi-report";

const FILE = "/tmp/daftar-hadir-murid.xlsx";
import fsSync from "node:fs";

// One-off: file template asli hanya ada di mesin dev/analisis — CI melewati.
describe.skipIf(!fsSync.existsSync(FILE))("e2e template Daftar hadir murid", () => {
  it("fill + render lengkap", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const buf = fsSync.readFileSync(FILE);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const ws = wb.worksheets[0];

    // Oktober 2026: libur Minggu saja (tanpa holiday eksternal).
    const columns: DayColumn[] = buildDayColumns(2026, 10, []);
    const rows: MatrixRow[] = Array.from({ length: 5 }, (_, i) => ({
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
      paperSize: "A4", orientation: "landscape",
    });
    expect(res.rowCount).toBe(5);
    expect(res.unknown).toEqual([]);

    // Baris contoh 13 → delta 4 → jumlah asli 14 → 18, signature 16 → 20.
    expect(ws.getCell("A18").value).toBe("Jumlah");
    const merges: string[] = (ws.model as never as { merges?: string[] }).merges ?? [];
    expect(merges).toContain("A18:C18"); // merge jumlah ikut turun
    expect(merges).not.toContain("A14:C14");
    expect(merges).toContain("B20:C20"); // signature tergeser
    expect(merges).not.toContain("B16:C16");

    // Kop tetap + tahun ajaran tersubstitusi.
    expect(String(ws.getCell("A3").value)).toBe("UPTD SDN 1 KENANGA");
    expect(String(ws.getCell("A9").value)).toContain("2026/2027");
    // Tanda tangan kepsek + wali + NIP.
    expect(String(ws.getCell("B26").value)).toBe("Drs. Test, M.Pd");
    expect(String(ws.getCell("B27").value)).toContain("19680101");
    expect(String(ws.getCell("AC26").value)).toBe("Siti, S.Pd");

    // Blok merah: 4 Oktober 2026 = Minggu → header D..AH angka 4, sel data fill merah.
    const oct4 = columns.find((c) => c.day === 4)!;
    expect(oct4.effective).toBe(false);
    const day4Col = 3 + 4; // D=4 → col index 4 (tgl_1 di D) → tgl_4 = kolom 7 (G)
    // header angka 4 ada di baris 12 kolom yang sama dengan {{tgl_4}} (G)
    const hdrFont = (ws.getCell("G12").font as { color?: { argb?: string } })?.color?.argb;
    expect(hdrFont).toContain("DC2626");
    const dataFill = (ws.getCell("G14").fill as { fgColor?: { argb?: string } })?.fgColor?.argb;
    expect(dataFill).toContain("FEE2E2");
    void day4Col;

    // Warna status: D14 (tgl_1 pertama siswa) = H hijau.
    expect(ws.getCell("D14").value).toBe("H");
    expect((ws.getCell("D14").font as { color?: { argb?: string } })?.color?.argb).toContain("15803D");

    // Formula jumlah + result.
    const jml = ws.getCell("D18").value as { formula?: string; result?: number };
    expect(jml.formula).toContain("COUNTIF");
    expect(jml.result).toBe(5);

    // pageSetup.
    expect((ws as never as { pageSetup?: { paperSize?: number } }).pageSetup?.paperSize).toBe(9);

    // Gambar kop template tetap ada (2 gambar anchor); render HTML dihapus
    // bersama jalur Chromium/dialog (2026-10-08) — PDF kini lewat LibreOffice.
    const anchored = (ws as never as { getImages?: () => unknown[] }).getImages?.() ?? [];
    expect(anchored.length).toBe(2);
    // Kop judul masih tersubstitusi di sel (bukan {{variabel}}).
    let kopJudul = "";
    for (let r = 1; r <= 15; r++) {
      const v = ws.getCell(`A${r}`).value;
      if (typeof v === "string" && v.includes("DAFTAR HADIR")) kopJudul = v;
    }
    expect(kopJudul).toContain("DAFTAR HADIR MURID");

    // Tulis ulang → workbook valid.
    const out = await wb.xlsx.writeBuffer();
    expect((out as ArrayBuffer).byteLength).toBeGreaterThan(10000);
  }, 60000);
});
