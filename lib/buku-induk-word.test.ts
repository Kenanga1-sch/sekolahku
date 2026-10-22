import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { BUKU_INDUK_TEMPLATE_PATH, bukuIndukFilename, bukuIndukWordData } from "./buku-induk-word";

// Token {{...}} yang benar-benar ada di template kanonik repo. Dipakai untuk
// memastikan builder mengisi SETIAP token (tidak ada yang tertinggal kosong).
function templateTokens(): string[] {
  const file = path.join(process.cwd(), "public", BUKU_INDUK_TEMPLATE_PATH.replace(/^\//, ""));
  const zip = new PizZip(readFileSync(file));
  const xml = zip.file("word/document.xml")?.asText() || "";
  const text = xml.replace(/<[^>]+>/g, "");
  return [...new Set([...text.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map((m) => m[1]))].sort();
}

const student = {
  id: "s1",
  fullName: "Ahmad Fauzi",
  registerNo: "12",
  gender: "L",
  birthPlace: "Indramayu",
  birthDate: "2014-01-05T00:00:00Z",
  religion: "Islam",
  address: "Jl. Melati 1",
  parentAddress: "Jl. Melati 1",
  parentPhone: "08123456789",
  bloodType: "O",
  fatherName: "Sukarno",
  motherName: "Siti",
  guardianName: "Hartono",
  previousSchoolCertDate: "2020-06-20",
  enrolledYear: "2020",
  metaData: JSON.stringify({
    kewarganegaraan: "Indonesia",
    jumlahSaudaraKandung: 2,
    jumlahSaudaraTiri: 1,
    jumlahSaudaraAngkat: 0,
    bahasaSehariHari: "Indonesia",
    fatherEducation: "SMA",
    fatherJob: "Petani",
    motherEducation: "S1",
    motherJob: "Ibu rumah tangga",
    guardianRelation: "Paman",
    guardianEducation: "D3",
    guardianJob: "Wiraswasta",
    asalSiswa: "TK Pertiwi",
    namaTk: "TK Pertiwi",
    alamatTk: "Jl. Kenanga 2",
    skTk: "421.1/001",
    mutasiAsalSekolah: "SDN 2 Kenanga",
    mutasiDariKelas: "Kelas II",
    mutasiDiterimaTanggal: "2022-07-01",
    jenisBeasiswa: "Beasiswa Prestasi",
    tamatTahun: "2026",
    melanjutkanKe: "SMPN 1 Kenanga",
    pindahKeKelas: "Kelas IV",
    pindahKeSekolah: "SDN 3 Kenanga",
    pindahTanggal: "2025-08-01",
    keluarTanggal: "2025-08-01",
    keluarAlasan: "Mengikuti orang tua",
    catatanLain: "Siswa berprestasi",
  }),
  healthRecords: [
    { year: "Kelas I", weight: 20, height: 110, illness: "Batuk", abnormality: "" },
    { year: "Kelas II", weight: 24, height: 118, illness: "Asma", abnormality: "-" },
  ],
  transcripts: [
    { academicYear: "2020/2021", semester: "Ganjil", subjectName: "Matematika", score: 85 },
    { academicYear: "2020/2021", semester: "Genap", subjectName: "Matematika", score: 88 },
    { academicYear: "2020/2021", semester: "Ganjil", subjectName: "Bahasa Indonesia", score: 80 },
  ],
  classHistory: [
    { academicYear: "2020/2021", className: "II", status: "Naik" },
    { academicYear: "2021/2022", className: "II", status: "Tidak naik" },
  ],
};

describe("bukuIndukWordData", () => {
  const data = bukuIndukWordData(student) as Record<string, unknown>;
  const loopRows = data.nilai as Record<string, string>[];

  /** Token di dalam loop {{#nilai}}…{{/nilai}} (bukan kunci root). */
  const LOOP_KEYS = new Set(["mapel"]);
  const inLoop = (t: string) => LOOP_KEYS.has(t) || /^n_\d+_\d+$/.test(t);

  it("mengisi setiap token yang ada di template kanonik", () => {
    const tokens = templateTokens();
    expect(tokens.length).toBeGreaterThan(100);

    // Token berindeks kelas/semester (berat_3, n_2_1, jumlah_4_2) boleh kosong
    // bila data kelas itu belum ada; token loop dicek pada barisnya sendiri.
    const indexed = /_\d+(_\d+)?$|^n_\d+_\d+$/;
    const empty = tokens.filter((t) => {
      if (indexed.test(t) || inLoop(t)) return false;
      const v = data[t];
      return v === undefined || v === null || v === "";
    });
    // peringkat_kelas memang diisi manual (tidak ada sumber data).
    expect(empty).toEqual(["peringkat_kelas"]);

    // Semua token berindeks & loop harus ada sebagai kunci.
    const missing = tokens.filter((t) => {
      if (inLoop(t)) return !loopRows.every((r) => t in r);
      if (indexed.test(t)) return !(t in data);
      return false;
    });
    expect(missing).toEqual([]);
  });

  it("identitas & orang tua terisi dari student.*", () => {
    expect(data.nama_lengkap).toBe("Ahmad Fauzi");
    expect(data.register_no).toBe("12");
    expect(data.jenis_kelamin).toBe("Laki-laki");
    expect(data.tanggal_lahir).toBe("05 Januari 2014");
    expect(data.ayah_nama).toBe("Sukarno");
    expect(data.ibu_nama).toBe("Siti");
    expect(data.wali_pendidikan).toBe("D3");
    expect(data.alamat_orang_tua).toBe("Jl. Melati 1");
  });

  it("meta JSON mengisi kewarganegaraan, mutasi, beasiswa, catatan", () => {
    expect(data.kewarganegaraan).toBe("Indonesia");
    expect(data.saudara_kandung).toBe("2");
    expect(data.mutasi_dari_kelas).toBe("Kelas II");
    expect(data.mutasi_diterima_tanggal).toBe("01 Juli 2022");
    expect(data.jenis_beasiswa).toBe("Beasiswa Prestasi");
    expect(data.melanjutkan_ke).toBe("SMPN 1 Kenanga");
    expect(data.catatan).toBe("Siswa berprestasi");
  });

  it("ringkasan jasmani bagian A memakai entri terbaru", () => {
    expect(data.berat_badan).toBe("24");
    expect(data.tinggi_badan).toBe("118");
    expect(data.penyakit).toBe("Batuk, Asma");
    expect(data.kelainan_jasmani).toBe("-");
  });

  it("tabel jasmani mengisi satu kolom per kelas", () => {
    expect(data.tahun_1).toBe("Kelas I");
    expect(data.tahun_2).toBe("Kelas II");
    expect(data.berat_1).toBe("20");
    expect(data.berat_2).toBe("24");
    expect(data.tinggi_1).toBe("110");
    expect(data.penyakit_2).toBe("Asma");
    expect(data.kelainan_2).toBe("-");
    // Kolom kelas III..VI belum ada riwayat → kosong (bukan error).
    expect(data.berat_3).toBe("");
  });

  it("header C.2 memuat tahun ajaran, label kelas, kenaikan", () => {
    expect(data.tahun_ajaran_1).toBe("2020/2021");
    expect(data.kelas_1).toBe("KELAS I");
    expect(data.kelas_6).toBe("KELAS VI");
    expect(data.kelas_7).toBe("");
    expect(data.naik_1).toBe("Naik ke kelas II");
    expect(data.naik_2).toBe("Tidak naik kelas");
  });

  it("loop nilai: satu baris per mata pelajaran", () => {
    expect(Array.isArray(loopRows)).toBe(true);
    expect(loopRows.length).toBeGreaterThanOrEqual(12);
    expect(loopRows[0].mapel).toBe("Pendidikan Agama Budi Pekerti");
    // Matematika = indeks 2 → kelas I semester 1/2 = 85/88
    expect(loopRows[2].mapel).toBe("Matematika");
    expect(loopRows[2].n_1_1).toBe("85");
    expect(loopRows[2].n_1_2).toBe("88");
    // Bahasa Indonesia = indeks 3 → hanya semester 1
    expect(loopRows[3].n_1_1).toBe("80");
    expect(loopRows[3].n_1_2).toBe("");
  });

  it("agregat jumlah & rata-rata per kelas/semester", () => {
    // Kelas I semester 1: 85 + 80 = 165 ; semester 2: 88
    expect(data.jumlah_1_1).toBe("165");
    expect(data.jumlah_1_2).toBe("88");
    expect(data.rata_1_1).toBe("82.5");
    expect(data.rata_1_2).toBe("88");
  });

  it("siswa tanpa data tetap menghasilkan semua kunci skalar", () => {
    const empty = bukuIndukWordData({}) as Record<string, unknown>;
    const loop = empty.nilai as Record<string, string>[];
    const indexed = /_\d+(_\d+)?$|^n_\d+_\d+$/;
    for (const t of templateTokens()) {
      if (inLoop(t)) expect(loop.every((r) => t in r)).toBe(true);
      else expect(empty).toHaveProperty(t);
    }
    // Token berindeks juga harus ada sebagai kunci (nilainya boleh kosong).
    for (const t of templateTokens().filter((x) => indexed.test(x) && !inLoop(x))) {
      expect(empty).toHaveProperty(t);
    }
    expect(empty.nama_lengkap).toBe("");
    expect(empty.berat_1).toBe("");
    expect(loop.length).toBeGreaterThan(0);
  });
});

describe("bukuIndukFilename", () => {
  it("slug + prefix", () => {
    expect(bukuIndukFilename("Ahmad Fauzi")).toBe("buku-induk-ahmad-fauzi.docx");
  });
  it("nama kosong tetap aman", () => {
    expect(bukuIndukFilename("")).toBe("buku-induk-siswa.docx");
  });
});
