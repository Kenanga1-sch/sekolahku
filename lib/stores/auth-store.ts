"use client";

import { useAuthContext } from "@/components/providers/auth-provider";

export const useAuthStore = () => {
    const context = useAuthContext();
    return {
        user: context.user,
        isAuthenticated: context.isAuthenticated,
        isLoading: context.isLoading,
        logout: context.logout,
        refreshSession: context.refreshSession
    };
};

export const useUser = () => {
    return useAuthContext().user;
};

export const useIsAuthenticated = () => {
    return useAuthContext().isAuthenticated;
};

export const useAuthLoading = () => {
    // Sync context is always loaded instantly since injected server-side
    return false;
};
