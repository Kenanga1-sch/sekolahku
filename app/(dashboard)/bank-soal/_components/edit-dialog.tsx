"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

import type { QuestionSet } from "./types";

/** Bentuk form edit paket (subset field saat membuat paket). */
export interface EditForm {
  name: string;
  mode: string;
  timerMinutes: string;
  maxAttempts: string;
  availableFrom: string;
  availableUntil: string;
  resultVisible: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

/** Dialog untuk mengubah nama & pengaturan paket soal. */
export function EditDialog({
  editingSet,
  editForm,
  onChange,
  onSave,
  onClose,
}: {
  editingSet: QuestionSet | null;
  editForm: EditForm;
  onChange: (next: EditForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!editingSet} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Paket Soal</DialogTitle>
          <DialogDescription>Ubah nama dan pengaturan paket</DialogDescription>
        </DialogHeader>
          <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nama Paket *</Label>
            <Input
              value={editForm.name}
              onChange={(e) => onChange({ ...editForm, name: e.target.value })}
              placeholder="Nama paket"
            />
          </div>
          <div className="space-y-2">
            <Label>Mode Paket</Label>
            <Select value={editForm.mode} onValueChange={(v) => onChange({ ...editForm, mode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latihan">Latihan</SelectItem>
                <SelectItem value="ujian">Ujian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batas Waktu (Menit, Opsional)</Label>
            <Input
              type="number"
              min="0"
              value={editForm.timerMinutes}
              onChange={(e) => onChange({ ...editForm, timerMinutes: e.target.value })}
              placeholder="Kosongkan untuk tanpa batas waktu"
            />
          </div>
          {editForm.mode === "ujian" && (
            <>
              <div className="space-y-2">
                <Label>Maks Percobaan (Opsional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.maxAttempts}
                  onChange={(e) => onChange({ ...editForm, maxAttempts: e.target.value })}
                  placeholder="Kosongkan untuk tak terbatas"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mulai (Opsional)</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.availableFrom}
                    onChange={(e) => onChange({ ...editForm, availableFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selesai (Opsional)</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.availableUntil}
                    onChange={(e) => onChange({ ...editForm, availableUntil: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Tampilkan Hasil ke Siswa</p>
                  <p className="text-xs text-muted-foreground">Jika nonaktif, siswa tidak melihat skor</p>
                </div>
                <Switch
                  checked={editForm.resultVisible}
                  onCheckedChange={(v) => onChange({ ...editForm, resultVisible: v })}
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
                checked={editForm.shuffleQuestions}
                onCheckedChange={(v) => onChange({ ...editForm, shuffleQuestions: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Acak Pilihan Jawaban</p>
                <p className="text-xs text-muted-foreground">Urutan opsi jawaban diacak</p>
              </div>
              <Switch
                checked={editForm.shuffleOptions}
                onCheckedChange={(v) => onChange({ ...editForm, shuffleOptions: v })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Batal</Button>
          <Button onClick={onSave}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
