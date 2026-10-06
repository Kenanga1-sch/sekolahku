import { describe, it, expect } from "vitest";
import {
  academicYearFor,
  buildDayColumns,
  resolveEffectiveDays,
  recordedDays,
  studentPct,
  classPct,
  isBelowThreshold,
  filterMatrix,
  sortMatrix,
  csvEscape,
  buildMonthlyCsv,
  csvFilename,
  dowLetter,
  type MatrixRow,
} from "./presensi-report";

function makeRow(over: Partial<MatrixRow> = {}): MatrixRow {
  return {
    studentId: over.studentId || "s1",
    studentName: over.studentName || "Aisyah Putri",
    nis: over.nis || "001234",
    nisn: over.nisn || "0098765",
    dailyStatus: over.dailyStatus || {},
    totalHadir: over.totalHadir ?? 0,
    totalSakit: over.totalSakit ?? 0,
    totalIzin: over.totalIzin ?? 0,
    totalAlpha: over.totalAlpha ?? 0,
    ...over,
  };
}

/** Split satu baris CSV yang memperhitungkan tanda kutip (nama boleh berisi koma). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

describe("presensi-report", () => {
  describe("academicYearFor", () => {
    it("Juli-Desember memakai tahun berjalan/berikutnya", () => {
      expect(academicYearFor(7, 2025)).toBe("2025/2026");
      expect(academicYearFor(12, 2025)).toBe("2025/2026");
    });

    it("Januari-Juni memakai tahun sebelumnya/berjalan", () => {
      expect(academicYearFor(1, 2026)).toBe("2025/2026");
      expect(academicYearFor(6, 2026)).toBe("2025/2026");
    });

    it("memakai config bila bulan terpilih berada di dalamnya", () => {
      expect(academicYearFor(9, 2025, "2025/2026")).toBe("2025/2026");
      expect(academicYearFor(2, 2026, "2025/2026")).toBe("2025/2026");
    });

    it("mengabaikan config yang sudah kedaluwarsa (mis. tahun ajaran berganti)", () => {
      expect(academicYearFor(9, 2026, "2025/2026")).toBe("2026/2027");
      expect(academicYearFor(3, 2025, "2025/2026")).toBe("2024/2025");
    });

    it("mengabaikan config yang formatnya tidak valid", () => {
      expect(academicYearFor(7, 2025, "tahun-ajaran-ini")).toBe("2025/2026");
      expect(academicYearFor(1, 2026, "")).toBe("2025/2026");
    });
  });

  describe("buildDayColumns", () => {
    it("Februari tahun kabisat punya 29 kolom", () => {
      expect(buildDayColumns(2024, 2, []).length).toBe(29);
      expect(buildDayColumns(2025, 2, []).length).toBe(28);
      expect(buildDayColumns(2025, 12, []).length).toBe(31);
    });

    it("menandai Minggu sebagai libur dengan alasan", () => {
      const cols = buildDayColumns(2025, 10, [{ date: "2025-10-05", reason: "Hari Minggu" }]);
      const sun = cols.find((c) => c.day === 5)!;
      expect(sun.sunday).toBe(true);
      expect(sun.holiday).toBe(true);
      expect(sun.effective).toBe(false);
      expect(sun.reason).toBe("Hari Minggu");
    });

    it("menandai libur nasional/sekolah dan menghitung hari efektif", () => {
      // Oktober 2025: 31 hari, 4 Minggu (5,12,19,26) + 1 libur nasional (17)
      const cols = buildDayColumns(2025, 10, [
        { date: "2025-10-17", reason: "Hari Kemerdekaan ke-80" },
      ]);
      const effective = cols.filter((c) => c.effective).length;
      expect(cols.length).toBe(31);
      expect(effective).toBe(31 - 4 - 1);

      const aug17 = cols.find((c) => c.day === 17)!;
      expect(aug17.holiday).toBe(true);
      expect(aug17.effective).toBe(false);
      expect(aug17.sunday).toBe(false);
    });

    it("tanggal dan huruf hari konsisten", () => {
      // 1 Oktober 2025 = Rabu
      const cols = buildDayColumns(2025, 10, []);
      expect(cols[0].date).toBe("2025-10-01");
      expect(cols[0].dow).toBe(3);
      expect(cols[0].letter).toBe("R");
      expect(dowLetter(0)).toBe("M"); // Minggu
      expect(dowLetter(5)).toBe("J"); // Jumat
      expect(dowLetter(6)).toBe("S"); // Sabtu
    });
  });

  describe("resolveEffectiveDays", () => {
    const cols = buildDayColumns(2025, 10, [{ date: "2025-10-17", reason: "Hari Kemerdekaan ke-80" }]);

    it("lebih memilih angka dari API", () => {
      expect(resolveEffectiveDays(26, cols)).toBe(26);
      expect(resolveEffectiveDays(0, cols)).toBe(cols.filter((c) => c.effective).length);
      expect(resolveEffectiveDays(undefined, cols)).toBe(cols.filter((c) => c.effective).length);
    });

    it("fallback terakhir menghitung hari Senin-Sabtu", () => {
      const empty = [] as never[];
      expect(resolveEffectiveDays(undefined, empty)).toBe(0);
    });
  });

  describe("studentPct / classPct", () => {
    it("hadir dibagi hari efektif, dibulatkan 1 desimal", () => {
      const row = makeRow({ totalHadir: 20, totalSakit: 2, totalAlpha: 1 });
      expect(studentPct(row, 24)).toBe(83.3);
      expect(recordedDays(row)).toBe(23);
    });

    it("dibatasi 100% meski catatan melebihi hari efektif", () => {
      expect(studentPct(makeRow({ totalHadir: 30 }), 24)).toBe(100);
    });

    it("null bila siswa belum punya catatan (tampil –, bukan 0%)", () => {
      expect(studentPct(makeRow(), 24)).toBeNull();
      expect(studentPct(makeRow({ totalHadir: 5 }), 0)).toBeNull();
    });

    it("persentase kelas memakai rumus siswa × hari efektif", () => {
      const rows = [
        makeRow({ studentId: "a", totalHadir: 24 }),
        makeRow({ studentId: "b", totalHadir: 12 }),
      ];
      expect(classPct(rows, 24)).toBe(75);
      expect(classPct([], 24)).toBeNull();
    });

    it("menandai siswa dengan kehadiran < 75%", () => {
      expect(isBelowThreshold(makeRow({ totalHadir: 17, totalSakit: 3, totalAlpha: 2 }), 24)).toBe(true);
      expect(isBelowThreshold(makeRow({ totalHadir: 22, totalSakit: 1 }), 24)).toBe(false);
      expect(isBelowThreshold(makeRow(), 24)).toBe(false); // belum ada data → tidak ditandai
    });
  });

  describe("filterMatrix / sortMatrix", () => {
    const rows = [
      makeRow({ studentId: "1", studentName: "Budi Santoso", nis: "1001" }),
      makeRow({ studentId: "2", studentName: "Aisyah Putri", nis: "1002" }),
      makeRow({ studentId: "3", studentName: "Citra Dewi", nis: "1003", totalHadir: 20, totalAlpha: 3 }),
    ];

    it("filter berdasarkan nama atau NIS", () => {
      expect(filterMatrix(rows, "aisyah").length).toBe(1);
      expect(filterMatrix(rows, "1001").length).toBe(1);
      expect(filterMatrix(rows, "  ").length).toBe(3);
      expect(filterMatrix(rows, "tidak-ada").length).toBe(0);
    });

    it("urut nama asc/desc", () => {
      expect(sortMatrix(rows, "name", "asc", 24).map((r) => r.studentName)[0]).toBe("Aisyah Putri");
      expect(sortMatrix(rows, "name", "desc", 24).map((r) => r.studentName)[0]).toBe("Citra Dewi");
    });

    it("urut kehadiran & alpha", () => {
      expect(sortMatrix(rows, "hadir", "desc", 24)[0].studentId).toBe("3");
      expect(sortMatrix(rows, "pct", "desc", 24)[0].studentId).toBe("3");
      expect(sortMatrix(rows, "pct", "asc", 24)[0].studentId).toBe("2"); // 0% → nama terkecil duluan
      expect(sortMatrix(rows, "alpha", "desc", 24)[0].studentId).toBe("3");
    });

    it("input tidak dimutasi", () => {
      const before = rows.map((r) => r.studentName);
      sortMatrix(rows, "name", "desc", 24);
      expect(rows.map((r) => r.studentName)).toEqual(before);
    });
  });

  describe("buildMonthlyCsv", () => {
    const columns = buildDayColumns(2025, 10, [{ date: "2025-10-17", reason: "Hari Kemerdekaan ke-80" }]);
    const rows = [
      makeRow({
        studentName: 'Dewi, "Sari"',
        dailyStatus: { 1: "H", 2: "S", 3: "-", 17: "H" },
        totalHadir: 20,
        totalSakit: 2,
        totalAlpha: 1,
      }),
    ];

    const csv = buildMonthlyCsv({
      rows,
      columns,
      className: "Kelas 3A",
      monthName: "Oktober",
      year: 2025,
      effectiveDays: 26,
    });

    it("diawali BOM UTF-8 agar Excel membaca karakter Indonesia benar", () => {
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("memuat judul, header kolom tanggal, dan data siswa", () => {
      expect(csv).toContain("Daftar Hadir Siswa - Kelas 3A - Oktober 2025");
      expect(csv).toContain("Hari efektif: 26");
      expect(csv).toContain("2025-10-01,2025-10-02,2025-10-03");
      expect(csv).toContain("Kehadiran(%)");
      expect(csv).toContain('"Dewi, ""Sari"""');
    });

    it("hari libur dikosongkan, hari tanpa catatan diberi tanda -", () => {
      const lines = csv.split("\r\n");
      const dataLine = lines.find((l) => l.includes('"Dewi, ""Sari"""'))!;
      const cells = splitCsv(dataLine);
      const idxDate = splitCsv(lines.find((l) => l.startsWith("No,"))!).indexOf("2025-10-17");
      expect(cells[idxDate]).toBe(""); // tanggal 17 Oktober 2025 libur
      expect(cells[5]).toBe("H"); // 1 Oktober
      expect(cells[7]).toBe("-"); // 3 Oktober belum tercatat
    });

    it("baris terakhir memuat rekap dan persentase", () => {
      const lines = csv.trim().split("\r\n");
      const header = splitCsv(lines.find((l) => l.startsWith("No,"))!);
      const data = splitCsv(lines[lines.length - 1]);
      expect(data[header.indexOf("H")]).toBe("20");
      expect(data[header.indexOf("A")]).toBe("1");
      expect(data[header.indexOf("Hari")]).toBe("23");
      expect(data[header.indexOf("Kehadiran(%)")]).toBe("76.9"); // 20/26
    });
  });

  describe("csvEscape / csvFilename", () => {
    it("mengutip tanda kutip, koma, dan newline", () => {
      expect(csvEscape("Aisyah")).toBe("Aisyah");
      expect(csvEscape("Dewi, Sari")).toBe('"Dewi, Sari"');
      expect(csvEscape('budi "jr"')).toBe('"budi ""jr"""');
      expect(csvEscape("baris\nbaru")).toBe('"baris\nbaru"');
    });

    it("nama file aman untuk nama kelas", () => {
      expect(csvFilename("Kelas 3A", 10, 2025)).toBe("daftar-hadir-kelas-3a-2025-10.csv");
      expect(csvFilename("Semua Kelas", 1, 2026)).toBe("daftar-hadir-semua-kelas-2026-01.csv");
    });
  });
});
