// ==========================================
// DDC (Dewey Decimal Classification) Mapping
// ==========================================
// Maps book subjects/categories from APIs (like OpenLibrary) to simplified DDC classes
// Uses keyword matching with "contains" logic

export type DDCCategory =
    | "000_COMPUTER"
    | "100_PHILOSOPHY"
    | "200_RELIGION"
    | "300_SOCIAL"
    | "400_LANGUAGE"
    | "500_SCIENCE"
    | "600_TECHNOLOGY"
    | "700_ART"
    | "800_LITERATURE"
    | "900_HISTORY"
    | "UNSORTED";

// DDC Main Classes with Indonesian & English keywords
// Each category has an array of keywords that trigger classification
const DDC_KEYWORDS: Record<Exclude<DDCCategory, "UNSORTED">, string[]> = {
    "000_COMPUTER": [
        // English
        "computer", "computing", "programming", "software", "data", "algorithm",
        "information", "internet", "web", "database", "artificial intelligence",
        "machine learning", "coding", "digital", "technology digital", "cyber",
        "encryption", "hardware", "networking", "system", "general works",
        "encyclopedia", "journalism", "news", "museum", "library", "documentation",
        // Indonesian
        "komputer", "pemrograman", "informatika", "teknologi informasi", "aplikasi",
        "perangkat lunak", "internet", "jaringan", "database", "data", "basis data",
        "umum", "ensiklopedia", "jurnalistik", "berita", "perpustakaan", "dokumentasi",
    ],
    "100_PHILOSOPHY": [
        // English
        "philosophy", "psychology", "ethics", "logic", "metaphysics", "mind",
        "consciousness", "moral", "epistemology", "phenomenology", "existentialism",
        "parapsychology", "occult", "spirituality", "self-help", "motivation",
        // Indonesian
        "filsafat", "psikologi", "etika", "logika", "moral", "kepribadian",
        "motivasi", "pengembangan diri", "spiritual",
    ],
    "200_RELIGION": [
        // English
        "religion", "religious", "theology", "spiritual", "faith", "prayer",
        "islam", "islamic", "muslim", "quran", "koran", "hadith", "fiqh", "christ",
        "christian", "christianity", "protestant", "catholic", "bible", "hindu", "hinduism", 
        "buddha", "buddhism", "jewish", "judaism", "mythology", "comparative religion",
        // Indonesian
        "agama", "keagamaan", "ibadah", "doa", "alquran", "hadits", "fiqih", "aqidah",
        "akhlak", "sholat", "alkitab", "islam", "kristen", "protestan", "katolik", 
        "hindu", "budha", "mitologi", "spiritualisme",
    ],
    "300_SOCIAL": [
        // English
        "social", "society", "politic", "political", "economic", "economics",
        "law", "legal", "education", "government", "sociology", "anthropology",
        "commerce", "trade", "business", "management", "public", "policy", "finance",
        "international relations", "culture", "cultural", "statistics", "folklore",
        "customs", "marriage", "family", "human rights", "poverty",
        // Indonesian
        "sosial", "masyarakat", "politik", "ekonomi", "hukum", "pendidikan",
        "pemerintahan", "bisnis", "manajemen", "perdagangan", "keuangan",
        "hubungan internasional", "budaya", "kebudayaan", "statistik", "rakyat",
        "adat", "pernikahan", "keluarga", "hak asasi", "miskin", "pkn", "kewarganegaraan",
    ],
    "400_LANGUAGE": [
        // English
        "language", "linguistic", "grammar", "dictionary", "vocabulary",
        "english language", "spanish language", "french language", "german language", "arabic language", "chinese language",
        "japanese language", "korean language", "indonesian language", "translation", "phonology", "syntax",
        // Indonesian
        "bahasa", "linguistik", "tata bahasa", "kamus", "kosakata",
        "terjemahan", "bahasa inggris", "bahasa arab", "bahasa mandarin", "bahasa jepang", "bahasa korea", "bahasa indonesia",
    ],
    "500_SCIENCE": [
        // English
        "science", "scientific", "math", "mathematics", "mathematical",
        "physics", "chemistry", "biology", "astronomy", "geology", "botany",
        "zoology", "ecology", "environment", "nature", "natural", "algebra",
        "geometry", "calculus", "evolution", "space", "stars", "planet",
        // Indonesian
        "ilmu pengetahuan", "sains", "matematika", "fisika", "kimia",
        "biologi", "astronomi", "geologi", "lingkungan", "alam", "aljabar",
        "geometri", "kalkulus", "evolusi", "luar angkasa", "tata surya", "biostatistik",
    ],
    "600_TECHNOLOGY": [
        // English
        "technology", "engineering", "medicine", "medical", "health",
        "agriculture", "farming", "manufacturing", "construction", "mechanical",
        "electrical", "chemical engineering", "food", "nutrition", "electronics",
        "robotic", "aviation", "cooking", "receipe", "domestic science", "parenting",
        "automotive", "home economics",
        // Indonesian
        "teknologi", "teknik", "kedokteran", "kesehatan", "pertanian",
        "manufaktur", "konstruksi", "pangan", "gizi", "elektronika", "robot",
        "penerbangan", "memasak", "resep", "masakan", "otomotif", "asuh", "kesejahteraan",
    ],
    "700_ART": [
        // English
        "art", "arts", "artistic", "music", "musical", "sport", "sports",
        "recreation", "painting", "drawing", "sculpture", "photography",
        "film", "dance", "theater", "architecture", "design", "crafts", "hobby",
        "games", "interior design", "fashion", "cinema",
        // Indonesian
        "seni", "musik", "olahraga", "rekreasi", "lukis", "gambar",
        "patung", "fotografi", "film", "tari", "teater", "arsitektur", "desain",
        "kerajinan", "hobi", "permainan", "tata busana",
    ],
    "800_LITERATURE": [
        // English
        "literature", "literary", "poetry", "poem", "drama", "novel", "fiction",
        "essay", "prose", "creative writing", "short stories", "plays",
        "american literature", "english literature", "world literature", "classics",
        "rhetoric", "oratory",
        // Indonesian
        "sastra", "puisi", "cerpen", "novel", "fiksi", "prosa", "drama", "dongeng",
        "antologi", "kumpulan cerita", "retorika", "pidato",
    ],
    "900_HISTORY": [
        // English
        "history", "historical", "geography", "geographic", "biography",
        "biographies", "travel", "world history", "ancient", "medieval",
        "modern history", "civilization", "war", "military", "atlas", "maps",
        "genealogy", "archaeology", "indonesia history", "southeast asia",
        // Indonesian
        "sejarah", "geografi", "biografi", "perjalanan", "peradaban",
        "perang", "militer", "atlas", "peta", "arkeologi", "nusantara", "kerajaan",
    ],
};

// Exclusion rules: If a category match contains these strings, it might be a false positive
// and should be ignored or penalized.
const DDC_EXCLUSIONS: Partial<Record<DDCCategory, string[]>> = {
    "400_LANGUAGE": ["history", "sejarah", "literature", "sastra", "novel"], // Book about history of language is History
    "300_SOCIAL": ["history", "sejarah", "fiction", "novel"], // Historical sociology is History
};

/**
 * Maps an array of subjects/categories from external APIs to a DDC category
 * Uses "contains" keyword matching - case insensitive
 * 
 * @param apiCategories - Array of category/subject strings from external API
 * @returns DDC category code or "UNSORTED" if no match found
 * 
 * @example
 * mapToDDC(["Computer Science", "Programming"]) // Returns "000_COMPUTER"
 * mapToDDC(["Islamic Studies", "Religion"]) // Returns "200_RELIGION"
 * mapToDDC(["Unknown"]) // Returns "UNSORTED"
 * mapToDDC([]) // Returns "UNSORTED"
 */
export function mapToDDC(apiCategories: string[] | null | undefined): DDCCategory {
    if (!apiCategories || apiCategories.length === 0) {
        return "UNSORTED";
    }

    const combined = apiCategories.join(" ").toLowerCase();
    
    // Scoring system: Category -> Score
    const scores: Record<DDCCategory, number> = {
        "000_COMPUTER": 0, "100_PHILOSOPHY": 0, "200_RELIGION": 0,
        "300_SOCIAL": 0, "400_LANGUAGE": 0, "500_SCIENCE": 0,
        "600_TECHNOLOGY": 0, "700_ART": 0, "800_LITERATURE": 0,
        "900_HISTORY": 0, "UNSORTED": 0
    };

    // Priority boost for specific categories (History, Science, Religion, Literature)
    // because they are more specific than generic "Social" or "Language"
    const priorityBoost: Partial<Record<DDCCategory, number>> = {
        "900_HISTORY": 1.5,
        "500_SCIENCE": 1.2,
        "200_RELIGION": 1.2,
        "800_LITERATURE": 1.1,
        "000_COMPUTER": 1.1,
    };

    // Calculate scores
    for (const [category, keywords] of Object.entries(DDC_KEYWORDS)) {
        let matchCount = 0;
        
        // Check for exclusions first
        const exclusions = DDC_EXCLUSIONS[category as DDCCategory] || [];
        const hasExclusion = exclusions.some(exc => combined.includes(exc.toLowerCase()));
        
        if (hasExclusion) {
            continue; // Skip this category if it contains an exclusion keyword
        }

        for (const keyword of keywords) {
            if (combined.includes(keyword.toLowerCase())) {
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            const boost = priorityBoost[category as DDCCategory] || 1.0;
            scores[category as DDCCategory] = matchCount * boost;
        }
    }

    // Find category with highest score
    let bestCategory: DDCCategory = "UNSORTED";
    let maxScore = 0;

    for (const [cat, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            bestCategory = cat as DDCCategory;
        }
    }

    return bestCategory;
}

/**
 * Get human-readable label for DDC category
 */
export function getDDCLabel(category: DDCCategory): string {
    const labels: Record<DDCCategory, string> = {
        "000_COMPUTER": "000 - Komputer & Informasi",
        "100_PHILOSOPHY": "100 - Filsafat & Psikologi",
        "200_RELIGION": "200 - Agama",
        "300_SOCIAL": "300 - Ilmu Sosial",
        "400_LANGUAGE": "400 - Bahasa",
        "500_SCIENCE": "500 - Sains & Matematika",
        "600_TECHNOLOGY": "600 - Teknologi & Kesehatan",
        "700_ART": "700 - Seni & Olahraga",
        "800_LITERATURE": "800 - Sastra",
        "900_HISTORY": "900 - Sejarah & Geografi",
        "UNSORTED": "Belum Disortir",
    };
    return labels[category] || category;
}

/**
 * Get all DDC categories with labels for UI select dropdowns
 */
export function getAllDDCCategories(): { value: DDCCategory; label: string }[] {
    return [
        { value: "000_COMPUTER", label: "000 - Komputer & Informasi" },
        { value: "100_PHILOSOPHY", label: "100 - Filsafat & Psikologi" },
        { value: "200_RELIGION", label: "200 - Agama" },
        { value: "300_SOCIAL", label: "300 - Ilmu Sosial" },
        { value: "400_LANGUAGE", label: "400 - Bahasa" },
        { value: "500_SCIENCE", label: "500 - Sains & Matematika" },
        { value: "600_TECHNOLOGY", label: "600 - Teknologi & Kesehatan" },
        { value: "700_ART", label: "700 - Seni & Olahraga" },
        { value: "800_LITERATURE", label: "800 - Sastra" },
        { value: "900_HISTORY", label: "900 - Sejarah & Geografi" },
        { value: "UNSORTED", label: "Belum Disortir" },
    ];
}

/**
 * Maps DDC category to physical shelf location
 */
export function getShelfByDDC(category: DDCCategory): string {
    const mapping: Record<DDCCategory, string> = {
        "000_COMPUTER": "RAK-000",
        "100_PHILOSOPHY": "RAK-100",
        "200_RELIGION": "RAK-200",
        "300_SOCIAL": "RAK-300",
        "400_LANGUAGE": "RAK-400",
        "500_SCIENCE": "RAK-500",
        "600_TECHNOLOGY": "RAK-600",
        "700_ART": "RAK-700",
        "800_LITERATURE": "RAK-800",
        "900_HISTORY": "RAK-900",
        "UNSORTED": "RAK-NEW",
    };
    return mapping[category] || "RAK-NEW";
}

/**
 * Get all available shelf locations
 */
export function getAllShelves() {
    return [
        { value: "RAK-000", label: "Rak 000 - Komputer & Informasi" },
        { value: "RAK-100", label: "Rak 100 - Filsafat & Psikologi" },
        { value: "RAK-200", label: "Rak 200 - Agama" },
        { value: "RAK-300", label: "Rak 300 - Ilmu Sosial" },
        { value: "RAK-400", label: "Rak 400 - Bahasa" },
        { value: "RAK-500", label: "Rak 500 - Sains & Matematika" },
        { value: "RAK-600", label: "Rak 600 - Teknologi & Kesehatan" },
        { value: "RAK-700", label: "Rak 700 - Seni & Olahraga" },
        { value: "RAK-800", label: "Rak 800 - Sastra" },
        { value: "RAK-900", label: "Rak 900 - Sejarah & Geografi" },
        { value: "RAK-REF", label: "Rak REF - Referensi & Kamus" },
        { value: "RAK-NEW", label: "Rak NEW - Belum Disortir" },
    ];
}
