"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { differenceInYears, differenceInMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable, TablePagination } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Users,
  RefreshCw,
  Trash2,
  UserCheck,
  Loader2,
  Plus,
  Pencil,
  Power
} from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/spmb-export";
import { goGet, goPost, goPatch, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";
import { SPMBPromoteDialog } from "@/components/spmb/spmb-promote-dialog";
import { ProcessAcceptanceDialog } from "@/components/spmb/process-acceptance-dialog";
import { calculateSPMBDomisiliPriority } from "@/lib/spmb-priority";
import { useSortableData } from "@/hooks/use-sortable-data";
import { normalizePeriod, getAgePriorityLabel, getAgePriorityClass } from "./types-spmb";
import type { Registrant, SPMBStats as Stats, Period, GlobalSettings, SPMBRegistrantsResponse, SPMBStatsResponse } from "./types-spmb";

export default function TabSPMB() {
  const searchParams = useSearchParams();
  const subTab = searchParams.get("sub") as "registrants" | "periods" | null;

  // Tabs State
  const [activeTab, setActiveTab] = useState<"registrants" | "periods">("registrants");

  useEffect(() => {
    if (subTab === "registrants" || subTab === "periods") {
      setActiveTab(subTab);
    }
  }, [subTab]);

  // Registrants State
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
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
  const { sortedData: sortedRegistrants, sortConfig, requestSort } = useSortableData(registrants);

  // Periods State
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [isPeriodLoading, setIsPeriodLoading] = useState(true);
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [deletePeriodId, setDeletePeriodId] = useState<string | null>(null);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  const [periodFormData, setPeriodFormData] = useState({
    name: "",
    committeeName: "",
    startDate: "",
    endDate: "",
    quota: "",
    isActive: false,
  });

  // Global settings
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);

  // Fetch school settings for max distance & global SPMB switch
  const fetchGlobalSettings = useCallback(async () => {
    setIsGlobalLoading(true);
    try {
      const data = await goGet<{ data?: GlobalSettings; [key: string]: unknown }>("/api/school-settings");
      const settings: GlobalSettings | undefined = data?.data;
      if (settings) {
        setGlobalSettings(settings);
        if (settings.max_distance_km) {
          setMaxDistance(settings.max_distance_km);
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setIsGlobalLoading(false);
    }
  }, []);

  const toggleGlobalSPMB = async (checked: boolean) => {
    if (!globalSettings) return;
    const prev = { ...globalSettings };
    const next = { ...globalSettings, spmb_is_open: checked };
    setGlobalSettings(next);
    try {
      const saved = await goPost<{ data?: GlobalSettings; [key: string]: unknown }>("/api/school-settings", next);
      if (saved.data) {
        setGlobalSettings(saved.data);
      }
      showSuccess(`Pendaftaran online ${checked ? 'dibuka' : 'ditutup'}`);
    } catch (e) {
      showError("Gagal mengubah status pendaftaran");
      setGlobalSettings(prev);
    }
  };

  const fetchPeriods = useCallback(async () => {
    setIsPeriodLoading(true);
    try {
      const res = await goGet<{ success?: boolean; data?: Record<string, unknown>[] }>("/api/spmb/periods");
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : [];
        setPeriods(items.map(normalizePeriod));
      }
    } catch (error) {
      console.error("Failed to fetch periods:", error);
    } finally {
      setIsPeriodLoading(false);
    }
  }, []);

  // Fetch active period to set as default
  const fetchActivePeriod = useCallback(async () => {
    try {
      const res = await goGet<{ success?: boolean; period?: Record<string, unknown> }>("/api/spmb/periods/active");
      if (res.success && res.period) {
        setSelectedPeriodId((res.period as Record<string, unknown>).id as string);
      } else {
        setSelectedPeriodId("all");
      }
    } catch (e) {
      console.error("Failed to fetch active period:", e);
    }
  }, []);

  useEffect(() => {
    fetchGlobalSettings();
    fetchPeriods();
    fetchActivePeriod();
  }, [fetchGlobalSettings, fetchPeriods, fetchActivePeriod]);

  // Fetch Data (Registrants & Stats)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const query = new URLSearchParams({
            page: page.toString(),
            perPage: perPage.toString(),
            search: searchQuery,
        });
        if (statusFilter !== "all") {
            query.set("status", statusFilter);
        }
        if (selectedPeriodId && selectedPeriodId !== "all") {
            query.set("periodId", selectedPeriodId);
        }

        const res = await goGet<SPMBRegistrantsResponse>(`/api/spmb/registrants?${query.toString()}`);

        if (res.success) {
            const items = Array.isArray(res.items) ? res.items : [];
            const referenceDate = new Date(new Date().getFullYear(), 6, 1);
            const itemsWithPriority = items.map((r) => {
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
            }).sort((a, b) => {
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
        const statsQuery = selectedPeriodId && selectedPeriodId !== "all"
          ? `?periodId=${selectedPeriodId}`
          : "";
        const statsRes = await goGet<SPMBStatsResponse>(`/api/spmb/stats${statsQuery}`);
        if (statsRes.success) {
            setStats({ total: 0, pending: 0, verified: 0, accepted: 0, rejected: 0, ...statsRes.data });
        }

    } catch (error) {
      console.error("Failed to fetch registrants:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, perPage, statusFilter, searchQuery, maxDistance, selectedPeriodId]);

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
      showSuccess(`Berhasil memperbarui ${selectedIds.length} status pendaftar`);
    } catch (error) {
      console.error("Failed to batch update:", error);
      showError("Gagal memperbarui status secara massal");
    } finally {
      setBatchLoading(false);
    }
  };

  // Period Form Handlers
  const resetPeriodForm = () => {
    setPeriodFormData({
      name: "",
      committeeName: "",
      startDate: "",
      endDate: "",
      quota: "",
      isActive: false,
    });
    setEditingPeriodId(null);
  };

  const handlePeriodSubmit = async () => {
    setIsSavingPeriod(true);
    try {
      if (!periodFormData.name.trim()) {
        showError("Nama periode wajib diisi");
        return;
      }
      if (!periodFormData.startDate || !periodFormData.endDate) {
        showError("Tanggal mulai dan selesai wajib diisi");
        return;
      }
      if (new Date(periodFormData.endDate) < new Date(periodFormData.startDate)) {
        showError("Tanggal selesai tidak boleh sebelum tanggal mulai");
        return;
      }

      const payload = {
        name: periodFormData.name.trim(),
        committeeName: periodFormData.committeeName.trim(),
        startDate: periodFormData.startDate,
        endDate: periodFormData.endDate,
        quota: parseInt(periodFormData.quota) || 100,
        isActive: periodFormData.isActive,
      };

      if (editingPeriodId) {
        await goPatch(`/api/spmb/periods/${editingPeriodId}`, payload);
        showSuccess("Gelombang pendaftaran diperbarui");
      } else {
        await goPost("/api/spmb/periods", payload);
        showSuccess("Gelombang pendaftaran baru berhasil ditambahkan");
      }

      fetchPeriods();
      setIsPeriodDialogOpen(false);
      resetPeriodForm();
    } catch (error) {
      showError("Gagal menyimpan periode");
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const handlePeriodEdit = (item: Period) => {
    setEditingPeriodId(item.id);
    setPeriodFormData({
      name: item.name,
      committeeName: item.committeeName || "",
      startDate: item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "",
      endDate: item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "",
      quota: (item.quota || 100).toString(),
      isActive: item.isActive,
    });
    setIsPeriodDialogOpen(true);
  };

  const handlePeriodDelete = async () => {
    if (!deletePeriodId) return;
    try {
      await goDelete(`/api/spmb/periods/${deletePeriodId}`);
      showSuccess("Periode berhasil dihapus");
      setDeletePeriodId(null);
      fetchPeriods();
    } catch (error) {
      showError("Gagal menghapus periode. Pastikan tidak ada pendaftar di periode ini.");
    }
  };

  const handleSetPeriodActiveStatus = async (id: string, currentActive: boolean) => {
    try {
      await goPatch(`/api/spmb/periods/${id}`, { isActive: !currentActive });
      showSuccess(`Periode ${!currentActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchPeriods();
    } catch (error) {
      showError("Gagal mengubah status keaktifan periode");
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

      {/* Global Settings & Main Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-xl border border-slate-100 dark:border-zinc-900">
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto items-stretch sm:items-center">
          {/* Active Period Dropdown Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-zinc-400 shrink-0">Gelombang:</span>
            <Select value={selectedPeriodId} onValueChange={(v) => { setSelectedPeriodId(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[220px] bg-white dark:bg-zinc-900 border shadow-sm">
                <SelectValue placeholder="Pilih Gelombang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Gelombang</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.isActive ? "(Aktif)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Global Open/Close Switch */}
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 border px-3 py-2 rounded-lg shadow-sm w-full sm:w-auto">
            <span className="text-xs sm:text-sm font-semibold">Pendaftaran Online:</span>
            {isGlobalLoading ? (
              <Skeleton className="h-5 w-10" />
            ) : (
              <Switch 
                checked={!!globalSettings?.spmb_is_open} 
                onCheckedChange={toggleGlobalSPMB} 
              />
            )}
          </div>
        </div>

        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40 max-w-fit mb-6">
        <button 
          onClick={() => setActiveTab("registrants")} 
          className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${activeTab === "registrants" ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800" : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"}`}
        >
          Daftar Pendaftar
        </button>
        <button 
          onClick={() => setActiveTab("periods")} 
          className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${activeTab === "periods" ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800" : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"}`}
        >
          Gelombang Pendaftaran
        </button>
      </div>

      {activeTab === "registrants" ? (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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

          {/* Filters & Table */}
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama atau nomor pendaftaran..."
                    className="pl-9 h-10 border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                
                 <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-48 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
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

                  <Select
                    value={perPage.toString()}
                    onValueChange={(val) => {
                      setPerPage(parseInt(val));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[120px] bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                      <SelectValue placeholder="Baris" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Baris</SelectItem>
                      <SelectItem value="20">20 Baris</SelectItem>
                      <SelectItem value="50">50 Baris</SelectItem>
                      <SelectItem value="100">100 Baris</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="col-span-2 sm:col-span-1 w-full sm:w-auto gap-2 border-slate-200 dark:border-zinc-800" variant="outline" disabled={actionLoading === "export"}>
                         {actionLoading === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export Data
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                           if (selectedPeriodId && selectedPeriodId !== "all") {
                             query.set("periodId", selectedPeriodId);
                           }
                            const res = await goGet<SPMBRegistrantsResponse>(`/api/spmb/registrants?${query.toString()}`);
                           
                            if (res.items) {
                                await exportToExcel(res.items as unknown as Parameters<typeof exportToExcel>[0], "Data-Lengkap-PPDB");
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
                         if (selectedPeriodId && selectedPeriodId !== "all") {
                           query.set("periodId", selectedPeriodId);
                         }
                          const res = await goGet<SPMBRegistrantsResponse>(`/api/spmb/registrants?${query.toString()}`);

                          if (res.items) {
                            await exportToPDF(res.items as unknown as Parameters<typeof exportToPDF>[0], "Data-Ringkas-PPDB");
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
              
              {/* Batch Action Bar */}
              {selectedIds.length > 0 && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-sm font-medium">
                    {selectedIds.length} pendaftar dipilih
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBatchUpdate("verified")}
                      disabled={batchLoading}
                      className="bg-white/50 hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
                    >
                      {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Verifikasi
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-200 bg-green-50/50 hover:bg-green-100 dark:text-green-400 dark:border-green-900/50 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                      onClick={() => handleBatchUpdate("accepted")}
                      disabled={batchLoading}
                    >
                      {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                      Terima
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-200 bg-red-50/50 hover:bg-red-100 dark:text-red-400 dark:border-red-900/50 dark:bg-red-900/20 dark:hover:bg-red-900/40"
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
            </CardHeader>
            <CardContent className="p-0">

              {/* Table */}
              <DataTable
                data={isLoading ? [] : sortedRegistrants}
                getRowId={(r) => r.id}
                loading={isLoading}
                sortConfig={sortConfig}
                onSort={requestSort}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                emptyTitle="Tidak ada data ditemukan"
                emptyDescription="Pendaftar SPMB akan muncul di sini."
                columns={[
                  {
                    key: "registrationNumber",
                    header: "No. Pendaftaran",
                    sortable: true,
                    card: "field",
                    render: (r) => (
                      <span className="font-mono text-sm">{r.registrationNumber}</span>
                    ),
                  },
                  {
                    key: "fullName",
                    header: "Nama Lengkap",
                    sortable: true,
                    card: "title",
                    render: (r) => (
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-zinc-200">{r.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.gender === "L" ? "Laki-laki" : "Perempuan"}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "ageEligibility",
                    header: "Prioritas Usia",
                    card: "field",
                    render: (r) => (
                      <Badge variant="outline" className={getAgePriorityClass(r.ageEligibility)}>
                        {getAgePriorityLabel(r.ageEligibility)}
                      </Badge>
                    ),
                  },
                  {
                    key: "birthDate",
                    header: "Usia",
                    sortable: true,
                    card: "field",
                    render: (r) => {
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
                    },
                  },
                  {
                    key: "distanceToSchool",
                    header: "Jarak",
                    sortable: true,
                    card: "field",
                    render: (r) => <span>{r.distanceToSchool?.toFixed(2) || "0.00"} km</span>,
                  },
                  {
                    key: "domisili",
                    header: "Domisili",
                    card: "field",
                    render: (r) => {
                      const isInReceptionArea = (r.distanceToSchool || 0) <= maxDistance;
                      return (
                        <Badge
                          className={isInReceptionArea ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}
                        >
                          {isInReceptionArea ? "Dalam Wilayah" : "Luar Wilayah"}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "createdAt",
                    header: "Tanggal",
                    sortable: true,
                    card: "hidden",
                    render: (r) => (
                      <span className="text-muted-foreground text-sm">
                        {new Date(r.createdAt || "").toLocaleDateString("id-ID")}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortable: true,
                    card: "field",
                    render: (r) => <SPMBStatusBadge status={r.status} />,
                  },
                ]}
                actions={(r) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-muted-foreground hover:text-foreground" disabled={actionLoading === r.id}>
                        {actionLoading === r.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/siswa/spmb-detail?id=${r.id}`}>
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
                )}
              />

              {/* Pagination */}
              {!isLoading && registrants.length > 0 && (
                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  label={`${registrants.length} pendaftar`}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Periods Management Tab */
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Gelombang Pendaftaran</CardTitle>
              <CardDescription>Atur gelombang penerimaan, kuota, dan masa pendaftaran online</CardDescription>
            </div>
            <Button className="gap-2" onClick={() => { resetPeriodForm(); setIsPeriodDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              Tambah Gelombang
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={isPeriodLoading ? [] : periods}
              getRowId={(p) => p.id}
              loading={isPeriodLoading}
              emptyTitle="Belum ada gelombang pendaftaran"
              emptyDescription="Tambahkan gelombang untuk membuka pendaftaran online."
              columns={[
                {
                  key: "name",
                  header: "Nama Gelombang",
                  card: "title",
                  render: (p) => <span className="font-semibold">{p.name}</span>,
                },
                {
                  key: "academicYear",
                  header: "Tahun Akademik",
                  card: "field",
                  render: (p) => p.academicYear,
                },
                {
                  key: "startDate",
                  header: "Mulai",
                  card: "field",
                  render: (p) => (p.startDate ? new Date(p.startDate).toLocaleDateString("id-ID") : "-"),
                },
                {
                  key: "endDate",
                  header: "Selesai",
                  card: "field",
                  render: (p) => (p.endDate ? new Date(p.endDate).toLocaleDateString("id-ID") : "-"),
                },
                {
                  key: "quota",
                  header: "Kuota",
                  card: "field",
                  render: (p) => <span className="font-mono">{p.quota}</span>,
                },
                {
                  key: "registered",
                  header: "Terdaftar",
                  card: "field",
                  render: (p) => <Badge variant="secondary">{p.registered}</Badge>,
                },
                {
                  key: "isActive",
                  header: "Status",
                  card: "field",
                  render: (p) => (
                    <Badge className={p.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-100"}>
                      {p.isActive ? "Aktif" : "Tidak Aktif"}
                    </Badge>
                  ),
                },
              ]}
              actions={(p) => (
                <div className="flex items-center justify-end gap-1">
                  <ProcessAcceptanceDialog
                    periodId={p.id}
                    periodName={p.name}
                    quota={p.quota}
                    onProcessComplete={() => {
                      fetchPeriods();
                      fetchData();
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePeriodEdit(p)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetPeriodActiveStatus(p.id, p.isActive)}>
                        <Power className="mr-2 h-4 w-4 text-amber-500" />
                        {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeletePeriodId(p.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Period Create/Edit Dialog */}
      <Dialog open={isPeriodDialogOpen} onOpenChange={setIsPeriodDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPeriodId ? "Edit Gelombang Pendaftaran" : "Tambah Gelombang Pendaftaran"}</DialogTitle>
            <DialogDescription>
              Buat atau perbarui rincian periode pendaftaran siswa baru.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="period-name" className="sm:text-right">Nama Gelombang</Label>
              <Input
                id="period-name"
                value={periodFormData.name}
                onChange={(e) => setPeriodFormData({ ...periodFormData, name: e.target.value })}
                placeholder="misal: Gelombang 1"
                className="sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="committee" className="sm:text-right">Panitia PPDB</Label>
              <Input
                id="committee"
                value={periodFormData.committeeName}
                onChange={(e) => setPeriodFormData({ ...periodFormData, committeeName: e.target.value })}
                placeholder="Nama Ketua Panitia"
                className="sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="start-date" className="sm:text-right">Tanggal Mulai</Label>
              <Input
                id="start-date"
                type="date"
                value={periodFormData.startDate}
                onChange={(e) => setPeriodFormData({ ...periodFormData, startDate: e.target.value })}
                className="sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="end-date" className="sm:text-right">Tanggal Selesai</Label>
              <Input
                id="end-date"
                type="date"
                value={periodFormData.endDate}
                onChange={(e) => setPeriodFormData({ ...periodFormData, endDate: e.target.value })}
                className="sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="quota" className="sm:text-right">Kuota Siswa</Label>
              <Input
                id="quota"
                type="number"
                value={periodFormData.quota}
                onChange={(e) => setPeriodFormData({ ...periodFormData, quota: e.target.value })}
                placeholder="100"
                className="sm:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="is-active" className="sm:text-right">Langsung Aktifkan</Label>
              <div className="sm:col-span-3 flex items-center">
                <Switch
                  id="is-active"
                  checked={periodFormData.isActive}
                  onCheckedChange={(checked) => setPeriodFormData({ ...periodFormData, isActive: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPeriodDialogOpen(false)}>Batal</Button>
            <Button onClick={handlePeriodSubmit} disabled={isSavingPeriod}>
              {isSavingPeriod ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Registrant Confirmation */}
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

      {/* Delete Period Confirmation */}
      <AlertDialog open={!!deletePeriodId} onOpenChange={() => setDeletePeriodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Gelombang Pendaftaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Gelombang pendaftaran ini akan dihapus permanen dari sistem. 
              Tindakan ini akan gagal jika sudah ada pendaftar yang terdaftar di gelombang ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handlePeriodDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
