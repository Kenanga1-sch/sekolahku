"use client";

import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { pb, getCurrentUser } from "@/lib/pocketbase";

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { setUser, setLoading, logout } = useAuthStore();

    const syncAuthState = useCallback(() => {
        // Sync PocketBase auth state with Zustand store
        if (pb.authStore.isValid && pb.authStore.record) {
            setUser(pb.authStore.record as any, pb.authStore.token);
        } else {
            // Check if we have stored auth but PocketBase doesn't
            const storedAuth = useAuthStore.getState();
            if (storedAuth.token) {
                // Try to restore PocketBase auth from stored token
                pb.authStore.save(storedAuth.token, storedAuth.user);
                if (pb.authStore.isValid) {
                    setUser(pb.authStore.record as any, pb.authStore.token);
                } else {
                    logout();
                }
            } else {
                setLoading(false);
            }
        }
    }, [setUser, setLoading, logout]);

    useEffect(() => {
        // Initial sync
        syncAuthState();

        // Listen for PocketBase auth changes
        const unsubscribe = pb.authStore.onChange((token, record) => {
            if (token && record) {
                setUser(record as any, token);
            } else {
                logout();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [syncAuthState, setUser, logout]);

    return <>{children}</>;
}
