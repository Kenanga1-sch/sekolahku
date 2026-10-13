/**
 * letter-docx-helpers.ts — Helper renderer DOCX surat modular.
 *
 * Diekstrak dari letter-docx.ts (refactor, zero behavior change).
 */
import {
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
  type IParagraphOptions,
} from "docx";
import type { LetterBlockInstance } from "@/lib/config/letter-blocks";
import type { LetterDocumentData } from "@/lib/config/letter-document";
import { asString } from "@/lib/letter-render-shared";
import { parseRichText, type RichNode } from "@/lib/letter-richtext";
import { loadImageBuffer, type LoadedImage } from "@/lib/letter-image";
import type { LetterSchoolData } from "@/lib/letter-pdf";

/** Konversi mm → twip (1 mm = 56.6929 twip). docx memakai twip untuk margin. */
export function mmToTwip(mm: number): number {
  return Math.round(mm * 56.6929);
}

/**
 * Resolver gambar: mengubah URL → ImageRun siap pakai. Diisi sebelum render
 * (semua gambar di-preload) sehingga render blok tetap sinkron.
 */
export type ImageResolver = (url: string, widthPx: number, heightPx?: number) => ImageRun | null;

/** Membuat resolver gambar dari peta URL → buffer yang sudah dimuat. */
export function makeImageResolver(map: Map<string, LoadedImage>): ImageResolver {
  return (url, widthPx, heightPx) => {
    const img = map.get(url.trim());
    if (!img) return null;
    const type = img.contentType.includes("jpeg") || img.contentType.includes("jpg") ? "jpg" : "png";
    return new ImageRun({
      data: img.buffer,
      transformation: {
        width: widthPx,
        height: heightPx ?? widthPx,
      },
      type: type === "jpg" ? "jpg" : "png",
    });
  };
}

type RunPatch = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean };

/** Mengubah rich text (TipTap JSON) → array Paragraph docx. */
export function richToParagraphs(
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

export function substitute(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v !== undefined && v !== "" ? v : m;
  });
}

export function labelRow(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${label}\t: ${value}`, bold: false })],
    tabStops: [{ type: "left", position: 1400 }],
  });
}

export function renderTableDocx(inst: LetterBlockInstance, vars: Record<string, string>): Table[] {
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

  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const borders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
    insideHorizontal: cellBorder,
    insideVertical: cellBorder,
  };

  const headerRow = new TableRow({
    children: columns.map(
      (c) =>
        new TableCell({
          borders,
          shading: { fill: "EEEEEE" },
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
              borders,
              children: [new Paragraph({ children: [new TextRun({ text: S(r[ci] || "") })] })],
            })
        ),
      })
  );

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [headerRow, ...bodyRows],
    }),
  ];
}

/**
 * Mengumpulkan URL gambar yang dibutuhkan dokumen (logo, stempel, blok
 * gambar/QR) lalu memuat semuanya sebelum render, agar render blok sinkron.
 */
export async function collectImages(
  document: LetterDocumentData,
  school: LetterSchoolData
): Promise<Map<string, LoadedImage>> {
  const urls = new Set<string>();
  if (school.logoUrl) urls.add(school.logoUrl);
  if (school.stampUrl) urls.add(school.stampUrl);
  for (const page of document.pages) {
    for (const b of page.blocks) {
      if (b.blockId === "gambar" || b.blockId === "qr_verifikasi") {
        const url = asString(b.data.url);
        if (url) urls.add(url);
      }
    }
  }
  const map = new Map<string, LoadedImage>();
  await Promise.all(
    [...urls].map(async (url) => {
      const img = await loadImageBuffer(url);
      if (img) map.set(url, img);
    })
  );
  return map;
}
