"use client";

/**
 * report-ribbon.tsx — Ribbon ala Excel untuk Studio Format Laporan.
 *
 * Struktur: satu baris judul (kembali, identitas template, simpan, ekspor) di
 * atas, lalu tab (Home/Insert/Page Layout/Data/View) berisi kelompok kontrol.
 * Semua kontrol yang dulu tersebar di header & panel kanan dipusatkan di sini.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignVerticalJustifyCenter,
  Merge,
  SplitSquareHorizontal,
  Plus,
  Minus,
  Undo2,
  Redo2,
  Save,
  Eye,
  FileText,
  FileSpreadsheet,
  FileDown,
  Printer,
  Database,
  Download,
  Upload,
  Scissors,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  LogOut,
  Loader2,
  Grid3x3,
  Rows3,
  Table2,
  Trash2,
  Home,
  SquarePlus,
  WrapText,
  Paintbrush,
  Search,
  ArrowUpDown,
  Snowflake,
  Braces,
  FunctionSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ReportDensity,
  type ReportPaperSize,
  type ReportOrientation,
  type ReportWorkbook,
  type SheetCell,
  type ReportShape,
  type ReportShapeType,
} from "@/lib/config/report-sheet";
import { cn } from "@/lib/utils";
import { REPORT_DENSITY_PRESETS } from "@/lib/config/report-document";
import { REPORT_FONT_OPTIONS } from "@/lib/report-fonts";
import {
  REPORT_VARIABLE_MODULES,
  getVariableModule,
  listVars,
  FORMULA_TEMPLATES,
  type ReportVariableSample,
} from "@/lib/report-variables";
import type { PageBreakPlan } from "@/lib/report-paginate";

/** Sampel variabel/global yang ditampilkan sebagai badge di ribbon. */
export type RibbonVariableSample = ReportVariableSample;

// Katalog template rumus & daftar variabel adalah sumber tunggal di
// report-variables.ts (diturunkan dari ENGINE_FUNCTIONS). Re-ekspor di sini
// agar konsumen lama yang mengimpor dari ribbon tetap bekerja.
export { FORMULA_TEMPLATES };

export interface ReportRibbonProps {
  wb: ReportWorkbook;
  currentCell: SheetCell | undefined;
  datasetKeys: string[];
  datasetCount: number;
  /** Modul peruntukan format (untuk filter variabel). "umum" bila generik. */
  module?: string;
  pageBreakPlan: PageBreakPlan;
  showPageBreaks: boolean;
  zoom: number | null;
  effectiveScale: number;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  generating: boolean;
  templateList: { id: number | string; name: string; category: string }[];
  selectedTplId: string;
  onExit: () => void;
  onBack: () => void;
  onSelectTemplate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPreview: () => void;
  onDownloadPdf: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDataDialog: () => void;
  onChangeMeta: (patch: Partial<ReportWorkbook>) => void;
  onChangeCell: (patch: Partial<SheetCell>) => void;
  onInsertCellValue: (value: string) => void;
  onClearCell: () => void;
  onMerge: () => void;
  onSplit: () => void;
  canMerge: boolean;
  isMerged: boolean;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  /** Bagi lebar area konten kertas secara proporsional ke seluruh kolom. */
  onFitColumnsToWidth: () => void;
  /** Rasio lebar total kolom terhadap area cetak (1 = pas). */
  printWidthRatio: number;
  /** Hitung skala cetak otomatis agar tabel muat 1 halaman lebar. */
  onScaleToFitPage: () => void;
  onAddRow: () => void;
  onRemoveRow: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  /** Shape. */
  onAddShape: (type: ReportShapeType) => void;
  onChangeShape: (patch: Partial<ReportShape>) => void;
  onDeleteShape: () => void;
  selectedShape: ReportShape | null;
  /** Gambar mengambang. */
  onAddImage: (src: string) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedImage: { id: string; src: string; x: number; y: number; width: number; height: number; rotation?: number } | null;
  onChangeImage: (patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>) => void;
  onAddSheet: () => void;
  onToggleRowRepeat: () => void;
  rowRepeat: boolean;
  sheets: { id: string; name: string }[];
  activeSheetIdx: number;
  onSelectSheet: (idx: number) => void;
  onRemoveSheet: (idx: number) => void;
  onTogglePageBreaks: () => void;
  onZoom: (zoom: number | null) => void;
  onApplyDensity: (density: ReportDensity) => void;
  onSetRowHeight: (heightPt: number | undefined) => void;
  rowHeight: number | undefined;
  /**
   * Variabel global/skala. Opsional: bila tak diberikan, ribbon memakai sumber
   * tunggal dari report-variables.ts (`listVars().generalVars`).
   */
  generalVars?: RibbonVariableSample[];
  /** Format painter aktif. */
  isClipboardFormatting: boolean;
  onToggleFormatPainter: () => void;
  /** Cari & ganti. */
  onFindReplace: () => void;
  /** Freeze. */
  freezeCols: number;
  freezeRows: number;
  onSetFreeze: (cols: number, rows: number) => void;
  /** Sort & filter dataset simulasi. */
  onOpenSortFilter: () => void;
  /** Conditional formatting. */
  onOpenConditional: () => void;
}

const FUTURE_TOOLTIP = "Segera: ekspor ini sedang disiapkan.";

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 border-r px-2 last:border-r-0">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Actions — himpunan callback STABIL. Dibangun sekali (deps kosong) dan membaca
// props terbaru via `propsRef`, jadi identitasnya tak pernah berubah dan tab
// memo tidak ikut re-render hanya karena handler dibuat ulang.
// ─────────────────────────────────────────────────────────────────────────

interface RibbonActions {
  onExit: () => void;
  onSelectTemplate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPreview: () => void;
  onDownloadPdf: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDataDialog: () => void;
  onOpenSortFilter: () => void;
  onOpenConditional: () => void;
  onFindReplace: () => void;
  onChangeMeta: (patch: Partial<ReportWorkbook>) => void;
  onChangeCell: (patch: Partial<SheetCell>) => void;
  onClearCell: () => void;
  /** Set nilai sel apa adanya (dipakai input "Cell Content"). */
  setCellValueRaw: (value: string) => void;
  /** Sisipkan token ke nilai sel aktif — append, bukan timpa. */
  insertToken: (token: string) => void;
  onMerge: () => void;
  onSplit: () => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onFitColumnsToWidth: () => void;
  onScaleToFitPage: () => void;
  onAddRow: () => void;
  onRemoveRow: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onAddShape: (type: ReportShapeType) => void;
  onChangeShape: (patch: Partial<ReportShape>) => void;
  onDeleteShape: () => void;
  onAddImage: (src: string) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeImage: (patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>) => void;
  onAddSheet: () => void;
  onToggleRowRepeat: () => void;
  onSelectSheet: (idx: number) => void;
  onRemoveSheet: (idx: number) => void;
  onTogglePageBreaks: () => void;
  onZoom: (zoom: number | null) => void;
  onApplyDensity: (density: ReportDensity) => void;
  onSetRowHeight: (heightPt: number | undefined) => void;
  onToggleFormatPainter: () => void;
  onSetFreeze: (cols: number, rows: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Title bar (memo) — hanya re-render bila identitas template/status berubah.
// ─────────────────────────────────────────────────────────────────────────

interface TitleBarProps {
  reportCode: string;
  reportName: string;
  templateList: { id: number | string; name: string; category: string }[];
  selectedTplId: string;
  saving: boolean;
  onExit: () => void;
  onSelectTemplate: (id: string) => void;
  onSave: () => void;
  onChangeMeta: (patch: Partial<ReportWorkbook>) => void;
}

const TitleBar = memo(function TitleBar({
  reportCode,
  reportName,
  templateList,
  selectedTplId,
  saving,
  onExit,
  onSelectTemplate,
  onSave,
  onChangeMeta,
}: TitleBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
      <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5" title="Keluar Studio">
        <ArrowLeft className="h-4 w-4" /> Exit
      </Button>
      <div className="flex items-center gap-1.5">
        <Input
          className="h-7 w-40 text-xs font-mono"
          placeholder="RPT_TABUNG"
          value={reportCode}
          onChange={(e) => onChangeMeta({ reportCode: e.target.value })}
        />
        <Input
          className="h-7 w-52 text-xs"
          placeholder="Nama Laporan"
          value={reportName}
          onChange={(e) => onChangeMeta({ reportName: e.target.value })}
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="w-44">
          <Select value={selectedTplId} onValueChange={onSelectTemplate}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Load Template..." />
            </SelectTrigger>
            <SelectContent>
              {templateList.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name} ({t.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          className="h-7 bg-blue-600 text-white hover:bg-blue-700"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────────────────────────────────

interface HomeTabProps {
  currentCell: SheetCell | undefined;
  baseFontSize: number;
  canUndo: boolean;
  canRedo: boolean;
  canMerge: boolean;
  isMerged: boolean;
  isClipboardFormatting: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeCell: (patch: Partial<SheetCell>) => void;
  onMerge: () => void;
  onSplit: () => void;
  onToggleFormatPainter: () => void;
  onClearCell: () => void;
  setCellValueRaw: (value: string) => void;
  onExit: () => void;
}

const HomeTab = memo(function HomeTab({
  currentCell,
  baseFontSize,
  canUndo,
  canRedo,
  canMerge,
  isMerged,
  isClipboardFormatting,
  onUndo,
  onRedo,
  onChangeCell,
  onMerge,
  onSplit,
  onToggleFormatPainter,
  onClearCell,
  setCellValueRaw,
  onExit,
}: HomeTabProps) {
  return (
    <TabsContent value="home" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Clipboard">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Font">
        <select
          className="h-7 w-28 rounded border bg-background px-1 text-[11px]"
          value={currentCell?.fontFamily || "Helvetica"}
          onChange={(e) => onChangeCell({ fontFamily: e.target.value as SheetCell["fontFamily"] })}
          title="Jenis font"
        >
          {REPORT_FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <Input
          type="number"
          min={6}
          max={72}
          className="h-7 w-14 text-[11px]"
          value={currentCell?.fontSize ?? baseFontSize}
          onChange={(e) => onChangeCell({ fontSize: Math.max(6, Math.min(72, Number(e.target.value) || baseFontSize)) })}
          title="Ukuran font"
        />
        <Button variant={currentCell?.bold ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ bold: !currentCell?.bold })} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.italic ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ italic: !currentCell?.italic })} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.underline ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ underline: !currentCell?.underline })} title="Underline">
          <Underline className="h-3.5 w-3.5" />
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Alignment">
        <Button variant={currentCell?.align === "left" || !currentCell?.align ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ align: "left" })} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.align === "center" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ align: "center" })} title="Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.align === "right" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ align: "right" })} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant={!currentCell?.vertical || currentCell?.vertical === "top" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ vertical: "top" })} title="Align Top">
          <ArrowUpToLine className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.vertical === "middle" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ vertical: "middle" })} title="Align Middle">
          <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
        </Button>
        <Button variant={currentCell?.vertical === "bottom" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onChangeCell({ vertical: "bottom" })} title="Align Bottom">
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Style">
        <label className="flex flex-col items-center">
          <input
            type="color"
            className="h-6 w-8 cursor-pointer rounded border bg-background"
            value={currentCell?.bg || "#ffffff"}
            onChange={(e) => onChangeCell({ bg: e.target.value })}
            title="Warna latar sel"
          />
          <span className="text-[8px] text-muted-foreground">Fill</span>
        </label>
        <label className="flex flex-col items-center">
          <input
            type="color"
            className="h-6 w-8 cursor-pointer rounded border bg-background"
            value={currentCell?.color || "#000000"}
            onChange={(e) => onChangeCell({ color: e.target.value })}
            title="Warna teks"
          />
          <span className="text-[8px] text-muted-foreground">Text</span>
        </label>
        <Button
          variant={currentCell?.wrap ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onChangeCell({ wrap: !currentCell?.wrap })}
          title="Wrap text"
        >
          <WrapText className="h-3.5 w-3.5" />
        </Button>
        <div className="flex flex-col items-center">
          <Input
            type="number"
            className="h-6 w-12 text-[10px]"
            placeholder="0"
            value={currentCell?.indent ?? 0}
            onChange={(e) => onChangeCell({ indent: Number(e.target.value) || 0 })}
          />
          <span className="text-[8px] text-muted-foreground">Indent</span>
        </div>
        <div className="flex flex-col items-center">
          <select
            className="h-6 rounded border bg-background px-1 text-[10px]"
            value={currentCell?.rotation ?? 0}
            onChange={(e) => onChangeCell({ rotation: Number(e.target.value) || 0 })}
          >
            <option value={0}>0°</option>
            <option value={45}>45°</option>
            <option value={90}>90°</option>
          </select>
          <span className="text-[8px] text-muted-foreground">Rotasi</span>
        </div>
        <Button
          variant={isClipboardFormatting ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={onToggleFormatPainter}
          title="Format Painter (tempel gaya)"
        >
          <Paintbrush className="h-3.5 w-3.5" />
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Number & Border">
        <select
          className="h-7 rounded border bg-background px-1 text-[11px]"
          value={currentCell?.format || "text"}
          onChange={(e) => onChangeCell({ format: e.target.value as SheetCell["format"] })}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="rupiah">Rupiah</option>
          <option value="date">Date</option>
        </select>
        <select
          className="h-7 rounded border bg-background px-1 text-[11px]"
          value={currentCell?.border || "none"}
          onChange={(e) => onChangeCell({ border: e.target.value as SheetCell["border"] })}
        >
          <option value="none">No Border</option>
          <option value="all">All Border</option>
          <option value="box">Box Border</option>
        </select>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex gap-0.5">
            <Button variant={currentCell?.borderTop ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => onChangeCell({ borderTop: !currentCell?.borderTop })} title="Border atas">
              Atas
            </Button>
            <Button variant={currentCell?.borderBottom ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => onChangeCell({ borderBottom: !currentCell?.borderBottom })} title="Border bawah">
              Bawah
            </Button>
          </div>
          <div className="flex gap-0.5">
            <Button variant={currentCell?.borderLeft ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => onChangeCell({ borderLeft: !currentCell?.borderLeft })} title="Border kiri">
              Kiri
            </Button>
            <Button variant={currentCell?.borderRight ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => onChangeCell({ borderRight: !currentCell?.borderRight })} title="Border kanan">
              Kanan
            </Button>
          </div>
        </div>
        <label className="flex flex-col items-center" title="Warna border">
          <input
            type="color"
            className="h-6 w-8 cursor-pointer rounded border bg-background"
            value={currentCell?.borderColor || "#000000"}
            onChange={(e) => onChangeCell({ borderColor: e.target.value })}
          />
          <span className="text-[8px] text-muted-foreground">Border</span>
        </label>
      </RibbonGroup>

      <RibbonGroup label="Cells">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onMerge} disabled={!canMerge}>
          <Merge className="h-3.5 w-3.5" /> Merge
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onSplit} disabled={!isMerged}>
          <SplitSquareHorizontal className="h-3.5 w-3.5" /> Split
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Cell Content">
        <input
          className="h-7 w-56 rounded border bg-background px-2 font-mono text-[11px]"
          value={currentCell?.value ?? ""}
          placeholder="Text, {{var}}, {field}, =SUM(A1:A5)"
          onChange={(e) => setCellValueRaw(e.target.value)}
        />
        <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-600" onClick={onClearCell}>
          Clear
        </Button>
      </RibbonGroup>

      <RibbonGroup label="File">
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={onExit} title="Keluar dari mode Studio">
          <LogOut className="h-3.5 w-3.5" /> Exit
        </Button>
      </RibbonGroup>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// INSERT TAB
// ─────────────────────────────────────────────────────────────────────────

interface InsertTabProps {
  printWidthRatio: number;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onRemoveRow: () => void;
  onRemoveColumn: () => void;
  onFitColumnsToWidth: () => void;
  onAddShape: (type: ReportShapeType) => void;
  selectedShape: ReportShape | null;
  onChangeShape: (patch: Partial<ReportShape>) => void;
  onDeleteShape: () => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedImage: { id: string; src: string; x: number; y: number; width: number; height: number; rotation?: number } | null;
  onChangeImage: (patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>) => void;
  onAddSheet: () => void;
  sheets: { id: string; name: string }[];
  activeSheetIdx: number;
  onSelectSheet: (idx: number) => void;
  onRemoveSheet: (idx: number) => void;
  rowRepeat: boolean;
  onToggleRowRepeat: () => void;
}

const InsertTab = memo(function InsertTab({
  printWidthRatio,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColLeft,
  onInsertColRight,
  onRemoveRow,
  onRemoveColumn,
  onFitColumnsToWidth,
  onAddShape,
  selectedShape,
  onChangeShape,
  onDeleteShape,
  onUploadImage,
  selectedImage,
  onChangeImage,
  onAddSheet,
  sheets,
  activeSheetIdx,
  onSelectSheet,
  onRemoveSheet,
  rowRepeat,
  onToggleRowRepeat,
}: InsertTabProps) {
  return (
    <TabsContent value="insert" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Rows & Columns">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onInsertRowAbove} title="Sisipkan baris di atas sel terpilih">
          <Plus className="h-3.5 w-3.5" /> Row Above
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onInsertRowBelow} title="Sisipkan baris di bawah sel terpilih">
          <Plus className="h-3.5 w-3.5" /> Row Below
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onInsertColLeft} title="Sisipkan kolom di kiri sel terpilih">
          <Plus className="h-3.5 w-3.5" /> Col Left
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onInsertColRight} title="Sisipkan kolom di kanan sel terpilih">
          <Plus className="h-3.5 w-3.5" /> Col Right
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onRemoveRow} title="Hapus baris terakhir">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onRemoveColumn} title="Hapus kolom terakhir">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button
          variant={printWidthRatio > 1.001 ? "default" : "outline"}
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={onFitColumnsToWidth}
          title="Ubah lebar kolom agar tabel pas dengan area cetak (proporsional)"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Fit to Width
        </Button>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
            printWidthRatio > 1.001
              ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
              : printWidthRatio < 0.999
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          )}
          title="Lebar total kolom relatif terhadap area cetak"
        >
          {Math.round(printWidthRatio * 100)}% lebar cetak
        </span>
      </RibbonGroup>
      <RibbonGroup label="Shapes">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onAddShape("line")} title="Garis pemisah">
          Garis
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onAddShape("rect")} title="Kotak (mis. area materai/foto)">
          Kotak
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onAddShape("ellipse")} title="Elips">
          Elips
        </Button>
        {selectedShape ? (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <label className="flex flex-col items-center" title="Isian shape">
              <input
                type="color"
                className="h-6 w-8 cursor-pointer rounded border bg-background"
                value={selectedShape.fill || "#ffffff"}
                onChange={(e) => onChangeShape({ fill: e.target.value })}
              />
              <span className="text-[8px] text-muted-foreground">Fill</span>
            </label>
            <label className="flex flex-col items-center" title="Garis tepi shape">
              <input
                type="color"
                className="h-6 w-8 cursor-pointer rounded border bg-background"
                value={selectedShape.stroke || "#000000"}
                onChange={(e) => onChangeShape({ stroke: e.target.value })}
              />
              <span className="text-[8px] text-muted-foreground">Outline</span>
            </label>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                className="h-6 w-12 text-[10px]"
                value={selectedShape.strokeWidth ?? 1}
                min={0}
                onChange={(e) => onChangeShape({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span className="text-[8px] text-muted-foreground">Tebal</span>
            </div>
            <Button variant={selectedShape.fill ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => onChangeShape({ fill: selectedShape?.fill ? "" : "#ffffff" })} title="Toggle isian">
              {selectedShape.fill ? "Isi" : "Kosong"}
            </Button>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                className="h-6 w-14 text-[10px]"
                value={selectedShape.width}
                min={1}
                onChange={(e) => onChangeShape({ width: Math.max(1, Number(e.target.value) || 1) })}
                title="Lebar (pt)"
              />
              <span className="text-[8px] text-muted-foreground">L (pt)</span>
            </div>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                className="h-6 w-14 text-[10px]"
                value={selectedShape.height}
                min={0}
                onChange={(e) => onChangeShape({ height: Math.max(0, Number(e.target.value) || 0) })}
                title="Tinggi (pt)"
              />
              <span className="text-[8px] text-muted-foreground">T (pt)</span>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onDeleteShape} title="Hapus shape">
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
        <span className="mx-1 h-5 w-px bg-border" />
        <label className="cursor-pointer" title="Unggah gambar (logo, foto, materai)">
          <input type="file" accept="image/*" className="hidden" onChange={onUploadImage} />
          <div className="flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
            <Upload className="h-3.5 w-3.5" /> Gambar
          </div>
        </label>
        {selectedImage ? (
          <>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                className="h-6 w-14 text-[10px]"
                value={selectedImage.width}
                min={1}
                onChange={(e) => onChangeImage({ width: Math.max(1, Number(e.target.value) || 1) })}
                title="Lebar gambar (pt)"
              />
              <span className="text-[8px] text-muted-foreground">L (pt)</span>
            </div>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                className="h-6 w-14 text-[10px]"
                value={selectedImage.height}
                min={1}
                onChange={(e) => onChangeImage({ height: Math.max(1, Number(e.target.value) || 1) })}
                title="Tinggi gambar (pt)"
              />
              <span className="text-[8px] text-muted-foreground">T (pt)</span>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onDeleteShape} title="Hapus gambar">
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
      </RibbonGroup>
      <RibbonGroup label="Sheets">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onAddSheet}>
          <Grid3x3 className="h-3.5 w-3.5" /> Add Sheet
        </Button>
        <div className="w-36">
          <Select
            value={String(activeSheetIdx)}
            onValueChange={(v) => onSelectSheet(Number(v))}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Lembar" />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((s, i) => (
                <SelectItem key={s.id} value={String(i)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 text-red-600"
          onClick={() => onRemoveSheet(activeSheetIdx)}
          disabled={sheets.length <= 1}
          title="Hapus lembar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </RibbonGroup>
      <RibbonGroup label="Row Repeat">
        <Button
          variant={rowRepeat ? "default" : "outline"}
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={onToggleRowRepeat}
          title="Paksa baris terpilih diulang mengikuti data"
        >
          <Rows3 className="h-3.5 w-3.5" /> {rowRepeat ? "Repeating" : "Force Repeat"}
        </Button>
      </RibbonGroup>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// VARIABEL TAB
// ─────────────────────────────────────────────────────────────────────────

interface VarTabProps {
  /** Modul aktif (derived dari workbook / props.module). */
  activeModule: string;
  datasetKeys: string[];
  generalVars: RibbonVariableSample[];
  insertToken: (token: string) => void;
}

const VarTab = memo(function VarTab({
  activeModule,
  datasetKeys,
  generalVars,
  insertToken,
}: VarTabProps) {
  // Sinkronkan modul terpilih dengan modul aktif: saat template dimuat (modul
  // berubah) daftar variabel ikut menyesuaikan. Katalog tetap satu sumber
  // (report-variables.ts), state lokal hanya untuk filter di UI.
  const [varModule, setVarModule] = useState<string>(activeModule);
  const [varQuery, setVarQuery] = useState("");
  useEffect(() => {
    setVarModule(activeModule);
  }, [activeModule]);

  const listVars = useMemo(() => datasetKeys.map((k) => `{${k}}`), [datasetKeys]);
  const variableModule = useMemo(() => getVariableModule(varModule), [varModule]);
  const filteredVarGroups = useMemo(() => {
    const q = varQuery.trim().toLowerCase();
    if (!q) return variableModule.groups;
    return variableModule.groups
      .map((g) => ({
        ...g,
        fields: g.fields.filter(
          (f) => f.label.toLowerCase().includes(q) || f.token.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.fields.length > 0);
  }, [variableModule, varQuery]);

  return (
    <TabsContent value="variables" className="mt-0 flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center gap-2 px-2">
        <div className="w-52">
          <Select value={varModule} onValueChange={setVarModule}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Pilih modul..." />
            </SelectTrigger>
            <SelectContent>
              {REPORT_VARIABLE_MODULES.map((m) => (
                <SelectItem key={m.module} value={m.module}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-xs"
            placeholder="Cari variabel..."
            value={varQuery}
            onChange={(e) => setVarQuery(e.target.value)}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">
          Klik variabel untuk menyisipkan ke sel aktif.
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-1">
        {filteredVarGroups.map((g) => (
          <RibbonGroup
            key={`${g.scope}-${g.label}`}
            label={`${g.label}${g.scope === "rekap" ? " ∙ rekap" : ""}`}
          >
            {g.fields.map((f) => {
              const token = g.scope === "row" ? `{${f.token}}` : `{{${f.token}}}`;
              return (
                <Badge
                  key={f.token}
                  variant={g.scope === "row" ? "secondary" : "outline"}
                  className="cursor-pointer font-mono text-[10px] hover:bg-accent"
                  title={f.hint || token}
                  onClick={() => insertToken(token)}
                >
                  {f.label} · {token}
                </Badge>
              );
            })}
          </RibbonGroup>
        ))}
        {filteredVarGroups.length === 0 ? (
          <span className="px-2 text-[10px] text-muted-foreground">
            Tidak ada variabel cocok untuk “{varQuery}”.
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-stretch gap-1 border-t pt-1">
        <RibbonGroup label="Dataset Simulasi">
          {listVars.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">Belum ada field data. Isi dataset simulasi di tab Data.</span>
          ) : (
            listVars.map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="cursor-pointer font-mono text-[10px] hover:bg-accent"
                title="Klik untuk menyisipkan variabel ini"
                onClick={() => insertToken(v)}
              >
                {v}
              </Badge>
            ))
          )}
        </RibbonGroup>
        <RibbonGroup label="Variabel Global">
          {generalVars.map((v) => (
            <Badge
              key={v.token}
              variant="outline"
              className="cursor-pointer font-mono text-[10px] hover:bg-accent"
              title={v.hint}
              onClick={() => insertToken(v.token)}
            >
              {v.label}
            </Badge>
          ))}
        </RibbonGroup>
      </div>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// FORMULA TAB
// ─────────────────────────────────────────────────────────────────────────

interface FormulaTabProps {
  insertToken: (token: string) => void;
}

const FormulaTab = memo(function FormulaTab({ insertToken }: FormulaTabProps) {
  return (
    <TabsContent value="formula" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Fungsi">
        {FORMULA_TEMPLATES.map((f) => (
          <Button
            key={f.label}
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            title={f.hint}
            onClick={() => insertToken(f.expr)}
          >
            {f.label}
          </Button>
        ))}
      </RibbonGroup>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// PAGE LAYOUT TAB
// ─────────────────────────────────────────────────────────────────────────

interface LayoutTabProps {
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  printScale: number;
  density: ReportDensity;
  margin: { top: number; bottom: number; left: number; right: number };
  typography: ReportWorkbook["typography"];
  rowHeight: number | undefined;
  showFooter: boolean;
  headerRepeat: boolean;
  onChangeMeta: (patch: Partial<ReportWorkbook>) => void;
  onScaleToFitPage: () => void;
  onApplyDensity: (density: ReportDensity) => void;
  onSetRowHeight: (heightPt: number | undefined) => void;
}

const LayoutTab = memo(function LayoutTab({
  paperSize,
  orientation,
  printScale,
  density,
  margin,
  typography,
  rowHeight,
  showFooter,
  headerRepeat,
  onChangeMeta,
  onScaleToFitPage,
  onApplyDensity,
  onSetRowHeight,
}: LayoutTabProps) {
  return (
    <TabsContent value="layout" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Page Setup">
        <div className="w-32">
          <Select value={paperSize} onValueChange={(v) => onChangeMeta({ paperSize: v as ReportPaperSize })}>
            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="F4">F4 / Folio</SelectItem>
              <SelectItem value="LEGAL">Legal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Select value={orientation} onValueChange={(v) => onChangeMeta({ orientation: v as ReportOrientation })}>
            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Scale to Fit">
        <div className="w-24">
          <Select
            value={String(Math.round((printScale ?? 1) * 100))}
            onValueChange={(v) => onChangeMeta({ printScale: Number(v) / 100 })}
          >
            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[50, 60, 70, 80, 90, 100, 110, 125].map((p) => (
                <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={onScaleToFitPage}
          title="Hitung skala otomatis agar seluruh lebar tabel muat 1 halaman (tanpa mengubah lebar kolom)"
        >
          <Minimize2 className="h-3.5 w-3.5" /> Fit 1 Page
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Density">
        {(Object.keys(REPORT_DENSITY_PRESETS) as ReportDensity[]).map((d) => (
          <Button
            key={d}
            type="button"
            variant={density === d ? "default" : "outline"}
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => onApplyDensity(d)}
          >
            {REPORT_DENSITY_PRESETS[d].label}
          </Button>
        ))}
      </RibbonGroup>

      <RibbonGroup label="Margins (pt)">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <div key={side} className="flex flex-col items-center">
            <Input
              type="number"
              className="h-6 w-14 text-[10px]"
              value={margin[side]}
              onChange={(e) => onChangeMeta({ margin: { ...margin, [side]: Number(e.target.value) || 0 } })}
            />
            <span className="text-[8px] text-muted-foreground capitalize">{side}</span>
          </div>
        ))}
      </RibbonGroup>

      <RibbonGroup label="Typography">
        <div className="flex flex-col items-center">
          <Input type="number" step="0.5" className="h-6 w-14 text-[10px]" value={typography.baseFontSize} onChange={(e) => onChangeMeta({ typography: { ...typography, baseFontSize: Number(e.target.value) || 0 } })} />
          <span className="text-[8px] text-muted-foreground">Base</span>
        </div>
        <div className="flex flex-col items-center">
          <Input type="number" step="0.5" className="h-6 w-14 text-[10px]" value={typography.tableFontSize} onChange={(e) => onChangeMeta({ typography: { ...typography, tableFontSize: Number(e.target.value) || 0 } })} />
          <span className="text-[8px] text-muted-foreground">Table</span>
        </div>
        <div className="flex flex-col items-center">
          <Input type="number" step="0.05" className="h-6 w-14 text-[10px]" value={typography.lineHeight} onChange={(e) => onChangeMeta({ typography: { ...typography, lineHeight: Number(e.target.value) || 0 } })} />
          <span className="text-[8px] text-muted-foreground">Line</span>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Row Height">
        <div className="flex flex-col items-center">
          <Input
            type="number"
            className="h-6 w-16 text-[10px]"
            placeholder="auto"
            value={rowHeight ?? ""}
            onChange={(e) => onSetRowHeight(e.target.value ? Number(e.target.value) : undefined)}
          />
          <span className="text-[8px] text-muted-foreground">selected row (pt)</span>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Options">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input type="checkbox" className="h-3.5 w-3.5" checked={showFooter} onChange={(e) => onChangeMeta({ showFooter: e.target.checked })} />
          Footer
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input type="checkbox" className="h-3.5 w-3.5" checked={headerRepeat} onChange={(e) => onChangeMeta({ headerRepeat: e.target.checked })} />
          Repeat header
        </label>
      </RibbonGroup>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// DATA TAB
// ─────────────────────────────────────────────────────────────────────────

interface DataTabProps {
  datasetCount: number;
  onOpenDataDialog: () => void;
  onOpenSortFilter: () => void;
  onFindReplace: () => void;
  onOpenConditional: () => void;
}

const DataTab = memo(function DataTab({
  datasetCount,
  onOpenDataDialog,
  onOpenSortFilter,
  onFindReplace,
  onOpenConditional,
}: DataTabProps) {
  return (
    <TabsContent value="data" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Simulation Dataset">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onOpenDataDialog}>
          <Database className="h-3.5 w-3.5" /> Edit JSON
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onOpenSortFilter} title="Urutkan & filter dataset simulasi">
          <ArrowUpDown className="h-3.5 w-3.5" /> Sort / Filter
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {datasetCount} baris data
        </span>
      </RibbonGroup>
      <RibbonGroup label="Find">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onFindReplace} title="Cari & ganti (Ctrl+F)">
          <Search className="h-3.5 w-3.5" /> Find & Replace
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onOpenConditional} title="Pewarnaan bersyarat">
          <Paintbrush className="h-3.5 w-3.5" /> Conditional
        </Button>
      </RibbonGroup>
    </TabsContent>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// VIEW TAB
// ─────────────────────────────────────────────────────────────────────────

interface ViewTabProps {
  showPageBreaks: boolean;
  onTogglePageBreaks: () => void;
  freezeCols: number;
  freezeRows: number;
  onSetFreeze: (cols: number, rows: number) => void;
  zoom: number | null;
  effectiveScale: number;
  onZoom: (zoom: number | null) => void;
  pageCount: number;
  rowsPerPageFirst: number | null;
  onPreview: () => void;
  onDownloadPdf: () => void;
  generating: boolean;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ViewTab = memo(function ViewTab({
  showPageBreaks,
  onTogglePageBreaks,
  freezeCols,
  freezeRows,
  onSetFreeze,
  zoom,
  effectiveScale,
  onZoom,
  pageCount,
  rowsPerPageFirst,
  onPreview,
  onDownloadPdf,
  generating,
  onExportJson,
  onImportJson,
}: ViewTabProps) {
  const isFit = zoom === null;
  return (
    <TabsContent value="view" className="mt-0 flex flex-wrap items-stretch">
      <RibbonGroup label="Paper Boundary">
        <Button
          variant={showPageBreaks ? "default" : "outline"}
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={onTogglePageBreaks}
        >
          <Scissors className="h-3.5 w-3.5" /> {showPageBreaks ? "Hide" : "Show"} Lines
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Freeze Panes">
        <Button
          variant={freezeCols > 0 || freezeRows > 0 ? "default" : "outline"}
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() =>
            onSetFreeze(
              freezeCols > 0 || freezeRows > 0 ? 0 : 1,
              freezeCols > 0 || freezeRows > 0 ? 0 : 1
            )
          }
          title="Bekukan baris teratas & kolom terkiri"
        >
          <Snowflake className="h-3.5 w-3.5" /> {freezeCols || freezeRows ? "Unfreeze" : "Freeze Top+Left"}
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {freezeRows} baris · {freezeCols} kolom
        </span>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const base = zoom === null ? 1 : zoom;
            onZoom(Math.max(0.5, +(base - 0.1).toFixed(2)));
          }}
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center font-mono text-[11px]">{Math.round(effectiveScale * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            const base = zoom === null ? 1 : zoom;
            onZoom(Math.min(3, +(base + 0.1).toFixed(2)));
          }}
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant={isFit ? "default" : "outline"} size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onZoom(null)} title="Fit to Width">
          <Maximize2 className="h-3.5 w-3.5" /> Fit
        </Button>
      </RibbonGroup>

      <RibbonGroup label="Pagination">
        <span className="flex h-7 items-center gap-1 rounded bg-muted px-2 text-[11px]">
          <Rows3 className="h-3.5 w-3.5" />
          {pageCount} hal
          {rowsPerPageFirst !== null ? ` · ${rowsPerPageFirst} baris/hal` : ""}
        </span>
      </RibbonGroup>

      <RibbonGroup label="Export">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={onDownloadPdf} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-red-600" />} PDF
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" disabled title={FUTURE_TOOLTIP}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel <Badge variant="secondary" className="h-4 px-1 text-[9px]">Soon</Badge>
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" disabled title={FUTURE_TOOLTIP}>
          <FileDown className="h-3.5 w-3.5" /> Word <Badge variant="secondary" className="h-4 px-1 text-[9px]">Soon</Badge>
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" disabled title={FUTURE_TOOLTIP}>
          <Printer className="h-3.5 w-3.5" /> HTML <Badge variant="secondary" className="h-4 px-1 text-[9px]">Soon</Badge>
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onExportJson} title="Export JSON">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <label className="cursor-pointer" title="Import JSON">
          <input type="file" accept=".json" className="hidden" onChange={onImportJson} />
          <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent">
            <Upload className="h-3.5 w-3.5" />
          </div>
        </label>
      </RibbonGroup>
    </TabsContent>
  );
});

function ReportRibbonInner(props: ReportRibbonProps) {
  const { wb, currentCell, pageBreakPlan } = props;

  // Ref ke props & currentCell terbaru. Action stabil (deps kosong) membacanya
  // via ref sehingga identitas callback tetap — tab memo tidak ikut re-render.
  const propsRef = useRef(props);
  propsRef.current = props;
  const currentCellRef = useRef<SheetCell | undefined>(currentCell);
  currentCellRef.current = currentCell;

  const activeModule = wb.module || props.module || "umum";

  // Sumber tunggal katalog variabel global: pakai prop bila ada (kompatibilitas),
  // jika tidak langsung dari report-variables.ts agar tak ada duplikasi daftar.
  const generalVars = props.generalVars ?? listVars().generalVars;

  // Himpunan callback STABIL (identitas tetap sepanjang umur komponen).
  const actions = useMemo<RibbonActions>(() => {
    const p = () => propsRef.current;
    return {
      onExit: () => p().onExit(),
      onSelectTemplate: (id) => p().onSelectTemplate(id),
      onUndo: () => p().onUndo(),
      onRedo: () => p().onRedo(),
      onSave: () => p().onSave(),
      onPreview: () => p().onPreview(),
      onDownloadPdf: () => p().onDownloadPdf(),
      onExportJson: () => p().onExportJson(),
      onImportJson: (e) => p().onImportJson(e),
      onOpenDataDialog: () => p().onOpenDataDialog(),
      onOpenSortFilter: () => p().onOpenSortFilter(),
      onOpenConditional: () => p().onOpenConditional(),
      onFindReplace: () => p().onFindReplace(),
      onChangeMeta: (patch) => p().onChangeMeta(patch),
      onChangeCell: (patch) => p().onChangeCell(patch),
      onClearCell: () => p().onClearCell(),
      setCellValueRaw: (value) => p().onInsertCellValue(value),
      // Sisipkan token ke nilai sel AKTIF (dibaca via ref), append bukan timpa.
      // SheetGridHandle belum mengekspos posisi kursor, jadi token ditempel di
      // akhir teks sel; saat API posisi kursor tersedia, cukup sesuaikan di sini.
      insertToken: (token) => {
        const existing = currentCellRef.current?.value ?? "";
        const newCellValue = existing ? `${existing} ${token}` : token;
        propsRef.current.onInsertCellValue(newCellValue);
      },
      onMerge: () => p().onMerge(),
      onSplit: () => p().onSplit(),
      onAddColumn: () => p().onAddColumn(),
      onRemoveColumn: () => p().onRemoveColumn(),
      onFitColumnsToWidth: () => p().onFitColumnsToWidth(),
      onScaleToFitPage: () => p().onScaleToFitPage(),
      onAddRow: () => p().onAddRow(),
      onRemoveRow: () => p().onRemoveRow(),
      onInsertRowAbove: () => p().onInsertRowAbove(),
      onInsertRowBelow: () => p().onInsertRowBelow(),
      onInsertColLeft: () => p().onInsertColLeft(),
      onInsertColRight: () => p().onInsertColRight(),
      onAddShape: (type) => p().onAddShape(type),
      onChangeShape: (patch) => p().onChangeShape(patch),
      onDeleteShape: () => p().onDeleteShape(),
      onAddImage: (src) => p().onAddImage(src),
      onUploadImage: (e) => p().onUploadImage(e),
      onChangeImage: (patch) => p().onChangeImage(patch),
      onAddSheet: () => p().onAddSheet(),
      onToggleRowRepeat: () => p().onToggleRowRepeat(),
      onSelectSheet: (idx) => p().onSelectSheet(idx),
      onRemoveSheet: (idx) => p().onRemoveSheet(idx),
      onTogglePageBreaks: () => p().onTogglePageBreaks(),
      onZoom: (z) => p().onZoom(z),
      onApplyDensity: (d) => p().onApplyDensity(d),
      onSetRowHeight: (h) => p().onSetRowHeight(h),
      onToggleFormatPainter: () => p().onToggleFormatPainter(),
      onSetFreeze: (cols, rows) => p().onSetFreeze(cols, rows),
    };
     
  }, []);

  // Handler meta stabil untuk TitleBar.
  const handleChangeMeta = useCallback(
    (patch: Partial<ReportWorkbook>) => actions.onChangeMeta(patch),
    [actions]
  );

  const rowsPerPageFirst =
    pageBreakPlan.rowsPerPage.length > 0 ? pageBreakPlan.rowsPerPage[0] : null;

  return (
    <div className="border-b bg-card">
      <TitleBar
        reportCode={wb.reportCode || ""}
        reportName={wb.reportName || ""}
        templateList={props.templateList}
        selectedTplId={props.selectedTplId}
        saving={props.saving}
        onExit={actions.onExit}
        onSelectTemplate={actions.onSelectTemplate}
        onSave={actions.onSave}
        onChangeMeta={handleChangeMeta}
      />

      {/* Tab ribbon */}
      <Tabs defaultValue="home" className="gap-0">
        <TabsList className="h-7 w-full justify-start gap-0 rounded-none border-b bg-transparent px-1">
          {[
            { v: "home", label: "Home", icon: Home },
            { v: "insert", label: "Insert", icon: SquarePlus },
            { v: "variables", label: "Variabel", icon: Braces },
            { v: "formula", label: "Formula", icon: FunctionSquare },
            { v: "layout", label: "Page Layout", icon: Table2 },
            { v: "data", label: "Data", icon: Database },
            { v: "view", label: "View", icon: Eye },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="h-full rounded-none border-b-2 border-transparent px-3 text-[11px] data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <t.icon className="mr-1 h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex min-h-[58px] flex-wrap items-stretch gap-0 bg-muted/20 px-1 py-1">
          <HomeTab
            currentCell={currentCell}
            baseFontSize={wb.typography.baseFontSize}
            canUndo={props.canUndo}
            canRedo={props.canRedo}
            canMerge={props.canMerge}
            isMerged={props.isMerged}
            isClipboardFormatting={props.isClipboardFormatting}
            onUndo={actions.onUndo}
            onRedo={actions.onRedo}
            onChangeCell={actions.onChangeCell}
            onMerge={actions.onMerge}
            onSplit={actions.onSplit}
            onToggleFormatPainter={actions.onToggleFormatPainter}
            onClearCell={actions.onClearCell}
            setCellValueRaw={actions.setCellValueRaw}
            onExit={actions.onExit}
          />

          <InsertTab
            printWidthRatio={props.printWidthRatio}
            onInsertRowAbove={actions.onInsertRowAbove}
            onInsertRowBelow={actions.onInsertRowBelow}
            onInsertColLeft={actions.onInsertColLeft}
            onInsertColRight={actions.onInsertColRight}
            onRemoveRow={actions.onRemoveRow}
            onRemoveColumn={actions.onRemoveColumn}
            onFitColumnsToWidth={actions.onFitColumnsToWidth}
            onAddShape={actions.onAddShape}
            selectedShape={props.selectedShape}
            onChangeShape={actions.onChangeShape}
            onDeleteShape={actions.onDeleteShape}
            onUploadImage={actions.onUploadImage}
            selectedImage={props.selectedImage}
            onChangeImage={actions.onChangeImage}
            onAddSheet={actions.onAddSheet}
            sheets={props.sheets}
            activeSheetIdx={props.activeSheetIdx}
            onSelectSheet={actions.onSelectSheet}
            onRemoveSheet={actions.onRemoveSheet}
            rowRepeat={props.rowRepeat}
            onToggleRowRepeat={actions.onToggleRowRepeat}
          />

          <VarTab
            activeModule={activeModule}
            datasetKeys={props.datasetKeys}
            generalVars={generalVars}
            insertToken={actions.insertToken}
          />

          <FormulaTab insertToken={actions.insertToken} />

          <LayoutTab
            paperSize={wb.paperSize}
            orientation={wb.orientation}
            printScale={wb.printScale ?? 1}
            density={wb.density}
            margin={wb.margin}
            typography={wb.typography}
            rowHeight={props.rowHeight}
            showFooter={wb.showFooter}
            headerRepeat={wb.headerRepeat}
            onChangeMeta={handleChangeMeta}
            onScaleToFitPage={actions.onScaleToFitPage}
            onApplyDensity={actions.onApplyDensity}
            onSetRowHeight={actions.onSetRowHeight}
          />

          <DataTab
            datasetCount={props.datasetCount}
            onOpenDataDialog={actions.onOpenDataDialog}
            onOpenSortFilter={actions.onOpenSortFilter}
            onFindReplace={actions.onFindReplace}
            onOpenConditional={actions.onOpenConditional}
          />

          <ViewTab
            showPageBreaks={props.showPageBreaks}
            onTogglePageBreaks={actions.onTogglePageBreaks}
            freezeCols={props.freezeCols}
            freezeRows={props.freezeRows}
            onSetFreeze={actions.onSetFreeze}
            zoom={props.zoom}
            effectiveScale={props.effectiveScale}
            onZoom={actions.onZoom}
            pageCount={pageBreakPlan.pageCount}
            rowsPerPageFirst={rowsPerPageFirst}
            onPreview={actions.onPreview}
            onDownloadPdf={actions.onDownloadPdf}
            generating={props.generating}
            onExportJson={actions.onExportJson}
            onImportJson={actions.onImportJson}
          />
        </div>
      </Tabs>
    </div>
  );
}

/**
 * Komponen utama dibungkus React.memo: re-render hanya saat props berubah.
 * Dengan tab-tab memo di dalamnya, mengetik di sel (yang mengubah `wb`/
 * `currentCell`) tidak lagi me-render ulang seluruh ribbon sekaligus.
 */
export const ReportRibbon = memo(ReportRibbonInner);
