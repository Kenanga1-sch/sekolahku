"use client";

import useSWR from "swr";
import { goGet } from "@/lib/api-client";

// Default settings values — harus konsisten dengan data di tabel
// school_settings produksi (dashboard: Pengaturan Sekolah).
const defaultSettings = {
    id: null,
    school_name: "UPTD SDN 1 Kenanga",
    school_npsn: "20216609",
    school_address: "Jl. Perindustrian Blok Dukuh, Desa Kenanga, Kec. Sindang, Kab. Indramayu, Jawa Barat 45226",
    school_phone: "",
    school_email: "uptdsdn1kenangasindang@gmail.com",
    school_website: "sdn1kenanga.sch.id",
    school_lat: -6.363876,
    school_lng: 108.313036,
    max_distance_km: 2,
    spmb_is_open: true,
    current_academic_year: "2026/2027",
    principal_name: "",
    principal_nip: "",
    school_stamp: "",
    governance_name: "",
    department_name: "",
    school_city: "",
    supervisor_name: "",
    supervisor_nip: "",
    last_letter_number: 0,
    letter_number_format: "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
};

export type SchoolSettingsData = typeof defaultSettings;

const fetcher = async (url: string) => {
    try {
        const result: any = await goGet(url);
        return result?.data || result;
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
            revalidateOnFocus: true,
            dedupingInterval: 2000, // 2 seconds
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
