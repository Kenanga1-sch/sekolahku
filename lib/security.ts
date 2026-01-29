// ==========================================
// Security Utilities
// ==========================================
// This module provides security helpers for:
// - XSS prevention (HTML sanitization)
// - Filter injection prevention (PocketBase query sanitization)
// - Input validation helpers

import DOMPurify from "isomorphic-dompurify";

// ==========================================
// XSS Prevention
// ==========================================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this before rendering user-generated HTML with dangerouslySetInnerHTML
 */
export function sanitizeHTML(dirty: string): string {
    if (!dirty) return "";

    return DOMPurify.sanitize(dirty, {
        // Allow safe HTML tags for rich content
        ALLOWED_TAGS: [
            "p", "br", "strong", "em", "u", "s", "blockquote",
            "h1", "h2", "h3", "h4", "h5", "h6",
            "ul", "ol", "li",
            "a", "img",
            "table", "thead", "tbody", "tr", "th", "td",
            "pre", "code",
            "hr", "div", "span",
        ],
        ALLOWED_ATTR: [
            "href", "src", "alt", "title", "class", "id",
            "target", "rel", "width", "height",
        ],
        // Force links to open in new tab with noopener
        ADD_ATTR: ["target", "rel"],
        // Disallow javascript: URLs
        ALLOW_DATA_ATTR: false,
    });
}

/**
 * Sanitize plain text - strips ALL HTML
 */
export function sanitizeText(dirty: string): string {
    if (!dirty) return "";
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

// ==========================================
// PocketBase Filter Injection Prevention
// ==========================================

/**
 * Sanitize a value for use in PocketBase filter queries
 * Prevents filter injection attacks by escaping special characters
 * 
 * Usage:
 * ```ts
 * const filter = `name = "${sanitizeFilter(userInput)}"`;
 * ```
 */
export function sanitizeFilter(value: string): string {
    if (!value) return "";

    // Remove or escape characters that could break PocketBase filter syntax
    return value
        .replace(/\\/g, "\\\\")  // Escape backslashes first
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/\n/g, "")      // Remove newlines
        .replace(/\r/g, "")      // Remove carriage returns
        .replace(/\t/g, "")      // Remove tabs
        .trim();
}

/**
 * Sanitize an ID value (alphanumeric + underscore only)
 * Use for record IDs to prevent injection
 */
export function sanitizeId(value: string): string {
    if (!value) return "";
    // PocketBase IDs are alphanumeric, allow only those
    return value.replace(/[^a-zA-Z0-9_]/g, "");
}

/**
 * Sanitize a slug (URL-safe characters only)
 */
export function sanitizeSlug(value: string): string {
    if (!value) return "";
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Sanitize a generic string - removes dangerous characters
 */
export function sanitizeString(value: string): string {
    if (!value) return "";
    return value
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/[<>]/g, "")    // Remove angle brackets
        .trim();
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(value: string): string {
    if (!value) return "";
    return value
        .toLowerCase()
        .replace(/[^a-z0-9@._+-]/g, "")
        .trim();
}

/**
 * Sanitize phone number (keep only digits and +)
 */
export function sanitizePhone(value: string): string {
    if (!value) return "";
    return value.replace(/[^\d+]/g, "");
}

/**
 * Sanitize NIK (Indonesian ID - 16 digits only)
 */
export function sanitizeNIK(value: string): string {
    if (!value) return "";
    return value.replace(/\D/g, "").substring(0, 16);
}

// ==========================================
// Input Validation
// ==========================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (Indonesian format)
 */
export function isValidPhone(phone: string): boolean {
    // Indonesian phone: 08xx, +62xx, 62xx
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{7,10}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ""));
}

/**
 * Validate NIK (Indonesian ID number - 16 digits)
 */
export function isValidNIK(nik: string): boolean {
    return /^\d{16}$/.test(nik);
}

// ==========================================
// Rate Limiting Helper (Client-side)
// ==========================================

const requestTimestamps: Map<string, number[]> = new Map();

// Cleanup interval to prevent memory leak
const CLEANUP_INTERVAL_MS = 300000; // 5 minutes
let lastCleanup = Date.now();

function cleanupOldEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    
    lastCleanup = now;
    requestTimestamps.forEach((timestamps, key) => {
        const validTimestamps = timestamps.filter(t => now - t < 60000);
        if (validTimestamps.length === 0) {
            requestTimestamps.delete(key);
        } else {
            requestTimestamps.set(key, validTimestamps);
        }
    });
}

interface RateLimitOptions {
    windowMs?: number;
    maxRequests?: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
}

/**
 * Simple client-side rate limiting
 * Returns object with allowed status and remaining requests
 */
export function checkRateLimit(
    key: string,
    options: RateLimitOptions = {}
): RateLimitResult {
    // Cleanup old entries periodically
    cleanupOldEntries();
    
    const { maxRequests = 10, windowMs = 60000 } = options;
    const now = Date.now();
    const timestamps = requestTimestamps.get(key) || [];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
        const oldestTimestamp = Math.min(...validTimestamps);
        return {
            allowed: false,
            remaining: 0,
            resetIn: windowMs - (now - oldestTimestamp),
        };
    }

    validTimestamps.push(now);
    requestTimestamps.set(key, validTimestamps);

    return {
        allowed: true,
        remaining: maxRequests - validTimestamps.length,
        resetIn: windowMs,
    };
}
