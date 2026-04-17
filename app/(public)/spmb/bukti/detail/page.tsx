"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, notFound } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { PrintButton } from "@/components/spmb/print-button";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { DownloadPdfButton } from "@/components/spmb/download-pdf-button";

function ProofContent() {
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
        if (!res.ok) throw new Error("Registrant not found");
        return res.json();
      })
      .then(json => {
        setRegistrant(json);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch registrant:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!id || error || !registrant) {
    return notFound();
  }

  const birthDate = registrant.birthDate ? new Date(registrant.birthDate) : new Date();
  const createdAt = registrant.createdAt ? new Date(registrant.createdAt) : new Date();

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="max-w-[210mm] mx-auto space-y-4 print:max-w-none print:p-0">
        {/* Actions - Hidden when printing */}
        <div className="flex justify-between items-center print:hidden">
            <Link 
                href="/spmb" 
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
                <ArrowLeft className="h-4 w-4" /> Kembali
            </Link>
            <DownloadPdfButton registrant={registrant} />
        </div>
        
        {/* Printable Card */}
        <div className="bg-white p-8 md:px-12 shadow-xl print:shadow-none print:border-none rounded-xl min-h-[297mm] relative">
             {/* Header Kop Surat */}
            <div className="relative pb-4 mb-2">
                <div className="flex items-center justify-center relative min-h-[100px]">
                    <div className="absolute left-0 top-0 w-24 h-24 flex items-center justify-center">
                         <div className="relative w-[80px] h-[80px]">
                            <Image 
                                src="/logo.png" 
                                alt="Logo Sekolah" 
                                fill
                                className="object-contain"
                                unoptimized={true}
                            />
                         </div>
                    </div>

                    <div className="text-center text-black mx-auto w-[80%]">
                        <h3 className="font-bold text-[14pt] leading-tight tracking-wide" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            PEMERINTAH KABUPATEN INDRAMAYU
                        </h3>
                        <h3 className="font-bold text-[14pt] leading-tight tracking-wide mb-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            DINAS PENDIDIKAN DAN KEBUDAYAAN
                        </h3>
                        <h1 className="font-bold text-[18pt] leading-tight my-1 text-blue-700 uppercase" style={{ fontFamily: '"Bookman Old Style", "URW Bookman L", serif' }}>
                            UPTD SDN 1 KENANGA
                        </h1>
                        <p className="text-[11pt] font-bold leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            NSS/NPSN : 10.1.02.18.160.15 / 20216609
                        </p>
                        <p className="text-[9pt] leading-tight mt-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            Alamat : Jl. Perindustrian Blok Dukuh Desa Kenanga Kec. Sindang Kab. Indramayu 45226
                        </p>
                        <p className="text-[9pt] leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            Email : <span className="text-blue-700 underline">uptdsdn1kenangasindang@gmail.com</span>
                        </p>
                    </div>
                </div>
                
                <div className="mt-4 border-b-[3px] border-black"></div>
                <div className="mt-[2px] border-b-[1px] border-black"></div>
            </div>

            <div className="relative z-10">
                <div className="text-center mt-6 mb-8">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-black border-b-2 border-black inline-block pb-1">
                        {registrant.status === "accepted" ? "SURAT KEPUTUSAN PENERIMAAN SISWA BARU" : "Tanda Bukti Pendaftaran"}
                    </h2>
                </div>

                {registrant.status === "accepted" && (
                     <div className="mb-8 px-4">
                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-lg text-justify leading-relaxed">
                            <p className="mb-4">
                                Berdasarkan hasil seleksi administrasi dan akademik Penerimaan Peserta Didik Baru (PPDB) Tahun Pelajaran {new Date().getFullYear()}/{new Date().getFullYear() + 1}, Kepala Sekolah UPTD SDN 1 Kenanga dengan ini memutuskan bahwa:
                            </p>
                        </div>
                     </div>
                )}

                <div className="flex flex-col md:flex-row gap-6 mb-8">
                    <div className="flex-1 space-y-6">
                        <div>
                             <div className="bg-blue-900 text-white px-3 py-1.5 text-sm font-bold uppercase rounded-t-sm mb-0">
                                 A. Data Calon Peserta Didik
                             </div>
                             <div className="border border-t-0 border-gray-300 rounded-b-sm p-4">
                                 <table className="w-full text-[11pt]">
                                     <tbody>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 w-[160px] text-gray-600 font-medium">No. Pendaftaran</td>
                                             <td className="py-2 font-bold font-mono text-lg text-blue-900">: {registrant.registrationNumber}</td>
                                         </tr>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 text-gray-600 font-medium">Nama Lengkap</td>
                                             <td className="py-2 font-bold uppercase">: {registrant.fullName}</td>
                                         </tr>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 text-gray-600 font-medium">NIK</td>
                                             <td className="py-2 font-medium">: {registrant.studentNik}</td>
                                         </tr>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 text-gray-600 font-medium">Tempat, Tanggal Lahir</td>
                                             <td className="py-2">: {registrant.birthPlace}, {format(birthDate, "dd MMMM yyyy", { locale: idLocale })}</td>
                                         </tr>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 text-gray-600 font-medium">Jenis Kelamin</td>
                                             <td className="py-2">: {registrant.gender === "L" ? "Laki-laki" : "Perempuan"}</td>
                                         </tr>
                                         <tr className="border-b border-gray-100 last:border-0">
                                             <td className="py-2 text-gray-600 font-medium">Sekolah Asal</td>
                                             <td className="py-2">: {registrant.previousSchool || "-"}</td>
                                         </tr>
                                     </tbody>
                                 </table>
                             </div>
                        </div>

                         <div>
                             <div className="bg-blue-900 text-white px-3 py-1.5 text-sm font-bold uppercase rounded-t-sm mb-0">
                                 B. Domisili
                             </div>
                             <div className="border border-t-0 border-gray-300 rounded-b-sm p-4">
                                 <table className="w-full text-[11pt]">
                                     <tbody>
                                        <tr className="align-top">
                                             <td className="py-1 w-[160px] text-gray-600 font-medium">Alamat Lengkap</td>
                                             <td className="py-1 text-justify leading-relaxed">: {registrant.address}</td>
                                         </tr>
                                         <tr className="align-top">
                                             <td className="py-1 text-gray-600 font-medium">Jarak ke Sekolah</td>
                                             <td className="py-1">: {registrant.distanceToSchool ? `${Number(registrant.distanceToSchool).toFixed(2)} km` : '-'}</td>
                                         </tr>
                                     </tbody>
                                 </table>
                             </div>
                        </div>
                    </div>

                    <div className="w-[5cm] shrink-0">
                        <div className="border border-gray-300 rounded-sm p-4 flex flex-col items-center gap-6 bg-gray-50/50 h-full">
                            <div className="text-center space-y-2">
                                <div className="w-[3cm] h-[4cm] bg-white border border-gray-300 mx-auto flex flex-col items-center justify-center text-gray-400">
                                    <span className="text-[10px] font-bold">FOTO 3x4</span>
                                </div>
                                <p className="text-[9px] text-gray-500 italic">Tempel pas foto terbaru<br/>di sini</p>
                            </div>

                            <div className="w-full border-b border-gray-200"></div>

                            <div className="text-center space-y-2">
                                <div className="bg-white border border-gray-300 mx-auto p-2 flex items-center justify-center w-fit h-fit">
                                      <QRCodeSVG 
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/spmb/tracking?id=${registrant.registrationNumber}`}
                                        size={90}
                                        level="H"
                                        includeMargin={false}
                                      />
                                </div>
                                <div className="text-[9px] font-mono font-bold text-blue-900">{registrant.registrationNumber}</div>
                                <p className="text-[9px] text-gray-500">Scan untuk validasi data</p>
                            </div>
                        </div>
                    </div>
                </div>

                {registrant.status === "accepted" && (
                    <div className="mt-8 mb-4 px-4 text-center">
                        <p className="text-lg font-bold">
                             Dinyatakan: <span className="text-xl uppercase border-b-2 border-green-600 text-green-700">DITERIMA / LULUS SELEKSI</span>
                        </p>
                        <p className="mt-2 text-sm italic text-gray-600">
                            Sebagai Peserta Didik Baru Kelas 1 di UPTD SDN 1 Kenanga.
                        </p>
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-900 mb-8">
                     <p><strong>Catatan Penting:</strong></p>
                     <ul className="list-disc ml-5 space-y-1 mt-1 text-xs">
                         <li>Bukti pendaftaran ini harap dibawa saat melakukan verifikasi ulang di sekolah.</li>
                         <li>Pantau pengumuman status penerimaan melalui website resmi sekolah atau papan pengumuman.</li>
                         <li>Data yang tidak sesuai dengan dokumen asli dapat menggugurkan status penerimaan.</li>
                     </ul>
                </div>

                <div className="flex justify-between items-end mt-12 px-8">
                    <div className="text-center text-xs text-gray-400">
                         Doc ID: {String(registrant.id).split('-')[0]}<br/>
                         Printed: {format(new Date(), "dd/MM/yyyy HH:mm")}
                    </div>
                    <div className="text-center w-64">
                        <p className="mb-2 text-[11pt]">Indramayu, {format(createdAt, "dd MMMM yyyy", { locale: idLocale })}</p>
                        <p className="text-[10pt] font-semibold text-gray-600">Panitia PPDB,</p>
                        <div className="h-20"></div> 
                        <div className="border-b border-black w-48 mx-auto mb-1"></div>
                        <p className="text-[10pt] font-bold">
                            {registrant.status === "accepted" ? "Kepala Sekolah" : "Panitia Penerimaan"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProofContent />
    </Suspense>
  );
}



