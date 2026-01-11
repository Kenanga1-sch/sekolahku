// Audit Log utility for tracking admin actions
import { pb } from "./pocketbase";

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
    created?: string;
}

// Create audit log entry
export async function createAuditLog(entry: Omit<AuditLogEntry, "id" | "created">): Promise<void> {
    try {
        // Get current user info if available
        const currentUser = pb.authStore.record;

        const logEntry = {
            action: entry.action,
            resource: entry.resource,
            resource_id: entry.resource_id || "",
            user_id: entry.user_id || currentUser?.id || "system",
            user_email: entry.user_email || currentUser?.email || "system",
            user_name: entry.user_name || currentUser?.name || "System",
            details: JSON.stringify(entry.details || {}),
            ip_address: entry.ip_address || "",
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 255) : "",
        };

        // Try to save to PocketBase
        // Note: You need to create "audit_logs" collection in PocketBase
        await pb.collection("audit_logs").create(logEntry);

        console.log("[Audit]", formatAuditLog(entry));
    } catch (error) {
        // If collection doesn't exist or error, just log to console
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
        const filters: string[] = [];

        if (options?.resource) {
            filters.push(`resource = "${options.resource}"`);
        }
        if (options?.action) {
            filters.push(`action = "${options.action}"`);
        }
        if (options?.userId) {
            filters.push(`user_id = "${options.userId}"`);
        }

        const result = await pb.collection("audit_logs").getList(
            options?.page || 1,
            options?.perPage || 50,
            {
                sort: "-created",
                filter: filters.join(" && ") || undefined,
            }
        );

        return {
            items: result.items.map(item => ({
                id: item.id,
                action: item.action as AuditAction,
                resource: item.resource as AuditResource,
                resource_id: item.resource_id,
                user_id: item.user_id,
                user_email: item.user_email,
                user_name: item.user_name,
                details: JSON.parse(item.details || "{}"),
                ip_address: item.ip_address,
                user_agent: item.user_agent,
                created: item.created,
            })),
            total: result.totalItems,
            page: result.page,
            totalPages: result.totalPages,
        };
    } catch (error) {
        console.error("[Audit] Failed to fetch logs:", error);
        return { items: [], total: 0, page: 1, totalPages: 0 };
    }
}
