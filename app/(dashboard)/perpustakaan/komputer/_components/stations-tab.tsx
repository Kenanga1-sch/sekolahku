"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import {
  listStations,
  createStation,
  deleteStation,
  type ComputerStation,
} from "@/lib/computer";

export function StationsTab() {
  const [stations, setStations] = useState<ComputerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", location: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await listStations());
    } catch {
      showError("Gagal memuat daftar komputer");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showError("Kode dan nama komputer wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await createStation({ ...form, status: "active" });
      showSuccess("Komputer ditambahkan");
      setDialogOpen(false);
      setForm({ code: "", name: "", location: "" });
      load();
    } catch (e: any) {
      showError(e?.message || "Gagal menambah komputer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus komputer "${name}"?`)) return;
    try {
      await deleteStation(id);
      showSuccess("Komputer dihapus");
      load();
    } catch {
      showError("Gagal menghapus komputer");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Daftar Komputer</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : stations.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            Belum ada komputer. Tambahkan unit pertama.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    aria-label={`Hapus ${s.name}`}
                    onClick={() => handleDelete(s.id, s.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {s.location && <p className="text-sm text-muted-foreground">{s.location}</p>}
                {s.activeSession ? (
                  <Badge className="bg-blue-600">
                    Dipakai: {s.activeSession.studentName}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Tersedia
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Komputer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="st-code">Kode unik</Label>
              <Input
                id="st-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PC-01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dipakai di URL kiosk komputer ini: /kiosk-komputer?station=PC-01
              </p>
            </div>
            <div>
              <Label htmlFor="st-name">Nama tampilan</Label>
              <Input
                id="st-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Komputer 1"
              />
            </div>
            <div>
              <Label htmlFor="st-loc">Lokasi (opsional)</Label>
              <Input
                id="st-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ruang Perpustakaan"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
