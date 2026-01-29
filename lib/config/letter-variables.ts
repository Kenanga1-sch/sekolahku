export const LETTER_VARIABLES = {
  Siswa: [
    { label: "Nama Lengkap", value: "{{siswa_nama}}" },
    { label: "NIS", value: "{{siswa_nis}}" },
    { label: "NISN", value: "{{siswa_nisn}}" },
    { label: "Kelas Saat Ini", value: "{{siswa_kelas}}" },
    { label: "Jenis Kelamin", value: "{{siswa_jenis_kelamin}}" },
    { label: "Tempat Lahir", value: "{{siswa_tempat_lahir}}" },
    { label: "Tanggal Lahir", value: "{{siswa_tanggal_lahir}}" },
    { label: "Tanggal Lahir (Indo)", value: "{{siswa_tanggal_lahir_indo}}" },
    { label: "Alamat", value: "{{siswa_alamat}}" },
    { label: "Nama Orang Tua/Wali", value: "{{siswa_nama_wali}}" },
    { label: "No. HP Orang Tua", value: "{{siswa_no_hp_wali}}" },
  ],
  Guru: [
    { label: "Nama Lengkap", value: "{{guru_nama}}" },
    { label: "NIP", value: "{{guru_nip}}" },
    { label: "Jabatan", value: "{{guru_jabatan}}" },
  ],
  Sekolah: [
    { label: "Nama Sekolah", value: "{{sekolah_nama}}" },
    { label: "NPSN", value: "{{sekolah_npsn}}" },
    { label: "Alamat Sekolah", value: "{{sekolah_alamat}}" },
    { label: "Kota/Kabupaten", value: "{{sekolah_kota}}" },
    { label: "No. Telepon", value: "{{sekolah_telepon}}" },
    { label: "Email Sekolah", value: "{{sekolah_email}}" },
    { label: "Website", value: "{{sekolah_website}}" },
    { label: "Nama Kepala Sekolah", value: "{{kepala_sekolah_nama}}" },
    { label: "NIP Kepala Sekolah", value: "{{kepala_sekolah_nip}}" },
  ],
  Umum: [
    { label: "Tanggal Hari Ini", value: "{{tanggal_hari_ini}}" },
    { label: "Tanggal Surat", value: "{{tanggal_surat}}" },
    { label: "No. Surat Otomatis", value: "{{nomor_surat_otomatis}}" },
    { label: "Nomor Surat", value: "{{nomor_surat}}" },
    { label: "Tahun Ajaran", value: "{{tahun_ajaran}}" },
  ],
  Manual: [
    { label: "Perihal Surat", value: "{{perihal_surat}}" },
    { label: "Keperluan", value: "{{keperluan}}" },
    { label: "Hari/Tanggal Acara", value: "{{hari_acara}}" },
    { label: "Waktu Acara", value: "{{waktu_acara}}" },
    { label: "Tempat Acara", value: "{{tempat_acara}}" },
  ]
};

// Start making a flat list for easy validation
export const FLATTENED_VARIABLES = Object.values(LETTER_VARIABLES)
  .flat()
  .map(v => v.value);
