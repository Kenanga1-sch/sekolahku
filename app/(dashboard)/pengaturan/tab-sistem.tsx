"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Compass, GraduationCap, ShieldCheck, MapPin, Plus, Trash2, Loader2 } from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { attendancePointsApi, type AttendancePoint } from "@/lib/presensi-gtk";

interface TabSistemProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function TabSistem({ settings, setSettings }: TabSistemProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [points, setPoints] = useState<AttendancePoint[]>([]);
  const [newPoint, setNewPoint] = useState({ name: "", latitude: "", longitude: "", radiusM: "100" });
  const [pointBusy, setPointBusy] = useState(false);

  const loadPoints = () => {
    attendancePointsApi
      .list()
      .then((res: any) => setPoints(res?.data || []))
      .catch(() => showError("Gagal memuat titik presensi"));
  };

  const addPoint = async () => {
    if (!newPoint.name.trim() || !newPoint.latitude || !newPoint.longitude) {
      showError("Nama, latitude & longitude wajib diisi");
      return;
    }
    setPointBusy(true);
    try {
      await attendancePointsApi.create({
        name: newPoint.name.trim(),
        pointType: "custom",
        latitude: parseFloat(newPoint.latitude),
        longitude: parseFloat(newPoint.longitude),
        radiusM: parseInt(newPoint.radiusM) || 100,
        isActive: true,
      });
      showSuccess("Titik presensi ditambahkan");
      setNewPoint({ name: "", latitude: "", longitude: "", radiusM: "100" });
      loadPoints();
    } catch (e: any) {
      showError(e?.message || "Gagal menambah titik");
    } finally {
      setPointBusy(false);
    }
  };

  const updatePoint = async (id: string, patch: Partial<AttendancePoint>) => {
    try {
      await attendancePointsApi.update(id, patch);
      showSuccess("Titik presensi diperbarui");
      loadPoints();
    } catch (e: any) {
      showError(e?.message || "Gagal memperbarui titik");
    }
  };

  const removePoint = async (id: string) => {
    if (!confirm("Hapus titik presensi ini?")) return;
    try {
      await attendancePointsApi.remove(id);
      showSuccess("Titik presensi dihapus");
      loadPoints();
    } catch (e: any) {
      showError(e?.message || "Gagal menghapus titik (titik sekolah tak bisa dihapus)");
    }
  };

  useEffect(() => {
    // Fetch GTK/Employees for treasurer list
    goGet("/api/master/employees?limit=200").then((res: any) => {
      setEmployees(res?.data || res || []);
    }).catch(err => {
      console.error("Error fetching employees:", err);
      showError("Gagal memuat daftar pegawai");
    });

    // Fetch Academic Years list
    goGet("/api/academic/years").then((res: any) => {
      setAcademicYears(res || []);
    }).catch(err => {
      console.error("Error fetching academic years:", err);
      showError("Gagal memuat daftar tahun ajaran");
    });

    loadPoints();
  }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      
      {/* 1. Academic & SPMB Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-600">
            <GraduationCap className="h-5 w-5" />
            Konfigurasi Akademik & SPMB
          </CardTitle>
          <CardDescription>
            Pengaturan Tahun Ajaran aktif dan penerimaan siswa baru.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Tahun Akademik */}
          <div className="space-y-2">
            <Label htmlFor="current_academic_year">Tahun Ajaran Aktif</Label>
            <select
              id="current_academic_year"
              value={settings.current_academic_year || ""}
              onChange={(e) =>
                setSettings((prev: any) => ({ ...prev, current_academic_year: e.target.value }))
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">-- Pilih Tahun Ajaran --</option>
              {academicYears.length > 0 ? (
                // Unique values by name
                Array.from(new Set(academicYears.map((item: any) => item.name))).map((yearName: any) => (
                  <option key={yearName} value={yearName}>{yearName}</option>
                ))
              ) : (
                <option value={settings.current_academic_year}>{settings.current_academic_year}</option>
              )}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Menentukan Tahun Ajaran berjalan saat ini untuk seluruh sistem sekolah.
            </p>
          </div>

          {/* SPMB is open */}
          <div className="flex items-center justify-between rounded-lg border p-4 bg-slate-50/50 dark:bg-zinc-900/40">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Status Pendaftaran SPMB</Label>
              <p className="text-xs text-muted-foreground">
                {settings.spmb_is_open ? "Pendaftaran Online DIBUKA" : "Pendaftaran Online DITUTUP"}
              </p>
            </div>
            <Switch
              checked={settings.spmb_is_open}
              onCheckedChange={(checked) =>
                setSettings((prev: any) => ({ ...prev, spmb_is_open: checked }))
              }
            />
          </div>

        </CardContent>
      </Card>

      {/* 2. Zoning & Savings Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-600">
            <Compass className="h-5 w-5" />
            Zonasi & Keuangan
          </CardTitle>
          <CardDescription>
            Batas wilayah SPMB jalur domisili dan konfigurasi bendahara.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Max distance for Zoning */}
          <div className="space-y-2">
            <Label htmlFor="max_distance_km">Jarak Maksimal Prioritas Domisili (km)</Label>
            <Input
              id="max_distance_km"
              type="number"
              step="0.1"
              value={settings.max_distance_km || 3}
              onChange={(e) =>
                setSettings((prev: any) => ({ ...prev, max_distance_km: parseFloat(e.target.value) || 3 }))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Jarak batas zonasi dari koordinat sekolah dalam kilometer untuk pendaftaran SPMB.
            </p>
          </div>

          {/* Savings Treasurer */}
          <div className="space-y-2">
            <Label htmlFor="savings_treasurer_id">Bendahara Tabungan</Label>
            <select
              id="savings_treasurer_id"
              value={settings.savings_treasurer_id || ""}
              onChange={(e) =>
                setSettings((prev: any) => ({ ...prev, savings_treasurer_id: e.target.value }))
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">-- Pilih Bendahara --</option>
              {Array.isArray(employees) && employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName || emp.name} ({emp.jobType || emp.role || "GTK"})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Guru/Staf yang ditunjuk mengelola verifikasi tabungan siswa di sekolah.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* 3. System Management & Coordinates */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
            Keamanan Sistem & Koordinat
          </CardTitle>
          <CardDescription>
            Konfigurasi koordinat geospesifik sekolah dan mode darurat aplikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Coordinates */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school_lat">Garis Lintang (Latitude)</Label>
              <Input
                id="school_lat"
                type="number"
                step="0.000001"
                value={settings.school_lat || -6.2}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, school_lat: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_lng">Garis Bujur (Longitude)</Label>
              <Input
                id="school_lng"
                type="number"
                step="0.000001"
                value={settings.school_lng || 106.816666}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, school_lng: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          {/* Principal Info */}
          <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="principal_name">Nama Kepala Sekolah</Label>
              <Input
                id="principal_name"
                value={settings.principal_name || ""}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, principal_name: e.target.value }))
                }
                placeholder="Dr. H. Contoh, M.Pd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="principal_nip">NIP Kepala Sekolah</Label>
              <Input
                id="principal_nip"
                value={settings.principal_nip || ""}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, principal_nip: e.target.value }))
                }
                placeholder="19800101 200501 1 001"
              />
            </div>
          </div>

          {/* Supervisor Info */}
          <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="supervisor_name">Nama Pengawas</Label>
              <Input
                id="supervisor_name"
                value={settings.supervisor_name || ""}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, supervisor_name: e.target.value }))
                }
                placeholder="Drs. H. Pengawas, M.Pd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_nip">NIP Pengawas</Label>
              <Input
                id="supervisor_nip"
                value={settings.supervisor_nip || ""}
                onChange={(e) =>
                  setSettings((prev: any) => ({ ...prev, supervisor_nip: e.target.value }))
                }
                placeholder="19700101 200501 1 002"
              />
            </div>
          </div>

          {/* Maintenance Mode */}
          <div className={`flex items-center justify-between rounded-lg border-l-4 p-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/10`}>
            <div className="space-y-1">
              <Label className="text-base font-semibold flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> Mode Pemeliharaan (Maintenance)
              </Label>
              <p className="text-xs text-muted-foreground">
                Mengunci seluruh halaman publik. Hanya admin yang dapat masuk dan mengakses dashboard.
              </p>
            </div>
            <Switch
              checked={settings.is_maintenance || false}
              onCheckedChange={(checked) =>
                setSettings((prev: any) => ({ ...prev, is_maintenance: checked }))
              }
            />
          </div>

        </CardContent>
      </Card>

      {/* Titik & Radius Presensi GTK */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-600">
            <MapPin className="h-5 w-5" />
            Titik & Radius Presensi GTK
          </CardTitle>
          <CardDescription>
            Titik lokasi untuk validasi radius saat scan presensi GTK (honorer & pembina ekskul).
            Koordinat sekolah di atas dipakai sebagai titik default bila belum diatur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada titik presensi.</p>
          ) : (
            <div className="space-y-2">
              {points.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{p.name}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {p.pointType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {p.latitude}, {p.longitude}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Radius (m)</Label>
                    <Input
                      type="number"
                      className="w-24 h-8"
                      defaultValue={p.radiusM}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value) || 100;
                        if (v !== p.radiusM) updatePoint(p.id, { radiusM: v });
                      }}
                    />
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(checked) => updatePoint(p.id, { isActive: checked })}
                    />
                    {p.pointType !== "sekolah" && (
                      <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => removePoint(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-slate-600">Tambah Titik Presensi</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                placeholder="Nama titik (mis. Lapangan)"
                value={newPoint.name}
                onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
              />
              <Input
                type="number"
                step="0.000001"
                placeholder="Latitude"
                value={newPoint.latitude}
                onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })}
              />
              <Input
                type="number"
                step="0.000001"
                placeholder="Longitude"
                value={newPoint.longitude}
                onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Radius (m)"
                value={newPoint.radiusM}
                onChange={(e) => setNewPoint({ ...newPoint, radiusM: e.target.value })}
              />
            </div>
            <Button type="button" size="sm" onClick={addPoint} disabled={pointBusy}>
              {pointBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Tambah Titik
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
