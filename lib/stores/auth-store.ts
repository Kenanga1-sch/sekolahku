"use client";

import { useSession, signOut } from "next-auth/react";
import type { UserRole } from "@/types";

interface User {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    image?: string;
    phone?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    setUser: (user: User | null, token?: string) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
    hydrate: () => void;
}

export const useAuthStore = <T = AuthState>(selector?: (state: AuthState) => T): T => {
    const { data: session, status } = useSession();
    
    const user = session?.user ? ({
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name ?? undefined,
        role: (session.user as any).role ?? "user",
        image: session.user.image ?? undefined,
        // session.user usually doesn't have phone, unless added to session callback
    } as User) : null;

    const state: AuthState = {
        user,
        token: null, // No accessible token in NextAuth client
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
        setUser: () => {
            console.warn("setUser is deprecated. Use NextAuth session update.");
        },
        setLoading: () => {},
        logout: () => signOut({ callbackUrl: "/login" }),
        hydrate: () => {},
    };

    if (selector) return selector(state);
    return state as unknown as T;
};

// Compatibility hooks
export const useUser = () => {
    const { user } = useAuthStore();
    return user;
};

export const useIsAuthenticated = () => {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated;
};

export const useAuthLoading = () => {
    const { isLoading } = useAuthStore();
    return isLoading;
};
