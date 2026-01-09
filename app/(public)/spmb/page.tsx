import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  Calendar,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  Users,
  Search,
  HelpCircle,
} from "lucide-react";

// Timeline steps
const timelineSteps = [
  {
    step: 1,
    title: "Pendaftaran Online",
    description: "Isi formulir pendaftaran dan upload dokumen yang diperlukan.",
    icon: FileText,
  },
  {
    step: 2,
    title: "Verifikasi Berkas",
    description: "Tim kami akan memverifikasi data dan dokumen Anda.",
    icon: Search,
  },
  {
    step: 3,
    title: "Pengumuman Hasil",
    description: "Cek status penerimaan melalui halaman tracking.",
    icon: CheckCircle,
  },
  {
    step: 4,
    title: "Daftar Ulang",
    description: "Lakukan daftar ulang di sekolah dengan membawa dokumen asli.",
    icon: Users,
  },
];

// Requirements
const requirements = [
  "Fotokopi Kartu Keluarga (KK)",
  "Fotokopi Akta Kelahiran",
  "Pas Foto 3x4 (latar merah)",
  "Fotokopi KTP Orang Tua/Wali",
  "Surat Keterangan dari TK/RA (jika ada)",
];

export default function SPMBPage() {
  // TODO: Fetch from PocketBase school_settings
  const isOpen = true;
  const period = {
    name: "Gelombang 1",
    academic_year: "2024/2025",
    start_date: "2024-01-15",
    end_date: "2024-02-28",
    quota: 100,
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white py-16">
        <div className="container">
          <div className="max-w-3xl space-y-4">
            <Badge className="bg-white/20 text-white">
              <Calendar className="h-3 w-3 mr-1" />
              {period.academic_year}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold">
              Penerimaan Siswa Baru
            </h1>
            <p className="text-lg text-white/80">
              Sistem Penerimaan Murid Baru (SPMB) SD Negeri 1 dengan fitur zonasi
              terintegrasi untuk memudahkan proses pendaftaran.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              {isOpen ? (
                <Link href="/spmb/daftar">
                  <Button size="lg" variant="secondary" className="gap-2">
                    Daftar Sekarang
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" variant="secondary" disabled>
                  Pendaftaran Ditutup
                </Button>
              )}
              <Link href="/spmb/tracking">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-white/30 hover:bg-white/10 text-white gap-2"
                >
                  <Search className="h-4 w-4" />
                  Cek Status Pendaftaran
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Status Banner */}
      <section className="py-6 border-b">
        <div className="container">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Periode</p>
                <p className="font-semibold">{period.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tanggal Pendaftaran</p>
                <p className="font-semibold">
                  {new Date(period.start_date).toLocaleDateString("id-ID")} -{" "}
                  {new Date(period.end_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kuota</p>
                <p className="font-semibold">{period.quota} Siswa</p>
              </div>
            </div>
            <Badge
              variant={isOpen ? "default" : "secondary"}
              className={isOpen ? "bg-green-600" : ""}
            >
              {isOpen ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}
            </Badge>
          </div>
        </div>
      </section>

      {/* Zonasi Info */}
      <section className="py-12 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                Sistem Zonasi
              </Badge>
              <h2 className="text-3xl font-bold">Prioritas Berdasarkan Jarak</h2>
              <p className="text-muted-foreground">
                Sesuai kebijakan pendidikan, kami menerapkan sistem zonasi dengan
                prioritas penerimaan berdasarkan jarak rumah ke sekolah.
              </p>
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <strong>Radius Zonasi: 3 KM</strong>
                  <br />
                  Calon siswa dalam radius 3 km dari sekolah mendapat prioritas
                  utama dalam seleksi.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                * Pendaftaran dari luar zona tetap diterima dengan prioritas lebih
                rendah.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Lokasi Sekolah
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
                  <p className="text-muted-foreground">Peta akan tampil saat pendaftaran</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Jl. Pendidikan No. 123, Kota Jakarta
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-12">
        <div className="container">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-2">
              <Clock className="h-3 w-3 mr-1" />
              Alur Pendaftaran
            </Badge>
            <h2 className="text-3xl font-bold">Langkah Pendaftaran</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {timelineSteps.map((item) => (
              <Card key={item.step} className="relative text-center">
                <CardContent className="pt-8">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <item.icon className="h-10 w-10 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-12 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Badge variant="outline" className="mb-2">
                <FileText className="h-3 w-3 mr-1" />
                Persyaratan
              </Badge>
              <h2 className="text-3xl font-bold mb-6">Dokumen yang Diperlukan</h2>
              <ul className="space-y-3">
                {requirements.map((req) => (
                  <li key={req} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
              <Alert className="mt-6">
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  Semua dokumen diupload dalam format JPG, PNG, atau PDF dengan
                  ukuran maksimal 2MB per file.
                </AlertDescription>
              </Alert>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Siap Mendaftar?</CardTitle>
                <CardDescription>
                  Pastikan Anda sudah menyiapkan semua dokumen yang diperlukan
                  sebelum memulai proses pendaftaran.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/spmb/daftar">
                  <Button className="w-full gap-2" size="lg" disabled={!isOpen}>
                    Mulai Pendaftaran
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/spmb/tracking">
                  <Button variant="outline" className="w-full">
                    Sudah Daftar? Cek Status
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
