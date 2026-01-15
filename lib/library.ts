// ==========================================
// Library PocketBase Helpers
// ==========================================

import { getPocketBase } from "./pocketbase";
import { sanitizeFilter, sanitizeId } from "./security";
import type {
    LibraryItem,
    LibraryMember,
    LibraryLoan,
    LibraryVisit,
    LibraryStats,
} from "@/types/library";

// Get PocketBase instance
const pb = getPocketBase();

// ==========================================
// Collection Accessors
// ==========================================

export const libraryCollections = {
    items: () => pb.collection("library_items"),
    members: () => pb.collection("library_members"),
    loans: () => pb.collection("library_loans"),
    visits: () => pb.collection("library_visits"),
} as const;

// ==========================================
// Library Items (Books)
// ==========================================

/**
 * Get all library items with optional filters
 */
export async function getLibraryItems(
    page = 1,
    perPage = 20,
    filter = "",
    sort = "-created"
): Promise<{ items: LibraryItem[]; totalPages: number; totalItems: number }> {
    const result = await libraryCollections.items().getList<LibraryItem>(page, perPage, {
        filter,
        sort,
    });
    return {
        items: result.items,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
    };
}

/**
 * Get single library item by ID
 */
export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
    try {
        return await libraryCollections.items().getOne<LibraryItem>(id);
    } catch {
        return null;
    }
}

/**
 * Get library item by QR code
 */
export async function getItemByQRCode(qrCode: string): Promise<LibraryItem | null> {
    try {
        const safeQR = sanitizeFilter(qrCode);
        return await libraryCollections.items().getFirstListItem<LibraryItem>(
            `qr_code = "${safeQR}"`
        );
    } catch {
        return null;
    }
}

/**
 * Create new library item
 */
export async function createLibraryItem(
    data: Partial<LibraryItem>
): Promise<LibraryItem> {
    // Generate QR code if not provided
    if (!data.qr_code) {
        data.qr_code = `BOOK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
    data.status = "AVAILABLE";
    return await libraryCollections.items().create<LibraryItem>(data);
}

/**
 * Update library item
 */
export async function updateLibraryItem(
    id: string,
    data: Partial<LibraryItem>
): Promise<LibraryItem> {
    return await libraryCollections.items().update<LibraryItem>(id, data);
}

/**
 * Delete library item (soft delete by setting status)
 */
export async function deleteLibraryItem(id: string): Promise<boolean> {
    try {
        await libraryCollections.items().delete(id);
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// Library Members
// ==========================================

/**
 * Get all library members
 */
export async function getLibraryMembers(
    page = 1,
    perPage = 20,
    filter = "",
    sort = "-created"
): Promise<{ items: LibraryMember[]; totalPages: number; totalItems: number }> {
    const result = await libraryCollections.members().getList<LibraryMember>(page, perPage, {
        filter: filter ? `${filter} && is_active = true` : "is_active = true",
        sort,
    });
    return {
        items: result.items,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
    };
}

/**
 * Get member by QR code
 */
export async function getMemberByQRCode(qrCode: string): Promise<LibraryMember | null> {
    try {
        const safeQR = sanitizeFilter(qrCode);
        return await libraryCollections.members().getFirstListItem<LibraryMember>(
            `qr_code = "${safeQR}" && is_active = true`
        );
    } catch {
        return null;
    }
}

/**
 * Create library member
 */
export async function createLibraryMember(
    data: Partial<LibraryMember>
): Promise<LibraryMember> {
    if (!data.qr_code) {
        data.qr_code = `MBR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
    data.is_active = true;
    data.max_borrow_limit = data.max_borrow_limit || 3;
    return await libraryCollections.members().create<LibraryMember>(data);
}

/**
 * Update library member
 */
export async function updateLibraryMember(
    id: string,
    data: Partial<LibraryMember>
): Promise<LibraryMember> {
    return await libraryCollections.members().update<LibraryMember>(id, data);
}

// ==========================================
// Library Loans
// ==========================================

/**
 * Get active loans (not returned)
 */
export async function getActiveLoans(
    page = 1,
    perPage = 50
): Promise<{ items: LibraryLoan[]; totalItems: number }> {
    const result = await libraryCollections.loans().getList<LibraryLoan>(page, perPage, {
        filter: "is_returned = false",
        sort: "due_date",
        expand: "member,item",
    });
    return { items: result.items, totalItems: result.totalItems };
}

/**
 * Get overdue loans
 */
export async function getOverdueLoans(): Promise<LibraryLoan[]> {
    const today = new Date().toISOString().split("T")[0];
    const result = await libraryCollections.loans().getFullList<LibraryLoan>({
        filter: `is_returned = false && due_date < "${today}"`,
        sort: "due_date",
        expand: "member,item",
    });
    return result;
}

/**
 * Get member's active loans
 */
export async function getMemberActiveLoans(memberId: string): Promise<LibraryLoan[]> {
    const safeMemberId = sanitizeId(memberId);
    return await libraryCollections.loans().getFullList<LibraryLoan>({
        filter: `member = "${safeMemberId}" && is_returned = false`,
        expand: "item",
    });
}

/**
 * Borrow a book
 */
export async function borrowBook(
    memberId: string,
    itemId: string,
    loanDays = 7
): Promise<LibraryLoan> {
    const now = new Date();
    const dueDate = new Date(now.getTime() + loanDays * 24 * 60 * 60 * 1000);

    // Create loan record
    const loan = await libraryCollections.loans().create<LibraryLoan>({
        member: memberId,
        item: itemId,
        borrow_date: now.toISOString(),
        due_date: dueDate.toISOString(),
        is_returned: false,
        fine_amount: 0,
        fine_paid: false,
    });

    // Update item status
    await libraryCollections.items().update(itemId, { status: "BORROWED" });

    return loan;
}

/**
 * Return a book
 */
export async function returnBook(loanId: string): Promise<LibraryLoan> {
    const loan = await libraryCollections.loans().getOne<LibraryLoan>(loanId);
    const now = new Date();
    const dueDate = new Date(loan.due_date);

    // Calculate fine
    let fineAmount = 0;
    if (now > dueDate) {
        const overdueDays = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
        fineAmount = overdueDays * 1000; // Rp 1.000 per hari
    }

    // Update loan
    const updatedLoan = await libraryCollections.loans().update<LibraryLoan>(loanId, {
        return_date: now.toISOString(),
        is_returned: true,
        fine_amount: fineAmount,
    });

    // Update item status
    await libraryCollections.items().update(loan.item, { status: "AVAILABLE" });

    return updatedLoan;
}

// ==========================================
// Library Visits
// ==========================================

/**
 * Record a visit
 */
export async function recordVisit(memberId: string): Promise<LibraryVisit> {
    const today = new Date().toISOString().split("T")[0];

    // Check if already visited today
    try {
        const safeMemberId = sanitizeId(memberId);
        const existing = await libraryCollections.visits().getFirstListItem<LibraryVisit>(
            `member = "${safeMemberId}" && date = "${today}"`
        );
        return existing; // Already visited
    } catch {
        // Create new visit
        return await libraryCollections.visits().create<LibraryVisit>({
            member: memberId,
            date: today,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Get today's visits count
 */
export async function getTodayVisitsCount(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const result = await libraryCollections.visits().getList(1, 1, {
        filter: `date = "${today}"`,
    });
    return result.totalItems;
}

// ==========================================
// Statistics
// ==========================================

/**
 * Get library statistics
 */
export async function getLibraryStats(): Promise<LibraryStats> {
    const [
        totalBooks,
        availableBooks,
        borrowedBooks,
        totalMembers,
        activeLoans,
        overdueLoans,
        todayVisits,
    ] = await Promise.all([
        libraryCollections.items().getList(1, 1).then((r) => r.totalItems),
        libraryCollections.items().getList(1, 1, { filter: 'status = "AVAILABLE"' }).then((r) => r.totalItems),
        libraryCollections.items().getList(1, 1, { filter: 'status = "BORROWED"' }).then((r) => r.totalItems),
        libraryCollections.members().getList(1, 1, { filter: "is_active = true" }).then((r) => r.totalItems),
        libraryCollections.loans().getList(1, 1, { filter: "is_returned = false" }).then((r) => r.totalItems),
        getOverdueLoans().then((r) => r.length),
        getTodayVisitsCount(),
    ]);

    return {
        totalBooks,
        availableBooks,
        borrowedBooks,
        totalMembers,
        activeLoans,
        overdueLoans,
        todayVisits,
    };
}

// ==========================================
// QR Code Scanning (Kiosk)
// ==========================================

export type ScanResult =
    | { type: "member"; data: LibraryMember }
    | { type: "item"; data: LibraryItem }
    | { type: "error"; message: string };

/**
 * Smart scan - detect if QR is member or item
 */
export async function smartScan(qrCode: string): Promise<ScanResult> {
    // Try member first
    const member = await getMemberByQRCode(qrCode);
    if (member) {
        return { type: "member", data: member };
    }

    // Try item
    const item = await getItemByQRCode(qrCode);
    if (item) {
        return { type: "item", data: item };
    }

    return { type: "error", message: "QR code tidak dikenali" };
}
