"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getSchoolSettings } from "@/lib/pocketbase";
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
    const [settings, setSettings] = useState<SchoolSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const data = await getSchoolSettings();
                setSettings(data);
            } catch (error) {
                console.error("Failed to fetch school settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchSettings();
    }, []);

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
