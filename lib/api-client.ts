/**
 * API Client for direct communication with Golang backend.
 * No more Next.js proxy — all requests go directly to Go.
 */

const GO_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function goFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GO_API_URL}${endpoint}`;

  const defaultHeaders: Record<string, string> = {};

  // If body is not FormData, set JSON content type
  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  // Attach JWT from cookie for authenticated requests
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";").map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith("session="));
    if (sessionCookie) {
      defaultHeaders["Authorization"] = `Bearer ${sessionCookie.split("=")[1]}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `API Error: ${res.status}`);
  }

  return res.json();
}

// Convenience methods
export const goGet = <T = unknown>(endpoint: string) =>
  goFetch<T>(endpoint, { method: "GET" });

export const goPost = <T = unknown>(endpoint: string, body?: unknown) =>
  goFetch<T>(endpoint, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const goPut = <T = unknown>(endpoint: string, body?: unknown) =>
  goFetch<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const goDelete = <T = unknown>(endpoint: string) =>
  goFetch<T>(endpoint, { method: "DELETE" });

export const goPatch = <T = unknown>(endpoint: string, body?: unknown) =>
  goFetch<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

