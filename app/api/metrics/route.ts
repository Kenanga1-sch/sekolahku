import { NextResponse } from "next/server";
import { getPrometheusMetrics, getMetricsJSON } from "@/lib/metrics";

/**
 * Metrics endpoint for monitoring
 * 
 * - GET /api/metrics - Returns Prometheus format (text/plain)
 * - GET /api/metrics?format=json - Returns JSON format
 * 
 * Note: In production, this endpoint should be protected
 * or exposed only to internal monitoring systems
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    
    if (format === "json") {
        return NextResponse.json(getMetricsJSON(), {
            headers: {
                "Cache-Control": "no-store",
            },
        });
    }
    
    // Default: Prometheus format
    return new NextResponse(getPrometheusMetrics(), {
        headers: {
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}
