/**
 * catalog — Client-side data fetcher for Library Catalog & Books
 */

import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type { LibraryItem, ItemCategory } from "@/types/library";

export interface GetBooksOptions {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
}

export interface GetBooksResponse {
  items: LibraryItem[];
  totalItems: number;
  totalPages: number;
  page: number;
}

export async function getBooks(options: GetBooksOptions = {}): Promise<GetBooksResponse> {
  const params = new URLSearchParams();
  if (options.page) params.append("page", options.page.toString());
  if (options.perPage) params.append("perPage", options.perPage.toString());
  if (options.search) params.append("search", options.search);
  if (options.category && options.category !== "all") params.append("category", options.category);

  return await goGet(`/api/library/books?${params.toString()}`);
}

export async function createBook(data: any) {
  return await goPost("/api/library/books", data);
}

export async function updateBook(id: string, data: any) {
  return await goPut(`/api/library/books/${id}`, data);
}

export async function deleteBook(id: string) {
  return await goDelete(`/api/library/books/${id}`);
}

export async function swapAssetQR(oldQr: string, newQr: string) {
  return await goPost("/api/library/assets/swap", { oldQr, newQr });
}

// Legacy/Compatibility Stubs - to be cleaned up later if unused
export async function downloadCoverImage(...args: any[]) {
  return { success: false, error: "Not implemented on backend" };
}

export async function lookupISBN(isbn: string) {
  return await goGet(`/api/library/isbn/${encodeURIComponent(isbn)}`);
}
