"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import useSWR from "swr";
import type { SchoolSettings } from "@/types";

// Default fallback values
const DEFAULT_SETTINGS: Partial<SchoolSettings> = {
    school_name: "Sekolah",
    school_address: "Alamat Sekolah",
    school_phone: "-",
    school_email: "-",
};

interface SchoolSettingsContextType {
    settings: SchoolSettings | null;
    isLoading: boolean;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType>({
    settings: null,
    isLoading: true,
});

export function SchoolSettingsProvider({ children }: { children: ReactNode }) {
    const fetcher = async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                const error = new Error('An error occurred while fetching the data.');
                // Attach extra info to the error object.
                (error as any).info = await res.json().catch(() => ({}));
                (error as any).status = res.status;
                throw error;
            }
            return res.json();
        } catch (error) {
            console.error(`SchoolSettingsContext fetcher error for ${url}:`, error);
            throw error;
        }
    };
    
    const { data, isLoading } = useSWR<SchoolSettings>("/api/school-settings", fetcher, {
        revalidateOnFocus: false, // Don't revalidate on window focus (settings rarely change)
        dedupingInterval: 60000, // Dedup requests within 1 minute
    });

    return (
        <SchoolSettingsContext.Provider value={{ settings: data || null, isLoading }}>
            {children}
        </SchoolSettingsContext.Provider>
    );
}

/**
 * Hook to access school settings throughout the app
 * @returns settings object and loading state
 */
export function useSchoolSettings() {
    const context = useContext(SchoolSettingsContext);
    return context;
}

/**
 * Helper to get a setting value with fallback
 */
export function getSettingValue<K extends keyof SchoolSettings>(
    settings: SchoolSettings | null,
    key: K,
    fallback?: SchoolSettings[K]
): SchoolSettings[K] | string {
    if (settings && settings[key] !== undefined && settings[key] !== null) {
        return settings[key];
    }
    return fallback ?? (DEFAULT_SETTINGS[key] as SchoolSettings[K]) ?? "";
}
