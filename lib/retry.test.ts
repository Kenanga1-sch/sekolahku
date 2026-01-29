import { describe, it, expect, vi } from "vitest";
import { 
    withRetry, 
    isTransientError,
    RetryPresets,
} from "./retry";

describe("Retry Utility", () => {
    describe("isTransientError", () => {
        it("should identify timeout errors as transient", () => {
            const error = new Error("Connection timeout");
            expect(isTransientError(error)).toBe(true);
        });

        it("should identify network errors as transient", () => {
            const error = new Error("Network error occurred");
            expect(isTransientError(error)).toBe(true);
        });

        it("should identify ECONNRESET as transient", () => {
            const error = { code: "ECONNRESET", message: "Connection reset" };
            expect(isTransientError(error)).toBe(true);
        });

        it("should identify 503 status as transient", () => {
            const error = { status: 503, message: "Service Unavailable" };
            expect(isTransientError(error)).toBe(true);
        });

        it("should identify 429 status as transient", () => {
            const error = { status: 429, message: "Too Many Requests" };
            expect(isTransientError(error)).toBe(true);
        });

        it("should not identify 404 as transient", () => {
            const error = { status: 404, message: "Not Found" };
            expect(isTransientError(error)).toBe(false);
        });

        it("should not identify validation errors as transient", () => {
            const error = new Error("Validation failed: email is invalid");
            expect(isTransientError(error)).toBe(false);
        });

        it("should handle null/undefined", () => {
            expect(isTransientError(null)).toBe(false);
            expect(isTransientError(undefined)).toBe(false);
        });
    });

    describe("withRetry", () => {
        it("should return result on first success", async () => {
            const fn = vi.fn().mockResolvedValue("success");
            
            const result = await withRetry(fn, { maxRetries: 1, initialDelayMs: 10 });
            
            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should retry on transient error and succeed", async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValue("success");
            
            const result = await withRetry(fn, { 
                maxRetries: 3, 
                initialDelayMs: 10,
                maxDelayMs: 50,
            });
            
            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        }, 10000);

        it("should not retry on non-transient error", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("Invalid data"));
            
            await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10 }))
                .rejects.toThrow("Invalid data");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should call onRetry callback", async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValue("success");
            
            const onRetry = vi.fn();
            
            await withRetry(fn, { 
                maxRetries: 3, 
                initialDelayMs: 10,
                onRetry,
            });
            
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(
                1,
                expect.any(Error),
                expect.any(Number)
            );
        }, 10000);

        it("should use custom isRetryable function", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("Custom error"));
            
            // Custom function that treats all errors as retryable
            const isRetryable = vi.fn().mockReturnValue(false);
            
            await expect(withRetry(fn, { 
                maxRetries: 3, 
                initialDelayMs: 10,
                isRetryable,
            })).rejects.toThrow("Custom error");
            
            expect(fn).toHaveBeenCalledTimes(1);
            expect(isRetryable).toHaveBeenCalled();
        });
    });

    describe("RetryPresets", () => {
        it("should have FAST preset with correct values", () => {
            expect(RetryPresets.FAST.maxRetries).toBe(2);
            expect(RetryPresets.FAST.initialDelayMs).toBe(500);
            expect(RetryPresets.FAST.maxDelayMs).toBe(2000);
        });

        it("should have STANDARD preset with correct values", () => {
            expect(RetryPresets.STANDARD.maxRetries).toBe(3);
            expect(RetryPresets.STANDARD.initialDelayMs).toBe(1000);
            expect(RetryPresets.STANDARD.maxDelayMs).toBe(10000);
        });

        it("should have AGGRESSIVE preset with correct values", () => {
            expect(RetryPresets.AGGRESSIVE.maxRetries).toBe(5);
            expect(RetryPresets.AGGRESSIVE.maxDelayMs).toBe(30000);
        });

        it("should have DATABASE preset with correct values", () => {
            expect(RetryPresets.DATABASE.maxRetries).toBe(3);
            expect(RetryPresets.DATABASE.initialDelayMs).toBe(100);
            expect(RetryPresets.DATABASE.maxDelayMs).toBe(1000);
        });
    });
});
