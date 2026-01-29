"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Loader2, Leaf } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DIMENSI_P5 = [
    "Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia",
    "Berkebinekaan Global",
    "Bergotong Royong",
    "Mandiri",
    "Bernalar Kritis",
    "Kreatif"
];

const TEMA_P5 = [
    "Gaya Hidup Berkelanjutan",
    "Kearifan Lokal",
    "Bhinneka Tunggal Ika",
    "Bangunlah Jiwa dan Raganya",
    "Suara Demokrasi",
    "Rekayasa dan Teknologi",
    "Kewirausahaan"
];

// ... imports

// Remove DUMMY_STUDENTS const

export default function P5Page() {
    const [projects, setProjects] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Project Form
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newProject, setNewProject] = useState({
        theme: "",
        title: "",
        description: "",
        gradeLevel: "1",
        semester: "1",
        dimensions: [] as string[]
    });

    // Assessment State
    const [selectedProject, setSelectedProject] = useState<string>("");
    // grades: { studentId_dimensionIndex: predicate }
    const [grades, setGrades] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchProjects();
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        const res = await fetch("/api/students");
        const json = await res.json();
        if (json.success) setStudents(json.data);
    };

    // ... existing functions

    const fetchProjects = async () => {
        setLoading(true);
         const res = await fetch("/api/kurikulum/p5/projects");
         const json = await res.json();
         if (json.success) {
             setProjects(json.data);
         }
         setLoading(false);
    };

    const handleCreate = async () => {
        try {
            const res = await fetch("/api/kurikulum/p5/projects", {
                method: "POST",
                body: JSON.stringify(newProject)
            });
            if (res.ok) {
                toast.success("Projek P5 dibuat!");
                setIsDialogOpen(false);
                fetchProjects();
            }
        } catch(e) { toast.error("Gagal"); }
    };

    const toggleDimension = (d: string) => {
        setNewProject(prev => {
             if (prev.dimensions.includes(d)) return { ...prev, dimensions: prev.dimensions.filter(x => x !== d) };
             return { ...prev, dimensions: [...prev.dimensions, d] };
        });
    };

    const handleSaveGrades = async () => {
        // Implement save logic calling /p5/grades
        toast.success("Nilai P5 Disimpan (Simulasi)");
    };

    const activeProjectData = projects.find(p => p.id === selectedProject);

    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Projek Penguatan Profil Pelajar Pancasila (P5)</h1>
                  <p className="text-muted-foreground">
                    Manajemen projek kokurikuler dan penilaian dimensi karakter.
                  </p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="mr-2 h-4 w-4" /> Buat Projek Baru
                </Button>
            </div>

            <Tabs defaultValue="list">
                <TabsList>
                    <TabsTrigger value="list">Daftar Projek</TabsTrigger>
                    <TabsTrigger value="assess">Input Penilaian</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4">
                     {loading ? <Loader2 className="animate-spin" /> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {projects.map(p => (
                                 <Card key={p.id} className="border-l-4 border-l-orange-500">
                                     <CardHeader>
                                         <Badge className="w-fit mb-2 bg-orange-100 text-orange-700 hover:bg-orange-200">{p.theme}</Badge>
                                         <CardTitle className="line-clamp-2">{p.title}</CardTitle>
                                         <CardDescription>Kelas {p.gradeLevel} - Semester {p.semester}</CardDescription>
                                     </CardHeader>
                                     <CardContent>
                                         <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{p.description}</p>
                                         <div className="flex flex-wrap gap-1">
                                             {(typeof p.dimensions === 'string' ? JSON.parse(p.dimensions) : p.dimensions || []).map((d:string, i:number) => (
                                                 <Badge key={i} variant="outline" className="text-[10px]">{d.split(" ")[0]}...</Badge>
                                             ))}
                                         </div>
                                     </CardContent>
                                 </Card>
                             ))}
                         </div>
                     )}
                </TabsContent>

                <TabsContent value="assess" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Input Rapor P5</CardTitle></CardHeader>
                        <CardContent>
                             <div className="mb-6 w-full md:w-1/3">
                                <Label>Pilih Projek yang Dinilai</Label>
                                <Select value={selectedProject} onValueChange={setSelectedProject}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Projek..." /></SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                             </div>

                             {activeProjectData && (
                                 <Table>
                                     <TableHeader>
                                         <TableRow>
                                             <TableHead className="w-[200px]">Nama Siswa</TableHead>
                                             {(typeof activeProjectData.dimensions === 'string' ? JSON.parse(activeProjectData.dimensions) : activeProjectData.dimensions).map((d:string, i:number) => (
                                                 <TableHead key={i} className="min-w-[150px]">{d}</TableHead>
                                             ))}
                                         </TableRow>
                                     </TableHeader>
                                     <TableBody>
                                         {students.map(s => (
                                             <TableRow key={s.id}>
                                                 <TableCell className="font-medium">{s.namaLengkap || s.nama}</TableCell>
                                                 {(typeof activeProjectData.dimensions === 'string' ? JSON.parse(activeProjectData.dimensions) : activeProjectData.dimensions).map((d:string, i:number) => (
                                                     <TableCell key={i}>
                                                         <Select>
                                                             <SelectTrigger className="h-8"><SelectValue placeholder="-" /></SelectTrigger>
                                                             <SelectContent>
                                                                 <SelectItem value="BB">Belum Berkembang (BB)</SelectItem>
                                                                 <SelectItem value="MB">Mulai Berkembang (MB)</SelectItem>
                                                                 <SelectItem value="BSH">Berkembang Sesuai Harapan (BSH)</SelectItem>
                                                                 <SelectItem value="SB">Sangat Berkembang (SB)</SelectItem>
                                                             </SelectContent>
                                                         </Select>
                                                     </TableCell>
                                                 ))}
                                             </TableRow>
                                         ))}
                                     </TableBody>
                                 </Table>
                             )}
                             
                             {activeProjectData && (
                                 <div className="mt-4 flex justify-end">
                                     <Button onClick={handleSaveGrades}><Save className="mr-2 h-4 w-4"/> Simpan Rapor P5</Button>
                                 </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Buat Projek P5 Baru</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Tema Besar</Label>
                                <Select value={newProject.theme} onValueChange={v => setNewProject({...newProject, theme: v})}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Tema" /></SelectTrigger>
                                    <SelectContent>
                                        {TEMA_P5.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Judul Projek</Label>
                                <Input value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} placeholder="Misal: Cerdik Mengelola Sampah" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Dimensi Profil Pelajar Pancasila (Target)</Label>
                            <div className="grid grid-cols-2 gap-2 border p-4 rounded-md">
                                {DIMENSI_P5.map(d => (
                                    <div key={d} className="flex items-center gap-2">
                                        <Checkbox 
                                            id={d} 
                                            checked={newProject.dimensions.includes(d)}
                                            onCheckedChange={() => toggleDimension(d)}
                                        />
                                        <label htmlFor={d} className="text-sm cursor-pointer">{d}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi Singkat</Label>
                            <Textarea value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
                        </div>
                    </div>
                     <DialogFooter>
                         <Button onClick={handleCreate}>Simpan Projek</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
