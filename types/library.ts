// ==========================================
// Library Module Types (Drizzle)
// ==========================================

// Base record (Removed PocketBase dependency)
export interface BaseRecord {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// Library Items (Books)
// ==========================================

export type ItemCategory =
    | "FICTION"
    | "NON_FICTION"
    | "REFERENCE"
    | "TEXTBOOK"
    | "MAGAZINE"
    | "OTHER";

export type ItemStatus = "AVAILABLE" | "BORROWED";

export interface LibraryItem extends BaseRecord {
    title: string;
    author: string | null;
    isbn: string | null;
    publisher: string | null;
    year: number | null;
    category: ItemCategory;
    location: string | null;
    description: string | null;
    qrCode: string; // camelCase
    status: ItemStatus;
    cover: string | null;
}

// ==========================================
// Library Members
// ==========================================

export interface LibraryMember extends BaseRecord {
    userId: string | null; // camelCase
    name: string;
    className: string | null; // camelCase
    studentId: string | null; // camelCase
    qrCode: string; // camelCase
    maxBorrowLimit: number; // camelCase
    photo: string | null;
    isActive: boolean; // camelCase
}

// ==========================================
// Library Loans
// ==========================================

export interface LibraryLoan extends BaseRecord {
    memberId: string; // camelCase
    itemId: string; // camelCase
    borrowDate: Date; // Date object
    dueDate: Date; // Date object
    returnDate: Date | null; // Date object
    isReturned: boolean; // camelCase
    fineAmount: number; // camelCase
    finePaid: boolean; // camelCase
    notes: string | null;
    
    // Expanded relations (manual join or with)
    member?: LibraryMember | null;
    item?: LibraryItem | null;
}

// ==========================================
// Library Visits
// ==========================================

export interface LibraryVisit extends BaseRecord {
    memberId: string; // camelCase
    date: string; // YYYY-MM-DD
    timestamp: Date; // Date object
    
    member?: LibraryMember | null;
}

// ==========================================
// Form Data (Derived from Zod Schemas)
// ==========================================

import {
  createItemSchema,
  createMemberSchema,
  createLoanSchema
} from "@/lib/validations/library";
import { z } from "zod";

export type LibraryItemFormData = z.infer<typeof createItemSchema>;
export type LibraryMemberFormData = z.infer<typeof createMemberSchema>;
export type LoanFormData = z.infer<typeof createLoanSchema>;

// ==========================================
// Stats Types
// ==========================================

export interface LibraryStats {
    totalBooks: number;
    availableBooks: number;
    borrowedBooks: number;
    totalMembers: number;
    activeLoans: number;
    overdueLoans: number;
    todayVisits: number;
}

// ==========================================
// Constants
// ==========================================

export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
    { value: "FICTION", label: "Fiksi" },
    { value: "NON_FICTION", label: "Non-Fiksi" },
    { value: "REFERENCE", label: "Referensi" },
    { value: "TEXTBOOK", label: "Buku Pelajaran" },
    { value: "MAGAZINE", label: "Majalah" },
    { value: "OTHER", label: "Lainnya" },
];


export const DEFAULT_LOAN_DAYS = 7;
export const FINE_PER_DAY = 1000; // Rp 1.000 per hari

// ==========================================
// Report Types
// ==========================================

export interface LoanReportItem {
    id: string;
    memberName: string;
    memberClass?: string | null;
    itemTitle: string;
    borrowDate: string; // ISO string
    dueDate: string; // ISO string
    returnDate?: string | null; // ISO string
    isReturned: boolean;
    fineAmount: number;
}

export interface VisitReportItem {
    id: string;
    memberName: string;
    memberClass?: string | null;
    date: string;
    timestamp: string; // ISO string
}
