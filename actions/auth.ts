/**
 * Client-side Auth Actions — no "use server" needed.
 * Communicates directly with Golang backend.
 */

const GO_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function loginAction(
  email: string,
  password: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const response = await fetch(`${GO_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return { error: "Username/email atau password salah." };
    }

    const data = await response.json();

    if (data.success && data.token) {
      // Set session cookie client-side
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      document.cookie = `session=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      return { success: true };
    }

    return { error: "Gagal memproses otentikasi" };
  } catch (e) {
    console.error("Auth Error:", e);
    return { error: "Terjadi kesalahan pada server" };
  }
}

export function logoutAction() {
  document.cookie = "session=; path=/; max-age=0";
  window.location.href = "/login";
}

export async function getSessionAction() {
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));

  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  if (!token) return null;

  try {
    // Decode JWT payload (client-side, no verification — just for display)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    };
  } catch {
    return null;
  }
}
