/**
 * members — Client-side data fetcher for Library Members
 */

import { goGet, goPost, goPatch, goDelete } from "@/lib/api-client";
import type { LibraryMember } from "@/types/library";

export interface GetMembersOptions {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface GetMembersResponse {
  items: LibraryMember[];
  totalItems: number;
  totalPages: number;
  page: number;
}

export async function getLibraryMembers(options: GetMembersOptions = {}): Promise<GetMembersResponse> {
  const params = new URLSearchParams();
  if (options.page) params.append("page", options.page.toString());
  if (options.perPage) params.append("perPage", options.perPage.toString());
  if (options.search) params.append("search", options.search);

  return await goGet(`/api/library/members?${params.toString()}`);
}

export async function getMemberByQRCode(qrCode: string): Promise<LibraryMember | null> {
  try {
    return await goGet(`/api/library/members/qr/${qrCode}`);
  } catch (error) {
    console.error("Failed to get member by QR:", error);
    return null;
  }
}

export async function createLibraryMember(data: any) {
  return await goPost("/api/library/members", data);
}

export async function updateLibraryMember(id: string, data: any) {
  return await goPatch(`/api/library/members/${id}`, data);
}

export async function deleteLibraryMember(id: string) {
  return await goDelete(`/api/library/members/${id}`);
}

export async function syncMembersFromStudents() {
  return await goPost("/api/library/members/sync", {});
}
