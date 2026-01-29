// ==========================================
// CSRF Protection Utilities
// ==========================================
// Double Submit Cookie pattern implementation

import { NextRequest, NextResponse } from "next/server";
import { createId } from "@paralleldrive/cuid2";

// ==========================================
// Configuration
// ==========================================

const CSRF_COOKIE_NAME = "__Host-csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_FORM_FIELD = "_csrf";
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CsrfTokenData {
    token: string;
    createdAt: number;
}

// In-memory store for token validation (use Redis in production with multiple instances)
const tokenStore = new Map<string, CsrfTokenData>();

// Cleanup interval
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour
let lastCleanup = Date.now();

function cleanupExpiredTokens(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    
    lastCleanup = now;
    for (const [key, data] of tokenStore.entries()) {
        if (now - data.createdAt > TOKEN_VALIDITY_MS) {
            tokenStore.delete(key);
        }
    }
}

// ==========================================
// Token Generation
// ==========================================

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
    cleanupExpiredTokens();
    
    const token = createId();
    tokenStore.set(token, {
        token,
        createdAt: Date.now(),
    });
    
    return token;
}

/**
 * Create response with CSRF token cookie
 */
export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
    // Use __Host- prefix for enhanced security (requires Secure, no Domain, Path=/)
    response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Client needs to read this to send in header
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: TOKEN_VALIDITY_MS / 1000,
    });
    
    return response;
}

// ==========================================
// Token Validation
// ==========================================

/**
 * Extract CSRF token from request
 */
function extractCsrfToken(req: NextRequest): string | null {
    // First, try header
    const headerToken = req.headers.get(CSRF_HEADER_NAME);
    if (headerToken) return headerToken;
    
    // For form submissions, check body (requires parsing)
    // Note: This is handled separately in validateCsrfFromBody
    
    return null;
}

/**
 * Get CSRF token from cookie
 */
function getCsrfCookie(req: NextRequest): string | null {
    return req.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Validate CSRF token using Double Submit Cookie pattern
 */
export function validateCsrfToken(req: NextRequest): boolean {
    // Skip validation for safe methods
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return true;
    }
    
    const cookieToken = getCsrfCookie(req);
    const requestToken = extractCsrfToken(req);
    
    if (!cookieToken || !requestToken) {
        return false;
    }
    
    // Tokens must match
    if (cookieToken !== requestToken) {
        return false;
    }
    
    // Verify token exists in store and is not expired
    const storedData = tokenStore.get(cookieToken);
    if (!storedData) {
        return false;
    }
    
    if (Date.now() - storedData.createdAt > TOKEN_VALIDITY_MS) {
        tokenStore.delete(cookieToken);
        return false;
    }
    
    return true;
}

// ==========================================
// Middleware Helper
// ==========================================

/**
 * CSRF validation response for invalid tokens
 */
export function csrfErrorResponse(): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: "CSRF_VALIDATION_FAILED",
                message: "Invalid or missing CSRF token",
            },
        },
        { status: 403 }
    );
}

/**
 * Middleware to protect routes with CSRF validation
 * 
 * Usage:
 * ```ts
 * export const POST = withCsrfProtection(async (req) => { ... });
 * ```
 */
export function withCsrfProtection<T extends (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>>(
    handler: T
): T {
    return (async (req: NextRequest, ...args: unknown[]) => {
        if (!validateCsrfToken(req)) {
            return csrfErrorResponse();
        }
        
        return handler(req, ...args);
    }) as T;
}

// ==========================================
// Form Helper (for FormData submissions)
// ==========================================

/**
 * Validate CSRF from form data
 * Call this for multipart form submissions
 */
export function validateCsrfFromFormData(
    req: NextRequest,
    formData: FormData
): boolean {
    const cookieToken = getCsrfCookie(req);
    const formToken = formData.get(CSRF_FORM_FIELD) as string | null;
    
    if (!cookieToken) return false;
    
    const requestToken = formToken || extractCsrfToken(req);
    
    if (!requestToken || cookieToken !== requestToken) {
        return false;
    }
    
    const storedData = tokenStore.get(cookieToken);
    if (!storedData || Date.now() - storedData.createdAt > TOKEN_VALIDITY_MS) {
        return false;
    }
    
    return true;
}

// ==========================================
// React Hook Helper (for client-side)
// ==========================================

/**
 * Get the CSRF token from cookie (client-side)
 * Usage in React component:
 * ```tsx
 * const token = getCsrfTokenFromCookie();
 * fetch('/api/endpoint', {
 *   headers: { 'x-csrf-token': token }
 * });
 * ```
 */
export const CSRF_CONFIG = {
    cookieName: CSRF_COOKIE_NAME,
    headerName: CSRF_HEADER_NAME,
    formField: CSRF_FORM_FIELD,
} as const;
