"use client";

import { createContext, useCallback, useContext, ReactNode } from "react";
import useSWR from "swr";
import { goGet, goPost } from "@/lib/api-client";
import { resolveSettingsPatch, type SettingsPatch } from "@/lib/resolve-settings-patch";
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
    updateSettings: (patch: SettingsPatch) => Promise<void>;
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

    // Menerima objek patch ATAU function-updater ala useState (pola tab
    // /pengaturan). Sebelumnya patch function di-spread menjadi {} sehingga
    // payload hanya berisi {id} dan update backend jadi no-op.
    const updateSettings = useCallback(async (patch: SettingsPatch) => {
        const body = resolveSettingsPatch(patch, settings);
        await goPost("/api/school-settings", { id: settings?.id, ...body });
        await mutate();
    }, [mutate, settings]);

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
