"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { BackgroundBeams } from "@/components/ui/background-beams";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";
import { goGet } from "@/lib/api-client";
import { siteConfig } from "@/lib/config";

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
    description: "Cek status kelulusan melalui halaman Pengumuman Resmi.",
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
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    goGet(`/api/public/spmb/landing`)
      .then((json: any) => {
        if (json.success) {
          setData(json);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch SPMB landing data:", err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const period = data?.period;
  const settings = data?.settings;
  const isOpen = data?.isOpen;
  const currentAcademicYear =
    period?.academicYear ||
    period?.academic_year ||
    settings?.currentAcademicYear ||
    settings?.current_academic_year;

  // Fallback for school info
  const schoolName = settings?.schoolName || settings?.school_name || siteConfig.school.name;
  const schoolAddress = settings?.schoolAddress || settings?.school_address || siteConfig.school.address;
  const maxDistance = settings?.maxDistanceKm || settings?.max_distance_km || 1;
  const schoolLat = settings?.schoolLat || settings?.school_lat || -6.175392;
  const schoolLng = settings?.schoolLng || settings?.school_lng || 106.827153;

  return (
    <div className="flex flex-col bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background via-primary/5 to-background py-20 sm:py-28">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-30" />
        <div className="container relative z-10 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-center">
                 <Badge className="border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/15">
                  <Calendar className="h-3.5 w-3.5 mr-2" />
                  {currentAcademicYear
                    ? `Tahun Ajaran ${currentAcademicYear}`
                    : isOpen
                      ? "Pendaftaran Dibuka"
                      : "Pendaftaran Belum Dibuka"}
                </Badge>
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Penerimaan Siswa Baru
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Bergabunglah bersama keluarga besar {schoolName}. Sistem Penerimaan Murid Baru (SPMB) dengan fitur zonasi terintegrasi untuk kemudahan dan transparansi.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
              {isOpen ? (
                <Link href="/spmb/daftar">
                  <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20">
                    Daftar Sekarang
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" variant="secondary" disabled className="h-12 px-8 text-base opacity-80">
                  Pendaftaran Ditutup
                </Button>
              )}

              <Link href="/spmb/tracking">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base font-medium bg-background/80"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Cek Status
                </Button>
              </Link>
              <Link href="/spmb/pengumuman">
                 <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 px-8 text-base font-medium"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pengumuman SPMB
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <BackgroundBeams className="opacity-10" />
      </section>

      {/* Status Banner */}
      <section className="py-8 border-b bg-background/50 backdrop-blur-sm supports-[backdrop-filter]:bg-background/50">
        <div className="container">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6 w-full md:w-auto text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3.5 w-3.5" /> Periode
                </p>
                <p className="font-semibold text-foreground">{period?.name || (isOpen ? "Pendaftaran umum" : "Belum ada periode aktif")}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Tanggal
                </p>
                <p className="font-semibold text-foreground truncate">
                  {period ? (
                    <>{new Date(period.startDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} - {new Date(period.endDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  ) : isOpen ? "Menunggu jadwal resmi" : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Users className="h-3.5 w-3.5" /> Kuota
                </p>
                <p className="font-semibold text-foreground">{period?.quota ? `${period.quota} Siswa` : "-"}</p>
              </div>
               <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> Pendaftar
                </p>
                <p className="font-semibold text-foreground">{period?.registered || 0} Calon Siswa</p>
              </div>
            </div>
            <div className="ml-auto">
                 <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className={isOpen ? "bg-green-600 hover:bg-green-700 text-sm px-4 py-1.5" : "text-sm px-4 py-1.5"}
                >
                  {isOpen ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}
                </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Zonasi Info */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
                <MapPin className="h-3 w-3" />
                Sistem Zonasi
              </Badge>
              <h2 className="text-4xl font-bold tracking-tight">Prioritas Berdasarkan Jarak</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Sesuai kebijakan pendidikan, kami menerapkan sistem zonasi dengan
                prioritas penerimaan berdasarkan jarak rumah ke sekolah. Pastikan alamat Anda terdeteksi dengan akurat saat mendaftar.
              </p>
              <Alert className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  <strong>Radius Zonasi Utama: {maxDistance} KM</strong>
                  <br />
                  Calon siswa yang berdomisili dalam radius {maxDistance} km dari sekolah akan mendapatkan prioritas utama dalam seleksi penerimaan.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                * Pendaftaran dari luar zona tetap diterima jika kuota masih tersedia, dengan prioritas setelah pendaftar dalam zona.
              </p>
            </div>
            <Card className="overflow-hidden border-0 shadow-2xl rounded-2xl ring-1 ring-black/5">
              <div className="bg-muted aspect-video relative flex items-center justify-center overflow-hidden">
                <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight={0} 
                    marginWidth={0} 
                    src={`https://maps.google.com/maps?q=${schoolLat},${schoolLng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    className="w-full h-full border-0 filter grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                    allowFullScreen
                 />
              </div>
              <CardContent className="p-6 bg-card">
                 <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-full">
                        <MapPin className="h-5 w-5 text-primary shrink-0" />
                    </div>
                    <div>
                        <p className="font-bold text-base">Lokasi Sekolah</p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {schoolAddress}
                        </p>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Timeline */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Clock className="h-3 w-3 mr-1" />
              Alur Pendaftaran
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Langkah Pendaftaran</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {timelineSteps.map((item) => (
              <Card key={item.step} className="text-center hover:shadow-xl transition-all duration-300 border-muted/60 hover:border-primary/20 relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-10 pb-10 relative">
                  <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-primary/5 text-primary flex items-center justify-center font-bold text-2xl group-hover:scale-110 transition-transform duration-300">
                    {item.step}
                  </div>
                  <item.icon className="absolute top-6 right-6 h-24 w-24 text-primary/5 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                  <h3 className="font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                <FileText className="h-3 w-3 mr-1" />
                Persyaratan
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Dokumen yang Diperlukan</h2>
              <ul className="space-y-4">
                {requirements.map((req) => (
                  <li key={req} className="flex items-center gap-4 p-4 rounded-xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                    </div>
                    <span className="font-medium">{req}</span>
                  </li>
                ))}
              </ul>
              <Alert className="mt-8 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Semua dokumen harus di-scan atau difoto dengan jelas dalam format <strong>JPG, PNG, atau PDF</strong>. Ukuran maksimal <strong>2MB per file</strong>.
                </AlertDescription>
              </Alert>
            </div>
            
            <div className="flex justify-center">
                <CardContainer className="inter-var">
                    <CardBody className="bg-gray-50 relative group/card  dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border  ">
                        <CardItem
                            translateZ="50"
                            className="text-xl font-bold text-neutral-600 dark:text-white"
                        >
                            Siap Mendaftar?
                        </CardItem>
                        <CardItem
                            as="p"
                            translateZ="60"
                            className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
                        >
                            Pastikan Anda sudah membaca semua persyaratan dan ketentuan yang berlaku sebelum melanjutkan.
                        </CardItem>
                        <CardItem translateZ="100" className="w-full mt-4">
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 mb-4">
                                <p className="text-sm font-medium text-center">
                                    {isOpen ? "Pendaftaran sedang dibuka!" : "Mohon maaf, pendaftaran sedang ditutup."}
                                </p>
                            </div>
                        </CardItem>
                        <div className="flex flex-col gap-4 mt-8">
                            <CardItem
                                translateZ={20}
                                className={!isOpen ? "pointer-events-none w-full" : "w-full"}
                            >
                                <Link href="/spmb/daftar" className="w-full block">
                                    <Button className="w-full gap-2 py-6 text-lg shadow-lg" size="lg" disabled={!isOpen}>
                                        {isOpen ? "Mulai Pendaftaran" : "Pendaftaran Ditutup"}
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </Link>
                            </CardItem>
                             <CardItem
                                translateZ={20}
                                className="w-full"
                            >
                                <Link href="/spmb/tracking" className="w-full block">
                                    <Button variant="outline" className="w-full py-6">
                                        Sudah Daftar? Cek Status
                                    </Button>
                                </Link>
                            </CardItem>
                             <CardItem
                                translateZ={20}
                                className="w-full"
                            >
                                <Link href="/spmb/pengumuman" className="w-full block">
                                    <Button variant="ghost" className="w-full py-6 text-muted-foreground hover:text-primary">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Cek Pengumuman Hasil
                                    </Button>
                                </Link>
                            </CardItem>
                        </div>
                    </CardBody>
                </CardContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


