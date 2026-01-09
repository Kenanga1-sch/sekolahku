"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Mock data - will be fetched from PocketBase
  const [settings, setSettings] = useState({
    school_name: "SD Negeri 1 Contoh",
    school_npsn: "12345678",
    school_address: "Jl. Pendidikan No. 123, Kelurahan Sukamaju, Kecamatan Kota Utara",
    school_phone: "(021) 1234-5678",
    school_email: "info@sdnegeri1.sch.id",
    school_lat: -6.2,
    school_lng: 106.816666,
    max_distance_km: 3,
    spmb_is_open: true,
  });

  const handleSave = async () => {
    setIsLoading(true);
    // TODO: Save to PocketBase
    await new Promise((r) => setTimeout(r, 1000));
    setIsLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

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
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Perubahan
        </Button>
      </div>

      {saved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Pengaturan berhasil disimpan!
          </AlertDescription>
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_phone">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Telepon
                </Label>
                <Input
                  id="school_phone"
                  value={settings.school_phone}
                  onChange={(e) =>
                    setSettings({ ...settings, school_phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_email">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="school_email"
                  type="email"
                  value={settings.school_email}
                  onChange={(e) =>
                    setSettings({ ...settings, school_email: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & SPMB */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Lokasi & Zonasi
              </CardTitle>
              <CardDescription>
                Koordinat sekolah untuk perhitungan zonasi SPMB
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
                      setSettings({
                        ...settings,
                        school_lat: parseFloat(e.target.value),
                      })
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
                      setSettings({
                        ...settings,
                        school_lng: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_distance_km">Radius Zonasi (KM)</Label>
                <Input
                  id="max_distance_km"
                  type="number"
                  step="0.5"
                  value={settings.max_distance_km}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_distance_km: parseFloat(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Pendaftar dalam radius ini mendapat prioritas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Pengaturan SPMB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Buka Pendaftaran SPMB</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktifkan untuk membuka pendaftaran siswa baru
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
    </div>
  );
}
