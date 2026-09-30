// Klien API DocStation (backend Go) di bawah /api/docstation/*.
//
// Endpoint dilindungi sesi JWT Sekolahku. Karena beberapa request mengirim
// body XML (eSCL) atau binary (cetak) yang bukan JSON, kita tidak memakai
// `goFetch` (yang menyetel Content-Type JSON); namun tetap menyertakan cookie
// sesi dan CSRF token agar konsisten dengan modul lain.

import type { DocStationPrinterConfig, PrinterInfo } from "@/app/(dashboard)/docstation/_components/types";
import { resolvePaperMM, type PaperSize } from "@/app/(dashboard)/docstation/_components/types";

const API_BASE = "/api/docstation";

function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const csrf = getCSRFToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

// Mengubah ukuran kertas (mm) menjadi dimensi eSCL (piksel) pada DPI tertentu.
const MM_PER_INCH = 25.4;
function esclDimensions(
  paperSize: PaperSize,
  resolution: number,
  customWidth?: number,
  customHeight?: number,
): { width: number; height: number } {
  const [wmm, hmm] = resolvePaperMM(paperSize, customWidth, customHeight);
  return {
    width: Math.round((wmm / MM_PER_INCH) * resolution),
    height: Math.round((hmm / MM_PER_INCH) * resolution),
  };
}

// ops signal dipakai polling status printer agar permintaan bisa dibatalkan
// saat komponen unmount (tanpa ini, hasil yang sudah terlanjur jalan tetap
// memanggil setState di komponen yang sudah dilepas).
export async function fetchStatus(signal?: AbortSignal): Promise<{
  printers: PrinterInfo[];
  defaultPrinter: string;
}> {
  const res = await fetch(`${API_BASE}/status`, { credentials: "include", signal });
  if (!res.ok) throw new Error("Gagal memeriksa status printer");
  const data = await res.json();
  return {
    printers: (data.printers ?? []).map((p: PrinterInfo) => ({
      ip: p.ip,
      name: p.name,
      online: p.online,
    })),
    defaultPrinter: data.printerIp ?? data.defaultPrinter ?? "",
  };
}

export async function fetchPrinters(): Promise<DocStationPrinterConfig> {
  const res = await fetch(`${API_BASE}/printers`, { credentials: "include" });
  if (!res.ok) throw new Error("Gagal memuat daftar printer");
  const data = await res.json();
  return { printers: data.printers ?? [], defaultPrinter: data.defaultPrinter ?? "" };
}

export interface ScanRequest {
  resolution: number;
  preset: "color" | "gray" | "text";
  paperSize: PaperSize;
  customWidth?: number;
  customHeight?: number;
  source: "flatbed" | "adf";
  printerIp: string;
  onProgress?: (message: string, percent: number) => void;
  /** Sinyal pembatalan — loop ADF berhenti di lembar berikutnya. */
  signal?: AbortSignal;
}

/** Batas lembar ADF per sekali scan agar tak OOM di perangkat lemah. */
export const ADF_MAX_PAGES = 50;

/** Meminta pemindaian eSCL dan mengembalikan daftar blob gambar (per lembar). */
export async function requestScan(req: ScanRequest): Promise<Blob[]> {
  const { resolution, preset, paperSize, customWidth, customHeight, source, printerIp, onProgress, signal } = req;
  const colorMode = preset === "color" ? "RGB24" : preset === "gray" ? "Grayscale8" : "RGB24";
  const dim = esclDimensions(paperSize, resolution, customWidth, customHeight);
  const inputSource = source === "adf" ? "Adf" : "Platen";

  const scanSettings =
    `<?xml version="1.0" encoding="UTF-8"?><scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03">` +
    `<pwg:Version xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">2.0</pwg:Version>` +
    `<pwg:ScanRegions xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm"><pwg:ScanRegion>` +
    `<pwg:Height>${dim.height}</pwg:Height><pwg:Width>${dim.width}</pwg:Width>` +
    `<pwg:XOffset>0</pwg:XOffset><pwg:YOffset>0</pwg:YOffset>` +
    `</pwg:ScanRegion></pwg:ScanRegions>` +
    `<pwg:InputSource xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">${inputSource}</pwg:InputSource>` +
    `<scan:ColorMode>${colorMode}</scan:ColorMode>` +
    `<scan:XResolution>${resolution}</scan:XResolution><scan:YResolution>${resolution}</scan:YResolution>` +
    `<pwg:DocumentFormat xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">image/jpeg</pwg:DocumentFormat>` +
    `</scan:ScanSettings>`;

  onProgress?.("Menghubungkan ke scanner eSCL…", 15);

  const response = await fetch(`${API_BASE}/escl/ScanJobs`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({ "Content-Type": "text/xml", "x-printer-ip": printerIp }),
    body: scanSettings,
    signal,
  });
  if (!response.ok) {
    const errText = await response.text();
    let msg = errText;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error || parsed.detail || errText;
    } catch {
      /* bukan JSON */
    }
    throw new Error(msg || `Printer ${printerIp} menolak permintaan scan`);
  }

  const jobPath = response.headers.get("x-docstation-job") || response.headers.get("location");
  if (!jobPath) throw new Error("Printer tidak mengembalikan lokasi pekerjaan scan");

  onProgress?.("Memindai berkas dari scanner…", 45);

  const blobs: Blob[] = [];
  try {
    if (source === "adf") {
      let pageNum = 1;
      while (pageNum <= ADF_MAX_PAGES) {
        signal?.throwIfAborted();
        onProgress?.(`Memindai lembar ADF ke-${pageNum}…`, Math.min(90, 45 + pageNum * 10));
        const nextDocPath = `${jobPath.replace(/\/$/, "")}/NextDocument`;
        const docResp = await fetch(nextDocPath, {
          credentials: "include",
          headers: { "x-printer-ip": printerIp },
          signal,
        });
        if (!docResp.ok) break;
        const blob = await docResp.blob();
        if (!blob || blob.size === 0) break;
        blobs.push(blob);
        pageNum++;
      }
    } else {
      const nextDocPath = jobPath.endsWith("/NextDocument")
        ? jobPath
        : `${jobPath.replace(/\/$/, "")}/NextDocument`;
      const docResp = await fetch(nextDocPath, {
        credentials: "include",
        headers: { "x-printer-ip": printerIp },
        signal,
      });
      if (!docResp.ok) {
        throw new Error((await docResp.text()) || "Gagal mengambil gambar hasil pemindaian");
      }
      blobs.push(await docResp.blob());
    }
  } finally {
    const cleanJobPath = jobPath.replace(/\/NextDocument$/, "");
    fetch(cleanJobPath, {
      method: "DELETE",
      credentials: "include",
      headers: mutationHeaders({ "x-printer-ip": printerIp }),
    }).catch(() => {});
  }

  if (blobs.length === 0) {
    throw new Error("Tidak ada lembaran kertas yang terdeteksi di scanner");
  }

  onProgress?.("Selesai memproses hasil scan!", 100);
  return blobs;
}

export interface PrintableFile {
  name: string;
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
}

/** Mengirim berkas ke printer. method "ipv"/"raw" dipetakan ke endpoint backend. */
export async function sendPrintFile(
  file: PrintableFile,
  printerIp: string,
  method: "raw" | "ipp",
): Promise<void> {
  const endpoint = method === "ipp" ? `${API_BASE}/print/ipp` : `${API_BASE}/print`;
  const blob = new Blob([file.bytes as BlobPart], {
    type: file.contentType || "application/pdf",
  });
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({
      "Content-Type": file.contentType || "application/pdf",
      "x-printer-ip": printerIp,
    }),
    body: blob,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.detail || "Gagal mengirim pekerjaan ke printer");
  }
}

/** Menyimpan berkas hasil scan ke server (folder arsip DocStation). */
export async function saveFileToServer(file: PrintableFile): Promise<void> {
  const blob = new Blob([file.bytes as BlobPart], {
    type: file.contentType || "application/octet-stream",
  });
  const response = await fetch(`${API_BASE}/save`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders({
      "Content-Type": "application/octet-stream",
      "x-docstation-filename": encodeURIComponent(file.name),
    }),
    body: blob,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Backend Fase 3 menolak printer tak dikenal dengan 400 eksplisit —
    // teruskan pesannya agar operator tahu harus pilih printer terdaftar.
    throw new Error(body.error || body.detail || "Server menolak penyimpanan berkas");
  }
}

export interface ArchiveUploadMeta {
  category: "surat-masuk" | "surat-keluar";
  originalNumber?: string;
  party?: string;
  subject?: string;
  dateOfLetter?: string;
  receivedAt?: string;
  classificationCode?: string;
  notes?: string;
}

/**
 * Mengarsipkan berkas hasil scan ke arsip persuratan (surat masuk/keluar) dan
 * opsional menautkannya ke ruang arsip Cloud Storage.
 */
export async function archiveScanFile(
  file: PrintableFile,
  meta: ArchiveUploadMeta,
): Promise<{ id: string; mailNumber?: string; filePath: string; cloudFileId?: string | null }> {
  const blob = new Blob([file.bytes as BlobPart], {
    type: file.contentType || "application/pdf",
  });
  const asFile = new File([blob], file.name, { type: file.contentType || "application/pdf" });

  const form = new FormData();
  form.append("file", asFile);
  form.append("category", meta.category);
  form.append("originalNumber", meta.originalNumber ?? "");
  form.append("subject", meta.subject ?? "");
  form.append("dateOfLetter", meta.dateOfLetter ?? "");
  form.append("classificationCode", meta.classificationCode ?? "");
  form.append("notes", meta.notes ?? "");
  if (meta.category === "surat-masuk") {
    form.append("sender", meta.party ?? "");
    form.append("receivedAt", meta.receivedAt ?? "");
  } else {
    form.append("recipient", meta.party ?? "");
  }

  const response = await fetch(`${API_BASE}/archive`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders(),
    body: form,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Gagal mengarsipkan berkas");
  }
  return response.json();
}
