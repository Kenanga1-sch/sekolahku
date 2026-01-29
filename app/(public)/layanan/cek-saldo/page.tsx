"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Loader2, Search, RefreshCw, Smartphone, CreditCard, CameraOff } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamic import QR Scanner to prevent SSR issues
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
    { ssr: false }
);

// Schema for manual input
const manualSchema = z.object({
  nisn: z.string().min(10, "NISN harus 10 digit"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
});

type BalanceData = {
  name: string;
  className: string;
  balance: number;
  lastUpdate: string;
};

export default function CekSaldoPage() {
  const [result, setResult] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");
  const [cooldown, setCooldown] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: { nisn: "", birthDate: "" },
  });

  // Auto-reset result after 30 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (result) {
      setCooldown(30);
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            setResult(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [result]);

  const checkBalance = async (identifier: string, birthDate?: string) => {
    if (loading || result) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/tabungan/check-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, birthDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal mengecek saldo");
      }

      setResult(data.data);
      toast.success("Data ditemukan");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onManualSubmit = (values: z.infer<typeof manualSchema>) => {
    checkBalance(values.nisn, values.birthDate);
  };

  const handleScan = (text: string) => {
      if (text) checkBalance(text);
  };

  const onScanResult = (scanResult: { rawValue: string }[]) => {
      if (scanResult && scanResult.length > 0) {
          handleScan(scanResult[0].rawValue);
      }
  };

  const handleScanError = (error: unknown) => {
      // Improve error handling for user feedback
      console.error("Scanner error:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.message.includes("permission")) {
             setCameraError("Izin kamera ditolak. Mohon aktifkan izin kamera di pengaturan browser.");
        }
      }
  };

  const resetScanner = () => {
    setResult(null);
    setCooldown(0);
    setActiveTab("scan");
  };

  return (
    <div className="container max-w-md py-12 px-4">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Cek Saldo</h1>
        <p className="text-muted-foreground">
          Cek saldo tabungan siswa secara mandiri.
        </p>
      </div>

      {result ? (
        <Card className="border-t-4 border-t-green-600 shadow-xl animate-in zoom-in-95 duration-300">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                    <CreditCard className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Informasi Saldo</CardTitle>
                <CardDescription>Data per {format(new Date(result.lastUpdate), "d MMM yyyy HH:mm", { locale: idLocale })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
                <div>
                    <p className="text-sm text-muted-foreground">Nama Siswa</p>
                    <p className="font-semibold text-lg">{result.name}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Kelas</p>
                    <p className="font-medium">{result.className}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 py-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm text-muted-foreground mb-1">Total Saldo</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        Rp {result.balance.toLocaleString("id-ID")}
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                <p className="text-xs text-center text-muted-foreground w-full mb-2">
                    Layar akan tertutup otomatis dalam {cooldown} detik.
                </p>
                <Button onClick={resetScanner} className="w-full" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" /> Cek Kartu Lain
                </Button>
            </CardFooter>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="scan">
                    <Smartphone className="mr-2 h-4 w-4" /> Scan QR
                </TabsTrigger>
                <TabsTrigger value="manual">
                    <CreditCard className="mr-2 h-4 w-4" /> Input Manual
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="scan">
                <Card>
                    <CardHeader>
                        <CardTitle>Scan Kartu</CardTitle>
                        <CardDescription>Arahkan kode QR/Barcode kartu siswa ke kamera.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <div className="aspect-square bg-gray-100 dark:bg-zinc-900 overflow-hidden relative sm:rounded-lg flex flex-col items-center justify-center text-center">
                             {!cameraError ? (
                                <Scanner
                                    onScan={onScanResult}
                                    onError={handleScanError}
                                    constraints={{ facingMode: "environment" }}
                                    styles={{
                                        container: { width: "100%", height: "100%" },
                                        video: { 
                                            width: "100%", 
                                            height: "100%", 
                                            objectFit: "cover",
                                        },
                                    }}
                                />
                             ) : (
                                <div className="absolute inset-0 flex items-center justify-center p-4">
                                     <div className="text-center">
                                        <CameraOff className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-red-500">{cameraError}</p>
                                     </div>
                                </div>
                             )}
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-4 px-4 pb-4 sm:pb-0">
                            Pastikan cahaya cukup dan kode tidak terlipat.
                            <br />
                            <span className="text-amber-500">Izin kamera diperlukan.</span>
                        </p>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="manual">
                <Card>
                    <CardHeader>
                        <CardTitle>Cek Manual</CardTitle>
                        <CardDescription>Masukkan NISN dan Tanggal Lahir siswa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onManualSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="nisn"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>NISN</FormLabel>
                                        <FormControl>
                                        <Input placeholder="Nomor Induk Siswa Nasional" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="birthDate"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tanggal Lahir</FormLabel>
                                        <FormControl>
                                        <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Cek Saldo
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
