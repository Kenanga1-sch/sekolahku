// ==========================================
// API Route Tests
// ==========================================
// Tests for custom error classes and validation logic

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// ==========================================
// Custom Error Classes Tests
// ==========================================

describe("Custom Error Classes", () => {
    describe("ValidationError", () => {
        it("should have correct structure", async () => {
            const { ValidationError } = await import("@/lib/errors");
            
            const error = new ValidationError("Test error", { field: "error" });
            const json = error.toJSON();
            
            expect(json.success).toBe(false);
            expect(json.error.code).toBe("VALIDATION_ERROR");
            expect(json.error.statusCode).toBe(400);
            expect(json.error.fields).toEqual({ field: "error" });
        });

        it("should work without fields", async () => {
            const { ValidationError } = await import("@/lib/errors");
            
            const error = new ValidationError("Simple error");
            expect(error.statusCode).toBe(400);
            expect(error.fields).toBeUndefined();
        });
    });

    describe("NotFoundError", () => {
        it("should have correct structure", async () => {
            const { NotFoundError } = await import("@/lib/errors");
            
            const error = new NotFoundError("Buku");
            const json = error.toJSON();
            
            expect(json.success).toBe(false);
            expect(json.error.code).toBe("NOT_FOUND");
            expect(json.error.statusCode).toBe(404);
            expect(json.error.message).toContain("tidak ditemukan");
        });

        it("should use default resource name", async () => {
            const { NotFoundError } = await import("@/lib/errors");
            
            const error = new NotFoundError();
            expect(error.message).toContain("Resource");
        });
    });

    describe("RateLimitError", () => {
        it("should include retryAfter", async () => {
            const { RateLimitError } = await import("@/lib/errors");
            
            const error = new RateLimitError(60);
            const json = error.toJSON();
            
            expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
            expect(json.error.statusCode).toBe(429);
            expect(json.error.retryAfter).toBe(60);
        });

        it("should have default retryAfter", async () => {
            const { RateLimitError } = await import("@/lib/errors");
            
            const error = new RateLimitError();
            expect(error.retryAfter).toBe(60);
        });
    });

    describe("UnauthorizedError", () => {
        it("should have 401 status", async () => {
            const { UnauthorizedError } = await import("@/lib/errors");
            
            const error = new UnauthorizedError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe("UNAUTHORIZED");
        });
    });

    describe("ForbiddenError", () => {
        it("should have 403 status", async () => {
            const { ForbiddenError } = await import("@/lib/errors");
            
            const error = new ForbiddenError();
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe("FORBIDDEN");
        });
    });

    describe("ConflictError", () => {
        it("should have 409 status", async () => {
            const { ConflictError } = await import("@/lib/errors");
            
            const error = new ConflictError("NIK sudah ada");
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe("CONFLICT");
        });
    });

    describe("DatabaseError", () => {
        it("should have 500 status and not be operational", async () => {
            const { DatabaseError } = await import("@/lib/errors");
            
            const error = new DatabaseError();
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(false);
        });
    });
});

// ==========================================
// Error Response Helper Tests
// ==========================================

describe("Error Response Helpers", () => {
    describe("createErrorResponse", () => {
        it("should handle AppError instances", async () => {
            const { createErrorResponse, ValidationError } = await import("@/lib/errors");
            
            const error = new ValidationError("Test");
            const response = createErrorResponse(error);
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe("VALIDATION_ERROR");
        });

        it("should handle unknown errors", async () => {
            const { createErrorResponse } = await import("@/lib/errors");
            
            const error = new Error("Unknown");
            const response = createErrorResponse(error);
            const data = await response.json();
            
            expect(response.status).toBe(500);
            expect(data.error.code).toBe("INTERNAL_ERROR");
        });
    });
});

// ==========================================
// Logger Tests
// ==========================================

describe("Logger", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should generate unique request IDs", async () => {
        const { generateRequestId } = await import("@/lib/logger");
        
        const id1 = generateRequestId();
        const id2 = generateRequestId();
        
        expect(id1).toMatch(/^req_/);
        expect(id2).toMatch(/^req_/);
        expect(id1).not.toBe(id2);
    });

    it("should have module-specific loggers", async () => {
        const { libLog, spmbLog, tabunganLog, inventoryLog, authLog } = await import("@/lib/logger");
        
        expect(libLog).toBeDefined();
        expect(spmbLog).toBeDefined();
        expect(tabunganLog).toBeDefined();
        expect(inventoryLog).toBeDefined();
        expect(authLog).toBeDefined();
    });

    it("should calculate timing correctly", async () => {
        const { timeStart, timeEnd } = await import("@/lib/logger");
        
        const start = timeStart();
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 10));
        const duration = timeEnd(start);
        
        expect(duration).toBeGreaterThanOrEqual(10);
    });
});

// ==========================================
// Error Messages Tests
// ==========================================

describe("Error Messages", () => {
    it("should have Indonesian validation messages", async () => {
        const { ErrorMessages } = await import("@/lib/errors");
        
        expect(ErrorMessages.REQUIRED_FIELD("email")).toContain("wajib diisi");
        expect(ErrorMessages.INVALID_EMAIL).toContain("email");
        expect(ErrorMessages.INVALID_NIK).toContain("16");
    });

    it("should have Indonesian auth messages", async () => {
        const { ErrorMessages } = await import("@/lib/errors");
        
        expect(ErrorMessages.LOGIN_REQUIRED).toContain("login");
        expect(ErrorMessages.PERMISSION_DENIED).toContain("izin");
    });

    it("should have Indonesian resource messages", async () => {
        const { ErrorMessages } = await import("@/lib/errors");
        
        expect(ErrorMessages.USER_NOT_FOUND).toContain("Pengguna");
        expect(ErrorMessages.ITEM_NOT_FOUND).toContain("Item");
        expect(ErrorMessages.LOAN_NOT_FOUND).toContain("peminjaman");
    });
});
