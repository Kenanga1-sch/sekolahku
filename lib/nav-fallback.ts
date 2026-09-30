/**
 * nav-fallback.ts — Navigasi "Kembali" untuk halaman error/404.
 *
 * Perilaku:
 * - Kembali ke halaman sebelumnya bila ada riwayat (router.back()).
 * - Bila tidak ada riwayat (halaman dibuka langsung), fallback ke beranda
 *   dashboard ("/") bila sudah login, atau ke "/login" bila belum.
 *
 * Deteksi login memakai cookie `user_info` (non-HttpOnly) sehingga aman
 * dipanggil dari mana pun, termasuk `global-error` yang berada di luar
 * provider React.
 */

const AUTH_INFO_COOKIE = "user_info";

/** True bila cookie user_info ada (indikasi sesi login). */
export function isAuthenticatedClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${AUTH_INFO_COOKIE}=`));
}

/** Beranda yang tepat sesuai status login. */
export function homeFallback(): string {
  return isAuthenticatedClient() ? "/" : "/login";
}

/** True bila ada riwayat navigasi di tab ini. */
export function hasHistory(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.history as History & { state?: { idx?: number } };
  // Next.js menandai indeks riwayat pada state; idx > 0 berarti ada halaman
  // sebelumnya. Fallback ke referrer same-origin bila state tak tersedia.
  if (typeof nav.state?.idx === "number") return nav.state.idx > 0;
  return !!document.referrer && document.referrer.startsWith(window.location.origin);
}

/**
 * Kembali ke halaman sebelumnya, atau ke beranda (login-aware) bila tak ada
 * riwayat. Selalu mengembalikan tujuan yang dipakai (untuk pengujian).
 */
export function goBackOrHome(): string {
  if (hasHistory()) {
    window.history.back();
    return "__back__";
  }
  const dest = homeFallback();
  window.location.assign(dest);
  return dest;
}
