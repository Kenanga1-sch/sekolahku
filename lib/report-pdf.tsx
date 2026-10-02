/**
 * report-pdf.tsx — Client-side PDF Generator untuk Report Builder v3 (cell-based).
 * Menerima ReportWorkbook bertipe sel; evaluasi dilakukan oleh report-engine-v3.
 */

/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image, Svg, Line, Rect, Ellipse, Font } from "@react-pdf/renderer";
import type {
  ReportWorkbook,
  ReportSheet,
  SheetCell,
  ReportMarginConfig,
  ReportDensityConfig,
} from "@/lib/config/report-sheet";
import { cellKey, printedColWidthsPt, visibleColumnCount, printScaleOf, BOARD_WIDTH_PT } from "@/lib/config/report-sheet";
import { conditionalStyleFor } from "@/lib/report-sheet-ops";
import { pdfFontFamily as mapPdfFont, registerReportFonts } from "@/lib/report-fonts";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import { evaluateSheet, type EvaluatedSheet, type EvaluateContext } from "@/lib/report-engine-v3";
import { rowHeightPt, paperContentSizePt, computePageBreaks } from "@/lib/report-paginate";
import type { Style } from "@react-pdf/types";

// Daftarkan font tambahan (Arial/Bookman/Liberation) sekali saat modul dimuat.
// Di browser, font dimuat dari /fonts/*; di Node (test/SSR), dari public/fonts/*.
const fontBase = typeof process !== "undefined" && process.versions?.node && !process.env.NEXT_RUNTIME
  ? "public/fonts"
  : "/fonts";
registerReportFonts(Font, fontBase);

export interface ReportPdfInput {
  workbook: ReportWorkbook;
  school: LetterSchoolData;
  dataset?: Record<string, any>[];
  /** Dataset bernama untuk laporan multi-sumber (lembar memilih via `datasetName`). */
  datasets?: Record<string, Record<string, any>[]>;
  global?: Record<string, any>;
  fileName?: string;
}

const DEFAULT_MARGIN: ReportMarginConfig = { top: 36, bottom: 45, left: 40, right: 40 };
const DEFAULT_TYPO: ReportDensityConfig = { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.4, rowPadding: 4, blockGap: 8 };

export function pdfFontFamily(cell: SheetCell): string {
  return mapPdfFont(cell);
}

/** Variabel global default yang selalu tersedia (dari pengaturan sekolah). */
export function schoolGlobalVars(school: LetterSchoolData): Record<string, any> {
  return {
    sekolah: {
      schoolName: school.schoolName,
      nama: school.schoolName,
      npsn: school.npsn,
      address: school.address,
      alamat: school.address,
      phone: school.phone,
      email: school.email,
      website: school.website,
      logoUrl: school.logoUrl,
      governanceLine: school.governanceLine,
      departmentLine: school.departmentLine,
    },
    principal: {
      nama: school.principalName,
      name: school.principalName,
      nip: school.principalNip,
      stampUrl: school.stampUrl,
    },
    schoolName: school.schoolName,
    schoolAddress: school.address,
    schoolPhone: school.phone,
    schoolEmail: school.email,
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cell: {
    justifyContent: "flex-start",
  },
  pageFooter: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#94a3b8",
    // Tebal garis footer disamakan dengan border user (BOARD_WIDTH_PT) agar
    // semua garis horizontal pada dokumen setebal 0.5pt.
    borderTopWidth: BOARD_WIDTH_PT,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
});

/** Warna default border yang digambar user (hitam), berbeda dari garis bawaan. */
const USER_BORDER_DEFAULT = "#000000";

/**
 * Ketebalan border user dalam pt.
 *
 * Grid editor merender 0.75px @96dpi = 0.5625pt; nilainya dibulatkan ke
 * `BOARD_WIDTH_PT` (0.5pt) agar ketebalan seragam di layar, pratinjau, dan
 * cetak — garis pecahan (hairline) pada PDF membuat batas tabel tampak
 * berantakan saat halaman terpotong. Konstanta didefinisikan di
 * `lib/config/report-sheet` supaya semua konsumen memakai nilai yang sama.
 *
 * diekspor agar pratinjau (`report-pdf-preview`) dapat memakai nilai identik.
 */
export const USER_BORDER_WIDTH_PT = BOARD_WIDTH_PT;

/**
 * Warna garis horizontal eksplisit di batas halaman. Dipakai agar baris
 * pertama/terakhir tiap halaman tetap punya garis penutup yang rapi saat tabel
 * terpotong antar-halaman (sebelumnya garis sel terpotong/hilang).
 */
const PAGE_BORDER_COLOR = USER_BORDER_DEFAULT;

function borderStyle(border: SheetCell["border"]): Record<string, any> {
  if (!border || border === "none") return {};
  // box = all border untuk saat ini: model sel tidak menyimpan konteks blok,
  // jadi "hanya sisi luar blok" tak bisa dihitung di renderer. Preset tersimpan
  // tetap dirender penuh agar template lama utuh; sisi luar blok bisa dibuat
  // lewat border per-sisi. Lihat `CellBorder` di lib/config/report-sheet.ts.
  if (border === "all" || border === "box") {
    return {
      borderTopWidth: USER_BORDER_WIDTH_PT,
      borderBottomWidth: USER_BORDER_WIDTH_PT,
      borderLeftWidth: USER_BORDER_WIDTH_PT,
      borderRightWidth: USER_BORDER_WIDTH_PT,
    };
  }
  return {};
}

/** Border per-sisi: menimpa preset `border` bila field eksplisit ada. */
function cellBorderStyle(cell: SheetCell): Record<string, any> {
  const base: Record<string, any> = borderStyle(cell.border);
  // Border yang digambar user default hitam (bukan abu-abu tipis).
  const color = cell.borderColor || USER_BORDER_DEFAULT;
  const apply = (key: "borderTop" | "borderBottom" | "borderLeft" | "borderRight", widthKey: string) => {
    const v = cell[key];
    if (v === undefined) return;
    base[widthKey] = v ? USER_BORDER_WIDTH_PT : 0;
  };
  apply("borderTop", "borderTopWidth");
  apply("borderBottom", "borderBottomWidth");
  apply("borderLeft", "borderLeftWidth");
  apply("borderRight", "borderRightWidth");
  if (Object.keys(base).length > 0) base.borderColor = color;
  return base;
}

function renderSheet(
  sheet: ReportSheet,
  ev: EvaluatedSheet,
  wb: ReportWorkbook,
  school: LetterSchoolData,
  key: string,
  ctx: EvaluateContext,
) {
  const typo = wb.typography || DEFAULT_TYPO;
  const margin = wb.margin || DEFAULT_MARGIN;
  const contentWidthPt = Math.max(
    1,
    paperContentSizePt(wb).contentWidthPt
  );
  // Skala cetak ("Scale to fit", persen). Hanya memengaruhi render, bukan
  // model lebar kolom. Diterapkan ke geometri & font konten.
  const pscale = printScaleOf(wb);
  const wrapCtx = { contentWidthPt, typo };

  // Lebar kolom untuk cetak (pt) — absolut px × 0.75 × skala cetak, TIDAK
  // diregangkan. Kolom yang melewati tepi kanan dipotong (ala Print Area
  // Excel) — apa yang didesain di grid = apa yang tercetak.
  const widthsPt = printedColWidthsPt(sheet).map((w) => w * pscale);
  // Lebar konten dalam satuan lebar kolom (belum diskala) supaya kliping kolom
  // di PDF konsisten dengan editor: `contentWidthPt / pscale` (bukan konstanta
  // editor / lebar area kerja di layar).
  const visibleColCount = visibleColumnCount(sheet, contentWidthPt / pscale);
  const visibleCols = new Set<number>();
  for (let c = 0; c < visibleColCount; c++) visibleCols.add(c);
  // Lebar total kolom yang benar-benar dirender (pt, sudah diskala) — batas
  // gambar garis horizontal di batas halaman agar tidak melebihi tabel. Batas
  // atasnya adalah lebar area cetak SEBENARNYA (`contentWidthPt`), bukan
  // `contentWidthPt * pscale`: skala cetak sudah diterapkan pada `widthsPt`,
  // sehingga mengalikan lagi akan memotong tabel lebih pendek dari aslinya
  // saat printScale < 1 (dan membuat border batas halaman tak sepanjang tabel).
  const tableWidthPt = Math.min(
    contentWidthPt,
    widthsPt.slice(0, visibleColCount).reduce((a, b) => a + b, 0),
  );

  // Rencana batas halaman yang identik dengan editor: baris pertama & terakhir
  // tiap halaman. Dipakai untuk menggambar border horizontal eksplisit pada
  // baris yang jatuh di batas halaman (garis sel sebelumnya terpotong).
  const pagePlan = computePageBreaks(sheet, wb, ctx);
  const firstRowOfPage = new Set<number>();
  const lastRowOfPage = new Set<number>();
  for (const info of pagePlan.pages || []) {
    if (info.firstRowIndex >= 0) firstRowOfPage.add(info.firstRowIndex);
    if (info.lastRowIndex >= 0) lastRowOfPage.add(info.lastRowIndex);
  }
  const lastOutputRow = ev.outputRows - 1;
  // Koordinat sel selalu dihitung dari geometri absolut kolom. Jangan memakai
  // jumlah kolom visible untuk menentukan pusat merge: itu menggeser pusat saat
  // merge menyentuh batas area cetak.
  const colStartPt: number[] = [];
  const colEndPt: number[] = [];
  {
    let acc = 0;
    for (let c = 0; c < sheet.cols; c++) {
      colStartPt[c] = acc;
      acc += widthsPt[c];
      colEndPt[c] = acc;
    }
  }

  // Tinggi baris: eksplisit bila ada, jika tidak mengikuti rumus bersama
  // (report-paginate.rowHeightPt) agar editor & PDF tak pernah menyimpang.
  const rowHeightFor = (inputR: number | undefined, fontSize: number): number => {
    if (typeof inputR !== "number") {
      return Math.ceil(fontSize * (typo.lineHeight || 1.4) + typo.rowPadding * 2 + 2) * pscale;
    }
    return rowHeightPt(sheet, inputR, fontSize, typo, wrapCtx) * pscale;
  };

  const cellFontSize = (inputCell: SheetCell): number =>
    (inputCell.fontSize ?? typo.baseFontSize) * pscale;

  /**
   * Border horizontal eksplisit untuk baris yang jatuh di batas halaman.
   *
   * Baris pertama halaman (kecuali baris 0 dokumen) mendapat garis atas, baris
   * terakhir halaman mendapat garis bawah. Tanpa ini, garis sel pada baris yang
   * terpotong bisa hilang, sehingga batas tabel tampak berantakan.
   *
   * Hindari dobel: baris 0 halaman pertama tidak diberi garis atas (sudah
   * jadi tepi atas tabel), dan baris terakhir dokumen tidak diberi garis bawah.
   */
  const pageBoundaryBorder = (r: number): Record<string, any> => {
    const style: Record<string, any> = {};
    let hasBorder = false;
    if (r > 0 && firstRowOfPage.has(r)) {
      style.borderTopWidth = USER_BORDER_WIDTH_PT;
      hasBorder = true;
    }
    if (lastRowOfPage.has(r) && r < lastOutputRow) {
      style.borderBottomWidth = USER_BORDER_WIDTH_PT;
      hasBorder = true;
    }
    if (hasBorder) style.borderColor = PAGE_BORDER_COLOR;
    return style;
  };

  /** Render satu baris output (atau baris header tetap) sebagai flex row. */
  const renderRow = (r: number, fixed: boolean, keySuffix: string) => {
    const inputR = ev.inputRowByOutput[r];
    const firstCell = Array.from({ length: sheet.cols })
      .map((_, c) => sheet.cells[cellKey(inputR ?? -1, c)])
      .find(Boolean);
    const baseFont = firstCell ? cellFontSize(firstCell) : typo.baseFontSize;
    const rowHeight = rowHeightFor(inputR, baseFont);

    // Kolom yang tertutup oleh colSpan sel di sebelah kirinya. Tanpa ini,
    // sel kosong pengisi ikut dirender dan (karena lebar persen) berebut
    // ruang dengan sel gabungan — akibatnya teks sel gabungan tak lagi
    // berada di tengah. Kolom yang tertutup rowSpan memakai slot transparan
    // (lihat bawah) agar kolom sesudahnya tidak bergeser ke kiri.
    const colCovered = new Set<number>();
    if (typeof inputR === "number") {
      for (let c = 0; c < sheet.cols; c++) {
        const cell = sheet.cells[cellKey(inputR, c)];
        const span = cell?.colSpan ?? 1;
        for (let cc = c + 1; cc < c + span && cc < sheet.cols; cc++) colCovered.add(cc);
      }
    }

    return (
      <View
        style={{
          ...styles.sheetRow,
          width: tableWidthPt,
          flexShrink: 0,
          ...pageBoundaryBorder(r),
        }}
        key={`row-${r}-${keySuffix}`}
        fixed={fixed || undefined}
      >
        {Array.from({ length: sheet.cols }).map((_, c) => {
          if (!visibleCols.has(c)) return null;
          if (colCovered.has(c)) return null;
          const key = cellKey(r, c);
          // Sel tertutup rowSpan: slot transparan berlebar kolom & tinggi baris.
          // Tanpa slot ini, sel sesudahnya bergeser ke kiri (flex tanpa kotak)
          // dan tinggi baris ikut hilang pada merge lebar-penuh.
          if (ev.occupied.has(key)) {
            return <View key={`cell-${c}`} style={{ width: widthsPt[c], minWidth: widthsPt[c], flexShrink: 0, minHeight: rowHeight }} />;
          }
          const inputCell = typeof inputR === "number" ? sheet.cells[cellKey(inputR, c)] : undefined;
          if (!inputCell) {
                return <View key={`cell-${c}`} style={{ width: widthsPt[c], minWidth: widthsPt[c], flexShrink: 0, minHeight: rowHeight }} />;
          }
          const colSpan = inputCell.colSpan ?? 1;
          const rowSpan = inputCell.rowSpan ?? 1;
          // Lebar span adalah rentang absolut dari kolom pertama sampai kolom
          // terakhir. Ini menjaga pusat alignment merge tetap sama dengan grid.
          const spanEndCol = Math.min(sheet.cols - 1, c + colSpan - 1);
          const startPt = colStartPt[c] ?? 0;
          const endPt = colEndPt[spanEndCol] ?? startPt;
          const spanWidth = Math.max(0, Math.min(endPt, contentWidthPt) - startPt);
          const rv = ev.cellMap.get(key);
          const text = rv ? rv.text : "";
          const cond = conditionalStyleFor(sheet, r, c, text);
          const pad = typo.rowPadding * pscale;
          const font = cellFontSize(inputCell);
          const cellVisual: Style = {
            paddingVertical: pad,
            paddingHorizontal: 3 * pscale,
            paddingLeft: (inputCell.indent ? 3 + inputCell.indent : 3) * pscale,
            backgroundColor: cond?.bg ?? inputCell.bg,
            justifyContent:
              inputCell.vertical === "middle" ? "center" : inputCell.vertical === "bottom" ? "flex-end" : "flex-start",
            ...cellBorderStyle(inputCell),
          };
          const textNode = (
            <Text
              wrap={inputCell.wrap === true}
              style={{
                fontSize: font,
                fontFamily: pdfFontFamily(inputCell),
                textDecoration: inputCell.underline ? "underline" : "none",
                textAlign: inputCell.align || "left",
                color: cond?.color ?? inputCell.color,
                flexShrink: inputCell.wrap ? 1 : undefined,
                ...(inputCell.rotation ? { transform: `rotate(${inputCell.rotation}deg)` } : {}),
              }}
            >
              {text}
            </Text>
          );

          if (rowSpan > 1) {
            // Merge vertikal: slot di aliran menjaga tinggi baris ini tetap
            // natural (h0), sementara anchor dirender ABSOLUTE sehingga
            // menjangkau baris di bawahnya tanpa mendorong baris-baris itu
            // turun (sebelumnya minHeight = Σ membuat baris sesudahnya terdorong
            // ke bawah dan tinggi total meleset dari rencana pagination).
            let spanHeight = 0;
            for (let rr = r; rr < r + rowSpan && rr < ev.outputRows; rr++) {
              const irr = ev.inputRowByOutput[rr];
              const f = Array.from({ length: sheet.cols })
                .map((_, cc) => sheet.cells[cellKey(irr ?? -1, cc)])
                .find(Boolean);
              spanHeight += rowHeightFor(irr, f ? cellFontSize(f) : typo.baseFontSize);
            }
            return (
              <View key={`cell-${c}`} style={{ width: spanWidth, minWidth: spanWidth, flexShrink: 0, minHeight: rowHeight }}>
                <View style={{ position: "absolute", top: 0, left: 0, width: spanWidth, height: spanHeight, ...cellVisual }}>
                  {textNode}
                </View>
              </View>
            );
          }

          return (
            <View
              key={`cell-${c}`}
              style={{
                 width: spanWidth,
                 minWidth: spanWidth,
                 flexShrink: 0,
                 minHeight: rowHeight,
                ...cellVisual,
              }}
            >
              {textNode}
            </View>
          );
        })}
      </View>
    );
  };

  // Baris header yang diulang antar halaman (opsional): baris input tepat di
  // atas baris zona ulang pertama. Cari output pertamanya untuk mengambil teks.
  let fixedHeaderOutputRow = -1;
  if (wb.headerRepeat && ev.repeatOutputRows.size > 0) {
    const firstRepeatOutput = Math.min(...Array.from(ev.repeatOutputRows));
    const headerInputR = (ev.inputRowByOutput[firstRepeatOutput] ?? 0) - 1;
    if (headerInputR >= 0) {
      const idx = ev.inputRowByOutput.indexOf(headerInputR);
      if (idx >= 0) fixedHeaderOutputRow = idx;
    }
  }

  return (
    <Page
      key={key}
      size={wb.paperSize === "F4" ? ([609.45, 935.43] as [number, number]) : wb.paperSize === "LEGAL" ? "LEGAL" : "A4"}
      orientation={wb.orientation || "portrait"}
      wrap
      style={{
        ...styles.page,
        fontSize: typo.baseFontSize,
        lineHeight: typo.lineHeight,
        paddingTop: margin.top,
        paddingBottom: margin.bottom,
        paddingLeft: margin.left,
        paddingRight: margin.right,
      }}
    >
      {/*
        Header berulang: baris header dirender inline pada posisi naturalnya
        (di bawah kop, halaman 1). Salinan berulang dibuat dengan `fixed`, tapi
        HANYA untuk halaman >1 — `fixed` tanpa penjaga mengeluarkan header dari
        aliran dan menempelkannya di puncak SETIAP halaman, sehingga menimpa kop
        di halaman 1 (bug cetak saat dataset terisi). `render` di sini
        menyembunyikan salinan fixed di halaman 1.
        ponytail: header inline diasumsikan jatuh di halaman 1 (kop pendek).
        Bila kop sangat panjang sehingga header jatuh ke halaman >1, salinan
        fixed dapat menghasilkan header ganda. Perbaikan penuh = menyisipkan
        baris header per halaman di report-paginate.
      */}
      {fixedHeaderOutputRow >= 0
        ? (
          <View fixed render={({ pageNumber }) => (pageNumber === 1 ? null : renderRow(fixedHeaderOutputRow, false, "fixed"))} />
        )
        : null}

      {Array.from({ length: ev.outputRows }).map((_, r) => {
        return renderRow(r, false, "body");
      })}

      {(sheet.shapes || []).map((shape) => (
        <View
          key={shape.id}
          fixed
          style={{
            position: "absolute",
            top: margin.top + shape.y * pscale,
            left: margin.left + shape.x * pscale,
            width: Math.max(shape.width * pscale, 1),
            height: Math.max(shape.height * pscale, 1),
            ...(shape.rotation ? { transform: `rotate(${shape.rotation}deg)` } : {}),
          }}
        >
          <Svg width={Math.max(shape.width * pscale, 1)} height={Math.max(shape.height * pscale, 1)}>
            {shape.type === "line" ? (
              <Line
                x1={0}
                y1={0}
                x2={shape.width * pscale}
                y2={shape.height * pscale}
                stroke={shape.stroke || "#000000"}
                strokeWidth={(shape.strokeWidth ?? 1) * pscale}
              />
            ) : shape.type === "rect" ? (
              <Rect
                x={0}
                y={0}
                width={Math.max(shape.width * pscale, 1)}
                height={Math.max(shape.height * pscale, 1)}
                fill={shape.fill || "none"}
                stroke={shape.stroke || "#000000"}
                strokeWidth={(shape.strokeWidth ?? 1) * pscale}
              />
            ) : (
              <Ellipse
                cx={Math.max(shape.width * pscale, 1) / 2}
                cy={Math.max(shape.height * pscale, 1) / 2}
                rx={Math.max(shape.width * pscale, 1) / 2}
                ry={Math.max(shape.height * pscale, 1) / 2}
                fill={shape.fill || "none"}
                stroke={shape.stroke || "#000000"}
                strokeWidth={(shape.strokeWidth ?? 1) * pscale}
              />
            )}
          </Svg>
        </View>
      ))}

      {(sheet.images || []).map((img) => (
        <View
          key={img.id}
          fixed
          style={{
            position: "absolute",
            top: margin.top + img.y * pscale,
            left: margin.left + img.x * pscale,
            width: Math.max(img.width * pscale, 1),
            height: Math.max(img.height * pscale, 1),
            ...(img.rotation ? { transform: `rotate(${img.rotation}deg)` } : {}),
          }}
        >
          <Image src={img.src} style={{ width: Math.max(img.width * pscale, 1), height: Math.max(img.height * pscale, 1), objectFit: "contain" }} />
        </View>
      ))}

      {wb.showFooter && (
        <View style={[styles.pageFooter, { bottom: 20, left: margin.left, right: margin.right }]} fixed>
          <Text>{school.schoolName} — System Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      )}
    </Page>
  );
}

export function ReportPdfDocument({ workbook, school, dataset = [], datasets, global }: ReportPdfInput) {
  const ctx: EvaluateContext = { dataset, datasets, global: { ...schoolGlobalVars(school), ...(global || {}) } };
  return (
    <Document title={workbook.reportName || "Laporan"}>
      {workbook.sheets.map((sheet, idx) => {
        const ev = evaluateSheet(sheet, ctx);
        return renderSheet(sheet, ev, workbook, school, sheet.id || `sheet-${idx}`, ctx);
      })}
    </Document>
  );
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  return pdf(<ReportPdfDocument {...input} />).toBlob();
}
