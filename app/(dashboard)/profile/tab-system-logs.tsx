"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Activity,
    RefreshCw,
    Filter,
    Trash2,
    Edit,
    Plus,
    LogIn,
    LogOut,
    Download,
    Eye,
    CheckSquare,
} from "lucide-react";
import type { AuditAction, AuditResource } from "@/lib/audit";
import { goGet } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface AuditLogEntry {
    id?: string;
    action: AuditAction;
    resource: AuditResource;
    resource_id?: string;
    user_id?: string;
    user_email?: string;
    user_name?: string;
    details?: string | Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created?: Date | string | null;
}

const actionValues: AuditAction[] = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "APPROVE",
    "REJECT",
    "RESTORE",
    "EXPORT",
    "UPLOAD",
];

const resourceValues: AuditResource[] = [
    "USER",
    "STUDENT",
    "INVENTORY",
    "SURAT_MASUK",
    "SURAT_KELUAR",
    "SYSTEM",
    "CONFIG",
    "FINANCE",
    "TABUNGAN",
    "SPMB",
];

const actionIcons: Record<AuditAction, ReactNode> = {
    CREATE: <Plus className="h-4 w-4" />,
    UPDATE: <Edit className="h-4 w-4" />,
    DELETE: <Trash2 className="h-4 w-4" />,
    LOGIN: <LogIn className="h-4 w-4" />,
    LOGOUT: <LogOut className="h-4 w-4" />,
    APPROVE: <CheckSquare className="h-4 w-4" />,
    REJECT: <Trash2 className="h-4 w-4" />,
    RESTORE: <RefreshCw className="h-4 w-4" />,
    EXPORT: <Download className="h-4 w-4" />,
    UPLOAD: <Eye className="h-4 w-4" />,
};

const actionColors: Record<AuditAction, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    LOGIN: "bg-emerald-100 text-emerald-700",
    LOGOUT: "bg-gray-100 text-gray-700",
    APPROVE: "bg-purple-100 text-purple-700",
    REJECT: "bg-red-100 text-red-700",
    RESTORE: "bg-indigo-100 text-indigo-700",
    EXPORT: "bg-amber-100 text-amber-700",
    UPLOAD: "bg-sky-100 text-sky-700",
};

const actionLabels: Record<AuditAction, string> = {
    CREATE: "Buat",
    UPDATE: "Update",
    DELETE: "Hapus",
    LOGIN: "Login",
    LOGOUT: "Logout",
    APPROVE: "Setujui",
    REJECT: "Tolak",
    RESTORE: "Pulihkan",
    EXPORT: "Export",
    UPLOAD: "Upload",
};

const resourceLabels: Record<AuditResource, string> = {
    USER: "Pengguna",
    STUDENT: "Siswa",
    INVENTORY: "Inventaris",
    SURAT_MASUK: "Surat Masuk",
    SURAT_KELUAR: "Surat Keluar",
    SYSTEM: "Sistem",
    CONFIG: "Pengaturan",
    FINANCE: "Keuangan",
    TABUNGAN: "Tabungan",
    SPMB: "SPMB",
};

function normalizeAction(action?: string): AuditAction {
    const value = (action || "UPDATE").toUpperCase();
    return actionValues.includes(value as AuditAction) ? (value as AuditAction) : "UPDATE";
}

function normalizeResource(resource?: string): AuditResource {
    const map: Record<string, AuditResource> = {
        USER: "USER",
        USERS: "USER",
        PENGGUNA: "USER",
        STUDENT: "STUDENT",
        STUDENTS: "STUDENT",
        SISWA: "STUDENT",
        INVENTORY: "INVENTORY",
        INVENTARIS: "INVENTORY",
        SURAT_MASUK: "SURAT_MASUK",
        SURAT_KELUAR: "SURAT_KELUAR",
        SETTINGS: "CONFIG",
        SETTING: "CONFIG",
        CONFIG: "CONFIG",
        SCHOOL_SETTINGS: "CONFIG",
        PROFILE: "SYSTEM",
        SECURITY: "SYSTEM",
        SYSTEM: "SYSTEM",
        FINANCE: "FINANCE",
        KEUANGAN: "FINANCE",
        TABUNGAN: "TABUNGAN",
        SAVINGS: "TABUNGAN",
        SPMB: "SPMB",
    };
    const value = (resource || "SYSTEM").toUpperCase();
    return map[value] || "SYSTEM";
}

function normalizeLog(log: any): AuditLogEntry {
    return {
        id: log.id,
        action: normalizeAction(log.action),
        resource: normalizeResource(log.resource),
        resource_id: log.resource_id || log.resourceId,
        user_id: log.user_id || log.userId,
        user_email: log.user_email || log.userEmail,
        user_name: log.user_name || log.userName,
        details: log.details,
        ip_address: log.ip_address || log.ipAddress,
        user_agent: log.user_agent || log.userAgent,
        created: log.created || log.createdAt,
    };
}

function formatDetails(details?: string | Record<string, unknown>): string {
    if (!details) return "-";

    if (typeof details === "string") {
        const trimmed = details.trim();
        if (!trimmed) return "-";

        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
                return formatDetails(parsed as Record<string, unknown>);
            }
        } catch {
            return trimmed;
        }

        return trimmed;
    }

    const parts: string[] = [];
    if (details.registrant_name) parts.push(`"${details.registrant_name}"`);
    if (details.title) parts.push(`"${details.title}"`);
    if (details.email) parts.push(`${details.email}`);
    if (details.old_status && details.new_status) parts.push(`${details.old_status} -> ${details.new_status}`);
    if (details.count) parts.push(`${details.count} item`);
    if (details.export_type) parts.push(`${String(details.export_type).toUpperCase()}`);
    return parts.join(" - ") || "-";
}

export default function TabSystemLogs() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [filterAction, setFilterAction] = useState<string>("all");
    const [filterResource, setFilterResource] = useState<string>("all");
    const { sortedData: sortedLogs, sortConfig, requestSort } = useSortableData(logs);

    const fetchLogs = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (filterAction !== "all") queryParams.append("action", filterAction);
            if (filterResource !== "all") queryParams.append("resource", filterResource);

            const result: any = await goGet(`/api/audit-logs?${queryParams.toString()}`);
            setLogs((result.items || []).map(normalizeLog));
            setTotalPages(result.totalPages || 1);
        } catch {
            setLogs([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [page, limit, filterAction, filterResource]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchLogs();
    };

    return (
        <div className="space-y-6 bg-white dark:bg-zinc-950 p-6 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-xs">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/60 pb-4 mb-4">
                <div>
                    <h3 className="text-lg font-bold">Log Aktivitas Sistem</h3>
                    <p className="text-muted-foreground text-xs font-normal">Riwayat semua jejak aktivitas administratif sistem.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="border-slate-200 hover:bg-slate-50">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card className="border-slate-250/50 dark:border-zinc-850/50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Filter className="h-4.5 w-4.5" />
                        Filter Pencarian
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <Select value={filterAction} onValueChange={(value) => { setFilterAction(value); setPage(1); }}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Semua Aksi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                <SelectItem value="CREATE">Buat</SelectItem>
                                <SelectItem value="UPDATE">Update</SelectItem>
                                <SelectItem value="DELETE">Hapus</SelectItem>
                                <SelectItem value="APPROVE">Setujui</SelectItem>
                                <SelectItem value="REJECT">Tolak</SelectItem>
                                <SelectItem value="LOGIN">Login</SelectItem>
                                <SelectItem value="EXPORT">Export</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterResource} onValueChange={(value) => { setFilterResource(value); setPage(1); }}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Semua Resource" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Resource</SelectItem>
                                {resourceValues.map((resource) => (
                                    <SelectItem key={resource} value={resource}>
                                        {resourceLabels[resource]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={limit.toString()}
                            onValueChange={(val) => {
                                setLimit(parseInt(val));
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Baris" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10 Baris</SelectItem>
                                <SelectItem value="20">20 Baris</SelectItem>
                                <SelectItem value="50">50 Baris</SelectItem>
                                <SelectItem value="100">100 Baris</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200/80 dark:border-zinc-800/80">
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <SortableTableHead label="Waktu" sortKey="created" sortConfig={sortConfig} onSort={requestSort} className="w-44" />
                                <SortableTableHead label="Aksi" sortKey="action" sortConfig={sortConfig} onSort={requestSort} className="w-28" />
                                <SortableTableHead label="Resource" sortKey="resource" sortConfig={sortConfig} onSort={requestSort} className="w-32" />
                                <TableHead>Detail</TableHead>
                                <SortableTableHead label="User" sortKey="user_name" sortConfig={sortConfig} onSort={requestSort} />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    </TableRow>
                                ))
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12">
                                        <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                        <p className="text-muted-foreground">Belum ada log aktivitas</p>
                                    </TableCell>
                                </TableRow>
                            ) : sortedLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(log.created)}</TableCell>
                                    <TableCell>
                                        <Badge className={`gap-1 ${actionColors[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                                            {actionIcons[log.action] ?? <Activity className="h-4 w-4" />}
                                            {actionLabels[log.action] ?? log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{resourceLabels[log.resource] ?? log.resource}</TableCell>
                                    <TableCell className="text-sm">{formatDetails(log.details)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{log.user_name || log.user_email || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {logs.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-zinc-800">
                            <div className="text-sm text-muted-foreground">
                                Halaman {page} dari {totalPages}
                            </div>
                            {totalPages > 1 && (
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Selanjutnya</Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
