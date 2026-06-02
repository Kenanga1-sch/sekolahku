"use client";

import { createContext, useContext, ReactNode } from "react";
import useSWR from "swr";
import { goGet } from "@/lib/api-client";
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

interface SchoolSettingsResponse {
    success?: boolean;
    data?: SchoolSettings;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType>({
    settings: null,
    isLoading: true,
});

export function SchoolSettingsProvider({ children }: { children: ReactNode }) {
    const { data: response, isLoading } = useSWR<SchoolSettingsResponse>("/api/public/school-settings", goGet, {
        revalidateOnFocus: false, // Don't revalidate on window focus (settings rarely change)
        dedupingInterval: 60000, // Dedup requests within 1 minute
    });

    const settings = response?.success ? response.data : response?.data ?? null;

    return (
        <SchoolSettingsContext.Provider value={{ settings, isLoading }}>
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
