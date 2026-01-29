// Audit Log utility for tracking admin actions
import { db } from "@/db";
import { auditLogs } from "@/db/schema/misc";
import { users } from "@/db/schema/users"; // Import users for join
import { desc, eq, and } from "drizzle-orm";

export type AuditAction =
    | "create"
    | "update"
    | "delete"
    | "status_change"
    | "login"
    | "logout"
    | "export"
    | "view"
    | "bulk_action";

export type AuditResource =
    | "registrant"
    | "user"
    | "announcement"
    | "period"
    | "settings"
    | "document";

export interface AuditLogEntry {
    id?: string;
    action: AuditAction;
    resource: AuditResource;
    resource_id?: string;
    user_id?: string;
    user_email?: string;
    user_name?: string;
    details?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created?: Date | null;
}

// Create audit log entry
export async function createAuditLog(entry: Omit<AuditLogEntry, "id" | "created">): Promise<void> {
    try {
        await db.insert(auditLogs).values({
            action: entry.action,
            resource: entry.resource,
            userId: entry.user_id || "system",
            details: JSON.stringify({
                ...entry.details,
                resource_id: entry.resource_id,
                user_email: entry.user_email,
                user_name: entry.user_name,
                ip_address: entry.ip_address,
                user_agent: entry.user_agent,
            }),
        });

        console.log("[Audit]", formatAuditLog(entry));
    } catch (error) {
        console.log("[Audit]", formatAuditLog(entry));
        console.warn("[Audit] Failed to save to database:", error);
    }
}

// Format audit log for console
function formatAuditLog(entry: Omit<AuditLogEntry, "id" | "created">): string {
    const user = entry.user_name || entry.user_email || "Unknown";
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${user} - ${entry.action.toUpperCase()} ${entry.resource}${entry.resource_id ? ` (${entry.resource_id})` : ""}`;
}

// Helper functions for common actions
export const audit = {
    // Registrant actions
    registrantCreated: (registrantId: string, name: string) =>
        createAuditLog({
            action: "create",
            resource: "registrant",
            resource_id: registrantId,
            details: { registrant_name: name },
        }),

    registrantUpdated: (registrantId: string, changes: Record<string, unknown>) =>
        createAuditLog({
            action: "update",
            resource: "registrant",
            resource_id: registrantId,
            details: { changes },
        }),

    registrantStatusChanged: (registrantId: string, oldStatus: string, newStatus: string, name: string) =>
        createAuditLog({
            action: "status_change",
            resource: "registrant",
            resource_id: registrantId,
            details: {
                registrant_name: name,
                old_status: oldStatus,
                new_status: newStatus
            },
        }),

    registrantDeleted: (registrantId: string, name: string) =>
        createAuditLog({
            action: "delete",
            resource: "registrant",
            resource_id: registrantId,
            details: { registrant_name: name },
        }),

    bulkStatusUpdate: (count: number, newStatus: string) =>
        createAuditLog({
            action: "bulk_action",
            resource: "registrant",
            details: { count, new_status: newStatus },
        }),

    // User actions
    userLogin: (userId: string, email: string) =>
        createAuditLog({
            action: "login",
            resource: "user",
            resource_id: userId,
            user_id: userId,
            user_email: email,
        }),

    userLogout: (userId: string, email: string) =>
        createAuditLog({
            action: "logout",
            resource: "user",
            resource_id: userId,
            user_id: userId,
            user_email: email,
        }),

    userCreated: (userId: string, email: string) =>
        createAuditLog({
            action: "create",
            resource: "user",
            resource_id: userId,
            details: { email },
        }),

    userDeleted: (userId: string, email: string) =>
        createAuditLog({
            action: "delete",
            resource: "user",
            resource_id: userId,
            details: { email },
        }),

    // Announcement actions
    announcementCreated: (id: string, title: string) =>
        createAuditLog({
            action: "create",
            resource: "announcement",
            resource_id: id,
            details: { title },
        }),

    announcementUpdated: (id: string, title: string) =>
        createAuditLog({
            action: "update",
            resource: "announcement",
            resource_id: id,
            details: { title },
        }),

    announcementDeleted: (id: string, title: string) =>
        createAuditLog({
            action: "delete",
            resource: "announcement",
            resource_id: id,
            details: { title },
        }),

    // Export actions
    dataExported: (type: "excel" | "pdf", resource: AuditResource, count: number) =>
        createAuditLog({
            action: "export",
            resource,
            details: { export_type: type, record_count: count },
        }),

    // Settings actions
    settingsUpdated: (changes: Record<string, unknown>) =>
        createAuditLog({
            action: "update",
            resource: "settings",
            details: { changes },
        }),
};

// Get audit logs with pagination
export async function getAuditLogs(options?: {
    page?: number;
    perPage?: number;
    resource?: AuditResource;
    action?: AuditAction;
    userId?: string;
}): Promise<{
    items: AuditLogEntry[];
    total: number;
    page: number;
    totalPages: number;
}> {
    try {
        const page = options?.page || 1;
        const perPage = options?.perPage || 50;
        const offset = (page - 1) * perPage;
        
        const conditions = [];
        if (options?.resource) conditions.push(eq(auditLogs.resource, options.resource));
        if (options?.action) conditions.push(eq(auditLogs.action, options.action));
        if (options?.userId) conditions.push(eq(auditLogs.userId, options.userId));
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        // Fetch items with join
        const items = await db
             .select({
                 id: auditLogs.id,
                 action: auditLogs.action,
                 resource: auditLogs.resource,
                 userId: auditLogs.userId,
                 details: auditLogs.details,
                 createdAt: auditLogs.createdAt,
                 userEmail: users.email,
                 userFullName: users.fullName,
             })
             .from(auditLogs)
             .leftJoin(users, eq(auditLogs.userId, users.id))
             .where(whereClause)
             .limit(perPage)
             .offset(offset)
             .orderBy(desc(auditLogs.createdAt));

        // Map Drizzle result to AuditLogEntry
        const mappedItems: AuditLogEntry[] = items.map(item => {
            let details = {};
            try {
                details = JSON.parse(item.details || "{}");
            } catch (e) {
                // ignore
            }
            return {
                id: item.id,
                action: item.action as AuditAction,
                resource: item.resource as AuditResource,
                resource_id: (details as any).resource_id,
                user_id: item.userId || undefined,
                user_email: (details as any).user_email || item.userEmail,
                user_name: (details as any).user_name || item.userFullName,
                details: details,
                ip_address: (details as any).ip_address,
                user_agent: (details as any).user_agent,
                created: item.createdAt,
            };
        });

        return {
            items: mappedItems,
            total: mappedItems.length, // Placeholder, implementing real count requires another query
            page,
            totalPages: 1, // Placeholder
        };
    } catch (error) {
        console.error("[Audit] Failed to fetch logs:", error);
        return { items: [], total: 0, page: 1, totalPages: 0 };
    }
}
