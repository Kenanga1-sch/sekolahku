
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
import { Plus, Pencil, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";

interface AcademicClass {
    id: string;
    name: string;
    grade: number;
    teacherName: string | null;
    capacity: number;
    academicYear: string;
}

export default function AcademicClassesPage() {
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AcademicClass | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: "",
        grade: "1",
        capacity: 28
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/academic/classes");
            if (!res.ok) throw new Error("Gagal load data");
            const data = await res.json();
            setClasses(Array.isArray(data) ? data : []);
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

    const handleOpenDialog = (item?: AcademicClass) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                grade: item.grade.toString(),
                capacity: item.capacity
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: "",
                grade: "1",
                capacity: 28
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.name) return;
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                grade: formData.grade,
                capacity: formData.capacity,
                academicYear: "2024/2025" // Hardcoded for now, or dynamic later
            };

            let res;
            if (editingItem) {
                res = await fetch(`/api/academic/classes/${editingItem.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch("/api/academic/classes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error("Gagal menyimpan");
            
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
            const res = await fetch(`/api/academic/classes/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Gagal hapus");
            showSuccess("Kelas dihapus");
            fetchData();
        } catch (e) {
            showError("Gagal menghapus");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Data Kelas Akademik</h1>
                    <p className="text-muted-foreground">Master data kelas utama sekolah</p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Daftar Kelas</CardTitle>
                        <CardDescription>Tahun Ajaran 2024/2025</CardDescription>
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
                                <TableHead>Kapasitas</TableHead>
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
                                        <TableCell>{c.capacity} Siswa</TableCell>
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
                        <DialogTitle>{editingItem ? "Edit Kelas" : "Tambah Kelas Baru"}</DialogTitle>
                        <DialogDescription>
                            Pastikan nama kelas sesuai dengan data Dapodik/Sekolah.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tingkat</Label>
                            <Select 
                                value={formData.grade} 
                                onValueChange={(v) => setFormData({...formData, grade: v})}
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
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kapasitas Siswa</Label>
                            <Input 
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                            />
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
