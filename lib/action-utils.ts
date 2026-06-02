/**
 * Utility for handling API actions with consistent error reporting.
 */

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Wraps an async API call and returns a consistent ActionResponse.
 */
export async function handleAction<T>(
  promise: Promise<T>,
  successMessage?: string
): Promise<ActionResponse<T>> {
  try {
    const data = await promise;
    return {
      success: true,
      data,
      message: successMessage,
    };
  } catch (error) {
    console.error("Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui",
    };
  }
}

/**
 * Remove null or undefined fields from an object to reduce payload size.
 */
export function trimPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined && v !== "")
  ) as Partial<T>;
}
