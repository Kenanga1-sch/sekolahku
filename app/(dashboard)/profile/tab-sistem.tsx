"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Compass, GraduationCap, ShieldCheck } from "lucide-react";
import { goGet } from "@/lib/api-client";

interface TabSistemProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function TabSistem({ settings, setSettings }: TabSistemProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  useEffect(() => {
    // Fetch GTK/Employees for treasurer list
    goGet("/api/master/employees?limit=200").then((res: any) => {
      setEmployees(res?.data || res || []);
    }).catch(err => console.error("Error fetching employees:", err));

    // Fetch Academic Years list
    goGet("/api/academic/years").then((res: any) => {
      setAcademicYears(res || []);
    }).catch(err => console.error("Error fetching academic years:", err));
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

    </div>
  );
}
