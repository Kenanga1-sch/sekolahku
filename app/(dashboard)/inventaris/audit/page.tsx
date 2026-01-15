"use client";

import { useEffect, useState, useCallback } from "react";
import {
    FileText,
    Search,
    Download,
    Filter,
    History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getPocketBase } from "@/lib/pocketbase";
import type { InventoryAudit, AuditAction, AuditEntity } from "@/types/inventory";

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

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const pb = getPocketBase();
            let filter = "";

            if (actionFilter !== "all") {
                filter = `action = "${actionFilter}"`;
            }
            if (entityFilter !== "all") {
                filter = filter
                    ? `${filter} && entity = "${entityFilter}"`
                    : `entity = "${entityFilter}"`;
            }

            const result = await pb.collection("inventory_audit").getList<InventoryAudit>(page, 20, {
                filter,
                sort: "-created",
                expand: "user",
            });

            setLogs(result.items);
            setTotalPages(result.totalPages);
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

    const getChangesSummary = (changes?: any[]) => {
        if (!changes || changes.length === 0) return "-";
        return changes.map(c => c.field).join(", ");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Riwayat Audit</h1>
                    <p className="text-muted-foreground">
                        Log aktivitas perubahan data inventaris
                    </p>
                </div>
                <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[180px]">
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
                            <SelectTrigger className="w-[180px]">
                                <History className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter Entitas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Entitas</SelectItem>
                                <SelectItem value="ASSET">Aset</SelectItem>
                                <SelectItem value="ROOM">Ruangan</SelectItem>
                                <SelectItem value="OPNAME">Opname</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Aksi</TableHead>
                                <TableHead>Entitas</TableHead>
                                <TableHead>Perubahan</TableHead>
                                <TableHead>Detail</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada data log.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm">
                                            {formatDate(log.created)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                                    {log.expand?.user?.name?.[0] || "?"}
                                                </div>
                                                <span className="text-sm">{log.expand?.user?.name || "System"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={ACTION_COLORS[log.action] || "default" as any}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs">{log.entity}</span>
                                            <span className="text-xs text-muted-foreground ml-2">#{log.entity_id.slice(0, 5)}</span>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate">
                                            {getChangesSummary(log.changes)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm">
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="py-2 px-4 text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
