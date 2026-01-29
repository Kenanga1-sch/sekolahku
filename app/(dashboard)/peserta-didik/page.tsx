"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Printer,
  Search,
  RefreshCw,
  Download,
  Upload,
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
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

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

interface StudentsResponse {
  data: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    active: number;
    byClass: { className: string | null; count: number }[];
  };
}

export default function PesertaDidikPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
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

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (search) params.set("search", search);
      if (classFilter !== "all") params.set("className", classFilter);
      if (statusFilter !== "all") params.set("isActive", statusFilter);

      const response = await fetch(`/api/students?${params.toString()}`);
      const data: StudentsResponse = await response.json();

      if (response.ok) {
        setStudents(data.data);
        setPagination(data.pagination);
        setSummary(data.summary);
      } else {
        toast.error("Gagal memuat data peserta didik");
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Gagal memuat data peserta didik");
    } finally {
      setLoading(false);
    }
  }, [page, search, classFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus peserta didik ini?")) return;

    try {
      const response = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Peserta didik berhasil dihapus");
        fetchStudents();
      } else {
        toast.error("Gagal menghapus peserta didik");
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
    router.push(`/peserta-didik/cetak-kartu?ids=${selectedStudents.join(",")}`);
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            Peserta Didik
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola data dan kartu peserta didik
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStudents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/peserta-didik/import")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintCards}
            disabled={selectedStudents.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Cetak Kartu ({selectedStudents.length})
          </Button>
          <Button onClick={() => router.push("/peserta-didik/tambah")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Tambah Siswa
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/20 border-blue-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Siswa
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {summary.total}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/20 border-green-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Siswa Aktif
            </CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {summary.active}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/20 border-purple-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Jumlah Kelas
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {uniqueClasses.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/20 border-amber-200/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Terpilih
            </CardTitle>
            <Printer className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
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
                <SelectItem value="true">Aktif</SelectItem>
                <SelectItem value="false">Non-Aktif</SelectItem>
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
                  <TableHead>Siswa</TableHead>
                  <TableHead>NISN</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Status</TableHead>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => router.push("/peserta-didik/tambah")}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Tambah Siswa Pertama
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
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
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage src={student.photo || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold">
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
                            <Button variant="ghost" size="icon">
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
                                router.push(`/peserta-didik/${student.id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/peserta-didik/${student.id}/edit`)
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
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan {(page - 1) * pagination.limit + 1} -{" "}
                {Math.min(page * pagination.limit, pagination.total)} dari{" "}
                {pagination.total} siswa
              </p>
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
