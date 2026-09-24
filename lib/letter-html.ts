/**
 * letter-html.ts — Renderer HTML surat modular untuk cetak (print) di browser.
 *
 * Menghasilkan string HTML mandiri (inline style) yang meniru tata letak PDF,
 * dengan aturan @page mengikuti margin/ukuran standar. Dipakai untuk tombol
 * "Cetak" di editor modular.
 */

import type { LetterBlockInstance } from "@/lib/config/letter-blocks";
import type { LetterDocumentData } from "@/lib/config/letter-document";
import type { LetterStandard } from "@/lib/config/letter-standards";
import {
  asString,
  formatTanggalIndo,
  isEmptyText,
  tempatTanggal,
} from "@/lib/letter-render-shared";
import { parseRichText, type RichNode } from "@/lib/letter-richtext";
import type { LetterSchoolData } from "@/lib/letter-pdf";

export interface LetterHtmlInput {
  standard: LetterStandard;
  document: LetterDocumentData;
  school: LetterSchoolData;
  vars: Record<string, string>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function substitute(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v !== undefined && v !== "" ? v : m;
  });
}

function richToHtml(json: string, vars: Record<string, string>): string {
  const doc = parseRichText(json);
  if (!doc) return "";
  const inline = (nodes: RichNode[] | undefined): string => {
    if (!nodes) return "";
    return nodes
      .map((n) => {
        if (n.type !== "text") return n.type === "hardBreak" ? "<br/>" : "";
        let t = esc(substitute(n.text || "", vars));
        for (const m of n.marks || []) {
          if (m.type === "bold") t = `<strong>${t}</strong>`;
          if (m.type === "italic") t = `<em>${t}</em>`;
          if (m.type === "underline") t = `<u>${t}</u>`;
          if (m.type === "strike") t = `<s>${t}</s>`;
        }
        return t;
      })
      .join("");
  };
  const out: string[] = [];
  for (const node of doc.content) {
    if (node.type === "paragraph") out.push(`<p>${inline(node.content)}</p>`);
    else if (node.type === "bulletList" || node.type === "orderedList") {
      const tag = node.type === "orderedList" ? "ol" : "ul";
      const items = (node.content || []).filter((c) => c.type === "listItem");
      const lis = items
        .map((li) => {
          const para = (li.content || []).find((c) => c.type === "paragraph");
          return `<li>${inline(para?.content)}</li>`;
        })
        .join("");
      out.push(`<${tag}>${lis}</${tag}>`);
    } else if (node.type === "heading") {
      out.push(`<p><strong>${inline(node.content)}</strong></p>`);
    }
  }
  return out.join("");
}

function renderBlock(
  inst: LetterBlockInstance,
  vars: Record<string, string>,
  school: LetterSchoolData
): string {
  const d = inst.data;
  const S = (v: unknown) => esc(substitute(asString(v), vars));

  switch (inst.blockId) {
    case "kop_surat": {
      const variant = asString(d.variant) || "pemerintah";
      const showGov = variant === "pemerintah" || variant === "lengkap";
      const doubleLine = variant === "lengkap" || variant === "garis_ganda";
      const showLogoLeft =
        variant === "pemerintah" || variant === "lengkap" || variant === "garis_ganda";
      const showLogoRight = variant === "logo_kanan";
      const logo = school.logoUrl;
      const logoLeft = showLogoLeft && logo ? `<img class="kop-logo" src="${esc(logo)}" alt="Logo"/>` : "";
      const logoRight = showLogoRight && logo ? `<img class="kop-logo" src="${esc(logo)}" alt="Logo"/>` : "";
      return `<div class="kop">
        <div class="kop-row">
          ${logoLeft}
          <div class="kop-center">
            ${showGov ? `<div class="kop-line">${esc((school.governanceLine || "PEMERINTAH DAERAH").toUpperCase())}</div>
            <div class="kop-line">${esc((school.departmentLine || "DINAS PENDIDIKAN").toUpperCase())}</div>` : ""}
            <div class="kop-nama">${esc(school.schoolName)}</div>
            <div class="kop-alamat">${esc(school.address)}</div>
            <div class="kop-alamat">${esc(
              [school.phone ? `Telp. ${school.phone}` : "", school.email, school.website]
                .filter(Boolean)
                .join(" | ")
            )}</div>
          </div>
          ${logoRight}
        </div>
        <div class="kop-garis${doubleLine ? " double" : ""}"></div>
      </div>`;
    }
    case "judul":
    case "judul_memo":
      return `<h2 class="judul">${S(d.text)}</h2>`;
    case "tanggal":
      return `<p class="right">${S(tempatTanggal(asString(d.tempat), asString(d.tanggal)))}</p>`;
    case "nomor_perihal_lampiran":
      return `<div class="kv">
        <div class="kv-row"><span class="kv-label">Nomor</span><span class="kv-colon">:</span><span>${S(d.nomor) || S(vars.nomor_surat) || "-"}</span></div>
        <div class="kv-row"><span class="kv-label">Perihal</span><span class="kv-colon">:</span><span>${S(d.perihal) || "-"}</span></div>
        ${!isEmptyText(d.lampiran) ? `<div class="kv-row"><span class="kv-label">Lampiran</span><span class="kv-colon">:</span><span>${S(d.lampiran)}</span></div>` : ""}
      </div>`;
    case "tujuan":
      return `<div class="tujuan"><p>Kepada Yth.</p><p><strong>${S(d.kepada)}</strong></p>${
        !isEmptyText(d.di_tempat) ? `<p>${S(d.di_tempat)}</p>` : ""
      }</div>`;
    case "salam_pembuka":
    case "penutup":
    case "isi": {
      if (typeof d.text === "string" && d.text.trimStart().startsWith("{")) {
        return `<div class="justify">${richToHtml(asString(d.text), vars)}</div>`;
      }
      return `<p class="justify">${S(d.text)}</p>`;
    }
    case "pelaksanaan_acara": {
      const rows: [string, string][] = [
        ["Hari", S(d.hari)],
        ["Tanggal", d.tanggal ? esc(formatTanggalIndo(asString(d.tanggal))) : ""],
        ["Waktu", S(d.waktu)],
        ["Tempat", S(d.tempat)],
        ["Agenda", S(d.agenda)],
      ];
      return `<div class="kv">${rows
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="kv-row"><span class="kv-label">${k}</span><span class="kv-colon">:</span><span>${v}</span></div>`)
        .join("")}</div>`;
    }
    case "tabel_penugasan":
    case "tabel_generik":
      return renderTableHtml(inst, vars);
    case "tabel_data_siswa": {
      const rows: [string, string][] = [
        ["Nama", S(d.nama)],
        ["NISN", S(d.nisn)],
        ["Kelas", S(d.kelas)],
        ["Tempat/Tgl Lahir", S(d.tempat_tanggal_lahir)],
        ["Alamat", S(d.alamat)],
      ];
      return `<div class="kv">${rows
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="kv-row"><span class="kv-label">${k}</span><span class="kv-colon">:</span><span>${v}</span></div>`)
        .join("")}</div>`;
    }
    case "tanggal_bawah":
      return `<p class="right" style="margin-top:12px">${S(tempatTanggal(asString(d.tempat), asString(d.tanggal)))}</p>`;
    case "tanda_tangan":
      return `<div class="ttd">
        <div></div>
        <div class="ttd-box">
          <p>${S(d.jabatan)}</p>
          <div class="ttd-space"></div>
          <p><strong><u>${S(d.nama) || esc(school.principalName || "")}</u></strong></p>
          <p>NIP. ${S(d.nip) || esc(school.principalNip || "")}</p>
        </div>
      </div>`;
    case "tanda_tangan_ganda":
      return `<div class="ttd">
        <div class="ttd-box"><p>${S(d.kiri_jabatan)}</p><div class="ttd-space"></div><p><strong><u>${S(d.kiri_nama)}</u></strong></p>${!isEmptyText(d.kiri_nip) ? `<p>NIP. ${S(d.kiri_nip)}</p>` : ""}</div>
        <div class="ttd-box"><p>${S(d.kanan_jabatan)}</p><div class="ttd-space"></div><p><strong><u>${S(d.kanan_nama) || esc(school.principalName || "")}</u></strong></p><p>NIP. ${S(d.kanan_nip) || esc(school.principalNip || "")}</p></div>
      </div>`;
    case "ttd_tiga":
      return `<div class="ttd">
        <div class="ttd-box"><p>${S(d.kiri_jabatan)}</p><div class="ttd-space"></div><p><strong><u>${S(d.kiri_nama)}</u></strong></p></div>
        <div class="ttd-box"><p>${S(d.tengah_jabatan)}</p><div class="ttd-space"></div><p><strong><u>${S(d.tengah_nama)}</u></strong></p></div>
        <div class="ttd-box"><p>${S(d.kanan_jabatan)}</p><div class="ttd-space"></div><p><strong><u>${S(d.kanan_nama)}</u></strong></p></div>
      </div>`;
    case "tembusan": {
      const items = asString(d.daftar)
        .split("\n")
        .map((l) => S(l).trim())
        .filter(Boolean)
        .map((l, i) => `<p style="margin-left:8px">${i + 1}. ${l}</p>`)
        .join("");
      return `<div style="margin-top:16px"><p><u>${S(d.judul) || "Tembusan:"}</u></p>${items}</div>`;
    }
    case "catatan_kaki":
      return `<p class="catatan">${S(d.text)}</p>`;
    case "qr_verifikasi":
      return !isEmptyText(d.url)
        ? `<div style="margin-top:12px"><img src="${S(d.url)}" alt="QR" style="width:70px;height:70px"/><p style="font-size:9pt">${S(d.caption)}</p></div>`
        : "";
    case "gambar":
      return !isEmptyText(d.url)
        ? `<div style="text-align:center;margin:6px 0"><img src="${S(d.url)}" alt="" style="max-width:220px"/><p style="font-size:9pt">${S(d.caption)}</p></div>`
        : "";
    case "daftar_lampiran":
      return `${!isEmptyText(d.judul) ? `<h3>${S(d.judul)}</h3>` : ""}<div class="justify">${richToHtml(asString(d.isi), vars)}</div>`;
    default:
      return "";
  }
}

function renderTableHtml(inst: LetterBlockInstance, vars: Record<string, string>): string {
  const d = inst.data;
  const S = (v: unknown) => esc(substitute(asString(v), vars));
  let columns: { key: string; label: string; width?: number }[] = [];
  let rows: string[][] = [];
  if (typeof d.table === "string" && d.table.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(d.table);
      if (Array.isArray(parsed.columns)) columns = parsed.columns;
      if (Array.isArray(parsed.rows)) rows = parsed.rows;
    } catch {
      /* ignore */
    }
  }
  if (columns.length === 0) return "";
  const head = columns
    .map((c) => `<th${c.width ? ` style="width:${c.width}px"` : ""}>${esc(c.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) => `<tr>${columns.map((_, ci) => `<td>${S(r[ci] || "")}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table class="tabel"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Menghasilkan dokumen HTML lengkap (siap dicetak). */
export function generateLetterHtml(input: LetterHtmlInput): string {
  const { standard, document, school, vars } = input;
  const { margins, typography } = standard;
  const pages = document.pages.length > 0 ? document.pages : [];
  const body = pages
    .map((page, pi) => {
      const useHeader = page.useHeader !== false;
      const content = page.blocks
        .filter((b) => b.enabled && !(b.blockId === "kop_surat" && !useHeader))
        .map((inst) => renderBlock(inst, vars, school))
        .join("");
      return `<section class="page"${pi > 0 ? ' style="page-break-before:always"' : ""}>${content}</section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Surat</title>
<style>
  @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
  * { box-sizing: border-box; }
  body { font-family: "${typography.fontFamily}", Arial, sans-serif; font-size: ${typography.fontSize}pt; line-height: ${typography.lineHeight}; color: #000; margin: 0; }
  .page { padding: 0; }
  p { margin: 0 0 ${typography.paragraphSpacing || 6}pt; }
  .justify p, .justify li { text-align: justify; }
  .right { text-align: right; }
  .kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4pt; margin-bottom: 12pt; }
  .kop-row { display: flex; align-items: center; gap: 8pt; }
  .kop-center { flex: 1; text-align: center; }
  .kop-logo { width: 54pt; height: 54pt; object-fit: contain; flex-shrink: 0; }
  .kop-line { font-weight: bold; letter-spacing: 0.5px; }
  .kop-nama { font-weight: bold; font-size: ${typography.headerFontSize}pt; }
  .kop-alamat { font-size: ${typography.fontSize - 3}pt; }
  .kop-garis { border-bottom: 1px solid #000; margin-top: 2pt; }
  .kop-garis.double { border-bottom: 3px double #000; }
  h2.judul { text-align: center; text-decoration: underline; font-size: ${typography.fontSize + 2}pt; margin: 0 0 10pt; }
  .kv-row { display: flex; margin-bottom: 2pt; }
  .kv-label { width: 90pt; }
  .kv-colon { width: 10pt; }
  .tujuan { margin-bottom: 10pt; }
  .tabel { width: 100%; border-collapse: collapse; margin: 6pt 0; }
  .tabel th, .tabel td { border: 1px solid #000; padding: 2pt 4pt; text-align: left; vertical-align: top; }
  .tabel th { background: #eee; }
  .ttd { display: flex; justify-content: space-between; margin-top: 24pt; }
  .ttd-box { width: 45%; text-align: center; }
  .ttd-space { height: 60pt; }
  .catatan { border-top: 1px solid #000; padding-top: 4pt; font-style: italic; font-size: ${typography.fontSize - 3}pt; margin-top: 12pt; }
  @media print { .page { page-break-after: always; } .page:last-child { page-break-after: auto; } }
</style>
</head>
<body>${body}</body>
</html>`;
}
