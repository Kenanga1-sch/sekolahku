"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { renderPageToCanvas } from "@/lib/docstation/canvas";
import type { EnginePage, EngineState, OverlayStroke, DocStationTool } from "@/lib/docstation/state";
import { getOverlaysForPage } from "@/lib/docstation/state";

export interface CanvasOverlayHandle {
  /** Membersihkan seluruh goresan pada halaman aktif. */
  clearOverlays: () => void;
  /** Jumlah goresan pada halaman aktif. */
  overlayCount: () => number;
  /**
   * Memfokuskan elemen overlay secara programatik (mis. saat crop mode
   * diaktifkan dari toolbar) agar handler panah/Enter langsung bekerja.
   */
  focusCanvas: () => void;
}

interface CanvasOverlayProps {
  state: EngineState;
  page: EnginePage | undefined;
  tool: DocStationTool;
  brushSize: number;
  brushColor: string;
  highlightColor: string;
  cropMode: boolean;
  cropRegion: { x: number; y: number; width: number; height: number } | null;
  zoom: number;
  /** Kunci interaksi saat worker sedang memproses. */
  busy?: boolean;
  onCropRegionChange: (region: { x: number; y: number; width: number; height: number }) => void;
  /** Terapkan crop (dipanggil Enter pada kanvas). */
  onApplyCrop?: () => void;
  /** Batalkan crop (dipanggil Escape pada kanvas). */
  onCancelCrop?: () => void;
  onChanged: () => void;
  onError?: (message: string) => void;
}

interface Point {
  x: number;
  y: number;
}

type CropRegion = { x: number; y: number; width: number; height: number };
/** Arah handle tepi crop; "new" = gambar baru, "move" = geser seluruh region. */
type CropDragMode = "new" | "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

/** Ukuran minimum region crop (koordinat kanvas render, maks 2200 px). */
const MIN_CROP = 32;

/**
 * Penampil kanvas halaman dengan overlay interaktif (brush/eraser/highlighter
 * dan crop). Mesin mengelola state; komponen ini hanya merender + menangkap
 * interaksi pointer.
 */
export const CanvasOverlay = forwardRef<CanvasOverlayHandle, CanvasOverlayProps>(
  function CanvasOverlay(
    {
      state,
      page,
      tool,
      brushSize,
      brushColor,
      highlightColor,
      cropMode,
      cropRegion,
      zoom,
      busy,
      onCropRegionChange,
      onApplyCrop,
      onCancelCrop,
      onChanged,
      onError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const currentStrokeRef = useRef<OverlayStroke | null>(null);
    const cropDragRef = useRef<{
      start: Point;
      startRegion: CropRegion | null;
      mode: CropDragMode;
    }>({
      start: { x: 0, y: 0 },
      startRegion: null,
      mode: null,
    });

    const [displayScale, setDisplayScale] = useState(1);
    const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });

    // Render ulang kanvas utama saat halaman berubah.
    const render = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !page) return;
      const maxDimension = 2200;
      renderPageToCanvas(state, page, canvas, { maxDimension });
      setBaseSize({ width: canvas.width, height: canvas.height });

      const container = containerRef.current;
      if (container) {
        const available = container.clientWidth - 24;
        const scale = canvas.width > 0 ? Math.min(1, available / canvas.width) : 1;
        setDisplayScale(scale || 1);
      }
    }, [page, state]);

    useEffect(() => {
      render();
    }, [render, zoom, page?.rotation, page?.fineRotation, page?.contrast, page?.brightness, page?.grayscale, page?.gamma, page?.flipH, page?.flipV, page?.sourceUrl]);

    // Gambar ulang overlay (goresan) setelah kanvas utama berubah.
    useEffect(() => {
      const overlay = overlayRef.current;
      const main = canvasRef.current;
      if (!overlay || !main || !page) return;
      overlay.width = main.width;
      overlay.height = main.height;
      overlay.style.width = `${main.width}px`;
      overlay.style.height = `${main.height}px`;
      const ctx = overlay.getContext("2d")!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const strokes = getOverlaysForPage(state, page.id);
      strokes.forEach((stroke) => paintStroke(ctx, stroke, state));
    }, [state, page, baseSize]);

    // Skala tampilan mengikuti lebar container (resize).
    useEffect(() => {
      const onResize = () => render();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [render]);

    // Lebar kolom tengah bisa berubah tanpa event window (mis. perubahan layout
    // grid). ResizeObserver menghitung ulang displayScale saat container
    // mengecil/membesar agar gambar tidak terpotong atau terlalu kecil.
    useEffect(() => {
      const container = containerRef.current;
      if (!container || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => render());
      observer.observe(container);
      return () => observer.disconnect();
    }, [render]);

    useImperativeHandle(
      ref,
      () => ({
        clearOverlays: () => {
          if (!page) return;
          const overlays = getOverlaysForPage(state, page.id);
          overlays.length = 0;
          const overlay = overlayRef.current;
          if (overlay) overlay.getContext("2d")!.clearRect(0, 0, overlay.width, overlay.height);
          onChanged();
        },
        overlayCount: () => (page ? getOverlaysForPage(state, page.id).length : 0),
        focusCanvas: () => {
          overlayRef.current?.focus();
        },
      }),
      [onChanged, page, state],
    );

    const toCanvasPoint = useCallback((event: React.PointerEvent): Point => {
      const overlay = overlayRef.current!;
      const rect = overlay.getBoundingClientRect();
      const scaleX = overlay.width / rect.width;
      const scaleY = overlay.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }, []);

    const handlePointerDown = useCallback(
      (event: React.PointerEvent) => {
        if (!page || busy) return;
        const point = toCanvasPoint(event);

        if (cropMode) {
          const region = cropRegion;
          if (region && hitInside(point, region)) {
            cropDragRef.current = { start: point, startRegion: region, mode: "move" };
          } else {
            cropDragRef.current = { start: point, startRegion: null, mode: "new" };
            onCropRegionChange({ x: point.x, y: point.y, width: 0, height: 0 });
          }
          overlayRef.current?.setPointerCapture(event.pointerId);
          return;
        }

        if (tool === "brush" || tool === "eraser" || tool === "highlighter") {
          const color = tool === "highlighter" ? highlightColor : brushColor;
          currentStrokeRef.current = {
            tool,
            points: [point],
            size: brushSize,
            color,
          };
          drawingRef.current = true;
          overlayRef.current?.setPointerCapture(event.pointerId);
        }
      },
      [busy, brushColor, brushSize, cropMode, cropRegion, highlightColor, onCropRegionChange, page, toCanvasPoint, tool],
    );

    // Ditarik dari handle tepi/sudut: kunci titik awal + snapshot region agar
    // resize menghitung dari posisi awal (tanpa akumulasi geser).
    const startCropDrag = useCallback(
      (event: React.PointerEvent, mode: Exclude<CropDragMode, "new" | "move" | null>) => {
        if (!page || busy || !cropMode || !cropRegion) return;
        event.preventDefault();
        const point = toCanvasPoint(event);
        cropDragRef.current = { start: point, startRegion: cropRegion, mode };
        overlayRef.current?.setPointerCapture(event.pointerId);
      },
      [busy, cropMode, cropRegion, page, toCanvasPoint],
    );

    const handlePointerMove = useCallback(
      (event: React.PointerEvent) => {
        const point = toCanvasPoint(event);

        if (cropMode && cropDragRef.current.mode) {
          const { start, mode, startRegion } = cropDragRef.current;
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (mode === "new") {
            onCropRegionChange({
              x: Math.min(start.x, point.x),
              y: Math.min(start.y, point.y),
              width: Math.abs(dx),
              height: Math.abs(dy),
            });
          } else if (mode === "move" && startRegion) {
            // Geser dari snapshot awal → tidak ada akumulasi drift.
            onCropRegionChange({
              x: clamp(startRegion.x + dx, 0, Math.max(0, baseSize.width - startRegion.width)),
              y: clamp(startRegion.y + dy, 0, Math.max(0, baseSize.height - startRegion.height)),
              width: startRegion.width,
              height: startRegion.height,
            });
          } else if (startRegion && mode !== "move") {
            onCropRegionChange(resizeRegion(startRegion, mode, dx, dy, baseSize));
          }
          return;
        }

        // Hover saat crop mode: kursor pindah bila di dalam region.
        if (cropMode && overlayRef.current) {
          overlayRef.current.style.cursor =
            cropRegion && hitInside(point, cropRegion) ? "move" : "crosshair";
        }

        if (!drawingRef.current || !currentStrokeRef.current) return;
        const stroke = currentStrokeRef.current;
        stroke.points.push(point);
        // Gambar segmen terakhir secara langsung agar terasa responsif.
        const overlay = overlayRef.current!;
        const ctx = overlay.getContext("2d")!;
        paintStroke(ctx, stroke, state);
      },
      [baseSize, cropMode, cropRegion, onCropRegionChange, state, toCanvasPoint],
    );

    const handlePointerUp = useCallback(
      (event: React.PointerEvent) => {
        if (overlayRef.current?.hasPointerCapture?.(event.pointerId)) {
          overlayRef.current.releasePointerCapture(event.pointerId);
        }
        if (drawingRef.current && currentStrokeRef.current) {
          const strokes = getOverlaysForPage(state, page!.id);
          strokes.push(currentStrokeRef.current);
          currentStrokeRef.current = null;
          drawingRef.current = false;
          onChanged();
        }
        cropDragRef.current = { start: { x: 0, y: 0 }, startRegion: null, mode: null };
      },
      [onChanged, page, state],
    );

    // Keyboard crop: panah memindahkan, Shift+panah mengubah ukuran (lebar
    // mengikuti panah kanan/kiri, tinggi mengikuti bawah/atas), Enter
    // menerapkan, Escape membatalkan. Region dibuat tengah bila belum ada.
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (!page || busy || !cropMode) return;
        if (event.key === "Escape") {
          onCancelCrop?.();
          return;
        }
        const step = event.shiftKey ? 20 : 5;
        let region = cropRegion;
        if (!region) {
          const w = Math.round(baseSize.width * 0.5);
          const h = Math.round(baseSize.height * 0.5);
          region = {
            x: Math.round((baseSize.width - w) / 2),
            y: Math.round((baseSize.height - h) / 2),
            width: w,
            height: h,
          };
        }
        let next = region;
        switch (event.key) {
          case "ArrowLeft":
            next = event.shiftKey
              ? { ...region, width: Math.max(MIN_CROP, region.width - step) }
              : { ...region, x: Math.max(0, region.x - step) };
            break;
          case "ArrowRight":
            next = event.shiftKey
              ? { ...region, width: Math.min(baseSize.width - region.x, region.width + step) }
              : { ...region, x: Math.min(baseSize.width - region.width, region.x + step) };
            break;
          case "ArrowUp":
            next = event.shiftKey
              ? { ...region, height: Math.max(MIN_CROP, region.height - step) }
              : { ...region, y: Math.max(0, region.y - step) };
            break;
          case "ArrowDown":
            next = event.shiftKey
              ? { ...region, height: Math.min(baseSize.height - region.y, region.height + step) }
              : { ...region, y: Math.min(baseSize.height - region.height, region.y + step) };
            break;
          case "Enter":
            // Enter pertama membuat area tengah; Enter berikutnya menerapkan.
            if (!cropRegion) {
              onCropRegionChange(region);
              return;
            }
            if (region.width >= 4 && region.height >= 4) {
              onApplyCrop?.();
            }
            return;
          default:
            return;
        }
        event.preventDefault();
        onCropRegionChange(next);
      },
      [baseSize, busy, cropMode, cropRegion, onApplyCrop, onCancelCrop, onCropRegionChange, page],
    );

    // Cursor mengikuti tool.
    const cursor =
      tool === "brush" || tool === "eraser" || tool === "highlighter"
        ? "crosshair"
        : cropMode
          ? "crosshair"
          : "default";

    if (!page) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          Pilih halaman untuk melihat pratinjau.
        </div>
      );
    }

    const crop = cropRegion;

    return (
      <div
        ref={containerRef}
        className="relative flex h-full min-h-0 flex-1 items-start justify-center overflow-auto rounded-2xl border border-border bg-muted/30 p-3"
      >
        <div
          className="relative shadow-lg"
          style={{
            // Ukuran tata letak ikut zoom sehingga area scroll membesar dan
            // gambar tak terpotong (transform scale saja tidak mempengaruhi
            // ukuran scroll parent).
            width: baseSize.width ? baseSize.width * displayScale * zoom : undefined,
            height: baseSize.height ? baseSize.height * displayScale * zoom : undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            aria-label={`Pratinjau halaman ${page.name}`}
            role="img"
            className="block h-auto w-full max-w-none rounded-sm bg-white"
            style={{ imageRendering: "auto" }}
          />
          <canvas
            ref={overlayRef}
            tabIndex={cropMode && !busy ? 0 : -1}
            role="application"
            aria-label={
              cropMode
                ? "Area crop — seret garis tepi/sudut untuk mengatur, panah memindahkan, Shift+panah mengubah ukuran, Enter menerapkan, Escape membatalkan"
                : "Kanvas anotasi"
            }
            className="absolute left-0 top-0 h-full w-full touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            style={{ cursor, pointerEvents: busy ? "none" : undefined }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
          {cropMode && !crop && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white shadow-md">
              Seret untuk membuat area · Enter untuk area tengah
            </div>
          )}
          {cropMode && crop && baseSize.width > 0 && (
            <div
              className="pointer-events-none absolute border-2 border-primary bg-primary/10"
              style={{
                left: `${(crop.x / baseSize.width) * 100}%`,
                top: `${(crop.y / baseSize.height) * 100}%`,
                width: `${(crop.width / baseSize.width) * 100}%`,
                height: `${(crop.height / baseSize.height) * 100}%`,
                // Redupkan area di luar crop agar batas terasa tegas.
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
            >
              {/* Garis tepi yang bisa ditarik (area lebar agar mudah ditangkap). */}
              <div
                className="pointer-events-auto absolute -top-2 left-5 right-5 h-3 cursor-ns-resize"
                onPointerDown={(e) => startCropDrag(e, "n")}
              />
              <div
                className="pointer-events-auto absolute -bottom-2 left-5 right-5 h-3 cursor-ns-resize"
                onPointerDown={(e) => startCropDrag(e, "s")}
              />
              <div
                className="pointer-events-auto absolute -left-2 top-5 bottom-5 w-3 cursor-ew-resize"
                onPointerDown={(e) => startCropDrag(e, "w")}
              />
              <div
                className="pointer-events-auto absolute -right-2 top-5 bottom-5 w-3 cursor-ew-resize"
                onPointerDown={(e) => startCropDrag(e, "e")}
              />
              {/* Knot sudut sebagai pegangan visual. */}
              <div
                className="pointer-events-auto absolute -left-[7px] -top-[7px] h-3.5 w-3.5 cursor-nwse-resize rounded-[2px] border-2 border-primary bg-background shadow"
                onPointerDown={(e) => startCropDrag(e, "nw")}
              />
              <div
                className="pointer-events-auto absolute -right-[7px] -top-[7px] h-3.5 w-3.5 cursor-nesw-resize rounded-[2px] border-2 border-primary bg-background shadow"
                onPointerDown={(e) => startCropDrag(e, "ne")}
              />
              <div
                className="pointer-events-auto absolute -bottom-[7px] -left-[7px] h-3.5 w-3.5 cursor-nesw-resize rounded-[2px] border-2 border-primary bg-background shadow"
                onPointerDown={(e) => startCropDrag(e, "sw")}
              />
              <div
                className="pointer-events-auto absolute -bottom-[7px] -right-[7px] h-3.5 w-3.5 cursor-nwse-resize rounded-[2px] border-2 border-primary bg-background shadow"
                onPointerDown={(e) => startCropDrag(e, "se")}
              />
              {/* Ukuran hasil crop pada resolusi asli halaman. */}
              <span
                title="Perkiraan ukuran hasil crop (piksel resolusi asli)"
                className="pointer-events-none absolute -bottom-6 right-0 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow"
              >
                {Math.round((crop.width * (page.image.naturalWidth || baseSize.width)) / baseSize.width)}{" "}
                ×{" "}
                {Math.round((crop.height * (page.image.naturalHeight || baseSize.height)) / baseSize.height)} px
              </span>
            </div>
          )}
        </div>
        {onError ? null : null}
      </div>
    );
  },
);

function hitInside(point: Point, region: { x: number; y: number; width: number; height: number }) {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Hitung ulang region dari snapshot awal + delta pointer untuk mode resize
 * tepi/sudut. Sisi berlawanan tetap sebagai jangkar; hasil di-clamp ke
 * [MIN_CROP, batas kanvas] agar region tidak terbalik atau keluar halaman.
 */
function resizeRegion(
  start: CropRegion,
  mode: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): CropRegion {
  let { x, y, width, height } = start;
  const right = x + width;
  const bottom = y + height;
  if (mode.includes("e")) width = clamp(width + dx, MIN_CROP, Math.max(MIN_CROP, bounds.width - x));
  if (mode.includes("s")) height = clamp(height + dy, MIN_CROP, Math.max(MIN_CROP, bounds.height - y));
  if (mode.includes("w")) {
    const nx = clamp(x + dx, 0, right - MIN_CROP);
    x = nx;
    width = right - nx;
  }
  if (mode.includes("n")) {
    const ny = clamp(y + dy, 0, bottom - MIN_CROP);
    y = ny;
    height = bottom - ny;
  }
  return { x, y, width, height };
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: OverlayStroke, state: EngineState) {
  const points = stroke.points;
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = stroke.size || 20;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  } else if (stroke.tool === "highlighter") {
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = hexToRgba(stroke.color || state.highlightColor || "#ffff00", 0.45);
    ctx.lineWidth = Math.max(stroke.size || 20, 30);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexToRgba(stroke.color || state.brushColor || "#2563eb", 0.85);
    ctx.lineWidth = stroke.size || 20;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
