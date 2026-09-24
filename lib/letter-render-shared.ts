/**
 * letter-render-shared.ts — Util murni (tanpa React/DOM) yang dipakai bersama
 * oleh semua renderer surat modular: PDF (@react-pdf/renderer), DOCX (docx),
 * dan HTML cetak.
 *
 * Prinsip: logika substitusi variabel, format tanggal, dan pemetaan font
 * HANYA didefinisikan sekali di sini agar ketiga renderer menghasilkan
 * output yang konsisten.
 */

/** Nama bulan Indonesia. */
export const BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Format ISO date (yyyy-mm-dd) → "17 Agustus 2025". */
export function formatTanggalIndo(iso: string): string {
  if (!iso) return "";
  // Terima "yyyy-mm-dd" (hindari pergeseran timezone) maupun ISO penuh.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  let d: Date;
  if (m) {
    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else {
    d = new Date(iso);
  }
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Mengganti {{variabel}} dengan nilai yang tersedia; sisakan placeholder bila
 * tidak ada nilainya (agar pengguna tahu ada variabel yang belum terisi).
 */
export function substitute(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v !== undefined && v !== "" ? v : m;
  });
}

/** Mengubah nama font Indonesia → font PDF bawaan yang paling dekat. */
export function mapFont(family: string): string {
  const f = (family || "").toLowerCase();
  if (f.includes("arial") || f.includes("helvetica") || f.includes("sans")) {
    return "Helvetica";
  }
  if (f.includes("courier") || f.includes("mono")) return "Courier";
  if (f.includes("bookman") || f.includes("georgia")) return "Times-Roman";
  return "Times-Roman";
}

/** Apakah teks terlihat kosong (hanya whitespace / tag HTML kosong)? */
export function isEmptyText(v: unknown): boolean {
  const s = asString(v).trim();
  if (!s) return true;
  // Anggap kosong bila hanya tag HTML tanpa teks (mis. "<p></p>").
  if (/^<[^>]*>$/.test(s)) return true;
  return s.replace(/<[^>]*>/g, "").trim() === "";
}

/** Menggabungkan tempat + tanggal menjadi "Indramayu, 17 Agustus 2025". */
export function tempatTanggal(tempat: string, iso: string): string {
  const t = asString(tempat).trim();
  const d = iso ? formatTanggalIndo(iso) : "";
  return [t, d].filter(Boolean).join(", ");
}
