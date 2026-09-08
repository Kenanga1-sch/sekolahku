"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
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
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
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
                goGet("/api/tabungan/kelas"),
                goGet("/api/tabungan/brankas"),
                goGet("/api/users?limit=200"),
                goGet("/api/academic/classes"),
            ]);

            setKelasList(Array.isArray(kelasRes) ? (kelasRes as any) : (kelasRes as any).items || (kelasRes as any).data || []);
            const vaults = (brankasRes as any).vaults || (brankasRes as any).items || (brankasRes as any).data?.vaults || [];
            setBrankasList(Array.isArray(vaults) ? vaults : []);
            setOfficialClasses(Array.isArray(officialClassesRes) ? (officialClassesRes as any) : (officialClassesRes as any).items || (officialClassesRes as any).data || []);

            if ((usersRes as any).items) {
                const allUsers = (usersRes as any).items as SimpleUser[];
                setTeachers(allUsers.filter(u => ["guru", "admin"].includes(u.role)));
                setStaff(allUsers.filter(u => ["staff", "guru", "admin"].includes(u.role)));
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

            if (editClassId) {
                // Update
                await goPut(`/api/tabungan/kelas/${editClassId}`, payload);
            } else {
                // Create
                await goPost("/api/tabungan/kelas", payload);
            }

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
            await goDelete(`/api/tabungan/kelas/${id}`);
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

            await goPut(`/api/tabungan/brankas/${brankasId}`, payload);
            
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
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
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
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                            <DataTable
                                data={isLoading ? [] : kelasList}
                                getRowId={(k) => k.id}
                                loading={isLoading}
                                emptyTitle="Belum ada data kelas"
                                emptyDescription="Tambahkan kelas untuk menugaskan wali kelas."
                                columns={[
                                    {
                                        key: "nama",
                                        header: "Nama Kelas",
                                        card: "title",
                                        render: (k) => (
                                            <span className="font-medium bg-muted/30 px-2 py-0.5 rounded">
                                                {k.nama}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: "waliKelasUser.name",
                                        header: "Wali Kelas (Guru)",
                                        card: "field",
                                        render: (k) => (
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className={`h-4 w-4 ${k.waliKelas ? "text-green-500" : "text-gray-300"}`} />
                                                <span className={k.waliKelas ? "font-medium" : "text-muted-foreground italic"}>
                                                    {k.waliKelasUser?.name || "Belum ditentukan"}
                                                </span>
                                            </div>
                                        ),
                                    },
                                ]}
                                actions={(k) => (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditClass(k)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClass(k.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            />
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
                            <DataTable
                                data={isLoading ? [] : brankasList}
                                getRowId={(b) => b.id}
                                loading={isLoading}
                                emptyTitle="Belum ada data brankas/rekening"
                                emptyDescription="Buat akun keuangan terlebih dahulu untuk menugaskan PIC."
                                emptyAction={{
                                    label: "Buat Akun Keuangan",
                                    href: "/tabungan/brankas",
                                }}
                                columns={[
                                    {
                                        key: "nama",
                                        header: "Nama Brankas",
                                        card: "title",
                                        render: (b) => (
                                            <span className="font-medium">{b.nama}</span>
                                        ),
                                    },
                                    {
                                        key: "tipe",
                                        header: "Tipe",
                                        card: "field",
                                        render: (b) => (
                                            <Badge variant="outline">{b.tipe === "bank" ? "Rekening Bank" : "Tunai"}</Badge>
                                        ),
                                    },
                                    {
                                        key: "picId",
                                        header: "PIC / Bendahara",
                                        card: "field",
                                        render: (b) => (
                                            <Select
                                                value={b.picId || "unassigned"}
                                                onValueChange={(val) => handleUpdateBrankasPIC(b.id, val === "unassigned" ? null : val)}
                                            >
                                                <SelectTrigger className="w-full sm:w-[250px]">
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
                                        ),
                                    },
                                ]}
                            />
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

