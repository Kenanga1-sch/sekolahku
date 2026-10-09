/**
 * Format nama GTK: gabungan nama + gelar menjadi "Nama, Gelar".
 *
 * `employee_details.name` disimpan TANPA gelar, gelar di kolom `degree`
 * terpisah — semua tampilan nama GTK (kartu, daftar, surat, selector)
 * wajib melewati helper ini supaya gelar selalu ikut. Konsumen berbasis
 * `users.name` (laporan presensi, eoffice, tabungan, dst.) sudah digabung
 * di sumber (migrasi 000074 + LinkEmployeeToUser/GenerateAccounts/
 * UpdateEmployee) — tetap aman memakai helper ini (degree kosong → name).
 */
export function formatNamaGtk(name?: string | null, degree?: string | null): string {
  const n = (name || "").trim();
  const d = (degree || "").trim();
  if (!d) return n;
  if (!n) return d;
  return `${n}, ${d}`;
}
