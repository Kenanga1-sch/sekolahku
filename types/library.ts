// ==========================================
// Library Module Types
// ==========================================

import { RecordModel } from "pocketbase";

// Base record
export interface BaseRecord extends RecordModel {
    id: string;
    created: string;
    updated: string;
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
    author?: string;
    isbn?: string;
    publisher?: string;
    year?: number;
    category: ItemCategory;
    location?: string;
    description?: string;
    qr_code: string;
    status: ItemStatus;
    cover?: string;
}

// ==========================================
// Library Members
// ==========================================

export interface LibraryMember extends BaseRecord {
    user?: string; // relation to users (optional)
    name: string;
    class_name?: string;
    student_id?: string;
    qr_code: string;
    max_borrow_limit: number;
    photo?: string;
    is_active: boolean;
}

// ==========================================
// Library Loans
// ==========================================

export interface LibraryLoan extends BaseRecord {
    member: string; // relation to library_members
    item: string; // relation to library_items
    borrow_date: string;
    due_date: string;
    return_date?: string;
    is_returned: boolean;
    fine_amount: number;
    fine_paid: boolean;
    notes?: string;
    // Expanded relations
    expand?: {
        member?: LibraryMember;
        item?: LibraryItem;
    };
}

// ==========================================
// Library Visits
// ==========================================

export interface LibraryVisit extends BaseRecord {
    member: string; // relation to library_members
    date: string;
    timestamp: string;
    expand?: {
        member?: LibraryMember;
    };
}

// ==========================================
// Form Types
// ==========================================

export interface LibraryItemFormData {
    title: string;
    author?: string;
    isbn?: string;
    publisher?: string;
    year?: number;
    category: ItemCategory;
    location?: string;
    description?: string;
}

export interface LibraryMemberFormData {
    name: string;
    class_name?: string;
    student_id?: string;
    user?: string;
    max_borrow_limit?: number;
}

export interface LoanFormData {
    member: string;
    item: string;
    loan_days?: number;
}

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
