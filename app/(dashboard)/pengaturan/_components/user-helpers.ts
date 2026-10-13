// Helper bersama modul Pengaturan (tab-users) — dipakai tabel & dialog profil.

/** Format tanggal dibuat (ISO string) → tanggal lokal id-ID; "-" bila kosong/tak valid. */
export function formatCreatedDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
}
