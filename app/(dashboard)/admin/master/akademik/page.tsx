
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { showSuccess, showError } from "@/lib/toast";

export default function MasterAcademicPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Referensi Akademik</h1>
                <p className="text-muted-foreground">Kelola Data Tahun Ajaran dan Mata Pelajaran.</p>
            </div>

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
        </div>
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

    useEffect(() => { fetchData() }, []);

    const fetchData = async () => {
        const res = await fetch("/api/master/academic-years");
        if(res.ok) setData(await res.json());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const url = editData ? `/api/master/academic-years/${editData.id}` : "/api/master/academic-years";
            const method = editData ? "PUT" : "POST";
            
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if(!res.ok) throw new Error("Gagal menyimpan");
            
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
        const res = await fetch(`/api/master/academic-years/${id}`, { method: "DELETE" });
        if(res.ok) { showSuccess("Terhapus"); fetchData(); }
        else showError("Gagal menghapus (mungkin status Aktif)");
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Daftar Tahun Ajaran</CardTitle>
                    <CardDescription>Atur periode akademik sekolah.</CardDescription>
                </div>
                <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tahun Ajaran</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Periode Tanggal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.semester}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {item.startDate ? new Date(item.startDate).toLocaleDateString("id-ID") : "-"} s/d <br/>
                                    {item.endDate ? new Date(item.endDate).toLocaleDateString("id-ID") : "-"}
                                </TableCell>
                                <TableCell>
                                    {item.isActive ? 
                                        <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Aktif</Badge> : 
                                        <Badge variant="outline">Non-Aktif</Badge>
                                    }
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
                         <div className="grid grid-cols-2 gap-4">
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
                        <DialogFooter><Button type="submit" disabled={isLoading}>Simpan</Button></DialogFooter>
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

    useEffect(() => { fetchData() }, []);
    const fetchData = async () => {
        const res = await fetch("/api/master/subjects");
        if(res.ok) setData(await res.json());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const url = editData ? `/api/master/subjects/${editData.id}` : "/api/master/subjects";
            const method = editData ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
            if(!res.ok) throw new Error("Gagal menyimpan");
            showSuccess("Data tersimpan"); setIsOpen(false); fetchData();
        } catch (err) { showError("Gagal menyimpan data"); } finally { setIsLoading(false); }
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
        const res = await fetch(`/api/master/subjects/${id}`, { method: "DELETE" });
        if(res.ok) { showSuccess("Terhapus"); fetchData(); }
        else showError("Gagal menghapus");
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                   <CardTitle>Daftar Mata Pelajaran</CardTitle>
                   <CardDescription>Kode dan nama mata pelajaran.</CardDescription>
                </div>
                <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
            </CardHeader>
             <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kode</TableHead>
                            <TableHead>Mata Pelajaran</TableHead>
                            <TableHead>Kategori</TableHead>
                             <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono font-medium">{item.code}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

             <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editData ? "Edit" : "Tambah"} Mata Pelajaran</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1 grid gap-2">
                                <Label>Kode Mapel</Label>
                                <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required placeholder="MTK" />
                            </div>
                            <div className="col-span-2 grid gap-2">
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

