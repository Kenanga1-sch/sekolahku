// ==========================================
// HTTP Fetch Utilities
// ==========================================
// Timeout, retry, and enhanced fetch functionality

interface FetchWithTimeoutOptions extends RequestInit {
    timeout?: number;  // Timeout in milliseconds
}

/**
 * Fetch with configurable timeout
 */
export async function fetchWithTimeout(
    url: string,
    options: FetchWithTimeoutOptions = {}
): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ==========================================
// Retry Logic
// ==========================================

interface RetryOptions {
    maxAttempts?: number;
    baseDelay?: number;     // Base delay in ms
    maxDelay?: number;      // Maximum delay between retries
    backoffFactor?: number; // Exponential factor
    retryOn?: (error: Error, attempt: number) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryOn'>> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
};

/**
 * Execute an async function with exponential backoff retry
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts,
        baseDelay = DEFAULT_RETRY_OPTIONS.baseDelay,
        maxDelay = DEFAULT_RETRY_OPTIONS.maxDelay,
        backoffFactor = DEFAULT_RETRY_OPTIONS.backoffFactor,
        retryOn,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt === maxAttempts) {
                break;
            }

            if (retryOn && !retryOn(lastError, attempt)) {
                break;
            }

            // Calculate delay with exponential backoff + jitter
            const delay = Math.min(
                baseDelay * Math.pow(backoffFactor, attempt - 1) + Math.random() * 1000,
                maxDelay
            );

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Fetch with timeout and retry
 */
export async function fetchWithRetry(
    url: string,
    options: FetchWithTimeoutOptions & RetryOptions = {}
): Promise<Response> {
    const { maxAttempts, baseDelay, maxDelay, backoffFactor, retryOn, ...fetchOptions } = options;

    return withRetry(
        () => fetchWithTimeout(url, fetchOptions),
        {
            maxAttempts: maxAttempts ?? 3,
            baseDelay: baseDelay ?? 1000,
            maxDelay,
            backoffFactor,
            retryOn: retryOn ?? ((error) => {
                // Retry on network errors, not on 4xx client errors
                if (error.name === 'AbortError') return true;  // Timeout
                if (error.message.includes('fetch')) return true;  // Network error
                return false;
            }),
        }
    );
}

// ==========================================
// Helpers
// ==========================================

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if response is successful (2xx status)
 */
export function isSuccessResponse(response: Response): boolean {
    return response.status >= 200 && response.status < 300;
}

/**
 * Parse JSON safely with error handling
 */
export async function safeJsonParse<T>(response: Response): Promise<T | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}
