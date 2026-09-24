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
  onCropRegionChange: (region: { x: number; y: number; width: number; height: number }) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
}

interface Point {
  x: number;
  y: number;
}

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
      onCropRegionChange,
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
    const cropDragRef = useRef<{ start: Point; mode: "new" | "move" | null }>({
      start: { x: 0, y: 0 },
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
        if (!page) return;
        const point = toCanvasPoint(event);

        if (cropMode) {
          const region = cropRegion;
          if (region && hitInside(point, region)) {
            cropDragRef.current = { start: point, mode: "move" };
          } else {
            cropDragRef.current = { start: point, mode: "new" };
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
      [brushColor, brushSize, cropMode, cropRegion, highlightColor, onCropRegionChange, page, toCanvasPoint, tool],
    );

    const handlePointerMove = useCallback(
      (event: React.PointerEvent) => {
        const point = toCanvasPoint(event);

        if (cropMode && cropDragRef.current.mode) {
          const { start, mode } = cropDragRef.current;
          if (mode === "new") {
            onCropRegionChange({
              x: Math.min(start.x, point.x),
              y: Math.min(start.y, point.y),
              width: Math.abs(point.x - start.x),
              height: Math.abs(point.y - start.y),
            });
          } else if (mode === "move" && cropRegion) {
            const dx = point.x - start.x;
            const dy = point.y - start.y;
            cropDragRef.current.start = point;
            onCropRegionChange({
              x: cropRegion.x + dx,
              y: cropRegion.y + dy,
              width: cropRegion.width,
              height: cropRegion.height,
            });
          }
          return;
        }

        if (!drawingRef.current || !currentStrokeRef.current) return;
        const stroke = currentStrokeRef.current;
        stroke.points.push(point);
        // Gambar segmen terakhir secara langsung agar terasa responsif.
        const overlay = overlayRef.current!;
        const ctx = overlay.getContext("2d")!;
        paintStroke(ctx, stroke, state);
      },
      [cropMode, cropRegion, onCropRegionChange, state, toCanvasPoint],
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
        cropDragRef.current.mode = null;
      },
      [onChanged, page, state],
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
        <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          Pilih halaman untuk melihat pratinjau.
        </div>
      );
    }

    const crop = cropRegion;

    return (
      <div
        ref={containerRef}
        className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-auto rounded-2xl border border-border bg-muted/30 p-3"
      >
        <div
          className="relative shadow-lg"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            width: baseSize.width ? baseSize.width * displayScale : undefined,
            height: baseSize.height ? baseSize.height * displayScale : undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            className="block h-auto w-full max-w-full rounded-sm bg-white"
            style={{ imageRendering: "auto" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute left-0 top-0 h-full w-full touch-none"
            style={{ cursor }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {cropMode && crop && (
            <div
              className="pointer-events-none absolute border-2 border-primary bg-primary/10"
              style={{
                left: `${(crop.x / baseSize.width) * 100}%`,
                top: `${(crop.y / baseSize.height) * 100}%`,
                width: `${(crop.width / baseSize.width) * 100}%`,
                height: `${(crop.height / baseSize.height) * 100}%`,
              }}
            />
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
