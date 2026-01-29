// ==========================================
// Application Metrics
// ==========================================
// Simple in-memory metrics for monitoring
// For production, integrate with Prometheus/Grafana

// ==========================================
// Types
// ==========================================

interface Counter {
    name: string;
    help: string;
    value: number;
    labels: Record<string, string>;
}

interface Histogram {
    name: string;
    help: string;
    count: number;
    sum: number;
    buckets: Map<number, number>;
    labels: Record<string, string>;
}

interface Gauge {
    name: string;
    help: string;
    value: number;
    labels: Record<string, string>;
}

// ==========================================
// Storage
// ==========================================

const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();
const gauges = new Map<string, Gauge>();

// Default histogram buckets (in ms for latency)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// ==========================================
// Helper Functions
// ==========================================

function getKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
}

// ==========================================
// Counter Functions
// ==========================================

export function incCounter(
    name: string,
    help: string = "",
    labels: Record<string, string> = {},
    value: number = 1
): void {
    const key = getKey(name, labels);
    const existing = counters.get(key);
    
    if (existing) {
        existing.value += value;
    } else {
        counters.set(key, { name, help, value, labels });
    }
}

export function getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = getKey(name, labels);
    return counters.get(key)?.value || 0;
}

// ==========================================
// Histogram Functions
// ==========================================

export function observeHistogram(
    name: string,
    value: number,
    help: string = "",
    labels: Record<string, string> = {},
    buckets: number[] = DEFAULT_BUCKETS
): void {
    const key = getKey(name, labels);
    let histogram = histograms.get(key);
    
    if (!histogram) {
        histogram = {
            name,
            help,
            count: 0,
            sum: 0,
            buckets: new Map(buckets.map(b => [b, 0])),
            labels,
        };
        histograms.set(key, histogram);
    }
    
    histogram.count++;
    histogram.sum += value;
    
    for (const bucket of histogram.buckets.keys()) {
        if (value <= bucket) {
            histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
        }
    }
}

// ==========================================
// Gauge Functions
// ==========================================

export function setGauge(
    name: string,
    value: number,
    help: string = "",
    labels: Record<string, string> = {}
): void {
    const key = getKey(name, labels);
    gauges.set(key, { name, help, value, labels });
}

export function incGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = getKey(name, labels);
    const existing = gauges.get(key);
    
    if (existing) {
        existing.value += value;
    } else {
        gauges.set(key, { name, help: "", value, labels });
    }
}

export function decGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    incGauge(name, labels, -value);
}

// ==========================================
// Predefined Metrics
// ==========================================

export const Metrics = {
    // HTTP Metrics
    httpRequestsTotal: (method: string, path: string, status: number) =>
        incCounter("http_requests_total", "Total HTTP requests", { method, path, status: String(status) }),
    
    httpRequestDuration: (method: string, path: string, durationMs: number) =>
        observeHistogram("http_request_duration_ms", durationMs, "HTTP request duration in ms", { method, path }),
    
    // Database Metrics
    dbQueryTotal: (operation: string, table: string) =>
        incCounter("db_queries_total", "Total database queries", { operation, table }),
    
    dbQueryDuration: (operation: string, durationMs: number) =>
        observeHistogram("db_query_duration_ms", durationMs, "Database query duration in ms", { operation }),
    
    // Cache Metrics
    cacheHit: (key: string) =>
        incCounter("cache_hits_total", "Cache hits", { key }),
    
    cacheMiss: (key: string) =>
        incCounter("cache_misses_total", "Cache misses", { key }),
    
    // Error Metrics
    errorTotal: (type: string, code: string) =>
        incCounter("errors_total", "Total errors", { type, code }),
    
    // Auth Metrics
    loginAttempts: (success: boolean) =>
        incCounter("login_attempts_total", "Login attempts", { success: String(success) }),
    
    // Business Metrics
    activeUsers: (count: number) =>
        setGauge("active_users", count, "Number of active users"),
    
    pendingRegistrations: (count: number) =>
        setGauge("spmb_pending_registrations", count, "Pending SPMB registrations"),
    
    activeBorrowings: (count: number) =>
        setGauge("library_active_borrowings", count, "Active library borrowings"),
};

// ==========================================
// Prometheus Format Export
// ==========================================

export function getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Export counters
    for (const [key, counter] of counters) {
        if (counter.help) {
            lines.push(`# HELP ${counter.name} ${counter.help}`);
            lines.push(`# TYPE ${counter.name} counter`);
        }
        lines.push(`${key} ${counter.value}`);
    }
    
    // Export histograms
    for (const [, histogram] of histograms) {
        if (histogram.help) {
            lines.push(`# HELP ${histogram.name} ${histogram.help}`);
            lines.push(`# TYPE ${histogram.name} histogram`);
        }
        
        const labelStr = Object.entries(histogram.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(",");
        const labelPrefix = labelStr ? `{${labelStr},` : "{";
        
        for (const [bucket, count] of histogram.buckets) {
            lines.push(`${histogram.name}_bucket${labelPrefix}le="${bucket}"} ${count}`);
        }
        lines.push(`${histogram.name}_bucket${labelPrefix}le="+Inf"} ${histogram.count}`);
        lines.push(`${histogram.name}_sum${labelStr ? `{${labelStr}}` : ""} ${histogram.sum}`);
        lines.push(`${histogram.name}_count${labelStr ? `{${labelStr}}` : ""} ${histogram.count}`);
    }
    
    // Export gauges
    for (const [key, gauge] of gauges) {
        if (gauge.help) {
            lines.push(`# HELP ${gauge.name} ${gauge.help}`);
            lines.push(`# TYPE ${gauge.name} gauge`);
        }
        lines.push(`${key} ${gauge.value}`);
    }
    
    return lines.join("\n");
}

// ==========================================
// JSON Format Export
// ==========================================

export function getMetricsJSON(): {
    counters: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; avg: number }>;
    gauges: Record<string, number>;
} {
    const result = {
        counters: {} as Record<string, number>,
        histograms: {} as Record<string, { count: number; sum: number; avg: number }>,
        gauges: {} as Record<string, number>,
    };
    
    for (const [key, counter] of counters) {
        result.counters[key] = counter.value;
    }
    
    for (const [key, histogram] of histograms) {
        result.histograms[key] = {
            count: histogram.count,
            sum: histogram.sum,
            avg: histogram.count > 0 ? Math.round(histogram.sum / histogram.count) : 0,
        };
    }
    
    for (const [key, gauge] of gauges) {
        result.gauges[key] = gauge.value;
    }
    
    return result;
}

// ==========================================
// Reset (for testing)
// ==========================================

export function resetMetrics(): void {
    counters.clear();
    histograms.clear();
    gauges.clear();
}
