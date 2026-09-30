// Mesin render canvas untuk DocStation.
//
// Hasil port dari mesin canvas DocStation lama (SPA vanilla), dilepas dari
// ketergantungan DOM: nilai yang dulu dibaca dari `elements.paperSize.value`
// kini diterima sebagai parameter biasa.

import {
  getOverlaysForPage,
  type EnginePage,
  type EngineState,
} from "./state";
import {
  resolvePaperMM,
  type PaperSize,
} from "@/app/(dashboard)/docstation/_components/types";

export function mmToPoints(mm: number): number {
  return (mm * 72) / 25.4;
}

export interface PaperDimensionsInput {
  paperSize: PaperSize | "custom";
  customWidth?: number;
  customHeight?: number;
  orientation?: "portrait" | "landscape";
}

/** Menghitung dimensi kertas (mm) dari konfigurasi eksplisit. */
export function paperDimensions(input: PaperDimensionsInput): [number, number] {
  let dimensions: [number, number] = resolvePaperMM(
    input.paperSize as PaperSize,
    input.customWidth,
    input.customHeight,
  );

  if (!dimensions || dimensions.some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new Error("Ukuran kertas tidak valid");
  }
  if (input.orientation === "landscape") {
    dimensions = [dimensions[1], dimensions[0]];
  }
  return dimensions;
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] as string,
  );
}

export function applyFilters(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  page: EnginePage,
): void {
  const gamma = page.gamma ?? 1;
  if (!page.contrast && !page.brightness && !page.grayscale && gamma === 1) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrastFactor = (259 * (page.contrast + 255)) / (255 * (259 - page.contrast));
  const invGamma = 1 / gamma;
  // Tabel LUT gamma agar loop tetap cepat.
  const gammaLut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    gammaLut[i] = Math.round(255 * Math.pow(i / 255, invGamma));
  }
  for (let index = 0; index < data.length; index += 4) {
    let red = contrastFactor * (data[index] - 128) + 128 + page.brightness;
    let green = contrastFactor * (data[index + 1] - 128) + 128 + page.brightness;
    let blue = contrastFactor * (data[index + 2] - 128) + 128 + page.brightness;
    if (gamma !== 1) {
      red = gammaLut[Math.max(0, Math.min(255, Math.round(red)))];
      green = gammaLut[Math.max(0, Math.min(255, Math.round(green)))];
      blue = gammaLut[Math.max(0, Math.min(255, Math.round(blue)))];
    }
    if (page.grayscale) {
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      red = gray;
      green = gray;
      blue = gray;
    }
    data[index] = Math.max(0, Math.min(255, red));
    data[index + 1] = Math.max(0, Math.min(255, green));
    data[index + 2] = Math.max(0, Math.min(255, blue));
  }
  ctx.putImageData(imageData, 0, 0);
}

export interface RenderOptions {
  maxDimension?: number;
  targetScale?: number;
}

/** Merender satu halaman ke canvas target (termasuk overlay). */
export function renderPageToCanvas(
  state: EngineState,
  page: EnginePage,
  canvas: HTMLCanvasElement,
  options: RenderOptions = {},
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const coarseRotation = ((page.rotation % 360) + 360) % 360;
  const swap = coarseRotation === 90 || coarseRotation === 270;
  const sourceWidth = page.image.naturalWidth || page.image.width;
  const sourceHeight = page.image.naturalHeight || page.image.height;
  const maxDimension = options.maxDimension || 2600;
  const scale =
    options.targetScale || Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round((swap ? sourceHeight : sourceWidth) * scale));
  const height = Math.max(1, Math.round((swap ? sourceWidth : sourceHeight) * scale));
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(((coarseRotation + page.fineRotation) * Math.PI) / 180);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const fineScale = page.fineRotation === 0 ? 1 : 1.03;
  const flipX = page.flipH ? -1 : 1;
  const flipY = page.flipV ? -1 : 1;
  ctx.scale(flipX, flipY);
  ctx.drawImage(
    page.image,
    (-drawWidth * fineScale) / 2,
    (-drawHeight * fineScale) / 2,
    drawWidth * fineScale,
    drawHeight * fineScale,
  );
  ctx.restore();
  applyFilters(ctx, width, height, page);
  drawOverlays(state, ctx, page, width, height);
  return canvas;
}

function drawOverlays(
  state: EngineState,
  ctx: CanvasRenderingContext2D,
  page: EnginePage,
  width: number,
  height: number,
): void {
  const overlays = getOverlaysForPage(state, page.id);
  if (!overlays.length) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  let eraserBuffer: HTMLCanvasElement | null = null;

  overlays.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    const pts = stroke.points;
    const lineSize = stroke.size || 20;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      const blurRadius = Math.max(1, Math.round(lineSize / 3));
      if (!eraserBuffer || eraserBuffer.width !== width || eraserBuffer.height !== height) {
        eraserBuffer = document.createElement("canvas");
        eraserBuffer.width = width;
        eraserBuffer.height = height;
      }
      const ectx = eraserBuffer.getContext("2d")!;
      ectx.clearRect(0, 0, width, height);
      ectx.setTransform(1, 0, 0, 1, 0, 0);
      ectx.lineCap = "round";
      ectx.lineJoin = "round";
      ectx.lineWidth = lineSize;
      ectx.strokeStyle = "white";
      ectx.filter = `blur(${blurRadius}px)`;
      drawCatmullRom(ectx, pts, 0.5);
      ectx.filter = "none";

      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(eraserBuffer, 0, 0);
      return;
    }

    if (stroke.tool === "brush") {
      ctx.globalCompositeOperation = "source-over";
      const color = stroke.color || state.brushColor || "#2563eb";
      ctx.strokeStyle = hexToRgba(color, 0.85);
    } else if (stroke.tool === "highlighter") {
      ctx.globalCompositeOperation = "multiply";
      const color = stroke.color || state.highlightColor || "#ffff00";
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.lineWidth = Math.max(lineSize, 30);
    }

    ctx.lineWidth = lineSize;
    drawCatmullRom(ctx, pts, 0.5);
  });

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function drawCatmullRom(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  tension: number,
): void {
  if (pts.length < 2) return;

  ctx.beginPath();
  if (pts.length === 2) {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    const getPoint = (idx: number, offset: number) => {
      if (idx + offset < 0) return pts[0];
      if (idx + offset >= pts.length) return pts[pts.length - 1];
      return pts[idx + offset];
    };

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = getPoint(i, -1);
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = getPoint(i + 1, 1);

      const cp1x = p1.x + (tension * (p2.x - p0.x)) / 6;
      const cp1y = p1.y + (tension * (p2.y - p0.y)) / 6;
      const cp2x = p2.x - (tension * (p3.x - p1.x)) / 6;
      const cp2y = p2.y - (tension * (p3.y - p1.y)) / 6;

      if (i === 0) ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }
  ctx.stroke();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createImageFromBlob(
  blob: Blob,
): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      reject(new Error("Gagal memuat gambar"));
    };
    image.src = url;
  });
}
