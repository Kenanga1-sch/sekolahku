"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { differenceInYears, differenceInMonths } from "date-fns";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Search, Filter, MoreHorizontal, Eye, CheckCircle, XCircle, Users, RefreshCw, Trash2, UserCheck, Loader2, HelpCircle } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/spmb-export";
import { goGet, goPost, goPatch, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";
import { SPMBPromoteDialog } from "@/components/spmb/spmb-promote-dialog";
import { calculateSPMBDomisiliPriority, type SPMBAgeEligibility } from "@/lib/spmb-priority";

// Define Drizzle-compatible interface locally for now
interface Registrant {
    id: string;
    registrationNumber: string;
    fullName: string;
    gender: "L" | "P";
    distanceToSchool: number;
    isInZone: boolean;
    createdAt: string;
    birthDate: string; // Added birthDate
    status: string;
    priorityScore?: number;
    ageEligibility?: SPMBAgeEligibility;
    needsSpecialRecommendation?: boolean;
    isAgeEligible?: boolean;
    isWithinReceptionArea?: boolean;
}

interface Stats {
  total: number;
  pending: number;
  verified: number;
  accepted: number;
  rejected: number;
}

function getAgePriorityLabel(ageEligibility?: SPMBAgeEligibility) {
  switch (ageEligibility) {
    case "priority_7_plus":
      return "Prioritas 7+";
    case "eligible_6_plus":
      return "Memenuhi";
    case "conditional_5_6":
      return "Butuh Rekomendasi";
    case "ineligible":
      return "Belum Memenuhi";
    default:
      return "-";
  }
}

function getAgePriorityClass(ageEligibility?: SPMBAgeEligibility) {
  switch (ageEligibility) {
    case "priority_7_plus":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-100 dark:border-green-800";
    case "eligible_6_plus":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800";
    case "conditional_5_6":
      return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800";
    case "ineligible":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-100 dark:border-red-800";
    default:
      return "";
  }
}

// function getStatusBadge removed

export default function SPMBAdminPage() {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState(3);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Promote Dialog
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [promoteCandidate, setPromoteCandidate] = useState<{id: string, name: string} | null>(null);

  // Fetch school max distance settings
  useEffect(() => {
    goGet("/api/school-settings")
      .then((data: any) => {
        const settings = data?.data ?? data;
        if (settings && settings.max_distance_km) {
          setMaxDistance(settings.max_distance_km);
        }
      })
      .catch(err => console.error("Failed to fetch settings", err));
  }, []);

  const fetchData = useCallback(async () => {
    try {
        const query = new URLSearchParams({
            page: page.toString(),
            perPage: "10",
            search: searchQuery,
        });
        if (statusFilter !== "all") {
            query.set("status", statusFilter);
        }

        const res: any = await goGet(`/api/spmb/registrants?${query.toString()}`);

        if (res.success) {
            const items = Array.isArray(res.items) ? res.items : [];
            const referenceDate = new Date(new Date().getFullYear(), 6, 1);
            const itemsWithPriority = items.map((r: any) => {
                const priority = calculateSPMBDomisiliPriority({
                    birthDate: r.birthDate,
                    distanceKm: r.distanceToSchool,
                    maxDistanceKm: maxDistance,
                    referenceDate,
                });

                return {
                    ...r,
                    priorityScore: priority.priorityScore,
                    ageEligibility: priority.ageEligibility,
                    needsSpecialRecommendation: priority.needsSpecialRecommendation,
                    isAgeEligible: priority.isAgeEligible,
                    isWithinReceptionArea: priority.isWithinReceptionArea,
                };
            }).sort((a: any, b: any) => {
                if (a.isWithinReceptionArea !== b.isWithinReceptionArea) {
                    return a.isWithinReceptionArea ? -1 : 1;
                }
                if (a.isAgeEligible !== b.isAgeEligible) {
                    return a.isAgeEligible ? -1 : 1;
                }
                const ageA = a.birthDate ? differenceInMonths(referenceDate, new Date(a.birthDate)) : 0;
                const ageB = b.birthDate ? differenceInMonths(referenceDate, new Date(b.birthDate)) : 0;
                if (ageA !== ageB) {
                    return ageB - ageA;
                }
                return (a.distanceToSchool ?? Number.POSITIVE_INFINITY) - (b.distanceToSchool ?? Number.POSITIVE_INFINITY);
            });

            setRegistrants(itemsWithPriority);
            setSelectedIds([]);
            setTotalPages(Math.max(res.totalPages || 1, 1));
        }

        // Fetch stats
        const statsRes: any = await goGet("/api/spmb/stats");
        if (statsRes.success) {
            setStats({ total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0, ...statsRes.data });
        }

    } catch (error) {
      console.error("Failed to fetch registrants:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, statusFilter, searchQuery, maxDistance]);

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
        await goPatch(`/api/spmb/registrants/${id}`, { status: newStatus });
        showSuccess("Status diperbarui");
        fetchData();
    } catch (error) {
        showError("Gagal memperbarui status");
    } finally {
        setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
        await goDelete(`/api/spmb/registrants/${deleteId}`);
        showSuccess("Pendaftar dihapus");
        setDeleteId(null);
        fetchData();
    } catch (error) {
        showError("Gagal menghapus pendaftar");
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
            goPatch(`/api/spmb/registrants/${id}`, { status: newStatus })
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
      <SPMBPromoteDialog
        open={isPromoteOpen}
        onOpenChange={setIsPromoteOpen}
        registrantId={promoteCandidate?.id || null}
        registrantName={promoteCandidate?.name}
        onSuccess={() => fetchData()}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pendaftar SPMB</h1>
          <p className="text-muted-foreground">
            Kelola dan verifikasi data pendaftar siswa baru
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Process Acceptance Button - Temporarily Disabled */}
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" variant="outline" disabled={actionLoading === "export"}>
                 {actionLoading === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                setActionLoading("export");
                try {
                   // Fetch ALL data
                   const query = new URLSearchParams({
                      page: "1",
                      perPage: "-1", // Fetch all
                      search: searchQuery,
                   });
                   if (statusFilter !== "all") {
                     query.set("status", statusFilter);
                   }
                   const res: any = await goGet(`/api/spmb/registrants?${query.toString()}`);
                   
                   if (res.items) {
                       await exportToExcel(res.items, "Data-Lengkap-PPDB");
                   }
                } catch (e) {
                   console.error("Export failed", e);
                } finally {
                    setActionLoading(null);
                }
              }}>
                📊 Export Excel (Lengkap)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                 setActionLoading("export");
                 try {
                 const query = new URLSearchParams({
                 page: "1",
                 perPage: "-1",
                 search: searchQuery,
                 });
                 if (statusFilter !== "all") {
                   query.set("status", statusFilter);
                 }
                 const res: any = await goGet(`/api/spmb/registrants?${query.toString()}`);
                 
                                    if (res.items) {
                   await exportToPDF(res.items, "Data-Ringkas-PPDB");
                 }
                 } catch (e) {
                   console.error("Export failed", e);
                 } finally {
                   setActionLoading(null);
                 }
              }}>
                📄 Export PDF (Ringkas)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-4 flex flex-col justify-between space-y-2">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm font-medium text-muted-foreground">Total Pendaftar</div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.total}</div>
        </Card>
        <Card className="p-4 flex flex-col justify-between space-y-2">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
             <div className="text-sm font-medium text-muted-foreground">Menunggu</div>
             <RefreshCw className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.pending}</div>
        </Card>
        <Card className="p-4 flex flex-col justify-between space-y-2">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
             <div className="text-sm font-medium text-muted-foreground">Terverifikasi</div>
             <CheckCircle className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.verified}</div>
        </Card>
        <Card className="p-4 flex flex-col justify-between space-y-2">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
             <div className="text-sm font-medium text-muted-foreground">Diterima</div>
             <UserCheck className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.accepted}</div>
        </Card>
        <Card className="p-4 flex flex-col justify-between space-y-2">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
             <div className="text-sm font-medium text-muted-foreground">Ditolak</div>
             <XCircle className="h-4 w-4 text-red-600" />
          </div>
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
                  <TableHead>
                    <div className="flex items-center gap-1">
                        Prioritas Usia
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="not-italic text-xs max-w-[200px]">
                                        <strong>Prioritas SPMB SD:</strong><br/>
                                        Jalur Domisili mengikuti urutan usia, lalu jarak terdekat ke sekolah jika kuota terlampaui.<br/>
                                        <br/>
                                        Usia dihitung per 1 Juli tahun berjalan.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead>Usia</TableHead>
                  <TableHead className="hidden md:table-cell">Jarak</TableHead>
                  <TableHead className="hidden lg:table-cell">Domisili</TableHead>
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
                    <TableCell colSpan={10} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Tidak ada data ditemukan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  registrants.map((r) => {
                    const isInReceptionArea = (r.distanceToSchool || 0) <= maxDistance;
                    return (
                    <TableRow key={r.id} className={selectedIds.includes(r.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {r.registrationNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.gender === "L" ? "Laki-laki" : "Perempuan"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getAgePriorityClass(r.ageEligibility)}>
                            {getAgePriorityLabel(r.ageEligibility)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                            if (!r.birthDate) return <span className="text-muted-foreground">-</span>;
                            const dob = new Date(r.birthDate);
                            const today = new Date();
                            const referenceDate = new Date(today.getFullYear(), 6, 1); // July 1st
                            const years = differenceInYears(referenceDate, dob);
                            const months = differenceInMonths(referenceDate, dob) % 12;
                            return (
                                <span className={years >= 7 ? "text-green-600 font-medium" : "text-amber-600"}>
                                    {years} Thn {months} Bln
                                </span>
                            );
                        })()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.distanceToSchool?.toFixed(2) || "0.00"} km
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          className={isInReceptionArea ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}
                        >
                          {isInReceptionArea ? "Dalam Wilayah" : "Luar Wilayah"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(r.createdAt || "").toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell><SPMBStatusBadge status={r.status} /></TableCell>
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
                              <Link href={`/spmb-admin/detail?id=${r.id}`}>
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
                            <DropdownMenuSeparator />
                            {r.status === "accepted" && (
                                <DropdownMenuItem 
                                    className="text-indigo-600 font-medium"
                                    onClick={() => {
                                        setPromoteCandidate({ id: r.id, name: r.fullName });
                                        setIsPromoteOpen(true);
                                    }}
                                >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Promosikan ke Siswa
                                </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
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



