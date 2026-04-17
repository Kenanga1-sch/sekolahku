"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, notFound } from "next/navigation";
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  FileText, 
  ArrowLeft,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

function VerifyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [registrant, setRegistrant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    fetch(`/api/public/spmb/registrants/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Nomor pendaftaran tidak valid");
        return res.json();
      })
      .then(json => {
        setRegistrant(json);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Verification error:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!id || error || !registrant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-100 shadow-xl">
           <CardContent className="pt-8 text-center space-y-4">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                 <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-900">Validasi Gagal</h2>
              <p className="text-muted-foreground">
                Data pendaftaran tidak ditemukan atau tautan verifikasi tidak valid.
              </p>
              <Link href="/spmb" className="inline-block mt-4 text-primary font-semibold hover:underline">
                 Kembali ke Beranda SPMB
              </Link>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
       <Card className="max-w-2xl w-full border-green-100 shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="h-2 w-full bg-green-500" />
          <CardHeader className="text-center pb-2">
             <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
             </div>
             <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400 uppercase tracking-tight">Dokumen Valid</CardTitle>
             <CardDescription>Berhasil memverifikasi keaslian dokumen pendaftaran.</CardDescription>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
             <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="grid grid-cols-2 gap-y-6">
                   <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">No. Pendaftaran</p>
                      <p className="font-mono font-bold text-primary">{registrant.registrationNumber}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tanggal Daftar</p>
                      <p className="font-semibold">
                        {registrant.createdAt ? format(new Date(registrant.createdAt), "dd MMM yyyy", { locale: idLocale }) : "-"}
                      </p>
                   </div>
                   <div className="col-span-2 space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nama Calon Siswa</p>
                      <p className="text-xl font-bold uppercase tracking-tight">{registrant.fullName}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Jenis Kelamin</p>
                      <p className="font-semibold">{registrant.gender === "L" ? "Laki-laki" : "Perempuan"}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status Hasil Seleksi</p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 uppercase">
                         {registrant.status === "accepted" ? "Diterima" : registrant.status === "pending" ? "Menunggu" : "Ditolak"}
                      </span>
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-xl">
                   <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                   <p className="text-xs text-yellow-800 dark:text-yellow-600 leading-relaxed font-medium">
                      Informasi ini dihasilkan secara otomatis oleh sistem SPMB Online UPTD SDN 1 Kenanga. 
                      Pastikan data pada lembar fisik sesuai dengan informasi digital di atas.
                   </p>
                </div>
                
                <Link href="/spmb" className="w-full">
                   <Button variant="outline" className="w-full h-11 font-semibold group border-zinc-200">
                      <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                      Kembali ke Beranda
                   </Button>
                </Link>
             </div>
          </CardContent>
          
          <div className="bg-zinc-50 dark:bg-zinc-800/80 p-4 text-center">
             <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1.5 uppercase tracking-[0.1em]">
                <FileText className="h-3 w-3" /> Digital Verification System • SDN 1 Kenanga
             </p>
          </div>
       </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}


