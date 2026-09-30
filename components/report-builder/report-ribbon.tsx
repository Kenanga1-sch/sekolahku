"use client";

/**
 * report-ribbon.tsx — Ribbon ala Excel untuk Studio Format Laporan.
 *
 * Struktur: satu baris judul (kembali, identitas template, simpan, ekspor) di
 * atas, lalu tab (Home/Insert/Page Layout/Data/View) berisi kelompok kontrol.
 * Semua kontrol yang dulu tersebar di header & panel kanan dipusatkan di sini.
 */

import { useMemo, useState } from "react";
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
import { REPORT_VARIABLE_MODULES, getVariableModule } from "@/lib/report-variables";
import type { PageBreakPlan } from "@/lib/report-paginate";

export interface RibbonVariableSample {
  label: string;
  token: string;
  hint?: string;
}

/** Template rumus yang didukung engine (report-engine-v3). */
export const FORMULA_TEMPLATES: { label: string; expr: string; hint: string }[] = [
  { label: "SUM", expr: "=SUM(A1:A1)", hint: "Jumlahkan rentang" },
  { label: "AVG", expr: "=AVG(A1:A1)", hint: "Rata-rata rentang" },
  { label: "COUNT", expr: "=COUNT(A1:A1)", hint: "Hitung banyak nilai dalam rentang" },
  { label: "MIN", expr: "=MIN(A1:A1)", hint: "Nilai terkecil" },
  { label: "MAX", expr: "=MAX(A1:A1)", hint: "Nilai terbesar" },
  { label: "IF", expr: "=IF(A1>0;A1;0)", hint: "Kondisi: jika benar → nilai 1, jika salah → nilai 2" },
  { label: "CONCAT", expr: '=CONCAT("A";"B")', hint: "Gabungkan teks" },
  { label: "ROUND", expr: "=ROUND(A1;2)", hint: "Bulatkan ke N desimal" },
  { label: "UPPER", expr: '=UPPER("abc")', hint: "Jadikan huruf besar" },
];

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
  generalVars: RibbonVariableSample[];
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

export function ReportRibbon(props: ReportRibbonProps) {
  const {
    wb,
    currentCell,
    datasetKeys,
    datasetCount,
    pageBreakPlan,
    showPageBreaks,
    zoom,
    effectiveScale,
    canUndo,
    canRedo,
    saving,
    generating,
    templateList,
    selectedTplId,
  } = props;

  const listVars = useMemo(() => datasetKeys.map((k) => `{${k}}`), [datasetKeys]);
  const isFit = zoom === null;
  const activeModule = wb.module || props.module || "umum";
  const [varModule, setVarModule] = useState<string>(activeModule);
  const [varQuery, setVarQuery] = useState("");
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
    <div className="border-b bg-card">
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={props.onExit} className="gap-1.5" title="Keluar Studio">
          <ArrowLeft className="h-4 w-4" /> Exit
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            className="h-7 w-40 text-xs font-mono"
            placeholder="RPT_TABUNG"
            value={wb.reportCode || ""}
            onChange={(e) => props.onChangeMeta({ reportCode: e.target.value })}
          />
          <Input
            className="h-7 w-52 text-xs"
            placeholder="Nama Laporan"
            value={wb.reportName || ""}
            onChange={(e) => props.onChangeMeta({ reportName: e.target.value })}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-44">
            <Select value={selectedTplId} onValueChange={props.onSelectTemplate}>
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
            onClick={props.onSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

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
          {/* ============================ HOME ============================ */}
          <TabsContent value="home" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Clipboard">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={props.onUndo} disabled={!canUndo} title="Undo">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={props.onRedo} disabled={!canRedo} title="Redo">
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Font">
              <select
                className="h-7 w-28 rounded border bg-background px-1 text-[11px]"
                value={currentCell?.fontFamily || "Helvetica"}
                onChange={(e) => props.onChangeCell({ fontFamily: e.target.value as SheetCell["fontFamily"] })}
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
                value={currentCell?.fontSize ?? wb.typography.baseFontSize}
                onChange={(e) => props.onChangeCell({ fontSize: Math.max(6, Math.min(72, Number(e.target.value) || wb.typography.baseFontSize)) })}
                title="Ukuran font"
              />
              <Button variant={currentCell?.bold ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ bold: !currentCell?.bold })} title="Bold">
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.italic ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ italic: !currentCell?.italic })} title="Italic">
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.underline ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ underline: !currentCell?.underline })} title="Underline">
                <Underline className="h-3.5 w-3.5" />
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Alignment">
              <Button variant={currentCell?.align === "left" || !currentCell?.align ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ align: "left" })} title="Align Left">
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.align === "center" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ align: "center" })} title="Center">
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.align === "right" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ align: "right" })} title="Align Right">
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant={!currentCell?.vertical || currentCell?.vertical === "top" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ vertical: "top" })} title="Align Top">
                <ArrowUpToLine className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.vertical === "middle" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ vertical: "middle" })} title="Align Middle">
                <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
              </Button>
              <Button variant={currentCell?.vertical === "bottom" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => props.onChangeCell({ vertical: "bottom" })} title="Align Bottom">
                <ArrowDownToLine className="h-3.5 w-3.5" />
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Style">
              <label className="flex flex-col items-center">
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border bg-background"
                  value={currentCell?.bg || "#ffffff"}
                  onChange={(e) => props.onChangeCell({ bg: e.target.value })}
                  title="Warna latar sel"
                />
                <span className="text-[8px] text-muted-foreground">Fill</span>
              </label>
              <label className="flex flex-col items-center">
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border bg-background"
                  value={currentCell?.color || "#000000"}
                  onChange={(e) => props.onChangeCell({ color: e.target.value })}
                  title="Warna teks"
                />
                <span className="text-[8px] text-muted-foreground">Text</span>
              </label>
              <Button
                variant={currentCell?.wrap ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => props.onChangeCell({ wrap: !currentCell?.wrap })}
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
                  onChange={(e) => props.onChangeCell({ indent: Number(e.target.value) || 0 })}
                />
                <span className="text-[8px] text-muted-foreground">Indent</span>
              </div>
              <div className="flex flex-col items-center">
                <select
                  className="h-6 rounded border bg-background px-1 text-[10px]"
                  value={currentCell?.rotation ?? 0}
                  onChange={(e) => props.onChangeCell({ rotation: Number(e.target.value) || 0 })}
                >
                  <option value={0}>0°</option>
                  <option value={45}>45°</option>
                  <option value={90}>90°</option>
                </select>
                <span className="text-[8px] text-muted-foreground">Rotasi</span>
              </div>
              <Button
                variant={props.isClipboardFormatting ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={props.onToggleFormatPainter}
                title="Format Painter (tempel gaya)"
              >
                <Paintbrush className="h-3.5 w-3.5" />
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Number & Border">
              <select
                className="h-7 rounded border bg-background px-1 text-[11px]"
                value={currentCell?.format || "text"}
                onChange={(e) => props.onChangeCell({ format: e.target.value as SheetCell["format"] })}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="rupiah">Rupiah</option>
                <option value="date">Date</option>
              </select>
              <select
                className="h-7 rounded border bg-background px-1 text-[11px]"
                value={currentCell?.border || "none"}
                onChange={(e) => props.onChangeCell({ border: e.target.value as SheetCell["border"] })}
              >
                <option value="none">No Border</option>
                <option value="all">All Border</option>
                <option value="box">Box Border</option>
              </select>
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex gap-0.5">
                  <Button variant={currentCell?.borderTop ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => props.onChangeCell({ borderTop: !currentCell?.borderTop })} title="Border atas">
                    Atas
                  </Button>
                  <Button variant={currentCell?.borderBottom ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => props.onChangeCell({ borderBottom: !currentCell?.borderBottom })} title="Border bawah">
                    Bawah
                  </Button>
                </div>
                <div className="flex gap-0.5">
                  <Button variant={currentCell?.borderLeft ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => props.onChangeCell({ borderLeft: !currentCell?.borderLeft })} title="Border kiri">
                    Kiri
                  </Button>
                  <Button variant={currentCell?.borderRight ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => props.onChangeCell({ borderRight: !currentCell?.borderRight })} title="Border kanan">
                    Kanan
                  </Button>
                </div>
              </div>
              <label className="flex flex-col items-center" title="Warna border">
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border bg-background"
                  value={currentCell?.borderColor || "#000000"}
                  onChange={(e) => props.onChangeCell({ borderColor: e.target.value })}
                />
                <span className="text-[8px] text-muted-foreground">Border</span>
              </label>
            </RibbonGroup>

            <RibbonGroup label="Cells">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onMerge} disabled={!props.canMerge}>
                <Merge className="h-3.5 w-3.5" /> Merge
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onSplit} disabled={!props.isMerged}>
                <SplitSquareHorizontal className="h-3.5 w-3.5" /> Split
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Cell Content">
              <input
                className="h-7 w-56 rounded border bg-background px-2 font-mono text-[11px]"
                value={currentCell?.value ?? ""}
                placeholder="Text, {{var}}, {field}, =SUM(A1:A5)"
                onChange={(e) => props.onInsertCellValue(e.target.value)}
              />
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-600" onClick={props.onClearCell}>
                Clear
              </Button>
            </RibbonGroup>

            <RibbonGroup label="File">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onExit} title="Keluar dari mode Studio">
                <LogOut className="h-3.5 w-3.5" /> Exit
              </Button>
            </RibbonGroup>
          </TabsContent>

          {/* ============================ INSERT ============================ */}
          <TabsContent value="insert" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Rows & Columns">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onInsertRowAbove} title="Sisipkan baris di atas sel terpilih">
                <Plus className="h-3.5 w-3.5" /> Row Above
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onInsertRowBelow} title="Sisipkan baris di bawah sel terpilih">
                <Plus className="h-3.5 w-3.5" /> Row Below
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onInsertColLeft} title="Sisipkan kolom di kiri sel terpilih">
                <Plus className="h-3.5 w-3.5" /> Col Left
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onInsertColRight} title="Sisipkan kolom di kanan sel terpilih">
                <Plus className="h-3.5 w-3.5" /> Col Right
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={props.onRemoveRow} title="Hapus baris terakhir">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={props.onRemoveColumn} title="Hapus kolom terakhir">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                variant={props.printWidthRatio > 1.001 ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={props.onFitColumnsToWidth}
                title="Ubah lebar kolom agar tabel pas dengan area cetak (proporsional)"
              >
                <Maximize2 className="h-3.5 w-3.5" /> Fit to Width
              </Button>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                  props.printWidthRatio > 1.001
                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                    : props.printWidthRatio < 0.999
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                )}
                title="Lebar total kolom relatif terhadap area cetak"
              >
                {Math.round(props.printWidthRatio * 100)}% lebar cetak
              </span>
            </RibbonGroup>
            <RibbonGroup label="Shapes">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => props.onAddShape("line")} title="Garis pemisah">
                Garis
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => props.onAddShape("rect")} title="Kotak (mis. area materai/foto)">
                Kotak
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => props.onAddShape("ellipse")} title="Elips">
                Elips
              </Button>
              {props.selectedShape ? (
                <>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <label className="flex flex-col items-center" title="Isian shape">
                    <input
                      type="color"
                      className="h-6 w-8 cursor-pointer rounded border bg-background"
                      value={props.selectedShape.fill || "#ffffff"}
                      onChange={(e) => props.onChangeShape({ fill: e.target.value })}
                    />
                    <span className="text-[8px] text-muted-foreground">Fill</span>
                  </label>
                  <label className="flex flex-col items-center" title="Garis tepi shape">
                    <input
                      type="color"
                      className="h-6 w-8 cursor-pointer rounded border bg-background"
                      value={props.selectedShape.stroke || "#000000"}
                      onChange={(e) => props.onChangeShape({ stroke: e.target.value })}
                    />
                    <span className="text-[8px] text-muted-foreground">Outline</span>
                  </label>
                  <div className="flex flex-col items-center">
                    <Input
                      type="number"
                      className="h-6 w-12 text-[10px]"
                      value={props.selectedShape.strokeWidth ?? 1}
                      min={0}
                      onChange={(e) => props.onChangeShape({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <span className="text-[8px] text-muted-foreground">Tebal</span>
                  </div>
                  <Button variant={props.selectedShape.fill ? "default" : "outline"} size="sm" className="h-6 px-1 text-[9px]" onClick={() => props.onChangeShape({ fill: props.selectedShape?.fill ? "" : "#ffffff" })} title="Toggle isian">
                    {props.selectedShape.fill ? "Isi" : "Kosong"}
                  </Button>
                  <div className="flex flex-col items-center">
                    <Input
                      type="number"
                      className="h-6 w-14 text-[10px]"
                      value={props.selectedShape.width}
                      min={1}
                      onChange={(e) => props.onChangeShape({ width: Math.max(1, Number(e.target.value) || 1) })}
                      title="Lebar (pt)"
                    />
                    <span className="text-[8px] text-muted-foreground">L (pt)</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Input
                      type="number"
                      className="h-6 w-14 text-[10px]"
                      value={props.selectedShape.height}
                      min={0}
                      onChange={(e) => props.onChangeShape({ height: Math.max(0, Number(e.target.value) || 0) })}
                      title="Tinggi (pt)"
                    />
                    <span className="text-[8px] text-muted-foreground">T (pt)</span>
                  </div>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={props.onDeleteShape} title="Hapus shape">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
              <span className="mx-1 h-5 w-px bg-border" />
              <label className="cursor-pointer" title="Unggah gambar (logo, foto, materai)">
                <input type="file" accept="image/*" className="hidden" onChange={props.onUploadImage} />
                <div className="flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" /> Gambar
                </div>
              </label>
              {props.selectedImage ? (
                <>
                  <div className="flex flex-col items-center">
                    <Input
                      type="number"
                      className="h-6 w-14 text-[10px]"
                      value={props.selectedImage.width}
                      min={1}
                      onChange={(e) => props.onChangeImage({ width: Math.max(1, Number(e.target.value) || 1) })}
                      title="Lebar gambar (pt)"
                    />
                    <span className="text-[8px] text-muted-foreground">L (pt)</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Input
                      type="number"
                      className="h-6 w-14 text-[10px]"
                      value={props.selectedImage.height}
                      min={1}
                      onChange={(e) => props.onChangeImage({ height: Math.max(1, Number(e.target.value) || 1) })}
                      title="Tinggi gambar (pt)"
                    />
                    <span className="text-[8px] text-muted-foreground">T (pt)</span>
                  </div>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={props.onDeleteShape} title="Hapus gambar">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
            </RibbonGroup>
            <RibbonGroup label="Sheets">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onAddSheet}>
                <Grid3x3 className="h-3.5 w-3.5" /> Add Sheet
              </Button>
              <div className="w-36">
                <Select
                  value={String(props.activeSheetIdx)}
                  onValueChange={(v) => props.onSelectSheet(Number(v))}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue placeholder="Lembar" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.sheets.map((s, i) => (
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
                onClick={() => props.onRemoveSheet(props.activeSheetIdx)}
                disabled={props.sheets.length <= 1}
                title="Hapus lembar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </RibbonGroup>
            <RibbonGroup label="Row Repeat">
              <Button
                variant={props.rowRepeat ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={props.onToggleRowRepeat}
                title="Paksa baris terpilih diulang mengikuti data"
              >
                <Rows3 className="h-3.5 w-3.5" /> {props.rowRepeat ? "Repeating" : "Force Repeat"}
              </Button>
            </RibbonGroup>
          </TabsContent>

          {/* =========================== VARIABEL =========================== */}
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
                        onClick={() => props.onInsertCellValue(token)}
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
                      onClick={() => props.onInsertCellValue(v)}
                    >
                      {v}
                    </Badge>
                  ))
                )}
              </RibbonGroup>
              <RibbonGroup label="Variabel Global">
                {props.generalVars.map((v) => (
                  <Badge
                    key={v.token}
                    variant="outline"
                    className="cursor-pointer font-mono text-[10px] hover:bg-accent"
                    title={v.hint}
                    onClick={() => props.onInsertCellValue(v.token)}
                  >
                    {v.label}
                  </Badge>
                ))}
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* =========================== FORMULA =========================== */}
          <TabsContent value="formula" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Fungsi">
              {FORMULA_TEMPLATES.map((f) => (
                <Button
                  key={f.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  title={f.hint}
                  onClick={() => props.onInsertCellValue(f.expr)}
                >
                  {f.label}
                </Button>
              ))}
            </RibbonGroup>
          </TabsContent>

          {/* ========================= PAGE LAYOUT ========================= */}
          <TabsContent value="layout" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Page Setup">
              <div className="w-32">
                <Select value={wb.paperSize} onValueChange={(v) => props.onChangeMeta({ paperSize: v as ReportPaperSize })}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="F4">F4 / Folio</SelectItem>
                    <SelectItem value="LEGAL">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Select value={wb.orientation} onValueChange={(v) => props.onChangeMeta({ orientation: v as ReportOrientation })}>
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
                  value={String(Math.round((wb.printScale ?? 1) * 100))}
                  onValueChange={(v) => props.onChangeMeta({ printScale: Number(v) / 100 })}
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
                onClick={() => props.onScaleToFitPage()}
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
                  variant={wb.density === d ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => props.onApplyDensity(d)}
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
                    value={wb.margin[side]}
                    onChange={(e) => props.onChangeMeta({ margin: { ...wb.margin, [side]: Number(e.target.value) || 0 } })}
                  />
                  <span className="text-[8px] text-muted-foreground capitalize">{side}</span>
                </div>
              ))}
            </RibbonGroup>

            <RibbonGroup label="Typography">
              <div className="flex flex-col items-center">
                <Input type="number" step="0.5" className="h-6 w-14 text-[10px]" value={wb.typography.baseFontSize} onChange={(e) => props.onChangeMeta({ typography: { ...wb.typography, baseFontSize: Number(e.target.value) || 0 } })} />
                <span className="text-[8px] text-muted-foreground">Base</span>
              </div>
              <div className="flex flex-col items-center">
                <Input type="number" step="0.5" className="h-6 w-14 text-[10px]" value={wb.typography.tableFontSize} onChange={(e) => props.onChangeMeta({ typography: { ...wb.typography, tableFontSize: Number(e.target.value) || 0 } })} />
                <span className="text-[8px] text-muted-foreground">Table</span>
              </div>
              <div className="flex flex-col items-center">
                <Input type="number" step="0.05" className="h-6 w-14 text-[10px]" value={wb.typography.lineHeight} onChange={(e) => props.onChangeMeta({ typography: { ...wb.typography, lineHeight: Number(e.target.value) || 0 } })} />
                <span className="text-[8px] text-muted-foreground">Line</span>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Row Height">
              <div className="flex flex-col items-center">
                <Input
                  type="number"
                  className="h-6 w-16 text-[10px]"
                  placeholder="auto"
                  value={props.rowHeight ?? ""}
                  onChange={(e) => props.onSetRowHeight(e.target.value ? Number(e.target.value) : undefined)}
                />
                <span className="text-[8px] text-muted-foreground">selected row (pt)</span>
              </div>
            </RibbonGroup>

            <RibbonGroup label="Options">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                <input type="checkbox" className="h-3.5 w-3.5" checked={wb.showFooter} onChange={(e) => props.onChangeMeta({ showFooter: e.target.checked })} />
                Footer
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                <input type="checkbox" className="h-3.5 w-3.5" checked={wb.headerRepeat} onChange={(e) => props.onChangeMeta({ headerRepeat: e.target.checked })} />
                Repeat header
              </label>
            </RibbonGroup>
          </TabsContent>

          {/* ============================ DATA ============================ */}
          <TabsContent value="data" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Simulation Dataset">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onOpenDataDialog}>
                <Database className="h-3.5 w-3.5" /> Edit JSON
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onOpenSortFilter} title="Urutkan & filter dataset simulasi">
                <ArrowUpDown className="h-3.5 w-3.5" /> Sort / Filter
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {datasetCount} baris data
              </span>
            </RibbonGroup>
            <RibbonGroup label="Find">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onFindReplace} title="Cari & ganti (Ctrl+F)">
                <Search className="h-3.5 w-3.5" /> Find & Replace
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onOpenConditional} title="Pewarnaan bersyarat">
                <Paintbrush className="h-3.5 w-3.5" /> Conditional
              </Button>
            </RibbonGroup>
          </TabsContent>

          {/* ============================ VIEW ============================ */}
          <TabsContent value="view" className="mt-0 flex flex-wrap items-stretch">
            <RibbonGroup label="Paper Boundary">
              <Button
                variant={showPageBreaks ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={props.onTogglePageBreaks}
              >
                <Scissors className="h-3.5 w-3.5" /> {showPageBreaks ? "Hide" : "Show"} Lines
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Freeze Panes">
              <Button
                variant={props.freezeCols > 0 || props.freezeRows > 0 ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() =>
                  props.onSetFreeze(
                    props.freezeCols > 0 || props.freezeRows > 0 ? 0 : 1,
                    props.freezeCols > 0 || props.freezeRows > 0 ? 0 : 1
                  )
                }
                title="Bekukan baris teratas & kolom terkiri"
              >
                <Snowflake className="h-3.5 w-3.5" /> {props.freezeCols || props.freezeRows ? "Unfreeze" : "Freeze Top+Left"}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {props.freezeRows} baris · {props.freezeCols} kolom
              </span>
            </RibbonGroup>

            <RibbonGroup label="Zoom">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const base = zoom === null ? 1 : zoom;
                  props.onZoom(Math.max(0.5, +(base - 0.1).toFixed(2)));
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
                  props.onZoom(Math.min(3, +(base + 0.1).toFixed(2)));
                }}
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant={isFit ? "default" : "outline"} size="sm" className="h-7 gap-1 text-[11px]" onClick={() => props.onZoom(null)} title="Fit to Width">
                <Maximize2 className="h-3.5 w-3.5" /> Fit
              </Button>
            </RibbonGroup>

            <RibbonGroup label="Pagination">
              <span className="flex h-7 items-center gap-1 rounded bg-muted px-2 text-[11px]">
                <Rows3 className="h-3.5 w-3.5" />
                {pageBreakPlan.pageCount} hal
                {pageBreakPlan.rowsPerPage.length > 0 ? ` · ${pageBreakPlan.rowsPerPage[0]} baris/hal` : ""}
              </span>
            </RibbonGroup>

            <RibbonGroup label="Export">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onPreview}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={props.onDownloadPdf} disabled={generating}>
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
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={props.onExportJson} title="Export JSON">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <label className="cursor-pointer" title="Import JSON">
                <input type="file" accept=".json" className="hidden" onChange={props.onImportJson} />
                <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                </div>
              </label>
            </RibbonGroup>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
