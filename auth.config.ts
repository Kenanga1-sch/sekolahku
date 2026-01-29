import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/db/schema/users";

export const authConfig = {
    pages: { signIn: '/login' },
    session: { strategy: "jwt" },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            // Define protected routes
            const isDashboard = nextUrl.pathname.startsWith('/dashboard') || 
                                nextUrl.pathname.startsWith('/spmb-admin') ||
                                nextUrl.pathname.startsWith('/tabungan/admin') ||
                                nextUrl.pathname.startsWith('/library/admin') ||
                                nextUrl.pathname.startsWith('/overview') ||
                                nextUrl.pathname.startsWith('/users') ||
                                nextUrl.pathname.startsWith('/activity-log') ||
                                nextUrl.pathname.startsWith('/school-settings') ||
                                nextUrl.pathname.startsWith('/profile') ||
                                nextUrl.pathname.startsWith('/inventaris') ||
                                nextUrl.pathname.startsWith('/perpustakaan') ||
                                nextUrl.pathname.startsWith('/tabungan');
            
            // Allow login/register/spmb (public)
            
            if (isDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect to login
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            // console.log("Auth Debug: JWT Callback", { token, user, trigger });
            if (user) {
                token.role = user.role as UserRole;
                token.id = user.id as string;
            }
            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }
            return token;
        },
        async session({ session, token }) {
            // console.log("Auth Debug: Session Callback", { session, token });
            if (token && session.user) {
                session.user.role = token.role as UserRole;
                session.user.id = token.id as string;
            }
            return session;
        }
    },
    providers: [], // Providers configured in auth.ts
} satisfies NextAuthConfig;
