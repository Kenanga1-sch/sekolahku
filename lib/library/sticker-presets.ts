/**
 * sticker-presets — Fetcher preset tata letak stiker QR (authenticated, admin).
 *
 * Preset tersimpan di server (dibagi semua akun admin), bukan di localStorage.
 * Base path: /api/library/sticker-presets
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type { StickerLayout } from "./qr-pdf";

export interface StickerPresetRecord {
  id: string;
  name: string;
  paperWidth: number;
  paperHeight: number;
  labelWidth: number;
  labelHeight: number;
  gapX: number;
  gapY: number;
  fontSize: number;
  createdBy?: string;
  createdByName?: string;
}

export type StickerPresetInput = Omit<
  StickerPresetRecord,
  "id" | "createdBy" | "createdByName"
>;

/** Ubah record dari API menjadi StickerLayout yang dipakai mesin PDF. */
export function recordToLayout(r: StickerPresetRecord): StickerLayout {
  return {
    paperWidth: r.paperWidth,
    paperHeight: r.paperHeight,
    labelWidth: r.labelWidth,
    labelHeight: r.labelHeight,
    gapX: r.gapX,
    gapY: r.gapY,
    fontSize: r.fontSize,
  };
}

/** Bangun payload dari layout yang sedang aktif. */
export function layoutToInput(name: string, l: StickerLayout): StickerPresetInput {
  return {
    name,
    paperWidth: l.paperWidth,
    paperHeight: l.paperHeight,
    labelWidth: l.labelWidth,
    labelHeight: l.labelHeight,
    gapX: l.gapX,
    gapY: l.gapY,
    fontSize: l.fontSize,
  };
}

export async function listStickerPresets(): Promise<StickerPresetRecord[]> {
  const res: any = await goGet("/api/library/sticker-presets");
  if (res?.success && Array.isArray(res.data)) return res.data;
  return [];
}

export async function createStickerPreset(input: StickerPresetInput): Promise<StickerPresetRecord> {
  const res: any = await goPost("/api/library/sticker-presets", input);
  return res?.data;
}

export async function updateStickerPreset(
  id: string,
  input: StickerPresetInput
): Promise<StickerPresetRecord> {
  const res: any = await goPut(`/api/library/sticker-presets/${encodeURIComponent(id)}`, input);
  return res?.data;
}

export async function deleteStickerPreset(id: string): Promise<void> {
  await goDelete(`/api/library/sticker-presets/${encodeURIComponent(id)}`);
}
