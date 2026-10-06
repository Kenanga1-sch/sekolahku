/**
 * Helper murni untuk laporan presensi bulanan (daftar hadir siswa).
 * Semua fungsi di sini tanpa dependensi DOM supaya bisa diuji vitest.
 */

export type DayCode = "H" | "S" | "I" | "A" | "-";

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  reason: string;
}

export interface DayColumn {
  day: number; // 1..31
  date: string; // YYYY-MM-DD
  dow: number; // 0=Minggu .. 6=Sabtu
  letter: string; // huruf hari (M, S, S, R, K, J, S)
  sunday: boolean;
  holiday: boolean;
  reason?: string;
  effective: boolean;
}

export interface MatrixRow {
  studentId: string;
  studentName: string;
  nis: string;
  nisn?: string;
  className?: string;
  dailyStatus: Record<number, DayCode>;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
}

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

export const STATUS_LABELS_ID: Record<string, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpha",
};

/** "Mei" → singkatan "Mei"; "September" → "Sep". Dipakai baris hari di kop tabel. */
const MONTH_ABBR: Record<string, string> = {
  Januari: "Jan", Februari: "Feb", Maret: "Mar", April: "Apr",
  Mei: "Mei", Juni: "Jun", Juli: "Jul", Agustus: "Agu",
  September: "Sep", Oktober: "Okt", November: "Nov", Desember: "Des",
};

/**
 * Tahun pelajaran untuk bulan terpilih.
 * Juli–Desember → tahun/berikutnya; Januari–Juni → sebelumnya/tahun.
 * Nilai config (env CURRENT_ACADEMIC_YEAR) dipakai hanya bila bulan terpilih
 * memang jatuh di dalamnya, agar tetap benar saat tahun ajaran berganti.
 */
export function academicYearFor(month: number, year: number, configured?: string | null): string {
  const computed = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  if (configured) {
    const m = /^(\d{4})\/(\d{4})$/.exec(configured.trim());
    if (m) {
      const startYear = Number(m[1]);
      const endYear = Number(m[2]);
      const inRange =
        month >= 7
          ? year === startYear
          : year === endYear;
      if (inRange) return configured.trim();
    }
  }
  return computed;
}

/** Kumpulkan daftar tanggal libur (Minggu + libur sekolah/nasional) di rentang. */
export function buildHolidayMap(holidays?: HolidayInfo[] | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of holidays || []) map.set(h.date, h.reason);
  return map;
}

/**
 * Kolom tanggal untuk satu bulan.
 * Efektif = bukan Minggu dan bukan hari libur.
 */
export function buildDayColumns(year: number, month: number, holidays?: HolidayInfo[] | null): DayColumn[] {
  const hmap = buildHolidayMap(holidays);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cols: DayColumn[] = [];
  for (let day = 1; day <= total; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const sunday = dow === 0;
    const reason = hmap.get(date);
    const holiday = reason !== undefined;
    cols.push({
      day,
      date,
      dow,
      letter: dowLetter(dow),
      sunday,
      holiday,
      reason,
      effective: !sunday && !holiday,
    });
  }
  return cols;
}

/** Huruf hari untuk baris "Hari" pada daftar hadir: M S S R K J S. */
export function dowLetter(dow: number): string {
  return ["M", "S", "S", "R", "K", "J", "S"][dow] || "";
}

/**
 * Jumlah hari efektif.
 * Utama: angka dari API (hasil hitung backend, mencakup libur sekolah+nasional).
 * Cadangan: jumlah kolom efektif; terakhir, hari Senin–Sabtu.
 */
export function resolveEffectiveDays(apiValue: number | undefined | null, columns: DayColumn[]): number {
  if (typeof apiValue === "number" && apiValue > 0) return apiValue;
  const fromCols = columns.filter((c) => c.effective).length;
  if (fromCols > 0) return fromCols;
  return columns.filter((c) => c.dow !== 0).length;
}

/** Hari yang benar-benar tercatat untuk siswa (H+S+I+A). */
export function recordedDays(row: Pick<MatrixRow, "totalHadir" | "totalSakit" | "totalIzin" | "totalAlpha">): number {
  return row.totalHadir + row.totalSakit + row.totalIzin + row.totalAlpha;
}

/**
 * Kehadiran siswa: hadir ÷ hari efektif, dibulatkan 1 desimal, maks 100.
 * null bila tidak ada hari efektif atau siswa belum punya catatan sama sekali
 * (tampil "–", bukan 0% yang menyesatkan).
 */
export function studentPct(row: MatrixRow, effectiveDays: number): number | null {
  if (effectiveDays <= 0) return null;
  if (recordedDays(row) === 0) return null;
  const pct = Math.round((row.totalHadir / effectiveDays) * 1000) / 10;
  return Math.min(pct, 100);
}

/** Kehadiran kelas: Σhadir ÷ (jumlah siswa × hari efektif), maks 100. */
export function classPct(rows: MatrixRow[], effectiveDays: number): number | null {
  const denom = rows.length * effectiveDays;
  if (denom <= 0) return null;
  const hadir = rows.reduce((sum, r) => sum + r.totalHadir, 0);
  return Math.min(Math.round((hadir / denom) * 1000) / 10, 100);
}

export function isBelowThreshold(row: MatrixRow, effectiveDays: number, threshold = 75): boolean {
  const pct = studentPct(row, effectiveDays);
  return pct !== null && pct < threshold;
}

export type SortKey = "name" | "hadir" | "pct" | "alpha";
export type SortDir = "asc" | "desc";

export function filterMatrix(rows: MatrixRow[], query: string): MatrixRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    r.studentName.toLowerCase().includes(q) ||
    (r.nis || "").toLowerCase().includes(q) ||
    (r.nisn || "").toLowerCase().includes(q)
  );
}

export function sortMatrix(rows: MatrixRow[], key: SortKey, dir: SortDir, effectiveDays: number): MatrixRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (key) {
      case "hadir":
        return sign * (a.totalHadir - b.totalHadir || a.studentName.localeCompare(b.studentName));
      case "alpha":
        return sign * (a.totalAlpha - b.totalAlpha || a.studentName.localeCompare(b.studentName));
      case "pct": {
        // efektif sama untuk semua siswa → % sebanding langsung dengan hadir
        const d = (studentPct(a, effectiveDays) ?? -1) - (studentPct(b, effectiveDays) ?? -1);
        return sign * (d || a.studentName.localeCompare(b.studentName));
      }
      default:
        return sign * a.studentName.localeCompare(b.studentName);
    }
  });
  return copy;
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export interface MonthlyCsvInput {
  rows: MatrixRow[];
  columns: DayColumn[];
  className: string;
  monthName: string;
  year: number;
  effectiveDays: number;
}

/**
 * CSV daftar hadir bulanan: BOM UTF-8 (aman untuk Excel), satu baris header,
 * kolom per tanggal (kode H/S/I/A, kosong untuk hari libur), lalu rekap.
 */
export function buildMonthlyCsv(input: MonthlyCsvInput): string {
  const { rows, columns, className, monthName, year, effectiveDays } = input;
  const header = [
    "No", "NIS", "NISN", "Nama", "Kelas",
    ...columns.map((c) => c.date),
    "H", "S", "I", "A", "Hari", "Kehadiran(%)",
  ];

  const body = rows.map((r, idx) => {
    const pct = studentPct(r, effectiveDays);
    const cells = [
      String(idx + 1),
      csvEscape(r.nis || ""),
      csvEscape(r.nisn || ""),
      csvEscape(r.studentName),
      csvEscape(r.className || className),
      ...columns.map((c) => (c.effective ? r.dailyStatus[c.day] || "-" : "")),
      String(r.totalHadir),
      String(r.totalSakit),
      String(r.totalIzin),
      String(r.totalAlpha),
      String(recordedDays(r)),
      pct === null ? "" : String(pct),
    ];
    return cells.join(",");
  });

  // Baris rekap: jumlah hadir per tanggal (hari efektif), total H/S/I/A, dan % kelas
  const rekapHadir = columns.map((c) =>
    c.effective ? String(rows.filter((r) => r.dailyStatus[c.day] === "H").length) : ""
  );
  const sum = (pick: (r: MatrixRow) => number) => String(rows.reduce((n, r) => n + pick(r), 0));
  const kelasPct = classPct(rows, effectiveDays);
  const rekap = [
    "Jumlah",
    "",
    "",
    `${rows.length} siswa`,
    csvEscape(className),
    ...rekapHadir,
    sum((r) => r.totalHadir),
    sum((r) => r.totalSakit),
    sum((r) => r.totalIzin),
    sum((r) => r.totalAlpha),
    String(rows.reduce((n, r) => n + recordedDays(r), 0)),
    kelasPct === null ? "" : String(kelasPct),
  ].join(",");

  const title = [
    csvEscape(`Daftar Hadir Siswa - ${className} - ${monthName} ${year}`),
    csvEscape(`Hari efektif: ${effectiveDays}`),
    "",
  ];

  return "\uFEFF" + [...title, header.join(","), ...body, rekap].join("\r\n") + "\r\n";
}

export function csvFilename(className: string, month: number, year: number): string {
  const slug = className.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "kelas";
  return `daftar-hadir-${slug}-${year}-${String(month).padStart(2, "0")}.csv`;
}
