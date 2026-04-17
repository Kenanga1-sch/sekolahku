import { goGet, goPost, goPut } from "@/lib/api-client";

// --- Users ---
export async function getEmployees() {
  try { return await goGet("/api/employee"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Treasurer Management ---
export async function getSavingsTreasurer() {
  try { return await goGet("/api/savings/treasurer"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function assignSavingsTreasurer(userId: string) {
  try {
    const res = await goPost("/api/savings/treasurer", { userId });
    return res;
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Class Rep Management ---
export async function getClassesWithReps() {
  try { return await goGet("/api/savings/classes/reps"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function assignClassRep(classId: string, userId: string) {
  try {
    const res = await goPut(`/api/savings/classes/${classId}/rep`, { userId });
    return res;
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Verification Queue (Setoran) ---
export async function getPendingSetoran() {
  try { return await goGet("/api/savings/setoran?status=pending"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function verifySetoran(setoranId: string, bendaharaId: string) {
  try {
    const res = await goPost("/api/savings/setoran/verify", { setoranId, bendaharaId, status: "verified" });
    return res;
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function rejectSetoran(setoranId: string, reason?: string) {
  try {
    const res = await goPost("/api/savings/setoran/verify", { setoranId, status: "rejected", catatan: reason });
    return res;
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

// --- Brankas Management ---
export async function getBrankasSummary() {
  try { return await goGet("/api/savings/brankas/summary"); }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function transferVaultFunds(tipe: "setor_ke_bank" | "tarik_dari_bank", nominal: number, userId: string) {
  try {
    const res = await goPost("/api/savings/brankas/transfer", { tipe, nominal, userId });
    return res;
  }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "Error" }; }
}
