// ==========================================
// Structured Logging Utility
// ==========================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
    requestId?: string;
    userId?: string;
    action?: string;
    resource?: string;
    duration?: number;
    [key: string]: unknown;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// ==========================================
// Logger Configuration
// ==========================================

const isDev = process.env.NODE_ENV !== "production";
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isDev ? "debug" : "info");

const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[logLevel];
}

// ==========================================
// Formatters
// ==========================================

function formatForDev(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelColors: Record<LogLevel, string> = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m",  // Green
        warn: "\x1b[33m",  // Yellow
        error: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    const color = levelColors[entry.level];
    
    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${timestamp} - ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
        output += ` ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
            output += `\n  ${entry.error.stack}`;
        }
    }
    
    return output;
}

function formatForProd(entry: LogEntry): string {
    return JSON.stringify(entry);
}

// ==========================================
// Core Logger Functions
// ==========================================

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
    };

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: isDev ? error.stack : undefined,
        };
    }

    const output = isDev ? formatForDev(entry) : formatForProd(entry);

    switch (level) {
        case "error":
            console.error(output);
            break;
        case "warn":
            console.warn(output);
            break;
        default:
            console.log(output);
    }
}

// ==========================================
// Public API
// ==========================================

export const logger = {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext, error?: Error) => log("error", message, context, error),
    
    /**
     * Create a child logger with preset context
     */
    child: (defaultContext: LogContext) => ({
        debug: (message: string, context?: LogContext) => 
            log("debug", message, { ...defaultContext, ...context }),
        info: (message: string, context?: LogContext) => 
            log("info", message, { ...defaultContext, ...context }),
        warn: (message: string, context?: LogContext) => 
            log("warn", message, { ...defaultContext, ...context }),
        error: (message: string, context?: LogContext, error?: Error) => 
            log("error", message, { ...defaultContext, ...context }, error),
    }),
};

// ==========================================
// Request Logging Helpers
// ==========================================

let requestIdCounter = 0;

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++requestIdCounter % 1000).toString(36).padStart(3, "0");
    return `req_${timestamp}${counter}`;
}

/**
 * Log API request
 */
export function logRequest(
    method: string,
    path: string,
    requestId: string,
    context?: LogContext
): void {
    logger.info(`${method} ${path}`, {
        requestId,
        action: "request",
        ...context,
    });
}

/**
 * Log API response
 */
export function logResponse(
    method: string,
    path: string,
    status: number,
    duration: number,
    requestId: string
): void {
    const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    log(level, `${method} ${path} ${status} (${duration}ms)`, {
        requestId,
        action: "response",
        duration,
    });
}

/**
 * Performance timing helper
 */
export function timeStart(): number {
    return performance.now();
}

export function timeEnd(start: number): number {
    return Math.round(performance.now() - start);
}

// ==========================================
// Module-specific Loggers
// ==========================================

export const libLog = logger.child({ module: "library" });
export const spmbLog = logger.child({ module: "spmb" });
export const tabunganLog = logger.child({ module: "tabungan" });
export const inventoryLog = logger.child({ module: "inventory" });
export const authLog = logger.child({ module: "auth" });
