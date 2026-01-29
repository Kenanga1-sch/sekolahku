
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, FileDown, MoreHorizontal, Pencil, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toast";
import { useDebounce } from "@/hooks/use-debounce";
import { StudentFormDialog } from "@/components/master/student-form-dialog";
import { StudentImportDialog } from "@/components/master/student-import-dialog";
import { DataHealthWidget } from "@/components/master/data-health-widget";

// Types
type Student = {
    id: string;
    nis: string;
    nisn: string;
    fullName: string;
    className: string;
    status: string;
    gender: "L" | "P";
};

export default function MasterStudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        fetchStudents();
    }, [debouncedSearch, statusFilter, page]);

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                q: debouncedSearch,
                ...(statusFilter && { status: statusFilter })
            });

            const res = await fetch(`/api/master/students?${params}`);
            if (!res.ok) throw new Error("Gagal mengambil data");
            const data = await res.json();
            
            setStudents(data.data);
            setTotalPages(data.pagination.totalPages);
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
            const res = await fetch(`/api/master/students/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Gagal menghapus");
            
            showSuccess("Siswa berhasil dihapus");
            fetchStudents(); // Refresh
        } catch (error) {
            showError("Gagal menghapus data");
        }
    }

    const handleCreate = () => {
        setSelectedStudentId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (id: string) => {
        setSelectedStudentId(id);
        setIsFormOpen(true);
    };

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

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Direktori Siswa Utama</h1>
                    <p className="text-muted-foreground">Pusat data seluruh siswa sekolah (Active & Alumni).</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                        <FileDown className="mr-2 h-4 w-4" /> Import Excel
                    </Button>
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah Siswa Baru
                    </Button>
                </div>
            </div>

            <DataHealthWidget />

            <Card>
                <CardHeader className="p-4 md:p-6 pb-2">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                         <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari Nama / NISN / NIS..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Semua Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="graduated">Lulus</SelectItem>
                                    <SelectItem value="transferred">Mutasi</SelectItem>
                                    <SelectItem value="dropped">DO / Keluar</SelectItem>
                                    <SelectItem value="deceased">Meninggal</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Clear Filter Button if selected */}
                            {statusFilter && (
                                <Button variant="ghost" size="icon" onClick={() => setStatusFilter("")}>
                                    <Filter className="h-4 w-4 text-red-500" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Lengkap</TableHead>
                                <TableHead>NIS / NISN</TableHead>
                                <TableHead>Kelas</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : students.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada data siswa ditemukan.</TableCell>
                                </TableRow>
                            ) : (
                                students.map((student) => (
                                    <TableRow key={student.id}>
                                        <TableCell className="font-medium">
                                            {student.fullName}
                                            <div className="text-xs text-muted-foreground">{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <span>{student.nisn || '-'}</span>
                                                <span className="text-xs text-muted-foreground">{student.nis}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{student.className || 'Tanpa Kelas'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                student.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                                student.status === 'graduated' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                                            }>
                                                {student.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(student.id)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {}}>
                                                        Promosi / Kenaikan
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(student.id)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Hapus Permanen
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
            
            <div className="flex justify-end gap-2">
                 <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                </Button>
                <div className="flex items-center text-sm font-medium">Page {page} of {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                </Button>
            </div>
        </div>
    );
}
