"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";

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

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: true,
            isAuthenticated: false,

            setUser: (user, token) => {
                set({
                    user,
                    token: token || get().token,
                    isAuthenticated: !!user,
                    isLoading: false,
                });
            },

            setLoading: (loading) => {
                set({ isLoading: loading });
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            },

            hydrate: () => {
                // Called after hydration to sync loading state
                const state = get();
                set({
                    isLoading: false,
                    isAuthenticated: !!state.user,
                });
            },
        }),
        {
            name: "sekolahku-auth",
            storage: createJSONStorage(() => {
                // Custom storage that syncs to both localStorage and cookie
                return {
                    getItem: (name) => {
                        if (typeof window === 'undefined') return null;
                        return localStorage.getItem(name);
                    },
                    setItem: (name, value) => {
                        if (typeof window === 'undefined') return;
                        localStorage.setItem(name, value);
                        // Also set cookie for middleware access
                        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
                    },
                    removeItem: (name) => {
                        if (typeof window === 'undefined') return;
                        localStorage.removeItem(name);
                        // Also remove cookie
                        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                    },
                };
            }),
            partialize: (state) => ({
                user: state.user,
                token: state.token,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.hydrate();
                }
            },
        }
    )
);

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
