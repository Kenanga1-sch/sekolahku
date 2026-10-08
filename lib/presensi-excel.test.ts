import { describe, expect, it } from "vitest";
import {
  excelFilename,
  fillPresensiWorksheet,
  isRowVariable,
  rowValues,
  scalarMap,
  shiftFormulaRows,
  substitute,
  unknownVariables,
} from "./presensi-excel";
import type { DayColumn, MatrixRow } from "./presensi-report";

type Cell = { value: unknown };
type Row = {
  getCell(c: number): Cell;
  eachCell(o: { includeEmpty?: boolean }, cb: (cell: Cell, col: number) => void): void;
};
type Sheet = {
  rowCount: number;
  getRow(n: number): Row & { duplicateMarker?: boolean };
  eachRow(cb: (row: Row, n: number) => void): void;
  duplicateRow(n: number, count: number, insert: boolean): void;
};

function col(day: number, effective = true): DayColumn {
  return {
    day,
    date: `2026-10-${String(day).padStart(2, "0")}`,
    dow: day % 7,
    letter: "S",
    sunday: false,
    holiday: !effective,
    effective,
  };
}

const rows: MatrixRow[] = [
  {
    studentId: "s1", studentName: "Andi", nis: "1001", className: "Kelas 1A",
    dailyStatus: { 1: "H", 2: "S" }, totalHadir: 20, totalSakit: 1, totalIzin: 0, totalAlpha: 0,
  },
];

function fakeSheet(cells: Record<string, unknown>): Sheet {
  const grid = new Map<string, Cell>();
  for (const [k, v] of Object.entries(cells)) grid.set(k, { value: v });
  const api = {
    rowCount: 10,
    getRow(n: number): Row {
      const rowApi: Row = {
        getCell(c: number) {
          const key = `${n},${c}`;
          if (!grid.has(key)) grid.set(key, { value: null });
          return grid.get(key)!;
        },
        eachCell(_o, cb) {
          for (let c = 1; c <= 40; c++) cb(rowApi.getCell(c), c);
        },
      };
      return rowApi;
    },
    eachRow(cb: (row: Row, n: number) => void) {
      for (let n = 1; n <= 10; n++) cb(api.getRow(n), n);
    },
    duplicateRow(n: number) {
      api.duplicatedFrom = n;
    },
    duplicatedFrom: 0 as number,
  };
  return api;
}

describe("substitute", () => {
  it("mengganti variabel yang dikenal, membiarkan yang asing", () => {
    expect(substitute("Kelas {{kelas}} {{typo_var}}", { kelas: "1A" })).toBe("Kelas 1A {{typo_var}}");
  });
  it("beberapa variabel dalam satu sel", () => {
    expect(substitute("{{bulan}} {{tahun}}", { bulan: "Oktober", tahun: 2026 })).toBe("Oktober 2026");
  });
});

describe("isRowVariable", () => {
  it("mengenali variabel baris", () => {
    expect(isRowVariable("{{no}}")).toBe(true);
    expect(isRowVariable("{{nama}}")).toBe(true);
    expect(isRowVariable("{{tgl_15}}")).toBe(true);
    expect(isRowVariable("{{total_h}}")).toBe(true);
    expect(isRowVariable("{{persen}}")).toBe(true);
  });
  it("menolak variabel skalar", () => {
    expect(isRowVariable("{{kelas}}")).toBe(false);
    expect(isRowVariable("{{bulan}}")).toBe(false);
    expect(isRowVariable("Hadir")).toBe(false);
  });
});

describe("scalarMap", () => {
  it("memetakan semua skalar + default kosong", () => {
    const m = scalarMap({
      rows, columns: [col(1)], effectiveDays: 21,
      scalars: { kelas: "Kelas 1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027", hariEfektif: 21 },
    });
    expect(m.kelas).toBe("Kelas 1A");
    expect(m.tahun).toBe("2026");
    expect(m.hari_efektif).toBe("21");
    expect(m.wali_kelas_nama).toBe("");
  });
});

describe("rowValues", () => {
  it("mengisi identitas + status tanggal + rekap + persen", () => {
    const v = rowValues(rows[0], 3, [col(1), col(2), col(3, false)], 21);
    expect(v.no).toBe(3);
    expect(v.nama).toBe("Andi");
    expect(v.tgl_1).toBe("H");
    expect(v.tgl_2).toBe("S");
    expect(v.tgl_3).toBe("");
    expect(v.total_h).toBe(20);
    expect(v.persen).toBe(95.2);
  });
  it("persen kosong bila siswa tanpa catatan", () => {
    const v = rowValues(
      { ...rows[0], dailyStatus: {}, totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0 },
      1, [col(1)], 21
    );
    expect(v.persen).toBe("");
  });
});

describe("shiftFormulaRows", () => {
  it("menggeser referensi baris template saja", () => {
    expect(shiftFormulaRows('=COUNTIF(D5:AH5,"H")', 5, 3)).toBe('=COUNTIF(D8:AH8,"H")');
  });
  it("tidak menyentuh referensi absolut dan baris lain", () => {
    expect(shiftFormulaRows("=D5+$E$5+E6", 5, 2)).toBe("=D7+$E$5+E6");
  });
  it("delta 0 tidak mengubah", () => {
    expect(shiftFormulaRows("=SUM(A5:A5)", 5, 0)).toBe("=SUM(A5:A5)");
  });
});

describe("colLetter", () => {
  it("konversi kolom", async () => {
    const { colLetter } = await import("./presensi-excel");
    expect(colLetter(1)).toBe("A");
    expect(colLetter(28)).toBe("AB");
    expect(colLetter(34)).toBe("AH");
  });
});

describe("fillPresensiWorksheet", () => {
  const input = {
    rows,
    columns: [col(1), col(2)],
    effectiveDays: 21,
    scalars: {
      kelas: "Kelas 1A", bulan: "Oktober", tahun: 2026,
      tahunAjaran: "2026/2027", hariEfektif: 21,
    },
  };
  it("mengisi skalar + mereplikasi baris + menggeser formula", async () => {
    const ws = fakeSheet({
      "1,1": "Kelas {{kelas}}",
      "4,1": "{{no}}", "4,2": "{{nama}}", "4,3": "{{tgl_1}}", "4,4": "{{tgl_2}}",
      "4,5": "=COUNTIF(C4:D4,\"H\")",
    });
    const res = await fillPresensiWorksheet(ws, {
      ...input,
      rows: [
        rows[0],
        { ...rows[0], studentId: "s2", studentName: "Budi", dailyStatus: { 1: "A" }, totalHadir: 19, totalAlpha: 1 },
      ],
    });
    expect(res.rowCount).toBe(2);
    expect(ws.getRow(1).getCell(1).value).toBe("Kelas Kelas 1A");
    expect(ws.getRow(4).getCell(2).value).toBe("Andi");
    expect(ws.getRow(4).getCell(5).value).toEqual({ formula: 'COUNTIF(C4:D4,"H")' });
    // Baris Jumlah otomatis di bawah blok data (2 siswa → baris 6);
    // result terhitung disertakan agar bisa dirender ke HTML/PDF.
    expect(ws.getRow(6).getCell(2).value).toBe("Jumlah"); // label menimpa sisa duplikat
    expect(ws.getRow(6).getCell(3).value).toEqual({ formula: 'COUNTIF(C4:C5,"H")', result: 1 });
    expect(ws.getRow(6).getCell(4).value).toEqual({ formula: 'COUNTIF(D4:D5,"H")', result: 0 });
  });

  it("mengembalikan rowCount 0 bila template tanpa baris contoh", async () => {
    const ws = fakeSheet({ "1,1": "Judul {{kelas}}" });
    const res = await fillPresensiWorksheet(ws, input);
    expect(res.rowCount).toBe(0);
    expect(ws.getRow(1).getCell(1).value).toBe("Judul Kelas 1A");
  });

  it("melaporkan variabel salah ketik", async () => {
    const ws = fakeSheet({ "1,1": "{{kellas}}", "4,1": "{{no}}" });
    const res = await fillPresensiWorksheet(ws, input);
    expect(res.unknown).toEqual(["kellas"]);
  });
});

describe("fillPresensiWorksheet — merge cells", () => {
  it("menggeser merge di bawah baris contoh, header tetap", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Daftar Hadir");
    // Baris 1 header merge (di atas baris contoh → tak tersentuh).
    ws.getCell("A1").value = "Daftar Hadir {{kelas}}";
    ws.mergeCells("A1:D1");
    // Baris 7 = baris contoh.
    ws.getCell("A7").value = "{{no}}";
    ws.getCell("B7").value = "{{nama}}";
    // Signature block (merge di bawah baris contoh) — harus ikut turun.
    ws.getCell("B10").value = "Mengetahui,";
    ws.mergeCells("B10:C10");
    ws.mergeCells("D11:E11");

    const res = await fillPresensiWorksheet(ws as never, {
      rows: [
        rows[0],
        { ...rows[0], studentId: "s2", studentName: "Budi" },
        { ...rows[0], studentId: "s3", studentName: "Cici" },
        { ...rows[0], studentId: "s4", studentName: "Dedi" },
      ],
      columns: [col(1), col(2)],
      effectiveDays: 21,
      scalars: { kelas: "Kelas 1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027", hariEfektif: 21 },
    });
    expect(res.rowCount).toBe(4); // 4 siswa → delta 3

    const merges = (ws.model as { merges?: string[] }).merges ?? [];
    expect(merges).toContain("A1:D1"); // header tetap
    expect(merges).toContain("B13:C13"); // 10 + 3
    expect(merges).toContain("D14:E14"); // 11 + 3
    expect(merges).not.toContain("B10:C10"); // ref lama hilang
    expect(merges).not.toContain("D11:E11");

    // Konten signature tergeser 3 baris (data 7..10, jumlah 11): merge lama
    // di baris 10 akan menutupi Nama siswa ke-4 bila tidak digeser.
    expect(ws.getCell("B10").value).not.toBe("Mengetahui,");
    expect(ws.getCell("B10").value).toBe("Dedi"); // siswa ke-4 (7+3)
    expect(ws.getCell("B13").value).toBe("Mengetahui,"); // pindah ke 10+3
  }, 30000); // import exceljs lambat di mesin CI — jangan kena timeout 5s
});

describe("fillPresensiWorksheet — warna status, blok libur & pageSetup", () => {
  it("H/S/I/A berwarna, kolom libur diblok merah, pageSetup ikut paperSize", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    // Header tanggal (baris 6) + baris contoh (baris 7).
    ws.getCell("C6").value = 1;
    ws.getCell("D6").value = 2;
    ws.getCell("A7").value = "{{no}}";
    ws.getCell("B7").value = "{{nama}}";
    ws.getCell("C7").value = "{{tgl_1}}";
    ws.getCell("D7").value = "{{tgl_2}}";

    await fillPresensiWorksheet(ws as never, {
      rows: [rows[0]], // Andi: tgl_1=H, tgl_2=S
      columns: [col(1), col(2, false)], // tgl 2 = libur
      effectiveDays: 21,
      scalars: { kelas: "1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027", hariEfektif: 21 },
      paperSize: "A4",
      orientation: "landscape",
    });

    const argb = (v: unknown) => JSON.stringify(v);
    // Sel data: H hijau; kolom libur di-blok merah muda (isinya "").
    expect(ws.getCell("C7").value).toBe("H");
    expect(argb((ws.getCell("C7").font as any)?.color?.argb)).toContain("15803D");
    expect(ws.getCell("D7").value).toBe("");
    expect(argb((ws.getCell("D7").fill as any)?.fgColor?.argb)).toContain("FEE2E2");
    // Header tanggal libur (D6=2): font merah tebal + blok merah.
    expect(argb((ws.getCell("D6").font as any)?.color?.argb)).toContain("DC2626");
    expect((ws.getCell("D6").font as any)?.bold).toBe(true);
    expect(argb((ws.getCell("D6").fill as any)?.fgColor?.argb)).toContain("FEE2E2");
    // Header tanggal efektif (C6=1) tidak disentuh.
    expect((ws.getCell("C6").font as any)?.color).toBeUndefined();
    // pageSetup A4=landscape + fit KOLOM (fitToHeight=0 → tinggi natural,
    // multi-halaman seperti print Excel) + margin 10mm (0.4in) konsisten
    // dengan jalur HTML (pageCss/printAreaPx default 10mm) + centering
    // horizontal (fix "mepet kiri" di LibreOffice).
    expect((ws as any).pageSetup?.paperSize).toBe(9);
    expect((ws as any).pageSetup?.orientation).toBe("landscape");
    expect((ws as any).pageSetup?.fitToPage).toBe(true);
    expect((ws as any).pageSetup?.fitToWidth).toBe(1);
    expect((ws as any).pageSetup?.fitToHeight).toBe(0);
    expect((ws as any).pageSetup?.margins?.left).toBe(0.4);
    expect((ws as any).pageSetup?.margins?.top).toBe(0.4);
    expect((ws as any).pageSetup?.horizontalCentered).toBe(true);
  }, 30000); // import exceljs lambat di mesin CI — jangan kena timeout 5s
});

describe("fillPresensiWorksheet — baris Jumlah bawaan template", () => {
  it("mempertahankan label 'Jumlah' di anchor merge (A14:C14), bukan ditimpa", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    // Header + baris contoh (13) + baris Jumlah statis (14, label di anchor A)
    // + signature (16) — struktur seperti template "Daftar hadir murid".
    ws.getCell("A14").value = "Jumlah";
    ws.mergeCells("A14:C14");
    ws.getCell("A16").value = "Mengetahui,";
    ws.mergeCells("B16:C16");
    ws.getCell("A13").value = "{{no}}";
    ws.getCell("B13").value = "{{nis}}";
    ws.getCell("C13").value = "{{nama}}";
    ws.getCell("D13").value = "{{tgl_1}}";

    const res = await fillPresensiWorksheet(ws as never, {
      rows: [rows[0], { ...rows[0], studentId: "s2" }, { ...rows[0], studentId: "s3" }],
      columns: [col(1)],
      effectiveDays: 21,
      scalars: { kelas: "1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027", hariEfektif: 21 },
    });
    expect(res.rowCount).toBe(3); // delta 2 → jumlah asli 14+2=16, signature 16+2=18

    // Label tetap di anchor merge — kalau ditimpa null, Excel menampilkan
    // anchor (kosong) dan label "Jumlah" hilang.
    expect(ws.getCell("A16").value).toBe("Jumlah");
    const merges = (ws.model as { merges?: string[] }).merges ?? [];
    expect(merges).toContain("A16:C16"); // merge jumlah ikut tergeser
    expect(merges).not.toContain("A14:C14");
    expect(merges).toContain("B18:C18"); // signature tergeser
    expect(merges).not.toContain("B16:C16");
    // Formula jumlah di kolom tanggal tetap tertulis.
    const v = ws.getCell("D16").value as { formula?: string; result?: number };
    expect(v?.formula).toContain("COUNTIF");
    expect(v?.result).toBe(3); // ketiga baris menyalin rows[0] (tgl_1 = H)
  }, 30000);
});

describe("fillPresensiWorksheet — copy-on-write style (anti menular)", () => {
  it("warna status tidak bocor ke sel lain satu baris (row-level style dishare)", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.getCell("A5").value = "{{no}}";
    ws.getCell("B5").value = "{{nama}}";
    ws.getCell("C5").value = "{{tgl_1}}";
    // Simulasikan row-level style exceljs: satu object dishare banyak sel
    // (terbukti pada template nyata: D13.style === I13.style).
    const shared = { font: { name: "Arial Narrow", size: 10, color: { argb: "FF333333" } } };
    ws.getCell("A5").style = shared;
    ws.getCell("B5").style = shared;
    ws.getCell("C5").style = shared;
    expect(ws.getCell("A5").style).toBe(ws.getCell("C5").style); // ter-share

    await fillPresensiWorksheet(ws as never, {
      rows: [rows[0]], // tgl_1 = H → C5 harus hijau
      columns: [col(1)],
      effectiveDays: 21,
      scalars: { kelas: "1A", bulan: "Oktober", tahun: 2026, tahunAjaran: "2026/2027", hariEfektif: 21 },
    });

    const c5 = ws.getCell("C5");
    expect((c5.font as { color?: { argb?: string } })?.color?.argb).toContain("15803D"); // hijau
    // Sel lain TIDAK tertular: masih memakai style bersama berwarna asli.
    const a5 = ws.getCell("A5");
    expect(a5.style).toBe(shared);
    expect((a5.font as { color?: { argb?: string } })?.color?.argb).toBe("FF333333");
    expect(c5.style).not.toBe(shared); // copy-on-write memutus share
  }, 30000);
});

describe("unknownVariables", () => {
  it("melaporkan variabel salah ketik", () => {
    expect(unknownVariables(["{{kelas}}", "{{kellas}}", "{{tgl_32}}"])).toEqual(["kellas", "tgl_32"]);
  });
  it("kosong bila semua dikenal", () => {
    expect(unknownVariables(["{{nama}} {{tgl_1}} {{total_h}}"])).toEqual([]);
  });
});

describe("excelFilename", () => {
  it("slug + periode", () => {
    expect(excelFilename("Kelas 1A", 10, 2026)).toBe("daftar-hadir-kelas-1a-2026-10.xlsx");
  });
});

describe("resolvePresensiTemplateUrl", () => {
  it("memakai default modul bila ada filePath", async () => {
    const { resolvePresensiTemplateUrl, PRESENSI_TEMPLATE_PATH } = await import("./presensi-excel");
    const fakeFetch = (async (url: string) => {
      if (url.includes("/api/reports/templates/default/presensi")) {
        return { ok: true, json: async () => ({ success: true, data: { filePath: "templates/custom-v2.xlsx" } }) };
      }
      return { ok: true };
    }) as unknown as typeof fetch;
    const res = await resolvePresensiTemplateUrl(fakeFetch);
    // Path lama templates/... = publik (tanpa /api/files).
    expect(res).toEqual({ url: "/templates/custom-v2.xlsx", fromDefault: true });
    expect(res.url).not.toBe(PRESENSI_TEMPLATE_PATH);
  });

  it("mengarahkan unggahan uploads/templates via endpoint terautentikasi", async () => {
    const { resolvePresensiTemplateUrl } = await import("./presensi-excel");
    const fakeFetch = (async (url: string) => {
      if (url.includes("/api/reports/templates/default/presensi")) {
        return { ok: true, json: async () => ({ success: true, data: { filePath: "uploads/templates/rpt-1.xlsx" } }) };
      }
      return { ok: true };
    }) as unknown as typeof fetch;
    const res = await resolvePresensiTemplateUrl(fakeFetch);
    expect(res).toEqual({ url: "/api/files/uploads/templates/rpt-1.xlsx", fromDefault: true });
  });

  it("tanpa HEAD probe ke URL privat (endpoint hanya GET → HEAD 405)", async () => {
    const { resolvePresensiTemplateUrl } = await import("./presensi-excel");
    const calls: string[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("/api/reports/templates/default/presensi")) {
        return { ok: true, json: async () => ({ success: true, data: { filePath: "uploads/templates/rpt-1.xlsx" } }) };
      }
      // Server privat membalas 405 untuk HEAD — dulu ini memicu fallback diam-diam.
      if (init?.method === "HEAD") return { ok: false, status: 405 };
      return { ok: true };
    }) as unknown as typeof fetch;
    const res = await resolvePresensiTemplateUrl(fakeFetch);
    expect(res).toEqual({ url: "/api/files/uploads/templates/rpt-1.xlsx", fromDefault: true });
    expect(calls.some((c) => c.startsWith("HEAD /api/files/"))).toBe(false);
  });

  it("fallback ke bawaan bila belum ada default", async () => {
    const { resolvePresensiTemplateUrl, PRESENSI_TEMPLATE_PATH } = await import("./presensi-excel");
    const fakeFetch = (async () => ({ ok: false, json: async () => null })) as unknown as typeof fetch;
    const res = await resolvePresensiTemplateUrl(fakeFetch);
    expect(res).toEqual({ url: PRESENSI_TEMPLATE_PATH, fromDefault: false });
  });

  it("fallback ke bawaan bila API error", async () => {
    const { resolvePresensiTemplateUrl, PRESENSI_TEMPLATE_PATH } = await import("./presensi-excel");
    const fakeFetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const res = await resolvePresensiTemplateUrl(fakeFetch);
    expect(res).toEqual({ url: PRESENSI_TEMPLATE_PATH, fromDefault: false });
  });
});
