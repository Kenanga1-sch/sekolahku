"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookMarked } from "lucide-react";
import type { QuickIndexForm } from "../alumni-types";

export interface QuickIndexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickIndexForm: QuickIndexForm;
  setQuickIndexForm: (updater: (f: QuickIndexForm) => QuickIndexForm) => void;
  quickIndexSaving: boolean;
  onSubmit: () => void;
}

export function QuickIndexDialog({
  open,
  onOpenChange,
  quickIndexForm,
  setQuickIndexForm,
  quickIndexSaving,
  onSubmit,
}: QuickIndexDialogProps) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              Index Cepat Arsip Fisik
            </DialogTitle>
            <DialogDescription>
              Catat penunjuk siswa lama ke buku induk fisik tanpa mengisi data lengkap. Cukup nama dan lokasi buku — data lain bisa dilengkapi nanti.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama Lengkap *</label>
              <Input
                value={quickIndexForm.fullName}
                onChange={(e) => setQuickIndexForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Nama sesuai buku induk fisik"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tahun Lulus</label>
                <Input
                  value={quickIndexForm.graduationYear}
                  onChange={(e) => setQuickIndexForm((f) => ({ ...f, graduationYear: e.target.value }))}
                  placeholder="mis. 1995"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">NISN</label>
                <Input
                  value={quickIndexForm.nisn}
                  onChange={(e) => setQuickIndexForm((f) => ({ ...f, nisn: e.target.value }))}
                  placeholder="Opsional"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Buku Induk No.</label>
                <Input
                  value={quickIndexForm.bukuFisikNo}
                  onChange={(e) => setQuickIndexForm((f) => ({ ...f, bukuFisikNo: e.target.value }))}
                  placeholder="mis. VI"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nomor Urut</label>
                <Input
                  type="number"
                  value={quickIndexForm.registerNo}
                  onChange={(e) => setQuickIndexForm((f) => ({ ...f, registerNo: e.target.value }))}
                  placeholder="mis. 1421"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={quickIndexSaving}>
              Batal
            </Button>
            <Button onClick={onSubmit} disabled={quickIndexSaving}>
              {quickIndexSaving ? "Menyimpan..." : "Simpan Index"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
