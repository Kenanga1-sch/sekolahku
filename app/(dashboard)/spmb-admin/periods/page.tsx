"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

// Mock periods data
const initialPeriods = [
  {
    id: "1",
    name: "SPMB 2024/2025",
    startDate: "2024-01-01",
    endDate: "2024-03-31",
    isActive: true,
    quota: 120,
    registered: 85,
  },
  {
    id: "2",
    name: "SPMB 2023/2024",
    startDate: "2023-01-01",
    endDate: "2023-03-31",
    isActive: false,
    quota: 120,
    registered: 118,
  },
  {
    id: "3",
    name: "SPMB 2022/2023",
    startDate: "2022-01-01",
    endDate: "2022-03-31",
    isActive: false,
    quota: 100,
    registered: 100,
  },
];

export default function SPMBPeriodsPage() {
  const [periods, setPeriods] = useState(initialPeriods);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    quota: "",
    isActive: false,
  });

  const handleSubmit = () => {
    if (editingId) {
      setPeriods(periods.map(p =>
        p.id === editingId
          ? {
              ...p,
              name: formData.name,
              startDate: formData.startDate,
              endDate: formData.endDate,
              quota: parseInt(formData.quota) || 0,
              isActive: formData.isActive,
            }
          : p
      ));
    } else {
      const newPeriod = {
        id: Date.now().toString(),
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        quota: parseInt(formData.quota) || 0,
        isActive: formData.isActive,
        registered: 0,
      };
      setPeriods([newPeriod, ...periods]);
    }
    resetForm();
  };

  const handleEdit = (item: typeof initialPeriods[0]) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      quota: item.quota.toString(),
      isActive: item.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPeriods(periods.filter(p => p.id !== id));
  };

  const toggleActive = (id: string) => {
    setPeriods(periods.map(p => ({
      ...p,
      isActive: p.id === id ? !p.isActive : false,
    })));
  };

  const resetForm = () => {
    setFormData({ name: "", startDate: "", endDate: "", quota: "", isActive: false });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const activePeriod = periods.find(p => p.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Periode SPMB</h1>
          <p className="text-muted-foreground">Kelola periode penerimaan siswa baru</p>
        </div>
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
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Tanggal Selesai</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Batal</Button>
              <Button onClick={handleSubmit}>
                {editingId ? "Simpan Perubahan" : "Buat Periode"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Period Card */}
      {activePeriod && (
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
                  {new Date(activePeriod.startDate).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selesai</p>
                <p className="font-medium">
                  {new Date(activePeriod.endDate).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kuota</p>
                <p className="font-medium">{activePeriod.quota} siswa</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terdaftar</p>
                <p className="font-medium">{activePeriod.registered} siswa</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round((activePeriod.registered / activePeriod.quota) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(activePeriod.registered / activePeriod.quota) * 100}%` }}
                />
              </div>
            </div>
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
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(period.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {new Date(period.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>{period.quota}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {period.registered}
                      <span className="text-xs text-muted-foreground">
                        ({Math.round((period.registered / period.quota) * 100)}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={period.isActive ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-700"}
                    >
                      {period.isActive ? (
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
                        <DropdownMenuItem onClick={() => toggleActive(period.id)}>
                          {period.isActive ? (
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
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(period.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
