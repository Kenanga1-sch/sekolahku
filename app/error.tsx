"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const words = [
    { text: "Terjadi", className: "text-red-500 dark:text-red-500" },
    { text: "Kesalahan", className: "text-red-500 dark:text-red-500" },
    { text: "Sistem." },
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
        <div className="w-24 h-24 bg-red-500/10 backdrop-blur-md rounded-full flex items-center justify-center mb-8 border border-red-500/20 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>

        <TypewriterEffect words={words} className="mb-8" />
        
        <p className="text-zinc-500 dark:text-zinc-300 mb-4 text-lg max-w-md mx-auto leading-relaxed">
            Maaf, sistem mengalami kendala saat memproses permintaan Anda.
        </p>

        {error.digest && (
             <span className="text-xs font-mono mb-8 block bg-black/10 dark:bg-white/10 p-2 rounded text-muted-foreground">
                Code: {error.digest}
            </span>
        )}

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Button 
                onClick={reset}
                className="w-full h-12 font-bold bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg" 
                size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Coba Lagi
            </Button>
          
          <Link href="/" className="w-full">
              <Button variant="outline" className="w-full h-12 rounded-full bg-white/5 border-white/10 hover:bg-white/10 hover:text-white" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Kembali ke Beranda
              </Button>
            </Link>
        </div>
      </motion.div>
    </AuroraBackground>
  );
}
