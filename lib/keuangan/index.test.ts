import { describe, it, expect } from "vitest";
import {
  formatRupiah,
  formatRupiahShort,
  computeBalance,
  computeAmount,
  directionLabel,
  unitTypeLabel,
  formatPeriod,
  isSampahUnit,
} from "./index";

describe("formatRupiah", () => {
  it("memformat ribuan dengan titik", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(1000)).toBe("Rp 1.000");
    expect(formatRupiah(1234567)).toBe("Rp 1.234.567");
  });

  it("menangani negatif dan membulatkan", () => {
    expect(formatRupiah(-5000)).toBe("-Rp 5.000");
    expect(formatRupiah(1500.7)).toBe("Rp 1.501");
  });

  it("menangani nilai tidak valid", () => {
    expect(formatRupiah(NaN)).toBe("Rp 0");
    expect(formatRupiah(Infinity)).toBe("Rp 0");
  });
});

describe("formatRupiahShort", () => {
  it("menyingkat juta dan miliar", () => {
    expect(formatRupiahShort(2_500_000)).toBe("Rp 2.5 jt");
    expect(formatRupiahShort(1_200_000_000)).toBe("Rp 1.2 M");
  });
  it("menyingkat ribu", () => {
    expect(formatRupiahShort(15_000)).toBe("Rp 15 rb");
  });
  it("memakai format penuh untuk nilai kecil", () => {
    expect(formatRupiahShort(800)).toBe("Rp 800");
  });
});

describe("computeBalance", () => {
  it("menghitung masuk dikurangi keluar", () => {
    expect(computeBalance(100000, 40000)).toBe(60000);
    expect(computeBalance(0, 0)).toBe(0);
    expect(computeBalance(0, 50000)).toBe(-50000);
  });
  it("menangani non-finite sebagai 0", () => {
    expect(computeBalance(NaN, 1000)).toBe(-1000);
  });
});

describe("computeAmount", () => {
  it("mengalikan kuantitas dengan harga satuan", () => {
    expect(computeAmount(10.5, 4000)).toBe(42000);
    expect(computeAmount(3, 5000)).toBe(15000);
  });
  it("mengembalikan 0 untuk nilai tidak valid / nol / negatif", () => {
    expect(computeAmount(0, 4000)).toBe(0);
    expect(computeAmount(10, 0)).toBe(0);
    expect(computeAmount(-5, 4000)).toBe(0);
    expect(computeAmount(NaN, 4000)).toBe(0);
  });
});

describe("directionLabel", () => {
  it("memberi label arah", () => {
    expect(directionLabel("in")).toBe("Pemasukan");
    expect(directionLabel("out")).toBe("Pengeluaran");
    expect(directionLabel("lain")).toBe("Pemasukan");
  });
});

describe("unitTypeLabel", () => {
  it("memberi label jenis unit", () => {
    expect(unitTypeLabel("sampah")).toBe("Pengelolaan Sampah");
    expect(unitTypeLabel("koperasi")).toBe("Koperasi");
    expect(unitTypeLabel("tidak-dikenal")).toBe("Umum");
  });
});

describe("formatPeriod", () => {
  it("mengubah YYYY-MM menjadi nama bulan", () => {
    expect(formatPeriod("2025-03")).toBe("Maret 2025");
    expect(formatPeriod("2025-12")).toBe("Desember 2025");
  });
  it("mengembalikan apa adanya bila tidak valid", () => {
    expect(formatPeriod("bukan")).toBe("bukan");
    expect(formatPeriod("2025-13")).toBe("2025-13");
  });
});

describe("isSampahUnit", () => {
  it("mendeteksi unit bertipe sampah", () => {
    expect(isSampahUnit("sampah")).toBe(true);
    expect(isSampahUnit("koperasi")).toBe(false);
  });
});
