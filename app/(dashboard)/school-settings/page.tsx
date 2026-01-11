"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  School,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import type { SchoolSettings } from "@/types";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    school_name: "",
    school_npsn: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    school_website: "",
    school_lat: -6.2,
    school_lng: 106.816666,
    max_distance_km: 3,
    spmb_is_open: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const records = await pb.collection("school_settings").getFullList<SchoolSettings>({
        sort: "-created",
      });

      if (records.length > 0) {
        const record = records[0];
        setSettingsId(record.id);
        setSettings({
          school_name: record.school_name || "",
          school_npsn: record.school_npsn || "",
          school_address: record.school_address || "",
          school_phone: record.school_phone || "",
          school_email: record.school_email || "",
          school_website: record.school_website || "",
          school_lat: record.school_lat || -6.2,
          school_lng: record.school_lng || 106.816666,
          max_distance_km: record.max_distance_km || 3,
          spmb_is_open: record.spmb_is_open ?? true,
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (settingsId) {
        // Update existing
        await pb.collection("school_settings").update(settingsId, settings);
      } else {
        // Create new
        const record = await pb.collection("school_settings").create(settings);
        setSettingsId(record.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Gagal menyimpan pengaturan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan Sekolah</h1>
          <p className="text-muted-foreground">
            Kelola informasi dan konfigurasi sekolah
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Perubahan
          </Button>
        </div>
      </div>

      {saved && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Pengaturan berhasil disimpan!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* School Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              Informasi Sekolah
            </CardTitle>
            <CardDescription>
              Data dasar sekolah yang tampil di website
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">Nama Sekolah</Label>
              <Input
                id="school_name"
                value={settings.school_name}
                onChange={(e) =>
                  setSettings({ ...settings, school_name: e.target.value })
                }
                placeholder="SD Negeri 1 Contoh"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_npsn">NPSN</Label>
              <Input
                id="school_npsn"
                value={settings.school_npsn}
                onChange={(e) =>
                  setSettings({ ...settings, school_npsn: e.target.value })
                }
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_address">Alamat Lengkap</Label>
              <Textarea
                id="school_address"
                value={settings.school_address}
                onChange={(e) =>
                  setSettings({ ...settings, school_address: e.target.value })
                }
                placeholder="Jl. Pendidikan No. 123..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Informasi Kontak
            </CardTitle>
            <CardDescription>
              Nomor telepon, email, dan website sekolah
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_phone">Nomor Telepon</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school_phone"
                  className="pl-10"
                  value={settings.school_phone}
                  onChange={(e) =>
                    setSettings({ ...settings, school_phone: e.target.value })
                  }
                  placeholder="(021) 1234-5678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school_email"
                  type="email"
                  className="pl-10"
                  value={settings.school_email}
                  onChange={(e) =>
                    setSettings({ ...settings, school_email: e.target.value })
                  }
                  placeholder="info@sekolah.sch.id"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_website">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="school_website"
                  className="pl-10"
                  value={settings.school_website}
                  onChange={(e) =>
                    setSettings({ ...settings, school_website: e.target.value })
                  }
                  placeholder="https://sekolah.sch.id"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Lokasi & Zonasi
            </CardTitle>
            <CardDescription>
              Koordinat sekolah dan radius zonasi SPMB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_lat">Latitude</Label>
                <Input
                  id="school_lat"
                  type="number"
                  step="0.000001"
                  value={settings.school_lat}
                  onChange={(e) =>
                    setSettings({ ...settings, school_lat: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_lng">Longitude</Label>
                <Input
                  id="school_lng"
                  type="number"
                  step="0.000001"
                  value={settings.school_lng}
                  onChange={(e) =>
                    setSettings({ ...settings, school_lng: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_distance_km">Radius Zonasi (km)</Label>
              <Input
                id="max_distance_km"
                type="number"
                step="0.1"
                value={settings.max_distance_km}
                onChange={(e) =>
                  setSettings({ ...settings, max_distance_km: parseFloat(e.target.value) || 3 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Jarak maksimal dari sekolah untuk masuk zona prioritas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SPMB Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              Pengaturan SPMB
            </CardTitle>
            <CardDescription>
              Konfigurasi pendaftaran siswa baru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Status Pendaftaran</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.spmb_is_open ? "Pendaftaran dibuka untuk publik" : "Pendaftaran ditutup"}
                </p>
              </div>
              <Switch
                checked={settings.spmb_is_open}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, spmb_is_open: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
