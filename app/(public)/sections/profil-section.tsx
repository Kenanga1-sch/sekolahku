"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Trophy, History, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { containerVariants, itemVariants } from "../use-landing";

interface ProfilSectionProps {
  landingTexts: { profile_desc: string; program_desc: string };
  schoolVisi: string;
  schoolMisi: string[];
}

export function ProfilSection({ landingTexts, schoolVisi, schoolMisi }: ProfilSectionProps) {
  return (
    <>
      <section id="visi-misi" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Profil & Visi Misi</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.profile_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-4">
            <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md text-zinc-100 rounded-2xl">
              <CardContent className="p-5 space-y-2">
                <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-xs text-blue-400 font-bold">1</span>Visi
                </h3>
                <p className="text-zinc-300 text-xs leading-relaxed">{schoolVisi}</p>
              </CardContent>
            </Card>
            <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md text-zinc-100 rounded-2xl">
              <CardContent className="p-5 space-y-2">
                <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-xs text-blue-400 font-bold">2</span>Misi Utama
                </h3>
                <ul className="text-zinc-400 text-xs space-y-2 list-disc list-inside leading-relaxed">
                  {schoolMisi.map((m: string, idx: number) => <li key={idx}>{m}</li>)}
                </ul>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link href="/profil/sejarah" className="block outline-none">
                <Card className="border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/80 backdrop-blur-md text-zinc-100 rounded-2xl cursor-pointer transition-all active:scale-[0.98] group h-full">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-zinc-800/80 flex items-center justify-center shrink-0 group-hover:bg-zinc-700/80 transition-colors">
                      <History className="h-5 w-5 text-zinc-300 group-hover:text-white transition-colors" />
                    </div>
                    <div className="space-y-1"><h4 className="text-sm font-bold text-white">Sejarah Sekolah</h4><p className="text-[10px] text-zinc-400 leading-snug">Jejak langkah dan perjalanan sekolah kami.</p></div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/profil/guru-staff" className="block outline-none">
                <Card className="border border-blue-900/30 bg-blue-950/20 hover:bg-blue-900/40 hover:border-blue-800/50 backdrop-blur-md text-zinc-100 rounded-2xl cursor-pointer transition-all active:scale-[0.98] group h-full">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-900/50 flex items-center justify-center shrink-0 group-hover:bg-blue-800/60 transition-colors">
                      <Users className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    </div>
                    <div className="space-y-1"><h4 className="text-sm font-bold text-blue-100">Guru & Staff</h4><p className="text-[10px] text-blue-200/60 leading-snug">Profil pendidik dan tenaga kependidikan.</p></div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section id="kurikulum" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Kurikulum & Ekstrakurikuler</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.program_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
              <BookOpen className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div><h4 className="font-bold text-sm">Kurikulum Merdeka</h4><p className="text-xs text-zinc-400 mt-1 leading-relaxed">Pembelajaran interaktif berbasis proyek untuk melatih anak berpikir kritis dan kolaboratif.</p></div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
              <Trophy className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div><h4 className="font-bold text-sm">Bakat & Minat Murid</h4><p className="text-xs text-zinc-400 mt-1 leading-relaxed">Fasilitas pembinaan olahraga, sains (robotik), dan seni tari tradisional/paduan suara.</p></div>
            </div>
            <Link href="/kurikulum" className="block w-full">
              <Button className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]">Lihat Detail Kurikulum & Ekskul</Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}