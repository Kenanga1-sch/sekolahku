"use client";

import { useState } from "react";
import { mutate } from "swr";
import useSWR from "swr";
import { format } from "date-fns";
import { Loader2, ArrowRightCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { goGet, goPost } from "@/lib/api-client";
import { toast } from "sonner";
import type { StudentItem } from "./types-mutasi";

export function DialogMutasiKeluar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    mutationDate: format(new Date(), "yyyy-MM-dd"),
    destinationSchool: "",
    destinationStreet: "",
    destinationVillage: "",
    destinationDistrict: "",
    destinationRegency: "",
    destinationProvince: "",
    destinationClass: "",
    letterNo: "",
    reason: ""
  });

  const { data: dataStudents } = useSWR(
    open ? "/api/students?limit=500&status=active" : null,
    (url: string) => goGet<{ data?: { data?: StudentItem[] } }>(url)
  );
  // /api/students mengembalikan StudentResponse double-bungkus:
  // { success, data: { data: [...siswa], pagination, summary } }
  const students = dataStudents?.data?.data || [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.destinationSchool) {
      toast.error("Siswa dan Sekolah Tujuan wajib diisi");
      return;
    }
    if (!form.mutationDate) {
      toast.error("Tanggal Mutasi wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await goPost("/api/admin/mutasi-keluar/langsung", {
        ...form,
        mutationDate: new Date(form.mutationDate).getTime(),
      });
      toast.success("Mutasi keluar berhasil diproses");
      setOpen(false);
      // Revalidate semua list mutasi (key SWR menyertakan query string,
      // jadi gunakan matcher prefix agar list benar-benar diperbarui).
      await mutate((key) => typeof key === "string" && key.startsWith("/api/admin/mutasi"));
      mutate("/api/classes/stats");
      setForm({
        studentId: "",
        mutationDate: format(new Date(), "yyyy-MM-dd"),
        destinationSchool: "",
        destinationStreet: "",
        destinationVillage: "",
        destinationDistrict: "",
        destinationRegency: "",
        destinationProvince: "",
        destinationClass: "",
        letterNo: "",
        reason: "",
      });
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
          <ArrowRightCircle className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Proses Mutasi Keluar</span>
          <span className="sm:hidden">Mutasi Keluar</span>
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
            <SearchableSelect
              items={students.map((s: StudentItem) => ({
                value: s.id,
                label: `${s.fullName}${s.className ? ` (${s.className})` : ""}${s.nis ? ` — ${s.nis}` : ""}`,
              }))}
              value={form.studentId}
              onChange={(v) => setForm({ ...form, studentId: v })}
              placeholder="Cari & pilih siswa..."
              searchPlaceholder="Ketik nama / NIS / kelas..."
              emptyMessage="Siswa tidak ditemukan."
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Ketik untuk mencari nama atau NIS.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Tanggal Mutasi *</Label>
            <Input
              type="date"
              value={form.mutationDate}
              onChange={(e) => setForm({...form, mutationDate: e.target.value})}
              required
            />
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
            <Label>Jalan / Dusun</Label>
            <Input
              value={form.destinationStreet}
              onChange={(e) => setForm({...form, destinationStreet: e.target.value})}
              placeholder="Jl. Melati No. 12"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desa / Kelurahan</Label>
              <Input
                value={form.destinationVillage}
                onChange={(e) => setForm({...form, destinationVillage: e.target.value})}
                placeholder="Kenanga"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kecamatan</Label>
              <Input
                value={form.destinationDistrict}
                onChange={(e) => setForm({...form, destinationDistrict: e.target.value})}
                placeholder="Sindang"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kabupaten / Kota</Label>
              <Input
                value={form.destinationRegency}
                onChange={(e) => setForm({...form, destinationRegency: e.target.value})}
                placeholder="Indramayu"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Provinsi</Label>
              <Input
                value={form.destinationProvince}
                onChange={(e) => setForm({...form, destinationProvince: e.target.value})}
                placeholder="Jawa Barat"
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
