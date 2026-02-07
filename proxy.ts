import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Match routes that need auth protection (from authConfig)
    "/dashboard/:path*",
    "/spmb-admin/:path*",
    "/tabungan/:path*",
    "/library/admin/:path*",
    "/overview/:path*",
    "/users/:path*",
    "/activity-log/:path*",
    "/school-settings/:path*",
    "/profile/:path*",
    "/inventaris/:path*",
    "/perpustakaan/:path*",
  ],
};
