"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Download,
    Filter,
    History,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { goGet } from "@/lib/api-client";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { DataTable, TablePagination } from "@/components/data-table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { InventoryAudit } from "@/types/inventory";
import { recordCreatedAt } from "@/types/inventory";

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    CREATE: "default",
    UPDATE: "secondary",
    DELETE: "destructive",
    OPNAME_APPLY: "outline",
};

export default function AuditLogPage() {
    const [logs, setLogs] = useState<InventoryAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [entityFilter, setEntityFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: "20",
            });
            
            if (actionFilter !== "all") queryParams.append("action", actionFilter);
            if (entityFilter !== "all") queryParams.append("entity", entityFilter);

            const result: any = await goGet(`/api/inventory/audit?${queryParams.toString()}`);
            if (!result.error) {
                setLogs(result.items || result.data || []);
                setTotalPages(result.totalPages || 1);
                setTotalItems(result.totalItems ?? 0);
            }
        } catch (error) {
            console.error("Failed to load audit logs:", error);
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, entityFilter]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "medium",
        });
    };

    const getChangesSummary = (changes?: any[] | string) => {
        if (!changes) return "-";
        let parsed = changes;
        if (typeof changes === "string") {
            try {
                parsed = JSON.parse(changes || "[]");
            } catch {
                return changes;
            }
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return "-";
        return parsed.map(c => c.field).join(", ");
    };
    const changesText = (log: InventoryAudit): string => {
        const c = log.changes as unknown;
        if (!c) return "";
        if (typeof c === "string") return c;
        const arr = c as { field?: string; oldValue?: unknown; newValue?: unknown }[];
        if (Array.isArray(arr)) {
            return arr.map(ch => `${ch.field ?? ""}: ${String(ch.oldValue ?? "-")} → ${String(ch.newValue ?? "-")}`).join("; ");
        }
        return JSON.stringify(c);
    };

    const handleExportCSV = () => {
        const header = ["Waktu", "Aksi", "Entitas", "ID Entitas", "User", "Perubahan"];
        const rows = logs.map(log => [
            recordCreatedAt(log) ?? "",
            log.action ?? "",
            log.entity ?? "",
            log.entity_id ?? "",
            log.expand?.user?.name ?? log.user_id ?? "",
            changesText(log).replace(/[\n;]/g, " "),
        ]);
        const csv = [header, ...rows]
            .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
            .join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `log-aktivitas-inventaris-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/inventaris">
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50" aria-label="Kembali"><ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Riwayat Audit</h1>
                        <p className="text-muted-foreground">
                            Log aktivitas perubahan data inventaris
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleExportCSV}
                    disabled={logs.length === 0}
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter Aksi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                <SelectItem value="CREATE">Create</SelectItem>
                                <SelectItem value="UPDATE">Update</SelectItem>
                                <SelectItem value="DELETE">Delete</SelectItem>
                                <SelectItem value="OPNAME_APPLY">Stok Opname</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <History className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter Entitas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Entitas</SelectItem>
                                <SelectItem value="ASSET">Aset</SelectItem>
                                <SelectItem value="ITEM">Barang Stok</SelectItem>
                                <SelectItem value="ROOM">Ruangan</SelectItem>
                                <SelectItem value="OPNAME">Opname</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <DataTable
                data={loading ? [] : logs}
                getRowId={(log) => log.id}
                loading={loading}
                emptyTitle="Tidak ada data log."
                emptyDescription="Aktivitas perubahan data inventaris akan tercatat di sini."
                columns={[
                    {
                        key: "created",
                        header: "Waktu",
                        card: "field",
                        render: (log) => (
                            <span className="text-sm">
                                {formatDate(recordCreatedAt(log) ?? "")}
                            </span>
                        ),
                    },
                    {
                        key: "user",
                        header: "User",
                        card: "title",
                        render: (log) => (
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                    {log.expand?.user?.name?.[0] || "?"}
                                </div>
                                <span className="text-sm">{log.expand?.user?.name || "System"}</span>
                            </div>
                        ),
                    },
                    {
                        key: "action",
                        header: "Aksi",
                        card: "field",
                        render: (log) => (
                            <Badge variant={ACTION_COLORS[log.action] || "default" as any}>
                                {log.action}
                            </Badge>
                        ),
                    },
                    {
                        key: "entity",
                        header: "Entitas",
                        card: "hidden",
                        render: (log) => (
                            <div>
                                <span className="font-mono text-xs">{log.entity}</span>
                                <span className="text-xs text-muted-foreground ml-2">#{log.entity_id.slice(0, 5)}</span>
                            </div>
                        ),
                    },
                    {
                        key: "changes",
                        header: "Perubahan",
                        card: "field",
                        render: (log) => (
                            <span className="text-sm max-w-[200px] truncate block">
                                {getChangesSummary(log.changes)}
                            </span>
                        ),
                    },
                    {
                        key: "detail",
                        header: "Detail",
                        card: "hidden",
                        render: (log) => {
                            const detail = changesText(log);
                            if (!detail) return null;
                            return (
                                <span className="text-xs text-muted-foreground max-w-[280px] truncate" title={detail}>
                                    {detail}
                                </span>
                            );
                        },
                    },
                ]}
            />

            {!loading && logs.length > 0 && (
                <TablePagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    label={`${totalItems} log`}
                />
            )}
        </div>
    );
}

