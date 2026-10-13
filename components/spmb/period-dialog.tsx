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
import { Loader2 } from "lucide-react";

/** Bentuk form gelombang pendaftaran. */
export interface PeriodFormData {
  name: string;
  committeeName: string;
  startDate: string;
  endDate: string;
  quota: string;
  isActive: boolean;
}

/** Dialog buat/edit gelombang pendaftaran (periode PPDB). */
export function PeriodDialog({
  open,
  editingPeriodId,
  formData,
  isSaving,
  onChange,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  editingPeriodId: string | null;
  formData: PeriodFormData;
  isSaving: boolean;
  onChange: (next: PeriodFormData) => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingPeriodId ? "Edit Gelombang Pendaftaran" : "Tambah Gelombang Pendaftaran"}</DialogTitle>
          <DialogDescription>
            Buat atau perbarui rincian periode pendaftaran siswa baru.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="period-name" className="sm:text-right">Nama Gelombang</Label>
            <Input
              id="period-name"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="misal: Gelombang 1"
              className="sm:col-span-3"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="committee" className="sm:text-right">Panitia PPDB</Label>
            <Input
              id="committee"
              value={formData.committeeName}
              onChange={(e) => onChange({ ...formData, committeeName: e.target.value })}
              placeholder="Nama Ketua Panitia"
              className="sm:col-span-3"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="start-date" className="sm:text-right">Tanggal Mulai</Label>
            <Input
              id="start-date"
              type="date"
              value={formData.startDate}
              onChange={(e) => onChange({ ...formData, startDate: e.target.value })}
              className="sm:col-span-3"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="end-date" className="sm:text-right">Tanggal Selesai</Label>
            <Input
              id="end-date"
              type="date"
              value={formData.endDate}
              onChange={(e) => onChange({ ...formData, endDate: e.target.value })}
              className="sm:col-span-3"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="quota" className="sm:text-right">Kuota Siswa</Label>
            <Input
              id="quota"
              type="number"
              value={formData.quota}
              onChange={(e) => onChange({ ...formData, quota: e.target.value })}
              placeholder="100"
              className="sm:col-span-3"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="is-active" className="sm:text-right">Langsung Aktifkan</Label>
            <div className="sm:col-span-3 flex items-center">
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => onChange({ ...formData, isActive: checked })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={onSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
