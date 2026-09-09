/**
 * qr-pdf — Cetak label QR buku langsung ke dokumen PDF
 *
 * Mengapa ada berkas ini:
 * output ZIP/PNG yang sudah ada memang disengaja untuk mengatur ukuran gambar
 * sendiri. Tetapi bila hanya ingin menempelkan banyak QR, mengatur satu per
 * satu melelahkan. Jalur ini menghasilkan PDF dengan QR yang sudah tertata di
 * lembar stiker — pilih preset, cetak, selesai.
 *
 * Isi QR adalah KODE-nya sendiri (mis. "BK-20260909-0001"), BUKAN URL.
 * Itu penting: pemindai di halaman Penjilidan membaca kode lalu memanggil
 * /api/library/books/qr/:code. Alurnya memang stiker ditempel dulu, data
 * buku diisi belakangan — jadi label tidak memuat judul.
 */

import QRCode from "qrcode";

export interface StickerLayout {
  /** Lebar kertas (mm). */
  paperWidth: number;
  /** Tinggi kertas (mm). */
  paperHeight: number;
  /** Lebar satu label (mm). */
  labelWidth: number;
  /** Tinggi satu label (mm). */
  labelHeight: number;
  /** Jarak mendatar antar label (mm). */
  gapX: number;
  /** Jarak tegak antar label (mm). */
  gapY: number;
  /** Font kode (pt). */
  fontSize: number;
}

export interface StickerPreset {
  id: string;
  name: string;
  layout: StickerLayout;
}

// Ukuran dihitung dari kertas A4 (210 × 297 mm) supaya benar-benar muat:
//   lebar = (210 - jarak*(kolom-1) - 2*margin) / kolom
// Angka 52,5 mm untuk 40 label yang sempat disebut tidak muat — 4 × 52,5 mm
// sudah 210 mm, tanpa ruang untuk jarak maupun margin cetak printer.
export const STICKER_PRESETS: StickerPreset[] = [
  {
    id: "a4-24",
    name: "24 label (63,7 × 33,2 mm)",
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 63.7,
      labelHeight: 33.2,
      gapX: 2.5,
      gapY: 2.5,
      fontSize: 11,
    },
  },
  {
    id: "a4-40",
    name: "40 label (47,1 × 26,1 mm)",
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 47.1,
      labelHeight: 26.1,
      gapX: 2.5,
      gapY: 2.5,
      fontSize: 9,
    },
  },
  {
    id: "a4-65",
    name: "65 label (37,2 × 19,5 mm)",
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      labelWidth: 37.2,
      labelHeight: 19.5,
      gapX: 2.5,
      gapY: 2.5,
      fontSize: 7,
    },
  },
];

export interface QrPdfOptions {
  /** Nama sekolah, dicetak hanya bila tinggi label cukup (>= 30 mm). */
  schoolName?: string;
  /** Garis batas sebagai panduan potong. Matikan untuk hemat tinta. */
  showGuides?: boolean;
  /** Dipanggil dengan jumlah kode yang sudah diproses. */
  onProgress?: (done: number, total: number) => void;
}

/** Kode QR dibuat setinggi mungkin agar enak dipindai. */
const QR_PADDING_MM = 1.6;
/** Ruang antara QR dan teks kode. */
const TEXT_GAP_MM = 1.6;

export async function downloadQrStickerPdf(
  codes: string[],
  layout: StickerLayout,
  filename: string,
  options: QrPdfOptions = {}
): Promise<void> {
  if (codes.length === 0) return;

  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [layout.paperWidth, layout.paperHeight],
  });

  // Hitung kisi yang benar-benar muat, lalu pusatkan di kertas. Dipusatkan
  // supaya tidak perlu menebak margin printer pemakai.
  const cols = Math.max(
    1,
    Math.floor((layout.paperWidth + layout.gapX) / (layout.labelWidth + layout.gapX))
  );
  const rows = Math.max(
    1,
    Math.floor((layout.paperHeight + layout.gapY) / (layout.labelHeight + layout.gapY))
  );
  const perPage = cols * rows;

  const gridWidth = cols * layout.labelWidth + (cols - 1) * layout.gapX;
  const gridHeight = rows * layout.labelHeight + (rows - 1) * layout.gapY;
  const offsetX = Math.max(0, (layout.paperWidth - gridWidth) / 2);
  const offsetY = Math.max(0, (layout.paperHeight - gridHeight) / 2);

  // QR diletakkan di kiri; teks kode di sisa ruang kanannya.
  const qrSize = Math.max(6, Math.min(layout.labelHeight - 2 * QR_PADDING_MM, layout.labelWidth * 0.45));
  const textLeft = QR_PADDING_MM + qrSize + TEXT_GAP_MM;
  const textWidth = layout.labelWidth - textLeft - QR_PADDING_MM;
  // Nama sekolah hanya bila ruang tegak cukup; pada 65 label tidak muat.
  const showSchool = Boolean(options.schoolName) && layout.labelHeight >= 30;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];

    if (i > 0 && i % perPage === 0) {
      doc.addPage([layout.paperWidth, layout.paperHeight], "portrait");
    }

    const slot = i % perPage;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = offsetX + col * (layout.labelWidth + layout.gapX);
    const y = offsetY + row * (layout.labelHeight + layout.gapY);

    if (options.showGuides) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(x, y, layout.labelWidth, layout.labelHeight);
    }

    // errorCorrectionLevel "H" sama dengan output ZIP, agar hasil cetak
    // terbaca pemindai yang sama.
    const dataUrl = await QRCode.toDataURL(code, {
      width: 600,
      margin: 0,
      errorCorrectionLevel: "H",
    });

    doc.addImage(
      dataUrl,
      "PNG",
      x + QR_PADDING_MM,
      y + (layout.labelHeight - qrSize) / 2,
      qrSize,
      qrSize
    );

    // Kode dipecah pada tanda hubung bila tidak muat satu baris.
    doc.setTextColor(0, 0, 0);
    const parts = fitCode(doc, code, textWidth, layout.fontSize);
    const lineHeight = layout.fontSize * 0.352778 + 0.8; // pt -> mm + spasi
    const blockHeight = lineHeight * parts.length + (showSchool ? lineHeight : 0);
    let textY = y + (layout.labelHeight - blockHeight) / 2 + lineHeight * 0.75;

    if (showSchool && options.schoolName) {
      doc.setFontSize(Math.min(7, layout.fontSize - 2));
      doc.text(clip(doc, options.schoolName, textWidth), x + textLeft, textY, {
        maxWidth: textWidth,
      });
      textY += lineHeight;
    }

    doc.setFontSize(layout.fontSize);
    for (const part of parts) {
      doc.text(part, x + textLeft, textY, { maxWidth: textWidth });
      textY += lineHeight;
    }

    options.onProgress?.(i + 1, codes.length);
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Pecah kode pada "-" bila terlalu panjang, atau potong bila tetap tak muat. */
function fitCode(doc: any, code: string, maxWidthMm: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  if (doc.getTextWidth(code) <= maxWidthMm) return [code];

  const pieces = code.split("-");
  if (pieces.length > 1) {
    const lines: string[] = [];
    let cur = "";
    for (const p of pieces) {
      const next = cur ? `${cur}-${p}` : p;
      if (doc.getTextWidth(next) > maxWidthMm && cur) {
        lines.push(cur);
        cur = p;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    if (lines.every((l) => doc.getTextWidth(l) <= maxWidthMm)) return lines;
  }
  return [clip(doc, code, maxWidthMm)];
}

/** Potong teks dengan elipsis bila melebihi lebar. */
function clip(doc: any, text: string, maxWidthMm: number): string {
  if (doc.getTextWidth(text) <= maxWidthMm) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidthMm) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Jumlah label per lembar menurut tata letak — dipakai untuk pratinjau. */
export function labelsPerSheet(layout: StickerLayout): number {
  const cols = Math.max(
    1,
    Math.floor((layout.paperWidth + layout.gapX) / (layout.labelWidth + layout.gapX))
  );
  const rows = Math.max(
    1,
    Math.floor((layout.paperHeight + layout.gapY) / (layout.labelHeight + layout.gapY))
  );
  return cols * rows;
}
