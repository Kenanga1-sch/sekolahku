// ==========================================
// Custom Error Classes
// ==========================================
// Centralized error handling with user-friendly messages

/**
 * Base application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = "INTERNAL_ERROR",
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        
        // Ensure proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
            },
        };
    }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
    public readonly fields?: Record<string, string>;

    constructor(message: string, fields?: Record<string, string>) {
        super(message, 400, "VALIDATION_ERROR");
        this.fields = fields;
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                fields: this.fields,
            },
        };
    }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
    constructor(resource: string = "Resource") {
        super(`${resource} tidak ditemukan`, 404, "NOT_FOUND");
    }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
    constructor(message: string = "Anda harus login untuk mengakses fitur ini") {
        super(message, 401, "UNAUTHORIZED");
    }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
    constructor(message: string = "Anda tidak memiliki akses ke fitur ini") {
        super(message, 403, "FORBIDDEN");
    }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
    public readonly retryAfter: number;

    constructor(retryAfter: number = 60) {
        super("Terlalu banyak permintaan. Silakan coba lagi nanti.", 429, "RATE_LIMIT_EXCEEDED");
        this.retryAfter = retryAfter;
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                retryAfter: this.retryAfter,
            },
        };
    }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
    constructor(message: string = "Data sudah ada") {
        super(message, 409, "CONFLICT");
    }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
    constructor(message: string = "Terjadi kesalahan pada database") {
        super(message, 500, "DATABASE_ERROR", false);
    }
}

// ==========================================
// Error Response Helpers
// ==========================================

import { NextResponse } from "next/server";

/**
 * Create standardized error response
 */
export function createErrorResponse(error: unknown): NextResponse {
    if (error instanceof AppError) {
        return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }

    // Unknown error
    console.error("Unhandled error:", error);
    return NextResponse.json(
        {
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                // DEBUG: Expose actual error message
                message: error instanceof Error ? error.message : "Terjadi kesalahan internal. Silakan coba lagi.",
                statusCode: 500,
            },
        },
        { status: 500 }
    );
}

/**
 * Wrap async route handler with error handling
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
    handler: T
): T {
    return (async (...args: unknown[]) => {
        try {
            return await handler(...args);
        } catch (error) {
            return createErrorResponse(error);
        }
    }) as T;
}

// ==========================================
// Error Messages (Indonesian)
// ==========================================

export const ErrorMessages = {
    // Validation
    REQUIRED_FIELD: (field: string) => `${field} wajib diisi`,
    INVALID_EMAIL: "Format email tidak valid",
    INVALID_PHONE: "Format nomor telepon tidak valid",
    INVALID_NIK: "NIK harus 16 digit angka",
    
    // Auth
    LOGIN_REQUIRED: "Silakan login terlebih dahulu",
    PERMISSION_DENIED: "Anda tidak memiliki izin untuk tindakan ini",
    
    // Resources
    USER_NOT_FOUND: "Pengguna tidak ditemukan",
    ITEM_NOT_FOUND: "Item tidak ditemukan",
    MEMBER_NOT_FOUND: "Anggota tidak ditemukan",
    LOAN_NOT_FOUND: "Data peminjaman tidak ditemukan",
    
    // Operations
    DUPLICATE_NIK: "NIK sudah terdaftar sebelumnya",
    ITEM_NOT_AVAILABLE: "Item sedang dipinjam",
    MAX_BORROW_REACHED: "Batas peminjaman sudah tercapai",
    PERIOD_NOT_ACTIVE: "Tidak ada periode aktif saat ini",
    
    // Generic
    OPERATION_FAILED: "Operasi gagal. Silakan coba lagi.",
} as const;
