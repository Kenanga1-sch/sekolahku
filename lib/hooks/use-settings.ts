"use client";

import useSWR from "swr";

// Default settings values
const defaultSettings = {
    id: null,
    school_name: "UPTD SDN 1 Kenanga",
    school_npsn: "20211091",
    school_address: "Jl. Pendidikan No. 1, Kenanga, Sungai Penuh, Jambi",
    school_phone: "(0748) 123456",
    school_email: "sdn1kenanga@gmail.com",
    school_website: "",
    school_lat: -2.072254,
    school_lng: 101.395614,
    max_distance_km: 3,
    spmb_is_open: true,
    current_academic_year: "2025/2026",
    principal_name: "",
    principal_nip: "",
    last_letter_number: 0,
    letter_number_format: "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
};

export type SchoolSettingsData = typeof defaultSettings;

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
        console.error(`SWR fetcher error for ${url}:`, error);
        throw error;
    }
};

/**
 * Hook to fetch school settings from the database
 * Returns default values while loading or on error
 */
export function useSchoolSettings() {
    const { data, error, isLoading, mutate } = useSWR<SchoolSettingsData>(
        "/api/school-settings",
        fetcher,
        {
            fallbackData: defaultSettings,
            revalidateOnFocus: false,
            dedupingInterval: 60000, // 1 minute
        }
    );

    return {
        settings: data || defaultSettings,
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Get the SPMB period label
 */
export function getSPMBPeriodFromSettings(settings: SchoolSettingsData): string {
    return `SPMB ${settings.current_academic_year}`;
}

export { defaultSettings };
