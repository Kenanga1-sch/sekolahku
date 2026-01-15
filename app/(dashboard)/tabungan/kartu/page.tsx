"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { Printer, CreditCard, Users, User } from "lucide-react";
import { getSiswaWithBalance, getAllKelas } from "@/lib/tabungan";
import { showSuccess, showError } from "@/lib/toast";
import type { TabunganSiswa, TabunganKelas } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function TabunganKartuPage() {
    const [siswaList, setSiswaList] = useState<TabunganSiswa[]>([]);
    const [kelasList, setKelasList] = useState<TabunganKelas[]>([]);
    const [selectedKelas, setSelectedKelas] = useState<string>("all");
    const [isLoading, setIsLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [siswa, kelas] = await Promise.all([
                    getSiswaWithBalance(selectedKelas === "all" ? undefined : selectedKelas),
                    getAllKelas(),
                ]);
                setSiswaList(siswa);
                setKelasList(kelas);
            } catch (error) {
                console.error("Failed to fetch data:", error);
                showError("Gagal memuat data siswa");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedKelas]);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            showError("Popup diblokir. Izinkan popup untuk mencetak.");
            return;
        }

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kartu QR Siswa</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; }
            .cards-container {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              padding: 16px;
            }
            .card {
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code { margin: 8px auto; }
            .name { font-weight: bold; font-size: 14px; margin-top: 8px; }
            .nisn { color: #6b7280; font-size: 12px; }
            .kelas { 
              display: inline-block;
              background: #e5e7eb;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              margin-top: 4px;
            }
            @media print {
              .cards-container { gap: 8px; padding: 8px; }
              .card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();

        showSuccess("Kartu berhasil dicetak");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Kartu QR Siswa</h1>
                    <p className="text-muted-foreground">
                        Generate dan cetak kartu QR untuk transaksi tabungan
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                        <SelectTrigger className="w-48">
                            <Users className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Pilih Kelas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kelas</SelectItem>
                            {kelasList.map((k) => (
                                <SelectItem key={k.id} value={k.id}>
                                    {k.nama}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handlePrint} disabled={siswaList.length === 0}>
                        <Printer className="h-4 w-4 mr-2" />
                        Cetak Semua
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <CreditCard className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Kartu yang akan dicetak</p>
                            <p className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : siswaList.length}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cards Preview */}
            <Card>
                <CardHeader>
                    <CardTitle>Preview Kartu</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-48 rounded-xl" />
                            ))}
                        </div>
                    ) : siswaList.length === 0 ? (
                        <div className="text-center py-12">
                            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">Tidak ada siswa untuk ditampilkan</p>
                        </div>
                    ) : (
                        <div
                            ref={printRef}
                            className="cards-container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                        >
                            {siswaList.map((siswa) => (
                                <div
                                    key={siswa.id}
                                    className="card border rounded-xl p-4 text-center hover:shadow-md transition-shadow"
                                >
                                    <div className="qr-code flex justify-center">
                                        <QRCodeSVG
                                            value={siswa.qr_code}
                                            size={100}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="mt-3">
                                        <p className="name font-semibold text-sm truncate">{siswa.nama}</p>
                                        <p className="nisn text-xs text-muted-foreground font-mono">
                                            {siswa.nisn}
                                        </p>
                                        <Badge variant="outline" className="kelas mt-2 text-xs">
                                            {siswa.expand?.kelas_id?.nama || "-"}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Petunjuk Penggunaan</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Pilih kelas untuk memfilter siswa yang akan dicetak</li>
                        <li>• Klik "Cetak Semua" untuk mencetak kartu QR</li>
                        <li>• Gunakan kertas A4 untuk hasil terbaik (3 kartu per baris)</li>
                        <li>• Laminating kartu untuk ketahanan lebih lama</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
