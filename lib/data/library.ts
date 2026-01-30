
import { db } from "@/db";
import { libraryItems, libraryMembers, libraryLoans, libraryVisits } from "@/db/schema/library";
import { eq, sql, lt, and, count, desc } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const getCachedLibraryStats = unstable_cache(
    async () => {
        try {
            const today = new Date();
            today.setHours(0,0,0,0);
            const todayStr = today.toISOString().split("T")[0];

            const [
                books,
                available,
                borrowed,
                members,
                loans,
                overdue,
                todayVisits
            ] = await Promise.all([
                db.select({ count: count() }).from(libraryItems),
                db.select({ count: count() }).from(libraryItems).where(eq(libraryItems.status, "AVAILABLE")),
                db.select({ count: count() }).from(libraryItems).where(eq(libraryItems.status, "BORROWED")),
                db.select({ count: count() }).from(libraryMembers).where(eq(libraryMembers.isActive, true)),
                db.select({ count: count() }).from(libraryLoans).where(eq(libraryLoans.isReturned, false)),
                db.select({ count: count() }).from(libraryLoans).where(and(eq(libraryLoans.isReturned, false), lt(libraryLoans.dueDate, new Date()))),
                db.select({ count: count() }).from(libraryVisits).where(eq(libraryVisits.date, todayStr)),
            ]);

            return {
                totalBooks: books[0]?.count || 0,
                availableBooks: available[0]?.count || 0,
                borrowedBooks: borrowed[0]?.count || 0,
                totalMembers: members[0]?.count || 0,
                activeLoans: loans[0]?.count || 0,
                overdueLoans: overdue[0]?.count || 0,
                todayVisits: todayVisits[0]?.count || 0,
            };
        } catch (error) {
            console.error("Error fetching library stats:", error);
            return {
                totalBooks: 0,
                availableBooks: 0,
                borrowedBooks: 0,
                totalMembers: 0,
                activeLoans: 0,
                overdueLoans: 0,
                todayVisits: 0,
            };
        }
    },
    ["library-stats"],
    { revalidate: 300 }
);
