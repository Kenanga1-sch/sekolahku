"use client";

import React, { useState, useEffect } from "react";
import { 
  Trophy, 
  MapPin, 
  Search, 
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function PengumumanPage() {
  const [registrants, setRegistrants] = useState<any[]>([]);
  const [landingData, setLandingData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/public/spmb/registrants`).then(res => {
        if (!res.ok) throw new Error("Gagal memuat hasil seleksi");
        return res.json();
      }),
      fetch(`/api/public/spmb/landing`).then(res => res.ok ? res.json() : null),
    ])
      .then(([registrantsJson, landingJson]) => {
        const items = Array.isArray(registrantsJson) ? registrantsJson : (Array.isArray(registrantsJson?.data) ? registrantsJson.data : []);
        setRegistrants(items);
        setLandingData(landingJson);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch public registrants:", err);
        setError(err?.message || "Gagal memuat hasil seleksi");
        setIsLoading(false);
      });
  }, []);

  const filteredRegistrants = registrants.filter(reg => 
    (reg.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (reg.registrationNumber || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const acceptedCount = registrants.filter(r => r.status === "accepted").length;
  const rejectedCount = registrants.filter(r => r.status === "rejected").length;
  const totalRegistered = landingData?.period?.registered ?? landingData?.activePeriod?.registered ?? registrants.length;
  const lastUpdated = registrants.reduce<number>((latest, reg) => {
    const value = Number(reg.updatedAt || reg.createdAt || 0);
    return Number.isFinite(value) && value > latest ? value : latest;
  }, 0);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header Section */}
      <section className="relative pt-12 pb-20 overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border-none">
              <Trophy className="h-3 w-3 mr-2" />
              Hasil Seleksi SPMB {new Date().getFullYear()}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Selamat Datang, Calon Siswa Baru!
            </h1>
            <p className="text-lg text-primary-foreground/80 leading-relaxed">
              Berikut adalah daftar hasil seleksi Sistem Penerimaan Murid Baru (SPMB) 
              UPTD SDN 1 Kenanga Tahun Pelajaran {new Date().getFullYear()}/{new Date().getFullYear() + 1}.
            </p>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="container -mt-10 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl">
            <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                     <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                     <p className="text-sm text-muted-foreground font-medium">Total Diterima</p>
                     <p className="text-2xl font-bold">{acceptedCount} Siswa</p>
                  </div>
               </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-xl">
            <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                     <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                     <p className="text-sm text-muted-foreground font-medium">Total Pendaftar</p>
                     <p className="text-2xl font-bold">{totalRegistered} Siswa</p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl">
            <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                     <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                     <p className="text-sm text-muted-foreground font-medium">Tidak Diterima</p>
                     <p className="text-2xl font-bold">{rejectedCount} Siswa</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 container">
        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <CardTitle className="text-2xl">Daftar Hasil Seleksi</CardTitle>
                <CardDescription className="mt-1">
                  Gunakan pencarian untuk menemukan nama atau nomor pendaftaran Anda.
                  {lastUpdated > 0 && (
                    <span className="block">
                      Pembaruan terakhir: {format(new Date(lastUpdated), "dd MMMM yyyy, HH:mm", { locale: idLocale })}.
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari Nama/No. Pendaftaran..." 
                  className="pl-10 bg-zinc-50 dark:bg-zinc-800"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                    <TableRow>
                      <TableHead className="w-[100px] font-bold">Peringkat</TableHead>
                      <TableHead className="font-bold">No. Pendaftaran</TableHead>
                      <TableHead className="font-bold uppercase">Nama Lengkap</TableHead>
                      <TableHead className="font-bold">Tanggal Daftar</TableHead>
                      <TableHead className="text-center font-bold">Status</TableHead>
                      <TableHead className="text-right font-bold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {error ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-red-600">
                           {error}
                        </TableCell>
                      </TableRow>
                    ) : filteredRegistrants.length > 0 ? (
                      filteredRegistrants.map((reg, index) => (
                        <TableRow key={reg.registrationNumber} className="hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="font-medium text-center">{index + 1}</TableCell>
                          <TableCell className="font-mono text-primary font-semibold">{reg.registrationNumber}</TableCell>
                          <TableCell className="font-bold uppercase tracking-tight">{reg.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {reg.createdAt ? format(new Date(reg.createdAt), "dd MMM yyyy", { locale: idLocale }) : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn(
                              "font-semibold border-none px-3 py-1",
                              reg.status === "accepted" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                              reg.status === "rejected" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                              "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            )}>
                              {reg.status === "accepted" ? "Diterima" :
                               reg.status === "rejected" ? "Tidak Diterima" : 
                               "Diproses"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link 
                                href={`/spmb/tracking?id=${encodeURIComponent(reg.registrationNumber)}`}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline group"
                            >
                                Detail <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                           {searchQuery ? "Pendaftar tidak ditemukan." : "Pengumuman hasil seleksi belum tersedia."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
             </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-12 grid md:grid-cols-2 gap-8">
           <Card className="bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20">
              <CardContent className="pt-6 flex gap-4">
                 <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                 </div>
                 <div className="space-y-2">
                    <h3 className="font-bold text-blue-900 dark:text-blue-300">Langkah Berikutnya?</h3>
                    <p className="text-sm text-blue-800/80 dark:text-blue-400/80 leading-relaxed">
                       Bagi calon siswa yang <strong>Diterima</strong>, harap segera melakukan pendaftaran ulang dengan membawa bukti pendaftaran ke sekolah pada jam operasional.
                    </p>
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-indigo-50 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/20">
              <CardContent className="pt-6 flex gap-4">
                 <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                    <ExternalLink className="h-5 w-5 text-indigo-600" />
                 </div>
                 <div className="space-y-2">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-300">Butuh Bantuan?</h3>
                    <p className="text-sm text-indigo-800/80 dark:text-indigo-400/80 leading-relaxed">
                       Jika Anda mengalami kendala atau terdapat data yang tidak sesuai, silakan hubungi tim administrasi kami melalui halaman kontak.
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>
      </section>
    </div>
  );
}


