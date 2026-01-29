// ==========================================
// Site Configuration
// ==========================================
// All configurable values in one place

export const siteConfig = {
    // School Information
    school: {
        name: "UPTD SDN 1 Kenanga",
        shortName: "SDN 1 Kenanga",
        npsn: "20211091",
        address: "Jl. Pendidikan No. 1, Kenanga, Sungai Penuh, Jambi",
        phone: "(0748) 123456",
        email: "sdn1kenanga@gmail.com",
        website: "https://sdn1kenanga.sch.id",
    },
    
    // Location (for SPMB zonasi)
    location: {
        lat: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LAT || "-2.072254"),
        lng: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LNG || "101.395614"),
        maxDistanceKm: 3,
    },
    
    // Current Academic Year
    academicYear: {
        current: "2025/2026",
        startYear: 2025,
        endYear: 2026,
    },
    
    // SPMB Settings
    spmb: {
        period: "SPMB 2025/2026",
        registrationFormat: "SPMB-YYYY-XXXX",
        exampleNumber: "SPMB-2026-0001",
    },
    
    // Site Metadata
    metadata: {
        title: "UPTD SDN 1 Kenanga - Website Sekolah Terpadu",
        titleTemplate: "%s | SDN 1 Kenanga",
        description: "Portal utama UPTD SDN 1 Kenanga untuk informasi sekolah, pendaftaran siswa baru (SPMB) dengan sistem zonasi, dan layanan digital terintegrasi.",
        keywords: ["SDN 1 Kenanga", "SPMB", "pendaftaran", "sekolah dasar", "Sungai Penuh", "Jambi"],
    },
    
    // Social Links
    social: {
        facebook: "",
        instagram: "",
        youtube: "",
    },
    
    // Feature Flags
    features: {
        spmbEnabled: true,
        libraryEnabled: true,
        savingsEnabled: true,
        inventoryEnabled: true,
        announcementsEnabled: true,
    },
} as const;

// Helper to get current academic year dynamically
export function getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 0-indexed
    
    // Academic year starts in July
    if (month >= 7) {
        return `${year}/${year + 1}`;
    }
    return `${year - 1}/${year}`;
}

// Helper to get SPMB period label
export function getSPMBPeriodLabel(): string {
    return `SPMB ${getCurrentAcademicYear()}`;
}

export default siteConfig;
