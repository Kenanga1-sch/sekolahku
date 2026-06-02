import { goGet, goPost, goPut } from "@/lib/api-client";

export async function getBrankasStats() {
  return await goGet("/api/savings/brankas");
}

export async function transferBrankas(data: any) {
  return await goPost("/api/savings/brankas/transfer", data);
}

export async function createOrUpdateBrankas(data: any) {
  if (data.id) {
    return await goPut(`/api/savings/brankas/${data.id}`, data);
  }
  return await goPost("/api/savings/brankas", data);
}
