/**
 * Client-side academic actions — fetches directly from Golang API.
 * Optimized with handleAction and caching.
 */

import { goGet, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

export async function getActiveAcademicYear() {
  return handleAction(
    goGet("/api/academic/active-year", { ttl: CacheTTL.LONG }),
    "Tahun akademik aktif berhasil dimuat"
  );
}
