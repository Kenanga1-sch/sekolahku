"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import type { SPMBPeriod } from "@/types";

interface PeriodWithCount extends SPMBPeriod {
  registered?: number;
}

export default function SPMBPeriodsPage() {
  const [periods, setPeriods] = useState<PeriodWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    quota: "",
    is_active: false,
  });

  const fetchPeriods = useCallback(async () => {
    try {
      const result = await pb.collection("spmb_periods").getFullList<SPMBPeriod>({
        sort: "-created",
      });

      // Get registered count for each period
      const periodsWithCount = await Promise.all(
        result.map(async (period) => {
          try {
            const count = await pb.collection("spmb_registrants").getList(1, 1, {
              filter: `period_id = "${period.id}"`,
            });
            return { ...period, registered: count.totalItems };
          } catch {
            return { ...period, registered: 0 };
          }
        })
      );

      setPeriods(periodsWithCount);
    } catch (error) {
      console.error("Failed to fetch periods:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const data = {
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        quota: parseInt(formData.quota) || 100,
        is_active: formData.is_active,
      };

      if (editingId) {
        await pb.collection("spmb_periods").update(editingId, data);
      } else {
        await pb.collection("spmb_periods").create(data);
      }

      // If setting as active, deactivate others
      if (formData.is_active) {
        const others = periods.filter(p => p.id !== editingId && p.is_active);
        for (const p of others) {
          await pb.collection("spmb_periods").update(p.id, { is_active: false });
        }
      }

      fetchPeriods();
      resetForm();
    } catch (error) {
      console.error("Failed to save period:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: PeriodWithCount) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      start_date: item.start_date?.split("T")[0] || "",
      end_date: item.end_date?.split("T")[0] || "",
      quota: (item.quota || 100).toString(),
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await pb.collection("spmb_periods").delete(deleteId);
      setDeleteId(null);
      fetchPeriods();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      // Deactivate all first
      for (const p of periods) {
        if (p.is_active) {
          await pb.collection("spmb_periods").update(p.id, { is_active: false });
        }
      }
      // Activate selected if it was inactive
      if (!currentState) {
        await pb.collection("spmb_periods").update(id, { is_active: true });
      }
      fetchPeriods();
    } catch (error) {
      console.error("Failed to toggle:", error);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", start_date: "", end_date: "", quota: "", is_active: false });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const activePeriod = periods.find(p => p.is_active);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Periode SPMB</h1>
          <p className="text-muted-foreground">Kelola periode penerimaan siswa baru</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setIsLoading(true); fetchPeriods(); }}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => resetForm()}>
                <Plus className="h-4 w-4" />
                Tambah Periode
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Periode" : "Tambah Periode Baru"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Perbarui informasi periode SPMB" : "Buat periode pendaftaran baru"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Periode</Label>
                  <Input
                    id="name"
                    placeholder="contoh: SPMB 2024/2025"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Tanggal Mulai</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Tanggal Selesai</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quota">Kuota Pendaftaran</Label>
                  <Input
                    id="quota"
                    type="number"
                    placeholder="120"
                    value={formData.quota}
                    onChange={(e) => setFormData({ ...formData, quota: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Status Aktif</Label>
                    <p className="text-sm text-muted-foreground">
                      Periode aktif akan ditampilkan ke publik
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>Batal</Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingId ? "Simpan Perubahan" : "Buat Periode"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Active Period Card */}
      {isLoading ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : activePeriod ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <CardTitle className="text-lg">Periode Aktif</CardTitle>
            </div>
            <CardDescription>{activePeriod.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Mulai</p>
                <p className="font-medium">
                  {activePeriod.start_date ? new Date(activePeriod.start_date).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric"
                  }) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selesai</p>
                <p className="font-medium">
                  {activePeriod.end_date ? new Date(activePeriod.end_date).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric"
                  }) : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kuota</p>
                <p className="font-medium">{activePeriod.quota || 100} siswa</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terdaftar</p>
                <p className="font-medium">{activePeriod.registered || 0} siswa</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {Math.round(((activePeriod.registered || 0) / (activePeriod.quota || 100)) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(((activePeriod.registered || 0) / (activePeriod.quota || 100)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground">Tidak ada periode aktif. Buat atau aktifkan periode untuk membuka pendaftaran.</p>
          </CardContent>
        </Card>
      )}

      {/* Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle>Semua Periode</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Periode</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kuota</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : periods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada periode. Klik "Tambah Periode" untuk membuat baru.
                  </TableCell>
                </TableRow>
              ) : (
                periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {period.start_date ? new Date(period.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"} - {period.end_date ? new Date(period.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </TableCell>
                    <TableCell>{period.quota || 100}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {period.registered || 0}
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(((period.registered || 0) / (period.quota || 100)) * 100)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={period.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-700"}
                      >
                        {period.is_active ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Aktif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Nonaktif
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(period)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(period.id, period.is_active)}>
                            {period.is_active ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Nonaktifkan
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Aktifkan
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(period.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Periode?</AlertDialogTitle>
            <AlertDialogDescription>
              Periode akan dihapus permanen. Pastikan tidak ada pendaftar yang terhubung dengan periode ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
