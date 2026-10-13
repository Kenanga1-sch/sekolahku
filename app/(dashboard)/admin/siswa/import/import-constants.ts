// Konstanta & helper murni untuk wizard impor siswa.
// Dipisah dari page agar bisa diuji tanpa merender komponen.

export type ImportType = "profile" | "grade";
export type ActiveTab = "excel" | "bridge";

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  desc?: string;
}

export const PROFILE_FIELDS: TargetField[] = [
  { key: "fullName", label: "Nama Lengkap", required: true, desc: "Nama lengkap siswa" },
  { key: "nickname", label: "Nama Panggilan", required: false, desc: "Nama panggilan sehari-hari" },
  { key: "nisn", label: "NISN", required: false, desc: "Nomor Induk Siswa Nasional (10 digit)" },
  { key: "nis", label: "NIS / No Induk", required: false, desc: "Nomor Induk Siswa" },
  { key: "nik", label: "NIK", required: false, desc: "Nomor Induk Kependudukan (16 digit)" },
  { key: "gender", label: "Jenis Kelamin", required: false, desc: "L (Laki-laki) atau P (Perempuan)" },
  { key: "birthPlace", label: "Tempat Lahir", required: false },
  { key: "birthDate", label: "Tanggal Lahir", required: false, desc: "Format: YYYY-MM-DD" },
  { key: "religion", label: "Agama", required: false },
  { key: "citizenship", label: "Kewarganegaraan", required: false, desc: "WNI atau WNA" },
  { key: "dailyLanguage", label: "Bahasa Keluarga", required: false, desc: "Bahasa sehari-hari" },
  { key: "livingWith", label: "Tinggal Bersama", required: false, desc: "Orangtua / Wali / Menumpang / Asrama" },
  { key: "address", label: "Alamat Lengkap", required: false },
  { key: "currentPhone", label: "No Telepon / HP", required: false },
  { key: "siblingKandung", label: "Saudara Kandung", required: false, desc: "Jumlah saudara kandung" },
  { key: "siblingTiri", label: "Saudara Tiri", required: false, desc: "Jumlah saudara tiri" },
  { key: "siblingAngkat", label: "Saudara Angkat", required: false, desc: "Jumlah saudara angkat" },
  { key: "fatherName", label: "Nama Ayah", required: false },
  { key: "fatherNik", label: "NIK Ayah", required: false },
  { key: "fatherEducation", label: "Pendidikan Ayah", required: false },
  { key: "fatherJob", label: "Pekerjaan Ayah", required: false },
  { key: "motherName", label: "Nama Ibu", required: false },
  { key: "motherNik", label: "NIK Ibu", required: false },
  { key: "motherEducation", label: "Pendidikan Ibu", required: false },
  { key: "motherJob", label: "Pekerjaan Ibu", required: false },
  { key: "guardianName", label: "Nama Wali", required: false },
  { key: "guardianNik", label: "NIK Wali", required: false },
  { key: "guardianRelation", label: "Hubungan Wali", required: false },
  { key: "guardianEducation", label: "Pendidikan Wali", required: false },
  { key: "guardianJob", label: "Pekerjaan Wali", required: false },
  { key: "guardianPhone", label: "No HP Wali", required: false },
  { key: "previousSchool", label: "Sekolah Asal (TK/SD)", required: false },
  { key: "previousSchoolAddress", label: "Alamat Sekolah Asal", required: false },
  { key: "previousSchoolCertNo", label: "No Ijazah / STTB Asal", required: false },
  { key: "previousSchoolCertDate", label: "Tanggal Ijazah Asal", required: false },
  { key: "mutasiMasukAsalSekolah", label: "Sekolah Asal Pindahan", required: false },
  { key: "mutasiMasukDariKelas", label: "Dari Kelas Pindahan", required: false },
  { key: "mutasiMasukDiterimaTanggal", label: "Diterima Tanggal", required: false },
  { key: "mutasiMasukDiKelas", label: "Diterima Di Kelas", required: false },
  { key: "scholarshipInfo", label: "Beasiswa", required: false },
  { key: "height", label: "Tinggi Badan (cm)", required: false },
  { key: "weight", label: "Berat Badan (kg)", required: false },
  { key: "bloodType", label: "Golongan Darah", required: false },
  { key: "medicalNotes", label: "Catatan Penyakit", required: false },
  { key: "specialNeeds", label: "Kelainan Jasmani", required: false },
  { key: "enrolledYear", label: "Tahun Masuk", required: false },
  { key: "graduationYear", label: "Tahun Lulus", required: false },
  { key: "bukuFisikNo", label: "Buku Induk Fisik No.", required: false, desc: "Nomor jilid buku induk fisik (mis. VI)" },
  { key: "registerNo", label: "Nomor Urut Register", required: false, desc: "Nomor urut siswa di buku fisik (mis. 1421)" },
  { key: "status", label: "Status Siswa", required: false, desc: "active / graduated / transferred / dropped" },
];

export const GRADE_FIELDS: TargetField[] = [
  { key: "nisn", label: "NISN Siswa", required: false, desc: "Untuk pencocokan profil siswa" },
  { key: "nis", label: "NIS Siswa", required: false, desc: "Untuk pencocokan profil siswa" },
  { key: "fullName", label: "Nama Siswa", required: false, desc: "Pencocokan nama (case-insensitive)" },
  { key: "academicYear", label: "Tahun Ajaran", required: true, desc: "Format: YYYY/YYYY (misal 2026/2027)" },
  { key: "semester", label: "Semester", required: true, desc: "Ganjil atau Genap" },
  { key: "subjectName", label: "Nama Mapel", required: true, desc: "Misalnya: Matematika, Bahasa Indonesia, Mangrove" },
  { key: "score", label: "Nilai Angka", required: true, desc: "Skala 0 - 100" },
  { key: "notes", label: "Deskripsi/Catatan", required: false, desc: "Deskripsi capaian nilai rapor" },
];

/**
 * Deteksi otomatis pemetaan kolom Excel → field database berdasarkan alias
 * header (case-insensitive, tanpa tanda baca). Murni: tak menyentuh state.
 */
export function autoDetectMappings(targetFields: TargetField[], excelHeaders: string[]): Record<string, string> {
  const newMappings: Record<string, string> = {};

  const dictionary: Record<string, string[]> = {
    fullName: ["nama", "namalengkap", "nama_lengkap", "nama_siswa", "namasiswa", "studentname", "full_name"],
    nickname: ["panggilan", "namapanggilan", "nama_panggilan", "nickname"],
    nisn: ["nisn", "n.i.s.n", "nisn_siswa"],
    nis: ["nis", "n.i.s", "nomorinduk", "no_induk", "noinduk", "student_id", "id_siswa"],
    nik: ["nik", "n.i.k", "nomorktp", "no_ktp", "noktp", "national_id"],
    gender: ["jeniskelamin", "jk", "j_k", "sex", "kelamin", "gender"],
    birthPlace: ["tempatlahir", "tempat_lahir", "tmplahir", "birth_place"],
    birthDate: ["tanggallahir", "tanggal_lahir", "tgllahir", "birth_date"],
    religion: ["agama", "religion"],
    citizenship: ["kewarganegaraan", "citizenship", "warga_negara"],
    dailyLanguage: ["bahasa", "bahasaseharihari", "bahasa_keluarga", "daily_language"],
    livingWith: ["tinggal", "tinggalbersama", "tinggal_dengan", "living_with"],
    address: ["alamat", "alamattinggal", "alamat_tinggal", "address"],
    currentPhone: ["notelpon", "notelepon", "nohp", "no_hp", "telepon", "phone"],
    siblingKandung: ["saudarakandung", "sibling_kandung"],
    graduationYear: ["tahunlulus", "tahun_lulus", "thnlulus", "thn_lulus", "lulus", "graduation_year"],
    bukuFisikNo: ["bukuinduk", "buku_induk", "buku", "jilid", "buku_fisik", "bukufisik", "nomorbuku", "nomor_buku"],
    registerNo: ["nomorurut", "nomor_urut", "no_urut", "nourut", "register", "register_no", "registerno"],
    fatherName: ["namaayah", "nama_ayah", "ayah", "father_name"],
    motherName: ["namaibu", "nama_ibu", "ibu", "mother_name"],
    academicYear: ["tahunajaran", "tahun_ajaran", "thnajaran", "thn_ajaran", "tahunakademik", "tahun_akademik", "academic_year", "tahunaer"],
    semester: ["semester", "smt", "term"],
    subjectName: ["matapelajaran", "mata_pelajaran", "mapel", "pelajaran", "subject_name", "subject"],
    score: ["nilai", "skor", "nilai_angka", "nilaiangka", "score", "grade"],
    notes: ["catatan", "keterangan", "deskripsi", "notes", "description"],
  };

  targetFields.forEach((field) => {
    const aliases = dictionary[field.key] || [field.key.toLowerCase()];
    const match = excelHeaders.find((h) => {
      const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return aliases.some((alias) => {
        const normA = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normH === normA || normH.includes(normA) || normA.includes(normH);
      });
    });
    if (match) {
      newMappings[field.key] = match;
    }
  });

  return newMappings;
}
