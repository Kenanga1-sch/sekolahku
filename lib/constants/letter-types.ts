export interface LetterType {
  id: number;
  jenis_surat: string;
  kode_klasifikasi: string;
  kategori: string;
  format_nomor: string;
}

export const LETTER_TYPES: LetterType[] = [
  {
    "id": 1,
    "jenis_surat": "SK Pengangkatan PTK",
    "kode_klasifikasi": "400.3.5.01",
    "kategori": "Kepegawaian",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 2,
    "jenis_surat": "Surat Undangan",
    "kode_klasifikasi": "400.3.5.02",
    "kategori": "Umum",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 3,
    "jenis_surat": "Pelatihan, Bimtek, Sosialisasi",
    "kode_klasifikasi": "400.3.5.03",
    "kategori": "Kurikulum",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 4,
    "jenis_surat": "Surat Pernyataan",
    "kode_klasifikasi": "400.3.5.06",
    "kategori": "Umum",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 5,
    "jenis_surat": "Surat Tugas",
    "kode_klasifikasi": "400.3.5.08",
    "kategori": "Kepegawaian",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 6,
    "jenis_surat": "Surat Keterangan Pindah / Mutasi / Titip Belajar",
    "kode_klasifikasi": "400.3.5.09",
    "kategori": "Kesiswaan",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 7,
    "jenis_surat": "Surat Rekomendasi",
    "kode_klasifikasi": "400.3.5.10",
    "kategori": "Umum",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 8,
    "jenis_surat": "Surat Perintah Perjalanan Dinas (SPPD)",
    "kode_klasifikasi": "400.3.5.12",
    "kategori": "Kepegawaian",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 9,
    "jenis_surat": "Surat Pengantar",
    "kode_klasifikasi": "400.3.5.15",
    "kategori": "Umum",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 10,
    "jenis_surat": "Penilaian Akademik (Semester & Ujian)",
    "kode_klasifikasi": "400.3.11.1",
    "kategori": "Akademik",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 11,
    "jenis_surat": "Penilaian Non Akademik",
    "kode_klasifikasi": "400.3.11.2",
    "kategori": "Akademik",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  },
  {
    "id": 12,
    "jenis_surat": "Analisis dan Sistem Penilaian",
    "kode_klasifikasi": "400.3.11.3",
    "kategori": "Akademik",
    "format_nomor": "{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}"
  }
];
