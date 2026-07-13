"use client";

import { useState, useEffect } from "react";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Upload, Users, GraduationCap, Award, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toast";
import { useDebounce } from "@/hooks/use-debounce";
import { goGet, goDelete } from "@/lib/api-client";
import { EmployeeFormDialog } from "@/components/master/employee-form-dialog";
import { EmployeeImportDialog } from "@/components/master/employee-import-dialog";

type Employee = {
    id: string;
    fullName: string;
    email: string;
    role: string;
    nip: string;
    nuptk: string;
    employmentStatus: string;
    jobType: string;
    photoUrl?: string;
    phone?: string;
    category?: string;
    degree?: string;
    quote?: string;
    displayOrder?: number;
};

const CATEGORY_COLORS: Record<string, string> = {
    kepsek: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    guru: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50",
    staff: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50",
    support: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
};

const STATUS_COLORS: Record<string, string> = {
    PNS: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400",
    GTY: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400",
    GTT: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400",
    PTT: "bg-orange-55 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400",
};

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

export default function MasterGTKPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    // Modal
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 500);
    const { sortedData: sortedEmployees, sortConfig, requestSort } = useSortableData(employees);

    useEffect(() => {
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, page, limit]);

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                q: debouncedSearch,
            });

            const data: any = await goGet(`/api/master/employees?${params}`);
            
            setEmployees(data.data || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalEmployees(data.pagination?.total || 0);
        } catch (error) {
            console.error(error);
            showError("Gagal memuat data GTK");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm("Yakin ingin menghapus GTK ini? Akun login juga akan terhapus.")) return;

        try {
            await goDelete(`/api/master/employees/${id}`);
            showSuccess("Data GTK berhasil dihapus");
            fetchEmployees();
        } catch (error) {
            showError(error instanceof Error ? error.message : "Gagal menghapus data");
        }
    };

    const handleCreate = () => {
        setSelectedId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (id: string) => {
        setSelectedId(id);
        setIsFormOpen(true);
    };

    const categoryLabel = (cat?: string) => {
        switch (cat) {
            case 'kepsek': return 'Kepala Sekolah';
            case 'guru': return 'Guru';
            case 'staff': return 'Staff TU';
            case 'support': return 'Tenaga Support';
            default: return 'Belum diatur';
        }
    };

    // Filter employees locally for responsive tabs
    const filteredEmployees = sortedEmployees.filter((emp) => {
        if (categoryFilter !== "all" && emp.category !== categoryFilter) return false;
        return true;
    });

    // Dynamic stats calculations
    const stats = {
        totalGTK: totalEmployees,
        totalGuru: employees.filter(e => e.category === 'guru').length || 0,
        totalPNS: employees.filter(e => e.employmentStatus === 'PNS').length || 0,
        totalHonorer: employees.filter(e => e.employmentStatus && e.employmentStatus !== 'PNS').length || 0,
    };

    return (
        <div className="space-y-6">
            <EmployeeFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                employeeId={selectedId}
                onSuccess={() => fetchEmployees()}
            />
            <EmployeeImportDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                onSuccess={() => fetchEmployees()}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-800">Direktori Pendidik & Tenaga Kependidikan (GTK)</h1>
                  <p className="text-sm text-muted-foreground">Kelola data kepegawaian, jabatan, status sertifikasi, dan akun login GTK.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={() => setIsImportOpen(true)} className="flex-1 md:flex-none border-slate-200 hover:bg-slate-50">
                        <Upload className="mr-2 h-4 w-4" /> Import Excel
                    </Button>
                    <Button onClick={handleCreate} className="flex-1 md:flex-none font-semibold shadow-sm">
                        <Plus className="mr-2 h-4.5 w-4.5" /> Tambah GTK
                    </Button>
                </div>
            </div>

            {/* Statistics Dashboard Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <Users className="h-5 w-5 text-slate-700" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Total Pegawai</p>
                            <p className="text-xl font-bold font-mono mt-0.5">{stats.totalGTK}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                            <GraduationCap className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Guru Kelas/Mapel</p>
                            <p className="text-xl font-bold font-mono mt-0.5">{stats.totalGuru > 0 ? stats.totalGuru : '-'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                            <Award className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Status ASN / PNS</p>
                            <p className="text-xl font-bold font-mono mt-0.5">{stats.totalPNS > 0 ? stats.totalPNS : '-'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                            <BookOpen className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Pegawai Non-ASN</p>
                            <p className="text-xl font-bold font-mono mt-0.5">{stats.totalHonorer > 0 ? stats.totalHonorer : '-'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200/85 shadow-sm">
                <CardHeader className="p-4 md:p-6 pb-2 border-b border-slate-100">
                    <div className="flex flex-col gap-4">
                        
                        {/* Responsive category tabs */}
                        <div className="flex flex-wrap gap-1.5 border-b pb-3 border-slate-100">
                            {[
                                { value: "all", label: "Semua Karyawan" },
                                { value: "kepsek", label: "Kepala Sekolah" },
                                { value: "guru", label: "Guru Pendidik" },
                                { value: "staff", label: "Staff TU" },
                                { value: "support", label: "Tenaga Support" },
                            ].map((tab) => (
                                <Button
                                    key={tab.value}
                                    type="button"
                                    variant={categoryFilter === tab.value ? "default" : "ghost"}
                                    className={`h-8 text-xs font-semibold px-3 ${
                                        categoryFilter !== tab.value ? "text-slate-600 hover:bg-slate-100" : ""
                                    }`}
                                    onClick={() => setCategoryFilter(tab.value)}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>

                        {/* Search & Limit filters */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari Nama / NIP / NUPTK..."
                                    className="pl-9 border-slate-200 focus:ring-primary focus:border-primary"
                                    value={searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Tampilkan</span>
                                <Select
                                    value={limit.toString()}
                                    onValueChange={(val) => {
                                        setLimit(parseInt(val));
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[110px] border-slate-200">
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
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent bg-slate-50/50">
                                <TableHead className="w-[70px]">Foto</TableHead>
                                <SortableTableHead label="Nama Lengkap & Email" sortKey="fullName" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Gelar" sortKey="degree" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Identitas Pegawai" sortKey="nip" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Tugas Utama / Jabatan" sortKey="jobType" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Kepegawaian" sortKey="employmentStatus" sortConfig={sortConfig} onSort={requestSort} />
                                <TableHead>Kategori</TableHead>
                                <TableHead>Urutan</TableHead>
                                <TableHead className="text-right pr-6">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                // Premium Shimmer Skeleton Loader rows
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell><div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" /></TableCell>
                                        <TableCell>
                                            <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mb-1.5" />
                                            <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                        </TableCell>
                                        <TableCell><div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                                        <TableCell>
                                            <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mb-1.5" />
                                            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                        </TableCell>
                                        <TableCell><div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" /></TableCell>
                                        <TableCell><div className="h-6 w-14 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" /></TableCell>
                                        <TableCell><div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredEmployees.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                                            <AlertCircle className="h-8 w-8 text-slate-400" />
                                            <span className="font-semibold text-sm">Tidak Ada Data GTK</span>
                                            <span className="text-xs">Coba ubah filter kategori atau kata kunci pencarian Anda.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const isPrincipal = emp.category === "kepsek";
                                    return (
                                        <TableRow 
                                            key={emp.id}
                                            className={isPrincipal ? "bg-amber-50/15 hover:bg-amber-50/25 dark:bg-amber-950/5" : ""}
                                        >
                                            <TableCell>
                                                <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                                                    <AvatarImage src={emp.photoUrl || undefined} />
                                                    <AvatarFallback className="text-xs font-semibold bg-slate-100 text-slate-700">
                                                        {(emp.fullName || '?')[0].toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {emp.fullName}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{emp.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {emp.degree || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-xs space-y-0.5">
                                                    <span className="font-medium text-slate-800">{emp.nip ? `NIP. ${emp.nip}` : '-'}</span>
                                                    <span className="text-muted-foreground">{emp.nuptk ? `NUPTK. ${emp.nuptk}` : '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[11px] font-medium border-slate-200 py-0.5 px-2 bg-slate-50/50">
                                                    {emp.jobType || 'Belum diatur'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-[11px] font-semibold py-0.5 px-2 border ${
                                                    STATUS_COLORS[emp.employmentStatus] || 'bg-slate-50 text-slate-700 border-slate-200'
                                                }`}>
                                                    {emp.employmentStatus || '-'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize text-[11px] font-semibold py-0.5 px-2 border ${
                                                    CATEGORY_COLORS[emp.category || ''] || 'bg-slate-50 text-slate-700'
                                                }`}>
                                                    {categoryLabel(emp.category)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-500 font-mono">
                                                {emp.displayOrder ?? '-'}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                         <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800 bg-white border-slate-200 shadow-sm">
                                                             <span className="sr-only">Open menu</span>
                                                             <MoreHorizontal className="h-4 w-4" />
                                                         </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(emp.id)} className="cursor-pointer">
                                                            <Pencil className="mr-2 h-4 w-4 text-slate-500" /> Edit Detail
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-rose-600 focus:text-rose-700 cursor-pointer" onClick={() => handleDelete(emp.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4 text-rose-500" /> Hapus Akun
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                 </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination */}
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <div className="text-sm text-muted-foreground">
                    Menampilkan halaman <span className="font-semibold text-slate-800">{page}</span> dari <span className="font-semibold text-slate-800">{totalPages}</span> halaman
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="border-slate-200">
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border-slate-200">
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
