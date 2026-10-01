// Tipe bersama untuk modul DocStation.
// Semua komponen & hook DocStation mengimpor dari sini agar konsisten.

export type DocStationMode = "scan" | "print";

/** Langkah wizard scan: 1=mode, 2=konfigurasi, 3=edit, 4=simpan */
export type ScanStep = 1 | 2 | 3 | 4;
/** Langkah wizard print: 1=mode, 2=unggah, 3=pengaturan & cetak */
export type PrintStep = 1 | 2 | 3;

export type PaperSize =
  | "a3"
  | "a4"
  | "a5"
  | "a6"
  | "b4"
  | "b5"
  | "f4"
  | "letter"
  | "legal"
  | "executive"
  | "photo4x6"
  | "photo5x7"
  | "custom";
export type ScanPreset = "color" | "gray" | "text";
export type ScanSource = "flatbed" | "adf";
export type PrintMethod = "raw" | "ipp";
export type SaveFormat = "pdf" | "jpg" | "png";
export type SaveLocation = "download" | "server" | "cloud" | "arsip";

/** Jenis arsip persuratan untuk hasil scan. */
export type ArchiveCategory = "surat-masuk" | "surat-keluar";

/** Metadata arsip persuratan (dipakai saat location = "arsip"). */
export interface ArchiveMeta {
  category: ArchiveCategory;
  /** Nomor asli (surat masuk) — juga dipakai sebagai nomor untuk surat keluar bila kosong. */
  originalNumber: string;
  /** Pengirim (surat masuk) atau tujuan (surat keluar). */
  party: string;
  subject: string;
  dateOfLetter: string;
  receivedAt: string;
  classificationCode: string;
  notes: string;
}

export interface PrinterInfo {
  ip: string;
  name: string;
  secure?: boolean;
  online?: boolean;
}

export interface DocStationPrinterConfig {
  printers: PrinterInfo[];
  defaultPrinter: string;
}

/** Halaman dokumen yang sedang diedit. */
export interface DocStationPage {
  id: string;
  name: string;
  sourceUrl: string;
  width: number;
  height: number;
  rotation: number;
  fineRotation: number;
  contrast: number;
  brightness: number;
  grayscale: boolean;
  /** Koreksi gamma (0.2..3, 1 = netral). */
  gamma?: number;
  /** Cermin horizontal. */
  flipH?: boolean;
  /** Cermin vertikal. */
  flipV?: boolean;
}

export interface ScanConfig {
  printerIp: string;
  paperSize: PaperSize;
  /** Lebar kertas kustom (mm) — dipakai bila paperSize = "custom". */
  customWidth?: number;
  /** Tinggi kertas kustom (mm) — dipakai bila paperSize = "custom". */
  customHeight?: number;
  resolution: number;
  preset: ScanPreset;
  source: ScanSource;
  /** Lewati halaman kosong saat memindai (khusus ADF multi-lembar). */
  skipBlank?: boolean;
  /** Terapkan perbaikan otomatis (auto-crop + deskew + whitening) ke setiap hasil scan. */
  autoEnhance?: boolean;
}

export interface PrintConfig {
  printerIp: string;
  paperSize: PaperSize;
  /** Lebar kertas kustom (mm) — dipakai bila paperSize = "custom". */
  customWidth?: number;
  /** Tinggi kertas kustom (mm) — dipakai bila paperSize = "custom". */
  customHeight?: number;
  method: PrintMethod;
  pageSelections: Record<string, boolean>;
}

export interface SaveConfig {
  fileName: string;
  format: SaveFormat;
  location: SaveLocation;
  /** Folder Cloud Storage tujuan (null = Beranda). Hanya dipakai bila location = "cloud". */
  cloudParentId?: string | null;
  /** Label folder tujuan (untuk ditampilkan di UI). */
  cloudParentName?: string;
  /** Metadata arsip — hanya dipakai bila location = "arsip". */
  archive?: ArchiveMeta;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  printerIp: "",
  paperSize: "a4",
  customWidth: 210,
  customHeight: 297,
  resolution: 300,
  preset: "color",
  source: "flatbed",
  skipBlank: false,
  autoEnhance: false,
};

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  printerIp: "",
  paperSize: "a4",
  customWidth: 210,
  customHeight: 297,
  method: "raw",
  pageSelections: {},
};

export const DEFAULT_SAVE_CONFIG: SaveConfig = {
  fileName: "Dokumen-Scan",
  format: "pdf",
  location: "download",
  archive: {
    category: "surat-masuk",
    originalNumber: "",
    party: "",
    subject: "",
    dateOfLetter: "",
    receivedAt: "",
    classificationCode: "",
    notes: "",
  },
};

/**
 * Dimensi kertas (mm) — SUMBER TUNGGAL KEBENARAN untuk seluruh modul.
 * Dipakai oleh renderer kanvas, ekspor PDF, dan konversi eSCL.
 * "custom" dihitung terpisah memakai customWidth/customHeight.
 */
export const PAPER_SIZE_MM: Record<Exclude<PaperSize, "custom">, [number, number]> = {
  a3: [297, 420],
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
  b4: [250, 353],
  b5: [176, 250],
  f4: [215, 330],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  executive: [184.15, 266.7],
  photo4x6: [101.6, 152.4],
  photo5x7: [127, 177.8],
};

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  a3: "A3 — 297 × 420 mm",
  a4: "A4 — 210 × 297 mm",
  a5: "A5 — 148 × 210 mm",
  a6: "A6 — 105 × 148 mm",
  b4: "B4 — 250 × 353 mm",
  b5: "B5 — 176 × 250 mm",
  f4: "F4 / Folio — 215 × 330 mm",
  letter: "Letter — 216 × 279 mm",
  legal: "Legal — 216 × 356 mm",
  executive: "Executive — 184 × 267 mm",
  photo4x6: "Foto 4R — 102 × 152 mm",
  photo5x7: "Foto 5R — 127 × 178 mm",
  custom: "Custom (isi manual)",
};

/** Mengembalikan dimensi [width, height] (mm) untuk paperSize + custom. */
export function resolvePaperMM(
  paperSize: PaperSize,
  customWidth?: number,
  customHeight?: number,
): [number, number] {
  if (paperSize === "custom") {
    const w = Number(customWidth);
    const h = Number(customHeight);
    return [
      Number.isFinite(w) && w > 0 ? w : 210,
      Number.isFinite(h) && h > 0 ? h : 297,
    ];
  }
  return PAPER_SIZE_MM[paperSize] ?? PAPER_SIZE_MM.a4;
}

export const PRESET_LABELS: Record<ScanPreset, string> = {
  color: "Color (Warna Penuh)",
  gray: "Grayscale (Keabu-abuan)",
  text: "Text (B&W Hitam Putih)",
};

export const SOURCE_LABELS: Record<ScanSource, string> = {
  flatbed: "Flatbed (Kaca Meja Scan)",
  adf: "ADF (Auto Document Feeder)",
};

// 400 DPI sengaja tidak dicantumkan: tidak didukung Canon G7000
// (75/100/150/200/300/600/1200) maupun Epson L6270 (100/200/300/600/1200);
// pemilihan di panel selalu di-filter lagi terhadap ScannerCapabilities —
// mis. 75 hanya muncul di Canon, 150 hanya muncul di Canon.
export const RESOLUTION_OPTIONS = [75, 100, 150, 200, 300, 600];
