// ==========================================
// Library Module Types (Drizzle)
// ==========================================

// Base record
export interface BaseRecord {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// Library Catalog (Bibliographic Data)
// ==========================================

export type ItemCategory =
    | "FICTION"
    | "NON_FICTION"
    | "REFERENCE"
    | "TEXTBOOK"
    | "MAGAZINE"
    | "OTHER";

export interface LibraryCatalog extends BaseRecord {
    isbn: string | null;
    title: string;
    author: string | null;
    publisher: string | null;
    year: number | null;
    category: ItemCategory;
    description: string | null;
    cover: string | null;
}

// ==========================================
// Library Assets (Physical Items)
// ==========================================

export type ItemStatus = "AVAILABLE" | "BORROWED" | "DAMAGED" | "LOST";

export interface LibraryAsset extends BaseRecord {
    catalogId: string;
    status: ItemStatus;
    location: string | null;
    condition: string | null;

    // Joined relation
    catalog?: LibraryCatalog | null;

    // Flattened properties for convenience (from joined catalog)
    title: string;
    author: string | null;
    isbn: string | null;
    publisher: string | null;
    year: number | null;
    category: ItemCategory;
    description: string | null;
}

// Legacy alias for compatibility
export type LibraryItem = LibraryAsset;

// ==========================================
// Library Members
// ==========================================

export interface LibraryMember extends BaseRecord {
    userId: string | null;
    name: string;
    className: string | null;
    studentId: string | null;
    qrCode: string;
    maxBorrowLimit: number;
    photo: string | null;
    isActive: boolean;
}

// ==========================================
// Library Loans
// ==========================================

export interface LibraryLoan extends BaseRecord {
    memberId: string;
    itemId: string; // Refers to Asset ID (QR Code)
    borrowDate: Date;
    dueDate: Date;
    returnDate: Date | null;
    isReturned: boolean;
    fineAmount: number;
    finePaid: boolean;
    notes: string | null;
    
    // Expanded relations
    member?: LibraryMember | null;
    item?: LibraryAsset | null;
}

// ==========================================
// Library Visits
// ==========================================

export interface LibraryVisit extends BaseRecord {
    memberId: string;
    date: string; // YYYY-MM-DD
    timestamp: Date;
    
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

// Updated to use Catalog schemas eventually, but for now compat
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
