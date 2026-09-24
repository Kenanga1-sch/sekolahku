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
import { LETTER_PAPER_OPTIONS } from "@/lib/config/letter-document";
import type { LetterStandard } from "@/lib/config/letter-standards";
import {
  asString,
  formatTanggalIndo,
  isEmptyText,
  tempatTanggal,
} from "@/lib/letter-render-shared";
import { parseRichText, type RichNode } from "@/lib/letter-richtext";
import { loadImageBuffer, type LoadedImage } from "@/lib/letter-image";
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

/**
 * Resolver gambar: mengubah URL → ImageRun siap pakai. Diisi sebelum render
 * (semua gambar di-preload) sehingga render blok tetap sinkron.
 */
type ImageResolver = (url: string, widthPx: number, heightPx?: number) => ImageRun | null;

/** Membuat resolver gambar dari peta URL → buffer yang sudah dimuat. */
function makeImageResolver(map: Map<string, LoadedImage>): ImageResolver {
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
  fontSize: number,
  resolver: ImageResolver,
  useHeader: boolean
): (Paragraph | Table)[] {
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), vars);
  const size = fontSize * 2; // docx half-points

  switch (inst.blockId) {
    case "kop_surat": {
      if (!useHeader) return [];
      const variant = asString(d.variant) || "pemerintah";
      const showGov = variant === "pemerintah" || variant === "lengkap";
      const doubleLine = variant === "lengkap" || variant === "garis_ganda";
      const showLogoLeft =
        variant === "pemerintah" || variant === "lengkap" || variant === "garis_ganda";
      const showLogoRight = variant === "logo_kanan";
      const logoUrl = school.logoUrl || "";
      const logoLeft = showLogoLeft ? resolver(logoUrl, 60, 60) : null;
      const logoRight = showLogoRight ? resolver(logoUrl, 60, 60) : null;

      // Baris tengah kop (governance/department + nama + alamat + kontak).
      const centerChildren: Paragraph[] = [];
      if (showGov) {
        centerChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: (school.governanceLine || "PEMERINTAH DAERAH").toUpperCase(),
                bold: true,
                size: size + 2,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: (school.departmentLine || "DINAS PENDIDIKAN").toUpperCase(),
                bold: true,
                size: size + 2,
              }),
            ],
          })
        );
      }
      centerChildren.push(
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
        centerChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: contact, size: size - 4 })],
          })
        );
      }

      const out: (Paragraph | Table)[] = [];
      if (logoLeft || logoRight) {
        // Kop dengan logo: tata 3 kolom (logo | tengah | logo) memakai tabel
        // borderless agar logo serata vertikal dengan blok teks tengah.
        const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: noBorder,
              insideVertical: noBorder,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: logoLeft ? [logoLeft] : [],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: centerChildren,
                  }),
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: logoRight ? [logoRight] : [],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      } else {
        out.push(...centerChildren);
      }

      // Garis kop: tunggal (border bawah) atau ganda (dua paragraf bergaris).
      out.push(
        new Paragraph({
          border: { bottom: { color: "000000", style: BorderStyle.SINGLE, size: 12, space: 1 } },
          children: [],
        })
      );
      if (doubleLine) {
        out.push(
          new Paragraph({
            border: { bottom: { color: "000000", style: BorderStyle.SINGLE, size: 6, space: 1 } },
            children: [],
          })
        );
      }
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
      const out: (Paragraph | Table)[] = [];
      const stamp =
        asString(d.show_stamp) === "true" && school.stampUrl
          ? resolver(school.stampUrl, 90, 90)
          : null;
      const ttdChildren: (Paragraph | ImageRun)[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: S(d.jabatan), size })],
        }),
      ];
      if (stamp) {
        ttdChildren.push(
          new Paragraph({ alignment: AlignmentType.CENTER, children: [stamp] })
        );
      } else {
        ttdChildren.push(new Paragraph({ text: "" }));
        ttdChildren.push(new Paragraph({ text: "" }));
        ttdChildren.push(new Paragraph({ text: "" }));
      }
      ttdChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: S(d.nama) || school.principalName, bold: true, underline: {}, size }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `NIP. ${S(d.nip) || school.principalNip}`, size })],
        })
      );
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
            insideHorizontal: noBorder,
            insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph("")] }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: ttdChildren as Paragraph[],
                }),
              ],
            }),
          ],
        })
      );
      return out;
    }
    case "tanda_tangan_ganda": {
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const stamp =
        asString(d.show_stamp) === "true" && school.stampUrl
          ? resolver(school.stampUrl, 90, 90)
          : null;
      const leftChildren: (Paragraph | ImageRun)[] = [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: S(d.kiri_jabatan), size })] }),
        new Paragraph(""),
        new Paragraph(""),
        new Paragraph(""),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: S(d.kiri_nama), bold: true, underline: {}, size })],
        }),
      ];
      if (!isEmptyText(d.kiri_nip)) {
        leftChildren.push(
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${S(d.kiri_nip)}`, size })] })
        );
      }
      const rightChildren: (Paragraph | ImageRun)[] = [];
      if (asString(d.layout) === "bertingkat") {
        rightChildren.push(
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui,", size })] })
        );
      }
      rightChildren.push(
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: S(d.kanan_jabatan) || "Kepala Sekolah", size })] })
      );
      if (stamp) {
        rightChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [stamp] }));
      } else {
        rightChildren.push(new Paragraph(""), new Paragraph(""), new Paragraph(""));
      }
      rightChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: S(d.kanan_nama) || school.principalName, bold: true, underline: {}, size })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `NIP. ${S(d.kanan_nip) || school.principalNip}`, size })],
        })
      );

      if (asString(d.layout) === "bertingkat") {
        return [
          // Row 1: Pihak 1 di kanan
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph("")] }),
                  new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: leftChildren as Paragraph[] }),
                ],
              }),
            ],
          }),
          new Paragraph(""),
          // Row 2: Mengetahui di tengah
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph("")] }),
                  new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: rightChildren as Paragraph[] }),
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph("")] }),
                ],
              }),
            ],
          }),
        ];
      }

      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
            insideHorizontal: noBorder,
            insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: leftChildren as Paragraph[] }),
                new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: rightChildren as Paragraph[] }),
              ],
            }),
          ],
        }),
      ];
    }
    case "ttd_tiga": {
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const cols: [string, string, string][] = [
        [S(d.kiri_jabatan), S(d.kiri_nama), S(d.kiri_nip)],
        [S(d.tengah_jabatan), S(d.tengah_nama), S(d.tengah_nip)],
        [S(d.kanan_jabatan) || "Kepala Sekolah", S(d.kanan_nama) || school.principalName || "", S(d.kanan_nip) || school.principalNip || ""],
      ];
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
            insideHorizontal: noBorder,
            insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              children: cols.map(
                ([jab, nama, nip]) =>
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: jab, size })] }),
                      new Paragraph(""),
                      new Paragraph(""),
                      new Paragraph(""),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: nama, bold: true, underline: {}, size })],
                      }),
                      ...(nip
                        ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NIP. ${nip}`, size })] })]
                        : []),
                    ],
                  })
              ),
            }),
          ],
        }),
      ];
    }
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
    case "garis_pemisah": {
      const t = (Number(asString(d.tebal)) || 1) * 4;
      return [
        new Paragraph({
          border: { bottom: { color: "000000", style: BorderStyle.SINGLE, size: t, space: 1 } },
          children: [],
        }),
      ];
    }
    case "dua_kolom": {
      const ratio = asString(d.ratio) || "50:50";
      const leftW = ratio === "40:60" ? 40 : ratio === "60:40" ? 60 : 50;
      const left = richToParagraphs(asString(d.kiri), vars);
      const right = richToParagraphs(asString(d.kanan), vars);
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
            insideHorizontal: noBorder,
            insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: leftW, type: WidthType.PERCENTAGE },
                  children: left.length ? left : [new Paragraph("")],
                }),
                new TableCell({
                  width: { size: 100 - leftW, type: WidthType.PERCENTAGE },
                  children: right.length ? right : [new Paragraph("")],
                }),
              ],
            }),
          ],
        }),
      ];
    }
    case "daftar_centang": {
      const out: Paragraph[] = [];
      if (!isEmptyText(d.judul)) {
        out.push(new Paragraph({ children: [new TextRun({ text: S(d.judul), bold: true, size })] }));
      }
      asString(d.daftar)
        .split("\n")
        .map((l) => S(l).trim())
        .filter(Boolean)
        .forEach((l) => {
          out.push(
            new Paragraph({
              indent: { left: 360 },
              children: [new TextRun({ text: `☐  ${l}`, size })],
            })
          );
        });
      return out;
    }
    case "tanda_tangan_basah": {
      const url = asString(d.url);
      if (!url) return [];
      const width = Number(asString(d.lebar)) || 150;
      const img = resolver(url, width, Math.round(width * 0.45));
      const align =
        asString(d.posisi) === "kiri"
          ? AlignmentType.LEFT
          : asString(d.posisi) === "tengah"
            ? AlignmentType.CENTER
            : AlignmentType.RIGHT;
      if (!img) {
        return [new Paragraph({ alignment: align, children: [new TextRun({ text: `[TTD: ${url}]`, size: size - 2 })] })];
      }
      return [new Paragraph({ alignment: align, children: [img] })];
    }
    case "barcode": {
      const text = S(d.text);
      if (!text) return [];
      const out: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, font: "Courier New", size: size + 6 })],
        }),
      ];
      if (!isEmptyText(d.caption)) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: S(d.caption), size: size - 3 })],
          })
        );
      }
      return out;
    }
    // qr_verifikasi & gambar: DOCX menyisipkan gambar via ImageRun.
    case "gambar":
    case "qr_verifikasi": {
      const url = asString(d.url);
      const caption = S(d.caption);
      const isQr = inst.blockId === "qr_verifikasi";
      const out: Paragraph[] = [];
      if (url) {
        const img = resolver(url, isQr ? 70 : 220, isQr ? 70 : undefined);
        if (img) {
          out.push(
            new Paragraph({
              alignment: isQr ? AlignmentType.LEFT : AlignmentType.CENTER,
              children: [img],
            })
          );
        } else {
          // Fallback: gambar tak dapat dimuat (CSP / offline).
          out.push(
            new Paragraph({ children: [new TextRun({ text: `[Gambar: ${url}]`, size: size - 2 })] })
          );
        }
      }
      if (caption) {
        out.push(new Paragraph({ children: [new TextRun({ text: caption, size: size - 4 })] }));
      }
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
async function collectImages(
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

/** Menghasilkan Blob DOCX dari dokumen surat. */
export async function generateLetterDocx(input: LetterDocxInput): Promise<Blob> {
  const { standard, document, school, vars } = input;
  const fontSize = standard.typography.fontSize;

  // Preload gambar (logo/stempel/blok gambar) agar render sinkron.
  const imageMap = await collectImages(document, school);
  const resolver = makeImageResolver(imageMap);

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
        children.push(...renderBlock(inst, vars, school, fontSize, resolver, page.useHeader !== false));
      });
  });

  // Dimensi kertas dari pilihan dokumen (mm → twip), disesuaikan orientasi.
  const paperOpt =
    LETTER_PAPER_OPTIONS.find((o) => o.value === (document.paperSize ?? "A4")) ??
    LETTER_PAPER_OPTIONS[0];
  const [pw, ph] = paperOpt.mm;
  const landscape = document.orientation === "landscape";
  const pageWidth = mmToTwip(landscape ? ph : pw);
  const pageHeight = mmToTwip(landscape ? pw : ph);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: pageWidth, height: pageHeight },
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

export { ImageRun };
