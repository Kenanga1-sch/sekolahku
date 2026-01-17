import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = [
    "/overview",
    "/school-settings",
    "/spmb-admin",
    "/announcements",
    "/profile",
    "/users",
    "/activity-log",
];

// Routes that require admin role
const adminRoutes = [
    "/overview",
    "/school-settings",
    "/spmb-admin",
    "/users",
    "/activity-log",
];

// Security headers
function addSecurityHeaders(response: NextResponse): NextResponse {
    // Prevent clickjacking
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions policy
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
    );

    // Content Security Policy (relaxed for development)
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss: http: https:",
        "frame-ancestors 'none'",
    ].join("; ");
    response.headers.set("Content-Security-Policy", csp);

    return response;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );

    // Create base response with security headers
    if (!isProtectedRoute) {
        return addSecurityHeaders(NextResponse.next());
    }

    // Check for auth cookie/token
    const authCookie = request.cookies.get("sekolahku-auth");

    if (!authCookie?.value) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }

    try {
        const authData = JSON.parse(authCookie.value);

        const isAdminRoute = adminRoutes.some((route) =>
            pathname.startsWith(route)
        );

        if (isAdminRoute && authData.state?.user?.role !== "admin" && authData.state?.user?.role !== "superadmin") {
            return addSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
        }

        return addSecurityHeaders(NextResponse.next());
    } catch {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
}

export const config = {
    matcher: [
        "/overview/:path*",
        "/school-settings/:path*",
        "/spmb-admin/:path*",
        "/announcements/:path*",
        "/profile/:path*",
        "/users/:path*",
        "/activity-log/:path*",
        // Also apply security headers to public routes
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
