/**
 * report-template-runner.ts — Menjalankan template format laporan v3 dari
 * server: ambil template berdasarkan kode, isi dataset + variabel global,
 * lalu render PDF. Dipakai modul-modul lain (mis. Inventaris) agar cetak
 * laporan mengikuti format yang dirancang admin di Studio Format Laporan.
 */

import { goGet } from "@/lib/api-client";
import { getSchoolLogo } from "@/lib/school-logo";
import type { SchoolSettings } from "@/types";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import { deserializeWorkbook } from "@/lib/report-engine-v3";
import { generateReportPdf } from "@/lib/report-pdf";

/** Bangun data sekolah standar untuk header/kop & tanda tangan PDF. */
export function schoolToLetterData(settings: SchoolSettings | null | undefined): LetterSchoolData {
  return {
    schoolName: settings?.school_name || "SEKOLAH DEMO",
    npsn: settings?.school_npsn || "",
    address: settings?.school_address || "Jl. Pendidikan No. 1",
    phone: settings?.school_phone || "021-123456",
    email: settings?.school_email || "info@sekolah.sch.id",
    website: settings?.school_website || "",
    logoUrl: getSchoolLogo(settings?.school_logo),
    governanceLine: settings?.governance_name || "PEMERINTAH KABUPATEN",
    departmentLine: settings?.department_name || "DINAS PENDIDIKAN DAN KEBUDAYAAN",
    principalName: settings?.principal_name || "Kepala Sekolah, M.Pd",
    principalNip: settings?.principal_nip || "19800101 200501 1 001",
    stampUrl: settings?.school_stamp || "",
  };
}

/** Ambil template laporan berdasarkan kode. Mengembalikan null bila tak ada. */
export async function fetchTemplateByCode(code: string) {
  try {
    const res: any = await goGet(`/api/reports/templates/code/${encodeURIComponent(code)}`);
    const tpl = res?.data ?? res;
    if (!tpl || !tpl.layoutJson) return null;
    return applyTemplateRecord(tpl);
  } catch {
    return null;
  }
}

/** Terapkan metadata record template ke workbook hasil deserialisasi. */
function applyTemplateRecord(tpl: any) {
  const workbook = deserializeWorkbook(tpl.layoutJson);
  workbook.reportCode = tpl.code || workbook.reportCode;
  workbook.reportName = tpl.name || workbook.reportName;
  workbook.category = tpl.category || workbook.category;
  workbook.module = tpl.module || workbook.module;
  if (tpl.paperSize) workbook.paperSize = tpl.paperSize;
  if (tpl.orientation) workbook.orientation = tpl.orientation;
  return workbook;
}

/**
 * Ambil template default untuk sebuah modul (isDefault lebih dulu). Bila tidak
 * ada yang default, pakai template pertama yang terhubung ke modul tersebut.
 * Mengembalikan null bila modul belum punya format.
 */
export async function fetchTemplateByModule(module: string) {
  try {
    const res: any = await goGet(`/api/reports/templates/module/${encodeURIComponent(module)}`);
    const list: any[] = Array.isArray(res?.data) ? res.data : [];
    if (list.length === 0) return null;
    const chosen = list.find((t) => t.isDefault) || list[0];
    if (!chosen?.layoutJson) return null;
    return applyTemplateRecord(chosen);
  } catch {
    return null;
  }
}

export interface RenderTemplateOptions {
  code: string;
  dataset?: Record<string, any>[];
  /** Dataset bernama untuk laporan multi-sumber (lembar memilih via `datasetName`). */
  datasets?: Record<string, Record<string, any>[]>;
  global?: Record<string, any>;
  settings: SchoolSettings | null | undefined;
  fileName?: string;
  /** Dipanggil bila template tidak ditemukan / gagal. */
  fallback?: () => void;
}

/**
 * Render PDF dari template kode. Mengembalikan Blob, atau null bila template
 * tidak tersedia (pemanggil dapat memutuskan fallback).
 */
export async function renderTemplatePdf(opts: RenderTemplateOptions): Promise<Blob | null> {
  const workbook = await fetchTemplateByCode(opts.code);
  if (!workbook) {
    opts.fallback?.();
    return null;
  }
  try {
    const blob = await generateReportPdf({
      workbook,
      school: schoolToLetterData(opts.settings),
      dataset: opts.dataset || [],
      datasets: opts.datasets,
      global: opts.global || {},
      fileName: opts.fileName || workbook.reportName || "Laporan",
    });
    return blob;
  } catch {
    opts.fallback?.();
    return null;
  }
}

export interface RenderModuleOptions {
  module: string;
  dataset?: Record<string, any>[];
  datasets?: Record<string, Record<string, any>[]>;
  global?: Record<string, any>;
  settings: SchoolSettings | null | undefined;
  fileName?: string;
  fallback?: () => void;
}

/**
 * Render PDF memakai format default modul (diatur admin di halaman
 * "Laporan & Format"). Jatuh ke `fallback` bila modul belum punya format.
 */
export async function renderModuleReport(opts: RenderModuleOptions): Promise<Blob | null> {
  const workbook = await fetchTemplateByModule(opts.module);
  if (!workbook) {
    opts.fallback?.();
    return null;
  }
  try {
    return await generateReportPdf({
      workbook,
      school: schoolToLetterData(opts.settings),
      dataset: opts.dataset || [],
      datasets: opts.datasets,
      global: opts.global || {},
      fileName: opts.fileName || workbook.reportName || "Laporan",
    });
  } catch {
    opts.fallback?.();
    return null;
  }
}

/** Unduh Blob sebagai file PDF. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const safe = (fileName || "Laporan").replace(/[\\/:*?"<>|]+/g, "_");
  const withExt = safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = withExt;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
