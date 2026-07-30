"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Loader2, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { goPost } from "@/lib/api-client";
import { toast } from "sonner";
import type { ClassStatsItem } from "./types-mutasi";

interface Props {
  classStats: ClassStatsItem[];
}

export function DialogMutasiMasuk({ classStats }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    nisn: "",
    nis: "",
    gender: "L",
    metaData: "",
    originNis: "",
    originClass: "",
    classId: "",
    approvalNo: "",
    approvalDate: "",
    reason: ""
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.nisn || !form.classId) {
      toast.error("Nama, NISN, dan Kelas tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student: {
          fullName: form.fullName,
          nisn: form.nisn,
          nis: form.nis || undefined,
          gender: form.gender,
          metaData: form.metaData,
          classId: form.classId
        },
        reason: form.reason,
        originNis: form.originNis,
        originClass: form.originClass,
        approvalNo: form.approvalNo,
        approvalDate: form.approvalDate
      };

      await goPost("/api/admin/mutasi/masuk/langsung", payload);
      toast.success("Mutasi masuk berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      mutate("/api/classes/stats");
      setForm({ fullName: "", nisn: "", nis: "", gender: "L", metaData: "", originNis: "", originClass: "", classId: "", approvalNo: "", approvalDate: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Proses Mutasi Masuk
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mutasi Masuk Langsung</DialogTitle>
          <DialogDescription>
            Isikan data mutasi masuk sesuai dokumen untuk pencatatan otomatis di Buku Mutasi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2 max-h-[80vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nama Siswa *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
                placeholder="Nama Lengkap"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>NISN *</Label>
              <Input
                value={form.nisn}
                onChange={(e) => setForm({...form, nisn: e.target.value})}
                placeholder="10 digit NISN"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>NIS Sekolah Ini</Label>
              <Input
                value={form.nis}
                onChange={(e) => setForm({...form, nis: e.target.value})}
                placeholder="No. Induk Baru"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kelamin</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({...form, gender: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kelas Penempatan *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({...form, classId: v})} required>
                <SelectTrigger><SelectValue placeholder="Pilih Kelas"/></SelectTrigger>
                <SelectContent>
                  {classStats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Sekolah Asal</Label>
              <Input
                value={form.metaData}
                onChange={(e) => setForm({...form, metaData: e.target.value})}
                placeholder="SDN Asal..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>No. Induk Asal</Label>
              <Input
                value={form.originNis}
                onChange={(e) => setForm({...form, originNis: e.target.value})}
                placeholder="NIS Sekolah Asal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kelas Asal</Label>
              <Input
                value={form.originClass}
                onChange={(e) => setForm({...form, originClass: e.target.value})}
                placeholder="misal: Kelas 3"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nomor Surat Persetujuan</Label>
              <Input
                value={form.approvalNo}
                onChange={(e) => setForm({...form, approvalNo: e.target.value})}
                placeholder="No. Surat Rekomendasi/Dinas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Surat Persetujuan</Label>
              <Input
                type="date"
                value={form.approvalDate}
                onChange={(e) => setForm({...form, approvalDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Keterangan / Alasan Mutasi</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({...form, reason: e.target.value})}
              placeholder="Ikut Domisili Orang Tua..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proses Mutasi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
