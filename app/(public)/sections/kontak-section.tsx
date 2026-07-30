"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact/contact-form";
import { containerVariants, itemVariants } from "../use-landing";

interface KontakSectionProps {
  landingTexts: { faq_desc: string; contact_desc: string };
  landingSections: Record<string, any>;
  contactSettings: any;
  settings: any;
  filteredFaqs: any[];
  faqSearch: string;
  setFaqSearch: (v: string) => void;
}

export function KontakSection({ landingTexts, contactSettings, settings, filteredFaqs }: KontakSectionProps) {
  return (
    <>
      {/* FAQ Section */}
      <section id="faq" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Tanya Jawab (FAQ)</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.faq_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-4">
            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="item-1" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">Bagaimana alur Pendaftaran Siswa Baru (SPMB)?</AccordionTrigger>
                <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">Lakukan pendaftaran di website, isi data diri & zonasi, upload berkas persyaratan (KK, Akta Lahir), pantau verifikasi panitia secara online di dashboard Anda.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">Berapa umur minimal untuk mendaftar kelas 1 SD?</AccordionTrigger>
                <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">Umur minimal adalah 6 tahun pada bulan Juli tahun berjalan, namun prioritas utama diberikan kepada anak usia 7 tahun ke atas sesuai juknis dinas pendidikan.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">Apakah ada biaya bulanan sekolah (SPP)?</AccordionTrigger>
                <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">Tidak ada. Seluruh operasional di UPTD SDN 1 Kenanga dibiayai penuh oleh dana Bantuan Operasional Sekolah (BOS) sehingga gratis untuk seluruh murid.</AccordionContent>
              </AccordionItem>
            </Accordion>
            <Link href="/faq" className="block">
              <Button className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]">Lihat Semua Tanya Jawab</Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Contact Section */}
      <section id="kontak" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Hubungi Kami</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.contact_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-6">
            <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-blue-400 shrink-0" /><span className="text-xs text-zinc-300 leading-relaxed">{contactSettings?.school_address || "Jl. Kenanga No. 1, Indramayu, Jawa Barat"}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-blue-400 shrink-0" /><span className="text-xs text-zinc-300">{contactSettings?.school_phone || "0812-3456-7890"}</span></div>
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-blue-400 shrink-0" /><span className="text-xs text-zinc-300">{contactSettings?.school_email || "sdn1kenanga@sch.id"}</span></div>
                <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-blue-400 shrink-0" /><span className="text-xs text-zinc-300">Senin - Jumat: 07:00 - 15:00 WIB</span></div>
              </CardContent>
            </Card>
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40 relative">
              <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
                src={`https://maps.google.com/maps?q=${contactSettings?.school_lat || -6.3273},${contactSettings?.school_lng || 108.3262}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full border-0 opacity-90 hover:opacity-100 transition-opacity duration-300" allowFullScreen />
            </div>
            <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
              <h4 className="font-bold text-sm mb-3 text-white">Kirim Pesan</h4>
              <ContactForm />
            </div>
          </motion.div>
          <motion.div variants={itemVariants} className="border-t border-zinc-800/60 pt-6 text-center">
            <p className="text-[10px] text-zinc-500">&copy; {new Date().getFullYear()} {settings?.school_name || "UPTD SDN 1 Kenanga"}. All rights reserved. Built with Next.js & Three.js.</p>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}