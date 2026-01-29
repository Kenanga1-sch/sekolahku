"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Ghost, Home, ArrowLeft } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { motion } from "framer-motion";

export default function NotFound() {
  const words = [
    { text: "404", className: "text-red-500 dark:text-red-500" },
    { text: "Halaman" },
    { text: "Tidak" },
    { text: "Ditemukan." },
  ];

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center"
      >
        <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
          <Ghost className="w-12 h-12 text-white" />
        </div>

        <TypewriterEffect words={words} className="mb-8" />
        
        <p className="text-zinc-500 dark:text-zinc-300 mb-12 text-lg max-w-md mx-auto leading-relaxed">
           Ups! Sepertinya Anda tersesat. Halaman yang Anda cari mungkin sudah dipindahkan atau tidak pernah ada.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link href="/" className="w-full">
            <Button className="w-full h-12 font-bold rounded-full shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset]" size="lg">
              <Home className="mr-2 h-4 w-4" />
              Kembali ke Beranda
            </Button>
          </Link>
          
          <Link href="#" onClick={() => window.history.back()} className="w-full">
            <Button variant="outline" className="w-full h-12 rounded-full bg-white/5 border-white/10 hover:bg-white/10 hover:text-white" size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
          </Link>
        </div>
      </motion.div>
    </AuroraBackground>
  );
}
