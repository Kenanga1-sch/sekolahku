"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { containerVariants, itemVariants } from "../use-landing";

interface LayananSectionProps {
  landingTexts: { services_desc: string };
  landingSections: { layanan?: { heading?: string; subheading?: string } };
}

export function LayananSection({ landingTexts, landingSections }: LayananSectionProps) {
  return (
    <section id="layanan" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
        className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{landingSections.layanan?.heading || "Layanan Administratif"}</h2>
          <p className="text-zinc-400 leading-relaxed text-sm">{landingSections.layanan?.subheading || landingTexts.services_desc}</p>
        </motion.div>
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border border-zinc-800/60 bg-zinc-900/40 shadow-md backdrop-blur-md hover:bg-zinc-900/60 transition-all duration-300 text-zinc-100 rounded-2xl active:scale-[0.98] active:translate-y-[1px]">
            <CardContent className="p-5 space-y-2 flex flex-col justify-between h-full">
              <div>
                <h4 className="font-bold text-sm text-white">Layanan Mutasi</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Ajukan perpindahan sekolah murid masuk/keluar secara online, serta pantau status verifikasinya.</p>
              </div>
              <div className="flex flex-col gap-1.5 pt-2">
                <Link href="/layanan/mutasi-masuk" className="inline-flex items-center text-xs text-blue-400 font-bold hover:underline cursor-pointer text-left">Urus Mutasi <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                <Link href="/layanan/mutasi-masuk/status" className="inline-flex items-center text-[10px] text-zinc-400 font-medium hover:text-white cursor-pointer text-left">Lacak Status Permohonan <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-zinc-800/60 bg-zinc-900/40 shadow-md backdrop-blur-md hover:bg-zinc-900/60 transition-all duration-300 text-zinc-100 rounded-2xl active:scale-[0.98] active:translate-y-[1px]">
            <CardContent className="p-5 space-y-2 flex flex-col justify-between h-full">
              <div>
                <h4 className="font-bold text-sm text-white">Cek Saldo Mandiri</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">Lacak riwayat uang jajan dan saldo tabungan brankas sekolah murid secara transparan untuk melatih hemat.</p>
              </div>
              <Link href="/layanan/cek-saldo" className="inline-flex items-center text-xs text-blue-400 font-bold hover:underline pt-2 cursor-pointer text-left">Periksa Saldo <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </section>
  );
}