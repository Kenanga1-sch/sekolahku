// ==========================================
// Soft Delete Utilities
// ==========================================
// Pattern for recoverable deletions


/**
 * Soft delete a record by setting deletedAt timestamp
 */
export async function softDelete<T extends { deletedAt: SQLiteColumn }>(
    db: any,
    table: SQLiteTableWithColumns<any>,
    idColumn: SQLiteColumn,
    id: string
): Promise<boolean> {
    const result = await db
        .update(table)
        .set({ deletedAt: new Date() } as any)
        .where(eq(idColumn, id))
        .returning();
    
    return result.length > 0;
}

/**
 * Restore a soft-deleted record
 */
export async function restore<T extends { deletedAt: SQLiteColumn }>(
    db: any,
    table: SQLiteTableWithColumns<any>,
    idColumn: SQLiteColumn,
    id: string
): Promise<boolean> {
    const result = await db
        .update(table)
        .set({ deletedAt: null } as any)
        .where(eq(idColumn, id))
        .returning();
    
    return result.length > 0;
}

/**
 * Permanently delete records that were soft-deleted before a certain date
 */
export async function purgeOldDeleted(
    db: any,
    table: SQLiteTableWithColumns<any>,
    deletedAtColumn: SQLiteColumn,
    olderThanDays: number = 30
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
        .delete(table)
        .where(
            and(
                isNotNull(deletedAtColumn),
                sql`${deletedAtColumn} < ${cutoffDate.toISOString()}`
            )
        )
        .returning();
    
    return result.length;
}

// ==========================================
// Query Helpers for Soft Delete
// ==========================================

/**
 * Filter condition to exclude soft-deleted records
 * Usage: .where(notDeleted(table.deletedAt))
 */
export function notDeleted(deletedAtColumn: SQLiteColumn) {
    return isNull(deletedAtColumn);
}

/**
 * Filter condition to only show soft-deleted records
 * Usage: .where(onlyDeleted(table.deletedAt))
 */
export function onlyDeleted(deletedAtColumn: SQLiteColumn) {
    return isNotNull(deletedAtColumn);
}

// ==========================================
// Schema Helper
// ==========================================

/**
 * Add to your Drizzle schema for soft delete support:
 * 
 *  * 
 * // In your table definition:
 * deletedAt: integer("deleted_at", { mode: "timestamp" }),
 * 
 * Example migration:
 * ALTER TABLE your_table ADD COLUMN deleted_at INTEGER;
 */

// ==========================================
// Soft Delete Types
// ==========================================

export interface SoftDeletable {
    deletedAt: Date | null;
}

/**
 * Type helper to mark a type as having soft delete
 */
export type WithSoftDelete<T> = T & SoftDeletable;
