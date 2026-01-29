"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Loader2, Upload, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

const CLASS_OPTIONS = [
  "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B",
];

interface Student {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  birthDate: string | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  className: string | null;
  photo: string | null;
  qrCode: string;
  isActive: boolean;
}

export default function EditSiswaPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nisn: "",
    nis: "",
    fullName: "",
    gender: "",
    birthPlace: "",
    birthDate: "",
    address: "",
    parentName: "",
    parentPhone: "",
    className: "",
    photo: "",
    isActive: true,
  });

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await fetch(`/api/students/${params.id}`);
        const data: Student = await response.json();

        if (response.ok) {
          setFormData({
            nisn: data.nisn || "",
            nis: data.nis || "",
            fullName: data.fullName,
            gender: data.gender || "",
            birthPlace: data.birthPlace || "",
            birthDate: data.birthDate || "",
            address: data.address || "",
            parentName: data.parentName || "",
            parentPhone: data.parentPhone || "",
            className: data.className || "",
            photo: data.photo || "",
            isActive: data.isActive,
          });
          setPhotoPreview(data.photo);
        } else {
          toast.error("Gagal memuat data");
          router.push("/peserta-didik");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      } finally {
        setFetching(false);
      }
    };

    if (params.id) {
      fetchStudent();
    }
  }, [params.id, router]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/students/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Data peserta didik berhasil diperbarui");
        router.push(`/peserta-didik/${params.id}`);
      } else {
        toast.error(data.error || "Gagal memperbarui data");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Peserta Didik</h1>
          <p className="text-muted-foreground">
            Perbarui data peserta didik
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Photo Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Foto Siswa</CardTitle>
              <CardDescription>
                Upload foto formal ukuran 3x4
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Avatar className="h-40 w-40 border-4 border-muted">
                <AvatarImage src={photoPreview || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-4xl">
                  {formData.fullName ? (
                    formData.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  ) : (
                    <User className="h-16 w-16" />
                  )}
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="photo"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Ganti Foto</span>
              </Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Data Peserta Didik</CardTitle>
              <CardDescription>
                Edit data peserta didik
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identity */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nisn">NISN</Label>
                  <Input
                    id="nisn"
                    placeholder="Nomor Induk Siswa Nasional"
                    value={formData.nisn}
                    onChange={(e) => handleChange("nisn", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nis">NIS</Label>
                  <Input
                    id="nis"
                    placeholder="Nomor Induk Sekolah"
                    value={formData.nis}
                    onChange={(e) => handleChange("nis", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Nama Lengkap <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="Nama lengkap sesuai akta kelahiran"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gender">Jenis Kelamin</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => handleChange("gender", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="className">Kelas</Label>
                  <Select
                    value={formData.className}
                    onValueChange={(v) => handleChange("className", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_OPTIONS.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Birth Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthPlace">Tempat Lahir</Label>
                  <Input
                    id="birthPlace"
                    placeholder="Kota tempat lahir"
                    value={formData.birthPlace}
                    onChange={(e) => handleChange("birthPlace", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Tanggal Lahir</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleChange("birthDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Textarea
                  id="address"
                  placeholder="Alamat lengkap"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  rows={3}
                />
              </div>

              {/* Parent Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="parentName">Nama Orang Tua/Wali</Label>
                  <Input
                    id="parentName"
                    placeholder="Nama orang tua atau wali"
                    value={formData.parentName}
                    onChange={(e) => handleChange("parentName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentPhone">No. HP Orang Tua/Wali</Label>
                  <Input
                    id="parentPhone"
                    placeholder="08xxxxxxxxxx"
                    value={formData.parentPhone}
                    onChange={(e) => handleChange("parentPhone", e.target.value)}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Status Aktif</Label>
                  <p className="text-sm text-muted-foreground">
                    Siswa aktif akan muncul di semua modul
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => handleChange("isActive", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
