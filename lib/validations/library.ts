import { z } from "zod";

// ==========================================
// Library Schemas
// ==========================================

export const libraryMemberSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  className: z.string().optional(),
  studentId: z.string().optional(),
  userId: z.string().optional(),
  maxBorrowLimit: z.number().int().min(1, "Minimal 1 buku").default(3),
});

export const libraryItemSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  category: z.enum(
    ["FICTION", "NON_FICTION", "REFERENCE", "TEXTBOOK", "MAGAZINE", "OTHER"]
  ),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const libraryLoanSchema = z.object({
  memberId: z.string().uuid("ID Anggota tidak valid"),
  itemId: z.string().uuid("ID Buku tidak valid"),
  loanDays: z.number().int().positive().default(7),
});

// APIs
export const createMemberSchema = libraryMemberSchema;
export const createItemSchema = libraryItemSchema;
export const createLoanSchema = libraryLoanSchema;
