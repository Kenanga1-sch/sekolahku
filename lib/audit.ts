/**
 * audit — Client-side data fetcher for Audit Logs
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

export async function createAuditLog(data: Partial<AuditLogItem>) {
  return await goPost("/api/audit-logs", data);
}

export async function getAuditLogs(page = 1, limit = 20, action?: string, resource?: string) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (action && action !== "all") params.append("action", action);
  if (resource && resource !== "all") params.append("resource", resource);
  
  return await goGet(`/api/audit-logs?${params.toString()}`);
}
