import { describe, it, expect } from "vitest";
import { romanMonths, previewLetterNumber, extractSequenceNumber } from "./pengaturan-helpers";

describe("romanMonths", () => {
  it("memuat 12 bulan romawi", () => {
    expect(romanMonths).toHaveLength(12);
    expect(romanMonths[0]).toBe("I");
    expect(romanMonths[11]).toBe("XII");
  });
});

describe("previewLetterNumber", () => {
  const fixed = new Date(2026, 5, 15); // Juni 2026

  it("mengganti placeholder nomor (3 digit) dan kode klasifikasi", () => {
    const out = previewLetterNumber(
      "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}",
      5,
      "400.3.5.02",
      fixed,
    );
    expect(out).toBe("005/400.3.5.02/SDN1-KNG/VI/2026");
  });

  it("mengganti {nomor_raw} tanpa padding", () => {
    const out = previewLetterNumber("{nomor_raw}", 5, "", fixed);
    expect(out).toBe("5");
  });

  it("mengganti {nomor_urut_2} dan {nomor_urut_4}", () => {
    expect(previewLetterNumber("{nomor_urut_2}", 5, "", fixed)).toBe("05");
    expect(previewLetterNumber("{nomor_urut_4}", 5, "", fixed)).toBe("0005");
  });

  it("mengganti {bulan_angka} dengan bulan numerik", () => {
    expect(previewLetterNumber("{bulan_angka}", 1, "", fixed)).toBe("06");
  });

  it("memakai format default bila pattern kosong", () => {
    const out = previewLetterNumber("", 1, "421", fixed);
    expect(out).toContain("421");
    expect(out).toContain("2026");
  });

  it("memakai kode klasifikasi default bila kosong", () => {
    const out = previewLetterNumber("{kode_klasifikasi}", 1, "", fixed);
    expect(out).toBe("400.3.5.02");
  });
});

describe("extractSequenceNumber", () => {
  it("mengembalikan 1 untuk input kosong", () => {
    expect(extractSequenceNumber("", "")).toBe(1);
  });

  it("mengambil angka sebelum slash pertama", () => {
    expect(extractSequenceNumber("005/421/SDN", "421")).toBe(5);
  });

  it("melewati segmen yang sama dengan classCode", () => {
    expect(extractSequenceNumber("421/007/SDN", "421")).toBe(7);
  });

  it("mengambil angka pertama walau mengandung titik kode klasifikasi", () => {
    expect(extractSequenceNumber("400.3.5/042/SDN", "999")).toBe(400);
  });

  it("mengembalikan 1 bila tidak ada angka valid", () => {
    expect(extractSequenceNumber("abc/def", "xyz")).toBe(1);
  });
});
