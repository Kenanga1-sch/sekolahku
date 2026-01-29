"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: () => {},
  refresh: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const user = session?.user ? ({
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name ?? undefined,
    role: (session.user as any).role ?? "user",
    image: session.user.image,
  } as unknown as User) : null;

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const logout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const refresh = () => {
    update();
  };

  const setUser = () => {
    console.warn("setUser is deprecated with NextAuth. Use server-side session update.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        logout,
        refresh,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Hook for protected routes
export function useRequireAuth(allowedRoles?: string[]) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        router.push("/");
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router, pathname]);

  return { user, isLoading, isAuthenticated };
}
