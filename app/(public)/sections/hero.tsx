"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { containerVariants, itemVariants } from "../use-landing";

const Demo3DCanvas = dynamic(() => import("@/components/landing/demo-3d-canvas"), {
  ssr: false, loading: () => <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />,
});

interface HeroProps {
  schoolName?: string;
  schoolTagline: string;
  schoolDescription: string;
  handleScrollTo: (id: string) => void;
}

export function HeroSection({ schoolName, schoolTagline, schoolDescription, handleScrollTo }: HeroProps) {
  return (
    <>
      <div className="fixed inset-0 w-full h-screen z-10 pointer-events-none opacity-90 md:opacity-100">
        <Demo3DCanvas />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-10 pointer-events-none z-0" />

      <section id="hero" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative">
        <motion.div variants={containerVariants} initial="hidden" animate="visible"
          className="space-y-6 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/40 border border-blue-900/30 text-xs font-semibold text-blue-400">
            <BadgeCheck className="h-3.5 w-3.5" />Portal Informasi Sekolah Dasar
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            {schoolName || "UPTD SDN 1 Kenanga"}
          </motion.h1>
          <motion.p variants={itemVariants} className="text-xl font-semibold text-zinc-400 tracking-wide uppercase">{schoolTagline}</motion.p>
          <motion.p variants={itemVariants} className="text-base sm:text-lg text-zinc-400 leading-relaxed">{schoolDescription}</motion.p>
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/spmb/daftar">
              <Button size="lg" className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] active:translate-y-[1px]">
                Mulai Pendaftaran<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <button onClick={() => handleScrollTo("visi-misi")}
              className="h-12 px-8 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-885 text-zinc-200 font-semibold active:scale-[0.98] active:translate-y-[1px] transition-all cursor-pointer">
              Jelajahi Program
            </button>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}