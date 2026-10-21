/**
 * Auth actions — adapted for Static Export (output: "export").
 * These run in the browser and call the Go backend API.
 */

import { goDelete, goGet, goPost } from "@/lib/api-client";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return decodeURIComponent(found.split("=").slice(1).join("="));
}

function getCSRFToken(): string | null {
  return readCookie("csrf_token");
}

export async function loginAction(
  email: string,
  password: string,
  rememberMe = false
): Promise<{ error?: string; success?: boolean; user?: any; publicInfo?: any }> {
  try {
    const data = await goPost("/api/auth/login", { email, password, remember_me: rememberMe }, { skipRetry: true });

    if (data && (data as any).success) {
      // Info publik sesi (id, nama, role) disimpan backend di cookie
      // user_info saat login. localStorage sengaja tidak dipakai lagi —
      // nilainya bisa dimodifikasi klien dan sempat dipakai sebagai sumber
      // sesi utama, sehingga cukup diubah lewat DevTools untuk memalsukan
      // role di UI.
      return {
        success: true,
        user: (data as any).user,
        publicInfo: (data as any).public_info,
      };
    }

    return { error: (data as any).error || "Gagal memproses otentikasi" };
  } catch (e: any) {
    console.error("Auth Error:", e);
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}

export async function logoutAction() {
  try {
    const csrf = getCSRFToken();
    await goPost("/api/auth/logout", {}, {
      skipRetry: true,
      headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
    });
  } catch (e) {
    console.error("Logout error:", e);
  }
  
  if (typeof document !== "undefined") {
    document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    document.cookie = "user_info=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }
  
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("sekolahku_user");
  }
}

export async function getSessionAction() {
  if (typeof document === "undefined") return null;

  // Sumber sesi hanyalah cookie user_info yang ditulis backend saat login
  // (HttpOnly session = kebenaran sebenarnya, diverifikasi ulang di setiap
  // request API). localStorage tidak lagi dipercaya sebagai sumber sesi.
  const infoCookie = readCookie("user_info");
  if (!infoCookie) return null;

  try {
    const data = JSON.parse(decodeURIComponent(infoCookie).replace(/\+/g, " "));
    return {
      user: {
        id: data.id,
        role: data.role,
        email: data.email,
        name: data.name,
        image: data.image || undefined,
        // Hanya ada saat sesi di-impersonasi admin (hasil /api/auth/switch).
        // Dipakai UI untuk menampilkan "Kembali ke Akun Admin".
        impersonatedBy: data.imp || undefined,
        impersonatedByName: data.impName || undefined,
      },
    };
  } catch {
    return null;
  }
}

// Home route sesuai role — sama dengan logika redirect di halaman login.
function homeRouteForRole(role: string | undefined): string {
  if (role === "staff") return "/inventaris";
  if (role === "orangtua") return "/parent";
  return "/overview";
}

/**
 * Admin ganti ke akun lain (impersonation). Backend mereset cookie session +
 * user_info, jadi sesi "benar" berpindah. Hard redirect dipakai agar chat
 * socket provider remount dengan identitas baru — tanpa itu, guard
 * activeUserId di use-chat-socket akan melihat mismatch dan socket mati.
 */
export async function switchAccountAction(userId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const csrf = getCSRFToken();
    const data = await goPost(
      "/api/auth/switch",
      { userId },
      { skipRetry: true, headers: csrf ? { "X-CSRF-Token": csrf } : undefined },
    );

    if (data && (data as any).success) {
      const role = (data as any).user?.role;
      if (typeof window !== "undefined") {
        window.location.href = homeRouteForRole(role);
      }
      return { success: true };
    }

    return { error: (data as any).error || "Gagal mengganti akun" };
  } catch (e: any) {
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}

/**
 * Kembali ke akun admin asal (hanya jika sesi sedang di-impersonasi).
 * Backend memverifikasi klaim JWT imp — klien tidak bisa memalsukan.
 */
export async function returnToAdminAction(): Promise<{ error?: string; success?: boolean }> {
  try {
    const csrf = getCSRFToken();
    const data = await goPost(
      "/api/auth/return",
      {},
      { skipRetry: true, headers: csrf ? { "X-CSRF-Token": csrf } : undefined },
    );

    if (data && (data as any).success) {
      if (typeof window !== "undefined") {
        window.location.href = "/overview";
      }
      return { success: true };
    }

    return { error: (data as any).error || "Gagal kembali ke akun admin" };
  } catch (e: any) {
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}

// ===== Pendaftaran / login Google (semua role) =====

export interface GooglePendingInfo {
  email: string;
  name?: string;
  picture?: string;
  /** Role akun sekolah yang memakai email sama (kosong = email belum terdaftar). */
  matchedRole?: string;
  /** Nama akun yang cocok, bila ada. */
  matchedName?: string;
}

/** Identitas Google yang sedang menunggu verifikasi NISN (dari cookie tiket). */
export async function getGooglePendingAction(): Promise<GooglePendingInfo | null> {
  try {
    const data = await goGet<{
      email?: string;
      name?: string;
      picture?: string;
      matchedRole?: string;
      matchedName?: string;
    }>("/api/auth/google/pending", { skipRetry: true });
    if (!data?.email) return null;
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
      matchedRole: data.matchedRole,
      matchedName: data.matchedName,
    };
  } catch {
    return null;
  }
}

/**
 * Menyelesaikan pendaftaran Google: verifikasi NISN + tanggal lahir, lalu
 * backend menautkan identitas Google ke akun ortu yang sudah ada atau
 * membuat akun ortu baru tanpa password.
 */
export async function completeGoogleSignupAction(payload: {
  nisn: string;
  birthDate: string;
  relation?: string;
}): Promise<{ success?: boolean; error?: string; redirect?: string }> {
  try {
    const data = await goPost(
      "/api/auth/google/complete",
      payload,
      { skipRetry: true },
    );
    if (data && (data as any).success) {
      return { success: true, redirect: (data as any).redirect || "/parent" };
    }
    return { error: (data as any).error || "Gagal menyelesaikan pendaftaran" };
  } catch (e: any) {
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}

/**
 * Menautkan akun Google ke akun orang tua yang sedang login.
 * `ticket` tidak dikirim dari klien: backend membacanya dari cookie HttpOnly
 * yang diset saat callback OAuth.
 */
export async function linkGoogleAccountAction(): Promise<{ success?: boolean; error?: string; email?: string }> {
  try {
    const csrf = getCSRFToken();
    const data = await goPost(
      "/api/auth/google/link",
      {},
      { skipRetry: true, headers: csrf ? { "X-CSRF-Token": csrf } : undefined },
    );
    if (data && (data as any).success) {
      return { success: true, email: (data as any).email };
    }
    return { error: (data as any).error || "Gagal menautkan akun Google" };
  } catch (e: any) {
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}

/** Status tautan Google untuk akun yang sedang login. */
export async function getGoogleLinkStatusAction(): Promise<{
  linked?: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const data = await goGet<{ linked?: boolean; email?: string }>(
      "/api/auth/google/link",
      { skipRetry: true },
    );
    return { linked: Boolean(data?.linked), email: data?.email };
  } catch {
    return { linked: false };
  }
}

/**
 * Melepas tautan Google dari akun yang sedang login. Backend menolak untuk
 * akun tanpa password (akun orang tua hasil daftar Google) supaya pengguna
 * tidak terkunci dari akunnya.
 */
export async function unlinkGoogleAccountAction(): Promise<{ success?: boolean; error?: string }> {
  try {
    const csrf = getCSRFToken();
    const data = await goDelete(
      "/api/auth/google/link",
      { skipRetry: true, headers: csrf ? { "X-CSRF-Token": csrf } : undefined },
    );
    if (data && (data as any).success) {
      return { success: true };
    }
    return { error: (data as any).error || "Gagal melepas tautan Google" };
  } catch (e: any) {
    return { error: e.message || "Terjadi kesalahan pada server" };
  }
}
