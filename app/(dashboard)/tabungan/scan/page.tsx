"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    QrCode,
    User,
    ArrowDownCircle,
    ArrowUpCircle,
    Loader2,
    Keyboard,
    ArrowLeft,
    Camera,
} from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import { QRScanner } from "@/components/ui/qr-scanner";
import type { TabunganSiswaWithRelations, TransactionType } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

type ScanState = "idle" | "scanning" | "found" | "notfound" | "processing" | "success" | "error";

export default function TabunganScanPage() {
    const { user } = useAuthStore();
    const [scanState, setScanState] = useState<ScanState>("idle");
    const [qrInput, setQrInput] = useState("");
    const [siswa, setSiswa] = useState<TabunganSiswaWithRelations | null>(null);
    const [showTransactionDialog, setShowTransactionDialog] = useState(false);

    // Transaction form
    const [tipe, setTipe] = useState<TransactionType>("setor");
    const [nominal, setNominal] = useState("");
    const [catatan, setCatatan] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const lastScannedCodeRef = useRef<string | null>(null);
    const cooldownRef = useRef<NodeJS.Timeout | null>(null);

    // Cooldown duration to prevent rapid rescans
    const SCAN_COOLDOWN_MS = 3000;

    // Scan mode: camera or manual
    const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");

    // Scanner should be inactive during dialog, processing, or cooldown
    const isScannerActive = scanMode === "camera" && scanState === "idle" && !showTransactionDialog;

    // Auto-focus input on mount (only for manual mode)
    useEffect(() => {
        if (scanMode === "manual") {
            inputRef.current?.focus();
        }
    }, [scanMode]);

    const handleScan = async (code: string) => {
        if (!code.trim()) return;

        // Prevent duplicate scans of the same code during cooldown
        if (lastScannedCodeRef.current === code.trim() && cooldownRef.current) {
            return;
        }

        // Prevent scanning if already processing or dialog open
        if (scanState !== "idle" || showTransactionDialog) {
            return;
        }

        setScanState("scanning");
        lastScannedCodeRef.current = code.trim();

        try {
            const res = await fetch(`/api/tabungan/siswa?qrCode=${encodeURIComponent(code.trim())}`);
            const result = await res.json();
            
            const foundSiswa = result.items?.[0];

            if (foundSiswa) {
                setSiswa(foundSiswa);
                setScanState("found");
                setShowTransactionDialog(true);
            } else {
                setSiswa(null);
                setScanState("notfound");
                setTimeout(() => {
                    setScanState("idle");
                    setQrInput("");
                    inputRef.current?.focus();
                }, 2000);
            }
        } catch (error) {
            console.error("Scan error:", error);
            setScanState("error");
            setTimeout(() => {
                setScanState("idle");
                setQrInput("");
            }, 2000);
        } finally {
            // Set cooldown to prevent rapid rescans
            cooldownRef.current = setTimeout(() => {
                cooldownRef.current = null;
            }, SCAN_COOLDOWN_MS);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleScan(qrInput);
        }
    };

    const handleSubmitTransaction = async () => {
        if (!siswa || !user || !nominal) {
            showError("Data tidak lengkap");
            return;
        }

        const nominalValue = parseInt(nominal.replace(/\D/g, ""), 10);
        if (nominalValue < 1000) {
            showError("Minimal transaksi Rp 1.000");
            return;
        }

        // Check for withdrawal
        if (tipe === "tarik" && nominalValue > siswa.saldoTerakhir) {
            showError("Saldo tidak mencukupi");
            return;
        }

        setIsSubmitting(true);
        setScanState("processing");

        try {
            const payload = {
                siswaId: siswa.id,
                tipe,
                nominal: nominalValue,
                catatan: catatan || undefined,
                userId: user.id
            };

            const res = await fetch("/api/tabungan/transaksi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Invalid JSON response:", text);
                throw new Error("Server error: Gagal memproses data (Invalid JSON)");
            }

            if (!res.ok) {
                console.error("API Error Data:", data);
                let msg = data.error?.message || (typeof data.error === 'string' ? data.error : "Gagal memproses transaksi");
                
                // Append validation details if available
                if (data.error?.fields) {
                    const fields = Object.entries(data.error.fields)
                        .map(([key, val]) => `${key}: ${val}`)
                        .join(", ");
                    msg += ` (${fields})`;
                }
                
                throw new Error(msg);
            }

            setScanState("success");
            showSuccess(
                tipe === "setor"
                    ? `Setoran ${formatRupiah(nominalValue)} berhasil dicatat`
                    : `Penarikan ${formatRupiah(nominalValue)} berhasil dicatat`
            );

            // Reset after success
            setTimeout(() => {
                resetForm();
            }, 2000);
        } catch (error: any) {
            console.error("Transaction error:", error);
            setScanState("error");
            showError(error.message || "Gagal menyimpan transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setScanState("idle");
        setSiswa(null);
        setQrInput("");
        setNominal("");
        setCatatan("");
        setTipe("setor");
        setShowTransactionDialog(false);
        // Clear last scanned code to allow rescanning
        lastScannedCodeRef.current = null;
        if (cooldownRef.current) {
            clearTimeout(cooldownRef.current);
            cooldownRef.current = null;
        }
        inputRef.current?.focus();
    };

    const handleNominalChange = (value: string) => {
        // Format as currency while typing
        const numericValue = value.replace(/\D/g, "");
        if (numericValue) {
            setNominal(parseInt(numericValue, 10).toLocaleString("id-ID"));
        } else {
            setNominal("");
        }
    };

    const quickAmounts = [5000, 10000, 20000, 50000];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/tabungan">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Scan Transaksi</h1>
                    <p className="text-muted-foreground">
                        Scan QR Code siswa untuk melakukan setoran atau penarikan
                    </p>
                </div>
            </div>

            {/* Scanner Card */}
            <Card className="max-w-lg mx-auto">
                <CardHeader className="text-center pb-2">
                    {/* Mode Toggle */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-muted p-1 rounded-lg inline-flex">
                            <Button
                                variant={scanMode === "camera" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setScanMode("camera")}
                                className="gap-2 rounded-md shadow-none"
                            >
                                <Camera className="h-4 w-4" />
                                Kamera
                            </Button>
                            <Button
                                variant={scanMode === "manual" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setScanMode("manual")}
                                className="gap-2 rounded-md shadow-none"
                            >
                                <Keyboard className="h-4 w-4" />
                                Manual
                            </Button>
                        </div>
                    </div>

                    {/* Status Icon - Only show when not in camera mode or when there's a status */}
                    <div className="text-center space-y-2 mb-4">
                        <h2 className="text-xl font-semibold tracking-tight">
                            {scanState === "scanning" && "Mencari siswa..."}
                            {scanState === "found" && "Siswa ditemukan!"}
                            {scanState === "notfound" && "Siswa tidak ditemukan"}
                            {scanState === "processing" && "Memproses transaksi..."}
                            {scanState === "success" && "Transaksi berhasil!"}
                            {scanState === "error" && "Terjadi kesalahan"}
                            {scanState === "idle" && (scanMode === "camera" ? "Scan QR Code" : "Masukkan Kode Manual")}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {scanMode === "camera" 
                                ? "Posisikan kode QR di dalam bingkai" 
                                : "Masukkan NISN atau kode QR siswa secara manual"}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Camera Scanner Mode */}
                    {scanMode === "camera" && (
                        <QRScanner
                            onScan={(code) => handleScan(code)}
                            onError={(err) => showError(err)}
                            active={isScannerActive}
                            mirrored={true}
                        />
                    )}

                    {/* Manual QR Input Mode */}
                    {scanMode === "manual" && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Keyboard className="h-4 w-4" />
                                <span>Ketik atau scan dengan barcode scanner</span>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    ref={inputRef}
                                    placeholder="Kode QR siswa..."
                                    value={qrInput}
                                    onChange={(e) => setQrInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={scanState !== "idle"}
                                    className="font-mono"
                                />
                                <Button
                                    onClick={() => handleScan(qrInput)}
                                    disabled={!qrInput || scanState !== "idle"}
                                >
                                    <QrCode className="h-4 w-4 mr-2" />
                                    Cari
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Status Messages */}
                    {scanState === "notfound" && (
                        <div className="text-center text-red-600">
                            <p>QR Code tidak valid atau siswa belum terdaftar di tabungan</p>
                        </div>
                    )}
                    {scanState === "success" && (
                        <div className="text-center text-green-600">
                            <p>Transaksi akan diverifikasi oleh bendahara</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Transaction Dialog */}
            <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transaksi Tabungan</DialogTitle>
                        <DialogDescription>
                            Input nominal setor atau tarik untuk siswa ini
                        </DialogDescription>
                    </DialogHeader>

                    {siswa && (
                        <div className="space-y-6 py-4">
                            {/* Student Info */}
                            <Card className="bg-muted/50">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{siswa.nama}</p>
                                            <p className="text-sm text-muted-foreground">
                                                NISN: {siswa.nisn} • {siswa.kelas?.nama}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <span className="text-sm">Saldo Saat Ini</span>
                                        <span className="text-lg font-bold text-green-600">
                                            {formatRupiah(siswa.saldoTerakhir)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Transaction Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant={tipe === "setor" ? "default" : "outline"}
                                    className={tipe === "setor" ? "bg-green-600 hover:bg-green-700" : ""}
                                    onClick={() => setTipe("setor")}
                                >
                                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                                    Setor
                                </Button>
                                <Button
                                    variant={tipe === "tarik" ? "default" : "outline"}
                                    className={tipe === "tarik" ? "bg-red-600 hover:bg-red-700" : ""}
                                    onClick={() => setTipe("tarik")}
                                >
                                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                                    Tarik
                                </Button>
                            </div>

                            {/* Amount Input */}
                            <div className="space-y-2">
                                <Label htmlFor="nominal">Nominal</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        Rp
                                    </span>
                                    <Input
                                        id="nominal"
                                        className="pl-10 text-lg font-mono"
                                        placeholder="0"
                                        value={nominal}
                                        onChange={(e) => handleNominalChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Quick Amount Buttons */}
                            <div className="flex flex-wrap gap-2">
                                {quickAmounts.map((amount) => (
                                    <Button
                                        key={amount}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setNominal(amount.toLocaleString("id-ID"))}
                                    >
                                        {formatRupiah(amount)}
                                    </Button>
                                ))}
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label htmlFor="catatan">Catatan (opsional)</Label>
                                <Input
                                    id="catatan"
                                    placeholder="Keterangan transaksi..."
                                    value={catatan}
                                    onChange={(e) => setCatatan(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmitTransaction}
                            disabled={isSubmitting || !nominal}
                            className={tipe === "setor" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                        >
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {tipe === "setor" ? "Setor" : "Tarik"} {nominal && `Rp ${nominal}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
