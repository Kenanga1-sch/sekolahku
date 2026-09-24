-- 000065_letter_types.up.sql
-- Tabel jenis surat: memindahkan konstanta LETTER_TYPES ke DB agar bisa CRUD
-- dari UI Admin. Data lama (dari kode) disemai di sini.

CREATE TABLE IF NOT EXISTS letter_types (
    id                 INTEGER PRIMARY KEY,
    jenis_surat        TEXT NOT NULL,
    kode_klasifikasi   TEXT NOT NULL DEFAULT '',
    kategori           TEXT NOT NULL DEFAULT 'Umum',
    format_nomor       TEXT NOT NULL DEFAULT '{nomor_urut}/{kode_klasifikasi}/{bulan_romawi}/{tahun}',
    is_active          INTEGER NOT NULL DEFAULT 1,
    urut               INTEGER NOT NULL DEFAULT 0,
    created_at         INTEGER NOT NULL DEFAULT 0,
    updated_at         INTEGER NOT NULL DEFAULT 0
);

-- Indeks untuk pencarian kategori.
CREATE INDEX IF NOT EXISTS idx_letter_types_kategori ON letter_types(kategori);
CREATE INDEX IF NOT EXISTS idx_letter_types_active ON letter_types(is_active, urut);

-- Seed dari lib/constants/letter-types.ts (id harus sama dengan konstanta).
INSERT OR IGNORE INTO letter_types (id, jenis_surat, kode_klasifikasi, kategori, format_nomor, is_active, urut, created_at, updated_at) VALUES
(1, 'SK Pengangkatan PTK', '400.3.5.01', 'Kepegawaian', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 1, 0, 0),
(2, 'Surat Undangan', '400.3.5.02', 'Umum', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 2, 0, 0),
(3, 'Pelatihan, Bimtek, Sosialisasi', '400.3.5.03', 'Kurikulum', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 3, 0, 0),
(4, 'Surat Pernyataan', '400.3.5.06', 'Umum', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 4, 0, 0),
(5, 'Surat Tugas', '400.3.5.08', 'Kepegawaian', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 5, 0, 0),
(6, 'Surat Keterangan Pindah / Mutasi / Titip Belajar', '400.3.5.09', 'Kesiswaan', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 6, 0, 0),
(7, 'Surat Rekomendasi', '400.3.5.10', 'Umum', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 7, 0, 0),
(8, 'Surat Perintah Perjalanan Dinas (SPPD)', '400.3.5.12', 'Kepegawaian', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 8, 0, 0),
(9, 'Surat Pengantar', '400.3.5.15', 'Umum', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 9, 0, 0),
(10, 'Penilaian Akademik (Semester & Ujian)', '400.3.11.1', 'Akademik', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 10, 0, 0),
(11, 'Penilaian Non Akademik', '400.3.11.2', 'Akademik', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 11, 0, 0),
(12, 'Analisis dan Sistem Penilaian', '400.3.11.3', 'Akademik', '{nomor_urut}/{kode_klasifikasi}/SDN1-KNG/{bulan_romawi}/{tahun}', 1, 12, 0, 0);
