/**
 * Auth actions — adapted for Static Export (output: "export").
 * These run in the browser and call the Go backend API.
 */

import { goPost } from "@/lib/api-client";

function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function loginAction(
  email: string,
  password: string
): Promise<{ error?: string; success?: boolean; user?: any; publicInfo?: any }> {
  try {
    const data = await goPost("/api/auth/login", { email, password });

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
    await goPost("/api/auth/logout", {});
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

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (sessionCookie) {
    const token = sessionCookie.split("=")[1];
    const payload = parseJwt(token);
    if (payload) {
      return {
        user: {
          id: payload.sub,
          role: payload.role,
          email: payload.email,
          name: payload.name,
        },
      };
    }
  }

  const infoCookie = cookies.find((c) => c.startsWith("user_info="));
  if (!infoCookie) return null;

  const jsonValue = decodeURIComponent(infoCookie.split("=")[1].replace(/\+/g, " "));
  if (!jsonValue) return null;

  try {
    const data = JSON.parse(jsonValue);
    return {
      user: {
        id: data.id,
        role: data.role,
        email: data.email,
        name: data.name,
        fullName: data.fullName,
        username: data.username,
        phone: data.phone,
        image: data.image,
      },
    };
  } catch {
    return null;
  }
}
