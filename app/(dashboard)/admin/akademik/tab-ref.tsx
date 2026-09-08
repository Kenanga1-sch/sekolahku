"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { showSuccess, showError } from "@/lib/toast";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

export default function TabReferensi() {
    return (
        <Tabs defaultValue="years" className="space-y-4">
            <TabsList>
                <TabsTrigger value="years">Tahun Ajaran</TabsTrigger>
                <TabsTrigger value="subjects">Mata Pelajaran</TabsTrigger>
            </TabsList>

            <TabsContent value="years" className="space-y-4">
                 <AcademicYearsTab />
            </TabsContent>

            <TabsContent value="subjects" className="space-y-4">
                 <SubjectsTab />
            </TabsContent>
        </Tabs>
    );
}

// ==========================================
// SUB-COMPONENT: ACADEMIC YEARS
// ==========================================
function AcademicYearsTab() {
    const [data, setData] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null); // If null = create
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ name: "", semester: "Ganjil", startDate: "", endDate: "", isActive: false });

    const fetchData = useCallback(async () => {
        try {
            const results: any = await goGet("/api/academic/years");
            setData(results);
        } catch (e) {
            showError("Gagal memuat data");
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (editData) {
                await goPut(`/api/academic/years/${editData.id}`, formData);
            } else {
                await goPost("/api/academic/years", formData);
            }
            
            showSuccess("Data tersimpan");
            setIsOpen(false);
            fetchData();
        } catch (err) {
            showError("Gagal menyimpan data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (item: any) => {
        setEditData(item);
        setFormData({ 
            name: item.name, 
            semester: item.semester, 
            startDate: item.startDate ? item.startDate.split('T')[0] : "", 
            endDate: item.endDate ? item.endDate.split('T')[0] : "", 
            isActive: item.isActive 
        });
        setIsOpen(true);
    };

    const handleCreate = () => {
        setEditData(null);
        setFormData({ name: "", semester: "Ganjil", startDate: "", endDate: "", isActive: false });
        setIsOpen(true);
    };

     const handleDelete = async (id: string) => {
        if(!confirm("Hapus tahun ajaran ini?")) return;
        try {
            await goDelete(`/api/academic/years/${id}`);
            showSuccess("Terhapus");
            fetchData();
        } catch (e) {
            showError("Gagal menghapus (mungkin status Aktif)");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <CardTitle>Daftar Tahun Ajaran</CardTitle>
                    <CardDescription>Atur periode akademik sekolah.</CardDescription>
                </div>
                <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
            </CardHeader>
            <CardContent>
                <DataTable
                    data={data}
                    getRowId={(item) => item.id}
                    emptyTitle="Belum ada tahun ajaran"
                    emptyDescription="Tambahkan tahun ajaran untuk mengatur periode akademik."
                    columns={[
                        {
                            key: "name",
                            header: "Tahun Ajaran",
                            card: "title",
                            render: (item) => <span className="font-medium">{item.name}</span>,
                        },
                        {
                            key: "semester",
                            header: "Semester",
                            card: "field",
                            render: (item) => item.semester,
                        },
                        {
                            key: "startDate",
                            header: "Periode Tanggal",
                            card: "field",
                            render: (item) => (
                                <span className="text-sm text-muted-foreground">
                                    {item.startDate ? new Date(item.startDate).toLocaleDateString("id-ID") : "-"} s/d <br/>
                                    {item.endDate ? new Date(item.endDate).toLocaleDateString("id-ID") : "-"}
                                </span>
                            ),
                        },
                        {
                            key: "isActive",
                            header: "Status",
                            card: "field",
                            render: (item) => (
                                item.isActive ? 
                                    <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Aktif</Badge> : 
                                    <Badge variant="outline">Non-Aktif</Badge>
                            ),
                        },
                    ]}
                    actions={(item) => (
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    )}
                />
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editData ? "Edit" : "Tambah"} Tahun Ajaran</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Nama Tahun (ex: 2024/2025)</Label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="YYYY/YYYY" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Semester</Label>
                            <Select value={formData.semester} onValueChange={v => setFormData({...formData, semester: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Ganjil">Ganjil</SelectItem>
                                    <SelectItem value="Genap">Genap</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Mulai</Label>
                                <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Selesai</Label>
                                <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 py-2">
                            <Switch checked={formData.isActive} onCheckedChange={c => setFormData({...formData, isActive: c})} />
                            <Label>Set sebagai Aktif</Label>
                        </div>
                        <DialogFooter><Button type="submit">Simpan</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ==========================================
// SUB-COMPONENT: SUBJECTS
// ==========================================
function SubjectsTab() {
    const [data, setData] = useState<any[]>([]);
     const [isOpen, setIsOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ code: "", name: "", category: "UMUM", description: "" });

    const fetchData = useCallback(async () => {
        try {
            const results: any = await goGet("/api/academic/subjects");
            setData(results);
        } catch (e) {
            showError("Gagal memuat data");
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (editData) {
                await goPut(`/api/academic/subjects/${editData.id}`, formData);
            } else {
                await goPost("/api/academic/subjects", formData);
            }
            showSuccess("Data tersimpan");
            setIsOpen(false);
            fetchData();
        } catch (err) {
            showError("Gagal menyimpan data");
        } finally {
            setIsLoading(false);
        }
    };

     const handleEdit = (item: any) => {
        setEditData(item);
        setFormData({ code: item.code, name: item.name, category: item.category || "UMUM", description: item.description || "" });
        setIsOpen(true);
    };

    const handleCreate = () => {
        setEditData(null);
        setFormData({ code: "", name: "", category: "UMUM", description: "" });
        setIsOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(!confirm("Hapus mata pelajaran ini?")) return;
        try {
            await goDelete(`/api/academic/subjects/${id}`);
            showSuccess("Terhapus");
            fetchData();
        } catch (e) {
            showError("Gagal menghapus");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                   <CardTitle>Daftar Mata Pelajaran</CardTitle>
                   <CardDescription>Kode dan nama mata pelajaran.</CardDescription>
                </div>
                <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
            </CardHeader>
              <CardContent>
                <DataTable
                    data={data}
                    getRowId={(item) => item.id}
                    emptyTitle="Belum ada mata pelajaran"
                    emptyDescription="Tambahkan kode dan nama mata pelajaran."
                    columns={[
                        {
                            key: "code",
                            header: "Kode",
                            card: "field",
                            render: (item) => <span className="font-mono font-medium">{item.code}</span>,
                        },
                        {
                            key: "name",
                            header: "Mata Pelajaran",
                            card: "title",
                            render: (item) => item.name,
                        },
                        {
                            key: "category",
                            header: "Kategori",
                            card: "field",
                            render: (item) => <Badge variant="secondary">{item.category}</Badge>,
                        },
                    ]}
                    actions={(item) => (
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    )}
                />
            </CardContent>

             <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editData ? "Edit" : "Tambah"} Mata Pelajaran</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>Kode Mapel</Label>
                                <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required placeholder="MTK" />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                                <Label>Nama Mapel</Label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Matematika" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Kategori</Label>
                             <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UMUM">UMUM</SelectItem>
                                    <SelectItem value="MUATAN_NASIONAL">MUATAN NASIONAL (A)</SelectItem>
                                    <SelectItem value="MUATAN_KEWILAYAHAN">MUATAN KEWILAYAHAN (B)</SelectItem>
                                    <SelectItem value="MUATAN_PEMINATAN">PEMINATAN KEJURUAN (C)</SelectItem>
                                    <SelectItem value="MULOK">MULOK</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-2">
                            <Label>Deskripsi (Opsional)</Label>
                            <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <DialogFooter><Button type="submit" disabled={isLoading}>Simpan</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
