import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

export async function createHutang(data: any) {
  return await goPost("/api/savings/hutang", data);
}

export async function getHutangBySiswa(siswaId: string) {
  return await goGet(`/api/savings/hutang?siswaId=${siswaId}`);
}

export async function getHutangAktifBySiswa(siswaId: string) {
  return await goGet(`/api/savings/hutang?siswaId=${siswaId}&status=aktif`);
}

export async function getTotalHutangAktif(siswaId: string) {
  return await goGet(`/api/savings/hutang/total-aktif?siswaId=${siswaId}`);
}

export async function updateHutang(id: string, data: any) {
  return await goPut(`/api/savings/hutang/${id}`, data);
}

export async function cancelHutang(id: string) {
  return await goDelete(`/api/savings/hutang/${id}`);
}

export async function payHutangCash(id: string, amount: number) {
  return await goPost(`/api/savings/hutang/${id}/pay-cash`, { amount });
}

export async function settleHutangFromTabungan(id: string) {
  return await goPost(`/api/savings/hutang/${id}/settle-savings`);
}

export async function getHutangList(params?: any) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return await goGet(`/api/savings/hutang${query}`);
}
