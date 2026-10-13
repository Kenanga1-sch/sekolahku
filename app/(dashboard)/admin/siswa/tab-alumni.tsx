"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
} from "@/components/ui/dropdown-menu";
import {
  GraduationCap,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCcw,
  X,
  Filter,
  Printer,
  BookOpen,
  BookMarked,
  Calendar,
  ChevronDown,
  ChevronUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { goGet, goDelete, goPost } from "@/lib/api-client";
import { useSortableData } from "@/hooks/use-sortable-data";
import { statusInfo, type Alumni, type AlumniStats, type Pagination } from "./alumni-types";
import { QuickIndexDialog } from "./_components/quick-index-dialog";
import { AlumniStatsCards } from "./_components/alumni-stats-cards";
import { StatusDistributionBar } from "./_components/status-distribution-bar";

export default function TabAlumni() {
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [stats, setStats] = useState<AlumniStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [quickIndexOpen, setQuickIndexOpen] = useState(false);
  const [quickIndexSaving, setQuickIndexSaving] = useState(false);
  const [quickIndexForm, setQuickIndexForm] = useState({ fullName: "", nisn: "", graduationYear: "", bukuFisikNo: "", registerNo: "" });

  const { sortedData: sortedAlumni, sortConfig, requestSort } = useSortableData(alumni);

  // Debounced search logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when debounced search or filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch]);

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (graduationYear) params.append("graduationYear", graduationYear);
      if (statusFilter) params.append("status", statusFilter);

      const data: any = await goGet(`/api/alumni?${params}`);

      setAlumni(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Error fetching alumni:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data: any = await goGet("/api/alumni/stats");
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchYearOptions = async () => {
    try {
      const data: any = await goGet("/api/alumni/graduation-years");
      setYearOptions(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error("Error fetching graduation years:", error);
    }
  };

  useEffect(() => {
    fetchAlumni();
    fetchStats();
    fetchYearOptions();
  }, [pagination.page, pagination.limit, debouncedSearch, graduationYear, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data siswa ini dari Buku Induk?")) return;

    try {
      await goDelete(`/api/alumni/${id}`);
      fetchAlumni();
      fetchStats();
    } catch (error) {
      console.error("Error deleting alumni:", error);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Batch print Buku Induk ───
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedAlumni.length && sortedAlumni.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedAlumni.map((a) => a.id));
    }
  };

  const handleBatchPrint = () => {
    if (selectedIds.length === 0) {
      alert("Pilih minimal satu data Buku Induk terlebih dahulu (centang checkbox).");
      return;
    }
    const ids = selectedIds.join(",");
    window.open(`/admin/siswa/buku-induk/print?ids=${encodeURIComponent(ids)}&type=alumni`, "_blank");
  };

  const handleSync = async () => {
    if (!confirm("Apakah Anda yakin ingin menyinkronkan seluruh data siswa aktif ke Buku Induk? Data yang sudah ada tidak akan diduplikasi.")) return;

    setSyncing(true);
    try {
      const res = await goPost("/api/students/sync-buku-induk", {});
      fetchAlumni();
      fetchStats();
      alert(res.message || "Sinkronisasi berhasil!");
    } catch (error: any) {
      console.error("Error syncing to buku induk:", error);
      alert(error.message || "Terjadi kesalahan saat sinkronisasi.");
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickIndex = async () => {
    if (quickIndexForm.fullName.trim().length < 3) {
      alert("Nama lengkap minimal 3 karakter");
      return;
    }
    setQuickIndexSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: quickIndexForm.fullName.trim(),
        status: "graduated",
      };
      if (quickIndexForm.graduationYear.trim()) payload.graduationYear = quickIndexForm.graduationYear.trim();
      if (quickIndexForm.nisn.trim()) payload.nisn = quickIndexForm.nisn.trim();
      if (quickIndexForm.bukuFisikNo.trim()) payload.bukuFisikNo = quickIndexForm.bukuFisikNo.trim();
      if (quickIndexForm.registerNo.trim()) payload.registerNo = parseInt(quickIndexForm.registerNo, 10);

      const res: any = await goPost("/api/alumni", payload);
      if (res.error) throw new Error(res.error);
      setQuickIndexOpen(false);
      setQuickIndexForm({ fullName: "", nisn: "", graduationYear: "", bukuFisikNo: "", registerNo: "" });
      fetchAlumni();
      fetchStats();
      fetchYearOptions();
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan index arsip");
    } finally {
      setQuickIndexSaving(false);
    }
  };

  // Tahun lulus diambil dari data (SELECT DISTINCT) supaya arsip
  // puluhan tahun kebelakang tetap terjangkau, bukan jendela 10 tahun.

  // Calculate percentage values for stacked bar
  const totalStudents = stats ? (stats.activeCount + stats.graduatedCount + stats.transferredCount + stats.droppedCount) : 0;
  const activePct = totalStudents > 0 ? (stats!.activeCount / totalStudents) * 100 : 0;
  const graduatedPct = totalStudents > 0 ? (stats!.graduatedCount / totalStudents) * 100 : 0;
  const transferredPct = totalStudents > 0 ? (stats!.transferredCount / totalStudents) * 100 : 0;
  const droppedPct = totalStudents > 0 ? (stats!.droppedCount / totalStudents) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Buku Induk Siswa
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 hidden sm:block">
            Catatan riwayat siswa aktif, alumni, pindahan, dan keluar sejak berdirinya sekolah
          </p>
        </div>
        
        {/* Action Buttons Container */}
        <div className="grid grid-cols-2 gap-2 mt-3 md:mt-0 w-full sm:w-auto sm:flex sm:flex-wrap sm:items-center">
          <Button variant="outline" size="sm" onClick={() => { fetchAlumni(); fetchStats(); }} className="h-9 shadow-sm hover:bg-slate-50 w-full sm:w-auto">
            <RefreshCcw className="h-4 w-4 mr-2 text-slate-500" />
            Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 shadow-sm w-full sm:w-auto">
                <MoreHorizontal className="h-4 w-4 mr-2 text-slate-500" />
                Opsi Lainnya
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/admin/siswa/import" className="flex items-center cursor-pointer">
                  <Upload className="h-4 w-4 mr-2 text-slate-500" />
                  Impor e-Rapor
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSync} disabled={syncing} className="flex items-center cursor-pointer text-emerald-600 focus:text-emerald-700">
                <RefreshCcw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Siswa Aktif
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickIndexOpen(true)} className="flex items-center cursor-pointer text-blue-600 focus:text-blue-700">
                <BookMarked className="h-4 w-4 mr-2" />
                Index Cepat Arsip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="col-span-2 sm:col-span-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchPrint}
              className={`h-9 w-full shadow-sm ${selectedIds.length > 0 ? "text-orange-700 border-orange-300 bg-orange-50 hover:bg-orange-100" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"}`}
            >
              <Printer className="h-4 w-4 mr-2" />
              Cetak Batch{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
          </div>

          <Link href="/admin/siswa/alumni-tambah" className="col-span-2 sm:col-span-1">
            <Button size="sm" className="h-9 w-full shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Data
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <AlumniStatsCards stats={stats} />

      {/* Stacked Status Progress Bar */}
      {totalStudents > 0 && (
        <StatusDistributionBar
          stats={stats}
          totalStudents={totalStudents}
          activePct={activePct}
          graduatedPct={graduatedPct}
          transferredPct={transferredPct}
          droppedPct={droppedPct}
        />
      )}
      {/* Data Table */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          {/* Search & Filter Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NISN, atau NIS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40"
                />
                {search && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSearch("")} />
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 flex-1 sm:flex-none px-3 flex items-center gap-2 border-slate-200 dark:border-zinc-800 justify-center">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      Filter Kategori
                      {(statusFilter || graduationYear) && (
                        <Badge className="bg-primary text-primary-foreground px-1 py-0 h-4 min-w-4 flex items-center justify-center text-[10px]">
                          {(statusFilter ? 1 : 0) + (graduationYear ? 1 : 0)}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-3 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Status Siswa</label>
                      <Select
                        value={statusFilter || "all"}
                        onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="graduated">Alumni</SelectItem>
                          <SelectItem value="transferred">Pindahan</SelectItem>
                          <SelectItem value="dropped">Keluar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Tahun Kelulusan</label>
                      <Select
                        value={graduationYear || "all"}
                        onValueChange={(val) => setGraduationYear(val === "all" ? "" : val)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Pilih tahun" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Tahun</SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-2 border-t flex justify-end">
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => {
                        setStatusFilter("");
                        setGraduationYear("");
                        setFilterOpen(false);
                      }}>
                        Reset Filter
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(val) => {
                    setPagination((prev) => ({ ...prev, limit: parseInt(val), page: 1 }));
                  }}
                >
                  <SelectTrigger className="w-24 sm:w-[110px] h-10 border-slate-200 dark:border-zinc-800">
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
            </div>

            {/* Active Filter Badges */}
            {(statusFilter || graduationYear) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-200">
                <span className="text-xs text-muted-foreground font-medium">Filter Aktif:</span>
                {statusFilter && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                    Status: {statusFilter === "active" ? "Aktif" : statusFilter === "graduated" ? "Alumni" : statusFilter === "transferred" ? "Pindahan" : "Keluar"}
                    <X className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground ml-1" onClick={() => setStatusFilter("")} />
                  </Badge>
                )}
                {graduationYear && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                    Tahun: {graduationYear}
                    <X className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground ml-1" onClick={() => setGraduationYear("")} />
                  </Badge>
                )}
                <Button variant="link" size="sm" className="h-6 text-xs text-destructive hover:no-underline px-1" onClick={() => {
                  setStatusFilter("");
                  setGraduationYear("");
                }}>
                  Bersihkan Semua
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={loading ? [] : sortedAlumni}
            getRowId={(item) => item.id}
            loading={loading}
            sortConfig={sortConfig}
            onSort={requestSort}
            emptyTitle="Tidak ada data Buku Induk ditemukan"
            emptyDescription="Sesuaikan kata kunci pencarian Anda atau tambahkan data baru."
            emptyAction={{
              label: "Tambah Data",
              href: "/admin/siswa/alumni-tambah",
            }}
            expandedRowIds={Object.keys(expandedRows)}
            onToggleExpand={toggleRow}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            columns={[
              {
                key: "fullName",
                header: "Nama Lengkap",
                sortable: true,
                card: "title",
                render: (item) => {
                  const isExpanded = !!expandedRows[item.id];
                  return (
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-zinc-200">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      {item.fullName}
                    </div>
                  );
                },
              },
              {
                key: "nisn",
                header: "NISN / NIS",
                sortable: true,
                card: "field",
                render: (item) => (
                  <div className="text-xs font-mono">
                    {item.nisn && <div>NISN: {item.nisn}</div>}
                    {item.nis && <div className="text-muted-foreground">NIS: {item.nis}</div>}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                sortable: true,
                card: "field",
                render: (item) => {
                  const details = statusInfo[item.status] || statusInfo.graduated;
                  return (
                    <Badge variant="outline" className={`font-semibold py-0.5 px-2.5 rounded-full border ${details.color}`}>
                      {details.label}
                    </Badge>
                  );
                },
              },
              {
                key: "graduationYear",
                header: "Tahun Lulus/Keluar",
                sortable: true,
                card: "field",
                render: (item) =>
                  item.status === "active" ? (
                    <span className="text-muted-foreground text-xs">-</span>
                  ) : (
                    <Badge variant="secondary" className="font-mono text-xs">{item.graduationYear || "-"}</Badge>
                  ),
              },
              {
                key: "finalClass",
                header: "Kelas Akhir",
                sortable: true,
                card: "field",
                render: (item) => <span className="font-medium">{item.finalClass || "-"}</span>,
              },
              {
                key: "nextSchool",
                header: "Sekolah Lanjutan",
                sortable: true,
                card: "hidden",
                render: (item) => (
                  <span className="max-w-[150px] truncate block">{item.nextSchool || "-"}</span>
                ),
              },
              {
                key: "bukuFisikNo",
                header: "Buku Induk / No. Urut",
                sortable: false,
                card: "field",
                cardSpan: "full",
                render: (item) =>
                  item.bukuFisikNo || item.registerNo ? (
                    <span className="text-xs font-mono">
                      {item.bukuFisikNo && <span>Buku {item.bukuFisikNo}</span>}
                      {item.bukuFisikNo && item.registerNo && <span> • </span>}
                      {item.registerNo && <span>No. {item.registerNo}</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Belum terindeks</span>
                  ),
              },
            ]}
            actions={(item) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/siswa/alumni-detail?id=${item.id}`}>
                      <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                      Lihat Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/siswa/alumni-detail/edit?id=${item.id}`}>
                      <Edit className="h-4 w-4 mr-2 text-muted-foreground" />
                      Edit Data
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            expandedContent={(item) => (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-sm text-muted-foreground py-1.5">
                <div className="md:col-span-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">Profil Cepat</p>
                  <p className="text-xs text-foreground">Gender: <strong className="font-semibold">{item.gender === "L" ? "Laki-laki" : item.gender === "P" ? "Perempuan" : "-"}</strong></p>
                  <p className="text-xs text-foreground">Tahun Lulus/Keluar: <strong className="font-semibold">{item.graduationYear || "-"}</strong></p>
                </div>
                <div className="md:col-span-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">Detail Pendidikan</p>
                  <p className="text-xs text-foreground">Kelas Akhir: <strong className="font-semibold">{item.finalClass || "-"}</strong></p>
                  {item.status === "graduated" && (
                    <p className="text-xs text-foreground">Sekolah Lanjutan: <strong className="font-semibold">{item.nextSchool || "-"}</strong></p>
                  )}
                </div>
                <div className="md:col-span-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">Lokasi Arsip Fisik</p>
                  <p className="text-xs text-foreground">Buku Induk: <strong className="font-semibold">{item.bukuFisikNo ? `Buku ${item.bukuFisikNo}` : "-"}</strong></p>
                  <p className="text-xs text-foreground">Nomor Urut: <strong className="font-semibold">{item.registerNo || "-"}</strong></p>
                </div>
                <div className="md:col-span-4 flex flex-col sm:flex-row flex-wrap gap-2 items-start md:justify-end">
                  <Link href={`/admin/siswa/alumni-detail?id=${item.id}&tab=transcripts`} className="w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto h-8 text-xs font-semibold flex items-center justify-center gap-1 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      Transkrip Nilai
                    </Button>
                  </Link>
                  <Link href={`/admin/siswa/alumni-detail?id=${item.id}&tab=attendance`} className="w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto h-8 text-xs font-semibold flex items-center justify-center gap-1 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      Rekap Absensi
                    </Button>
                  </Link>
                  <Link href={`/admin/siswa/alumni-detail?id=${item.id}`} className="w-full sm:w-auto">
                    <Button size="sm" className="w-full sm:w-auto h-8 text-xs font-semibold flex items-center justify-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Lihat Detail
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <div className="text-sm text-muted-foreground">
            Menampilkan {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} dari{" "}
            {pagination.total} data
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
              >
                Selanjutnya
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Index Cepat Arsip Fisik */}
      <QuickIndexDialog
        open={quickIndexOpen}
        onOpenChange={setQuickIndexOpen}
        quickIndexForm={quickIndexForm}
        setQuickIndexForm={setQuickIndexForm}
        quickIndexSaving={quickIndexSaving}
        onSubmit={handleQuickIndex}
      />
    </div>
  );
}
