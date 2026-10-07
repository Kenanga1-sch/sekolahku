/**
 * cover-orient.ts — Deteksi & koreksi orientasi sampul buku (murni, teruji).
 *
 * Masalah: sampul difoto landscape (HP miring) tetapi bingkai tampilan
 * portrait 3:4 → gambar gepeng/salah orientasi. Web tidak bisa tahu arah
 * miring (kiri vs kanan), jadi:
 *  - deteksi: landscape bila width/height > LANDSCAPE_RATIO (1.25),
 *  - koreksi: putar +90° (searah jarum jam) sebagai tebakan default —
 *    arah yang benar untuk foto portrait yang diambil dengan HP miring
 *    ke kiri (kasus paling umum),
 *  - cadangan: tombol putar manual ±90° di UI bila tebakan salah.
 *
 * Sampul yang memang desain landscape (rasio ekstrem tapi disengaja)
 * tidak dipaksa: ambang 1.25 + pratinjau + tombol putar/undo di UI.
 */

/** Rasio w/h di atas ini dianggap foto miring (bukan desain landscape). */
export const LANDSCAPE_RATIO = 1.25;

/** True bila dimensi landscape dan cukup ekstrem untuk dikoreksi. */
export function needsRotation(width: number, height: number, ratio = LANDSCAPE_RATIO): boolean {
  if (!width || !height || width <= 0 || height <= 0) return false;
  return width / height > ratio;
}

/** Derajat putar berikutnya untuk tombol manual (90° searah jarum jam). */
export function nextRotation(currentDeg: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  return ((currentDeg + 90) % 360) as 0 | 90 | 180 | 270;
}

/**
 * Dimensi kanvas hasil putar: 90°/270° menukar w/h, 0°/180° tetap.
 * Dipakai UI untuk pratinjau tanpa menyentuh file.
 */
export function rotatedSize(
  width: number,
  height: number,
  deg: 0 | 90 | 180 | 270
): { width: number; height: number } {
  if (deg === 90 || deg === 270) return { width: height, height: width };
  return { width, height };
}
