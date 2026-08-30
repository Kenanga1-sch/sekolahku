"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { goGet, goPost, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { Plus, Trash2, Calendar } from "lucide-react";

interface Holiday {
  id: string;
  date: string;
  title: string;
  description?: string;
}

export default function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", title: "", description: "" });

  const fetchHolidays = async () => {
    try {
      const data = await goGet("/api/school-holidays");
      setHolidays(data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) fetchHolidays();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await goPost("/api/school-holidays", formData);
      showSuccess("Hari libur berhasil ditambahkan");
      setFormData({ date: "", title: "", description: "" });
      fetchHolidays();
    } catch (err: any) {
      showError(err.message || "Gagal menambahkan hari libur");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus hari libur ini?")) return;
    try {
      await goDelete(`/api/school-holidays/${id}`);
      showSuccess("Berhasil dihapus");
      fetchHolidays();
    } catch (err: any) {
      showError(err.message || "Gagal menghapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-20 flex-col gap-1">
          <Calendar className="h-6 w-6" />
          <span>Kelola Hari Libur</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola Hari Libur Sekolah</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 border-b pb-4">
            <div className="col-span-1">
              <Label>Tanggal</Label>
              <Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="col-span-1">
              <Label>Nama Hari Libur</Label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Contoh: Cuti Bersama" />
            </div>
            <div className="col-span-2">
              <Label>Keterangan (Opsional)</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <Button disabled={loading} className="col-span-2">Tambahkan</Button>
          </form>
          
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.date}</TableCell>
                    <TableCell>{h.title}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(h.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {holidays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada data</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
