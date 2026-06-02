/**
 * Savings Admin Actions — optimized with handleAction and Caching.
 */

import { goGet, goPost, goPut, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

// --- Users ---
export async function getEmployees() {
  return handleAction(goGet("/api/master/employees?limit=1000", { ttl: CacheTTL.LONG }));
}

// --- Treasurer Management ---
export async function getSavingsTreasurer() {
  return handleAction(goGet("/api/savings/treasurer", { ttl: CacheTTL.MEDIUM }));
}

export async function assignSavingsTreasurer(userId: string) {
  return handleAction(
    goPost("/api/savings/treasurer", { userId }),
    "Bendahara tabungan berhasil ditetapkan"
  );
}

// --- Class Rep Management ---
export async function getClassesWithReps() {
  return handleAction(goGet("/api/savings/classes/reps", { ttl: CacheTTL.MEDIUM }));
}

export async function assignClassRep(classId: string, userId: string) {
  return handleAction(
    goPut(`/api/savings/classes/${classId}/rep`, { userId }),
    "Koordinator kelas berhasil ditetapkan"
  );
}

// --- Verification Queue (Setoran) ---
export async function getPendingSetoran() {
  return handleAction(goGet("/api/savings/setoran?status=pending", { ttl: CacheTTL.SHORT }));
}

export async function verifySetoran(setoranId: string, bendaharaId: string) {
  return handleAction(
    goPost("/api/savings/setoran/verify", { setoranId, bendaharaId, status: "verified" }),
    "Setoran berhasil diverifikasi"
  );
}

export async function rejectSetoran(setoranId: string, bendaharaId: string, reason?: string) {
  return handleAction(
    goPost("/api/savings/setoran/verify", { setoranId, bendaharaId, status: "rejected", catatan: reason }),
    "Setoran ditolak"
  );
}

// --- Brankas Management ---
export async function getBrankasSummary() {
  return handleAction(goGet("/api/savings/brankas/summary", { ttl: CacheTTL.MEDIUM }));
}

export async function transferVaultFunds(tipe: "setor_ke_bank" | "tarik_dari_bank", nominal: number, userId: string) {
  return handleAction(
    goPost("/api/savings/brankas/transfer", { tipe, nominal, userId }),
    "Mutasi dana berhasil dicatat"
  );
}
