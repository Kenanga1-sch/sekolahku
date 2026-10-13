// Helper murni generator surat (diekstrak dari surat/buat/page.tsx).
// Refactor — zero behavior change.

import { format } from "date-fns";
import { id } from "date-fns/locale";

export const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function formatLetterNumber(formatPattern: string | undefined, sequence: number, classificationCode: string, date = new Date()) {
  const padded3 = String(sequence).padStart(3, "0");
  const padded2 = String(sequence).padStart(2, "0");
  const padded4 = String(sequence).padStart(4, "0");
  const rawSeq = String(sequence);
  const year = String(date.getFullYear());
  const month = romanMonths[date.getMonth()];
  const monthNumeric = String(date.getMonth() + 1).padStart(2, "0");

  return (formatPattern || "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}")
    .replaceAll("{kode_klasifikasi}", classificationCode)
    .replaceAll("{nomor_urut_raw}", rawSeq)
    .replaceAll("{nomor_raw}", rawSeq)
    .replaceAll("{no_raw}", rawSeq)
    .replaceAll("{nomor_urut_2}", padded2)
    .replaceAll("{nomor_urut_3}", padded3)
    .replaceAll("{nomor_urut_4}", padded4)
    .replaceAll("{nomor_urut}", padded3)
    .replaceAll("{nomor}", padded3)
    .replaceAll("{no}", padded3)
    .replaceAll("{bulan_angka}", monthNumeric)
    .replaceAll("{bulan}", month)
    .replaceAll("{bulan_romawi}", month)
    .replaceAll("{tahun}", year);
}

export function recipientLabel(recipient: any) {
  return recipient?.fullName || recipient?.name || recipient?.email || "Manual";
}

export function mergeRecipientData(data: any, recipient: any, targetType: string) {
  if (targetType === "STUDENT") {
    data.siswa_nama = recipient.name || recipient.fullName || "";
    data.siswa_nis = recipient.nis || "-";
    data.siswa_nisn = recipient.nisn || "-";
    data.siswa_kelas = recipient.className || "";
    data.siswa_jenis_kelamin = recipient.gender === "L" ? "Laki-laki" : "Perempuan";
    data.siswa_tempat_lahir = recipient.birthPlace || "";

    if (recipient.birthDate) {
      const bDate = new Date(recipient.birthDate);
      data.siswa_tanggal_lahir = format(bDate, "d MMMM yyyy", { locale: id });
      data.siswa_tanggal_lahir_indo = data.siswa_tanggal_lahir;
    }
    data.siswa_alamat = recipient.address || "";
    data.siswa_nik = recipient.nik || "-";
    data.siswa_agama = recipient.religion || "-";
    data.siswa_nama_ayah = recipient.fatherName || "";
    data.siswa_nama_ibu = recipient.motherName || "";
    data.siswa_nama_wali = recipient.parentName || recipient.guardianName || "";
    data.siswa_no_hp_wali = recipient.parentPhone || "";
    data.siswa_no_hp = recipient.parentPhone || "";
  } else {
    data.penerima_nama = recipient.fullName || recipient.name || "";
    data.penerima_nip = recipient.nip || "-";
    data.penerima_jabatan = recipient.position || recipient.jobType || recipient.role || "";
    data.guru_nama = data.penerima_nama;
    data.guru_nip = data.penerima_nip;
    data.guru_jabatan = data.penerima_jabatan;
  }
}
