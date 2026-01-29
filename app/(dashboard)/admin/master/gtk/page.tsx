
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Filter, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from "@/lib/toast";
import { useDebounce } from "@/hooks/use-debounce";
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
};

export default function MasterGTKPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modal
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        fetchEmployees();
    }, [debouncedSearch, page]);

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                q: debouncedSearch,
            });

            const res = await fetch(`/api/master/employees?${params}`);
            if (!res.ok) throw new Error("Gagal mengambil data");
            const data = await res.json();
            
            setEmployees(data.data);
            setTotalPages(data.pagination.totalPages);
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
            const res = await fetch(`/api/master/employees/${id}`, { method: "DELETE" });
            const json = await res.json();

            if (!res.ok) throw new Error(json.error || "Gagal menghapus");
            
            showSuccess("Data GTK berhasil dihapus");
            fetchEmployees();
        } catch (error: any) {
            showError(error.message || "Gagal menghapus data");
        }
    }

    const handleCreate = () => {
        setSelectedId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (id: string) => {
        setSelectedId(id);
        setIsFormOpen(true);
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

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Direktori Guru & Tenaga Kependidikan</h1>
                    <p className="text-muted-foreground">Manajemen data pegawai, guru, dan staff sekolah.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" /> Import Excel
                    </Button>
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah GTK Baru
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="p-4 md:p-6 pb-2">
                     <div className="relative w-full md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari Nama / NIP / NUPTK..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Lengkap</TableHead>
                                <TableHead>NIP / NUPTK</TableHead>
                                <TableHead>Jabatan</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : employees.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada data GTK ditemukan.</TableCell>
                                </TableRow>
                            ) : (
                                employees.map((emp) => (
                                    <TableRow key={emp.id}>
                                        <TableCell className="font-medium">
                                            {emp.fullName}
                                            <div className="text-xs text-muted-foreground">{emp.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <span>{emp.nip ? `NIP. ${emp.nip}` : '-'}</span>
                                                <span className="text-xs text-muted-foreground">{emp.nuptk ? `NUPTK. ${emp.nuptk}` : '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{emp.jobType || 'Belum diatur'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                emp.employmentStatus === 'PNS' ? 'bg-blue-100 text-blue-700' :
                                                emp.employmentStatus === 'GTY' ? 'bg-green-100 text-green-700' :
                                                'bg-zinc-100 text-zinc-700'
                                            }>
                                                {emp.employmentStatus || '-'}
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
                                                    <DropdownMenuItem onClick={() => handleEdit(emp.id)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(emp.id)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Hapus Akun
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

             <div className="flex justify-end gap-2 text-sm text-muted-foreground">
                 {/* Logic pagination simple */}
                  Halaman {page} dari {totalPages}
            </div>
        </div>
    );
}
