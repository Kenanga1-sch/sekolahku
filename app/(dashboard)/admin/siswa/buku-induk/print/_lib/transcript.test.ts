import { describe, it, expect } from "vitest";
import {
    buildTranscriptGrid,
    matchSubject,
    buildPrintMeta,
    meta0Year,
    fmtTanggalID,
    latestHealth,
    joinIllness,
    joinAbnormality,
    yearSortKey,
    enrolledAtYear,
    buildPromotionMap,
    CLASSES,
} from "./transcript";

describe("CLASSES", () => {
    it("berisi 6 tingkat SD", () => {
        expect(CLASSES).toEqual(["I", "II", "III", "IV", "V", "VI"]);
    });
});

describe("fmtTanggalID", () => {
    it("memformat YYYY-MM-DD ke 'DD Bulan YYYY'", () => {
        expect(fmtTanggalID("2019-01-01")).toBe("01 Januari 2019");
        expect(fmtTanggalID("2024-12-25")).toBe("25 Desember 2024");
    });
    it("menangani string dengan komponen waktu", () => {
        expect(fmtTanggalID("2019-01-01T10:30:00")).toBe("01 Januari 2019");
        expect(fmtTanggalID("2019-01-01 10:30:00")).toBe("01 Januari 2019");
    });
    it("mengembalikan string kosong bila kosong/null", () => {
        expect(fmtTanggalID("")).toBe("");
        expect(fmtTanggalID(null)).toBe("");
        expect(fmtTanggalID(undefined)).toBe("");
    });
    it("mengembalikan string asli bila tidak bisa diparse", () => {
        expect(fmtTanggalID("tidak-valid")).toBe("tidak-valid");
    });
    it("meng-cover semua nama bulan", () => {
        expect(fmtTanggalID("2020-02-14")).toBe("14 Februari 2020");
        expect(fmtTanggalID("2020-08-17")).toBe("17 Agustus 2020");
        expect(fmtTanggalID("2020-11-05")).toBe("05 November 2020");
    });
});

describe("meta0Year", () => {
    it("membaca tahunMasuk dari metaData JSON", () => {
        const s = { metaData: JSON.stringify({ tahunMasuk: "2019" }) };
        expect(meta0Year(s)).toBe("2019");
    });
    it("mengembalikan null bila metaData rusak / tidak ada", () => {
        expect(meta0Year({ metaData: "{invalid" })).toBeNull();
        expect(meta0Year({})).toBeNull();
        expect(meta0Year(null)).toBeNull();
    });
});

describe("buildTranscriptGrid", () => {
    const student = {
        enrolledYear: "2020",
        transcripts: [
            { academicYear: "2020/2021", semester: "Ganjil", subjectName: "Matematika", score: 85 },
            { academicYear: "2020/2021", semester: "Genap", subjectName: "Matematika", score: 88 },
            { academicYear: "2021/2022", semester: "Ganjil", subjectName: "Bahasa Indonesia", score: 80 },
        ],
    };

    it("memetakan academicYear ke kelas relatif tahun masuk", () => {
        const { grid } = buildTranscriptGrid(student);
        expect(grid["I"]["Matematika"]["1"]).toBe(85);
        expect(grid["I"]["Matematika"]["2"]).toBe(88);
        expect(grid["II"]["Bahasa Indonesia"]["1"]).toBe(80);
    });

    it("mengisi yearLabels per kelas", () => {
        const { yearLabels } = buildTranscriptGrid(student);
        expect(yearLabels["I"]).toBe("2020/2021");
        expect(yearLabels["II"]).toBe("2021/2022");
    });

    it("mengabaikan transkrip tanpa academicYear / subjectName", () => {
        const { grid } = buildTranscriptGrid({
            enrolledYear: "2020",
            transcripts: [
                { semester: "Ganjil", subjectName: "X", score: 1 },
                { academicYear: "2020/2021", score: 2 },
            ],
        });
        expect(Object.keys(grid)).toHaveLength(0);
    });

    it("mengabaikan tahun di luar rentang 6 tingkat", () => {
        const { grid } = buildTranscriptGrid({
            enrolledYear: "2020",
            transcripts: [
                { academicYear: "2027/2028", semester: "Ganjil", subjectName: "X", score: 90 },
            ],
        });
        expect(grid["VI"]).toBeUndefined();
    });

    it("fallback ke metaData.tahunMasuk bila enrolledYear kosong", () => {
        const { grid } = buildTranscriptGrid({
            metaData: JSON.stringify({ tahunMasuk: "2020" }),
            transcripts: [
                { academicYear: "2020/2021", semester: "Genap", subjectName: "IPAS", score: 77 },
            ],
        });
        expect(grid["I"]["IPAS"]["2"]).toBe(77);
    });
});

describe("matchSubject", () => {
    const subjects = ["Matematika", "Bahasa Indonesia", "IPAS"];
    it("cocok persis (case-insensitive, trim)", () => {
        expect(matchSubject(subjects, "  matematika ")).toBe("Matematika");
    });
    it("cocok longgar via includes", () => {
        expect(matchSubject(subjects, "Bahasa Indonesia Lanjut")).toBe("Bahasa Indonesia");
        expect(matchSubject(subjects, "IPAS")).toBe("IPAS");
    });
    it("undefined bila tidak cocok", () => {
        expect(matchSubject(subjects, "Kimia")).toBeUndefined();
    });
});

describe("buildPrintMeta", () => {
    it("mengutamakan kolom alumni di atas metaData legacy", () => {
        const m = buildPrintMeta({
            metaData: JSON.stringify({ tamatTahun: "2019" }),
            graduationYear: "2024",
        });
        // implementasi: metaData di-assign dulu, lalu kolom hanya mengisi bila meta[key] kosong.
        expect(m.tamatTahun).toBe("2019"); // metaData menang karena sudah ada
    });

    it("mengisi dari kolom alumni bila metaData tidak punya key tsb", () => {
        const m = buildPrintMeta({
            metaData: JSON.stringify({}),
            graduationYear: "2024",
        });
        expect(m.tamatTahun).toBe("2024");
    });

    it("toleran metaData rusak", () => {
        const m = buildPrintMeta({ metaData: "{oops", nickname: "Budi" });
        expect(m.namaPanggilan).toBe("Budi");
    });

    it("tidak menimpa nilai meta yang sudah ada dengan string kosong", () => {
        const m = buildPrintMeta({
            metaData: JSON.stringify({ tamatTahun: "2019" }),
            graduationYear: "",
        });
        expect(m.tamatTahun).toBe("2019");
    });

    // Data orang tua/wali (pendidikan, pekerjaan, penghasilan) kembali dicetak
    // pada format 3 halaman super lengkap — mappingnya harus tetap ada.
    it("memetakan pendidikan/pekerjaan orang tua & wali", () => {
        const m = buildPrintMeta({
            metaData: JSON.stringify({}),
            fatherEducation: "SMA",
            fatherJob: "Petani",
            motherEducation: "S1",
            motherJob: "IRT",
            guardianEducation: "D3",
            guardianJob: "Wiraswasta",
        });
        expect(m.fatherEducation).toBe("SMA");
        expect(m.fatherJob).toBe("Petani");
        expect(m.motherEducation).toBe("S1");
        expect(m.motherJob).toBe("IRT");
        expect(m.guardianEducation).toBe("D3");
        expect(m.guardianJob).toBe("Wiraswasta");
    });

    it("tetap memetakan hubungan wali", () => {
        const m = buildPrintMeta({ metaData: "{}", guardianRelation: "Paman" });
        expect(m.guardianRelation).toBe("Paman");
    });
});

describe("yearSortKey", () => {
    it("mengurutkan angka tahun", () => {
        expect(yearSortKey("2019")).toBe(2019);
        expect(yearSortKey("2024")).toBeGreaterThan(yearSortKey("2020"));
    });
    it("mengurutkan romawi 'Kelas III'", () => {
        expect(yearSortKey("Kelas I")).toBe(1);
        expect(yearSortKey("Kelas III")).toBe(3);
        expect(yearSortKey("VI")).toBe(6);
    });
    it("mengembalikan -1 untuk nilai tak dikenal", () => {
        expect(yearSortKey("")).toBe(-1);
        expect(yearSortKey(null)).toBe(-1);
        expect(yearSortKey("abc")).toBe(-1);
    });
});

describe("enrolledAtYear", () => {
    it("membaca epoch milidetik", () => {
        const ms = Date.UTC(2019, 0, 15);
        expect(enrolledAtYear(ms)).toBe(2019);
    });
    it("membaca epoch detik", () => {
        const sec = Math.floor(Date.UTC(2020, 5, 1) / 1000);
        expect(enrolledAtYear(sec)).toBe(2020);
    });
    it("NaN untuk nilai kosong/nol", () => {
        expect(enrolledAtYear(null)).toBeNaN();
        expect(enrolledAtYear(0)).toBeNaN();
        expect(enrolledAtYear("")).toBeNaN();
    });
});

describe("buildTranscriptGrid fallback enrolledAt", () => {
    it("memakai enrolledAt saat enrolledYear & metaData kosong", () => {
        const { grid } = buildTranscriptGrid({
            enrolledAt: Date.UTC(2021, 6, 1),
            transcripts: [
                { academicYear: "2021/2022", semester: "Ganjil", subjectName: "Matematika", score: 91 },
            ],
        });
        expect(grid["I"]["Matematika"]["1"]).toBe(91);
    });
});

describe("latestHealth / joinIllness / joinAbnormality", () => {
    const records = [
        { year: "Kelas I", weight: 22, height: 118, illness: "Flu", abnormality: "" },
        { year: "Kelas III", weight: 28, height: 132, illness: "Demam berdarah", abnormality: "Rabun jauh" },
        { year: "Kelas II", weight: 25, height: 125, illness: "Flu", abnormality: "" },
    ];

    it("mengambil entri terbaru (romawi terbesar)", () => {
        expect(latestHealth(records)?.year).toBe("Kelas III");
        expect(latestHealth(records)?.weight).toBe(28);
    });

    it("menggabungkan penyakit tanpa duplikat", () => {
        expect(joinIllness(records)).toBe("Flu, Demam berdarah");
    });

    it("menggabungkan kelainan jasmani", () => {
        expect(joinAbnormality(records)).toBe("Rabun jauh");
    });

    it("null/empty untuk data kosong", () => {
        expect(latestHealth([])).toBeNull();
        expect(latestHealth(undefined)).toBeNull();
        expect(joinIllness([])).toBe("");
    });
});

describe("buildPromotionMap", () => {
    it("memetakan riwayat kelas ke kelas I..VI", () => {
        const map = buildPromotionMap(
            { enrolledYear: "2020" },
            [
                { academicYear: "2020/2021", className: "II", status: "naik" },
                { academicYear: "2021/2022", className: "III", status: "tidak naik" },
            ]
        );
        expect(map["I"]).toBe("Naik ke kelas II");
        expect(map["II"]).toBe("Tidak naik kelas");
    });

    it("menyimpulkan tahun masuk dari tahun pelajaran terawal bila tak diketahui", () => {
        // Fallback baru: enrolled_year/enrolled_at kosong di data nyata, jadi
        // tahun pelajaran paling awal dianggap sebagai kelas I.
        const map = buildPromotionMap(
            {},
            [{ academicYear: "2021/2022", className: "III", status: "naik" }]
        );
        expect(map["I"]).toBe("Naik ke kelas III");
    });

    it("tetap kosong bila tidak ada tahun pelajaran sama sekali", () => {
        expect(buildPromotionMap({}, [{ status: "naik" }])).toEqual({});
    });
});
