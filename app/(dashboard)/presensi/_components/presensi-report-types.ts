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

/** Baris matriks kehadiran satu siswa untuk satu periode (bulanan). */
export interface StudentMatrix {
  studentId: string;
  studentName: string;
  nis: string;
  nisn?: string;
  className?: string;
  dailyStatus: Record<number, "H" | "S" | "I" | "A" | "-">;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
}

// 0=Minggu … 6=Sabtu (sesuai Date.getDay / dow di DayColumn).
// Dipakai bersama oleh tampilan layar (ScreenMatrix) & artefak cetak (PrintPage).
export const DOW_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
