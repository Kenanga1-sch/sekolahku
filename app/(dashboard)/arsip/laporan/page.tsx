"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";

export default function LaporanPage() {
    const [month, setMonth] = useState<string>(new Date().getMonth().toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [type, setType] = useState<string>("surat-masuk");

    const handlePrint = () => {
        const url = `/arsip/laporan/print?type=${type}&month=${month}&year=${year}`;
        window.open(url, "_blank");
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Laporan & Buku Agenda</h1>
                <p className="text-muted-foreground text-sm">Cetak buku agenda surat masuk dan keluar per bulan</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Cetak Laporan
                    </CardTitle>
                    <CardDescription>
                        Pilih periode dan jenis laporan yang ingin dicetak.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Jenis Buku Agenda</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="surat-masuk">Buku Agenda Surat Masuk</SelectItem>
                                <SelectItem value="surat-keluar">Buku Agenda Surat Keluar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bulan</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                                        <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tahun</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024">2024</SelectItem>
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button className="w-full mt-4" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak Laporan (PDF)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
