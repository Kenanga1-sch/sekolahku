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
import { siteConfig } from "@/lib/config";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";

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

// Database imports
import { db } from "@/db";
import { spmbPeriods, spmbRegistrants } from "@/db/schema/spmb";
import { schoolSettings } from "@/db/schema/misc";
import { eq, sql } from "drizzle-orm";

// Fetch data directly from DB
async function getSPMBData() {
  try {
    // 1. Get active period with registrant count
    const result = await db
            .select({
                id: spmbPeriods.id,
                name: spmbPeriods.name,
                academicYear: spmbPeriods.academicYear,
                startDate: spmbPeriods.startDate,
                endDate: spmbPeriods.endDate,
                quota: spmbPeriods.quota,
                isActive: spmbPeriods.isActive,
                registered: sql<number>`count(${spmbRegistrants.id})`.mapWith(Number),
            })
            .from(spmbPeriods)
            .leftJoin(spmbRegistrants, eq(spmbPeriods.id, spmbRegistrants.periodId))
            .where(eq(spmbPeriods.isActive, true))
            .groupBy(spmbPeriods.id)
            .limit(1);

    const period = result[0] || null;

    // 2. Get school settings
    const [settings] = await db.select().from(schoolSettings).limit(1);

    // 3. Calculate status
    let isOpen = false;
    if (period) {
        const now = new Date();
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        // Open if within dates OR if global setting forces it open.
        // User expectation: If period is active and global setting is ON, then it's OPEN.
        // Dates are advisory or for automated scheduling if global setting is "on".
        // But if global setting is explicitly true, we respect it.
        const isDateOpen = now >= startDate && now <= endDate;
        const isGlobalOpen = settings?.spmbIsOpen ?? true; 
        
        // Revised Logic: 
        // If we have an active period (which we do, due to the query), 
        // and the global switch is ON, we consider it OPEN.
        // We will still trust the date check IF the global switch was relying on automation, 
        // but here we simplify: Active Period + Global Open = Open.
        isOpen = isGlobalOpen;
    }

    return { period, settings, isOpen };
  } catch (error) {
    console.error("Failed to fetch SPMB data:", error);
    return { period: null, settings: null, isOpen: false };
  }
}

// Google Maps Iframe used for stability

// ... existing code ...

export default async function SPMBPage() {
  const { period, settings, isOpen } = await getSPMBData();

  // Fallback for school info
  const schoolName = settings?.schoolName || siteConfig.school.name;
  const schoolAddress = settings?.schoolAddress || siteConfig.school.address;
  const maxDistance = settings?.maxDistanceKm || 1; // Default 1km
  
  // Default coordinates if not set (fallback to Jakarta Monas as example or 0,0)
  const schoolLat = settings?.schoolLat || -6.175392; 
  const schoolLng = settings?.schoolLng || 106.827153;

  return (
    <div className="flex flex-col bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-neutral-950 py-24 sm:py-32">
        <div className="container relative z-10 text-center text-white">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-center">
                 <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm font-normal">
                  <Calendar className="h-3.5 w-3.5 mr-2 text-amber-400" />
                  {period?.academicYear ? `Tahun Ajaran ${period.academicYear}` : "Pendaftaran Belum Dibuka"}
                </Badge>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Penerimaan Siswa Baru
            </h1>
            <p className="text-xl md:text-2xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              Bergabunglah bersama keluarga besar {schoolName}. Sistem Penerimaan Murid Baru (SPMB) dengan fitur zonasi terintegrasi untuk kemudahan dan transparansi.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
              {isOpen ? (
                <Link href="/spmb/daftar">
                  <Button size="lg" className="h-12 px-8 text-base bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)] border-0">
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
                  className="h-12 px-8 text-base bg-transparent border-neutral-700 text-white hover:bg-neutral-800"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Cek Status
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <BackgroundBeams className="opacity-40" />
      </section>

      {/* Status Banner */}
      <section className="py-8 border-b bg-background/50 backdrop-blur-sm supports-[backdrop-filter]:bg-background/50 sticky top-0 z-20">
        <div className="container">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6 w-full md:w-auto text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3.5 w-3.5" /> Periode
                </p>
                <p className="font-semibold text-foreground">{period?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Tanggal
                </p>
                <p className="font-semibold text-foreground truncate">
                  {period ? (
                    <>{new Date(period.startDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} - {new Date(period.endDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  ) : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Users className="h-3.5 w-3.5" /> Kuota
                </p>
                <p className="font-semibold text-foreground">{period?.quota || 0} Siswa</p>
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
