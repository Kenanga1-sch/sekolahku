"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { formatDate } from "@/lib/utils";
import Image from "next/image";

export default function CetakSuratUmumPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useSchoolSettings();
  const s = settings as any;

  useEffect(() => {
    if (!id) return;
    goGet(`/api/arsip/surat-keluar/detail?id=${id}`)
      .then((res: any) => {
        setData(res.data || res);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => {
        window.print();
      }, 1000);
    }
  }, [loading, data]);

  if (loading) {
    return <div className="p-8 text-center text-sm font-medium">Memuat data surat...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-red-500 font-medium">Data surat tidak ditemukan.</div>;
  }

  return (
    <div className="print-wrapper w-full bg-white text-black min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 2cm; }
        @media print {
          body { -webkit-print-color-adjust: exact; background: white !important; }
          .no-print { display: none !important; }
        }
        .prose p { margin-top: 0.5em; margin-bottom: 0.5em; }
        .prose table { width: 100%; border-collapse: collapse; margin-top: 1em; margin-bottom: 1em; }
        .prose th, .prose td { border: 1px solid black; padding: 0.5em; }
        .print-container {
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          max-width: 100%;
        }
      `}} />

      <div className="print-container w-full h-full">
        {/* KOP SURAT */}
        <div className="w-full flex items-center justify-between pb-2">
          <div className="w-[80px] h-[80px] relative">
            <Image 
              src={s?.logoUrl || "/logo.png"} 
              alt="Logo" 
              fill 
              className="object-contain" 
            />
          </div>
          <div className="flex-1 text-center px-4">
            <div className="text-lg uppercase tracking-wide">
              {s?.governanceName || "PEMERINTAH KABUPATEN INDRAMAYU"}
              <br />
              {s?.departmentName || "DINAS PENDIDIKAN DAN KEBUDAYAAN"}
            </div>
            <div className="text-xl font-bold uppercase tracking-wider mt-1">
              {settings?.school_name || "UPTD SDN 1 KENANGA"}
            </div>
            <div className="text-sm mt-1">
              {settings?.school_address || "Jl. Raya Kenanga No. 1, Kec. Sindang, Kab. Indramayu"}
              <br />
              Email: {settings?.school_email || "sdn1kenanga@gmail.com"} | Telp: {settings?.school_phone || "-"}
            </div>
          </div>
          <div className="w-[80px] h-[80px] relative">
            {/* Optional Tut Wuri Handayani or right logo */}
          </div>
        </div>
        <hr className="border-t-[3px] border-black mt-2 mb-1" />
        <hr className="border-t border-black mb-6" />

        {/* METADATA SURAT */}
        <div className="flex justify-between items-start mb-6 text-sm">
          <div>
            <table className="w-auto">
              <tbody>
                <tr>
                  <td className="pr-4 pb-1 align-top">Nomor</td>
                  <td className="px-2 pb-1 align-top">:</td>
                  <td className="pb-1 align-top">{data.mailNumber || "-"}</td>
                </tr>
                <tr>
                  <td className="pr-4 pb-1 align-top">Sifat</td>
                  <td className="px-2 pb-1 align-top">:</td>
                  <td className="pb-1 align-top">Biasa</td>
                </tr>
                <tr>
                  <td className="pr-4 pb-1 align-top">Perihal</td>
                  <td className="px-2 pb-1 align-top">:</td>
                  <td className="pb-1 align-top font-bold">{data.subject}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-right">
            <div>
              {s?.city || "Indramayu"}, {formatDate(data.dateOfLetter)}
            </div>
          </div>
        </div>

        {/* KEPADA YTH */}
        <div className="mb-8 text-sm">
          <div>Kepada Yth.</div>
          <div className="font-bold">{data.recipient}</div>
          <div>di -</div>
          <div className="ml-4">Tempat</div>
        </div>

        {/* ISI SURAT (TipTap Content) */}
        <div 
          className="prose prose-sm max-w-none text-justify text-black"
          dangerouslySetInnerHTML={{ __html: data.htmlContent || "<p>Isi surat kosong.</p>" }}
        />

        {/* TANDA TANGAN */}
        <div className="mt-16 flex justify-end">
          <div className="w-[300px] text-center text-sm">
            <div>Kepala Sekolah</div>
            <div className="h-24 flex items-center justify-center">
              {data.digitalSignature ? (
                <Image 
                  src={data.digitalSignature} 
                  alt="Tanda Tangan" 
                  width={150} 
                  height={80} 
                  className="object-contain mix-blend-multiply" 
                />
              ) : (
                <div className="text-xs text-gray-400 italic">(Belum Ditandatangani)</div>
              )}
            </div>
            <div className="font-bold underline">{s?.principalName || "Nama Kepala Sekolah"}</div>
            <div>NIP. {s?.principalNip || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
