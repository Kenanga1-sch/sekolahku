import { describe, it, expect } from "vitest";
import {
  isAttendanceRequired,
  isAsn,
  gtkStatusLabel,
  formatDistance,
  resolvePointForSession,
  gtkCategoryLabel,
  daysInMonth,
  dateKey,
  statusLetter,
  gtkAttendancePct,
  overallAttendancePct,
  monthlyFilename,
  annualAttendancePct,
  overallAnnualPct,
  isBelowThreshold,
  monthRangeLabel,
  rangeFilename,
  SEMESTERS,
  type AttendancePoint,
} from "./index";

describe("isAttendanceRequired", () => {
  it("menerima status honorer (case-insensitive)", () => {
    expect(isAttendanceRequired("GTT")).toBe(true);
    expect(isAttendanceRequired("gty")).toBe(true);
    expect(isAttendanceRequired("Honorer")).toBe(true);
    expect(isAttendanceRequired("ptt")).toBe(true);
    expect(isAttendanceRequired("Pembina Ekskul")).toBe(true);
    expect(isAttendanceRequired("  pembina ekstrakurikuler ")).toBe(true);
  });

  it("menolak ASN & kosong", () => {
    expect(isAttendanceRequired("PNS")).toBe(false);
    expect(isAttendanceRequired("P3K")).toBe(false);
    expect(isAttendanceRequired("PPPK")).toBe(false);
    expect(isAttendanceRequired("PPPK PW")).toBe(false);
    expect(isAttendanceRequired("")).toBe(false);
    expect(isAttendanceRequired(null)).toBe(false);
    expect(isAttendanceRequired(undefined)).toBe(false);
  });
});

describe("isAsn", () => {
  it("mengenali ASN", () => {
    expect(isAsn("PNS")).toBe(true);
    expect(isAsn("p3k")).toBe(true);
    expect(isAsn("PPPK")).toBe(true);
    expect(isAsn("honorer")).toBe(false);
  });
});

describe("gtkStatusLabel", () => {
  it("memetakan status ke label", () => {
    expect(gtkStatusLabel("hadir").text).toBe("Hadir");
    expect(gtkStatusLabel("sakit").text).toBe("Sakit");
    expect(gtkStatusLabel("").text).toBe("Belum absen");
    expect(gtkStatusLabel("entah").text).toBe("Belum absen");
  });
});

describe("formatDistance", () => {
  it("meter untuk < 1 km", () => {
    expect(formatDistance(12.4)).toBe("12 m");
    expect(formatDistance(999)).toBe("999 m");
  });
  it("km untuk >= 1 km", () => {
    expect(formatDistance(1200)).toBe("1.20 km");
  });
  it("null safety", () => {
    expect(formatDistance(null)).toBe("-");
    expect(formatDistance(undefined)).toBe("-");
  });
});

describe("resolvePointForSession", () => {
  const points: AttendancePoint[] = [
    { id: "sekolah", name: "Sekolah", pointType: "sekolah", latitude: -6.3, longitude: 108.3, radiusM: 100, isActive: true },
    { id: "lapangan", name: "Lapangan", pointType: "ekskul", latitude: -6.31, longitude: 108.31, radiusM: 150, isActive: true },
  ];

  it("prioritas titik eksplisit", () => {
    expect(resolvePointForSession(points, { pointId: "lapangan" })?.id).toBe("lapangan");
  });
  it("fallback ke titik ekskul", () => {
    expect(resolvePointForSession(points, { ekskulPointId: "lapangan" })?.id).toBe("lapangan");
  });
  it("fallback ke titik sekolah", () => {
    expect(resolvePointForSession(points, {})?.id).toBe("sekolah");
  });
  it("null bila tak ada titik", () => {
    expect(resolvePointForSession([], {})).toBeNull();
  });
});

describe("gtkCategoryLabel", () => {
  it("memetakan kategori", () => {
    expect(gtkCategoryLabel("guru")).toBe("Guru");
    expect(gtkCategoryLabel("kepsek")).toBe("Kepala Sekolah");
    expect(gtkCategoryLabel(undefined)).toBe("GTK");
  });
});

describe("monthly report helpers", () => {
  it("daysInMonth", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
  });

  it("dateKey", () => {
    expect(dateKey(2026, 10, 5)).toBe("2026-10-05");
  });

  it("statusLetter", () => {
    expect(statusLetter("hadir")).toBe("H");
    expect(statusLetter("Sakit")).toBe("S");
    expect(statusLetter("")).toBe("-");
  });

  it("gtkAttendancePct", () => {
    const row = {
      employeeId: "e1", name: "A", nip: "", category: "guru", employmentStatus: "Honorer",
      dailyStatus: {}, totalHadir: 20, totalSakit: 1, totalIzin: 0, totalAlpha: 1,
    };
    expect(gtkAttendancePct(row, 22)).toBe(90.9);
    // tanpa catatan → null
    expect(gtkAttendancePct({ ...row, totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0 }, 22)).toBeNull();
    expect(gtkAttendancePct(row, 0)).toBeNull();
  });

  it("overallAttendancePct", () => {
    const rows = [
      { employeeId: "e1", name: "A", nip: "", category: "", employmentStatus: "", dailyStatus: {}, totalHadir: 10, totalSakit: 0, totalIzin: 0, totalAlpha: 0 },
      { employeeId: "e2", name: "B", nip: "", category: "", employmentStatus: "", dailyStatus: {}, totalHadir: 12, totalSakit: 0, totalIzin: 0, totalAlpha: 0 },
    ];
    // 22 / (2*22) = 50%
    expect(overallAttendancePct(rows, 22)).toBe(50);
    expect(overallAttendancePct([], 22)).toBeNull();
  });

  it("monthlyFilename", () => {
    expect(monthlyFilename(2026, 10, "gtk")).toBe("laporan-presensi-gtk-2026-10");
    expect(monthlyFilename(2026, 3, "ekskul")).toBe("laporan-presensi-ekskul-2026-03");
  });
});

describe("annual/semester helpers", () => {
  const row = {
    employeeId: "e1", name: "A", nip: "", category: "guru", employmentStatus: "Honorer",
    totalHadir: 100, totalSakit: 5, totalIzin: 3, totalAlpha: 12, effectiveDays: 120,
  };

  it("annualAttendancePct", () => {
    expect(annualAttendancePct(row)).toBe(83.3);
    expect(annualAttendancePct({ ...row, totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0 })).toBeNull();
    expect(annualAttendancePct({ ...row, effectiveDays: 0 })).toBeNull();
  });

  it("overallAnnualPct", () => {
    const rows = [{ ...row, totalHadir: 60 }, { ...row, totalHadir: 60 }];
    expect(overallAnnualPct(rows, 120)).toBe(50);
    expect(overallAnnualPct([], 120)).toBeNull();
  });

  it("isBelowThreshold", () => {
    expect(isBelowThreshold(70)).toBe(true);
    expect(isBelowThreshold(75)).toBe(false);
    expect(isBelowThreshold(80)).toBe(false);
    expect(isBelowThreshold(null)).toBe(false);
    expect(isBelowThreshold(60, 65)).toBe(true);
  });

  it("monthRangeLabel", () => {
    expect(monthRangeLabel(7, 12, 2026)).toBe("Jul–Des 2026");
    expect(monthRangeLabel(1, 6, 2026)).toBe("Jan–Jun 2026");
  });

  it("rangeFilename", () => {
    expect(rangeFilename(2026, 7, 12, "gtk")).toBe("rekap-presensi-gtk-2026-07-12");
    expect(rangeFilename(2026, 1, 6, "ekskul")).toBe("rekap-presensi-ekskul-2026-01-06");
  });

  it("SEMESTERS", () => {
    expect(SEMESTERS.ganjil.startMonth).toBe(7);
    expect(SEMESTERS.genap.endMonth).toBe(6);
  });
});
