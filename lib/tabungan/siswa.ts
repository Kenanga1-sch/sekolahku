import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

export async function getSiswa(page = 1, limit = 20, search = "", classId = "") {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
    classId
  });
  return await goGet(`/api/savings/students?${params.toString()}`);
}

export async function getSiswaById(id: string) {
  return await goGet(`/api/savings/students/${id}`);
}

export async function getSiswaByQr(qrCode: string) {
  return await goGet(`/api/savings/students/${qrCode}`);
}

export async function createSiswa(data: any) {
  return await goPost("/api/savings/students", data);
}

export async function updateSiswa(id: string, data: any) {
  return await goPut(`/api/savings/students/${id}`, data);
}

export async function deleteSiswa(id: string) {
  return await goDelete(`/api/savings/students/${id}`);
}

export async function getSiswaWithBalance(classId?: string) {
  const url = classId ? `/api/savings/students?classId=${classId}` : "/api/savings/students";
  return await goGet(url);
}
