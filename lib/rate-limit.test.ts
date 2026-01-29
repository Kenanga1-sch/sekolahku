import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
    checkRateLimit, 
    RateLimitPresets,
} from "./rate-limit";

describe("Rate Limiting", () => {
    beforeEach(() => {
        // Reset rate limit store between tests by using different keys
        vi.useFakeTimers();
    });

    describe("checkRateLimit", () => {
        it("should allow requests under the limit", () => {
            const clientId = `test-client-${Date.now()}`;
            const config = { limit: 5, windowSeconds: 60 };
            
            const result = checkRateLimit(clientId, config);
            
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it("should count requests correctly", () => {
            const clientId = `test-client-2-${Date.now()}`;
            const config = { limit: 5, windowSeconds: 60 };
            
            // Make 3 requests
            checkRateLimit(clientId, config);
            checkRateLimit(clientId, config);
            const result = checkRateLimit(clientId, config);
            
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2);
        });

        it("should block requests over the limit", () => {
            const clientId = `test-client-3-${Date.now()}`;
            const config = { limit: 3, windowSeconds: 60 };
            
            // Exhaust the limit
            checkRateLimit(clientId, config);
            checkRateLimit(clientId, config);
            checkRateLimit(clientId, config);
            
            // This should be blocked
            const result = checkRateLimit(clientId, config);
            
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it("should reset after window expires", () => {
            const clientId = `test-client-4-${Date.now()}`;
            const config = { limit: 2, windowSeconds: 60 };
            
            // Exhaust the limit
            checkRateLimit(clientId, config);
            checkRateLimit(clientId, config);
            
            // Should be blocked
            expect(checkRateLimit(clientId, config).allowed).toBe(false);
            
            // Advance time past the window
            vi.advanceTimersByTime(61000);
            
            // Should be allowed again
            const result = checkRateLimit(clientId, config);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
        });
    });

    describe("RateLimitPresets", () => {
        it("should have correct STRICT preset", () => {
            expect(RateLimitPresets.STRICT.limit).toBe(10);
            expect(RateLimitPresets.STRICT.windowSeconds).toBe(60);
        });

        it("should have correct AUTH preset", () => {
            expect(RateLimitPresets.AUTH.limit).toBe(5);
            expect(RateLimitPresets.AUTH.windowSeconds).toBe(900);
        });

        it("should have correct STANDARD preset", () => {
            expect(RateLimitPresets.STANDARD.limit).toBe(60);
            expect(RateLimitPresets.STANDARD.windowSeconds).toBe(60);
        });
    });
});
