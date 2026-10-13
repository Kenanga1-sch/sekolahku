// Tipe & helper murni untuk halaman binding (pengikatan) buku perpustakaan.
// Dipisah dari page agar logika normalisasi ISBN dapat diuji tanpa merender UI.

import type { DDCCategory } from "@/lib/library/ddc-mapping";

export interface CatalogData {
  title: string;
  author: string;
  publisher?: string;
  year?: number;
  isbn?: string;
  coverUrl?: string;
  subjects?: string[];
  ddcCategory?: DDCCategory;
  localFound?: boolean;
  totalExemplars?: number;
  description?: string;
}

/**
 * Normalisasi hasil scan barcode menjadi ISBN inti.
 *
 * Aturan:
 * - buang spasi/pemisah dari hasil decode
 * - buang add-on harga (EAN-13 + 5 digit) agar ISBN inti yang terbaca
 * - konversi UPC-A buku lama (0 + ISBN-10 + check) menjadi ISBN-10
 *
 * Mengembalikan ISBN yang sudah dinormalisasi (bisa tak valid) agar pemanggil
 * bisa memberi pesan yang tepat.
 */
export function normalizeISBNBarcode(code: string): { isbn: string; valid: boolean } {
  let raw = code.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (raw.length > 13 && (raw.startsWith("978") || raw.startsWith("979"))) {
    raw = raw.slice(0, 13);
  }
  if (raw.length === 12 && raw.startsWith("0")) {
    raw = raw.slice(1, 11);
  }
  const isIsbn13 = raw.length === 13 && /^97[89]/.test(raw);
  const isIsbn10 = raw.length === 10 && /^[0-9]{9}[0-9X]$/.test(raw);
  return { isbn: raw, valid: isIsbn13 || isIsbn10 };
}

/** Kunci cache AI: judul & penulis dinormalkan (trim + lowercase). */
export function aiCacheKey(title: string, author: string): string {
  return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`;
}
