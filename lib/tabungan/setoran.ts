import { goGet, goPost } from "@/lib/api-client";

export async function getSetoranList() {
  return await goGet("/api/savings/setoran");
}

export async function getSetoranByGuru(guruId: string) {
  return await goGet(`/api/savings/setoran?guruId=${guruId}`);
}

export async function createSetoran(data: any) {
  return await goPost("/api/savings/setoran", data);
}

export async function verifySetoran(data: any) {
  return await goPost("/api/savings/setoran/verify", data);
}

export async function getSetoranDetail(id: string) {
  return await goGet(`/api/savings/setoran/${id}`);
}
