"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 max-w-lg"
      >
        {/* 404 Illustration */}
        <div className="relative">
          <div className="text-[180px] md:text-[220px] font-bold text-zinc-100 dark:text-zinc-800 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-12 w-12 text-primary" />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Halaman Tidak Ditemukan</h1>
          <p className="text-muted-foreground">
            Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
            Silakan kembali ke beranda atau gunakan navigasi di atas.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/">
            <Button size="lg" className="gap-2">
              <Home className="h-4 w-4" />
              Kembali ke Beranda
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Halaman Sebelumnya
          </Button>
        </div>

        {/* Quick Links */}
        <div className="pt-8 border-t">
          <p className="text-sm text-muted-foreground mb-4">Atau kunjungi:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/spmb" className="text-primary hover:underline">
              Pendaftaran SPMB
            </Link>
            <Link href="/berita" className="text-primary hover:underline">
              Berita Terbaru
            </Link>
            <Link href="/kontak" className="text-primary hover:underline">
              Hubungi Kami
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
