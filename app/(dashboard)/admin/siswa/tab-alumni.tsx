"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Users,
  FolderOpen,
  Clock,
  RefreshCcw,
  X,
  Filter,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { goGet, goDelete, goPost } from "@/lib/api-client";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface Alumni {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: string | null;
  graduationYear: string;
  finalClass: string | null;
  photo: string | null;
  nextSchool: string | null;
  status: string;
  createdAt: Date;
}

interface AlumniStats {
  totalAlumni: number;
  totalDocuments: number;
  pendingVerification: number;
  activeCount: number;
  graduatedCount: number;
  transferredCount: number;
  droppedCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusInfo: Record<string, { label: string; color: string; border: string }> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
    border: "border-emerald-500/30",
  },
  graduated: {
    label: "Alumni",
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
    border: "border-blue-500/30",
  },
  transferred: {
    label: "Pindahan",
    color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    border: "border-amber-500/30",
  },
  dropped: {
    label: "Keluar",
    color: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20",
    border: "border-rose-500/30",
  },
};

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

  useEffect(() => {
    fetchAlumni();
    fetchStats();
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

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = currentYear - i;
    return `${year - 1}/${year}`;
  });

  // Calculate percentage values for stacked bar
  const totalStudents = stats ? (stats.activeCount + stats.graduatedCount + stats.transferredCount + stats.droppedCount) : 0;
  const activePct = totalStudents > 0 ? (stats!.activeCount / totalStudents) * 100 : 0;
  const graduatedPct = totalStudents > 0 ? (stats!.graduatedCount / totalStudents) * 100 : 0;
  const transferredPct = totalStudents > 0 ? (stats!.transferredCount / totalStudents) * 100 : 0;
  const droppedPct = totalStudents > 0 ? (stats!.droppedCount / totalStudents) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Buku Induk Siswa
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Catatan riwayat siswa aktif, alumni, pindahan, dan keluar sejak berdirinya sekolah
          </p>
        </div>
        
        {/* Action Buttons Container - Placed below text on small screens, right aligned on large screens */}
        <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={() => { fetchAlumni(); fetchStats(); }} className="h-9 shadow-sm hover:bg-slate-50 flex-1 md:flex-none">
            <RefreshCcw className="h-4 w-4 mr-2 text-slate-500" />
            Refresh
          </Button>
          
          <Link href="/admin/siswa/import" className="flex-1 md:flex-none">
            <Button variant="outline" size="sm" className="h-9 w-full shadow-sm hover:bg-slate-50">
              <Upload className="h-4 w-4 mr-2 text-slate-500" />
              Impor Dapodik / e-Rapor
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 shadow-sm text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-900/50 dark:hover:bg-emerald-900/30 flex-1 md:flex-none w-full md:w-auto font-medium" 
            onClick={handleSync} 
            disabled={syncing}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sinkronisasi...' : 'Sinkronisasi Data Siswa'}
          </Button>
          
          <Link href="/admin/siswa/alumni-tambah" className="flex-1 md:flex-none">
            <Button size="sm" className="h-9 w-full shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Data Buku Induk
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Total Buku Induk
              </CardTitle>
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.totalAlumni || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Siswa terdaftar di Buku Induk
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Siswa Aktif
              </CardTitle>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.activeCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sedang aktif bersekolah
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-amber-500/30 dark:hover:border-amber-400/30 transition-colors duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                Menunggu Verifikasi Dokumen
              </CardTitle>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                {stats?.pendingVerification || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Berkas siswa perlu diverifikasi
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Stacked Status Progress Bar */}
      {totalStudents > 0 && (
        <Card className="overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-sm">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground font-medium">Distribusi Status Siswa</span>
              <span className="text-muted-foreground font-mono font-semibold">{totalStudents} Total Siswa</span>
            </div>
            <div className="h-3.5 w-full rounded-full flex overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              {stats?.activeCount ? (
                <div style={{ width: `${activePct}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Aktif: ${stats.activeCount}`} />
              ) : null}
              {stats?.graduatedCount ? (
                <div style={{ width: `${graduatedPct}%` }} className="h-full bg-blue-500 transition-all duration-300" title={`Alumni/Lulus: ${stats.graduatedCount}`} />
              ) : null}
              {stats?.transferredCount ? (
                <div style={{ width: `${transferredPct}%` }} className="h-full bg-amber-500 transition-all duration-300" title={`Pindahan: ${stats.transferredCount}`} />
              ) : null}
              {stats?.droppedCount ? (
                <div style={{ width: `${droppedPct}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Keluar: ${stats.droppedCount}`} />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>Aktif: <strong className="text-foreground">{stats?.activeCount || 0}</strong> ({activePct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span>Alumni: <strong className="text-foreground">{stats?.graduatedCount || 0}</strong> ({graduatedPct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Pindahan: <strong className="text-foreground">{stats?.transferredCount || 0}</strong> ({transferredPct.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span>Keluar: <strong className="text-foreground">{stats?.droppedCount || 0}</strong> ({droppedPct.toFixed(0)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ketik untuk mencari nama, NISN, atau NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-slate-200 dark:border-zinc-800"
            />
            {search && (
              <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSearch("")} />
            )}
          </div>

          <div className="flex gap-2">
            <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 px-3 flex items-center gap-2 border-slate-200 dark:border-zinc-800">
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
              <SelectTrigger className="w-[110px] h-10 border-slate-200 dark:border-zinc-800">
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

      {/* Data Table */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/30">
              <TableRow>
                <SortableTableHead label="Nama Lengkap" sortKey="fullName" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTableHead label="NISN / NIS" sortKey="nisn" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTableHead label="Tahun Lulus/Keluar" sortKey="graduationYear" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTableHead label="Kelas Akhir" sortKey="finalClass" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTableHead label="Sekolah Lanjutan" sortKey="nextSchool" sortConfig={sortConfig} onSort={requestSort} />
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : alumni.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-12 w-12 opacity-50" />
                      <p className="font-semibold text-sm">Tidak ada data Buku Induk ditemukan</p>
                      <p className="text-xs text-muted-foreground max-w-sm">Sesuaikan kata kunci pencarian Anda atau tambahkan data baru.</p>
                      <Link href="/admin/siswa/alumni-tambah" className="mt-2">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Data
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedAlumni.map((item) => {
                  const isExpanded = !!expandedRows[item.id];
                  const details = statusInfo[item.status] || statusInfo.graduated;
                  return (
                    <Fragment key={item.id}>
                      <TableRow
                        key={item.id}
                        className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50/30 dark:bg-zinc-900/10" : ""}`}
                        onClick={() => toggleRow(item.id)}
                      >
                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-200">
                          <div className="flex items-center gap-1">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            {item.fullName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">
                            {item.nisn && <div>NISN: {item.nisn}</div>}
                            {item.nis && <div className="text-muted-foreground">NIS: {item.nis}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-semibold py-0.5 px-2.5 rounded-full border ${details.color}`}>
                            {details.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.status === "active" ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : (
                            <Badge variant="secondary" className="font-mono text-xs">{item.graduationYear || "-"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.finalClass || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{item.nextSchool || "-"}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <TableRow className="bg-slate-50/20 dark:bg-zinc-900/5 hover:bg-slate-50/20 dark:hover:bg-zinc-900/5 border-t border-dashed">
                            <TableCell colSpan={7} className="p-4 bg-slate-50/20 dark:bg-zinc-900/5">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground py-1.5">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">Profil Cepat</p>
                                    <p className="text-xs text-foreground">Gender: <strong className="font-semibold">{item.gender === "L" ? "Laki-laki" : item.gender === "P" ? "Perempuan" : "-"}</strong></p>
                                    <p className="text-xs text-foreground">Tahun Lulus/Keluar: <strong className="font-semibold">{item.graduationYear || "-"}</strong></p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">Detail Pendidikan</p>
                                    <p className="text-xs text-foreground">Kelas Akhir: <strong className="font-semibold">{item.finalClass || "-"}</strong></p>
                                    {item.status === "graduated" && (
                                      <p className="text-xs text-foreground">Sekolah Lanjutan: <strong className="font-semibold">{item.nextSchool || "-"}</strong></p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2 items-center md:justify-end">
                                    <Link href={`/admin/siswa/alumni-detail?id=${item.id}&tab=transcripts`}>
                                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold flex items-center gap-1 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                                        Transkrip Nilai
                                      </Button>
                                    </Link>
                                    <Link href={`/admin/siswa/alumni-detail?id=${item.id}&tab=attendance`}>
                                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold flex items-center gap-1 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                                        <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                                        Rekap Absensi
                                      </Button>
                                    </Link>
                                    <Link href={`/admin/siswa/alumni-detail?id=${item.id}`}>
                                      <Button size="sm" className="h-8 text-xs font-semibold flex items-center gap-1">
                                        <Eye className="h-3.5 w-3.5" />
                                        Lihat Detail
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
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
    </div>
  );
}
