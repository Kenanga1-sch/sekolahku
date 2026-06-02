// ==========================================
 // Site Configuration - Env Driven
 // ==========================================

export const siteConfig = {
    // School Information from ENV
    school: {
        name: process.env.NEXT_PUBLIC_SCHOOL_NAME || "UPTD SDN 1 Kenanga",
        shortName: process.env.NEXT_PUBLIC_SCHOOL_SHORT || "SDN 1 Kenanga",
        npsn: process.env.NEXT_PUBLIC_SCHOOL_NPSN || "20211091",
        address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || "Jl. Pendidikan No. 1, Kenanga, Sungai Penuh, Jambi",
        phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || "(0748) 123456",
        email: process.env.NEXT_PUBLIC_SCHOOL_EMAIL || "sdn1kenanga@gmail.com",
        website: process.env.NEXT_PUBLIC_SCHOOL_WEBSITE || "https://sdn1kenanga.sch.id",
    },
    
    // Location (for SPMB zonasi)
    location: {
        lat: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT || "-2.072254"),
        lng: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG || "101.395614"),
        maxDistanceKm: 3,
    },
    
    // Current Academic Year from ENV
    academicYear: {
        current: process.env.CURRENT_ACADEMIC_YEAR || "2025/2026",
        startYear: 2025,
        endYear: 2026,
    },
    
    // SPMB Settings
    spmb: {
        period: `SPMB ${process.env.CURRENT_ACADEMIC_YEAR || "2025/2026"}`,
        registrationFormat: process.env.SPMB_REGISTRATION_FORMAT || "SPMB-YYYY-XXXX",
        exampleNumber: "SPMB-2026-0001",
    },
    
    // Site Metadata
    metadata: {
        title: `${process.env.NEXT_PUBLIC_SCHOOL_SHORT || "Sekolahku"} - Website Sekolah Terpadu`,
        titleTemplate: "%s | Website Sekolah Terpadu",
        description: "Portal utama sekolah untuk informasi, SPMB zonasi, perpustakaan, tabungan, inventaris.",
        keywords: ["sekolah", "SPMB", "perpustakaan", "tabungan", "inventaris"],
    },
    
    // Social Links (env expandable)
    social: {
        facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || "",
        instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "",
        youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || "",
    },
    
    // Feature Flags (env toggle)
    features: {
        spmbEnabled: process.env.NEXT_PUBLIC_FEATURE_SPMB === "false" ? false : true,
        libraryEnabled: process.env.NEXT_PUBLIC_FEATURE_LIBRARY === "false" ? false : true,
        savingsEnabled: process.env.NEXT_PUBLIC_FEATURE_SAVINGS === "false" ? false : true,
        inventoryEnabled: process.env.NEXT_PUBLIC_FEATURE_INVENTORY === "false" ? false : true,
        announcementsEnabled: true,
    },
} as const;

// Dynamic helpers
export function getCurrentAcademicYear(): string {
    return process.env.CURRENT_ACADEMIC_YEAR || (() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    })();
}

export function getSPMBPeriodLabel(): string {
    return `SPMB ${getCurrentAcademicYear()}`;
}

export default siteConfig;

