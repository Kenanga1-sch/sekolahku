"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Info, Hash } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

interface AcademicClass {
    id: string;
    name: string;
    grade: number;
    teacherName: string | null;
    waliUserId?: string | null;
    waliUserName?: string | null;
    capacity: number;
    academicYear: string;
}

interface Teacher {
    id: string;
    fullName: string;
    name?: string;
}

export default function TabKelas() {
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [academicYear, setAcademicYear] = useState<string>("...");
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AcademicClass | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [inheritedFrom, setInheritedFrom] = useState<string>("");
    const [deletingItem, setDeletingItem] = useState<AcademicClass | null>(null);
    const [nisTarget, setNisTarget] = useState<AcademicClass | null>(null);
    const [isIssuingNIS, setIsIssuingNIS] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: "",
        grade: "1",
        capacity: 28,
        waliUserId: "__none__"
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Guru wali kelas harus dipilih dari users (punya akun login),
            // bukan dari direktori GTK — scoping Presensi/Tabungan
            // melengkapinya lewat wali_user_id → users.id.
            const [dataClasses, resYear, usersRes]: [any, any, any] = await Promise.all([
                goGet("/api/academic/classes"),
                goGet("/api/academic/active-year"),
                goGet("/api/users?role=guru&limit=100")
            ]);

            setClasses(Array.isArray(dataClasses) ? dataClasses : []);
            setTeachers((usersRes?.items || []).map((t: any) => ({
                id: t.id,
                fullName: t.name || t.fullName || t.email || "-"
            })));

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
                capacity: item.capacity,
                waliUserId: item.waliUserId || "__none__"
            });
        } else {
            setEditingItem(null);
            setInheritedFrom("");
            setFormData({
                name: "",
                grade: "1",
                capacity: 28,
                waliUserId: "__none__"
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
                academicYear: academicYear,
                waliUserId: formData.waliUserId === "__none__" ? null : formData.waliUserId
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

    const handleIssueNIS = async (item: AcademicClass) => {
        setIsIssuingNIS(true);
        try {
            const res: any = await goPost("/api/master/students/issue-nis", { classId: item.id });
            const count = res?.data?.count ?? 0;
            if (count > 0) {
                showSuccess(`${count} NIS diterbitkan untuk ${item.name} (urut nama)`);
            } else {
                showSuccess(`Semua siswa di ${item.name} sudah memiliki NIS`);
            }
            setNisTarget(null);
            fetchData();
        } catch (error: any) {
            showError(error?.message || "Gagal menerbitkan NIS");
        } finally {
            setIsIssuingNIS(false);
        }
    };

    const handleDelete = async (item: AcademicClass) => {
        setDeletingItem(null);
        try {
            await goDelete(`/api/academic/classes/${item.id}`);
            showSuccess("Kelas dihapus");
            fetchData();
        } catch (e) {
            showError("Gagal menghapus");
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                    <DataTable
                        data={classes}
                        getRowId={(c) => c.id}
                        loading={isLoading}
                        emptyTitle="Belum ada data kelas"
                        emptyDescription="Kelas yang dibuat akan tampil di sini."
                        columns={[
                            {
                                key: "grade",
                                header: "Tingkat",
                                card: "field",
                                render: (c) => `Kelas ${c.grade}`,
                            },
                            {
                                key: "name",
                                header: "Nama Kelas",
                                card: "title",
                                render: (c) => <span className="font-bold">{c.name}</span>,
                            },
                            {
                                key: "wali",
                                header: "Wali Kelas",
                                card: "field",
                                render: (c) => c.waliUserName ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        {c.waliUserName}
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Wali</span>
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                ),
                            },
                            {
                                key: "capacity",
                                header: "Kapasitas (Kuota Angkatan)",
                                card: "field",
                                render: (c) => (
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{c.capacity} Siswa</span>
                                        <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                                            Kuota Angkatan
                                        </span>
                                    </div>
                                ),
                            },
                        ]}
                        actions={(c) => (
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Terbitkan NIS"
                                    onClick={() => setNisTarget(c)}
                                >
                                    <Hash className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(c)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingItem(c)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    />
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
                            <Label>Wali Kelas</Label>
                            <Select
                                value={formData.waliUserId}
                                onValueChange={(val) => setFormData({...formData, waliUserId: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Wali Kelas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Tidak ada</SelectItem>
                                    {teachers.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.fullName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Guru yang ditunjuk hanya melihat data kelas ini di modul Presensi dan Tabungan.
                            </p>
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

            <AlertDialog open={!!nisTarget} onOpenChange={(open) => !open && setNisTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Terbitkan NIS kelas {nisTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Siswa di kelas ini yang belum memiliki NIS akan diberi NIS otomatis, diurutkan
                            menurut nama (A → nomor terkecil). NIS yang sudah ada tidak akan diubah.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isIssuingNIS}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isIssuingNIS}
                            onClick={(e) => {
                                e.preventDefault();
                                if (nisTarget) handleIssueNIS(nisTarget);
                            }}
                        >
                            {isIssuingNIS ? "Memproses..." : "Terbitkan NIS"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus kelas {deletingItem?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Kelas hanya bisa dihapus jika tidak ada siswa aktif di dalamnya. Riwayat kelas siswa tidak akan terhapus.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => deletingItem && handleDelete(deletingItem)}
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

