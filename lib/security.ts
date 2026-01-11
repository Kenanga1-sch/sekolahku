// Security utilities for input sanitization and validation

/**
 * Sanitize string input to prevent XSS
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
    if (!input || typeof input !== "string") return "";

    return input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        .replace(/`/g, "&#x60;")
        .trim();
}

/**
 * Sanitize HTML content - allows safe tags only
 * For rich text content, use with caution
 */
export function sanitizeHtml(html: string): string {
    if (!html || typeof html !== "string") return "";

    // Remove script tags and their content
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Remove event handlers
    cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
    cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

    // Remove javascript: URLs
    cleaned = cleaned.replace(/javascript:/gi, "");

    // Remove data: URLs in src/href (except for images)
    cleaned = cleaned.replace(/(?:src|href)\s*=\s*["']data:(?!image)/gi, 'src="');

    return cleaned.trim();
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
    if (!email || typeof email !== "string") return "";

    // Basic email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = email.toLowerCase().trim();

    if (!emailRegex.test(cleaned)) {
        return "";
    }

    return cleaned;
}

/**
 * Sanitize phone number - keep only digits and + prefix
 */
export function sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== "string") return "";

    // Remove everything except digits and leading +
    let cleaned = phone.replace(/[^\d+]/g, "");

    // Ensure + is only at the start if present
    if (cleaned.includes("+") && !cleaned.startsWith("+")) {
        cleaned = cleaned.replace(/\+/g, "");
    }

    return cleaned;
}

/**
 * Sanitize NIK - keep only 16 digits
 */
export function sanitizeNIK(nik: string): string {
    if (!nik || typeof nik !== "string") return "";

    const digitsOnly = nik.replace(/\D/g, "");

    // NIK must be exactly 16 digits
    if (digitsOnly.length !== 16) {
        return "";
    }

    return digitsOnly;
}

/**
 * Validate file upload
 */
export function validateFileUpload(
    file: File,
    options: {
        maxSize?: number; // in bytes
        allowedTypes?: string[];
    } = {}
): { valid: boolean; error?: string } {
    const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default
    const allowedTypes = options.allowedTypes || [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    ];

    if (file.size > maxSize) {
        return { valid: false, error: `File terlalu besar (max ${maxSize / 1024 / 1024}MB)` };
    }

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: "Tipe file tidak diizinkan" };
    }

    // Check for double extensions (e.g., file.jpg.exe)
    const nameParts = file.name.split(".");
    if (nameParts.length > 2) {
        const suspiciousExts = ["exe", "bat", "cmd", "sh", "php", "js", "html"];
        if (suspiciousExts.some(ext => nameParts.includes(ext))) {
            return { valid: false, error: "File mencurigakan terdeteksi" };
        }
    }

    return { valid: true };
}

/**
 * Rate limiter using in-memory store
 * Note: For production, use Redis or similar
 */
const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

export function checkRateLimit(
    identifier: string,
    options: { windowMs?: number; maxRequests?: number } = {}
): { allowed: boolean; remaining: number; resetIn: number } {
    const windowMs = options.windowMs || 60 * 1000; // 1 minute default
    const maxRequests = options.maxRequests || 60; // 60 requests per minute default

    const now = Date.now();
    const record = rateLimitStore.get(identifier);

    // Clean up expired entries periodically
    if (rateLimitStore.size > 10000) {
        for (const [key, value] of rateLimitStore.entries()) {
            if (value.resetTime < now) {
                rateLimitStore.delete(key);
            }
        }
    }

    if (!record || record.resetTime < now) {
        rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (record.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetTime - now
        };
    }

    record.count++;
    return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetIn: record.resetTime - now
    };
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Fallback for environments without crypto
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Password strength checker
 */
export function checkPasswordStrength(password: string): {
    score: number; // 0-4
    feedback: string[];
} {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push("Minimal 8 karakter");

    if (password.length >= 12) score++;

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    else feedback.push("Gunakan huruf besar dan kecil");

    if (/\d/.test(password)) score++;
    else feedback.push("Tambahkan angka");

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    else feedback.push("Tambahkan simbol");

    // Check for common patterns
    const commonPatterns = ["password", "123456", "qwerty", "admin"];
    if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
        score = Math.max(0, score - 2);
        feedback.push("Hindari kata/pola umum");
    }

    return { score: Math.min(4, score), feedback };
}
