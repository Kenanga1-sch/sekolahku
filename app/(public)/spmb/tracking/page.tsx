"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Search, 
  MapPin, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || "";
  const [searchId, setSearchId] = useState(initialId);
  const [registrant, setRegistrant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId) return;

    setIsLoading(true);
    setError(null);
    setRegistrant(null);

    try {
      const res = await fetch(`/api/public/spmb/registrants/${searchId}`);
      if (!res.ok) throw new Error("Nomor pendaftaran tidak ditemukan");
      const data = await res.json();
      setRegistrant(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      handleSearch();
    }
  }, [initialId]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "accepted":
        return { label: "Diterima", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" };
      case "rejected":
        return { label: "Tidak Diterima", icon: XCircle, color: "bg-red-100 text-red-700 border-red-200" };
      case "pending":
        return { label: "Menunggu Verifikasi", icon: Clock, color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
      default:
        return { label: "Diproses", icon: AlertCircle, color: "bg-blue-100 text-blue-700 border-blue-200" };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12">
      <div className="container max-w-4xl">
        <div className="text-center mb-10 space-y-4">
          <Badge variant="outline" className="px-4 py-1.5 border-primary/20 text-primary">
            SPMB Tracking
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Cek Status Pendaftaran</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Masukkan nomor pendaftaran Anda untuk melihat status terbaru dan informasi detail pendaftaran.
          </p>
        </div>

        <Card className="mb-8 border-primary/10 shadow-lg shadow-primary/5">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Contoh: REG-2024-0001" 
                  className="pl-10 h-12"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Cari Sekarang"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-3 p-4 text-red-800 border border-red-100 bg-red-50 rounded-xl mb-8 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {registrant && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Head */}
            <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 overflow-hidden">
               <div className={cn("h-2 w-full", getStatusConfig(registrant.status).color.split(' ')[0])} />
               <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                     <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Status Saat Ini</p>
                        <div className="flex items-center gap-3">
                           {React.createElement(getStatusConfig(registrant.status).icon, { 
                              className: cn("h-8 w-8", getStatusConfig(registrant.status).color.split(' ')[1]) 
                           })}
                           <h2 className="text-2xl font-bold">{getStatusConfig(registrant.status).label}</h2>
                        </div>
                     </div>
                     <Link 
                        href={`/spmb/bukti/detail?id=${registrant.registrationNumber}`}
                        className={cn(buttonVariants({ variant: "outline" }), "group")}
                     >
                        Lihat Bukti Pendaftaran
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                     </Link>
                  </div>
               </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
               <Card>
                  <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Informasi Siswa
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                        <p className="font-semibold">{registrant.fullName}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Nomor Pendaftaran</p>
                        <p className="font-mono font-medium">{registrant.registrationNumber}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Jenis Kelamin</p>
                        <p className="font-medium">{registrant.gender === "L" ? "Laki-laki" : "Perempuan"}</p>
                     </div>
                  </CardContent>
               </Card>

               <Card>
                  <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Detail Pendaftaran
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Tanggal Daftar</p>
                        <p className="font-medium">
                          {registrant.createdAt ? format(new Date(registrant.createdAt), "dd MMMM yyyy, HH:mm", { locale: idLocale }) : "-"}
                        </p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Jarak ke Sekolah</p>
                        <p className="font-medium">{registrant.distanceToSchool ? `${Number(registrant.distanceToSchool).toFixed(2)} km` : "-"}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Alamat</p>
                        <p className="text-sm line-clamp-2">{registrant.address}</p>
                     </div>
                  </CardContent>
               </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <TrackingContent />
    </Suspense>
  );
}

const buttonVariants = ({ variant }: { variant: string }) => {
    const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";
    const variants: Record<string, string> = {
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
    };
    return cn(base, variants[variant] || "");
};


