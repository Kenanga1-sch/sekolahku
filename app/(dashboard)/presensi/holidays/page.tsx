"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calendar } from "lucide-react";
import { goGet, goPost, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type Holiday = {
  id: string;
  date: string;
  title: string;
  description?: string;
  created_at: number;
};

export default function HolidayManagementPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const fetchHolidays = async () => {
    try {
      const res = await goGet("/api/school-holidays");
      setHolidays(res?.data ?? res ?? []);
    } catch (error) {
      showError("Gagal memuat data hari libur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAdd = async () => {
    if (!date || !title) {
      showError("Tanggal dan judul harus diisi");
      return;
    }
    try {
      await goPost("/api/school-holidays", { date, title, description });
      showSuccess("Hari libur berhasil ditambahkan");
      setOpen(false);
      setDate("");
      setTitle("");
      setDescription("");
      fetchHolidays();
    } catch (error) {
      showError("Gagal menambahkan hari libur");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus hari libur ini?")) return;
    try {
      await goDelete(`/api/school-holidays/${id}`);
      showSuccess("Hari libur berhasil dihapus");
      fetchHolidays();
    } catch (error) {
      showError("Gagal menghapus hari libur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Manajemen Hari Libur
          </h1>
          <p className="text-muted-foreground text-sm">
            Kelola tanggal merah dan hari libur sekolah
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Libur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Hari Libur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Judul</Label>
                <Input
                  placeholder="Misal: Hari Raya Idul Fitri"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi (Opsional)</Label>
                <Input
                  placeholder="Keterangan tambahan"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleAdd} className="w-full">
                Simpan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Hari Libur</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat...</div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada data hari libur
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {format(new Date(h.date), "EEEE, d MMMM yyyy", { locale: id })}
                    </TableCell>
                    <TableCell className="font-medium">{h.title}</TableCell>
                    <TableCell>{h.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(h.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}