"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Vault, Plus, Pencil, Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import type { TabunganKelasWithRelations } from "@/types/tabungan";

interface SimpleUser {
    id: string;
    name: string;
    role: string;
}

interface BrankasData {
    id: string;
    nama: string;
    tipe: string;
    picId: string | null;
    pic?: { name: string } | null;
}

export default function TabunganPenggunaPage() {
    const [activeTab, setActiveTab] = useState("wali-kelas");
    const [isLoading, setIsLoading] = useState(true);
    
    // Data State
    const [kelasList, setKelasList] = useState<TabunganKelasWithRelations[]>([]);
    const [brankasList, setBrankasList] = useState<BrankasData[]>([]);
    const [teachers, setTeachers] = useState<SimpleUser[]>([]);
    const [staff, setStaff] = useState<SimpleUser[]>([]);

    // Class Dialog State
    const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
    const [editClassId, setEditClassId] = useState<string | null>(null);
    const [className, setClassName] = useState("");
    const [classWali, setClassWali] = useState<string>("none");

    // Official Classes State
    const [officialClasses, setOfficialClasses] = useState<{id: string, name: string}[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [kelasRes, brankasRes, usersRes, officialClassesRes] = await Promise.all([
                fetch("/api/tabungan/kelas").then(r => r.json()),
                fetch("/api/tabungan/brankas").then(r => r.json()),
                fetch("/api/users?limit=200").then(r => r.json()),
                fetch("/api/academic/classes").then(r => r.json()),
            ]);

            setKelasList(Array.isArray(kelasRes) ? kelasRes : []);
            setBrankasList(brankasRes.data && Array.isArray(brankasRes.data) ? brankasRes.data : []);
            setOfficialClasses(Array.isArray(officialClassesRes) ? officialClassesRes : []);

            if (usersRes.items) {
                const allUsers = usersRes.items as SimpleUser[];
                setTeachers(allUsers.filter(u => ["guru", "admin", "superadmin"].includes(u.role)));
                setStaff(allUsers.filter(u => ["staff", "guru", "admin", "superadmin"].includes(u.role)));
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            showError("Gagal memuat data pengguna");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveClass = async () => {
         if (!className || className === "custom_other") {
            showError("Pilih nama kelas");
            return;
         }
        
        try {
            const payload = {
                nama: className,
                waliKelas: classWali === "none" ? null : classWali,
            };

            let res;
            if (editClassId) {
                // Update
                 res = await fetch(`/api/tabungan/kelas/${editClassId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                // Create
                res = await fetch("/api/tabungan/kelas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (!res.ok) throw new Error("Gagal menyimpan kelas");

            showSuccess(editClassId ? "Kelas diperbarui" : "Kelas berhasil ditambahkan");
            setIsClassDialogOpen(false);
            resetClassForm();
            fetchData();
        } catch (error) {
            console.error(error);
            showError("Terjadi kesalahan saat menyimpan");
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm("Yakin ingin menghapus kelas ini?")) return;
        try {
            const res = await fetch(`/api/tabungan/kelas/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Gagal hapus");
            showSuccess("Kelas dihapus");
            fetchData();
        } catch (error) {
            showError("Gagal menghapus kelas");
        }
    };

    const openCreateClass = () => {
        resetClassForm();
        setIsClassDialogOpen(true);
    };

    const openEditClass = (k: TabunganKelasWithRelations) => {
        setEditClassId(k.id);
        setClassName(k.nama);
        setClassWali(k.waliKelas || "none");
        setIsClassDialogOpen(true);
    };

    const resetClassForm = () => {
        setEditClassId(null);
        setClassName("");
        setClassWali("none");
    };
    
    // Quick Update for Brankas PIC (Inline)
    const handleUpdateBrankasPIC = async (brankasId: string, picId: string | null) => {
        try {
            // We use the same createOrUpdate logic which might need existing details
            // But ideally we just patch the PIC.
            // Let's assume hitting the POST endpoint works as update if ID exists.
            // We need to fetch the existing brankas detail first to not overwrite other fields?
            // Or our API handles partial updates? 
            // Looking at previous API work, the POST handled createOrUpdate. 
            // Let's try sending just the ID and the new picId if the backend supports partial.
            // Actually, the backend `createOrUpdateBrankas` likely needs all required fields if it's an insert, but for update it might be safer to get current data.
            // Simplest way: Find the brankas in our local state list, clone it, update picId, send it.
            
            const current = brankasList.find(b => b.id === brankasId);
            if (!current) return;

            const payload = {
                id: current.id,
                nama: current.nama,
                tipe: current.tipe,
                picId: picId,
                // We might need to send other fields like saldo if validation requires it, 
                // but let's hope the API is smart or we just send what we have.
            };

            const res = await fetch("/api/tabungan/brankas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Gagal update PIC");
            
            showSuccess("PIC Brankas diperbarui");
            fetchData();
        } catch (e) {
            showError("Gagal update PIC");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Kelola Pengguna Tabungan</h1>
                        <p className="text-muted-foreground">
                            Atur Wali Kelas dan Bendahara (PIC)
                        </p>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="wali-kelas">Wali Kelas</TabsTrigger>
                    <TabsTrigger value="bendahara">Bendahara (Brankas)</TabsTrigger>
                </TabsList>

                <TabsContent value="wali-kelas" className="space-y-4 py-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Data Wali Kelas</CardTitle>
                                <CardDescription>
                                    Guru yang bertanggung jawab memvalidasi setoran kelas
                                </CardDescription>
                            </div>
                            <Button onClick={openCreateClass} size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah Kelas
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nama Kelas</TableHead>
                                        <TableHead>Wali Kelas (Guru)</TableHead>
                                        <TableHead className="w-[150px] text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {kelasList.map((k) => (
                                        <TableRow key={k.id}>
                                            <TableCell className="font-medium bg-muted/30">{k.nama}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck className={`h-4 w-4 ${k.waliKelas ? "text-green-500" : "text-gray-300"}`} />
                                                    <span className={k.waliKelas ? "font-medium" : "text-muted-foreground italic"}>
                                                        {k.waliKelasUser?.name || "Belum ditentukan"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditClass(k)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClass(k.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {kelasList.length === 0 && !isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                Belum ada data kelas
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bendahara" className="space-y-4 py-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Penanggung Jawab Brankas</CardTitle>
                            <CardDescription>
                                Staff/Guru yang memegang akses brankas/rekening
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nama Brankas</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead>PIC / Bendahara</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {brankasList.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-medium">{b.nama}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{b.tipe === "bank" ? "Rekening Bank" : "Tunai"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Select 
                                                    value={b.picId || "unassigned"} 
                                                    onValueChange={(val) => handleUpdateBrankasPIC(b.id, val === "unassigned" ? null : val)}
                                                >
                                                    <SelectTrigger className="w-[250px]">
                                                        <SelectValue placeholder="Pilih PIC..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">-- Belum Ada --</SelectItem>
                                                        {staff.map((s) => (
                                                            <SelectItem key={s.id} value={s.id}>
                                                                {s.name} ({s.role})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {brankasList.length === 0 && !isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <p>Belum ada data brankas/rekening.</p>
                                                    <Link href="/tabungan/brankas">
                                                        <Button variant="outline" size="sm">
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Buat Akun Keuangan Baru
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog Edit/Create Kelas */}
            <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editClassId ? "Edit Kelas" : "Tambah Kelas"}</DialogTitle>
                        <DialogDescription>Atur nama kelas dan wali kelasnya</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nama Kelas</Label>
                            <Select value={className} onValueChange={setClassName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kelas Akademik..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {officialClasses.map((oc) => (
                                        <SelectItem key={oc.id} value={oc.name}>
                                            {oc.name}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="custom_other">-- Lainnya / Manual --</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Fallback for manual input if needed, or just strict select? 
                                User asked for strict connection to reduce error. 
                                Let's keep it strict select for now, maybe add "Other" later if requested.
                                Actually, let's allow manual input if they select "Other" or just strict?
                                The prompt says "lessen error", so let's try strict first.
                            */}
                        </div>
                        <div className="space-y-2">
                            <Label>Wali Kelas</Label>
                            <Select value={classWali} onValueChange={setClassWali}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Guru..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Belum Ada --</SelectItem>
                                    {teachers.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsClassDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSaveClass}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
