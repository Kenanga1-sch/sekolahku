// State & model halaman untuk mesin DocStation.
//
// Hasil port dari mesin state DocStation lama, diubah menjadi TypeScript dan
// dilepas dari ketergantungan DOM. Mesin ini murni data + fungsi; tidak
// menyentuh `document`/`window`.

import type { DocStationPage } from "@/app/(dashboard)/docstation/_components/types";

export type DocStationTool = "none" | "brush" | "eraser" | "highlighter" | "crop";

/** Titik koordinat pada overlay (brush/highlighter/eraser). */
export interface StrokePoint {
  x: number;
  y: number;
}

/** Satu goresan overlay pada halaman. */
export interface OverlayStroke {
  tool: Exclude<DocStationTool, "none" | "crop">;
  points: StrokePoint[];
  size: number;
  color?: string;
}

/** Bentuk halaman internal mesin (memuat elemen Image asli). */
export interface EnginePage extends DocStationPage {
  image: HTMLImageElement;
}

export interface EngineState {
  pages: EnginePage[];
  activeId: string | null;
  selectedIds: Set<string>;
  busy: boolean;
  workerReady: boolean;
  activeTool: DocStationTool;
  brushSize: number;
  brushColor: string;
  highlightColor: string;
  cropMode: boolean;
  cropRegion: { x: number; y: number; width: number; height: number } | null;
  zoomLevel: number;
  zoomPanX: number;
  zoomPanY: number;
  manualOverlays: Record<string, OverlayStroke[]>;
}

export function createEngineState(): EngineState {
  return {
    pages: [],
    activeId: null,
    selectedIds: new Set(),
    busy: false,
    workerReady: false,
    activeTool: "none",
    brushSize: 20,
    brushColor: "#2563eb",
    highlightColor: "#ffff00",
    cropMode: false,
    cropRegion: null,
    zoomLevel: 1.0,
    zoomPanX: 0,
    zoomPanY: 0,
    manualOverlays: {},
  };
}

export function getOverlaysForPage(state: EngineState, pageId: string): OverlayStroke[] {
  return state.manualOverlays[pageId] || (state.manualOverlays[pageId] = []);
}

export function clearOverlaysForPage(state: EngineState, pageId: string): void {
  const overlays = getOverlaysForPage(state, pageId);
  overlays.length = 0;
}

export function resetAllOverlays(state: EngineState): void {
  state.manualOverlays = {};
  state.selectedIds.clear();
}

export function activePage(state: EngineState): EnginePage | undefined {
  return state.pages.find((page) => page.id === state.activeId);
}

export function createEnginePage(
  image: HTMLImageElement,
  sourceUrl: string,
  name = "Halaman Baru",
): EnginePage {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name,
    image,
    sourceUrl,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    rotation: 0,
    fineRotation: 0,
    contrast: 0,
    brightness: 0,
    grayscale: false,
    gamma: 1,
    flipH: false,
    flipV: false,
  };
}
