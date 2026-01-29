import { describe, it, expect, beforeEach } from "vitest";
import { 
    withCircuitBreaker, 
    getCircuitStatus, 
    resetCircuit,
    CircuitOpenError,
    withFallback,
} from "./circuit-breaker";

describe("Circuit Breaker", () => {
    beforeEach(() => {
        // Reset all circuits before each test
        resetCircuit("test-circuit");
    });

    describe("withCircuitBreaker", () => {
        it("should execute function when circuit is closed", async () => {
            const result = await withCircuitBreaker(
                "test-circuit",
                async () => "success"
            );
            
            expect(result).toBe("success");
        });

        it("should record failures and open circuit after threshold", async () => {
            const failingFn = async () => {
                throw new Error("Service unavailable");
            };

            // Make failures up to threshold
            for (let i = 0; i < 5; i++) {
                try {
                    await withCircuitBreaker("test-circuit", failingFn, {
                        failureThreshold: 5,
                        recoveryTimeout: 30000,
                    });
                } catch {
                    // Expected
                }
            }

            // Circuit should now be open
            const status = getCircuitStatus("test-circuit");
            expect(status.state).toBe("OPEN");
        });

        it("should throw CircuitOpenError when circuit is open", async () => {
            // Force circuit open by causing failures
            const failingFn = async () => {
                throw new Error("fail");
            };

            for (let i = 0; i < 6; i++) {
                try {
                    await withCircuitBreaker("test-circuit", failingFn, {
                        failureThreshold: 5,
                    });
                } catch {
                    // Expected
                }
            }

            // Now try a request - should get CircuitOpenError
            await expect(
                withCircuitBreaker("test-circuit", async () => "success")
            ).rejects.toThrow(CircuitOpenError);
        });

        it("should record successes correctly", async () => {
            await withCircuitBreaker("test-circuit", async () => "ok");
            await withCircuitBreaker("test-circuit", async () => "ok");
            
            const status = getCircuitStatus("test-circuit");
            expect(status.state).toBe("CLOSED");
            expect(status.isAvailable).toBe(true);
        });
    });

    describe("getCircuitStatus", () => {
        it("should return CLOSED for new circuit", () => {
            const status = getCircuitStatus("new-circuit");
            
            expect(status.state).toBe("CLOSED");
            expect(status.failures).toBe(0);
            expect(status.isAvailable).toBe(true);
        });
    });

    describe("resetCircuit", () => {
        it("should reset circuit to CLOSED state", async () => {
            // Cause some failures
            const failingFn = async () => {
                throw new Error("fail");
            };

            for (let i = 0; i < 6; i++) {
                try {
                    await withCircuitBreaker("test-circuit", failingFn, {
                        failureThreshold: 5,
                    });
                } catch {
                    // Expected
                }
            }

            // Circuit should be open
            expect(getCircuitStatus("test-circuit").state).toBe("OPEN");

            // Reset
            resetCircuit("test-circuit");

            // Should be closed now
            const status = getCircuitStatus("test-circuit");
            expect(status.state).toBe("CLOSED");
            expect(status.failures).toBe(0);
        });
    });

    describe("withFallback", () => {
        it("should use fallback when circuit is open", async () => {
            const failingFn = async () => {
                throw new Error("fail");
            };

            // Open the circuit
            for (let i = 0; i < 6; i++) {
                try {
                    await withCircuitBreaker("fallback-test", failingFn, {
                        failureThreshold: 5,
                    });
                } catch {
                    // Expected
                }
            }

            // Now use withFallback
            const result = await withFallback(
                "fallback-test",
                async () => "primary",
                () => "fallback"
            );

            expect(result).toBe("fallback");
        });

        it("should use primary when circuit is closed", async () => {
            resetCircuit("fallback-test-2");
            
            const result = await withFallback(
                "fallback-test-2",
                async () => "primary",
                () => "fallback"
            );

            expect(result).toBe("primary");
        });
    });
});
