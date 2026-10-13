"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileStack, Plus, Trash2, Eye, Pencil, ChevronUp, ChevronDown, Search, Users } from "lucide-react";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { TYPE_LABELS } from "./_components/types";
import type { QuestionBank, QuestionSet, ClassItem, SetItem, BankQuestion, ExamAssignment } from "./_components/types";
import { AssignDialog } from "./_components/assign-dialog";
import { EditDialog, type EditForm } from "./_components/edit-dialog";

// toLocalInput mengubah ISO string dari backend ke format datetime-local (waktu lokal).
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TabPaket() {
  const { settings } = useSchoolSettings();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    bankId: "",
    mode: "latihan",
    timerMinutes: "",
    maxAttempts: "",
    availableFrom: "",
    availableUntil: "",
    resultVisible: true,
    shuffleQuestions: false,
    shuffleOptions: false,
  });

  // Kelola soal
  const [managingSet, setManagingSet] = useState<QuestionSet | null>(null);
  const [items, setItems] = useState<SetItem[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  // Edit paket
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    mode: "latihan",
    timerMinutes: "",
    maxAttempts: "",
    availableFrom: "",
    availableUntil: "",
    resultVisible: true,
    shuffleQuestions: false,
    shuffleOptions: false,
  });

  // Kelas (untuk penugasan ujian)
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Dialog tugaskan kelas
  const [assigningSet, setAssigningSet] = useState<QuestionSet | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [isAssignSaving, setIsAssignSaving] = useState(false);

  const fetchSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const result: any = await goGet("/api/bank-soal/sets?limit=100");
      setSets(result?.data || []);
    } catch {
      showError("Gagal memuat paket soal");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBanks = async () => {
    try {
      const res: any = await goGet("/api/bank-soal/banks?limit=100");
      setBanks(res?.data || []);
    } catch { /* silent */ }
  };

  const fetchClasses = async () => {
    try {
      const res: any = await goGet("/api/academic/classes");
      setClasses(res?.data || res || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchBanks();
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.bankId) {
      showError("Nama paket dan bank soal wajib diisi");
      return;
    }
    setIsSaving(true);
    try {
      const body: any = {
        name: formData.name,
        bankId: formData.bankId,
        mode: formData.mode,
        resultVisible: formData.resultVisible,
        shuffleQuestions: formData.shuffleQuestions,
        shuffleOptions: formData.shuffleOptions,
        academicYear: settings?.current_academic_year || undefined,
      };
      if (formData.timerMinutes) body.timerMinutes = parseInt(formData.timerMinutes);
      if (formData.maxAttempts) body.maxAttempts = parseInt(formData.maxAttempts);
      if (formData.mode === "ujian") {
        if (formData.availableFrom) body.availableFrom = new Date(formData.availableFrom).getTime();
        if (formData.availableUntil) body.availableUntil = new Date(formData.availableUntil).getTime();
      }

      await goPost("/api/bank-soal/sets", body);
      showSuccess("Paket soal berhasil dibuat");
      setIsDialogOpen(false);
      resetForm();
      fetchSets();
    } catch {
      showError("Gagal membuat paket soal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus paket soal ini? Semua soal di dalamnya akan dilepas.")) return;
    try {
      await goDelete(`/api/bank-soal/sets/${id}`);
      showSuccess("Paket soal berhasil dihapus");
      fetchSets();
    } catch {
      showError("Gagal menghapus paket soal");
    }
  };

  // ── Kelola soal ──────────────────────────────────────────
  const openManage = async (set: QuestionSet) => {
    setManagingSet(set);
    setSelectedToAdd(new Set());
    setAddSearch("");
    setIsItemsLoading(true);
    try {
      const [itemsRes, qsRes] = await Promise.all([
        goGet(`/api/bank-soal/sets/${set.id}/items`),
        goGet(`/api/bank-soal/questions?bankId=${set.bankId}&limit=200`),
      ]);
      setItems((itemsRes as any)?.data || []);
      setBankQuestions((qsRes as any)?.data || []);
    } catch {
      showError("Gagal memuat data paket");
    } finally {
      setIsItemsLoading(false);
    }
  };

  const refreshItems = async () => {
    if (!managingSet) return;
    try {
      const res: any = await goGet(`/api/bank-soal/sets/${managingSet.id}/items`);
      setItems(res?.data || []);
    } catch { /* silent */ }
  };

  const handleRemoveItem = async (questionId: string) => {
    if (!managingSet) return;
    try {
      await goDelete(`/api/bank-soal/sets/${managingSet.id}/items/${questionId}`);
      showSuccess("Soal dikeluarkan dari paket");
      await refreshItems();
      fetchSets();
    } catch {
      showError("Gagal mengeluarkan soal");
    }
  };

  const handleMoveItem = async (idx: number, dir: -1 | 1) => {
    if (!managingSet) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map((i) => i.questionId);
    setItems(reordered); // optimistic
    try {
      await goPut(`/api/bank-soal/sets/${managingSet.id}/items/reorder`, { questionIds: orderedIds });
    } catch {
      showError("Gagal mengubah urutan");
      refreshItems();
    }
  };

  const toggleAdd = (qid: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  const handleBulkAdd = async () => {
    if (!managingSet || selectedToAdd.size === 0) {
      showError("Pilih soal yang ingin ditambahkan");
      return;
    }
    try {
      await goPost(`/api/bank-soal/sets/${managingSet.id}/items/bulk`, {
        questionIds: [...selectedToAdd],
      });
      showSuccess(`${selectedToAdd.size} soal ditambahkan ke paket`);
      setSelectedToAdd(new Set());
      await refreshItems();
      fetchSets();
    } catch {
      showError("Gagal menambahkan soal");
    }
  };

  // ── Edit paket ───────────────────────────────────────────
  const openEdit = (set: QuestionSet) => {
    setEditingSet(set);
    setEditForm({
      name: set.name,
      mode: set.mode || "latihan",
      timerMinutes: set.timerMinutes ? String(set.timerMinutes) : "",
      maxAttempts: set.maxAttempts ? String(set.maxAttempts) : "",
      availableFrom: toLocalInput(set.availableFrom),
      availableUntil: toLocalInput(set.availableUntil),
      resultVisible: set.resultVisible !== false,
      shuffleQuestions: set.shuffleQuestions,
      shuffleOptions: set.shuffleOptions,
    });
  };

  const handleEditSubmit = async () => {
    if (!editingSet) return;
    if (!editForm.name.trim()) {
      showError("Nama paket wajib diisi");
      return;
    }
    const body: any = { name: editForm.name.trim(), mode: editForm.mode, resultVisible: editForm.resultVisible };
    body.timerMinutes = editForm.timerMinutes ? parseInt(editForm.timerMinutes) : 0;
    body.maxAttempts = editForm.maxAttempts ? parseInt(editForm.maxAttempts) : 0;
    if (editForm.mode === "ujian") {
      body.availableFrom = editForm.availableFrom ? new Date(editForm.availableFrom).getTime() : 0;
      body.availableUntil = editForm.availableUntil ? new Date(editForm.availableUntil).getTime() : 0;
    }
    body.shuffleQuestions = editForm.shuffleQuestions;
    body.shuffleOptions = editForm.shuffleOptions;
    try {
      await goPut(`/api/bank-soal/sets/${editingSet.id}`, body);
      showSuccess("Paket soal berhasil diperbarui");
      setEditingSet(null);
      fetchSets();
    } catch {
      showError("Gagal memperbarui paket");
    }
  };

  // ── Tugaskan kelas ───────────────────────────────────────
  const openAssign = async (set: QuestionSet) => {
    setAssigningSet(set);
    setAssignSelected(new Set());
    try {
      const res: any = await goGet(`/api/bank-soal/sets/${set.id}/assignments`);
      const assigned = (res?.data || []) as ExamAssignment[];
      setAssignSelected(new Set(assigned.map((a) => a.classId)));
    } catch { /* silent */ }
  };

  const toggleAssign = (classId: string) => {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleAssignSave = async () => {
    if (!assigningSet) return;
    setIsAssignSaving(true);
    try {
      await goPut(`/api/bank-soal/sets/${assigningSet.id}/assignments`, {
        classIds: [...assignSelected],
      });
      showSuccess("Penugasan kelas disimpan");
      setAssigningSet(null);
      fetchSets();
    } catch {
      showError("Gagal menyimpan penugasan");
    } finally {
      setIsAssignSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      bankId: "",
      mode: "latihan",
      timerMinutes: "",
      maxAttempts: "",
      availableFrom: "",
      availableUntil: "",
      resultVisible: true,
      shuffleQuestions: false,
      shuffleOptions: false,
    });
  };

  // Soal di bank yang belum ada di paket (difilter search)
  const existingIds = new Set(items.map((i) => i.questionId));
  const availableQuestions = bankQuestions.filter((q) => !existingIds.has(q.id));
  const filteredAvailable = addSearch
    ? availableQuestions.filter((q) => q.content.toLowerCase().includes(addSearch.toLowerCase()))
    : availableQuestions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Paket Soal</h2>
          <p className="text-xs text-muted-foreground">
            Susun soal dari bank soal menjadi paket untuk latihan atau ujian
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Paket
        </Button>
      </div>

      {/* Sets List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileStack className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada paket soal</p>
            <p className="text-xs">Klik &quot;Buat Paket&quot; untuk mulai menyusun</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <Card key={set.id} className="hover:border-blue-300 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{set.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {set.bankTitle || "Bank Soal"}
                    </p>
                  </div>
                  <Badge variant="outline">{set.itemCount || 0} soal</Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {set.mode === "ujian" ? (
                    <Badge className="bg-red-100 text-red-700">Ujian</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700">Latihan</Badge>
                  )}
                  {set.mode === "ujian" && set.assignedClasses && set.assignedClasses.length > 0 && (
                    <Badge className="bg-sky-100 text-sky-700">
                      {set.assignedClasses.length} kelas
                    </Badge>
                  )}
                  {set.mode === "ujian" && !set.resultVisible && (
                    <Badge className="bg-zinc-200 text-zinc-700">Hasil disembunyikan</Badge>
                  )}
                  {set.maxAttempts ? (
                    <Badge className="bg-orange-100 text-orange-700">Maks {set.maxAttempts}x</Badge>
                  ) : null}
                  {set.shuffleQuestions && (
                    <Badge className="bg-purple-100 text-purple-700">Acak Soal</Badge>
                  )}
                  {set.shuffleOptions && (
                    <Badge className="bg-indigo-100 text-indigo-700">Acak Jawaban</Badge>
                  )}
                  {set.timerMinutes && (
                    <Badge className="bg-amber-100 text-amber-700">{set.timerMinutes} menit</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openManage(set)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Kelola Soal
                  </Button>
                  {set.mode === "ujian" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssign(set)}
                      title="Tugaskan ke kelas"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(set)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(set.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Buat Paket */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Paket Soal Baru</DialogTitle>
            <DialogDescription>
              Pilih bank soal dan atur pengaturan paket
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Paket *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Ulangan Tengah Semester 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Soal *</Label>
              <Select value={formData.bankId} onValueChange={(v) => setFormData({ ...formData, bankId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Bank Soal" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode Paket</Label>
              <Select value={formData.mode} onValueChange={(v) => setFormData({ ...formData, mode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latihan">Latihan (bebas untuk semua siswa)</SelectItem>
                  <SelectItem value="ujian">Ujian (ditugaskan ke kelas, terjadwal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Batas Waktu (Menit, Opsional)</Label>
              <Input
                type="number"
                min="0"
                value={formData.timerMinutes}
                onChange={(e) => setFormData({ ...formData, timerMinutes: e.target.value })}
                placeholder="Kosongkan untuk tanpa batas waktu"
              />
            </div>

            {formData.mode === "ujian" && (
              <>
                <div className="space-y-2">
                  <Label>Maks Percobaan (Opsional)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxAttempts}
                    onChange={(e) => setFormData({ ...formData, maxAttempts: e.target.value })}
                    placeholder="Kosongkan untuk tak terbatas"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mulai (Opsional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.availableFrom}
                      onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Selesai (Opsional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => setFormData({ ...formData, availableUntil: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Tampilkan Hasil ke Siswa</p>
                    <p className="text-xs text-muted-foreground">Jika nonaktif, siswa tidak melihat skor</p>
                  </div>
                  <Switch
                    checked={formData.resultVisible}
                    onCheckedChange={(v) => setFormData({ ...formData, resultVisible: v })}
                  />
                </div>
              </>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Acak Urutan Soal</p>
                  <p className="text-xs text-muted-foreground">Setiap siswa mendapat urutan soal berbeda</p>
                </div>
                <Switch
                  checked={formData.shuffleQuestions}
                  onCheckedChange={(v) => setFormData({ ...formData, shuffleQuestions: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Acak Pilihan Jawaban</p>
                  <p className="text-xs text-muted-foreground">Urutan opsi jawaban diacak</p>
                </div>
                <Switch
                  checked={formData.shuffleOptions}
                  onCheckedChange={(v) => setFormData({ ...formData, shuffleOptions: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Buat Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelola Soal */}
      <Dialog open={!!managingSet} onOpenChange={(open) => { if (!open) setManagingSet(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Soal: {managingSet?.name}</DialogTitle>
            <DialogDescription>
              {managingSet?.bankTitle || "Bank Soal"} — tambah, urutkan, atau keluarkan soal dari paket
            </DialogDescription>
          </DialogHeader>

          {isItemsLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Soal saat ini */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Soal di Paket ({items.length})</Label>
                  {items.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">Gunakan ↑ ↓ untuk mengatur urutan</span>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center bg-slate-50 dark:bg-zinc-900 rounded-lg">
                    Belum ada soal di paket ini. Pilih dari daftar di bawah.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-white dark:bg-zinc-950"
                      >
                        <span className="font-bold text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-1">{item.question?.content || "Soal tidak ditemukan"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">
                              {TYPE_LABELS[item.question?.type || ""] || item.question?.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{item.question?.points || 0} poin</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, -1)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={idx === items.length - 1}
                            onClick={() => handleMoveItem(idx, 1)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveItem(item.questionId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tambah soal dari bank */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between gap-2">
                  <Label>Soal di Bank ({availableQuestions.length} tersedia)</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        placeholder="Cari soal..."
                        className="h-8 w-48 pl-8 text-xs"
                      />
                    </div>
                    <Button size="sm" onClick={handleBulkAdd} disabled={selectedToAdd.size === 0}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah {selectedToAdd.size > 0 ? `(${selectedToAdd.size})` : ""}
                    </Button>
                  </div>
                </div>
                {filteredAvailable.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center bg-slate-50 dark:bg-zinc-900 rounded-lg">
                    {availableQuestions.length === 0 ? "Semua soal di bank sudah ada di paket" : "Tidak ada soal cocok"}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {filteredAvailable.map((q) => {
                      const isSelected = selectedToAdd.has(q.id);
                      return (
                        <div
                          key={q.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300" : "hover:bg-slate-50 dark:hover:bg-zinc-900"
                          }`}
                          onClick={() => toggleAdd(q.id)}
                        >
                          <Checkbox checked={isSelected} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-1">{q.content}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px]">
                                {TYPE_LABELS[q.type] || q.type}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{q.points} poin</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tugaskan Kelas */}
      <AssignDialog
        assigningSet={assigningSet}
        classes={classes}
        assignSelected={assignSelected}
        isAssignSaving={isAssignSaving}
        onToggle={toggleAssign}
        onSave={handleAssignSave}
        onClose={() => setAssigningSet(null)}
      />

      {/* Dialog Edit Paket */}
      <EditDialog
        editingSet={editingSet}
        editForm={editForm}
        onChange={setEditForm}
        onSave={handleEditSubmit}
        onClose={() => setEditingSet(null)}
      />
    </div>
  );
}
