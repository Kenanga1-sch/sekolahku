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

/**
 * Keputusan sampul untuk satu katalog tujuan.
 *
 * - coverUrl: URL sampul yang boleh dikirim ke server (undefined = tanpa
 *   sampul; jangan kirim string kosong).
 * - coverOverwrite: true bila sampul itu JUSTRU diunggah user untuk
 *   judul ini pada sesi ini, jadi server boleh menimpa sampul lama.
 */
export interface CoverState {
  coverUrl?: string;
  coverOverwrite: boolean;
}

export interface ResolveCoverInput {
  /** Sampul hasil unggahan/pindai/rotasi milik judul ini (bila ada). */
  uploadedUrl?: string | null;
  /** Sampul milik kandidat/katalog yang dipilih user. */
  ownedUrl?: string | null;
  /** true = sedang membuat judul baru (bukan menambah eksemplar). */
  isNewTitle: boolean;
}

/**
 * Tentukan sampul untuk katalog tujuan.
 *
 * Satu ISBN boleh dipakai banyak judul, jadi aturan utamanya: sampul
 * milik judul lain tidak boleh diwarisi judul baru (bug lama: judul baru
 * memakai sampul judul pertama).
 *
 * 1. Sampul hasil unggahan pada sesi ini -> pakai apa adanya + overwrite.
 * 2. Judul baru -> jangan mewarisi sampul judul lain.
 * 3. Kandidat yang dipilih user -> sampul miliknya sendiri; server hanya
 *    mengisinya bila katalog itu belum punya sampul.
 */
export function resolveCoverState(input: ResolveCoverInput): CoverState {
  const uploaded = (input.uploadedUrl || "").trim();
  if (uploaded) return { coverUrl: uploaded, coverOverwrite: true };
  if (input.isNewTitle) return { coverUrl: undefined, coverOverwrite: false };
  const owned = (input.ownedUrl || "").trim();
  if (owned) return { coverUrl: owned, coverOverwrite: false };
  return { coverUrl: undefined, coverOverwrite: false };
}
