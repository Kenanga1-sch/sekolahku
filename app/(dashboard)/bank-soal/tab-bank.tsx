"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { FolderOpen, Plus, Trash2, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { goGet, goPost, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

interface QuestionBank {
  id: string;
  title: string;
  subjectName?: string;
  className?: string;
  kurikulumName?: string;
  semester?: string;
  questionCount?: number;
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

interface Bab {
  id: string;
  subjectId: string;
  title: string;
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

export default function TabBank() {
  const router = useRouter();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [babs, setBabs] = useState<Bab[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Kurikulum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    subjectId: "",
    babId: "",
    classId: "",
    kurikulumId: "",
    semester: "",
    title: "",
    description: "",
  });

  const fetchBanks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await goGet("/api/bank-soal/banks?limit=100");
      setBanks(res?.data || []);
    } catch {
      showError("Gagal memuat daftar bank soal");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSubjects = async () => {
    try {
      const res: any = await goGet("/api/academic/subjects");
      setSubjects(res?.data || res || []);
    } catch {
      /* silent */
    }
  };

  const fetchClasses = async () => {
    try {
      const res: any = await goGet("/api/academic/classes");
      setClasses(res?.data || res || []);
    } catch {
      /* silent */
    }
  };

  const fetchBabs = async () => {
    try {
      const res: any = await goGet("/api/bank-soal/bab?limit=100");
      setBabs(res?.data || []);
    } catch {
      /* silent */
    }
  };

  const fetchKurikulum = async () => {
    try {
      const res: any = await goGet("/api/academic/kurikulum?active=true");
      setKurikulumList(res?.data || []);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
    fetchBabs();
    fetchKurikulum();
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // Bab dropdown difilter berdasarkan mapel yang dipilih
  const filteredBabs = babs.filter((b) => !formData.subjectId || b.subjectId === formData.subjectId);

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
      };
      if (formData.babId) body.babId = formData.babId;
      if (formData.classId) body.classId = formData.classId;
      if (formData.kurikulumId) body.kurikulumId = formData.kurikulumId;
      if (formData.semester) body.semester = formData.semester;
      if (formData.description) body.description = formData.description;

      await goPost("/api/bank-soal/banks", body);
      showSuccess("Bank soal berhasil dibuat");
      setIsDialogOpen(false);
      resetForm();
      fetchBanks();
    } catch {
      showError("Gagal membuat bank soal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string, count: number) => {
    const msg =
      count > 0
        ? `Bank soal "${title}" berisi ${count} soal. Yakin ingin menghapusnya?`
        : `Yakin ingin menghapus bank soal "${title}"?`;
    if (!confirm(msg)) return;
    try {
      await goDelete(`/api/bank-soal/banks/${id}`);
      showSuccess("Bank soal berhasil dihapus");
      fetchBanks();
    } catch {
      showError("Gagal menghapus bank soal");
    }
  };

  const resetForm = () => {
    setFormData({
      subjectId: "",
      babId: "",
      classId: "",
      kurikulumId: "",
      semester: "",
      title: "",
      description: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Bank Soal</h2>
          <p className="text-xs text-muted-foreground">
            Wadah kumpulan soal per mata pelajaran. Soal harus dimasukkan ke bank sebelum disusun
            jadi paket.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Bank Soal
        </Button>
      </div>

      {/* Banks List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : banks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada bank soal</p>
            <p className="text-xs">Klik &quot;Buat Bank Soal&quot; untuk mulai</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => (
            <Card key={bank.id} className="hover:border-blue-300 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{bank.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {bank.subjectName || "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {bank.questionCount || 0} soal
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {bank.className && (
                    <Badge className="bg-blue-100 text-blue-700">{bank.className}</Badge>
                  )}
                  {bank.kurikulumName && (
                    <Badge className="bg-emerald-100 text-emerald-700">{bank.kurikulumName}</Badge>
                  )}
                  {bank.semester && (
                    <Badge className="bg-amber-100 text-amber-700">
                      {bank.semester === "ganjil" ? "Sem. Ganjil" : "Sem. Genap"}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      router.push(`/bank-soal/soal/baru?bankId=${bank.id}`)
                    }
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Tambah Soal
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(bank.id, bank.title, bank.questionCount || 0)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Bank Soal Baru</DialogTitle>
            <DialogDescription>
              Bank soal adalah wadah untuk mengelompokkan soal per mata pelajaran
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Mata Pelajaran *</Label>
              <Select
                value={formData.subjectId}
                onValueChange={(v) => setFormData({ ...formData, subjectId: v, babId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mata Pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bab / Topik (Opsional)</Label>
              <Select
                value={formData.babId}
                onValueChange={(v) => setFormData({ ...formData, babId: v })}
                disabled={!formData.subjectId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formData.subjectId ? "Pilih Bab" : "Pilih mapel dulu untuk melihat bab"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredBabs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kelas (Opsional)</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(v) => setFormData({ ...formData, classId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester (Opsional)</Label>
                <Select
                  value={formData.semester}
                  onValueChange={(v) => setFormData({ ...formData, semester: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kurikulum (Opsional)</Label>
              <Select
                value={formData.kurikulumId}
                onValueChange={(v) => setFormData({ ...formData, kurikulumId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kurikulum" />
                </SelectTrigger>
                <SelectContent>
                  {kurikulumList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Judul Bank Soal *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Contoh: Soal Latihan Bab 1 — Bilangan"
              />
            </div>

            <div className="space-y-2">
              <Label>Deskripsi (Opsional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Keterangan singkat tentang bank soal ini"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Buat Bank Soal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
