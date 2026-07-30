"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, Star } from "lucide-react";
import { containerVariants, itemVariants } from "../use-landing";

interface KeunggulanSectionProps {
  landingTexts: { excellence_desc: string };
  landingSections: { fasilitas?: { heading?: string; subheading?: string; items?: any[] } };
}

const iconMap: Record<string, React.ElementType> = { Sparkles, BookOpen, Star };

export function KeunggulanSection({ landingTexts, landingSections }: KeunggulanSectionProps) {
  const fasilitas = landingSections.fasilitas;

  return (
    <section id="keunggulan" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
        className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{fasilitas?.heading || "Fasilitas & Ekosistem Unggulan"}</h2>
          <p className="text-zinc-400 leading-relaxed text-sm">{fasilitas?.subheading || landingTexts.excellence_desc}</p>
        </motion.div>
        <motion.div variants={itemVariants} className="space-y-4">
          {(fasilitas?.items?.length ?? 0) > 0 ? (
            fasilitas!.items!.map((item: any, idx: number) => {
              const Icon = iconMap[item.icon] || Star;
              return (
                <div key={idx} className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                  {item.image && (
                    <div className="h-36 w-full relative overflow-hidden">
                      <Image src={item.image} alt={item.title} fill className="object-cover transition-transform duration-700 group-hover:scale-102" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon className="h-4 w-4 text-amber-400" /> {item.title}</h3>
                    <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              <div className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                <div className="h-36 w-full relative overflow-hidden">
                  <Image src="/images/kurikulum_merdeka.png" alt="Kurikulum" fill className="object-cover transition-transform duration-700 group-hover:scale-102" />
                </div>
                <div className="p-5"><h3 className="text-sm font-bold text-white flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-400" /> Kurikulum Merdeka Terpadu</h3><p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">Pembelajaran yang berpusat pada murid, mendorong pemikiran kritis dan kreatif dengan bimbingan penuh kasih dari para guru.</p></div>
              </div>
              <div className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                <div className="h-36 w-full relative overflow-hidden">
                  <Image src="/images/fasilitas_modern.png" alt="Fasilitas" fill className="object-cover transition-transform duration-700 group-hover:scale-102" />
                </div>
                <div className="p-5"><h3 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-400" /> Fasilitas & Laboratorium Modern</h3><p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">Akses ke koleksi buku lengkap, ruang komputer modern, serta program sains dasar ramah anak untuk memuaskan rasa ingin tahu mereka.</p></div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}