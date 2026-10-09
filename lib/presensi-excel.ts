/**
 * Generator Excel template-based untuk Daftar Hadir Bulanan (presensi).
 *
 * Cara pakai: template .xlsx (dibuat di Excel asli, mis. oleh admin sekolah)
 * berisi variabel {{...}} di sel mana pun. Fungsi ini:
 *   1. memuat template (exceljs — style sel dipertahankan),
 *   2. mengganti variabel skalar ({{kelas}}, {{bulan}}, dst),
 *   3. menemukan baris contoh berisi variabel baris ({{no}}, {{nama}}, ...),
 *      mereplikasi baris itu sejumlah siswa (style disalin dari baris contoh),
 *      lalu mengisi tiap sel {{tgl_N}} / {{total_h}} / {{persen}} / rumus,
 *   4. mengembalikan workbook siap unduh.
 *
 * Variabel yang dikenali — daftar lengkap & deskripsi ada di kamus:
 *   lib/config/report-variables.ts (halaman admin /admin/kamus-variabel).
 *   Skalar : {{sekolah_nama}} {{sekolah_alamat}} {{sekolah_telepon}}
 *            {{sekolah_npsn}} {{sekolah_email}} {{sekolah_website}}
 *            {{kepala_sekolah_nama}} {{kepala_sekolah_nip}}
 *            {{wali_kelas_nama}} {{wali_kelas_nip}}
 *            {{kelas}} {{kelas_upper}} {{jumlah_siswa}} {{persen_kelas}}
 *            {{bulan}} {{tahun}} {{tahun_ajaran}}
 *            {{hari_efektif}} {{tanggal_cetak}} {{tempat_ttd}}
 *            {{ttd_mulai}} {{ttd_selesai}} (penanda blok TTD — dikosongkan)
 *   Baris  : {{no}} {{nama}} {{nis}} {{nisn}}
 *            {{tgl_1}}..{{tgl_31}} {{total_h}} {{total_s}} {{total_i}}
 *            {{total_a}} {{persen}}
 *   Rumus  : sel berisi teks diawali "=" (mis. =COUNTIF(D5:AH5,"H"))
 *            dipertahankan sebagai formula Excel; referensi baris pada baris
 *            contoh digeser otomatis ke baris data hasil replikasi.
 *
 * Sel berisi variabel tak dikenal dibiarkan apa adanya (tidak error).
 */
import type { DayColumn, MatrixRow } from "./presensi-report";
import { recordedDays, studentPct } from "./presensi-report";
import { applyPagination, applyPrintPageSetup, resolveModuleTemplate, type PrintSettings } from "./print-kit";
import { PRESENSI_KNOWN_VARIABLES } from "./config/report-variables";

// Geometry cetak bersama (kode kertas, fit kolom, margin, centering) ada di
// print-kit — presensi hanya memakai; jangan menambah logika halaman di sini.
export { PAPER_SIZE_CODES } from "./print-kit";

export const PRESENSI_TEMPLATE_PATH = "/templates/daftar-hadir-bulanan-v1.xlsx";
export const PRESENSI_TEMPLATE_VERSION = "v1";
/** Modul template di tabel report_templates. */
export const PRESENSI_TEMPLATE_MODULE = "presensi";

export interface PresensiExcelScalars {
  sekolahNama?: string;
  sekolahAlamat?: string;
  sekolahTelepon?: string;
  sekolahNpsn?: string;
  sekolahEmail?: string;
  sekolahWebsite?: string;
  kepalaSekolahNama?: string;
  kepalaSekolahNip?: string;
  waliKelasNama?: string;
  waliKelasNip?: string;
  kelas: string;
  bulan: string;
  tahun: number;
  tahunAjaran: string;
  hariEfektif: number | string;
  tanggalCetak?: string;
  tempatTtd?: string;
  /** Jumlah siswa pada kelas yang dicetak (opsional; bila kosong, tidak ada variabel jumlah_siswa). */
  jumlahSiswa?: number | string;
  /** Persentase kehadiran kelas (%). */
  persenKelas?: number | string | null;
}

export interface PresensiExcelInput {
  rows: MatrixRow[];
  columns: DayColumn[];
  scalars: PresensiExcelScalars;
  effectiveDays: number;
  /** Ukuran kertas template (A4/F4/LEGAL) → worksheet.pageSetup Excel. */
  paperSize?: string;
  orientation?: string;
  /** Pengaturan cetak modul (margin, ulang kop) — dari pengaturan cetak laporan. */
  printSettings?: PrintSettings;
  /** Jumlah baris siswa yang ikut pindah ke halaman terakhir bersama TTD (0 = otomatis). */
  keepRows?: number;
}

/** Warna font status kehadiran (palet sama dengan tampilan layar). */
export const STATUS_FONT_ARGB: Record<string, string> = {
  H: "FF15803D", // hijau
  S: "FFB45309", // kuning/amber
  I: "FF1D4ED8", // biru
  A: "FFDC2626", // merah
};

/** Blok merah muda untuk kolom hari libur (fill) + font merah angka tanggalnya. */
export const HOLIDAY_FILL_ARGB = "FFFEE2E2";
export const HOLIDAY_FONT_ARGB = "FFDC2626";

/** Variabel skalar yang dikenali → nilai dari input. */
export function scalarMap(input: PresensiExcelInput): Record<string, string> {
  const s = input.scalars;
  return {
    sekolah_nama: s.sekolahNama ?? "",
    sekolah_alamat: s.sekolahAlamat ?? "",
    sekolah_telepon: s.sekolahTelepon ?? "",
    sekolah_npsn: s.sekolahNpsn ?? "",
    sekolah_email: s.sekolahEmail ?? "",
    sekolah_website: s.sekolahWebsite ?? "",
    kepala_sekolah_nama: s.kepalaSekolahNama ?? "",
    kepala_sekolah_nip: s.kepalaSekolahNip ?? "",
    wali_kelas_nama: s.waliKelasNama ?? "",
    wali_kelas_nip: s.waliKelasNip ?? "",
    kelas: s.kelas,
    // Huruf besar penuh — untuk judul raksaka ("DAFTAR HADIR MURID {{kelas_upper}}").
    kelas_upper: s.kelas ? s.kelas.toLocaleUpperCase("id") : "",
    jumlah_siswa: s.jumlahSiswa === undefined ? "" : String(s.jumlahSiswa),
    persen_kelas: s.persenKelas === undefined || s.persenKelas === null ? "" : String(s.persenKelas),
    bulan: s.bulan,
    tahun: String(s.tahun),
    tahun_ajaran: s.tahunAjaran,
    hari_efektif: String(s.hariEfektif),
    tanggal_cetak: s.tanggalCetak ?? "",
    tempat_ttd: s.tempatTtd ?? "",
  };
}

/** Nilai sel baris untuk satu siswa (indeks 1-based). */
export function rowValues(
  row: MatrixRow,
  index: number,
  columns: DayColumn[],
  effectiveDays: number
): Record<string, string | number> {
  const pct = studentPct(row, effectiveDays);
  const vals: Record<string, string | number> = {
    no: index,
    nama: row.studentName,
    nis: row.nis || "",
    nisn: row.nisn || "",
    total_h: row.totalHadir,
    total_s: row.totalSakit,
    total_i: row.totalIzin,
    total_a: row.totalAlpha,
    persen: pct === null ? "" : pct,
  };
  for (const c of columns) {
    vals[`tgl_${c.day}`] = c.effective ? row.dailyStatus[c.day] || "-" : "";
  }
  return vals;
}

/** true bila sel berisi variabel baris {{...}} (penanda baris contoh). */
export function isRowVariable(text: string): boolean {
  return /\{\{(no|nama|nis|nisn|tgl_\d+|total_[hsia]|persen)\}\}/.test(text);
}

/**
 * Ganti semua {{variabel}} pada teks dengan nilai map.
 * Variabel tak dikenal dibiarkan apa adanya.
 */
export function substitute(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key: string) =>
    key in values ? String(values[key]) : m
  );
}

/**
 * Geser referensi baris pada formula Excel sejauh `delta` baris.
 * Hanya menggeser referensi ke baris template (`templateRow`):
 * =COUNTIF(D5:AH5,"H") dengan templateRow=5, delta=3 → =COUNTIF(D8:AH8,"H").
 * Referensi absolut ($5) dan baris lain tidak disentuh.
 */
export function shiftFormulaRows(formula: string, templateRow: number, delta: number): string {
  if (delta === 0) return formula;
  const target = String(templateRow);
  // Cocokkan $Col? (opsional) + nomor baris — bukan bagian dari angka lebih panjang.
  return formula.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (m, col: string, abs: string, num: string) => {
    if (abs === "$") return m;
    if (num !== target) return m;
    // Hindari pola seperti A1B2 (referensi sudah dikonsumsi dari kiri; cukup cek digit lanjutan)
    return `${col}${Number(num) + delta}`;
  });
}

/**
 * Terapkan injeksi pada worksheet exceljs asli (dipanggil dari komponen).
 * Mengembalikan { rowCount, unknown } untuk toast hasil.
 *
 * Catatan exceljs: duplicateRow menyalin style tetapi TIDAK menggeser
 * formula (terbukti via probe) — jadi formula baris contoh digeser manual
 * lewat shiftFormulaRows agar rentangnya mengikuti baris data aktual.
 * Sama halnya merge cells juga tidak ikut bergeser — digesir terpisah di
 * langkah 3b agar blok signature tidak menimpa baris data siswa.
 */
export async function fillPresensiWorksheet(
  ws: {
    rowCount: number;
    columnCount?: number;
    getRow(n: number): {
      getCell(c: number): { value: unknown; formula?: string; font?: unknown; fill?: unknown; style?: unknown };
      eachCell(o: { includeEmpty?: boolean }, cb: (cell: { value: unknown; font?: unknown; fill?: unknown; style?: unknown }, col: number) => void): void;
    };
    eachRow(cb: (row: { getCell(c: number): { value: unknown; font?: unknown; fill?: unknown; style?: unknown } }, n: number) => void): void;
    duplicateRow(n: number, count: number, insert: boolean): void;
  },
  input: PresensiExcelInput
): Promise<{ rowCount: number; unknown: string[] }> {
  const scalars = scalarMap(input);
  const unknown = new Set<string>();

  // Extent kolom NYATA template, di-capture sebelum loop mana pun berjalan.
  // row.getCell(c) pada kolom kosong MEMBUAT sel baru — memakai batas tetap
  // 64 membuat sel hantu 40..64 sehingga columnCount meledak 39→64 dan
  // renderer cetak menghitung naturalW ~2× lebih lebar → skala fit-to-page
  // runtuh (0.43) → konten mengecil hanya di pojok kiri atas lembar.
  const maxCol = Math.min(ws.columnCount || 64, 64);

  // 0. Marker blok TTD dicatat dulu (sebelum substitusi), lalu dikosongkan
  //    agar tidak tampil di hasil cetak.
  const ttdRows = ttdMarkerRows(ws, maxCol);
  if (ttdRows) {
    ws.eachRow((row) => {
      for (let c = 1; c <= maxCol; c++) {
        const cell = row.getCell(c);
        if (typeof cell.value === "string" && cell.value.includes("{{ttd_")) {
          cell.value = cell.value.replace(/\{\{ttd_(mulai|selesai)\}\}/g, "");
        }
      }
    });
  }

  // 1. Skalar di seluruh sheet.
  ws.eachRow((row) => {
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      if (typeof cell.value === "string" && cell.value.includes("{{")) {
        const before = cell.value;
        cell.value = substitute(before, scalars);
        for (const v of unknownVariables([before])) unknown.add(v);
      }
    }
  });

  // 2. Cari baris contoh (variabel baris); tanpa itu, data tak bisa diisi.
  let templateRow: number | null = null;
  ws.eachRow((row, n) => {
    if (templateRow !== null) return;
    for (let c = 1; c <= maxCol; c++) {
      const v = row.getCell(c).value;
      if (typeof v === "string" && isRowVariable(v)) {
        templateRow = n;
        break;
      }
    }
  });
  if (templateRow === null) {
    return { rowCount: 0, unknown: [...unknown].sort() };
  }

  const tplRowNum: number = templateRow;

  // Potret baris contoh SEBELUM replikasi: nilai sel + formula per kolom.
  // (duplicateRow exceljs menyalin sel ke baris baru; membaca ulang tpl
  //  setelahnya berisiko mendapat sel hasil duplikat pada fake/worksheet.)
  const tplSnapshot = new Map<number, unknown>();
  const tplRow0 = ws.getRow(tplRowNum);
  tplRow0.eachCell({ includeEmpty: true }, (cell, c) => {
    tplSnapshot.set(c, cell.value);
  });

  // 3a. Lepaskan merge di bawah baris contoh SEBELUM replikasi.
  //     duplicateRow menyalin sel + style TETAPI tidak menggeser merge cells
  //     (terbukti via probe) — blok signature di bawah baris contoh (mis.
  //     B10:C10) harus ikut turun, kalau tidak menimpa baris data siswa
  //     ke-4 dst. (Nama + tanggal akhir + kolom rekap tersembunyi di Excel).
  //     unMergeCells exceljs berbasis tipe cell sehingga rapuh setelah baris
  //     digeser — karena itu dilepas dulu (3a), baru dipasang kembali
  //     tergeser setelah replikasi (3c). Merge header (di atas/tepat baris
  //     contoh) tak tersentuh. Method opsional: worksheet fake pada test
  //     lama di-skip dengan aman.
  const delta = input.rows.length - 1;
  const wsMerge = ws as {
    model?: { merges?: readonly string[] };
    unMergeCells?: (range: string) => void;
    mergeCells?: (range: string) => void;
  };
  const belowTemplate = delta > 0
    ? (wsMerge.model?.merges ?? [])
        .map((ref) => ({ ref, m: /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref) }))
        .filter((x): x is { ref: string; m: RegExpExecArray } =>
          !!x.m && Number(x.m[2]) > tplRowNum)
    : [];
  for (const { ref } of belowTemplate) wsMerge.unMergeCells?.(ref);

  // 3b. Replikasi baris contoh sejumlah siswa (style ikut tersalin).
  if (input.rows.length > 1) {
    ws.duplicateRow(tplRowNum, input.rows.length - 1, true);
  }

  // 3c. Pasang kembali merge pada posisi tergeser sejauh jumlah siswa − 1.
  for (const { m } of belowTemplate) {
    wsMerge.mergeCells?.(`${m[1]}${Number(m[2]) + delta}:${m[3]}${Number(m[4]) + delta}`);
  }

  // 4. Isi tiap baris data; formula digeser ke baris aktual.
  const tplFormulas = new Map<number, string>();
  for (const [c, v] of tplSnapshot) {
    if (v && typeof v === "object" && typeof (v as { formula?: string }).formula === "string") {
      tplFormulas.set(c, (v as { formula: string }).formula);
    } else if (typeof v === "string" && v.startsWith("=")) {
      tplFormulas.set(c, v.slice(1));
    }
  }

  // Kolom tanggal (berisi {{tgl_N}}) → alamat kolom untuk baris Jumlah.
  // Rekaman kolom efektif saja; hari libur dibiarkan kosong.
  const dateCols: { col: number; letter: string; day: number; effective: boolean }[] = [];
  for (const [c, v] of tplSnapshot) {
    if (typeof v === "string") {
      const m = /\{\{tgl_(\d+)\}\}/.exec(v);
      if (m) {
        const day = Number(m[1]);
        dateCols.push({
          col: c,
          letter: colLetter(c),
          day,
          effective: input.columns.some((dc) => dc.day === day && dc.effective),
        });
      }
    }
  }
  const dayByCol = new Map(dateCols.map((d) => [d.col, d.day]));
  const holidayCols = new Set(dateCols.filter((d) => !d.effective).map((d) => d.col));
  const solidFill = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

  // Copy-on-write style: pada template dengan row-level style (customFormat),
  // exceljs MENSHARE satu object style untuk semua sel dalam satu baris —
  // menulis cell.font/fill langsung menular ke seluruh baris (terbukti via
  // probe: D13.style === I13.style). Karena itu selalu assign style BARU
  // (spread) agar warna hanya mengenai sel yang dituju.
  const patchCellStyle = (
    cell: { style?: unknown; font?: unknown },
    patch: { font?: Record<string, unknown>; fill?: Record<string, unknown> }
  ) => {
    const next: Record<string, unknown> = { ...((cell.style || {}) as Record<string, unknown>) };
    if (patch.font) {
      next.font = { ...((cell.font || next.font || {}) as Record<string, unknown>), ...patch.font };
    }
    if (patch.fill) next.fill = patch.fill;
    cell.style = next;
  };

  // Blok merah hari libur pada baris header tanggal (angka 1..31 di atas
  // baris contoh): font merah tebal + fill merah muda.
  if (holidayCols.size > 0) {
    ws.eachRow((row, n) => {
      if (n >= tplRowNum) return;
      for (const col of holidayCols) {
        const cell = row.getCell(col);
        const v = cell.value;
        if (typeof v === "number" && v === dayByCol.get(col)) {
          patchCellStyle(cell, {
            font: { color: { argb: HOLIDAY_FONT_ARGB }, bold: true },
            fill: solidFill(HOLIDAY_FILL_ARGB),
          });
        }
      }
    });
  }

  input.rows.forEach((r, i) => {
    const n = tplRowNum + i;
    const vals = rowValues(r, i + 1, input.columns, input.effectiveDays);
    const dest = ws.getRow(n);
    for (let c = 1; c <= maxCol; c++) {
      const cell = dest.getCell(c);
      const f = tplFormulas.get(c);
      if (f !== undefined) {
        cell.value = { formula: shiftFormulaRows(f, tplRowNum, i) } as never;
        continue;
      }
      if (typeof cell.value === "string" && cell.value.includes("{{")) {
        const before = cell.value;
        cell.value = substitute(before, vals);
        for (const v of unknownVariables([before])) unknown.add(v);
      }
      // Patch style sekali per sel: blok merah libur + warna status
      // (H hijau, S kuning, I biru, A merah) — copy-on-write, tanpa menular.
      const patch: { font?: Record<string, unknown>; fill?: Record<string, unknown> } = {};
      if (holidayCols.has(c)) {
        patch.fill = solidFill(HOLIDAY_FILL_ARGB);
      }
      const day = dayByCol.get(c);
      if (day !== undefined) {
        const argb = STATUS_FONT_ARGB[String(vals[`tgl_${day}`] ?? "")];
        if (argb) patch.font = { color: { argb } };
      }
      if (patch.fill || patch.font) patchCellStyle(cell, patch);
    }
  });

  // 5. Baris "Jumlah" tepat di bawah blok data: jumlah H per tanggal efektif
  //    + total H/S/I/A + % kelas — semua sebagai formula hidup.
  const firstData = tplRowNum;
  const lastData = tplRowNum + input.rows.length - 1;
  const jumlahRow = ws.getRow(lastData + 1);
  const sumLetter = (col: number) => colLetter(col);
  try {
    ws.getRow(tplRowNum); // pastikan baris ada
    // Label pada kolom nama (kolom {{nama}} bila ketemu, fallback kolom 3).
    // Baris ini adalah HASIL duplicateRow dari baris contoh bila menimpa area
    // jumlah/TTD template — jadi timpa paksa: label + kosongkan sisa sel,
    // lalu tulis ulang formula.
    let nameCol = 3;
    for (const [c, v] of tplSnapshot) {
      if (typeof v === "string" && v.includes("{{nama}}")) nameCol = c;
    }
    // Label: pertahankan "Jumlah" bawaan template bila ada — penting karena
    // template bisa meletakkannya di ANCHOR merge (mis. A14:C14) sehingga
    // menimpa sel lain (atau mengosongkan anchor) membuat label hilang
    // saat dibuka di Excel (hanya nilai anchor yang tampil).
    let labelPlaced = false;
    for (let c = 1; c <= maxCol; c++) {
      if (c === nameCol) continue;
      const cur = jumlahRow.getCell(c).value;
      if (typeof cur === "string" && cur.trim().toLowerCase() === "jumlah") {
        labelPlaced = true;
        continue;
      }
      jumlahRow.getCell(c).value = null;
    }
    if (!labelPlaced) jumlahRow.getCell(nameCol).value = "Jumlah";
    for (const dc of dateCols) {
      if (!dc.effective) continue;
      // result diisi agar cell punya nilai saat dirender ke HTML/PDF;
      // Excel tetap menghitung ulang formula saat file dibuka.
      const hadirCount = input.rows.filter((r) => r.dailyStatus[dc.day] === "H").length;
      jumlahRow.getCell(dc.col).value = {
        formula: `COUNTIF(${dc.letter}${firstData}:${dc.letter}${lastData},"H")`,
        result: hadirCount,
      } as never;
    }
    // Total H/S/I/A: kolom yang memuat {{total_h}} dst pada baris contoh.
    const totalVars: Record<string, string> = {};
    for (const [c, v] of tplSnapshot) {
      if (typeof v === "string") {
        for (const key of ["total_h", "total_s", "total_i", "total_a"]) {
          if (v.includes(`{{${key}}}`)) totalVars[key] = sumLetter(c);
        }
      }
    }
    const totalPick: Record<string, (r: MatrixRow) => number> = {
      total_h: (r) => r.totalHadir,
      total_s: (r) => r.totalSakit,
      total_i: (r) => r.totalIzin,
      total_a: (r) => r.totalAlpha,
    };
    for (const key of Object.keys(totalVars)) {
      const L = totalVars[key];
      const sum = input.rows.reduce((n, r) => n + totalPick[key](r), 0);
      jumlahRow.getCell(colNumber(L)).value = {
        formula: `SUM(${L}${firstData}:${L}${lastData})`,
        result: sum,
      } as never;
    }
  } catch {
    // Template tanpa ruang baris Jumlah — lewati tanpa menggagalkan unduhan.
  }

  // 5b. Pagination: blok TTD ({{ttd_mulai}}..{{ttd_selesai}}) tidak boleh
  //     terpotong; keepRows baris siswa terakhir ikut pindah ke halaman TTD.
  if (ttdRows) {
    applyPagination(ws as never, {
      paperSize: input.paperSize,
      orientation: input.orientation,
      settings: input.printSettings,
      dataStartRow: firstData,
      dataEndRow: lastData,
      keepRows: input.keepRows ?? 0,
      signatureStartRow: ttdRows.start,
      signatureEndRow: ttdRows.end,
    });
  }

  // 6. Terapkan ukuran kertas/orientasi template ke pageSetup Excel via
  //    print-kit (A4=9, F4→Folio=14, LEGAL=5; fit kolom, margin 10mm,
  //    horizontalCentered) agar hasil cetak Excel & LibreOffice identik
  //    dengan jalur HTML.
  applyPrintPageSetup(ws as never, {
    paperSize: input.paperSize,
    orientation: input.orientation,
  });

  return { rowCount: input.rows.length, unknown: [...unknown].sort() };
}

/** Baris marker {{ttd_mulai}} dan {{ttd_selesai}} di template (null bila tak ada). */
function ttdMarkerRows(
  ws: { eachRow(cb: (row: { getCell(c: number): { value: unknown } }, n: number) => void): void },
  maxCol: number
): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;
  ws.eachRow((row, n) => {
    for (let c = 1; c <= maxCol; c++) {
      const v = row.getCell(c).value;
      if (typeof v !== "string") continue;
      if (v.includes("{{ttd_mulai}}") && start === null) start = n;
      if (v.includes("{{ttd_selesai}}")) end = n;
    }
  });
  return start !== null && end !== null ? { start, end } : null;
}

/** 1-based nomor kolom → huruf Excel (1=A, 28=AB). */
export function colLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colNumber(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function excelFilename(className: string, month: number, year: number): string {
  const slug =
    className
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "kelas";
  return `daftar-hadir-${slug}-${year}-${String(month).padStart(2, "0")}.xlsx`;
}

/**
 * URL template Excel modul presensi — pembungkus tipis atas
 * resolveModuleTemplate(print-kit) dengan fallback bawaan
 * PRESENSI_TEMPLATE_PATH. Lihat print-kit untuk logika normalisasi.
 */
export async function resolvePresensiTemplateUrl(
  fetchFn: typeof fetch = fetch,
  apiBase = ""
): Promise<{ url: string; fromDefault: boolean; paperSize?: string; orientation?: string }> {
  return resolveModuleTemplate(PRESENSI_TEMPLATE_MODULE, {
    fetchFn,
    apiBase,
    fallbackUrl: PRESENSI_TEMPLATE_PATH,
  });
}

/** Ringkasan untuk toast sukses: jumlah baris + variabel tak dikenal (bila ada). */
export function unknownVariables(texts: string[]): string[] {
  const known = new Set(PRESENSI_KNOWN_VARIABLES);
  const found = new Set<string>();
  for (const t of texts) {
    if (typeof t !== "string") continue;
    for (const m of t.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)) {
      if (!known.has(m[1])) found.add(m[1]);
    }
  }
  return [...found].sort();
}

export { recordedDays };
