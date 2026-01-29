"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, BookOpen, Target, ArrowRight, Loader2, Save, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KKO_BLOOM } from "@/lib/constants/kko";

export default function PerencanaanPage() {
  // Force rebuild for hydration sync
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("cp");
  const [loading, setLoading] = useState(false);
  
  // CP State
  const [cpList, setCpList] = useState<any[]>([]);
  const [cpFilter, setCpFilter] = useState({ fase: "A", subject: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");

  // Derive unique subjects from the fetched list
  const uniqueSubjects = Array.from(new Set(cpList.map(item => item.subject))).sort();

  // Filter logic
  const filteredCps = cpList.filter(cp => {
      const matchSubject = selectedSubject === "all" || cp.subject === selectedSubject;
      const matchSearch = cp.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cp.element.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cp.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSubject && matchSearch;
  });
  
  // TP State
  const [tpList, setTpList] = useState<any[]>([]);
  const [isTpDialogOpen, setIsTpDialogOpen] = useState(false);
  const [newTp, setNewTp] = useState({
     cpId: "",
     code: "",
     content: "",
     semester: "1",
     gradeLevel: "1",
     subject: ""
  });

  // --- Fetchers ---

  const fetchCP = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cpFilter.fase) params.set("fase", cpFilter.fase);
      // if (cpFilter.subject) params.set("subject", cpFilter.subject);
      
      const res = await fetch(`/api/kurikulum/cp?${params.toString()}`);
      const json = await res.json();
      if (json.success) setCpList(json.data);
    } catch (err) {
      toast.error("Gagal memuat CP");
    } finally {
      setLoading(false);
    }
  };

  const fetchTP = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/kurikulum/tp?teacherId=${user.id}`);
      const json = await res.json();
      if (json.success) setTpList(json.data);
    } catch (err) {
      toast.error("Gagal memuat TP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "cp") fetchCP();
    if (activeTab === "tp") fetchTP();
  }, [activeTab, cpFilter.fase, user?.id]);

  // --- Actions ---

  const handleSeedCP = async () => {
     setLoading(true);
     try {
         const res = await fetch("/api/kurikulum/seed", {
             method: "POST"
         });
         const json = await res.json();
         
         if (json.success) {
            toast.success(`Berhasil import ${json.count} data CP Resmi`);
            fetchCP();
         } else {
            throw new Error(json.error);
         }
     } catch (e) {
         toast.error("Gagal import data CP");
     } finally {
         setLoading(false);
     }
  };

  const [editingTpId, setEditingTpId] = useState<string | null>(null);

  // ... (fetchers)
  
  // Handlers
  const handleEditTP = (tp: any) => {
      setNewTp({
          cpId: tp.cpId,
          code: tp.code,
          content: tp.content,
          semester: String(tp.semester),
          gradeLevel: String(tp.gradeLevel),
          subject: tp.subject
      });
      setEditingTpId(tp.id);
      setIsTpDialogOpen(true);
  };

  const handleDeleteTP = async (id: string) => {
      if (!confirm("Yakin hapus TP ini? Data di rapor mungkin akan hilang.")) return;
      try {
          await fetch(`/api/kurikulum/tp?id=${id}`, { method: "DELETE" });
          toast.success("TP dihapus");
          fetchTP();
      } catch (e) {
          toast.error("Gagal hapus TP");
      }
  };

  const handleSaveTP = async () => {
      if (!user?.id) return;
      
      try {
          const payload = {
              ...newTp,
              semester: parseInt(newTp.semester),
              gradeLevel: parseInt(newTp.gradeLevel),
              teacherId: user.id,
              subject: newTp.subject || "Umum" 
          };
          
          if (editingTpId) {
             // Update Mode
             await fetch("/api/kurikulum/tp", {
                 method: "PATCH",
                 body: JSON.stringify({ ...payload, id: editingTpId })
             });
             toast.success("TP diperbarui");
          } else {
             // Create Mode
             const res = await fetch("/api/kurikulum/tp", {
                method: "POST",
                body: JSON.stringify(payload)
             });
             if (!res.ok) throw new Error("Failed");
             toast.success("Tujuan Pembelajaran disimpan");
          }

          setIsTpDialogOpen(false);
          setEditingTpId(null);
          fetchTP();
          
          // Reset form only if create mode or finished edit
          if (!editingTpId) {
             setNewTp({ ...newTp, code: `TP.${parseInt(newTp.code.split('.')[1] || "0") + 1}`, content: "" });
          }
      } catch (e) {
          toast.error("Gagal menyimpan TP");
      }
  };

  const handleCopyCPtoTP = (cp: any) => {
      setNewTp({
          ...newTp,
          cpId: cp.id,
          subject: cp.subject,
          content: cp.content, 
          code: "TP.1.1"
      });
      setEditingTpId(null);
      setActiveTab("tp");
      setIsTpDialogOpen(true);
  };
   
  const openCreateDialog = () => {
      setEditingTpId(null);
      setNewTp({
         cpId: "",
         code: "TP.1.1",
         content: "",
         semester: "1",
         gradeLevel: "1",
         subject: ""
      });
      setIsTpDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perencanaan Pembelajaran</h1>
          <p className="text-muted-foreground">
            Kelola Capaian Pembelajaran (CP) dan turunkan menjadi Tujuan Pembelajaran (TP).
          </p>
        </div>
        
        {activeTab === "tp" && (
           <Button onClick={openCreateDialog}>
             <Plus className="mr-2 h-4 w-4" /> Susun TP Baru
           </Button>
        )}
      </div>

      {/* TP Dialog */}
      <Dialog open={isTpDialogOpen} onOpenChange={setIsTpDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>{editingTpId ? "Edit Tujuan Pembelajaran" : "Susun Tujuan Pembelajaran"}</DialogTitle>
                <DialogDescription>Turunkan CP menjadi tujuan pembelajaran yang lebih spesifik.</DialogDescription>
            </DialogHeader>
            {/* ... form inputs ... */}
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Mapel</Label>
                        <Input 
                            value={newTp.subject} 
                            onChange={e => setNewTp({...newTp, subject: e.target.value})}
                            placeholder="Contoh: Matematika"
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Kode TP</Label>
                        <Input 
                            value={newTp.code} 
                            onChange={e => setNewTp({...newTp, code: e.target.value})}
                            placeholder="Contoh: TP.1.1"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Semester</Label>
                        <Select value={newTp.semester} onValueChange={v => setNewTp({...newTp, semester: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Semester 1</SelectItem>
                                <SelectItem value="2">Semester 2</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>Kelas</Label>
                        <Select value={newTp.gradeLevel} onValueChange={v => setNewTp({...newTp, gradeLevel: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Kelas 1</SelectItem>
                                <SelectItem value="2">Kelas 2</SelectItem>
                                <SelectItem value="3">Kelas 3</SelectItem>
                                <SelectItem value="4">Kelas 4</SelectItem>
                                <SelectItem value="5">Kelas 5</SelectItem>
                                <SelectItem value="6">Kelas 6</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label>Isi Tujuan Pembelajaran</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600">
                                    <BookOpen className="mr-1 h-3 w-3" /> Bantu Pilih KKO
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="end">
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-900 border-b font-medium text-xs text-center text-muted-foreground">
                                    Pilih Kata Kerja Operasional (Taksonomi Bloom)
                                </div>
                                <div className="h-[300px] overflow-y-auto p-2 space-y-4">
                                    {KKO_BLOOM.map((k) => (
                                        <div key={k.level}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Badge variant="outline" className="text-[10px] h-5">{k.level}</Badge>
                                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{k.title}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {k.verbs.map(v => (
                                                    <button 
                                                        key={v}
                                                        className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition"
                                                        onClick={() => setNewTp({...newTp, content: newTp.content + (newTp.content ? " " : "") + v + " "})}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Textarea 
                        className="h-32" 
                        placeholder="Contoh: Peserta didik mampu menjelaskan..." 
                        value={newTp.content}
                        onChange={e => setNewTp({...newTp, content: e.target.value})}
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Klik tombol bantuan KKO untuk menyisipkan kata kerja operasional yang tepat.
                    </p>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsTpDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSaveTP}>Simpan TP</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[800px] grid-cols-4">
          <TabsTrigger value="cp">Bank CP (Pusat)</TabsTrigger>
          <TabsTrigger value="tp">TP Saya</TabsTrigger>
          <TabsTrigger value="atp">Penyusunan ATP</TabsTrigger>
          <TabsTrigger value="modul">Modul Ajar</TabsTrigger>
        </TabsList>

        {/* TAB 1: BANK CP */}
        <TabsContent value="cp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bank Capaian Pembelajaran</CardTitle>
                    <CardDescription>
                        Referensi CP resmi dari Kemendikbudristek per Fase dan Mata Pelajaran.
                    </CardDescription>
                  </div>
                   <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSeedCP}>
                         + Import CP Kemendikbud
                      </Button>
                   </div>
              </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                  <div className="flex gap-2 w-full md:w-auto">
                      <div className="w-[150px]">
                          <Select value={cpFilter.fase} onValueChange={(v) => {
                              setCpFilter({...cpFilter, fase: v});
                              setSelectedSubject("all"); // Reset subject on fase change
                          }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Fase" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A">Fase A (Kls 1-2)</SelectItem>
                                <SelectItem value="B">Fase B (Kls 3-4)</SelectItem>
                                <SelectItem value="C">Fase C (Kls 5-6)</SelectItem>
                            </SelectContent>
                          </Select>
                      </div>
                      <div className="w-[180px]">
                           <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semua Mapel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Mapel</SelectItem>
                                    {uniqueSubjects.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                           </Select>
                      </div>
                  </div>
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari elemen atau kata kunci..." 
                        className="pl-9" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
               </div>

               {loading ? (
                   <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
                       <Loader2 className="h-8 w-8 animate-spin mb-2" />
                       Loading CP...
                   </div>
               ) : filteredCps.length === 0 ? (
                   <div className="rounded-md border p-8 text-center text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50">
                      <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Tidak ada data CP yang sesuai filter.</p>
                   </div>
               ) : (
                   <div className="space-y-4">
                       {filteredCps.map((cp) => (
                           <div key={cp.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition">
                               <div className="flex justify-between items-start mb-2">
                                   <div className="flex gap-2">
                                       <Badge>{cp.subject}</Badge>
                                       <Badge variant="outline">{cp.element}</Badge>
                                   </div>
                                   <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => handleCopyCPtoTP(cp)}>
                                       <Target className="mr-2 h-3 w-3" /> Buat TP
                                   </Button>
                               </div>
                               <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                                   {cp.content}
                               </p>
                           </div>
                       ))}
                   </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: TEACHER TP */}
        <TabsContent value="tp" className="space-y-4">
           {/* ... existing TP content ... */}
           <Card>
            <CardHeader>
              <CardTitle>Tujuan Pembelajaran Saya</CardTitle>
              <CardDescription>
                Daftar TP yang sudah Anda turunkan dari CP untuk kelas Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                   <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
                       <Loader2 className="h-8 w-8 animate-spin mb-2" />
                       Loading TP...
                   </div>
               ) : tpList.length === 0 ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50">
                  <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Anda belum menyusun Tujuan Pembelajaran.</p>
                  <Button className="mt-4" onClick={() => setIsTpDialogOpen(true)}>
                     Mulai Menyusun TP <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
               </div>
               ) : (
                   <div className="rounded-md border">
                       <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b font-medium text-sm grid grid-cols-12 gap-2 text-muted-foreground">
                           <div className="col-span-2">Kode</div>
                           <div className="col-span-2">Mapel</div>
                           <div className="col-span-1">Kls</div>
                           <div className="col-span-1">Sem</div>
                           <div className="col-span-5">Konten Tujuan Pembelajaran</div>
                           <div className="col-span-1 text-right">Aksi</div>
                       </div>
                       <div>
                           {tpList.map((tp) => (
                               <div key={tp.id} className="p-4 border-b last:border-0 grid grid-cols-12 gap-2 text-sm items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                   <div className="col-span-2 font-mono font-bold text-blue-600">{tp.code}</div>
                                   <div className="col-span-2">{tp.subject}</div>
                                   <div className="col-span-1 text-center"><Badge variant="outline">{tp.gradeLevel}</Badge></div>
                                   <div className="col-span-1 text-center"><Badge variant="secondary">{tp.semester}</Badge></div>
                                   <div className="col-span-5 text-zinc-600 dark:text-zinc-300">{tp.content}</div>
                                   <div className="col-span-1 flex justify-end gap-1">
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-blue-600" onClick={() => handleEditTP(tp)}>
                                           <Pencil className="h-4 w-4" />
                                       </Button>
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-600" onClick={() => handleDeleteTP(tp.id)}>
                                           <Trash2 className="h-4 w-4" />
                                       </Button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: VISUAL ATP */}
        <TabsContent value="atp" className="space-y-4">
             <AtpVisualPlanner tpList={tpList} onUpdate={fetchTP} />
        </TabsContent>

        {/* TAB 4: MODUL AJAR */}
        <TabsContent value="modul" className="space-y-4">
           <ModuleListCard user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AtpVisualPlanner({ tpList, onUpdate }: { tpList: any[], onUpdate: () => void }) {
    const [selectedGrade, setSelectedGrade] = useState("all");

    // Filter by grade
    const filtered = selectedGrade === "all" ? tpList : tpList.filter(t => String(t.gradeLevel) === selectedGrade);
    const sem1 = filtered.filter(t => String(t.semester) === "1").sort((a,b) => a.code.localeCompare(b.code));
    const sem2 = filtered.filter(t => String(t.semester) === "2").sort((a,b) => a.code.localeCompare(b.code));

    const moveTp = async (tp: any, targetSem: string) => {
        try {
            await fetch('/api/kurikulum/tp', {
                method: 'PATCH',
                body: JSON.stringify({ id: tp.id, semester: parseInt(targetSem) }) 
            });
            toast.success(`TP dipindahkan ke Semester ${targetSem}`);
            onUpdate();
        } catch (e) {
            toast.error("Gagal memindahkan TP");
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Alur Tujuan Pembelajaran (ATP)</CardTitle>
                        <CardDescription>Visualisasi sebaran TP per semester.</CardDescription>
                    </div>
                    <div className="w-[180px]">
                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                             <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="all">Semua Kelas</SelectItem>
                                {[1,2,3,4,5,6].map(i => <SelectItem key={i} value={i.toString()}>Kelas {i}</SelectItem>)}
                             </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SEMESTER 1 COL */}
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Badge variant="secondary">Semester 1</Badge>
                                <span className="text-muted-foreground text-xs">({sem1.length} TP)</span>
                            </h3>
                        </div>
                        <div className="space-y-2 min-h-[200px]">
                            {sem1.length === 0 && <p className="text-center text-xs text-muted-foreground py-10">Kosong</p>}
                            {sem1.map(tp => (
                                <div key={tp.id} className="bg-white dark:bg-zinc-950 p-3 rounded shadow-sm border text-sm flex gap-3 group">
                                     <div className="font-mono font-bold text-xs text-blue-600 mt-1">{tp.code}</div>
                                     <div className="flex-1">
                                         <p className="line-clamp-2 text-xs mb-1">{tp.content}</p>
                                         <Badge variant="outline" className="text-[9px] h-4">{tp.subject}</Badge>
                                     </div>
                                     <Button 
                                        size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity self-center"
                                        onClick={() => moveTp(tp, "2")}
                                        title="Pindah ke Sem 2"
                                     >
                                         <ArrowRight className="h-3 w-3" />
                                     </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SEMESTER 2 COL */}
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Badge variant="secondary">Semester 2</Badge>
                                <span className="text-muted-foreground text-xs">({sem2.length} TP)</span>
                            </h3>
                        </div>
                        <div className="space-y-2 min-h-[200px]">
                            {sem2.length === 0 && <p className="text-center text-xs text-muted-foreground py-10">Kosong</p>}
                            {sem2.map(tp => (
                                <div key={tp.id} className="bg-white dark:bg-zinc-950 p-3 rounded shadow-sm border text-sm flex gap-3 group">
                                     <Button 
                                        size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity self-center"
                                        onClick={() => moveTp(tp, "1")}
                                        title="Pindah ke Sem 1"
                                     >
                                         <ArrowRight className="h-3 w-3 rotate-180" />
                                     </Button>
                                     <div className="flex-1">
                                         <div className="flex justify-between">
                                             <div className="font-mono font-bold text-xs text-blue-600 mb-1">{tp.code}</div>
                                         </div>
                                         <p className="line-clamp-2 text-xs mb-1">{tp.content}</p>
                                          <Badge variant="outline" className="text-[9px] h-4">{tp.subject}</Badge>
                                     </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Sub-component for Module List to keep code clean
function ModuleListCard({ user }: { user: any }) {
    const [modules, setModules] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const fetchModules = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/kurikulum/modules?teacherId=${user.id}`);
            const json = await res.json();
            if (json.success) setModules(json.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModules();
    }, [user?.id]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Modul Ajar Digital</CardTitle>
                        <CardDescription>Rencana pelaksanaan pembelajaran (RPP) berbasis TP.</CardDescription>
                    </div>
                    <Button onClick={() => window.location.href = "/admin/kurikulum/perencanaan/modul-editor"}>
                        <NotebookPen className="mr-2 h-4 w-4" /> Buat Modul Baru
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                   <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> 
                ) : modules.length === 0 ? (
                   <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
                       <NotebookPen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                       <p>Belum ada modul ajar.</p>
                   </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {modules.map(m => (
                            <Card key={m.id} className="hover:shadow-md transition cursor-pointer" onClick={() => window.location.href = `/admin/kurikulum/perencanaan/modul-editor?id=${m.id}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="mb-2">{m.tpCode}</Badge>
                                        <Badge className={m.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-zinc-500'}>{m.status}</Badge>
                                    </div>
                                    <CardTitle className="text-base line-clamp-1">{m.topic}</CardTitle>
                                    <CardDescription>{m.subject} - Kelas {m.grade}</CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Add NotebookPen to imports at the top
