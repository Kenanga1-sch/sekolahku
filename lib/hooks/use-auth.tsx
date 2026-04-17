"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    refresh: () => {},
    setUser: () => {}
  };
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
