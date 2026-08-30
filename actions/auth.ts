/**
 * Auth actions — adapted for Static Export (output: "export").
 * These run in the browser and call the Go backend API.
 */

import { goPost } from "@/lib/api-client";

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
      const publicInfo = (data as any).public_info;
      if (publicInfo && typeof window !== "undefined") {
        localStorage.setItem("sekolahku_user", JSON.stringify(publicInfo));
      }
      return { 
        success: true, 
        user: (data as any).user,
        publicInfo: publicInfo
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

  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("sekolahku_user");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return { user: data };
      } catch {}
    }
  }

  // Fallback: baca cookie user_info (non-sensitive, dikirim backend saat login).
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
      },
    };
  } catch {
    return null;
  }
}
