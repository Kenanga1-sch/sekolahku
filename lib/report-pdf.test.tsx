import { describe, expect, it } from "vitest";
import React from "react";
import zlib from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdfDocument, pdfFontFamily } from "@/lib/report-pdf";
import { reportPdfFingerprint } from "@/components/report-builder/report-pdf-preview";
import { createDefaultWorkbook } from "@/lib/report-engine-v3";
import { cellKey, createSheet, PX_TO_PT, type ReportWorkbook, type SheetCell } from "@/lib/config/report-sheet";
import type { LetterSchoolData } from "@/lib/letter-pdf";

const school: LetterSchoolData = {
  schoolName: "SEKOLAH DEMO",
  npsn: "123",
  address: "Jl. X",
  phone: "021",
  email: "a@b.c",
  website: "",
  logoUrl: "",
  governanceLine: "PEMERINTAH KABUPATEN",
  departmentLine: "DINAS PENDIDIKAN",
  principalName: "Kepsek",
  principalNip: "1980",
  stampUrl: "",
};

function kopWorkbook(row0: SheetCell): ReportWorkbook {
  const sheet = createSheet({ name: "Kop", cols: 6 });
  sheet.cells[cellKey(0, 0)] = row0;
  sheet.cells[cellKey(1, 0)] = { value: "BARIS KEDUA", align: "left" };
  return { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false };
}

/**
 * Ambil posisi-x teks (dalam pt, relatif konten halaman) dari PDF. Setiap
 * `BT ... ET` didahului operator transform terdekat `1 0 0 1 <x> <y> cm`.
 */
function textXPositions(buf: Buffer): number[] {
  const positions: number[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  const latin = buf.toString("latin1");
  while ((m = re.exec(latin))) {
    let stream: Buffer;
    try {
      stream = zlib.inflateSync(Buffer.from(m[1], "latin1"));
    } catch {
      continue;
    }
    const txt = stream.toString("latin1");
    for (const block of txt.matchAll(/BT([\s\S]*?)ET/g)) {
      const before = txt.slice(0, block.index ?? 0);
      // Transform konten biasanya berupa translasi murni `1 0 0 1 x y cm`.
      // Ambil kemunculan terakhir SEBELUM BT (setelah parent flip vertikal
      // `1 0 0 -1 0 H cm`), abaikan yang flip.
      const nonFlip = [...before.matchAll(/1 0 0 1 ([\d.-]+) [\d.-]+ cm/g)].pop();
      if (nonFlip) {
        positions.push(Number(nonFlip[1]));
        continue;
      }
      // Fallback: translasi di dalam blok lewat `Tm`.
      const tm = /1 0 0 1 ([\d.-]+) [\d.-]+ Tm/.exec(block[1]);
      if (tm) positions.push(Number(tm[1]));
    }
  }
  return positions;
}

describe("report-pdf — preview fingerprint", () => {
  it("berubah untuk seluruh input yang memengaruhi render PDF", () => {
    const workbook = createDefaultWorkbook();
    const base = { workbook, school, dataset: [{ nama: "A" }], global: { periode: "2026" } };
    const fingerprint = reportPdfFingerprint(base);
    expect(reportPdfFingerprint({ ...base, school: { ...school, schoolName: "LAIN" } })).not.toBe(fingerprint);
    expect(reportPdfFingerprint({ ...base, dataset: [{ nama: "B" }] })).not.toBe(fingerprint);
    expect(reportPdfFingerprint({ ...base, global: { periode: "2027" } })).not.toBe(fingerprint);
    expect(reportPdfFingerprint({ ...base, workbook: { ...workbook, showFooter: false } })).not.toBe(fingerprint);
    expect(reportPdfFingerprint({ ...base, fileName: "nama lain" })).toBe(fingerprint);
  });
});

describe("report-pdf — font", () => {
  it("memilih varian built-in untuk kombinasi bold dan italic", async () => {
    expect(pdfFontFamily({ bold: true, italic: true })).toBe("Helvetica-BoldOblique");
    expect(pdfFontFamily({ fontFamily: "Times-Roman", bold: true, italic: true })).toBe("Times-BoldItalic");
    expect(pdfFontFamily({ fontFamily: "Courier", italic: true })).toBe("Courier-Oblique");
    await expect(renderToBuffer(
      <ReportPdfDocument workbook={kopWorkbook({ value: "Bold italic", bold: true, italic: true, fontSize: 14 })} school={school} />
    )).resolves.toBeInstanceOf(Buffer);
  });

  it("mengembalikan nama keluarga terdaftar untuk font tambahan", () => {
    expect(pdfFontFamily({ fontFamily: "Arial", bold: true })).toBe("Arial");
    expect(pdfFontFamily({ fontFamily: "Bookman Old Style", italic: true })).toBe("Bookman Old Style");
    expect(pdfFontFamily({ fontFamily: "Liberation Serif" })).toBe("Liberation Serif");
  });

  it("merender font tambahan tanpa error", async () => {
    for (const fontFamily of ["Arial", "Bookman Old Style", "Liberation Serif"] as const) {
      await expect(renderToBuffer(
        <ReportPdfDocument workbook={kopWorkbook({ value: `Contoh ${fontFamily}`, fontFamily, bold: true, fontSize: 12 })} school={school} />
      )).resolves.toBeInstanceOf(Buffer);
    }
  });
});

describe("report-pdf — header berulang", () => {
  /** Jumlah blok teks per halaman (mendekati jumlah teks yang dirender). */
  function pageTextBlocks(buf: Buffer): number[] {
    const counts: number[] = [];
    const latin = buf.toString("latin1");
    for (const m of latin.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      let stream: Buffer;
      try {
        stream = zlib.inflateSync(Buffer.from(m[1], "latin1"));
      } catch {
        continue;
      }
      const txt = stream.toString("latin1");
      if (!txt.includes("BT")) continue;
      counts.push((txt.match(/BT/g) || []).length);
    }
    return counts;
  }

  function headerWorkbook(repeat: boolean): ReportWorkbook {
    const sheet = createSheet({ name: "A", cols: 2, colWidths: [100, 100] });
    sheet.cells[cellKey(0, 0)] = { value: "KOPBARIS1", bold: true, align: "center", colSpan: 2 };
    sheet.cells[cellKey(2, 0)] = { value: "HEADERNO", bold: true, border: "all" };
    sheet.cells[cellKey(2, 1)] = { value: "HEADERNAMA", bold: true, border: "all" };
    sheet.cells[cellKey(3, 0)] = { value: "{no}" };
    sheet.cells[cellKey(3, 1)] = { value: "{nama}" };
    return { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false, headerRepeat: repeat };
  }

  it("header berulang tidak menambah salinan di halaman 1 (tidak menimpa kop)", async () => {
    const dataset = [{ nama: "A" }, { nama: "B" }];
    const on = pageTextBlocks(await renderToBuffer(<ReportPdfDocument workbook={headerWorkbook(true)} school={school} dataset={dataset} global={{}} />));
    const off = pageTextBlocks(await renderToBuffer(<ReportPdfDocument workbook={headerWorkbook(false)} school={school} dataset={dataset} global={{}} />));
    // Halaman 1 harus identik: salinan header fixed hanya untuk halaman >1.
    expect(on[0]).toBe(off[0]);
  });
});

describe("report-pdf — perataan sel gabungan (kop)", () => {
  it("sel gabungan dengan align center dimulai lebih ke kanan daripada align left", async () => {
    const leftBuf = await renderToBuffer(
      <ReportPdfDocument workbook={kopWorkbook({ value: "PEMERINTAH KABUPATEN", colSpan: 6, align: "left" })} school={school} />
    );
    const centerBuf = await renderToBuffer(
      <ReportPdfDocument workbook={kopWorkbook({ value: "PEMERINTAH KABUPATEN", colSpan: 6, align: "center" })} school={school} />
    );

    const left = textXPositions(leftBuf);
    const center = textXPositions(centerBuf);

    // Baris pertama = teks kop.
    expect(left[0]).toBeCloseTo(0, 0);
    expect(center[0]).toBeGreaterThan(100);
  });

  it("sel gabungan center berada di tengah konten halaman", async () => {
    const buf = await renderToBuffer(
      <ReportPdfDocument workbook={kopWorkbook({ value: "PEMERINTAH KABUPATEN", colSpan: 6, align: "center" })} school={school} />
    );
    const positions = textXPositions(buf);
    // Model lebar kolom absolut: tabel 6 × 96px = 576px = 432pt (tidak lagi
    // dipaksa selebar konten). Sel gabungan center berada di tengah tabel:
    // teks ~95pt → (432 - 95) / 2 ≈ 168pt dari awal konten.
    expect(positions[0]).toBeGreaterThan(120);
    expect(positions[0]).toBeLessThan(230);
  });
});

describe("report-pdf — tabel lebih sempit dari kertas (kop_sek)", () => {
  // Perilaku Excel/LibreOffice: lebar kolom absolut TIDAK diregangkan. Kop 23
  // kolom × 40px (920px = 690pt) pada LEGAL landscape (konten 929pt) tetap
  // 690pt; `align:center` memusatkan pada span sel (tabel), bukan kertas.
  function kopSekWorkbook(): ReportWorkbook {
    const sheet = createSheet({ name: "Kop", cols: 23, colWidths: Array.from({ length: 23 }, () => 40) });
    sheet.cells[cellKey(0, 0)] = {
      value: "PEMERINTAH KABUPATEN INDRAMAYU",
      align: "center",
      vertical: "middle",
      colSpan: 23,
      bold: true,
      fontSize: 14,
    };
    return {
      ...createDefaultWorkbook(),
      paperSize: "LEGAL",
      orientation: "landscape",
      headerRepeat: false,
      showFooter: false,
      sheets: [sheet],
    };
  }

  it("sel center dengan span tepat selebar area cetak berada di tengah kertas", async () => {
    const wb = createDefaultWorkbook();
    const contentPt = 595.28 - wb.margin.left - wb.margin.right;
    const sheet = createSheet({
      name: "Kop",
      cols: 2,
      colWidths: [contentPt / PX_TO_PT / 2, contentPt / PX_TO_PT / 2],
    });
    sheet.cells[cellKey(0, 0)] = { value: "JUDUL TENGAH", align: "center", colSpan: 2, fontSize: 14 };
    const buf = await renderToBuffer(<ReportPdfDocument workbook={{ ...wb, showFooter: false, sheets: [sheet] }} school={school} />);
    const positions = textXPositions(buf);
    expect(positions[0]).toBeGreaterThan(contentPt / 2 - 75);
    expect(positions[0]).toBeLessThan(contentPt / 2 + 75);
  });

  it("sel center dipusatkan pada span sel (bukan diregangkan ke kertas)", async () => {
    const buf = await renderToBuffer(<ReportPdfDocument workbook={kopSekWorkbook()} school={school} />);
    const positions = textXPositions(buf);
    // Tabel tetap 690pt (tidak diregangkan). Teks "PEMERINTAH KABUPATEN
    // INDRAMAYU" (~215pt @14pt) di tengah span 690pt → mulai ≈ (690−215)/2 ≈ 237.
    expect(positions[0]).toBeGreaterThan(180);
    expect(positions[0]).toBeLessThan(300);
  });
});

describe("report-pdf — skala cetak (Scale to fit)", () => {
  it("printScale 50% memperkecil posisi-x teks center", async () => {
    const big = () => {
      const sheet = createSheet({ name: "S", cols: 6, colWidths: Array.from({ length: 6 }, () => 200) });
      sheet.cells[cellKey(0, 0)] = { value: "JUDUL", align: "center", colSpan: 6, fontSize: 14 };
      return { ...createDefaultWorkbook(), showFooter: false, sheets: [sheet] };
    };
    const full = textXPositions(await renderToBuffer(<ReportPdfDocument workbook={big()} school={school} />));
    const half = textXPositions(
      await renderToBuffer(<ReportPdfDocument workbook={{ ...big(), printScale: 0.5 }} school={school} />),
    );
    // Skala 50% memusatkan teks lebih ke kiri (konten menyusut proporsional).
    expect(half[0]).toBeLessThan(full[0]);
    expect(half[0]).toBeGreaterThan(0);
  });
});

describe("report-pdf — potong kolom overflow", () => {
  function wideWorkbook(): ReportWorkbook {
    // 4 kolom × 400px = 1600px = 1200pt, jauh melebihi konten A4 (≈515pt).
    const sheet = createSheet({ name: "Lebar", cols: 4, colWidths: [400, 400, 400, 400] });
    sheet.cells[cellKey(0, 0)] = { value: "KIRI" };
    sheet.cells[cellKey(0, 3)] = { value: "KANANJAUH" };
    return { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false };
  }

  it("teks tidak pernah dirender melewati lebar konten kertas", async () => {
    const buf = await renderToBuffer(<ReportPdfDocument workbook={wideWorkbook()} school={school} />);
    const positions = textXPositions(buf);
    // Konten A4 = 515.28pt. Kolom ke-4 (mulai 1200pt) harus dipotong total,
    // sehingga tak ada teks yang mulai di luar batas konten.
    for (const x of positions) {
      expect(x).toBeLessThan(515.28);
    }
  });
});

/**
 * Posisi {x, y} teks (pt) dari PDF dengan menelusuri CTM (q/Q/cm) secara
 * kumulatif. `textXPositions` lama hanya mengambil translasi terakhir sebelum
 * BT — cukup untuk x teks yang ditata sendiri, tapi semua teks berbagi
 * translasi baris yang sama, sehingga y-nya identik (tak berguna). Parser ini
 * menghitung translasi absolut tiap blok BT sehingga Δy antar baris bermakna
 * (meski sistem koordinat halaman terbalik, |Δy| tetap sama).
 */
function textXYPositions(buf: Buffer): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  const latin = buf.toString("latin1");
  while ((m = re.exec(latin))) {
    let stream: Buffer;
    try {
      stream = zlib.inflateSync(Buffer.from(m[1], "latin1"));
    } catch {
      continue;
    }
    // Matriks affine 2D: [a b 0; c d 0; e f 1].
    let cur = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const stack: typeof cur[] = [];
    for (const rawLine of stream.toString("latin1").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === "q") {
        stack.push({ ...cur });
        continue;
      }
      if (line === "Q") {
        cur = stack.pop() ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        continue;
      }
      const cm = /^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm$/.exec(line);
      if (cm) {
        const [a2, b2, c2, d2, e2, f2] = cm.slice(1).map(Number);
        cur = {
          a: cur.a * a2 + cur.b * c2,
          b: cur.a * b2 + cur.b * d2,
          c: cur.c * a2 + cur.d * c2,
          d: cur.c * b2 + cur.d * d2,
          e: cur.a * e2 + cur.b * f2 + cur.e,
          f: cur.c * e2 + cur.d * f2 + cur.f,
        };
        continue;
      }
      if (line === "BT") {
        positions.push({ x: cur.e, y: cur.f });
      }
    }
  }
  return positions;
}

const near = (actual: number, expected: number, tol = 2) => Math.abs(actual - expected) < tol;

describe("report-pdf — merge vertikal (geometri)", () => {
  // Lembar sebagian: kolom A di-merge A1:A2, kolom B tetap punya B1 & B2.
  // Tinggi baris eksplisit 40pt per baris (rowHeights dalam pt).
  function partialMergeWorkbook(): ReportWorkbook {
    const sheet = createSheet({ name: "Sebagian", cols: 2, rowHeights: { 0: 40, 1: 40, 2: 40 } });
    sheet.cells[cellKey(0, 0)] = { value: "JUDUL", rowSpan: 2 };
    sheet.cells[cellKey(0, 1)] = { value: "KANAN1" };
    sheet.cells[cellKey(1, 1)] = { value: "KANAN2" };
    sheet.cells[cellKey(2, 0)] = { value: "SESUDAH" };
    return { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false };
  }

  it("sel di kolom B tidak bergeser ke kiri oleh sel tertutup", async () => {
    const buf = await renderToBuffer(<ReportPdfDocument workbook={partialMergeWorkbook()} school={school} />);
    const p = textXYPositions(buf);
    // Urutan gambar: JUDUL, KANAN1, KANAN2, SESUDAH.
    expect(p).toHaveLength(4);
    expect(near(p[2].x, p[1].x, 1)).toBe(true); // KANAN2 sejajar KANAN1 (bukan di x≈0)
  });

  it("baris B2 tidak terdorong turun oleh merge — jaraknya tetap 1 tinggi baris", async () => {
    const buf = await renderToBuffer(<ReportPdfDocument workbook={partialMergeWorkbook()} school={school} />);
    const p = textXYPositions(buf);
    // |Δy| KANAN2−KANAN1 = 40pt (1 baris). Sebelumnya anchor minHeight=Σ
    // mendorong baris bawah turun → Δy ≈ 80pt.
    expect(near(Math.abs(p[2].y - p[1].y), 40)).toBe(true);
    // Baris sesudah blok merge tetap di posisinya: 2 baris dari baris 0 → 80pt.
    expect(near(Math.abs(p[3].y - p[1].y), 80)).toBe(true);
  });

  it("merge lebar-penuh tetap seperti semula (regresi)", async () => {
    const sheet = createSheet({ name: "Penuh", cols: 1, rowHeights: { 0: 40, 1: 40, 2: 40 } });
    sheet.cells[cellKey(0, 0)] = { value: "JUDUL", rowSpan: 2 };
    sheet.cells[cellKey(2, 0)] = { value: "SESUDAH" };
    const wb: ReportWorkbook = { ...createDefaultWorkbook(), sheets: [sheet], showFooter: false };
    const buf = await renderToBuffer(<ReportPdfDocument workbook={wb} school={school} />);
    const p = textXYPositions(buf);
    expect(p).toHaveLength(2);
    // SESUDAH di baris ke-3 → 2 × 40pt dari baris pertama, seperti perilaku lama.
    expect(near(Math.abs(p[1].y - p[0].y), 80)).toBe(true);
  });
});
