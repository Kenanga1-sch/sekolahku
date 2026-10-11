import { describe, it, expect } from "vitest";
import {
  isAttendanceRequired,
  isAsn,
  gtkStatusLabel,
  formatDistance,
  resolvePointForSession,
  gtkCategoryLabel,
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
