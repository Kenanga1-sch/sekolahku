"use client";

import { useState, useEffect } from "react";
import { Plus, Search, FileDown, MoreHorizontal, Pencil, Trash2, Filter, Users, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toast";
import { useDebounce } from "@/hooks/use-debounce";
import { goGet, goDelete } from "@/lib/api-client";
import { StudentFormDialog } from "@/components/master/student-form-dialog";
import { StudentImportDialog } from "@/components/master/student-import-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

type Student = {
    id: string;
    nis: string;
    nisn: string;
    fullName: string;
    className: string;
    status: string;
    gender: "L" | "P";
    photo?: string;
};

export default function TabDirektori() {
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [classFilter, setClassFilter] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    
    // Stats Summary
    const [totalStudents, setTotalStudents] = useState(0);
    const [activeStudents, setActiveStudents] = useState(0);
    const [activeMale, setActiveMale] = useState(0);
    const [activeFemale, setActiveFemale] = useState(0);
    const [byClass, setByClass] = useState<{ className: string | null; count: number }[]>([]);
    
    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const debouncedSearch = useDebounce(searchTerm, 500);
    const { sortedData: sortedStudents, sortConfig, requestSort } = useSortableData(students);

    // Reset page to 1 when filters or search change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, statusFilter, classFilter]);

    useEffect(() => {
        fetchStudents();
    }, [page, limit, debouncedSearch, statusFilter, classFilter]);

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                q: debouncedSearch,
                ...(statusFilter && { status: statusFilter }),
                ...(classFilter && { classId: classFilter })
            });

            const response: any = await goGet(`/api/master/students?${params}`);
            const result = response?.data ?? response;
            
            setStudents(result?.data ?? []);
            setTotalPages(result?.pagination?.totalPages ?? 1);
            setTotalStudents(result?.summary?.total ?? result?.pagination?.total ?? 0);
            setActiveStudents(result?.summary?.active ?? 0);
            setActiveMale(result?.summary?.male ?? 0);
            setActiveFemale(result?.summary?.female ?? 0);
            setByClass(result?.summary?.byClass ?? []);
        } catch (error) {
            console.error(error);
            showError("Gagal memuat data siswa");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm("Yakin ingin menghapus data siswa ini secara permanen?")) return;

        try {
            await goDelete(`/api/master/students/${id}`);
            showSuccess("Siswa berhasil dihapus");
            fetchStudents(); // Refresh
        } catch (error) {
            showError("Gagal menghapus data");
        }
    };

    const handleCreate = () => {
        setSelectedStudentId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (id: string) => {
        setSelectedStudentId(id);
        setIsFormOpen(true);
    };

    const uniqueClasses = (byClass || [])
        .filter((c) => c?.className)
        .map((c) => c.className!)
        .sort();

    return (
        <div className="space-y-6">
            <StudentFormDialog 
                open={isFormOpen} 
                onOpenChange={setIsFormOpen} 
                studentId={selectedStudentId}
                onSuccess={() => fetchStudents()}
            />
            
            <StudentImportDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                onSuccess={() => fetchStudents()}
            />

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Direktori Siswa Utama</h2>
                    <p className="text-muted-foreground text-sm mt-0.5 font-medium">Pusat data seluruh siswa sekolah (Active & Alumni).</p>
                </div>
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="flex-1 md:flex-none shadow-sm font-medium">
                        <FileDown className="mr-2 h-4 w-4 text-slate-500" /> Import Excel
                    </Button>
                    <Button size="sm" onClick={handleCreate} className="flex-1 md:flex-none shadow-sm font-medium bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white border-0 transition-all">
                        <Plus className="mr-2 h-4 w-4" /> Tambah Siswa Baru
                    </Button>
                </div>
            </div>

            {/* Stats Dashboard Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Total Siswa</span>
                        <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                            <Users className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoading && totalStudents === 0 ? <Skeleton className="h-8 w-16" /> : totalStudents}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Siswa Terdaftar (Semua Status)</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Siswa Aktif</span>
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <UserCheck className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoading && activeStudents === 0 ? <Skeleton className="h-8 w-16" /> : activeStudents}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Mengikuti Pembelajaran</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-sky-500/30 dark:hover:border-sky-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Laki-laki (Aktif)</span>
                        <div className="p-1.5 bg-sky-50 dark:bg-sky-950/40 rounded-lg text-sky-600 dark:text-sky-400">
                            <div className="h-4 w-4 flex items-center justify-center font-bold text-xs">L</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoading && activeMale === 0 ? <Skeleton className="h-8 w-16" /> : activeMale}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {activeStudents > 0 ? `${Math.round((activeMale / activeStudents) * 100)}% dari siswa aktif` : 'Siswa Laki-laki'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-rose-500/30 dark:hover:border-rose-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Perempuan (Aktif)</span>
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400">
                            <div className="h-4 w-4 flex items-center justify-center font-bold text-xs">P</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoading && activeFemale === 0 ? <Skeleton className="h-8 w-16" /> : activeFemale}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {activeStudents > 0 ? `${Math.round((activeFemale / activeStudents) * 100)}% dari siswa aktif` : 'Siswa Perempuan'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card className="border-slate-100 dark:border-zinc-800 shadow-sm">
                <CardHeader className="p-4 md:p-6 pb-2">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                         <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari Nama / NISN / NIS..."
                                className="pl-9 bg-slate-50/40 dark:bg-zinc-900/40"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <Select value={classFilter} onValueChange={(val) => setClassFilter(val === "all" ? "" : val)}>
                                <SelectTrigger className="w-[140px] bg-background">
                                    <SelectValue placeholder="Semua Kelas" />
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

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] bg-background">
                                    <SelectValue placeholder="Semua Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="graduated">Lulus</SelectItem>
                                    <SelectItem value="transferred">Mutasi</SelectItem>
                                    <SelectItem value="dropped">DO / Keluar</SelectItem>
                                    <SelectItem value="deceased">Meninggal</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={limit.toString()}
                                onValueChange={(val) => {
                                    setLimit(parseInt(val));
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[110px] bg-background">
                                    <SelectValue placeholder="Baris" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 Baris</SelectItem>
                                    <SelectItem value="20">20 Baris</SelectItem>
                                    <SelectItem value="50">50 Baris</SelectItem>
                                    <SelectItem value="100">100 Baris</SelectItem>
                                </SelectContent>
                            </Select>

                            {(statusFilter || classFilter || searchTerm) && (
                                <Button variant="ghost" size="icon" onClick={() => {
                                    setStatusFilter("");
                                    setClassFilter("");
                                    setSearchTerm("");
                                }} className="hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 dark:hover:text-red-400">
                                    <Filter className="h-4 w-4 text-red-500 dark:text-red-400" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/70 dark:bg-zinc-900/50">
                                <SortableTableHead label="Nama Lengkap" sortKey="fullName" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="NIS / NISN" sortKey="nisn" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Kelas" sortKey="className" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
                                <TableHead className="text-right pr-6">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: limit }).map((_, i) => (
                                    <TableRow key={i} className="hover:bg-transparent">
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-40 md:w-56" />
                                                    <Skeleton className="h-3.5 w-16" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-2">
                                                <Skeleton className="h-3.5 w-24" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-20 rounded-full" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-16 rounded-full" />
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : students.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={5} className="h-36 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Users className="h-8 w-8 opacity-45 text-slate-400" />
                                            <p className="font-medium text-sm">Tidak ada data siswa ditemukan.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedStudents.map((student) => (
                                    <TableRow key={student.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/30 transition-colors">
                                        <TableCell className="font-medium pl-6">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border border-slate-100 dark:border-zinc-800 shadow-sm shrink-0">
                                                    <AvatarImage src={student.photo || undefined} />
                                                    <AvatarFallback className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-xs">
                                                        {student.fullName
                                                            ?.split(" ")
                                                            .map((n) => n[0])
                                                            .slice(0, 2)
                                                            .join("")
                                                            .toUpperCase() || "S"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-zinc-100">{student.fullName}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {student.gender === "L" ? (
                                                            <Badge className="h-4.5 px-1.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/50 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/40 hover:bg-sky-50">
                                                                Laki-laki
                                                            </Badge>
                                                        ) : student.gender === "P" ? (
                                                            <Badge className="h-4.5 px-1.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40 hover:bg-rose-50">
                                                                Perempuan
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground font-medium">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <code className="text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300">
                                                    {student.nisn || '-'}
                                                </code>
                                                <span className="text-xs text-muted-foreground font-mono mt-0.5">{student.nis || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-semibold bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-xs px-2.5 py-0.5">
                                                {student.className || 'Tanpa Kelas'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' :
                                                student.status === 'graduated' ? 'bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50' :
                                                student.status === 'transferred' ? 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50' :
                                                student.status === 'dropped' ? 'bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50' :
                                                'bg-slate-50 text-slate-700 border border-slate-200/60 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800'
                                            }>
                                                {student.status === 'active' ? 'AKTIF' :
                                                 student.status === 'graduated' ? 'LULUS' :
                                                 student.status === 'transferred' ? 'MUTASI' :
                                                 student.status === 'dropped' ? 'KELUAR' :
                                                 student.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground bg-background/50 border-slate-200 dark:border-zinc-800">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => handleEdit(student.id)} className="cursor-pointer font-medium text-xs">
                                                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild className="cursor-pointer font-medium text-xs">
                                                        <Link href="/admin/akademik?tab=kenaikan" className="flex items-center">
                                                            Promosi / Kenaikan
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600 cursor-pointer font-medium text-xs" onClick={() => handleDelete(student.id)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Permanen
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                             </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <div className="text-xs text-muted-foreground font-medium">
                    Menampilkan {students.length > 0 ? (page - 1) * limit + 1 : 0} -{" "}
                    {Math.min(page * limit, totalStudents)} dari{" "}
                    {totalStudents} siswa
                </div>
                {totalPages > 1 && (
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1}
                            className="shadow-sm h-8 font-semibold text-xs"
                        >
                            Sebelumnya
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages}
                            className="shadow-sm h-8 font-semibold text-xs"
                        >
                            Selanjutnya
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
