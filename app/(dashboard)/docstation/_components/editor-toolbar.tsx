"use client";

import {
  Brush,
  Eraser,
  Highlighter,
  Crop,
  RotateCcw,
  RotateCw,
  RotateCcwSquare,
  Sparkles,
  ScanLine,
  Wand2,
  Droplets,
  CircleSlash,
  GitMerge,
  LayoutTemplate,
  Eraser as ClearIcon,
  ZoomIn,
  ZoomOut,
  Contrast,
  Sun,
  SlidersHorizontal,
  SunMedium,
  Trash,
  Frame,
  Zap,
  Waves,
  FlipVertical2,
  FlipHorizontal2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DocStationTool } from "@/lib/docstation/state";

export interface EditorToolbarProps {
  activeTool: DocStationTool;
  brushSize: number;
  onToolChange: (tool: DocStationTool) => void;
  onBrushSizeChange: (size: number) => void;
  onRotate: (degrees: number) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onResetEdits: () => void;
  onCrop: () => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  cropMode: boolean;
  onClearOverlays: () => void;
  onEnhance: (mode: "bw" | "bg" | "despeckle" | "punch-hole") => void;
  onAdvanced: (
    mode:
      | "white-bg"
      | "illumination"
      | "despeckle-strong"
      | "stray-marks"
      | "adf-border"
      | "sharpen",
    strength: number,
  ) => void;
  onDeskew: () => void;
  onAutoWarp: () => void;
  onAutoPipeline: (mode: "color" | "gray" | "bw") => void;
  onStitch: () => void;
  onCardLayout: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  busy?: boolean;
  hasPage: boolean;
  hasMultiplePages: boolean;
  cvStatus: string;
  // Penyesuaian manual (langsung diterapkan ke halaman aktif).
  adjustments: { brightness: number; contrast: number; gamma: number; grayscale: boolean };
  onAdjustmentsChange: (patch: Partial<{ brightness: number; contrast: number; gamma: number; grayscale: boolean }>) => void;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active !== undefined ? active : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // 40px ≈ target sentuh minimum yang nyaman di ponsel.
        "flex h-10 w-10 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {icon}
    </button>
  );
}

function ToolLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

const iconClass = "h-4 w-4";

/** Toolbar editor halaman bergrup tab: transformasi, pembersihan, ketajaman,
 *  binarisasi, anotasi, multi-halaman, dan penyesuaian manual. */
export function EditorToolbar(props: EditorToolbarProps) {
  const {
    activeTool,
    brushSize,
    onToolChange,
    onBrushSizeChange,
    onRotate,
    onFlip,
    onResetEdits,
    onCrop,
    onApplyCrop,
    onCancelCrop,
    cropMode,
    onClearOverlays,
    onEnhance,
    onAdvanced,
    onDeskew,
    onAutoWarp,
    onAutoPipeline,
    onStitch,
    onCardLayout,
    zoom,
    onZoomChange,
    busy,
    hasPage,
    hasMultiplePages,
    cvStatus,
    adjustments,
    onAdjustmentsChange,
  } = props;

  const dis = !hasPage || busy;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
      {/* Baris utama: Perbaiki Otomatis + mode cepat */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={dis}
          onClick={() => onAutoPipeline("color")}
          title="Auto-crop + bersihkan + pertajam (warna)"
        >
          <Sparkles className="h-4 w-4" /> Perbaiki Otomatis
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => onAutoPipeline("gray")} title="Perbaikan otomatis → Grayscale">
          Auto → Gray
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => onAutoPipeline("bw")} title="Perbaikan otomatis → Hitam Putih">
          Auto → B&amp;W
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
              cvStatus === "ready"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-muted text-muted-foreground",
            )}
            title="Status mesin OpenCV (fallback pure-JS selalu aktif)"
          >
            {cvStatus === "ready" ? "OpenCV Aktif" : "Engine Pure-JS"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="transform" className="gap-2">
        <TabsList aria-label="Grup alat editor" className="h-10 w-full justify-start overflow-x-auto">
          <TabsTrigger value="transform" className="gap-1 text-xs">
            <RotateCw className="h-3.5 w-3.5" /> Transform
          </TabsTrigger>
          <TabsTrigger value="clean" className="gap-1 text-xs">
            <Droplets className="h-3.5 w-3.5" /> Bersihkan
          </TabsTrigger>
          <TabsTrigger value="sharpen" className="gap-1 text-xs">
            <Zap className="h-3.5 w-3.5" /> Ketajaman
          </TabsTrigger>
          <TabsTrigger value="binarize" className="gap-1 text-xs">
            <Contrast className="h-3.5 w-3.5" /> Binarisasi
          </TabsTrigger>
          <TabsTrigger value="adjust" className="gap-1 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Penyesuaian
          </TabsTrigger>
          <TabsTrigger value="annotate" className="gap-1 text-xs">
            <Brush className="h-3.5 w-3.5" /> Anotasi
          </TabsTrigger>
          <TabsTrigger value="multi" className="gap-1 text-xs">
            <LayoutTemplate className="h-3.5 w-3.5" /> Multi
          </TabsTrigger>
        </TabsList>

        {/* TRANSFORM */}
        <TabsContent value="transform">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton icon={<RotateCcw className={iconClass} />} label="Putar kiri" disabled={dis} onClick={() => onRotate(-90)} />
            <ToolButton icon={<RotateCw className={iconClass} />} label="Putar kanan" disabled={dis} onClick={() => onRotate(90)} />
            <ToolButton icon={<FlipHorizontal2 className={iconClass} />} label="Mirror horizontal" disabled={dis} onClick={() => onFlip("horizontal")} />
            <ToolButton icon={<FlipVertical2 className={iconClass} />} label="Mirror vertikal" disabled={dis} onClick={() => onFlip("vertical")} />
            <ToolButton icon={<RotateCcwSquare className={iconClass} />} label="Reset edit" disabled={dis} onClick={onResetEdits} />
            <ToolButton icon={<Crop className={iconClass} />} label="Crop manual" active={cropMode} disabled={dis} onClick={onCrop} />
            <ToolButton icon={<Frame className={iconClass} />} label="Auto crop (deteksi tepi kertas)" disabled={dis} onClick={onAutoWarp} />
            <ToolButton icon={<ScanLine className={iconClass} />} label="Auto-deskew" disabled={dis} onClick={onDeskew} />
            <ToolButton icon={<Wand2 className={iconClass} />} label="Hapus strip tepi scan ADF" disabled={dis} onClick={() => onAdvanced("adf-border", 1)} />

            {cropMode && (
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" size="sm" onClick={onApplyCrop} disabled={busy}>
                  Terapkan Crop
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancelCrop} disabled={busy}>
                  Batal
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* BERSIHKAN */}
        <TabsContent value="clean">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton icon={<Droplets className={iconClass} />} label="Hapus bayangan/latar (MSRCR)" disabled={dis} onClick={() => onEnhance("bg")} />
            <ToolButton icon={<SunMedium className={iconClass} />} label="Background putih bersih (whitening)" disabled={dis} onClick={() => onAdvanced("white-bg", 0.7)} />
            <ToolButton icon={<Waves className={iconClass} />} label="Ratakan pencahayaan" disabled={dis} onClick={() => onAdvanced("illumination", 0.8)} />
            <ToolButton icon={<CircleSlash className={iconClass} />} label="Despeckle (median 3×3)" disabled={dis} onClick={() => onEnhance("despeckle")} />
            <ToolButton icon={<CircleSlash className={iconClass} />} label="Despeckle kuat (5×5 + buang blob kecil)" disabled={dis} onClick={() => onAdvanced("despeckle-strong", 1)} />
            <ToolButton icon={<Trash className={iconClass} />} label="Hapus bintik/guratan kecil" disabled={dis} onClick={() => onAdvanced("stray-marks", 1)} />
            <ToolButton icon={<CircleSlash className={iconClass} />} label="Hapus lubang binder" disabled={dis} onClick={() => onEnhance("punch-hole")} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ToolLabel>Kekuatan pembersihan</ToolLabel>
            <Slider
              aria-label="Kekuatan pembersihan"
              className="w-40"
              min={0}
              max={1}
              step={0.05}
              defaultValue={[0.7]}
              disabled={dis}
              onValueCommit={(v) => onAdvanced("white-bg", v[0])}
            />
          </div>
        </TabsContent>

        {/* KETAJAMAN */}
        <TabsContent value="sharpen">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton icon={<Zap className={iconClass} />} label="Pertajam lembut" disabled={dis} onClick={() => onAdvanced("sharpen", 0.5)} />
            <ToolButton icon={<Zap className={iconClass} />} label="Pertajam sedang" disabled={dis} onClick={() => onAdvanced("sharpen", 0.9)} />
            <ToolButton icon={<Zap className={iconClass} />} label="Pertajam kuat" disabled={dis} onClick={() => onAdvanced("sharpen", 1.6)} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ToolLabel>Kekuatan (unsharp mask)</ToolLabel>
            <Slider
              aria-label="Kekuatan unsharp mask"
              className="w-40"
              min={0}
              max={3}
              step={0.1}
              defaultValue={[0.9]}
              disabled={dis}
              onValueCommit={(v) => onAdvanced("sharpen", v[0])}
            />
          </div>
        </TabsContent>

        {/* BINARISASI */}
        <TabsContent value="binarize">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton icon={<Sparkles className={iconClass} />} label="Magic B&W (adaptif Sauvola/Otsu)" disabled={dis} onClick={() => onEnhance("bw")} />
            <ToolButton icon={<Contrast className={iconClass} />} label="Biner ambang (kontras tinggi)" disabled={dis} onClick={() => onAdvanced("sharpen", 0.6)} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Magic B&amp;W memakai Sauvola adaptif (fallback) atau Otsu (OpenCV) untuk
            pencahayaan tidak merata.
          </p>
        </TabsContent>

        {/* PENYESUAIAN MANUAL */}
        <TabsContent value="adjust">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <ToolLabel>Terang</ToolLabel>
              <Slider
                aria-label="Kecerahan"
                className="flex-1"
                min={-100}
                max={100}
                step={1}
                value={[adjustments.brightness]}
                disabled={dis}
                onValueChange={(v) => onAdjustmentsChange({ brightness: v[0] })}
              />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {adjustments.brightness}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Contrast className="h-4 w-4 text-muted-foreground" />
              <ToolLabel>Kontras</ToolLabel>
              <Slider
                aria-label="Kontras"
                className="flex-1"
                min={-100}
                max={100}
                step={1}
                value={[adjustments.contrast]}
                disabled={dis}
                onValueChange={(v) => onAdjustmentsChange({ contrast: v[0] })}
              />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {adjustments.contrast}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <ToolLabel>Gamma</ToolLabel>
              <Slider
                aria-label="Gamma"
                className="flex-1"
                min={0.3}
                max={2.5}
                step={0.05}
                value={[adjustments.gamma]}
                disabled={dis}
                onValueChange={(v) => onAdjustmentsChange({ gamma: v[0] })}
              />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {adjustments.gamma.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={adjustments.grayscale}
                disabled={dis}
                onChange={(e) => onAdjustmentsChange({ grayscale: e.target.checked })}
              />
              Grayscale
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={dis}
              onClick={() => onAdjustmentsChange({ brightness: 0, contrast: 0, gamma: 1, grayscale: false })}
            >
              Reset penyesuaian
            </Button>
          </div>
        </TabsContent>

        {/* ANOTASI */}
        <TabsContent value="annotate">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton
              icon={<Brush className={iconClass} />}
              label="Brush"
              active={activeTool === "brush"}
              disabled={dis}
              onClick={() => onToolChange(activeTool === "brush" ? "none" : "brush")}
            />
            <ToolButton
              icon={<Eraser className={iconClass} />}
              label="Eraser"
              active={activeTool === "eraser"}
              disabled={dis}
              onClick={() => onToolChange(activeTool === "eraser" ? "none" : "eraser")}
            />
            <ToolButton
              icon={<Highlighter className={iconClass} />}
              label="Stabilo"
              active={activeTool === "highlighter"}
              disabled={dis}
              onClick={() => onToolChange(activeTool === "highlighter" ? "none" : "highlighter")}
            />
            <ToolButton icon={<ClearIcon className={iconClass} />} label="Hapus anotasi" disabled={dis} onClick={onClearOverlays} />
            <div className="flex items-center gap-2 pl-2">
              <ToolLabel>Ukuran</ToolLabel>
              <Slider
                aria-label="Ukuran kuas"
                className="w-32"
                min={4}
                max={60}
                step={1}
                value={[brushSize]}
                onValueChange={(v) => onBrushSizeChange(v[0])}
                disabled={dis}
              />
              <span className="w-8 text-xs font-semibold tabular-nums text-muted-foreground">
                {brushSize}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* MULTI */}
        <TabsContent value="multi">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton icon={<GitMerge className={iconClass} />} label="Gabung (stitch)" disabled={!hasMultiplePages || busy} onClick={onStitch} />
            <ToolButton icon={<LayoutTemplate className={iconClass} />} label="Layout kartu ganda" disabled={!hasMultiplePages || busy} onClick={onCardLayout} />
            <div className="mx-1 h-6 w-px bg-border" />
            <ToolButton icon={<ZoomOut className={iconClass} />} label="Perkecil" disabled={dis} onClick={() => onZoomChange(Math.max(0.25, zoom - 0.15))} />
            <ToolButton icon={<ZoomIn className={iconClass} />} label="Perbesar" disabled={dis} onClick={() => onZoomChange(Math.min(3, zoom + 0.15))} />
            <button
              type="button"
              disabled={dis}
              onClick={() => onZoomChange(1)}
              aria-label={`Reset zoom (saat ini ${Math.round(zoom * 100)} persen)`}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
