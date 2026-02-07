"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface VerificationData {
    success: boolean;
    valid: boolean;
    message: string;
    data?: {
        student: {
            nama: string;
            nisn: string;
            kelas: string | null;
        } | null;
        period: {
            start: string;
            end: string;
        };
        closingBalance: number;
    };
}

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export default function VerifyStatementPage({ params }: { params: Promise<{ hash: string }> }) {
    const { hash } = use(params);
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<VerificationData | null>(null);

    useEffect(() => {
        const verify = async () => {
            try {
                // Get verification params from URL query
                const urlParams = new URLSearchParams(window.location.search);
                const queryString = urlParams.toString();
                
                const res = await fetch(`/api/tabungan/rekening-koran/verify/${hash}?${queryString}`);
                const data = await res.json();
                setResult(data);
            } catch (error) {
                console.error("Verification error:", error);
                setResult({
                    success: false,
                    valid: false,
                    message: "Terjadi kesalahan saat verifikasi",
                });
            } finally {
                setIsLoading(false);
            }
        };

        verify();
    }, [hash]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardContent className="p-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
                            <p className="text-gray-500">Memverifikasi dokumen...</p>
                        </div>
                    ) : result?.valid ? (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                                </div>
                                <div className="text-center">
                                    <h1 className="text-xl font-bold text-green-700">Dokumen Valid</h1>
                                    <p className="text-sm text-gray-500">{result.message}</p>
                                </div>
                            </div>

                            {result.data && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-gray-500">Nama Siswa</div>
                                        <div className="font-semibold">{result.data.student?.nama || "-"}</div>
                                        
                                        <div className="text-gray-500">NISN</div>
                                        <div className="font-mono">{result.data.student?.nisn || "-"}</div>
                                        
                                        <div className="text-gray-500">Kelas</div>
                                        <div>{result.data.student?.kelas || "-"}</div>
                                        
                                        <div className="text-gray-500">Periode</div>
                                        <div className="text-xs">
                                            {formatDate(result.data.period.start)} - {formatDate(result.data.period.end)}
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                                        <p className="text-xs text-emerald-600 uppercase">Saldo Akhir Terverifikasi</p>
                                        <p className="text-2xl font-bold text-emerald-700">
                                            {formatRupiah(result.data.closingBalance)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-center text-gray-400 pt-4">
                                Verifikasi berhasil pada {new Date().toLocaleString("id-ID")}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="h-12 w-12 text-red-600" />
                            </div>
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-red-700">Dokumen Tidak Valid</h1>
                                <p className="text-sm text-gray-500 mt-2">{result?.message}</p>
                            </div>
                            <p className="text-xs text-center text-gray-400 pt-4 max-w-sm">
                                Dokumen ini tidak dapat diverifikasi. Pastikan QR Code belum rusak 
                                atau hubungi sekolah untuk informasi lebih lanjut.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
