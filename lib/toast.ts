// ==========================================
// Toast Utility
// ==========================================
// Wrapper around Sonner for consistent toast notifications

import { toast as sonnerToast } from "sonner";

/**
 * Show success toast
 */
export function showSuccess(message: string, description?: string) {
    sonnerToast.success(message, { description });
}

/**
 * Show error toast
 */
export function showError(message: string, description?: string) {
    sonnerToast.error(message, { description });
}

/**
 * Show warning toast
 */
export function showWarning(message: string, description?: string) {
    sonnerToast.warning(message, { description });
}

/**
 * Show info toast
 */
export function showInfo(message: string, description?: string) {
    sonnerToast.info(message, { description });
}

/**
 * Show loading toast with promise
 * Returns promise result for chaining
 */
export function showPromise<T>(
    promise: Promise<T>,
    options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: Error) => string);
    }
): Promise<T> {
    sonnerToast.promise(promise, options);
    return promise;
}

/**
 * Dismiss all toasts
 */
export function dismissAll() {
    sonnerToast.dismiss();
}

// Re-export original toast for custom usage
export { sonnerToast as toast };
