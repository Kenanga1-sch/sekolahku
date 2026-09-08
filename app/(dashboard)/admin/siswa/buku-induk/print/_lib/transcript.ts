// Util murni untuk matriks & meta cetak Buku Induk.
// Diekstrak dari page.tsx agar dapat diuji terpisah (unit test) dan dipakai ulang.

export const CLASSES = ["I", "II", "III", "IV", "V", "VI"]; // SD: 6 tingkat

const BULAN_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Format tanggal ke gaya Indonesia: "01 Januari 2019".
// Menerima "YYYY-MM-DD", "YYYY-MM-DDTHH:mm...", atau string tanggal lain yang bisa diparse.
// Mengembalikan string aslinya bila tidak bisa diparse; "" bila kosong.
export function fmtTanggalID(d?: string | null): string {
    if (!d) return "";
    const s = String(d).trim();
    if (!s) return "";
    // Ambil bagian tanggal saja bila ada komponen waktu.
    const datePart = s.split("T")[0].split(" ")[0];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (m) {
        const [, y, mo, da] = m;
        const bulan = BULAN_ID[parseInt(mo, 10) - 1];
        if (bulan) return `${da} ${bulan} ${y}`;
    }
    // Coba parse umum (mis. timestamp) — hindari pergeseran timezone dengan UTC.
    const t = Date.parse(s);
    if (!isNaN(t)) {
        const dt = new Date(t);
        const bulan = BULAN_ID[dt.getUTCMonth()];
        const da = String(dt.getUTCDate()).padStart(2, "0");
        if (bulan) return `${da} ${bulan} ${dt.getUTCFullYear()}`;
    }
    return s;
}

export interface TranscriptRow {
    academicYear?: string;
    semester?: string; // "Ganjil" | "Genap"
    subjectName?: string;
    score?: number;
}

export interface TranscriptGrid {
    /** kelas (I..VI) -> mapel -> semester ("1"|"2") -> nilai */
    grid: Record<string, Record<string, Record<string, number>>>;
    /** kelas -> label tahun pelajaran (mis. "2020/2021") */
    yearLabels: Record<string, string>;
}

// fallback tahun masuk untuk siswa aktif (tanpa kolom enrolledYear di students)
export function meta0Year(student: any): string | null {
    if (student?.metaData) {
        try {
            const m = JSON.parse(student.metaData);
            return m.tahunMasuk || null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Tebak tahun masuk dari `enrolled_at` (epoch ms) untuk siswa aktif.
export function enrolledAtYear(v?: number | string | null): number {
    if (v === null || v === undefined || v === "") return NaN;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (isNaN(n) || n <= 0) return NaN;
    // enrolled_at bisa dalam detik atau milidetik
    const ms = n < 1e11 ? n * 1000 : n;
    const y = new Date(ms).getFullYear();
    return isNaN(y) ? NaN : y;
}

// Kelompokkan transkrip per kelas (I–VI) dan semester.
// Kelas ditarik dari academicYear relatif terhadap tahun masuk (enrolledYear),
// atau dari penamaan academicYear itu sendiri bila tahun masuk tak diketahui.
//
// Sumber tahun masuk diuji berurutan (penting untuk siswa aktif yang tidak punya
// kolom enrolled_year): enrolledYear → metaData.tahunMasuk → enrolledAt.
export function buildTranscriptGrid(student: any): TranscriptGrid {
    const grid: Record<string, Record<string, Record<string, number>>> = {};
    const yearLabels: Record<string, string> = {};
    const transcripts: TranscriptRow[] = student?.transcripts || [];

    let enrolledYear = parseInt(student?.enrolledYear || "", 10);
    if (isNaN(enrolledYear)) {
        enrolledYear = parseInt(meta0Year(student) || "", 10);
    }
    if (isNaN(enrolledYear)) {
        enrolledYear = enrolledAtYear(student?.enrolledAt);
    }
    if (isNaN(enrolledYear)) {
        // Fallback terakhir: tahun pelajaran paling awal pada transkrip dianggap kelas I.
        // Penting karena `enrolled_year`/`enrolled_at` bisa kosong di data nyata,
        // yang membuat seluruh matriks nilai tidak pernah terisi.
        const starts = transcripts
            .map((t) => parseInt(String(t.academicYear || "").split("/")[0], 10))
            .filter((y) => !isNaN(y));
        if (starts.length) enrolledYear = Math.min(...starts);
    }

    for (const t of transcripts) {
        if (!t.academicYear || !t.subjectName) continue;
        let kelasIdx: number | null = null;
        if (!isNaN(enrolledYear)) {
            const startYear = parseInt(t.academicYear.split("/")[0], 10);
            if (!isNaN(startYear)) {
                const diff = startYear - enrolledYear;
                if (diff >= 0 && diff <= 5) kelasIdx = diff;
            }
        }
        if (kelasIdx === null) continue;
        const kelas = CLASSES[kelasIdx];
        if (!grid[kelas]) grid[kelas] = {};
        if (!grid[kelas][t.subjectName]) grid[kelas][t.subjectName] = {};
        const sem = t.semester === "Genap" ? "2" : "1";
        grid[kelas][t.subjectName][sem] = t.score ?? 0;
        yearLabels[kelas] = t.academicYear;
    }
    return { grid, yearLabels };
}

// Cocokkan label mapel transkrip ke baris matriks; longgar (case-insensitive, trim, includes).
export function matchSubject(gridSubjects: string[], label: string): string | undefined {
    const norm = (s: string) => s.trim().toLowerCase();
    return (
        gridSubjects.find((gs) => norm(gs) === norm(label)) ||
        gridSubjects.find((gs) => norm(gs).includes(norm(label)) || norm(label).includes(norm(gs)))
    );
}

export interface HealthRecord {
    id?: string;
    year?: string | number | null;
    weight?: number | null;
    height?: number | null;
    illness?: string | null;
    abnormality?: string | null;
}

// Urutan kelas Romawi (I..VI) untuk menyortir `year` berformat "Kelas I", "I", dst.
const ROMAN_ORDER: Record<string, number> = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
    vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

// Skor urutan untuk nilai `year`: angka → angka; "Kelas III"/"III" → 3; selainnya → -1.
export function yearSortKey(year: unknown): number {
    if (year === null || year === undefined) return -1;
    const raw = String(year).trim();
    if (!raw) return -1;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && String(num) === raw) return num;
    // "Kelas III" / "III" → ambil token terakhir & cocokkan romawi
    const last = raw.split(/\s+/).pop()?.toLowerCase() ?? "";
    if (ROMAN_ORDER[last] !== undefined) return ROMAN_ORDER[last];
    return -1;
}

// Ambil entri perkembangan jasmani TERBARU (urutan tahun terbesar).
// Dipakai untuk mengisi baris Berat/Tinggi Badan di seksi A secara otomatis
// dari data tab Kesehatan, sehingga tidak perlu diisi dua kali.
// Bila `year` tidak bisa diurutkan (format tak dikenal), entri terakhir dipakai.
export function latestHealth(records?: any[]): HealthRecord | null {
    const list = (records || []).filter((r) => r && (r.year || r.weight || r.height));
    if (list.length === 0) return null;
    const scored = list.map((r, idx) => ({ r, k: yearSortKey(r.year), idx }));
    const anyKnown = scored.some((s) => s.k >= 0);
    scored.sort((a, b) => {
        if (anyKnown) return b.k - a.k; // terbaru duluan
        return b.idx - a.idx; // fallback: entri terakhir yang dimasukkan
    });
    return scored[0].r;
}

// Gabungkan seluruh riwayat penyakit menjadi satu teks (dipisah koma).
export function joinIllness(records?: any[]): string {
    const vals = (records || [])
        .map((r) => (r?.illness || "").toString().trim())
        .filter((v) => v !== "");
    return Array.from(new Set(vals)).join(", ");
}

// Gabungkan seluruh catatan kelainan jasmani menjadi satu teks.
export function joinAbnormality(records?: any[]): string {
    const vals = (records || [])
        .map((r) => (r?.abnormality || "").toString().trim())
        .filter((v) => v !== "");
    return Array.from(new Set(vals)).join(", ");
}

// Peta kelas (I..VI) → keterangan naik/tidak naik, diambil dari riwayat kelas (classHistory).
// classHistory menyimpan per tahun pelajaran; indeks kelas dihitung dari tahun masuk,
// sama seperti pemetaan transkrip.
export function buildPromotionMap(
    student: any,
    classHistory?: any[]
): Record<string, string> {
    const out: Record<string, string> = {};
    const list: any[] = classHistory || student?.classHistory || [];
    let enrolledYear = parseInt(student?.enrolledYear || "", 10);
    if (isNaN(enrolledYear)) enrolledYear = parseInt(meta0Year(student) || "", 10);
    if (isNaN(enrolledYear)) enrolledYear = enrolledAtYear(student?.enrolledAt);
    if (isNaN(enrolledYear)) {
        // Fallback: tahun pelajaran paling awal = kelas I (sama seperti buildTranscriptGrid).
        const starts = list
            .map((e: any) => parseInt(String(e?.academicYear || "").split("/")[0], 10))
            .filter((y: number) => !isNaN(y));
        if (starts.length) enrolledYear = Math.min(...starts);
    }
    if (isNaN(enrolledYear)) return out;

    for (const entry of list) {
        const ay = entry?.academicYear;
        if (!ay) continue;
        const startYear = parseInt(String(ay).split("/")[0], 10);
        if (isNaN(startYear)) continue;
        const diff = startYear - enrolledYear;
        if (diff < 0 || diff > 5) continue;
        const kelas = CLASSES[diff];
        const status = (entry.status || "").toString().trim();
        if (!status) continue;
        const naik = !/tidak\s*naik|repeat|tinggal/i.test(status);
        const nextClass = (entry?.className || "").toString().trim();
        out[kelas] = naik
            ? nextClass
                ? `Naik ke kelas ${nextClass}`
                : "Naik"
            : "Tidak naik kelas";
    }
    return out;
}

// Map kolom alumni terstruktur ke keys meta yang dipakai layout cetak.
// Sumber: kolom alumni (utama, mode type=alumni) → JSON metaData siswa (legacy) → kosong.
export function buildPrintMeta(student: any): Record<string, any> {
    const meta: Record<string, any> = {};
    if (student?.metaData) {
        try {
            Object.assign(meta, JSON.parse(student.metaData));
        } catch (e) {
            /* abaikan metaData rusak */
        }
    }
    const fromCol: [string, any][] = [
        ["tahunMasuk", student?.enrolledYear],
        ["namaPanggilan", student?.nickname],
        ["kewarganegaraan", student?.citizenship],
        ["jumlahSaudaraKandung", student?.siblingKandung],
        ["jumlahSaudaraTiri", student?.siblingTiri],
        ["jumlahSaudaraAngkat", student?.siblingAngkat],
        ["bahasaSehariHari", student?.dailyLanguage],
        ["beratBadan", student?.weight],
        ["tinggiBadan", student?.height],
        ["golDarah", student?.bloodType],
        ["penyakitPernahDiderita", student?.medicalNotes],
        ["jenisTinggal", student?.livingWith],
        ["fatherEducation", student?.fatherEducation],
        ["motherEducation", student?.motherEducation],
        ["fatherJob", student?.fatherJob],
        ["motherJob", student?.motherJob],
        ["guardianRelation", student?.guardianRelation],
        ["guardianEducation", student?.guardianEducation],
        ["guardianJob", student?.guardianJob],
        ["asalSiswa", student?.previousSchool],
        ["namaTk", student?.previousSchool],
        ["alamatTk", student?.previousSchoolAddress],
        ["skTk", student?.previousSchoolCertNo],
        ["mutasiAsalSekolah", student?.mutasiMasukAsalSekolah],
        ["mutasiDariKelas", student?.mutasiMasukDariKelas],
        ["mutasiDiterimaTanggal", student?.mutasiMasukDiterimaTanggal],
        ["mutasiDiKelas", student?.mutasiMasukDiKelas],
        ["jenisBeasiswa", student?.scholarshipInfo],
        ["tamatTahun", student?.graduationYear],
        ["tamatNoIjazah", student?.ijazahNo],
        ["melanjutkanKe", student?.nextSchool],
        ["pindahDariKelas", student?.mutationOutClass],
        ["pindahKeSekolah", student?.mutationOutToSchool],
        ["pindahKeKelas", student?.mutationOutToClass],
        ["pindahTanggal", student?.mutationOutDate],
        ["keluarTanggal", student?.droppedOutDate],
        ["keluarAlasan", student?.droppedOutReason],
        ["catatanLain", student?.notes],
    ];
    for (const [key, val] of fromCol) {
        if (val !== null && val !== undefined && val !== "" && !meta[key]) {
            meta[key] = val;
        }
    }
    return meta;
}
