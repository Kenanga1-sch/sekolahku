import { goGet, goPost } from "@/lib/api-client";

export async function getBrankasStats() {
  return await goGet("/api/savings/brankas");
}

export async function transferBrankas(data: any) {
  return await goPost("/api/savings/brankas/transfer", data);
}

export async function createOrUpdateBrankas(data: any) {
  return await goPost("/api/savings/brankas", data);
}
