/**
 * template-word.ts — Injeksi template Word (.docx) untuk laporan naratif.
 *
 * Pasangan dari lib/template-excel.ts (yang khusus .xlsx rekap):
 *   - resolveTemplateUrl: cari template default modul via
 *     /api/reports/templates/default/:module (kind=docx), tanpa fallback
 *     bawaan (modul naratif wajib punya template yang diunggah admin).
 *   - fillWordTemplate: render docxtemplater ({{variabel}}, loop {#rows}…{/rows},
 *     kondisi) → Blob .docx siap unduh.
 *   - downloadWordTemplate: orkestrasi resolve → fetch → render → unduh,
 *     mengembalikan { unknown } (variabel template tak terisi data).
 *
 * Sintaks template mengikuti docxtemplater v3 DENGAN delimiters {{ }} —
 *   PENTING: karena delimiters diganti ke kurawal ganda (agar konsisten dengan
 *   variabel Excel {{...}}), loop/kondisi juga memakai kurawal ganda:
 *   {{nama}}                          → variabel skalar
 *   {{#siswa}}…{{nama}}…{{/siswa}}     → loop per baris (section = key data)
 *   {{#tampilkan}}…{{/tampilkan}}     → kondisi (truthy)
 *   {{^kosong}}…{{/kosong}}           → kondisi terbalik (falsy)
 *   Tulis loop satu section per paragraf untuk hasil tabel/rapor yang rapi.
 *
 * Semua import berat (pizzip, docxtemplater, file-saver) dynamic agar tidak
 * membengkakkan bundle awal.
 */

export type WordTemplateData = Record<string, string | number | boolean | null | undefined | object>;

export interface ResolveTemplateResult {
  url: string;
  code: string;
  name: string;
  /** true bila berkas berasal dari template bawaan repo, bukan unggahan admin. */
  fromFallback?: boolean;
}

/**
 * Ambil template default sebuah modul. Hanya yang berkind docx (atau tanpa
 * kind tapi berekstensi .docx) yang diterima; selain itu error agar pemanggil
 * bisa menampilkan pesan "belum ada template Word" alih-alih unduhan rusak.
 *
 * `fallbackUrl` (opsional) dipakai bila default modul belum ada / bukan docx —
 * pola yang sama dengan `resolveModuleTemplate` di print-kit (modul presensi):
 * template bawaan repo tetap bisa dipakai walau admin belum mengunggah.
 */
export async function resolveWordTemplate(
  module: string,
  fetchFn: typeof fetch = fetch,
  apiBase = "",
  fallbackUrl?: string
): Promise<ResolveTemplateResult> {
  const fallbackResult = (): ResolveTemplateResult | null =>
    fallbackUrl ? { url: fallbackUrl, code: "", name: "", fromFallback: true } : null;

  const json = await fetchDefaultTemplate(module, fetchFn, apiBase);
  const meta = json?.success ? await docxTemplateMeta(json) : null;
  if (meta) return meta;

  const fb = fallbackResult();
  if (fb) return fb;
  if (!json) throw new Error("Gagal memuat template Word.");
  if (json.status === 404) {
    throw new Error("Belum ada template Word untuk modul ini — unggah via Admin → Format Laporan.");
  }
  throw new Error("Template default modul ini bukan Word (.docx) — periksa Admin → Format Laporan.");
}

interface DefaultTemplateResponse {
  status: number;
  success?: boolean;
  data?: { filePath?: string; kind?: string; code?: string; name?: string };
}

/** GET default template modul; null bila permintaan gagal di level jaringan. */
async function fetchDefaultTemplate(
  module: string,
  fetchFn: typeof fetch,
  apiBase: string
): Promise<DefaultTemplateResponse | null> {
  try {
    const res = await fetchFn(`${apiBase}/api/reports/templates/default/${encodeURIComponent(module)}`, {
      credentials: "include",
    });
    const body = res.ok
      ? ((await res.json().catch(() => null)) as Omit<DefaultTemplateResponse, "status"> | null)
      : null;
    return { status: res.status, ...(body || {}) };
  } catch {
    return null;
  }
}

/** Normalisasi row template default → hasil resolve, null bila bukan docx. */
async function docxTemplateMeta(
  json: DefaultTemplateResponse
): Promise<ResolveTemplateResult | null> {
  const fp = json.data?.filePath?.trim() || "";
  const kind = (json.data?.kind || "").trim();
  const isDocx = kind === "docx" || (!kind && fp.toLowerCase().endsWith(".docx"));
  if (!fp || !isDocx) return null;
  // Unggahan baru (uploads/templates/...) = folder privat → endpoint
  // terautentikasi; path lama (templates/...) tetap URL publik.
  const { resolveUploadUrl } = await import("./upload-url");
  const url = resolveUploadUrl(fp) ?? (fp.startsWith("/") ? fp : `/${fp}`);
  return { url, code: json.data?.code || "", name: json.data?.name || "" };
}

/** Render buffer .docx dengan data → Blob siap unduh. */
export async function fillWordTemplate(templateBuf: ArrayBuffer, data: WordTemplateData): Promise<Blob> {
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import("pizzip"),
    import("docxtemplater"),
  ]);
  const zip = new PizZip(templateBuf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  try {
    doc.render(data);
  } catch (e) {
    const props = (e as { properties?: { errors?: { message?: string }[] } })?.properties;
    if (props?.errors?.length) {
      throw new Error(`Template Word bermasalah: ${props.errors.map((x) => x.message || "?").join("; ")}`);
    }
    throw e;
  }
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Daftar variabel {{...}} pada XML dokumen (untuk pesan "tak terisi").
 * Dibaca dari document.xml hasil unzip ringan via PizZip.
 * Catatan: loop memakai kurawal ganda ({{#siswa}}…{{/siswa}}) — prefix
 * # / ^ / / dilewati, hanya nama variabel yang dicatat.
 */
export async function listWordVariables(templateBuf: ArrayBuffer): Promise<string[]> {
  const { default: PizZip } = await import("pizzip");
  const zip = new PizZip(templateBuf);
  const file = zip.file("word/document.xml");
  if (!file) return [];
  const xml = file.asText();
  const found = new Set<string>();
  // docxtemplater memecah tag di beberapa <w:t>; gabungkan dulu teks mentah.
  const text = xml.replace(/<[^>]+>/g, "");
  for (const m of text.matchAll(/\{\{\s*([#/^]?)([A-Za-z0-9_.]+)\s*\}\}/g)) {
    if (!m[1]) found.add(m[2]);
  }
  return [...found].sort();
}

/** Cek data terhadap variabel template → token yang tak punya nilai. */
export function unknownWordVariables(variables: string[], data: WordTemplateData): string[] {
  return variables.filter((v) => {
    const root = v.split(".")[0];
    const val = data[root];
    return val === undefined || val === null || val === "";
  });
}

/**
 * Token yang kuncinya SUDAH ada di data tetapi nilainya kosong.
 * Dibedakan dari `unknownWordVariables` supaya UI bisa membedakan
 * "variabel tidak dikenal template" vs "data siswa belum diisi".
 */
export function emptyWordVariables(variables: string[], data: WordTemplateData): string[] {
  return variables.filter((v) => {
    const root = v.split(".")[0];
    if (!(root in data)) return false;
    const val = data[root];
    return val === undefined || val === null || val === "";
  });
}

export interface RenderWordOptions {
  module: string;
  data: WordTemplateData;
  apiBase?: string;
  /** Template bawaan repo bila default modul belum ada (pola print-kit). */
  fallbackUrl?: string;
}

export interface RenderWordResult {
  blob: Blob;
  /** Variabel template yang tidak punya pasangan kunci di data. */
  unknown: string[];
  /** Variabel yang kuncinya ada tapi nilainya kosong (data belum diisi). */
  kosong: string[];
  /** true bila template bawaan repo yang dipakai (admin belum unggah). */
  fromFallback: boolean;
  templateName: string;
}

/**
 * Resolve → unduh → render template Word menjadi Blob, tanpa menyimpan berkas.
 * Dipakai langsung oleh unduhan .docx maupun konversi PDF (LibreOffice).
 */
export async function renderWordTemplate(opts: RenderWordOptions): Promise<RenderWordResult> {
  const { module, data, apiBase = "", fallbackUrl } = opts;
  const { url, name, fromFallback } = await resolveWordTemplate(module, fetch, apiBase, fallbackUrl);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Berkas template tidak dapat diunduh dari server.");
  const buf = await res.arrayBuffer();
  const [blob, variables] = await Promise.all([fillWordTemplate(buf, data), listWordVariables(buf)]);
  return {
    blob,
    unknown: unknownWordVariables(variables, data),
    kosong: emptyWordVariables(variables, data),
    fromFallback: !!fromFallback,
    templateName: name,
  };
}

export interface DownloadWordOptions extends RenderWordOptions {
  filename: string;
}

/** Orkestrasi penuh: resolve → fetch → render → unduh. */
export async function downloadWordTemplate(opts: DownloadWordOptions): Promise<RenderWordResult> {
  const { filename, ...renderOpts } = opts;
  const result = await renderWordTemplate(renderOpts);
  const { saveAs } = await import("file-saver");
  saveAs(result.blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
  return result;
}

export function wordFilename(base: string): string {
  const slug = base.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "laporan";
  return `${slug}.docx`;
}
