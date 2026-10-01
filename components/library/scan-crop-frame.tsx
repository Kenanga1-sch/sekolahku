// Bingkai crop dengan 8 titik handle untuk dialog Pindai Sampul.
//
// Berbeda dengan react-easy-crop (bingkai terkunci rasio + zoom/geser gambar),
// komponen ini menampilkan bingkai yang LANGKAH DEFAULT-nya sudah membingkai
// seluruh gambar, lengkap dengan garis rule-of-thirds, dan bisa diatur
// langsung lewat 8 handle: 4 sudut (resize diagonal) + 4 tepi (resize satu
// sumbu). Seret di luar bingkai membuat bingkai baru; seret di dalam = geser.
//
// Koordinat internal: pecahan 0..1 relatif terhadap kotak gambar (robust
// terhadap resize container); luaran dikonversi ke piksel asli gambar.

"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { forwardRef } from "react";

/** Luas crop dalam piksel asli gambar. */
export interface NaturalArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Frame dalam pecahan 0..1 relatif kotak gambar. */
export interface CropFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Ukuran minimum frame (piksel layar). */
export const MIN_FRAME_PX = 24;

/** Frame default: seluruh gambar. */
export const FULL_FRAME: CropFrame = { x: 0, y: 0, w: 1, h: 1 };

/** Konversi frame pecahan → piksel asli gambar. */
export function frameToArea(frame: CropFrame, natural: { w: number; h: number }): NaturalArea {
  return {
    x: Math.round(frame.x * natural.w),
    y: Math.round(frame.y * natural.h),
    width: Math.max(1, Math.round(frame.w * natural.w)),
    height: Math.max(1, Math.round(frame.h * natural.h)),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Hitung ulang rect piksel dari snapshot awal + delta pointer untuk mode
 * resize tepi/sudut (sisi berlawanan jadi jangkar). Diclamp ke bounds dan
 * ukuran minimum agar rect tidak terbalik/keluar area.
 */
export function resizePxRect(
  start: PxRect,
  mode: CropHandle,
  dx: number,
  dy: number,
  bounds: PxRect,
): PxRect {
  let { x, y, w, h } = start;
  const right = x + w;
  const bottom = y + h;
  const minW = Math.min(MIN_FRAME_PX, bounds.w);
  const minH = Math.min(MIN_FRAME_PX, bounds.h);
  if (mode.includes("e")) w = clamp(w + dx, minW, Math.max(minW, bounds.x + bounds.w - x));
  if (mode.includes("s")) h = clamp(h + dy, minH, Math.max(minH, bounds.y + bounds.h - y));
  if (mode.includes("w")) {
    const nx = clamp(x + dx, bounds.x, right - minW);
    x = nx;
    w = right - nx;
  }
  if (mode.includes("n")) {
    const ny = clamp(y + dy, bounds.y, bottom - minH);
    y = ny;
    h = bottom - ny;
  }
  return { x, y, w, h };
}

/** Rect piksel → frame pecahan (relatif bounds). */
export function pxRectToFrame(r: PxRect, bounds: PxRect): CropFrame {
  return {
    x: (r.x - bounds.x) / bounds.w,
    y: (r.y - bounds.y) / bounds.h,
    w: r.w / bounds.w,
    h: r.h / bounds.h,
  };
}

export interface ScanCropFrameHandle {
  /** Kembalikan bingkai ke seluruh gambar. */
  reset: () => void;
}

export interface ScanCropFrameProps {
  imageSrc: string;
  /** Dilaporkan pada setiap perubahan bingkai (piksel asli gambar). */
  onAreaChange: (area: NaturalArea) => void;
  /** Sembunyikan garis rule-of-thirds (default: tampil). */
  hideGrid?: boolean;
}

type DragMode = CropHandle | "move" | "new";

const HANDLES: { dir: CropHandle; className: string }[] = [
  { dir: "nw", className: "-left-[7px] -top-[7px] cursor-nwse-resize" },
  { dir: "ne", className: "-right-[7px] -top-[7px] cursor-nesw-resize" },
  { dir: "sw", className: "-bottom-[7px] -left-[7px] cursor-nesw-resize" },
  { dir: "se", className: "-bottom-[7px] -right-[7px] cursor-nwse-resize" },
];

const EDGE_HANDLES: { dir: CropHandle; className: string }[] = [
  { dir: "n", className: "-top-2 left-5 right-5 h-3 cursor-ns-resize" },
  { dir: "s", className: "-bottom-2 left-5 right-5 h-3 cursor-ns-resize" },
  { dir: "w", className: "-left-2 bottom-5 top-5 w-3 cursor-ew-resize" },
  { dir: "e", className: "-right-2 bottom-5 top-5 w-3 cursor-ew-resize" },
];

export const ScanCropFrame = forwardRef<ScanCropFrameHandle, ScanCropFrameProps>(
  function ScanCropFrame({ imageSrc, onAreaChange, hideGrid }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<{ start: { x: number; y: number }; startFrame: CropFrame; mode: DragMode } | null>(null);

    const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [frame, setFrame] = useState<CropFrame>(FULL_FRAME);

    // Callback lewat ref agar perubahan identitas fungsi induk tidak
    // memicu loop render.
    const cbRef = useRef(onAreaChange);
    useEffect(() => {
      cbRef.current = onAreaChange;
    });

    // Frame default & pengukuran ulang menangani sendiri oleh induk lewat
    // `key={imageSrc}` — setiap gambar baru membuat instance baru dengan
    // frame penuh (tanpa effect reset di sini).

    useImperativeHandle(ref, () => ({ reset: () => setFrame(FULL_FRAME) }), []);

    // Ukur kotak gambar (object-contain) relatif container — saat load &
    // saat container berubah ukuran.
    const measure = useCallback(() => {
      const img = imgRef.current;
      const cont = containerRef.current;
      if (!img || !cont || !img.naturalWidth) return;
      const cr = cont.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setBox({ x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height });
    }, []);

    useEffect(() => {
      const cont = containerRef.current;
      if (!cont || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => measure());
      ro.observe(cont);
      return () => ro.disconnect();
    }, [measure]);

    // Lapor area ke induk setiap frame/natural/gambar berubah (imageSrc ikut
    // agar scan ulang yang frame-nya tak bergerak tetap memancarkan area baru).
    useEffect(() => {
      if (natural.w > 0 && natural.h > 0) {
        cbRef.current(frameToArea(frame, natural));
      }
    }, [frame, natural, imageSrc]);

    const framePx = (): PxRect | null => {
      if (!box) return null;
      return { x: box.x + frame.x * box.w, y: box.y + frame.y * box.h, w: frame.w * box.w, h: frame.h * box.h };
    };

    const handlePointerDown = (event: React.PointerEvent) => {
      if (!box) return;
      const cont = containerRef.current!;
      const cr = cont.getBoundingClientRect();
      const cx = event.clientX - cr.left;
      const cy = event.clientY - cr.top;
      const target = event.target as HTMLElement;
      const handle = target.dataset?.handle as CropHandle | undefined;
      const fp = framePx();
      if (!fp) return;

      if (handle) {
        dragRef.current = { start: { x: cx, y: cy }, startFrame: frame, mode: handle };
      } else if (
        cx >= fp.x && cx <= fp.x + fp.w && cy >= fp.y && cy <= fp.y + fp.h
      ) {
        dragRef.current = { start: { x: cx, y: cy }, startFrame: frame, mode: "move" };
      } else {
        // Klik di luar bingkai (masih dalam area gambar) → gambar baru.
        if (cx < box.x || cx > box.x + box.w || cy < box.y || cy > box.y + box.h) return;
        dragRef.current = {
          start: { x: clamp(cx, box.x, box.x + box.w), y: clamp(cy, box.y, box.y + box.h) },
          startFrame: frame,
          mode: "new",
        };
        setFrame(pxRectToFrame({ x: cx, y: cy, w: 0, h: 0 }, box));
      }
      cont.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event: React.PointerEvent) => {
      const drag = dragRef.current;
      const cont = containerRef.current;
      if (!cont || !box) return;
      const cr = cont.getBoundingClientRect();
      const cx = event.clientX - cr.left;
      const cy = event.clientY - cr.top;

      if (drag) {
        const dx = cx - drag.start.x;
        const dy = cy - drag.start.y;
        const bounds: PxRect = box;

        if (drag.mode === "new") {
          const x = clamp(Math.min(drag.start.x, cx), box.x, box.x + box.w);
          const y = clamp(Math.min(drag.start.y, cy), box.y, box.y + box.h);
          const w = Math.min(Math.abs(cx - drag.start.x), box.x + box.w - x);
          const h = Math.min(Math.abs(cy - drag.start.y), box.y + box.h - y);
          setFrame(pxRectToFrame({ x, y, w: Math.max(w, MIN_FRAME_PX), h: Math.max(h, MIN_FRAME_PX) }, box));
          return;
        }

        const startPx: PxRect = {
          x: box.x + drag.startFrame.x * box.w,
          y: box.y + drag.startFrame.y * box.h,
          w: drag.startFrame.w * box.w,
          h: drag.startFrame.h * box.h,
        };

        if (drag.mode === "move") {
          const nx = clamp(startPx.x + dx, bounds.x, bounds.x + bounds.w - startPx.w);
          const ny = clamp(startPx.y + dy, bounds.y, bounds.y + bounds.h - startPx.h);
          setFrame(pxRectToFrame({ x: nx, y: ny, w: startPx.w, h: startPx.h }, box));
          return;
        }

        setFrame(pxRectToFrame(resizePxRect(startPx, drag.mode, dx, dy, bounds), box));
        return;
      }

      // Hover tanpa drag: kunci kursor agar terasa bisa digeser.
      const fp = framePx();
      cont.style.cursor =
        fp && cx >= fp.x && cx <= fp.x + fp.w && cy >= fp.y && cy <= fp.y + fp.h
          ? "move"
          : "crosshair";
    };

    const handlePointerUp = (event: React.PointerEvent) => {
      dragRef.current = null;
      const cont = containerRef.current;
      if (cont?.hasPointerCapture?.(event.pointerId)) {
        cont.releasePointerCapture(event.pointerId);
      }
    };

    const fp = framePx();

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full touch-none select-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: "crosshair" }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Hasil scan"
          draggable={false}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full select-none"
          onLoad={measure}
        />
        {box && fp && (
          <div
            className="pointer-events-none absolute border-2 border-primary"
            style={{
              left: `${fp.x}px`,
              top: `${fp.y}px`,
              width: `${fp.w}px`,
              height: `${fp.h}px`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            {!hideGrid && (
              <>
                <span className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                <span className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                <span className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
                <span className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
              </>
            )}
            {EDGE_HANDLES.map((h) => (
              <div
                key={h.dir}
                data-handle={h.dir}
                className={`pointer-events-auto absolute ${h.className}`}
              />
            ))}
            {HANDLES.map((h) => (
              <div
                key={h.dir}
                data-handle={h.dir}
                className={`pointer-events-auto absolute h-3.5 w-3.5 rounded-[2px] border-2 border-primary bg-background shadow ${h.className}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
