// Mesin ekspor PDF untuk DocStation.
//
// Hasil port dari mesin PDF DocStation lama, dilepas dari ketergantungan DOM:
// opsi kualitas/format/fit diterima sebagai parameter. Bergantung pada PDFLib
// (window.PDFLib) yang dimuat dari vendor lewat vendor-loader.

import { type EnginePage, type EngineState } from "./state";
import { mmToPoints, paperDimensions, renderPageToCanvas, type PaperDimensionsInput } from "./canvas";

declare global {
  interface Window {
    // PDFLib dimuat dari vendor dan tidak menyediakan tipe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PDFLib?: any;
  }
}

export interface PdfExportOptions {
  quality: number; // 0..1
  format: "jpeg" | "png" | "webp";
  fitMode: "contain" | "cover";
  paper: PaperDimensionsInput;
}

/**
 * Membuat layout kartu ganda: dua halaman (depan & belakang) digabung ke satu
 * halaman A4.
 */
export async function createCardLayoutCanvas(
  state: EngineState,
  frontPage: EnginePage,
  backPage: EnginePage | undefined,
  canvas: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const [paperWidthMm, paperHeightMm] = [210, 297];
  const paperWidth = mmToPoints(paperWidthMm);
  const paperHeight = mmToPoints(paperHeightMm);
  const scale = 2;

  const canvasWidth = Math.round(paperWidth * scale);
  const canvasHeight = Math.round(paperHeight * scale);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const sideHeight = canvasHeight / 2;
  const sidePadding = 20;

  for (let index = 0; index < 2; index += 1) {
    const page = index === 0 ? frontPage : backPage;
    if (!page) continue;
    const tempCanvas = document.createElement("canvas");
    renderPageToCanvas(state, page, tempCanvas, { maxDimension: 2000 });
    const imgWidth = tempCanvas.width;
    const imgHeight = tempCanvas.height;
    const maxHeight = sideHeight - sidePadding * 2;
    const maxWidth = canvasWidth - sidePadding * 2;
    const scaleImage = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
    const drawWidth = imgWidth * scaleImage;
    const drawHeight = imgHeight * scaleImage;
    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = index * sideHeight + (sideHeight - drawHeight) / 2;
    ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
  }

  return canvas;
}

export async function createPdf(
  state: EngineState,
  pages: EnginePage[],
  options: PdfExportOptions,
): Promise<Uint8Array> {
  if (!window.PDFLib) throw new Error("Mesin PDF gagal dimuat");
  const { quality, format, fitMode, paper } = options;
  const [paperWidthMm, paperHeightMm] = paperDimensions(paper);
  const paperWidth = mmToPoints(paperWidthMm);
  const paperHeight = mmToPoints(paperHeightMm);
  const pdf = await window.PDFLib.PDFDocument.create();

  for (const sourcePage of pages) {
    const renderCanvas = document.createElement("canvas");
    renderPageToCanvas(state, sourcePage, renderCanvas, { maxDimension: 2600 });

    const mimeType =
      format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      renderCanvas.toBlob(resolve, mimeType, quality),
    );
    const imageBytes = blob ? await blob.arrayBuffer() : new ArrayBuffer(0);
    const image =
      format === "png" ? await pdf.embedPng(imageBytes) : await pdf.embedJpg(imageBytes);
    const page = pdf.addPage([paperWidth, paperHeight]);
    const scale =
      fitMode === "contain"
        ? Math.min(paperWidth / image.width, paperHeight / image.height)
        : Math.max(paperWidth / image.width, paperHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: (paperWidth - width) / 2,
      y: (paperHeight - height) / 2,
      width,
      height,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.save();
}
