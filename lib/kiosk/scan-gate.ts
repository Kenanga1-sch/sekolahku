/**
 * Gerbang scan untuk kiosk (perpustakaan & presensi).
 *
 * Terpisah dari komponen supaya keputusan "scan ini diterima atau ditolak"
 * bisa diuji tanpa DOM. Kebijakan:
 *   - ada transaksi yang sedang berjalan  → tolak (in-flight)
 *   - kode sama dalam 3 detik            → tolak diam-diam (anti dobel baca)
 *   - baru terima scan < 300 ms          → tolak (anti-blink frame kamera)
 *   - selain itu                         → TERIMA, tanpa suara error
 *
 * Sebelumnya kiosk memakai cooldown 1500 ms yang membunyikan "bip error",
 * sehingga operator mengira tidak terbaca dan scan ulang → jeda antar scan
 * terasa lama padahal backend hanya ~1-5 ms.
 */

/** Jarak minimum antar scan yang diterima (ms). */
export const SCAN_COOLDOWN_MS = 300;

/** Kode identik dianggap duplikat selama jendela ini (ms). */
export const SAME_CODE_BLOCK_MS = 3000;

export type ScanGateReason = "in-flight" | "same-code" | "too-fast";

export interface ScanGateInput {
  /** Timestamp sekarang (Date.now()). */
  now: number;
  /** True bila transaksi sebelumnya masih berjalan. */
  inFlight: boolean;
  /** Kode hasil scan (QR/barcode). */
  code: string;
  /** Kode terakhir yang diterima (null bila belum pernah). */
  lastCode: string | null;
  /** Waktu kode terakhir diterima. */
  lastCodeAt: number;
}

/**
 * Nilai kembalian `null` berarti scan diterima; selain itu alasan penolakan
 * (semua penolakan bersifat diam-diam — tanpa buzzer).
 */
export function evaluateScan(input: ScanGateInput): ScanGateReason | null {
  const { now, inFlight, code, lastCode, lastCodeAt } = input;

  if (inFlight) return "in-flight";
  if (lastCode !== null && lastCode === code && now - lastCodeAt < SAME_CODE_BLOCK_MS) {
    return "same-code";
  }
  if (now - lastCodeAt < SCAN_COOLDOWN_MS) return "too-fast";
  return null;
}
