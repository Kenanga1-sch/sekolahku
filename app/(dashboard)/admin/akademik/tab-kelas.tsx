"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

interface AcademicClass {
    id: string;
    name: string;
    grade: number;
    teacherName: string | null;
    capacity: number;
    academicYear: string;
}

export default function TabKelas() {
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [academicYear, setAcademicYear] = useState<string>("...");
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AcademicClass | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [inheritedFrom, setInheritedFrom] = useState<string>("");

    // Form
    const [formData, setFormData] = useState({
        name: "",
        grade: "1",
        capacity: 28
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [dataClasses, resYear]: [any, any] = await Promise.all([
                goGet("/api/academic/classes"),
                goGet("/api/academic/active-year")
            ]);

            setClasses(Array.isArray(dataClasses) ? dataClasses : []);

            if (resYear.success && resYear.data) {
                setAcademicYear(resYear.data);
            }
        } catch (error) {
            console.error(error);
            showError("Gagal memuat data kelas");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchSuggestedCapacity = async (gradeStr: string, nameStr: string) => {
        if (!academicYear || academicYear === "...") return;
        try {
            const res: any = await goGet(`/api/academic/classes/suggested-capacity?grade=${gradeStr}&name=${encodeURIComponent(nameStr)}&academicYear=${encodeURIComponent(academicYear)}`);
            if (res?.success && typeof res?.capacity === "number") {
                setFormData(prev => ({ ...prev, capacity: res.capacity }));
                setInheritedFrom(res.inheritedFrom || "");
            }
        } catch (e) {
            console.error("Failed to fetch suggested capacity", e);
        }
    };

    const handleOpenDialog = (item?: AcademicClass) => {
        if (item) {
            setEditingItem(item);
            setInheritedFrom("");
            setFormData({
                name: item.name,
                grade: item.grade.toString(),
                capacity: item.capacity
            });
        } else {
            setEditingItem(null);
            setInheritedFrom("");
            setFormData({
                name: "",
                grade: "1",
                capacity: 28
            });
            fetchSuggestedCapacity("1", "");
        }
        setIsDialogOpen(true);
    };

    const handleGradeChange = (newGrade: string) => {
        setFormData(prev => ({ ...prev, grade: newGrade }));
        if (!editingItem) {
            fetchSuggestedCapacity(newGrade, formData.name);
        }
    };

    const handleNameChange = (newName: string) => {
        setFormData(prev => ({ ...prev, name: newName }));
        if (!editingItem) {
            fetchSuggestedCapacity(formData.grade, newName);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name) return;
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                grade: parseInt(formData.grade, 10),
                capacity: formData.capacity,
                academicYear: academicYear
            };

            if (editingItem) {
                await goPut(`/api/academic/classes/${editingItem.id}`, payload);
            } else {
                await goPost("/api/academic/classes", payload);
            }
            
            showSuccess(editingItem ? "Kelas diperbarui" : "Kelas ditambahkan");
            setIsDialogOpen(false);
            fetchData();
        } catch (error) {
            showError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus kelas ini?")) return;
        try {
            await goDelete(`/api/academic/classes/${id}`);
            showSuccess("Kelas dihapus");
            fetchData();
        } catch (e) {
            showError("Gagal menghapus");
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Daftar Kelas</CardTitle>
                        <CardDescription>Tahun Ajaran {academicYear} • Kuota dikunci sesuai angkatan saat Kelas 1</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Kelas
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tingkat</TableHead>
                                <TableHead>Nama Kelas</TableHead>
                                <TableHead>Kapasitas (Kuota Angkatan)</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : classes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Belum ada data kelas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                classes.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>Kelas {c.grade}</TableCell>
                                        <TableCell className="font-bold">{c.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{c.capacity} Siswa</span>
                                                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                                                    Kuota Angkatan
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(c)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? "Edit Kelas & Kuota" : "Tambah Kelas Baru"}</DialogTitle>
                        <DialogDescription>
                            Kapasitas dikunci mengikuti kuota angkatan saat Kelas 1, namun tetap dapat Anda sesuaikan bila ada kesalahan atau perubahan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tingkat</Label>
                            <Select 
                                value={formData.grade} 
                                onValueChange={handleGradeChange}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1,2,3,4,5,6].map(g => (
                                        <SelectItem key={g} value={g.toString()}>Kelas {g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Nama Kelas</Label>
                            <Input 
                                placeholder="Contoh: 1A" 
                                value={formData.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kapasitas Siswa (Maksimal)</Label>
                            <Input 
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                            />
                            {inheritedFrom ? (
                                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-2.5 flex items-start gap-1.5">
                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <span>
                                        Kuota otomatis diwariskan dari <strong>{inheritedFrom}</strong> ({formData.capacity} Siswa). Anda tetap dapat mengubah angka ini bila ada penyesuaian.
                                    </span>
                                </p>
                            ) : parseInt(formData.grade) === 1 ? (
                                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-start gap-1.5">
                                    <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                    <span>
                                        Kuota awal angkatan baru untuk Kelas 1 T.A <strong>{academicYear}</strong>. Kuota ini akan diwariskan secara otomatis ke tingkat berikutnya hingga lulus.
                                    </span>
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500">
                                    Kapasitas dapat Anda sesuaikan sewaktu-waktu jika terdapat perubahan kuota sekolah.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSaving || !formData.name}>
                            {isSaving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

