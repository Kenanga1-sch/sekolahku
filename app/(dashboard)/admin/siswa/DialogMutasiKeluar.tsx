"use client";

import { useState } from "react";
import { mutate } from "swr";
import useSWR from "swr";
import { Loader2, ArrowRightCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { goGet, goPost } from "@/lib/api-client";
import { toast } from "sonner";
import type { StudentItem } from "./types-mutasi";

export function DialogMutasiKeluar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    destinationSchool: "",
    destinationClass: "",
    letterNo: "",
    reason: ""
  });

  const { data: dataStudents } = useSWR(
    open ? "/api/students?limit=500&status=active" : null,
    (url: string) => goGet<{ data?: StudentItem[] }>(url)
  );
  const students = dataStudents?.data || [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.destinationSchool) {
      toast.error("Siswa dan Sekolah Tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await goPost("/api/admin/mutasi-keluar/langsung", form);
      toast.success("Mutasi keluar berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      setForm({ studentId: "", destinationSchool: "", destinationClass: "", letterNo: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi keluar. Pastikan tidak ada sangkutan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
          <ArrowRightCircle className="mr-2 h-4 w-4" /> Proses Mutasi Keluar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mutasi Keluar Langsung</DialogTitle>
          <DialogDescription>
            Isikan data mutasi keluar siswa untuk pencatatan otomatis di Buku Mutasi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">

          <div className="space-y-1.5">
            <Label>Pilih Siswa (Aktif) *</Label>
            <Select value={form.studentId} onValueChange={(v) => setForm({...form, studentId: v})} required>
              <SelectTrigger><SelectValue placeholder="Pilih Siswa"/></SelectTrigger>
              <SelectContent>
                {students.map((s: StudentItem) => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.className})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sekolah Tujuan *</Label>
              <Input
                value={form.destinationSchool}
                onChange={(e) => setForm({...form, destinationSchool: e.target.value})}
                placeholder="SDN Tujuan..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ke Kelas (Tujuan)</Label>
              <Input
                value={form.destinationClass}
                onChange={(e) => setForm({...form, destinationClass: e.target.value})}
                placeholder="misal: Kelas 4"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nomor Surat Pindah / Permohonan</Label>
            <Input
              value={form.letterNo}
              onChange={(e) => setForm({...form, letterNo: e.target.value})}
              placeholder="No. Surat Permohonan/Pindah"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Alasan Pindah</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({...form, reason: e.target.value})}
              placeholder="Ikut Orang Tua / Pindah Domisili..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keluarkan Siswa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
