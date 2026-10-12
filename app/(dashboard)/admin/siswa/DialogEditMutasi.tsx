"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { goPut } from "@/lib/api-client";
import { toast } from "sonner";
import type { MutasiLog } from "./types-mutasi";

interface Props {
  log: MutasiLog;
}

function toDateInputValue(v?: string): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA");
}

function initialForm(log: MutasiLog) {
  return {
    mutationDate: toDateInputValue(log.mutationDate),
    originOrDestination: log.originOrDestination || "",
    originNis: log.originNis || "",
    originClass: log.originClass || "",
    approvalDate: toDateInputValue(log.approvalDate),
    approvalNo: log.approvalNo || "",
    letterNo: log.letterNo || "",
    destinationClass: log.destinationClass || "",
    reason: log.reason || "",
  };
}

export function DialogEditMutasi({ log }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => initialForm(log));

  const isMasuk = log.mutasiType === "masuk";

  const onOpenChange = (o: boolean) => {
    if (o) setForm(initialForm(log)); // selalu prefill ulang dari data terbaru
    setOpen(o);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!log.id) return;
    if (!form.mutationDate) {
      toast.error("Tanggal Mutasi wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await goPut(`/api/admin/mutasi/logs/${log.id}`, {
        ...form,
        mutationDate: new Date(form.mutationDate).getTime(),
      });
      toast.success("Entri buku mutasi diperbarui");
      setOpen(false);
      await mutate((key) => typeof key === "string" && key.startsWith("/api/admin/mutasi"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan perubahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="no-print h-4 w-4 text-slate-400 hover:text-blue-600"
          title={`Edit entri ${log.studentName}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Entri Mutasi {isMasuk ? "Masuk" : "Keluar"}</DialogTitle>
          <DialogDescription>
            Perbaiki data dokumen untuk <span className="font-semibold">{log.studentName}</span>
            {log.nisn ? ` (NISN ${log.nisn})` : ""}. Nama dan NISN tidak dapat diubah di sini.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Mutasi *</Label>
              <Input
                type="date"
                value={form.mutationDate}
                onChange={(e) => setForm({ ...form, mutationDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isMasuk ? "Sekolah Asal" : "Sekolah Tujuan"} *</Label>
              <Input
                value={form.originOrDestination}
                onChange={(e) => setForm({ ...form, originOrDestination: e.target.value })}
                placeholder="SDN ..."
                required
              />
            </div>
          </div>

          {isMasuk ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>No. Induk Asal</Label>
                  <Input
                    value={form.originNis}
                    onChange={(e) => setForm({ ...form, originNis: e.target.value })}
                    placeholder="NIS Sekolah Asal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kelas Asal</Label>
                  <Input
                    value={form.originClass}
                    onChange={(e) => setForm({ ...form, originClass: e.target.value })}
                    placeholder="misal: Kelas 3"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tanggal Surat Persetujuan</Label>
                  <Input
                    type="date"
                    value={form.approvalDate}
                    onChange={(e) => setForm({ ...form, approvalDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Surat Persetujuan</Label>
                  <Input
                    value={form.approvalNo}
                    onChange={(e) => setForm({ ...form, approvalNo: e.target.value })}
                    placeholder="No. Surat Rekomendasi/Dinas"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nomor Surat Pindah</Label>
                <Input
                  value={form.letterNo}
                  onChange={(e) => setForm({ ...form, letterNo: e.target.value })}
                  placeholder="No. Surat Permohonan/Pindah"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ke Kelas (Tujuan)</Label>
                <Input
                  value={form.destinationClass}
                  onChange={(e) => setForm({ ...form, destinationClass: e.target.value })}
                  placeholder="misal: Kelas 4"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Keterangan / Alasan</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ikut Orang Tua / Pindah Domisili..."
            />
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
