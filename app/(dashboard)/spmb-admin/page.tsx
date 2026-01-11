"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Download,
  Users,
  RefreshCw,
  Trash2,
  UserCheck,
  Loader2,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { exportToExcel, exportToPDF } from "@/lib/export";
import type { SPMBRegistrant } from "@/types";

interface Stats {
  total: number;
  pending: number;
  verified: number;
  accepted: number;
  rejected: number;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    verified: "Terverifikasi",
    accepted: "Diterima",
    rejected: "Ditolak",
  };
  return (
    <Badge className={styles[status] || styles.pending}>
      {labels[status] || status}
    </Badge>
  );
}

export default function SPMBAdminPage() {
  const [registrants, setRegistrants] = useState<SPMBRegistrant[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Build filter
      let filter = "";
      const filters: string[] = [];

      if (statusFilter !== "all") {
        filters.push(`status = "${statusFilter}"`);
      }
      if (searchQuery) {
        filters.push(`(student_name ~ "${searchQuery}" || registration_number ~ "${searchQuery}")`);
      }
      if (filters.length > 0) {
        filter = filters.join(" && ");
      }

      // Fetch registrants
      const result = await pb.collection("spmb_registrants").getList<SPMBRegistrant>(page, 10, {
        filter,
        sort: "-created",
      });

      setRegistrants(result.items);
      setTotalPages(result.totalPages);

      // Fetch stats
      const [totalRes, pendingRes, verifiedRes, acceptedRes, rejectedRes] = await Promise.all([
        pb.collection("spmb_registrants").getList(1, 1),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "pending"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "verified"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "accepted"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "rejected"' }),
      ]);

      setStats({
        total: totalRes.totalItems,
        pending: pendingRes.totalItems,
        verified: verifiedRes.totalItems,
        accepted: acceptedRes.totalItems,
        rejected: rejectedRes.totalItems,
      });
    } catch (error) {
      console.error("Failed to fetch registrants:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      await pb.collection("spmb_registrants").update(id, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      await pb.collection("spmb_registrants").delete(deleteId);
      setDeleteId(null);
      fetchData();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Batch selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === registrants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(registrants.map((r) => r.id));
    }
  };

  const handleBatchUpdate = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          pb.collection("spmb_registrants").update(id, { status: newStatus })
        )
      );
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error("Failed to batch update:", error);
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pendaftar SPMB</h1>
          <p className="text-muted-foreground">
            Kelola dan verifikasi data pendaftar siswa baru
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                const all = await pb.collection("spmb_registrants").getFullList<SPMBRegistrant>({ sort: "-created" });
                exportToExcel(all, "pendaftar-spmb");
              }}>
                📊 Export ke Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const all = await pb.collection("spmb_registrants").getFullList<SPMBRegistrant>({ sort: "-created" });
                exportToPDF(all, "pendaftar-spmb");
              }}>
                📄 Export ke PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Terverifikasi</div>
          <div className="text-2xl font-bold text-blue-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.verified}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Diterima</div>
          <div className="text-2xl font-bold text-green-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.accepted}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Ditolak</div>
          <div className="text-2xl font-bold text-red-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.rejected}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau nomor pendaftaran..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="accepted">Diterima</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Batch Action Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.length} pendaftar dipilih
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchUpdate("verified")}
                  disabled={batchLoading}
                >
                  {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Verifikasi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => handleBatchUpdate("accepted")}
                  disabled={batchLoading}
                >
                  {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                  Terima
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleBatchUpdate("rejected")}
                  disabled={batchLoading}
                >
                  {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Tolak
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={registrants.length > 0 && selectedIds.length === registrants.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>No. Pendaftaran</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead className="hidden md:table-cell">Jarak</TableHead>
                  <TableHead className="hidden lg:table-cell">Zonasi</TableHead>
                  <TableHead className="hidden md:table-cell">Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : registrants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Tidak ada data ditemukan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  registrants.map((r) => (
                    <TableRow key={r.id} className={selectedIds.includes(r.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {r.registration_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.student_name || r.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.gender === "L" ? "Laki-laki" : "Perempuan"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.distance_to_school?.toFixed(1) || "-"} km
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          className={r.is_in_zone || r.is_within_zone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                        >
                          {r.is_in_zone || r.is_within_zone ? "Dalam" : "Luar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(r.created).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionLoading === r.id}>
                              {actionLoading === r.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/spmb-admin/${r.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {r.status === "pending" && (
                              <DropdownMenuItem
                                className="text-blue-600"
                                onClick={() => handleUpdateStatus(r.id, "verified")}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Verifikasi
                              </DropdownMenuItem>
                            )}
                            {(r.status === "pending" || r.status === "verified") && (
                              <DropdownMenuItem
                                className="text-green-600"
                                onClick={() => handleUpdateStatus(r.id, "accepted")}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Terima
                              </DropdownMenuItem>
                            )}
                            {r.status !== "rejected" && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleUpdateStatus(r.id, "rejected")}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Tolak
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(r.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pendaftar?</AlertDialogTitle>
            <AlertDialogDescription>
              Data pendaftar akan dihapus permanen dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
