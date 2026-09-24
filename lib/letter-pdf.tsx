/**
 * letter-pdf.tsx — Renderer PDF surat modular (100% di klien).
 *
 * Menggunakan @react-pdf/renderer untuk menyusun PDF dari LetterDocumentData
 * (multi-halaman) mengikuti standar baku (font/margin) per jenis surat.
 * Tidak ada render di server → nol beban tambahan untuk server.
 *
 * Catatan integrasi Next.js:
 *  - File ini HARUS diimpor secara dinamis (next/dynamic, { ssr: false }) karena
 *    @react-pdf/renderer menyentuh API browser.
 *  - Font: menggunakan font standar PDF bawaan (Helvetica/Times/Courier) agar
 *    tidak perlu memuat berkas font eksternal. "Arial" ≈ Helvetica,
 *    "Bookman Old Style" ≈ Times, "Times New Roman" = Times.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { LetterBlockInstance } from "@/lib/config/letter-blocks";
import type { LetterDocumentData, LetterPage } from "@/lib/config/letter-document";
import type { LetterStandard } from "@/lib/config/letter-standards";
import {
  asString,
  formatTanggalIndo,
  isEmptyText,
  mapFont,
  substitute,
  tempatTanggal,
} from "@/lib/letter-render-shared";
import { parseRichText, type RichNode } from "@/lib/letter-richtext";

/** Data sekolah untuk kop & tanda tangan. */
export interface LetterSchoolData {
  schoolName: string;
  npsn: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  /** Baris instansi atasan (mis. "PEMERINTAH KABUPATEN INDRAMAYU"). */
  governanceLine?: string;
  departmentLine?: string;
  principalName?: string;
  principalNip?: string;
  stampUrl?: string;
}

export interface LetterPdfInput {
  standard: LetterStandard;
  document: LetterDocumentData;
  school: LetterSchoolData;
  /** Variabel {{...}} terisi. */
  vars: Record<string, string>;
  /** Nama berkas saat diunduh. */
  fileName?: string;
}

// ─────────────────────────────────────────────
// Style
// ─────────────────────────────────────────────

function buildStyles(standard: LetterStandard) {
  const font = mapFont(standard.typography.fontFamily);
  const { margins, typography } = standard;
  return StyleSheet.create({
    page: {
      fontFamily: font,
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
      paddingTop: margins.top,
      paddingRight: margins.right,
      paddingBottom: margins.bottom,
      paddingLeft: margins.left,
      color: "#000000",
    },
    kop: {
      borderBottomWidth: 2,
      borderBottomColor: "#000000",
      paddingBottom: 6,
      marginBottom: 12,
      textAlign: "center",
    },
    kopRow: { flexDirection: "row", alignItems: "center" },
    kopLogo: { width: 60, height: 60, marginRight: 10 },
    kopLogoRight: { width: 60, height: 60, marginLeft: 10 },
    kopInstansi: {
      fontSize: typography.headerFontSize - 3,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    kopDinas: {
      fontSize: typography.headerFontSize - 3,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    kopSekolah: {
      fontSize: typography.headerFontSize,
      fontWeight: "bold",
    },
    kopAlamat: { fontSize: typography.fontSize - 3, marginTop: 2 },
    kopGarisGanda: {
      borderBottomWidth: 1,
      borderBottomColor: "#000000",
      marginTop: 1,
    },
    judul: {
      textAlign: "center",
      fontWeight: "bold",
      fontSize: typography.fontSize + 2,
      textDecoration: "underline",
      marginBottom: 8,
    },
    row: { flexDirection: "row", marginBottom: 2 },
    labelCell: { width: 90 },
    colonCell: { width: 10 },
    valueCell: { flex: 1 },
    paragraf: { textAlign: "justify", marginBottom: typography.paragraphSpacing || 6 },
    tanggalKanan: { textAlign: "right", marginBottom: 8 },
    table: { borderWidth: 1, borderColor: "#000000", marginVertical: 6 },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000000" },
    th: {
      padding: 4,
      fontWeight: "bold",
      backgroundColor: "#eeeeee",
      borderRightWidth: 1,
      borderRightColor: "#000000",
    },
    td: { padding: 4, borderRightWidth: 1, borderRightColor: "#000000" },
    ttdWrap: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
    ttdBox: { width: "45%", textAlign: "center" },
    ttdSpace: { height: 60 },
    stamp: { width: 80, height: 80, alignSelf: "center", marginVertical: 4 },
    listRow: { flexDirection: "row", marginBottom: 2 },
    listBullet: { width: 14 },
    listText: { flex: 1, textAlign: "justify" },
    footer: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: typography.fontSize - 4,
      color: "#444444",
    },
  });
}

// ─────────────────────────────────────────────
// Renderer rich text (TipTap JSON → React-PDF)
// ─────────────────────────────────────────────

function richInline(node: RichNode, key: number): React.ReactNode {
  const style: Style = {};
  const marks = node.marks || [];
  for (const m of marks) {
    if (m.type === "bold") style.fontWeight = "bold";
    if (m.type === "italic") style.fontStyle = "italic";
    if (m.type === "underline") style.textDecoration = "underline";
    if (m.type === "strike") style.textDecoration = "line-through";
  }
  return (
    <Text key={key} style={style}>
      {node.text || ""}
    </Text>
  );
}

/**
 * Render rich text (JSON TipTap) menjadi beberapa elemen React-PDF.
 * Mendukung paragraf, bullet/list berurutan, dan inline marks dasar.
 */
function renderRich(
  json: string,
  ctx: BlockRenderCtx,
  keyBase: string
): React.ReactElement | null {
  const doc = parseRichText(json);
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) return null;
  const { styles } = ctx;
  const out: React.ReactNode[] = [];
  let listCounter = 0;

  doc.content.forEach((node, i) => {
    const type = node.type;
    if (type === "paragraph") {
      const text = renderInlineChildren(node.content, ctx, `${keyBase}-p${i}`);
      out.push(
        <Text style={styles.paragraf} key={`${keyBase}-p${i}`}>
          {text}
        </Text>
      );
      listCounter = 0;
    } else if (type === "bulletList" || type === "orderedList") {
      const items = (node.content || []).filter((c) => c.type === "listItem");
      items.forEach((li, liIdx) => {
        const para = (li.content || []).find((c) => c.type === "paragraph");
        const text = renderInlineChildren(para?.content, ctx, `${keyBase}-li${i}-${liIdx}`);
        const marker = type === "orderedList" ? `${++listCounter}.` : "•";
        out.push(
          <View style={styles.listRow} key={`${keyBase}-li${i}-${liIdx}`}>
            <Text style={styles.listBullet}>{marker}</Text>
            <Text style={styles.listText}>{text}</Text>
          </View>
        );
      });
    } else if (type === "heading") {
      out.push(
        <Text
          style={[styles.paragraf, { fontWeight: "bold" }]}
          key={`${keyBase}-h${i}`}
        >
          {renderInlineChildren(node.content, ctx, `${keyBase}-h${i}`)}
        </Text>
      );
    }
  });

  if (out.length === 0) return null;
  return <View key={keyBase}>{out}</View>;
}

function renderInlineChildren(
  content: RichNode[] | undefined,
  ctx: BlockRenderCtx,
  keyBase: string
): React.ReactNode[] {
  if (!content || content.length === 0) return [];
  return content.map((n, i) => {
    if (n.type === "text") {
      const sub = substitute(n.text || "", ctx.vars);
      return richInline({ ...n, text: sub }, i);
    }
    if (n.type === "hardBreak") return <Text key={`${keyBase}-br${i}`}>{"\n"}</Text>;
    return null;
  });
}

// ─────────────────────────────────────────────
// Renderer satu blok
// ─────────────────────────────────────────────

interface BlockRenderCtx {
  styles: ReturnType<typeof buildStyles>;
  school: LetterSchoolData;
  vars: Record<string, string>;
  standard: LetterStandard;
}

function renderKop(
  variant: string,
  ctx: BlockRenderCtx
): React.ReactElement {
  const { styles, school } = ctx;
  const showLogoLeft = variant === "logo_kiri" || variant === "pemerintah" || variant === "lengkap";
  const showLogoRight = variant === "logo_kanan";
  const showGovernance = variant === "pemerintah" || variant === "lengkap";
  const doubleLine = variant === "lengkap" || variant === "garis_ganda";
  const logo = school.logoUrl;

  return (
    <View style={styles.kop}>
      <View style={styles.kopRow}>
        {showLogoLeft && logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logo} style={styles.kopLogo} />
        ) : null}
        <View style={{ flex: 1 }}>
          {showGovernance && (
            <>
              <Text style={styles.kopInstansi}>
                {school.governanceLine || "PEMERINTAH DAERAH"}
              </Text>
              <Text style={styles.kopDinas}>
                {school.departmentLine || "DINAS PENDIDIKAN"}
              </Text>
            </>
          )}
          <Text style={styles.kopSekolah}>{school.schoolName}</Text>
          <Text style={styles.kopAlamat}>{school.address}</Text>
          {(school.phone || school.email || school.website) && (
            <Text style={styles.kopAlamat}>
              {[
                school.phone ? `Telp. ${school.phone}` : "",
                school.email || "",
                school.website || "",
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          )}
        </View>
        {showLogoRight && logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logo} style={styles.kopLogoRight} />
        ) : null}
      </View>
      {doubleLine && <View style={styles.kopGarisGanda} />}
    </View>
  );
}

function renderBlock(
  inst: LetterBlockInstance,
  ctx: BlockRenderCtx
): React.ReactElement | null {
  const { styles, school } = ctx;
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), ctx.vars);
  const key = inst.instanceId;

  switch (inst.blockId) {
    case "kop_surat":
      return renderKop(asString(d.variant) || "pemerintah", ctx);
    case "judul":
    case "judul_memo":
      return (
        <Text style={styles.judul} key={key}>
          {S(d.text)}
        </Text>
      );
    case "tanggal":
      return (
        <View style={styles.row} key={key}>
          <Text style={{ flex: 1 }} />
          <Text>{tempatTanggal(S(d.tempat), asString(d.tanggal))}</Text>
        </View>
      );
    case "nomor_perihal_lampiran":
      return (
        <View style={{ marginBottom: 8 }} key={key}>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Nomor</Text>
            <Text style={styles.colonCell}>:</Text>
            <Text style={styles.valueCell}>
              {S(d.nomor) || ctx.vars.nomor_surat || "-"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Perihal</Text>
            <Text style={styles.colonCell}>:</Text>
            <Text style={styles.valueCell}>{S(d.perihal) || "-"}</Text>
          </View>
          {!isEmptyText(d.lampiran) && (
            <View style={styles.row}>
              <Text style={styles.labelCell}>Lampiran</Text>
              <Text style={styles.colonCell}>:</Text>
              <Text style={styles.valueCell}>{S(d.lampiran)}</Text>
            </View>
          )}
        </View>
      );
    case "tujuan":
      return (
        <View style={{ marginBottom: 8 }} key={key}>
          <Text>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{S(d.kepada)}</Text>
          {!isEmptyText(d.di_tempat) && <Text>{S(d.di_tempat)}</Text>}
        </View>
      );
    case "salam_pembuka":
    case "penutup":
    case "isi":
      if (d.text && typeof d.text === "string" && d.text.trimStart().startsWith("{")) {
        return renderRich(asString(d.text), ctx, key);
      }
      return (
        <Text style={styles.paragraf} key={key}>
          {S(d.text)}
        </Text>
      );
    case "pelaksanaan_acara":
      return (
        <View style={{ marginVertical: 6 }} key={key}>
          {(
            [
              ["Hari", S(d.hari)],
              ["Tanggal", d.tanggal ? formatTanggalIndo(asString(d.tanggal)) : ""],
              ["Waktu", S(d.waktu)],
              ["Tempat", S(d.tempat)],
              ["Agenda", S(d.agenda)],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <View style={styles.row} key={String(k)}>
                <Text style={styles.labelCell}>{k}</Text>
                <Text style={styles.colonCell}>:</Text>
                <Text style={styles.valueCell}>{v}</Text>
              </View>
            ))}
        </View>
      );
    case "tabel_penugasan":
    case "tabel_generik":
      return renderGenericTable(inst, ctx, key);
    case "tabel_data_siswa":
      return (
        <View style={{ marginVertical: 6 }} key={key}>
          {(
            [
              ["Nama", S(d.nama)],
              ["NISN", S(d.nisn)],
              ["Kelas", S(d.kelas)],
              ["Tempat/Tgl Lahir", S(d.tempat_tanggal_lahir)],
              ["Alamat", S(d.alamat)],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <View style={styles.row} key={String(k)}>
                <Text style={styles.labelCell}>{k}</Text>
                <Text style={styles.colonCell}>:</Text>
                <Text style={styles.valueCell}>{v}</Text>
              </View>
            ))}
        </View>
      );
    case "tanggal_bawah":
      return (
        <View style={{ marginTop: 12, marginBottom: 4 }} key={key}>
          <View style={styles.row}>
            <Text style={{ flex: 1 }} />
            <Text>{tempatTanggal(S(d.tempat), asString(d.tanggal))}</Text>
          </View>
        </View>
      );
    case "tanda_tangan":
      return (
        <View style={styles.ttdWrap} key={key}>
          <View style={styles.ttdBox} />
          <View style={styles.ttdBox}>
            <Text>{S(d.jabatan)}</Text>
            {asString(d.show_stamp) === "true" && school.stampUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={school.stampUrl} style={styles.stamp} />
            ) : (
              <View style={styles.ttdSpace} />
            )}
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.nama) || school.principalName}
            </Text>
            <Text>NIP. {S(d.nip) || school.principalNip}</Text>
          </View>
        </View>
      );
    case "tanda_tangan_ganda":
      return (
        <View style={styles.ttdWrap} key={key}>
          <View style={styles.ttdBox}>
            <Text>{S(d.kiri_jabatan)}</Text>
            <View style={styles.ttdSpace} />
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.kiri_nama)}
            </Text>
            {!isEmptyText(d.kiri_nip) && <Text>NIP. {S(d.kiri_nip)}</Text>}
          </View>
          <View style={styles.ttdBox}>
            <Text>{S(d.kanan_jabatan)}</Text>
            {asString(d.show_stamp) === "true" && school.stampUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={school.stampUrl} style={styles.stamp} />
            ) : (
              <View style={styles.ttdSpace} />
            )}
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.kanan_nama) || school.principalName}
            </Text>
            {(!isEmptyText(d.kanan_nip) || school.principalNip) && (
              <Text>NIP. {S(d.kanan_nip) || school.principalNip}</Text>
            )}
          </View>
        </View>
      );
    case "ttd_tiga":
      return (
        <View style={[styles.ttdWrap, { justifyContent: "space-between" }]} key={key}>
          {(
            [
              ["kiri", "kiri_jabatan", "kiri_nama", "kiri_nip"],
              ["tengah", "tengah_jabatan", "tengah_nama", "tengah_nip"],
              ["kanan", "kanan_jabatan", "kanan_nama", "kanan_nip"],
            ] as [string, string, string, string][]
          ).map(([pid, jk, nk, nipk]) => (
            <View style={[styles.ttdBox, { width: "31%" }]} key={pid}>
              <Text>{S(d[jk])}</Text>
              <View style={styles.ttdSpace} />
              <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
                {S(d[nk])}
              </Text>
              {!isEmptyText(d[nipk]) && <Text>NIP. {S(d[nipk])}</Text>}
            </View>
          ))}
        </View>
      );
    case "tembusan":
      return (
        <View style={{ marginTop: 16 }} key={key}>
          <Text style={{ textDecoration: "underline" }}>
            {S(d.judul) || "Tembusan:"}
          </Text>
          {asString(d.daftar)
            .split("\n")
            .map((l) => S(l).trim())
            .filter(Boolean)
            .map((l, i) => (
              <Text key={i} style={{ marginLeft: 8 }}>
                {i + 1}. {l}
              </Text>
            ))}
        </View>
      );
    case "catatan_kaki":
      return (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 4 }} key={key}>
          <Text style={{ fontSize: ctx.standard.typography.fontSize - 3, fontStyle: "italic" }}>
            {S(d.text)}
          </Text>
        </View>
      );
    case "qr_verifikasi":
      return !isEmptyText(d.url) && d.url ? (
        <View style={{ marginTop: 12, alignItems: "flex-start" }} key={key}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={asString(d.url)} style={{ width: 70, height: 70 }} />
          <Text style={{ fontSize: ctx.standard.typography.fontSize - 4, marginTop: 2 }}>
            {S(d.caption) || "Pindai untuk verifikasi"}
          </Text>
        </View>
      ) : null;
    case "gambar":
      return !isEmptyText(d.url) && d.url ? (
        <View style={{ marginVertical: 6, alignItems: "center" }} key={key}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={asString(d.url)}
            style={{ width: 220, objectFit: "contain" }}
          />
          {!isEmptyText(d.caption) && (
            <Text style={{ fontSize: ctx.standard.typography.fontSize - 3, marginTop: 2 }}>
              {S(d.caption)}
            </Text>
          )}
        </View>
      ) : null;
    case "daftar_lampiran":
      return (
        <View key={key}>
          {!isEmptyText(d.judul) && (
            <Text style={[styles.judul, { textAlign: "left" }]}>{S(d.judul)}</Text>
          )}
          {renderRich(asString(d.isi), ctx, `${key}-lamp`)}
        </View>
      );
    case "page_break":
      // Blok pemisah halaman tidak dirender sebagai konten.
      return null;
    default:
      return null;
  }
}

/** Render tabel generik / penugasan dari data JSON (kolom + baris). */
function renderGenericTable(
  inst: LetterBlockInstance,
  ctx: BlockRenderCtx,
  key: string
): React.ReactElement | null {
  const { styles } = ctx;
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), ctx.vars);

  let columns: { key: string; label: string; width?: number }[] = [];
  let rows: string[][] = [];

  // Format baru: satu field `table` berisi JSON {columns, rows}.
  if (typeof d.table === "string" && d.table.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(d.table);
      if (Array.isArray(parsed.columns)) columns = parsed.columns;
      if (Array.isArray(parsed.rows)) rows = parsed.rows;
    } catch {
      /* fallback ke format lama */
    }
  }

  // Format lama (pipe-separated pada field `rows`).
  if (columns.length === 0 && !isEmptyText(d.rows)) {
    const raw = asString(d.rows);
    const parsed = raw
      .split("\n")
      .map((line) => S(line).split("|").map((c) => c.trim()))
      .filter((cells) => cells.some(Boolean));
    const maxCols = Math.max(1, ...parsed.map((r) => r.length + 1));
    columns = ["No", "Nama", "NIP", "Jabatan", "Uraian"]
      .slice(0, maxCols)
      .map((h, i) => ({ key: `c${i}`, label: h }));
    rows = parsed.map((r, ri) => [String(ri + 1), ...r]);
  }

  if (columns.length === 0) return null;

  return (
    <View style={styles.table} key={key} wrap={false}>
      <View style={[styles.tr, { backgroundColor: "#eeeeee" }]}>
        {columns.map((c, i) => (
          <Text
            style={[styles.th, c.width ? { flex: 0, width: c.width } : { flex: 1 }]}
            key={i}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View style={styles.tr} key={ri}>
          {columns.map((c, ci) => (
            <Text
              style={[styles.td, c.width ? { flex: 0, width: c.width } : { flex: 1 }]}
              key={ci}
            >
              {S(r[ci] || "")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// Halaman & Dokumen
// ─────────────────────────────────────────────

function renderPage(
  page: LetterPage,
  ctx: BlockRenderCtx,
  index: number,
  total: number
): React.ReactElement {
  // Halaman tanpa kop: lewati blok kop_surat (mis. halaman lampiran).
  const useHeader = page.useHeader !== false;
  return (
    <Page size="A4" style={ctx.styles.page} key={page.id} wrap>
      {page.blocks
        .filter((b) => b.enabled && !(b.blockId === "kop_surat" && !useHeader))
        .map((inst) => (
          <React.Fragment key={inst.instanceId}>
            {renderBlock(inst, ctx)}
          </React.Fragment>
        ))}
      <Text
        style={ctx.styles.footer}
        render={({ pageNumber, totalPages }) =>
          total > 1 ? `Halaman ${pageNumber} dari ${totalPages}` : ""
        }
        fixed
      />
    </Page>
  );
}

export function LetterDocument({ standard, document, school, vars }: LetterPdfInput) {
  const styles = buildStyles(standard);
  const ctx: BlockRenderCtx = { styles, school, vars, standard };
  const pages = document.pages.length > 0 ? document.pages : [{ id: "empty", name: "Surat", blocks: [], useHeader: true }];
  const total = pages.length;

  return (
    <Document>
      {pages.map((p, i) => renderPage(p, ctx, i, total))}
    </Document>
  );
}

/** Menghasilkan Blob PDF dari dokumen surat (dijalankan di klien). */
export async function generateLetterPdf(input: LetterPdfInput): Promise<Blob> {
  return pdf(<LetterDocument {...input} />).toBlob();
}
