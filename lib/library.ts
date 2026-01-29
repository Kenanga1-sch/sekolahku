// ==========================================
// Library Helpers (Drizzle ORM)
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryItems, libraryMembers, libraryLoans, libraryVisits } from "@/db/schema/library";
import { students } from "@/db/schema/students";
import { users } from "@/db/schema/users";
import { eq, like, and, or, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { sanitizeFilter, sanitizeId } from "./security";
import type {
    LibraryItem,
    LibraryMember,
    LibraryLoan,
    LibraryVisit,
    LibraryStats,
} from "@/types/library";

// ==========================================
// Library Items (Books)
// ==========================================

export interface GetLibraryItemsOptions {
    search?: string;
    category?: string;
    sort?: string;
}

/**
 * Get all library items with optional filters
 */
export async function getLibraryItems(
    page = 1,
    perPage = 20,
    options: GetLibraryItemsOptions = {}
): Promise<{ items: LibraryItem[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;
    
    // Build where clause
    const conditions = [];
    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(or(
            like(libraryItems.title, s),
            like(libraryItems.author, s),
            like(libraryItems.isbn, s)
        ));
    }
    if (options.category && options.category !== 'all') {
        conditions.push(eq(libraryItems.category, options.category as any));
    }

    const whereClause = conditions.length > 0 ? (conditions.length > 1 ? and(...conditions) : conditions[0]) : undefined;

    // Count total
    let countQuery = db.select({ count: sql<number>`count(*)` })
        .from(libraryItems)
        .$dynamic();
    
    if (whereClause) {
        countQuery = countQuery.where(whereClause);
    }
    const [countResult] = await countQuery;

    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    // Get items
    let query = db.select()
        .from(libraryItems)
        .$dynamic();
    
    if (whereClause) {
        query = query.where(whereClause);
    }
    
    const items = await query
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(libraryItems.createdAt)); // Default sort

    return {
        items: items as LibraryItem[],
        totalPages,
        totalItems,
    };
}

/**
 * Get single library item by ID
 */
export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
    try {
        const [item] = await db.select()
            .from(libraryItems)
            .where(eq(libraryItems.id, id))
            .limit(1);
        return (item as LibraryItem) || null;
    } catch {
        return null;
    }
}

/**
 * Get library item by QR code
 */
export async function getItemByQRCode(qrCode: string): Promise<LibraryItem | null> {
    try {
        const [item] = await db.select()
            .from(libraryItems)
            .where(eq(libraryItems.qrCode, qrCode))
            .limit(1);
        return (item as LibraryItem) || null;
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
    if (!data.qrCode) {
        data.qrCode = `BOOK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
    
    const [newItem] = await db.insert(libraryItems).values({
        ...data,
        status: "AVAILABLE",
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    
    return newItem as LibraryItem;
}

/**
 * Update library item
 */
export async function updateLibraryItem(
    id: string,
    data: Partial<LibraryItem>
): Promise<LibraryItem> {
    const [updated] = await db.update(libraryItems)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(libraryItems.id, id))
        .returning();
    return updated as LibraryItem;
}

/**
 * Delete library item
 */
export async function deleteLibraryItem(id: string): Promise<boolean> {
    try {
        await db.delete(libraryItems).where(eq(libraryItems.id, id));
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// Library Members
// ==========================================

export interface GetLibraryMembersOptions {
    search?: string;
    sort?: string;
}

/**
 * Get all library members
 */
export async function getLibraryMembers(
    page = 1,
    perPage = 20,
    options: GetLibraryMembersOptions = {}
): Promise<{ items: LibraryMember[]; totalPages: number; totalItems: number }> {
    const offset = (page - 1) * perPage;
    
    const conditions = [eq(libraryMembers.isActive, true)];
    if (options.search) {
        const s = `%${options.search}%`;
        conditions.push(or(
            like(libraryMembers.name, s),
            like(libraryMembers.className, s),
            like(libraryMembers.qrCode, s)
        ) as any);
    }

    const whereClause = and(...conditions);

    let countQuery = db.select({ count: sql<number>`count(*)` })
        .from(libraryMembers)
        .$dynamic();
    
    if (whereClause) {
        countQuery = countQuery.where(whereClause);
    }
    const [countResult] = await countQuery;

    const totalItems = countResult.count;
    const totalPages = Math.ceil(totalItems / perPage);

    let query = db.select()
        .from(libraryMembers)
        .$dynamic();
    
    if (whereClause) {
        query = query.where(whereClause);
    }
    
    const items = await query
        .limit(perPage)
        .offset(offset)
        .orderBy(desc(libraryMembers.createdAt));

    return {
        items: items as LibraryMember[],
        totalPages,
        totalItems,
    };
}

/**
 * Get member by QR code
 */
export async function getMemberByQRCode(qrCode: string): Promise<LibraryMember | null> {
    try {
        const [member] = await db.select()
            .from(libraryMembers)
            .where(and(eq(libraryMembers.qrCode, qrCode), eq(libraryMembers.isActive, true)))
            .limit(1);
        return (member as LibraryMember) || null;
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
    if (!data.qrCode) {
        data.qrCode = `MBR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
    
    const [newMember] = await db.insert(libraryMembers).values({
        ...data,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any).returning();
    
    return newMember as LibraryMember;
}

/**
 * Update library member
 */
export async function updateLibraryMember(
    id: string,
    data: Partial<LibraryMember>
): Promise<LibraryMember> {
    const [updated] = await db.update(libraryMembers)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(libraryMembers.id, id))
        .returning();
    return updated as LibraryMember;
}

/**
 * Delete library member
 */
export async function deleteLibraryMember(id: string): Promise<boolean> {
    try {
        await db.delete(libraryMembers).where(eq(libraryMembers.id, id));
        return true;
    } catch {
        return false;
    }
}

/**
 * Get library member by student ID
 */
export async function getMemberByStudentId(studentId: string): Promise<LibraryMember | null> {
    try {
        const [member] = await db.select()
            .from(libraryMembers)
            .where(and(eq(libraryMembers.studentId, studentId), eq(libraryMembers.isActive, true)))
            .limit(1);
        return (member as LibraryMember) || null;
    } catch {
        return null;
    }
}

/**
 * Get library member by student's QR code
 * This looks up the student first, then finds the linked library member
 */
export async function getMemberByStudentQRCode(qrCode: string): Promise<LibraryMember | null> {
    try {
        // Find student by QR code
        const [student] = await db.select()
            .from(students)
            .where(eq(students.qrCode, qrCode))
            .limit(1);
        
        if (!student) return null;
        
        // Find linked library member
        return getMemberByStudentId(student.id);
    } catch {
        return null;
    }
}

/**
 * Link an existing library member to a student
 */
export async function linkMemberToStudent(memberId: string, studentId: string): Promise<LibraryMember | null> {
    try {
        const [updated] = await db.update(libraryMembers)
            .set({ studentId, updatedAt: new Date() } as any)
            .where(eq(libraryMembers.id, memberId))
            .returning();
        return updated as LibraryMember;
    } catch {
        return null;
    }
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
    const offset = (page - 1) * perPage;
    
    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(libraryLoans)
        .where(eq(libraryLoans.isReturned, false));
    
    const rows = await db
        .select({
            loan: libraryLoans,
            member: libraryMembers,
            item: libraryItems,
        })
        .from(libraryLoans)
        .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
        .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(eq(libraryLoans.isReturned, false))
        .orderBy(asc(libraryLoans.dueDate))
        .limit(perPage)
        .offset(offset);

    const items = rows.map(({ loan, member, item }) => ({
        ...loan,
        member: member || null,
        item: item || null,
    }));

    return { 
        items: items as LibraryLoan[],
        totalItems: countResult[0].count 
    };
}

/**
 * Get overdue loans
 */
export async function getOverdueLoans(): Promise<LibraryLoan[]> {
    const today = new Date(); // Drizzle handles Date objects for comparison? 
    // SQLite stores dates as numbers or strings. We store as Int (timestamp) or Text.
    // Schema uses `integer(..., { mode: "timestamp" })`.
    // So we can compare with Date object.
    
    const rows = await db
        .select({
            loan: libraryLoans,
            member: libraryMembers,
            item: libraryItems,
        })
        .from(libraryLoans)
        .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
        .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(and(
            eq(libraryLoans.isReturned, false),
            lte(libraryLoans.dueDate, today)
        ))
        .orderBy(asc(libraryLoans.dueDate));

    return rows.map(({ loan, member, item }) => ({
        ...loan,
        member: member || null,
        item: item || null,
    })) as LibraryLoan[];
}

/**
 * Get member's active loans
 */
export async function getMemberActiveLoans(memberId: string): Promise<LibraryLoan[]> {
    const rows = await db
        .select({
            loan: libraryLoans,
            item: libraryItems,
        })
        .from(libraryLoans)
        .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(and(
            eq(libraryLoans.memberId, memberId),
            eq(libraryLoans.isReturned, false)
        ));

    return rows.map(({ loan, item }) => ({
        ...loan,
        item: item || null,
    })) as LibraryLoan[];
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

    // Create loan
    const [loan] = await db.insert(libraryLoans).values({
        memberId,
        itemId,
        borrowDate: now,
        dueDate: dueDate,
        isReturned: false,
        fineAmount: 0,
        finePaid: false,
        createdAt: now,
        updatedAt: now,
    } as any).returning(); // No relations returned here, simple object

    // Update item status
    await db.update(libraryItems)
        .set({ status: "BORROWED", updatedAt: now } as any)
        .where(eq(libraryItems.id, itemId));

    return loan as LibraryLoan;
}

/**
 * Return a book
 */
export async function returnBook(loanId: string): Promise<LibraryLoan> {
    const [loan] = await db.select()
        .from(libraryLoans)
        .where(eq(libraryLoans.id, loanId))
        .limit(1);
    if (!loan) throw new Error("Loan not found");

    const now = new Date();
    const dueDate = new Date(loan.dueDate);

    // Calculate fine
    let fineAmount = 0;
    if (now > dueDate) {
        const overdueDays = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
        fineAmount = overdueDays * 1000;
    }

    // Update loan
    const [updatedLoan] = await db.update(libraryLoans)
        .set({
            returnDate: now,
            isReturned: true,
            fineAmount: fineAmount,
            updatedAt: now,
        } as any)
        .where(eq(libraryLoans.id, loanId))
        .returning();

    // Update item status
    await db.update(libraryItems)
        .set({ status: "AVAILABLE", updatedAt: now } as any)
        .where(eq(libraryItems.id, loan.itemId));

    return updatedLoan as LibraryLoan;
}

// ==========================================
// Library Visits
// ==========================================

/**
 * Record a visit
 */
export async function recordVisit(memberId: string): Promise<LibraryVisit> {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Check if visited (Assuming 'date' string column usage for simple checks, or timestamp range)
    // Schema `libraryVisits.date` is text ("YYYY-MM-DD").
    const [existing] = await db.select()
        .from(libraryVisits)
        .where(and(
            eq(libraryVisits.memberId, memberId),
            eq(libraryVisits.date, todayStr)
        ))
        .limit(1);

    if (existing) return existing as LibraryVisit;

    const [visit] = await db.insert(libraryVisits).values({
        memberId,
        date: todayStr,
        timestamp: new Date(),
        createdAt: new Date(),
    } as any).returning();
    
    return visit as LibraryVisit;
}

/**
 * Get today's visits count
 */
export async function getTodayVisitsCount(): Promise<number> {
    const todayStr = new Date().toISOString().split("T")[0];
    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(libraryVisits)
        .where(eq(libraryVisits.date, todayStr));
    return result.count;
}

/**
 * Check if member already visited today
 */
export async function hasVisitedToday(memberId: string): Promise<boolean> {
    const todayStr = new Date().toISOString().split("T")[0];
    const [existing] = await db.select()
        .from(libraryVisits)
        .where(and(
            eq(libraryVisits.memberId, memberId),
            eq(libraryVisits.date, todayStr)
        ))
        .limit(1);
    return !!existing;
}

/**
 * Find active loan by item ID
 */
export async function findLoanByItemId(itemId: string): Promise<LibraryLoan | null> {
    try {
        const rows = await db
            .select({
                loan: libraryLoans,
                member: libraryMembers,
                item: libraryItems,
            })
            .from(libraryLoans)
            .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
            .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
            .where(and(
                eq(libraryLoans.itemId, itemId),
                eq(libraryLoans.isReturned, false)
            ))
            .limit(1);

        if (rows.length === 0) return null;
        
        const { loan, member, item } = rows[0];
        return {
            ...loan,
            member: member || null,
            item: item || null,
        } as LibraryLoan;
    } catch {
        return null;
    }
}

// ==========================================
// Statistics
// ==========================================

/**
 * Get library statistics
 */
export async function getLibraryStats(): Promise<LibraryStats> {
    const [
        [countItems],
        [countAvailable],
        [countBorrowed],
        [countMembers],
        [countLoans],
        overdueCountObj,
        todayVisits
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(libraryItems),
        db.select({ count: sql<number>`count(*)` }).from(libraryItems).where(eq(libraryItems.status, "AVAILABLE")),
        db.select({ count: sql<number>`count(*)` }).from(libraryItems).where(eq(libraryItems.status, "BORROWED")),
        db.select({ count: sql<number>`count(*)` }).from(libraryMembers).where(eq(libraryMembers.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(libraryLoans).where(eq(libraryLoans.isReturned, false)),
        getOverdueLoans().then(l => l.length), // Reusing function
        getTodayVisitsCount(),
    ]);

    return {
        totalBooks: countItems.count,
        availableBooks: countAvailable.count,
        borrowedBooks: countBorrowed.count,
        totalMembers: countMembers.count,
        activeLoans: countLoans.count,
        overdueLoans: overdueCountObj, // It's number
        todayVisits: todayVisits,
    };
}

// ==========================================
// QR Code Scanning (Kiosk)
// ==========================================

export type ScanResult =
    | { type: "member"; data: LibraryMember }
    | { type: "item"; data: LibraryItem }
    | { type: "student"; data: LibraryMember; studentQr: true }
    | { type: "error"; message: string };

/**
 * Smart scan - supports student QR, member QR, and item QR
 * Auto-registers students as library members when first scanned
 */
export async function smartScan(qrCode: string): Promise<ScanResult> {
    // 1. Check if it's a student QR code (e.g., starts with "STU-")
    if (qrCode.startsWith("STU-")) {
        // First check if already registered as library member
        const existingMember = await getMemberByStudentQRCode(qrCode);
        if (existingMember) return { type: "student", data: existingMember, studentQr: true };
        
        // Not registered yet - try to auto-register
        try {
            // Find the student
            const [student] = await db.select()
                .from(students)
                .where(eq(students.qrCode, qrCode))
                .limit(1);
            
            if (!student) {
                return { type: "error", message: "QR code siswa tidak valid" };
            }
            
            // Auto-create library member linked to student
            const newMember = await createLibraryMember({
                name: student.fullName,
                className: student.className || undefined,
                studentId: student.id,
                qrCode: student.qrCode, // Use student's QR code (STU-) directly!
                isActive: true,
            });
            
            return { type: "student", data: newMember, studentQr: true };
        } catch (error) {
            console.error("Error auto-registering student as library member:", error);
            return { type: "error", message: "Gagal mendaftarkan siswa sebagai anggota perpustakaan" };
        }
    }

    // 2. Check member QR code
    const member = await getMemberByQRCode(qrCode);
    if (member) return { type: "member", data: member };

    // 3. Try to find by student QR (for QR codes that don't start with STU-)
    const memberByStudent = await getMemberByStudentQRCode(qrCode);
    if (memberByStudent) return { type: "student", data: memberByStudent, studentQr: true };

    // 4. Check item QR code
    const item = await getItemByQRCode(qrCode);
    if (item) return { type: "item", data: item };

    return { type: "error", message: "QR code tidak dikenali" };
}

// ==========================================
// Optimized Kiosk Scan (Performance)
// ==========================================

export interface VisitStatus {
    isFirstVisit: boolean;
    visitRecorded: boolean;
}

export type ScanCompleteResult =
    | { type: "member"; data: LibraryMember; visitStatus: VisitStatus; activeLoans: LibraryLoan[] }
    | { type: "student"; data: LibraryMember; studentQr: true; visitStatus: VisitStatus; activeLoans: LibraryLoan[] }
    | { type: "item"; data: LibraryItem }
    | { type: "error"; message: string };

/**
 * Combined visit check and record in one function (reduces 2 API calls to 1)
 */
export async function recordVisitAndCheckStatus(memberId: string): Promise<VisitStatus> {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Single query to check existing visit
    const [existing] = await db.select()
        .from(libraryVisits)
        .where(and(
            eq(libraryVisits.memberId, memberId),
            eq(libraryVisits.date, todayStr)
        ))
        .limit(1);
    
    if (existing) {
        return { isFirstVisit: false, visitRecorded: false };
    }
    
    // Only insert if not visited
    await db.insert(libraryVisits).values({
        memberId,
        date: todayStr,
        timestamp: new Date(),
        createdAt: new Date(),
    } as any);
    
    return { isFirstVisit: true, visitRecorded: true };
}

/**
 * Optimized smart scan that returns all needed data in one call
 * Replaces: smartScan + hasVisitedToday + recordVisit + getMemberActiveLoans
 * Performance: 4 API calls → 1 API call with parallel DB queries
 */
export async function smartScanComplete(qrCode: string): Promise<ScanCompleteResult> {
    const scanResult = await smartScan(qrCode);
    
    // If error or item, return as-is (no visit/loan data needed)
    if (scanResult.type === "error") {
        return scanResult;
    }
    
    if (scanResult.type === "item") {
        return scanResult;
    }
    
    // For member/student, fetch visit status and loans in parallel
    const memberId = scanResult.data.id;
    
    const [visitStatus, activeLoans] = await Promise.all([
        recordVisitAndCheckStatus(memberId),
        getMemberActiveLoans(memberId)
    ]);
    
    if (scanResult.type === "student") {
        return {
            ...scanResult,
            visitStatus,
            activeLoans
        };
    }
    
    return {
        type: "member",
        data: scanResult.data,
        visitStatus,
        activeLoans
    };
}

// ==========================================
// Dashboard Data Functions
// ==========================================

export interface RecentActivity {
    id: string;
    type: "borrow" | "return" | "visit";
    title: string;
    description: string;
    time: string; // ISO string
    memberName?: string;
    itemTitle?: string;
}

export async function getRecentActivity(limit = 10): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];
    
    // Get recent loans
    const loans = await db.select({
            loan: libraryLoans,
            member: libraryMembers,
            item: libraryItems
        })
        .from(libraryLoans)
        .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
        .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .orderBy(desc(libraryLoans.createdAt))
        .limit(limit);

    for (const row of loans) {
        const { loan, member, item } = row;
        const memberName = member?.name || "Anggota";
        const itemTitle = item?.title || "Buku";
        
        // Return event
        if (loan.isReturned && loan.returnDate) {
             activities.push({
                id: `return-${loan.id}`,
                type: "return",
                title: "Pengembalian Buku",
                description: `${memberName} mengembalikan "${itemTitle}"`,
                time: loan.returnDate.toISOString(),
                memberName,
                itemTitle,
            });
        }
        // Borrow event (always add)
        activities.push({
            id: `borrow-${loan.id}`,
            type: "borrow",
            title: "Peminjaman Buku",
            description: `${memberName} meminjam "${itemTitle}"`,
            time: loan.borrowDate.toISOString(),
            memberName,
            itemTitle,
        });
    }

    // Get recent visits
    const visits = await db.select({
            visit: libraryVisits,
            member: libraryMembers
        })
        .from(libraryVisits)
        .leftJoin(libraryMembers, eq(libraryVisits.memberId, libraryMembers.id))
        .orderBy(desc(libraryVisits.timestamp))
        .limit(limit);

    for (const row of visits) {
        const { visit, member } = row;
        const memberName = member?.name || "Anggota";
        activities.push({
            id: `visit-${visit.id}`,
            type: "visit",
            title: "Kunjungan",
            description: `${memberName} mengunjungi perpustakaan`,
            time: visit.timestamp.toISOString(),
            memberName,
        });
    }

    return activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, limit);
}

export interface LoanTrendData {
    date: string;
    pinjam: number;
    kembali: number;
}

export async function getLoanTrend(days = 7): Promise<LoanTrendData[]> {
    const result: LoanTrendData[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.setHours(0,0,0,0));
        const endOfDay = new Date(date.setHours(23,59,59,999));
        
        // Using gte/lte on timestamps
        const [borrowCount] = await db.select({ count: sql<number>`count(*)` })
            .from(libraryLoans)
            .where(and(gte(libraryLoans.borrowDate, startOfDay), lte(libraryLoans.borrowDate, endOfDay)));

        const [returnCount] = await db.select({ count: sql<number>`count(*)` })
            .from(libraryLoans)
            .where(and(gte(libraryLoans.returnDate, startOfDay), lte(libraryLoans.returnDate, endOfDay)));

        result.push({
            date: date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }),
            pinjam: borrowCount.count,
            kembali: returnCount.count,
        });
    }
    return result;
}

export interface CategoryDistribution {
    name: string;
    value: number;
    color: string;
}

// ... constants CATEGORY_COLORS, CATEGORY_LABELS ... (redeclared)
const CATEGORY_COLORS: Record<string, string> = {
    FICTION: "#3b82f6",
    NON_FICTION: "#22c55e",
    REFERENCE: "#f59e0b",
    TEXTBOOK: "#ef4444",
    MAGAZINE: "#8b5cf6",
    OTHER: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
    FICTION: "Fiksi",
    NON_FICTION: "Non-Fiksi",
    REFERENCE: "Referensi",
    TEXTBOOK: "Buku Pelajaran",
    MAGAZINE: "Majalah",
    OTHER: "Lainnya",
};

export async function getCategoryDistribution(): Promise<CategoryDistribution[]> {
    const categories = Object.keys(CATEGORY_LABELS);
    const result: CategoryDistribution[] = [];

    // Group by aggregate query?
    // SQLite: SELECT category, count(*) FROM library_items GROUP BY category
    const stats = await db
        .select({ category: libraryItems.category, count: sql<number>`count(*)` })
        .from(libraryItems)
        .groupBy(libraryItems.category);

    for (const stat of stats) {
        const cat = stat.category || 'OTHER';
        // Check if cat is in our expected list logic or just map it?
        result.push({
            name: CATEGORY_LABELS[cat] || cat,
            value: stat.count,
            color: CATEGORY_COLORS[cat] || "#6b7280",
        });
    }
    return result;
}

export interface TopBook {
    id: string; // Add id
    title: string;
    author?: string;
    borrowCount: number;
    cover?: string;
}

export async function getTopBorrowedBooks(limit = 5): Promise<TopBook[]> {
    // Top items by loan count
    // SELECT item_id, count(*) as c FROM library_loans GROUP BY item_id ORDER BY c DESC LIMIT X
    const top = await db
        .select({
            itemId: libraryLoans.itemId,
            count: sql<number>`count(*)`
        })
        .from(libraryLoans)
        .groupBy(libraryLoans.itemId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

    // FIX: Batch fetch all items in one query instead of N+1
    const itemIds = top.map(t => t.itemId).filter((id): id is string => id !== null);
    if (itemIds.length === 0) return [];
    
    const items = await db.select()
        .from(libraryItems)
        .where(inArray(libraryItems.id, itemIds));
    
    const itemMap = new Map(items.map(item => [item.id, item]));
    
    return top
        .map(t => {
            if (!t.itemId) return null;
            const item = itemMap.get(t.itemId);
            if (!item) return null;
            const result: TopBook = {
                id: item.id,
                title: item.title,
                author: item.author || undefined,
                borrowCount: t.count,
                cover: item.cover || undefined,
            };
            return result;
        })
        .filter(Boolean) as TopBook[];
}

export interface TopMember {
    id: string;
    name: string;
    class_name?: string;
    borrowCount: number;
    photo?: string;
}

export async function getTopActiveMembers(limit = 5): Promise<TopMember[]> {
    const top = await db
        .select({
            memberId: libraryLoans.memberId,
            count: sql<number>`count(*)`
        })
        .from(libraryLoans)
        .groupBy(libraryLoans.memberId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

    // FIX: Batch fetch all members in one query instead of N+1
    const memberIds = top.map(t => t.memberId).filter((id): id is string => id !== null);
    if (memberIds.length === 0) return [];
    
    const members = await db.select()
        .from(libraryMembers)
        .where(inArray(libraryMembers.id, memberIds));
    
    const memberMap = new Map(members.map(m => [m.id, m]));
    
    return top
        .map(t => {
            if (!t.memberId) return null;
            const member = memberMap.get(t.memberId);
            if (!member) return null;
            const result: TopMember = {
                id: member.id,
                name: member.name,
                class_name: member.className || undefined,
                borrowCount: t.count,
                photo: member.photo || undefined,
            };
            return result;
        })
        .filter(Boolean) as TopMember[];
}

export interface LoanReportItem {
    id: string;
    memberName: string;
    memberClass?: string;
    itemTitle: string;
    borrowDate: string; // ISO string
    dueDate: string;
    returnDate?: string;
    isReturned: boolean;
    fineAmount: number;
}

export async function getLoanReport(
    startDate: string,
    endDate: string
): Promise<LoanReportItem[]> {
    const start = new Date(startDate); // 00:00
    const end = new Date(endDate + 'T23:59:59');

    const loans = await db
        .select({
            loan: libraryLoans,
            member: libraryMembers,
            item: libraryItems,
        })
        .from(libraryLoans)
        .leftJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
        .leftJoin(libraryItems, eq(libraryLoans.itemId, libraryItems.id))
        .where(and(gte(libraryLoans.borrowDate, start), lte(libraryLoans.borrowDate, end)))
        .orderBy(desc(libraryLoans.borrowDate));

    return loans.map(({ loan, member, item }) => ({
        id: loan.id,
        memberName: member?.name || "-",
        memberClass: member?.className || undefined,
        itemTitle: item?.title || "-",
        borrowDate: loan.borrowDate.toISOString(),
        dueDate: loan.dueDate.toISOString(),
        returnDate: loan.returnDate?.toISOString(),
        isReturned: loan.isReturned,
        fineAmount: loan.fineAmount,
    }));
}

export interface VisitReportItem {
    id: string;
    memberName: string;
    memberClass?: string;
    date: string;
    timestamp: string;
}

export async function getVisitReport(
    startDate: string,
    endDate: string
): Promise<VisitReportItem[]> {
    // Visits store 'date' string YYYY-MM-DD
    const rows = await db
        .select({
            visit: libraryVisits,
            member: libraryMembers,
        })
        .from(libraryVisits)
        .leftJoin(libraryMembers, eq(libraryVisits.memberId, libraryMembers.id))
        .where(and(gte(libraryVisits.date, startDate), lte(libraryVisits.date, endDate)))
        .orderBy(desc(libraryVisits.timestamp));
    
    return rows.map(({ visit, member }) => ({
        id: visit.id,
        memberName: member?.name || "-",
        memberClass: member?.className || undefined,
        date: visit.date,
        timestamp: visit.timestamp.toISOString(),
    }));
}
