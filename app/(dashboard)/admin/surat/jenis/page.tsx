"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { DataTable } from "@/components/data-table";
import { toast } from "sonner";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { useLetterTypes } from "@/lib/hooks/use-letter-types";
import { LETTER_NUMBER_PLACEHOLDERS } from "@/lib/config/letter-number-format";

interface LetterTypeRow {
  id: number;
  jenisSurat: string;
  kodeKlasifikasi: string;
  kategori: string;
  formatNomor: string;
  isActive: boolean;
  urut: number;
}

const KATEGORI_OPTIONS = [
  "Kepegawaian",
  "Umum",
  "Kesiswaan",
  "Kurikulum",
  "Akademik",
];

const DEFAULT_FORMAT = "{nomor_urut}/{kode_klasifikasi}/{bulan_romawi}/{tahun}";

const EMPTY_FORM = {
  id: 0,
  jenisSurat: "",
  kodeKlasifikasi: "",
  kategori: "Umum",
  formatNomor: DEFAULT_FORMAT,
  isActive: true,
  urut: 0,
};

export default function JenisSuratPage() {
  const { refresh: refreshOptions } = useLetterTypes();
  const [rows, setRows] = useState<LetterTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isEdit, setIsEdit] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res: any = await goGet("/api/eoffice/letter-types?include_inactive=true");
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch {
      toast.error("Gagal memuat jenis surat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEdit = (row: LetterTypeRow) => {
    setForm({ ...row });
    setIsEdit(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.jenisSurat.trim()) {
      toast.error("Nama jenis surat wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        jenisSurat: form.jenisSurat,
        kodeKlasifikasi: form.kodeKlasifikasi,
        kategori: form.kategori,
        formatNomor: form.formatNomor || DEFAULT_FORMAT,
        isActive: form.isActive,
        urut: Number(form.urut) || 0,
      };
      const res: any = isEdit
        ? await goPut(`/api/eoffice/letter-types/${form.id}`, payload)
        : await goPost("/api/eoffice/letter-types", payload);
      if (res?.success) {
        toast.success(isEdit ? "Jenis surat diperbarui" : "Jenis surat ditambahkan");
        setDialogOpen(false);
        await fetchRows();
        await refreshOptions();
      } else {
        toast.error(res?.error || "Gagal menyimpan");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: LetterTypeRow) => {
    if (!confirm(`Hapus jenis surat "${row.jenisSurat}"?`)) return;
    try {
      const res: any = await goDelete(`/api/eoffice/letter-types/${row.id}`);
      if (res?.success) {
        toast.success("Jenis surat dihapus");
        await fetchRows();
        await refreshOptions();
      } else {
        toast.error(res?.error || "Gagal menghapus");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jenis Surat</h1>
          <p className="text-muted-foreground">
            Kelola jenis surat, kode klasifikasi, dan format nomor surat.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchRows} disabled={loading} title="Muat ulang">
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Tambah Jenis
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        getRowId={(r) => String(r.id)}
        loading={loading}
        emptyTitle="Belum ada jenis surat"
        emptyDescription="Tambahkan jenis surat baru untuk mulai."
        actions={(row) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row)}
              className="text-red-600 hover:text-red-700"
              title="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        columns={[
          {
            key: "jenisSurat",
            header: "Jenis Surat",
            card: "title",
            render: (r) => <span className="font-medium">{r.jenisSurat}</span>,
          },
          {
            key: "kodeKlasifikasi",
            header: "Kode",
            card: "field",
            render: (r) => <Badge variant="outline">{r.kodeKlasifikasi || "-"}</Badge>,
          },
          {
            key: "kategori",
            header: "Kategori",
            card: "field",
            render: (r) => <Badge variant="secondary">{r.kategori}</Badge>,
          },
          {
            key: "formatNomor",
            header: "Format Nomor",
            card: "field",
            render: (r) => (
              <span className="font-mono text-xs text-muted-foreground">{r.formatNomor}</span>
            ),
          },
          {
            key: "isActive",
            header: "Status",
            card: "field",
            render: (r) => (
              <Badge variant={r.isActive ? "default" : "outline"}>
                {r.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            ),
          },
        ]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Jenis Surat" : "Tambah Jenis Surat"}</DialogTitle>
            <DialogDescription>
              Format nomor memakai placeholder seperti {"{nomor_urut}"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nama Jenis Surat</Label>
              <Input
                value={form.jenisSurat}
                onChange={(e) => setForm({ ...form, jenisSurat: e.target.value })}
                placeholder="Surat Keterangan Aktif"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kode Klasifikasi</Label>
                <Input
                  value={form.kodeKlasifikasi}
                  onChange={(e) => setForm({ ...form, kodeKlasifikasi: e.target.value })}
                  placeholder="400.3.5.09"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kategori</Label>
                <Select
                  value={form.kategori}
                  onValueChange={(v) => setForm({ ...form, kategori: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORI_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format Nomor Surat</Label>
              <Input
                value={form.formatNomor}
                onChange={(e) => setForm({ ...form, formatNomor: e.target.value })}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {LETTER_NUMBER_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    className="rounded border px-1.5 py-0.5 font-mono text-[10px] hover:bg-accent"
                    title={p.desc}
                    onClick={() =>
                      setForm({ ...form, formatNomor: form.formatNomor + p.token })
                    }
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Urutan</Label>
                <Input
                  type="number"
                  value={form.urut}
                  onChange={(e) => setForm({ ...form, urut: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.isActive ? "1" : "0"}
                  onValueChange={(v) => setForm({ ...form, isActive: v === "1" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Aktif</SelectItem>
                    <SelectItem value="0">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="hidden">
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
          <CardDescription>Perubahan berlaku pada editor surat modular.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
