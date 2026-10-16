/**
 * tabungan-excel.ts — Pengisi template laporan Tabungan (Excel-only).
 *
 * Cara pakai: admin merancang file .xlsx berisi variabel {{...}} di sel mana
 * pun, lalu mengunggahnya lewat Admin → Format Laporan (kind xlsx, modul
 * tabungan, jadikan default). Modul ini meniru pola
 * lib/inventory/inventory-excel.ts:
 *   1. memuat template (exceljs — style sel dipertahankan),
 *   2. mengganti variabel skalar ({{sekolah_nama}}, {{periode}}, …),
 *   3. menemukan baris contoh berisi variabel baris ({{no}}, {{tanggal}}, …),
 *      mereplikasi baris itu sejumlah transaksi (style ikut disalin),
 *      sambil menggeser merge di bawahnya (blok TTD tidak tertimpa),
 *   4. mengisi tiap sel baris data + menggeser formula Excel baris contoh,
 *   5. mengembalikan workbook siap unduh (PDF menyusul via LibreOffice).
 *
 * Daftar variabel lengkap & deskripsi ada di kamus:
 *   lib/config/report-variables.ts (tab Kamus Variabel di /pengaturan?tab=laporan-format&sub=kamus),
 *   modul "tabungan". Nama di sini HARUS sama dengan nama di kamus —
 *   TABUNGAN_KNOWN_VARIABLES dipakai untuk deteksi variabel tak dikenal.
 */

import { applyPrintPageSetup, resolveModuleTemplate, type PrintSettings } from "@/lib/print-kit";
import { TABUNGAN_KNOWN_VARIABLES } from "@/lib/config/report-variables";

export const TABUNGAN_TEMPLATE_MODULE = "tabungan";
/** Fallback bawaan bila modul belum diatur admin (kosong = wajib unggah). */
export const TABUNGAN_TEMPLATE_PATH = "";

/** Satu baris transaksi yang sudah dipetakan halaman laporan. */
export interface TabunganExcelRow {
    tanggal: string;
    siswa: string;
    kelas: string;
    /** "Setor" | "Tarik" (label tampilan). */
    tipe: string;
    nominal: number;
    status: string;
    petugas: string;
}

export interface TabunganExcelScalars {
    sekolahNama?: string;
    sekolahAlamat?: string;
    sekolahTelepon?: string;
    sekolahNpsn?: string;
    sekolahEmail?: string;
    sekolahWebsite?: string;
    kepalaSekolahNama?: string;
    kepalaSekolahNip?: string;
    bendaharaNama?: string;
    periode?: string;
    tanggalCetak?: string;
    tempatTtd?: string;
    totalSaldo?: number | string;
    totalSiswa?: number | string;
    totalSetoran?: number | string;
    totalPenarikan?: number | string;
    jumlahTransaksi?: number | string;
}

export interface TabunganExcelInput {
    rows: TabunganExcelRow[];
    scalars: TabunganExcelScalars;
    paperSize?: string;
    orientation?: string;
    printSettings?: PrintSettings;
}

/** Variabel skalar yang dikenali → nilai dari input. */
export function tabunganScalarMap(input: TabunganExcelInput): Record<string, string> {
    const s = input.scalars;
    const str = (x: number | string | undefined) => (x === undefined ? "" : String(x));
    return {
        sekolah_nama: s.sekolahNama ?? "",
        sekolah_alamat: s.sekolahAlamat ?? "",
        sekolah_telepon: s.sekolahTelepon ?? "",
        sekolah_npsn: s.sekolahNpsn ?? "",
        sekolah_email: s.sekolahEmail ?? "",
        sekolah_website: s.sekolahWebsite ?? "",
        kepala_sekolah_nama: s.kepalaSekolahNama ?? "",
        kepala_sekolah_nip: s.kepalaSekolahNip ?? "",
        bendahara_nama: s.bendaharaNama ?? "",
        periode: s.periode ?? "",
        tanggal_cetak: s.tanggalCetak ?? "",
        tempat_ttd: s.tempatTtd ?? "",
        total_saldo: str(s.totalSaldo),
        total_siswa: str(s.totalSiswa),
        total_setoran: str(s.totalSetoran),
        total_penarikan: str(s.totalPenarikan),
        jumlah_transaksi: str(s.jumlahTransaksi),
    };
}

/** Nilai sel baris untuk satu transaksi (indeks 1-based). */
export function tabunganRowValues(row: TabunganExcelRow, index: number): Record<string, string | number> {
    return {
        no: index,
        tanggal: row.tanggal,
        siswa: row.siswa,
        kelas: row.kelas,
        tipe: row.tipe,
        nominal: row.nominal,
        status: row.status,
        petugas: row.petugas,
    };
}

/** Nama-nama variabel baris (tanpa kurung) — penanda baris contoh. */
const ROW_VAR_NAMES = [
    "no", "tanggal", "siswa", "kelas", "tipe", "nominal", "status", "petugas",
];

/**
 * Variabel bernilai angka. Bila sebuah sel isinya HANYA satu token ini, sel
 * diisi sebagai NUMBER — bukan string — supaya format angka template (mis.
 * "Rp" #,##0 pada Nominal) benar-benar berlaku di Excel maupun PDF.
 */
const NUMERIC_VAR_NAMES = new Set([
    "no", "nominal",
    "total_saldo", "total_siswa", "total_setoran", "total_penarikan", "jumlah_transaksi",
]);

/**
 * Ganti variabel pada SATU sel. Bila isi sel persis satu variabel numerik,
 * kembalikan number agar format angka template tetap berlaku; selain itu
 * kembalikan string hasil substitusi.
 */
export function substituteTabunganCell(
    text: string,
    values: Record<string, string | number>
): string | number | boolean {
    const m = /^\s*\{\{([a-zA-Z0-9_]+)\}\}\s*$/.exec(text);
    if (m && m[1] in values && NUMERIC_VAR_NAMES.has(m[1])) {
        const raw = values[m[1]];
        if (typeof raw === "number") return raw;
        if (raw !== "" && raw !== null && raw !== undefined && !Number.isNaN(Number(raw))) {
            return Number(raw);
        }
    }
    return substituteTabungan(text, values);
}

/** true bila sel berisi variabel baris {{...}} (penanda baris contoh). */
export function isTabunganRowVariable(text: string): boolean {
    for (const name of ROW_VAR_NAMES) {
        if (text.includes(`{{${name}}}`)) return true;
    }
    return false;
}

/** Ganti semua {{variabel}} pada teks dengan nilai map. Tak dikenal dibiarkan. */
export function substituteTabungan(text: string, values: Record<string, string | number>): string {
    return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key: string) =>
        key in values ? String(values[key]) : m
    );
}

/** Nama variabel {{...}} di luar daftar dikenal (untuk pesan/toast). */
export function unknownTabunganVariables(texts: string[]): string[] {
    const known = new Set(TABUNGAN_KNOWN_VARIABLES);
    const found = new Set<string>();
    for (const t of texts) {
        if (typeof t !== "string") continue;
        for (const m of t.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)) {
            if (!known.has(m[1])) found.add(m[1]);
        }
    }
    return [...found].sort();
}

/**
 * Geser referensi baris pada formula Excel sejauh `delta` baris (baris contoh).
 * =SUM(F8:F8) dengan templateRow=8, delta=3 → =SUM(F11:F11). Referensi absolut
 * ($8) tak disentuh.
 */
export function shiftTabunganFormulaRows(formula: string, templateRow: number, delta: number): string {
    if (delta === 0) return formula;
    const target = String(templateRow);
    return formula.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (m, col: string, abs: string, num: string) => {
        if (abs === "$") return m;
        if (num !== target) return m;
        return `${col}${Number(num) + delta}`;
    });
}

type CellLike = {
    value: unknown;
    formula?: string;
    font?: unknown;
    fill?: unknown;
    style?: unknown;
    alignment?: { wrapText?: boolean; vertical?: string; horizontal?: string };
};

type RowLike = {
    getCell(c: number): CellLike;
    eachCell(
        o: { includeEmpty?: boolean },
        cb: (cell: CellLike, col: number) => void
    ): void;
    height?: number;
};

type WsLike = {
    rowCount: number;
    columnCount?: number;
    getRow(n: number): RowLike;
    eachRow(cb: (row: RowLike, n: number) => void): void;
    duplicateRow(n: number, count: number, insert: boolean): void;
    getColumn?(c: number): { width?: number };
    getColumnCount?(): number;
};

/**
 * Terapkan injeksi pada worksheet exceljs asli (dipanggil dari komponen).
 * Mengembalikan { rowCount, unknown } untuk toast hasil.
 */
export async function fillTabunganWorksheet(
    ws: WsLike,
    input: TabunganExcelInput
): Promise<{ rowCount: number; unknown: string[] }> {
    const scalars = tabunganScalarMap(input);
    const unknown = new Set<string>();

    // Extent kolom nyata template; getCell pada kolom kosong MEMBUAT sel baru,
    // jadi batasi (hindari sel hantu → skala cetak).
    const maxCol = Math.min(ws.columnCount || 64, 64);

    // 0. Kosongkan penanda blok TTD ({{ttd_mulai}}..{{ttd_selesai}}) agar tak
    //    tampil di cetak; barisnya tetap ada sebagai penanda pagination.
    const ttdRows = tabunganTtdMarkerRows(ws, maxCol);
    if (ttdRows) {
        ws.eachRow((row) => {
            for (let c = 1; c <= maxCol; c++) {
                const cell = row.getCell(c);
                if (typeof cell.value === "string" && cell.value.includes("{{ttd_")) {
                    cell.value = cell.value.replace(/\{\{ttd_(mulai|selesai)\}\}/g, "");
                }
            }
        });
    }

    // 1. Skalar di seluruh sheet.
    ws.eachRow((row) => {
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            if (typeof cell.value === "string" && cell.value.includes("{{")) {
                const before = cell.value;
                cell.value = substituteTabunganCell(before, scalars);
                for (const v of unknownTabunganVariables([before])) unknown.add(v);
            }
        }
    });

    // 2. Cari baris contoh (variabel baris).
    let templateRow: number | null = null;
    ws.eachRow((row, n) => {
        if (templateRow !== null) return;
        for (let c = 1; c <= maxCol; c++) {
            const v = row.getCell(c).value;
            if (typeof v === "string" && isTabunganRowVariable(v)) {
                templateRow = n;
                break;
            }
        }
    });
    if (templateRow === null) {
        return { rowCount: 0, unknown: [...unknown].sort() };
    }
    const tplRowNum: number = templateRow;

    // Potret baris contoh SEBELUM replikasi (nilai + formula per kolom).
    const tplSnapshot = new Map<number, unknown>();
    ws.getRow(tplRowNum).eachCell({ includeEmpty: true }, (cell, c) => {
        tplSnapshot.set(c, cell.value);
    });

    // 3. Replikasi baris contoh sejumlah transaksi, dengan merge di bawahnya
    //    digeser (duplicateRow tidak menggeser merge — tanpa ini blok TTD
    //    tertimpa data).
    replicateWithMergeShift(ws, tplRowNum, input.rows.length);

    // 4. Isi tiap baris data.
    const tplFormulas = new Map<number, string>();
    for (const [c, v] of tplSnapshot) {
        if (v && typeof v === "object" && typeof (v as { formula?: string }).formula === "string") {
            tplFormulas.set(c, (v as { formula: string }).formula);
        } else if (typeof v === "string" && v.startsWith("=")) {
            tplFormulas.set(c, v.slice(1));
        }
    }

    input.rows.forEach((r, i) => {
        const n = tplRowNum + i;
        const vals = tabunganRowValues(r, i + 1);
        const dest = ws.getRow(n);
        for (let c = 1; c <= maxCol; c++) {
            const cell = dest.getCell(c);
            const f = tplFormulas.get(c);
            if (f !== undefined) {
                cell.value = { formula: shiftTabunganFormulaRows(f, tplRowNum, i) } as never;
                continue;
            }
            if (typeof cell.value === "string" && cell.value.includes("{{")) {
                const before = cell.value;
                cell.value = substituteTabunganCell(before, vals);
                for (const v of unknownTabunganVariables([before])) unknown.add(v);
            }
        }
    });

    // 5. Baris Jumlah opsional (hanya bila template menyediakannya).
    fillOptionalSumRow(ws, tplRowNum, input.rows, maxCol, tplSnapshot);

    // 5b. Tinggi baris menyesuaikan teks yang membungkus (wrapText). Excel asli
    //     menyesuaikan otomatis saat dibuka, tetapi LibreOffice saat konversi
    //     PDF TIDAK — sehingga baris ber-nama panjang terpotong/bertumpuk.
    autoFitDataRowHeights(ws, tplRowNum, input.rows.length, maxCol);

    // 6. Pagination: blok TTD tidak boleh terpotong. applyPagination dipanggil
    //    hanya bila ada blok TTD (fungsi print-kit).
    void ttdRows;

    // 7. Ukuran kertas/orientasi (A4/F4/LEGAL) → pageSetup Excel via print-kit.
    applyPrintPageSetup(ws as never, {
        paperSize: input.paperSize,
        orientation: input.orientation,
    });

    return { rowCount: input.rows.length, unknown: [...unknown].sort() };
}

/** 1-based nomor kolom → huruf Excel (1=A, 28=AB). */
function colLetter(col: number): string {
    let s = "";
    let n = col;
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

/**
 * Replikasi baris contoh sejumlah `count`, sambil menggeser merge cells yang
 * berada DI BAWAH baris contoh sejauh `count - 1`. duplicateRow exceljs
 * menyalin style tetapi TIDAK menggeser merge, sehingga blok tanda tangan di
 * bawah tabel akan tertimpa data bila tidak digeser.
 */
function replicateWithMergeShift(ws: WsLike, tplRowNum: number, count: number): void {
    const wsMerge = ws as unknown as {
        model?: { merges?: readonly string[] };
        unMergeCells?: (range: string) => void;
        mergeCells?: (range: string) => void;
    };
    const delta = count - 1;
    const below =
        delta > 0
            ? (wsMerge.model?.merges ?? [])
                .map((ref) => ({ ref, m: /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref) }))
                .filter(
                    (x): x is { ref: string; m: RegExpExecArray } => !!x.m && Number(x.m[2]) > tplRowNum
                )
            : [];
    for (const { ref } of below) wsMerge.unMergeCells?.(ref);
    if (count > 1) ws.duplicateRow(tplRowNum, count - 1, true);
    for (const { m } of below) {
        wsMerge.mergeCells?.(`${m[1]}${Number(m[2]) + delta}:${m[3]}${Number(m[4]) + delta}`);
    }
}

/**
 * Baris Jumlah opsional: hanya diisi bila template menyediakan baris tepat di
 * bawah data dengan label "jumlah"/"total". Kolom yang pada baris contoh
 * memuat {{nominal}} akan menjadi SUM baris data.
 */
function fillOptionalSumRow(
    ws: WsLike,
    tplRowNum: number,
    rows: TabunganExcelRow[],
    maxCol: number,
    tplSnapshot: Map<number, unknown>
): void {
    if (rows.length === 0) return;
    const sumRow = ws.getRow(tplRowNum + rows.length);
    let wantsSum = false;
    for (let c = 1; c <= maxCol; c++) {
        const v = sumRow.getCell(c).value;
        if (typeof v === "string" && /^\s*(jumlah|total)\b/i.test(v)) {
            wantsSum = true;
            break;
        }
    }
    if (!wantsSum) return;

    const first = tplRowNum;
    const last = tplRowNum + rows.length - 1;
    const sumCols: { col: number; key: "nominal" }[] = [];
    for (const [c, v] of tplSnapshot) {
        if (typeof v !== "string") continue;
        if (v.includes("{{nominal}}")) sumCols.push({ col: c, key: "nominal" });
    }
    for (const { col, key } of sumCols) {
        const L = colLetter(col);
        const sum = rows.reduce((acc, r) => acc + (key === "nominal" ? r.nominal : 0), 0);
        sumRow.getCell(col).value = {
            formula: `SUM(${L}${first}:${L}${last})`,
            result: sum,
        } as never;
    }
}

/**
 * Perkiraan jumlah baris teks yang dibutuhkan sel wrapText pada kolom selebar
 * `widthChars`. Lebar kolom Excel dinyatakan dalam satuan karakter (≈ lebar
 * digit font default); kita pakai sebagai aproksimasi kapasitas per baris.
 */
function estimateWrappedLines(text: string, widthChars: number): number {
    if (!text) return 1;
    const cap = Math.max(4, Math.floor(widthChars));
    let lines = 0;
    for (const segment of text.split("\n")) {
        const words = segment.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines += 1;
            continue;
        }
        let cur = 0;
        let used = 1;
        for (const w of words) {
            const need = cur === 0 ? w.length : w.length + 1;
            if (cur + need <= cap) {
                cur += need;
            } else {
                used += 1;
                cur = w.length > cap ? cap : w.length;
            }
        }
        lines += used;
    }
    return Math.max(1, lines);
}

/**
 * Set tinggi baris data agar teks yang membungkus (wrapText) tidak terpotong
 * saat dikonversi ke PDF. LibreOffice headless memakai tinggi tersimpan —
 * tanpa ini nama panjang menumpuk/terpotong dan layout berantakan.
 */
function autoFitDataRowHeights(
    ws: WsLike,
    tplRowNum: number,
    rowCount: number,
    maxCol: number
): void {
    if (rowCount === 0 || typeof ws.getColumn !== "function") return;
    const LINE_PT = 15;
    const MIN_PT = 16;
    const MAX_PT = 120;

    const caps = new Map<number, number>();
    for (let c = 1; c <= maxCol; c++) {
        const w = ws.getColumn?.(c)?.width;
        caps.set(c, typeof w === "number" && w > 0 ? w : 9);
    }

    for (let i = 0; i < rowCount; i++) {
        const n = tplRowNum + i;
        const row = ws.getRow(n);
        let maxLines = 1;
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            if (!cell.alignment?.wrapText) continue;
            const v = cell.value;
            if (typeof v !== "string" || !v) continue;
            maxLines = Math.max(maxLines, estimateWrappedLines(v, caps.get(c) ?? 9));
        }
        if (maxLines <= 1) continue;
        const h = Math.min(MAX_PT, Math.max(MIN_PT, maxLines * LINE_PT));
        row.height = h;
    }
}

/** Baris marker {{ttd_mulai}} dan {{ttd_selesai}} di template (null bila tak ada). */
function tabunganTtdMarkerRows(
    ws: { eachRow(cb: (row: { getCell(c: number): { value: unknown } }, n: number) => void): void },
    maxCol: number
): { start: number; end: number } | null {
    let start: number | null = null;
    let end: number | null = null;
    ws.eachRow((row, n) => {
        for (let c = 1; c <= maxCol; c++) {
            const v = row.getCell(c).value;
            if (typeof v !== "string") continue;
            if (v.includes("{{ttd_mulai}}") && start === null) start = n;
            if (v.includes("{{ttd_selesai}}")) end = n;
        }
    });
    return start !== null && end !== null ? { start, end } : null;
}

/**
 * URL template Tabungan (kind xlsx) dari
 * /api/reports/templates/default/tabungan, dinormalisasi via print-kit.
 */
export async function resolveTabunganTemplateUrl(
    fetchFn: typeof fetch = fetch,
    apiBase = ""
): Promise<{ url: string; fromDefault: boolean; paperSize?: string; orientation?: string }> {
    return resolveModuleTemplate(TABUNGAN_TEMPLATE_MODULE, {
        fetchFn,
        apiBase,
        fallbackUrl: TABUNGAN_TEMPLATE_PATH,
    });
}
