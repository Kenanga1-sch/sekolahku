/**
 * Resolver URL untuk aset upload.
 *
 * Folder PUBLIK (gallery, announcements, library, staff, logo, stamp) tetap
 * disajikan oleh route anonim /uploads/* — memang ditujukan untuk dipajang
 * di halaman publik (foto guru, galeri, sampul buku).
 *
 * Folder PRIVAT (spmb, alumni, arsip, eoffice, chat, tugas, profiles,
 * inventory, bank-soal) hanya bisa diakses lewat endpoint terautentikasi
 * /api/files/* yang memeriksa JWT + role per folder. Meneruskan path privat
 * ke /uploads/* akan menghasilkan 404.
 */

const PUBLIC_UPLOAD_FOLDERS = new Set([
  "gallery",
  "announcements",
  "library",
  "staff",
  "logo",
  "stamp",
]);

/**
 * Ubah path tersimpan (format "/uploads/<folder>/..." atau "<folder>/...")
 * menjadi URL yang bisa diakses sesuai klasifikasi foldernya.
 */
export function resolveUploadUrl(storedPath?: string | null): string | undefined {
  if (!storedPath) return undefined;

  // URL/data absolut atau path root (logo, sw.js) diteruskan apa adanya.
  if (/^(https?:)?\/\//.test(storedPath) || storedPath.startsWith("data:")) {
    return storedPath;
  }

  // Normalisasi: hilangkan leading "/" dan prefix "uploads/".
  let rel = storedPath.replace(/^\/+/, "");
  if (rel.startsWith("uploads/")) rel = rel.slice("uploads/".length);

  // Klasifikasi folder tingkat atas.
  const top = rel.split("/")[0];
  if (PUBLIC_UPLOAD_FOLDERS.has(top)) {
    return `/uploads/${rel}`;
  }

  // Folder privat: lewat endpoint terautentikasi.
  return `/api/files/uploads/${rel}`;
}
