/**
 * Auth actions — adapted for Static Export (output: "export").
 * These run in the browser and call the Go backend API.
 */

import { goPost } from "@/lib/api-client";

export async function loginAction(
  email: string,
  password: string
): Promise<{ error?: string; success?: boolean; user?: any; publicInfo?: any }> {
  try {
    const data = await goPost("/api/auth/login", { email, password });

    if (data && (data as any).success) {
      return { 
        success: true, 
        user: (data as any).user,
        publicInfo: (data as any).public_info
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
  
  // Clear cookies manually just in case
  if (typeof document !== "undefined") {
    document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    document.cookie = "user_info=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }
}

export async function getSessionAction() {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";").map((c) => c.trim());
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
