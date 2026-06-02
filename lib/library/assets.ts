/**
 * assets — Client-side data fetcher for Library Assets
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type { LibraryItem } from "@/types/library";

export interface GetLibraryAssetsOptions {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
}

export interface GetLibraryAssetsResponse {
  items: LibraryItem[];
  totalItems: number;
  totalPages: number;
  page: number;
}

export async function getLibraryAssets(options: GetLibraryAssetsOptions = {}): Promise<GetLibraryAssetsResponse> {
  const params = new URLSearchParams();
  if (options.page) params.append("page", options.page.toString());
  if (options.perPage) params.append("perPage", options.perPage.toString());
  if (options.search) params.append("search", options.search);
  if (options.category && options.category !== "all") params.append("category", options.category);

  return await goGet(`/api/library/books?${params.toString()}`);
}

export async function getAssetByQRCode(qrCode: string): Promise<LibraryItem | null> {
  try {
    return await goGet(`/api/library/books/qr/${qrCode}`);
  } catch (error) {
    console.error("Failed to get asset by QR:", error);
    return null;
  }
}

// Aliases for compatibility
export const getLibraryItems = getLibraryAssets;
export const getItemByQRCode = getAssetByQRCode;

export async function createLibraryItem(data: any) {
  return await goPost("/api/library/books", data);
}

export async function updateLibraryItem(id: string, data: any) {
  return await goPut(`/api/library/books/${id}`, data);
}

export async function deleteLibraryItem(id: string) {
  return await goDelete(`/api/library/books/${id}`);
}

export async function getInventoryStats() {
  return await goGet("/api/library/stats");
}
