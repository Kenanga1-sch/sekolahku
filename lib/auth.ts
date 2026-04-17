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
  };
}

export function auth(): SessionData | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  if (!token) return null;

  try {
    // Decode JWT payload (no verification — that's Go's job)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      user: {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
        name: payload.name,
      },
    };
  } catch {
    return null;
  }
}
