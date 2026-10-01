// Kemampuan scanner eSCL (ScannerCapabilities) — diambil via proxy backend
// /api/docstation/escl/ScannerCapabilities dengan header x-printer-ip.
//
// Mengapa penting: SATUAN region eSCL adalah 1/300 inci tetap (lihat
// esclRegionUnits), sedangkan batas di ScannerCapabilities (Min/MaxWidth,
// Min/MaxHeight, X/YOffset) memakai satuan yang sama. Berdasarkan caps ini kita:
//   1. memfilter opsi DPI agar hanya menampilkan resolusi yang didukung printer,
//   2. memberi peringatan bila kertas melebihi area kaca/ADF,
//   3. meng-clamp region sebelum dikirim (printer juga clamp — kita buat
//      eksplisit agar perilaku bisa dilaporkan ke user).

import { resolvePaperMM, type PaperSize } from "@/app/(dashboard)/docstation/_components/types";

const API_BASE = "/api/docstation";
const MM_PER_INCH = 25.4;
/** Satuan region eSCL selalu 1/300 inci — bukan DPI scan yang diminta. */
export const ESCL_REGION_UNIT_DPI = 300;

/** Batas area scan satu sumber masukan, dalam satuan 1/300 inci. */
export interface ScannerInputCaps {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  /** Resolusi (DPI) yang didukung, urut naik. */
  resolutions: number[];
}

export interface ScannerCaps {
  makeModel: string;
  platen: ScannerInputCaps | null;
  adf: ScannerInputCaps | null;
}

export type ScanSourceKind = "flatbed" | "adf";

/**
 * Mengubah ukuran kertas (mm) menjadi satuan region eSCL (1/300 inci).
 *
 * SPESIFIKASI: region scan eSCL/PWG memakai satuan tetap 1/300 inci (elemen
 * pwg:ContentRegionUnits = escl:ThreeHundredthsOfInches) — BUKAN piksel pada
 * DPI yang diminta. Menghitung region pada DPI pemindaian membuat printer
 * membaca angka itu sebagai 1/300 inci: pada 150 DPI region A4 terbaca
 * setengah ukuran sehingga lampu berhenti di tengah kaca. DPI hanya menentukan
 * sampling gambar, bukan panjang area scan.
 */
export function esclRegionUnits(
  paperSize: PaperSize,
  customWidth?: number,
  customHeight?: number,
): { width: number; height: number } {
  const [wmm, hmm] = resolvePaperMM(paperSize, customWidth, customHeight);
  return {
    width: Math.round((wmm / MM_PER_INCH) * ESCL_REGION_UNIT_DPI),
    height: Math.round((hmm / MM_PER_INCH) * ESCL_REGION_UNIT_DPI),
  };
}

/** Pilih caps untuk sumber masukan (flatbed = platen). */
export function inputCapsFor(
  caps: ScannerCaps | null | undefined,
  source: ScanSourceKind,
): ScannerInputCaps | null {
  if (!caps) return null;
  return source === "adf" ? caps.adf : caps.platen;
}

/**
 * Clamp region ke area yang didukung printer agar angka yang dikirim sama
 * persis dengan yang akan diproses firmware (tanpa kejutan clamp diam-diam).
 */
export function clampRegionToCaps(
  region: { width: number; height: number },
  caps: ScannerCaps | null | undefined,
  source: ScanSourceKind,
): { width: number; height: number; clamped: boolean } {
  const ic = inputCapsFor(caps, source);
  if (!ic) return { ...region, clamped: false };
  const width = Math.min(Math.max(region.width, ic.minWidth), ic.maxWidth);
  const height = Math.min(Math.max(region.height, ic.minHeight), ic.maxHeight);
  return { width, height, clamped: width !== region.width || height !== region.height };
}

/** Apakah region melebihi maksimum area printer (kertas lebih besar dari kaca)? */
export function regionExceedsCaps(
  region: { width: number; height: number },
  caps: ScannerCaps | null | undefined,
  source: ScanSourceKind,
): boolean {
  const ic = inputCapsFor(caps, source);
  if (!ic) return false;
  return region.width > ic.maxWidth || region.height > ic.maxHeight;
}

/** Label "216 × 297 mm" dari batas caps (untuk pesan peringatan). */
export function capsMaxMMLabel(
  caps: ScannerCaps | null | undefined,
  source: ScanSourceKind,
): string | null {
  const ic = inputCapsFor(caps, source);
  if (!ic) return null;
  const toMM = (units: number) => Math.round((units / ESCL_REGION_UNIT_DPI) * MM_PER_INCH);
  return `${toMM(ic.maxWidth)} × ${toMM(ic.maxHeight)} mm`;
}

/**
 * Irisan opsi DPI dengan kemampuan printer. Bila caps tak tersedia atau
 * tidak ada irisan, kembalikan opsi apa adanya (fallback aman).
 */
export function supportedResolutions(
  caps: ScannerCaps | null | undefined,
  source: ScanSourceKind,
  options: readonly number[],
): number[] {
  const ic = inputCapsFor(caps, source);
  if (!ic || ic.resolutions.length === 0) return [...options];
  const sup = new Set(ic.resolutions);
  const filtered = options.filter((r) => sup.has(r));
  return filtered.length > 0 ? filtered : [...options];
}

/** Cari elemen berdasarkan localName (abaikan prefix XML). */
function findLocal(root: Document | Element, localName: string): Element | null {
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i];
  }
  return null;
}

function findAllLocal(root: Document | Element, localName: string): Element[] {
  const out: Element[] = [];
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) out.push(all[i]);
  }
  return out;
}

function childNumber(parent: Element, localName: string): number | null {
  const el = findLocal(parent, localName);
  if (!el || !el.textContent) return null;
  const n = Number.parseInt(el.textContent.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseInputCaps(el: Element): ScannerInputCaps | null {
  const maxWidth = childNumber(el, "MaxWidth");
  const maxHeight = childNumber(el, "MaxHeight");
  if (maxWidth === null || maxHeight === null) return null;
  const resolutions = [
    ...new Set(
      findAllLocal(el, "DiscreteResolution")
        .map((r) => childNumber(r, "XResolution"))
        .filter((r): r is number => r !== null),
    ),
  ].sort((a, b) => a - b);
  return {
    minWidth: childNumber(el, "MinWidth") ?? 1,
    maxWidth,
    minHeight: childNumber(el, "MinHeight") ?? 1,
    maxHeight,
    resolutions,
  };
}

/** Parse XML ScannerCapabilities → ScannerCaps (null bila tak terbaca). */
export function parseScannerCaps(xml: string): ScannerCaps | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return null;
  }
  if (!doc.documentElement || doc.documentElement.localName === "parsererror") return null;
  if (findLocal(doc, "parsererror")) return null;

  const platenEl = findLocal(doc, "PlatenInputCaps");
  const adfEl = findLocal(doc, "AdfSimplexInputCaps") ?? findLocal(doc, "AdfInputCaps");
  const caps: ScannerCaps = {
    makeModel: findLocal(doc, "MakeAndModel")?.textContent?.trim() ?? "",
    platen: platenEl ? parseInputCaps(platenEl) : null,
    adf: adfEl ? parseInputCaps(adfEl) : null,
  };
  return caps.platen || caps.adf ? caps : null;
}

// Cache per-IP selama sesi (caps jarang berubah; hindari GET tiap ganti panel).
const CAPS_TTL_MS = 5 * 60 * 1000;
const capsCache = new Map<string, { caps: ScannerCaps; at: number }>();

/** Hapus cache (dipakai tes). */
export function clearScannerCapsCache(): void {
  capsCache.clear();
}

/**
 * Ambil ScannerCapabilities printer. Mengembalikan null bila printer tak
 * merespons/tak terbaca (pemanggil lanjut tanpa validasi caps).
 * AbortError diteruskan agar pembersihan useEffect tetap bekerja.
 */
export async function fetchScannerCaps(
  printerIp: string,
  signal?: AbortSignal,
): Promise<ScannerCaps | null> {
  if (!printerIp) return null;
  const hit = capsCache.get(printerIp);
  if (hit && Date.now() - hit.at < CAPS_TTL_MS) return hit.caps;

  const res = await fetch(`${API_BASE}/escl/ScannerCapabilities`, {
    credentials: "include",
    headers: { "x-printer-ip": printerIp },
    signal,
  });
  if (!res.ok) return null;
  const caps = parseScannerCaps(await res.text());
  if (caps) capsCache.set(printerIp, { caps, at: Date.now() });
  return caps;
}
