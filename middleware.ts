import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// ==========================================
// Security Headers
// ==========================================

const securityHeaders = {
    // Prevent XSS attacks
    "X-XSS-Protection": "1; mode=block",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Prevent clickjacking
    "X-Frame-Options": "SAMEORIGIN",
    
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Restrict browser features
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
    
    // Content Security Policy
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://images.unsplash.com",
        "connect-src 'self' https://*.sentry.io",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join("; "),
};

// ==========================================
// Middleware Function
// ==========================================

export default auth(async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", request.nextUrl.pathname);
    
    // Apply security headers to all responses
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    
    // Add HSTS header for HTTPS connections
    if (request.nextUrl.protocol === "https:") {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains"
        );
    }
    
    // Rate Limiting for Login
    if (request.nextUrl.pathname === "/login" && request.method === "POST") {
        const ip = request.headers.get("x-forwarded-for") || "unknown";
        const limit = rateLimit(ip);
        if (limit.blocked) {
            return new NextResponse("Too Many Requests", { status: 429 });
        }
    }

    return response;
});

// Simple in-memory rate limiter (Token Bucket / Window)
const rateLimitMap = new Map<string, { count: number; lastTime: number }>();

function rateLimit(ip: string) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const max = 5; // 5 attempts

    const record = rateLimitMap.get(ip) || { count: 0, lastTime: now };
    
    if (now - record.lastTime > windowMs) {
        // Reset window
        record.count = 1;
        record.lastTime = now;
    } else {
        record.count++;
    }
    
    rateLimitMap.set(ip, record);
    
    if (record.count > max) {
        return { blocked: true };
    }
    return { blocked: false };
}

export const config = {
    // Only run middleware on specific protected paths
    // This greatly improves performance for public pages (landing, blog, etc) by bypassing the auth check entirely
    matcher: [
        "/dashboard/:path*",
        "/spmb-admin/:path*",
        "/tabungan/admin/:path*",
        "/library/admin/:path*",
        "/overview/:path*",
        "/users/:path*",
        "/activity-log/:path*",
        "/school-settings/:path*",
        "/profile/:path*",
        "/inventaris/:path*", 
        // Note: We need to be careful not to match /inventaris/public if that exists, 
        // but assuming inventaris is mostly internal/admin based on previous context.
        // If there are public subpaths, they should be excluded.
        "/perpustakaan/admin/:path*",
        "/tabungan/admin/:path*",
        "/keuangan/:path*",
        // Also match login to redirect if already logged in
        "/login",
        "/register",
    ],
};
