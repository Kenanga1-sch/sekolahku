"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { School, MapPin, Phone, Mail, Globe, Loader2 } from "lucide-react";
import { goPost } from "@/lib/api-client";
import { compressImage } from "@/lib/utils";

interface TabProfilProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function TabProfil({ settings, setSettings }: TabProfilProps) {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File terlalu besar. Maksimal 5MB.");
      return;
    }

    setIsUploadingLogo(true);
    setUploadError(null);

    try {
      // Compress logo to WebP
      const compressed = await compressImage(file, 512, 0.85);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("folder", "logo");

      const response: any = await goPost("/api/upload", formData);
      if (response && response.success) {
        const logoPath = response.url ? response.url.replace(/^\/uploads\//, "") : "";
        setSettings((prev: any) => ({ ...prev, school_logo: logoPath }));
      } else {
        setUploadError(response?.error || "Gagal mengunggah logo");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Terjadi kesalahan saat mengunggah logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* School Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-indigo-600" />
            Informasi Sekolah
          </CardTitle>
          <CardDescription>
            Data dasar sekolah yang tampil di website publik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
            <div className="h-20 w-20 relative rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
              {settings.school_logo ? (
                <img
                  src={settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/")
                    ? settings.school_logo
                    : `/uploads/${settings.school_logo}`}
                  alt="Logo Sekolah"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <School className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="logo-upload" className="text-sm font-semibold">Logo Sekolah</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  className="cursor-pointer"
                />
                {isUploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              <p className="text-[10px] text-muted-foreground">
                Format: PNG, JPG, WebP. Maksimal 5MB. Otomatis dikompresi ke format WebP.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="school_name">Nama Sekolah</Label>
            <Input
              id="school_name"
              value={settings.school_name}
              onChange={(e) =>
                setSettings((prev: any) => ({ ...prev, school_name: e.target.value }))
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
                setSettings((prev: any) => ({ ...prev, school_npsn: e.target.value }))
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
                setSettings((prev: any) => ({ ...prev, school_address: e.target.value }))
              }
              placeholder="Jl. Pendidikan No. 123..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-indigo-600" />
            Informasi Kontak
          </CardTitle>
          <CardDescription>
            Nomor telepon, email, dan website sekolah.
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
                  setSettings((prev: any) => ({ ...prev, school_phone: e.target.value }))
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
                  setSettings((prev: any) => ({ ...prev, school_email: e.target.value }))
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
                  setSettings((prev: any) => ({ ...prev, school_website: e.target.value }))
                }
                placeholder="https://sekolah.sch.id"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
