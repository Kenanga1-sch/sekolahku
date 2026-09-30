// Operasi pengeditan halaman DocStation.
//
// Mengumpulkan aksi "sekali jalan" yang mengubah citra halaman (rotate, crop,
// apply hasil worker, reset) dan aksi multi-halaman (stitch, layout kartu).
// Semua fungsi menerima/mengembalikan struktur data murni; DOM hanya disentuh
// lewat kanvas sementara (tidak tersimpan).

import { createImageFromBlob, renderPageToCanvas } from "./canvas";
import {
  createEnginePage,
  getOverlaysForPage,
  type EnginePage,
  type EngineState,
} from "./state";

/** Mengubah query string object URL apa pun menjadi Blob baru yang dimuat ulang. */
async function blobFromCanvas(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar"))),
      type,
      quality,
    );
  });
}

/** Mengganti citra sebuah halaman dari Blob dan membersihkan cache turunannya. */
export async function replacePageImage(page: EnginePage, blob: Blob): Promise<void> {
  const { image, url } = await createImageFromBlob(blob);
  if (page.sourceUrl) {
    try {
      URL.revokeObjectURL(page.sourceUrl);
    } catch {
      /* ignore */
    }
  }
  page.image = image;
  page.sourceUrl = url;
  page.width = image.naturalWidth || image.width;
  page.height = image.naturalHeight || image.height;
}

/** Memutar halaman 90° (kasar). */
export function rotatePage(page: EnginePage, degrees: number): void {
  page.rotation = (((page.rotation + degrees) % 360) + 360) % 360;
}

/** Mencerminkan halaman secara horizontal/vertikal. */
export function flipPage(page: EnginePage, axis: "horizontal" | "vertical"): void {
  if (axis === "horizontal") page.flipH = !page.flipH;
  else page.flipV = !page.flipV;
}

/** Mengatur ulang seluruh penyesuaian & transformasi halaman. */
export function resetPageEdits(state: EngineState, page: EnginePage): void {
  page.rotation = 0;
  page.fineRotation = 0;
  page.contrast = 0;
  page.brightness = 0;
  page.grayscale = false;
  page.gamma = 1;
  page.flipH = false;
  page.flipV = false;
  const overlays = getOverlaysForPage(state, page.id);
  overlays.length = 0;
}

/** Menerapkan buffer ImageData hasil worker (enhanсement/warp) ke sebuah halaman. */
export async function applyImageDataToPage(
  page: EnginePage,
  imageData: ArrayBuffer,
  width: number,
  height: number,
  options: { resetTransform?: boolean } = {},
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(imageData), width, height), 0, 0);
  // JPEG jauh lebih kecil dari PNG untuk foto dokumen; kualitas 0.92 menjaga teks tajam.
  const blob = await blobFromCanvas(canvas, "image/jpeg", 0.92);
  await replacePageImage(page, blob);
  if (options.resetTransform) {
    page.rotation = 0;
    page.fineRotation = 0;
    page.contrast = 0;
    page.brightness = 0;
    page.grayscale = false;
    page.gamma = 1;
    page.flipH = false;
    page.flipV = false;
  }
}

/** Crop halaman sesuai region (koordinat pada kanvas sumber). */
export async function cropPage(
  state: EngineState,
  page: EnginePage,
  region: { x: number; y: number; width: number; height: number },
  // Samakan dengan render overlay (2200) agar koordinat crop 1:1.
  sourceMax = 2200,
): Promise<void> {
  const temp = document.createElement("canvas");
  renderPageToCanvas(state, page, temp, { maxDimension: sourceMax });

  const sx = Math.max(0, Math.round(region.x));
  const sy = Math.max(0, Math.round(region.y));
  const sw = Math.max(1, Math.round(region.width));
  const sh = Math.max(1, Math.round(region.height));

  const cropped = document.createElement("canvas");
  cropped.width = Math.min(sw, temp.width - sx);
  cropped.height = Math.min(sh, temp.height - sy);
  const cctx = cropped.getContext("2d")!;
  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, cropped.width, cropped.height);
  cctx.drawImage(temp, sx, sy, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);

  const blob = await blobFromCanvas(cropped, "image/jpeg", 0.95);
  await replacePageImage(page, blob);
  page.rotation = 0;
  page.fineRotation = 0;
  page.contrast = 0;
  page.brightness = 0;
  page.grayscale = false;
  page.gamma = 1;
  page.flipH = false;
  page.flipV = false;
  const overlays = getOverlaysForPage(state, page.id);
  overlays.length = 0;
}

/** Menggabungkan beberapa halaman menjadi satu gambar panjang. */
export async function stitchPages(
  state: EngineState,
  pages: EnginePage[],
  direction: "vertical" | "horizontal",
): Promise<EnginePage> {
  // Batasi tiap lembar agar gabungan N halaman tak meledak (worker menolak >40MP).
  const STITCH_MAX_DIMENSION = 1600;
  const canvases = pages.map((page) => {
    const canvas = document.createElement("canvas");
    renderPageToCanvas(state, page, canvas, { maxDimension: STITCH_MAX_DIMENSION });
    return canvas;
  });

  const isVertical = direction === "vertical";
  const totalWidth = isVertical
    ? Math.max(...canvases.map((c) => c.width))
    : canvases.reduce((sum, c) => sum + c.width, 0);
  const totalHeight = isVertical
    ? canvases.reduce((sum, c) => sum + c.height, 0)
    : Math.max(...canvases.map((c) => c.height));

  const output = document.createElement("canvas");
  output.width = totalWidth;
  output.height = totalHeight;
  const ctx = output.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  let x = 0;
  let y = 0;
  for (const canvas of canvases) {
    if (isVertical) {
      const scaledHeight = Math.round(canvas.height * (totalWidth / canvas.width));
      ctx.drawImage(canvas, 0, y, totalWidth, scaledHeight);
      y += scaledHeight;
    } else {
      const scaledWidth = Math.round(canvas.width * (totalHeight / canvas.height));
      ctx.drawImage(canvas, x, 0, scaledWidth, totalHeight);
      x += scaledWidth;
    }
  }

  const blob = await blobFromCanvas(output, "image/jpeg", 0.92);
  const { image, url } = await createImageFromBlob(blob);
  return createEnginePage(image, url, `Gabungan ${pages.length} halaman`);
}

/** Membuat layout kartu ganda (dua halaman ke satu A4). */
export async function createCardPage(
  state: EngineState,
  front: EnginePage,
  back: EnginePage,
  canvas: HTMLCanvasElement,
): Promise<EnginePage> {
  const { createCardLayoutCanvas } = await import("./pdf");
  await createCardLayoutCanvas(state, front, back, canvas);
  const blob = await blobFromCanvas(canvas, "image/jpeg", 0.9);
  const { image, url } = await createImageFromBlob(blob);
  return createEnginePage(image, url, `Kartu Ganda (${front.name})`);
}
