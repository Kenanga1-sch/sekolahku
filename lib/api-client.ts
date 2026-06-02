/**
 * API Client for direct communication with Golang backend.
 * Integrated with Resilience Patterns: Retry, Circuit Breaker, and Cache.
 */

import { withRetry, RetryPresets } from "./retry";
import { withCircuitBreaker } from "./circuit-breaker";
import { getFromCache, setCache, CacheTTL } from "./cache";
import { logger } from "./logger";

const GO_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface FetchOptions extends RequestInit {
  ttl?: number;
  forceRefresh?: boolean;
  skipRetry?: boolean;
  skipCircuitBreaker?: boolean;
  circuitName?: string;
}

/**
 * Enhanced fetch with resilience and caching
 */
export async function goFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    ttl,
    forceRefresh,
    skipRetry,
    skipCircuitBreaker,
    circuitName,
    ...fetchOptions
  } = options;

  const url = `${GO_API_URL}${endpoint}`;
  const method = fetchOptions.method || "GET";

  // 1. Caching (GET requests only)
  if (method === "GET" && ttl && !forceRefresh) {
    const cached = getFromCache<T>(endpoint);
    if (cached !== null) {
      return cached;
    }
  }

  const performFetch = async () => {
    const defaultHeaders: Record<string, string> = {};

    // If body is not FormData, set JSON content type
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...fetchOptions.headers,
      },
      credentials: "include",
    });

    if (!res.ok) {
      // Auto-redirect on 401 (expired/invalid token)
      if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
        document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        throw new Error("Session expired");
      }
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      const error = new Error(errorData.error || `API Error: ${res.status}`);
      (error as any).status = res.status;
      (error as any).data = errorData;
      throw error;
    }

    const data = await res.json();

    // Store in cache if TTL is provided
    if (method === "GET" && ttl) {
      setCache(endpoint, data, ttl);
    }

    return data;
  };

  // 2. Wrap with Resilience Patterns
  // Circuit breaker is opt-in since this is a local backend
  const wrappedFetch = async () => {
    if (skipRetry) {
      return performFetch();
    }
    return withRetry(performFetch, {
      ...RetryPresets.STANDARD,
      onRetry: (attempt, error) => {
        logger.warn(`Retrying API call to ${endpoint} (Attempt ${attempt})`, { error });
      }
    });
  };

  // Only use circuit breaker when explicitly requested (opt-in)
  if (circuitName) {
    return withCircuitBreaker(circuitName, wrappedFetch);
  }

  return wrappedFetch();
}

// Convenience methods
export const goGet = <T = any>(endpoint: string, options?: FetchOptions) =>
  goFetch<T>(endpoint, { ...options, method: "GET" });

export const goPost = <T = any>(endpoint: string, body?: unknown, options?: FetchOptions) =>
  goFetch<T>(endpoint, {
    ...options,
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const goPut = <T = any>(endpoint: string, body?: unknown, options?: FetchOptions) =>
  goFetch<T>(endpoint, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });

export const goDelete = <T = any>(endpoint: string, options?: FetchOptions) =>
  goFetch<T>(endpoint, { ...options, method: "DELETE" });

export const goPatch = <T = any>(endpoint: string, body?: unknown, options?: FetchOptions) =>
  goFetch<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export { CacheTTL };

