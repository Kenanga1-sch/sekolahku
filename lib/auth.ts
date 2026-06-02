/**
 * Client-side auth helper — replaces the server-side jose-based auth.
 * Decodes JWT from cookie for display purposes only.
 * Actual verification happens on the Golang backend.
 */

import type { UserRole } from "@/types";

export interface SessionData {
  user: {
    id: string;
    role: UserRole | string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

export function auth(): SessionData | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const infoCookie = cookies.find((c) => c.startsWith("user_info="));
  if (!infoCookie) return null;

  const jsonValue = decodeURIComponent(infoCookie.split("=")[1]);
  if (!jsonValue) return null;

  try {
    const data = JSON.parse(jsonValue);
    return {
      user: {
        id: data.id,
        role: data.role,
        email: data.email,
        name: data.name,
        phone: data.phone,
      },
    };
  } catch {
    return null;
  }
}
