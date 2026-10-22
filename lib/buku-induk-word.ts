/**
 * buku-induk-word.ts — Penyusun data template Word "Buku Induk" (.docx).
 *
 * Pasangan Word dari `lib/presensi-excel.ts` (pengisi .xlsx presensi):
 *   - presensi: baris contoh direplikasi per siswa, formula digeser otomatis;
 *   - buku induk: satu dokumen per siswa. Tabel C.2 punya SATU baris contoh
 *     berisi loop `{{#nilai}}…{{/nilai}}` (direplikasi docxtemplater per mata
 *     pelajaran) dan tabel Keadaan Jasmani punya 6 kolom kelas tetap.
 *
 * Sumber data = objek siswa yang sama dengan halaman cetak HTML
 * (`app/(dashboard)/admin/siswa/buku-induk/print`): field `student.*`,
 * `metaData` (via buildPrintMeta), `healthRecords`, `transcripts`,
 * `classHistory`.
 *
 * Daftar variabel yang dikenali ada di kamus:
 *   lib/config/report-variables.ts (modul "buku-induk").
 *
 * Kotak pas foto 3×4 cm di kop SENGAJA tidak diberi token — dibiarkan kosong
 * agar ditempel manual setelah dokumen diunduh.
 */

import {
  CLASSES,
  SUBJECTS,
  buildPrintMeta,
  buildPromotionMap,
  buildTranscriptGrid,
  fmtTanggalID,
  matchSubject,
  yearSortKey,
} from "@/app/(dashboard)/admin/siswa/buku-induk/print/_lib/transcript";
import type { WordTemplateData } from "./template-word";

/** Modul template di tabel report_templates. */
export const BUKU_INDUK_TEMPLATE_MODULE = "buku-induk";

/** Template bawaan di repo (dipakai bila admin belum mengunggah / default hilang). */
export const BUKU_INDUK_TEMPLATE_PATH = "/templates/buku-induk-v1.docx";

/** Jumlah kolom kelas pada tabel C.2 template (I..VIII; SD memakai 6 pertama). */
export const C2_CLASS_COLUMNS = 8;

/** Jumlah kolom kelas pada tabel Keadaan Jasmani (I..VI). */
export const JASMANI_CLASS_COLUMNS = 6;

const str = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

/** Angka gaya Indonesia tanpa nol desimal berlebih (88, 85.5). */
const fmtNum = (v: unknown): string => {
  if (typeof v !== "number" || !isFinite(v)) return str(v);
  return String(Math.round(v * 100) / 100);
};

/** Label jenis kelamin satu kata (sama dengan halaman cetak HTML). */
const genderLabel = (g?: string | null): string =>
  g === "L" ? "Laki-laki" : g === "P" ? "Perempuan" : str(g);

/** Riwayat jasmani terurut kelas I → VI (sama seperti tabel HTML). */
function healthRows(student: any): any[] {
  return (student?.healthRecords || [])
    .filter((r: any) => r && (r.year || r.weight || r.height || r.illness || r.abnormality))
    .slice()
    .sort((a: any, b: any) => yearSortKey(a.year) - yearSortKey(b.year));
}

/** Nilai satu sel tabel Keadaan Jasmani (kolom kelas ke-`index`, 1-based). */
const jasmaniCell = (rows: any[], index: number, pick: (r: any) => unknown): string => {
  const row = rows[index - 1];
  return row ? str(pick(row)) : "";
};

/** Token tabel Keadaan Jasmani: tahun/berat/tinggi/penyakit/kelainan per kelas. */
function jasmaniColumns(rows: any[]): WordTemplateData {
  const out: WordTemplateData = {};
  for (let i = 1; i <= JASMANI_CLASS_COLUMNS; i++) {
    out[`tahun_${i}`] = jasmaniCell(rows, i, (r) => r.year);
    out[`berat_${i}`] = jasmaniCell(rows, i, (r) => r.weight);
    out[`tinggi_${i}`] = jasmaniCell(rows, i, (r) => r.height);
    out[`penyakit_${i}`] = jasmaniCell(rows, i, (r) => r.illness);
    out[`kelainan_${i}`] = jasmaniCell(rows, i, (r) => r.abnormality);
  }
  return out;
}

/** Baris loop C.2: satu objek per mata pelajaran ({{#nilai}}…{{/nilai}}). */
function scoreRows(
  grid: Record<string, Record<string, Record<string, number>>>
): Record<string, string>[] {
  return SUBJECTS.map((subject) => {
    const row: Record<string, string> = { mapel: subject };
    for (let k = 1; k <= C2_CLASS_COLUMNS; k++) {
      const kelas = CLASSES[k - 1];
      const bySubject = (kelas && grid[kelas]) || {};
      const key = matchSubject(Object.keys(bySubject), subject);
      const scores = key ? bySubject[key] || {} : {};
      row[`n_${k}_1`] = scores["1"] === undefined ? "" : fmtNum(scores["1"]);
      row[`n_${k}_2`] = scores["2"] === undefined ? "" : fmtNum(scores["2"]);
    }
    return row;
  });
}

/** Agregat C.2 per kelas+semester (jumlah & rata-rata). */
function aggregateColumns(
  grid: Record<string, Record<string, Record<string, number>>>
): WordTemplateData {
  const out: WordTemplateData = {};
  for (let k = 1; k <= C2_CLASS_COLUMNS; k++) {
    const kelas = CLASSES[k - 1];
    const bySubject = (kelas && grid[kelas]) || {};
    for (const sem of ["1", "2"] as const) {
      const vals = Object.values(bySubject)
        .map((s) => s[sem])
        .filter((v): v is number => typeof v === "number");
      const total = vals.reduce((a, b) => a + b, 0);
      out[`jumlah_${k}_${sem}`] = vals.length ? fmtNum(total) : "";
      out[`rata_${k}_${sem}`] = vals.length ? fmtNum(total / vals.length) : "";
    }
  }
  return out;
}

/** Header C.2: tahun ajaran, label kelas, dan kenaikan tingkat per kolom. */
function c2HeaderColumns(
  yearLabels: Record<string, string>,
  promotions: Record<string, string>
): WordTemplateData {
  const out: WordTemplateData = {};
  for (let k = 1; k <= C2_CLASS_COLUMNS; k++) {
    const kelas = CLASSES[k - 1];
    out[`tahun_ajaran_${k}`] = kelas ? yearLabels[kelas] || "" : "";
    out[`kelas_${k}`] = kelas ? `KELAS ${kelas}` : "";
    out[`naik_${k}`] = kelas ? promotions[kelas] || "" : "";
  }
  return out;
}

/** Identitas murid (bagian A + kop). */
function identityFields(student: any, meta: Record<string, any>): WordTemplateData {
  return {
    register_no: str(student?.registerNo),
    nama_lengkap: str(student?.fullName),
    jenis_kelamin: genderLabel(student?.gender),
    tempat_lahir: str(student?.birthPlace),
    tanggal_lahir: fmtTanggalID(student?.birthDate),
    agama: str(student?.religion),
    kewarganegaraan: str(meta.kewarganegaraan),
    saudara_kandung: str(meta.jumlahSaudaraKandung),
    saudara_tiri: str(meta.jumlahSaudaraTiri),
    saudara_angkat: str(meta.jumlahSaudaraAngkat),
    bahasa_sehari_hari: str(meta.bahasaSehariHari),
    alamat_siswa: str(student?.address),
    alamat_orang_tua: str(student?.parentAddress),
    telepon_orang_tua: str(student?.parentPhone),
    golongan_darah: str(meta.golDarah) || str(student?.bloodType),
  };
}

/**
 * Keadaan jasmani ringkas (bagian A butir 8). Diambil dari entri riwayat
 * terbaru; kolom statis siswa dipakai bila riwayat kesehatan belum diisi.
 */
function jasmaniSummary(student: any, meta: Record<string, any>): WordTemplateData {
  const rows = healthRows(student);
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const penyakit = [...new Set(rows.map((r) => str(r.illness)).filter((v) => v !== ""))].join(", ");
  const kelainan = [...new Set(rows.map((r) => str(r.abnormality)).filter((v) => v !== ""))].join(", ");
  return {
    berat_badan: str(latest?.weight) || str(meta.beratBadan) || str(student?.weight),
    tinggi_badan: str(latest?.height) || str(meta.tinggiBadan) || str(student?.height),
    penyakit: penyakit || str(meta.penyakitPernahDiderita),
    kelainan_jasmani: kelainan,
  };
}

/** Orang tua / wali (bagian B). */
function parentFields(student: any, meta: Record<string, any>): WordTemplateData {
  return {
    ayah_nama: str(student?.fatherName),
    ayah_pendidikan: str(meta.fatherEducation),
    ayah_pekerjaan: str(meta.fatherJob),
    ibu_nama: str(student?.motherName),
    ibu_pendidikan: str(meta.motherEducation),
    ibu_pekerjaan: str(meta.motherJob),
    wali_nama: str(student?.guardianName),
    hubungan_wali: str(meta.guardianRelation),
    wali_pendidikan: str(meta.guardianEducation),
    wali_pekerjaan: str(meta.guardianJob),
  };
}

/** Pendidikan sebelumnya, mutasi, beasiswa, dan meninggalkan sekolah (C–F). */
function historyFields(student: any, meta: Record<string, any>): WordTemplateData {
  return {
    asal_sekolah: str(meta.asalSiswa),
    nama_tk: str(meta.namaTk),
    alamat_asal_sekolah: str(meta.alamatTk),
    tanggal_sttb: fmtTanggalID(student?.previousSchoolCertDate),
    no_sttb: str(meta.skTk),
    mutasi_asal_sekolah: str(meta.mutasiAsalSekolah),
    mutasi_dari_kelas: str(meta.mutasiDariKelas),
    mutasi_diterima_tanggal: fmtTanggalID(meta.mutasiDiterimaTanggal),
    jenis_beasiswa: str(meta.jenisBeasiswa),
    tamat_tahun: str(meta.tamatTahun),
    melanjutkan_ke: str(meta.melanjutkanKe),
    pindah_ke_kelas: str(meta.pindahKeKelas),
    pindah_ke_sekolah: str(meta.pindahKeSekolah),
    pindah_tanggal: fmtTanggalID(meta.pindahTanggal),
    keluar_tanggal: fmtTanggalID(meta.keluarTanggal),
    alasan_keluar: str(meta.keluarAlasan),
    catatan: str(meta.catatanLain),
  };
}

/**
 * Susun seluruh nilai variabel template Word Buku Induk untuk satu siswa.
 * Hanya kunci yang benar-benar dipakai template yang diisi; token lain
 * dibiarkan kosong oleh nullGetter docxtemplater.
 */
export function bukuIndukWordData(student: any): WordTemplateData {
  const meta = buildPrintMeta(student);
  const { grid, yearLabels } = buildTranscriptGrid(student);
  const promotions = buildPromotionMap(student, student?.classHistory);

  return {
    ...identityFields(student, meta),
    ...jasmaniSummary(student, meta),
    ...parentFields(student, meta),
    ...historyFields(student, meta),
    // Tabel 3 "Keadaan Jasmani" — satu kolom per kelas I..VI.
    ...jasmaniColumns(healthRows(student)),
    // Tabel C.2 "Prestasi Belajar" — header per kelas + loop per mapel.
    ...c2HeaderColumns(yearLabels, promotions),
    nilai: scoreRows(grid),
    ...aggregateColumns(grid),
    // Peringkat diisi manual (tidak ada sumber data peringkat per kelas).
    peringkat_kelas: "",
  };
}

/** Nama berkas unduhan: buku-induk-<nama-siswa>.docx */
export function bukuIndukFilename(nama: string): string {
  const slug =
    str(nama)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "siswa";
  return `buku-induk-${slug}.docx`;
}
