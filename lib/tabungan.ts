import { goGet, goPost, goPut } from "@/lib/api-client";

// ==========================================
// Tabungan (Student Savings) - Wired to Go API
// ==========================================

export * from "./tabungan/index";

export async function createOrUpdateBrankas(data: any): Promise<any> {
  try {
    if (data.id) {
      return await goPut("/api/savings/brankas/" + data.id, data);
    } else {
      return await goPost("/api/savings/brankas", data);
    }
  } catch (error) {
    console.error("createOrUpdateBrankas error", error);
    return { success: false, error: "API Error" };
  }
}

// Additional brankas helpers
export async function getBrankas(): Promise<any[]> {
  try {
    return await goGet("/api/savings/brankas");
  } catch (error) {
    console.error("getBrankas error", error);
    return [];
  }
}

