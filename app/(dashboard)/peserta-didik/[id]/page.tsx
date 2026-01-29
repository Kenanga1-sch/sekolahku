"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Printer,
  QrCode,
  User,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
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
  enrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DetailSiswaPage() {
  const router = useRouter();
  const params = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await fetch(`/api/students/${params.id}`);
        const data = await response.json();

        if (response.ok) {
          setStudent(data);
        } else {
          toast.error(data.error || "Gagal memuat data");
          router.push("/peserta-didik");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchStudent();
    }
  }, [params.id, router]);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/students/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Peserta didik berhasil dihapus");
        router.push("/peserta-didik");
      } else {
        toast.error("Gagal menghapus peserta didik");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Peserta didik tidak ditemukan</p>
        <Button onClick={() => router.push("/peserta-didik")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detail Peserta Didik</h1>
            <p className="text-muted-foreground">
              Informasi lengkap peserta didik
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/peserta-didik/cetak-kartu?ids=${student.id}`)}
          >
            <Printer className="h-4 w-4 mr-2" />
            Cetak Kartu
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/peserta-didik/${student.id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-32 w-32 border-4 border-muted">
                <AvatarImage src={student.photo || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-3xl">
                  {student.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-xl font-bold">{student.fullName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{student.className || "-"}</Badge>
                {student.isActive ? (
                  <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                ) : (
                  <Badge variant="secondary">Non-Aktif</Badge>
                )}
              </div>

              <Separator className="my-6" />

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Code Universal
                </p>
                <div className="p-3 bg-white rounded-lg shadow-inner border">
                  <QRCodeSVG value={student.qrCode} size={140} level="H" />
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {student.qrCode}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="md:col-span-2 space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Identitas Siswa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">NISN</dt>
                  <dd className="font-medium font-mono">{student.nisn || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">NIS</dt>
                  <dd className="font-medium font-mono">{student.nis || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Jenis Kelamin</dt>
                  <dd className="font-medium">
                    {student.gender === "L"
                      ? "Laki-laki"
                      : student.gender === "P"
                      ? "Perempuan"
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Kelas</dt>
                  <dd className="font-medium">{student.className || "-"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Birth Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Data Kelahiran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Tempat Lahir</dt>
                  <dd className="font-medium">{student.birthPlace || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Tanggal Lahir</dt>
                  <dd className="font-medium">{formatDate(student.birthDate)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Alamat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{student.address || "Belum diisi"}</p>
            </CardContent>
          </Card>

          {/* Parent Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Data Orang Tua/Wali
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Nama Orang Tua/Wali</dt>
                  <dd className="font-medium">{student.parentName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">No. HP</dt>
                  <dd className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {student.parentPhone || "-"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Peserta Didik?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data{" "}
              <strong>{student.fullName}</strong> akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
