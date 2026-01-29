"use client";

import { SparklesCore } from "@/components/ui/sparkles";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-white dark:bg-black flex flex-col items-center justify-center overflow-hidden relative">
      <div className="w-full absolute inset-0 h-screen">
        <SparklesCore
          id="tsparticlesloading"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={70}
          className="w-full h-full"
          particleColor="#A1A1AA"
          speed={1}
        />
      </div>
      <div className="relative z-20 flex flex-col items-center gap-4">
         <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <Loader2 className="h-12 w-12 text-primary animate-spin relative z-10" />
         </div>
         <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400 animate-pulse tracking-wide">
            MEMUAT...
         </p>
      </div>
    </div>
  );
}
