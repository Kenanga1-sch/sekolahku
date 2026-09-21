/**
 * public-catalog — Client-side fetcher for PUBLIC Library Catalog
 * 
 * These endpoints are read-only and do NOT require authentication.
 * Base path: /api/public/library/*
 */

import { goGet } from "@/lib/api-client";
import type { ItemCategory } from "@/types/library";

export interface PublicBook {
  id: string;
  catalogId: string;
  status: string;
  location?: string;
  condition?: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  year: number;
  category: ItemCategory;
  description: string;
  cover: string;
  totalExemplars: number;
  availableCount: number;
}

export interface PublicBooksResponse {
  success: boolean;
  items: PublicBook[];
  totalItems: number;
  totalPages: number;
  page: number;
}

export interface PublicLibraryStats {
  totalBooks: number;
  totalExemplars: number;
  availableBooks: number;
  borrowedBooks: number;
  categoriesCount: number;
}

export interface GetPublicBooksOptions {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
}

export async function getPublicBooks(
  options: GetPublicBooksOptions = {}
): Promise<PublicBooksResponse> {
  const params = new URLSearchParams();
  if (options.page) params.append("page", options.page.toString());
  if (options.perPage) params.append("perPage", options.perPage.toString());
  if (options.search) params.append("search", options.search);
  if (options.category && options.category !== "all") {
    params.append("category", options.category);
  }

  return await goGet(`/api/public/library/books?${params.toString()}`);
}

export async function getPublicBook(id: string): Promise<PublicBook> {
  const res: any = await goGet(`/api/public/library/books/${encodeURIComponent(id)}`);
  return res?.data ?? res;
}

export async function getPublicLibraryStats(): Promise<PublicLibraryStats> {
  const res: any = await goGet(`/api/public/library/stats`);
  return res?.data ?? res;
}

export async function checkAvailabilityByISBN(
  isbn: string
): Promise<PublicBook | null> {
  try {
    const res: any = await goGet(
      `/api/public/library/availability/${encodeURIComponent(isbn)}`
    );
    return res?.data ?? null;
  } catch {
    return null;
  }
}
