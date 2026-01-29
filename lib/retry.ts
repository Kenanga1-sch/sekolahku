// ==========================================
// Retry Utility
// ==========================================
// Automatic retry with exponential backoff for transient errors

import { logger } from "./logger";

// ==========================================
// Types
// ==========================================

export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Initial delay in ms before first retry */
    initialDelayMs: number;
    /** Maximum delay in ms between retries */
    maxDelayMs: number;
    /** Multiplier for exponential backoff */
    backoffMultiplier: number;
    /** Function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Called before each retry attempt */
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

// ==========================================
// Default Configuration
// ==========================================

const defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
};

// ==========================================
// Error Classification
// ==========================================

/**
 * Common transient error patterns
 */
const TRANSIENT_ERROR_PATTERNS = [
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /ECONNREFUSED/i,
    /ENETUNREACH/i,
    /socket hang up/i,
    /network error/i,
    /timeout/i,
    /rate limit/i,
    /too many requests/i,
    /service unavailable/i,
    /bad gateway/i,
    /gateway timeout/i,
];

/**
 * HTTP status codes that indicate transient errors
 */
const TRANSIENT_STATUS_CODES = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];

/**
 * Default function to determine if an error is retryable
 */
export function isTransientError(error: unknown): boolean {
    if (!error) return false;

    // Check if it's a network error with status code
    if (typeof error === "object" && error !== null) {
        const err = error as { status?: number; statusCode?: number; message?: string; code?: string };
        
        // Check status code
        if (err.status && TRANSIENT_STATUS_CODES.includes(err.status)) {
            return true;
        }
        if (err.statusCode && TRANSIENT_STATUS_CODES.includes(err.statusCode)) {
            return true;
        }

        // Check error code
        if (err.code && TRANSIENT_ERROR_PATTERNS.some(p => p.test(err.code!))) {
            return true;
        }

        // Check error message
        if (err.message && TRANSIENT_ERROR_PATTERNS.some(p => p.test(err.message!))) {
            return true;
        }
    }

    // Check Error instance
    if (error instanceof Error) {
        return TRANSIENT_ERROR_PATTERNS.some(p => p.test(error.message));
    }

    return false;
}

// ==========================================
// Retry Implementation
// ==========================================

/**
 * Calculate delay for next retry with jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter (±25%) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    
    return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry on transient errors
 * 
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch("https://api.example.com/data"),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const fullConfig: RetryConfig = {
        ...defaultConfig,
        ...config,
        isRetryable: config.isRetryable ?? isTransientError,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= fullConfig.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we've exhausted retries
            if (attempt > fullConfig.maxRetries) {
                break;
            }

            // Check if error is retryable
            if (!fullConfig.isRetryable!(error)) {
                break;
            }

            // Calculate delay
            const delayMs = calculateDelay(attempt, fullConfig);

            // Log retry attempt
            logger.warn(`Retry attempt ${attempt}/${fullConfig.maxRetries}`, {
                delay: delayMs,
                error: error instanceof Error ? error.message : String(error),
            });

            // Call onRetry callback if provided
            if (fullConfig.onRetry) {
                fullConfig.onRetry(attempt, error, delayMs);
            }

            // Wait before retry
            await sleep(delayMs);
        }
    }

    // All retries exhausted, throw last error
    throw lastError;
}

// ==========================================
// Presets
// ==========================================

export const RetryPresets = {
    /** Fast retry for quick operations */
    FAST: {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
    },
    
    /** Standard retry for API calls */
    STANDARD: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
    },
    
    /** Aggressive retry for critical operations */
    AGGRESSIVE: {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
    },
    
    /** Database operation retry */
    DATABASE: {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
    },
} as const;

// ==========================================
// Fetch with Retry
// ==========================================

/**
 * Fetch wrapper with automatic retry
 */
export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryConfig?: Partial<RetryConfig>
): Promise<Response> {
    return withRetry(async () => {
        const response = await fetch(url, options);
        
        // Treat certain status codes as errors for retry
        if (TRANSIENT_STATUS_CODES.includes(response.status)) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            (error as any).status = response.status;
            throw error;
        }
        
        return response;
    }, retryConfig);
}
