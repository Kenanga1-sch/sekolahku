import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getAllCircuitStatuses } from "@/lib/circuit-breaker";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    version: string;
    checks: {
        database: { status: "pass" | "fail"; latency?: number; error?: string };
        memory: { status: "pass" | "warn" | "fail"; used: number; total: number; percentage: number };
        disk?: { status: "pass" | "warn" | "fail"; message?: string };
    };
    circuits?: Record<string, { state: string; failures: number; isAvailable: boolean }>;
}

/**
 * Health check endpoint for container orchestration
 * Used by Docker/Kubernetes to verify the application is running
 * 
 * Returns:
 * - 200: healthy or degraded (app is running)
 * - 503: unhealthy (critical failure)
 */
export async function GET() {
    const startTime = performance.now();
    
    const health: HealthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "unknown",
        checks: {
            database: { status: "pass" },
            memory: { status: "pass", used: 0, total: 0, percentage: 0 },
        },
    };
    
    // Database check
    try {
        const dbStart = performance.now();
        await db.run(sql`SELECT 1`);
        const dbLatency = Math.round(performance.now() - dbStart);
        health.checks.database = { status: "pass", latency: dbLatency };
    } catch (error) {
        health.checks.database = { 
            status: "fail", 
            error: error instanceof Error ? error.message : "Unknown error" 
        };
        health.status = "unhealthy";
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    health.checks.memory = {
        status: memPercentage > 90 ? "fail" : memPercentage > 75 ? "warn" : "pass",
        used: usedMB,
        total: totalMB,
        percentage: memPercentage,
    };
    
    if (memPercentage > 90) {
        health.status = health.status === "unhealthy" ? "unhealthy" : "degraded";
    }
    
    // Circuit breaker status
    try {
        health.circuits = getAllCircuitStatuses();
    } catch {
        // Ignore if circuit breaker not initialized
    }
    
    // Determine HTTP status
    const httpStatus = health.status === "unhealthy" ? 503 : 200;
    
    // Add response time
    const responseTime = Math.round(performance.now() - startTime);
    
    return NextResponse.json(
        {
            ...health,
            responseTime: `${responseTime}ms`,
        },
        { 
            status: httpStatus,
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}
