/**
 * audit — Client-side data fetcher
 * All database logic has been moved to the Golang backend.
 * These functions now fetch data via the Golang API.
 */

import { goGet, goPost } from "@/lib/api-client";

export type AuditAction = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "LOGIN" 
  | "LOGOUT" 
  | "APPROVE" 
  | "REJECT" 
  | "RESTORE" 
  | "EXPORT" 
  | "UPLOAD";

export type AuditResource = 
  | "USER" 
  | "STUDENT" 
  | "INVENTORY" 
  | "SURAT_MASUK" 
  | "SURAT_KELUAR" 
  | "SYSTEM" 
  | "CONFIG" 
  | "FINANCE" 
  | "TABUNGAN" 
  | "SPMB";

export interface AuditLogItem {
    id: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    userId: string;
    userFullName: string;
    details: string;
    ipAddress: string;
    userAgent: string;
    createdAt: string;
}

// TODO: Implement specific endpoints as needed.
// For now, functions export stubs that call the Go API.

export async function createAuditLog(...args: any[]) {
  console.warn("createAuditLog: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}

export async function getAuditLogs(...args: any[]) {
  console.warn("getAuditLogs: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}
