/**
 * Utility untuk menstandarisasi penamaan kelas
 * Mencegah duplikasi "Kelas Kelas 1" dan memastikan konsistensi tampilan
 */

/**
 * Normalisasi nama kelas untuk display
 * - Jika sudah ada prefix "Kelas", gunakan as-is
 * - Jika tidak, tambahkan prefix "Kelas"
 * 
 * @param name Nama kelas dari database (contoh: "1", "Kelas 2", "III-A")
 * @returns String yang ditambahkan prefix "Kelas" jika diperlukan
 */
export function formatClassName(name: string | number): string {
  const className = String(name).trim();
  
  // Cek apakah sudah memiliki prefix "Kelas" (case-insensitive)
  if (/^kelas\s+/i.test(className)) {
    return className;
  }
  
  // Tambahkan prefix "Kelas" dengan spasi
  return `Kelas ${className}`;
}

/**
 * Ekstrak nomor/id kelas dari string formatted
 * - "Kelas 1" → "1"
 * - "Kelas III-A" → "III-A"
 * 
 * @param formattedName Nama kelas dalam format UI (contoh: "Kelas 1")
 * @returns ID kelas asli
 */
export function extractClassId(formattedName: string): string {
  const match = formattedName.match(/^kelas\s+(.+)$/i);
  return match ? match[1] : formattedName;
}

/**
 * Normalize class name untuk pencarian di API
 * - Hilangkan spasi berlebih, konversi uppercase
 * - Digunakan untuk parameter query seperti `/api/classes?grade=1`
 * 
 * @param name Nama kelas yang akan dinormalisasi
 * @returns String yang siap untuk query API
 */
export function normalizeClassNameForApi(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '');
}
