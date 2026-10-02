import type { SchoolSettings } from "@/types";

/**
 * Normalisasi patch update settings.
 *
 * Tab-tab di /pengaturan menulis dengan pola setState
 * (`setSettings((prev) => ({ ...prev, x })))`), sedangkan context
 * mengirim objek patch langsung. Keduanya harus menghasilkan payload
 * yang sama; `id` dari prev tidak boleh ikut (id dikirim sendiri oleh
 * pemanggil) supaya tidak menimpa id tujuan.
 */
export type SettingsPatch =
  | Partial<SchoolSettings>
  | ((prev: Partial<SchoolSettings> | null) => Partial<SchoolSettings>);

export function resolveSettingsPatch(
  patch: SettingsPatch,
  prev: Partial<SchoolSettings> | null
): Partial<SchoolSettings> {
  const resolved = typeof patch === "function" ? patch(prev) : patch;
  if (!resolved || typeof resolved !== "object") return {};
  const { id: _id, ...rest } = resolved as Partial<SchoolSettings> & { id?: string };
  return rest;
}
