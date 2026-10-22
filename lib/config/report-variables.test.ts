import { describe, expect, it } from "vitest";
import {
  BUKU_INDUK_EXECUTED_VARIABLES,
  BUKU_INDUK_KNOWN_VARIABLES,
  FILL_VARIABLE_MODULES,
  getFillVariableModule,
} from "./report-variables";

describe("kamus variabel laporan", () => {
  it("menyediakan modul Buku Induk untuk unggahan template Word", () => {
    const mod = getFillVariableModule("buku-induk");
    expect(mod?.label).toBe("Buku Induk");
    expect(FILL_VARIABLE_MODULES.some((m) => m.module === "buku-induk")).toBe(true);
  });

  it("memuat variabel inti Buku Induk", () => {
    const mod = getFillVariableModule("buku-induk");
    const names = mod!.groups.flatMap((g) => g.variables.map((x) => x.name));
    for (const key of [
      "nama_lengkap",
      "nis",
      "nisn",
      "register_no",
      "golongan_darah",
      "nama_tk",
      "jenis_beasiswa",
      "catatan",
      "jumlah_nilai",
      "nilai_rata_rata",
      "peringkat_kelas",
      "kenaikan_kelas",
      "ayah_nama",
      "ibu_nama",
      "wali_nama",
      "alamat_siswa",
      "tanggal_lahir",
      "tamat_tahun",
      "no_ijazah",
      "tanggal_cetak",
    ]) {
      expect(names).toContain(key);
    }
  });

  it("token yang dieksekusi template Word berstatus siap", () => {
    const mod = getFillVariableModule("buku-induk")!;
    const byName = new Map(mod.groups.flatMap((g) => g.variables.map((x) => [x.name, x] as const)));
    for (const key of BUKU_INDUK_EXECUTED_VARIABLES) {
      expect(byName.get(key)?.status, `token ${key}`).toBe("siap");
    }
    // Token di luar daftar eksekusi tetap "rencana" (belum dipakai template).
    expect(byName.get("no_ijazah")?.status).toBe("rencana");
  });

  it("setiap token eksekusi terdaftar di kamus", () => {
    const known = new Set(BUKU_INDUK_KNOWN_VARIABLES);
    for (const key of BUKU_INDUK_EXECUTED_VARIABLES) expect(known.has(key)).toBe(true);
    expect(BUKU_INDUK_EXECUTED_VARIABLES.length).toBe(150);
  });

  it("setiap modul punya label dan grup berisi variabel", () => {
    for (const mod of FILL_VARIABLE_MODULES) {
      expect(mod.label.length).toBeGreaterThan(0);
      expect(mod.groups.length).toBeGreaterThan(0);
      for (const g of mod.groups) {
        expect(g.label.length).toBeGreaterThan(0);
        expect(g.variables.length).toBeGreaterThan(0);
      }
    }
  });
});
