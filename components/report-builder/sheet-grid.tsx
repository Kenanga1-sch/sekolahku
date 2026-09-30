"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Plus, Trash2, Merge, SplitSquareHorizontal, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter, Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cellKey,
  absoluteColWidths,
  DEFAULT_COL_WIDTH_PX,
  isRowHidden,
  isColHidden,
  sheetRowCount,
  rowHeightAt,
  colWidthPx,
  MIN_COL_WIDTH_PX,
  MAX_COL_WIDTH_PX,
  createShape,
  createImage,
  type ReportSheet,
  type SheetCell,
  type ReportShape,
  type ReportShapeType,
  type ReportImage,
} from "@/lib/config/report-sheet";
import { parseCellValue } from "@/lib/report-parser";
import { detectRepeatRows, evaluateSheet } from "@/lib/report-engine-v3";
import { rowHeightPt, type PageBreakPlan } from "@/lib/report-paginate";
import { blockToTsv, tsvToMatrix, extrapolateSeries, extractBlock, extractVisualStyle, normalizeBounds, adjustFormulaRefs, conditionalStyleFor, rebaseBlockFormula, insertRows, deleteRows, insertColumns, deleteColumns, fillSpans, type CellBlock, type Bounds } from "@/lib/report-sheet-ops";
import { browserFontFamily } from "@/lib/report-fonts";

export { browserFontFamily };

export interface SheetGridHandle {
  mergeSelection: () => void;
  unmergeSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  insertRowAbove: () => void;
  insertRowBelow: () => void;
  /** Hapus baris paling bawah yang berisi data. */
  deleteLastRow: () => void;
  insertColLeft: () => void;
  insertColRight: () => void;
  /** Tambah shape baru di tengah area yang terlihat. */
  addShape: (type: ReportShapeType) => void;
  /** Tambah gambar mengambang dari URL. */
  addImage: (src: string) => void;
  /** Hapus shape/gambar terpilih. */
  deleteShape: () => void;
}

export interface SheetGridProps {
  sheet: ReportSheet;
  onChange: (next: ReportSheet) => void;
  selected: { r: number; c: number };
  onSelect: (addr: { r: number; c: number }) => void;
  minRows?: number;
  dataset?: Record<string, any>[];
  global?: Record<string, any>;
  /** Rencana batas halaman; bila ada, grid dirender dengan skala kertas. */
  pageBreakPlan?: PageBreakPlan;
  /** Tampilkan garis batas halaman. */
  showPageBreaks?: boolean;
  /** Callback toggle tampil/sembunyi batas halaman. */
  onTogglePageBreaks?: () => void;
  /** Zoom manual (1 = 100%). `null` = Fit to Width. */
  zoom?: number | null;
  /** Dipanggil saat skala efektif berubah (untuk indikator di ribbon). */
  onScaleChange?: (scale: number) => void;
  /** Dipanggil saat kemampuan merge/split seleksi berubah. */
  onMergeStateChange?: (state: { canMerge: boolean; isMerged: boolean }) => void;
  onSelectionChange?: (bounds: Bounds) => void;
  /** Dipanggil saat shape terpilih berubah (untuk panel properti di ribbon). */
  onShapeSelectChange?: (id: string | null) => void;
  /** Sembunyikan toolbar internal (dipakai saat kontrol dipindah ke ribbon). */
  hideToolbar?: boolean;
  /** Dipanggil untuk mengganti lebar kolom (px absolut) — bisa banyak kolom serentak. */
  onResizeColumn?: (cols: number[], widthPx: number) => void;
  /** Dipanggil untuk mengganti tinggi baris (pt) — bisa banyak baris serentak. */
  onResizeRow?: (rows: number[], heightPt: number) => void;
  /** Nonaktifkan interaksi (mis. saat preview). */
  readOnly?: boolean;
  /** Jumlah kolom terkiri yang dibekukan (sticky saat scroll horizontal). */
  freezeCols?: number;
  /** Jumlah baris teratas yang dibekukan (header sudah sticky; ini untuk data). */
  freezeRows?: number;
  /** Saat format painter aktif, klik sel memanggil callback ini alih-alih seleksi biasa. */
  onPaintFormat?: (r: number, c: number) => void;
  /** Daftar lembar untuk bar tab di bawah (opsional). */
  sheetTabs?: { id: string; name: string }[];
  activeSheetIdx?: number;
  onSelectSheet?: (idx: number) => void;
  onAddSheet?: () => void;
  onRemoveSheet?: (idx: number) => void;
  onRenameSheet?: (idx: number, name: string) => void;
}

interface SelectionRect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

function colLetters(c: number): string {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Tentukan border satu sisi: per-sisi eksplisit menimpa preset `border`. */
function sideBorder(cell: SheetCell | undefined, side: "top" | "bottom" | "left" | "right", key: "borderTop" | "borderBottom" | "borderLeft" | "borderRight"): boolean {
  if (!cell) return false;
  const perSide = cell[key];
  if (perSide !== undefined) return perSide;
  if (!cell.border || cell.border === "none") return false;
  if (cell.border === "all") return true;
  // box: semua sisi
  void side;
  return true;
}

/** Salin sel tanpa field `value` (untuk mewarisi gaya saat fill/paste). */
function styleOf(cell: SheetCell | undefined): Omit<SheetCell, "value"> | undefined {
  return extractVisualStyle(cell);
}

/** Tulis sel ke map tanpa menyisakan entri kosong, sekaligus normalisasi. */
function assignCell(target: Record<string, SheetCell>, key: string, merged: SheetCell): void {
  const clean: SheetCell = { ...merged };
  if (clean.value === "" || clean.value === undefined) delete clean.value;
  if (clean.colSpan === 1) delete clean.colSpan;
  if (clean.rowSpan === 1) delete clean.rowSpan;
  if (clean.repeatZone === false) delete clean.repeatZone;
  if (Object.keys(clean).length === 0) delete target[key];
  else target[key] = clean;
}

export const SheetGrid = forwardRef<SheetGridHandle, SheetGridProps>(function SheetGrid({
  sheet,
  onChange,
  selected,
  onSelect,
  minRows = 12,
  dataset = [],
  global = {},
  pageBreakPlan,
  showPageBreaks = true,
  onTogglePageBreaks,
  zoom = null,
  onScaleChange,
  onMergeStateChange,
  onSelectionChange,
  onShapeSelectChange,
  hideToolbar = false,
  onResizeColumn,
  onResizeRow,
  readOnly = false,
  freezeCols = 0,
  freezeRows = 0,
  onPaintFormat,
  sheetTabs,
  activeSheetIdx = 0,
  onSelectSheet,
  onAddSheet,
  onRemoveSheet,
  onRenameSheet,
}: SheetGridProps, ref) {
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rect, setRect] = useState<SelectionRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [extraRows, setExtraRows] = useState(0);
  /** Mode seret header kolom/baris. */
  const [headerDrag, setHeaderDrag] = useState<"col" | "row" | null>(null);
  /** Posisi fill-handle: sel tujuan saat menyeret tuas isi otomatis. */
  const [fillTarget, setFillTarget] = useState<{ r: number; c: number } | null>(null);
  const [fillActive, setFillActive] = useState(false);
  /** Menu konteks klik-kanan. */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  /** Shape terpilih (untuk resize/geser & panel properti). */
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  /** Indeks lembar yang sedang diganti namanya di bar tab bawah. */
  const [renamingSheet, setRenamingSheet] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const internalClipboard = useRef<CellBlock | null>(null);
  const pasteSpecialMode = useRef<"all" | "values" | "formats" | "formatsWithValues" | null>(null);
  const applyFillRef = useRef<((target: { r: number; c: number }) => void) | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  const repeatRows = useMemo(() => new Set(detectRepeatRows(sheet)), [sheet]);

  useEffect(() => {
    setEditing(null);
    setRect(null);
    setDragging(false);
    setHeaderDrag(null);
    setFillTarget(null);
    setFillActive(false);
    setCtxMenu(null);
    setExtraRows(0);
  }, [sheet.id]);
  /**
   * Lebar kolom absolut (px), apa adanya. Renderer tidak meregangkan kolom —
   * apa yang didesain = apa yang tampil & tercetak (perilaku Excel/LibreOffice).
   */
  const widths = useMemo(() => absoluteColWidths(sheet), [sheet]);
  const totalWidthPx = useMemo(() => widths.reduce((a, b) => a + b, 0), [widths]);
  const rowCount = Math.max(sheetRowCount(sheet) + 4 + extraRows, minRows + extraRows);

  // Ukur lebar area kerja dari kontainer luar (bukan area scroll yang bisa
  // menggembung), agar fit-to-width stabil dan tidak menghasilkan skala raksasa.
  useEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? node.clientWidth;
      setAvailableWidth(w);
    });
    observer.observe(node);
    setAvailableWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  /**
   * Skala kertas. `contentWidthPt` = lebar area konten kertas (pt). Grid
   * memakai skala efektif = zoom manual, atau fit-to-width bila zoom null.
   * Geometri (lebar, margin, tinggi baris) ikut skala; ukuran teks tetap agar
   * mudah dibaca.
   *
   * Fit dibatasi 40%–125%: cukup untuk mengisi lebar area kerja tanpa membuat
   * kertas terlihat raksasa (mis. 285%) pada layar lebar.
   */
  const fitScale = useMemo(() => {
    if (!pageBreakPlan || availableWidth <= 0) return 1;
    const usable = Math.max(120, availableWidth - 32); // sisakan padding kontainer
    const raw = usable / pageBreakPlan.contentWidthPt;
    return Math.min(1.25, Math.max(0.4, raw));
  }, [pageBreakPlan, availableWidth]);

  const scale = zoom ?? fitScale;

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  const contentWidthPx = pageBreakPlan ? Math.round(pageBreakPlan.contentWidthPt * scale) : undefined;
  /** Lebar total kolom dalam px efektif (setelah skala kertas). */
  const totalWidthScaledPx = totalWidthPx * scale;

  /**
   * Offset kiri (px) untuk kolom yang dibekukan. Dihitung akumulatif dari
   * lebar kolom absolut × skala kertas. Dipakai `sticky left-[..]`.
   */
  const frozenLeftPx = useMemo(() => {
    const map = new Map<number, number>();
    let acc = 0;
    for (let c = 0; c < Math.min(freezeCols, sheet.cols); c++) {
      map.set(c, acc);
      acc += (widths[c] ?? 0) * scale;
    }
    return map;
  }, [freezeCols, sheet.cols, widths, scale]);
  const marginPx = useMemo(() => {
    if (!pageBreakPlan) return null;
    return {
      top: Math.round((pageBreakPlan.marginTopPt ?? 0) * scale),
      right: Math.round((pageBreakPlan.marginRightPt ?? 0) * scale),
      bottom: Math.round((pageBreakPlan.marginBottomPt ?? 0) * scale),
      left: Math.round((pageBreakPlan.marginLeftPt ?? 0) * scale),
    };
  }, [pageBreakPlan, scale]);

  const breaksActive = showPageBreaks && !!pageBreakPlan;

  /** Cegah garis batas digambar pada baris tambahan kosong di bawah data. */
  const breakRows = useMemo(() => {
    if (!breaksActive || !pageBreakPlan) return new Map<number, number>();
    const m = new Map<number, number>();
    for (const r of pageBreakPlan.breakAfterInputRow) m.set(r, (pageBreakPlan.pageOfInputRow.get(r) ?? 1) + 1);
    return m;
  }, [breaksActive, pageBreakPlan]);

  const evaluated = useMemo(() => {
    try {
      return evaluateSheet(sheet, { dataset, global }).cellMap;
    } catch {
      return new Map<string, { text: string }>();
    }
  }, [sheet, dataset, global]);

  const covered = useMemo(() => {
    const set = new Set<string>();
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const [r, c] = key.split(",").map(Number);
      const cs = cell.colSpan ?? 1;
      const rs = cell.rowSpan ?? 1;
      for (let rr = r; rr < r + rs; rr++) {
        for (let cc = c; cc < c + cs; cc++) {
          if (rr === r && cc === c) continue;
          set.add(cellKey(rr, cc));
        }
      }
    }
    return set;
  }, [sheet]);

  /** Tinggi baris efektif saat ini (pt), termasuk eksplisit & hasil hitung. */
  const currentRowHeightPt = useCallback(
    (r: number): number => {
      const explicit = rowHeightAt(sheet, r);
      if (explicit) return explicit;
      const typo = pageBreakPlan?.typography ?? undefined;
      const font = typo?.baseFontSize ?? 11;
      const wrapCtx = pageBreakPlan ? { contentWidthPt: pageBreakPlan.contentWidthPt, typo } : undefined;
      return rowHeightPt(sheet, r, font, typo, wrapCtx);
    },
    [sheet, pageBreakPlan]
  );

  /**
   * Tinggi tambahan (px, sudah dikali `scale`) yang harus diserap baris anchor
   * agar hasil merge vertikal benar-benar menjangkau baris di bawahnya.
   * Model baris tidak menyimpan tinggi per-baris untuk sel tertutup, jadi baris
   * anchor tumbuh mengambil alih tinggi baris yang tertutup.
   */
  const rowSpanExtraPx = useMemo(() => {
    const map = new Map<number, number>();
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const rs = cell.rowSpan ?? 1;
      if (rs <= 1) continue;
      const [r, c] = key.split(",").map(Number);
      // Hanya jika sel ini memang anchor dari blok merge vertikal yang utuh.
      let extraPt = 0;
      for (let rr = r + 1; rr < r + rs; rr++) {
        if (!covered.has(cellKey(rr, c))) {
          extraPt = 0;
          break;
        }
        extraPt += currentRowHeightPt(rr);
      }
      if (extraPt <= 0) continue;
      const extraPx = Math.round(extraPt * scale);
      map.set(r, Math.max(map.get(r) ?? 0, extraPx));
    }
    return map;
  }, [sheet, covered, currentRowHeightPt, scale]);

  /** Sel jangkar yang menutupi tiap koordinat tertutup (untuk klik → anchor). */
  const coverAnchor = useMemo(() => {
    const map = new Map<string, { r: number; c: number }>();
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const cs = cell.colSpan ?? 1;
      const rs = cell.rowSpan ?? 1;
      if (cs <= 1 && rs <= 1) continue;
      const [r, c] = key.split(",").map(Number);
      for (let rr = r; rr < r + rs; rr++) {
        for (let cc = c; cc < c + cs; cc++) {
          if (rr === r && cc === c) continue;
          map.set(cellKey(rr, cc), { r, c });
        }
      }
    }
    return map;
  }, [sheet]);

  /** Baris yang mengandung anchor merge vertikal (rowSpan > 1). */
  const anchorRows = useMemo(() => {
    const set = new Set<number>();
    for (const [key, cell] of Object.entries(sheet.cells)) {
      if ((cell.rowSpan ?? 1) > 1) set.add(Number(key.split(",")[0]));
    }
    return set;
  }, [sheet]);

  /**
   * Tarikan ke atas (px) untuk baris tertutup PERTAMA di bawah tiap anchor:
   * baris anchor sudah menyerap tinggi baris tertutup, jadi baris pertama
   * tertutup ditarik ke atas sebesar serapan itu agar tinggi total lembar TIDAK
   * bertambah dan sel di bawahnya sejajar dengan bagian bawah sel merge (Excel).
   * Baris-baris sesudahnya otomatis mengalir tepat setelahnya.
   */
  const pullUpPx = useMemo(() => {
    const map = new Map<number, number>();
    for (const [r, extra] of rowSpanExtraPx) {
      if (extra <= 0) continue;
      map.set(r + 1, Math.max(map.get(r + 1) ?? 0, extra));
    }
    return map;
  }, [rowSpanExtraPx]);


  /** Ukur lebar teks (px) memakai canvas untuk auto-fit kolom. */
  const measureTextPx = useCallback((text: string, fontPx: number): number => {
    if (typeof document === "undefined") return text.length * fontPx * 0.6;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * fontPx * 0.6;
    ctx.font = `${fontPx}px sans-serif`;
    return ctx.measureText(text).width;
  }, []);

  /** Teks tampil sebuah sel (hasil evaluasi rumus bila ada, atau nilai mentah). */
  const displayTextOf = useCallback(
    (r: number, c: number): string => {
      const key = cellKey(r, c);
      const cell = sheet.cells[key];
      if (!cell || cell.value == null || cell.value === "") return "";
      const evald = evaluated.get(key)?.text;
      if (evald !== undefined) return evald;
      return cell.value;
    },
    [sheet, evaluated]
  );

  /** Auto-fit lebar kolom (px) berdasarkan konten terpanjang. */
  const autoFitColumnWidth = useCallback(
    (c: number): number => {
      const rowsN = Math.max(sheetRowCount(sheet), 4);
      let maxPx = MIN_COL_WIDTH_PX;
      for (let r = 0; r < rowsN; r++) {
        const cell = sheet.cells[cellKey(r, c)];
        const span = cell?.colSpan ?? 1;
        if (span > 1) continue; // sel gabungan tidak menentukan lebar kolom tunggal
        const text = displayTextOf(r, c);
        if (!text) continue;
        const fontPx = cell?.fontSize ?? pageBreakPlan?.typography.baseFontSize ?? 11;
        const px = measureTextPx(text, fontPx) + 16;
        if (px > maxPx) maxPx = px;
      }
      return Math.max(MIN_COL_WIDTH_PX, Math.min(MAX_COL_WIDTH_PX, Math.round(maxPx)));
    },
    [sheet, displayTextOf, measureTextPx, pageBreakPlan]
  );

  /**
   * Auto-fit tinggi baris (pt). Memakai rumus bersama `rowHeightPt` — sumber
   * kebenaran yang sama dengan render PDF & penghitungan batas halaman —
   * sehingga tinggi baris hasil auto-fit tidak menyimpang dari cetak.
   */
  const autoFitRowHeight = useCallback(
    (r: number): number => {
      const typo = pageBreakPlan?.typography;
      const wrapCtx = pageBreakPlan ? { contentWidthPt: pageBreakPlan.contentWidthPt, typo } : undefined;
      const base = rowHeightPt(sheet, r, typo?.baseFontSize ?? 11, typo, wrapCtx);
      return Math.round(base * 10) / 10;
    },
    [sheet, pageBreakPlan]
  );

  const setCell = useCallback(
    (r: number, c: number, patch: Partial<SheetCell> | null) => {
      const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
      const key = cellKey(r, c);
      if (patch === null) {
        delete next.cells[key];
      } else {
        const existing = next.cells[key] || {};
        const merged = { ...existing, ...patch };
        if (merged.value === "" || merged.value === undefined) {
          const { value, ...rest } = merged;
          void value;
          if (Object.keys(rest).length === 0) delete next.cells[key];
          else next.cells[key] = rest;
        } else {
          next.cells[key] = merged;
        }
      }
      onChange(next);
    },
    [sheet, onChange]
  );

  /** Terapkan patch ke seluruh sel dalam seleksi (bukan hanya sel jangkar). */
  const setCellsInSelection = useCallback(
    (patch: Partial<SheetCell> | null) => {
      const b = rectBounds();
      const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
      const apply = (r: number, c: number) => {
        const key = cellKey(r, c);
        if (patch === null) {
          delete next.cells[key];
          return;
        }
        const existing = next.cells[key] || {};
        const merged = { ...existing, ...patch };
        if (merged.value === "" || merged.value === undefined) {
          const { value, ...rest } = merged;
          void value;
          if (Object.keys(rest).length === 0) delete next.cells[key];
          else next.cells[key] = rest;
        } else {
          next.cells[key] = merged;
        }
      };
      if (b) {
        for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) apply(r, c);
      } else {
        apply(selected.r, selected.c);
      }
      onChange(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, onChange, selected, rect]
  );

  /**
   * Kembalikan fokus ke container grid setelah editor sel ditutup. Tanpa ini,
   * fokus jatuh ke <body> saat <input> pengedit ter-unmount sehingga handler
   * panah (yang dipasang di scrollRef) berhenti menerima tombol.
   */
  const refocusGrid = () => {
    requestAnimationFrame(() => scrollRef.current?.focus({ preventScroll: true }));
  };

  /** Hapus shape/gambar yang sedang terpilih (dipakai tombol ribbon, ×, & tombol Delete). */
  const deleteSelectedShape = () => {
    if (!selectedShapeId) return;
    onChange({
      ...sheet,
      shapes: (sheet.shapes || []).filter((s) => s.id !== selectedShapeId),
      images: (sheet.images || []).filter((im) => im.id !== selectedShapeId),
    });
    setSelectedShapeId(null);
  };

  const beginEdit = (r: number, c: number, initial?: string) => {
    const cell = sheet.cells[cellKey(r, c)];
    setEditing({ r, c });
    setEditValue(initial !== undefined ? initial : cell?.value ?? "");
  };

  const commitEdit = (refocus = false) => {
    if (!editing) return;
    setCell(editing.r, editing.c, { value: editValue });
    setEditing(null);
    if (refocus) refocusGrid();
  };

  const selectCell = (r: number, c: number) => {
    const next = {
      r: Math.max(0, Math.min(rowCount - 1, r)),
      c: Math.max(0, Math.min(sheet.cols - 1, c)),
    };
    onSelect(next);
    setRect({ r0: next.r, c0: next.c, r1: next.r, c1: next.c });
  };

  const moveSelection = (dr: number, dc: number) => selectCell(selected.r + dr, selected.c + dc);

  const extendSelection = (dr: number, dc: number) => {
    setRect((current) => {
      const base = current ?? { r0: selected.r, c0: selected.c, r1: selected.r, c1: selected.c };
      const r1 = Math.max(0, Math.min(rowCount - 1, base.r1 + dr));
      const c1 = Math.max(0, Math.min(sheet.cols - 1, base.c1 + dc));
      onSelect({ r: r1, c: c1 });
      return { ...base, r1, c1 };
    });
  };

  const handleMouseDown = (r: number, c: number) => {
    if (readOnly) return;
    if (onPaintFormat) {
      onPaintFormat(r, c);
      return;
    }
    scrollRef.current?.focus({ preventScroll: true });
    onSelect({ r, c });
    setRect({ r0: r, c0: c, r1: r, c1: c });
    setDragging(true);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (headerDrag === "col") {
      if (rect) setRect({ ...rect, c1: c, r1: rowCount - 1 });
      return;
    }
    if (headerDrag === "row") {
      if (rect) setRect({ ...rect, r1: r, c1: sheet.cols - 1 });
      return;
    }
    if (fillActive && rect) {
      setFillTarget({ r, c });
      return;
    }
    if (!dragging || !rect) return;
    setRect({ ...rect, r1: r, c1: c });
  };

  useEffect(() => {
    const up = () => {
      setDragging(false);
      setHeaderDrag(null);
      setFillActive((active) => {
        if (active) {
          setFillTarget((t) => {
            if (t) applyFillRef.current?.(t);
            return null;
          });
        }
        return false;
      });
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const inRect = (r: number, c: number): boolean => {
    if (!rect) return false;
    return (
      r >= Math.min(rect.r0, rect.r1) &&
      r <= Math.max(rect.r0, rect.r1) &&
      c >= Math.min(rect.c0, rect.c1) &&
      c <= Math.max(rect.c0, rect.c1)
    );
  };

  const rectBounds = useCallback((): Bounds | null => {
    if (!rect) return null;
    return normalizeBounds(rect);
  }, [rect]);

  useEffect(() => {
    onSelectionChange?.(rect ? normalizeBounds(rect) : { r0: selected.r, c0: selected.c, r1: selected.r, c1: selected.c });
  }, [rect, selected.r, selected.c, onSelectionChange]);

  useEffect(() => {
    onShapeSelectChange?.(selectedShapeId);
  }, [selectedShapeId, onShapeSelectChange]);

  /**
   * Tulis blok nilai+gaya ke workbook pada posisi jangkar. Dipakai paste &
   * fill. `mode` mengatur apakah gaya ikut disalin.
   */
  const writeBlock = useCallback(
    (
      anchor: { r: number; c: number },
      block: { rows: number; cols: number; source?: { r: number; c: number }; values: (string | undefined)[][]; styles?: (Omit<SheetCell, "value"> | undefined)[][] },
      opts?: { withStyle?: boolean; adjustFormulas?: boolean }
    ) => {
      const maxCol = Math.max(0, sheet.cols - 1);
      const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
      for (let r = 0; r < block.rows; r++) {
        for (let c = 0; c < block.cols; c++) {
          const tr = anchor.r + r;
          const tc = anchor.c + c;
          if (tc > maxCol) continue;
          const key = cellKey(tr, tc);
          const existing = next.cells[key] || {};
          let value = block.values[r]?.[c];
          // Sesuaikan referensi rumus relatif bila diminta (copy/paste/fill).
          if (opts?.adjustFormulas && block.source && typeof value === "string" && value.startsWith("=")) {
            value = rebaseBlockFormula(block as CellBlock, r, c, tr, tc);
          }
          const style = opts?.withStyle !== false ? block.styles?.[r]?.[c] : undefined;
          const merged: SheetCell = { ...existing, ...(style || {}) };
          if (value !== undefined && value !== "") merged.value = value;
          else if (value === "") delete merged.value;
          assignCell(next.cells, key, merged);
        }
      }
      onChange(next);
      // Pastikan baris tersedia.
      const needed = anchor.r + block.rows;
      setExtraRows((e) => Math.max(e, needed - (sheetRowCount(sheet) + 4)));
    },
    [sheet, onChange]
  );

  const copySelection = useCallback(() => {
    const b = rectBounds() ?? { r0: selected.r, c0: selected.c, r1: selected.r, c1: selected.c };
    const block = extractBlock(sheet, b);
    internalClipboard.current = block;
    const tsv = blockToTsv(block);
    try {
      navigator.clipboard?.writeText(tsv);
    } catch {
      /* clipboard OS tidak tersedia; internal tetap tersimpan */
    }
  }, [sheet, selected, rectBounds]);

  const clearBlock = useCallback(
    (b: Bounds) => {
      const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
      for (let r = b.r0; r <= b.r1; r++) {
        for (let c = b.c0; c <= b.c1; c++) {
          const key = cellKey(r, c);
          const cell = next.cells[key];
          if (!cell) continue;
          assignCell(next.cells, key, styleOf(cell) ?? {});
        }
      }
      onChange(next);
    },
    [sheet, onChange]
  );

  const cutSelection = useCallback(() => {
    const b = rectBounds() ?? { r0: selected.r, c0: selected.c, r1: selected.r, c1: selected.c };
    internalClipboard.current = extractBlock(sheet, b);
    try {
      navigator.clipboard?.writeText(blockToTsv(internalClipboard.current));
    } catch {
      /* ignore */
    }
    clearBlock(b);
  }, [sheet, selected, clearBlock, rectBounds]);

  const pasteClipboard = useCallback(async () => {
    const target = { r: selected.r, c: selected.c };
    const special = pasteSpecialMode.current;
    pasteSpecialMode.current = null;
    // Paste special dari internal.
    if (special && internalClipboard.current) {
      const src = internalClipboard.current;
      if (special === "values") {
        writeBlock(target, { rows: src.rows, cols: src.cols, source: src.source, values: src.values }, { withStyle: false, adjustFormulas: true });
      } else if (special === "formats") {
        writeBlock(target, { rows: src.rows, cols: src.cols, values: [], styles: src.styles }, { withStyle: true });
      } else if (special === "formatsWithValues") {
        writeBlock(target, src, { withStyle: true, adjustFormulas: true });
      } else {
        writeBlock(target, src, { withStyle: true, adjustFormulas: true });
      }
      return;
    }
    // Utamakan clipboard OS bila berisi TSV/tab; jika tidak, pakai internal.
    try {
      const text = await navigator.clipboard?.readText?.();
      if (text && /\t|\n/.test(text)) {
        const matrix = tsvToMatrix(text);
        writeBlock(target, { rows: matrix.length, cols: Math.max(...matrix.map((m) => m.length)), values: matrix }, { withStyle: false, adjustFormulas: true });
        return;
      }
      if (text) {
        writeBlock(target, { rows: 1, cols: 1, values: [[text]] }, { withStyle: false, adjustFormulas: true });
        return;
      }
    } catch {
      /* izin clipboard ditolak → fallback internal */
    }
    if (internalClipboard.current) writeBlock(target, internalClipboard.current, { withStyle: true, adjustFormulas: true });
  }, [selected, writeBlock]);

  /** Paste hanya gaya (tanpa nilai) — dipakai "Paste Format". */
  const pasteFormatOnly = useCallback(() => {
    const src = internalClipboard.current;
    if (!src) return;
    pasteSpecialMode.current = "formats";
    void pasteClipboard();
  }, [pasteClipboard]);

  /** Paste hanya nilai (tanpa gaya). */
  const pasteValuesOnly = useCallback(() => {
    const src = internalClipboard.current;
    if (!src) return;
    pasteSpecialMode.current = "values";
    void pasteClipboard();
  }, [pasteClipboard]);

  /**
   * Terapkan pola merge dari seleksi sumber ke area tujuan fill (mirip Excel):
   * anchor span diulang, sel tertutup dihapus, nilai & gaya anchor disalin.
   * Dipanggil setelah nilai/gaya dasar ditulis agar span menang.
   */
  const applyFillSpans = useCallback(
    (next: ReportSheet, b: Bounds, direction: "down" | "up" | "right" | "left", count: number) => {
      const plan = fillSpans(sheet, b, direction, count);
      if (plan.spans.length === 0) return;
      const maxCol = Math.max(0, sheet.cols - 1);
      const anchorKeys = new Set(plan.spans.map((s) => cellKey(s.r, s.c)));
      for (const key of plan.coveredToRemove) {
        if (anchorKeys.has(key)) continue;
        delete next.cells[key];
      }
      for (const span of plan.spans) {
        if (span.c > maxCol) continue;
        const source = sheet.cells[cellKey(span.sourceR, span.sourceC)];
        const style = styleOf(source);
        const merged: SheetCell = {
          ...(style || {}),
          colSpan: span.colSpan > 1 ? span.colSpan : undefined,
          rowSpan: span.rowSpan > 1 ? span.rowSpan : undefined,
        };
        if (source?.value !== undefined) merged.value = source.value;
        if (merged.colSpan === undefined) delete merged.colSpan;
        if (merged.rowSpan === undefined) delete merged.rowSpan;
        assignCell(next.cells, cellKey(span.r, span.c), merged);
      }
    },
    [sheet]
  );

  /**
   * Fill handle. Menghitung arah dominan (vertikal/horizontal) atau nilai.
   * garis potong. Mendukung satu kolom/baris
   * sumber dan memperluas deret.
   */
  const applyFill = useCallback(
    (target: { r: number; c: number }) => {
      const b = rectBounds();
      if (!b) return;
      if (target.r > b.r1) {
        // Tarik ke bawah per kolom.
        const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
        const need = target.r - b.r1;
        for (let c = b.c0; c <= b.c1; c++) {
          const source: string[] = [];
          for (let r = b.r0; r <= b.r1; r++) source.push(sheet.cells[cellKey(r, c)]?.value ?? "");
          const series = extrapolateSeries(source, need);
          const baseRow = b.r1;
          for (let i = 0; i < need; i++) {
            const key = cellKey(baseRow + 1 + i, c);
            const base = sheet.cells[cellKey(baseRow, c)];
            const style = styleOf(base);
            let value = series[i];
            const baseValue = base?.value ?? "";
            if (baseValue.startsWith("=")) value = "=" + adjustFormulaRefs(baseValue.slice(1), i + 1, 0);
            if (value === "" && !style) continue;
            next.cells[key] = { ...(style || {}), ...(value !== "" ? { value } : {}) };
          }
        }
        applyFillSpans(next, b, "down", need);
        onChange(next);
        setExtraRows((e) => Math.max(e, target.r + 4 - (sheetRowCount(sheet) + 4)));
      } else if (target.r < b.r0) {
        const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
        const need = b.r0 - target.r;
        for (let c = b.c0; c <= b.c1; c++) {
          const source: string[] = [];
          for (let r = b.r0; r <= b.r1; r++) source.push(sheet.cells[cellKey(r, c)]?.value ?? "");
          const series = extrapolateSeries(source, need, -1);
          for (let i = 0; i < need; i++) {
            const key = cellKey(target.r + i, c);
            const base = sheet.cells[cellKey(b.r0, c)];
            const style = styleOf(base);
            let value = series[need - 1 - i];
            if ((base?.value ?? "").startsWith("=")) value = "=" + adjustFormulaRefs(base!.value!.slice(1), target.r + i - b.r0, 0);
            if (value === "" && !style) continue;
            next.cells[key] = { ...(style || {}), ...(value !== "" ? { value } : {}) };
          }
        }
        applyFillSpans(next, b, "up", need);
        onChange(next);
      } else if (target.c > b.c1) {
        const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
        const need = target.c - b.c1;
        for (let r = b.r0; r <= b.r1; r++) {
          const source: string[] = [];
          for (let c = b.c0; c <= b.c1; c++) source.push(sheet.cells[cellKey(r, c)]?.value ?? "");
          const series = extrapolateSeries(source, need);
          for (let i = 0; i < need; i++) {
            const key = cellKey(r, b.c1 + 1 + i);
            if (Number(key.split(",")[1]) >= sheet.cols) continue;
            const base = sheet.cells[cellKey(r, b.c1)];
            const style = styleOf(base);
            let value = series[i];
            if ((base?.value ?? "").startsWith("=")) value = "=" + adjustFormulaRefs(base!.value!.slice(1), 0, b.c1 + 1 + i - b.c1);
            if (value === "" && !style) continue;
            next.cells[key] = { ...(style || {}), ...(value !== "" ? { value } : {}) };
          }
        }
        applyFillSpans(next, b, "right", need);
        onChange(next);
      } else if (target.c < b.c0) {
        // Tarik ke kiri per baris (mirror dari cabang kanan).
        const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
        const need = b.c0 - target.c;
        for (let r = b.r0; r <= b.r1; r++) {
          const source: string[] = [];
          for (let c = b.c0; c <= b.c1; c++) source.push(sheet.cells[cellKey(r, c)]?.value ?? "");
          const series = extrapolateSeries(source, need, -1);
          for (let i = 0; i < need; i++) {
            const col = target.c + i;
            if (col < 0) continue;
            const key = cellKey(r, col);
            const base = sheet.cells[cellKey(r, b.c0)];
            const style = styleOf(base);
            let value = series[need - 1 - i];
            if ((base?.value ?? "").startsWith("=")) value = "=" + adjustFormulaRefs(base!.value!.slice(1), 0, col - b.c0);
            if (value === "" && !style) continue;
            next.cells[key] = { ...(style || {}), ...(value !== "" ? { value } : {}) };
          }
        }
        applyFillSpans(next, b, "left", need);
        onChange(next);
      }
    },
    [sheet, onChange, rectBounds, applyFillSpans]
  );

  // Sinkronkan applyFill ke ref agar handler mouseup global bisa memanggilnya.
  useEffect(() => {
    applyFillRef.current = applyFill;
  }, [applyFill]);

  /** Pilih seluruh kolom/baris melalui header; mendukung shift untuk perluas. */
  const selectColumn = (c: number, shift = false) => {
    const r1 = rowCount - 1;
    if (shift && rect) setRect({ r0: 0, c0: Math.min(rect.c0, c), r1, c1: Math.max(rect.c0, c) });
    else setRect({ r0: 0, c0: c, r1, c1: c });
    onSelect({ r: 0, c });
  };

  const selectRow = (r: number, shift = false) => {
    const c1 = sheet.cols - 1;
    if (shift && rect) setRect({ r0: Math.min(rect.r0, r), c0: 0, r1: Math.max(rect.r0, r), c1 });
    else setRect({ r0: r, c0: 0, r1: r, c1 });
    onSelect({ r, c: 0 });
  };

  const selectAll = () => {
    setRect({ r0: 0, c0: 0, r1: rowCount - 1, c1: sheet.cols - 1 });
    onSelect({ r: 0, c: 0 });
  };

  /** Insert kolom di posisi tertentu (geser sel kanan). */
  const insertColumnAt = (at: number) => {
    onChange(insertColumns(sheet, at));
  };

  /** Hapus kolom tertentu (sel kanan bergeser kiri). */
  /** Duplikasi kolom: sisipkan salinan kolom `at` tepat di kanannya. */
  const duplicateColumnAt = (at: number) => {
    const next = insertColumns(sheet, at + 1);
    next.colWidths[at + 1] = colWidthPx(sheet, at);
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const [r, c] = key.split(",").map(Number);
      if (c !== at) continue;
      next.cells[cellKey(r, at + 1)] = {
        ...cell,
        value: cell.value?.startsWith("=") ? adjustFormulaRefs(cell.value, 0, 1) : cell.value,
      };
    }
    onChange(next);
  };

  const deleteColumnAt = (at: number) => {
    if (sheet.cols <= 1) return;
    onChange(deleteColumns(sheet, at));
    selectCell(selected.r, Math.min(selected.c, sheet.cols - 2));
  };

  /** Insert baris di posisi tertentu. Baris bukan bagian model, jadi cukup
   *  geser sel ke bawah dan tambahkan kapasitas render. Kapasitas hanya
   *  ditambah bila jumlah baris data TIDAK bertambah (insert di bawah data) —
   *  insert di dalam data sudah menaikkan hitungan sendiri, sehingga tanpa
   *  penjaga ini satu klik bisa menambah 2 baris tampilan. */
  const insertRowAt = (at: number) => {
    const prevDataRows = sheetRowCount(sheet);
    const next = insertRows(sheet, at);
    onChange(next);
    if (sheetRowCount(next) === prevDataRows) setExtraRows((e) => e + 1);
  };

  const deleteRowAt = (at: number) => {
    onChange(deleteRows(sheet, at));
    selectCell(Math.min(selected.r, Math.max(0, rowCount - 2)), selected.c);
  };

  /**
   * Hapus SATU baris terakhir yang terlihat (per klik), bukan semua kapasitas
   * sekaligus. Bila baris terakhir berisi data, baris itu dihapus struktural;
   * bila hanya padding, kapasitas dikurangi 1.
   *
   * rowCount = max(dataRows + 4 + extraRows, minRows + extraRows), sehingga
   * extraRows = target - max(dataRowsBaru + 4, minRows) menjamin rowCount tepat
   * menyentuh target (dan floor alami di 1 baris).
   */
  const deleteLastRow = () => {
    if (rowCount <= 1) return;
    const lastIdx = rowCount - 1;
    if (lastIdx >= sheetRowCount(sheet)) {
      // Baris terakhir hanya padding: kurangi kapasitas 1. Fungsional agar
      // beberapa klik berturut-turut dalam satu batch pun tetap −1 per klik,
      // dengan floor di dalam update (rowCount tak pernah < 1) karena guard
      // luar bisa membaca rowCount yang sudah basi dalam satu batch.
      setExtraRows((e) => {
        const floor = 1 - Math.max(sheetRowCount(sheet) + 4, minRows);
        return Math.max(e - 1, floor);
      });
      selectCell(Math.min(selected.r, lastIdx - 1), selected.c);
      return;
    }
    const next = deleteRows(sheet, lastIdx);
    onChange(next);
    setExtraRows(lastIdx - Math.max(sheetRowCount(next) + 4, minRows));
    selectCell(Math.min(selected.r, Math.max(0, lastIdx - 1)), selected.c);
  };

  /** Sembunyikan/tampilkan baris (tinggi 0 = hidden, ala Excel). */
  const toggleHideRowAt = (at: number, hide: boolean) => {
    const rowHeights = { ...(sheet.rowHeights || {}) };
    if (hide) rowHeights[at] = 0;
    else delete rowHeights[at];
    onChange({ ...sheet, rowHeights });
  };

  /** Sembunyikan/tampilkan kolom (lebar 0 = hidden, ala Excel). */
  const toggleHideColumnAt = (at: number, hide: boolean) => {
    const colWidths = [...sheet.colWidths];
    if (hide) colWidths[at] = 0;
    else colWidths[at] = DEFAULT_COL_WIDTH_PX;
    onChange({ ...sheet, colWidths });
  };

  /** Pindah ke tepi data berikutnya (Ctrl+Arrow), meniru Excel. */
  const jumpEdge = (dr: number, dc: number) => {
    let r = selected.r;
    let c = selected.c;
    if (dc !== 0) {
      const limit = dc > 0 ? sheet.cols - 1 : 0;
      c = dc > 0 ? limit : 0;
      selectCell(r, c);
      return;
    }
    if (dr > 0) r = rowCount - 1;
    else if (dr < 0) r = 0;
    selectCell(r, c);
  };

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (editing || readOnly) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        cutSelection();
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        void pasteClipboard();
        return;
      }
      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        jumpEdge(dr, dc);
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        beginEdit(selected.r, selected.c);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.shiftKey) extendSelection(1, 0);
        else moveSelection(1, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.shiftKey) extendSelection(-1, 0);
        else moveSelection(-1, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) extendSelection(0, 1);
        else moveSelection(0, 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) extendSelection(0, -1);
        else moveSelection(0, -1);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        moveSelection(10, 0);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        moveSelection(-10, 0);
      } else if (e.key === "Home") {
        e.preventDefault();
        selectCell(selected.r, 0);
      } else if (e.key === "End") {
        e.preventDefault();
        selectCell(selected.r, sheet.cols - 1);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) moveSelection(0, -1);
        else moveSelection(0, 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        beginEdit(selected.r, selected.c);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedShapeId) {
          deleteSelectedShape();
          return;
        }
        const b = rectBounds();
        if (b) clearBlock(b);
        else setCell(selected.r, selected.c, null);
      } else if (
        !mod &&
        !e.altKey &&
        e.key.length === 1 &&
        e.key !== " " &&
        !["F2"].includes(e.key)
      ) {
        // Excel: mulai mengetik karakter apa pun langsung menggantikan isi sel.
        e.preventDefault();
        beginEdit(selected.r, selected.c, e.key);
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, selected, rowCount, sheet.cols, rect, readOnly, copySelection, cutSelection, pasteClipboard, clearBlock, selectedShapeId, deleteSelectedShape]);

  const canMerge = (() => {
    const b = rectBounds();
    if (!b) return false;
    if (b.r0 === b.r1 && b.c0 === b.c1) return false;
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const [r, c] = key.split(",").map(Number);
      const cs = cell.colSpan ?? 1;
      const rs = cell.rowSpan ?? 1;
      if (cs <= 1 && rs <= 1) continue;
      const rEnd = r + rs - 1;
      const cEnd = c + cs - 1;
      const overlaps = r <= b.r1 && rEnd >= b.r0 && c <= b.c1 && cEnd >= b.c0;
      // Seleksi harus bersih dari merge yang ada: merge yang terpotong bikin
      // geometri rusak, dan merge yang tercakup utuh akan terhapus tanpa jejak
      // (span bagian dalam hilang). Pengguna harus Split dulu sebelum merge
      // ulang.
      if (overlaps) return false;
    }
    return true;
  })();

  const mergeSelection = () => {
    const b = rectBounds();
    if (!b || !canMerge) return;
    const next: ReportSheet = { ...sheet, cells: { ...sheet.cells } };
    const anchor = next.cells[cellKey(b.r0, b.c0)] || {};
    for (let r = b.r0; r <= b.r1; r++) {
      for (let c = b.c0; c <= b.c1; c++) {
        if (r === b.r0 && c === b.c0) continue;
        delete next.cells[cellKey(r, c)];
      }
    }
    next.cells[cellKey(b.r0, b.c0)] = {
      ...anchor,
      // Sengaja: merge tanpa perataan terlihat "nyangkut" di kiri. Nilai
      // tengah-tengah adalah harapan umum pengguna saat menggabungkan kop.
      align: anchor.align ?? "center",
      vertical: anchor.vertical ?? "middle",
      colSpan: b.c1 - b.c0 + 1,
      rowSpan: b.r1 - b.r0 + 1,
    };
    onChange(next);
    setRect(null);
  };

  const unmergeSelection = () => {
    // Cari sel jangkar: langsung pada seleksi, atau jangkar yang menutupi
    // koordinat seleksi (merge vertikal/horizontal dari sel di atas/kiri).
    let ar = selected.r;
    let ac = selected.c;
    let anchor = sheet.cells[cellKey(ar, ac)];
    if (!anchor || ((anchor.colSpan ?? 1) === 1 && (anchor.rowSpan ?? 1) === 1)) {
      let found = false;
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const cs = cell.colSpan ?? 1;
        const rs = cell.rowSpan ?? 1;
        if (cs <= 1 && rs <= 1) continue;
        const [r, c] = key.split(",").map(Number);
        if (
          selected.r >= r && selected.r < r + rs &&
          selected.c >= c && selected.c < c + cs
        ) {
          ar = r; ac = c; anchor = cell; found = true;
          break;
        }
      }
      if (!found) return;
    }
    setCell(ar, ac, { colSpan: undefined, rowSpan: undefined });
  };

  // Ekspos aksi merge/split, clipboard, & insert ke ribbon (kontrol dipusatkan di sana).
  useImperativeHandle(ref, () => ({
    mergeSelection,
    unmergeSelection,
    copySelection,
    cutSelection,
    pasteClipboard,
    insertRowAbove: () => insertRowAt(selected.r),
    insertRowBelow: () => insertRowAt(selected.r + 1),
    deleteLastRow,
    insertColLeft: () => insertColumnAt(selected.c),
    insertColRight: () => insertColumnAt(selected.c + 1),
    addShape: (type) => {
      const contentW = pageBreakPlan?.contentWidthPt ?? 400;
      const shape = createShape(type, { x: Math.round(contentW / 4), y: 80 });
      onChange({ ...sheet, shapes: [...(sheet.shapes || []), shape] });
      setSelectedShapeId(shape.id);
    },
    addImage: (src) => {
      const contentW = pageBreakPlan?.contentWidthPt ?? 400;
      const img = createImage(src, { x: Math.round(contentW / 3), y: 60 });
      onChange({ ...sheet, images: [...(sheet.images || []), img] });
      setSelectedShapeId(img.id);
    },
    deleteShape: deleteSelectedShape,
  }));

  const isAnchorMerged =
    (sheet.cells[cellKey(selected.r, selected.c)]?.colSpan ?? 1) > 1 ||
    (sheet.cells[cellKey(selected.r, selected.c)]?.rowSpan ?? 1) > 1;
  useEffect(() => {
    onMergeStateChange?.({ canMerge, isMerged: isAnchorMerged });
  }, [canMerge, isAnchorMerged, onMergeStateChange]);

  const patchSelected = (patch: Partial<SheetCell>) => {
    setCellsInSelection(patch);
  };

  const current = sheet.cells[cellKey(selected.r, selected.c)];
  const isMerged = (current?.colSpan ?? 1) > 1 || (current?.rowSpan ?? 1) > 1;
  const preview = evaluated.get(cellKey(selected.r, selected.c));
  const isFormulaCell = current?.value ? parseCellValue(current.value).type === "FORMULA" : false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!hideToolbar ? (
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-card px-2 py-1.5">
        <div className="mr-1 w-20 rounded border bg-background px-2 py-0.5 text-center font-mono text-[11px]">
          {colLetters(selected.c)}{selected.r + 1}
        </div>
        <Button type="button" variant={current?.bold ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ bold: !current?.bold })} title="Tebal">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.italic ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ italic: !current?.italic })} title="Miring">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.underline ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ underline: !current?.underline })} title="Garis bawah">
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant={current?.align === "left" || !current?.align ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ align: "left" })} title="Rata kiri">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.align === "center" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ align: "center" })} title="Rata tengah">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.align === "right" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ align: "right" })} title="Rata kanan">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant={!current?.vertical || current?.vertical === "top" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ vertical: "top" })} title="Rata atas">
          <ArrowUpToLine className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.vertical === "middle" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ vertical: "middle" })} title="Rata tengah vertikal">
          <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={current?.vertical === "bottom" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => patchSelected({ vertical: "bottom" })} title="Rata bawah">
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <select
          className="h-7 rounded border bg-background px-1 text-[11px]"
          value={current?.format || "text"}
          onChange={(e) => patchSelected({ format: e.target.value as SheetCell["format"] })}
        >
          <option value="text">Teks</option>
          <option value="number">Angka</option>
          <option value="rupiah">Rupiah</option>
          <option value="date">Tanggal</option>
        </select>
        <select
          className="h-7 rounded border bg-background px-1 text-[11px]"
          value={current?.border || "none"}
          onChange={(e) => patchSelected({ border: e.target.value as SheetCell["border"] })}
        >
          <option value="none">Tanpa Border</option>
          <option value="all">Border Semua</option>
          <option value="box">Border Kotak</option>
        </select>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={mergeSelection} disabled={!canMerge} title="Gabungkan sel terpilih">
          <Merge className="h-3.5 w-3.5" /> Gabung
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={unmergeSelection} disabled={!isMerged} title="Pisahkan sel">
          <SplitSquareHorizontal className="h-3.5 w-3.5" /> Pisah
        </Button>
        {onTogglePageBreaks ? (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              type="button"
              variant={showPageBreaks ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={onTogglePageBreaks}
              title="Tampilkan/sembunyikan garis batas kertas (skala 1pt = 1px)"
            >
              <Scissors className="h-3.5 w-3.5" /> Batas Kertas
            </Button>
            {pageBreakPlan ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {pageBreakPlan.pageCount} halaman
                {pageBreakPlan.rowsPerPage.length > 0 ? ` · ${pageBreakPlan.rowsPerPage[0]} baris/hal` : ""}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-2 py-1">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Isi Sel</span>
        <input
          className="h-7 flex-1 rounded border bg-background px-2 font-mono text-xs"
          value={editing ? editValue : current?.value ?? ""}
          placeholder='Teks, {{variabel}}, {list.field}, atau =SUM(A1:A5)'
          onChange={(e) => {
            if (!editing) setEditing({ r: selected.r, c: selected.c });
            setEditValue(e.target.value);
          }}
          onBlur={() => commitEdit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit(true);
              moveSelection(1, 0);
            } else if (e.key === "Tab") {
              e.preventDefault();
              commitEdit(true);
              if (selected.c >= sheet.cols - 1) onSelect({ r: Math.min(rowCount - 1, selected.r + 1), c: 0 });
              else moveSelection(0, 1);
            } else if (e.key === "Escape") {
              setEditing(null);
              refocusGrid();
            }
          }}
        />
        {isFormulaCell && preview ? (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            = {preview.text}
          </span>
        ) : null}
      </div>

      <div
        ref={outerRef}
        className="min-h-0 flex-1 overflow-hidden"
      >
      <div
        ref={scrollRef}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          "h-full min-h-0 overflow-auto bg-slate-200 p-6 outline-none dark:bg-zinc-900/40",
          focused && "ring-1 ring-inset ring-blue-400/40"
        )}
        onContextMenu={(e) => {
          if (readOnly) return;
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, r: selected.r, c: selected.c });
        }}
      >
        <div
          className={cn(
            "inline-block select-none",
            !contentWidthPx && "min-w-full"
          )}
          style={
            marginPx
              ? {
                  paddingTop: marginPx.top,
                  paddingRight: marginPx.right,
                  paddingBottom: marginPx.bottom,
                  paddingLeft: marginPx.left,
                    background: "#ffffff",
                    boxShadow: "0 4px 18px rgba(15, 23, 42, 0.16)",
                }
              : undefined
          }
        >
        <div
          ref={gridRef}
          className={cn("relative rounded border bg-white text-xs dark:bg-zinc-900", !contentWidthPx && "w-full")}
          style={{
            // Excel-like: papan mengikuti lebar kolom (bukan dipaksa seukuran
            // kertas). Namun minimal selebar area konten agar batas cetak
            // tetap terlihat saat kolom lebih sempit dari kertas.
            width: contentWidthPx ? Math.max(totalWidthScaledPx, contentWidthPx) : undefined,
          }}
        >
           {/* Garis referensi area kertas. Kanvas di luar garis tetap valid untuk
               didesain; Fit to Width adalah aksi eksplisit bila tabel harus pas. */}
           {contentWidthPx !== undefined ? (
             <div
               className="pointer-events-none absolute inset-y-0 z-[5] border-x border-dashed border-blue-400/50"
               style={{ left: 0, width: contentWidthPx }}
               title="Batas area kertas (referensi)"
             />
           ) : null}
          <div className="flex sticky top-0 z-10">
            <button
              type="button"
              className="sticky left-0 z-[4] w-8 shrink-0 border-b border-r bg-muted/60 hover:bg-muted"
              title="Pilih seluruh lembar"
              onClick={selectAll}
            />
            {Array.from({ length: sheet.cols }).map((_, c) => {
              const colSelected = rect ? c >= Math.min(rect.c0, rect.c1) && c <= Math.max(rect.c0, rect.c1) : false;
              const frozen = frozenLeftPx.has(c);
              const hidden = isColHidden(sheet, c);
              if (hidden) {
                // Kolom disembunyikan: header jadi garis tipis yang bisa
                // diklik untuk menampilkan kembali (ala Excel).
                return (
                  <div
                    key={c}
                    className="relative shrink-0 cursor-pointer border-b border-r bg-muted/80 hover:bg-blue-200"
                    style={{ width: 4 * scale }}
                    title={`Kolom ${colLetters(c)} tersembunyi — klik untuk menampilkan`}
                    onClick={() => toggleHideColumnAt(c, false)}
                  />
                );
              }
              return (
                <div
                  key={c}
                  className={cn(
                    "relative shrink-0 cursor-pointer border-b border-r bg-muted/60 px-1 py-0.5 text-center text-[10px] font-semibold text-muted-foreground hover:bg-muted",
                    colSelected && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                    frozen && "sticky z-[5]"
                  )}
                  style={{ width: (widths[c] ?? 0) * scale, left: frozen ? frozenLeftPx.get(c) : undefined }}
                  title={`Pilih kolom ${colLetters(c)}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectColumn(c, e.shiftKey);
                    setHeaderDrag("col");
                  }}
                  onMouseEnter={() => handleMouseEnter(0, c)}
                >
                  {colLetters(c)}
                  {onResizeColumn ? (
                    <span
                      className="absolute inset-y-0 -right-0.5 z-10 w-1 cursor-col-resize hover:bg-blue-400"
                      title="Tarik untuk ubah lebar kolom · klik dua kali untuk auto-fit"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Kolom yang di-resize serentak: seluruh kolom dalam seleksi
                        // bila seleksi mencakup kolom ini, jika tidak hanya kolom ini.
                        const b = rectBounds();
                        const cols =
                          b && c >= b.c0 && c <= b.c1
                            ? Array.from({ length: b.c1 - b.c0 + 1 }, (_, i) => b.c0 + i)
                            : [c];
                        const startX = e.clientX;
                        const scaleNow = scale || 1;
                        // Lebar absolut awal = rata-rata kolom terpilih (semua identik).
                        const startWidth =
                          cols.reduce((sum, cc) => sum + colWidthPx(sheet, cc), 0) / cols.length;
                        let last = startWidth;
                        const onMove = (ev: MouseEvent) => {
                          const deltaPx = (ev.clientX - startX) / scaleNow;
                          // Tanpa lantai: menyeret sampai 0 menyembunyikan kolom
                          // (ala Excel/LibreOffice). Hanya batas atas yang dijaga.
                          const next = Math.max(0, Math.min(MAX_COL_WIDTH_PX, Math.round(startWidth + deltaPx)));
                          if (next === last) return;
                          last = next;
                          onResizeColumn(cols, next);
                        };
                        const onUp = () => {
                          window.removeEventListener("mousemove", onMove);
                          window.removeEventListener("mouseup", onUp);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const b = rectBounds();
                        const cols =
                          b && c >= b.c0 && c <= b.c1
                            ? Array.from({ length: b.c1 - b.c0 + 1 }, (_, i) => b.c0 + i)
                            : [c];
                        cols.forEach((cc) => onResizeColumn([cc], autoFitColumnWidth(cc)));
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {Array.from({ length: rowCount }).map((_, r) => {
            const isRepeat = repeatRows.has(r);
            const explicitH = rowHeightAt(sheet, r);
            const typo = pageBreakPlan?.typography;
            const wrapCtx = pageBreakPlan ? { contentWidthPt: pageBreakPlan.contentWidthPt, typo } : undefined;
            const rowHpt = explicitH ?? rowHeightPt(sheet, r, typo?.baseFontSize ?? 11, typo, wrapCtx);
            const rowH = Math.round(rowHpt * scale);
            const breakToPage = breakRows.get(r);
            const isLastDataRow = pageBreakPlan ? r === sheetRowCount(sheet) - 1 : false;
            const rowSelected = rect ? r >= Math.min(rect.r0, rect.r1) && r <= Math.max(rect.r0, rect.r1) : false;
            const rowHidden = isRowHidden(sheet, r);
            // Di baris yang mengandung anchor merge vertikal, anak selain anchor
            // TIDAK ikut meregang — tingginya tetap tinggi natural baris itu,
            // agar border kolom lain tidak melebar mengikuti sel merge.
            const naturalChild = anchorRows.has(r) && rowH !== undefined;
            const pullUp = pullUpPx.get(r);
            if (rowHidden) {
              // Baris disembunyikan: nomor jadi garis tipis yang bisa diklik
              // untuk menampilkan kembali (ala Excel).
              return (
                <div
                  key={r}
                  className="flex"
                  style={pullUp !== undefined ? { marginTop: -pullUp } : undefined}
                >
                  <div
                    className="sticky left-0 z-[6] shrink-0 cursor-pointer border-b border-r bg-muted/80 hover:bg-blue-200"
                    style={{ width: 32, height: 3 }}
                    title={`Baris ${r + 1} tersembunyi — klik untuk menampilkan`}
                    onClick={() => toggleHideRowAt(r, false)}
                  />
                </div>
              );
            }
            return (
              <div key={r} style={pullUp !== undefined ? { marginTop: -pullUp } : undefined}>
                <div
                  className="flex"
                  style={
                    rowH !== undefined || rowSpanExtraPx.has(r)
                      ? { minHeight: (rowH ?? 0) + (rowSpanExtraPx.get(r) ?? 0) }
                      : undefined
                  }
                >
                  <div
                    className={cn(
                      "relative sticky left-0 z-[6] w-8 shrink-0 cursor-pointer border-b border-r bg-muted/60 py-1 text-center text-[10px] font-semibold hover:bg-muted",
                      isRepeat ? "text-blue-600" : "text-muted-foreground",
                      rowSelected && "bg-blue-100 dark:bg-blue-900/40"
                    )}
                    style={{ width: 32, ...(naturalChild ? { alignSelf: "flex-start", height: rowH } : {}) }}
                    title={`Pilih baris ${r + 1}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectRow(r, e.shiftKey);
                      setHeaderDrag("row");
                    }}
                    onMouseEnter={() => handleMouseEnter(r, 0)}
                  >
                    {r + 1}
                    {onResizeRow ? (
                      <span
                        className="absolute -bottom-0.5 inset-x-0 z-10 h-1 cursor-row-resize hover:bg-blue-400"
                        title="Tarik untuk ubah tinggi baris · klik dua kali untuk auto-fit"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rb = rectBounds();
                          const rows =
                            rb && r >= rb.r0 && r <= rb.r1
                              ? Array.from({ length: rb.r1 - rb.r0 + 1 }, (_, i) => rb.r0 + i)
                              : [r];
                          const startY = e.clientY;
                          const scaleNow = Math.max(scale, 0.01);
                          const startH = rows.reduce((sum, rr) => sum + currentRowHeightPt(rr), 0) / rows.length;
                          let last = startH;
                          const onMove = (ev: MouseEvent) => {
                            const deltaPt = (ev.clientY - startY) / scaleNow;
                            // Tanpa lantai: 0 menyembunyikan baris (ala Excel/
                            // LibreOffice). Hanya dibulatkan ke 0.1pt.
                            const next = Math.max(0, Math.round((startH + deltaPt) * 10) / 10);
                            if (next === last) return;
                            last = next;
                            onResizeRow(rows, next);
                          };
                          const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rb = rectBounds();
                          const rows =
                            rb && r >= rb.r0 && r <= rb.r1
                              ? Array.from({ length: rb.r1 - rb.r0 + 1 }, (_, i) => rb.r0 + i)
                              : [r];
                          rows.forEach((rr) => onResizeRow([rr], autoFitRowHeight(rr)));
                        }}
                      />
                    ) : null}
                  </div>
                  {Array.from({ length: sheet.cols }).map((_, c) => {
                    const key = cellKey(r, c);
                    if (covered.has(key)) {
                      const anchor = coverAnchor.get(key);
                      // Sel yang tertutup horizontal sudah tercakup oleh lebar
                      // anchor; jangan membuat slot kedua karena itu menciptakan
                      // ruang kosong setelah merge. Slot hanya diperlukan untuk
                      // baris di bawah anchor vertical agar kolom tetap sejajar.
                      if (!anchor || anchor.r === r) return null;
                      return (
                        <div
                          key={c}
                          className="shrink-0 cursor-cell"
                          style={{ width: widths[c] * scale }}
                          onMouseDown={() => handleMouseDown(anchor.r, anchor.c)}
                          onMouseEnter={() => handleMouseEnter(r, c)}
                          onDoubleClick={() => beginEdit(anchor.r, anchor.c)}
                        />
                      );
                    }
                    const cell = sheet.cells[key];
                    const isEditing = editing?.r === r && editing?.c === c;
                    const isSel = selected.r === r && selected.c === c;
                    const isInRect = inRect(r, c);
                    const colSpan = cell?.colSpan ?? 1;
                    const rowSpan = cell?.rowSpan ?? 1;
                    const spanWidth = (colSpan > 1 ? widths.slice(c, c + colSpan).reduce((a, b) => a + b, 0) : widths[c]) * scale;
                    const parsed = cell?.value ? parseCellValue(cell.value).type : "EMPTY";
                    const isListCell = parsed === "LIST" || isRepeat;
                    const evaluatedText = evaluated.get(key)?.text;
                    const displayValue = evaluatedText !== undefined ? evaluatedText : cell?.value || "";
                    const b = rectBounds();
                    /** Fill handle hanya pada pojok kanan-bawah seleksi. */
                    const isFillCorner = !!b && r === b.r1 && c === b.c1 && !editing;
                    const isFillHover = fillActive && fillTarget && (
                      (fillTarget.r > b!.r1 && c === b!.c1 && r === b!.r1) ||
                      (fillTarget.r < b!.r0 && c === b!.c0 && r === b!.r0) ||
                      (fillTarget.c > b!.c1 && r === b!.r1 && c === b!.c1) ||
                      (fillTarget.c < b!.c0 && r === b!.r0 && c === b!.c0)
                    );
                    const frozen = frozenLeftPx.has(c);
                    const rowFrozen = freezeRows > 0 && r < freezeRows;
                    const cond = conditionalStyleFor(sheet, r, c, displayValue);
                    return (
                      <div
                        key={c}
                        className={cn(
                          "relative flex min-h-0 shrink-0 flex-col cursor-cell border-b border-r px-1 py-0.5",
                          isSel && "ring-2 ring-inset ring-blue-500 z-[1]",
                          !isSel && isInRect && "bg-blue-100 dark:bg-blue-900/40",
                          isListCell && !isInRect && !isSel && "bg-blue-50/60 dark:bg-blue-950/30",
                          isFillHover && "ring-2 ring-inset ring-blue-400",
                          frozen && "sticky z-[3]",
                          rowFrozen && "sticky top-[25px] z-[2]"
                        )}
                        style={{
                          width: spanWidth,
                          left: frozen ? frozenLeftPx.get(c) : undefined,
                          // Sel non-anchor di baris anchor: tinggi natural,
                          // jangan ikut meregang mengikuti sel merge.
                          ...(naturalChild && rowSpan <= 1 ? { alignSelf: "flex-start" as const, height: rowH } : {}),
                           textAlign: cell?.align || "left",
                           justifyContent: cell?.vertical === "middle" ? "center" : cell?.vertical === "bottom" ? "flex-end" : "flex-start",
                           fontFamily: browserFontFamily(cell?.fontFamily),
                           fontSize: cell?.fontSize,
                          fontWeight: cell?.bold ? 700 : 400,
                          fontStyle: cell?.italic ? "italic" : "normal",
                          textDecoration: cell?.underline ? "underline" : "none",
                          backgroundColor: cond?.bg ?? cell?.bg ?? (frozen ? "#ffffff" : undefined),
                          color: cond?.color ?? cell?.color,
                          paddingLeft: cell?.indent ? 6 + cell.indent : undefined,
                          // Warna per sisi: sisi yang digambar user memakai warnanya
                          // (default hitam); sisi bawaan tetap garis tipis lembut.
                          borderTopColor: sideBorder(cell, "top", "borderTop") ? (cell?.borderColor ?? "#000000") : BORDER_COLOR,
                          borderLeftColor: sideBorder(cell, "left", "borderLeft") ? (cell?.borderColor ?? "#000000") : BORDER_COLOR,
                          borderBottomColor: sideBorder(cell, "bottom", "borderBottom") ? (cell?.borderColor ?? "#000000") : BORDER_COLOR,
                          borderRightColor: sideBorder(cell, "right", "borderRight") ? (cell?.borderColor ?? "#000000") : BORDER_COLOR,
                          borderTopWidth: sideBorder(cell, "top", "borderTop") ? 0.75 : 0,
                          borderLeftWidth: sideBorder(cell, "left", "borderLeft") ? 0.75 : 0,
                          borderBottomWidth: sideBorder(cell, "bottom", "borderBottom") ? 0.75 : 1,
                          borderRightWidth: sideBorder(cell, "right", "borderRight") ? 0.75 : 1,
                        }}
                        onMouseDown={() => handleMouseDown(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        onDoubleClick={() => beginEdit(r, c)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="absolute inset-0 w-full bg-white px-1 text-xs outline-none dark:bg-zinc-900"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(true);
                                moveSelection(1, 0);
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                commitEdit(true);
                                // Excel: Tab pindah kanan; bila di kolom terakhir, ke
                                // baris berikutnya kolom pertama.
                                if (selected.c >= sheet.cols - 1) {
                                  onSelect({ r: Math.min(rowCount - 1, selected.r + 1), c: 0 });
                                } else {
                                  moveSelection(0, 1);
                                }
                              } else if (e.key === "Escape") {
                                setEditing(null);
                                refocusGrid();
                              }
                            }}
                          />
                        ) : (
                          <span
                            className={cn(
                              "block",
                              cell?.wrap ? "whitespace-pre-wrap break-words" : "truncate",
                              parsed === "FORMULA" && "font-mono text-emerald-700 dark:text-emerald-400"
                            )}
                            style={
                              // Rotasi memakai `transform: rotate` yang sama
                              // dengan renderer PDF, agar layar & cetak sama
                              // (hindari `writing-mode` yang tak ada di PDF).
                              cell?.rotation
                                ? { display: "inline-block", transform: `rotate(${cell.rotation}deg)` }
                                : undefined
                            }
                          >
                            {displayValue}
                          </span>
                        )}
                        {rowSpan > 1 || colSpan > 1 ? (
                          <span className="pointer-events-none absolute -top-0 -right-0 rounded-bl bg-blue-500/80 px-0.5 text-[8px] leading-tight text-white">
                            {colSpan > 1 ? `↔${colSpan}` : ""}{rowSpan > 1 ? `↕${rowSpan}` : ""}
                          </span>
                        ) : null}
                        {isFillCorner ? (
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 z-[2] h-2.5 w-2.5 rounded-sm border border-white bg-blue-600 shadow-sm",
                              "cursor-crosshair"
                            )}
                            title="Tarik untuk isi otomatis (deret angka/teks)"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setFillActive(true);
                              setFillTarget(null);
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {breakToPage ? (
                  <div className="relative flex items-center" title={`Batas kertas — halaman ${breakToPage}`}>
                    <div className="flex h-4 w-8 shrink-0 items-center justify-center bg-red-100 text-[8px] font-bold text-red-600 dark:bg-red-950/50 dark:text-red-400">
                      {breakToPage}
                    </div>
                    <div className="relative flex h-4 flex-1 items-center">
                      <div className="h-0 flex-1 border-t-2 border-dashed border-red-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 rounded bg-red-500 px-1.5 text-[8px] font-semibold text-white">
                        Batas Kertas · Halaman {breakToPage}
                      </span>
                    </div>
                  </div>
                ) : null}
                {isLastDataRow && pageBreakPlan ? (
                  <div className="flex items-center gap-2 border-y border-dashed border-emerald-400 bg-emerald-50 px-2 py-0.5 text-[9px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <span className="font-semibold">▣ Akhir data</span>
                    <span>·</span>
                    <span>
                      Total {pageBreakPlan.pageCount} halaman
                      {pageBreakPlan.rowsPerPage.length
                        ? ` (${pageBreakPlan.rowsPerPage.map((n, i) => `hal ${i + 1}: ${n} baris`).join(", ")})`
                        : ""}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}

          <ShapeLayer
            shapes={sheet.shapes || []}
            images={sheet.images || []}
            scale={scale}
            marginLeftPx={marginPx?.left ?? 0}
            marginTopPx={marginPx?.top ?? 0}
            selectedId={selectedShapeId}
            onSelect={setSelectedShapeId}
            onDelete={(id) => {
              onChange({
                ...sheet,
                shapes: (sheet.shapes || []).filter((s) => s.id !== id),
                images: (sheet.images || []).filter((im) => im.id !== id),
              });
              setSelectedShapeId(null);
            }}
            onChange={(shapes, images) => onChange({ ...sheet, shapes, images })}
            readOnly={readOnly}
          />
        </div>
        </div>
      </div>
      </div>

      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onCut={() => { cutSelection(); setCtxMenu(null); }}
          onCopy={() => { copySelection(); setCtxMenu(null); }}
          onPaste={() => { void pasteClipboard(); setCtxMenu(null); }}
          onPasteValues={() => { pasteValuesOnly(); setCtxMenu(null); }}
          onPasteFormat={() => { pasteFormatOnly(); setCtxMenu(null); }}
          onClear={() => { const b = rectBounds(); if (b) clearBlock(b); setCtxMenu(null); }}
          onInsertRowAbove={() => { insertRowAt(ctxMenu.r); setCtxMenu(null); }}
          onInsertRowBelow={() => { insertRowAt(ctxMenu.r + 1); setCtxMenu(null); }}
          onDeleteRow={() => { deleteRowAt(ctxMenu.r); setCtxMenu(null); }}
          onHideRow={() => { toggleHideRowAt(ctxMenu.r, !isRowHidden(sheet, ctxMenu.r)); setCtxMenu(null); }}
          rowHidden={isRowHidden(sheet, ctxMenu.r)}
          onInsertColLeft={() => { insertColumnAt(ctxMenu.c); setCtxMenu(null); }}
          onInsertColRight={() => { insertColumnAt(ctxMenu.c + 1); setCtxMenu(null); }}
          onDuplicateCol={() => { duplicateColumnAt(ctxMenu.c); setCtxMenu(null); }}
          onDeleteCol={() => { deleteColumnAt(ctxMenu.c); setCtxMenu(null); }}
          onHideCol={() => { toggleHideColumnAt(ctxMenu.c, !isColHidden(sheet, ctxMenu.c)); setCtxMenu(null); }}
          colHidden={isColHidden(sheet, ctxMenu.c)}
          onBold={() => { patchSelected({ bold: !current?.bold }); setCtxMenu(null); }}
          onCenter={() => { patchSelected({ align: "center" }); setCtxMenu(null); }}
          onMerge={() => { mergeSelection(); setCtxMenu(null); }}
          onSplit={() => { unmergeSelection(); setCtxMenu(null); }}
          canMerge={canMerge}
          isMerged={isMerged}
        />
      ) : null}

      <div className="flex shrink-0 items-center gap-2 border-t bg-card px-2 py-1.5">
        {!hideToolbar ? (
          <span className="text-[10px] text-muted-foreground">
            Kontrol baris & kolom dipindah ke ribbon <b>Insert</b>.
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Klik header A/B/C atau nomor baris untuk blok. Tarik tuas biru di sudut sel untuk deret otomatis. Tarik batas header untuk ubah ukuran, klik dua kali untuk auto-fit.
          </span>
        )}
        {rect && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-[11px]" onClick={() => setRect(null)}>
            <X className="h-3.5 w-3.5" /> Batal Pilih
          </Button>
        )}
      </div>

      {/* Bar tab lembar (bawah), ala Excel */}
      {sheetTabs && sheetTabs.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t bg-muted/40 px-1 py-1">
          {sheetTabs.map((s, i) => {
            const active = i === activeSheetIdx;
            if (renamingSheet === i) {
              return (
                <input
                  key={s.id}
                  autoFocus
                  className="h-6 w-28 rounded border bg-background px-2 text-[11px] outline-none"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) onRenameSheet?.(i, renameValue.trim());
                    setRenamingSheet(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (renameValue.trim()) onRenameSheet?.(i, renameValue.trim());
                      setRenamingSheet(null);
                    } else if (e.key === "Escape") {
                      setRenamingSheet(null);
                    }
                  }}
                />
              );
            }
            return (
              <button
                key={s.id}
                type="button"
                className={cn(
                  "h-6 shrink-0 rounded-t border-b-2 px-3 text-[11px] font-medium transition-colors",
                  active
                    ? "border-blue-500 bg-card text-blue-700 dark:text-blue-300"
                    : "border-transparent text-muted-foreground hover:bg-accent"
                )}
                onClick={() => onSelectSheet?.(i)}
                onDoubleClick={() => {
                  setRenamingSheet(i);
                  setRenameValue(s.name);
                }}
                title={`${s.name} — klik dua kali untuk ganti nama`}
              >
                {s.name}
              </button>
            );
          })}
          {onAddSheet ? (
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onAddSheet} title="Tambah lembar">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onRemoveSheet && sheetTabs.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-red-600"
              onClick={() => onRemoveSheet(activeSheetIdx)}
              title="Hapus lembar aktif"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

/** Menu konteks klik-kanan ala Excel. */
function ContextMenu(props: {
  x: number;
  y: number;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onPasteValues: () => void;
  onPasteFormat: () => void;
  onClear: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteRow: () => void;
  onHideRow: () => void;
  rowHidden: boolean;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDuplicateCol: () => void;
  onDeleteCol: () => void;
  onHideCol: () => void;
  colHidden: boolean;
  onBold: () => void;
  onCenter: () => void;
  onMerge: () => void;
  onSplit: () => void;
  canMerge: boolean;
  isMerged: boolean;
}) {
  useEffect(() => {
    const close = () => props.onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [props]);
  const item = "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-40";
  return (
    <div
      className="fixed z-50 min-w-[190px] rounded-md border bg-popover p-1 shadow-lg"
      style={{ left: props.x, top: props.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className={item} onClick={props.onCut}>Cut <span className="ml-auto text-[9px] text-muted-foreground">Ctrl+X</span></button>
      <button type="button" className={item} onClick={props.onCopy}>Copy <span className="ml-auto text-[9px] text-muted-foreground">Ctrl+C</span></button>
      <button type="button" className={item} onClick={props.onPaste}>Paste <span className="ml-auto text-[9px] text-muted-foreground">Ctrl+V</span></button>
      <button type="button" className={item} onClick={props.onPasteValues}>Paste Values Only</button>
      <button type="button" className={item} onClick={props.onPasteFormat}>Paste Format Only</button>
      <button type="button" className={item} onClick={props.onClear}>Clear</button>
      <div className="my-1 h-px bg-border" />
      <button type="button" className={item} onClick={props.onInsertRowAbove}>Insert Row Above</button>
      <button type="button" className={item} onClick={props.onInsertRowBelow}>Insert Row Below</button>
      <button type="button" className={item} onClick={props.onDeleteRow}>Delete Row</button>
      <button type="button" className={item} onClick={props.onHideRow}>{props.rowHidden ? "Unhide Row" : "Hide Row"}</button>
      <div className="my-1 h-px bg-border" />
      <button type="button" className={item} onClick={props.onInsertColLeft}>Insert Column Left</button>
      <button type="button" className={item} onClick={props.onInsertColRight}>Insert Column Right</button>
      <button type="button" className={item} onClick={props.onDuplicateCol}>Duplicate Column</button>
      <button type="button" className={item} onClick={props.onDeleteCol}>Delete Column</button>
      <button type="button" className={item} onClick={props.onHideCol}>{props.colHidden ? "Unhide Column" : "Hide Column"}</button>
      <div className="my-1 h-px bg-border" />
      <button type="button" className={item} onClick={props.onBold}>Toggle Bold</button>
      <button type="button" className={item} onClick={props.onCenter}>Align Center</button>
      <button type="button" className={item} disabled={!props.canMerge} onClick={props.onMerge}>Merge Cells</button>
      <button type="button" className={item} disabled={!props.isMerged} onClick={props.onSplit}>Split Cells</button>
    </div>
  );
}

const BORDER_COLOR = "#cbd5e1";

/** 1 pt = 25.4/72 mm. Dipakai untuk label ukuran shape. */
const PT_TO_MM = 25.4 / 72;
function fmtMm(pt: number): string {
  return `${(pt * PT_TO_MM).toFixed(1)} mm`;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * Lapisan shape mengambang di atas grid. Semua shape digambar sebagai SVG
 * absolut di koordinat pt relatif area konten (dikalikan `scale`). Mendukung
 * pemilihan, geser, dan resize interaktif lewat 8 handle + label ukuran.
 */
function ShapeLayer(props: {
  shapes: ReportShape[];
  images: ReportImage[];
  scale: number;
  marginLeftPx: number;
  marginTopPx: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (id: string) => void;
  onChange: (shapes: ReportShape[], images: ReportImage[]) => void;
  readOnly?: boolean;
}) {
  const { shapes, images, scale, marginLeftPx, marginTopPx, selectedId, readOnly } = props;

  type OverlayBox = { x: number; y: number; width: number; height: number; rotation?: number; type?: ReportShapeType };

  const patchShape = (id: string, next: Partial<ReportShape>) =>
    props.onChange(shapes.map((s) => (s.id === id ? { ...s, ...next } : s)), images);
  const patchImage = (id: string, next: Partial<ReportImage>) =>
    props.onChange(shapes, images.map((im) => (im.id === id ? { ...im, ...next } : im)));

  const isImage = (id: string) => images.some((im) => im.id === id);
  const patch = (id: string, next: Partial<ReportShape>) =>
    isImage(id) ? patchImage(id, next) : patchShape(id, next);

  const startMove = (e: React.MouseEvent, box: OverlayBox & { id: string }) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    props.onSelect(box.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = box.x;
    const oy = box.y;
    const move = (ev: MouseEvent) => {
      patch(box.id, { x: Math.round(ox + (ev.clientX - startX) / scale), y: Math.round(oy + (ev.clientY - startY) / scale) });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startResize = (e: React.MouseEvent, box: OverlayBox & { id: string }, handle: ResizeHandle) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    props.onSelect(box.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const o = { ...box };
    const minWidth = box.type === "rect" || box.type === undefined ? 2 : 1;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      let { x, y, width, height } = o;
      if (handle.includes("e")) width = Math.max(minWidth, Math.round(o.width + dx));
      if (handle.includes("s")) height = Math.max(0, Math.round(o.height + dy));
      if (handle.includes("w")) {
        width = Math.max(minWidth, Math.round(o.width - dx));
        x = Math.round(o.x + (o.width - width));
      }
      if (handle.includes("n")) {
        height = Math.max(0, Math.round(o.height - dy));
        y = Math.round(o.y + (o.height - height));
      }
      patch(box.id, { x, y, width, height });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handlePos: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
    nw: { left: "0", top: "0", cursor: "nwse-resize" },
    n: { left: "50%", top: "0", cursor: "ns-resize" },
    ne: { left: "100%", top: "0", cursor: "nesw-resize" },
    e: { left: "100%", top: "50%", cursor: "ew-resize" },
    se: { left: "100%", top: "100%", cursor: "nwse-resize" },
    s: { left: "50%", top: "100%", cursor: "ns-resize" },
    sw: { left: "0", top: "100%", cursor: "nesw-resize" },
    w: { left: "0", top: "50%", cursor: "ew-resize" },
  };

  const selectionChrome = (id: string, box: OverlayBox) => (
    <>
      <div
        className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ pointerEvents: "none" }}
      >
        {fmtMm(box.width)} × {fmtMm(box.height)}
      </div>
      <button
        type="button"
        className="absolute -top-6 right-0 flex h-5 w-5 items-center justify-center rounded-sm bg-red-600 text-xs leading-none text-white hover:bg-red-700"
        style={{ cursor: "pointer" }}
        title="Hapus"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete?.(id);
        }}
      >
        ×
      </button>
      {(Object.keys(handlePos) as ResizeHandle[]).map((hd) => (
        <div
          key={hd}
          className="absolute h-2 w-2 rounded-sm border border-blue-600 bg-white"
          style={{
            left: handlePos[hd].left,
            top: handlePos[hd].top,
            transform: "translate(-50%, -50%)",
            cursor: handlePos[hd].cursor,
          }}
          onMouseDown={(e) => startResize(e, { ...box, id }, hd)}
        />
      ))}
    </>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[7]">
      {shapes.map((shape) => {
        const selected = shape.id === selectedId;
        const w = Math.max(shape.width * scale, 1);
        const h = Math.max(shape.height * scale, 1);
        const sw = Math.max(shape.strokeWidth ?? 1, 0) * scale;
        const stroke = shape.stroke || "#000000";
        const fill = shape.fill || "none";
        const box = { id: shape.id, x: shape.x, y: shape.y, width: shape.width, height: shape.height, rotation: shape.rotation, type: shape.type };
        return (
          <div
            key={shape.id}
            className="pointer-events-auto absolute"
            style={{
              left: marginLeftPx + shape.x * scale,
              top: marginTopPx + shape.y * scale,
              width: w,
              height: Math.max(h, shape.type === "line" ? Math.max(sw, 1) : h),
              transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
              cursor: readOnly ? "default" : "move",
              outline: selected ? "1px dashed #3b82f6" : "none",
              outlineOffset: 2,
            }}
            onMouseDown={(e) => startMove(e, box)}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <svg width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>              {shape.type === "line" ? (
                <line x1={0} y1={0} x2={w} y2={Math.max(h, 0)} stroke={stroke} strokeWidth={sw || 1} />
              ) : shape.type === "rect" ? (
                <rect x={0} y={0} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={sw} />
              ) : (
                <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
              )}
            </svg>
            {selected && !readOnly ? selectionChrome(shape.id, box) : null}
          </div>
        );
      })}

      {images.map((img) => {
        const selected = img.id === selectedId;
        const w = Math.max(img.width * scale, 1);
        const h = Math.max(img.height * scale, 1);
        const box = { id: img.id, x: img.x, y: img.y, width: img.width, height: img.height, rotation: img.rotation };
        return (
          <div
            key={img.id}
            className="pointer-events-auto absolute"
            style={{
              left: marginLeftPx + img.x * scale,
              top: marginTopPx + img.y * scale,
              width: w,
              height: h,
              transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
              cursor: readOnly ? "default" : "move",
              outline: selected ? "1px dashed #3b82f6" : "none",
              outlineOffset: 2,
            }}
            onMouseDown={(e) => startMove(e, box)}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
              onError={(e) => {
                // Gambar gagal dimuat (mis. URL lama yang tak disajikan) → tampilkan
                // placeholder agar tidak crash / kotak rusak.
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
              }}
            />
            <div
              className="absolute inset-0 hidden items-center justify-center bg-slate-100 text-[10px] text-slate-400 dark:bg-zinc-800"
              style={{ display: "none" }}
            >
              Gambar tidak dapat dimuat
            </div>
            {selected && !readOnly ? selectionChrome(img.id, box) : null}
          </div>
        );
      })}
    </div>
  );
}
