"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserRole } from "@/types";
import { getSessionAction } from "@/actions/auth";

type User = {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    phone?: string;
};

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => void;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    logout: () => {},
    refreshSession: async () => {},
});

interface AuthProviderProps {
    children: React.ReactNode;
    session?: any;
}

export function AuthProvider({ children, session: initialSession }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(initialSession?.user || null);
    const [isLoading, setIsLoading] = useState(!initialSession);

    const refreshSession = async () => {
        const session = await getSessionAction();
        if (session?.user) {
            setUser(session.user as User);
        } else {
            setUser(null);
        }
        setIsLoading(false);
    };

    const logout = async () => {
        setUser(null);
    };

    useEffect(() => {
        if (!user) {
            refreshSession();
        } else {
            setIsLoading(false);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ 
            user, 
            isAuthenticated: !!user, 
            isLoading, 
            logout,
            refreshSession
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => useContext(AuthContext);
