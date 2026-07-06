"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Printer,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  QrCode,
  GraduationCap,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { goGet, goDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface Student {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  birthDate: string | null;
  className: string | null;
  photo: string | null;
  qrCode: string;
  isActive: boolean;
  createdAt: string;
}

export default function TabKartu() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    byClass: [] as { className: string | null; count: number }[],
  });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { sortedData, sortConfig, requestSort } = useSortableData(students);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("q", search);
      if (classFilter !== "all") params.set("classId", classFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await goGet(`/api/master/students?${params.toString()}`);
      
      if (response.success) {
        const result = response.data;
        setStudents(result.data || []);
        setPagination(result.pagination || { total: 0, totalPages: 0, page: 1, limit: limit });
        setSummary(result.summary || { total: 0, active: 0, byClass: [] });
      } else {
        toast.error(response.error || "Gagal memuat data peserta didik");
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Gagal memuat data peserta didik");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, classFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus peserta didik ini?")) return;

    try {
      const response = await goDelete(`/api/master/students/${id}`);
      if (response.success) {
        toast.success("Peserta didik berhasil dihapus");
        fetchStudents();
      } else {
        toast.error(response.error || "Gagal menghapus peserta didik");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(students.map((s) => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, id]);
    } else {
      setSelectedStudents(selectedStudents.filter((s) => s !== id));
    }
  };

  const handlePrintCards = () => {
    if (selectedStudents.length === 0) {
      toast.error("Pilih peserta didik terlebih dahulu");
      return;
    }
    router.push(`/admin/siswa/cetak-kartu?ids=${selectedStudents.join(",")}`);
  };

  const showQrCode = (student: Student) => {
    setSelectedStudent(student);
    setQrDialogOpen(true);
  };

  const uniqueClasses = (summary?.byClass || [])
    .filter((c) => c?.className)
    .map((c) => c.className!)
    .sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Printer className="h-6 w-6 text-primary" /> Cetak Kartu Siswa
          </h2>
          <p className="text-muted-foreground text-sm">
            Pilih siswa, cetak kartu pelajar/NISN/KIP, dan lihat QR code.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStudents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handlePrintCards}
            disabled={selectedStudents.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Cetak Kartu ({selectedStudents.length})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-colors duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Total Siswa
            </CardTitle>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {summary.total}
            </div>
          </CardContent>
        </Card>

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
              {summary.active}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-purple-500/30 dark:hover:border-purple-400/30 transition-colors duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Jumlah Kelas
            </CardTitle>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {uniqueClasses.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-amber-500/30 dark:hover:border-amber-400/30 transition-colors duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Terpilih
            </CardTitle>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
              <Printer className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              {selectedStudents.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Peserta Didik</CardTitle>
          <CardDescription>
            Data seluruh peserta didik yang terdaftar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NISN, atau NIS..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={classFilter}
              onValueChange={(v) => {
                setClassFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {uniqueClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Non-Aktif</SelectItem>
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

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        students.length > 0 &&
                        selectedStudents.length === students.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <SortableTableHead label="Siswa" sortKey="fullName" sortConfig={sortConfig} onSort={requestSort} />
                  <SortableTableHead label="NISN" sortKey="nisn" sortConfig={sortConfig} onSort={requestSort} />
                  <SortableTableHead label="Kelas" sortKey="className" sortConfig={sortConfig} onSort={requestSort} />
                  <SortableTableHead label="Status" sortKey="isActive" sortConfig={sortConfig} onSort={requestSort} />
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Memuat data...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/30" />
                      <p className="mt-2 text-muted-foreground">
                        Belum ada data peserta didik
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={(checked) =>
                            handleSelectStudent(student.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-slate-100 dark:border-zinc-800 shadow-sm shrink-0">
                            <AvatarImage src={student.photo || undefined} />
                            <AvatarFallback className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-xs">
                              {student.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.gender === "L"
                                ? "Laki-laki"
                                : student.gender === "P"
                                ? "Perempuan"
                                : "-"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {student.nisn || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.className || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        {student.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Non-Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground bg-background/50">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => showQrCode(student)}>
                              <QrCode className="h-4 w-4 mr-2" />
                              Lihat QR Code
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/admin/siswa/detail?id=${student.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/admin/siswa/detail/edit?id=${student.id}`)
                              }
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(student.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
          {pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <div className="text-sm text-muted-foreground">
                Menampilkan {pagination.total > 0 ? (page - 1) * pagination.limit + 1 : 0} -{" "}
                {Math.min(page * pagination.limit, pagination.total)} dari{" "}
                {pagination.total} siswa
              </div>
              
              {pagination.totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={page === pagination.totalPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Peserta Didik</DialogTitle>
            <DialogDescription>
              QR code ini dapat digunakan untuk perpustakaan, tabungan, dan presensi
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-lg shadow-inner">
                <QRCodeSVG
                  value={selectedStudent.qrCode}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{selectedStudent.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  NISN: {selectedStudent.nisn || "-"} | Kelas:{" "}
                  {selectedStudent.className || "-"}
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                  {selectedStudent.qrCode}
                </code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
