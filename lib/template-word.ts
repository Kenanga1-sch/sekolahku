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
}

/**
 * Ambil template default sebuah modul. Hanya yang berkind docx (atau tanpa
 * kind tapi berekstensi .docx) yang diterima; selain itu error agar pemanggil
 * bisa menampilkan pesan "belum ada template Word" alih-alih unduhan rusak.
 */
export async function resolveWordTemplate(
  module: string,
  fetchFn: typeof fetch = fetch,
  apiBase = ""
): Promise<ResolveTemplateResult> {
  const res = await fetchFn(`${apiBase}/api/reports/templates/default/${encodeURIComponent(module)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Belum ada template Word untuk modul ini — unggah via Admin → Format Laporan."
        : "Gagal memuat template Word."
    );
  }
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { filePath?: string; kind?: string; code?: string; name?: string };
  } | null;
  const fp = json?.data?.filePath?.trim() || "";
  const kind = (json?.data?.kind || "").trim();
  const isDocx = kind === "docx" || (!kind && fp.toLowerCase().endsWith(".docx"));
  if (!json?.success || !fp || !isDocx) {
    throw new Error("Template default modul ini bukan Word (.docx) — periksa Admin → Format Laporan.");
  }
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

export interface DownloadWordOptions {
  module: string;
  data: WordTemplateData;
  filename: string;
  apiBase?: string;
}

/** Orkestrasi penuh: resolve → fetch → render → unduh. */
export async function downloadWordTemplate(opts: DownloadWordOptions): Promise<{ unknown: string[] }> {
  const { module, data, filename, apiBase = "" } = opts;
  const { url } = await resolveWordTemplate(module, fetch, apiBase);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Berkas template tidak dapat diunduh dari server.");
  const buf = await res.arrayBuffer();
  const [blob, variables] = await Promise.all([fillWordTemplate(buf, data), listWordVariables(buf)]);
  const unknown = unknownWordVariables(variables, data);

  const { saveAs } = await import("file-saver");
  saveAs(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
  return { unknown };
}

export function wordFilename(base: string): string {
  const slug = base.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "laporan";
  return `${slug}.docx`;
}
