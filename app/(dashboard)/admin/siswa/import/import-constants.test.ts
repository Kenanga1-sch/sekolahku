// Tes jaring pengaman untuk konstanta & helper murni wizard impor.
// Mengunci deteksi otomatis pemetaan kolom Excel → field DB.
import { describe, it, expect } from "vitest";
import {
  PROFILE_FIELDS,
  GRADE_FIELDS,
  autoDetectMappings,
} from "./import-constants";

describe("PROFILE_FIELDS & GRADE_FIELDS", () => {
  it("PROFILE_FIELDS punya fullName wajib; kunci unik", () => {
    const keys = PROFILE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PROFILE_FIELDS.find((f) => f.key === "fullName")?.required).toBe(true);
  });

  it("GRADE_FIELDS wajib: academicYear, semester, subjectName, score", () => {
    const required = GRADE_FIELDS.filter((f) => f.required).map((f) => f.key).sort();
    expect(required).toEqual(["academicYear", "score", "semester", "subjectName"]);
  });
});

describe("autoDetectMappings — alias & normalisasi header", () => {
  it("cocokkan header persis (case-insensitive)", () => {
    const m = autoDetectMappings(PROFILE_FIELDS, ["Nama Lengkap", "NISN", "NIK"]);
    expect(m.fullName).toBe("Nama Lengkap");
    expect(m.nisn).toBe("NISN");
    expect(m.nik).toBe("NIK");
  });

  it("normalisasi: abaikan spasi/tanda baca", () => {
    const m = autoDetectMappings(PROFILE_FIELDS, ["nama_lengkap", "No. HP"]);
    expect(m.fullName).toBe("nama_lengkap");
    expect(m.currentPhone).toBe("No. HP");
  });

  it("alias bahasa (mis. 'nama' → fullName, 'jk' → gender)", () => {
    const m = autoDetectMappings(PROFILE_FIELDS, ["nama", "jk", "agama"]);
    expect(m.fullName).toBe("nama");
    expect(m.gender).toBe("jk");
    expect(m.religion).toBe("agama");
  });

  it("field grade: tahunajaran/subject/nilai terpetakan", () => {
    const m = autoDetectMappings(GRADE_FIELDS, ["Tahun Ajaran", "Mata Pelajaran", "Nilai"]);
    expect(m.academicYear).toBe("Tahun Ajaran");
    expect(m.subjectName).toBe("Mata Pelajaran");
    expect(m.score).toBe("Nilai");
  });

  it("header tanpa alias cocok → field tak dipetakan", () => {
    const m = autoDetectMappings(GRADE_FIELDS, ["Kolom Tak Dikenal XYZ"]);
    expect(Object.keys(m)).toHaveLength(0);
  });

  it("header kosong → hasil kosong", () => {
    expect(autoDetectMappings(PROFILE_FIELDS, [])).toEqual({});
  });

  it("murni: tidak mengubah input & deterministik", () => {
    const headers = ["Nama", "NISN"];
    const snapshot = [...headers];
    const m1 = autoDetectMappings(PROFILE_FIELDS, headers);
    const m2 = autoDetectMappings(PROFILE_FIELDS, headers);
    expect(m1).toEqual(m2);
    expect(headers).toEqual(snapshot);
  });
});
