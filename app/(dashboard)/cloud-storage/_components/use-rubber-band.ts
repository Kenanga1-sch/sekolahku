"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Options {
  /** Aktifkan rubber-band hanya bila true (mis. tidak sedang mencari). */
  enabled: boolean;
  /** Dipanggil dengan himpunan id yang bersinggungan dengan kotak seleksi. */
  onSelect: (ids: string[]) => void;
  /** Elemen yang menampung item yang bisa diseleksi. */
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * useRubberBandSelection — seleksi area (drag kotak di ruang kosong).
 *
 * Item yang dapat dipilih harus memiliki atribut `data-select-id` dan berada
 * di dalam container. Drag yang dimulai di atas item (atau kontrol interaktif)
 * diabaikan agar tidak mengganggu klik/aksi normal.
 */
export function useRubberBandSelection({ enabled, onSelect, containerRef }: Options) {
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Abaikan bila dimulai dari item/kontrol interaktif.
      if (target.closest("[data-select-id]")) return;
      if (target.closest("button, a, input, select, textarea, [role='menuitem']")) return;

      const container = containerRef.current;
      if (!container) return;
      const cbox = container.getBoundingClientRect();
      startRef.current = { x: e.clientX - cbox.left, y: e.clientY - cbox.top };
      setRect({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 });
    },
    [enabled, containerRef],
  );

  useEffect(() => {
    if (!rect) return;

    const handleMove = (e: MouseEvent) => {
      const container = containerRef.current;
      const start = startRef.current;
      if (!container || !start) return;
      const cbox = container.getBoundingClientRect();
      const cx = e.clientX - cbox.left;
      const cy = e.clientY - cbox.top;
      const next: Rect = {
        x: Math.min(start.x, cx),
        y: Math.min(start.y, cy),
        w: Math.abs(cx - start.x),
        h: Math.abs(cy - start.y),
      };
      setRect(next);

      // Hitung item yang bersinggungan.
      const items = container.querySelectorAll<HTMLElement>("[data-select-id]");
      const hits: string[] = [];
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        const rel = {
          x: r.left - cbox.left,
          y: r.top - cbox.top,
          w: r.width,
          h: r.height,
        };
        const intersects =
          rel.x < next.x + next.w && rel.x + rel.w > next.x && rel.y < next.y + next.h && rel.y + rel.h > next.y;
        if (intersects) {
          const id = el.getAttribute("data-select-id");
          if (id) hits.push(id);
        }
      });
      onSelect(hits);
    };

    const handleUp = () => {
      startRef.current = null;
      setRect(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [rect, containerRef, onSelect]);

  return { rect, onMouseDown, active: rect !== null };
}
