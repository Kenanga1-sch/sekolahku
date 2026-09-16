"use client";

import { createContext, useCallback, useContext, ReactNode } from "react";
import useSWR from "swr";
import { goGet, goPatch } from "@/lib/api-client";
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
    updateSettings: (patch: Partial<SchoolSettings>) => Promise<void>;
}

interface SchoolSettingsResponse {
    success?: boolean;
    data?: SchoolSettings;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType>({
    settings: null,
    isLoading: true,
    updateSettings: async () => {},
});

export function SchoolSettingsProvider({ children }: { children: ReactNode }) {
    const { data: response, isLoading, mutate } = useSWR<SchoolSettingsResponse>("/api/public/school-settings", goGet, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    const settings = (response?.success ? response.data : response?.data) ?? null;

    const updateSettings = useCallback(async (patch: Partial<SchoolSettings>) => {
        await goPatch("/api/public/school-settings", patch);
        await mutate();
    }, [mutate]);

    return (
        <SchoolSettingsContext.Provider value={{ settings, isLoading, updateSettings }}>
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
