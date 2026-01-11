"use client";

import { useState, useEffect, useCallback } from "react";
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
import { getAuditLogs, type AuditLogEntry, type AuditAction, type AuditResource } from "@/lib/audit";

const actionIcons: Record<AuditAction, React.ReactNode> = {
    create: <Plus className="h-4 w-4" />,
    update: <Edit className="h-4 w-4" />,
    delete: <Trash2 className="h-4 w-4" />,
    status_change: <CheckSquare className="h-4 w-4" />,
    login: <LogIn className="h-4 w-4" />,
    logout: <LogOut className="h-4 w-4" />,
    export: <Download className="h-4 w-4" />,
    view: <Eye className="h-4 w-4" />,
    bulk_action: <CheckSquare className="h-4 w-4" />,
};

const actionColors: Record<AuditAction, string> = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    status_change: "bg-purple-100 text-purple-700",
    login: "bg-emerald-100 text-emerald-700",
    logout: "bg-gray-100 text-gray-700",
    export: "bg-amber-100 text-amber-700",
    view: "bg-sky-100 text-sky-700",
    bulk_action: "bg-indigo-100 text-indigo-700",
};

const actionLabels: Record<AuditAction, string> = {
    create: "Buat",
    update: "Update",
    delete: "Hapus",
    status_change: "Status",
    login: "Login",
    logout: "Logout",
    export: "Export",
    view: "Lihat",
    bulk_action: "Bulk",
};

const resourceLabels: Record<AuditResource, string> = {
    registrant: "Pendaftar",
    user: "Pengguna",
    announcement: "Pengumuman",
    period: "Periode",
    settings: "Pengaturan",
    document: "Dokumen",
};

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDetails(details: Record<string, unknown>): string {
    const parts: string[] = [];
    if (details.registrant_name) parts.push(`"${details.registrant_name}"`);
    if (details.title) parts.push(`"${details.title}"`);
    if (details.email) parts.push(`${details.email}`);
    if (details.old_status && details.new_status) parts.push(`${details.old_status} → ${details.new_status}`);
    if (details.count) parts.push(`${details.count} item`);
    if (details.export_type) parts.push(`${String(details.export_type).toUpperCase()}`);
    return parts.join(" • ") || "-";
}

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterAction, setFilterAction] = useState<string>("all");
    const [filterResource, setFilterResource] = useState<string>("all");

    const fetchLogs = useCallback(async () => {
        try {
            const result = await getAuditLogs({
                page,
                perPage: 20,
                action: filterAction !== "all" ? filterAction as AuditAction : undefined,
                resource: filterResource !== "all" ? filterResource as AuditResource : undefined,
            });
            setLogs(result.items);
            setTotalPages(result.totalPages);
        } catch {
            setLogs([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [page, filterAction, filterResource]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleRefresh = () => { setIsRefreshing(true); fetchLogs(); };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Activity className="h-8 w-8 text-primary" />
                        Log Aktivitas
                    </h1>
                    <p className="text-muted-foreground mt-1">Riwayat semua aktivitas admin</p>
                </div>
                <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5" />
                        Filter
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <Select value={filterAction} onValueChange={setFilterAction}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Semua Aksi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                <SelectItem value="create">Buat</SelectItem>
                                <SelectItem value="update">Update</SelectItem>
                                <SelectItem value="delete">Hapus</SelectItem>
                                <SelectItem value="status_change">Ubah Status</SelectItem>
                                <SelectItem value="login">Login</SelectItem>
                                <SelectItem value="export">Export</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterResource} onValueChange={setFilterResource}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Semua Resource" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Resource</SelectItem>
                                <SelectItem value="registrant">Pendaftar</SelectItem>
                                <SelectItem value="user">Pengguna</SelectItem>
                                <SelectItem value="announcement">Pengumuman</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-44">Waktu</TableHead>
                                <TableHead className="w-28">Aksi</TableHead>
                                <TableHead className="w-32">Resource</TableHead>
                                <TableHead>Detail</TableHead>
                                <TableHead>User</TableHead>
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
                            ) : logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-sm text-muted-foreground">{log.created ? formatDate(log.created) : "-"}</TableCell>
                                    <TableCell>
                                        <Badge className={`gap-1 ${actionColors[log.action]}`}>
                                            {actionIcons[log.action]}
                                            {actionLabels[log.action]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{resourceLabels[log.resource]}</TableCell>
                                    <TableCell className="text-sm">{log.details ? formatDetails(log.details) : "-"}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{log.user_name || log.user_email || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Selanjutnya</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
