"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";

export default function PrintLaporanPage() {
    const searchParams = useSearchParams();
    const type = searchParams.get("type") || "surat-masuk";
    const month = parseInt(searchParams.get("month") || "0");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    
    // Explicitly define Type instead of relying on inference
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch data based on type
        // Note: For MVP we use the existing list APIs. 
        // Ideally, we create a specialized report API or filter existing ones.
        // We will fetch ALL and filter client side or implement range filter on API.
        // Existing APIs support ?search & ?status.
        // Let's just mock fetching "Surat Masuk" or "Surat Keluar" list for now.
        // In production, implement date range filter on API.
        
        const fetchData = async () => {
            try {
                const endpoint = type === "surat-masuk" ? "/api/arsip/surat-masuk" : "/api/arsip/surat-keluar";
                const res = await fetch(`${endpoint}?perPage=1000`); // Get many
                const result = await res.json();
                
                // Client-side filter for month/year (MVP solution)
                const filtered = result.items.filter((item: any) => {
                    const date = new Date(type === "surat-masuk" ? item.receivedAt : item.dateOfLetter);
                    return date.getMonth() === month && date.getFullYear() === year;
                });
                
                setData(filtered);
                
                // Auto print when loaded
                setTimeout(() => window.print(), 1000);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [type, month, year]);

    const monthName = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][month];

    if (loading) return <div className="p-8 text-center">Memuat Laporan...</div>;

    return (
        <div className="bg-white text-black bg-white p-8 min-h-screen text-xs font-sans print:p-0">
            <div className="text-center mb-6">
                <h1 className="font-bold text-xl uppercase">Buku Agenda {type === "surat-masuk" ? "Surat Masuk" : "Surat Keluar"}</h1>
                <p className="text-sm">Bulan: {monthName} {year}</p>
                <p className="text-sm">SDN 1 Kenanga</p>
            </div>

            <table className="w-full border-collapse border border-black">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-black p-2 w-10">No</th>
                        {type === "surat-masuk" ? (
                            <>
                                <th className="border border-black p-2">Nomor Agenda</th>
                                <th className="border border-black p-2">Nomor Surat Asli</th>
                                <th className="border border-black p-2">Tanggal Surat</th>
                                <th className="border border-black p-2">Tanggal Diterima</th>
                                <th className="border border-black p-2">Pengirim</th>
                                <th className="border border-black p-2">Perihal</th>
                            </>
                        ) : (
                            <>
                                <th className="border border-black p-2">Nomor Surat</th>
                                <th className="border border-black p-2">Tanggal Surat</th>
                                <th className="border border-black p-2">Tujuan</th>
                                <th className="border border-black p-2">Perihal</th>
                            </>
                        )}
                        <th className="border border-black p-2 w-20">Ket</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={item.id} className="text-center">
                            <td className="border border-black p-1">{index + 1}</td>
                            {type === "surat-masuk" ? (
                                <>
                                    <td className="border border-black p-1">{item.agendaNumber}</td>
                                    <td className="border border-black p-1">{item.originalNumber}</td>
                                    <td className="border border-black p-1">{formatDate(item.dateOfLetter)}</td>
                                    <td className="border border-black p-1">{formatDate(item.receivedAt)}</td>
                                    <td className="border border-black p-1 text-left px-2">{item.sender}</td>
                                    <td className="border border-black p-1 text-left px-2">{item.subject}</td>
                                </>
                            ) : (
                                <>
                                    <td className="border border-black p-1">{item.mailNumber}</td>
                                    <td className="border border-black p-1">{formatDate(item.dateOfLetter)}</td>
                                    <td className="border border-black p-1 text-left px-2">{item.recipient}</td>
                                    <td className="border border-black p-1 text-left px-2">{item.subject}</td>
                                </>
                            )}
                             <td className="border border-black p-1"></td>
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={8} className="border border-black p-4 text-center italic">Tidak ada data untuk periode ini.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="mt-8 flex justify-end">
                <div className="text-center w-64">
                    <p className="mb-20">Mengetahui,<br/>Kepala Sekolah</p>
                    <p className="font-bold underline">_________________________</p>
                    <p>NIP. ........................................</p>
                </div>
            </div>
            
            <style jsx global>{`
                @page {
                    size: landscape;
                    margin: 1cm;
                }
                @media print {
                    body {
                        visibility: visible;
                    }
                }
            `}</style>
        </div>
    );
}
