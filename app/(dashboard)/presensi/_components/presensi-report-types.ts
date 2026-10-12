// Tipe bersama untuk laporan presensi (dipakai tab utama & komponen terpisah).
// Dipisah agar sub-komponen bisa diimpor tanpa menyeret seluruh tab.

export interface StudentAttendanceSummary {
  academicYear: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  totalDays: number;
}

/** Referensi siswa ringkas untuk pembukaan modal detail. */
export interface StudentRef {
  id: string;
  name: string;
  nis: string;
  className: string;
}
