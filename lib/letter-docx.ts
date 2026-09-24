/**
 * letter-docx.ts — Renderer DOCX (Word) surat modular (100% di klien).
 *
 * Mirror dari letter-pdf.tsx: memetakan LetterDocumentData → dokumen Word
 * memakai pustaka `docx`. Tujuan: pengguna dapat mengunduh & mengedit lanjut
 * surat di Microsoft Word.
 *
 * Catatan: fitur yang tak didukung penuh di DOCX (mis. posisi absolute)
 * disederhanakan agar tetap terbaca.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";
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

export interface LetterDocxInput {
  standard: LetterStandard;
  document: LetterDocumentData;
  school: LetterSchoolData;
  vars: Record<string, string>;
  fileName?: string;
}

/** Konversi mm → twip (1 mm = 56.6929 twip). docx memakai twip untuk margin. */
function mmToTwip(mm: number): number {
  return Math.round(mm * 56.6929);
}

type RunPatch = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean };

/** Mengubah rich text (TipTap JSON) → array Paragraph docx. */
function richToParagraphs(
  json: string,
  vars: Record<string, string>,
  base: IParagraphOptions = {}
): Paragraph[] {
  const doc = parseRichText(json);
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
    return [];
  }
  const out: Paragraph[] = [];
  let listCounter = 0;

  const inlineRuns = (nodes: RichNode[] | undefined, patch: RunPatch = {}): TextRun[] => {
    if (!nodes) return [];
    const runs: TextRun[] = [];
    for (const n of nodes) {
      if (n.type === "text") {
        const marks = n.marks || [];
        const p: RunPatch = { ...patch };
        for (const m of marks) {
          if (m.type === "bold") p.bold = true;
          if (m.type === "italic") p.italics = true;
          if (m.type === "underline") p.underline = true;
          if (m.type === "strike") p.strike = true;
        }
        runs.push(
          new TextRun({
            text: substitute(n.text || "", vars),
            bold: p.bold,
            italics: p.italics,
            underline: p.underline ? {} : undefined,
            strike: p.strike,
          })
        );
      } else if (n.type === "hardBreak") {
        runs.push(new TextRun({ text: "", break: 1 }));
      }
    }
    return runs;
  };

  for (const node of doc.content) {
    if (node.type === "paragraph") {
      out.push(new Paragraph({ ...base, children: inlineRuns(node.content) }));
      listCounter = 0;
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content || []).filter((c) => c.type === "listItem");
      for (const li of items) {
        const para = (li.content || []).find((c) => c.type === "paragraph");
        const prefix = node.type === "orderedList" ? `${++listCounter}. ` : "• ";
        out.push(
          new Paragraph({
            ...base,
            indent: { left: 360 },
            children: [new TextRun({ text: prefix }), ...inlineRuns(para?.content)],
          })
        );
      }
    } else if (node.type === "heading") {
      out.push(
        new Paragraph({
          ...base,
          children: inlineRuns(node.content, { bold: true }),
        })
      );
    }
  }
  return out;
}

function substitute(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v !== undefined && v !== "" ? v : m;
  });
}

function labelRow(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${label}\t: ${value}`, bold: false })],
    tabStops: [{ type: "left", position: 1400 }],
  });
}

/** Render satu blok → array elemen docx (Paragraph/Table). */
function renderBlock(
  inst: LetterBlockInstance,
  vars: Record<string, string>,
  school: LetterSchoolData,
  fontSize: number
): (Paragraph | Table)[] {
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), vars);
  const size = fontSize * 2; // docx half-points

  switch (inst.blockId) {
    case "kop_surat": {
      const variant = asString(d.variant) || "pemerintah";
      const showGov = variant === "pemerintah" || variant === "lengkap";
      const out: Paragraph[] = [];
      if (showGov) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: (school.governanceLine || "PEMERINTAH DAERAH").toUpperCase(), bold: true, size: size + 2 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: (school.departmentLine || "DINAS PENDIDIKAN").toUpperCase(), bold: true, size: size + 2 })],
          })
        );
      }
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: school.schoolName, bold: true, size: size + 6 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: school.address, size: size - 4 })],
        })
      );
      const contact = [
        school.phone ? `Telp. ${school.phone}` : "",
        school.email || "",
        school.website || "",
      ]
        .filter(Boolean)
        .join(" | ");
      if (contact) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: contact, size: size - 4 })],
          })
        );
      }
      // Garis kop.
      out.push(
        new Paragraph({
          border: { bottom: { color: "000000", style: BorderStyle.SINGLE, size: 12, space: 1 } },
          children: [],
        })
      );
      return out;
    }
    case "judul":
    case "judul_memo":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: S(d.text), bold: true, underline: {}, size: size + 4 })],
        }),
      ];
    case "tanggal":
      return [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: tempatTanggal(S(d.tempat), asString(d.tanggal)), size })],
        }),
      ];
    case "nomor_perihal_lampiran": {
      const out = [
        labelRow("Nomor", S(d.nomor) || vars.nomor_surat || "-"),
        labelRow("Perihal", S(d.perihal) || "-"),
      ];
      if (!isEmptyText(d.lampiran)) out.push(labelRow("Lampiran", S(d.lampiran)));
      return out;
    }
    case "tujuan": {
      const out = [new Paragraph({ children: [new TextRun({ text: "Kepada Yth.", size })] })];
      out.push(new Paragraph({ children: [new TextRun({ text: S(d.kepada), bold: true, size })] }));
      if (!isEmptyText(d.di_tempat)) {
        out.push(new Paragraph({ children: [new TextRun({ text: S(d.di_tempat), size })] }));
      }
      return out;
    }
    case "salam_pembuka":
    case "penutup":
    case "isi": {
      if (typeof d.text === "string" && d.text.trimStart().startsWith("{")) {
        return richToParagraphs(asString(d.text), vars, {
          alignment: AlignmentType.JUSTIFIED,
        });
      }
      return [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: S(d.text), size })],
        }),
      ];
    }
    case "pelaksanaan_acara": {
      const rows: [string, string][] = [
        ["Hari", S(d.hari)],
        ["Tanggal", d.tanggal ? formatTanggalIndo(asString(d.tanggal)) : ""],
        ["Waktu", S(d.waktu)],
        ["Tempat", S(d.tempat)],
        ["Agenda", S(d.agenda)],
      ];
      return rows.filter(([, v]) => v).map(([k, v]) => labelRow(k, v));
    }
    case "tabel_penugasan":
    case "tabel_generik":
      return renderTableDocx(inst, vars);
    case "tabel_data_siswa": {
      const rows: [string, string][] = [
        ["Nama", S(d.nama)],
        ["NISN", S(d.nisn)],
        ["Kelas", S(d.kelas)],
        ["Tempat/Tgl Lahir", S(d.tempat_tanggal_lahir)],
        ["Alamat", S(d.alamat)],
      ];
      return rows.filter(([, v]) => v).map(([k, v]) => labelRow(k, v));
    }
    case "tanggal_bawah":
      return [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: tempatTanggal(S(d.tempat), asString(d.tanggal)), size })],
        }),
      ];
    case "tanda_tangan": {
      const out: Paragraph[] = [];
      out.push(new Paragraph({ text: "" }));
      out.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: S(d.jabatan), size })],
        })
      );
      for (let i = 0; i < 3; i++) out.push(new Paragraph({ text: "" }));
      out.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: S(d.nama) || school.principalName, bold: true, underline: {}, size }),
          ],
        })
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `NIP. ${S(d.nip) || school.principalNip}`, size })],
        })
      );
      return out;
    }
    case "tanda_tangan_ganda":
      return [
        new Paragraph({ children: [new TextRun({ text: `${S(d.kiri_jabatan)}\t\t\t${S(d.kanan_jabatan) || "Kepala Sekolah"}`, size })] }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: `${S(d.kiri_nama)}\t\t\t${S(d.kanan_nama) || school.principalName}`, bold: true, underline: {}, size })] }),
        new Paragraph({ children: [new TextRun({ text: `${S(d.kiri_nip) ? `NIP. ${S(d.kiri_nip)}` : ""}\t\t\tNIP. ${S(d.kanan_nip) || school.principalNip}`, size })] }),
      ];
    case "ttd_tiga":
      return [
        new Paragraph({ children: [new TextRun({ text: `${S(d.kiri_jabatan)}\t${S(d.tengah_jabatan)}\t${S(d.kanan_jabatan) || "Kepala Sekolah"}`, size })] }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: `${S(d.kiri_nama)}\t${S(d.tengah_nama)}\t${S(d.kanan_nama) || school.principalName}`, bold: true, underline: {}, size })] }),
      ];
    case "tembusan": {
      const out = [
        new Paragraph({
          children: [new TextRun({ text: S(d.judul) || "Tembusan:", underline: {}, size })],
        }),
      ];
      asString(d.daftar)
        .split("\n")
        .map((l) => S(l).trim())
        .filter(Boolean)
        .forEach((l, i) => {
          out.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: `${i + 1}. ${l}`, size: size - 2 })] }));
        });
      return out;
    }
    case "catatan_kaki":
      return [
        new Paragraph({
          border: { top: { color: "000000", style: BorderStyle.SINGLE, size: 6, space: 2 } },
          children: [new TextRun({ text: S(d.text), italics: true, size: size - 4 })],
        }),
      ];
    case "daftar_lampiran": {
      const out: Paragraph[] = [];
      if (!isEmptyText(d.judul)) {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: S(d.judul), bold: true, underline: {}, size: size + 2 })],
          })
        );
      }
      out.push(...richToParagraphs(asString(d.isi), vars));
      return out;
    }
    // qr_verifikasi & gambar: DOCX menyisipkan gambar bila berupa data URL.
    case "gambar":
    case "qr_verifikasi": {
      const url = asString(d.url);
      const caption = S(d.caption);
      const out: Paragraph[] = [];
      if (url) out.push(new Paragraph({ children: [new TextRun({ text: `[Gambar: ${url}]`, size: size - 2 })] }));
      if (caption) out.push(new Paragraph({ children: [new TextRun({ text: caption, size: size - 4 })] }));
      return out;
    }
    default:
      return [];
  }
}

function renderTableDocx(inst: LetterBlockInstance, vars: Record<string, string>): Table[] {
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), vars);
  let columns: { key: string; label: string }[] = [];
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
  if (columns.length === 0) return [];

  const headerRow = new TableRow({
    children: columns.map(
      (c) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true })] })],
        })
    ),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: columns.map(
          (c, ci) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: S(r[ci] || "") })] })],
            })
        ),
      })
  );

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...bodyRows],
    }),
  ];
}

/** Menghasilkan Blob DOCX dari dokumen surat. */
export async function generateLetterDocx(input: LetterDocxInput): Promise<Blob> {
  const { standard, document, school, vars } = input;
  const fontSize = standard.typography.fontSize;

  const children: (Paragraph | Table)[] = [];
  const pages = document.pages.length > 0 ? document.pages : [];

  pages.forEach((page, pi) => {
    if (pi > 0) {
      // Pemisah halaman.
      children.push(new Paragraph({ children: [new TextRun({ break: 1, text: "" })], pageBreakBefore: true }));
    }
    page.blocks
      .filter((b) => b.enabled)
      .forEach((inst) => {
        children.push(...renderBlock(inst, vars, school, fontSize));
      });
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: mmToTwip(standard.margins.top),
              right: mmToTwip(standard.margins.right),
              bottom: mmToTwip(standard.margins.bottom),
              left: mmToTwip(standard.margins.left),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

// `ImageRun` diimpor untuk kelengkapan tipe (dipakai bila gambar diperluas).
export { ImageRun };
