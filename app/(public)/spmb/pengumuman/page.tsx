"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, Loader2, CheckCircle, XCircle, Clock, Download, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackgroundGradient } from "@/components/ui/background-gradient";

interface SearchResult {
  registration_number: string;
  id: string;
  student_name: string;
  status: "draft" | "pending" | "verified" | "accepted" | "rejected";
  status_label: string;
  period_name: string;
  notes: string | null;
}

export default function PengumumanPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/spmb/status?number=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Data tidak ditemukan");
      }
    } catch (err) {
      setError("Terjadi kesalahan saat mencari data");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Back Button */}
        <Link href="/spmb" className="inline-flex items-center text-zinc-500 hover:text-amber-600 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Halaman Utama
        </Link>

        {/* Header Section */}
        <div className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Pengumuman <span className="text-amber-600 dark:text-amber-500">Penerimaan</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto"
          >
            Silakan masukkan nomor pendaftaran Anda untuk melihat hasil seleksi penerimaan siswa baru.
          </motion.p>
        </div>

        {/* Search Section */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
        >
          <Card className="border-none shadow-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input 
                    placeholder="Contoh: SPMB-2024-0001" 
                    className="pl-10 h-12 text-lg bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-amber-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cek Status"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Result Section */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key="error"
            >
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 text-center">
                <CardContent className="pt-6 pb-6 space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400">Data Tidak Ditemukan</h3>
                    <p className="text-red-600 dark:text-red-300 max-w-md mx-auto">
                        Nomor pendaftaran tidak ditemukan atau format salah. Mohon periksa kembali nomor Anda.
                    </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              key="result"
            >
               {result.status === "accepted" ? (
                  <BackgroundGradient containerClassName="rounded-[24px]">
                    <Card className="border-none bg-white dark:bg-zinc-900 h-full overflow-hidden">
                        <div className="h-2 w-full bg-gradient-to-r from-green-500 to-emerald-600" />
                        <CardHeader className="text-center pt-8 pb-2">
                            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 ring-8 ring-green-50 dark:ring-green-900/10">
                                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                            </div>
                            <Badge className="mx-auto mb-4 bg-green-100 text-green-700 hover:bg-green-100 border-green-200 px-4 py-1 text-sm">
                                LULUS SELEKSI
                            </Badge>
                            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400">
                                SELAMAT!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-6 pb-8">
                            <div className="space-y-2">
                                <p className="text-muted-foreground text-lg">Ananda</p>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{result.student_name}</h3>
                                <p className="text-zinc-500 font-mono text-sm">{result.registration_number}</p>
                            </div>
                            
                            <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl max-w-lg mx-auto border border-green-100 dark:border-green-900/20">
                                <p className="text-green-800 dark:text-green-300 leading-relaxed">
                                    Berdasarkan hasil seleksi administrasi dan akademik, siswa dinyatakan <strong>DITERIMA</strong> sebagai calon peserta didik baru periode {result.period_name}.
                                </p>
                            </div>

                            <Button 
                                size="lg" 
                                className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white rounded-full px-8 shadow-lg shadow-green-600/20"
                                onClick={() => window.open(`/spmb/bukti/${result.id}`, '_blank')}
                            >
                                <Download className="h-4 w-4" /> Download Surat Keputusan
                            </Button>
                        </CardContent>
                    </Card>
                  </BackgroundGradient>
               ) : result.status === "rejected" ? (
                 <Card className="border-none shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden">
                     <div className="h-2 w-full bg-gradient-to-r from-red-500 to-pink-600" />
                     <CardContent className="text-center pt-12 pb-12 space-y-6">
                        <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mohon Maaf</h3>
                            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
                                Setelah melalui proses seleksi yang ketat, kami belum dapat menerima Ananda <strong>{result.student_name}</strong> sebagai peserta didik baru periode ini.
                            </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl max-w-md mx-auto">
                            <p className="text-sm text-zinc-500">
                                Tetap semangat dan jangan menyerah. Kami mendoakan kesuksesan Ananda di tempat lain.
                            </p>
                        </div>
                     </CardContent>
                 </Card>
               ) : (
                <Card className="border-none shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
                    <CardContent className="text-center pt-12 pb-12 space-y-6">
                       <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 animate-pulse">
                           <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                       </div>
                       <div className="space-y-2">
                           <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sedang Diproses</h3>
                           <p className="text-muted-foreground text-lg">
                               Data pendaftaran Ananda <strong>{result.student_name}</strong> saat ini masih dalam tahap seleksi/verifikasi.
                           </p>
                       </div>
                       <div className="flex justify-center gap-2">
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                Status: {result.status_label}
                            </Badge>
                       </div>
                       <div className="pt-4">
                           <Button variant="outline" onClick={() => window.open(`/spmb/tracking`, '_self')}>
                               Cek Tracking Detail <ChevronRight className="h-4 w-4 ml-1" />
                           </Button>
                       </div>
                    </CardContent>
                </Card>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
