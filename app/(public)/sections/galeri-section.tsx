"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaEmbed } from "@/components/ui/media-embed";
import { containerVariants, itemVariants } from "../use-landing";

interface GaleriSectionProps {
  landingTexts: { gallery_desc: string };
  galleryItems: any[];
  isGalleryLoading: boolean;
  selectedImage: any;
  setSelectedImage: (v: any) => void;
}

export function GaleriSection({ landingTexts, galleryItems, isGalleryLoading, selectedImage, setSelectedImage }: GaleriSectionProps) {
  return (
    <>
      <section id="galeri" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-900/30 text-xs font-semibold text-emerald-400">
              <Camera className="h-3.5 w-3.5" />Dokumentasi Kegiatan
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Galeri Dokumentasi</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.gallery_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-4">
            {isGalleryLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">Belum ada dokumentasi foto.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {galleryItems.slice(0, 4).map((item: any) => (
                  <div key={item.id} onClick={() => setSelectedImage(item)}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-zinc-800/60 bg-zinc-900/50 active:scale-[0.98] active:translate-y-[1px] transition-all duration-300">
                    <MediaEmbed url={item.imageUrl} alt={item.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <span className="text-[10px] font-medium text-white truncate w-full">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link href="/galeri" className="block">
              <Button className="w-full h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]">Buka Galeri Lengkap</Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-none shadow-2xl text-white rounded-2xl">
          <DialogTitle className="sr-only">Detail Foto</DialogTitle>
          <div className="relative w-full h-[70vh] flex flex-col">
            <div className="relative flex-1 w-full bg-black/40">
              {selectedImage && <MediaEmbed url={selectedImage.imageUrl} alt={selectedImage.title} fill className="object-contain" />}
            </div>
            {selectedImage && (
              <div className="p-4 bg-zinc-950/80 border-t border-zinc-900 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-white leading-none">{selectedImage.title}</h4>
                  <span className="text-[9px] text-zinc-500 mt-1 block capitalize">{selectedImage.category}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedImage(null)} className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}