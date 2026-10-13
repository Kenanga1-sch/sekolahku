// Tes jaring pengaman untuk helper murni Unified QR Workbench.
import { describe, it, expect } from "vitest";
import {
  formatRupiah,
  toArray,
  getApiMessage,
  getApiData,
  getSavingsName,
  getSavingsClass,
  attendanceBadgeClass,
  QUICK_AMOUNTS,
  SAME_CODE_BLOCK_MS,
  RESET_AFTER_ACTION_MS,
  INVALID_RESET_MS,
} from "./unified-qr-helpers";
import type { TabunganSiswaWithRelations } from "@/types/tabungan";

describe("konstanta", () => {
  it("nilai timeout & quick amounts", () => {
    expect(SAME_CODE_BLOCK_MS).toBe(3000);
    expect(RESET_AFTER_ACTION_MS).toBe(2500);
    expect(INVALID_RESET_MS).toBe(3000);
    expect(QUICK_AMOUNTS).toEqual([10000, 20000, 50000, 100000]);
  });
});

describe("formatRupiah", () => {
  it("format IDR tanpa desimal", () => {
    expect(formatRupiah(50000)).toContain("50.000");
    expect(formatRupiah(0)).toContain("0");
  });
});

describe("toArray — ekstraksi array dari berbagai bentuk respons", () => {
  it("array langsung", () => {
    expect(toArray<number>([1, 2])).toEqual([1, 2]);
  });
  it("objek {data:[...]}", () => {
    expect(toArray<number>({ data: [1, 2] })).toEqual([1, 2]);
  });
  it("objek {items:[...]}", () => {
    expect(toArray<number>({ items: [3, 4] })).toEqual([3, 4]);
  });
  it("null/undefined/bentuk lain → []", () => {
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray({ foo: "bar" })).toEqual([]);
  });
});

describe("getApiMessage", () => {
  it("Error → message; non-error → pesan default", () => {
    expect(getApiMessage(new Error("gagal jaringan"))).toBe("gagal jaringan");
    expect(getApiMessage("string biasa")).toBe("Terjadi kesalahan");
    expect(getApiMessage(null)).toBe("Terjadi kesalahan");
  });
});

describe("getApiData", () => {
  it("error dengan properti data objek → objek data", () => {
    expect(getApiData({ data: { a: 1 } })).toEqual({ a: 1 });
  });
  it("tanpa data / data non-objek → undefined", () => {
    expect(getApiData(new Error("x"))).toBeUndefined();
    expect(getApiData({ data: 5 })).toBeUndefined();
    expect(getApiData(null)).toBeUndefined();
  });
});

describe("getSavingsName / getSavingsClass", () => {
  it("akun null → nama 'Penabung', kelas undefined", () => {
    expect(getSavingsName(null)).toBe("Penabung");
    expect(getSavingsClass(null)).toBeUndefined();
  });
  it("akun dengan nama → dipakai; kelas dari nama lalu kelasId", () => {
    const acc = { nama: "Budi", kelasId: "k1", kelas: { nama: "4A" } } as unknown as TabunganSiswaWithRelations;
    expect(getSavingsName(acc)).toBe("Budi");
    expect(getSavingsClass(acc)).toBe("4A");
  });
  it("tanpa kelas → fallback kelasId", () => {
    const acc = { nama: "Budi", kelasId: "k1", kelas: null } as unknown as TabunganSiswaWithRelations;
    expect(getSavingsClass(acc)).toBe("k1");
  });
});

describe("attendanceBadgeClass — kelas warna per status", () => {
  it("recorded → emerald", () => {
    expect(attendanceBadgeClass("recorded")).toContain("emerald");
  });
  it("already → amber", () => {
    expect(attendanceBadgeClass("already")).toContain("amber");
  });
  it("wrong-class & no-session → orange", () => {
    expect(attendanceBadgeClass("wrong-class")).toContain("orange");
    expect(attendanceBadgeClass("no-session")).toContain("orange");
  });
  it("not-found & error → red", () => {
    expect(attendanceBadgeClass("not-found")).toContain("red");
    expect(attendanceBadgeClass("error")).toContain("red");
  });
});
