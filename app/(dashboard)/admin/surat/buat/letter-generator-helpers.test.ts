// Tes jaring pengaman helper generator surat (surat/buat).
import { describe, it, expect } from "vitest";
import {
  formatLetterNumber,
  recipientLabel,
  mergeRecipientData,
  romanMonths,
} from "./letter-generator-helpers";

describe("formatLetterNumber", () => {
  const date = new Date(2026, 5, 15); // Juni 2026

  it("mengganti placeholder dasar", () => {
    const out = formatLetterNumber("{nomor}/{kode_klasifikasi}/{bulan}/{tahun}", 7, "400.3.5", date);
    expect(out).toBe("007/400.3.5/VI/2026");
  });

  it("mendukung padding 2/3/4 dan raw", () => {
    expect(formatLetterNumber("{nomor_urut_2}", 7, "", date)).toBe("07");
    expect(formatLetterNumber("{nomor_urut_3}", 7, "", date)).toBe("007");
    expect(formatLetterNumber("{nomor_urut_4}", 7, "", date)).toBe("0007");
    expect(formatLetterNumber("{nomor_urut_raw}", 7, "", date)).toBe("7");
  });

  it("memakai pola default bila pattern kosong", () => {
    const out = formatLetterNumber(undefined, 1, "KODE", date);
    expect(out).toBe("001/KODE/SDN1-KNG/VI/2026");
  });

  it("mengganti bulan_angka 2 digit", () => {
    expect(formatLetterNumber("{bulan_angka}", 1, "", date)).toBe("06");
  });
});

describe("recipientLabel", () => {
  it("memilih fullName lalu name lalu email lalu Manual", () => {
    expect(recipientLabel({ fullName: "Budi" })).toBe("Budi");
    expect(recipientLabel({ name: "Ani" })).toBe("Ani");
    expect(recipientLabel({ email: "a@b.c" })).toBe("a@b.c");
    expect(recipientLabel(null)).toBe("Manual");
  });
});

describe("mergeRecipientData", () => {
  it("mengisi field siswa untuk targetType STUDENT", () => {
    const data: any = {};
    mergeRecipientData(data, { name: "Budi", nis: "123", gender: "L" }, "STUDENT");
    expect(data.siswa_nama).toBe("Budi");
    expect(data.siswa_nis).toBe("123");
    expect(data.siswa_jenis_kelamin).toBe("Laki-laki");
  });

  it("mengisi field penerima/guru untuk non-STUDENT", () => {
    const data: any = {};
    mergeRecipientData(data, { fullName: "Pak Guru", nip: "999" }, "STAFF");
    expect(data.penerima_nama).toBe("Pak Guru");
    expect(data.penerima_nip).toBe("999");
    expect(data.guru_nama).toBe("Pak Guru");
  });
});

describe("romanMonths", () => {
  it("memuat 12 bulan romawi", () => {
    expect(romanMonths).toHaveLength(12);
    expect(romanMonths[0]).toBe("I");
    expect(romanMonths[11]).toBe("XII");
  });
});
