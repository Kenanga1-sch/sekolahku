"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface SWRProviderProps {
    children: ReactNode;
}

/**
 * Global SWR configuration provider
 * Provides consistent caching and error handling across the app
 */
export function SWRProvider({ children }: SWRProviderProps) {
    return (
        <SWRConfig
            value={{
                // Revalidation settings
                revalidateOnFocus: false, // Don't refetch when window focuses
                revalidateOnReconnect: true, // Refetch on network reconnect
                revalidateIfStale: true, // Refetch stale data in background

                // Cache settings
                dedupingInterval: 5000, // Dedupe requests within 5 seconds

                // Error retry settings
                errorRetryCount: 3,
                errorRetryInterval: 5000,

                // Loading state settings
                keepPreviousData: true, // Keep old data while loading new

                // Global error handler
                onError: (error, key) => {
                    console.error(`SWR Error [${key}]:`, error);
                },
            }}
        >
            {children}
        </SWRConfig>
    );
}
