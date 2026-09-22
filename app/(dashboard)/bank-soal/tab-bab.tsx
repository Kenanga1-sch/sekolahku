"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

interface Bab {
  id: string;
  subjectId: string;
  classId?: string;
  kurikulumId?: string;
  semester?: string;
  title: string;
  description?: string;
  orderNumber: number;
  subjectName?: string;
  className?: string;
  kurikulumName?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Kurikulum {
  id: string;
  name: string;
  isActive: boolean;
}

const SEMESTER_OPTIONS = [
  { value: "ganjil", label: "Ganjil" },
  { value: "genap", label: "Genap" },
];

export default function TabBab() {
  const [babs, setBabs] = useState<Bab[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Kurikulum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterKurikulum, setFilterKurikulum] = useState("");

  const [formData, setFormData] = useState({
    subjectId: "",
    classId: "",
    kurikulumId: "",
    semester: "",
    title: "",
    description: "",
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const fetchBabs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.append("subjectId", filterSubject);
      if (filterClass) params.append("classId", filterClass);
      if (filterKurikulum) params.append("kurikulumId", filterKurikulum);

      const result: any = await goGet(`/api/bank-soal/bab?${params.toString()}`);
      setBabs(result?.data || []);
    } catch {
      showError("Gagal memuat daftar bab");
    } finally {
      setIsLoading(false);
    }
  }, [filterSubject, filterClass, filterKurikulum]);

  const fetchSubjects = async () => {
    try {
      const res: any = await goGet("/api/academic/subjects");
      setSubjects(res?.data || res || []);
    } catch { /* silent */ }
  };

  const fetchClasses = async () => {
    try {
      const res: any = await goGet("/api/academic/classes");
      setClasses(res?.data || res || []);
    } catch { /* silent */ }
  };

  const fetchKurikulum = async () => {
    try {
      const res: any = await goGet("/api/academic/kurikulum?active=true");
      setKurikulumList(res?.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
    fetchKurikulum();
  }, []);

  useEffect(() => {
    fetchBabs();
  }, [fetchBabs]);

  const handleSubmit = async () => {
    if (!formData.subjectId || !formData.title) {
      showError("Mata pelajaran dan judul wajib diisi");
      return;
    }
    setIsSaving(true);
    try {
      const body: any = {
        subjectId: formData.subjectId,
        title: formData.title,
        description: formData.description || undefined,
      };
      if (formData.classId && formData.classId !== "__none__") body.classId = formData.classId;
      if (formData.kurikulumId && formData.kurikulumId !== "__none__") body.kurikulumId = formData.kurikulumId;
      if (formData.semester && formData.semester !== "__none__") body.semester = formData.semester;

      if (editingId) {
        await goPut(`/api/bank-soal/bab/${editingId}`, body);
        showSuccess("Bab berhasil diperbarui");
      } else {
        await goPost("/api/bank-soal/bab", body);
        showSuccess("Bab berhasil dibuat");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchBabs();
    } catch {
      showError(editingId ? "Gagal memperbarui bab" : "Gagal membuat bab");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus bab ini?")) return;
    try {
      await goDelete(`/api/bank-soal/bab/${id}`);
      showSuccess("Bab berhasil dihapus");
      fetchBabs();
    } catch {
      showError("Gagal menghapus bab");
    }
  };

  // Reorder: pindahkan dragId ke posisi dropId, lalu simpan urutan baru.
  const handleDrop = async (dropId: string) => {
    if (!dragId || dragId === dropId) {
      setDragId(null);
      return;
    }
    const from = babs.findIndex((b) => b.id === dragId);
    const to = babs.findIndex((b) => b.id === dropId);
    if (from === -1 || to === -1) {
      setDragId(null);
      return;
    }
    const next = [...babs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBabs(next);
    setDragId(null);

    setIsReordering(true);
    try {
      await goPut("/api/bank-soal/bab/reorder", { orderedIds: next.map((b) => b.id) });
      showSuccess("Urutan bab disimpan");
    } catch {
      showError("Gagal menyimpan urutan bab");
      fetchBabs();
    } finally {
      setIsReordering(false);
    }
  };

  const handleEdit = (bab: Bab) => {
    setEditingId(bab.id);
    setFormData({
      subjectId: bab.subjectId,
      classId: bab.classId || "",
      kurikulumId: bab.kurikulumId || "",
      semester: bab.semester || "",
      title: bab.title,
      description: bab.description || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ subjectId: "", classId: "", kurikulumId: "", semester: "", title: "", description: "" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Daftar Bab / Chapter</h2>
          <p className="text-xs text-muted-foreground">
            Kelompokkan soal berdasarkan mata pelajaran, kelas, dan bab. Seret kartu untuk mengubah urutan.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Bab
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterKurikulum} onValueChange={setFilterKurikulum}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Semua Kurikulum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kurikulum</SelectItem>
            {kurikulumList.map((k) => (
              <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Semua Mata Pelajaran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mata Pelajaran</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Semua Kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : babs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada bab</p>
            <p className="text-xs">Klik &quot;Tambah Bab&quot; untuk mulai membuat</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {babs.map((bab) => (
            <Card
              key={bab.id}
              draggable={!isReordering}
              onDragStart={() => setDragId(bab.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(bab.id)}
              onDragEnd={() => setDragId(null)}
              className={`transition-colors ${
                dragId === bab.id ? "opacity-50 border-blue-400" : "hover:border-blue-300"
              }`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{bab.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {bab.kurikulumName && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded dark:bg-purple-900/30 dark:text-purple-400">
                        {bab.kurikulumName}
                      </span>
                    )}
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-400">
                      {bab.subjectName || "-"}
                    </span>
                    {bab.className && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded dark:bg-zinc-800 dark:text-zinc-400">
                        Kelas {bab.className}
                      </span>
                    )}
                    {bab.semester && (
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-400">
                        {bab.semester === "ganjil" ? "Ganjil" : "Genap"}
                      </span>
                    )}
                  </div>
                  {bab.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{bab.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(bab)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(bab.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Bab" : "Tambah Bab Baru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui informasi bab" : "Buat bab baru untuk mengelompokkan soal"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Mata Pelajaran *</Label>
              <Select value={formData.subjectId} onValueChange={(v) => setFormData({ ...formData, subjectId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mata Pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kelas (Opsional)</Label>
              <Select value={formData.classId} onValueChange={(v) => setFormData({ ...formData, classId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Semua Kelas</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kurikulum (Opsional)</Label>
                <Select value={formData.kurikulumId} onValueChange={(v) => setFormData({ ...formData, kurikulumId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kurikulum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tidak spesifik</SelectItem>
                    {kurikulumList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester (Opsional)</Label>
                <Select value={formData.semester} onValueChange={(v) => setFormData({ ...formData, semester: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tidak spesifik</SelectItem>
                    {SEMESTER_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Judul Bab *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Contoh: Operasi Hitung Bilangan Bulat"
              />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (Opsional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi singkat tentang bab ini"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : editingId ? "Simpan" : "Buat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
