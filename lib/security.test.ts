// ==========================================
// Security Library Unit Tests
// ==========================================

import { describe, it, expect } from "vitest";
import {
    sanitizeHTML,
    sanitizeText,
    sanitizeFilter,
    sanitizeId,
    sanitizeSlug,
    sanitizeString,
    sanitizeEmail,
    sanitizePhone,
    sanitizeNIK,
    escapeHTML,
    sanitizeUrl,
    isValidEmail,
    isValidPhone,
    isValidNIK,
    checkRateLimit,
} from "./security";

describe("escapeHTML", () => {
    it("should escape script tags", () => {
        expect(escapeHTML('<script>alert(1)</script>')).toBe(
            "&lt;script&gt;alert(1)&lt;/script&gt;"
        );
    });

    it("should escape img onerror payload", () => {
        const out = escapeHTML('<img src=x onerror=alert(1)>');
        // Yang penting: tidak ada lagi tag yang bisa diparse browser.
        expect(out).not.toContain("<img");
        expect(out).toContain("&lt;img");
        // Teks "onerror=" boleh tersisa sebagai teks biasa — tidak dieksekusi
        // karena "<" sudah di-escape.
        expect(out).toBe("&lt;img src=x onerror=alert(1)&gt;");
    });

    it("should escape quotes for attribute contexts", () => {
        expect(escapeHTML(`" onmouseover="alert(1)`)).toBe(
            "&quot; onmouseover=&quot;alert(1)"
        );
        expect(escapeHTML("it's")).toBe("it&#39;s");
    });

    it("should escape ampersands before other entities", () => {
        // & harus di-escape duluan agar &lt; tidak jadi &amp;lt; dobel.
        expect(escapeHTML("&lt;")).toBe("&amp;lt;");
    });

    it("should handle null and undefined", () => {
        expect(escapeHTML(null)).toBe("");
        expect(escapeHTML(undefined)).toBe("");
    });

    it("should coerce non-string values", () => {
        expect(escapeHTML(123)).toBe("123");
        expect(escapeHTML(0)).toBe("0");
    });

    it("should neutralise XSS from student name injected into print template", () => {
        // Skenario nyata: nama siswa berisi payload, dicetak ke jendela baru.
        const studentName = '<img src=x onerror="fetch(\'//evil.tld\')">';
        const html = `<td>${escapeHTML(studentName)}</td>`;
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });
});

describe("sanitizeUrl", () => {
    it("should allow http and https", () => {
        expect(sanitizeUrl("https://example.com/x")).toBe("https://example.com/x");
        // URL.toString() menormalisasi host tanpa path jadi ada trailing slash.
        expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
    });

    it("should block javascript: scheme", () => {
        expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
        expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBe("#");
    });

    it("should block data: scheme", () => {
        expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
    });

    it("should allow relative paths", () => {
        expect(sanitizeUrl("/uploads/a.pdf")).toBe("/uploads/a.pdf");
        expect(sanitizeUrl("./file.pdf")).toBe("./file.pdf");
    });

    it("should allow mailto and tel", () => {
        expect(sanitizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
        expect(sanitizeUrl("tel:+62123")).toBe("tel:+62123");
    });

    it("should return # for empty or invalid", () => {
        expect(sanitizeUrl("")).toBe("#");
        expect(sanitizeUrl(null)).toBe("#");
        expect(sanitizeUrl(undefined)).toBe("#");
    });
});

describe("XSS Prevention", () => {
    describe("sanitizeHTML", () => {
        it("should allow safe HTML tags", () => {
            const input = "<p>Hello <strong>World</strong></p>";
            expect(sanitizeHTML(input)).toContain("<p>");
            expect(sanitizeHTML(input)).toContain("<strong>");
        });

        it("should remove script tags", () => {
            const input = '<script>alert("xss")</script><p>Safe</p>';
            const result = sanitizeHTML(input);
            expect(result).not.toContain("<script>");
            expect(result).toContain("<p>");
        });

        it("should remove onclick handlers", () => {
            const input = '<p onclick="alert()">Click me</p>';
            const result = sanitizeHTML(input);
            expect(result).not.toContain("onclick");
        });

        it("should handle empty input", () => {
            expect(sanitizeHTML("")).toBe("");
            expect(sanitizeHTML(null as unknown as string)).toBe("");
        });
    });

    describe("sanitizeText", () => {
        it("should strip all HTML", () => {
            const input = "<p>Hello <strong>World</strong></p>";
            expect(sanitizeText(input)).toBe("Hello World");
        });
    });
});

describe("Filter Injection Prevention", () => {
    describe("sanitizeFilter", () => {
        it("should escape double quotes", () => {
            const input = 'test"injection';
            expect(sanitizeFilter(input)).toBe('test\\"injection');
        });

        it("should escape single quotes", () => {
            const input = "test'injection";
            expect(sanitizeFilter(input)).toBe("test\\'injection");
        });

        it("should remove newlines", () => {
            const input = "test\ninjection";
            expect(sanitizeFilter(input)).toBe("testinjection");
        });

        it("should trim whitespace", () => {
            const input = "  test  ";
            expect(sanitizeFilter(input)).toBe("test");
        });
    });

    describe("sanitizeId", () => {
        it("should only allow alphanumeric and underscore", () => {
            expect(sanitizeId("abc123_test")).toBe("abc123_test");
            expect(sanitizeId("abc!@#$%123")).toBe("abc123");
        });

        it("should handle empty input", () => {
            expect(sanitizeId("")).toBe("");
        });
    });

    describe("sanitizeSlug", () => {
        it("should convert to lowercase", () => {
            expect(sanitizeSlug("Hello-World")).toBe("hello-world");
        });

        it("should replace spaces with dashes", () => {
            expect(sanitizeSlug("hello world")).toBe("hello-world");
        });

        it("should remove special characters", () => {
            expect(sanitizeSlug("hello@world!")).toBe("hello-world");
        });
    });
});

describe("Input Sanitization", () => {
    describe("sanitizeString", () => {
        it("should remove HTML tags", () => {
            expect(sanitizeString("<p>Hello</p>")).toBe("Hello");
        });

        it("should trim whitespace", () => {
            expect(sanitizeString("  hello  ")).toBe("hello");
        });
    });

    describe("sanitizeEmail", () => {
        it("should lowercase email", () => {
            expect(sanitizeEmail("Test@Example.COM")).toBe("test@example.com");
        });

        it("should remove invalid characters", () => {
            expect(sanitizeEmail("test<script>@mail.com")).toBe("testscript@mail.com");
        });
    });

    describe("sanitizePhone", () => {
        it("should keep only digits and plus", () => {
            expect(sanitizePhone("+62 812-3456-7890")).toBe("+6281234567890");
        });

        it("should handle various formats", () => {
            expect(sanitizePhone("081234567890")).toBe("081234567890");
            expect(sanitizePhone("(021) 123-4567")).toBe("0211234567");
        });
    });

    describe("sanitizeNIK", () => {
        it("should keep only digits", () => {
            expect(sanitizeNIK("1234567890123456")).toBe("1234567890123456");
        });

        it("should truncate to 16 digits", () => {
            expect(sanitizeNIK("12345678901234567890")).toBe("1234567890123456");
        });

        it("should remove non-digits", () => {
            expect(sanitizeNIK("1234-5678-9012-3456")).toBe("1234567890123456");
        });
    });
});

describe("Input Validation", () => {
    describe("isValidEmail", () => {
        it("should validate correct emails", () => {
            expect(isValidEmail("test@example.com")).toBe(true);
            expect(isValidEmail("user.name@domain.co.id")).toBe(true);
        });

        it("should reject invalid emails", () => {
            expect(isValidEmail("invalid")).toBe(false);
            expect(isValidEmail("@domain.com")).toBe(false);
            expect(isValidEmail("test@")).toBe(false);
        });
    });

    describe("isValidPhone", () => {
        it("should validate Indonesian numbers", () => {
            expect(isValidPhone("081234567890")).toBe(true);
            expect(isValidPhone("+6281234567890")).toBe(true);
            expect(isValidPhone("6281234567890")).toBe(true);
        });

        it("should reject invalid numbers", () => {
            expect(isValidPhone("12345")).toBe(false);
            expect(isValidPhone("abc123")).toBe(false);
        });
    });

    describe("isValidNIK", () => {
        it("should validate 16 digit NIK", () => {
            expect(isValidNIK("1234567890123456")).toBe(true);
        });

        it("should reject invalid NIK", () => {
            expect(isValidNIK("123456789012345")).toBe(false); // 15 digits
            expect(isValidNIK("12345678901234567")).toBe(false); // 17 digits
            expect(isValidNIK("123456789012345a")).toBe(false); // has letter
        });
    });
});

describe("Rate Limiting", () => {
    describe("checkRateLimit", () => {
        it("should allow requests under limit", () => {
            const key = "test-" + Date.now();
            const result = checkRateLimit(key, { maxRequests: 10 });
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(9);
        });

        it("should block requests over limit", () => {
            const key = "test-limit-" + Date.now();

            // Make 3 requests with limit of 3
            checkRateLimit(key, { maxRequests: 3 });
            checkRateLimit(key, { maxRequests: 3 });
            checkRateLimit(key, { maxRequests: 3 });

            // 4th should be blocked
            const result = checkRateLimit(key, { maxRequests: 3 });
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });
});
