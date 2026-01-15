import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Smartlib URL from environment or default
const SMARTLIB_URL = process.env.SMARTLIB_URL || "http://localhost:5173";

/**
 * SSO Redirect to Smartlib
 * 
 * This endpoint generates a redirect URL to Smartlib with the user's
 * PocketBase auth token, enabling single sign-on.
 * 
 * Usage: GET /api/sso/redirect?app=smartlib
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const app = searchParams.get("app");
    const callback = searchParams.get("callback") || "/";

    // Only support smartlib for now
    if (app !== "smartlib") {
        return NextResponse.json(
            { error: "Aplikasi tidak didukung" },
            { status: 400 }
        );
    }

    // Get auth cookie
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("sekolahku-auth");

    if (!authCookie?.value) {
        // Not authenticated, redirect to login
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", `/api/sso/redirect?app=${app}&callback=${callback}`);
        return NextResponse.redirect(loginUrl);
    }

    try {
        // Parse auth data to get token
        const authData = JSON.parse(authCookie.value);
        const token = authData?.state?.token;

        if (!token) {
            return NextResponse.json(
                { error: "Token tidak ditemukan" },
                { status: 401 }
            );
        }

        // Build redirect URL to Smartlib SSO endpoint
        const smartlibSsoUrl = new URL(`${SMARTLIB_URL}/sso-callback`);
        smartlibSsoUrl.searchParams.set("token", token);
        smartlibSsoUrl.searchParams.set("callback", callback);

        return NextResponse.redirect(smartlibSsoUrl);
    } catch (error) {
        console.error("SSO redirect error:", error);
        return NextResponse.json(
            { error: "Gagal memproses SSO" },
            { status: 500 }
        );
    }
}

/**
 * SSO Token API
 * 
 * Returns the current user's PocketBase token for use in SSO.
 * This is used when doing SSO via JavaScript instead of redirect.
 * 
 * Usage: POST /api/sso/redirect
 * Body: { app: "smartlib" }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { app } = body;

        if (app !== "smartlib") {
            return NextResponse.json(
                { error: "Aplikasi tidak didukung" },
                { status: 400 }
            );
        }

        // Get auth cookie
        const cookieStore = await cookies();
        const authCookie = cookieStore.get("sekolahku-auth");

        if (!authCookie?.value) {
            return NextResponse.json(
                { error: "Tidak terautentikasi" },
                { status: 401 }
            );
        }

        const authData = JSON.parse(authCookie.value);
        const token = authData?.state?.token;
        const user = authData?.state?.user;

        if (!token) {
            return NextResponse.json(
                { error: "Token tidak ditemukan" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            token,
            user: {
                id: user?.id,
                email: user?.email,
                name: user?.name,
                role: user?.role,
            },
            smartlib_url: `${SMARTLIB_URL}/api/sso/login`,
        });
    } catch (error) {
        console.error("SSO token error:", error);
        return NextResponse.json(
            { error: "Gagal memproses SSO" },
            { status: 500 }
        );
    }
}
