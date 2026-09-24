"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createImageFromBlob } from "@/lib/docstation/canvas";
import {
  requestScan,
  sendPrintFile,
  saveFileToServer,
  type PrintableFile,
} from "@/lib/docstation/api";
import {
  applyImageDataToPage,
  createCardPage,
  cropPage,
  flipPage,
  resetPageEdits,
  rotatePage,
  stitchPages,
} from "@/lib/docstation/editor";
import {
  createEnginePage,
  createEngineState,
  type EnginePage,
  type EngineState,
} from "@/lib/docstation/state";
import type { ScanConfig } from "../_components/types";

export interface ScanProgress {
  message: string;
  percent: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Deteksi halaman kosong secara ringan (pure-JS) untuk opsi "lewati halaman
 * kosong" pada pemindaian ADF. Halaman dianggap kosong bila rasio piksel gelap
 * sangat rendah.
 */
function isProbablyBlank(image: HTMLImageElement): boolean {
  try {
    const maxSide = 200;
    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    if (!w || !h) return false;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(image, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;
    let ink = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (g < 160) ink++;
      total++;
    }
    return total > 0 && ink / total < 0.0035;
  } catch {
    return false;
  }
}

export interface UseDocStationResult {
  /** Daftar halaman (ringkas, untuk dirender React). */
  pages: EnginePage[];
  /** State mesin penuh (untuk canvas/worker). */
  stateRef: React.MutableRefObject<EngineState>;
  /** ID halaman aktif (untuk memicu render ulang). */
  activeId: string | null;
  scanning: boolean;
  scanProgress: ScanProgress | null;
  /** Menandai sedang memproses gambar (enhancement/warp dst). */
  busy: boolean;
  busyLabel: string | null;
  /** Menambahkan gambar (hasil scan / unggahan) menjadi halaman baru. */
  addImageBlobs: (blobs: Blob[], namePrefix?: string, options?: { skipBlank?: boolean }) => Promise<void>;
  /** Memindai dari printer sesuai konfigurasi. */
  scan: (config: ScanConfig) => Promise<void>;
  /** Menghapus satu halaman. */
  removePage: (id: string) => void;
  /** Memilih halaman aktif. */
  selectPage: (id: string) => void;
  /** Mengosongkan seluruh sesi. */
  resetSession: () => void;
  /** Mengirim daftar berkas ke printer. */
  print: (files: PrintableFile[], printerIp: string, method: "raw" | "ipp") => Promise<void>;
  /** Menyimpan satu berkas ke server. */
  saveToServer: (file: PrintableFile) => Promise<void>;

  // --- Aksi pengeditan (Fase 3) ---
  rotateActive: (degrees: number) => void;
  flipActive: (axis: "horizontal" | "vertical") => void;
  /** Penyesuaian manual: terang/kontras/gamma/grayscale pada halaman aktif. */
  setActiveAdjustments: (
    patch: Partial<{ brightness: number; contrast: number; gamma: number; grayscale: boolean }>,
  ) => void;
  resetActiveEdits: () => void;
  applyImageData: (buffer: ArrayBuffer, width: number, height: number, resetTransform?: boolean) => Promise<void>;
  /** Menerapkan buffer gambar ke halaman tertentu (untuk pipeline batch). */
  applyImageDataForPage: (
    page: EnginePage,
    buffer: ArrayBuffer,
    width: number,
    height: number,
    resetTransform?: boolean,
  ) => Promise<void>;
  cropActive: (region: CropRegion, sourceWidth: number, sourceHeight: number) => Promise<void>;
  stitchSelected: (ids: string[], direction: "vertical" | "horizontal") => Promise<void>;
  createCardLayout: (frontId: string, backId: string) => Promise<void>;
  setBusy: (busy: boolean, label?: string | null) => void;
}

/**
 * Hook utama yang membungkus mesin DocStation: menyatukan state halaman, aksi
 * pemindaian, cetak, simpan, dan pengeditan gambar.
 */
export function useDocStation(): UseDocStationResult {
  const stateRef = useRef<EngineState | null>(null);
  if (stateRef.current === null) stateRef.current = createEngineState();

  const [pages, setPages] = useState<EnginePage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [busy, setBusyState] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const syncPages = useCallback(() => {
    setPages([...stateRef.current!.pages]);
    setActiveId(stateRef.current!.activeId);
  }, []);

  const setBusy = useCallback((value: boolean, label: string | null = null) => {
    setBusyState(value);
    setBusyLabel(value ? label : null);
  }, []);

  // Bersihkan object URL halaman saat unmount agar tidak bocor.
  useEffect(() => {
    const engine = stateRef.current!;
    return () => {
      engine.pages.forEach((p) => {
        try {
          URL.revokeObjectURL(p.sourceUrl);
        } catch {
          /* ignore */
        }
      });
      engine.pages = [];
    };
  }, []);

  const requireActive = useCallback((): EnginePage | undefined => {
    const engine = stateRef.current!;
    return engine.pages.find((p) => p.id === engine.activeId);
  }, []);

  const addImageBlobs = useCallback(
    async (blobs: Blob[], namePrefix = "Halaman", options: { skipBlank?: boolean } = {}) => {
      const engine = stateRef.current!;
      for (const blob of blobs) {
        const { image, url } = await createImageFromBlob(blob);
        if (options.skipBlank && isProbablyBlank(image)) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
          continue;
        }
        const page = createEnginePage(image, url, `${namePrefix} ${engine.pages.length + 1}`);
        engine.pages.push(page);
        engine.activeId = page.id;
      }
      syncPages();
    },
    [syncPages],
  );

  const scan = useCallback(
    async (config: ScanConfig) => {
      if (scanning) return;
      setScanning(true);
      setScanProgress({ message: "Menyiapkan pemindaian…", percent: 0 });
      try {
        const blobs = await requestScan({
          resolution: config.resolution,
          preset: config.preset,
          paperSize: config.paperSize,
          customWidth: config.customWidth,
          customHeight: config.customHeight,
          source: config.source,
          printerIp: config.printerIp,
          onProgress: (message, percent) => setScanProgress({ message, percent }),
        });
        await addImageBlobs(blobs, "Scan", { skipBlank: config.skipBlank });
      } finally {
        setScanning(false);
        setScanProgress(null);
      }
    },
    [addImageBlobs, scanning],
  );

  const removePage = useCallback(
    (id: string) => {
      const engine = stateRef.current!;
      const page = engine.pages.find((p) => p.id === id);
      if (page) {
        try {
          URL.revokeObjectURL(page.sourceUrl);
        } catch {
          /* ignore */
        }
      }
      delete engine.manualOverlays[id];
      engine.pages = engine.pages.filter((p) => p.id !== id);
      if (engine.activeId === id) engine.activeId = engine.pages[0]?.id ?? null;
      syncPages();
    },
    [syncPages],
  );

  const selectPage = useCallback(
    (id: string) => {
      stateRef.current!.activeId = id;
      setActiveId(id);
    },
    [],
  );

  const resetSession = useCallback(() => {
    const engine = stateRef.current!;
    engine.pages.forEach((p) => {
      try {
        URL.revokeObjectURL(p.sourceUrl);
      } catch {
        /* ignore */
      }
    });
    engine.pages = [];
    engine.activeId = null;
    engine.manualOverlays = {};
    syncPages();
  }, [syncPages]);

  const print = useCallback(
    async (files: PrintableFile[], printerIp: string, method: "raw" | "ipp") => {
      for (const file of files) {
        await sendPrintFile(file, printerIp, method);
      }
    },
    [],
  );

  const saveToServer = useCallback(async (file: PrintableFile) => {
    await saveFileToServer(file);
  }, []);

  // --- Aksi pengeditan ---

  const rotateActive = useCallback(
    (degrees: number) => {
      const page = requireActive();
      if (!page) return;
      rotatePage(page, degrees);
      syncPages();
    },
    [requireActive, syncPages],
  );

  const flipActive = useCallback(
    (axis: "horizontal" | "vertical") => {
      const page = requireActive();
      if (!page) return;
      flipPage(page, axis);
      syncPages();
    },
    [requireActive, syncPages],
  );

  const setActiveAdjustments = useCallback(
    (patch: Partial<{ brightness: number; contrast: number; gamma: number; grayscale: boolean }>) => {
      const page = requireActive();
      if (!page) return;
      if (patch.brightness !== undefined) page.brightness = patch.brightness;
      if (patch.contrast !== undefined) page.contrast = patch.contrast;
      if (patch.gamma !== undefined) page.gamma = patch.gamma;
      if (patch.grayscale !== undefined) page.grayscale = patch.grayscale;
      syncPages();
    },
    [requireActive, syncPages],
  );

  const resetActiveEdits = useCallback(() => {
    const page = requireActive();
    if (!page) return;
    resetPageEdits(stateRef.current!, page);
    syncPages();
  }, [requireActive, syncPages]);

  const applyImageData = useCallback(
    async (buffer: ArrayBuffer, width: number, height: number, resetTransform = false) => {
      const page = requireActive();
      if (!page) return;
      await applyImageDataToPage(page, buffer, width, height, { resetTransform });
      syncPages();
    },
    [requireActive, syncPages],
  );

  const applyImageDataForPage = useCallback(
    async (
      page: EnginePage,
      buffer: ArrayBuffer,
      width: number,
      height: number,
      resetTransform = true,
    ) => {
      await applyImageDataToPage(page, buffer, width, height, { resetTransform });
      syncPages();
    },
    [syncPages],
  );

  const cropActive = useCallback(
    async (region: CropRegion, sourceWidth: number, sourceHeight: number) => {
      const page = requireActive();
      if (!page) return;
      // Region berada pada koordinat kanvas sumber (overlay seukuran kanvas).
      await cropPage(stateRef.current!, page, region, Math.max(sourceWidth, sourceHeight));
      syncPages();
    },
    [requireActive, syncPages],
  );

  const stitchSelected = useCallback(
    async (ids: string[], direction: "vertical" | "horizontal") => {
      const engine = stateRef.current!;
      const selected = ids
        .map((id) => engine.pages.find((p) => p.id === id))
        .filter((p): p is EnginePage => Boolean(p));
      if (selected.length < 2) throw new Error("Pilih minimal 2 halaman untuk digabungkan");
      const newPage = await stitchPages(engine, selected, direction);
      engine.pages.push(newPage);
      engine.activeId = newPage.id;
      engine.selectedIds.clear();
      engine.selectedIds.add(newPage.id);
      syncPages();
    },
    [syncPages],
  );

  const createCardLayout = useCallback(
    async (frontId: string, backId: string) => {
      const engine = stateRef.current!;
      const front = engine.pages.find((p) => p.id === frontId);
      const back = engine.pages.find((p) => p.id === backId);
      if (!front || !back) throw new Error("Butuh dua halaman untuk layout kartu");
      const canvas = document.createElement("canvas");
      const newPage = await createCardPage(engine, front, back, canvas);
      engine.pages.push(newPage);
      engine.activeId = newPage.id;
      syncPages();
    },
    [syncPages],
  );

  return {
    pages,
    stateRef: stateRef as React.MutableRefObject<EngineState>,
    activeId,
    scanning,
    scanProgress,
    busy,
    busyLabel,
    addImageBlobs,
    scan,
    removePage,
    selectPage,
    resetSession,
    print,
    saveToServer,
    rotateActive,
    flipActive,
    setActiveAdjustments,
    resetActiveEdits,
    applyImageData,
    applyImageDataForPage,
    cropActive,
    stitchSelected,
    createCardLayout,
    setBusy,
  };
}
