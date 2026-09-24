/**
 * letter-number-format.ts — Formatter nomor surat (mirror dari Go).
 *
 * Logika ini menyalin `formatLetterNumber` di
 * go-backend/internal/repository/eoffice_repo.go agar nomor yang ditampilkan
 * di klien (pratinjau) identik dengan yang tercatat di backend.
 *
 * Placeholder yang didukung:
 *   {kode_klasifikasi} {nomor_urut} {nomor_urut_2} {nomor_urut_3} {nomor_urut_4}
 *   {nomor_urut_raw} {nomor_raw} {no_raw} {nomor} {no}
 *   {bulan} {bulan_romawi} {bulan_angka} {tahun}
 */

import { BULAN_INDO } from "@/lib/letter-render-shared";

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function monthRoman(month1to12: number): string {
  const idx = month1to12 - 1;
  if (idx < 0 || idx >= ROMAWI.length) return "I";
  return ROMAWI[idx];
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/**
 * Menghasilkan nomor surat dari pola + nomor urut + kode klasifikasi + tanggal.
 * Bila pola kosong, gunakan pola default Permendagri-ish.
 */
export function formatLetterNumber(
  pattern: string,
  sequence: number,
  classificationCode: string,
  date: Date
): string {
  const p = pattern && pattern.trim() ? pattern : "{nomor_urut}/{kode_klasifikasi}/{bulan_romawi}/{tahun}";
  const year = String(date.getFullYear());
  const monthNum = date.getMonth() + 1;
  const month = monthRoman(monthNum);
  const monthNumeric = pad(monthNum, 2);

  return p
    .replaceAll("{kode_klasifikasi}", classificationCode)
    .replaceAll("{nomor_urut_raw}", String(sequence))
    .replaceAll("{nomor_raw}", String(sequence))
    .replaceAll("{no_raw}", String(sequence))
    .replaceAll("{nomor_urut_2}", pad(sequence, 2))
    .replaceAll("{nomor_urut_3}", pad(sequence, 3))
    .replaceAll("{nomor_urut_4}", pad(sequence, 4))
    .replaceAll("{nomor_urut}", pad(sequence, 3))
    .replaceAll("{nomor}", pad(sequence, 3))
    .replaceAll("{no}", pad(sequence, 3))
    .replaceAll("{bulan_angka}", monthNumeric)
    .replaceAll("{bulan}", month)
    .replaceAll("{bulan_romawi}", month)
    .replaceAll("{tahun}", year);
}

/** Daftar placeholder untuk membantu pengguna di UI. */
export const LETTER_NUMBER_PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: "{nomor_urut}", desc: "Nomor urut (3 digit, mis. 001)" },
  { token: "{kode_klasifikasi}", desc: "Kode klasifikasi jenis surat" },
  { token: "{bulan_romawi}", desc: "Bulan angka Romawi (I–XII)" },
  { token: "{tahun}", desc: "Tahun 4 digit" },
  { token: "{bulan_angka}", desc: "Bulan 2 digit (01–12)" },
];

export { BULAN_INDO };
