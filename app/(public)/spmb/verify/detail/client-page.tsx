"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle, Calendar, User, FileText, School } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface VerificationData {
  id: string;
  registrationNumber: string;
  fullName: string;
  studentNik: string;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  periodName: string;
  academicYear: string;
}

export default function VerificationPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const res = await fetch(`/api/public/spmb/registrants/${id}`);
        const result = await res.json();

        if (res.ok) {
          setData({
              id: result.id,
              registrationNumber: result.registrationNumber,
              fullName: result.fullName,
              studentNik: result.studentNik,
              status: result.status,
              createdAt: result.createdAt,
              verifiedAt: result.createdAt, // Mocking
              periodName: "PPDB Utama",
              academicYear: "2024/2025"
          });
        } else {
          setError(result.error || "Dokumen tidak valid");
        }
      } catch (err) {
        setError("Gagal menghubungi server verifikasi");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchVerification();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-muted-foreground animate-pulse">Memverifikasi keaslian dokumen...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-red-50/50 dark:bg-red-950/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 dark:border-red-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-500" />
            </div>
            <CardTitle className="text-red-700 dark:text-red-400">Dokumen Tidak Valid</CardTitle>
            <CardDescription>
              Sistem tidak dapat menemukan data pendaftaran dengan ID dokumen tersebut.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            <p className="mb-4">
              Kemungkinan penyebab:
            </p>
            <ul className="text-left list-disc list-inside space-y-1 mx-auto max-w-[280px]">
              <li>QR Code rusak atau tidak terbaca</li>
              <li>Dokumen palsu atau dimanipulasi</li>
              <li>Data pendaftaran telah dihapus</li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center pt-2">
             <Link href="/spmb">
                <Button variant="outline" className="border-red-200 hover:bg-red-50 text-red-700">Kembali ke Beranda</Button>
             </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4">
      {/* Brand Header */}
      <div className="mb-8 text-center">
         <div className="flex items-center justify-center gap-3 mb-2">
             <School className="h-8 w-8 text-blue-700" />
             <h1 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-100">UPTD SDN 1 KENANGA</h1>
         </div>
         <p className="text-sm text-muted-foreground">Sistem Verifikasi Dokumen Digital</p>
      </div>

      <Card className="max-w-lg w-full border-blue-100 dark:border-blue-900 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500" />
        
        <CardHeader className="text-center pb-6 pt-8">
            <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 ring-4 ring-white dark:ring-zinc-950 shadow-sm">
              <ShieldCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-500" />
            </div>
            <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-2">
               <CheckCircle2 className="h-6 w-6" />
               DOKUMEN VALID
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Bukti Pendaftaran ini <strong className="text-emerald-600 dark:text-emerald-400">TERDAFTAR RESMI</strong> dalam sistem kami.
            </CardDescription>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
               <FileText className="h-3 w-3" />
               ID: {data.id}
            </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">No. Pendaftaran</p>
                    <p className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">{data.registrationNumber}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Saat Ini</p>
                    <Badge variant={data.status === 'accepted' ? 'default' : 'secondary'} className="uppercase">
                        {data.status === 'draft' ? 'Draft' : 
                         data.status === 'pending' ? 'Menunggu Verifikasi' :
                         data.status === 'verified' ? 'Terverifikasi' :
                         data.status === 'accepted' ? 'Diterima' : 
                         data.status === 'rejected' ? 'Ditolak' : data.status}
                    </Badge>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium text-muted-foreground">Nama Siswa</p>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{data.fullName}</p>
                    </div>
                </div>
                
                <Separator className="bg-slate-200 dark:bg-slate-700" />

                <div className="flex items-start gap-3">
                     <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                     <div className="space-y-0.5">
                        <p className="text-sm font-medium text-muted-foreground">NIK (Disamarkan)</p>
                        <p className="text-base font-mono text-slate-700 dark:text-slate-300">{data.studentNik}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                     <div className="space-y-0.5">
                        <p className="text-sm font-medium text-muted-foreground">Tanggal Pendaftaran</p>
                        <p className="text-base text-slate-700 dark:text-slate-300">{formatDate(data.createdAt)}</p>
                    </div>
                </div>
            </div>

           <div className="text-center">
                <p className="text-xs text-muted-foreground">
                    Terdaftar pada Jalur/Periode:
                </p>
                <p className="text-sm font-medium">{data.periodName} ({data.academicYear})</p>
           </div>
        </CardContent>

        <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 py-4 px-6 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800">
             <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                 <Link href="/spmb">Kunjungi Website Sekolah</Link>
             </Button>
             <p className="text-[10px] text-center text-muted-foreground mt-2">
                 Validasi ini dihasilkan oleh sistem secara otomatis. Tanggal akses: {new Date().toLocaleString('id-ID')}
             </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-center space-y-2">
         <p className="text-xs text-slate-400">© {new Date().getFullYear()} UPTD SDN 1 Kenanga. All rights reserved.</p>
         <div className="flex justify-center gap-4 text-xs text-slate-400">
            <Link href="#" className="hover:text-slate-600">Privacy Policy</Link>
            <Link href="#" className="hover:text-slate-600">Contact Support</Link>
         </div>
      </div>
    </div>
  );
}



