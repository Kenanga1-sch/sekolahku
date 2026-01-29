// ==========================================
// Server-Side Rate Limiting
// ==========================================
// In-memory rate limiter for API routes
// For production with multiple instances, use Redis

import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (use Redis for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    
    lastCleanup = now;
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetAt) {
            rateLimitStore.delete(key);
        }
    }
}

// ==========================================
// Configuration
// ==========================================

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    limit: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Key prefix for different rate limit buckets */
    keyPrefix?: string;
    /** Skip rate limiting for certain conditions */
    skip?: (req: NextRequest) => boolean;
}

export const RateLimitPresets = {
    /** Strict: 10 requests per minute (for sensitive operations) */
    STRICT: { limit: 10, windowSeconds: 60 },
    /** Standard: 60 requests per minute (for normal API calls) */
    STANDARD: { limit: 60, windowSeconds: 60 },
    /** Relaxed: 120 requests per minute (for read-heavy endpoints) */
    RELAXED: { limit: 120, windowSeconds: 60 },
    /** Auth: 5 attempts per 15 minutes (for login/password reset) */
    AUTH: { limit: 5, windowSeconds: 900 },
    /** Upload: 10 uploads per 10 minutes */
    UPLOAD: { limit: 10, windowSeconds: 600 },
} as const;

// ==========================================
// Core Functions
// ==========================================

/**
 * Get client identifier from request
 */
function getClientId(req: NextRequest): string {
    // Try to get real IP from headers (for proxied requests)
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }
    
    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }
    
    // Fallback to connection info (may not be available in all environments)
    return req.headers.get("cf-connecting-ip") || "unknown";
}

/**
 * Check rate limit for a request
 * Returns remaining requests and reset time
 */
export function checkRateLimit(
    clientId: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
    cleanupExpiredEntries();
    
    const key = `${config.keyPrefix || "default"}:${clientId}`;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    
    const existing = rateLimitStore.get(key);
    
    if (!existing || now > existing.resetAt) {
        // First request or window expired
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + windowMs,
        });
        return {
            allowed: true,
            remaining: config.limit - 1,
            resetIn: config.windowSeconds,
        };
    }
    
    if (existing.count >= config.limit) {
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetIn: Math.ceil((existing.resetAt - now) / 1000),
        };
    }
    
    // Increment counter
    existing.count++;
    rateLimitStore.set(key, existing);
    
    return {
        allowed: true,
        remaining: config.limit - existing.count,
        resetIn: Math.ceil((existing.resetAt - now) / 1000),
    };
}

// ==========================================
// Middleware Helper
// ==========================================

/**
 * Rate limit response with proper headers
 */
export function rateLimitResponse(
    remaining: number,
    resetIn: number
): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
                retryAfter: resetIn,
            },
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(resetIn),
                "X-RateLimit-Remaining": String(remaining),
                "X-RateLimit-Reset": String(resetIn),
            },
        }
    );
}

/**
 * Apply rate limiting to an API route handler
 * 
 * Usage:
 * ```ts
 * export const POST = withRateLimit(
 *   async (req) => { ... },
 *   RateLimitPresets.STRICT
 * );
 * ```
 */
export function withRateLimit<T extends (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>>(
    handler: T,
    config: RateLimitConfig = RateLimitPresets.STANDARD
): T {
    return (async (req: NextRequest, ...args: unknown[]) => {
        // Skip rate limiting if configured
        if (config.skip?.(req)) {
            return handler(req, ...args);
        }
        
        const clientId = getClientId(req);
        const result = checkRateLimit(clientId, config);
        
        if (!result.allowed) {
            return rateLimitResponse(result.remaining, result.resetIn);
        }
        
        // Add rate limit headers to successful responses
        const response = await handler(req, ...args);
        
        response.headers.set("X-RateLimit-Remaining", String(result.remaining));
        response.headers.set("X-RateLimit-Reset", String(result.resetIn));
        
        return response;
    }) as T;
}

// ==========================================
// User-specific Rate Limiting
// ==========================================

/**
 * Check rate limit for a specific user action
 * Use this for authenticated routes where you want per-user limits
 */
export function checkUserRateLimit(
    userId: string,
    action: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
    return checkRateLimit(`user:${userId}:${action}`, {
        ...config,
        keyPrefix: "user-action",
    });
}

// ==========================================
// Cleanup on module unload
// ==========================================

if (typeof process !== "undefined") {
    process.on("beforeExit", () => {
        rateLimitStore.clear();
    });
}
