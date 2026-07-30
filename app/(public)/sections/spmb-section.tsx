"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { containerVariants, itemVariants } from "../use-landing";

interface SPMBSectionProps {
  landingTexts: { spmb_desc: string };
  landingSections: { spmb?: { heading?: string; subheading?: string; button?: { label?: string; url?: string } } };
  handleScrollTo: (id: string) => void;
}

export function SPMBSection({ landingTexts, landingSections, handleScrollTo }: SPMBSectionProps) {
  return (
    <section id="spmb" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
        className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/30 border border-blue-900/30 text-xs font-semibold text-blue-400">
            <Users className="h-3.5 w-3.5" />{landingSections.spmb?.heading || "Penerimaan Siswa Baru"}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{landingSections.spmb?.heading || "Penerimaan Siswa Baru (SPMB)"}</h2>
          <p className="text-zinc-400 leading-relaxed text-sm">{landingSections.spmb?.subheading || landingTexts.spmb_desc}</p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
          <Link href={landingSections.spmb?.button?.url || "/spmb/daftar"} className="flex-1">
            <Button size="lg" className="w-full h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] active:translate-y-[1px]">
              {landingSections.spmb?.button?.label || "Pendaftaran Online"}
            </Button>
          </Link>
          <button onClick={() => handleScrollTo("kontak")}
            className="flex-1 h-14 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 text-zinc-200 font-semibold active:scale-[0.98] active:translate-y-[1px] transition-all cursor-pointer">
            Hubungi Panitia
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}