"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, GraduationCap, Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PhotoUpload } from "@/components/alumni/photo-upload";

const alumniFormSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  nisn: z.string().optional(),
  nis: z.string().optional(),
  gender: z.enum(["L", "P"]).optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
  graduationYear: z.string().min(1, "Tahun lulus wajib diisi"),
  graduationDate: z.string().optional(),
  finalClass: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  currentAddress: z.string().optional(),
  currentPhone: z.string().optional(),
  currentEmail: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  nextSchool: z.string().optional(),
  notes: z.string().optional(),
});

type AlumniFormData = z.infer<typeof alumniFormSchema>;

export default function EditAlumniPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alumniName, setAlumniName] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [yearOpen, setYearOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AlumniFormData>({
    resolver: zodResolver(alumniFormSchema),
  });

  // Fetch existing alumni data
  useEffect(() => {
    const fetchAlumni = async () => {
      try {
        const response = await fetch(`/api/alumni/${params.id}`);
        if (!response.ok) throw new Error("Alumni not found");
        const data = await response.json();

        // Pre-fill form with existing data
        setAlumniName(data.fullName || "");
        setCurrentPhoto(data.photo || null);
        reset({
          fullName: data.fullName || "",
          nisn: data.nisn || "",
          nis: data.nis || "",
          gender: data.gender || undefined,
          birthPlace: data.birthPlace || "",
          birthDate: data.birthDate || "",
          graduationYear: data.graduationYear || "",
          graduationDate: data.graduationDate ? new Date(data.graduationDate).toISOString().split("T")[0] : "",
          finalClass: data.finalClass || "",
          parentName: data.parentName || "",
          parentPhone: data.parentPhone || "",
          currentAddress: data.currentAddress || "",
          currentPhone: data.currentPhone || "",
          currentEmail: data.currentEmail || "",
          nextSchool: data.nextSchool || "",
          notes: data.notes || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        setFetching(false);
      }
    };

    if (params.id) {
      fetchAlumni();
    }
  }, [params.id, reset]);

  const onSubmit = async (data: AlumniFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/alumni/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update alumni");
      }

      router.push(`/arsip-alumni/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Generate graduation year options (from 1980 to next year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1980 + 2 }, (_, i) => {
    return (currentYear - i + 1).toString();
  });

  if (fetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/arsip-alumni/${params.id}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Edit Alumni
          </h1>
          <p className="text-muted-foreground">
            Perbarui data alumni
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Foto Alumni */}
        <Card>
          <CardHeader>
            <CardTitle>Foto Alumni</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PhotoUpload
              alumniId={params.id as string}
              currentPhoto={currentPhoto}
              alumniName={alumniName}
              onPhotoChange={setCurrentPhoto}
            />
          </CardContent>
        </Card>

        {/* Data Diri */}
        <Card>
          <CardHeader>
            <CardTitle>Data Diri</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="fullName">Nama Lengkap *</Label>
              <Input
                id="fullName"
                {...register("fullName")}
                placeholder="Masukkan nama lengkap"
                className={errors.fullName ? "border-red-500" : ""}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="nisn">NISN</Label>
              <Input
                id="nisn"
                {...register("nisn")}
                placeholder="Nomor Induk Siswa Nasional"
              />
            </div>

            <div>
              <Label htmlFor="nis">NIS</Label>
              <Input
                id="nis"
                {...register("nis")}
                placeholder="Nomor Induk Sekolah"
              />
            </div>

            <div>
              <Label htmlFor="gender">Jenis Kelamin</Label>
              <Select
                value={watch("gender") || ""}
                onValueChange={(value) => setValue("gender", value as "L" | "P")}
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

            <div>
              <Label htmlFor="birthPlace">Tempat Lahir</Label>
              <Input
                id="birthPlace"
                {...register("birthPlace")}
                placeholder="Kota kelahiran"
              />
            </div>

            <div>
              <Label htmlFor="birthDate">Tanggal Lahir</Label>
              <Input
                id="birthDate"
                type="date"
                {...register("birthDate")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Kelulusan */}
        <Card>
          <CardHeader>
            <CardTitle>Data Kelulusan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="graduationYear">Tahun Lulus *</Label>
              <Popover open={yearOpen} onOpenChange={setYearOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={yearOpen}
                    className={cn(
                      "w-full justify-between",
                      !watch("graduationYear") && "text-muted-foreground",
                      errors.graduationYear && "border-red-500"
                    )}
                  >
                    {watch("graduationYear")
                      ? yearOptions.find((year) => year === watch("graduationYear"))
                      : "Pilih tahun lulus"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Cari tahun..." />
                    <CommandList>
                      <CommandEmpty>Tahun tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {yearOptions.map((year) => (
                          <CommandItem
                            key={year}
                            value={year}
                            onSelect={(currentValue) => {
                              setValue("graduationYear", currentValue);
                              setYearOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                watch("graduationYear") === year ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {year}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.graduationYear && (
                <p className="text-sm text-red-500 mt-1">{errors.graduationYear.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="graduationDate">Tanggal Kelulusan</Label>
              <Input
                id="graduationDate"
                type="date"
                {...register("graduationDate")}
              />
            </div>

            <div>
              <Label htmlFor="finalClass">Kelas Terakhir</Label>
              <Input
                id="finalClass"
                {...register("finalClass")}
                placeholder="Contoh: 6A"
              />
            </div>

            <div>
              <Label htmlFor="nextSchool">Sekolah Lanjutan</Label>
              <Input
                id="nextSchool"
                {...register("nextSchool")}
                placeholder="Nama SMP tujuan"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Orang Tua */}
        <Card>
          <CardHeader>
            <CardTitle>Data Orang Tua / Wali</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="parentName">Nama Orang Tua</Label>
              <Input
                id="parentName"
                {...register("parentName")}
                placeholder="Nama orang tua atau wali"
              />
            </div>

            <div>
              <Label htmlFor="parentPhone">Telepon Orang Tua</Label>
              <Input
                id="parentPhone"
                {...register("parentPhone")}
                placeholder="Nomor telepon"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kontak Alumni */}
        <Card>
          <CardHeader>
            <CardTitle>Kontak Alumni (Opsional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currentPhone">Telepon</Label>
              <Input
                id="currentPhone"
                {...register("currentPhone")}
                placeholder="Nomor telepon alumni"
              />
            </div>

            <div>
              <Label htmlFor="currentEmail">Email</Label>
              <Input
                id="currentEmail"
                type="email"
                {...register("currentEmail")}
                placeholder="Email alumni"
                className={errors.currentEmail ? "border-red-500" : ""}
              />
              {errors.currentEmail && (
                <p className="text-sm text-red-500 mt-1">{errors.currentEmail.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="currentAddress">Alamat Saat Ini</Label>
              <Textarea
                id="currentAddress"
                {...register("currentAddress")}
                placeholder="Alamat lengkap"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href={`/arsip-alumni/${params.id}`}>
            <Button type="button" variant="outline">
              Batal
            </Button>
          </Link>
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
