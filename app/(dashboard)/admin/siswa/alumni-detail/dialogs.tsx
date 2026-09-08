"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import type { ColumnDef, SavedTemplate } from "./use-alumni-detail";
import type { AlumniTranscript, AlumniAttendanceSummary, AlumniAchievement, AlumniExtracurricular, AlumniHealthRecord } from "./types-alumni";

// --- Columns Dialog ---
interface ColumnsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: ColumnDef[];
  newColLabel: string;
  onNewColLabelChange: (v: string) => void;
  onToggleStandard: (key: string, label: string) => void;
  onAddCustom: () => void;
  onRemove: (key: string) => void;
}

export function ColumnsDialog({ open, onOpenChange, columns, newColLabel, onNewColLabelChange, onToggleStandard, onAddCustom, onRemove }: ColumnsDialogProps) {
  const standardCols = [
    { key: "subjectCode", label: "Kode MP" },
    { key: "scoreLetter", label: "Nilai Huruf" },
    { key: "notes", label: "Catatan" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kelola Kolom Spreadsheet</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kolom Standar</h4>
            <div className="space-y-2">
              {standardCols.map(col => {
                const isActive = columns.some(c => c.key === col.key);
                return (
                  <label key={col.key} className="flex items-center gap-2 text-sm font-medium cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                    <input type="checkbox" checked={isActive} onChange={() => onToggleStandard(col.key, col.label)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span>Tampilkan Kolom &quot;{col.label}&quot;</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kolom Kustom</h4>
            <div className="space-y-2">
              {columns.filter(col => col.isCustom).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Belum ada kolom kustom yang ditambahkan.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {columns.filter(col => col.isCustom).map(col => (
                    <Badge key={col.key} variant="secondary" className="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5 font-medium text-xs">
                      {col.label}
                      <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => onRemove(col.key)}><Trash2 className="h-3 w-3" /></Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Input placeholder="Nama kolom (misal: KKM, Bobot)" value={newColLabel} onChange={e => onNewColLabelChange(e.target.value)} className="h-9" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddCustom(); } }} />
              <Button size="sm" onClick={onAddCustom} className="h-9 shrink-0">Tambah</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Templates Dialog ---
interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: SavedTemplate[];
  newTemplateName: string;
  onNewTemplateNameChange: (v: string) => void;
  onSave: () => void;
  onLoad: (t: SavedTemplate) => void;
  onDelete: (id: string) => void;
}

export function TemplatesDialog({ open, onOpenChange, templates, newTemplateName, onNewTemplateNameChange, onSave, onLoad, onDelete }: TemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kelola Template Mapel</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Simpan Layout &amp; Mapel Saat Ini</h4>
            <div className="flex gap-2">
              <Input placeholder="Nama template (misal: KTSP Kelas 4)" value={newTemplateName} onChange={e => onNewTemplateNameChange(e.target.value)} className="h-9" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }} />
              <Button size="sm" onClick={onSave} className="h-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-0">Simpan</Button>
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daftar Template Tersimpan</h4>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">Belum ada template kustom disimpan di browser ini.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-950/20 hover:bg-slate-50 dark:hover:bg-zinc-950/40 transition-colors">
                    <div className="space-y-0.5 cursor-pointer flex-1" onClick={() => onLoad(t)}>
                      <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground">{t.subjects.length} Mapel &bull; {t.columns.length} Kolom</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Shared Form Actions ---
function DialogActions({ onCancel, submitting }: { onCancel: () => void; submitting: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
      <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button>
    </div>
  );
}

// --- Transcript Dialog ---
interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  editing: AlumniTranscript | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function TranscriptDialog({ open, onOpenChange, mode, editing, submitting, onSubmit }: TranscriptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "add" ? "Tambah Transkrip Nilai" : "Ubah Transkrip Nilai"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="academicYear">Tahun Ajaran *</Label><Input id="academicYear" name="academicYear" placeholder="Contoh: 2025/2026" defaultValue={editing?.academicYear || ""} required /></div>
            <div className="space-y-2"><Label htmlFor="semester">Semester *</Label>
              <Select name="semester" defaultValue={editing?.semester || "Ganjil"}>
                <SelectTrigger id="semester"><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                <SelectContent><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="subjectName">Nama Mata Pelajaran *</Label><Input id="subjectName" name="subjectName" placeholder="Contoh: Matematika" defaultValue={editing?.subjectName || ""} required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="subjectCode">Kode MP (Opsional)</Label><Input id="subjectCode" name="subjectCode" placeholder="Contoh: MTK10" defaultValue={editing?.subjectCode || ""} /></div>
            <div className="space-y-2"><Label htmlFor="score">Nilai Angka *</Label><Input id="score" name="score" type="number" step="0.01" min="0" max="100" placeholder="0 - 100" defaultValue={editing?.score ?? ""} required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="scoreLetter">Nilai Huruf (Opsional)</Label><Input id="scoreLetter" name="scoreLetter" placeholder="A, B, C, D, E" defaultValue={editing?.scoreLetter || ""} /></div>
          <div className="space-y-2"><Label htmlFor="notes">Catatan (Opsional)</Label><Textarea id="notes" name="notes" placeholder="Catatan nilai..." defaultValue={editing?.notes || ""} /></div>
          <DialogActions onCancel={() => onOpenChange(false)} submitting={submitting} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Attendance Dialog ---
interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  editing: AlumniAttendanceSummary | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function AttendanceDialog({ open, onOpenChange, mode, editing, submitting, onSubmit }: AttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "add" ? "Tambah Rekap Kehadiran" : "Ubah Rekap Kehadiran"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="attAcademicYear">Tahun Ajaran *</Label><Input id="attAcademicYear" name="academicYear" placeholder="Contoh: 2025/2026" defaultValue={editing?.academicYear || ""} required /></div>
            <div className="space-y-2"><Label htmlFor="attSemester">Semester *</Label>
              <Select name="semester" defaultValue={editing?.semester || "Ganjil"}>
                <SelectTrigger id="attSemester"><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                <SelectContent><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="present">Hadir (Hari) *</Label><Input id="present" name="present" type="number" min="0" defaultValue={editing?.present ?? ""} required /></div>
            <div className="space-y-2"><Label htmlFor="sick">Sakit (Hari)</Label><Input id="sick" name="sick" type="number" min="0" defaultValue={editing?.sick ?? 0} /></div>
            <div className="space-y-2"><Label htmlFor="permission">Izin (Hari)</Label><Input id="permission" name="permission" type="number" min="0" defaultValue={editing?.permission ?? 0} /></div>
            <div className="space-y-2"><Label htmlFor="absent">Alpha (Hari)</Label><Input id="absent" name="absent" type="number" min="0" defaultValue={editing?.absent ?? 0} /></div>
          </div>
          <DialogActions onCancel={() => onOpenChange(false)} submitting={submitting} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Achievement Dialog ---
interface AchievementDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  editing: AlumniAchievement | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function AchievementDialog({ open, onOpenChange, mode, editing, submitting, onSubmit }: AchievementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "add" ? "Tambah Prestasi" : "Ubah Prestasi"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="type">Jenis Prestasi *</Label>
            <Select name="type" defaultValue={editing?.type || "academic"}>
              <SelectTrigger id="type"><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
              <SelectContent><SelectItem value="academic">Akademik</SelectItem><SelectItem value="non_academic">Non-Akademik</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="title">Nama Prestasi / Penghargaan *</Label><Input id="title" name="title" placeholder="Contoh: Juara 1 Olimpiade Fisika" defaultValue={editing?.title || ""} required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="level">Tingkat *</Label>
              <Select name="level" defaultValue={editing?.level || "school"}>
                <SelectTrigger id="level"><SelectValue placeholder="Pilih Tingkat" /></SelectTrigger>
                <SelectContent><SelectItem value="school">Sekolah</SelectItem><SelectItem value="district">Kecamatan/Kabupaten</SelectItem><SelectItem value="province">Provinsi</SelectItem><SelectItem value="national">Nasional</SelectItem><SelectItem value="international">Internasional</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="year">Tahun Perolehan *</Label><Input id="year" name="year" placeholder="Contoh: 2025" defaultValue={editing?.year || ""} required /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="ranking">Peringkat / Juara Ke-</Label><Input id="ranking" name="ranking" placeholder="Contoh: Juara 1 / Harapan 2" defaultValue={editing?.ranking || ""} /></div>
            <div className="space-y-2"><Label htmlFor="organizer">Penyelenggara</Label><Input id="organizer" name="organizer" placeholder="Contoh: Dinas Pendidikan" defaultValue={editing?.organizer || ""} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="certificateUrl">URL Sertifikat (Opsional)</Label><Input id="certificateUrl" name="certificateUrl" placeholder="https://..." defaultValue={editing?.certificateUrl || ""} /></div>
          <div className="space-y-2"><Label htmlFor="achDescription">Deskripsi / Detail Penghargaan</Label><Textarea id="achDescription" name="description" placeholder="Deskripsi singkat..." defaultValue={editing?.description || ""} /></div>
          <DialogActions onCancel={() => onOpenChange(false)} submitting={submitting} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Ekskul Dialog ---
interface EkskulDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  editing: AlumniExtracurricular | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function EkskulDialog({ open, onOpenChange, mode, editing, submitting, onSubmit }: EkskulDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "add" ? "Tambah Ekstrakurikuler" : "Ubah Ekstrakurikuler"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="activityName">Nama Kegiatan / Ekskul *</Label><Input id="activityName" name="activityName" placeholder="Contoh: Pramuka / Paskibra" defaultValue={editing?.activityName || ""} required /></div>
          <div className="space-y-2"><Label htmlFor="role">Peran / Jabatan</Label><Input id="role" name="role" placeholder="Contoh: Ketua / Anggota Aktif" defaultValue={editing?.role || ""} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="yearStart">Tahun Mulai</Label><Input id="yearStart" name="yearStart" placeholder="Contoh: 2023" defaultValue={editing?.yearStart || ""} /></div>
            <div className="space-y-2"><Label htmlFor="yearEnd">Tahun Selesai</Label><Input id="yearEnd" name="yearEnd" placeholder="Contoh: 2025" defaultValue={editing?.yearEnd || ""} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="exDescription">Keterangan / Deskripsi Kegiatan</Label><Textarea id="exDescription" name="description" placeholder="Deskripsi singkat..." defaultValue={editing?.description || ""} /></div>
          <DialogActions onCancel={() => onOpenChange(false)} submitting={submitting} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Health Dialog ---
interface HealthDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  editing: AlumniHealthRecord | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function HealthDialog({ open, onOpenChange, mode, editing, submitting, onSubmit }: HealthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "add" ? "Tambah Rekam Medis Tahunan" : "Ubah Rekam Medis Tahunan"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="healthYear">Tingkat Kelas / Tahun *</Label>
            <Select name="year" defaultValue={editing?.year || "Kelas I"}>
              <SelectTrigger id="healthYear"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
              <SelectContent>{["Kelas I","Kelas II","Kelas III","Kelas IV","Kelas V","Kelas VI"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="healthWeight">Berat Badan (kg)</Label><Input id="healthWeight" name="weight" type="number" placeholder="Contoh: 25" defaultValue={editing?.weight ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="healthHeight">Tinggi Badan (cm)</Label><Input id="healthHeight" name="height" type="number" placeholder="Contoh: 120" defaultValue={editing?.height ?? ""} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="healthIllness">Penyakit Diderita (Opsional)</Label><Input id="healthIllness" name="illness" placeholder="Contoh: Campak, Cacingan, dll." defaultValue={editing?.illness || ""} /></div>
          <div className="space-y-2"><Label htmlFor="healthAbnormality">Kelainan Jasmani (Opsional)</Label><Input id="healthAbnormality" name="abnormality" placeholder="Contoh: - (jika tidak ada)" defaultValue={editing?.abnormality || ""} /></div>
          <DialogActions onCancel={() => onOpenChange(false)} submitting={submitting} />
        </form>
      </DialogContent>
    </Dialog>
  );
}