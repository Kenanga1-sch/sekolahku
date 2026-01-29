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
    "jenis_surat": "Surat Keterangan Berkelakuan Baik",
    "kode_klasifikasi": "400.3.5.1",
    "kategori": "Kesiswaan",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
    "id": 2,
    "jenis_surat": "Surat Keterangan Aktif Siswa",
    "kode_klasifikasi": "400.3.5.1",
    "kategori": "Kesiswaan",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
    "id": 3,
    "jenis_surat": "Surat Tugas Guru (Pelatihan/Workshop)",
    "kode_klasifikasi": "400.3.5.3",
    "kategori": "GTK",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
    "id": 4,
    "jenis_surat": "SK Pembagian Tugas Mengajar",
    "kode_klasifikasi": "400.3.5.1",
    "kategori": "Akademik",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
    "id": 5,
    "jenis_surat": "Surat Pengantar Kenaikan Pangkat",
    "kode_klasifikasi": "800.1.3.2",
    "kategori": "Kepegawaian",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
    "id": 6,
    "jenis_surat": "Surat Perintah Perjalanan Dinas (SPPD)",
    "kode_klasifikasi": "800.1.11.1",
    "kategori": "Kepegawaian",
    "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  // Additional from specification
  {
      "id": 7,
      "jenis_surat": "Surat Pindah Sekolah (Mutasi Siswa)",
      "kode_klasifikasi": "400.3.5.1",
      "kategori": "Kesiswaan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 8,
      "jenis_surat": "Jadwal Pelajaran & Kalender Akademik",
      "kode_klasifikasi": "400.3.5.1",
      "kategori": "Akademik",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 9,
      "jenis_surat": "Undangan Sosialisasi Program Sekolah",
      "kode_klasifikasi": "400.3.5.3",
      "kategori": "Kesiswaan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 10,
      "jenis_surat": "Surat Tugas Siswa Lomba",
      "kode_klasifikasi": "400.3.5.4",
      "kategori": "Kesiswaan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 11,
      "jenis_surat": "Piagam Penghargaan Siswa Berprestasi",
      "kode_klasifikasi": "400.3.5.4",
      "kategori": "Kesiswaan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 12,
      "jenis_surat": "SK Tim Manajemen BOS / SPJ",
      "kode_klasifikasi": "400.3.5.5",
      "kategori": "Keuangan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 13,
      "jenis_surat": "Surat Keterangan Penerima PIP/KIP",
      "kode_klasifikasi": "400.3.5.6",
      "kategori": "Kesiswaan",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 14,
      "jenis_surat": "Surat Izin Sakit/Cuti Guru",
      "kode_klasifikasi": "800.1.11.2",
      "kategori": "Kepegawaian",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  },
  {
      "id": 15,
      "jenis_surat": "Undangan Rapat Dinas / Orang Tua",
      "kode_klasifikasi": "005",
      "kategori": "Umum",
      "format_nomor": "{kode_klasifikasi}/{nomor_urut}-SD/{bulan_romawi}/{tahun}"
  }
];
