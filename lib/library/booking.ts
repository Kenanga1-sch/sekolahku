/**
 * library-bookings — Client-side fetcher for BOOKING SYSTEM (authenticated)
 * 
 * These endpoints require authentication (JWT + role check).
 * Base path: /api/library/bookings
 */

import { goGet, goPost, goDelete } from "@/lib/api-client";

export interface CreateBookingRequest {
  assetId: string;
  borrowDate: number; // Unix ms
  dueDate: number;    // Unix ms
  borrowerName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  studentClass?: string;
  notes?: string;
}

export async function createBooking(data: CreateBookingRequest): Promise<any> {
  return await goPost("/api/library/bookings", data);
}

export async function getMyBookings(page?: number, perPage?: number): Promise<{ items: any[]; totalItems: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (perPage) params.append("perPage", perPage.toString());
  
  return await goGet(`/api/library/bookings?${params.toString()}`);
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await goDelete(`/api/library/bookings/${encodeURIComponent(bookingId)}`);
}
