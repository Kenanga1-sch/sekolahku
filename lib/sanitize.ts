// ==========================================
// Input Sanitization Utilities
// ==========================================
// Server-side sanitization for user inputs

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

// Create DOMPurify instance for Node.js
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// ==========================================
// HTML Sanitization
// ==========================================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for rich text editor content before storing in database
 */
export function sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            // Text formatting
            "p", "br", "b", "i", "u", "s", "strong", "em", "mark",
            // Structure
            "h1", "h2", "h3", "h4", "h5", "h6",
            "ul", "ol", "li",
            "blockquote", "pre", "code",
            "hr",
            // Media
            "img",
            // Links
            "a",
            // Tables
            "table", "thead", "tbody", "tr", "th", "td",
        ],
        ALLOWED_ATTR: [
            "href", "src", "alt", "title", "class",
            "width", "height",
            "target", "rel",
        ],
        // Only allow safe URLs
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
        FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
    });
}

/**
 * Strip all HTML tags, leaving only text
 * Use for plain text fields where no HTML is allowed
 */
export function stripHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

// ==========================================
// String Sanitization
// ==========================================

/**
 * Escape special characters for safe output
 */
export function escapeHTML(str: string): string {
    const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars
        .replace(/\.{2,}/g, ".") // Prevent .. traversal
        .replace(/^\.+/, "") // Remove leading dots
        .slice(0, 255); // Limit length
}

/**
 * Sanitize search query to prevent injection
 */
export function sanitizeSearchQuery(query: string): string {
    return query
        .trim()
        .replace(/[<>'"%;()&+]/g, "") // Remove dangerous chars
        .slice(0, 100); // Limit length
}

// ==========================================
// URL Sanitization
// ==========================================

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

/**
 * Validate and sanitize URL
 * Returns null if URL is invalid or uses dangerous protocol
 */
export function sanitizeURL(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

// ==========================================
// SQL Prevention (reminder - use parameterized queries!)
// ==========================================

/**
 * Check if string contains SQL injection patterns
 * This is a safety net, not a replacement for parameterized queries!
 */
export function hasSQLInjectionPatterns(input: string): boolean {
    const patterns = [
        /('|")\s*(OR|AND)\s*('|")/i,
        /('|")\s*;\s*--/i,
        /UNION\s+(ALL\s+)?SELECT/i,
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+\w+\s+SET/i,
    ];
    return patterns.some((pattern) => pattern.test(input));
}
