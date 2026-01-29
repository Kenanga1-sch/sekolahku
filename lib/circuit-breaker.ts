// ==========================================
// Circuit Breaker Pattern
// ==========================================
// Prevents cascading failures when external services are down

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Time in ms before attempting recovery */
    recoveryTimeout: number;
    /** Number of successful requests needed in HALF_OPEN to close */
    successThreshold: number;
    /** Optional timeout for individual requests */
    requestTimeout?: number;
}

interface CircuitStats {
    failures: number;
    successes: number;
    lastFailureTime: number;
    state: CircuitState;
}

const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 2,
    requestTimeout: 10000, // 10 seconds
};

// Store for circuit breakers
const circuits = new Map<string, CircuitStats>();

// ==========================================
// Core Functions
// ==========================================

function getCircuit(name: string): CircuitStats {
    if (!circuits.has(name)) {
        circuits.set(name, {
            failures: 0,
            successes: 0,
            lastFailureTime: 0,
            state: "CLOSED",
        });
    }
    return circuits.get(name)!;
}

function updateCircuitState(name: string, config: CircuitBreakerConfig): void {
    const circuit = getCircuit(name);
    const now = Date.now();

    switch (circuit.state) {
        case "CLOSED":
            if (circuit.failures >= config.failureThreshold) {
                circuit.state = "OPEN";
                circuit.lastFailureTime = now;
                console.warn(`[CircuitBreaker] ${name}: Circuit OPENED after ${circuit.failures} failures`);
            }
            break;

        case "OPEN":
            if (now - circuit.lastFailureTime >= config.recoveryTimeout) {
                circuit.state = "HALF_OPEN";
                circuit.successes = 0;
                console.info(`[CircuitBreaker] ${name}: Circuit HALF_OPEN, attempting recovery`);
            }
            break;

        case "HALF_OPEN":
            if (circuit.successes >= config.successThreshold) {
                circuit.state = "CLOSED";
                circuit.failures = 0;
                circuit.successes = 0;
                console.info(`[CircuitBreaker] ${name}: Circuit CLOSED, recovery successful`);
            }
            break;
    }
}

function recordSuccess(name: string, config: CircuitBreakerConfig): void {
    const circuit = getCircuit(name);
    
    if (circuit.state === "HALF_OPEN") {
        circuit.successes++;
    } else if (circuit.state === "CLOSED") {
        // Reset failure count on success (sliding window approach)
        circuit.failures = Math.max(0, circuit.failures - 1);
    }
    
    updateCircuitState(name, config);
}

function recordFailure(name: string, config: CircuitBreakerConfig): void {
    const circuit = getCircuit(name);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    
    if (circuit.state === "HALF_OPEN") {
        // Any failure in HALF_OPEN returns to OPEN
        circuit.state = "OPEN";
        console.warn(`[CircuitBreaker] ${name}: Circuit re-OPENED due to failure in HALF_OPEN`);
    }
    
    updateCircuitState(name, config);
}

// ==========================================
// Public API
// ==========================================

/**
 * Circuit breaker error - thrown when circuit is open
 */
export class CircuitOpenError extends Error {
    constructor(circuitName: string) {
        super(`Circuit breaker '${circuitName}' is open. Service unavailable.`);
        this.name = "CircuitOpenError";
    }
}

/**
 * Execute a function with circuit breaker protection
 * 
 * @example
 * ```ts
 * const result = await withCircuitBreaker(
 *   "external-api",
 *   () => fetch("https://api.example.com/data"),
 *   { failureThreshold: 3, recoveryTimeout: 60000 }
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
    const fullConfig = { ...defaultConfig, ...config };
    const circuit = getCircuit(name);
    
    // Update state (may transition from OPEN to HALF_OPEN)
    updateCircuitState(name, fullConfig);
    
    // Check if circuit is open
    if (circuit.state === "OPEN") {
        throw new CircuitOpenError(name);
    }
    
    try {
        // Execute with optional timeout
        let result: T;
        
        if (fullConfig.requestTimeout) {
            result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Request timeout")), fullConfig.requestTimeout)
                ),
            ]);
        } else {
            result = await fn();
        }
        
        recordSuccess(name, fullConfig);
        return result;
        
    } catch (error) {
        recordFailure(name, fullConfig);
        throw error;
    }
}

/**
 * Get current circuit breaker status
 */
export function getCircuitStatus(name: string): {
    state: CircuitState;
    failures: number;
    isAvailable: boolean;
} {
    const circuit = getCircuit(name);
    updateCircuitState(name, defaultConfig);
    
    return {
        state: circuit.state,
        failures: circuit.failures,
        isAvailable: circuit.state !== "OPEN",
    };
}

/**
 * Reset a circuit breaker (for testing/admin)
 */
export function resetCircuit(name: string): void {
    circuits.set(name, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: "CLOSED",
    });
    console.info(`[CircuitBreaker] ${name}: Circuit manually reset`);
}

/**
 * Get all circuit statuses
 */
export function getAllCircuitStatuses(): Record<string, ReturnType<typeof getCircuitStatus>> {
    const statuses: Record<string, ReturnType<typeof getCircuitStatus>> = {};
    
    for (const name of circuits.keys()) {
        statuses[name] = getCircuitStatus(name);
    }
    
    return statuses;
}

// ==========================================
// Fallback Wrapper
// ==========================================

/**
 * Execute with circuit breaker and fallback
 * 
 * @example
 * ```ts
 * const data = await withFallback(
 *   "external-api",
 *   () => fetchFromAPI(),
 *   () => getCachedData(), // Fallback when circuit is open
 * );
 * ```
 */
export async function withFallback<T>(
    name: string,
    fn: () => Promise<T>,
    fallback: () => T | Promise<T>,
    config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
    try {
        return await withCircuitBreaker(name, fn, config);
    } catch (error) {
        if (error instanceof CircuitOpenError) {
            console.info(`[CircuitBreaker] ${name}: Using fallback due to open circuit`);
            return fallback();
        }
        throw error;
    }
}
